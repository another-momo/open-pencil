<script setup lang="ts">
import { useTimeoutFn } from '@vueuse/core'
import {
  ComboboxAnchor,
  ComboboxContent,
  ComboboxInput,
  ComboboxItem,
  ComboboxItemIndicator,
  ComboboxPortal,
  ComboboxRoot,
  ComboboxTrigger,
  ComboboxViewport,
  TooltipProvider
} from 'reka-ui'
import { computed, nextTick, onMounted, ref } from 'vue'

import ChatModeChips from '@/components/chat/ChatModeChips.vue'
import {
  atomicSkillTokenDeletionRange,
  atomicTokenDeletionRange,
  captureSelectionFromStore,
  createSelectionDraftState,
  resetSelectionDraftState,
  restoreSelectionDraftState,
  scanSelectionTokens,
  scanSkillTokens,
  selectionTokenText,
  serializeSelectionManifest,
  skillTokenText,
  snapshotSelectionDraftState,
  stripSelectionManifest,
  stripSkillTokenBrackets,
  type SelectionDraftState
} from '@/components/chat/selection-capture'
import IconButton from '@/components/ui/IconButton.vue'
import InputGroup from '@/components/ui/InputGroup.vue'
import { piDesignAssignment } from '@/app/ai/pi-backend/assignment'
import {
  ensurePiStudioManifest,
  piStudioManifest,
  piStudioManifestFailed,
  retryPiStudioManifest
} from '@/app/ai/pi-backend/mode-selection'
import { getActiveEditorStoreOrNull } from '@/app/editor/active-store'
import { openSettingsDialog } from '@/app/settings/dialog'
import { useI18n } from '@open-pencil/vue'

import { useForkChips, useForkPi } from '@/app/i18n/fork'
const { dialogs } = useI18n()
const piDialogs = useForkPi()
const chipsText = useForkChips()

const { status, disabled = false } = defineProps<{
  status: 'ready' | 'submitted' | 'streaming' | 'error'
  disabled?: boolean
}>()

const emit = defineEmits<{
  submit: [text: string]
  stop: []
  error: [message: string]
}>()

const input = ref('')

const isStreaming = computed(() => disabled || status === 'streaming' || status === 'submitted')

// ── T70：画布选区采集（内联 token「@画布选区-N」，路线 A = overlay 高亮
//    textarea；契约与格式钉扎在 selection-capture.ts 头部注释） ──────────────
//
// 草稿期 token 状态（登记表 + 序号）刻意不进响应式系统：模板渲染只依赖
// input 文本实扫（backdropSegments），状态仅在采集/提交/回填时读写。
const draftTokens = createSelectionDraftState()
// T27 快照：提交即清空文本+登记表；失败回填时两者一并恢复（restoreDraft）
let lastDraftSnapshot: SelectionDraftState | null = null

const inputRef = ref<HTMLTextAreaElement | null>(null)
const backdropRef = ref<HTMLElement | null>(null)

/** 空选区轻提示：actionToast 桌面端无渲染面（仅 MobileHud 消费），按计划
 *  退化为按钮短暂文案反馈（T70-plan §1.1「若无则按钮短暂文案反馈」） */
const captureEmptyFlash = ref(false)
const { start: scheduleCaptureFlashEnd, stop: cancelCaptureFlashEnd } = useTimeoutFn(
  () => {
    captureEmptyFlash.value = false
  },
  1600,
  { immediate: false }
)

/** backdrop 高亮分段：文本流实扫占位串 → token 段染底色（glyph 由上层
 *  textarea 提供，backdrop 全透明文字 + token 段背景块，Twitter mention 同款）。
 *  T89：合并扫描「@画布选区-N」与「@skill-<name>」两类 token——同名 token
 *  类型共用高亮样式，按 start 序合并渲染段 */
const backdropSegments = computed(() => {
  const text = input.value
  const selTokens = scanSelectionTokens(text).map((t) => ({
    kind: 'sel' as const,
    start: t.start,
    end: t.end
  }))
  const skillTokens = scanSkillTokens(text).map((t) => ({
    kind: 'skill' as const,
    start: t.start,
    end: t.end
  }))
  const tokens = [...selTokens, ...skillTokens].sort((a, b) => a.start - b.start)
  const segments: Array<{ key: number; text: string; token: boolean }> = []
  let cursor = 0
  for (const token of tokens) {
    if (token.start > cursor) {
      segments.push({ key: segments.length, text: text.slice(cursor, token.start), token: false })
    }
    segments.push({ key: segments.length, text: text.slice(token.start, token.end), token: true })
    cursor = token.end
  }
  if (cursor < text.length) {
    segments.push({ key: segments.length, text: text.slice(cursor), token: false })
  }
  // 尾部 ZWSP：末尾换行在 div 里塌缩不占高，补上以对齐 textarea 滚动度量
  segments.push({ key: segments.length, text: '\u200B', token: false })
  return segments
})

function syncBackdropScroll() {
  const el = inputRef.value
  const backdrop = backdropRef.value
  if (el && backdrop) backdrop.scrollTop = el.scrollTop
}

function insertTokenAtCursor(token: string) {
  const el = inputRef.value
  const current = input.value
  // 采集按钮 @mousedown.prevent 不抢焦点——仍聚焦 textarea 时插光标处；
  // 无焦点（尚未点过输入框）追加文末
  if (!el || document.activeElement !== el) {
    input.value = current + token
    void nextTick(() => {
      el?.focus()
      el?.setSelectionRange(input.value.length, input.value.length)
    })
    return
  }
  const start = el.selectionStart ?? current.length
  const end = el.selectionEnd ?? current.length
  input.value = current.slice(0, start) + token + current.slice(end)
  void nextTick(() => {
    el.setSelectionRange(start + token.length, start + token.length)
  })
}

function handleCaptureSelection() {
  const store = getActiveEditorStoreOrNull()
  if (!store) return
  const entry = captureSelectionFromStore(store, draftTokens.nextSeq)
  if (!entry) {
    captureEmptyFlash.value = true
    cancelCaptureFlashEnd()
    scheduleCaptureFlashEnd()
    return
  }
  draftTokens.nextSeq += 1
  draftTokens.registry.set(entry.n, entry)
  insertTokenAtCursor(selectionTokenText(entry.n))
}

/** 原子删除：光标紧邻完整占位串时 Backspace/Delete 整段删除（路线 A 的
 *  keydown 拦截面）；已拦截返回 true。
 *  T89：两类 token 共用此拦截面（selection + skill），按检查优先 selection →
 *  skill（任一命中即整段删） */
function handleAtomicTokenDeletion(event: KeyboardEvent): boolean {
  const el = event.currentTarget
  if (!(el instanceof HTMLTextAreaElement)) return false
  if (event.isComposing || el.selectionStart !== el.selectionEnd) return false
  const dir = event.code === 'Backspace' ? 'backward' : 'forward'
  const selRange = atomicTokenDeletionRange(input.value, el.selectionStart, dir)
  const range = selRange ?? atomicSkillTokenDeletionRange(input.value, el.selectionStart, dir)
  if (!range) return false
  event.preventDefault()
  input.value = input.value.slice(0, range.start) + input.value.slice(range.end)
  void nextTick(() => {
    el.setSelectionRange(range.start, range.start)
  })
  return true
}
// T21：模型由后端 catalog/指派决定，聊天输入只读展示当前指派
// T25：pi 已是唯一路径（门退役），旧模型/资料切换臂与图片附件流已切除
// （图片从不进 pi 后端——analyze 直通已随旧面删除，C4a 通道 B 落地时恢复）
// T61：T24 ChatModeSelect/ChatStyleProfileSelect 退役——mode/profile 由 chips
// （active_design 回显 + 新建意图暂存）承载
// T65（决策 A/B）：输入条瘦身——只放随下次发送生效的内容（mode/profile chips +
// 模型名 label 暂留）；设计/需求单/gallery 三面板按钮移出，状态查看归 header 的
// 画布工作状态面板（ChatContextBar），gallery 组件删除

// T24→T61：manifest 数据源不变；失败改显式暴露（错误条 + 重试，08 P0-2）
onMounted(() => {
  void ensurePiStudioManifest()
})
const piModelLabel = computed(
  // T38：useForkPi() 返回 Ref——script 内访问必须 .value（T35 曾丢 .value 致标签空白）
  () => piDesignAssignment.value?.modelId ?? piDialogs.value.designModelDefault
)

// T65（决策 B2/E）→ T66（决策①）：空槽引导从输入条删除——状态显示收敛为
// header ChatContextBar 双段式 trigger 一处（trigger 文案本身即引导）

function handleInputKeydown(event: KeyboardEvent) {
  // T70：Backspace/Delete 先过原子删除拦截（紧邻完整占位串 → 整段删除）；
  // IME 合成中/有选区时不拦（isComposing/selectionStart≠selectionEnd 在
  // handleAtomicTokenDeletion 内判）
  if (event.code === 'Backspace' || event.code === 'Delete') {
    if (handleAtomicTokenDeletion(event)) return
  }
  if (event.code !== 'Enter' || event.shiftKey || event.isComposing) return
  event.preventDefault()
  const target = event.currentTarget
  if (target instanceof HTMLElement) target.closest('form')?.requestSubmit()
}

// T89：skill dropdown（替代 T87 chip 平铺）——reka-ui ComboboxRoot + chip 形态
// trigger + 选项点击触发 insertTokenAtCursor。skills 数据面来源 = manifest.skills
// （脱敏投影，OFF 时恒 []；capabilities 关则 listSkills 守门不在结果中暴露）。
// 用户在 dropdown 内选中即向 textarea 插入「「/skill:<name>」」内联 token
// （中文角括号是混排原子边界 / backdrop 高亮锚点，与 @画布选区-N 同款 UI 表达）。
// 提交时 `stripSkillTokenBrackets` 仅剥中文角括号（主体不动），emit 出去的
// 是 `/skill:<name>` 字面串（pi SDK _expandSkillCommand 唯一识别斜杠形式）。
// 取消选中靠 textarea 内删除 token 或 atomic-deletion 拦截面。
const skillSearch = ref('')
const skillComboboxOpen = ref(false)

const availableSkills = computed(() => {
  const manifest = piStudioManifest.value
  if (!manifest || !manifest.capabilities.agentSkills) return []
  return manifest.skills
})

const filteredSkills = computed(() => {
  const needle = skillSearch.value.trim().toLowerCase()
  if (!needle) return availableSkills.value
  return availableSkills.value.filter(
    (s) => s.name.toLowerCase().includes(needle) || s.description.toLowerCase().includes(needle)
  )
})

function handleSkillSelect(name: string): void {
  insertTokenAtCursor(skillTokenText(name))
  skillSearch.value = ''
  // 触发后 refocus textarea，让用户继续输入
  void nextTick(() => {
    inputRef.value?.focus()
  })
}

function handleSubmit(e: Event) {
  e.preventDefault()
  const text = input.value.trim()
  if (!text) return
  // T70：文本流实扫占位串 → 尾部追加 [画布选区] 清单（发送瞬间 graph 状态
  // 为准；无 token 时 serialize 原样返回）。store 缺席（storybook/测试面）
  // 退化为原文提交。
  const store = getActiveEditorStoreOrNull()
  const submission = store
    ? serializeSelectionManifest(text, draftTokens.registry, store.graph)
    : { text }
  // T27 快照先行：emit 即清空文本+登记表，失败回填（restoreDraft）整体恢复
  lastDraftSnapshot = snapshotSelectionDraftState(draftTokens)
  // T89：skill token 中文角括号剥除（主体不动，仍是 pi SDK 识别的
  // `/skill:<name>` 字面串）。strip 在 selection manifest 拼完之后执行，
  // 避免误吃清单内可能含的角括号
  emit('submit', stripSkillTokenBrackets(submission.text))
  input.value = ''
  resetSelectionDraftState(draftTokens)
}

// T27：父级在提交失败时回填草稿（emit 即清空是即时反馈设计，失败不该丢稿）；
// 用户已另起新输入时不覆盖
// T70：回填文本 = 提交文本剥掉尾部 [画布选区] 清单（占位串本体保留）；
// token 登记表 + 序号从快照一并恢复（快照只消费一次，防旧快照串新稿）
function restoreDraft(text: string) {
  if (input.value.trim()) return
  input.value = stripSelectionManifest(text)
  if (lastDraftSnapshot) {
    restoreSelectionDraftState(draftTokens, lastDraftSnapshot)
    lastDraftSnapshot = null
  }
}
// T61：新建意图确认卡「确认并发送」经父级清掉拦截时回填的草稿
// T70：token 登记表/序号/快照随草稿一并清空（序号归 1）
function clearDraft() {
  input.value = ''
  resetSelectionDraftState(draftTokens)
  lastDraftSnapshot = null
}
defineExpose({ restoreDraft, clearDraft })
</script>

<template>
  <TooltipProvider>
    <div class="shrink-0 border-t border-border p-2.5">
      <!-- T61：manifest 失败显式暴露（chips 禁用联动 ChatModeChips） -->
      <div
        v-if="piStudioManifestFailed"
        data-test-id="chat-manifest-error"
        class="mb-2 flex items-center gap-2 rounded-md border border-red-500/30 bg-red-500/10 px-2.5 py-1.5"
      >
        <icon-lucide-triangle-alert class="size-3.5 shrink-0 text-red-400" />
        <span class="min-w-0 flex-1 text-[11px] text-red-300">
          {{ chipsText.chipsManifestFailed }}
        </span>
        <button
          type="button"
          data-test-id="chat-manifest-retry"
          class="shrink-0 rounded-md border border-red-500/40 px-2 py-0.5 text-[11px] text-red-300 hover:bg-red-500/20"
          @click="retryPiStudioManifest"
        >
          {{ chipsText.chipsRetry }}
        </button>
      </div>
      <!-- T89：actions 行（采集画布选区 + skill dropdown），位于 textarea 上方
           一处承载两件事。采集按钮永远渲染；skill dropdown trigger 仅在
           capabilities.agentSkills && skills.length > 0 时渲染 -->
      <div class="mb-2 flex items-center gap-1" data-test-id="chat-actions-row">
        <!-- T89（原 T70）：采集画布选区——从原 InputGroup attachment slot 挪出。
             空选区 → 按钮短暂文案反馈、不产生 token；非空 → 光标处插入
             「@画布选区-N」内联 token -->
        <button
          type="button"
          data-test-id="chat-capture-selection"
          :disabled="isStreaming"
          class="flex items-center gap-1 rounded-md border border-border px-1.5 py-0.5 text-[11px] text-muted hover:border-accent/50 hover:text-surface disabled:cursor-not-allowed disabled:opacity-60"
          @mousedown.prevent
          @click="handleCaptureSelection"
        >
          <icon-lucide-scan class="size-3 shrink-0" />
          <span>
            {{ captureEmptyFlash ? chipsText.chipsCaptureEmpty : chipsText.chipsCaptureSelection }}
          </span>
        </button>
        <!-- T89 skill dropdown：reka-ui ComboboxRoot + chip 形态 trigger + 选项
             点击触发 insertTokenAtCursor。ignore-filter 关掉 SDK 默认过滤，
             用本地 filteredSkills（按 name + description 子串模糊匹配）。 -->
        <ComboboxRoot
          v-if="availableSkills.length > 0"
          v-model:open="skillComboboxOpen"
          v-model:search-term="skillSearch"
          :ignore-filter="true"
        >
          <ComboboxAnchor as-child>
            <ComboboxTrigger
              data-test-id="chat-skill-trigger"
              class="flex items-center gap-1 rounded-md border border-border px-1.5 py-0.5 text-[11px] text-muted hover:border-accent/50 hover:text-surface data-[state=open]:border-accent/60 data-[state=open]:text-surface"
              :disabled="isStreaming"
            >
              <icon-lucide-sparkles class="size-3 shrink-0" />
              <span class="truncate">{{ chipsText.chipsSkillChoose }}</span>
              <icon-lucide-chevron-down class="size-3 shrink-0 opacity-60" />
            </ComboboxTrigger>
          </ComboboxAnchor>
          <ComboboxPortal>
            <ComboboxContent
              position="popper"
              :side-offset="4"
              class="z-50 max-h-64 min-w-[var(--reka-combobox-anchor-width)] overflow-hidden rounded-md border border-border bg-panel shadow-lg"
            >
              <ComboboxInput
                v-model="skillSearch"
                :placeholder="chipsText.chipsSkillSearchPlaceholder"
                data-test-id="chat-skill-search"
                class="w-full border-b border-border bg-transparent px-2.5 py-1.5 text-[11px] outline-none placeholder:text-muted"
              />
              <ComboboxViewport class="max-h-52 overflow-y-auto p-1">
                <ComboboxItem
                  v-for="skill in filteredSkills"
                  :key="skill.name"
                  :value="skill.name"
                  data-test-id="chat-skill-option"
                  class="flex cursor-pointer flex-col gap-0.5 rounded px-2 py-1 text-[11px] outline-none data-[highlighted]:bg-hover"
                  @select="handleSkillSelect(skill.name)"
                >
                  <span class="font-medium text-surface">「/skill:{{ skill.name }}」</span>
                  <span v-if="skill.description" class="text-muted">{{ skill.description }}</span>
                  <ComboboxItemIndicator class="hidden" />
                </ComboboxItem>
                <div
                  v-if="filteredSkills.length === 0"
                  class="px-2 py-1 text-[11px] text-muted"
                  data-test-id="chat-skill-empty"
                >
                  {{ chipsText.chipsSkillEmpty }}
                </div>
              </ComboboxViewport>
            </ComboboxContent>
          </ComboboxPortal>
        </ComboboxRoot>
      </div>
      <form @submit="handleSubmit">
        <InputGroup :disabled="isStreaming">
          <!-- T70 路线 A：overlay 高亮 textarea——backdrop 在下层同步渲染文本流
               （全透明字形 + token 段背景块），textarea 承载输入/IME/光标；
               折行对齐靠同字号/行高/内边距 + whitespace-pre-wrap，滚动单向同步 -->
          <div class="relative">
            <div
              ref="backdropRef"
              aria-hidden="true"
              class="pointer-events-none absolute inset-0 overflow-hidden px-3 pt-2.5 pb-1 text-xs leading-relaxed break-words whitespace-pre-wrap text-transparent select-none"
              :class="{ 'opacity-60': isStreaming }"
            >
              <span
                v-for="segment in backdropSegments"
                :key="segment.key"
                :class="
                  segment.token ? 'box-decoration-clone rounded-[3px] bg-accent/25' : undefined
                "
                >{{ segment.text }}</span
              >
            </div>
            <textarea
              ref="inputRef"
              v-model="input"
              data-test-id="chat-input"
              :placeholder="dialogs.describeChange"
              :disabled="isStreaming"
              rows="2"
              aria-label="Describe a change"
              class="relative block min-h-12 w-full resize-none bg-transparent px-3 pt-2.5 pb-1 text-xs leading-relaxed text-surface outline-none placeholder:text-muted disabled:cursor-not-allowed disabled:opacity-60"
              @keydown="handleInputKeydown"
              @scroll="syncBackdropScroll"
              @copy.stop
              @cut.stop
            />
          </div>

          <template #model>
            <div class="flex min-w-0 items-center">
              <div
                class="flex min-w-0 items-center gap-1 px-1.5 text-[10px] text-muted"
                data-test-id="chat-pi-model-label"
              >
                <icon-lucide-bot class="size-3 shrink-0" />
                <span class="truncate">{{ piModelLabel }}</span>
                <!-- T61：chips（active_design 回显 + 新建意图暂存）——输入条终态
                     = mode chip + profile chip + 模型名（T65 决策 B4 暂留） -->
                <ChatModeChips :disabled="isStreaming" />
              </div>
            </div>
          </template>

          <template #actions>
            <IconButton
              :label="dialogs.providerSettings"
              size="sm"
              data-test-id="provider-settings-trigger"
              @click="openSettingsDialog('ai')"
            >
              <icon-lucide-settings class="size-3.5" />
            </IconButton>
            <IconButton
              v-if="isStreaming"
              :label="dialogs.stopGenerating"
              size="sm"
              data-test-id="chat-stop-button"
              class="border border-border"
              @click="emit('stop')"
            >
              <icon-lucide-square class="size-3" />
            </IconButton>
            <IconButton
              v-else
              :label="dialogs.sendMessage"
              size="sm"
              type="submit"
              data-test-id="chat-send-button"
              class="bg-accent text-white hover:bg-accent/90 hover:text-white"
              :disabled="!input.trim()"
            >
              <icon-lucide-send class="size-3.5" />
            </IconButton>
          </template>
        </InputGroup>
      </form>
    </div>
  </TooltipProvider>
</template>

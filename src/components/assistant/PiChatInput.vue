<script setup lang="ts">
// Batch 2a 命名分离（2026-09-05）：本组件自 ChatInput.vue 改名 PiChatInput.vue，
// 原名留给 deletedPaths 落账——组件已实质重写，与上游 ChatInput 无合并语义。
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
import { computed, nextTick, onMounted, ref, watch } from 'vue'

import ChatModeChips from '@/components/assistant/ChatModeChips.vue'
import ChatNodePreview from '@/components/assistant/ChatNodePreview.vue'
import { resolveSelectionTokenChips } from '@/components/assistant/node-preview'
import {
  atomicTokenDeletionRange,
  captureSelectionFromStore,
  createSelectionDraftState,
  removeSelectionToken,
  resetSelectionDraftState,
  restoreSelectionDraftState,
  scanSelectionTokens,
  selectionTokenText,
  serializeSelectionManifest,
  snapshotSelectionDraftState,
  stripSelectionManifest,
  type SelectionDraftState
} from '@/components/assistant/selection-capture'
import {
  composeSkillSubmission,
  extractLeadingSkillCommand
} from '@/components/assistant/skill-chip'
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
import type { SkiaRenderer } from '@open-pencil/core/canvas'
import type { SceneGraph } from '@open-pencil/scene-graph'
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

/** backdrop 文本流分段：纯字形对齐层——无 token 染底（视觉表达完全交给
 *  attachment chip 行；backdrop 仅承担 textarea 滚动度量 + 折行对齐的
 *  全透明字符镜像）。保留 token 段扫描是因 selection-capture 的 scan API
 *  单一出口（serialize 也用同扫描器）。 */
const backdropSegments = computed(() => {
  const text = input.value
  const tokens = scanSelectionTokens(text).map((t) => ({
    start: t.start,
    end: t.end
  }))
  const segments: Array<{ key: number; text: string }> = []
  let cursor = 0
  for (const token of tokens) {
    if (token.start > cursor) {
      segments.push({ key: segments.length, text: text.slice(cursor, token.start) })
    }
    // token 段继续拆出（与 textarea 文本流逐字对齐），但不染底
    segments.push({ key: segments.length, text: text.slice(token.start, token.end) })
    cursor = token.end
  }
  if (cursor < text.length) {
    segments.push({ key: segments.length, text: text.slice(cursor) })
  }
  // 尾部 ZWSP：末尾换行在 div 里塌缩不占高，补上以对齐 textarea 滚动度量
  segments.push({ key: segments.length, text: '\u200B' })
  return segments
})

// Batch 2g：token chip 条（InputGroup attachment slot）——文本流实扫到的
// 已采集 token 每个渲一条 chip（首节点缩略图 + 节点名）；手打无登记占位串
// 不进 chip 条（纪律见 node-preview.ts 头部）。registry 刻意非响应式：其
// 每次变动都伴随 input 变动（采集/手删/回填/清空），input 实扫即充分触发；
// sceneVersion 触碰让采集后改名/删除在 chip 名上如实反映（与 serialize
// 同口径）
const tokenChips = computed(() => {
  const store = getActiveEditorStoreOrNull()
  if (store) void store.state.sceneVersion
  return resolveSelectionTokenChips(input.value, draftTokens.registry, store?.graph ?? null)
})

// chip 缩略图渲染上下文：不用 computed——renderer 挂载是非响应式事件，模板
// 重渲染（chip 出现/变化必伴随 input 变动）时直取现值即可；store 缺席
// （storybook/测试面）→ null，ChatNodePreview 降级为 box 图标 + 名称
function chipRenderContext(): { graph: SceneGraph | null; renderer: SkiaRenderer | null } {
  const store = getActiveEditorStoreOrNull()
  return { graph: store?.graph ?? null, renderer: store?.renderer ?? null }
}

function syncBackdropScroll() {
  const el = inputRef.value
  const backdrop = backdropRef.value
  if (el && backdrop) backdrop.scrollTop = el.scrollTop
  // T91p：chip 是绝对定位覆盖层，不随 textarea 内容滚动——垂直滚动时手动
  // 同步位移，保持与首行正文对齐
  const chip = skillChipRef.value
  if (el && chip) chip.style.transform = el.scrollTop > 0 ? `translateY(-${el.scrollTop}px)` : ''
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

/** chip 行 X 按钮：从文本流里删掉该 n 的全部占位串（视觉代理消失 = 文本同步）——
 *  payload 不变（提交仍走 serializeSelectionManifest，少一条占位串 → 清单少一行） */
function handleRemoveToken(n: number) {
  const next = removeSelectionToken(input.value, n)
  if (next === input.value) return
  const el = inputRef.value
  input.value = next
  void nextTick(() => {
    el?.focus()
    // 光标落到删除段起点（最左一个匹配位）即可——剩余光标位置由用户接管
    const cursor = Math.min(input.value.length, el ? el.selectionStart : input.value.length)
    el?.setSelectionRange(cursor, cursor)
  })
}

/** 原子删除：光标紧邻完整占位串时 Backspace/Delete 整段删除（路线 A 的
 *  keydown 拦截面）；已拦截返回 true。
 *  T91p：skill chip 化后文本内只剩选区 token 一类 */
function handleAtomicTokenDeletion(event: KeyboardEvent): boolean {
  const el = event.currentTarget
  if (!(el instanceof HTMLTextAreaElement)) return false
  if (event.isComposing || el.selectionStart !== el.selectionEnd) return false
  const dir = event.code === 'Backspace' ? 'backward' : 'forward'
  const range = atomicTokenDeletionRange(input.value, el.selectionStart, dir)
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
  // T91p：光标在 0 位且有钉头 chip 时 Backspace 移除 chip（chip 不进文本流，
  // 它是光标前唯一的「东西」；mention chip 行首 Backspace 删除的通行交互）
  if (event.code === 'Backspace' && pinnedSkill.value && !event.isComposing) {
    const el = event.currentTarget
    if (el instanceof HTMLTextAreaElement && el.selectionStart === 0 && el.selectionEnd === 0) {
      event.preventDefault()
      pinnedSkill.value = null
      return
    }
  }
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

// T91p：skill chip（钉头单例内联芯片，替代 T89 文本内 token）——owner 决议：
// skill 是命令不是引用，与选区 token（任意位置、多实例）本质不同；chip 恒钉
// 消息最前、全消息最多一个、新选覆盖旧选。chip 是纯组件状态（pinnedSkill），
// 不进 textarea 文本流（文本态可被光标进入逐字编辑，观感怪异）；视觉上以
// 覆盖层 chip + textarea/backdrop text-indent 让出首行宽度实现「在输入框内、
// 与正文同行同高」（owner 效果图）。提交时 composeSkillSubmission 把
// `/skill:<name>` 拼到消息头（后端 T91o normalizeSkillCommandText 再兜底
// 手输/粘贴的裸提及）；移除靠光标在 0 位时按 Backspace。
// skills 数据面来源 = manifest.skills（脱敏投影，OFF 时恒 []；capabilities
// 关则 listSkills 守门不在结果中暴露）。
const skillSearch = ref('')
const skillComboboxOpen = ref(false)
/** 钉头 skill chip（null = 未选）；新选直接覆盖旧选 */
const pinnedSkill = ref<string | null>(null)
const skillChipRef = ref<HTMLElement | null>(null)
/** chip 实测宽度 → textarea/backdrop 首行 text-indent（chip 与正文同行衔接） */
const skillChipIndent = ref(0)

watch(pinnedSkill, async () => {
  await nextTick()
  skillChipIndent.value =
    pinnedSkill.value && skillChipRef.value ? skillChipRef.value.offsetWidth : 0
})

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

// T91m：reka ComboboxItem 在 select 后会 `modelValue.value = props.value`
// 并在 ComboboxInput 侧挂 `watch(modelValue, { immediate: true })` ——
// 每次重新挂载（Presence 控制，开关 dropdown 即重挂）时，watcher 从
// `rootContext.modelValue` 推回 input 的 searchTerm。若不清 modelValue，
// 上次选中的 skill 名会随重挂一起回到输入框（owner 实测）。
// 解决：在 select 事件里 `event.preventDefault()` 阻断 reka 的 onSelect 续作
// （既不写 modelValue 也不自动关 dropdown），由我们手动 `skillComboboxOpen
// = false` 关闭；modelValue 保持 undefined，下次挂载 watcher 读 undefined →
// `resetSearchTerm()` 走 else 分支写 ''，输入框干净。同时去掉 Root 上无意义
// 的 `v-model:search-term`（Root 没声明此 prop，是 dead binding，混入会让
// reviewer 误以为双重写源）。
function handleSkillSelect(event: Event, name: string): void {
  event.preventDefault()
  // 钉头单例：赋值即覆盖旧选
  pinnedSkill.value = name
  skillSearch.value = ''
  skillComboboxOpen.value = false
  // 触发后 refocus textarea，让用户继续输入
  void nextTick(() => {
    inputRef.value?.focus()
  })
}

function handleSubmit(e: Event) {
  e.preventDefault()
  const text = input.value.trim()
  // T91p：chip 单独成命令也允许提交（`/skill:<name>` 纯命令，SDK
  // spaceIndex=-1 路径，args 为空）
  if (!text && !pinnedSkill.value) return
  // T70：文本流实扫占位串 → 尾部追加 [画布选区] 清单（发送瞬间 graph 状态
  // 为准；无 token 时 serialize 原样返回）。store 缺席（storybook/测试面）
  // 退化为原文提交。
  const store = getActiveEditorStoreOrNull()
  const submission = store
    ? serializeSelectionManifest(text, draftTokens.registry, store.graph)
    : { text }
  // T27 快照先行：emit 即清空文本+登记表，失败回填（restoreDraft）整体恢复
  lastDraftSnapshot = snapshotSelectionDraftState(draftTokens)
  // T91p：chip 拼到消息头（composeSkillSubmission；SDK 命令契约的宿主侧
  // 整形兜底在 backend normalizeSkillCommandText，双层幂等）
  emit('submit', composeSkillSubmission(pinnedSkill.value, submission.text))
  input.value = ''
  pinnedSkill.value = null
  resetSelectionDraftState(draftTokens)
}

// T27：父级在提交失败时回填草稿（emit 即清空是即时反馈设计，失败不该丢稿）；
// 用户已另起新输入（或已另选 chip）时不覆盖
// T70：回填文本 = 提交文本剥掉尾部 [画布选区] 清单（占位串本体保留）；
// token 登记表 + 序号从快照一并恢复（快照只消费一次，防旧快照串新稿）
// T91p：提交文本开头的 /skill:<name> 命令拆回 chip 状态（extractLeadingSkillCommand）
function restoreDraft(text: string) {
  if (input.value.trim() || pinnedSkill.value) return
  const command = extractLeadingSkillCommand(text)
  if (command) pinnedSkill.value = command.name
  input.value = stripSelectionManifest(command ? command.rest : text)
  if (lastDraftSnapshot) {
    restoreSelectionDraftState(draftTokens, lastDraftSnapshot)
    lastDraftSnapshot = null
  }
}
// T61：新建意图确认卡「确认并发送」经父级清掉拦截时回填的草稿
// T70：token 登记表/序号/快照随草稿一并清空（序号归 1）
// T91p：chip 状态随草稿一并清空
function clearDraft() {
  input.value = ''
  pinnedSkill.value = null
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
        <!-- T89 skill dropdown：reka-ui ComboboxRoot + chip 形态 trigger；
             T91p：选项点击钉 pinnedSkill（不再插文本 token）。ignore-filter
             关掉 SDK 默认过滤，用本地 filteredSkills（按 name + description
             子串模糊匹配）。 -->
        <ComboboxRoot
          v-if="availableSkills.length > 0"
          v-model:open="skillComboboxOpen"
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
            <!-- T91m：max-w 盖帽 + 单行截断——长 description 曾把 popover
                 撑到 2321px 横贯页面（owner 实测）；每项一行名称+一行描述；
                 min-w 锚宽语义保留 -->
            <ComboboxContent
              position="popper"
              :side-offset="4"
              class="z-50 max-h-64 w-max max-w-[min(28rem,calc(100vw-2rem))] min-w-[var(--reka-combobox-anchor-width)] overflow-hidden rounded-md border border-border bg-panel shadow-lg"
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
                  @select="handleSkillSelect($event, skill.name)"
                >
                  <span class="truncate font-medium text-surface">「/skill:{{ skill.name }}」</span>
                  <span v-if="skill.description" class="truncate text-muted">{{
                    skill.description
                  }}</span>
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
          <!-- Batch 2g：token chip 条——文本流实扫到的已采集引用 token 每个
               一条 chip（首节点缩略图 + 节点名 + 移除 X）；视觉代理完全承担
               选区的输入框呈现（backdrop 不再染底，只做对齐层）。X 按钮从
               文本流里删掉该 n 的全部占位串（payload 序列化实扫，删占位串
               = 清单少一行，提交语义不变）。renderer 缺席/渲染失败时缩略图
               位降级为 box 图标（ChatNodePreview 内部兜底） -->
          <template v-if="tokenChips.length > 0" #attachment>
            <div class="flex flex-wrap gap-1 px-2 pt-2">
              <div
                v-for="chip in tokenChips"
                :key="chip.n"
                data-test-id="chat-token-chip"
                :data-token-n="chip.n"
                class="flex min-w-0 max-w-full items-center gap-1 rounded-md border border-border bg-canvas py-0.5 pr-0.5 pl-1.5 text-[11px] text-surface"
              >
                <ChatNodePreview
                  :node-id="chip.preview.nodeId"
                  :page-id="chip.preview.pageId"
                  :graph="chipRenderContext().graph"
                  :renderer="chipRenderContext().renderer"
                />
                <span class="min-w-0 truncate">{{ chip.label }}</span>
                <button
                  type="button"
                  :data-test-id="`chat-token-chip-remove`"
                  :data-token-n="chip.n"
                  :aria-label="`移除引用 ${chip.label}`"
                  class="flex size-4 shrink-0 items-center justify-center rounded text-muted hover:bg-hover hover:text-surface focus:outline-none focus-visible:ring-1 focus-visible:ring-accent"
                  @mousedown.prevent
                  @click="handleRemoveToken(chip.n)"
                >
                  <icon-lucide-x class="size-3" />
                </button>
              </div>
            </div>
          </template>
          <!-- T70 路线 A → Batch 2g：overlay 对齐层——backdrop 在下层渲染全透明
               字形（无 token 染底；视觉表达完全交给 attachment chip），
               textarea 承载输入/IME/光标；折行对齐靠同字号/行高/内边距 +
               whitespace-pre-wrap，滚动单向同步 -->
          <div class="relative">
            <div
              ref="backdropRef"
              aria-hidden="true"
              class="pointer-events-none absolute inset-0 overflow-hidden px-3 pt-2.5 pb-1 text-xs leading-relaxed break-words whitespace-pre-wrap text-transparent select-none"
              :class="{ 'opacity-60': isStreaming }"
              :style="skillChipIndent > 0 ? { textIndent: `${skillChipIndent}px` } : undefined"
            >
              <span
                v-for="segment in backdropSegments"
                :key="segment.key"
                >{{ segment.text }}</span
              >
            </div>
            <!-- T91p：钉头 skill chip——覆盖层渲染（accent 色 icon + 名称，
                 整体不可编辑、不抢指针事件），textarea/backdrop 用同值
                 text-indent 让出首行宽度；宽度实测见 watch(pinnedSkill)；
                 垂直滚动位移同步见 syncBackdropScroll -->
            <div
              v-if="pinnedSkill"
              ref="skillChipRef"
              aria-hidden="true"
              data-test-id="chat-skill-chip"
              class="pointer-events-none absolute top-2.5 left-3 z-10 flex items-center gap-1 pr-1 text-xs leading-relaxed text-accent"
              :class="{ 'opacity-60': isStreaming }"
            >
              <icon-lucide-sparkles class="size-3.5 shrink-0" />
              <span class="font-medium">{{ pinnedSkill }}</span>
            </div>
            <textarea
              ref="inputRef"
              v-model="input"
              data-test-id="chat-input"
              :placeholder="pinnedSkill ? '' : dialogs.describeChange"
              :disabled="isStreaming"
              rows="2"
              aria-label="Describe a change"
              class="relative block min-h-12 w-full resize-none bg-transparent px-3 pt-2.5 pb-1 text-xs leading-relaxed text-surface outline-none placeholder:text-muted disabled:cursor-not-allowed disabled:opacity-60"
              :style="skillChipIndent > 0 ? { textIndent: `${skillChipIndent}px` } : undefined"
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

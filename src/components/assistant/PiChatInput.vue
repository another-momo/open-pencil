<script setup lang="ts">
// Batch 2a 命名分离（2026-09-05）：本组件自 ChatInput.vue 改名 PiChatInput.vue，
// 原名留给 deletedPaths 落账——组件已实质重写，与上游 ChatInput 无合并语义。
//
// Batch ux/inline-selection-chips（2026-09-05）：
//   选区 token 缩略图 chip 从独立 attachment slot 行**内嵌进文本流**——
//   contenteditable div + 分段模型（纯文本段 | 选区 token 段）。token 段在
//   DOM 里渲成 contenteditable="false" 的原子 chip（含 ChatNodePreview 缩略图
//   + 「@画布选区-N」标签），与正文混排、跨行随文。序列化路径不变——
//   模型 → 字面 `「@画布选区-N」` → 既有 serializeSelectionManifest，
//   payload 与上一版（attachment slot 行）逐字节一致。分段的纯函数面
//   （segmentsFromText / segmentsToText）钉扎在 selection-capture.ts 与
//   tests/engine/rebuild/chat/selection-capture.test.ts。
//
// DOM↔模型同步纪律（contenteditable 最大坑点）：
//   - **DOM 是编辑期 master**：用户打字/移动光标由浏览器维护；我们通过
//     `input` / `compositionend` 事件单向读取 DOM → input.value。
//   - **只在结构性变化时写 DOM**：挂载、采集插入 chip、X 删除 chip、原子
//     删除、clearDraft、restoreDraft。重写时用结构 diff（chip 序号集合 + 文本
//     段落边界），未变不动；并把光标按模型文本偏移归位（IME 合成期不重写）。
//   - **IME 合成期禁止任何 DOM 写回**——compositionstart 锁门、compositionend
//     解锁。这是中文/日文 IME 流不断流的核心保证。
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
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'

import ChatModeChips from '@/components/assistant/ChatModeChips.vue'
import ChatNodePreview from '@/components/assistant/ChatNodePreview.vue'
import {
  resolveSelectionTokenChips,
  type SelectionTokenChip
} from '@/components/assistant/node-preview'
import {
  captureSelectionFromStore,
  createSelectionDraftState,
  removeSelectionToken,
  resetSelectionDraftState,
  restoreSelectionDraftState,
  segmentsFromText,
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

/** 文本态模型（input 流；token = 字面 `「@画布选区-N」`）。
 *  - 序列化源：text → serializeSelectionManifest → payload 逐字节等价旧路径
 *  - 渲染源：segmentsFromText(text) → 分段模型 → contenteditable DOM
 *  - 编辑期反向：DOM → syncTextFromDom → input.value（单向，原子）
 *  两条路径在两端都用纯函数（scan/segments/snapshot），边界在
 *  syncTextFromDom，纯函数测试钉扎。 */
const input = ref('')

const isStreaming = computed(() => disabled || status === 'streaming' || status === 'submitted')

// ── T70：画布选区采集（内联 token「@画布选区-N」；路线 B = contenteditable
//    chip 内嵌） ────────────────────────────────────────────────────────────
//
// 草稿期 token 状态（登记表 + 序号）刻意不进响应式系统：模板渲染只依赖
// input 文本实扫（segmentsFromText 即从 input 派生），状态仅在采集/提交/
// 回填时读写。
const draftTokens = createSelectionDraftState()
// T27 快照：提交即清空文本+登记表；失败回填时两者一并恢复（restoreDraft）
let lastDraftSnapshot: SelectionDraftState | null = null

/** 编辑器根（contenteditable） */
const editorRef = ref<HTMLDivElement | null>(null)
/** IME 合成期守卫——compositionstart/end 期间禁止把 DOM 重渲染回写模型
 *  （contenteditable 最大坑点：合成中清空重渲会打断 IME 流）。 */
const isComposing = ref(false)

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

/** 分段模型（响应式）——文本流实扫到 token 即切 token 段；半删残串归文本
 *  段（与 scanSelectionTokens 一致）。序列化永远走 segmentsToText → 既有
 *  serializeSelectionManifest。 */
const segments = computed(() => segmentsFromText(input.value))

/** 内嵌 chip 数据：与上一版（attachment slot 行）同口径——首节点缩略图 +
 *  节点名 label。chip key = n。 */
const tokenChips = computed<SelectionTokenChip[]>(() => {
  const store = getActiveEditorStoreOrNull()
  if (store) void store.state.sceneVersion
  return resolveSelectionTokenChips(input.value, draftTokens.registry, store?.graph ?? null)
})

/** 按 n 查 token chip 数据（渲染时多对一映射：同 n 多次出现共用一张缩略图） */
function chipForN(n: number): SelectionTokenChip | null {
  return tokenChips.value.find((c) => c.n === n) ?? null
}

function chipLabelForN(n: number): string {
  // 已采集 → 节点名；手打无登记占位串 → 原字面（与 serialize「未采集的引用」语义对齐）
  const chip = chipForN(n)
  return chip ? chip.label : selectionTokenText(n)
}

// chip 缩略图渲染上下文：不用 computed——renderer 挂载是非响应式事件，模板
// 重渲染（chip 出现/变化必伴随 input 变动）时直取现值即可；store 缺席
// （storybook/测试面）→ null，ChatNodePreview 降级为 box 图标 + 名称
function chipRenderContext(): { graph: SceneGraph | null; renderer: SkiaRenderer | null } {
  const store = getActiveEditorStoreOrNull()
  return { graph: store?.graph ?? null, renderer: store?.renderer ?? null }
}

// ── contenteditable DOM 同步面 ──────────────────────────────────────────────
//
// DOM↔text 桥的纯字符串扫描层。syncTextFromDom 不读 selection，只走 DOM
// 子节点 → 文本：chip span（data-token-n）→ 字面 `「@画布选区-N」`；
// <br> → \n；其余文本节点 textContent 拼接。结果与 segmentsToText(segmentsFromText(input))
// 字节等价（半删残串情形除外——残串被切到文本段里，反向还原自然对齐）。

function syncTextFromDom(): void {
  const el = editorRef.value
  if (!el) return
  let text = ''
  const walk = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      text += node.textContent ?? ''
      return
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return
    const el = node as HTMLElement
    if (el.dataset.tokenN) {
      const n = Number(el.dataset.tokenN)
      if (Number.isFinite(n)) text += selectionTokenText(n)
      return
    }
    if (el.tagName === 'BR') {
      text += '\n'
      return
    }
    for (const child of Array.from(el.childNodes)) walk(child)
  }
  walk(el)
  // 归一：去掉 ZWSP 与 CRLF，与旧 textarea 路径字节等价
  const normalized = text.replace(/\u200B/g, '').replace(/\r\n?/g, '\n')
  if (normalized !== input.value) input.value = normalized
}

/** DOM 文本位置 → 模型文本偏移：扫描 DOM 子节点累计文本/BR/token 长度，
 *  命中目标节点后返回累计 + offset。 */
function domOffsetToTextOffset(root: HTMLElement, node: Node, offset: number): number {
  let acc = 0
  let found = false
  const walk = (n: Node): boolean => {
    if (found) return true
    if (n === node) {
      acc += offset
      found = true
      return true
    }
    if (n.nodeType === Node.TEXT_NODE) {
      acc += (n.textContent ?? '').length
      return false
    }
    if (n.nodeType !== Node.ELEMENT_NODE) return false
    const el = n as HTMLElement
    if (el.tagName === 'BR') {
      acc += 1
      return false
    }
    if (el.dataset.tokenN) {
      acc += selectionTokenText(Number(el.dataset.tokenN)).length
      return false
    }
    for (const child of Array.from(el.childNodes)) {
      if (walk(child)) return true
    }
    return false
  }
  walk(root)
  return acc
}

// 卸载前清理守卫态
onBeforeUnmount(() => {
  isComposing.value = false
})

// T24→T61：manifest 数据源不变；失败改显式暴露（错误条 + 重试，08 P0-2）
onMounted(() => {
  void ensurePiStudioManifest()
})

// ── 事件处理（IME / 粘贴 / 键入 / 原子删除） ───────────────────────────────

function handleCompositionStart() {
  isComposing.value = true
}

function handleCompositionEnd() {
  isComposing.value = false
  // 合成完毕 → 立即同步 DOM → 模型（合成期间的临时字符在 compositionend 后
  // 已是确定文本）。合成期内 DOM 已被浏览器接管、我们没碰。
  syncTextFromDom()
}

function handleInput() {
  // 编辑期 DOM → 模型：每次 input/compositionend 都读一次。syncTextFromDom
  // 内部判相等避免无谓赋值。
  if (isComposing.value) return
  syncTextFromDom()
}

function handlePaste(event: ClipboardEvent) {
  // 拦截 paste → 只插纯文本（与上一版纪律一致）。beforeinput 也拦了一遍，
  // 这里再兜一道（某些浏览器 paste 路径不触发 beforeinput）。
  if (isComposing.value) return
  const text = event.clipboardData?.getData('text/plain')
  if (text == null) return
  event.preventDefault()
  insertTextAtSelection(text)
}

/** 在当前 selection 处插入文本（保留 selection 位置；用户在 chip 间移动
 *  光标后粘贴 → 落到光标位置）。 */
function insertTextAtSelection(text: string): void {
  const sel = window.getSelection()
  if (!sel || sel.rangeCount === 0) {
    input.value = input.value + text
    return
  }
  const range = sel.getRangeAt(0)
  if (!editorRef.value || !editorRef.value.contains(range.commonAncestorContainer)) {
    input.value = input.value + text
    return
  }
  const offset = domOffsetToTextOffset(editorRef.value, range.startContainer, range.startOffset)
  input.value = input.value.slice(0, offset) + text + input.value.slice(offset)
}

function handleKeydown(event: KeyboardEvent) {
  // T91p：光标在 0 位且有钉头 chip 时 Backspace 移除 chip（chip 不进文本流，
  // 它是光标前唯一的「东西」；mention chip 行首 Backspace 删除的通行交互）
  if (event.code === 'Backspace' && pinnedSkill.value && !event.isComposing) {
    const sel = window.getSelection()
    if (sel && sel.rangeCount > 0) {
      const range = sel.getRangeAt(0)
      if (range.collapsed && isCaretAtEditorStart(range)) {
        event.preventDefault()
        pinnedSkill.value = null
        return
      }
    }
  }
  // T70：Backspace/Delete 紧邻 chip 时原子删除——contenteditable=false 天然原子
  // 浏览器会自动删除整个 chip span + 触发 input 事件；不需要 keydown 拦截。
  // 唯一需要兜底：IME 合成期（浏览器不会删 chip）。
  if ((event.code === 'Backspace' || event.code === 'Delete') && !event.isComposing) {
    if (handleAtomicChipDeletion(event)) return
  }
  if (event.code !== 'Enter' || event.shiftKey || event.isComposing) return
  event.preventDefault()
  const target = event.currentTarget
  if (target instanceof HTMLElement) target.closest('form')?.requestSubmit()
}

function isCaretAtEditorStart(range: Range): boolean {
  const el = editorRef.value
  if (!el) return false
  if (range.startContainer !== el && !el.contains(range.startContainer)) return false
  const r = document.createRange()
  r.selectNodeContents(el)
  r.setEnd(range.startContainer, range.startOffset)
  return r.toString().replace(/\u200B/g, '').length === 0
}

/** 原子 chip 删除兜底：在浏览器未自动删的边缘情形（IME 合成期 / 光标
 *  紧贴 chip 但 selection 在 chip 边界外），我们用模型侧 removeSelectionToken
 *  显式删占位串。 */
function handleAtomicChipDeletion(event: KeyboardEvent): boolean {
  const el = editorRef.value
  if (!el) return false
  const sel = window.getSelection()
  if (!sel || sel.rangeCount === 0) return false
  const range = sel.getRangeAt(0)
  if (!range.collapsed) return false
  const dir = event.code === 'Backspace' ? 'backward' : 'forward'
  const offset = domOffsetToTextOffset(el, range.startContainer, range.startOffset)
  const tokens = scanSelectionTokens(input.value)
  for (const token of tokens) {
    if (dir === 'backward' && token.end === offset) {
      event.preventDefault()
      input.value = removeSelectionToken(input.value, token.n)
      return true
    }
    if (dir === 'forward' && token.start === offset) {
      event.preventDefault()
      input.value = removeSelectionToken(input.value, token.n)
      return true
    }
  }
  return false
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
  insertTokenAtSelection(selectionTokenText(entry.n))
}

/** 在当前 selection 处插入 token 字面（采集按钮默认插入路径） */
function insertTokenAtSelection(token: string) {
  const el = editorRef.value
  const current = input.value
  // 采集按钮 @mousedown.prevent 不抢焦点——仍聚焦编辑器时插光标处；
  // 无焦点（尚未点过输入框）追加文末
  if (!el || document.activeElement !== el) {
    input.value = current + token
    void nextTick(() => {
      const node = editorRef.value
      if (!node) return
      node.focus()
      // 光标落到文末
      const sel = window.getSelection()
      if (sel) {
        const range = document.createRange()
        range.selectNodeContents(node)
        range.collapse(false)
        sel.removeAllRanges()
        sel.addRange(range)
      }
    })
    return
  }
  insertTextAtSelection(token)
}

/** chip X 按钮：从文本流里删掉该 n 的全部占位串（视觉代理消失 = 文本同步） */
function handleRemoveToken(n: number) {
  const next = removeSelectionToken(input.value, n)
  if (next === input.value) return
  input.value = next
  void nextTick(() => editorRef.value?.focus())
}

/** contenteditable 上的 mousedown 拦截——chip 自身的 mousedown 阻止默认光标
 *  移动（chip 是 contenteditable=false，浏览器默认会把 selection 放 chip 内） */
function handleChipMouseDown(event: MouseEvent) {
  const target = event.target as HTMLElement | null
  if (!target) return
  if (target.closest('.chat-inline-chip')) {
    event.preventDefault()
  }
}

// T21：模型由后端 catalog/指派决定，聊天输入只读展示当前指派
// T25：pi 已是唯一路径（门退役），旧模型/资料切换臂与图片附件流已切除
// T61：T24 ChatModeSelect/ChatStyleProfileSelect 退役——mode/profile 由 chips
// （active_design 回显 + 新建意图暂存）承载
// T65（决策 A/B）：输入条瘦身——只放随下次发送生效的内容（mode/profile chips +
// 模型名 label 暂留）；设计/需求单/gallery 三面板按钮移出，状态查看归 header 的
// 画布工作状态面板（ChatContextBar），gallery 组件删除

const piModelLabel = computed(
  // T38：useForkPi() 返回 Ref——script 内访问必须 .value（T35 曾丢 .value 致标签空白）
  () => piDesignAssignment.value?.modelId ?? piDialogs.value.designModelDefault
)

// T91p：skill chip（钉头单例内联芯片，替代 T89 文本内 token）——owner 决议：
// skill 是命令不是引用，与选区 token（任意位置、多实例）本质不同；chip 恒钉
// 消息最前、全消息最多一个、新选覆盖旧选。chip 是纯组件状态（pinnedSkill），
// 不进 contenteditable 文本流；视觉上以覆盖层 chip + 编辑器首行
// text-indent 让出首行宽度实现「在输入框内、与正文同行同高」（owner 效果图）。
// 提交时 composeSkillSubmission 把 `/skill:<name>` 拼到消息头；移除靠光标在
// 0 位时按 Backspace。
const skillSearch = ref('')
const skillComboboxOpen = ref(false)
/** 钉头 skill chip（null = 未选）；新选直接覆盖旧选 */
const pinnedSkill = ref<string | null>(null)
const skillChipRef = ref<HTMLElement | null>(null)
/** chip 实测宽度 → 编辑器首行 text-indent（chip 与正文同行衔接） */
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

function handleSkillSelect(event: Event, name: string): void {
  event.preventDefault()
  // 钉头单例：赋值即覆盖旧选
  pinnedSkill.value = name
  skillSearch.value = ''
  skillComboboxOpen.value = false
  // 触发后 refocus 编辑器
  void nextTick(() => {
    editorRef.value?.focus()
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
  // 退化为原文提交。**内嵌 chip 路径与旧 textarea 路径在序列化层完全一致**：
  // input.value 是 `「@画布选区-N」` 字面流，serializeSelectionManifest
  // 按既有实扫规则处理。
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

// Vue 自动响应：segments computed 重算 → v-for diff。Vue v-for diff 只在
// 节点增删（结构变化）时动 DOM，纯文本字符级变化不影响节点身份 → 光标不跳。
// IME 合成期守卫见模板上的 v-if="!isComposing"——Vue 不重渲 children，
// 浏览器原生 IME 流接管；compositionend 后 v-if 复位 → Vue 用确定后的
// segments 重渲。
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
      <!-- T89：actions 行（采集画布选区 + skill dropdown），位于输入控件上方
           一处承载两件事。采集按钮永远渲染；skill dropdown trigger 仅在
           capabilities.agentSkills && skills.length > 0 时渲染 -->
      <div class="mb-2 flex items-center gap-1" data-test-id="chat-actions-row">
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
          <!-- ux/inline-selection-chips：内嵌 chip——contenteditable div 承载
               输入/IME/光标；选区 token 段在 DOM 里渲成 contenteditable=false
               原子 chip（含 ChatNodePreview 缩略图 + 「@画布选区-N」标签 + X 按钮）。
               序列化走既有 serializeSelectionManifest（input 文本流是字面
               `「@画布选区-N」`，与上一版逐字节一致）。backdrop/attachment
               slot 全部退役——chip 与正文同行同高、跨行随文。 -->
          <div class="relative">
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
            <div
              v-if="input.length === 0 && !pinnedSkill"
              class="pointer-events-none absolute top-2.5 left-3 text-xs leading-relaxed text-muted"
              :style="skillChipIndent > 0 ? { paddingLeft: `${skillChipIndent}px` } : undefined"
            >
              {{ dialogs.describeChange }}
            </div>
            <div
              ref="editorRef"
              data-test-id="chat-input"
              spellcheck="false"
              role="textbox"
              aria-label="Describe a change"
              :contenteditable="isStreaming ? 'false' : 'true'"
              class="chat-inline-editor block min-h-12 w-full resize-none overflow-y-auto whitespace-pre-wrap break-words bg-transparent px-3 pt-2.5 pb-1 text-xs leading-relaxed text-surface outline-none disabled:cursor-not-allowed disabled:opacity-60"
              :style="skillChipIndent > 0 ? { textIndent: `${skillChipIndent}px` } : undefined"
              @keydown="handleKeydown"
              @input="handleInput"
              @compositionstart="handleCompositionStart"
              @compositionend="handleCompositionEnd"
              @paste="handlePaste"
              @copy.stop
              @cut.stop
              @mousedown.capture="handleChipMouseDown"
            >
              <!-- IME 守卫：合成期 Vue 不重渲 children（v-if 把 segments 模板
                   整体隐藏，浏览器原生 IME 流接管；compositionend 后 v-if
                   复位 → Vue 用确定后的 segments 重渲）。 -->
              <template v-if="!isComposing">
                <!-- 空编辑器补一个 <br> 占位，否则首次输入光标无落点 -->
                <br v-if="segments.length === 0" />
                <template v-for="(seg, idx) in segments" :key="`seg-${idx}`">
                <span
                  v-if="seg.kind === 'token'"
                  contenteditable="false"
                  :data-token-n="seg.n"
                  class="chat-inline-chip"
                  data-test-id="chat-token-chip"
                >
                  <ChatNodePreview
                    v-if="chipForN(seg.n)"
                    :node-id="chipForN(seg.n)!.preview.nodeId"
                    :page-id="chipForN(seg.n)!.preview.pageId"
                    :graph="chipRenderContext().graph"
                    :renderer="chipRenderContext().renderer"
                  />
                  <span v-else class="chat-inline-chip-placeholder" aria-hidden="true"></span>
                  <span class="chat-inline-chip-inner">{{ chipLabelForN(seg.n) }}</span>
                  <button
                    type="button"
                    class="chat-inline-chip-x"
                    aria-label="移除引用"
                    :data-token-n="seg.n"
                    @mousedown.prevent
                    @click.stop="handleRemoveToken(seg.n)"
                  >
                    <svg
                      class="size-3"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                    >
                      <path d="M18 6L6 18M6 6l12 12" />
                    </svg>
                  </button>
                </span>
                <template v-else>
                  <template v-for="(line, lineIdx) in seg.text.split('\n')" :key="`line-${idx}-${lineIdx}`">
                    <br v-if="lineIdx > 0" />
                    <span>{{ line }}</span>
                  </template>
                </template>
                </template>
              </template>
            </div>
          </div>

          <template #model>
            <div class="flex min-w-0 items-center">
              <div
                class="flex min-w-0 items-center gap-1 px-1.5 text-[10px] text-muted"
                data-test-id="chat-pi-model-label"
              >
                <icon-lucide-bot class="size-3 shrink-0" />
                <span class="truncate">{{ piModelLabel }}</span>
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

<style scoped>
/* contenteditable 内嵌 chip 样式——与正文同行同高、原子边界 */
.chat-inline-editor :deep(.chat-inline-chip) {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  margin: 0 1px;
  padding: 1px 2px 1px 4px;
  border-radius: 6px;
  border: 1px solid var(--op-border, rgb(64 64 72));
  background: var(--op-canvas, rgb(28 28 32));
  vertical-align: baseline;
  white-space: nowrap;
  user-select: none;
  -webkit-user-select: none;
  cursor: default;
}

.chat-inline-editor :deep(.chat-inline-chip-inner) {
  font-size: 11px;
  color: var(--op-surface, rgb(245 245 250));
  line-height: 1.2;
}

.chat-inline-editor :deep(.chat-inline-chip-x) {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  border-radius: 4px;
  color: var(--op-muted, rgb(150 150 160));
  background: transparent;
  border: 0;
  cursor: pointer;
  flex-shrink: 0;
  padding: 0;
}

.chat-inline-editor :deep(.chat-inline-chip-x:hover) {
  background: var(--op-hover, rgb(50 50 56));
  color: var(--op-surface, rgb(245 245 250));
}
</style>

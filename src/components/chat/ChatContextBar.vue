<script setup lang="ts">
/**
 * T65（决策 B1/B2）：画布工作状态面板三合一——当前设计显示 + 设计区列表 +
 * 需求单面板合一，挂在 ChatPanel header（会话下拉旁边）。
 *
 *  - trigger 按钮本身 = 当前设计名显示（无 active = 空槽引导文案
 *    contextTriggerEmpty）——状态可见性与入口合一，零新增控件。
 *  - popover 内分节不分 tab：①当前目标卡 ②设计区列表（active 徽标 + 点击
 *    打开定位不切换 + 显式「设为当前」→ 端点）③需求单列表 + 详情编辑视图。
 *  - 扫描统一只扫当前页（决策 D4，需求单从全文档收回），标题文案明示
 *    「当前页面」。
 *  - 「+ 新建需求单」（决策 D1）：列表顶部入口 → 内联内容编辑 → core
 *    create_brief 原语经 makeFigmaFromStore 桥直调（不触发 setup_design）
 *    → 列表重扫 + 画布定位。
 *  - 切换成功回执（决策 D3）：端点 200 后 emit switched → ChatPanel 注入
 *    data-context-switch 分割线（非 assistant 气泡）。
 *  - 编辑防丢（决策 E）：popover 重开不重置 detailView/草稿；有未保存草稿时
 *    关闭/返回需经内联 dirty 守卫确认（不用 window.confirm——Tauri WKWebView
 *    不支持）。
 *
 * 面板纪律（沿 T61）：零自有事实源——打开/进入详情/保存后重读画布；编辑写回
 * 走 core brief-edit 原语（画布节点单一事实源）。常驻非模态、仅用户打开。
 */
import { PopoverContent, PopoverPortal, PopoverRoot, PopoverTrigger } from 'reka-ui'
import { computed, ref } from 'vue'

import {
  piActiveDesign,
  piStudioManifest,
  resyncPiActiveDesign
} from '@/app/ai/pi-backend/mode-selection'
import { getActiveEditorStoreOrNull } from '@/app/editor/active-store'
import { useForkPanels } from '@/app/i18n/fork'
import { toast } from '@/app/shell/ui'
import AppInput from '@/components/ui/AppInput.vue'
import AppTextarea from '@/components/ui/AppTextarea.vue'
import AppTextButton from '@/components/ui/AppTextButton.vue'
import { usePopoverUI } from '@/components/ui/popover'

import {
  createBriefOnPage,
  postActiveDesign,
  readBriefView,
  saveBriefContent,
  saveMaterialCaption,
  scanCurrentPageBriefs,
  scanCurrentPageDesigns,
  type BriefListEntry
} from './active-design'

import type { BriefView } from '@open-pencil/core/tools/fork/marketing/brief-edit'
import type { MarketingDesignRef } from '@open-pencil/core/tools/fork/marketing/setup'

const { disabled = false } = defineProps<{ disabled?: boolean }>()

const emit = defineEmits<{
  /** 端点 200 后上抛（ChatPanel 注入 data-context-switch 分割线回执） */
  switched: [payload: { name: string }]
}>()

const panelsText = useForkPanels()
const cls = usePopoverUI({ content: 'isolate z-[51] w-80 p-3' })
const open = ref(false)

// ── ① 当前目标卡（无状态字段） ──

const active = computed(() => piActiveDesign.value)

function modeLabel(modeId: string): string {
  return piStudioManifest.value?.modes.find((mode) => mode.id === modeId)?.label ?? modeId
}

function profileLabel(profileId: string | null): string | null {
  if (!profileId) return null
  return (
    piStudioManifest.value?.profiles.find((profile) => profile.id === profileId)?.label ?? profileId
  )
}

const activeBriefName = computed(() => {
  const briefId = active.value?.briefId
  if (!briefId) return null
  const store = getActiveEditorStoreOrNull()
  return store?.graph.getNode(briefId)?.name ?? null
})

// ── ② 设计区列表（当前页；点击 = 定位不切换） ──

const designs = ref<MarketingDesignRef[]>([])
/** 逐条目切换中态（按钮按下即确认语义；防连击） */
const switchingNodeId = ref<string | null>(null)

const activeNodeId = computed(() => piActiveDesign.value?.nodeId ?? null)

function rescanDesigns() {
  const store = getActiveEditorStoreOrNull()
  designs.value = store ? scanCurrentPageDesigns(store) : []
}

/** 点击条目 = 打开定位（不切换） */
function locateDesign(design: MarketingDesignRef) {
  const store = getActiveEditorStoreOrNull()
  if (!store) return
  store.select([design.rootId])
  store.zoomToSelection()
  open.value = false
}

/** 显式切换（按钮按下本身即确认，S1 §5）；端点 200 后 emit 分割线回执 */
async function setCurrent(design: MarketingDesignRef) {
  if (switchingNodeId.value !== null) return
  switchingNodeId.value = design.rootId
  try {
    const result = await postActiveDesign(design.rootId)
    if (!result) {
      toast.error(panelsText.value.designsSwitchFailed)
      return
    }
    // 端点已落槽（宿主写 root sharedPluginData）——显式重同步兜底，
    // 常规路径由 mode-selection 的 sceneVersion watcher 自动覆盖
    resyncPiActiveDesign()
    emit('switched', { name: design.name })
  } finally {
    switchingNodeId.value = null
  }
}

// ── ③ 需求单列表（当前页）+ 新建 + 详情编辑 ──

const briefs = ref<BriefListEntry[]>([])

function rescanBriefs() {
  const store = getActiveEditorStoreOrNull()
  briefs.value = store ? scanCurrentPageBriefs(store) : []
}

function containsActive(entry: BriefListEntry): boolean {
  const nodeId = active.value?.nodeId
  return nodeId !== undefined && nodeId !== null && entry.boundDesignIds.includes(nodeId)
}

// 新建需求单（内联内容编辑 → 桥直调 → 重扫 + 定位）

const creating = ref(false)
const createDraft = ref('')
const creatingBusy = ref(false)

function startCreate() {
  creating.value = true
  createDraft.value = ''
  pendingDiscard.value = null
}

function cancelCreate() {
  creating.value = false
  createDraft.value = ''
}

function confirmCreateBrief() {
  const store = getActiveEditorStoreOrNull()
  if (!store || creatingBusy.value) return
  creatingBusy.value = true
  try {
    const briefId = createBriefOnPage(store, createDraft.value)
    creating.value = false
    createDraft.value = ''
    rescanBriefs()
    store.select([briefId])
    store.zoomToSelection()
  } catch (error) {
    console.error('Brief create error:', error)
    toast.error(panelsText.value.briefCreateFailed)
  } finally {
    creatingBusy.value = false
  }
}

// 详情编辑视图（编辑是第一功能；写回走 core brief-edit 原语）

const detailView = ref<BriefView | null>(null)
const detailBroken = ref(false)
const contentDraft = ref('')
/** 素材标题草稿：entryId → 编辑中文本（整对象替换重建，不用动态 delete） */
const captionDrafts = ref<Record<string, string>>({})
const saving = ref(false)
const savedTick = ref(false)
let savedTimer: ReturnType<typeof setTimeout> | undefined

function openDetail(briefId: string) {
  const store = getActiveEditorStoreOrNull()
  if (!store) return
  const view = readBriefView(store, briefId)
  detailView.value = view
  detailBroken.value = view === null
  contentDraft.value = view?.content ?? ''
  captionDrafts.value = Object.fromEntries(
    (view?.materials ?? []).map((material) => [material.entryId, material.caption])
  )
}

function flashSaved() {
  savedTick.value = true
  clearTimeout(savedTimer)
  savedTimer = setTimeout(() => {
    savedTick.value = false
  }, 1500)
}

async function saveContent() {
  const store = getActiveEditorStoreOrNull()
  const view = detailView.value
  if (!store || !view || saving.value) return
  saving.value = true
  try {
    if (!saveBriefContent(store, view.briefId, contentDraft.value)) {
      toast.error(panelsText.value.briefSaveFailed)
      return
    }
    openDetail(view.briefId)
    flashSaved()
  } finally {
    saving.value = false
  }
}

function saveCaption(entryId: string) {
  const store = getActiveEditorStoreOrNull()
  const view = detailView.value
  if (!store || !view) return
  const caption = captionDrafts.value[entryId] ?? ''
  if (!saveMaterialCaption(store, entryId, caption)) {
    toast.error(panelsText.value.briefSaveFailed)
    return
  }
  const material = view.materials.find((entry) => entry.entryId === entryId)
  if (material) material.caption = caption
  flashSaved()
}

// ── dirty 守卫（T65 决策 E：未保存草稿时关闭/返回需内联确认） ──

const detailDirty = computed(() => {
  const view = detailView.value
  if (!view) return false
  if (contentDraft.value !== view.content) return true
  return view.materials.some(
    (material) => (captionDrafts.value[material.entryId] ?? material.caption) !== material.caption
  )
})
const createDirty = computed(() => creating.value && createDraft.value.trim() !== '')
const isDirty = computed(() => detailDirty.value || createDirty.value)

/** 待确认的丢弃动作（内联确认条显隐；'close' = 关 popover，'back' = 返回列表） */
const pendingDiscard = ref<'close' | 'back' | null>(null)

function discardDrafts() {
  detailView.value = null
  detailBroken.value = false
  creating.value = false
  createDraft.value = ''
}

/** 丢弃确认条「丢弃」按钮：执行挂起动作 */
function confirmDiscard() {
  const action = pendingDiscard.value
  pendingDiscard.value = null
  discardDrafts()
  if (action === 'back') rescanBriefs()
  if (action === 'close') open.value = false
}

function backToList() {
  if (detailDirty.value) {
    pendingDiscard.value = 'back'
    return
  }
  detailView.value = null
  detailBroken.value = false
  rescanBriefs()
}

function handleOpen(value: boolean) {
  if (!value && isDirty.value) {
    // dirty 关闭确认：popover 保持打开，内联确认条显形
    pendingDiscard.value = 'close'
    return
  }
  open.value = value
  pendingDiscard.value = null
  // 防丢：重开只重扫列表，不重置 detailView/草稿（决策 E）
  if (value) {
    rescanDesigns()
    rescanBriefs()
  }
}
</script>

<template>
  <PopoverRoot :open="open" @update:open="handleOpen">
    <PopoverTrigger as-child>
      <AppTextButton
        data-test-id="chat-context-trigger"
        :disabled="disabled"
        :aria-label="panelsText.contextTriggerLabel"
        :ui="{
          base: 'flex max-w-44 items-center gap-1 rounded px-1.5 py-0.5 text-[11px] hover:bg-hover'
        }"
      >
        <icon-lucide-pin class="size-3 shrink-0" />
        <span class="min-w-0 truncate">{{ active?.name ?? panelsText.contextTriggerEmpty }}</span>
        <icon-lucide-chevron-down class="size-2.5 shrink-0" />
      </AppTextButton>
    </PopoverTrigger>
    <PopoverPortal>
      <PopoverContent side="bottom" align="start" :side-offset="6" :class="cls.content">
        <div data-test-id="chat-context-panel" class="max-h-[70vh] space-y-3 overflow-y-auto">
          <!-- dirty 守卫内联确认条 -->
          <div
            v-if="pendingDiscard"
            data-test-id="chat-context-discard-bar"
            class="flex items-center gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-1.5"
          >
            <span class="min-w-0 flex-1 text-[11px] text-amber-200">
              {{ panelsText.briefDirtyHint }}
            </span>
            <button
              type="button"
              data-test-id="chat-context-discard-confirm"
              class="shrink-0 rounded-md border border-amber-500/40 px-2 py-0.5 text-[11px] text-amber-200 hover:bg-amber-500/20"
              @click="confirmDiscard"
            >
              {{
                pendingDiscard === 'close'
                  ? panelsText.briefDiscardClose
                  : panelsText.briefDiscardBack
              }}
            </button>
            <button
              type="button"
              data-test-id="chat-context-discard-cancel"
              class="shrink-0 rounded-md border border-border px-2 py-0.5 text-[11px] text-surface hover:bg-hover"
              @click="pendingDiscard = null"
            >
              {{ panelsText.briefKeepEditing }}
            </button>
          </div>

          <!-- ① 当前目标卡（无状态字段） -->
          <div class="space-y-1">
            <div class="flex items-center gap-2">
              <icon-lucide-pin class="size-3.5 shrink-0 text-accent" />
              <span class="text-[12px] font-medium text-surface">{{
                panelsText.targetSection
              }}</span>
            </div>
            <div
              class="rounded-md border border-border bg-canvas px-2 py-1.5"
              data-test-id="chat-context-target"
            >
              <div v-if="!active" class="text-[11px] text-muted">
                {{ panelsText.targetNoActive }}
              </div>
              <template v-else>
                <div class="truncate text-[11px] text-surface">{{ active.name }}</div>
                <div class="mt-0.5 truncate text-[11px] text-muted">
                  {{ modeLabel(active.modeId) }}
                  <template v-if="profileLabel(active.profileId)">
                    · {{ profileLabel(active.profileId) }}
                  </template>
                </div>
                <div class="mt-0.5 truncate text-[11px] text-muted">
                  {{ activeBriefName ?? panelsText.targetNoBriefBound }}
                </div>
              </template>
            </div>
          </div>

          <!-- 详情编辑视图（替换 ②③ 两节；返回带 dirty 守卫） -->
          <template v-if="detailView || detailBroken">
            <div class="space-y-3 border-t border-border pt-3">
              <div class="flex items-center gap-2">
                <AppTextButton
                  data-test-id="chat-brief-back"
                  :ui="{
                    base: 'flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] hover:bg-hover'
                  }"
                  @click="backToList"
                >
                  <icon-lucide-chevron-left class="size-3" />
                  {{ panelsText.briefBack }}
                </AppTextButton>
                <span
                  v-if="savedTick"
                  data-test-id="chat-brief-saved"
                  class="text-[11px] text-green-400"
                >
                  {{ panelsText.briefSaved }}
                </span>
              </div>

              <div v-if="detailBroken" class="text-[11px] text-muted">
                {{ panelsText.briefOpenFailed }}
              </div>

              <template v-else-if="detailView">
                <div class="space-y-1">
                  <div class="text-[11px] font-medium text-muted">
                    {{ panelsText.briefContent }}
                  </div>
                  <AppTextarea
                    v-model="contentDraft"
                    :rows="4"
                    :disabled="saving"
                    data-test-id="chat-brief-content-editor"
                  />
                  <div class="flex justify-end">
                    <button
                      type="button"
                      :disabled="saving"
                      data-test-id="chat-brief-content-save"
                      class="rounded-md bg-accent px-2 py-1 text-[11px] text-white hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-60"
                      @click="saveContent"
                    >
                      {{ panelsText.briefSave }}
                    </button>
                  </div>
                </div>

                <div class="space-y-1">
                  <div class="text-[11px] font-medium text-muted">
                    {{ panelsText.briefMaterials }}
                  </div>
                  <div v-if="detailView.materials.length === 0" class="text-[11px] text-muted">
                    {{ panelsText.briefEmptySection }}
                  </div>
                  <div
                    v-for="material in detailView.materials"
                    :key="material.entryId"
                    class="flex items-center gap-1.5"
                    :data-test-id="`chat-brief-material`"
                  >
                    <icon-lucide-file-image class="size-3 shrink-0 text-muted" />
                    <AppInput
                      v-model="captionDrafts[material.entryId]"
                      class="min-w-0 flex-1"
                      @blur="saveCaption(material.entryId)"
                      @keydown.enter="saveCaption(material.entryId)"
                    />
                  </div>
                </div>

                <div class="space-y-1">
                  <div class="text-[11px] font-medium text-muted">
                    {{ panelsText.briefConclusions }}
                  </div>
                  <div v-if="detailView.conclusions.length === 0" class="text-[11px] text-muted">
                    {{ panelsText.briefEmptySection }}
                  </div>
                  <div
                    v-for="(conclusion, index) in detailView.conclusions"
                    :key="index"
                    class="text-[11px] text-surface"
                  >
                    · {{ conclusion.text }}
                    <span v-if="conclusion.designName" class="text-[11px] text-muted">
                      （{{ conclusion.designName }}）
                    </span>
                  </div>
                </div>

                <div class="space-y-1">
                  <div class="text-[11px] font-medium text-muted">
                    {{ panelsText.briefDesigns }}
                  </div>
                  <div v-if="detailView.designs.length === 0" class="text-[11px] text-muted">
                    {{ panelsText.briefEmptySection }}
                  </div>
                  <div
                    v-for="design in detailView.designs"
                    :key="design.designId"
                    class="truncate text-[11px] text-surface"
                    :data-design-id="design.designId"
                  >
                    {{ design.name }}
                    <span class="text-[11px] text-muted">{{ modeLabel(design.modeId) }}</span>
                  </div>
                </div>
              </template>
            </div>
          </template>

          <template v-else>
            <!-- ② 设计区列表（当前页；点击 = 定位不切换） -->
            <div class="space-y-1 border-t border-border pt-3">
              <div class="flex items-center gap-2">
                <icon-lucide-layout-grid class="size-3.5 shrink-0 text-accent" />
                <span class="text-[12px] font-medium text-surface">{{
                  panelsText.designsSection
                }}</span>
              </div>

              <div v-if="designs.length === 0" class="text-[11px] text-muted">
                {{ panelsText.designsEmpty }}
              </div>

              <div
                v-for="design in designs"
                :key="design.rootId"
                class="rounded-md border px-2 py-1.5 transition-colors"
                :class="
                  design.rootId === activeNodeId
                    ? 'border-accent bg-accent/5'
                    : 'border-border bg-canvas'
                "
                :data-test-id="`chat-design-item`"
                :data-design-node-id="design.rootId"
              >
                <button type="button" class="block w-full text-left" @click="locateDesign(design)">
                  <div class="flex items-center gap-1.5">
                    <span class="min-w-0 flex-1 truncate text-[11px] text-surface">
                      {{ design.name }}
                    </span>
                    <span
                      v-if="design.rootId === activeNodeId"
                      data-test-id="chat-design-active-badge"
                      class="shrink-0 rounded bg-accent/15 px-1.5 py-0.5 text-[11px] text-accent"
                    >
                      {{ panelsText.designsActive }}
                    </span>
                  </div>
                  <div class="mt-0.5 truncate text-[11px] text-muted">
                    {{ modeLabel(design.modeId) }}
                    <template v-if="design.profileId">
                      · {{ profileLabel(design.profileId) }}
                    </template>
                  </div>
                </button>
                <div v-if="design.rootId !== activeNodeId" class="mt-1 flex justify-end">
                  <button
                    type="button"
                    :disabled="switchingNodeId !== null"
                    :data-test-id="`chat-design-set-current`"
                    :data-design-node-id="design.rootId"
                    class="rounded-md border border-border px-2 py-0.5 text-[11px] text-surface hover:bg-hover disabled:cursor-not-allowed disabled:opacity-60"
                    @click="setCurrent(design)"
                  >
                    {{
                      switchingNodeId === design.rootId
                        ? panelsText.designsSetting
                        : panelsText.designsSetCurrent
                    }}
                  </button>
                </div>
              </div>

              <div class="text-[11px] text-muted">{{ panelsText.designsLocateHint }}</div>
            </div>

            <!-- ③ 需求单列表（当前页）+ 新建入口 -->
            <div class="space-y-1 border-t border-border pt-3">
              <div class="flex items-center gap-2">
                <icon-lucide-book-open class="size-3.5 shrink-0 text-accent" />
                <span class="min-w-0 flex-1 text-[12px] font-medium text-surface">{{
                  panelsText.briefsSection
                }}</span>
                <button
                  v-if="!creating"
                  type="button"
                  data-test-id="chat-brief-new"
                  class="flex shrink-0 items-center gap-0.5 rounded-md border border-border px-1.5 py-0.5 text-[11px] text-surface hover:bg-hover"
                  @click="startCreate"
                >
                  <icon-lucide-plus class="size-3" />
                  {{ panelsText.briefNew }}
                </button>
              </div>

              <!-- 新建需求单内联编辑（core create_brief 桥直调，不触发 setup_design） -->
              <div
                v-if="creating"
                class="space-y-1.5 rounded-md border border-border bg-canvas px-2 py-1.5"
                data-test-id="chat-brief-create-form"
              >
                <AppTextarea
                  v-model="createDraft"
                  :rows="3"
                  :disabled="creatingBusy"
                  :placeholder="panelsText.briefNewPlaceholder"
                  data-test-id="chat-brief-create-editor"
                />
                <div class="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    :disabled="creatingBusy"
                    data-test-id="chat-brief-create-cancel"
                    class="rounded-md border border-border px-2 py-0.5 text-[11px] text-muted hover:bg-hover disabled:cursor-not-allowed disabled:opacity-60"
                    @click="cancelCreate"
                  >
                    {{ panelsText.briefCreateCancel }}
                  </button>
                  <button
                    type="button"
                    :disabled="creatingBusy"
                    data-test-id="chat-brief-create-confirm"
                    class="rounded-md bg-accent px-2 py-0.5 text-[11px] text-white hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-60"
                    @click="confirmCreateBrief"
                  >
                    {{ panelsText.briefCreate }}
                  </button>
                </div>
              </div>

              <div v-if="briefs.length === 0 && !creating" class="text-[11px] text-muted">
                {{ panelsText.briefListEmpty }}
              </div>
              <button
                v-for="entry in briefs"
                :key="entry.briefId"
                type="button"
                class="block w-full rounded-md border border-border bg-canvas px-2 py-1.5 text-left transition-colors hover:bg-hover"
                :data-test-id="`chat-brief-item`"
                :data-brief-id="entry.briefId"
                @click="openDetail(entry.briefId)"
              >
                <div class="flex items-center gap-1.5">
                  <span class="min-w-0 flex-1 truncate text-[11px] text-surface">
                    {{ entry.name }}
                  </span>
                  <span
                    v-if="containsActive(entry)"
                    data-test-id="chat-brief-contains-active"
                    class="shrink-0 rounded bg-accent/15 px-1.5 py-0.5 text-[11px] text-accent"
                  >
                    {{ panelsText.briefContainsActive }}
                  </span>
                </div>
              </button>
            </div>
          </template>
        </div>
      </PopoverContent>
    </PopoverPortal>
  </PopoverRoot>
</template>

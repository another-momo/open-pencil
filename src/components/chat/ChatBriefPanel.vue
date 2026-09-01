<script setup lang="ts">
/**
 * T61（Phase 3 W3/T-B10）：需求单面板三段结构（S1 §5 定谳）——
 *
 *  ① 顶部「当前目标」卡：active_design 文档级唯一（设计区名 + mode/profile
 *     + 所属 brief）；**无状态字段**——身份之外一律不显示。
 *  ② 需求单列表：当前文档全部需求单（条目带页标识；「含当前目标」徽标由
 *     activeDesignNodeId 与绑定条目读穿比较得出，不存储）；点击 = 打开详情
 *     编辑视图，**不切换**。
 *  ③ 详情编辑视图：**编辑是第一功能**——内容区文本 + 素材标题可编辑，
 *     写回经既有桥通路（makeFigmaFromStore + core brief-edit 原语直改画布
 *     文本节点，画布节点保持单一事实源）；结论区/关联设计区只读。
 *
 * 面板纪律：零自有事实源——每次打开/进入详情/保存后重读画布重建视图
 * （readBrief view-only；编辑 apply 前重读、commit 后 draft 以新读为准）。
 * 常驻非模态、仅用户打开（红线 #10：AI 永不主动打开）。
 */
import { PopoverContent, PopoverPortal, PopoverRoot, PopoverTrigger } from 'reka-ui'
import { computed, ref } from 'vue'

import { piActiveDesign, piStudioManifest } from '@/app/ai/pi-backend/mode-selection'
import { getActiveEditorStoreOrNull } from '@/app/editor/active-store'
import { useForkChips, useForkPanels } from '@/app/i18n/fork'
import { toast } from '@/app/shell/ui'
import AppInput from '@/components/ui/AppInput.vue'
import AppTextarea from '@/components/ui/AppTextarea.vue'
import AppTextButton from '@/components/ui/AppTextButton.vue'
import { usePopoverUI } from '@/components/ui/popover'

import {
  readBriefView,
  saveBriefContent,
  saveMaterialCaption,
  scanDocumentBriefs,
  type BriefListEntry
} from './active-design'

import type { BriefView } from '@open-pencil/core/tools/fork/marketing/brief-edit'

const { disabled = false } = defineProps<{ disabled?: boolean }>()

const chipsText = useForkChips()
const panelsText = useForkPanels()
const cls = usePopoverUI({ content: 'isolate z-[51] w-80 p-3' })
const open = ref(false)

// ── 段①：当前目标卡（无状态字段） ──

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

// ── 段②：需求单列表（点击 = 打开详情，不切换） ──

const briefs = ref<BriefListEntry[]>([])

function rescanBriefs() {
  const store = getActiveEditorStoreOrNull()
  briefs.value = store ? scanDocumentBriefs(store) : []
}

function containsActive(entry: BriefListEntry): boolean {
  const nodeId = active.value?.nodeId
  return nodeId !== undefined && nodeId !== null && entry.boundDesignIds.includes(nodeId)
}

// ── 段③：详情编辑视图 ──

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

function backToList() {
  detailView.value = null
  detailBroken.value = false
  rescanBriefs()
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

function handleOpen(value: boolean) {
  open.value = value
  if (value) {
    backToList()
  }
}
</script>

<template>
  <PopoverRoot :open="open" @update:open="handleOpen">
    <PopoverTrigger as-child>
      <AppTextButton
        data-test-id="chat-briefs-trigger"
        :disabled="disabled"
        :ui="{ base: 'flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] hover:bg-hover' }"
      >
        <icon-lucide-book-open class="size-3" />
        {{ chipsText.chipsBriefs }}
      </AppTextButton>
    </PopoverTrigger>
    <PopoverPortal>
      <PopoverContent side="top" align="start" :side-offset="6" :class="cls.content">
        <div data-test-id="chat-briefs-panel" class="space-y-3">
          <div class="flex items-center gap-2">
            <icon-lucide-book-open class="size-3.5 shrink-0 text-accent" />
            <span class="text-[11px] font-medium text-surface">{{ panelsText.briefsTitle }}</span>
          </div>

          <!-- 段①：当前目标卡（无状态字段） -->
          <div
            class="rounded-md border border-border bg-canvas px-2 py-1.5"
            data-test-id="chat-brief-current-target"
          >
            <div class="text-[10px] font-medium text-muted">
              {{ panelsText.briefCurrentTarget }}
            </div>
            <div v-if="!active" class="mt-1 text-[11px] text-muted">
              {{ panelsText.briefNoActive }}
            </div>
            <template v-else>
              <div class="mt-1 truncate text-[11px] text-surface">{{ active.name }}</div>
              <div class="mt-0.5 truncate text-[10px] text-muted">
                {{ modeLabel(active.modeId) }}
                <template v-if="profileLabel(active.profileId)">
                  · {{ profileLabel(active.profileId) }}
                </template>
              </div>
              <div class="mt-0.5 truncate text-[10px] text-muted">
                {{ activeBriefName ?? panelsText.briefNoBriefBound }}
              </div>
            </template>
          </div>

          <!-- 段③：详情编辑视图 -->
          <template v-if="detailView || detailBroken">
            <div class="flex items-center gap-2">
              <AppTextButton
                data-test-id="chat-brief-back"
                :ui="{
                  base: 'flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] hover:bg-hover'
                }"
                @click="backToList"
              >
                <icon-lucide-chevron-left class="size-3" />
                {{ panelsText.briefBack }}
              </AppTextButton>
              <span
                v-if="savedTick"
                data-test-id="chat-brief-saved"
                class="text-[10px] text-green-400"
              >
                {{ panelsText.briefSaved }}
              </span>
            </div>

            <div v-if="detailBroken" class="text-[11px] text-muted">
              {{ panelsText.briefOpenFailed }}
            </div>

            <template v-else-if="detailView">
              <div class="space-y-1">
                <div class="text-[10px] font-medium text-muted">{{ panelsText.briefContent }}</div>
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
                <div class="text-[10px] font-medium text-muted">
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
                <div class="text-[10px] font-medium text-muted">
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
                  <span v-if="conclusion.designName" class="text-[10px] text-muted">
                    （{{ conclusion.designName }}）
                  </span>
                </div>
              </div>

              <div class="space-y-1">
                <div class="text-[10px] font-medium text-muted">{{ panelsText.briefDesigns }}</div>
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
                  <span class="text-[10px] text-muted">{{ modeLabel(design.modeId) }}</span>
                </div>
              </div>
            </template>
          </template>

          <!-- 段②：需求单列表 -->
          <template v-else>
            <div class="space-y-1">
              <div class="text-[10px] font-medium text-muted">
                {{ panelsText.briefListSection }}
              </div>
              <div v-if="briefs.length === 0" class="text-[11px] text-muted">
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
                    class="shrink-0 rounded bg-accent/15 px-1.5 py-0.5 text-[10px] text-accent"
                  >
                    {{ panelsText.briefContainsActive }}
                  </span>
                </div>
                <div class="mt-0.5 text-[10px] text-muted">{{ entry.pageName }}</div>
              </button>
            </div>
          </template>
        </div>
      </PopoverContent>
    </PopoverPortal>
  </PopoverRoot>
</template>

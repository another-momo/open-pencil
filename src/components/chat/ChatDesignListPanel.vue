<script setup lang="ts">
/**
 * T61（Phase 3 W3/T-B10）：设计列表面板——active_design 的可见面（S1 §5）。
 *
 *  - 扫描当前页营销设计区（core scanMarketingDesigns 经 makeFigmaFromStore
 *    seam 复用；每次打开重扫，不做轮询/缓存）。
 *  - active 标记读穿 piActiveDesign（共享契约 5 单槽口径）。
 *  - 列表点击 = 打开定位画布（select + zoomToSelection），**不切换**（v7）；
 *    切换只走条目上的显式「设为当前」按钮 → POST /api/pi/active-design
 *    （共享契约 2，与 set_active_design 同意卡共用端点）。
 */
import { PopoverContent, PopoverPortal, PopoverRoot, PopoverTrigger } from 'reka-ui'
import { computed, ref } from 'vue'

import {
  piActiveDesign,
  piStudioManifest,
  resyncPiActiveDesign
} from '@/app/ai/pi-backend/mode-selection'
import { getActiveEditorStoreOrNull } from '@/app/editor/active-store'
import { useForkChips, useForkPanels } from '@/app/i18n/fork'
import { toast } from '@/app/shell/ui'
import AppTextButton from '@/components/ui/AppTextButton.vue'
import { usePopoverUI } from '@/components/ui/popover'

import { postActiveDesign, scanCurrentPageDesigns } from './active-design'

import type { MarketingDesignRef } from '@open-pencil/core/tools/fork/marketing/setup'

const { disabled = false } = defineProps<{ disabled?: boolean }>()

const chipsText = useForkChips()
const panelsText = useForkPanels()
const cls = usePopoverUI({ content: 'isolate z-[51] w-72 p-3' })
const open = ref(false)

const designs = ref<MarketingDesignRef[]>([])
/** 逐条目切换中态（按钮按下即确认语义；防连击） */
const switchingNodeId = ref<string | null>(null)

const activeNodeId = computed(() => piActiveDesign.value?.nodeId ?? null)

function rescan() {
  const store = getActiveEditorStoreOrNull()
  designs.value = store ? scanCurrentPageDesigns(store) : []
}

function handleOpen(value: boolean) {
  open.value = value
  if (value) rescan()
}

function modeLabel(modeId: string): string {
  return piStudioManifest.value?.modes.find((mode) => mode.id === modeId)?.label ?? modeId
}

function profileLabel(profileId: string): string {
  return (
    piStudioManifest.value?.profiles.find((profile) => profile.id === profileId)?.label ?? profileId
  )
}

/** 点击条目 = 打开定位（不切换） */
function locateDesign(design: MarketingDesignRef) {
  const store = getActiveEditorStoreOrNull()
  if (!store) return
  store.select([design.rootId])
  store.zoomToSelection()
  open.value = false
}

/** 显式切换（按钮按下本身即确认，S1 §5） */
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
  } finally {
    switchingNodeId.value = null
  }
}
</script>

<template>
  <PopoverRoot :open="open" @update:open="handleOpen">
    <PopoverTrigger as-child>
      <AppTextButton
        data-test-id="chat-designs-trigger"
        :disabled="disabled"
        :ui="{ base: 'flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] hover:bg-hover' }"
      >
        <icon-lucide-layout-grid class="size-3" />
        {{ chipsText.chipsDesigns }}
      </AppTextButton>
    </PopoverTrigger>
    <PopoverPortal>
      <PopoverContent side="top" align="start" :side-offset="6" :class="cls.content">
        <div data-test-id="chat-designs-panel" class="space-y-2">
          <div class="flex items-center gap-2">
            <icon-lucide-layout-grid class="size-3.5 shrink-0 text-accent" />
            <span class="text-[11px] font-medium text-surface">{{ panelsText.designsTitle }}</span>
          </div>

          <div v-if="designs.length === 0" class="text-[11px] text-muted">
            {{ panelsText.designsEmpty }}
          </div>

          <div v-else class="space-y-1">
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
                    class="shrink-0 rounded bg-accent/15 px-1.5 py-0.5 text-[10px] text-accent"
                  >
                    {{ panelsText.designsActive }}
                  </span>
                </div>
                <div class="mt-0.5 truncate text-[10px] text-muted">
                  {{ modeLabel(design.modeId) }}
                  <template v-if="design.profileId">
                    · {{ profileLabel(design.profileId) }}</template
                  >
                </div>
              </button>
              <div v-if="design.rootId !== activeNodeId" class="mt-1 flex justify-end">
                <button
                  type="button"
                  :disabled="switchingNodeId !== null"
                  :data-test-id="`chat-design-set-current`"
                  :data-design-node-id="design.rootId"
                  class="rounded-md border border-border px-2 py-0.5 text-[10px] text-surface hover:bg-hover disabled:cursor-not-allowed disabled:opacity-60"
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
          </div>

          <div class="border-t border-border pt-2 text-[10px] text-muted">
            {{ panelsText.designsLocateHint }}
          </div>
        </div>
      </PopoverContent>
    </PopoverPortal>
  </PopoverRoot>
</template>

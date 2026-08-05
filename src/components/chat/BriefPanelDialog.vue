<script setup lang="ts">
import { useFileDialog } from '@vueuse/core'
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'

import { useI18n, useSelectionState } from '@open-pencil/vue'

import {
  applyAddMaterial,
  applyAddMaterialsFromSelection,
  applyCaption,
  applyContent,
  applyRemoveMaterial,
  briefPanelError,
  briefPanelOpen,
  clearDraftCaption,
  clearDraftContent,
  clearDrafts,
  closeBriefPanel,
  createBriefInStore,
  getSelectionImageNodes,
  loadBrief,
  noteDraftCaption,
  noteDraftContent,
  selectionAddMode,
  type BriefPanelState,
  type SelectionAddMode
} from '@/app/ai/marketing/brief-panel'
import { getActiveEditorStoreOrNull } from '@/app/editor/active-store'
import { AppDialogBody, AppDialogHeader, AppDialogRoot } from '@/components/ui/dialog'

const { dialogs } = useI18n()

// The canvas brief node tree is the single source of truth; `state` is just
// its latest read. Rebuilt on open and after every apply. Intentionally NOT
// live-synced: if the user hand-edits the brief on the canvas while the panel
// is open, the next refresh (canvas truth) wins over stale field values.
const state = ref<BriefPanelState>({ kind: 'none' })
const view = computed(() => (state.value.kind === 'ok' ? state.value.view : null))
const contentText = ref('')
const captionTexts = ref<Record<string, string>>({})
const captionInputs = new Map<string, HTMLInputElement>()

function refresh(): void {
  clearDrafts()
  state.value = loadBrief()
  if (state.value.kind === 'ok') {
    contentText.value = state.value.view.content
    const captions: Record<string, string> = {}
    for (const material of state.value.view.materials) {
      captions[material.entryId] = material.caption
    }
    captionTexts.value = captions
  } else {
    contentText.value = ''
    captionTexts.value = {}
  }
}

// --- Thumbnails: panel-level objectURL cache, revoked on close/unmount ---

const thumbUrls = new Map<string, string>()

function thumbUrl(hash: string): string {
  const cached = thumbUrls.get(hash)
  if (cached) return cached
  const bytes = getActiveEditorStoreOrNull()?.graph.images.get(hash)
  if (!bytes) return ''
  const url = URL.createObjectURL(new Blob([bytes as BlobPart]))
  thumbUrls.set(hash, url)
  return url
}

function releaseThumbs(): void {
  for (const url of thumbUrls.values()) URL.revokeObjectURL(url)
  thumbUrls.clear()
}

watch(briefPanelOpen, (open) => {
  if (open) refresh()
  else {
    clearDrafts()
    releaseThumbs()
  }
})
onBeforeUnmount(releaseThumbs)

function onOpenChange(open: boolean): void {
  if (!open) closeBriefPanel()
}

// --- Field handlers: @change commits, @input only notes the draft ---

function onContentInput(): void {
  noteDraftContent(contentText.value)
}

function onContentChange(): void {
  clearDraftContent()
  applyContent(contentText.value)
  refresh()
}

function onCaptionInput(entryId: string): void {
  noteDraftCaption(entryId, captionTexts.value[entryId] ?? '')
}

function onCaptionChange(entryId: string): void {
  clearDraftCaption(entryId)
  applyCaption(entryId, captionTexts.value[entryId] ?? '')
  refresh()
}

function onRemoveMaterial(entryId: string): void {
  applyRemoveMaterial(entryId)
  refresh()
}

function setCaptionInput(entryId: string, el: unknown): void {
  if (el instanceof HTMLInputElement) captionInputs.set(entryId, el)
  else captionInputs.delete(entryId)
}

const { open: pickImage, onChange: onFilesPicked } = useFileDialog({
  accept: 'image/png,image/jpeg,image/webp',
  multiple: false
})
onFilesPicked(async (files) => {
  const file = files?.[0]
  if (!file) return
  const bytes = new Uint8Array(await file.arrayBuffer())
  // Add with an empty caption, then focus the new entry's caption field
  const entryId = applyAddMaterial(bytes, '')
  refresh()
  if (entryId) {
    await nextTick()
    captionInputs.get(entryId)?.focus()
  }
})

function onCreateBrief(): void {
  if (createBriefInStore()) refresh()
}

// --- Add from canvas selection: move/copy chooser, remembered per session ---

const { selectedIds } = useSelectionState()
const selectionImageCount = computed(() => getSelectionImageNodes(selectedIds.value).length)
const selectionChooserOpen = ref(false)

function onAddFromSelection(): void {
  if (selectionImageCount.value === 0) return
  // A mode chosen earlier this session is reused without asking again
  if (selectionAddMode.value) {
    applyAddMaterialsFromSelection(selectionAddMode.value)
    refresh()
    return
  }
  selectionChooserOpen.value = !selectionChooserOpen.value
}

function onChooseSelectionMode(mode: SelectionAddMode): void {
  selectionChooserOpen.value = false
  applyAddMaterialsFromSelection(mode)
  refresh()
}
</script>

<template>
  <AppDialogRoot
    :open="briefPanelOpen"
    size="lg"
    data-test-id="brief-panel-dialog"
    @update:open="onOpenChange"
  >
    <AppDialogHeader
      :heading="dialogs.briefPanelTitle"
      :description="dialogs.briefPanelDescription"
      :close-label="dialogs.close"
    />

    <AppDialogBody>
      <!-- Empty state: no brief in the active document -->
      <div
        v-if="state.kind === 'none'"
        class="flex flex-col items-center gap-3 py-8"
        data-test-id="brief-panel-empty"
      >
        <p class="text-xs text-muted">{{ dialogs.briefPanelEmpty }}</p>
        <button
          type="button"
          class="rounded border border-border px-3 py-1.5 text-xs text-muted hover:bg-hover hover:text-surface"
          data-test-id="brief-panel-create-button"
          @click="onCreateBrief"
        >
          {{ dialogs.briefPanelCreate }}
        </button>
      </div>

      <!-- Brief exists but its expected zone structure is broken -->
      <div
        v-else-if="state.kind === 'broken'"
        class="rounded border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200"
        data-test-id="brief-panel-broken"
      >
        {{ dialogs.briefPanelBroken }}
      </div>

      <template v-else-if="view">
        <!-- Content zone -->
        <section>
          <div class="mb-1 text-[11px] font-medium text-muted">
            {{ dialogs.briefPanelContentLabel }}
          </div>
          <textarea
            v-model="contentText"
            rows="5"
            class="w-full resize-y rounded border border-border bg-input px-2 py-1.5 text-xs text-surface placeholder:text-muted"
            :placeholder="dialogs.briefPanelContentPlaceholder"
            data-test-id="brief-panel-content"
            @input="onContentInput"
            @change="onContentChange"
          />
        </section>

        <!-- Materials zone -->
        <section class="mt-4">
          <div class="mb-1 text-[11px] font-medium text-muted">
            {{ dialogs.briefPanelMaterialsLabel }}
          </div>
          <div
            v-for="material in view.materials"
            :key="material.entryId"
            class="mb-2 flex items-center gap-2"
            data-test-id="brief-panel-material"
          >
            <div
              class="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-input"
            >
              <img
                v-if="material.imageHash && thumbUrl(material.imageHash)"
                :src="thumbUrl(material.imageHash)"
                :alt="material.caption"
                class="size-full object-cover"
              />
              <icon-lucide-image v-else class="size-4 text-muted" />
            </div>
            <input
              :ref="(el) => setCaptionInput(material.entryId, el)"
              v-model="captionTexts[material.entryId]"
              type="text"
              class="min-w-0 flex-1 rounded border border-border bg-input px-2 py-1 text-xs text-surface placeholder:text-muted"
              :placeholder="dialogs.briefPanelCaptionPlaceholder"
              data-test-id="brief-panel-caption"
              @input="onCaptionInput(material.entryId)"
              @change="onCaptionChange(material.entryId)"
            />
            <button
              type="button"
              class="shrink-0 rounded p-1 text-muted hover:bg-hover hover:text-surface"
              :aria-label="dialogs.briefPanelRemoveMaterial"
              data-test-id="brief-panel-remove-material"
              @click="onRemoveMaterial(material.entryId)"
            >
              <icon-lucide-trash-2 class="size-3.5" />
            </button>
          </div>
          <div class="flex items-center gap-2">
            <button
              type="button"
              class="rounded border border-border px-2.5 py-1 text-xs text-muted hover:bg-hover hover:text-surface"
              data-test-id="brief-panel-add-material"
              @click="pickImage()"
            >
              {{ dialogs.briefPanelAddMaterial }}
            </button>
            <div class="relative">
              <button
                type="button"
                class="rounded border border-border px-2.5 py-1 text-xs text-muted hover:bg-hover hover:text-surface disabled:cursor-not-allowed disabled:opacity-50"
                :disabled="selectionImageCount === 0"
                data-test-id="brief-panel-add-from-selection"
                @click="onAddFromSelection"
              >
                {{ dialogs.briefPanelAddFromSelection }}
              </button>
              <div
                v-if="selectionChooserOpen"
                class="absolute bottom-full left-0 z-10 mb-1 flex w-64 flex-col gap-1 rounded border border-border bg-surface p-1.5 shadow-lg"
                data-test-id="brief-panel-selection-chooser"
              >
                <button
                  type="button"
                  class="rounded px-2 py-1.5 text-left text-xs text-surface hover:bg-hover"
                  data-test-id="brief-panel-selection-move"
                  @click="onChooseSelectionMode('move')"
                >
                  {{ dialogs.briefPanelAddSelectionMove }}
                </button>
                <button
                  type="button"
                  class="rounded px-2 py-1.5 text-left text-xs text-surface hover:bg-hover"
                  data-test-id="brief-panel-selection-copy"
                  @click="onChooseSelectionMode('copy')"
                >
                  {{ dialogs.briefPanelAddSelectionCopy }}
                </button>
              </div>
            </div>
          </div>
        </section>

        <!-- AI conclusions zone (read-only) -->
        <section class="mt-4">
          <div class="mb-1 text-[11px] font-medium text-muted">
            {{ dialogs.briefPanelAiLabel }}
          </div>
          <div
            class="rounded border border-border bg-input px-2 py-1.5 text-xs text-muted"
            data-test-id="brief-panel-conclusions"
          >
            <div v-if="view.conclusions.length === 0">
              {{ dialogs.briefPanelAiEmpty }}
            </div>
            <div v-for="(line, i) in view.conclusions" v-else :key="i" class="py-0.5">
              {{ line }}
            </div>
          </div>
          <p class="mt-1 text-[10px] text-muted">{{ dialogs.briefPanelAiNote }}</p>
        </section>
      </template>

      <p
        v-if="briefPanelError"
        class="mt-3 text-[11px] text-red-500"
        data-test-id="brief-panel-error"
      >
        {{ dialogs.briefPanelApplyFailed }}
      </p>
    </AppDialogBody>
  </AppDialogRoot>
</template>

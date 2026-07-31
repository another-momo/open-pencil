<script setup lang="ts">
import { useFileDialog } from '@vueuse/core'
import {
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogOverlay,
  DialogPortal,
  DialogRoot,
  DialogTitle
} from 'reka-ui'
import { computed, ref, watch } from 'vue'

import { useI18n } from '@open-pencil/vue'

import {
  documentLibraryMismatch,
  replaceMarketingLibrary,
  retryMarketingLibraryLoad,
  useLibraryDialogOpen,
  useLibraryLoadError,
  useMarketingLibrary
} from '@/app/ai/marketing/library'
import { getActiveEditorStore } from '@/app/editor/active-store'
import { useDialogUI } from '@/components/ui/dialog'

const { dialogs } = useI18n()
const open = useLibraryDialogOpen()
const library = useMarketingLibrary()
const loadError = useLibraryLoadError()
const store = getActiveEditorStore()

const cls = useDialogUI({
  overlay: 'z-50',
  content: 'w-96 rounded-lg p-4 shadow-xl'
})

const uploadError = ref('')

const warnings = computed(() => library.value?.index.warnings ?? [])
const mismatch = computed(() => {
  void library.value
  void open.value
  return documentLibraryMismatch(store.graph)
})

watch(
  open,
  (isOpen) => {
    if (!isOpen) return
    uploadError.value = ''
  },
  { immediate: true }
)

const { open: openFilePicker, onChange: onFilesPicked } = useFileDialog({
  accept: '.fig,.pen',
  multiple: false
})
onFilesPicked(async (files) => {
  const file = files?.[0]
  if (!file) return
  const result = await replaceMarketingLibrary(file)
  uploadError.value = 'error' in result ? result.error : ''
})
</script>

<template>
  <DialogRoot v-model:open="open">
    <DialogPortal>
      <DialogOverlay :class="cls.overlay" />
      <DialogContent data-test-id="marketing-library-dialog" :class="cls.content">
        <DialogTitle class="text-sm font-semibold text-surface">
          {{ dialogs.materialLibrary }}
        </DialogTitle>
        <DialogDescription class="mt-1 text-xs text-muted">
          {{ dialogs.materialLibraryDescription }}
        </DialogDescription>

        <div class="mt-3 flex items-center gap-2 text-xs">
          <span class="min-w-0 flex-1 truncate text-surface">
            {{ library?.name ?? '…' }}
          </span>
          <button
            type="button"
            class="shrink-0 rounded border border-border px-2 py-1 text-muted hover:bg-hover hover:text-surface"
            data-test-id="library-upload-button"
            @click="openFilePicker()"
          >
            {{ dialogs.uploadLibrary }}
          </button>
        </div>
        <div
          v-if="!library && loadError"
          class="mt-2 flex items-center gap-2 rounded border border-red-300 bg-red-50 px-2 py-1.5 text-[11px] text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300"
          data-test-id="library-load-error"
        >
          <span class="min-w-0 flex-1">{{ dialogs.libraryLoadFailed }}: {{ loadError }}</span>
          <button
            type="button"
            class="shrink-0 rounded border border-red-300 px-1.5 py-0.5 hover:bg-red-100 dark:hover:bg-red-900"
            data-test-id="library-retry-button"
            @click="retryMarketingLibraryLoad"
          >
            {{ dialogs.retry }}
          </button>
        </div>
        <p v-if="uploadError" class="mt-1 text-[11px] text-red-500">{{ uploadError }}</p>

        <div
          v-if="mismatch.length > 0"
          class="mt-3 rounded border border-amber-300 bg-amber-50 px-2 py-1.5 text-[11px] text-amber-800 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200"
          data-test-id="library-mismatch-warning"
        >
          {{ dialogs.documentMadeWithLibrary }}:
          <span class="font-medium">{{ mismatch.join(', ') }}</span>
          {{ dialogs.resubmitLibraryHint }}
        </div>

        <div v-if="warnings.length > 0" class="mt-3">
          <div class="mb-1 text-[11px] font-medium text-muted">
            {{ dialogs.libraryWarningsSection }}
          </div>
          <div class="max-h-24 overflow-y-auto rounded bg-input px-2 py-1 text-[10px] text-muted">
            <div v-for="warning in warnings" :key="warning">{{ warning }}</div>
          </div>
        </div>

        <div class="mt-4 flex justify-end gap-2">
          <DialogClose
            class="rounded border border-border px-3 py-1.5 text-xs text-muted hover:bg-hover hover:text-surface"
          >
            {{ dialogs.done }}
          </DialogClose>
        </div>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>

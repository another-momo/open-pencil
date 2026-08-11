<script setup lang="ts">
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

import { profileSelection, setUserProfile } from '@/app/ai/marketing/settings'
import { useMarketingLibrary } from '@/app/ai/marketing/library'
import { useDialogUI } from '@/components/ui/dialog'

const { dialogs } = useI18n()
const library = useMarketingLibrary()

const open = defineModel<boolean>('open', { default: false })

const cls = useDialogUI({
  overlay: 'z-50',
  content: 'w-[640px] max-w-[90vw] rounded-lg p-4 shadow-xl'
})
// The markdown preview is a real NESTED dialog (not a raw fixed div):
// reka-ui's dismissable-layer stack lets only the topmost layer answer
// outside clicks and Escape, and pointer events inside the content layer
// are untouched — a hand-rolled overlay outside DialogContent gets its
// scrollbar drag eaten by the modal layer and its clicks dismiss the
// gallery dialog underneath.
const previewCls = useDialogUI({
  overlay: 'z-[60]',
  content: 'z-[60] max-h-[85vh] w-[560px] max-w-[90vw] rounded-lg p-4 shadow-xl'
})

const profiles = computed(() => library.value?.index.profiles ?? [])
const selectedId = computed(() => profileSelection.value?.id ?? null)

const query = ref('')
const previewId = ref<string | null>(null)

const filtered = computed(() => {
  const q = query.value.trim().toLowerCase()
  if (!q) return profiles.value
  return profiles.value.filter((profile) => {
    if (profile.id.toLowerCase().includes(q)) return true
    if (profile.label.toLowerCase().includes(q)) return true
    if (profile.description.toLowerCase().includes(q)) return true
    return false
  })
})

const previewProfile = computed(() =>
  previewId.value
    ? (profiles.value.find((profile) => profile.id === previewId.value) ?? null)
    : null
)

const previewOpen = computed({
  get: () => previewProfile.value !== null,
  set: (value: boolean) => {
    if (!value) previewId.value = null
  }
})

function pick(id: string) {
  setUserProfile(id)
  open.value = false
}

function formatApplicableTo(types: string[]): string {
  return types.length > 0 ? types.join(', ') : ''
}

watch(open, (isOpen) => {
  if (!isOpen) {
    query.value = ''
    previewId.value = null
  }
})
</script>

<template>
  <DialogRoot v-model:open="open">
    <DialogPortal>
      <DialogOverlay :class="cls.overlay" />
      <DialogContent data-test-id="profile-gallery-dialog" :class="cls.content">
        <DialogTitle class="text-sm font-semibold text-surface">
          {{ dialogs.profileGalleryTitle }}
        </DialogTitle>
        <DialogDescription class="mt-1 text-xs text-muted">
          {{ dialogs.profileGalleryDescription }}
        </DialogDescription>

        <div class="mt-3 flex items-center gap-2">
          <input
            v-model="query"
            type="text"
            :placeholder="dialogs.profileGallerySearch"
            data-test-id="profile-gallery-search"
            class="flex-1 rounded border border-border bg-input px-2 py-1 text-xs text-surface placeholder:text-muted focus:border-accent focus:outline-none"
          />
          <span class="shrink-0 text-[10px] text-muted">
            {{ filtered.length }} / {{ profiles.length }}
          </span>
        </div>

        <!-- P8v4 (2026-08-04): auto-pick is disabled. The "Auto (no lock)"
             card was removed because clicking it only sent the user back
             to the unset state, which now means "no profile in effect"
             rather than "let setup auto-pick." Toggling out of a locked
             profile now requires an explicit pick of a different one. -->

        <div
          v-if="filtered.length > 0"
          class="mt-3 grid max-h-[60vh] grid-cols-1 gap-2 overflow-y-auto sm:grid-cols-2"
          data-test-id="profile-gallery-grid"
        >
          <div
            v-for="profile in filtered"
            :key="profile.id"
            class="relative rounded border p-2 transition-colors"
            :class="
              selectedId === profile.id
                ? 'border-accent bg-accent/5'
                : 'border-border hover:border-accent/40'
            "
            :data-profile-id="profile.id"
          >
            <button type="button" class="block w-full text-left" @click="pick(profile.id)">
              <div class="flex items-start gap-2">
                <icon-lucide-check
                  v-if="selectedId === profile.id"
                  class="mt-0.5 size-3.5 shrink-0 text-accent"
                />
                <span v-else class="mt-0.5 size-3.5 shrink-0" />
                <div class="min-w-0 flex-1">
                  <div class="truncate text-xs font-medium text-surface">
                    {{ profile.label || profile.id }}
                  </div>
                  <div v-if="profile.label" class="truncate font-mono text-[10px] text-muted">
                    {{ profile.id }}
                  </div>
                  <div v-if="profile.description" class="mt-1 line-clamp-3 text-[10px] text-muted">
                    {{ profile.description }}
                  </div>
                  <div
                    v-if="profile.applicableTo.length > 0"
                    class="mt-1.5 truncate text-[10px] text-muted"
                  >
                    <span class="text-surface/70">{{ dialogs.profileGalleryApplicableTo }}:</span>
                    {{ formatApplicableTo(profile.applicableTo) }}
                  </div>
                  <div v-else class="mt-1.5 text-[10px] text-muted">
                    <span class="text-surface/70">{{ dialogs.profileGalleryApplicableTo }}:</span>
                    {{ dialogs.profileGalleryApplicableToAll }}
                  </div>
                </div>
              </div>
            </button>
            <button
              type="button"
              class="absolute right-1 top-1 rounded p-0.5 text-muted hover:bg-hover hover:text-surface"
              :data-preview-id="profile.id"
              :aria-label="dialogs.profileGalleryShowMarkdown"
              @click.stop="previewId = profile.id"
            >
              <icon-lucide-eye class="size-3.5" />
            </button>
          </div>
        </div>
        <div
          v-else
          class="mt-3 rounded border border-dashed border-border p-4 text-center text-xs text-muted"
        >
          {{ dialogs.profileGalleryEmpty }}
        </div>

        <div class="mt-3 flex justify-end">
          <DialogClose
            class="rounded border border-border px-2 py-1 text-xs text-surface hover:border-accent/40"
            data-test-id="profile-gallery-close"
          >
            {{ dialogs.done }}
          </DialogClose>
        </div>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>

  <!-- Nested preview dialog: the layer stack closes only this top layer on
       overlay click / Escape, leaving the gallery dialog open underneath. -->
  <DialogRoot v-model:open="previewOpen">
    <DialogPortal>
      <DialogOverlay :class="previewCls.overlay" />
      <DialogContent data-test-id="profile-preview-dialog" :class="previewCls.content">
        <template v-if="previewProfile">
          <div class="mb-2 flex shrink-0 items-center justify-between gap-3">
            <div class="min-w-0">
              <DialogTitle class="truncate text-sm font-semibold text-surface">
                {{ previewProfile.label || previewProfile.id }}
              </DialogTitle>
              <div v-if="previewProfile.label" class="truncate font-mono text-[11px] text-muted">
                {{ previewProfile.id }}
              </div>
            </div>
            <DialogClose
              class="shrink-0 rounded p-1 text-muted hover:bg-hover hover:text-surface"
              :aria-label="dialogs.close"
            >
              <icon-lucide-x class="size-3.5" />
            </DialogClose>
          </div>
          <DialogDescription class="sr-only">
            {{ dialogs.profileGalleryShowMarkdown }}
          </DialogDescription>
          <pre
            class="min-h-0 flex-1 overflow-y-auto whitespace-pre-wrap rounded border border-border bg-panel-field p-3 text-[11px] leading-relaxed text-surface"
          ><code>{{ previewProfile.markdown }}</code></pre>
        </template>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>

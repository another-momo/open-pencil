<script setup lang="ts">
import {
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuRoot,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from 'reka-ui'
import { computed, ref } from 'vue'

import { useI18n } from '@open-pencil/vue'

import {
  materialTypeSelection,
  profileSelection,
  setUserMaterialType
} from '@/app/ai/chat/storage'
import {
  injectLibraryReferences,
  listMarketingTypes,
  useMarketingLibrary
} from '@/app/ai/marketing/library'
import { getActiveEditorStore } from '@/app/editor/active-store'
import { menuItem, useMenuUI } from '@/components/ui/menu'
import ProfileGalleryDialog from '@/components/chat/ProfileGalleryDialog.vue'

const { dialogs } = useI18n()
const library = useMarketingLibrary()
const store = getActiveEditorStore()

const menuCls = useMenuUI({ content: 'min-w-52' })
const itemCls = menuItem({ justify: 'start', class: 'relative pl-7' })
const checkedCls = menuItem({ justify: 'start', class: 'relative pl-7' })

// --- Type ---

const types = computed(() => {
  void library.value
  return listMarketingTypes()
})

const typeLabel = computed(() => {
  const selection = materialTypeSelection.value
  if (!selection) return `${dialogs.value.chipType}: ${dialogs.value.autoOption}`
  const label = types.value.find((type) => type.id === selection.id)?.label ?? selection.id
  const suffix = selection.source === 'inferred' ? ` ${dialogs.value.inferredTag}` : ''
  return `${dialogs.value.chipType}: ${label}${suffix}`
})

const typeLocked = computed(() => materialTypeSelection.value?.source === 'user')

// --- Profile (gallery) ---

const profiles = computed(() => library.value?.index.profiles ?? [])
const profileGalleryOpen = ref(false)

const profileLabel = computed(() => {
  const locked = profileSelection.value
  if (!locked) return `${dialogs.value.chipProfile}: ${dialogs.value.autoOption}`
  const profile = profiles.value.find((entry) => entry.id === locked)
  return `${dialogs.value.chipProfile}: ${profile?.label || locked}`
})

// --- References ---

const references = computed(() => library.value?.index.references ?? [])
const injectedCount = computed(
  () =>
    (library.value?.index.references ?? []).filter((r) => library.value?.refInjections.has(r.id))
      .length
)
const referencesLabel = computed(() =>
  injectedCount.value > 0
    ? `${dialogs.value.chipReferences} (${injectedCount.value})`
    : dialogs.value.chipReferences
)

// Soft filter by current material type (from type selection). Universal refs
// (empty applicableTo) are always shown. With "show all" the non-matching
// refs are revealed too — useful for cross-type inspiration.
const showAllReferences = ref(false)
const activeTypeId = computed(
  () => materialTypeSelection.value?.id ?? types.value[0]?.id ?? null
)
const partitionedRefs = computed(() => {
  const all = references.value
  const t = activeTypeId.value
  const matching = all.filter((r) => r.applicableTo.length > 0 && r.applicableTo.includes(t ?? ''))
  const universal = all.filter((r) => r.applicableTo.length === 0)
  const other = all.filter(
    (r) => r.applicableTo.length > 0 && !r.applicableTo.includes(t ?? '')
  )
  return { matching, universal, other, total: all.length, hidden: other.length }
})
const visibleReferences = computed(() => {
  const { matching, universal, other } = partitionedRefs.value
  return showAllReferences.value ? [...matching, ...universal, ...other] : [...matching, ...universal]
})

const checked = ref<string[]>([])
const refOpen = ref(false)
const injectErrors = ref<string[]>([])

function openReferences(open: boolean) {
  if (!open) return
  injectErrors.value = []
  showAllReferences.value = false
  checked.value = references.value
    .filter((reference) => library.value?.refInjections.has(reference.id))
    .map((reference) => reference.id)
}

function toggleReference(id: string) {
  checked.value = checked.value.includes(id)
    ? checked.value.filter((entry) => entry !== id)
    : [...checked.value, id]
}

function handleInject() {
  injectErrors.value = []
  const result = injectLibraryReferences(store, checked.value)
  if (result.errors.length > 0) {
    injectErrors.value = result.errors
    return
  }
  refOpen.value = false
}

function chipClass(active: boolean): string {
  const base =
    'shrink-0 cursor-pointer rounded-full border px-2 py-0.5 text-[10px] transition-colors'
  return active
    ? `${base} border-accent bg-accent/15 font-medium text-accent`
    : `${base} border-border text-muted hover:border-accent/40 hover:text-surface`
}
</script>

<template>
  <div class="mb-1.5 flex items-center gap-1 overflow-x-auto" data-test-id="marketing-config-bar">
    <!-- Type -->
    <DropdownMenuRoot>
      <DropdownMenuTrigger as-child>
        <button :class="chipClass(typeLocked)" data-test-id="config-type-trigger">
          {{ typeLabel }}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuPortal>
        <DropdownMenuContent side="top" :side-offset="4" align="start" :class="menuCls.content">
          <DropdownMenuItem :class="itemCls" data-type-id="" @select="setUserMaterialType(null)">
            <icon-lucide-check v-if="!materialTypeSelection" class="absolute left-2 size-3.5" />
            <span class="flex-1">{{ dialogs.autoOption }}</span>
          </DropdownMenuItem>
          <DropdownMenuSeparator :class="menuCls.separator" />
          <DropdownMenuItem
            v-for="type in types"
            :key="type.id"
            :class="itemCls"
            :data-type-id="type.id"
            @select="setUserMaterialType(type.id)"
          >
            <icon-lucide-check
              v-if="materialTypeSelection?.id === type.id"
              class="absolute left-2 size-3.5"
            />
            <span class="flex-1">{{ type.label }}</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenuPortal>
    </DropdownMenuRoot>

    <!-- Profile (opens gallery dialog) -->
    <button
      type="button"
      :class="chipClass(!!profileSelection)"
      data-test-id="config-profile-trigger"
      @click="profileGalleryOpen = true"
    >
      {{ profileLabel }}
    </button>

    <!-- References -->
    <DropdownMenuRoot v-model:open="refOpen">
      <DropdownMenuTrigger as-child>
        <button
          :class="chipClass(injectedCount > 0)"
          data-test-id="config-references-trigger"
          @click="openReferences(true)"
        >
          {{ referencesLabel }}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuPortal>
        <DropdownMenuContent side="top" :side-offset="4" align="start" :class="menuCls.content">
          <div v-if="activeTypeId" class="px-2 pt-1 pb-0.5 text-[10px] text-muted">
            {{ dialogs.referencesFilteredFor }}: <span class="text-surface/80">{{ activeTypeId }}</span>
          </div>
          <div class="max-h-48 overflow-y-auto">
            <template v-if="visibleReferences.length > 0">
              <DropdownMenuItem
                v-for="reference in visibleReferences"
                :key="reference.id"
                :class="checkedCls"
                :data-reference-id="reference.id"
                @select.prevent="toggleReference(reference.id)"
              >
                <icon-lucide-check
                  v-if="checked.includes(reference.id)"
                  class="absolute left-2 size-3.5"
                />
                <span class="min-w-0 flex-1 truncate">{{ reference.id }}</span>
                <span class="shrink-0 text-[10px] text-muted">
                  {{ [...reference.applicableTo, ...reference.tags].filter(Boolean).join(' · ') }}
                </span>
              </DropdownMenuItem>
            </template>
            <div v-else class="px-2 py-1.5 text-[10px] text-muted">
              {{ dialogs.referencesNoneForType }}
            </div>
          </div>
          <template v-if="partitionedRefs.hidden > 0">
            <DropdownMenuSeparator :class="menuCls.separator" />
            <button
              type="button"
              class="flex w-full items-center gap-1 px-2 py-1 text-left text-[10px] text-muted hover:text-surface"
              data-test-id="config-references-show-all"
              @click="showAllReferences = !showAllReferences"
            >
              <icon-lucide-chevron-down
                v-if="!showAllReferences"
                class="size-3 shrink-0"
              />
              <icon-lucide-chevron-up v-else class="size-3 shrink-0" />
              {{
                showAllReferences
                  ? dialogs.referencesHideOther
                  : `${dialogs.referencesShowOther} (${partitionedRefs.hidden})`
              }}
            </button>
          </template>
          <template v-if="references.length > 0">
            <DropdownMenuSeparator :class="menuCls.separator" />
            <div class="px-2 py-1.5">
              <p class="mb-1 text-[10px] text-muted">{{ dialogs.referencesKeepNote }}</p>
              <p v-for="error in injectErrors" :key="error" class="text-[10px] text-red-500">
                {{ error }}
              </p>
              <button
                type="button"
                class="w-full rounded bg-accent px-2 py-1 text-xs font-medium text-white hover:bg-accent/90"
                data-test-id="config-references-inject"
                @click="handleInject"
              >
                {{ dialogs.injectSelected }}
              </button>
            </div>
          </template>
        </DropdownMenuContent>
      </DropdownMenuPortal>
    </DropdownMenuRoot>

    <ProfileGalleryDialog v-model:open="profileGalleryOpen" />
  </div>
</template>

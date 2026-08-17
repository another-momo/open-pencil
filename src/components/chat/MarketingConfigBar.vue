<script setup lang="ts">
import {
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuRoot,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from 'reka-ui'
import { computed, onMounted, ref } from 'vue'

import { useI18n } from '@open-pencil/vue'

import {
  materialTypeSelection,
  profileSelection,
  setUserMaterialType,
  setUserProfile
} from '@/app/ai/marketing/settings'
import { ensureBrandConfig, listMarketingTypes, useMarketingLibrary } from '@/app/ai/marketing/library'
import { AppDialogRoot } from '@/components/ui/dialog'
import { menuItem, useMenuUI } from '@/components/ui/menu'
import Tip from '@/components/ui/Tip.vue'
import BrandConfigPanel from '@/components/chat/BrandConfigPanel.vue'
import ProfileGalleryDialog from '@/components/chat/ProfileGalleryDialog.vue'

const { dialogs } = useI18n()
const library = useMarketingLibrary()

onMounted(() => ensureBrandConfig())

const menuCls = useMenuUI({ content: 'min-w-52' })
const itemCls = menuItem({ justify: 'start', class: 'relative pl-7' })

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

const profiles = computed(() => library.value?.profiles ?? [])
const profileGalleryOpen = ref(false)

// --- Brand config panel (品牌库: types / profiles / import-export / reset) ---

const brandPanelOpen = ref(false)

const profileLabel = computed(() => {
  const selection = profileSelection.value
  if (!selection) return `${dialogs.value.chipProfile}: ${dialogs.value.profileChipUnset}`
  const profile = profiles.value.find((entry) => entry.id === selection.id)
  const name = profile?.label || selection.id
  // P8 (2026-08-01): only user-picked profiles exist — no AI-echo /
  // inferred suffix any more. The label is just the picked profile's name.
  return `${dialogs.value.chipProfile}: ${name}`
})

// --- References ---

function chipClass(active: boolean): string {
  const base =
    'shrink-0 cursor-pointer rounded-full border px-2 py-0.5 text-[10px] transition-colors'
  return active
    ? `${base} border-accent bg-accent/15 font-medium text-accent`
    : `${base} border-border text-muted hover:border-accent/40 hover:text-surface`
}

// Profile chip is a binary state machine per P8 (2026-08-01): profile is
// either explicitly user-picked or it is not. There is no AI-driven path
// any more (setup never auto-picks, AI never echoes).
//   - 'unset' (no profileSelection)        → dashed muted border, signals
//     "no profile will be applied" to the user.
//   - 'picked' (selection.source === 'user') → accent border + background,
//     signalling a persistent user-driven pick that survives subsequent
//     bindMarketingLibrary calls.
type ProfileChipState = 'unset' | 'picked'
function profileChipClass(state: ProfileChipState): string {
  const base =
    'shrink-0 cursor-pointer rounded-full border px-2 py-0.5 text-[10px] transition-colors'
  if (state === 'picked') {
    return `${base} border-accent bg-accent/15 font-medium text-accent`
  }
  return `${base} border-dashed border-border text-muted hover:border-accent/40 hover:text-surface`
}

function profileChipState(): ProfileChipState {
  return profileSelection.value ? 'picked' : 'unset'
}

// Chip is a toggle: clicking a 'picked' chip clears the user-picked profile
// (back to unset, no profile in effect); clicking an 'unset' chip opens the
// gallery to pick one. Mirrors how the Type chip's dropdown lists "Auto" as
// the explicit unset option — for profile there is no "Auto" any more
// (P8v4), so the toggle action lives on the chip itself.
function toggleProfileChip() {
  if (profileSelection.value) {
    setUserProfile(null)
  } else {
    profileGalleryOpen.value = true
  }
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

    <!-- Profile (chip toggles: clicked when picked → clear; clicked when unset → open gallery) -->
    <Tip :label="profileSelection ? dialogs.profileChipClearHint : dialogs.profileChipOpenHint">
      <button
        type="button"
        :class="profileChipClass(profileChipState())"
        :data-profile-state="profileChipState()"
        data-test-id="config-profile-trigger"
        @click="toggleProfileChip"
      >
        {{ profileLabel }}
      </button>
    </Tip>

    <!-- Brand config panel entry (品牌库) -->
    <Tip label="品牌库">
      <button
        type="button"
        class="rounded p-0.5 text-muted hover:bg-hover hover:text-surface"
        aria-label="品牌库"
        data-test-id="brand-config-trigger"
        @click="brandPanelOpen = true"
      >
        <icon-lucide-library-big class="size-3" />
      </button>
    </Tip>

    <ProfileGalleryDialog v-model:open="profileGalleryOpen" />

    <!-- Same dialog shell as BriefPanelDialog; the panel renders its own header/close -->
    <AppDialogRoot v-model:open="brandPanelOpen" size="lg" data-test-id="brand-config-dialog">
      <BrandConfigPanel v-if="brandPanelOpen" @close="brandPanelOpen = false" />
    </AppDialogRoot>
  </div>
</template>

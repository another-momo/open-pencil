<script setup lang="ts">
/**
 * T61（Phase 3 W3/T-B10）：gallery 只读浏览（S1 §6——编辑不发生，mode /
 * profile 是磁盘本地文件，UI 侧只有只读选择器 + gallery）。
 * 数据源 = piStudioManifest；失败/空载显式空态，不静默。
 */
import { PopoverContent, PopoverPortal, PopoverRoot, PopoverTrigger } from 'reka-ui'
import { computed, ref } from 'vue'

import { ensurePiStudioManifest, piStudioManifest } from '@/app/ai/pi-backend/mode-selection'
import { useForkChips } from '@/app/i18n/fork'
import AppTextButton from '@/components/ui/AppTextButton.vue'
import { usePopoverUI } from '@/components/ui/popover'

const { disabled = false } = defineProps<{ disabled?: boolean }>()

const chipsText = useForkChips()
const cls = usePopoverUI({ content: 'isolate z-[51] w-72 p-3' })
const open = ref(false)

const modes = computed(() => piStudioManifest.value?.modes ?? [])
const profiles = computed(() => piStudioManifest.value?.profiles ?? [])
const isEmpty = computed(() => modes.value.length === 0 && profiles.value.length === 0)

function handleOpen(value: boolean) {
  open.value = value
  if (value) void ensurePiStudioManifest()
}
</script>

<template>
  <PopoverRoot :open="open" @update:open="handleOpen">
    <PopoverTrigger as-child>
      <AppTextButton
        data-test-id="chat-gallery-trigger"
        :disabled="disabled"
        :ui="{ base: 'flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] hover:bg-hover' }"
      >
        <icon-lucide-library class="size-3" />
        {{ chipsText.chipsGallery }}
      </AppTextButton>
    </PopoverTrigger>
    <PopoverPortal>
      <PopoverContent side="top" align="start" :side-offset="6" :class="cls.content">
        <div data-test-id="chat-gallery-panel" class="space-y-3">
          <div class="flex items-center gap-2">
            <icon-lucide-library class="size-3.5 shrink-0 text-accent" />
            <span class="text-[11px] font-medium text-surface">{{ chipsText.galleryTitle }}</span>
          </div>

          <div v-if="isEmpty" class="text-[11px] text-muted">{{ chipsText.galleryEmpty }}</div>

          <template v-else>
            <div v-if="modes.length > 0" class="space-y-1">
              <div class="text-[10px] font-medium text-muted">{{ chipsText.galleryModes }}</div>
              <div
                v-for="mode in modes"
                :key="mode.id"
                class="rounded-md border border-border bg-canvas px-2 py-1.5"
                :data-test-id="`chat-gallery-mode`"
                :data-mode-id="mode.id"
              >
                <div class="text-[11px] text-surface">{{ mode.label }}</div>
                <div v-if="mode.subtitle" class="mt-0.5 text-[10px] text-muted">
                  {{ mode.subtitle }}
                </div>
              </div>
            </div>

            <div v-if="profiles.length > 0" class="space-y-1">
              <div class="text-[10px] font-medium text-muted">{{ chipsText.galleryProfiles }}</div>
              <div
                v-for="profile in profiles"
                :key="profile.id"
                class="rounded-md border border-border bg-canvas px-2 py-1.5"
                :data-test-id="`chat-gallery-profile`"
                :data-profile-id="profile.id"
              >
                <div class="text-[11px] text-surface">{{ profile.label }}</div>
                <div v-if="profile.applicableTo.length > 0" class="mt-0.5 text-[10px] text-muted">
                  {{ profile.applicableTo.join(' / ') }}
                </div>
              </div>
            </div>
          </template>

          <div class="border-t border-border pt-2 text-[10px] text-muted">
            {{ chipsText.galleryReadonlyHint }}
          </div>
        </div>
      </PopoverContent>
    </PopoverPortal>
  </PopoverRoot>
</template>

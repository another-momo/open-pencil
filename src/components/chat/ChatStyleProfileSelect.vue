<script setup lang="ts">
/**
 * T24 style profile 下拉（T24-plan D8 薄 UI）：仅 marketing 模式渲染
 * （ui 模式注册表 acceptsProfile=false，overlay 不存在）。
 *
 * 数据源 = piStudioManifest（GET /api/pi/studio/manifest，T45 更名；正文不下发）。
 * 降级：manifest 拉取失败或注册表无 profiles → 触发器禁用空态（后端 overlay
 * 同步走 fallback 段，C5）。「No style profile」项清除选择（sentinel 映射 null，
 * reka Select 不收 null 值）。
 */
import { computed } from 'vue'
import {
  SelectContent,
  SelectItem,
  SelectItemText,
  SelectPortal,
  SelectRoot,
  SelectTrigger,
  SelectViewport
} from 'reka-ui'

import { piPickedProfileId, piStudioManifest } from '@/app/ai/pi-backend/mode-selection'
import { useSelectUI } from '@/components/ui/select'

const { disabled = false } = defineProps<{ disabled?: boolean }>()

const NO_PROFILE = '__none__'

const profiles = computed(() => piStudioManifest.value?.profiles ?? [])
const unavailable = computed(() => piStudioManifest.value === null || profiles.value.length === 0)

const selectedProfile = computed({
  get: () => piPickedProfileId.value ?? NO_PROFILE,
  set: (value: string) => {
    piPickedProfileId.value = value === NO_PROFILE ? null : value
  }
})

const selectedLabel = computed(
  () =>
    profiles.value.find((profile) => profile.id === piPickedProfileId.value)?.label ??
    'Style profile'
)

const selectCls = useSelectUI({
  trigger:
    'min-w-0 max-w-full gap-1 rounded border-none bg-transparent px-1.5 py-0.5 text-[10px] text-muted',
  content: 'max-h-60 overflow-y-auto',
  item: 'min-w-0 gap-2 rounded px-2 py-1.5 text-[11px]'
})
</script>

<template>
  <SelectRoot v-model="selectedProfile" :disabled="disabled || unavailable">
    <SelectTrigger
      data-test-id="chat-style-profile-select"
      aria-label="Select style profile"
      :class="selectCls.trigger"
    >
      <icon-lucide-swatch-book class="size-3" />
      <span class="min-w-0 truncate">{{ selectedLabel }}</span>
      <icon-lucide-chevron-down class="size-2.5" />
    </SelectTrigger>
    <SelectPortal>
      <SelectContent position="popper" side="top" :side-offset="4" :class="selectCls.content">
        <SelectViewport>
          <SelectItem :value="NO_PROFILE" :class="selectCls.item">
            <SelectItemText class="min-w-0 flex-1 truncate">No style profile</SelectItemText>
          </SelectItem>
          <SelectItem
            v-for="profile in profiles"
            :key="profile.id"
            :value="profile.id"
            :class="selectCls.item"
          >
            <SelectItemText class="min-w-0 flex-1 truncate">{{ profile.label }}</SelectItemText>
          </SelectItem>
        </SelectViewport>
      </SelectContent>
    </SelectPortal>
  </SelectRoot>
</template>

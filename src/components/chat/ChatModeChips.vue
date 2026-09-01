<script setup lang="ts">
/**
 * T61（Phase 3 W3/T-B10）：输入条内联 chips——T24 ChatModeSelect /
 * ChatStyleProfileSelect 的 PD-16 翻案重做（S1 §6 选择器层级）。
 *
 *  - 两级数据驱动：mode chip → profile chip 恒在（正交不过滤，PD-17）。
 *    type 中间级已随 T62 删除（manifest.modes[].types 数据面退役）——本文件
 *    无 type 级专属逻辑。
 *  - 恒回显 active_design（piChipSelection：未确认意向 > active 读穿 >
 *    默认态 general + 无 profile）；指针移动由 mode-selection watcher 自动
 *    同步，系统同步不触发意图。
 *  - 拨 chip = setPiChipSelection 暂存未确认意向（与回显相同则清空）；
 *    发消息时 ChatPanel 拦为新建意图确认卡。只拨 chip 浏览不发消息 = 无意图事件。
 *  - manifest 失败（piStudioManifestFailed）→ chips 禁用（错误条 + 重试在
 *    ChatInput 错误条区，08 P0-2）。
 */
import {
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuRoot,
  DropdownMenuTrigger
} from 'reka-ui'
import { computed } from 'vue'

import {
  piChipSelection,
  piPendingNewIntent,
  piStudioManifest,
  piStudioManifestFailed,
  setPiChipSelection
} from '@/app/ai/pi-backend/mode-selection'
import { useForkChips } from '@/app/i18n/fork'
import { menuItem, useMenuUI } from '@/components/ui/menu'

const { disabled = false } = defineProps<{ disabled?: boolean }>()

const chipsText = useForkChips()
const menuCls = useMenuUI({ content: 'min-w-36 max-w-56' })
const itemCls = menuItem({ justify: 'start' })

const modes = computed(() => piStudioManifest.value?.modes ?? [])
const profiles = computed(() => piStudioManifest.value?.profiles ?? [])

const selection = computed(() => piChipSelection.value)

const selectedMode = computed(
  () => modes.value.find((mode) => mode.id === selection.value.modeId) ?? null
)
const selectedProfile = computed(
  () => profiles.value.find((profile) => profile.id === selection.value.profileId) ?? null
)

const chipsDisabled = computed(
  () => disabled || piStudioManifestFailed.value || piStudioManifest.value === null
)
const hasPendingIntent = computed(() => piPendingNewIntent.value !== null)

function pickMode(modeId: string) {
  setPiChipSelection({ modeId, profileId: selection.value.profileId })
}

function pickProfile(profileId: string | null) {
  setPiChipSelection({ modeId: selection.value.modeId, profileId })
}

const triggerCls =
  'flex min-w-0 max-w-28 items-center gap-1 rounded px-1.5 py-0.5 text-[10px] text-muted outline-none hover:bg-hover data-[state=open]:bg-hover disabled:cursor-not-allowed disabled:opacity-50'
</script>

<template>
  <div data-test-id="chat-mode-chips" class="flex min-w-0 items-center gap-0.5">
    <!-- mode chip（一级） -->
    <DropdownMenuRoot>
      <DropdownMenuTrigger
        data-test-id="chat-mode-chip"
        :aria-label="chipsText.chipsMode"
        :disabled="chipsDisabled"
        :class="triggerCls"
      >
        <icon-lucide-palette class="size-3 shrink-0" />
        <span class="min-w-0 truncate">{{ selectedMode?.label ?? selection.modeId }}</span>
        <icon-lucide-chevron-down class="size-2.5 shrink-0" />
      </DropdownMenuTrigger>
      <DropdownMenuPortal>
        <DropdownMenuContent side="top" align="start" :side-offset="4" :class="menuCls.content">
          <DropdownMenuItem
            v-for="mode in modes"
            :key="mode.id"
            :class="itemCls"
            :data-test-id="`chat-mode-chip-item`"
            :data-mode-id="mode.id"
            @select="pickMode(mode.id)"
          >
            <icon-lucide-check
              v-if="mode.id === selection.modeId"
              :class="menuCls.icon"
              class="shrink-0"
            />
            <span v-else class="size-3 shrink-0" />
            <span class="min-w-0 truncate">{{ mode.label }}</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenuPortal>
    </DropdownMenuRoot>

    <!-- profile chip（恒在，正交不过滤） -->
    <DropdownMenuRoot>
      <DropdownMenuTrigger
        data-test-id="chat-profile-chip"
        :aria-label="chipsText.chipsProfile"
        :disabled="chipsDisabled"
        :class="triggerCls"
      >
        <icon-lucide-swatch-book class="size-3 shrink-0" />
        <span class="min-w-0 truncate">{{
          selectedProfile?.label ?? chipsText.chipsNoProfile
        }}</span>
        <icon-lucide-chevron-down class="size-2.5 shrink-0" />
      </DropdownMenuTrigger>
      <DropdownMenuPortal>
        <DropdownMenuContent side="top" align="start" :side-offset="4" :class="menuCls.content">
          <DropdownMenuItem
            :class="itemCls"
            data-test-id="chat-profile-chip-item"
            @select="pickProfile(null)"
          >
            <icon-lucide-check
              v-if="selection.profileId === null"
              :class="menuCls.icon"
              class="shrink-0"
            />
            <span v-else class="size-3 shrink-0" />
            <span class="min-w-0 truncate">{{ chipsText.chipsNoProfile }}</span>
          </DropdownMenuItem>
          <DropdownMenuItem
            v-for="profile in profiles"
            :key="profile.id"
            :class="itemCls"
            :data-test-id="`chat-profile-chip-item`"
            :data-profile-id="profile.id"
            @select="pickProfile(profile.id)"
          >
            <icon-lucide-check
              v-if="profile.id === selection.profileId"
              :class="menuCls.icon"
              class="shrink-0"
            />
            <span v-else class="size-3 shrink-0" />
            <span class="min-w-0 truncate">{{ profile.label }}</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenuPortal>
    </DropdownMenuRoot>

    <!-- 未确认新建意向标记（发送前可见信号；确认卡见 ChatNewIntentCard） -->
    <span
      v-if="hasPendingIntent"
      data-test-id="chat-chips-pending-badge"
      class="shrink-0 rounded bg-accent/15 px-1.5 py-0.5 text-[10px] text-accent"
    >
      {{ chipsText.chipsPendingBadge }}
    </span>
  </div>
</template>

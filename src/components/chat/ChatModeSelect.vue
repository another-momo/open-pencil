<script setup lang="ts">
/**
 * T24 AgentMode 切换（T24-plan D8 薄 UI）：ui / marketing 两态。
 * 切换语义 = 后端驱逐 SessionEntry 重建（同 sessionId 同历史，T24-plan D4），
 * 流式中禁用（进行中的 run 不切模式）。
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

import { piChatMode } from '@/app/ai/pi-backend/mode-selection'
import type { PiChatMode } from '@/app/ai/pi-backend/chat-mode'
import { useSelectUI } from '@/components/ui/select'

const { disabled = false } = defineProps<{ disabled?: boolean }>()

const MODE_LABELS: Record<PiChatMode, string> = {
  ui: 'UI design',
  marketing: 'Marketing'
}
const modes = Object.keys(MODE_LABELS) as PiChatMode[]

const selectedMode = computed({
  get: () => piChatMode.value,
  set: (mode: PiChatMode) => {
    piChatMode.value = mode
  }
})

const selectCls = useSelectUI({
  trigger:
    'min-w-0 max-w-full gap-1 rounded border-none bg-transparent px-1.5 py-0.5 text-[10px] text-muted',
  content: 'max-h-60 overflow-y-auto',
  item: 'min-w-0 gap-2 rounded px-2 py-1.5 text-[11px]'
})
</script>

<template>
  <SelectRoot v-model="selectedMode" :disabled="disabled">
    <SelectTrigger
      data-test-id="chat-mode-select"
      aria-label="Select agent mode"
      :class="selectCls.trigger"
    >
      <icon-lucide-palette class="size-3" />
      <span class="min-w-0 truncate">{{ MODE_LABELS[selectedMode] }}</span>
      <icon-lucide-chevron-down class="size-2.5" />
    </SelectTrigger>
    <SelectPortal>
      <SelectContent position="popper" side="top" :side-offset="4" :class="selectCls.content">
        <SelectViewport>
          <SelectItem v-for="mode in modes" :key="mode" :value="mode" :class="selectCls.item">
            <SelectItemText class="min-w-0 flex-1 truncate">{{ MODE_LABELS[mode] }}</SelectItemText>
          </SelectItem>
        </SelectViewport>
      </SelectContent>
    </SelectPortal>
  </SelectRoot>
</template>

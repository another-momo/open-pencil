<script setup lang="ts">
import { useI18n } from '@open-pencil/vue'

import type { ChatMode } from '@/app/ai/chat/storage'
import { useProviderSettingsContext } from '@/components/chat/ProviderSettings/context'

const ctx = useProviderSettingsContext()
const { dialogs } = useI18n()

const modes: { value: ChatMode; label: string }[] = [
  { value: 'ui', label: 'UI Design' },
  { value: 'marketing', label: 'Marketing Design' }
]

function onModeChange(event: Event) {
  const select = event.target as HTMLSelectElement
  ctx.setChatMode(select.value as ChatMode)
}
</script>

<template>
  <div class="flex flex-col gap-1">
    <label class="text-[11px] font-medium text-muted">{{ dialogs.designMode }}</label>
    <select
      :value="ctx.chatMode"
      class="w-full rounded border border-border bg-input px-2 py-1 text-[11px] text-surface outline-none focus:border-accent"
      data-test-id="chat-mode-select"
      @change="onModeChange"
    >
      <option v-for="mode in modes" :key="mode.value" :value="mode.value">
        {{ mode.label }}
      </option>
    </select>
  </div>
</template>

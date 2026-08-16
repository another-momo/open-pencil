<script setup lang="ts">
import type { AgentMode } from '@/app/ai/chat/agent-transport'
import { useProviderSettingsContext } from '@/components/settings/provider/context'

const ctx = useProviderSettingsContext()

const modes: { value: AgentMode; label: string; hint: string }[] = [
  {
    value: 'backend',
    label: 'Backend (recommended)',
    hint: 'Routes every chat through the local agent backend that `bun run dev` spawns.'
  },
  {
    value: 'browser',
    label: 'In-browser',
    hint: 'Runs the agent loop directly in the frontend. Skips the local backend entirely.'
  },
  {
    value: 'auto',
    label: 'Auto fallback',
    hint: 'Uses the backend if reachable; otherwise falls back to in-browser. Legacy behavior.'
  }
]

function onModeChange(event: Event) {
  const select = event.target as HTMLSelectElement
  ctx.setAgentMode(select.value as AgentMode)
}
</script>

<template>
  <div class="flex flex-col gap-1">
    <label class="text-[11px] text-muted">Agent mode</label>
    <select
      :value="ctx.agentMode"
      class="w-full rounded border border-border bg-input px-2 py-1 text-[11px] text-surface outline-none focus:border-accent"
      data-test-id="agent-mode-select"
      @change="onModeChange"
    >
      <option v-for="mode in modes" :key="mode.value" :value="mode.value">
        {{ mode.label }}
      </option>
    </select>
    <p class="text-[10px] text-muted">
      {{ modes.find((m) => m.value === ctx.agentMode)?.hint }}
    </p>
  </div>
</template>

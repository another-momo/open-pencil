<script setup lang="ts">
import { useI18n } from '@open-pencil/vue'

import ProviderSettingsKeyField from '@/components/chat/ProviderSettings/ProviderSettingsKeyField.vue'
import { useProviderSettingsContext } from '@/components/chat/ProviderSettings/context'

const ctx = useProviderSettingsContext()
const { dialogs } = useI18n()

function onModeChange(event: Event) {
  const select = event.target as HTMLSelectElement
  ctx.visionMode = select.value as 'A' | 'B'
}

function onProviderChange(event: Event) {
  const select = event.target as HTMLSelectElement
  ctx.visionProvider = select.value as 'openai-compatible' | 'anthropic-compatible'
}
</script>

<template>
  <div class="flex flex-col gap-1">
    <select
      :value="ctx.visionMode"
      class="w-full rounded border border-border bg-input px-2 py-1 text-[11px] text-surface outline-none focus:border-accent"
      data-test-id="vision-mode-select"
      @change="onModeChange"
    >
      <option value="A">{{ dialogs.visionModeA }}</option>
      <option value="B">{{ dialogs.visionModeB }}</option>
    </select>
  </div>

  <template v-if="ctx.visionMode === 'B'">
    <div class="flex flex-col gap-1">
      <label class="text-[10px] text-muted">{{ dialogs.visionProvider }}</label>
      <select
        :value="ctx.visionProvider"
        class="w-full rounded border border-border bg-input px-2 py-1 text-[11px] text-surface outline-none focus:border-accent"
        data-test-id="vision-provider-select"
        @change="onProviderChange"
      >
        <option value="openai-compatible">{{ dialogs.visionProviderOpenAI }}</option>
        <option value="anthropic-compatible">{{ dialogs.visionProviderAnthropic }}</option>
      </select>
    </div>
    <div class="flex items-end gap-1.5">
      <div class="min-w-0 flex-1">
        <ProviderSettingsKeyField
          v-model="ctx.visionKeyInput"
          :label="dialogs.visionAPIKey"
          :saved="!!ctx.visionApiKey"
          kind="api"
          :placeholder="
            ctx.hasExistingVisionKey ? dialogs.keySavedReplace : dialogs.visionAPIKeyPlaceholder
          "
          @clear="ctx.clearVisionKey"
          @change="ctx.save"
        />
      </div>
      <button
        class="shrink-0 pb-1 text-[10px] text-accent hover:underline disabled:text-muted disabled:no-underline"
        :disabled="!ctx.canCopyMainKey"
        data-test-id="vision-copy-main-key"
        @click="ctx.copyMainKeyToVision"
      >
        {{ dialogs.copyFromMain }}
      </button>
    </div>

    <div class="flex items-end gap-1.5">
      <div class="min-w-0 flex-1">
        <ProviderSettingsKeyField
          v-model="ctx.visionBaseURLInput"
          :label="dialogs.visionBaseURL"
          :saved="!!ctx.visionBaseURL"
          kind="url"
          type="text"
          placeholder="https://api.minimax.io/v1"
          @clear="ctx.clearVisionKey"
          @change="ctx.save"
        />
      </div>
      <button
        class="shrink-0 pb-1 text-[10px] text-accent hover:underline disabled:text-muted disabled:no-underline"
        :disabled="!ctx.canCopyMainBaseURL"
        data-test-id="vision-copy-main-baseurl"
        @click="ctx.copyMainBaseURLToVision"
      >
        {{ dialogs.copyFromMain }}
      </button>
    </div>

    <div class="flex items-end gap-1.5">
      <div class="min-w-0 flex-1">
        <ProviderSettingsKeyField
          v-model="ctx.visionModelInput"
          :label="dialogs.visionModel"
          :saved="!!ctx.visionModel"
          kind="model"
          type="text"
          placeholder="MiniMax-M3"
          @clear="ctx.clearVisionKey"
          @change="ctx.save"
        />
      </div>
      <button
        class="shrink-0 pb-1 text-[10px] text-accent hover:underline disabled:text-muted disabled:no-underline"
        :disabled="!ctx.canCopyMainModel"
        data-test-id="vision-copy-main-model"
        @click="ctx.copyMainModelToVision"
      >
        {{ dialogs.copyFromMain }}
      </button>
    </div>
  </template>
</template>

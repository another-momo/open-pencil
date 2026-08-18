<script setup lang="ts">
import { TooltipProvider } from 'reka-ui'
import { computed, ref, watch } from 'vue'

import ChatProfileSelect from '@/components/chat/ChatProfileSelect.vue'
import ProviderModelSelect from '@/components/chat/ProviderModelSelect.vue'
import AppInput from '@/components/ui/AppInput.vue'
import Tip from '@/components/ui/Tip.vue'
import { useButtonUI } from '@/components/ui/button'
import { inferMaterialTypeFromText } from '@/app/ai/chat/material-type-infer'
import { createBriefInStore, openBriefPanel } from '@/app/ai/marketing/brief-panel'
import { setInferredMaterialType } from '@/app/ai/marketing/settings'
import { useAIChat } from '@/app/ai/chat/use'
import { designModelProfile, designModelProfiles } from '@/app/ai/models'
import { openSettingsDialog } from '@/app/settings/dialog'
import { useI18n } from '@open-pencil/vue'

import { ACP_AGENTS } from '@open-pencil/core/constants'

import { ensureBrandConfig } from '@/app/ai/marketing/library'
import BriefPanelDialog from '@/components/chat/BriefPanelDialog.vue'
import MarketingConfigBar from '@/components/chat/MarketingConfigBar.vue'

const { providerID, providerDef, modelID, customModelID, chatMode } = useAIChat()
const { dialogs } = useI18n()

const { status } = defineProps<{
  status: 'ready' | 'submitted' | 'streaming' | 'error'
}>()

const emit = defineEmits<{
  submit: [text: string]
  stop: []
}>()

const input = ref('')

const isStreaming = computed(() => status === 'streaming' || status === 'submitted')
const isACPProvider = computed(() => providerID.value.startsWith('acp:'))
const acpAgentName = computed(() => {
  const agentId = providerID.value.replace('acp:', '')
  return ACP_AGENTS.find((a) => a.id === agentId)?.name ?? agentId
})
const isCustomProvider = computed(
  () => providerID.value === 'openai-compatible' || providerID.value === 'anthropic-compatible'
)
const stopButton = useButtonUI({
  tone: 'ghost',
  shape: 'rounded',
  size: 'sm',
  ui: { base: 'shrink-0 border border-border px-2 py-1.5' }
})
const sendButton = useButtonUI({
  tone: 'accent',
  shape: 'rounded',
  size: 'sm',
  ui: { base: 'shrink-0 px-2.5 py-1.5 font-medium' }
})
const customModelName = computed(() => customModelID.value.trim())
const usesCustomModel = computed(
  () => !!providerDef.value.supportsCustomModel && !!customModelName.value
)

const selectedModelName = computed(() => {
  if (usesCustomModel.value) return customModelName.value
  if (isCustomProvider.value) return 'No model'
  return providerDef.value.models.find((m) => m.id === modelID.value)?.name ?? modelID.value
})

// Switching between saved profiles only makes sense once more than one can drive the design agent.
const switchableProfiles = computed(designModelProfiles)
const canSwitchProfile = computed(() => switchableProfiles.value.length > 1)
const selectedProfileName = computed(
  () => designModelProfile.value?.name ?? selectedModelName.value
)

const modeLabel = computed(() =>
  chatMode.value === 'marketing' ? 'Marketing Design' : 'UI Design'
)

watch(
  chatMode,
  async (mode) => {
    if (mode !== 'marketing') return
    await ensureBrandConfig()
  },
  { immediate: true }
)

watch(input, (text) => {
  if (chatMode.value !== 'marketing') return
  setInferredMaterialType(inferMaterialTypeFromText(text))
})

async function handleSubmit(e: Event) {
  e.preventDefault()
  const text = input.value.trim()
  if (!text) return
  if (chatMode.value === 'marketing') {
    // Await the brand-config load so the first turn's system-prompt overlay
    // already contains the material types list — otherwise a fast submit
    // right after switching to marketing mode would make the model see
    // "No material types available" and fall back to custom.
    await ensureBrandConfig()
  }
  emit('submit', text)
  input.value = ''
}

function handleNewBrief() {
  // Single-brief semantics: create only when missing, then open the panel
  createBriefInStore()
  openBriefPanel()
}
</script>

<template>
  <TooltipProvider>
    <div class="shrink-0 border-t border-border px-3 py-2">
      <!-- Model selector & settings -->
      <div class="mb-1.5 flex items-center gap-1">
        <template v-if="isACPProvider">
          <div class="flex items-center gap-1 px-1.5 py-0.5 text-[10px] text-muted">
            <icon-lucide-bot class="size-3" />
            {{ modeLabel }}
            <span class="text-border">|</span>
            {{ acpAgentName }}
          </div>
        </template>
        <ChatProfileSelect v-else-if="canSwitchProfile && (isCustomProvider || usesCustomModel)">
          <template #value>
            <span class="min-w-0 truncate">{{ selectedProfileName }}</span>
          </template>
        </ChatProfileSelect>
        <template v-else-if="isCustomProvider || usesCustomModel">
          <div
            class="flex items-center gap-1 px-1.5 py-0.5 text-[10px] text-muted"
            data-test-id="chat-custom-model-label"
          >
            <icon-lucide-bot class="size-3" />
            {{ modeLabel }}
            <span class="text-border">|</span>
            {{ selectedModelName }}
          </div>
        </template>
        <ProviderModelSelect v-else>
          <template #value>{{ modeLabel }} | {{ selectedModelName }}</template>
        </ProviderModelSelect>

        <div class="ml-auto flex items-center gap-1">
          <Tip v-if="chatMode === 'marketing'" :label="dialogs.newBrief">
            <button
              type="button"
              data-test-id="new-brief-button"
              class="rounded p-0.5 text-muted hover:bg-hover hover:text-surface"
              @click="handleNewBrief"
            >
              <icon-lucide-sticky-note class="size-3" />
            </button>
          </Tip>
          <Tip :label="dialogs.providerSettings">
            <button
              type="button"
              data-test-id="provider-settings-trigger"
              :aria-label="dialogs.providerSettings"
              class="rounded p-0.5 text-muted hover:bg-hover hover:text-surface"
              @click="openSettingsDialog('ai')"
            >
              <icon-lucide-settings class="size-3" />
            </button>
          </Tip>
        </div>
      </div>

      <!-- Marketing config bar (type / profile / references) -->
      <MarketingConfigBar v-if="chatMode === 'marketing'" />

      <!-- Input form -->
      <form class="flex gap-1.5" @submit="handleSubmit">
        <AppInput
          v-model="input"
          data-test-id="chat-input"
          :placeholder="dialogs.describeChange"
          class="min-w-0 flex-1 placeholder:text-muted"
          :disabled="isStreaming"
          @paste.stop
          @copy.stop
          @cut.stop
        />
        <Tip v-if="isStreaming" :label="dialogs.stopGenerating">
          <button
            type="button"
            data-test-id="chat-stop-button"
            :class="stopButton.base"
            @click="emit('stop')"
          >
            <icon-lucide-square class="size-3" />
          </button>
        </Tip>
        <Tip v-else :label="dialogs.sendMessage">
          <button
            type="submit"
            data-test-id="chat-send-button"
            :class="sendButton.base"
            :disabled="!input.trim()"
          >
            <icon-lucide-send class="size-3" />
          </button>
        </Tip>
      </form>

      <BriefPanelDialog v-if="chatMode === 'marketing'" />
    </div>
  </TooltipProvider>
</template>

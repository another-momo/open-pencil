<script setup lang="ts">
import { TooltipProvider } from 'reka-ui'
import { computed, ref, watch } from 'vue'

import ProviderModelSelect from '@/components/chat/ProviderModelSelect.vue'
import ProviderSettings from '@/components/chat/ProviderSettings/ProviderSettings.vue'
import AppInput from '@/components/ui/AppInput.vue'
import Tip from '@/components/ui/Tip.vue'
import { useButtonUI } from '@/components/ui/button'
import { inferMaterialTypeFromText } from '@/app/ai/chat/material-type-infer'
import {
  materialTypeSelection,
  setInferredMaterialType,
  toggleMaterialTypeLock
} from '@/app/ai/chat/storage'
import { useAIChat } from '@/app/ai/chat/use'
import { makeFigmaFromStore } from '@/app/automation/bridge/figma-factory'
import { getActiveEditorStore } from '@/app/editor/active-store'
import { useI18n } from '@open-pencil/vue'

import { ACP_AGENTS } from '@open-pencil/core/constants'
import { computeAllLayouts } from '@open-pencil/core/layout'
import { createBrief, listMaterialTypes } from '@open-pencil/core/tools'

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

const modeLabel = computed(() =>
  chatMode.value === 'marketing' ? 'Marketing Design' : 'UI Design'
)

const materialTypes = listMaterialTypes()

watch(input, (text) => {
  if (chatMode.value !== 'marketing') return
  setInferredMaterialType(inferMaterialTypeFromText(text))
})

function materialTypeChipClass(id: string): string {
  const selected = materialTypeSelection.value?.id === id
  const locked = selected && materialTypeSelection.value?.source === 'user'
  const base = 'shrink-0 rounded-full border px-2 py-0.5 text-[10px] transition-colors'
  if (locked) return `${base} border-accent bg-accent/15 font-medium text-accent`
  if (selected) return `${base} border-dashed border-accent/60 bg-accent/5 text-accent`
  return `${base} border-border text-muted hover:border-accent/40 hover:text-surface`
}

function handleSubmit(e: Event) {
  e.preventDefault()
  const text = input.value.trim()
  if (!text) return
  emit('submit', text)
  input.value = ''
}

function handleNewBrief() {
  const store = getActiveEditorStore()
  const before = store.snapshotPage()
  const figma = makeFigmaFromStore(store)
  const center = store.viewportCanvasCenter()
  const brief = createBrief(figma, center.x - 180, center.y - 120)
  computeAllLayouts(store.graph, store.state.currentPageId)
  store.select([brief.id])
  store.requestRender()
  const after = store.snapshotPage()
  store.pushUndoEntry({
    label: '新建需求单',
    forward: () => store.restorePageFromSnapshot(after),
    inverse: () => store.restorePageFromSnapshot(before)
  })
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
          <ProviderSettings />
        </div>
      </div>

      <!-- Material type chips (marketing mode) -->
      <div
        v-if="chatMode === 'marketing'"
        class="mb-1.5 flex items-center gap-1 overflow-x-auto"
        data-test-id="material-type-chips"
      >
        <button
          v-for="type in materialTypes"
          :key="type.id"
          type="button"
          :class="materialTypeChipClass(type.id)"
          :data-type-id="type.id"
          @click="toggleMaterialTypeLock(type.id)"
        >
          {{ type.label }}
        </button>
      </div>

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
    </div>
  </TooltipProvider>
</template>

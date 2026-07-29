import { useLocalStorage } from '@vueuse/core'
import { computed, ref, watch } from 'vue'

import {
  AI_PROVIDERS,
  DEFAULT_AI_MODEL,
  DEFAULT_AI_PROVIDER,
  IS_BROWSER,
  IS_TAURI
} from '@open-pencil/core/constants'
import type { AIProviderID } from '@open-pencil/core/constants'
import {
  setPexelsApiKey,
  setUnsplashAccessKey,
  setImageGenCredentials
} from '@open-pencil/core/tools'

const STORAGE_PREFIX = 'open-pencil:'

export type ChatMode = 'ui' | 'marketing'
const LEGACY_KEY_STORAGE = `${STORAGE_PREFIX}openrouter-api-key`

export function keyStorageKey(id: string) {
  return `${STORAGE_PREFIX}ai-key:${id}`
}

function migrateLegacyStorage() {
  const legacyKey = localStorage.getItem(LEGACY_KEY_STORAGE)
  if (legacyKey) {
    localStorage.setItem(keyStorageKey('openrouter'), legacyKey)
    localStorage.removeItem(LEGACY_KEY_STORAGE)
    if (!localStorage.getItem(`${STORAGE_PREFIX}ai-provider`)) {
      localStorage.setItem(`${STORAGE_PREFIX}ai-provider`, 'openrouter')
    }
  }
}

if (IS_BROWSER) migrateLegacyStorage()

export const providerID = useLocalStorage<AIProviderID>(
  `${STORAGE_PREFIX}ai-provider`,
  DEFAULT_AI_PROVIDER
)
const apiKeyStorageKey = computed(() => keyStorageKey(providerID.value))
export const apiKey = useLocalStorage(apiKeyStorageKey, '')
export const modelID = useLocalStorage(`${STORAGE_PREFIX}ai-model`, DEFAULT_AI_MODEL)
export const customBaseURL = useLocalStorage(`${STORAGE_PREFIX}ai-base-url`, '')
export const customModelID = useLocalStorage(`${STORAGE_PREFIX}ai-custom-model`, '')
export const customAPIType = useLocalStorage<'completions' | 'responses'>(
  `${STORAGE_PREFIX}ai-api-type`,
  'completions'
)
export const maxOutputTokens = useLocalStorage(`${STORAGE_PREFIX}ai-max-output-tokens`, 16384)
// Media elision: how many recent tool-result images (look/export_image) are
// kept as base64 in each LLM request; older ones become text placeholders.
export const lookImagesKept = useLocalStorage(`${STORAGE_PREFIX}ai-look-images-kept`, 2)
export const pexelsApiKey = useLocalStorage(`${STORAGE_PREFIX}pexels-api-key`, '')
export const unsplashAccessKey = useLocalStorage(`${STORAGE_PREFIX}unsplash-access-key`, '')
// Image-generation credentials — independent from the chat LLM key/base URL.
export const imageGenApiKey = useLocalStorage(`${STORAGE_PREFIX}image-gen-api-key`, '')
export const imageGenBaseURL = useLocalStorage(
  `${STORAGE_PREFIX}image-gen-base-url`,
  'https://www.dmxapi.cn/v1'
)
export const imageGenModel = useLocalStorage(
  `${STORAGE_PREFIX}image-gen-model`,
  'gpt-image-2-ssvip'
)

// Chat mode: 'ui' (default) or 'marketing'
export const chatMode = useLocalStorage<ChatMode>(`${STORAGE_PREFIX}chat-mode`, 'ui')

/**
 * Material type selection for the marketing chips row.
 * - 'user': explicitly clicked by the user — a hard lock injected into the
 *   next message; AI must not override it
 * - 'inferred': local keyword pre-inference from the input text — visual
 *   hint only, replaced whenever the user clicks or the AI sets up
 * - 'ai': synced from the AI's setup_material_type call
 */
export type MaterialTypeSource = 'user' | 'inferred' | 'ai'
export const materialTypeSelection = ref<{ id: string; source: MaterialTypeSource } | null>(
  null
)

export function toggleMaterialTypeLock(id: string): void {
  const current = materialTypeSelection.value
  materialTypeSelection.value =
    current?.source === 'user' && current.id === id ? null : { id, source: 'user' }
}

export function setInferredMaterialType(id: string | null): void {
  if (materialTypeSelection.value?.source === 'user') return
  materialTypeSelection.value = id ? { id, source: 'inferred' } : null
}

export function syncMaterialTypeFromAI(id: string): void {
  materialTypeSelection.value = { id, source: 'ai' }
}

export const providerDef = computed(
  () => AI_PROVIDERS.find((p) => p.id === providerID.value) ?? AI_PROVIDERS[0]
)

export const isACPProvider = computed(() => providerID.value.startsWith('acp:'))

export const isConfigured = computed(() => {
  if (isACPProvider.value) return IS_TAURI
  if (!apiKey.value) return false
  const needsBaseURL =
    providerID.value === 'openai-compatible' || providerID.value === 'anthropic-compatible'
  if (needsBaseURL && !customBaseURL.value) return false
  return true
})

export function setAPIKey(key: string) {
  apiKey.value = key
}

export function registerAIChatEffects(markTransportDirty: () => void) {
  watch(
    pexelsApiKey,
    (key) => {
      setPexelsApiKey(key || null)
    },
    { immediate: true }
  )

  watch(
    unsplashAccessKey,
    (key) => {
      setUnsplashAccessKey(key || null)
    },
    { immediate: true }
  )

  watch(
    [imageGenApiKey, imageGenBaseURL, imageGenModel],
    ([key, baseURL, model]) => {
      setImageGenCredentials(key || null, baseURL || undefined, model || undefined)
    },
    { immediate: true }
  )

  watch(providerID, (id) => {
    const def = AI_PROVIDERS.find((p) => p.id === id)
    if (def?.defaultModel) {
      modelID.value = def.defaultModel
    }
    markTransportDirty()
  })

  watch(modelID, markTransportDirty)
  watch(customModelID, markTransportDirty)
  watch(customAPIType, markTransportDirty)
  watch(apiKey, markTransportDirty)
  watch(customBaseURL, markTransportDirty)
  watch(chatMode, markTransportDirty)
}

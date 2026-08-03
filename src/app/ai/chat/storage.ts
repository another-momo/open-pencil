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
  setImageGenCredentials,
  setVisionCredentials,
  setVisionMode,
  setVisionProvider
} from '@open-pencil/core/tools'
import type { VisionMode, VisionProvider } from '@open-pencil/core/tools'

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

// Vision channel (l2-visual-loop.md §3): 'A' = main model sees images directly;
// 'B' = look calls an independent vision model and returns text only.
// Credentials are independent — empty means channel B stays unavailable.
export const visionMode = useLocalStorage<VisionMode>(`${STORAGE_PREFIX}ai-vision-mode`, 'A')
export const visionProvider = useLocalStorage<VisionProvider>(
  `${STORAGE_PREFIX}vision-provider`,
  'openai-compatible'
)
export const visionApiKey = useLocalStorage(`${STORAGE_PREFIX}vision-api-key`, '')
export const visionBaseURL = useLocalStorage(`${STORAGE_PREFIX}vision-base-url`, '')
export const visionModel = useLocalStorage(`${STORAGE_PREFIX}vision-model`, '')

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
export const materialTypeSelection = ref<{ id: string; source: MaterialTypeSource } | null>(null)

export function toggleMaterialTypeLock(id: string): void {
  const current = materialTypeSelection.value
  materialTypeSelection.value =
    current?.source === 'user' && current.id === id ? null : { id, source: 'user' }
}

/** Explicitly set or clear the user-locked material type (config bar) */
export function setUserMaterialType(id: string | null): void {
  materialTypeSelection.value = id ? { id, source: 'user' } : null
}

/**
 * Current style profile (P8, 2026-08-01). Profile is a user-driven asset
 * — only the `ProfileGalleryDialog` writes to this ref. AI does not pick
 * profiles; setup never auto-picks either. The shape mirrors
 * `materialTypeSelection` so the chip and overlay read from a single source.
 *
 * - `source: 'user'`  — picked in ProfileGalleryDialog, persisted as core
 *   preferences so setup picks it deterministically.
 * - `null`            — no user-picked profile; the overlay emits no
 *   profile section and `setup_material_type` does not mount a profile.
 */
export const profileSelection = ref<{ id: string; source: 'user' } | null>(null)

export function setUserProfile(id: string | null): void {
  profileSelection.value = id ? { id, source: 'user' } : null
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

  watch(
    visionMode,
    (mode) => {
      setVisionMode(mode)
    },
    { immediate: true }
  )

  watch(
    visionProvider,
    (provider) => {
      setVisionProvider(provider)
    },
    { immediate: true }
  )

  watch(
    [visionApiKey, visionBaseURL, visionModel],
    ([key, baseURL, model]) => {
      setVisionCredentials(key || null, baseURL, model)
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

import { useLocalStorage } from '@vueuse/core'
import { ref, watch } from 'vue'

import {
  setImageGenCredentials,
  setVisionCredentials,
  setVisionMode,
  setVisionProvider
} from '@open-pencil/core/tools'
import type { VisionMode, VisionProvider } from '@open-pencil/core/tools'

/**
 * Fork-owned AI/marketing settings state (see docs/plans/architecture/
 * fork-divergence.md R2). Everything here lives outside upstream's
 * chat/storage.ts so that file can track upstream unchanged — upstream's
 * model-profiles store (src/app/ai/models/) owns the chat model config,
 * this module owns the fork's additions: marketing mode, image generation,
 * vision channel, and media elision preferences.
 */

const STORAGE_PREFIX = 'open-pencil:'

export type ChatMode = 'ui' | 'marketing'

// Media elision: how many recent tool-result images (look/export_image) are
// kept as base64 in each LLM request; older ones become text placeholders.
export const lookImagesKept = useLocalStorage(`${STORAGE_PREFIX}ai-look-images-kept`, 2)
// Image-generation credentials — independent from the chat LLM key/base URL.
export const imageGenAPIKey = useLocalStorage(`${STORAGE_PREFIX}image-gen-api-key`, '')
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
export const visionAPIKey = useLocalStorage(`${STORAGE_PREFIX}vision-api-key`, '')
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
 * - `source: 'user'`  — picked in ProfileGalleryDialog; setup reads it
 *   deterministically via the marketing overlay.
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

/**
 * Push the fork's settings into core and mark the chat transport dirty when
 * they change. Called once from the chat session setup alongside upstream's
 * registerAIChatEffects.
 */
export function registerMarketingSettingsEffects(markTransportDirty: () => void) {
  watch(
    [imageGenAPIKey, imageGenBaseURL, imageGenModel],
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
    [visionAPIKey, visionBaseURL, visionModel],
    ([key, baseURL, model]) => {
      setVisionCredentials(key || null, baseURL, model)
    },
    { immediate: true }
  )

  watch(chatMode, markTransportDirty)
}

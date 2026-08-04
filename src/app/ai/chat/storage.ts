import { useLocalStorage } from '@vueuse/core'
import { computed, ref, watch } from 'vue'

import { IS_TAURI } from '@open-pencil/core/constants'
import {
  setPexelsApiKey,
  setUnsplashAccessKey,
  setImageGenCredentials,
  setVisionCredentials,
  setVisionMode,
  setVisionProvider
} from '@open-pencil/core/tools'
import type { VisionMode, VisionProvider } from '@open-pencil/core/tools'

import {
  designCustomAPIType,
  designCustomBaseURL,
  designCustomModelID,
  designMaxOutputTokens,
  designModelConnection,
  designModelID,
  designProviderDefinition,
  designProviderID,
  modelConnectionCredentialRef
} from '@/app/ai/models'
import { appCredentialServices, browserCredentialsRemembered } from '@/app/settings/credentials/app'
import {
  initializeCredentialMigration,
  PEXELS_CREDENTIAL,
  UNSPLASH_CREDENTIAL
} from '@/app/settings/credentials/migration'
import { setAppCredentialPersistence } from '@/app/settings/credentials/persistence'
import type { CredentialRef, CredentialStatus } from '@/app/settings/credentials/types'

const STORAGE_PREFIX = 'open-pencil:'

export type ChatMode = 'ui' | 'marketing'

// Media elision: how many recent tool-result images (look/export_image) are
// kept as base64 in each LLM request; older ones become text placeholders.
export const lookImagesKept = useLocalStorage(`${STORAGE_PREFIX}ai-look-images-kept`, 2)
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

export const providerID = designProviderID
export const modelID = designModelID
export const customBaseURL = designCustomBaseURL
export const customModelID = designCustomModelID
export const customAPIType = designCustomAPIType
export const maxOutputTokens = designMaxOutputTokens
export const providerDef = designProviderDefinition

export const apiKeyStatus = ref<CredentialStatus>('missing')
export const pexelsKeyStatus = ref<CredentialStatus>('missing')
export const unsplashKeyStatus = ref<CredentialStatus>('missing')
const credentialRevision = ref(0)

export const isACPProvider = computed(() => providerID.value.startsWith('acp:'))

export const isConfigured = computed(() => {
  if (isACPProvider.value) return IS_TAURI
  if (apiKeyStatus.value !== 'configured') return false
  const needsBaseURL =
    providerID.value === 'openai-compatible' || providerID.value === 'anthropic-compatible'
  return !needsBaseURL || Boolean(customBaseURL.value)
})

async function refreshStatus(reference: CredentialRef): Promise<CredentialStatus> {
  return appCredentialServices.manager.status(reference)
}

function designCredentialReference(): CredentialRef | null {
  const connection = designModelConnection.value
  if (!connection || connection.providerID.startsWith('acp:')) return null
  return modelConnectionCredentialRef(connection)
}

export async function refreshAIProviderStatus(): Promise<void> {
  const reference = designCredentialReference()
  apiKeyStatus.value = reference ? await refreshStatus(reference) : 'missing'
}

async function refreshMediaCredentials(): Promise<void> {
  const [pexelsStatus, unsplashStatus] = await Promise.all([
    refreshStatus(PEXELS_CREDENTIAL),
    refreshStatus(UNSPLASH_CREDENTIAL)
  ])
  pexelsKeyStatus.value = pexelsStatus
  unsplashKeyStatus.value = unsplashStatus
  setPexelsApiKey(
    pexelsStatus === 'configured'
      ? await appCredentialServices.resolver.resolve(PEXELS_CREDENTIAL)
      : null
  )
  setUnsplashAccessKey(
    unsplashStatus === 'configured'
      ? await appCredentialServices.resolver.resolve(UNSPLASH_CREDENTIAL)
      : null
  )
}

export const credentialsReady = initializeCredentialMigration().then(async () => {
  await Promise.all([refreshAIProviderStatus(), refreshMediaCredentials()])
  return undefined
})

export async function resolveAPIKey(): Promise<string | null> {
  await credentialsReady
  const reference = designCredentialReference()
  return reference ? appCredentialServices.resolver.resolve(reference) : null
}

export async function setAPIKey(key: string): Promise<void> {
  const reference = designCredentialReference()
  if (!reference) return
  const value = key.trim()
  if (value) await appCredentialServices.manager.set(reference, value)
  else await appCredentialServices.manager.clear(reference)
  apiKeyStatus.value = await refreshStatus(reference)
  credentialRevision.value++
}

export async function setPexelsKey(key: string): Promise<void> {
  const value = key.trim()
  if (value) await appCredentialServices.manager.set(PEXELS_CREDENTIAL, value)
  else await appCredentialServices.manager.clear(PEXELS_CREDENTIAL)
  pexelsKeyStatus.value = await refreshStatus(PEXELS_CREDENTIAL)
  setPexelsApiKey(value || null)
}

export async function setUnsplashKey(key: string): Promise<void> {
  const value = key.trim()
  if (value) await appCredentialServices.manager.set(UNSPLASH_CREDENTIAL, value)
  else await appCredentialServices.manager.clear(UNSPLASH_CREDENTIAL)
  unsplashKeyStatus.value = await refreshStatus(UNSPLASH_CREDENTIAL)
  setUnsplashAccessKey(value || null)
}

export async function setRememberCredentials(remembered: boolean): Promise<void> {
  await credentialsReady
  await setAppCredentialPersistence(remembered)
  await Promise.all([refreshAIProviderStatus(), refreshMediaCredentials()])
  credentialRevision.value++
}

export { browserCredentialsRemembered }

export function registerAIChatEffects(markTransportDirty: () => void) {
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

  watch(
    () => designModelConnection.value?.id,
    () => {
      void refreshAIProviderStatus()
      markTransportDirty()
    }
  )
  watch(modelID, markTransportDirty)
  watch(customModelID, markTransportDirty)
  watch(customAPIType, markTransportDirty)
  watch(customBaseURL, markTransportDirty)
  watch(chatMode, markTransportDirty)
  watch(maxOutputTokens, markTransportDirty)
  watch(credentialRevision, markTransportDirty)
}

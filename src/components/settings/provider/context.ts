import { computed, inject, provide, proxyRefs, ref } from 'vue'
import type { InjectionKey, ShallowUnwrapRef } from 'vue'

import { resolveProviderAPIFormat, resolveProviderBaseURL } from '@/app/ai/chat/model'
import { useAIChat } from '@/app/ai/chat/use'
import type { ChatMode } from '@/app/ai/marketing/settings'
import {
  clearVisionBaseURL,
  clearVisionKey,
  clearVisionModel,
  saveVisionSettings
} from '@/app/ai/marketing/vision-settings'

// Fork-owned provider settings context (marketing/vision/image-gen). Upstream's
// chat-model settings moved to the model-profiles system
// (src/app/ai/models/* + settings/models/ModelsPanel.vue); this context now
// only backs the fork sections: ChatModeSection, LookImagesKeptSection,
// ImageGenKeysSection, VisionKeysSection.
function createProviderSettingsContext() {
  const {
    providerID,
    apiKeyStatus,
    resolveAPIKey,
    customBaseURL,
    customModelID,
    modelID,
    lookImagesKept,
    imageGenAPIKey,
    imageGenBaseURL,
    imageGenModel,
    visionMode,
    visionAPIKey,
    visionBaseURL,
    visionModel,
    visionProvider,
    chatMode,
    resetChat
  } = useAIChat()

  const isACP = computed(() => providerID.value.startsWith('acp:'))
  const imageGenKeyInput = ref('')
  const imageGenBaseURLInput = ref(imageGenBaseURL.value)
  const imageGenModelInput = ref(imageGenModel.value)
  const hasExistingImageGenKey = ref(!!imageGenAPIKey.value)
  const visionKeyInput = ref('')
  const visionBaseURLInput = ref(visionBaseURL.value)
  const visionModelInput = ref(visionModel.value)
  const hasExistingVisionKey = ref(!!visionAPIKey.value)
  const mainModelValue = computed(() => customModelID.value.trim() || modelID.value)
  const mainBaseURLValue = computed(() =>
    resolveProviderBaseURL(providerID.value, customBaseURL.value)
  )
  const canCopyMainKey = computed(() => apiKeyStatus.value === 'configured')
  const canCopyMainBaseURL = computed(() => !!mainBaseURLValue.value)
  const canCopyMainModel = computed(() => !!mainModelValue.value)

  async function save() {
    if (imageGenKeyInput.value.trim()) {
      imageGenAPIKey.value = imageGenKeyInput.value.trim()
      hasExistingImageGenKey.value = true
      imageGenKeyInput.value = ''
    }
    if (imageGenBaseURLInput.value.trim()) {
      imageGenBaseURL.value = imageGenBaseURLInput.value.trim()
    }
    if (imageGenModelInput.value.trim()) {
      imageGenModel.value = imageGenModelInput.value.trim()
    }
    saveVisionSettings(
      { visionAPIKey, visionBaseURL, visionModel },
      { visionKeyInput, visionBaseURLInput, visionModelInput, hasExistingVisionKey }
    )
  }

  function clearImageGenKey() {
    imageGenAPIKey.value = ''
    imageGenKeyInput.value = ''
    hasExistingImageGenKey.value = false
  }

  const visionStorage = { visionAPIKey, visionBaseURL, visionModel }
  const visionInputs = {
    visionKeyInput,
    visionBaseURLInput,
    visionModelInput,
    hasExistingVisionKey
  }

  // Copy-from-main buttons persist immediately: they fill the input
  // programmatically, which never fires the field's change event, so deferring
  // to save() would silently drop the copied value when the dialog closes.
  async function copyMainKeyToVision() {
    if (!canCopyMainKey.value) return
    const key = await resolveAPIKey()
    if (!key) return
    visionKeyInput.value = key
    saveVisionSettings(visionStorage, visionInputs)
  }

  function copyMainBaseURLToVision() {
    const baseURL = mainBaseURLValue.value
    if (!baseURL) return
    visionBaseURLInput.value = baseURL
    // Align the provider type with the endpoint's request format when known,
    // so the copied URL isn't combined with a mismatched format.
    const format = resolveProviderAPIFormat(providerID.value)
    if (format) visionProvider.value = format
    saveVisionSettings(visionStorage, visionInputs)
  }

  function copyMainModelToVision() {
    if (!canCopyMainModel.value) return
    visionModelInput.value = mainModelValue.value
    saveVisionSettings(visionStorage, visionInputs)
  }

  function setChatMode(mode: ChatMode) {
    chatMode.value = mode
    resetChat()
  }

  return {
    isACP,
    lookImagesKept,
    imageGenAPIKey,
    imageGenBaseURL,
    imageGenModel,
    visionMode,
    visionAPIKey,
    visionBaseURL,
    visionModel,
    visionProvider,
    chatMode,
    imageGenKeyInput,
    imageGenBaseURLInput,
    imageGenModelInput,
    visionKeyInput,
    visionBaseURLInput,
    visionModelInput,
    hasExistingVisionKey,
    canCopyMainKey,
    canCopyMainBaseURL,
    canCopyMainModel,
    hasExistingImageGenKey,
    save,
    clearImageGenKey,
    clearVisionKey: () => clearVisionKey(visionStorage, visionInputs),
    clearVisionBaseURL: () => clearVisionBaseURL(visionStorage, visionInputs),
    clearVisionModel: () => clearVisionModel(visionStorage, visionInputs),
    copyMainKeyToVision,
    copyMainBaseURLToVision,
    copyMainModelToVision,
    setChatMode
  }
}

export type ProviderSettingsContext = ShallowUnwrapRef<
  ReturnType<typeof createProviderSettingsContext>
>

const PROVIDER_SETTINGS_KEY: InjectionKey<ProviderSettingsContext> =
  Symbol('ProviderSettingsContext')

export function provideProviderSettings() {
  const ctx = proxyRefs(createProviderSettingsContext())
  provide(PROVIDER_SETTINGS_KEY, ctx)
  return ctx
}

export function useProviderSettingsContext(): ProviderSettingsContext {
  const ctx = inject(PROVIDER_SETTINGS_KEY)
  if (!ctx) throw new Error('Provider settings controls must be used within ProviderSettings')
  return ctx
}

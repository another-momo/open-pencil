import { computed, inject, provide, proxyRefs, ref, watch } from 'vue'
import type { InjectionKey, ShallowUnwrapRef } from 'vue'

import {
  testProviderConnection,
  type ProviderConnectionTestFailureReason
} from '@/app/ai/chat/connection-test'
import { resolveProviderApiFormat, resolveProviderBaseURL } from '@/app/ai/chat/model'
import type { ChatMode } from '@/app/ai/chat/storage'
import { useAIChat } from '@/app/ai/chat/use'

function createProviderSettingsContext() {
  const {
    providerID,
    providerDef,
    apiKeyStatus,
    setAPIKey,
    resolveAPIKey,
    customBaseURL,
    customModelID,
    modelID,
    customAPIType,
    maxOutputTokens,
    lookImagesKept,
    pexelsKeyStatus,
    setPexelsKey,
    unsplashKeyStatus,
    setUnsplashKey,
    imageGenApiKey,
    imageGenBaseURL,
    imageGenModel,
    visionMode,
    visionApiKey,
    visionBaseURL,
    visionModel,
    visionProvider,
    chatMode,
    resetChat
  } = useAIChat()

  const isACP = computed(() => providerID.value.startsWith('acp:'))
  const keyInput = ref('')
  const pexelsKeyInput = ref('')
  const unsplashKeyInput = ref('')
  const baseURLInput = ref(customBaseURL.value)
  const customModelInput = ref(customModelID.value)
  const hasExistingKey = ref(apiKeyStatus.value === 'configured')
  const hasExistingPexelsKey = ref(pexelsKeyStatus.value === 'configured')
  const hasExistingUnsplashKey = ref(unsplashKeyStatus.value === 'configured')
  const imageGenKeyInput = ref('')
  const imageGenBaseURLInput = ref(imageGenBaseURL.value)
  const imageGenModelInput = ref(imageGenModel.value)
  const hasExistingImageGenKey = ref(!!imageGenApiKey.value)
  const visionKeyInput = ref('')
  const visionBaseURLInput = ref(visionBaseURL.value)
  const visionModelInput = ref(visionModel.value)
  const hasExistingVisionKey = ref(!!visionApiKey.value)
  const mainModelValue = computed(() => customModelID.value.trim() || modelID.value)
  const mainBaseURLValue = computed(() =>
    resolveProviderBaseURL(providerID.value, customBaseURL.value)
  )
  const canCopyMainKey = computed(() => apiKeyStatus.value === 'configured')
  const canCopyMainBaseURL = computed(() => !!mainBaseURLValue.value)
  const canCopyMainModel = computed(() => !!mainModelValue.value)
  const connectionTestStatus = ref<'idle' | 'testing' | 'success' | 'error'>('idle')
  const connectionTestReason = ref<ProviderConnectionTestFailureReason | null>(null)

  const canTestConnection = computed(() => {
    if (isACP.value) return false
    if (!keyInput.value.trim() && !hasExistingKey.value) return false
    if (providerDef.value.supportsCustomBaseURL && !baseURLInput.value.trim()) return false
    if (providerDef.value.supportsCustomModel && !customModelInput.value.trim()) return false
    return true
  })

  function resetConnectionTest() {
    connectionTestStatus.value = 'idle'
    connectionTestReason.value = null
  }

  watch(providerID, () => {
    keyInput.value = ''
    hasExistingKey.value = apiKeyStatus.value === 'configured'
    baseURLInput.value = customBaseURL.value
    customModelInput.value = customModelID.value
    resetConnectionTest()
  })

  watch(
    [keyInput, baseURLInput, customModelInput, customAPIType, imageGenBaseURLInput],
    resetConnectionTest
  )
  watch(apiKeyStatus, (status) => {
    hasExistingKey.value = status === 'configured'
  })
  watch(pexelsKeyStatus, (status) => {
    hasExistingPexelsKey.value = status === 'configured'
  })
  watch(unsplashKeyStatus, (status) => {
    hasExistingUnsplashKey.value = status === 'configured'
  })

  async function save() {
    if (keyInput.value.trim()) {
      await setAPIKey(keyInput.value.trim())
      hasExistingKey.value = true
      keyInput.value = ''
    }
    if (pexelsKeyInput.value.trim()) {
      await setPexelsKey(pexelsKeyInput.value.trim())
      hasExistingPexelsKey.value = true
      pexelsKeyInput.value = ''
    }
    if (unsplashKeyInput.value.trim()) {
      await setUnsplashKey(unsplashKeyInput.value.trim())
      hasExistingUnsplashKey.value = true
      unsplashKeyInput.value = ''
    }
    if (imageGenKeyInput.value.trim()) {
      imageGenApiKey.value = imageGenKeyInput.value.trim()
      hasExistingImageGenKey.value = true
      imageGenKeyInput.value = ''
    }
    if (imageGenBaseURLInput.value.trim()) {
      imageGenBaseURL.value = imageGenBaseURLInput.value.trim()
    }
    if (imageGenModelInput.value.trim()) {
      imageGenModel.value = imageGenModelInput.value.trim()
    }
    if (visionKeyInput.value.trim()) {
      visionApiKey.value = visionKeyInput.value.trim()
      hasExistingVisionKey.value = true
      visionKeyInput.value = ''
    }
    if (visionBaseURLInput.value.trim()) {
      visionBaseURL.value = visionBaseURLInput.value.trim()
    }
    if (visionModelInput.value.trim()) {
      visionModel.value = visionModelInput.value.trim()
    }
    if (providerDef.value.supportsCustomBaseURL) {
      customBaseURL.value = baseURLInput.value.trim()
    }
    if (providerDef.value.supportsCustomModel) {
      customModelID.value = customModelInput.value.trim()
    }
  }

  async function clearKey() {
    await setAPIKey('')
    keyInput.value = ''
    hasExistingKey.value = false
  }

  async function clearPexelsKey() {
    await setPexelsKey('')
    pexelsKeyInput.value = ''
    hasExistingPexelsKey.value = false
  }

  async function clearUnsplashKey() {
    await setUnsplashKey('')
    unsplashKeyInput.value = ''
    hasExistingUnsplashKey.value = false
  }

  function clearImageGenKey() {
    imageGenApiKey.value = ''
    imageGenKeyInput.value = ''
    hasExistingImageGenKey.value = false
  }

  function clearVisionKey() {
    visionApiKey.value = ''
    visionKeyInput.value = ''
    hasExistingVisionKey.value = false
  }

  // Copy-from-main buttons only fill the inputs — nothing is persisted until
  // save() runs, matching every other field in this dialog.
  async function copyMainKeyToVision() {
    if (!canCopyMainKey.value) return
    const key = await resolveAPIKey()
    if (!key) return
    visionKeyInput.value = key
  }

  function copyMainBaseURLToVision() {
    const baseURL = mainBaseURLValue.value
    if (!baseURL) return
    visionBaseURLInput.value = baseURL
    // Align the provider type with the endpoint's request format when known,
    // so the copied URL isn't combined with a mismatched format.
    const format = resolveProviderApiFormat(providerID.value)
    if (format) visionProvider.value = format
  }

  function copyMainModelToVision() {
    if (!canCopyMainModel.value) return
    visionModelInput.value = mainModelValue.value
  }

  function setCustomAPIType(value: string) {
    customAPIType.value = value as 'completions' | 'responses'
    void save()
  }

  function setChatMode(mode: ChatMode) {
    chatMode.value = mode
    resetChat()
  }

  async function testConnection() {
    if (connectionTestStatus.value === 'testing') return
    connectionTestStatus.value = 'testing'
    connectionTestReason.value = null

    const result = await testProviderConnection({
      providerID: providerID.value,
      apiKey: keyInput.value.trim() || (await resolveAPIKey()) || '',
      modelID: modelID.value,
      customModelID: providerDef.value.supportsCustomModel
        ? customModelInput.value.trim()
        : customModelID.value,
      customBaseURL: providerDef.value.supportsCustomBaseURL
        ? baseURLInput.value.trim()
        : customBaseURL.value,
      customAPIType: customAPIType.value
    })

    if (result.ok) {
      connectionTestStatus.value = 'success'
      connectionTestReason.value = null
      return
    }

    connectionTestStatus.value = 'error'
    connectionTestReason.value = result.reason
  }

  return {
    providerID,
    providerDef,
    apiKeyStatus,
    modelID,
    customAPIType,
    customBaseURL,
    customModelID,
    maxOutputTokens,
    lookImagesKept,
    pexelsKeyStatus,
    unsplashKeyStatus,
    imageGenApiKey,
    imageGenBaseURL,
    imageGenModel,
    visionMode,
    visionApiKey,
    visionBaseURL,
    visionModel,
    visionProvider,
    chatMode,
    isACP,
    keyInput,
    pexelsKeyInput,
    unsplashKeyInput,
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
    baseURLInput,
    customModelInput,
    hasExistingKey,
    hasExistingPexelsKey,
    hasExistingUnsplashKey,
    hasExistingImageGenKey,
    hasExistingImageGenModel: ref(!!imageGenModel.value),
    connectionTestStatus,
    connectionTestReason,
    canTestConnection,
    save,
    clearKey,
    clearPexelsKey,
    clearUnsplashKey,
    clearImageGenKey,
    clearVisionKey,
    copyMainKeyToVision,
    copyMainBaseURLToVision,
    copyMainModelToVision,
    setCustomAPIType,
    setChatMode,
    testConnection
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

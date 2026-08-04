import { ref } from 'vue'

import { IS_BROWSER } from '@open-pencil/core/constants'

import {
  apiKeyStatus,
  browserCredentialsRemembered,
  credentialsReady,
  customAPIType,
  customBaseURL,
  customModelID,
  isACPProvider,
  isConfigured,
  maxOutputTokens,
  modelID,
  pexelsKeyStatus,
  providerDef,
  providerID,
  registerAIChatEffects,
  resolveAPIKey,
  setAPIKey,
  setPexelsKey,
  setRememberCredentials,
  setUnsplashKey,
  unsplashKeyStatus
} from '@/app/ai/chat/storage'
import { createChatSessionManager } from '@/app/ai/chat/transports'
import {
  chatMode,
  imageGenApiKey,
  imageGenBaseURL,
  imageGenModel,
  lookImagesKept,
  registerMarketingSettingsEffects,
  visionApiKey,
  visionBaseURL,
  visionMode,
  visionModel,
  visionProvider
} from '@/app/ai/marketing/settings'
import { exposeChatTransportOverride } from '@/app/browser-bridge'
import { getActiveEditorStore } from '@/app/editor/active-store'

const activeTab = ref<'design' | 'code' | 'ai'>('design')

const chatSession = createChatSessionManager({
  isConfigured,
  isACPProvider,
  providerID,
  credentialsReady,
  chatMode,
  getActiveEditorStore
})

registerAIChatEffects(chatSession.markTransportDirty)
registerMarketingSettingsEffects(chatSession.markTransportDirty)

if (IS_BROWSER) {
  exposeChatTransportOverride((factory) => {
    chatSession.setOverrideTransport(factory)
  })
}

export function useAIChat() {
  return {
    providerID,
    providerDef,
    apiKeyStatus,
    browserCredentialsRemembered,
    setAPIKey,
    resolveAPIKey,
    modelID,
    customBaseURL,
    customModelID,
    customAPIType,
    maxOutputTokens,
    pexelsKeyStatus,
    setPexelsKey,
    setRememberCredentials,
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
    activeTab,
    isConfigured,
    lookImagesKept,
    ensureChat: chatSession.ensureChat,
    resetChat: chatSession.resetChat
  }
}

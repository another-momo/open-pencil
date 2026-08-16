import { ref } from 'vue'

import { IS_BROWSER } from '@open-pencil/core/constants'

import {
  probeAgentBackend,
  resetAgentBackendCache,
  type AgentBackendInfo
} from '@/app/ai/chat/agent-transport'
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
  imageGenAPIKey,
  imageGenBaseURL,
  imageGenModel,
  lookImagesKept,
  registerMarketingSettingsEffects,
  visionAPIKey,
  visionBaseURL,
  visionMode,
  visionModel,
  visionProvider
} from '@/app/ai/marketing/settings'
import { exposeChatTransportOverride } from '@/app/browser-bridge'
import { getActiveEditorStore } from '@/app/editor/active-store'

const activeTab = ref<'design' | 'code' | 'ai'>('design')

const agentBackend = ref<AgentBackendInfo | null>(null)

if (IS_BROWSER) {
  void probeAgentBackend().then((info) => {
    agentBackend.value = info
    return info
  })
}

const chatSession = createChatSessionManager({
  isConfigured,
  isACPProvider,
  providerID,
  credentialsReady,
  chatMode,
  getActiveEditorStore,
  getAgentBackend: () => agentBackend.value
})

registerAIChatEffects(() => {
  chatSession.markTransportDirty()
  resetAgentBackendCache()
  void probeAgentBackend().then((info) => {
    agentBackend.value = info
    return info
  })
})
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
    imageGenAPIKey,
    imageGenBaseURL,
    imageGenModel,
    visionMode,
    visionAPIKey,
    visionBaseURL,
    visionModel,
    visionProvider,
    chatMode,
    activeTab,
    isConfigured,
    lookImagesKept,
    agentBackend,
    ensureChat: chatSession.ensureChat,
    resetChat: chatSession.resetChat
  }
}

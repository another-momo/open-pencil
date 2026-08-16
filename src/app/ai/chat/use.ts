import { ref, watch } from 'vue'

import { IS_BROWSER } from '@open-pencil/core/constants'

import {
  agentMode,
  probeAgentBackend,
  resetAgentBackendCache,
  setAgentMode,
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

/**
 * Set when agent mode is `'backend'` (default) and the local agent is
 * unreachable. The UI surfaces a banner with a recovery hint instead of
 * silently routing through the in-browser fallback.
 */
export const agentBackendError = ref<string | null>(null)

async function refreshAgentBackend(): Promise<void> {
  const mode = agentMode.value
  agentBackendError.value = null
  if (mode === 'browser') {
    agentBackend.value = null
    return
  }
  const info = await probeAgentBackend()
  agentBackend.value = info
  if (mode === 'backend' && !info) {
    agentBackendError.value =
      'Local agent backend is not reachable on 127.0.0.1:7601. ' +
      'Run `bun run dev` (it auto-spawns the agent) or switch the Agent mode setting.'
  }
}

if (IS_BROWSER) {
  void refreshAgentBackend()
}

// React to mode flips — clear cache and re-probe so the next chat
// routes through the right path.
watch(
  agentMode,
  () => {
    chatSession.markTransportDirty()
    resetAgentBackendCache()
    void refreshAgentBackend()
  }
)

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
  void refreshAgentBackend()
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
    agentBackendError,
    agentMode,
    setAgentMode,
    ensureChat: chatSession.ensureChat,
    resetChat: chatSession.resetChat
  }
}

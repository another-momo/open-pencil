import { ref } from 'vue'

import { IS_BROWSER } from '@open-pencil/core/constants'

import {
  apiKeyStatus,
  browserCredentialsRemembered,
  credentialsReady,
  customAPIType,
  customBaseURL,
  customModelID,
  isHarnessProvider,
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
import { loadPiChatHistory, mintPiSessionId } from '@/app/ai/pi-backend/document-key'
import { exposeChatTransportOverride } from '@/app/browser-bridge'
import { getActiveEditorStore } from '@/app/editor/active-store'

const activeTab = ref<'design' | 'code' | 'ai'>('design')

// T22：pi 后端模式下接线「历史回填 + clear 铸新会话」钩子（T22-plan D2/D3）；
// 非 pi 模式不挂（legacy 路径行为零变化）
const piSessionHooks =
  import.meta.env.VITE_PI_BACKEND === '1'
    ? {
        loadHistory: loadPiChatHistory,
        onSessionReset: (store: ReturnType<typeof getActiveEditorStore>) => {
          void mintPiSessionId(store)
        }
      }
    : {}

const chatSession = createChatSessionManager({
  isConfigured,
  isHarnessProvider,
  credentialsReady,
  getActiveEditorStore,
  ...piSessionHooks
})

registerAIChatEffects(chatSession.markTransportDirty)

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
    activeTab,
    isConfigured,
    ensureChat: chatSession.ensureChat,
    resetChat: chatSession.resetChat,
    chatFailure: chatSession.failure,
    clearChatFailure: chatSession.clearFailure
  }
}

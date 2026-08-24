import { ref } from 'vue'

import { IS_BROWSER } from '@open-pencil/core/constants'

import { createChatSessionManager } from '@/app/ai/chat/transports'
import { loadPiChatHistory, mintPiSessionId } from '@/app/ai/pi-backend/document-key'
import { exposeChatTransportOverride } from '@/app/browser-bridge'
import { getActiveEditorStore } from '@/app/editor/active-store'
import {
  browserCredentialsRemembered,
  pexelsKeyStatus,
  setPexelsKey,
  setRememberCredentials,
  setUnsplashKey,
  unsplashKeyStatus
} from '@/app/settings/credentials/stock-photo-keys'

/**
 * T25：pi 单路径后的 chat 入口——会话钩子恒挂（T22 D2/D3），模型/凭证旧面
 * 已切除；stock-photo key 与 remember 开关经此处 re-export 给设置 UI。
 */
const activeTab = ref<'design' | 'code' | 'ai'>('design')

const chatSession = createChatSessionManager({
  getActiveEditorStore,
  loadHistory: loadPiChatHistory,
  onSessionReset: (store: ReturnType<typeof getActiveEditorStore>) => {
    void mintPiSessionId(store)
  }
})

if (IS_BROWSER) {
  exposeChatTransportOverride((factory) => {
    chatSession.setOverrideTransport(factory)
  })
}

export function useAIChat() {
  return {
    activeTab,
    pexelsKeyStatus,
    setPexelsKey,
    unsplashKeyStatus,
    setUnsplashKey,
    browserCredentialsRemembered,
    setRememberCredentials,
    ensureChat: chatSession.ensureChat,
    resetChat: chatSession.resetChat,
    chatFailure: chatSession.failure,
    clearChatFailure: chatSession.clearFailure
  }
}

import { Chat } from '@ai-sdk/vue'
import type { ChatTransport, FinishReason, UIMessage } from 'ai'
import { ref } from 'vue'

import {
  classifyAIChatError,
  classifyAIChatFinish,
  type AIChatFailure
} from '@/app/ai/chat/failure'
import type { getActiveEditorStore } from '@/app/editor/active-store'

type EditorStore = ReturnType<typeof getActiveEditorStore>

/**
 * T25：三路径收敛为 pi 单路径后的会话管理器——transport 唯一来源是 override
 * 工厂（pi 由 pi-backend/attach.ts 注册；e2e mock 经同一钩子注入）。
 * 旧浏览器 ToolLoopAgent 直连路径与 harness sidecar 路径已切除（T25-plan D1/D2）。
 */
type ChatSessionOptions = {
  getActiveEditorStore: () => EditorStore
  /** T22：pi 后端历史回填——Chat 创建且本地无消息时拉取（T22-plan D3） */
  loadHistory?: (store: EditorStore) => Promise<UIMessage[] | undefined>
  /** T22：pi 后端 clear 上下文钩子——清空后铸新会话（T22-plan D2 时间戳后缀） */
  onSessionReset?: (store: EditorStore) => void
}

export function createChatSessionManager({
  getActiveEditorStore,
  loadHistory,
  onSessionReset
}: ChatSessionOptions) {
  const failure = ref<AIChatFailure | null>(null)
  let transportDirty = false
  let currentChatStore: EditorStore | null = null
  let currentChatMessages = new WeakMap<EditorStore, UIMessage[]>()
  let chat: Chat<UIMessage> | null = null
  let overrideTransport: ((store: EditorStore) => ChatTransport<UIMessage>) | null = null

  function handleChatFinish({
    finishReason,
    isAbort,
    isError
  }: {
    finishReason?: FinishReason
    isAbort: boolean
    isError: boolean
  }): void {
    if (!isAbort && !isError) failure.value = classifyAIChatFinish(finishReason)
  }

  function clearFailure(): void {
    failure.value = null
  }

  function markTransportDirty() {
    transportDirty = true
    currentChatStore = null
    currentChatMessages = new WeakMap()
  }

  function createTransport(store: EditorStore) {
    if (!overrideTransport) {
      // pi attach 在 app 启动时恒注册（T25 D3 门退役）；走到这里说明启动顺序异常
      throw new Error('Chat transport is not registered (pi backend attach missing)')
    }
    return overrideTransport(store)
  }

  async function ensureChat(): Promise<Chat<UIMessage> | null> {
    const store = getActiveEditorStore()
    if (currentChatStore && chat) {
      currentChatMessages.set(currentChatStore, chat.messages)
    }

    if (!chat || transportDirty || currentChatStore !== store) {
      let messages = currentChatMessages.get(store)
      // T22：本地无消息时从 pi 后端回填该文档会话族的历史（R2：只灌空态，
      // 不做增量合并）；失败/无历史返回 undefined 即全新会话。
      // 空数组同样重取：restore/打开文件的 docId 在首次 ensureChat 后才就位
      // （graph:replaced 时序），只认 WeakMap 缺失会让回填永远错过该窗口
      if ((!messages || messages.length === 0) && loadHistory) {
        messages = (await loadHistory(store)) ?? messages
      }
      chat = new Chat<UIMessage>({
        transport: createTransport(store),
        messages,
        onError: (error) => {
          failure.value = classifyAIChatError(error)
        },
        onFinish: handleChatFinish
      })
      currentChatStore = store
      transportDirty = false
    } else if (loadHistory && chat.messages.length === 0) {
      // T22：restore/打开文件复用同 store（tab id 不变，不触发重建）——图替换后
      // docId 就位，会话仍为空则补一次回填；loadHistory 守卫确保 clear 后不复活
      const activeChat = chat
      const history = await loadHistory(store)
      if (history?.length && chat === activeChat) chat.messages = history
    }
    return chat
  }

  async function resetChat() {
    const store = currentChatStore
    if (store) currentChatMessages.delete(store)
    failure.value = null
    chat = null
    currentChatStore = null
    transportDirty = false
    // T22：pi 模式下 clear = 该文档会话族内铸新会话（旧会话后端归档保留）
    if (store) onSessionReset?.(store)
  }

  function setOverrideTransport(
    factory: ((store: EditorStore) => ChatTransport<UIMessage>) | null
  ) {
    overrideTransport = factory
    markTransportDirty()
  }

  return {
    ensureChat,
    resetChat,
    markTransportDirty,
    setOverrideTransport,
    failure,
    clearFailure
  }
}

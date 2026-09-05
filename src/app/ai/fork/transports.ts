// Batch 2a 路径分离（2026-09-05）：本文件自 src/app/ai/chat/transports.ts 迁入
// owned 路径 src/app/ai/fork/，原上游路径留给 deletedPaths 落账——pi 单路径
// 会话管理器为 fork 实质重写（override transport 唯一来源），不再跟随上游。
import { Chat } from '@ai-sdk/vue'
import type { ChatTransport, FinishReason, UIMessage } from 'ai'
import { ref } from 'vue'

import { recordChatCompleted, recordChatFailed } from '@/app/diagnostics'
import type { getActiveEditorStore } from '@/app/editor/active-store'

import { classifyAIChatError, classifyAIChatFinish, type AIChatFailure } from './failure'

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
  /** T22：pi 后端 clear 上下文钩子——清空后铸新会话（T22-plan D2 时间戳后缀）。
   * T27：允许返回 Promise——resetChat 会 await 它，调用方可在铸会话完成后
   * 确定性刷新 UI（替代 setTimeout 魔法数等待） */
  onSessionReset?: (store: EditorStore) => unknown
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
  // T27：ensureChat 调用序号——loadHistory await 期间切 tab 会让旧调用的结果
  // 晚到新调用之后，过期调用必须丢弃（否则旧 store 的 chat 覆盖新 tab 的 chat）
  let ensureSeq = 0

  function handleChatFinish({
    finishReason,
    isAbort,
    isError
  }: {
    finishReason?: FinishReason
    isAbort: boolean
    isError: boolean
  }): void {
    if (!isAbort && !isError) {
      failure.value = classifyAIChatFinish(finishReason)
      // T36：chat 级 diagnostics 接线（owner 拍板①，对 T31「不采纳」的追认反转）——
      // 语义对齐上游 88c10770 版（上游另有 isDisconnect 参，fork 面无此信号）；
      // token 级 recordModelStepCompleted 经 pi 后端采数不在本任务范围（登记排期）
      recordChatCompleted({ finishReason: finishReason ?? null })
    }
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
    const seq = ++ensureSeq
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
        const history = await loadHistory(store)
        // T27：await 期间有更新的 ensureChat 调用（切 tab/reset）——本次结果过期，
        // 直接返回当前 chat（新调用已重建或会重建），不得用旧 store 覆盖
        if (seq !== ensureSeq) return chat
        messages = history ?? messages
      }
      chat = new Chat<UIMessage>({
        transport: createTransport(store),
        messages,
        onError: (error) => {
          failure.value = classifyAIChatError(error)
          // T36：chat 级 diagnostics 接线（owner 拍板①）——对齐上游 88c10770 版语义
          recordChatFailed({ errorName: error instanceof Error ? error.name : 'unknown' })
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
      // T27：await 期间过期判定同上一并带序号（chat 引用比较挡不住 resetChat
      // 后同引用重建之外的交错，序号是单一事实源）
      if (history?.length && chat === activeChat && seq === ensureSeq) chat.messages = history
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
    // T27：await 铸会话完成（crypto.subtle 异步），调用方得以确定性刷新
    if (store) await onSessionReset?.(store)
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

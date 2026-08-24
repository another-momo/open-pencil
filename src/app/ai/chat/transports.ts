import { Chat } from '@ai-sdk/vue'
import { DirectChatTransport, stepCountIs, ToolLoopAgent } from 'ai'
import type { ChatTransport, FinishReason, LanguageModel, UIMessage } from 'ai'
import type { ComputedRef } from 'vue'
import { ref } from 'vue'

import type { AIProviderID } from '@open-pencil/core/constants'

import {
  classifyAIChatError,
  classifyAIChatFinish,
  type AIChatFailure
} from '@/app/ai/chat/failure'
import { resolveLanguageModelID } from '@/app/ai/chat/model'
import { buildReasoningProviderOptions, type AIProviderOptions } from '@/app/ai/chat/reasoning'
import SYSTEM_PROMPT from '@/app/ai/chat/system-prompt.md?raw'
import { createAIModelRuntime, resolveModelConnectionAPIKey } from '@/app/ai/models'
import { MAX_AGENT_STEPS, createAITools, recordStepUsage, resetRunSteps } from '@/app/ai/tools'
import type { getActiveEditorStore } from '@/app/editor/active-store'

type EditorStore = ReturnType<typeof getActiveEditorStore>

type ChatSessionOptions = {
  isConfigured: ComputedRef<boolean>
  isHarnessProvider: ComputedRef<boolean>
  credentialsReady: Promise<void>
  getActiveEditorStore: () => EditorStore
  /** T22：pi 后端历史回填——Chat 创建且本地无消息时拉取（T22-plan D3） */
  loadHistory?: (store: EditorStore) => Promise<UIMessage[] | undefined>
  /** T22：pi 后端 clear 上下文钩子——清空后铸新会话（T22-plan D2 时间戳后缀） */
  onSessionReset?: (store: EditorStore) => void
}

type ToolLoopTransportOptions = {
  store: EditorStore
  providerID: AIProviderID
  model: LanguageModel
  effectiveModelID: string
  maxOutputTokens: number
  reasoningEffort: string
}

const ANTHROPIC_CACHE_CONTROL = {
  anthropic: { cacheControl: { type: 'ephemeral' } }
} as const

function supportsAnthropicCaching(providerID: AIProviderID, modelID: string): boolean {
  return (
    providerID === 'anthropic' ||
    providerID === 'anthropic-compatible' ||
    (providerID === 'openrouter' && modelID.startsWith('anthropic/'))
  )
}

function mergeProviderOptions(
  cacheOptions: typeof ANTHROPIC_CACHE_CONTROL | undefined,
  reasoningOptions: AIProviderOptions | undefined
): AIProviderOptions | undefined {
  if (!cacheOptions && !reasoningOptions) return undefined
  return { ...cacheOptions, ...reasoningOptions }
}

export function createToolLoopTransport({
  store,
  providerID,
  model,
  effectiveModelID,
  maxOutputTokens,
  reasoningEffort
}: ToolLoopTransportOptions) {
  const tools = createAITools(store)
  const cacheProviderOptions = supportsAnthropicCaching(providerID, effectiveModelID)
    ? ANTHROPIC_CACHE_CONTROL
    : undefined
  const providerOptions = mergeProviderOptions(
    cacheProviderOptions,
    buildReasoningProviderOptions(providerID, reasoningEffort)
  )

  const agent = new ToolLoopAgent({
    model,
    instructions: SYSTEM_PROMPT,
    tools,
    stopWhen: stepCountIs(MAX_AGENT_STEPS),
    maxOutputTokens,
    providerOptions,
    prepareCall: (options) => {
      resetRunSteps(store)
      return {
        ...options,
        maxOutputTokens,
        providerOptions
      }
    },
    onStepFinish: ({ usage }) => {
      recordStepUsage(
        {
          inputTokens: usage.inputTokens ?? 0,
          outputTokens: usage.outputTokens ?? 0,
          cacheReadTokens: usage.inputTokenDetails.cacheReadTokens ?? 0,
          cacheWriteTokens: usage.inputTokenDetails.cacheWriteTokens ?? 0,
          timestamp: Date.now()
        },
        store
      )
    }
  })

  return new DirectChatTransport({ agent }) as ChatTransport<UIMessage>
}

export function createChatSessionManager({
  isConfigured,
  isHarnessProvider,
  credentialsReady,
  getActiveEditorStore,
  loadHistory,
  onSessionReset
}: ChatSessionOptions) {
  const failure = ref<AIChatFailure | null>(null)
  let transportDirty = false
  let currentChatStore: EditorStore | null = null
  let currentChatMessages = new WeakMap<EditorStore, UIMessage[]>()
  let chat: Chat<UIMessage> | null = null
  let harnessTransportInstance: { destroy(): Promise<void> } | null = null
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

  async function destroyAgentTransports(): Promise<void> {
    const harness = harnessTransportInstance
    harnessTransportInstance = null
    await harness?.destroy()
  }

  async function createActiveHarnessTransport() {
    await destroyAgentTransports()
    const runtime = await createAIModelRuntime('design')
    if (runtime?.kind !== 'harness') throw new Error('The Design agent is not configured for Pi')
    const [{ HarnessChatTransport }, { buildPiMCPServers }, { getActiveTabId }] = await Promise.all(
      [import('@/app/ai/harness/transport'), import('@/app/integrations/mcp'), import('@/app/tabs')]
    )
    const apiKey = await resolveModelConnectionAPIKey(runtime.role.connection.id)
    if (!apiKey) throw new Error('Credential is unavailable for the Pi agent')
    const model = runtime.role.profile.customModelID || runtime.role.profile.modelID
    const transport = new HarnessChatTransport(
      `tab-${getActiveTabId()}-${runtime.role.profile.id}`,
      {
        adapter: 'pi',
        sandbox: 'just-bash',
        model,
        settings: {
          thinkingLevel: runtime.role.profile.harnessThinkingLevel ?? 'medium',
          permissionMode: runtime.role.profile.harnessPermissionMode ?? 'allow-edits'
        },
        instructions: SYSTEM_PROMPT,
        mcpServers: await buildPiMCPServers()
      },
      { OPENPENCIL_HARNESS_API_KEY: apiKey }
    )
    harnessTransportInstance = transport
    return transport as ChatTransport<UIMessage>
  }

  async function createTransport(store: EditorStore) {
    if (overrideTransport) return overrideTransport(store)

    await destroyAgentTransports()

    const runtime = await createAIModelRuntime('design')
    if (runtime?.kind !== 'direct') {
      throw new Error('The Design model is not configured for direct API access')
    }
    return createToolLoopTransport({
      store,
      providerID: runtime.role.connection.providerID,
      model: runtime.model,
      effectiveModelID: resolveLanguageModelID({
        providerID: runtime.role.connection.providerID,
        modelID: runtime.role.profile.modelID,
        customModelID: runtime.role.profile.customModelID
      }),
      maxOutputTokens: runtime.role.profile.maxOutputTokens,
      reasoningEffort: runtime.role.profile.reasoningEffort ?? ''
    })
  }

  async function ensureChat(): Promise<Chat<UIMessage> | null> {
    await credentialsReady
    if (!isConfigured.value) return null

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
      let transport: ChatTransport<UIMessage>
      if (isHarnessProvider.value) transport = await createActiveHarnessTransport()
      else transport = await createTransport(store)
      chat = new Chat<UIMessage>({
        transport,
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
    await destroyAgentTransports()
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

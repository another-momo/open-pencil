import { Chat } from '@ai-sdk/vue'
import { DirectChatTransport, stepCountIs, ToolLoopAgent } from 'ai'
import type { ChatTransport, LanguageModel, UIMessage } from 'ai'
import type { ComputedRef, Ref } from 'vue'

import { ACP_AGENTS } from '@open-pencil/core/constants'
import type { ACPAgentID, AIProviderID } from '@open-pencil/core/constants'

import { elideMediaToolResults } from '@/app/ai/chat/elision'
import {
  censusMediaToolResults,
  inlineMediaToolResultsAsUserMessages
} from '@/app/ai/chat/media-tool-results'
import { resolveLanguageModelID } from '@/app/ai/chat/model'
import { lookImagesKept } from '@/app/ai/chat/storage'
import type { ChatMode } from '@/app/ai/chat/storage'
import SYSTEM_PROMPT_MARKETING from '@/app/ai/chat/system-prompt-marketing.md?raw'
import SYSTEM_PROMPT from '@/app/ai/chat/system-prompt.md?raw'
import { bindMarketingLibrary, buildMarketingOverlay } from '@/app/ai/marketing/library'
import { createAIModelRuntime } from '@/app/ai/models'
import {
  MAX_AGENT_STEPS,
  createAITools,
  recordPrepareCallDebug,
  recordStepInlinedImages,
  recordStepUsage,
  resetRunSteps
} from '@/app/ai/tools'
import type { getActiveEditorStore } from '@/app/editor/active-store'

type EditorStore = ReturnType<typeof getActiveEditorStore>

type ChatSessionOptions = {
  isConfigured: ComputedRef<boolean>
  isACPProvider: ComputedRef<boolean>
  providerID: Ref<AIProviderID>
  credentialsReady: Promise<void>
  chatMode: Ref<ChatMode>
  getActiveEditorStore: () => EditorStore
}

type ToolLoopTransportOptions = {
  store: EditorStore
  providerID: AIProviderID
  model: LanguageModel
  effectiveModelID: string
  maxOutputTokens: number
  customAPIType: 'completions' | 'responses'
  chatMode: ChatMode
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

/**
 * Chat-completions providers cannot carry images in tool messages — their SDK
 * converts media tool-results with JSON.stringify, so the model never sees
 * the image (docs/plans/l2-visual-loop.md §3.1). Anthropic, OpenRouter,
 * Google, and the OpenAI Responses API handle media tool-results natively.
 */
function needsImageAsUserMessage(
  providerID: AIProviderID,
  customAPIType: 'completions' | 'responses'
): boolean {
  if (providerID === 'openai' || providerID === 'minimax' || providerID === 'deepseek') return true
  return providerID === 'openai-compatible' && customAPIType === 'completions'
}

export async function createACPTransport(providerID: AIProviderID) {
  const agentId = providerID.replace('acp:', '') as ACPAgentID
  const agentDef = ACP_AGENTS.find((a) => a.id === agentId)
  if (!agentDef) throw new Error(`Unknown ACP agent: ${agentId}`)

  const { ACPChatTransport } = await import('@/app/ai/acp/transport')
  const { homeDir } = await import('@tauri-apps/api/path')
  return new ACPChatTransport({ agentDef, cwd: await homeDir() })
}

export function createToolLoopTransport({
  store,
  providerID,
  model,
  effectiveModelID,
  maxOutputTokens,
  customAPIType,
  chatMode
}: ToolLoopTransportOptions) {
  const tools = createAITools(store, chatMode)
  const cacheProviderOptions = supportsAnthropicCaching(providerID, effectiveModelID)
    ? ANTHROPIC_CACHE_CONTROL
    : undefined

  const instructions = chatMode === 'marketing' ? SYSTEM_PROMPT_MARKETING : SYSTEM_PROMPT

  const agent = new ToolLoopAgent({
    model,
    instructions,
    tools,
    stopWhen: stepCountIs(MAX_AGENT_STEPS),
    maxOutputTokens,
    providerOptions: cacheProviderOptions,
    prepareCall: (options) => {
      resetRunSteps(store)
      // Marketing: bind the library session to this document and refresh the
      // system prompt library context (types list + active profile markdown) per
      // call — a profile switch via re-setup takes effect on the next turn
      // (docs/plans/l2-resource-library.md Q6).
      let instructions: string | undefined
      if (chatMode === 'marketing') {
        bindMarketingLibrary(store.graph)
        instructions = SYSTEM_PROMPT_MARKETING + buildMarketingOverlay(store)
      }
      const keep = Math.min(3, Math.max(1, Math.round(lookImagesKept.value) || 2))
      const rewrite = needsImageAsUserMessage(providerID, customAPIType)
      // DirectChatTransport passes the converted history as `prompt` (an array
      // of ModelMessages), not `messages` — handle both shapes.
      const source =
        options.messages ?? (Array.isArray(options.prompt) ? options.prompt : undefined)
      if (!source) {
        return {
          ...options,
          ...(instructions ? { instructions } : {}),
          maxOutputTokens,
          providerOptions: cacheProviderOptions
        }
      }
      recordPrepareCallDebug(
        {
          providerID,
          modelID: effectiveModelID,
          customAPIType,
          rewriteToUserMessage: rewrite,
          ...censusMediaToolResults(source),
          stepInlinedImages: 0,
          timestamp: Date.now()
        },
        store
      )
      // Elide first so only the K surviving images are rewritten below.
      let messages = elideMediaToolResults(source, keep)
      if (rewrite) {
        messages = inlineMediaToolResultsAsUserMessages(messages)
      }
      return {
        ...options,
        ...(instructions ? { instructions } : {}),
        ...(options.messages ? { messages } : { prompt: messages }),
        maxOutputTokens,
        providerOptions: cacheProviderOptions
      }
    },
    // Chat-completions providers also need intra-turn coverage: images created
    // by look DURING the 50-step loop don't exist at prepareCall time, so the
    // rewrite must run per step. Fresh images sit at the tail of the history,
    // so rewriting them does not disturb the cached prefix.
    prepareStep: ({ messages }) => {
      if (!needsImageAsUserMessage(providerID, customAPIType)) return {}
      const census = censusMediaToolResults(messages)
      if (census.mediaParts === 0) return {}
      recordStepInlinedImages(census.mediaParts, store)
      return { messages: inlineMediaToolResultsAsUserMessages(messages) }
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
  isACPProvider,
  providerID,
  credentialsReady,
  chatMode,
  getActiveEditorStore
}: ChatSessionOptions) {
  let transportDirty = false
  let currentChatStore: EditorStore | null = null
  let currentChatMessages = new WeakMap<EditorStore, UIMessage[]>()
  let chat: Chat<UIMessage> | null = null
  let acpTransportInstance: { destroy(): Promise<void> } | null = null
  let overrideTransport: (() => ChatTransport<UIMessage>) | null = null

  function markTransportDirty() {
    transportDirty = true
    currentChatStore = null
    currentChatMessages = new WeakMap()
  }

  async function createActiveACPTransport() {
    await acpTransportInstance?.destroy()
    const transport = await createACPTransport(providerID.value)
    acpTransportInstance = transport
    return transport as ChatTransport<UIMessage>
  }

  async function createTransport(store: EditorStore) {
    if (overrideTransport) return overrideTransport()

    void acpTransportInstance?.destroy()
    acpTransportInstance = null

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
      customAPIType: runtime.role.connection.customAPIType,
      chatMode: chatMode.value
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
      const messages = currentChatMessages.get(store)
      const transport: ChatTransport<UIMessage> = isACPProvider.value
        ? await createActiveACPTransport()
        : await createTransport(store)
      chat = new Chat<UIMessage>({ transport, messages })
      currentChatStore = store
      transportDirty = false
    }
    return chat
  }

  function resetChat() {
    if (currentChatStore) currentChatMessages.delete(currentChatStore)
    chat = null
    currentChatStore = null
    transportDirty = false
  }

  function setOverrideTransport(factory: (() => ChatTransport<UIMessage>) | null) {
    overrideTransport = factory
    markTransportDirty()
  }

  return { ensureChat, resetChat, markTransportDirty, setOverrideTransport }
}

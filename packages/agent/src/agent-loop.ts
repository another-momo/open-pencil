import { ToolLoopAgent, stepCountIs } from 'ai'
import type { LanguageModel, ModelMessage } from 'ai'

import type { AIProviderID } from '@open-pencil/core/constants'
import { CORE_TOOLS } from '@open-pencil/core/tools'

import type { FrontendBridge } from './bridge/ws-client.js'
import { bridgeToolsToAI } from './tools-bridge.js'
import { createLanguageModel, resolveLanguageModelID } from './model-resolver.js'
import { consumeCredential } from './credentials.js'
import { SYSTEM_PROMPT, SYSTEM_PROMPT_MARKETING_FULL, buildMarketingOverlay } from './prompts/index.js'
import type { LibrarySnapshot } from './prompts/index.js'
import { elideMediaToolResults } from './elision.js'
import { inlineMediaToolResultsAsUserMessages } from './media-rewriter.js'
import {
  ANTHROPIC_CACHE_CONTROL,
  needsImageAsUserMessage,
  supportsAnthropicCaching
} from './provider-helpers.js'

export const MAX_AGENT_STEPS = 50

const MARKETING_ONLY_TOOLS = new Set([
  'look',
  'setup_material_type',
  'validate',
  'read_brief',
  'create_brief'
])

export type ChatMode = 'ui' | 'marketing'

export type AgentRunOptions = {
  connectionId: string
  providerID: AIProviderID
  modelID: string
  customModelID: string
  customBaseURL: string
  customAPIType: 'completions' | 'responses'
  maxOutputTokens: number
  chatMode: ChatMode
  librarySnapshot: LibrarySnapshot
  lookImagesKept: number
  bridge: FrontendBridge
}

/**
 * Construct a `ToolLoopAgent` ready to be invoked via `streamText`. Mirrors
 * `src/app/ai/chat/transports.ts#createToolLoopTransport` with two key
 * adaptations:
 *   1. `execute` for every tool is a reverse-RPC dispatch through the
 *      frontend automation bridge (see `tools-bridge.ts`).
 *   2. The marketing library overlay is built from a serialized snapshot
 *      the frontend ships in the `x-op-library-snapshot` header — the
 *      agent backend never touches the editor's SceneGraph.
 */
export function createAgent(options: AgentRunOptions): ToolLoopAgent {
  const apiKey = consumeCredential(options.connectionId)
  if (!apiKey) {
    throw new Error('API key not available — POST /v1/auth first')
  }

  const model: LanguageModel = createLanguageModel({
    providerID: options.providerID,
    apiKey,
    modelID: options.modelID,
    customModelID: options.customModelID,
    customBaseURL: options.customBaseURL,
    customAPIType: options.customAPIType
  })

  const effectiveModelID = resolveLanguageModelID({
    providerID: options.providerID,
    modelID: options.modelID,
    customModelID: options.customModelID
  })

  const toolsList =
    options.chatMode === 'marketing'
      ? CORE_TOOLS
      : CORE_TOOLS.filter((def) => !MARKETING_ONLY_TOOLS.has(def.name))

  const tools = bridgeToolsToAI(toolsList, options.bridge)

  const cacheProviderOptions = supportsAnthropicCaching(options.providerID, effectiveModelID)
    ? ANTHROPIC_CACHE_CONTROL
    : undefined

  const baseInstructions =
    options.chatMode === 'marketing' ? SYSTEM_PROMPT_MARKETING_FULL : SYSTEM_PROMPT

  return new ToolLoopAgent({
    model,
    instructions: baseInstructions,
    tools,
    stopWhen: stepCountIs(MAX_AGENT_STEPS),
    maxOutputTokens: options.maxOutputTokens,
    providerOptions: cacheProviderOptions,
    prepareCall: (callOptions) => {
      let instructions = baseInstructions
      if (options.chatMode === 'marketing') {
        instructions = baseInstructions + buildMarketingOverlay(options.librarySnapshot)
      }

      const keep = Math.min(
        3,
        Math.max(1, Math.round(options.lookImagesKept) || 2)
      )
      const rewrite = needsImageAsUserMessage(options.providerID, options.customAPIType)

      const source =
        callOptions.messages ?? (Array.isArray(callOptions.prompt) ? callOptions.prompt : undefined)

      if (!source) {
        return {
          ...callOptions,
          ...(instructions ? { instructions } : {}),
          maxOutputTokens: options.maxOutputTokens,
          providerOptions: cacheProviderOptions
        }
      }

      // Elide first so only the K surviving images are rewritten below.
      let messages: ModelMessage[] = elideMediaToolResults(source, keep)
      if (rewrite) {
        messages = inlineMediaToolResultsAsUserMessages(messages)
      }

      return {
        ...callOptions,
        ...(instructions ? { instructions } : {}),
        ...(callOptions.messages ? { messages } : { prompt: messages }),
        maxOutputTokens: options.maxOutputTokens,
        providerOptions: cacheProviderOptions
      }
    },
    prepareStep: ({ messages }) => {
      if (!needsImageAsUserMessage(options.providerID, options.customAPIType)) return {}
      return { messages: inlineMediaToolResultsAsUserMessages(messages) }
    },
    onStepFinish: ({ usage }) => {
      // P0: stream-time usage is exposed via the UI message stream's
      // onStepFinish / onFinish hooks at the route layer. The agent
      // backend intentionally doesn't track usage state itself — the
      // frontend debug panel is the canonical reader.
      void usage
    }
  })
}
import type { AIProviderID } from '@open-pencil/core/constants'

/**
 * Chat-completions providers cannot carry images in tool messages — their SDK
 * converts media tool-results with JSON.stringify, so the model never sees the
 * image (packages/docs/programmable/byok-provider-compatibility.md §3.1).
 * Anthropic, OpenRouter, Google, and the OpenAI Responses API handle media
 * tool-results natively.
 *
 * Mirror of src/app/ai/chat/transports.ts:77-89.
 */
export function needsImageAsUserMessage(
  providerID: AIProviderID,
  customAPIType: 'completions' | 'responses'
): boolean {
  if (
    providerID === 'openai' ||
    providerID === 'minimax' ||
    providerID === 'minimax-cn' ||
    providerID === 'deepseek'
  )
    return true
  return providerID === 'openai-compatible' && customAPIType === 'completions'
}

/**
 * Mirror of src/app/ai/chat/transports.ts:63-69.
 */
export function supportsAnthropicCaching(providerID: AIProviderID, modelID: string): boolean {
  return (
    providerID === 'anthropic' ||
    providerID === 'anthropic-compatible' ||
    (providerID === 'openrouter' && modelID.startsWith('anthropic/'))
  )
}

export const ANTHROPIC_CACHE_CONTROL = {
  anthropic: { cacheControl: { type: 'ephemeral' } }
} as const
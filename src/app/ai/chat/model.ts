import type { LanguageModel } from 'ai'

import type { AIProviderID } from '@open-pencil/core/constants'

import { modelProviderAdapter } from '@/app/ai/providers/registry'
import type { ModelConfig } from '@/app/ai/providers/types'
import { isTauri } from '@/app/tauri/env'
import { tauriFetch } from '@/app/tauri/http'

export type { ModelConfig } from '@/app/ai/providers/types'

export function resolveLanguageModelID(
  config: Pick<ModelConfig, 'providerID' | 'modelID' | 'customModelID'>
): string {
  if (
    config.providerID === 'openrouter' ||
    config.providerID === 'openai-compatible' ||
    config.providerID === 'anthropic-compatible'
  ) {
    return config.customModelID.trim() || config.modelID
  }
  return config.modelID
}

/**
 * The base URL a provider effectively talks to, when knowable — used by the
 * vision settings "copy from main" buttons. Undefined for providers whose
 * endpoint is the vendor default (openai/anthropic/google/deepseek/openrouter)
 * since copying those is meaningless for a custom vision endpoint.
 */
export function resolveProviderBaseURL(
  providerID: AIProviderID,
  customBaseURL: string
): string | undefined {
  switch (providerID) {
    case 'openai-compatible':
    case 'anthropic-compatible':
      return customBaseURL.trim() || undefined
    case 'minimax':
      return 'https://api.minimax.io/v1'
    case 'minimax-cn':
      return 'https://api.minimaxi.com/v1'
    case 'zai':
      return 'https://api.z.ai/api/anthropic'
    case 'zai-cn':
      return 'https://open.bigmodel.cn/api/anthropic'
    default:
      return undefined
  }
}

/** Which request format a provider speaks — for aligning the vision provider type. */
export function resolveProviderAPIFormat(
  providerID: AIProviderID
): 'openai-compatible' | 'anthropic-compatible' | undefined {
  switch (providerID) {
    case 'openai':
    case 'minimax':
    case 'minimax-cn':
    case 'deepseek':
    case 'openai-compatible':
      return 'openai-compatible'
    case 'anthropic':
    case 'anthropic-compatible':
    case 'zai':
    case 'zai-cn':
      return 'anthropic-compatible'
    default:
      return undefined
  }
}

function desktopFetch(): typeof fetch | undefined {
  return isTauri() ? tauriFetch : undefined
}

export function createLanguageModel(config: ModelConfig): LanguageModel {
  return modelProviderAdapter(config.providerID).create(config, { fetch: desktopFetch() })
}

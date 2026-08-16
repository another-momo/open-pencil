import type { LanguageModel } from 'ai'

import type { AIProviderID } from '@open-pencil/core/constants'

import { modelProviderAdapter } from './providers/registry.js'
import type { ModelConfig } from './providers/types.js'

export type { ModelConfig } from './providers/types.js'

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

export function createLanguageModel(config: ModelConfig): LanguageModel {
  // The agent backend runs in Node — no desktop/tauir fetch override needed.
  return modelProviderAdapter(config.providerID).create(config, { fetch: globalThis.fetch })
}
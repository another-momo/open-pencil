import { createAnthropic } from '@ai-sdk/anthropic'
import { createOpenAI } from '@ai-sdk/openai'

import type { ModelConfig, ModelProviderAdapter } from './types.js'

// IMPORTANT (fork note):
// In the original frontend (`src/app/ai/providers/compatible.ts`) the Anthropic
// adapter injects `anthropic-dangerous-direct-browser-access: true` when
// running in the browser. The agent backend is a Node process that talks to
// providers directly, so CORS never applies and the dangerous-access header is
// not needed — we deliberately omit it here.

export type CompatibleEndpoint = string | ((config: ModelConfig) => string)

type OpenAICompatibleOptions = {
  baseURL?: CompatibleEndpoint
  mode?: 'default' | 'chat' | 'configurable'
}

type AnthropicCompatibleOptions = {
  baseURL?: CompatibleEndpoint
}

function resolveEndpoint(endpoint: CompatibleEndpoint | undefined, config: ModelConfig) {
  return typeof endpoint === 'function' ? endpoint(config) : endpoint
}

export function createOpenAICompatibleAdapter(
  options: OpenAICompatibleOptions = {}
): ModelProviderAdapter {
  return {
    create(config, runtime) {
      const provider = createOpenAI({
        apiKey: config.apiKey,
        baseURL: resolveEndpoint(options.baseURL, config),
        fetch: runtime.fetch
      })
      const modelID = config.customModelID.trim() || config.modelID
      if (options.mode === 'chat') return provider.chat(modelID)
      if (options.mode === 'configurable') {
        return config.customAPIType === 'responses'
          ? provider.responses(modelID)
          : provider.chat(modelID)
      }
      return provider(modelID)
    }
  }
}

export function createAnthropicCompatibleAdapter(
  options: AnthropicCompatibleOptions = {}
): ModelProviderAdapter {
  return {
    create(config, runtime) {
      const provider = createAnthropic({
        apiKey: config.apiKey,
        baseURL: resolveEndpoint(options.baseURL, config),
        fetch: runtime.fetch
      })
      return provider(config.customModelID.trim() || config.modelID)
    }
  }
}
/**
 * Channel B: independent vision-model configuration and analysis
 * (docs/plans/l2-visual-loop.md §3).
 *
 * Explicitly selected by the user (no capability probing, no auto-fallback).
 * When mode is B, `look` sends the exported image to an OpenAI-compatible
 * vision endpoint and returns the text analysis to the main model — no
 * base64 ever enters the main conversation context.
 */

import { FetchError, ofetch } from 'ofetch'

export type VisionMode = 'A' | 'B'
export type VisionProvider = 'openai-compatible' | 'anthropic-compatible'

let visionMode: VisionMode = 'A'
let visionProvider: VisionProvider = 'openai-compatible'
let visionKey: string | null = null
let visionBaseURL = ''
let visionModel = ''

export function setVisionMode(mode: VisionMode): void {
  visionMode = mode
}

export function getVisionMode(): VisionMode {
  return visionMode
}

export function setVisionProvider(provider: VisionProvider): void {
  visionProvider = provider
}

/** Independent from the chat LLM credentials — empty means channel B is off. */
export function setVisionCredentials(key: string | null, baseURL?: string, model?: string): void {
  visionKey = key
  if (baseURL !== undefined) visionBaseURL = baseURL.replace(/\/$/, '')
  if (model !== undefined) visionModel = model
}

export function isVisionChannelBReady(): boolean {
  return visionMode === 'B' && !!visionKey && !!visionBaseURL && !!visionModel
}

export type VisionAnalyzer = (input: {
  base64: string
  mimeType: string
  prompt: string
}) => Promise<string>

interface ChatCompletionResponse {
  choices?: Array<{ message?: { content?: string } }>
}

interface AnthropicMessagesResponse {
  content?: Array<{ type: string; text?: string }>
}

function visionErrorDetail(error: unknown): string | undefined {
  if (!(error instanceof FetchError)) return undefined
  const data = error.data as { error?: { message?: string } | string; message?: string } | undefined
  if (typeof data?.error === 'string') return data.error
  return data?.error?.message ?? data?.message ?? error.message
}

async function requestVisionAnalysis(
  path: string,
  headers: Record<string, string>,
  body: Record<string, unknown>,
  extractText: (data: unknown) => string | undefined
): Promise<string> {
  try {
    const response: unknown = await ofetch(`${visionBaseURL}${path}`, {
      method: 'POST',
      headers,
      body,
      timeout: 60_000
    })
    const text = extractText(response)
    if (typeof text !== 'string' || !text.trim()) {
      throw new Error('Vision model returned an empty analysis')
    }
    return text.trim()
  } catch (error) {
    const detail = visionErrorDetail(error)
    if (detail !== undefined) {
      const status = (error as FetchError).statusCode
      throw new Error(`Vision API error (${status}): ${detail}`)
    }
    throw error
  }
}

function analyzeViaOpenAICompatible(input: {
  base64: string
  mimeType: string
  prompt: string
}): Promise<string> {
  return requestVisionAnalysis(
    '/chat/completions',
    { Authorization: `Bearer ${visionKey}` },
    {
      model: visionModel,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: { url: `data:${input.mimeType};base64,${input.base64}` }
            },
            { type: 'text', text: input.prompt }
          ]
        }
      ],
      max_tokens: 2048
    },
    (data) => (data as ChatCompletionResponse).choices?.[0]?.message?.content
  )
}

function analyzeViaAnthropicCompatible(input: {
  base64: string
  mimeType: string
  prompt: string
}): Promise<string> {
  return requestVisionAnalysis(
    '/messages',
    { 'x-api-key': visionKey ?? '', 'anthropic-version': '2023-06-01' },
    {
      model: visionModel,
      max_tokens: 2048,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: input.mimeType, data: input.base64 }
            },
            { type: 'text', text: input.prompt }
          ]
        }
      ]
    },
    (data) =>
      (data as AnthropicMessagesResponse).content?.find((block) => block.type === 'text')?.text
  )
}

let analyzer: VisionAnalyzer = (input) =>
  visionProvider === 'anthropic-compatible'
    ? analyzeViaAnthropicCompatible(input)
    : analyzeViaOpenAICompatible(input)

/** Test hook — replace the analyzer with a stub; pass null to restore the real one. */
export function setVisionAnalyzer(custom: VisionAnalyzer | null): void {
  analyzer =
    custom ??
    ((input) =>
      visionProvider === 'anthropic-compatible'
        ? analyzeViaAnthropicCompatible(input)
        : analyzeViaOpenAICompatible(input))
}

export function analyzeImageWithVisionModel(input: {
  base64: string
  mimeType: string
  prompt: string
}): Promise<string> {
  if (!input.base64) {
    throw new Error('Vision analysis requires a non-empty base64 image')
  }
  if (!input.mimeType.startsWith('image/')) {
    throw new Error(`Invalid mime type for vision analysis: ${input.mimeType}`)
  }
  return analyzer(input)
}

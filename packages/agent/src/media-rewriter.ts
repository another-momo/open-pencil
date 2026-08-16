import type { ModelMessage, ToolResultPart } from 'ai'

import { MEDIA_OUTPUT_TOOLS } from './elision.js'
import type { ContentOutput, ToolResultLikePart } from './elision.js'

type ToolResultOutput = ToolResultPart['output']

/**
 * Mirror of `src/app/ai/chat/media-tool-results.ts`. Pure function.
 *
 * For chat-completions providers that JSON.stringify content outputs (which
 * collapses images into base64 text the model never sees), this rewrites each
 * surviving media tool-result into a text-only tool message and appends a
 * follow-up user message carrying the image part. Run AFTER elision.
 */

interface MediaItem {
  type: string
  mediaType?: string
  data?: unknown
  text?: unknown
}

function isContentOutput(output: unknown): output is { type: string; value: MediaItem[] } {
  return (
    !!output &&
    typeof output === 'object' &&
    (output as ContentOutput).type === 'content' &&
    Array.isArray((output as ContentOutput).value)
  )
}

function isMediaItem(item: MediaItem): item is { type: string; mediaType: string; data: string } {
  return (
    item.type === 'media' && typeof item.mediaType === 'string' && typeof item.data === 'string'
  )
}

export interface MediaToolResultCensus {
  contentOutputs: number
  degradedOutputs: number
  mediaParts: number
}

export function censusMediaToolResults(messages: ModelMessage[]): MediaToolResultCensus {
  const census: MediaToolResultCensus = { contentOutputs: 0, degradedOutputs: 0, mediaParts: 0 }
  for (const message of messages) {
    if (message.role !== 'tool' || !Array.isArray(message.content)) continue
    for (const part of message.content) {
      const candidate = part as ToolResultLikePart
      if (candidate.type !== 'tool-result') continue
      if (!MEDIA_OUTPUT_TOOLS.has(candidate.toolName ?? '')) continue
      if (!isContentOutput(candidate.output)) {
        census.degradedOutputs++
        continue
      }
      census.contentOutputs++
      census.mediaParts += candidate.output.value.filter(isMediaItem).length
    }
  }
  return census
}

interface InlinedImage {
  toolName: string
  mediaType: string
  data: string
}

function extractMediaOutput(
  candidate: ToolResultLikePart & { output: { type: string; value: MediaItem[] } },
  images: InlinedImage[]
): ToolResultOutput | null {
  const mediaItems = candidate.output.value.filter(isMediaItem)
  if (mediaItems.length === 0) return null

  for (const item of mediaItems) {
    images.push({
      toolName: candidate.toolName ?? 'look',
      mediaType: item.mediaType,
      data: item.data
    })
  }
  const textOnly = candidate.output.value.filter((item) => !isMediaItem(item))
  if (textOnly.length === 0) {
    return { type: 'text', value: '[image inlined as a user message]' }
  }
  const first = textOnly[0]
  if (textOnly.length === 1 && first.type === 'text' && typeof first.text === 'string') {
    return { type: 'text', value: first.text }
  }
  return { ...candidate.output, value: textOnly } as ToolResultOutput
}

export function inlineMediaToolResultsAsUserMessages(messages: ModelMessage[]): ModelMessage[] {
  const result: ModelMessage[] = []
  let anyTouched = false

  for (const message of messages) {
    if (message.role !== 'tool' || !Array.isArray(message.content)) {
      result.push(message)
      continue
    }

    const images: InlinedImage[] = []
    let content: typeof message.content | null = null
    let contentTouched = false

    for (const part of message.content) {
      const candidate = part as ToolResultLikePart
      if (candidate.type !== 'tool-result') {
        if (content) content.push(part)
        continue
      }
      if (!MEDIA_OUTPUT_TOOLS.has(candidate.toolName ?? '')) {
        if (content) content.push(part)
        continue
      }
      if (!isContentOutput(candidate.output)) {
        if (content) content.push(part)
        continue
      }

      const output = extractMediaOutput({ ...candidate, output: candidate.output }, images)
      if (!output) {
        if (content) content.push(part)
        continue
      }

      if (!content) {
        content = message.content.slice(0, message.content.indexOf(part))
      }
      content.push({ ...part, output } as (typeof content)[number])
      contentTouched = true
    }

    if (contentTouched) {
      anyTouched = true
      result.push({ ...message, content } as ModelMessage)
    } else {
      result.push(message)
    }

    if (images.length > 0) {
      result.push({
        role: 'user',
        content: images.flatMap((image) => [
          { type: 'image', image: image.data, mediaType: image.mediaType },
          { type: 'text', text: `[image returned by ${image.toolName}]` }
        ])
      } as ModelMessage)
    }
  }

  return anyTouched ? result : messages
}
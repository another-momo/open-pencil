import type { ModelMessage, ToolResultPart } from 'ai'

import { MEDIA_OUTPUT_TOOLS } from '@/app/ai/chat/elision'

type ToolResultOutput = ToolResultPart['output']

/**
 * Media delivery for chat-completions providers (docs/plans/l2-visual-loop.md §3.1).
 *
 * OpenAI-style chat completions cannot carry images inside tool messages —
 * @ai-sdk/openai and @ai-sdk/deepseek convert a media tool-result with
 * `JSON.stringify(output.value)`, so the model receives base64 as plain text
 * and never sees the image. These APIs only accept images in user messages
 * (as base64 data URLs).
 *
 * This transform rewrites each surviving media tool-result into a text-only
 * tool message (the note stays, preserving the tool_call/tool_result pairing)
 * plus a user message carrying the image part, inserted right after it.
 *
 * Run AFTER elision so only the K surviving images are rewritten. Pure
 * function: never mutates the input, and a second pass is a no-op (the media
 * items are gone from the tool results).
 */

interface MediaItem {
  type: string
  mediaType?: string
  data?: unknown
  text?: unknown
}

interface ContentOutputLike {
  type: string
  value?: unknown
}

interface ToolResultPartLike {
  type: string
  toolName?: string
  output?: unknown
}

function isContentOutput(output: unknown): output is { type: string; value: MediaItem[] } {
  return (
    !!output &&
    typeof output === 'object' &&
    (output as ContentOutputLike).type === 'content' &&
    Array.isArray((output as ContentOutputLike).value)
  )
}

function isMediaItem(item: MediaItem): item is { type: string; mediaType: string; data: string } {
  return (
    item.type === 'media' && typeof item.mediaType === 'string' && typeof item.data === 'string'
  )
}

export interface MediaToolResultCensus {
  /** tool-results from media tools with a content-type output (media deliverable) */
  contentOutputs: number
  /** tool-results from media tools with a non-content output (image degraded to JSON/text) */
  degradedOutputs: number
  /** media items inside content-type outputs */
  mediaParts: number
}

export function censusMediaToolResults(messages: ModelMessage[]): MediaToolResultCensus {
  const census: MediaToolResultCensus = { contentOutputs: 0, degradedOutputs: 0, mediaParts: 0 }
  for (const message of messages) {
    if (message.role !== 'tool' || !Array.isArray(message.content)) continue
    for (const part of message.content) {
      const candidate = part as ToolResultPartLike
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

export function inlineMediaToolResultsAsUserMessages(messages: ModelMessage[]): ModelMessage[] {
  const result: ModelMessage[] = []
  let anyTouched = false

  for (const message of messages) {
    if (message.role !== 'tool' || !Array.isArray(message.content)) {
      result.push(message)
      continue
    }

    const images: Array<{ toolName: string; mediaType: string; data: string }> = []
    let content: typeof message.content | null = null
    let contentTouched = false

    for (const part of message.content) {
      const candidate = part as ToolResultPartLike
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
      const mediaItems = candidate.output.value.filter(isMediaItem)
      if (mediaItems.length === 0) {
        if (content) content.push(part)
        continue
      }

      for (const item of mediaItems) {
        images.push({
          toolName: candidate.toolName ?? 'look',
          mediaType: item.mediaType,
          data: item.data
        })
      }
      const textOnly = candidate.output.value.filter((item) => !isMediaItem(item))
      // Collapse to a plain text output when no media remains — chat-completions
      // providers JSON.stringify content outputs, which would wrap the note in
      // a '[{"type":"text",...}]' envelope the model has to read through.
      const singleText =
        textOnly.length === 1 && textOnly[0].type === 'text' && typeof textOnly[0].text === 'string'
          ? textOnly[0].text
          : undefined
      const output: ToolResultOutput =
        textOnly.length === 0
          ? { type: 'text', value: '[image inlined as a user message]' }
          : singleText !== undefined
            ? { type: 'text', value: singleText }
            : ({ ...candidate.output, value: textOnly } as ToolResultOutput)

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

import type { ModelMessage } from 'ai'

import { MEDIA_OUTPUT_TOOLS } from '@open-pencil/core/tools'

/**
 * Mirror of `src/app/ai/chat/elision.ts`. Pure function.
 *
 * Request-level media elision — keep only the newest `keep` media parts and
 * replace the older ones with a text placeholder so chat history doesn't
 * accumulate base64 screenshots.
 */

export { MEDIA_OUTPUT_TOOLS }

const ELIDED_PLACEHOLDER =
  '[image omitted from history to save context — the note above still describes it; call the tool again if you need to see it]'

interface MediaLikePart {
  type: string
}

export interface ContentOutput {
  type: string
  value?: unknown
}

export interface ToolResultLikePart {
  type: string
  toolName?: string
  output?: unknown
}

function isMediaPart(item: unknown): item is MediaLikePart {
  return !!item && typeof item === 'object' && (item as MediaLikePart).type === 'media'
}

function isContentOutput(output: unknown): output is ContentOutput & { value: unknown[] } {
  return (
    !!output &&
    typeof output === 'object' &&
    (output as ContentOutput).type === 'content' &&
    Array.isArray((output as ContentOutput).value)
  )
}

export function elideMediaToolResults(messages: ModelMessage[], keep: number): ModelMessage[] {
  const positions: Array<readonly [number, number, number]> = []
  messages.forEach((message, messageIndex) => {
    if (message.role !== 'tool' || !Array.isArray(message.content)) return
    message.content.forEach((part, partIndex) => {
      const candidate = part as ToolResultLikePart
      if (candidate.type !== 'tool-result') return
      if (!MEDIA_OUTPUT_TOOLS.has(candidate.toolName ?? '')) return
      if (!isContentOutput(candidate.output)) return
      candidate.output.value.forEach((item, valueIndex) => {
        if (isMediaPart(item)) positions.push([messageIndex, partIndex, valueIndex] as const)
      })
    })
  })

  const elideCount = positions.length - Math.max(0, keep)
  if (elideCount <= 0) return messages

  const toElide = new Set(positions.slice(0, elideCount).map(([m, p, v]) => `${m}:${p}:${v}`))

  return messages.map((message, messageIndex) => {
    if (message.role !== 'tool' || !Array.isArray(message.content)) return message
    const content = message.content.map((part, partIndex) => {
      const candidate = part as ToolResultLikePart
      if (candidate.type !== 'tool-result' || !isContentOutput(candidate.output)) return part
      const output = candidate.output
      const value = output.value.map((item, valueIndex) => {
        if (!toElide.has(`${messageIndex}:${partIndex}:${valueIndex}`)) return item
        return { type: 'text', text: ELIDED_PLACEHOLDER }
      })
      if (value === output.value) return part
      return { ...part, output: { ...output, value } }
    })
    if (content === message.content) return message
    return { ...message, content } as ModelMessage
  })
}
import type { ModelMessage } from 'ai'

/**
 * Request-level media elision (docs/plans/l2-context-engineering.md §方案 1).
 *
 * Media tool results (`look`, `export_image`) carry full base64 screenshots
 * that accumulate in the chat history. Before each LLM call we keep only the
 * newest `keep` media parts and replace the older ones with a text
 * placeholder — note text and other parts are preserved.
 *
 * Pure function: never mutates the input messages, and the transform is
 * idempotent (already-elided messages contain no media parts).
 */

const MEDIA_OUTPUT_TOOLS = new Set(['export_image', 'look'])

const ELIDED_PLACEHOLDER =
  '[image omitted from history to save context — the note above still describes it; call the tool again if you need to see it]'

interface MediaLikePart {
  type: string
}

interface ContentOutput {
  type: string
  value?: unknown
}

interface ToolResultLikePart {
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
    let touched = false
    const content = message.content.map((part, partIndex) => {
      const candidate = part as ToolResultLikePart
      if (candidate.type !== 'tool-result' || !isContentOutput(candidate.output)) return part
      const output = candidate.output
      let outputTouched = false
      const value = output.value.map((item, valueIndex) => {
        if (!toElide.has(`${messageIndex}:${partIndex}:${valueIndex}`)) return item
        outputTouched = true
        return { type: 'text', text: ELIDED_PLACEHOLDER }
      })
      if (!outputTouched) return part
      touched = true
      return { ...part, output: { ...output, value } }
    })
    return touched ? ({ ...message, content } as ModelMessage) : message
  })
}

import { describe, expect, test } from 'bun:test'

import type { ModelMessage } from 'ai'

import { elideMediaToolResults } from '@/app/ai/chat/elision'
import { inlineMediaToolResultsAsUserMessages } from '@/app/ai/chat/media-tool-results'

function mediaToolMessage(toolName: string, note: string, base64: string): ModelMessage {
  return {
    role: 'tool',
    content: [
      {
        type: 'tool-result',
        toolCallId: `call-${base64}`,
        toolName,
        output: {
          type: 'content',
          value: [
            { type: 'text', text: note },
            { type: 'media', mediaType: 'image/jpeg', data: base64 }
          ]
        }
      }
    ]
  } as ModelMessage
}

function jsonToolMessage(toolName: string): ModelMessage {
  return {
    role: 'tool',
    content: [
      {
        type: 'tool-result',
        toolCallId: `call-${toolName}`,
        toolName,
        output: { type: 'json', value: { ok: true } }
      }
    ]
  } as ModelMessage
}

function textMessage(role: 'user' | 'assistant', text: string): ModelMessage {
  return { role, content: text } as ModelMessage
}

describe('inlineMediaToolResultsAsUserMessages', () => {
  test('rewrites a media tool-result into a text-only tool message plus a user image message', () => {
    const result = inlineMediaToolResultsAsUserMessages([
      mediaToolMessage('look', 'note-1', 'IMG1')
    ])

    expect(result).toHaveLength(2)

    const toolMessage = result[0]
    expect(toolMessage.role).toBe('tool')
    const toolPart = (toolMessage.content as Array<{ output: unknown }>)[0]
    expect(toolPart.output).toEqual({ type: 'text', value: 'note-1' })

    const userMessage = result[1]
    expect(userMessage.role).toBe('user')
    expect(userMessage.content).toEqual([
      { type: 'image', image: 'IMG1', mediaType: 'image/jpeg' },
      { type: 'text', text: '[image returned by look]' }
    ])
  })

  test('non-media tools and json outputs are untouched', () => {
    const messages = [textMessage('user', 'hi'), jsonToolMessage('describe')]
    expect(inlineMediaToolResultsAsUserMessages(messages)).toBe(messages)
  })

  test('degraded json output from a media tool is left alone', () => {
    const messages = [jsonToolMessage('look')]
    expect(inlineMediaToolResultsAsUserMessages(messages)).toBe(messages)
  })

  test('each image gets its user message right after its tool message', () => {
    const result = inlineMediaToolResultsAsUserMessages([
      mediaToolMessage('look', 'note-1', 'IMG1'),
      textMessage('assistant', 'working'),
      mediaToolMessage('export_image', 'note-2', 'IMG2')
    ])

    expect(result.map((m) => m.role)).toEqual(['tool', 'user', 'assistant', 'tool', 'user'])
    const secondUser = result[4]
    expect((secondUser.content as Array<{ image?: string }>)[0].image).toBe('IMG2')
  })

  test('idempotent and does not mutate the input', () => {
    const messages = [mediaToolMessage('look', 'note-1', 'IMG1')]
    const snapshot = structuredClone(messages)

    const once = inlineMediaToolResultsAsUserMessages(messages)
    expect(messages).toEqual(snapshot)

    const twice = inlineMediaToolResultsAsUserMessages(once)
    expect(twice).toEqual(once)
  })

  test('pipeline order: elide first, then rewrite only the surviving K images', () => {
    const messages = [
      mediaToolMessage('look', 'note-1', 'IMG1'),
      mediaToolMessage('look', 'note-2', 'IMG2'),
      mediaToolMessage('look', 'note-3', 'IMG3')
    ]

    const elided = elideMediaToolResults(messages, 2)
    const rewritten = inlineMediaToolResultsAsUserMessages(elided)

    expect(JSON.stringify(rewritten)).not.toContain('"image":"IMG1"')
    expect(JSON.stringify(rewritten)).toContain('"image":"IMG2"')
    expect(JSON.stringify(rewritten)).toContain('"image":"IMG3"')

    // The elided placeholder stays as text inside the first tool message.
    const firstTool = rewritten[0]
    const firstPart = (
      firstTool.content as Array<{ output: { value: Array<{ type: string; text?: string }> } }>
    )[0]
    expect(firstPart.output.value.every((item) => item.type === 'text')).toBe(true)
    expect(firstPart.output.value[1].text).toContain('omitted from history')

    // Two surviving images → two user messages.
    expect(rewritten.filter((m) => m.role === 'user')).toHaveLength(2)
  })
})

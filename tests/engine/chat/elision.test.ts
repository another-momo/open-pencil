import { describe, expect, test } from 'bun:test'

import type { ModelMessage } from 'ai'

import { elideMediaToolResults } from '@/app/ai/chat/elision'

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

type ContentValue = Array<{ type: string; text?: string; data?: string }>

function mediaValueOf(message: ModelMessage): ContentValue {
  const content = message.content as Array<{ output: { value: ContentValue } }>
  return content[0].output.value
}

describe('elideMediaToolResults', () => {
  test('no images → messages unchanged', () => {
    const messages = [textMessage('user', 'hi'), jsonToolMessage('describe')]
    expect(elideMediaToolResults(messages, 2)).toBe(messages)
  })

  test('one image → kept as-is', () => {
    const messages = [mediaToolMessage('look', 'note-a', 'AAA')]
    const result = elideMediaToolResults(messages, 2)
    expect(result).toBe(messages)
  })

  test('five images → only the newest two kept, older replaced with placeholder', () => {
    const messages = [
      mediaToolMessage('look', 'note-1', 'IMG1'),
      mediaToolMessage('look', 'note-2', 'IMG2'),
      mediaToolMessage('look', 'note-3', 'IMG3'),
      mediaToolMessage('look', 'note-4', 'IMG4'),
      mediaToolMessage('look', 'note-5', 'IMG5')
    ]
    const result = elideMediaToolResults(messages, 2)

    expect(mediaValueOf(result[0])[1].type).toBe('text')
    expect(mediaValueOf(result[2])[1].type).toBe('text')
    expect(mediaValueOf(result[3])[1]).toEqual({
      type: 'media',
      mediaType: 'image/jpeg',
      data: 'IMG4'
    })
    expect(mediaValueOf(result[4])[1]).toEqual({
      type: 'media',
      mediaType: 'image/jpeg',
      data: 'IMG5'
    })
  })

  test('keeps the newest K across interleaved turns and tool kinds', () => {
    const messages = [
      mediaToolMessage('look', 'note-1', 'IMG1'),
      textMessage('assistant', 'working'),
      mediaToolMessage('export_image', 'note-2', 'IMG2'),
      textMessage('user', 'next'),
      mediaToolMessage('look', 'note-3', 'IMG3')
    ]
    const result = elideMediaToolResults(messages, 2)

    expect(mediaValueOf(result[0])[1].type).toBe('text')
    expect(mediaValueOf(result[2])[1]).toEqual({
      type: 'media',
      mediaType: 'image/jpeg',
      data: 'IMG2'
    })
    expect(mediaValueOf(result[4])[1]).toEqual({
      type: 'media',
      mediaType: 'image/jpeg',
      data: 'IMG3'
    })
  })

  test('placeholder preserves the note text and explains the mechanism', () => {
    const messages = [
      mediaToolMessage('look', 'Visual inspection of "Banner"', 'IMG1'),
      mediaToolMessage('look', 'note-2', 'IMG2'),
      mediaToolMessage('look', 'note-3', 'IMG3')
    ]
    const result = elideMediaToolResults(messages, 2)
    const value = mediaValueOf(result[0])

    expect(value[0]).toEqual({ type: 'text', text: 'Visual inspection of "Banner"' })
    expect(value[1].type).toBe('text')
    expect(value[1].text).toContain('omitted from history')
    expect(value[1].text).toContain('call the tool again')
  })

  test('export_image results are elided too', () => {
    const messages = [
      mediaToolMessage('export_image', 'note-1', 'IMG1'),
      mediaToolMessage('export_image', 'note-2', 'IMG2'),
      mediaToolMessage('export_image', 'note-3', 'IMG3')
    ]
    const result = elideMediaToolResults(messages, 2)
    expect(mediaValueOf(result[0])[1].type).toBe('text')
    expect(mediaValueOf(result[1])[1].type).toBe('media')
  })

  test('idempotent and does not mutate the input', () => {
    const messages = [
      mediaToolMessage('look', 'note-1', 'IMG1'),
      mediaToolMessage('look', 'note-2', 'IMG2'),
      mediaToolMessage('look', 'note-3', 'IMG3')
    ]
    const snapshot = structuredClone(messages)

    const once = elideMediaToolResults(messages, 2)
    expect(messages).toEqual(snapshot)

    const twice = elideMediaToolResults(once, 2)
    expect(twice).toEqual(once)
  })
})

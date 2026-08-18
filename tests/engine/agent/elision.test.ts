import { describe, expect, test } from 'bun:test'

import { elideMediaToolResults, MEDIA_OUTPUT_TOOLS } from '#agent/elision'
import type { ModelMessage } from 'ai'

function mediaToolMessage(toolName: string, base64: string): ModelMessage {
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
            { type: 'text', text: 'screenshot note' },
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

describe('agent.elideMediaToolResults (parity with src/app/ai/chat/elision.ts)', () => {
  test('re-exports MEDIA_OUTPUT_TOOLS so the agent and frontend agree', () => {
    // The agent's `bridgeToolsToAI` skips the elision logic for tools not in
    // this set. Drift between this and the frontend list would cause silent
    // history bloat.
    expect(MEDIA_OUTPUT_TOOLS.has('look')).toBe(true)
    expect(MEDIA_OUTPUT_TOOLS.has('export_image')).toBe(true)
  })

  test('no images → messages unchanged (reference equality)', () => {
    const messages = [textMessage('user', 'hi'), jsonToolMessage('describe')]
    expect(elideMediaToolResults(messages, 2)).toBe(messages)
  })

  test('images below the keep threshold are preserved', () => {
    const messages = [
      textMessage('user', 'draw a cat'),
      mediaToolMessage('look', 'BASE64-A'),
      mediaToolMessage('look', 'BASE64-B')
    ]
    const out = elideMediaToolResults(messages, 2)
    expect(out).toBe(messages)
  })

  test('older images are replaced with a text placeholder, newest K kept', () => {
    const messages = [
      textMessage('user', 'draw 3 cats'),
      mediaToolMessage('look', 'BASE64-A'),
      mediaToolMessage('look', 'BASE64-B'),
      mediaToolMessage('look', 'BASE64-C')
    ]
    const out = elideMediaToolResults(messages, 2)
    expect(out).not.toBe(messages)
    expect(out[0]).toBe(messages[0])

    // With keep=2 and 3 images, exactly one is elided; the newest two survive.
    const mediaCount = countMedia(out)
    expect(mediaCount).toBe(2)

    // BASE64-A (the oldest) must be elided; BASE64-B and BASE64-C must remain.
    const surviving = collectMediaBase64s(out)
    expect(surviving).not.toContain('BASE64-A')
    expect(surviving).toContain('BASE64-B')
    expect(surviving).toContain('BASE64-C')
  })

  test('keep=0 elides every image', () => {
    const messages = [
      textMessage('user', 'go'),
      mediaToolMessage('look', 'BASE64-A'),
      mediaToolMessage('look', 'BASE64-B')
    ]
    const out = elideMediaToolResults(messages, 0)
    expect(countMedia(out)).toBe(0)
  })

  test('non-media tool results are not elided', () => {
    const messages = [textMessage('user', 'inspect'), jsonToolMessage('describe')]
    expect(elideMediaToolResults(messages, 0)).toBe(messages)
  })

  test('tool results from non-media tools keep their media-bearing siblings alone', () => {
    // If `describe` had a media field it would be ignored (it's not in
    // MEDIA_OUTPUT_TOOLS). We assert by constructing a media part inside
    // a describe output and confirming it's preserved verbatim.
    const messages = [
      textMessage('user', 'inspect'),
      {
        role: 'tool',
        content: [
          {
            type: 'tool-result',
            toolCallId: 'call-1',
            toolName: 'describe',
            output: {
              type: 'content',
              value: [{ type: 'media', mediaType: 'image/jpeg', data: 'BASE64-D' }]
            }
          }
        ]
      } as ModelMessage
    ]
    expect(elideMediaToolResults(messages, 0)).toBe(messages)
  })
})

function countMedia(messages: ModelMessage[]): number {
  let count = 0
  for (const message of messages) {
    if (message.role !== 'tool' || !Array.isArray(message.content)) continue
    for (const part of message.content) {
      const candidate = part as {
        type?: string
        output?: { type?: string; value?: Array<{ type?: string }> }
      }
      if (candidate.type !== 'tool-result') continue
      const value = candidate.output?.value
      if (!Array.isArray(value)) continue
      for (const item of value) if (item?.type === 'media') count++
    }
  }
  return count
}

function collectMediaBase64s(messages: ModelMessage[]): string[] {
  const out: string[] = []
  for (const message of messages) {
    if (message.role !== 'tool' || !Array.isArray(message.content)) continue
    for (const part of message.content) {
      const candidate = part as {
        type?: string
        output?: { type?: string; value?: Array<{ type?: string; data?: string }> }
      }
      if (candidate.type !== 'tool-result') continue
      const value = candidate.output?.value
      if (!Array.isArray(value)) continue
      for (const item of value) {
        if (item?.type === 'media' && typeof item.data === 'string') out.push(item.data)
      }
    }
  }
  return out
}

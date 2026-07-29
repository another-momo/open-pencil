import { describe, expect, test } from 'bun:test'

import { valibotSchema } from '@ai-sdk/valibot'
import { convertToModelMessages, tool } from 'ai'
import type { ModelMessage, UIMessage } from 'ai'
import * as v from 'valibot'

import { CORE_TOOLS, FigmaAPI, SceneGraph, toolsToAI } from '@open-pencil/core'

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

describe('UIMessage → ModelMessage wiring (toModelOutput + elision)', () => {
  function lookOutput(tag: string) {
    return {
      base64: `BASE64-${tag}`,
      mimeType: 'image/jpeg',
      byteLength: 100,
      node: { id: '0:1', name: 'Root', width: 750, height: 4000 },
      note: `note-${tag}`
    }
  }

  function lookUIMessage(tags: string[]): UIMessage[] {
    return [
      {
        id: 'msg-1',
        role: 'assistant',
        parts: tags.map((tag, i) => ({
          type: 'tool-look',
          toolCallId: `call-${tag}`,
          state: 'output-available',
          input: {},
          output: lookOutput(tag)
        }))
      }
    ] as unknown as UIMessage[]
  }

  function chatTools() {
    const figma = new FigmaAPI(new SceneGraph())
    return toolsToAI(CORE_TOOLS, { getFigma: () => figma }, { v, valibotSchema, tool })
  }

  function toolResultOutputs(messages: ModelMessage[]) {
    const outputs: Array<{ type: string; value?: Array<{ type: string; data?: string }> }> = []
    for (const message of messages) {
      if (message.role !== 'tool' || !Array.isArray(message.content)) continue
      for (const part of message.content) {
        const candidate = part as {
          type: string
          output?: { type: string; value?: Array<{ type: string; data?: string }> }
        }
        if (candidate.type === 'tool-result' && candidate.output) outputs.push(candidate.output)
      }
    }
    return outputs
  }

  test('look output reaches the model as media content parts, not JSON', async () => {
    const modelMessages = await convertToModelMessages(lookUIMessage(['A']), {
      tools: chatTools()
    })

    const outputs = toolResultOutputs(modelMessages)
    expect(outputs).toHaveLength(1)
    expect(outputs[0].type).toBe('content')
    const value = outputs[0].value ?? []
    expect(value.map((item) => item.type)).toEqual(['text', 'media'])
    expect(value[1].data).toBe('BASE64-A')
  })

  test('end-to-end: conversion then elision keeps only the newest K images', async () => {
    const modelMessages = await convertToModelMessages(lookUIMessage(['1', '2', '3']), {
      tools: chatTools()
    })

    const elided = elideMediaToolResults(modelMessages, 2)
    const outputs = toolResultOutputs(elided)

    const first = outputs[0].value ?? []
    expect(first[0]).toEqual({ type: 'text', text: 'note-1' })
    expect(first[1].type).toBe('text')
    expect(JSON.stringify(elided)).not.toContain('BASE64-1')
    expect(JSON.stringify(elided)).toContain('BASE64-2')
    expect(JSON.stringify(elided)).toContain('BASE64-3')
  })
})

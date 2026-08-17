import { afterEach, beforeEach, describe, expect, test } from 'bun:test'

import type { UIMessage, UIMessageChunk } from 'ai'

import type { AgentBackendInfo, AgentChatConfig } from '@/app/ai/chat/agent-transport'
import { createHttpAgentTransport } from '@/app/ai/chat/http-agent-transport'
import type { EditorStore } from '@/app/editor/session/create'

// The transport uses `globalThis.fetch` directly and reads `store` for the
// brand selection. We bypass both by passing a store stub and swapping
// globalThis.fetch for a spy that hands back a controllable SSE body.

type CapturedRequest = {
  url: string
  headers: Record<string, string>
  body: string
}

function sseStream(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder()
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk))
      controller.close()
    }
  })
}

async function collectChunks(stream: ReadableStream<UIMessageChunk>): Promise<UIMessageChunk[]> {
  const reader = stream.getReader()
  const chunks: UIMessageChunk[] = []
  while (true) {
    const { value, done } = await reader.read()
    if (done) break
    chunks.push(value)
  }
  return chunks
}

function makeStoreStub(): EditorStore {
  // Only `graph` is touched in marketing mode; we keep `chatMode` at 'design'
  // in tests so this stub never gets dereferenced.
  return { graph: {} } as unknown as EditorStore
}

describe('createHttpAgentTransport.sendMessages', () => {
  let originalFetch: typeof fetch
  let captured: CapturedRequest | null

  beforeEach(() => {
    originalFetch = globalThis.fetch
    captured = null
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  const info: AgentBackendInfo = {
    baseUrl: 'http://127.0.0.1:7601',
    connectionId: 'web-conn-abc',
    version: '0.14.0'
  }

  const baseConfig: AgentChatConfig = {
    connectionId: 'web-conn-abc',
    providerID: 'anthropic',
    modelID: 'claude-sonnet-4-5',
    customModelID: '',
    customBaseURL: '',
    customAPIType: 'completions',
    maxOutputTokens: 4096,
    chatMode: 'design',
    lookImagesKept: 0
  }

  test('sends POST to /v1/chat with the correct wire shape', async () => {
    const transport = createHttpAgentTransport({
      info,
      chatId: 'web-tab-1',
      store: makeStoreStub(),
      config: baseConfig
    })

    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      captured = {
        url: String(input),
        headers: Object.fromEntries(new Headers(init?.headers).entries()),
        body: String(init?.body ?? '')
      }
      return new Response(sseStream(['data: {"type":"finish","finishReason":"stop"}\n\n']), {
        status: 200,
        headers: { 'content-type': 'text/event-stream' }
      })
    }) as typeof fetch

    const messages: UIMessage[] = [
      { id: 'm1', role: 'user', parts: [{ type: 'text', text: 'hello' }] }
    ]

    const stream = await transport.sendMessages({
      messages,
      abortSignal: undefined,
      trigger: 'submit-message',
      chatId: 'sdk-chat-id',
      messageId: 'm1',
      headers: undefined,
      body: undefined,
      metadata: undefined
    })

    // Drain the stream so the underlying body reader is released before
    // the test ends.
    await collectChunks(stream)

    expect(captured).not.toBeNull()
    expect(captured!.url).toBe('http://127.0.0.1:7601/v1/chat')
    expect(captured!.headers['content-type']).toBe('application/json')
    expect(captured!.headers['x-op-connection-id']).toBe('web-conn-abc')
    expect(captured!.headers['x-op-chat-id']).toBe('web-tab-1')

    const body = JSON.parse(captured!.body)
    expect(body.id).toBe('web-tab-1')
    expect(body.trigger).toBe('submit-message')
    expect(body.agent).toMatchObject({
      connectionId: 'web-conn-abc',
      providerID: 'anthropic',
      modelID: 'claude-sonnet-4-5',
      chatMode: 'design'
    })
    expect(Array.isArray(body.messages)).toBe(true)
    // UI messages go through convertToModelMessages → role/content pairs.
    // Without tools we can't validate exact content shape here, only that
    // the wire format is ModelMessage[] (not UIMessage[]).
    expect(body.messages[0]).toHaveProperty('role')
    expect(body.messages[0]).toHaveProperty('content')
    expect(body.messages[0].role).toBe('user')
    // Marketing mode is off → no brandSelection on the wire.
    expect(body.brandSelection).toBeUndefined()
  })

  test('throws when the backend returns a non-2xx status with the body text', async () => {
    const transport = createHttpAgentTransport({
      info,
      chatId: 'web-tab-1',
      store: makeStoreStub(),
      config: baseConfig
    })

    globalThis.fetch = (async () => {
      return new Response('{"error":"messages[] is required"}', {
        status: 400,
        headers: { 'content-type': 'application/json' }
      })
    }) as typeof fetch

    const messages: UIMessage[] = [
      { id: 'm1', role: 'user', parts: [{ type: 'text', text: 'hello' }] }
    ]

    await expect(
      transport.sendMessages({
        messages,
        abortSignal: undefined,
        trigger: 'submit-message',
        chatId: 'sdk',
        messageId: 'm1',
        headers: undefined,
        body: undefined,
        metadata: undefined
      })
    ).rejects.toThrow(/Agent backend returned 400: \{"error":"messages\[\] is required"\}/)
  })

  test('throws when the backend returns an empty body', async () => {
    const transport = createHttpAgentTransport({
      info,
      chatId: 'web-tab-1',
      store: makeStoreStub(),
      config: baseConfig
    })

    globalThis.fetch = (async () => new Response(null, { status: 200 })) as typeof fetch

    const messages: UIMessage[] = [
      { id: 'm1', role: 'user', parts: [{ type: 'text', text: 'hello' }] }
    ]

    await expect(
      transport.sendMessages({
        messages,
        abortSignal: undefined,
        trigger: 'submit-message',
        chatId: 'sdk',
        messageId: 'm1',
        headers: undefined,
        body: undefined,
        metadata: undefined
      })
    ).rejects.toThrow(/Agent backend returned an empty body/)
  })
})

describe('createHttpAgentTransport SSE parsing', () => {
  let originalFetch: typeof fetch

  beforeEach(() => {
    originalFetch = globalThis.fetch
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  test('emits one chunk per `data:` line, even when split across HTTP chunks', async () => {
    const transport = createHttpAgentTransport({
      info: { baseUrl: 'http://x', connectionId: 'c', version: null },
      chatId: 'c',
      store: { graph: {} } as unknown as EditorStore,
      config: {
        connectionId: 'c',
        providerID: 'anthropic',
        modelID: 'm',
        customModelID: '',
        customBaseURL: '',
        customAPIType: 'completions',
        maxOutputTokens: 4096,
        chatMode: 'design',
        lookImagesKept: 0
      }
    })

    // SSE arrives split across two HTTP chunks — first one carries the first
    // event terminator, second one carries the rest. The parser must
    // concatenate across the boundary.
    globalThis.fetch = (async () => {
      return new Response(
        sseStream([
          'data: {"type":"start","messageId":"m1"}\n\ndata: {"type":"text-start","id":"t1"}\n',
          '\ndata: {"type":"text-delta","id":"t1","delta":"hi"}\n\ndata: {"type":"finish","finishReason":"stop"}\n\n'
        ]),
        { status: 200, headers: { 'content-type': 'text/event-stream' } }
      )
    }) as typeof fetch

    const stream = await transport.sendMessages({
      messages: [{ id: 'm', role: 'user', parts: [{ type: 'text', text: 'x' }] }],
      abortSignal: undefined,
      trigger: 'submit-message',
      chatId: 'sdk',
      messageId: 'm',
      headers: undefined,
      body: undefined,
      metadata: undefined
    })

    const chunks = await collectChunks(stream)
    expect(chunks.map((c) => c.type)).toEqual(['start', 'text-start', 'text-delta', 'finish'])
    expect(chunks[2]).toMatchObject({ type: 'text-delta', delta: 'hi' })
  })

  test('skips malformed JSON chunks instead of throwing', async () => {
    const transport = createHttpAgentTransport({
      info: { baseUrl: 'http://x', connectionId: 'c', version: null },
      chatId: 'c',
      store: { graph: {} } as unknown as EditorStore,
      config: {
        connectionId: 'c',
        providerID: 'anthropic',
        modelID: 'm',
        customModelID: '',
        customBaseURL: '',
        customAPIType: 'completions',
        maxOutputTokens: 4096,
        chatMode: 'design',
        lookImagesKept: 0
      }
    })

    globalThis.fetch = (async () => {
      return new Response(
        sseStream([
          'data: {"type":"start","messageId":"m1"}\n\n' +
            'data: not-valid-json\n\n' +
            'data: {"type":"finish","finishReason":"stop"}\n\n'
        ]),
        { status: 200, headers: { 'content-type': 'text/event-stream' } }
      )
    }) as typeof fetch

    const stream = await transport.sendMessages({
      messages: [{ id: 'm', role: 'user', parts: [{ type: 'text', text: 'x' }] }],
      abortSignal: undefined,
      trigger: 'submit-message',
      chatId: 'sdk',
      messageId: 'm',
      headers: undefined,
      body: undefined,
      metadata: undefined
    })

    const chunks = await collectChunks(stream)
    // Malformed line is dropped, valid lines pass through.
    expect(chunks.map((c) => c.type)).toEqual(['start', 'finish'])
  })

  test('ignores non-data SSE fields (event:, id:, retry:)', async () => {
    const transport = createHttpAgentTransport({
      info: { baseUrl: 'http://x', connectionId: 'c', version: null },
      chatId: 'c',
      store: { graph: {} } as unknown as EditorStore,
      config: {
        connectionId: 'c',
        providerID: 'anthropic',
        modelID: 'm',
        customModelID: '',
        customBaseURL: '',
        customAPIType: 'completions',
        maxOutputTokens: 4096,
        chatMode: 'design',
        lookImagesKept: 0
      }
    })

    globalThis.fetch = (async () => {
      return new Response(
        sseStream([
          'event: ping\nid: 42\nretry: 1000\ndata: {"type":"start","messageId":"m1"}\n\n'
        ]),
        { status: 200, headers: { 'content-type': 'text/event-stream' } }
      )
    }) as typeof fetch

    const stream = await transport.sendMessages({
      messages: [{ id: 'm', role: 'user', parts: [{ type: 'text', text: 'x' }] }],
      abortSignal: undefined,
      trigger: 'submit-message',
      chatId: 'sdk',
      messageId: 'm',
      headers: undefined,
      body: undefined,
      metadata: undefined
    })

    const chunks = await collectChunks(stream)
    // Only the data: line becomes a chunk; the event/id/retry fields are
    // silently skipped per the SSE shape we actually use (AI SDK v1).
    expect(chunks).toHaveLength(1)
    expect(chunks[0].type).toBe('start')
  })
})

describe('createHttpAgentTransport.reconnectToStream', () => {
  test('returns null (the agent backend does not support resumable streams)', async () => {
    const transport = createHttpAgentTransport({
      info: { baseUrl: 'http://x', connectionId: 'c', version: null },
      chatId: 'c',
      store: { graph: {} } as unknown as EditorStore,
      config: {
        connectionId: 'c',
        providerID: 'anthropic',
        modelID: 'm',
        customModelID: '',
        customBaseURL: '',
        customAPIType: 'completions',
        maxOutputTokens: 4096,
        chatMode: 'design',
        lookImagesKept: 0
      }
    })
    const result = await transport.reconnectToStream({ chatId: 'c' })
    expect(result).toBeNull()
  })
})

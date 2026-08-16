import {
  convertToModelMessages,
  type ChatTransport,
  type UIMessage,
  type UIMessageChunk
} from 'ai'

import type {
  AgentBackendInfo,
  AgentChatConfig
} from '@/app/ai/chat/agent-transport'
import { serializeLibrarySnapshot } from '@/app/ai/marketing/library'
import type { EditorStore } from '@/app/editor/session/create'

/**
 * ChatTransport that proxies `Chat<UIMessage>.sendMessages` directly to the
 * local agent backend.
 *
 * Why a hand-rolled transport (not SDK's `DefaultChatTransport`):
 *   The SDK's `DefaultChatTransport.sendMessages` ultimately calls
 *   `JSON.stringify({...resolvedBody, ...options.body, id, messages, ...})`
 *   with `messages` left as UI-message wire format (id/role/parts). We
 *   need ModelMessage[] (role/content) for the agent's
 *   `ToolLoopAgent.stream({messages})` — the SDK doesn't expose a
 *   per-send messages hook in `HttpChatTransport`/`DefaultChatTransport`,
 *   so we own the full send + SSE parse.
 *
 * Wire shape:
 *   POST {info.baseUrl}/v1/chat
 *     headers:
 *       Content-Type: application/json
 *       x-op-connection-id: <info.connectionId>
 *       x-op-chat-id:       <chatId>
 *     body:
 *       { id, messages, trigger, agent: AgentChatConfig, librarySnapshot? }
 *   response:
 *     text/event-stream carrying AI SDK UIMessage chunks
 *     (x-vercel-ai-data-stream: v1)
 */
export function createHttpAgentTransport({
  info,
  chatId,
  store,
  config
}: {
  info: AgentBackendInfo
  chatId: string
  store: EditorStore
  config: AgentChatConfig
}): ChatTransport<UIMessage> {
  const headers: Record<string, string> = {
    'x-op-connection-id': info.connectionId,
    'x-op-chat-id': chatId
  }

  return {
    async sendMessages({ messages, abortSignal, ...options }) {
      const modelMessages = await convertToModelMessages(messages)
      const body: Record<string, unknown> = {
        id: chatId,
        messages: modelMessages,
        trigger: options.trigger,
        agent: config
      }
      if (config.chatMode === 'marketing') {
        const snapshot = serializeLibrarySnapshot(store.graph)
        if (snapshot) body.librarySnapshot = snapshot
      }
      const response = await fetch(`${info.baseUrl}/v1/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify(body),
        credentials: 'omit',
        signal: abortSignal
      })
      if (!response.ok) {
        const text = await response.text().catch(() => '')
        console.error('[agent-transport] backend error', response.status, text)
        throw new Error(
          `Agent backend returned ${response.status}: ${text || response.statusText}`
        )
      }
      if (!response.body) throw new Error('Agent backend returned an empty body')
      return parseUIMessageStream(response.body)
    },
    async reconnectToStream() {
      // The agent backend is in-process — restart the stream by re-sending.
      return null
    }
  }
}

/**
 * Parse an AI SDK UIMessage SSE stream into a `ReadableStream<UIMessageChunk>`.
 *
 * SDK chunk format (`x-vercel-ai-data-stream: v1`):
 *   data: {"type":"text-start", ...}\n\n
 *   data: {"type":"tool-input-start", ...}\n\n
 *   ...
 * Each `data:` line is a complete JSON object. Blank lines separate events.
 */
function parseUIMessageStream(
  body: ReadableStream<Uint8Array>
): ReadableStream<UIMessageChunk> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  return new ReadableStream<UIMessageChunk>({
    async pull(controller) {
      const { value, done } = await reader.read()
      if (done) {
        controller.close()
        return
      }
      buffer += decoder.decode(value, { stream: true })

      // Parse SSE events: each event is `data: <json>\n\n` (one or more
      // data lines per event in spec, but AI SDK uses single line).
      let newlineIndex: number
      while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
        const line = buffer.slice(0, newlineIndex).trim()
        buffer = buffer.slice(newlineIndex + 1)
        if (!line) continue
        if (line.startsWith('data:')) {
          const payload = line.slice(5).trim()
          if (!payload) continue
          try {
            controller.enqueue(JSON.parse(payload) as UIMessageChunk)
          } catch {
            // Ignore malformed chunks; SDK spec says do not throw on
            // individual chunk parse errors.
          }
        }
        // Ignore `event:`, `id:`, `retry:` — AI SDK only uses `data:` lines.
      }
    },
    cancel() {
      reader.cancel().catch(() => undefined)
    }
  })
}
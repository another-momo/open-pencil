/**
 * T19 前端 transport：POST /api/pi-chat + 手工 SSE 解析 → ReadableStream<UIMessageChunk>。
 * T21：请求体新增可选 model（PiModelSpec，来自 assignment.ts 的 design 指派）。
 *
 * 契约与 tests/e2e/chat/panel.spec.ts 的 mock transport 完全一致（对象实现
 * ChatTransport 接口，sendMessages 返回 UIMessageChunk 流），因此 Chat 类与
 * ChatPanel.vue 零改动。
 */

import type { ChatTransport, UIMessage, UIMessageChunk } from 'ai'

import type { PiModelSpec } from '@/app/ai/pi-backend/client'

export class PiBackendChatTransport implements ChatTransport<UIMessage> {
  constructor(
    private readonly sessionId: string,
    private readonly getModelSpec?: () => PiModelSpec | undefined,
    private readonly api = '/api/pi-chat'
  ) {}

  async sendMessages({
    messages,
    abortSignal
  }: Parameters<ChatTransport<UIMessage>['sendMessages']>[0]): Promise<
    ReadableStream<UIMessageChunk>
  > {
    const model = this.getModelSpec?.()
    const response = await fetch(this.api, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ sessionId: this.sessionId, messages, ...(model ? { model } : {}) }),
      signal: abortSignal ?? null
    })
    if (!response.ok || !response.body) {
      const detail = await response.text().catch(() => '')
      throw new Error(`pi backend chat failed: HTTP ${response.status} ${detail}`.trim())
    }
    return parseSSEChunkStream(response.body)
  }

  async reconnectToStream(): Promise<ReadableStream<UIMessageChunk> | null> {
    return null
  }
}

function parseSSEChunkStream(body: ReadableStream<Uint8Array>): ReadableStream<UIMessageChunk> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  return new ReadableStream<UIMessageChunk>({
    async pull(controller) {
      for (;;) {
        const frameEnd = buffer.indexOf('\n\n')
        if (frameEnd !== -1) {
          const frame = buffer.slice(0, frameEnd)
          buffer = buffer.slice(frameEnd + 2)
          const dataLine = frame.split('\n').find((line) => line.startsWith('data:'))
          if (dataLine) {
            const data = dataLine.slice(5).trimStart()
            if (data === '[DONE]') {
              controller.close()
              return
            }
            controller.enqueue(JSON.parse(data) as UIMessageChunk)
          }
          continue
        }
        const { done, value } = await reader.read()
        if (done) {
          controller.close()
          return
        }
        buffer += decoder.decode(value, { stream: true })
      }
    },
    cancel(reason) {
      void reader.cancel(reason)
    }
  })
}

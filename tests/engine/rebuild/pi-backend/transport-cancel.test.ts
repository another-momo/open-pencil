/**
 * T73 钉扎：PiBackendChatTransport 的 stop 带外取消通道。
 *
 * 背景（T73-plan §1）：唯一取消通道曾是 server.ts res.on('close')——客户端
 * socket 关闭语义穿透 vite http-proxy 不可靠（curl 对照实证：客户端死后后端
 * 仍持续执行工具 25s+）。修复 = abortSignal 触发时 transport 同步 POST
 * /api/pi-chat/cancel（fire-and-forget，once，失败静默）。
 *
 * 本文件钉扎 transport 侧行为；路由侧 HTTP 往返见 chat-cancel-route.test.ts。
 */
import { afterEach, describe, expect, test } from 'bun:test'

import { PiBackendChatTransport } from '@/app/ai/pi-backend/transport'

interface FetchCall {
  url: string
  method: string | undefined
  body: unknown
}

const realFetch = globalThis.fetch

/** 挂起永不结束的 SSE 响应（sendMessages 拿到 body 即返回，不消费） */
function hangingSSEResponse(): Response {
  return new Response(
    new ReadableStream<Uint8Array>({
      start() {
        /* 永不 enqueue——模拟进行中的 SSE 流 */
      }
    }),
    { status: 200, headers: { 'content-type': 'text/event-stream' } }
  )
}

function stubFetch(calls: FetchCall[], cancelFails = false) {
  globalThis.fetch = (async (input: unknown, init?: RequestInit) => {
    const url = String(typeof input === 'string' ? input : (input as Request).url)
    if (url.endsWith('/cancel')) {
      calls.push({
        url,
        method: init?.method,
        body: init?.body ? JSON.parse(String(init.body)) : null
      })
      if (cancelFails) throw new Error('network down')
      return new Response(null, { status: 204 })
    }
    calls.push({
      url,
      method: init?.method,
      body: init?.body ? JSON.parse(String(init.body)) : null
    })
    return hangingSSEResponse()
  }) as typeof fetch
}

function makeTransport() {
  return new PiBackendChatTransport(
    async () => ({ sessionId: 'sess-t73', documentId: undefined }) as never
  )
}

const MESSAGES = [{ id: 'm1', role: 'user', parts: [{ type: 'text', text: 'hi' }] }]

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

describe('PiBackendChatTransport stop 带外取消（T73）', () => {
  afterEach(() => {
    globalThis.fetch = realFetch
  })

  test('abortSignal 触发 → 恰好一次 POST /api/pi-chat/cancel 且 body 带当次 sessionId', async () => {
    const calls: FetchCall[] = []
    stubFetch(calls)
    const controller = new AbortController()
    const transport = makeTransport()

    await transport.sendMessages({ messages: MESSAGES, abortSignal: controller.signal } as never)
    expect(calls.filter((c) => c.url.endsWith('/cancel'))).toHaveLength(0)

    controller.abort()
    await sleep(10)

    const cancels = calls.filter((c) => c.url.endsWith('/cancel'))
    expect(cancels).toHaveLength(1)
    expect(cancels[0].method).toBe('POST')
    expect(cancels[0].body).toEqual({ sessionId: 'sess-t73' })
  })

  test('无 abortSignal → 不发 cancel', async () => {
    const calls: FetchCall[] = []
    stubFetch(calls)
    const transport = makeTransport()

    await transport.sendMessages({ messages: MESSAGES } as never)
    await sleep(10)

    expect(calls).toHaveLength(1)
    expect(calls[0].url.endsWith('/cancel')).toBe(false)
  })

  test('cancel 请求失败 → 静默吞掉（不冒 unhandled rejection）', async () => {
    const calls: FetchCall[] = []
    stubFetch(calls, true)
    const controller = new AbortController()
    const transport = makeTransport()

    await transport.sendMessages({ messages: MESSAGES, abortSignal: controller.signal } as never)
    controller.abort()
    await sleep(10)
    // 不抛错即通过；cancel 确实尝试过
    expect(calls.filter((c) => c.url.endsWith('/cancel'))).toHaveLength(1)
  })

  test('入参信号已 aborted → 立即补发 cancel（不等新事件）', async () => {
    const calls: FetchCall[] = []
    stubFetch(calls)
    const controller = new AbortController()
    controller.abort()
    const transport = makeTransport()

    await transport.sendMessages({ messages: MESSAGES, abortSignal: controller.signal } as never)
    await sleep(10)

    expect(calls.filter((c) => c.url.endsWith('/cancel'))).toHaveLength(1)
  })
})

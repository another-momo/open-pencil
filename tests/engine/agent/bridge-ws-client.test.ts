import { afterEach, describe, expect, test } from 'bun:test'
import { createServer, type Server } from 'node:http'
import { randomUUID } from 'node:crypto'
import { WebSocket, WebSocketServer } from 'ws'

import { FrontendBridge, type RpcEnvelope } from '#agent/bridge/ws-client'

// Spins up an HTTP server that upgrades to a real WS pair. The "server"
// side plays the role of the OpenPencil frontend mcp bridge for the
// duration of one test: it accepts auth, then echoes any `request`
// envelopes back as `response` envelopes using a configurable handler.

type Handler = (command: string, args: unknown) => unknown

function createTestBridge(handler: Handler): Promise<{
  url: string
  authToken: string
  close: () => Promise<void>
  received: RpcEnvelope[]
}> {
  return new Promise((resolve, reject) => {
    const authToken = `test-token-${randomUUID().slice(0, 8)}`
    const received: RpcEnvelope[] = []

    const httpServer = createServer()
    const wss = new WebSocketServer({ noServer: true })

    httpServer.on('upgrade', (request, socket, head) => {
      wss.handleUpgrade(request, socket, head, (ws) => wss.emit('connection', ws, request))
    })

    wss.on('connection', (ws) => {
      ws.on('message', (raw) => {
        const data = typeof raw === 'string' ? raw : Buffer.from(raw as Buffer).toString('utf-8')
        let parsed: RpcEnvelope
        try {
          parsed = JSON.parse(data) as RpcEnvelope
        } catch {
          return
        }
        received.push(parsed)

        if (parsed.type === 'auth') {
          if (parsed.token !== authToken) {
            ws.close()
            return
          }
          // Accept auth and stay open.
          return
        }

        if (parsed.type === 'request' && parsed.id && parsed.command) {
          try {
            const result = handler(parsed.command, parsed.args)
            ws.send(
              JSON.stringify({
                type: 'response',
                id: parsed.id,
                ok: true,
                result
              } satisfies RpcEnvelope)
            )
          } catch (err) {
            ws.send(
              JSON.stringify({
                type: 'response',
                id: parsed.id,
                ok: false,
                error: err instanceof Error ? err.message : String(err)
              } satisfies RpcEnvelope)
            )
          }
        }
      })
    })

    httpServer.listen(0, '127.0.0.1', () => {
      const addr = httpServer.address()
      const port = typeof addr === 'object' && addr ? addr.port : 0
      resolve({
        url: `ws://127.0.0.1:${port}`,
        authToken,
        received,
        close: async () => {
          await new Promise<void>((res) => wss.close(() => res()))
          await new Promise<void>((res) => httpServer.close(() => res()))
        }
      })
    })

    httpServer.on('error', reject)
  })
}

function rejectHandler(reason: string): Handler {
  return () => {
    throw new Error(reason)
  }
}

let testHandles: Array<{ close: () => Promise<void> }> = []
let testBridges: FrontendBridge[] = []

afterEach(async () => {
  for (const bridge of testBridges) bridge.disconnect()
  testBridges = []
  for (const handle of testHandles) await handle.close()
  testHandles = []
})

async function withBridge(handler: Handler) {
  const setup = await createTestBridge(handler)
  testHandles.push(setup)
  const bridge = new FrontendBridge()
  await bridge.connect({
    socketPath: null,
    httpPort: new URL(setup.url).port ? Number(new URL(setup.url).port) : 0,
    authToken: setup.authToken
  })
  testBridges.push(bridge)
  return { bridge, setup }
}

describe('FrontendBridge.connect', () => {
  test('sends an auth envelope with the configured token', async () => {
    const { setup } = await withBridge(() => null)
    // The auth envelope is the very first message.
    const auth = setup.received.find((msg) => msg.type === 'auth')
    expect(auth).toBeDefined()
    expect(auth?.token).toBe(setup.authToken)
  })

  test('isOpen() returns true after successful connect', async () => {
    const { bridge } = await withBridge(() => null)
    expect(bridge.isOpen()).toBe(true)
  })
})

describe('FrontendBridge.sendRPC', () => {
  test('sends a request envelope with command + args + id', async () => {
    const { setup, bridge } = await withBridge(() => ({ ok: true }))
    await bridge.sendRPC('tool', { name: 'create_shape', args: { x: 1 } })

    const request = setup.received.find((msg) => msg.type === 'request')
    expect(request).toBeDefined()
    expect(request?.command).toBe('tool')
    expect(request?.args).toEqual({ name: 'create_shape', args: { x: 1 } })
    expect(request?.id).toBeString()
  })

  test('resolves with the response result', async () => {
    const { bridge } = await withBridge(() => ({ nodeId: '0:99' }))
    const response = await bridge.sendRPC('tool', { name: 'create_shape' })
    expect(response.ok).toBe(true)
    expect(response.result).toEqual({ nodeId: '0:99' })
  })

  test('rejects when the bridge returns ok:false', async () => {
    const { bridge } = await withBridge(rejectHandler('Tool exploded'))
    await expect(bridge.sendRPC('tool', {})).rejects.toThrow(/Tool exploded/)
  })

  test('throws synchronously when the bridge is not connected', async () => {
    const bridge = new FrontendBridge()
    await expect(bridge.sendRPC('tool', {})).rejects.toThrow(/Bridge not connected/)
  })

  test('rejects in-flight requests when disconnect() is called', async () => {
    // A handler that never responds — request sits pending until disconnect.
    const setup = await createTestBridge(() => {
      // intentionally no-op
    })
    testHandles.push(setup)
    const bridge = new FrontendBridge()
    await bridge.connect({
      socketPath: null,
      httpPort: Number(new URL(setup.url).port),
      authToken: setup.authToken
    })
    testBridges.push(bridge)

    const pending = bridge.sendRPC('slow', {})
    bridge.disconnect()
    await expect(pending).rejects.toThrow(/Bridge disconnected/)
  })
})

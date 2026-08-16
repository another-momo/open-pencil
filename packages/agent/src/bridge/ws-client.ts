import { randomUUID } from 'node:crypto'
import { EventEmitter } from 'node:events'
import WebSocket from 'ws'

import { platformHasUnixSockets } from '@open-pencil/mcp/transport'

// The image-generation provider runs at 240s (`imageGenTimeoutMs` in
// @open-pencil/core/tools/image-gen/providers.ts); the RPC envelope has
// to comfortably exceed that or the LLM sees a transport timeout mid-
// step. Keep a 60s margin to absorb WS overhead and image-byte transfer.
const BRIDGE_RPC_TIMEOUT_MS = 300_000
const AUTH_RETRY_DELAY_MS = 1_000
const AUTH_RETRY_MAX = 5

export type RpcEnvelope = {
  type: 'request' | 'response' | 'auth' | 'register'
  id?: string
  token?: unknown
  command?: string
  args?: unknown
  ok?: boolean
  result?: unknown
  error?: string
  target?: unknown
}

export type RpcResponse = {
  ok: boolean
  result?: unknown
  error?: string
  target?: unknown
}

export type BridgeInfo = {
  socketPath: string | null
  httpPort: number
  authToken: string | null
}

export type FrontendBridgeEvents = {
  connect: []
  disconnect: []
  authenticated: []
  rpc: [RpcEnvelope]
}

/**
 * Reverse-RPC WebSocket client. Connects to the OpenPencil automation
 * bridge (port 7600 or the platform's Unix socket) and authenticates as
 * a *secondary* client — sending `{type:'auth', token}` instead of
 * `{type:'register', token}` so the frontend stays the canonical
 * `browserWs` RPC target.
 *
 * Why "auth" not "register": the bridge allows only one registered
 * browser at a time (see packages/mcp/src/browser-rpc.ts:228-237). A
 * second `register` would steal the slot and close the frontend's
 * socket. `auth` authenticates without becoming the RPC target, then
 * the client can send `request` messages that the bridge forwards to
 * the frontend's WebSocket handler.
 */
export class FrontendBridge extends EventEmitter<FrontendBridgeEvents> {
  private ws: WebSocket | null = null
  private pending = new Map<
    string,
    { resolve: (value: RpcResponse) => void; reject: (error: Error) => void; timer: NodeJS.Timeout }
  >()
  private info: BridgeInfo | null = null
  private authToken: string | null = null
  private explicitClose = false
  private authRetries = 0

  async connect(info: BridgeInfo): Promise<void> {
    this.info = info
    this.authToken = info.authToken
    this.explicitClose = false
    await this.openSocket()
  }

  private openSocket(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.info) return reject(new Error('Bridge info not set'))

      const useSocket = platformHasUnixSockets() && this.info.socketPath
      const target = useSocket
        ? { socketPath: this.info.socketPath }
        : { host: '127.0.0.1', port: this.info.httpPort }

      const ws = useSocket
        ? new WebSocket(target.socketPath!, { perMessageDeflate: false })
        : new WebSocket(`ws://${target.host}:${target.port}`)
      this.ws = ws
      this.explicitClose = false

      const fail = (err: Error) => {
        if (this.ws === ws) this.ws = null
        reject(err)
      }

      ws.once('open', () => {
        this.emit('connect')
        ws.send(
          JSON.stringify({ type: 'auth', token: this.authToken } satisfies RpcEnvelope)
        )
        // Give the bridge a moment to process auth before resolving;
        // any auth-failure close arrives within a few ms on localhost.
        // The retry counter is incremented in the `close` handler below
        // — counting on every open would consume the retry budget twice
        // for each failed handshake.
        setTimeout(() => {
          if (this.ws === ws && ws.readyState === WebSocket.OPEN) {
            this.emit('authenticated')
            resolve()
          } else {
            fail(new Error('Bridge closed before authentication completed'))
          }
        }, 50)
      })

      ws.on('message', (raw) => {
        const data = typeof raw === 'string' ? raw : Buffer.from(raw as Buffer).toString('utf-8')
        let parsed: RpcEnvelope
        try {
          parsed = JSON.parse(data) as RpcEnvelope
        } catch {
          return
        }
        this.emit('rpc', parsed)
        if (parsed.type === 'response' && parsed.id && this.pending.has(parsed.id)) {
          const { resolve, reject, timer } = this.pending.get(parsed.id)!
          this.pending.delete(parsed.id)
          clearTimeout(timer)
          if (parsed.ok === false) {
            reject(new Error(parsed.error ?? 'RPC failed'))
          } else {
            resolve({
              ok: parsed.ok ?? true,
              result: parsed.result,
              error: parsed.error,
              target: parsed.target
            })
          }
        }
      })

      ws.on('error', (err) => {
        if (this.ws === ws) this.ws = null
        fail(err instanceof Error ? err : new Error(String(err)))
      })

      ws.on('close', () => {
        if (this.ws === ws) this.ws = null
        this.emit('disconnect')
        // Reject all pending — the bridge is gone, they cannot complete.
        for (const [, entry] of this.pending) {
          clearTimeout(entry.timer)
          entry.reject(new Error('Bridge disconnected'))
        }
        this.pending.clear()
        // Auto-retry auth if reconnect-on-close is desired (only when not explicit).
        if (!this.explicitClose && this.info && this.authRetries < AUTH_RETRY_MAX) {
          this.authRetries++
          setTimeout(() => {
            if (!this.explicitClose && this.info) {
              this.openSocket().catch(() => undefined)
            }
          }, AUTH_RETRY_DELAY_MS)
        }
      })
    })
  }

  isOpen(): boolean {
    return this.ws?.readyState === WebSocket.OPEN
  }

  async sendRPC(command: string, args: unknown): Promise<RpcResponse> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('Bridge not connected')
    }
    const id = randomUUID()
    return new Promise<RpcResponse>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id)
        reject(new Error(`Bridge RPC timeout (${BRIDGE_RPC_TIMEOUT_MS / 1000}s)`))
      }, BRIDGE_RPC_TIMEOUT_MS)
      this.pending.set(id, { resolve, reject, timer })
      try {
        this.ws!.send(
          JSON.stringify({ type: 'request', id, command, args } satisfies RpcEnvelope)
        )
      } catch (e) {
        clearTimeout(timer)
        this.pending.delete(id)
        reject(e instanceof Error ? e : new Error(String(e)))
      }
    })
  }

  disconnect(): void {
    this.explicitClose = true
    if (this.ws) {
      try {
        this.ws.close()
      } catch {
        // ignore
      }
      this.ws = null
    }
    for (const [, entry] of this.pending) {
      clearTimeout(entry.timer)
      entry.reject(new Error('Bridge disconnected'))
    }
    this.pending.clear()
  }
}
import { randomUUID } from 'node:crypto'
import { EventEmitter } from 'node:events'
import WebSocket from 'ws'

import { platformHasUnixSockets } from '@open-pencil/mcp/transport'

// The image-generation provider runs at 240s (`imageGenTimeoutMs` in
// @open-pencil/core/tools/image-gen/providers.ts); the RPC envelope has
// to comfortably exceed that or the LLM sees a transport timeout mid-
// step. Keep a 60s margin to absorb WS overhead and image-byte transfer.
const BRIDGE_RPC_TIMEOUT_MS = 300_000

// Client-side heartbeat. We send a WS ping every HEARTBEAT_INTERVAL_MS
// and watch for pong frames; if STALE_CHECK_INTERVAL_MS passes without
// a pong, we count a miss. STALE_MISS_LIMIT consecutive misses → emit
// `'stale'` and terminate the socket so the auto-reconnect kicks in.
//
// The server side already runs a 5 s heartbeat (see
// packages/mcp/src/server.ts#wireConnectionHandling). We add a client
// heartbeat because the server's heartbeat is one-directional (it
// kicks half-dead clients); we want the reverse — detecting a
// half-dead server when our ping gets no pong back.
//
// 15 s ping interval + 30 s pong timeout is intentionally conservative
// — image-gen RPCs can run for 240 s, but those don't block the
// heartbeat (it's a frame on the same socket, the OS sends it
// independently of in-flight application data).
const HEARTBEAT_INTERVAL_MS = 15_000
const HEARTBEAT_TIMEOUT_MS = 30_000
const STALE_CHECK_INTERVAL_MS = 5_000
const STALE_MISS_LIMIT = 3

// Exponential backoff for reconnect attempts: 1s → 2s → 4s → 8s → 16s
// → 30s (capped). Replaces the old fixed 1s / 5-retry cap. We retry
// forever until `disconnect()` is called explicitly; an agent process
// restart, frontend tab switch, or brief network blip should not
// require operator intervention.
const RECONNECT_BASE_MS = 1_000
const RECONNECT_CAP_MS = 30_000

export const HEARTBEAT_CONSTANTS = {
  HEARTBEAT_INTERVAL_MS,
  HEARTBEAT_TIMEOUT_MS,
  STALE_CHECK_INTERVAL_MS,
  STALE_MISS_LIMIT,
  RECONNECT_BASE_MS,
  RECONNECT_CAP_MS
} as const

function nextReconnectDelay(attempt: number): number {
  return Math.min(RECONNECT_CAP_MS, RECONNECT_BASE_MS * 2 ** (attempt - 1))
}

export { nextReconnectDelay }

export type RPCEnvelope = {
  type: 'request' | 'response' | 'auth' | 'register' | 'abort'
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

/**
 * Test-only timing overrides. Production code uses module constants
 * (HEARTBEAT_INTERVAL_MS = 15 s etc.) which would make the heartbeat /
 * stale-detection tests take minutes. Exposing a hook keeps the prod
 * surface unchanged while letting tests run in milliseconds.
 */
export type BridgeTimings = {
  heartbeatIntervalMs?: number
  heartbeatTimeoutMs?: number
  staleCheckIntervalMs?: number
  staleMissLimit?: number
  reconnectBaseMs?: number
  reconnectCapMs?: number
}

export type FrontendBridgeEvents = {
  connect: []
  disconnect: []
  authenticated: []
  rpc: [RPCEnvelope]
  /**
   * Emitted when the server failed to pong STALE_MISS_LIMIT times in
   * a row. The bridge terminates the socket and the auto-reconnect
   * loop will bring it back. Callers (routes/chat.ts) can use this to
   * invalidate cached state so the next chat surfaces a real error
   * instead of silently routing RPCs into a half-dead pipe.
   */
  stale: []
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
 *
 * Lifecycle:
 *   connect(info)     → first openSocket attempt; on success resolves
 *   socket dies       → reject pending RPCs, emit 'disconnect',
 *                       schedule reconnect with exponential backoff
 *   socket misses N pong → emit 'stale', terminate, reconnect kicks in
 *   disconnect()      → explicit close; no reconnect
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
  /** Consecutive reconnect attempts since the last successful open. */
  private reconnectAttempts = 0
  /** Last time we observed a pong frame from the server. */
  private lastPong = 0
  /** Consecutive stale-check ticks that saw no pong. */
  private staleMisses = 0
  private heartbeatTimer: NodeJS.Timeout | null = null
  private staleTimer: NodeJS.Timeout | null = null
  private reconnectTimer: NodeJS.Timeout | null = null
  private openInFlight: Promise<void> | null = null
  private timings: {
    heartbeatIntervalMs: number
    heartbeatTimeoutMs: number
    staleCheckIntervalMs: number
    staleMissLimit: number
    reconnectBaseMs: number
    reconnectCapMs: number
  }

  constructor(timings: BridgeTimings = {}) {
    super()
    this.timings = {
      heartbeatIntervalMs: timings.heartbeatIntervalMs ?? HEARTBEAT_INTERVAL_MS,
      heartbeatTimeoutMs: timings.heartbeatTimeoutMs ?? HEARTBEAT_TIMEOUT_MS,
      staleCheckIntervalMs: timings.staleCheckIntervalMs ?? STALE_CHECK_INTERVAL_MS,
      staleMissLimit: timings.staleMissLimit ?? STALE_MISS_LIMIT,
      reconnectBaseMs: timings.reconnectBaseMs ?? RECONNECT_BASE_MS,
      reconnectCapMs: timings.reconnectCapMs ?? RECONNECT_CAP_MS
    }
  }

  async connect(info: BridgeInfo): Promise<void> {
    // Reset reconnect state on every explicit connect — the operator
    // has signalled intent to (re)attach, so we don't carry over a
    // partially-spent retry budget from the previous failure.
    this.info = info
    this.authToken = info.authToken
    this.explicitClose = false
    this.reconnectAttempts = 0
    this.clearReconnectTimer()
    await this.openSocket()
  }

  private openSocket(): Promise<void> {
    // Coalesce concurrent openSocket calls (close handler can fire while
    // a fresh connect is in flight) — they all share the same promise.
    if (this.openInFlight) return this.openInFlight

    this.openInFlight = new Promise<void>((resolve, reject) => {
      if (!this.info) {
        this.openInFlight = null
        return reject(new Error('Bridge info not set'))
      }

      const useSocket = platformHasUnixSockets() && this.info.socketPath
      const target = useSocket
        ? { socketPath: this.info.socketPath }
        : { host: '127.0.0.1', port: this.info.httpPort }

      const ws = useSocket
        ? new WebSocket(target.socketPath!, { perMessageDeflate: false })
        : new WebSocket(`ws://${target.host}:${target.port}`)
      this.ws = ws
      this.explicitClose = false
      this.lastPong = Date.now()
      this.staleMisses = 0

      const fail = (err: Error) => {
        if (this.ws === ws) this.ws = null
        this.openInFlight = null
        this.clearHeartbeat()
        reject(err)
      }

      ws.once('open', () => {
        this.emit('connect')
        ws.send(
          JSON.stringify({ type: 'auth', token: this.authToken } satisfies RPCEnvelope)
        )
        // Give the bridge a moment to process auth before resolving;
        // any auth-failure close arrives within a few ms on localhost.
        setTimeout(() => {
          if (this.ws === ws && ws.readyState === WebSocket.OPEN) {
            // Auth succeeded — reset the retry budget and start heartbeats.
            this.reconnectAttempts = 0
            this.startHeartbeat()
            this.emit('authenticated')
            this.openInFlight = null
            resolve()
          } else {
            fail(new Error('Bridge closed before authentication completed'))
          }
        }, 50)
      })

      ws.on('message', (raw) => {
        const data = typeof raw === 'string' ? raw : Buffer.from(raw as Buffer).toString('utf-8')
        let parsed: RPCEnvelope
        try {
          parsed = JSON.parse(data) as RPCEnvelope
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

      // pong listener for the heartbeat. The `ws` library surfaces
      // protocol-level pong frames here — no application data needed.
      ws.on('pong', () => {
        this.lastPong = Date.now()
        this.staleMisses = 0
      })

      ws.on('error', (err) => {
        if (this.ws === ws) this.ws = null
        fail(err instanceof Error ? err : new Error(String(err)))
      })

      ws.on('close', () => {
        const wasOurs = this.ws === ws
        if (wasOurs) this.ws = null
        this.openInFlight = null
        this.clearHeartbeat()
        this.emit('disconnect')
        // Reject all pending — the bridge is gone, they cannot complete.
        for (const [, entry] of this.pending) {
          clearTimeout(entry.timer)
          entry.reject(new Error('Bridge disconnected'))
        }
        this.pending.clear()
        // Auto-retry unless the operator called disconnect() explicitly.
        if (!this.explicitClose && this.info) {
          this.reconnectAttempts++
          const delay = Math.min(
            this.timings.reconnectCapMs,
            this.timings.reconnectBaseMs * 2 ** (this.reconnectAttempts - 1)
          )
          this.clearReconnectTimer()
          this.reconnectTimer = setTimeout(() => {
            this.reconnectTimer = null
            if (!this.explicitClose && this.info) {
              this.openSocket().catch(() => undefined)
            }
          }, delay)
        }
      })
    })

    return this.openInFlight
  }

  private startHeartbeat(): void {
    this.clearHeartbeat()
    this.heartbeatTimer = setInterval(() => {
      if (!this.isOpen()) return
      try {
        this.ws!.ping()
      } catch {
        // socket is dying — let the close handler take it from here
      }
    }, this.timings.heartbeatIntervalMs)
    this.staleTimer = setInterval(() => {
      if (!this.isOpen()) return
      const sincePong = Date.now() - this.lastPong
      if (sincePong > this.timings.heartbeatTimeoutMs) {
        this.staleMisses++
        if (this.staleMisses >= this.timings.staleMissLimit) {
          this.emit('stale')
          // Force-close so the close handler runs, which will trigger
          // the normal reconnect path. terminate() skips the WS
          // close-handshake so we don't waste the timeout window
          // waiting for a doomed FIN exchange.
          try {
            this.ws?.terminate()
          } catch {
            // ignore — close handler will run regardless
          }
        }
      } else {
        this.staleMisses = 0
      }
    }, STALE_CHECK_INTERVAL_MS)
    // Don't let the heartbeat keep the process alive during shutdown.
    this.heartbeatTimer.unref?.()
    this.staleTimer.unref?.()
  }

  private clearHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer)
      this.heartbeatTimer = null
    }
    if (this.staleTimer) {
      clearInterval(this.staleTimer)
      this.staleTimer = null
    }
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
  }

  isOpen(): boolean {
    return this.ws?.readyState === WebSocket.OPEN
  }

  async sendRPC(command: string, args: unknown, signal?: AbortSignal): Promise<RpcResponse> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('Bridge not connected')
    }
    const id = randomUUID()
    return new Promise<RpcResponse>((resolve, reject) => {
      // Aborts always reject — they don't depend on the pending map
      // existing. We capture `aborted` into a single helper so the
      // pre-flight check and the listener handler stay consistent.
      const abortNow = (): void => {
        if (signal && !signal.aborted) signal.removeEventListener('abort', onAbort)
        clearTimeout(timer)
        // Don't bother sending an abort envelope if the request never
        // went out — the bridge never saw it.
        if (requestSent) {
          try {
            this.ws?.send(JSON.stringify({ type: 'abort', id } satisfies RPCEnvelope))
          } catch {
            // socket is dying — close handler will reject the rest
          }
        }
        reject(new Error('RPC aborted by caller'))
      }

      const timer = setTimeout(() => {
        if (signal) signal.removeEventListener('abort', onAbort)
        this.pending.delete(id)
        reject(new Error(`Bridge RPC timeout (${BRIDGE_RPC_TIMEOUT_MS / 1000}s)`))
      }, BRIDGE_RPC_TIMEOUT_MS)

      const onAbort = () => abortNow()

      let requestSent = false

      if (signal) {
        if (signal.aborted) {
          abortNow()
          return
        }
        signal.addEventListener('abort', onAbort, { once: true })
      }

      this.pending.set(id, {
        resolve: (value) => {
          if (signal) signal.removeEventListener('abort', onAbort)
          clearTimeout(timer)
          resolve(value)
        },
        reject: (error) => {
          if (signal) signal.removeEventListener('abort', onAbort)
          clearTimeout(timer)
          reject(error)
        },
        timer
      })
      try {
        this.ws!.send(
          JSON.stringify({ type: 'request', id, command, args } satisfies RPCEnvelope)
        )
        requestSent = true
      } catch (e) {
        this.pending.delete(id)
        clearTimeout(timer)
        if (signal) signal.removeEventListener('abort', onAbort)
        reject(e instanceof Error ? e : new Error(String(e)))
      }
    })
  }

  disconnect(): void {
    this.explicitClose = true
    this.clearHeartbeat()
    this.clearReconnectTimer()
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

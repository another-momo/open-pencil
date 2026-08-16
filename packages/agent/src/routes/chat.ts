import type { Context, MiddlewareHandler } from 'hono'
import { Hono } from 'hono'
import { ToolLoopAgent } from 'ai'
import type { UIMessage } from 'ai'

import { readDiscoveryFile } from '@open-pencil/mcp/discovery'

import { FrontendBridge } from '../bridge/ws-client.js'
import { createAgent } from '../agent-loop.js'
import type { ChatMode } from '../agent-loop.js'
import { consumeCredentialAsync } from '../credentials.js'
import type { LibrarySnapshot } from '../prompts/index.js'

/**
 * Per-process bridge cache. The frontend automation server stays running
 * for the lifetime of the OpenPencil editor; one connection per agent
 * process is enough — the bridge multiplexes tool RPCs over a single
 * authenticated WebSocket.
 */
let bridge: FrontendBridge | null = null
let bridgePromise: Promise<FrontendBridge> | null = null

async function getBridge(): Promise<FrontendBridge> {
  if (bridge?.isOpen()) return bridge
  if (bridgePromise) return bridgePromise
  bridgePromise = (async () => {
    const info = await readDiscoveryFile()
    if (!info) {
      throw new Error(
        'OpenPencil editor is not running. Start `bun run dev` (or `bun run tauri dev`) ' +
          'before chatting through the agent backend.'
      )
    }
    const next = new FrontendBridge()
    // When the bridge detects a half-dead socket (N consecutive missed
    // pongs from the frontend), it emits `'stale'` and auto-terminates
    // to trigger reconnect. From the route layer we want the next chat
    // request to wait for the reconnect rather than reusing a stale
    // cached handle — drop the cache so `bridge?.isOpen()` falls through
    // to a fresh `connect()` next time around.
    next.once('stale', () => {
      if (bridge === next) bridge = null
    })
    await next.connect({
      socketPath: info.socketPath,
      httpPort: info.httpPort,
      authToken: info.authToken
    })
    bridge = next
    return next
  })()
  try {
    return await bridgePromise
  } finally {
    bridgePromise = null
  }
}

/**
 * Tear down the bridge on shutdown. Called from `server.ts#closeAll` so
 * the WebSocket disconnects cleanly before the process exits.
 */
export function disposeBridge(): void {
  bridge?.disconnect()
  bridge = null
}

type ChatRequestBody = {
  id: string
  messages: UIMessage[]
  trigger?: 'submit-message' | 'regenerate-message'
  // Agent config — shipped by the frontend HttpChatTransport extension
  // via prepareSendMessagesRequest. NOT part of the SDK standard body.
  agent?: {
    connectionId: string
    providerID: string
    modelID: string
    customModelID: string
    customBaseURL: string
    customAPIType: 'completions' | 'responses'
    maxOutputTokens: number
    chatMode: ChatMode
    lookImagesKept: number
  }
}

function decodeLibrarySnapshot(value: unknown): LibrarySnapshot {
  if (!value || typeof value !== 'object') return null
  // Already structured JSON from the request body. Validate basic shape
  // before handing off — the agent-loop treats this as the canonical
  // library snapshot, so a missing/empty object should fail closed.
  const candidate = value as Partial<NonNullable<LibrarySnapshot>>
  if (!Array.isArray(candidate.types) || !Array.isArray(candidate.profiles)) return null
  return value as LibrarySnapshot
}

function requireAgent(body: ChatRequestBody): NonNullable<ChatRequestBody['agent']> {
  if (!body.agent) {
    throw new Error('Missing agent config in request body')
  }
  return body.agent
}

const chatHandler: MiddlewareHandler = async (c) => {
  const requestSignal = c.req.raw.signal

  let body: ChatRequestBody
  try {
    body = (await c.req.json()) as ChatRequestBody
  } catch (e) {
    return c.json(
      { error: 'Invalid JSON body', detail: e instanceof Error ? e.message : String(e) },
      400
    )
  }

  if (!body?.messages || !Array.isArray(body.messages)) {
    return c.json({ error: 'messages[] is required' }, 400)
  }
  if (!body.id) {
    return c.json({ error: 'id is required' }, 400)
  }

  let agent: ToolLoopAgent
  try {
    const agentConfig = requireAgent(body)
    const librarySnapshot = decodeLibrarySnapshot(body.librarySnapshot)
    const bridgeInstance = await getBridge()
    if (!(await consumeCredentialAsync(agentConfig.connectionId))) {
      return c.json({ error: 'API key not available — POST /v1/auth first' }, 500)
    }
    agent = createAgent({
      connectionId: agentConfig.connectionId,
      providerID: agentConfig.providerID as Parameters<typeof createAgent>[0]['providerID'],
      modelID: agentConfig.modelID,
      customModelID: agentConfig.customModelID,
      customBaseURL: agentConfig.customBaseURL,
      customAPIType: agentConfig.customAPIType,
      maxOutputTokens: agentConfig.maxOutputTokens,
      chatMode: agentConfig.chatMode,
      lookImagesKept: agentConfig.lookImagesKept,
      librarySnapshot,
      bridge: bridgeInstance
    })
  } catch (e) {
    return c.json(
      { error: e instanceof Error ? e.message : String(e) },
      e instanceof Error && e.message.includes('not running') ? 503 : 500
    )
  }

  const result = await agent.stream({
    messages: body.messages,
    abortSignal: requestSignal
  })

  return result.toUIMessageStreamResponse({
    onError: (err) => (err instanceof Error ? err.message : String(err))
  })
}

export function chatRoute(): Hono {
  const app = new Hono()
  app.post('/', chatHandler)
  return app
}

// Suppress unused imports in environments that strict-fail on TS.
export type { Context }
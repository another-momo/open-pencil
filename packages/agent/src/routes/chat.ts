import type { Context, MiddlewareHandler } from 'hono'
import { Hono } from 'hono'
import { ToolLoopAgent } from 'ai'
import type { UIMessage } from 'ai'

import { readDiscoveryFile } from '@open-pencil/mcp/discovery'

import type { BrandRepository } from '../brand/index.js'
import { FrontendBridge } from '../bridge/ws-client.js'
import { createAgent } from '../agent-loop.js'
import type { ChatMode } from '../agent-loop.js'
import { consumeCredentialAsync } from '../credentials.js'
import type { BrandSelection } from '../prompts/index.js'

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
  // Brand selection — marketing mode only; decoded by decodeBrandSelection.
  brandSelection?: unknown
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

function decodeBrandSelection(value: unknown): BrandSelection | null {
  if (!value || typeof value !== 'object') return null
  // P3: the frontend only ships pickedProfileId — types and profiles
  // live in the agent's BrandRepository.
  const candidate = value as Record<string, unknown>
  const pickedRaw = candidate.pickedProfileId
  const pickedProfileId = typeof pickedRaw === 'string' ? pickedRaw : null
  return { pickedProfileId }
}

function requireAgent(body: ChatRequestBody): NonNullable<ChatRequestBody['agent']> {
  if (!body.agent) {
    throw new Error('Missing agent config in request body')
  }
  return body.agent
}

const chatHandler = (c: Context, deps: ChatRouteDeps): ReturnType<MiddlewareHandler> =>
  (async () => {
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
    const brandSelection = decodeBrandSelection(body.brandSelection)
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
      brandSelection,
      brandRepository: deps.brandRepository,
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
})()

export interface ChatRouteDeps {
  brandRepository: BrandRepository
}

export function chatRoute(deps: ChatRouteDeps): Hono {
  const app = new Hono()
  app.post('/', (c) => chatHandler(c, deps))
  return app
}

// Suppress unused imports in environments that strict-fail on TS.
export type { Context }
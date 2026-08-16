import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'

import { agentHost, agentPort, AGENT_VERSION } from './constants.js'
import { activeConnectionCountAsync } from './credentials.js'
import { writeAgentDiscovery, removeAgentDiscovery } from './discovery.js'
import { authRoute } from './routes/auth.js'
import { catalogRoute } from './routes/catalog.js'
import { chatRoute, disposeBridge } from './routes/chat.js'
import { healthRoute } from './routes/health.js'

export type ServerHandle = {
  app: Hono
  close: () => Promise<void>
}

/**
 * Comma-separated list of allowed CORS origins for cross-origin browser
 * callers (the OpenPencil dev server at :1420 and the production web app).
 * Override via `OPENPENCIL_AGENT_CORS_ORIGINS` env var. When unset we
 * default to the Vite dev server origin so a fresh `bun run dev` works
 * without extra configuration. Pass an empty value (or `none`) to lock
 * the server down to same-origin only (e.g. for production deployments
 * behind a reverse proxy that already handles CORS).
 */
const DEFAULT_CORS_ORIGINS = ['http://localhost:1420', 'http://127.0.0.1:1420']

function readCorsOrigins(): string[] {
  const raw = process.env.OPENPENCIL_AGENT_CORS_ORIGINS?.trim()
  if (raw === 'none' || raw === '') return []
  if (!raw) return DEFAULT_CORS_ORIGINS
  return raw
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0)
}

export async function createAgentServer(): Promise<ServerHandle> {
  const app = new Hono()

  const corsOrigins = readCorsOrigins()
  if (corsOrigins.length > 0) {
    // Allow common local dev hosts plus whatever the operator whitelisted.
    // SSE needs explicit Access-Control-Allow-Headers / exposed headers.
    app.use(
      '*',
      cors({
        origin: (origin) => (corsOrigins.includes(origin) ? origin : corsOrigins[0]),
        allowMethods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
        allowHeaders: ['Content-Type', 'x-op-connection-id', 'x-op-chat-id', 'x-op-library-snapshot'],
        exposeHeaders: [],
        credentials: false,
        maxAge: 600
      })
    )
  }

  app.route('/health', healthRoute())
  app.route('/v1/auth', authRoute())
  app.route('/v1/catalog', catalogRoute())
  app.route('/v1/chat', chatRoute())

  app.get('/', async (c) =>
    c.json({
      name: 'openpencil-agent',
      description: 'Local agent backend for the OpenPencil web editor',
      version: AGENT_VERSION,
      activeConnections: await activeConnectionCountAsync()
    })
  )

  return {
    app,
    close: async () => {
      // placeholder — the runtime shutdown lives in start.ts
    }
  }
}

let runtimeHandle: { close: () => Promise<void> } | null = null

export async function startServer(): Promise<void> {
  const { app, close } = await createAgentServer()
  const port = agentPort()
  const host = agentHost()
  const version = process.env.OPENPENCIL_AGENT_VERSION ?? AGENT_VERSION

  const nodeServer = serve({ fetch: app.fetch, port, hostname: host })

  const closeAll = async () => {
    if (runtimeHandle) return
    runtimeHandle = { close: async () => undefined }
    // Tear down the editor bridge first so any in-flight RPC aborts
    // cleanly, then stop accepting new HTTP requests before removing
    // the discovery file (otherwise a client racing shutdown could read
    // stale metadata and fail to connect).
    disposeBridge()
    await close()
    await new Promise<void>((resolve) => nodeServer.close(() => resolve()))
    await removeAgentDiscovery()
    process.exit(0)
  }

  process.on('SIGINT', closeAll)
  process.on('SIGTERM', closeAll)

  await writeAgentDiscovery({
    pid: process.pid,
    httpPort: port,
    version,
    startedAt: new Date().toISOString()
  })

  const corsOrigins = readCorsOrigins()
  const corsNote =
    corsOrigins.length > 0 ? ` CORS=${corsOrigins.join(',')}` : ' CORS=disabled (same-origin only)'

  // eslint-disable-next-line no-console
  console.log(
    `[openpencil-agent] listening on http://${host}:${port} (pid ${process.pid}, version ${version})${corsNote}`
  )
}
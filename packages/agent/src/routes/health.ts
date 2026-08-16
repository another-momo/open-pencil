import { Hono } from 'hono'

import { activeConnectionCount } from '../credentials.js'
import { AGENT_VERSION } from '../constants.js'

export function healthRoute(): Hono {
  const app = new Hono()

  app.get('/', (c) =>
    c.json({
      status: 'ok',
      version: process.env.OPENPENCIL_AGENT_VERSION ?? AGENT_VERSION,
      activeConnections: activeConnectionCount()
    })
  )

  return app
}
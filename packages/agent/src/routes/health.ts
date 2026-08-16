import { Hono } from 'hono'

import { activeConnectionCountAsync } from '../credentials.js'
import { AGENT_VERSION } from '../constants.js'

export function healthRoute(): Hono {
  const app = new Hono()

  app.get('/', async (c) =>
    c.json({
      status: 'ok',
      version: process.env.OPENPENCIL_AGENT_VERSION ?? AGENT_VERSION,
      activeConnections: await activeConnectionCountAsync()
    })
  )

  return app
}
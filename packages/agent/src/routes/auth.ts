import { Hono } from 'hono'

import { forgetCredential, putCredential } from '../credentials.js'

export function authRoute(): Hono {
  const app = new Hono()

  app.post('/', async (c) => {
    let body: unknown
    try {
      body = await c.req.json()
    } catch {
      return c.json({ error: 'Invalid JSON body' }, 400)
    }
    if (!body || typeof body !== 'object') {
      return c.json({ error: 'Body must be an object' }, 400)
    }
    const { connectionId, apiKey } = body as { connectionId?: unknown; apiKey?: unknown }
    if (typeof connectionId !== 'string' || !connectionId) {
      return c.json({ error: 'Missing connectionId' }, 400)
    }
    if (typeof apiKey !== 'string') {
      return c.json({ error: 'Missing apiKey' }, 400)
    }
    const { expiresIn } = putCredential(connectionId, apiKey)
    return c.json({ ok: true, expiresIn })
  })

  app.delete('/:connectionId', (c) => {
    forgetCredential(c.req.param('connectionId'))
    return c.json({ ok: true })
  })

  return app
}
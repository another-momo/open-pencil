import { Hono } from 'hono'

import { resolveModelsDevModel } from '../catalog.js'

export function catalogRoute(): Hono {
  const app = new Hono()

  app.get('/resolve', async (c) => {
    const providerID = c.req.query('providerID')
    const modelID = c.req.query('modelID')
    if (!providerID || !modelID) {
      return c.json({ error: 'providerID and modelID are required' }, 400)
    }
    const option = await resolveModelsDevModel(
      providerID as Parameters<typeof resolveModelsDevModel>[0],
      modelID
    )
    return c.json({ option })
  })

  return app
}
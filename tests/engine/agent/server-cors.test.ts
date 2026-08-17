import { afterEach, describe, expect, test } from 'bun:test'

import { createAgentServer } from '#agent/server'

const originalEnv = process.env.OPENPENCIL_AGENT_CORS_ORIGINS

afterEach(() => {
  if (originalEnv === undefined) delete process.env.OPENPENCIL_AGENT_CORS_ORIGINS
  else process.env.OPENPENCIL_AGENT_CORS_ORIGINS = originalEnv
})

async function preflight(
  app: Awaited<ReturnType<typeof createAgentServer>>['app'],
  origin: string
) {
  const request = new Request('http://localhost/v1/chat', {
    method: 'OPTIONS',
    headers: {
      origin,
      'access-control-request-method': 'POST',
      'access-control-request-headers': 'content-type, x-op-connection-id'
    }
  })
  return app.fetch(request)
}

describe('CORS middleware (default origins)', () => {
  test('reflects the Vite dev server origin', async () => {
    delete process.env.OPENPENCIL_AGENT_CORS_ORIGINS
    const { app } = await createAgentServer()
    const response = await preflight(app, 'http://localhost:1420')
    expect(response.status).toBe(204)
    expect(response.headers.get('access-control-allow-origin')).toBe('http://localhost:1420')
    expect(response.headers.get('access-control-allow-methods')).toContain('POST')
    expect(response.headers.get('access-control-allow-headers')).toContain('x-op-connection-id')
  })

  test('reflects the 127.0.0.1 dev server origin (alternate host header)', async () => {
    delete process.env.OPENPENCIL_AGENT_CORS_ORIGINS
    const { app } = await createAgentServer()
    const response = await preflight(app, 'http://127.0.0.1:1420')
    expect(response.headers.get('access-control-allow-origin')).toBe('http://127.0.0.1:1420')
  })
})

describe('CORS middleware (custom origins)', () => {
  test('accepts a single custom origin', async () => {
    process.env.OPENPENCIL_AGENT_CORS_ORIGINS = 'https://app.example.com'
    const { app } = await createAgentServer()
    const response = await preflight(app, 'https://app.example.com')
    expect(response.status).toBe(204)
    expect(response.headers.get('access-control-allow-origin')).toBe('https://app.example.com')
  })

  test('accepts a comma-separated list', async () => {
    process.env.OPENPENCIL_AGENT_CORS_ORIGINS = 'https://a.example.com, https://b.example.com'
    const { app } = await createAgentServer()
    const responseA = await preflight(app, 'https://a.example.com')
    const responseB = await preflight(app, 'https://b.example.com')
    expect(responseA.headers.get('access-control-allow-origin')).toBe('https://a.example.com')
    expect(responseB.headers.get('access-control-allow-origin')).toBe('https://b.example.com')
  })
})

describe('CORS middleware (disabled)', () => {
  test('returns 404 when OPENPENCIL_AGENT_CORS_ORIGINS=none and preflight fires', async () => {
    // With CORS disabled, the middleware is not mounted, so OPTIONS hits the
    // route table directly. /v1/chat has no OPTIONS handler → 404. This is
    // the expected behavior for same-origin-only deployments.
    process.env.OPENPENCIL_AGENT_CORS_ORIGINS = 'none'
    const { app } = await createAgentServer()
    const response = await preflight(app, 'http://localhost:1420')
    expect(response.status).toBe(404)
    expect(response.headers.get('access-control-allow-origin')).toBeNull()
  })

  test('returns 404 when OPENPENCIL_AGENT_CORS_ORIGINS is the empty string', async () => {
    process.env.OPENPENCIL_AGENT_CORS_ORIGINS = ''
    const { app } = await createAgentServer()
    const response = await preflight(app, 'http://localhost:1420')
    expect(response.status).toBe(404)
  })
})

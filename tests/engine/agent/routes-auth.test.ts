import { afterEach, describe, expect, test } from 'bun:test'

import { authRoute } from '#agent/routes/auth'
import {
  activeConnectionCount,
  consumeCredential,
  forgetCredential
} from '#agent/credentials'

const app = authRoute()

async function sendJson(
  path: string,
  init: { method?: string; body?: unknown; headers?: Record<string, string> } = {}
) {
  const request = new Request(`http://localhost${path}`, {
    method: init.method ?? 'POST',
    headers: { 'content-type': 'application/json', ...(init.headers ?? {}) },
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined
  })
  return app.fetch(request)
}

describe('authRoute POST /', () => {
  afterEach(() => {
    for (const id of ['conn-X', 'conn-Y']) forgetCredential(id)
  })

  test('returns 400 for invalid JSON body', async () => {
    const request = new Request('http://localhost/', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: 'not-json'
    })
    const response = await app.fetch(request)
    expect(response.status).toBe(400)
    const body = (await response.json()) as { error: string }
    expect(body.error).toMatch(/Invalid JSON body/)
  })

  test('returns 400 when body is not an object', async () => {
    const response = await sendJson('/', { body: 'a string' })
    expect(response.status).toBe(400)
    const body = (await response.json()) as { error: string }
    expect(body.error).toMatch(/Body must be an object/)
  })

  test('returns 400 when connectionId is missing', async () => {
    const response = await sendJson('/', { body: { apiKey: 'sk-test' } })
    expect(response.status).toBe(400)
    const body = (await response.json()) as { error: string }
    expect(body.error).toMatch(/Missing connectionId/)
  })

  test('returns 400 when apiKey is missing or non-string', async () => {
    const response = await sendJson('/', { body: { connectionId: 'conn-X' } })
    expect(response.status).toBe(400)
    const body = (await response.json()) as { error: string }
    expect(body.error).toMatch(/Missing apiKey/)
  })

  test('returns 400 when apiKey is not a string', async () => {
    const response = await sendJson('/', {
      body: { connectionId: 'conn-X', apiKey: 123 }
    })
    expect(response.status).toBe(400)
    const body = (await response.json()) as { error: string }
    expect(body.error).toMatch(/Missing apiKey/)
  })

  test('stores the credential and returns ok + expiresIn', async () => {
    expect(consumeCredential('conn-X')).toBeNull()
    const response = await sendJson('/', {
      body: { connectionId: 'conn-X', apiKey: 'sk-secret' }
    })
    expect(response.status).toBe(200)
    const body = (await response.json()) as { ok: boolean; expiresIn: number }
    expect(body.ok).toBe(true)
    expect(body.expiresIn).toBe(3600)
    expect(consumeCredential('conn-X')).toBe('sk-secret')
  })

  test('republishing overwrites the previous credential', async () => {
    await sendJson('/', { body: { connectionId: 'conn-X', apiKey: 'sk-old' } })
    await sendJson('/', { body: { connectionId: 'conn-X', apiKey: 'sk-new' } })
    expect(consumeCredential('conn-X')).toBe('sk-new')
    expect(activeConnectionCount()).toBe(1)
  })
})

describe('authRoute DELETE /:connectionId', () => {
  afterEach(() => {
    for (const id of ['conn-Y']) forgetCredential(id)
  })

  test('removes the entry and returns ok', async () => {
    await sendJson('/', { body: { connectionId: 'conn-Y', apiKey: 'sk-secret' } })
    expect(consumeCredential('conn-Y')).toBe('sk-secret')

    const response = await app.fetch(
      new Request('http://localhost/conn-Y', { method: 'DELETE' })
    )
    expect(response.status).toBe(200)
    const body = (await response.json()) as { ok: boolean }
    expect(body.ok).toBe(true)
    expect(consumeCredential('conn-Y')).toBeNull()
  })

  test('is a no-op for unknown connectionIds', async () => {
    const response = await app.fetch(
      new Request('http://localhost/conn-NEVER-EXISTED', { method: 'DELETE' })
    )
    expect(response.status).toBe(200)
    const body = (await response.json()) as { ok: boolean }
    expect(body.ok).toBe(true)
  })
})

/**
 * /v1/brand/* Hono route tests. Uses a Hono `app.request` invocation
 * (no live HTTP server needed). The repository is wired in-process so
 * each test owns its own SQLite DB and brand config.
 */

import { describe, expect, test } from 'bun:test'

import { openBrandRepository, type BrandConfig } from '#agent/brand/index.js'
import { brandRoute } from '#agent/routes/brand.js'

const SAMPLE: BrandConfig = {
  schema_version: 1,
  name: 'Acme',
  types: [{ id: 'wechat_moments', label: '朋友圈', size: '1080x1080' }],
  profiles: [
    { id: 'casual_v1', label: '休闲', applicable_to: ['wechat_moments'], markdown: '# 休闲' }
  ]
}

function makeApp() {
  const repo = openBrandRepository({ path: ':memory:', seed: SAMPLE })
  const app = brandRoute({ repo })
  return { app, repo }
}

async function req(
  app: ReturnType<typeof brandRoute>,
  path: string,
  init: { method?: string; body?: BodyInit | null; headers?: Record<string, string> } = {}
) {
  return app.request(path, {
    method: init.method ?? 'GET',
    ...(init.body !== undefined ? { body: init.body } : {}),
    ...(init.headers ? { headers: init.headers } : {})
  })
}

describe('GET /v1/brand/manifest', () => {
  test('returns the effective config seeded with defaults', async () => {
    const { app, repo } = makeApp()
    const res = await req(app, '/manifest')
    expect(res.status).toBe(200)
    const body = (await res.json()) as { types: { id: string }[]; profiles: { id: string }[] }
    expect(body.types.map((entry) => entry.id)).toContain('wechat_moments')
    expect(body.profiles.map((entry) => entry.id)).toContain('casual_v1')
    repo.close()
  })
})

describe('PUT /v1/brand/types/:id', () => {
  test('upserts a user type', async () => {
    const { app, repo } = makeApp()
    const res = await req(app, '/types/wechat_moments', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label: '朋友圈（自定义）', size: '1080x1080' })
    })
    expect(res.status).toBe(200)
    repo.close()
  })

  test('rejects an invalid id', async () => {
    const { app, repo } = makeApp()
    const res = await req(app, '/types/has%20space', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label: 'x', size: '100x100' })
    })
    expect(res.status).toBe(400)
    repo.close()
  })

  test('rejects a malformed size', async () => {
    const { app, repo } = makeApp()
    const res = await req(app, '/types/wechat_moments', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label: '朋友圈', size: 'not-a-size' })
    })
    expect(res.status).toBe(400)
    repo.close()
  })
})

describe('DELETE /v1/brand/types/:id', () => {
  test('removes the user override and falls back to default', async () => {
    const { app, repo } = makeApp()
    await req(app, '/types/wechat_moments', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label: 'override', size: '1080x1080' })
    })
    const res = await req(app, '/types/wechat_moments', { method: 'DELETE' })
    expect(res.status).toBe(200)
    repo.close()
  })

  test('returns 404 for an unknown id', async () => {
    const { app, repo } = makeApp()
    const res = await req(app, '/types/no_such_id', { method: 'DELETE' })
    expect(res.status).toBe(404)
    repo.close()
  })

  test('returns 409 when the id has no user override (default only)', async () => {
    const { app, repo } = makeApp()
    const res = await req(app, '/types/wechat_moments', { method: 'DELETE' })
    expect(res.status).toBe(409)
    repo.close()
  })
})

describe('POST /v1/brand/reset', () => {
  test('clears the user layer', async () => {
    const { app, repo } = makeApp()
    await req(app, '/types/wechat_moments', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label: 'override', size: '1080x1080' })
    })
    const res = await req(app, '/reset', { method: 'POST' })
    expect(res.status).toBe(200)
    repo.close()
  })
})

describe('GET /v1/brand/export', () => {
  test('returns the merged config as YAML', async () => {
    const { app, repo } = makeApp()
    const res = await req(app, '/export')
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('yaml')
    const text = await res.text()
    expect(text).toContain('schema_version: 1')
    expect(text).toContain('wechat_moments')
    repo.close()
  })
})

describe('POST /v1/brand/import', () => {
  test('replaces the user layer from a valid payload', async () => {
    const { app, repo } = makeApp()
    const yaml = `schema_version: 1
name: Imported
types:
  - id: xhs
    label: 小红书
    size: 1080x1440
profiles: []
`
    const res = await req(app, '/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/yaml' },
      body: yaml
    })
    expect(res.status).toBe(200)
    repo.close()
  })

  test('rejects an invalid payload with 400 + issues', async () => {
    const { app, repo } = makeApp()
    const res = await req(app, '/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/yaml' },
      body: 'schema_version: 99'
    })
    expect(res.status).toBe(400)
    const body = (await res.json()) as { error: { code: string; detail?: unknown } }
    expect(body.error.code).toBe('invalid_yaml')
    repo.close()
  })
})

describe('PUT /v1/brand/profiles/:id', () => {
  test('upserts a user profile', async () => {
    const { app, repo } = makeApp()
    const res = await req(app, '/profiles/casual_v1', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        label: '休闲（自定义）',
        applicable_to: ['wechat_moments'],
        markdown: '# 自定义'
      })
    })
    expect(res.status).toBe(200)
    const body = (await res.json()) as { profile: { id: string; layer: string } }
    expect(body.profile.id).toBe('casual_v1')
    expect(body.profile.layer).toBe('user')
    repo.close()
  })

  test('creates a brand-new profile id', async () => {
    const { app, repo } = makeApp()
    const res = await req(app, '/profiles/brand_new', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label: '新风格', applicable_to: [], markdown: '# 新' })
    })
    expect(res.status).toBe(200)
    const profiles = repo.effectiveProfiles().map((entry) => entry.id)
    expect(profiles).toContain('brand_new')
    repo.close()
  })

  test('rejects an empty markdown', async () => {
    const { app, repo } = makeApp()
    const res = await req(app, '/profiles/casual_v1', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label: 'x', applicable_to: [], markdown: '' })
    })
    expect(res.status).toBe(400)
    repo.close()
  })

  test('rejects a non-array applicable_to', async () => {
    const { app, repo } = makeApp()
    const res = await req(app, '/profiles/casual_v1', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label: 'x', applicable_to: 'wechat_moments', markdown: '# x' })
    })
    expect(res.status).toBe(400)
    repo.close()
  })
})

describe('DELETE /v1/brand/profiles/:id', () => {
  test('removes the user override and falls back to default', async () => {
    const { app, repo } = makeApp()
    await req(app, '/profiles/casual_v1', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label: 'override', applicable_to: [], markdown: '# o' })
    })
    const res = await req(app, '/profiles/casual_v1', { method: 'DELETE' })
    expect(res.status).toBe(200)
    const profile = repo.effectiveProfiles().find((entry) => entry.id === 'casual_v1')
    expect(profile?.layer).toBe('default')
    repo.close()
  })

  test('returns 404 for an unknown id', async () => {
    const { app, repo } = makeApp()
    const res = await req(app, '/profiles/no_such_id', { method: 'DELETE' })
    expect(res.status).toBe(404)
    repo.close()
  })

  test('returns 409 when the id has no user override (default only)', async () => {
    const { app, repo } = makeApp()
    const res = await req(app, '/profiles/casual_v1', { method: 'DELETE' })
    expect(res.status).toBe(409)
    repo.close()
  })
})

describe('GET /v1/brand/metadata', () => {
  test('returns seed version + db path + counts', async () => {
    const { app, repo } = makeApp()
    const res = await req(app, '/metadata')
    expect(res.status).toBe(200)
    const body = (await res.json()) as {
      seed_version: string
      db_path: string
      counts: { defaultTypes: number }
    }
    expect(body.seed_version).toBe('3')
    expect(body.db_path).toBe(':memory:')
    expect(body.counts.defaultTypes).toBeGreaterThanOrEqual(1)
    repo.close()
  })
})
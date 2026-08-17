/**
 * End-to-end smoke for the brand config flow: seed → manifest → upsert →
 * import/export → reset. Exercises the BrandRepository + the Hono route
 * together, without touching the filesystem DB or the frontend.
 */

import { describe, expect, test } from 'bun:test'

import {
  openBrandRepository,
  parseBrandYaml,
  stringifyBrandYaml,
  type BrandConfig
} from '#agent/brand/index.js'
import { brandRoute } from '#agent/routes/brand.js'

const FACTORY: BrandConfig = {
  schema_version: 1,
  name: 'Factory',
  types: [{ id: 'wechat_moments', label: '朋友圈', size: '1080x1080' }],
  profiles: []
}

async function call(app: ReturnType<typeof brandRoute>, path: string, init: RequestInit = {}) {
  const res = await app.request(path, {
    method: init.method ?? 'GET',
    ...(init.body !== undefined ? { body: init.body } : {}),
    ...(init.headers ? { headers: init.headers } : {})
  })
  return res
}

describe('brand config e2e smoke', () => {
  test('full CRUD roundtrip via HTTP', async () => {
    const repo = openBrandRepository({ path: ':memory:', seed: FACTORY })
    const app = brandRoute({ repo })

    // 1. Read manifest — should expose the factory type
    const manifest = await call(app, '/manifest')
    expect(manifest.status).toBe(200)
    const initial = (await manifest.json()) as EffectiveBrandConfig
    expect(initial.types).toHaveLength(1)
    expect(initial.types[0]?.layer).toBe('default')

    // 2. Upsert a user override
    const put = await call(app, '/types/wechat_moments', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label: '朋友圈（用户版）', size: '1080x1080' })
    })
    expect(put.status).toBe(200)

    // 3. Read manifest again — the override should be visible
    const manifestAfter = await call(app, '/manifest')
    const after = (await manifestAfter.json()) as EffectiveBrandConfig
    const overridden = after.types.find((entry) => entry.id === 'wechat_moments')
    expect(overridden?.layer).toBe('user')
    expect(overridden?.label).toBe('朋友圈（用户版）')

    // 4. Add a brand-new type
    const newType = await call(app, '/types/event_poster', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label: '活动海报', size: '1080x1920' })
    })
    expect(newType.status).toBe(200)

    // 5. Export merged YAML — should round-trip cleanly
    const exportRes = await call(app, '/export')
    expect(exportRes.status).toBe(200)
    const yaml = await exportRes.text()
    expect(yaml).toContain('wechat_moments')
    expect(yaml).toContain('event_poster')
    const parsed = parseBrandYaml(yaml)
    if (!parsed.ok) {
      console.error('Export YAML round-trip failed:\n', yaml)
      console.error('Issues:', JSON.stringify(parsed.issues, null, 2))
    }
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) throw new Error('round-trip parse failed')

    // 6. Delete the brand-new type
    const delRes = await call(app, '/types/event_poster', { method: 'DELETE' })
    expect(delRes.status).toBe(200)

    // 7. Import a fresh user layer (replacing wechat_moments override)
    const imported: BrandConfig = {
      schema_version: 1,
      name: 'Imported',
      types: [{ id: 'xiaohongshu', label: '小红书', size: '1080x1440' }],
      profiles: [
        { id: 'casual_v1', label: '休闲', applicable_to: ['xiaohongshu'], markdown: '# 休闲' }
      ]
    }
    const importRes = await call(app, '/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/yaml' },
      body: stringifyBrandYaml(imported)
    })
    expect(importRes.status).toBe(200)

    // 8. After import, the wechat_moments user override is gone (default
    //    remains). xiaohongshu appears with the casual_v1 profile.
    const manifestAfterImport = (await (
      await call(app, '/manifest')
    ).json()) as EffectiveBrandConfig
    const wm = manifestAfterImport.types.find((entry) => entry.id === 'wechat_moments')
    expect(wm?.layer).toBe('default')
    expect(manifestAfterImport.profiles.find((entry) => entry.id === 'casual_v1')).toBeTruthy()

    // 9. Reset the user layer — only factory remains
    const reset = await call(app, '/reset', { method: 'POST' })
    expect(reset.status).toBe(200)
    const manifestAfterReset = (await (await call(app, '/manifest')).json()) as EffectiveBrandConfig
    expect(manifestAfterReset.types).toHaveLength(1)
    expect(manifestAfterReset.types[0]?.id).toBe('wechat_moments')
    expect(manifestAfterReset.profiles).toHaveLength(0)

    // 10. Metadata endpoint reflects the cleared state
    const meta = (await (await call(app, '/metadata')).json()) as {
      counts: { userTypes: number; userProfiles: number }
    }
    expect(meta.counts.userTypes).toBe(0)
    expect(meta.counts.userProfiles).toBe(0)

    repo.close()
  })
})

interface EffectiveBrandConfig {
  schema_version: 1
  name: string
  types: Array<{ id: string; layer: 'user' | 'default'; label: string; size: string }>
  profiles: Array<{ id: string; layer: 'user' | 'default' }>
}

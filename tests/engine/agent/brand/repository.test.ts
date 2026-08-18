/**
 * BrandRepository tests — covers seeding, user-layer CRUD, the
 * default-override-user merge, and the whole-file import path. The DB
 * uses `:memory:` so each test gets an isolated store; no filesystem
 * state leaks across cases.
 */

import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { openBrandRepository, type BrandConfig, type BrandRepository } from '#agent/brand/index.js'

const SAMPLE: BrandConfig = {
  schema_version: 1,
  name: 'Acme',
  types: [
    { id: 'wechat_moments', label: '朋友圈', size: '1080x1080', description: '微信朋友圈广告' },
    { id: 'product_long', label: '产品长图', size: '750x' }
  ],
  profiles: [
    {
      id: 'casual_v1',
      label: '休闲',
      applicable_to: ['wechat_moments'],
      markdown: '# 休闲'
    }
  ]
}

let repo: BrandRepository

beforeEach(() => {
  repo = openBrandRepository({ path: ':memory:', seed: SAMPLE })
})

afterEach(() => {
  repo.close()
})

describe('BrandRepository', () => {
  test('seeds defaults on first open', () => {
    const config = repo.effectiveConfig()
    expect(config.types).toHaveLength(2)
    expect(config.profiles).toHaveLength(1)
    expect(config.types[0]?.layer).toBe('default')
  })

  test('upsertUserType shadows the default with the same id', () => {
    repo.upsertUserType({
      id: 'wechat_moments',
      label: '朋友圈（自定义）',
      size: '1080x1080'
    })
    const merged = repo.effectiveTypes().filter((entry) => entry.id === 'wechat_moments')
    expect(merged).toHaveLength(1)
    expect(merged[0]?.layer).toBe('user')
    expect(merged[0]?.label).toBe('朋友圈（自定义）')
  })

  test('upsertUserProfile preserves applicable_to as JSON array', () => {
    repo.upsertUserProfile({
      id: 'casual_v1',
      label: '休闲 v2',
      applicable_to: ['wechat_moments', 'product_long'],
      markdown: '# Updated'
    })
    const profiles = repo.effectiveProfiles()
    const casual = profiles.find((entry) => entry.id === 'casual_v1')
    expect(casual?.applicable_to).toEqual(['wechat_moments', 'product_long'])
    expect(casual?.layer).toBe('user')
  })

  test('addUserType adds a brand-new id without touching defaults', () => {
    repo.upsertUserType({ id: 'wechat_video', label: '视频号', size: '1080x1920' })
    const types = repo.effectiveTypes()
    expect(types.map((entry) => entry.id)).toContain('wechat_video')
    expect(types.find((entry) => entry.id === 'wechat_video')?.layer).toBe('user')
  })

  test('deleteUserType falls back to default with the same id', () => {
    repo.upsertUserType({ id: 'wechat_moments', label: 'override', size: '1080x1080' })
    expect(repo.deleteUserType('wechat_moments')).toBe(true)
    const types = repo.effectiveTypes()
    const fallback = types.find((entry) => entry.id === 'wechat_moments')
    expect(fallback?.layer).toBe('default')
    expect(fallback?.label).toBe('朋友圈')
  })

  test('deleteUserProfile removes the user override and reports false for unknown ids', () => {
    repo.upsertUserProfile({
      id: 'casual_v1',
      label: 'override',
      applicable_to: [],
      markdown: '# x'
    })
    expect(repo.deleteUserProfile('casual_v1')).toBe(true)
    const fallback = repo.effectiveProfiles().find((entry) => entry.id === 'casual_v1')
    expect(fallback?.layer).toBe('default')
    expect(fallback?.label).toBe('休闲')
    expect(repo.deleteUserProfile('casual_v1')).toBe(false)
    expect(repo.deleteUserProfile('never_existed')).toBe(false)
  })

  test('resetUserLayer clears all user overrides but preserves defaults', () => {
    repo.upsertUserType({ id: 'wechat_moments', label: 'override', size: '1080x1080' })
    repo.upsertUserProfile({
      id: 'casual_v1',
      label: 'override',
      applicable_to: [],
      markdown: '# x'
    })
    repo.resetUserLayer()
    const counts = repo.counts()
    expect(counts.userTypes).toBe(0)
    expect(counts.userProfiles).toBe(0)
    expect(counts.defaultTypes).toBe(2)
    expect(counts.defaultProfiles).toBe(1)
  })

  test('importUserLayer replaces the user layer in a single transaction', () => {
    repo.upsertUserType({ id: 'wechat_moments', label: 'override', size: '1080x1080' })
    repo.importUserLayer({
      schema_version: 1,
      name: 'Imported',
      types: [{ id: 'wechat_video', label: '视频号', size: '1080x1920' }],
      profiles: [{ id: 'minimal_v1', label: '极简', applicable_to: [], markdown: '# 极简' }]
    })
    const config = repo.effectiveConfig()
    // default_* stays: wechat_moments + product_long (only user layer was replaced)
    expect(config.types.map((entry) => entry.id).sort()).toEqual([
      'product_long',
      'wechat_moments',
      'wechat_video'
    ])
    expect(config.profiles.map((entry) => entry.id).sort()).toEqual(['casual_v1', 'minimal_v1'])
  })

  test('size is round-tripped through HUG (Wx) form', () => {
    const types = repo.effectiveTypes()
    expect(types.find((entry) => entry.id === 'product_long')?.size).toBe('750x')
  })
})

/**
 * Reseed gating is content-hash based: editing the shipped preset markdown
 * must refresh existing databases without any manual version bump. These
 * cases need a real file DB (close + reopen), so they use a temp dir
 * instead of the shared `:memory:` store above.
 */
describe('BrandRepository reseed gating', () => {
  /** Same shape as FULL, but with stub markdown — the pre-fix preset state. */
  const STUB: BrandConfig = {
    ...SAMPLE,
    profiles: [
      { id: 'casual_v1', label: '休闲', applicable_to: ['wechat_moments'], markdown: '# stub' },
      { id: 'poster_v1', label: '海报', applicable_to: ['product_long'], markdown: '# poster stub' }
    ]
  }
  /** Identical ids/labels, but the markdown bodies were filled in. */
  const FULL: BrandConfig = {
    ...STUB,
    profiles: [
      {
        id: 'casual_v1',
        label: '休闲',
        applicable_to: ['wechat_moments'],
        markdown: '# 休闲\n\nFull style guide: colors, fonts, tone, layout.'
      },
      {
        id: 'poster_v1',
        label: '海报',
        applicable_to: ['product_long'],
        markdown: '# Poster\n\nFull poster style guide body.'
      }
    ]
  }

  function tempDbPath(): { dir: string; dbPath: string } {
    const dir = mkdtempSync(join(tmpdir(), 'openpencil-brand-test-'))
    return { dir, dbPath: join(dir, 'brand.db') }
  }

  /**
   * Remove the temp DB dir. On Windows the SQLite file stays locked while
   * any `Database` handle is reachable — even after `close()` — so each
   * test scopes repo usage inside an IIFE (letting the handles die before
   * cleanup runs) and we force a GC pass before unlinking.
   */
  function cleanup(dir: string): void {
    Bun.gc(true)
    rmSync(dir, { recursive: true, force: true })
  }

  test('reseeds defaults when the seed config content changes (no version bump)', () => {
    const { dir, dbPath } = tempDbPath()
    try {
      ;(() => {
        const first = openBrandRepository({ path: dbPath, seed: STUB })
        let stubHash: string | undefined
        try {
          expect(first.effectiveProfiles().find((p) => p.id === 'casual_v1')?.markdown).toBe('# stub')
          stubHash = first.metaValue('default_hash')
          expect(stubHash).toBeDefined()
        } finally {
          first.close()
        }

        const second = openBrandRepository({ path: dbPath, seed: FULL })
        try {
          const profiles = second.effectiveProfiles()
          expect(profiles.find((p) => p.id === 'casual_v1')?.markdown).toBe(
            '# 休闲\n\nFull style guide: colors, fonts, tone, layout.'
          )
          expect(profiles.find((p) => p.id === 'poster_v1')?.markdown).toBe(
            '# Poster\n\nFull poster style guide body.'
          )
          expect(profiles.every((p) => p.layer === 'default')).toBe(true)
          expect(second.metaValue('default_hash')).not.toBe(stubHash)
        } finally {
          second.close()
        }
      })()
    } finally {
      cleanup(dir)
    }
  })

  test('user-layer rows survive a content-change reseed', () => {
    const { dir, dbPath } = tempDbPath()
    try {
      ;(() => {
        const first = openBrandRepository({ path: dbPath, seed: STUB })
        try {
          first.upsertUserProfile({
            id: 'casual_v1',
            label: '我的休闲',
            applicable_to: ['wechat_moments'],
            markdown: '# mine'
          })
          first.upsertUserType({ id: 'wechat_moments', label: '我的朋友圈', size: '1080x1080' })
        } finally {
          first.close()
        }

        const second = openBrandRepository({ path: dbPath, seed: FULL })
        try {
          // User overrides are untouched and still shadow the refreshed defaults.
          const casual = second.effectiveProfiles().find((p) => p.id === 'casual_v1')
          expect(casual?.layer).toBe('user')
          expect(casual?.markdown).toBe('# mine')
          const moments = second.effectiveTypes().find((t) => t.id === 'wechat_moments')
          expect(moments?.layer).toBe('user')
          expect(moments?.label).toBe('我的朋友圈')
          // The non-shadowed default profile picked up the new markdown.
          const poster = second.effectiveProfiles().find((p) => p.id === 'poster_v1')
          expect(poster?.layer).toBe('default')
          expect(poster?.markdown).toBe('# Poster\n\nFull poster style guide body.')
          const counts = second.counts()
          expect(counts.userProfiles).toBe(1)
          expect(counts.userTypes).toBe(1)
        } finally {
          second.close()
        }
      })()
    } finally {
      cleanup(dir)
    }
  })

  test('reopening with an unchanged seed config is a no-op', () => {
    const { dir, dbPath } = tempDbPath()
    try {
      ;(() => {
        const first = openBrandRepository({ path: dbPath, seed: STUB })
        let beforeHash: string | undefined
        let beforeConfig: ReturnType<BrandRepository['effectiveConfig']>
        try {
          beforeHash = first.metaValue('default_hash')
          beforeConfig = first.effectiveConfig()
        } finally {
          first.close()
        }

        const second = openBrandRepository({ path: dbPath, seed: STUB })
        try {
          expect(second.metaValue('default_hash')).toBe(beforeHash)
          expect(second.effectiveConfig()).toEqual(beforeConfig)
        } finally {
          second.close()
        }
      })()
    } finally {
      cleanup(dir)
    }
  })
})

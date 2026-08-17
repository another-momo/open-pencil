/**
 * BrandRepository tests — covers seeding, user-layer CRUD, the
 * default-override-user merge, and the whole-file import path. The DB
 * uses `:memory:` so each test gets an isolated store; no filesystem
 * state leaks across cases.
 */

import { afterEach, beforeEach, describe, expect, test } from 'bun:test'

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

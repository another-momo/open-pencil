/**
 * Brand config YAML loader tests — covers parse, validation, and the
 * schema round-trip. Persisted tests for the SQLite-backed BrandRepository
 * will live alongside these in C4.
 */

import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { parseBrandYaml, parseYaml, stringifyBrandYaml, stringifyYaml } from '#agent/brand/index.js'

const SAMPLE = `schema_version: 1
name: Acme Brand
types:
  - id: wechat_moments
    label: 朋友圈广告
    size: 1080x1080
    description: 微信朋友圈信息流广告
  - id: product_long
    label: 产品长图
    size: 750x
profiles:
  - id: casual_v1
    label: 休闲活泼
    applicable_to: [wechat_moments, xiaohongshu]
    markdown: |
      # 休闲活泼风格
      - 主色: 暖橙
      - 字体: 思源黑体
`

describe('parseBrandYaml', () => {
  test('parses a well-formed sample', () => {
    const result = parseBrandYaml(SAMPLE)
    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error('expected ok')
    expect(result.config.name).toBe('Acme Brand')
    expect(result.config.types).toHaveLength(2)
    expect(result.config.types[0]?.size).toBe('1080x1080')
    expect(result.config.types[1]?.size).toBe('750x')
    expect(result.config.profiles).toHaveLength(1)
    expect(result.config.profiles[0]?.markdown).toContain('# 休闲活泼风格')
  })

  test('rejects unknown schema_version', () => {
    const result = parseBrandYaml('schema_version: 99\nname: x\ntypes: []\nprofiles: []\n')
    expect(result.ok).toBe(false)
    if (result.ok) throw new Error('expected fail')
    expect(result.issues[0]?.message).toMatch(/invalid|expected/i)
  })

  test('flags duplicate type ids', () => {
    const source = `schema_version: 1
name: Acme
types:
  - id: wechat_moments
    label: A
    size: 1080x1080
  - id: wechat_moments
    label: B
    size: 1080x1080
profiles: []
`
    const result = parseBrandYaml(source)
    expect(result.ok).toBe(false)
    if (result.ok) throw new Error('expected fail')
    expect(result.issues.some((issue) => issue.message.includes('duplicate type id'))).toBe(true)
  })

  test('flags malformed size string', () => {
    const source = `schema_version: 1
name: Acme
types:
  - id: bad
    label: B
    size: not-a-size
profiles: []
`
    const result = parseBrandYaml(source)
    expect(result.ok).toBe(false)
  })

  test('rejects unknown keys', () => {
    const source = `schema_version: 1
name: Acme
types: []
profiles: []
mystery: true
`
    const result = parseBrandYaml(source)
    expect(result.ok).toBe(false)
  })
})

describe('round-trip', () => {
  test('parse → stringify → parse returns identical config', () => {
    const first = parseBrandYaml(SAMPLE)
    expect(first.ok).toBe(true)
    if (!first.ok) throw new Error('expected ok')
    const emitted = stringifyBrandYaml(first.config)
    const second = parseBrandYaml(emitted)
    expect(second.ok).toBe(true)
    if (!second.ok) throw new Error('expected ok')
    expect(second.config).toEqual(first.config)
  })

  test('ships a valid default-brand/config.yaml', () => {
    const path = join(process.cwd(), 'public/default-brand/config.yaml')
    const source = readFileSync(path, 'utf8')
    const result = parseBrandYaml(source)
    if (!result.ok) {
      throw new Error(`default-brand/config.yaml invalid: ${JSON.stringify(result.issues)}`)
    }
    expect(result.config.types.length).toBeGreaterThanOrEqual(7)
    expect(result.config.profiles.length).toBeGreaterThanOrEqual(1)
  })
})

describe('parseYaml', () => {
  test('returns scalar at root', () => {
    expect(parseYaml('42')).toBe(42)
    expect(parseYaml('hello')).toBe('hello')
    expect(parseYaml('null')).toBeNull()
    expect(parseYaml('true')).toBe(true)
  })

  test('parses flow-style array as nested value', () => {
    const result = parseYaml('ids: [a, b, c]') as { ids: string[] }
    expect(result.ids).toEqual(['a', 'b', 'c'])
  })
})

describe('stringifyYaml', () => {
  test('emits canonical header', () => {
    const emitted = stringifyYaml({
      schema_version: 1,
      name: 'Acme',
      types: [],
      profiles: []
    })
    expect(emitted.split('\n')[0]).toBe('schema_version: 1')
    expect(emitted).toContain('name: Acme')
  })
})

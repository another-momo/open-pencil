/**
 * T54：generate_image requests 纯函数层钉扎（移植自源 image-gen/requests.ts）。
 * 验收锚（T54-plan §3.1）：尺寸/数量校验——16px 对齐、边长/纵横比/像素钳制、
 * 枚举校验与别名归一、references 形状、replace_id/id 别名。
 */
import { describe, expect, test } from 'bun:test'

import {
  normalizeDimensions,
  normalizeSize,
  parseImageGenRequests,
  parseReferences
} from '@open-pencil/core/tools/fork/image-gen/requests'

describe('normalizeDimensions', () => {
  test('16px 对齐', () => {
    // 1008x496 像素数低于下限 655360，保宽高比继续抬升至 1168x576
    expect(normalizeDimensions(1000, 500)).toEqual({ width: 1168, height: 576 })
    expect(normalizeDimensions(1024, 1024)).toEqual({ width: 1024, height: 1024 })
  })

  test('超长边钳到 3840（保宽高比）', () => {
    const result = normalizeDimensions(8000, 4000)
    expect(result.width).toBeLessThanOrEqual(3840)
    expect(result.width / result.height).toBeCloseTo(2, 1)
  })

  test('纵横比钳到 3:1', () => {
    const result = normalizeDimensions(3000, 200)
    expect(result.width / result.height).toBeLessThanOrEqual(3.01)
  })

  test('像素下限抬升（保宽高比）', () => {
    const result = normalizeDimensions(100, 100)
    expect(result.width * result.height).toBeGreaterThanOrEqual(655_360 - 4096)
    expect(result.width).toBe(result.height)
  })
})

describe('normalizeSize', () => {
  test('非法尺寸报错（0 / 负数 / 非有限）', () => {
    expect('error' in normalizeSize(0, 100)).toBe(true)
    expect('error' in normalizeSize(100, -5)).toBe(true)
    expect('error' in normalizeSize(Number.NaN, 100)).toBe(true)
  })

  test('未调整时 adjusted=false', () => {
    const result = normalizeSize(1024, 1024)
    if ('error' in result) throw new Error('unexpected')
    expect(result.adjusted).toBe(false)
  })
})

describe('parseImageGenRequests', () => {
  test('空数组拒绝', () => {
    const result = parseImageGenRequests('[]')
    expect('error' in result && result.error).toContain('Empty requests array')
  })

  test('非法 JSON 拒绝', () => {
    const result = parseImageGenRequests('[{"prompt":')
    expect('error' in result).toBe(true)
  })

  test('每条需要非空 prompt', () => {
    const result = parseImageGenRequests('[{"width":1024,"height":1024}]')
    expect('error' in result && result.error).toContain('prompt')
  })

  test('新图必须有数值 width/height（数量校验）', () => {
    const result = parseImageGenRequests('[{"prompt":"hero"}]')
    expect('error' in result && result.error).toContain('width')
  })

  test('带 replace_id 可省略尺寸（从目标节点读取）', () => {
    const result = parseImageGenRequests('[{"prompt":"hero","replace_id":"0:7"}]')
    if ('error' in result) throw new Error(result.error)
    expect(result.requests[0].replaceId).toBe('0:7')
    expect(result.requests[0].width).toBeUndefined()
  })

  test('尺寸越界自动调整并进 sizeNote', () => {
    const result = parseImageGenRequests('[{"prompt":"hero","width":1000,"height":500}]')
    if ('error' in result) throw new Error(result.error)
    // 16px 对齐 1008x496 后像素数低于下限，保宽高比抬升至 1168x576
    expect(result.requests[0].width).toBe(1168)
    expect(result.requests[0].height).toBe(576)
    expect(result.sizeNote).toContain('1000x500 → 1168x576')
  })

  test('quality 枚举校验 + hd→auto 别名', () => {
    const bad = parseImageGenRequests(
      '[{"prompt":"a","width":1024,"height":1024,"quality":"ultra"}]'
    )
    expect('error' in bad && bad.error).toContain('Invalid quality')
    const aliased = parseImageGenRequests(
      '[{"prompt":"a","width":1024,"height":1024,"quality":"hd"}]'
    )
    if ('error' in aliased) throw new Error(aliased.error)
    expect(aliased.requests[0].quality).toBe('auto')
  })

  test('output_format/background 枚举校验', () => {
    const badFormat = parseImageGenRequests(
      '[{"prompt":"a","width":1024,"height":1024,"output_format":"gif"}]'
    )
    expect('error' in badFormat && badFormat.error).toContain('Invalid output_format')
    const badBackground = parseImageGenRequests(
      '[{"prompt":"a","width":1024,"height":1024,"background":"transparent"}]'
    )
    expect('error' in badBackground && badBackground.error).toContain('Invalid background')
  })

  test('尾部垃圾打捞（warning 而非报错）', () => {
    const result = parseImageGenRequests('[{"prompt":"a","width":1024,"height":1024}]"}')
    if ('error' in result) throw new Error(result.error)
    expect(result.warning).toContain('Trailing garbage')
  })

  test('单对象（非数组）按单条处理', () => {
    const result = parseImageGenRequests('{"prompt":"a","width":1024,"height":1024}')
    if ('error' in result) throw new Error(result.error)
    expect(result.requests).toHaveLength(1)
  })
})

describe('parseReferences', () => {
  test('缺省/空 = 空数组', () => {
    expect(parseReferences(undefined)).toEqual([])
    expect(parseReferences(null)).toEqual([])
  })

  test('字符串 id 与 {id, composite} 两种形态；asImage 旧别名', () => {
    const refs = parseReferences([
      '0:1',
      { id: '0:2', composite: true },
      { id: '0:3', asImage: true }
    ])
    expect(refs).toEqual([
      { id: '0:1' },
      { id: '0:2', composite: true },
      { id: '0:3', composite: true }
    ])
  })

  test('非数组/坏条目拒绝', () => {
    expect('error' in (parseReferences('0:1') as { error: string })).toBe(true)
    expect('error' in (parseReferences([{ name: 'x' }]) as { error: string })).toBe(true)
    expect('error' in (parseReferences(['  ']) as { error: string })).toBe(true)
  })
})

import { describe, expect, test } from 'bun:test'

import { expectDefined } from '#tests/helpers/assert'
import { getTool, setupToolTest, type ToolResult } from '#tests/helpers/tools'

const SUPPORTED_KEYS = [
  'spacing',
  'padding',
  'padding_horizontal',
  'padding_vertical',
  'counter_align',
  'align',
  'sizing_horizontal',
  'sizing_vertical',
  'grow',
  'name',
  'visible',
  'corner_radius',
  'opacity',
  'auto_resize',
  'direction'
]

function makeRect() {
  const { figma } = setupToolTest()
  const rect = figma.createRectangle()
  rect.resize(50, 50)
  return { figma, rect }
}

describe('batch_update validation', () => {
  test('unknown key produces error listing supported keys, known keys still apply', () => {
    const { figma, rect } = makeRect()
    const tool = getTool('batch_update')

    const result = tool.execute(figma, {
      operations: JSON.stringify([
        {
          id: rect.id,
          props: { spacing: 12, frobnicate: 42, font_size: 16 }
        }
      ])
    }) as ToolResult

    expect(result.partial).toBe(true)
    expect(Array.isArray(result.errors)).toBe(true)
    const errs = result.errors as string[]
    expect(errs).toHaveLength(1)
    const [msg] = errs as [string]
    expect(msg).toContain(rect.id)
    expect(msg).toContain('"frobnicate"')
    expect(msg).toContain('"font_size"')
    for (const key of SUPPORTED_KEYS) {
      expect(msg).toContain(key)
    }

    // Known key in the same op was still applied
    expect(expectDefined(figma.getNodeById(rect.id), 'rect').itemSpacing).toBe(12)
    // updated counter reflects the known key only
    expect(result.updated).toBe(1)
    const results = result.results as Array<{ id: string; updated: string[] }>
    expect(results).toHaveLength(1)
    const [first] = results as [{ id: string; updated: string[] }]
    expect(first.updated).toEqual(['spacing'])
  })

  test('all-unknown props: updated=0 and partial=true, node untouched', () => {
    const { figma, rect } = makeRect()
    rect.itemSpacing = 99
    const tool = getTool('batch_update')

    const result = tool.execute(figma, {
      operations: JSON.stringify([{ id: rect.id, props: { foo: 1, bar: 'x' } }])
    }) as ToolResult

    expect(result.partial).toBe(true)
    expect(result.updated).toBe(0)
    expect(result.results).toBeUndefined()
    const errs = result.errors as string[]
    expect(errs.length).toBe(1)
    expect(errs[0]).toContain('"foo"')
    expect(errs[0]).toContain('"bar"')
    // Known props untouched
    expect(expectDefined(figma.getNodeById(rect.id), 'rect').itemSpacing).toBe(99)
  })

  test('all-valid: no partial flag, no errors', () => {
    const { figma, rect } = makeRect()
    const tool = getTool('batch_update')

    const result = tool.execute(figma, {
      operations: JSON.stringify([{ id: rect.id, props: { spacing: 4, name: 'ok' } }])
    }) as ToolResult

    expect(result.partial).toBeUndefined()
    expect(result.errors).toBeUndefined()
    expect(result.updated).toBe(1)
    const node = expectDefined(figma.getNodeById(rect.id), 'rect')
    expect(node.itemSpacing).toBe(4)
    expect(node.name).toBe('ok')
  })

  test('mixed multi-op batch: one bad op marks partial but valid ones still apply', () => {
    const { figma } = setupToolTest()
    const a = figma.createRectangle()
    const b = figma.createRectangle()
    const c = figma.createRectangle()
    const tool = getTool('batch_update')

    const result = tool.execute(figma, {
      operations: JSON.stringify([
        { id: a.id, props: { spacing: 5 } }, // ok
        { id: b.id, props: { unknown_thing: 1 } }, // unknown
        { id: c.id, props: { padding: 8, bogus: true } } // partial: known applied, unknown reported
      ])
    }) as ToolResult

    expect(result.partial).toBe(true)
    expect(result.updated).toBe(2)
    const errs = result.errors as string[]
    expect(errs.length).toBe(2)
    expect(errs.some((m) => m.includes(b.id) && m.includes('"unknown_thing"'))).toBe(true)
    expect(errs.some((m) => m.includes(c.id) && m.includes('"bogus"'))).toBe(true)

    // Valid op A applied
    expect(expectDefined(figma.getNodeById(a.id), 'a').itemSpacing).toBe(5)
    // Unknown-only op B untouched (itemSpacing default)
    const bNode = expectDefined(figma.getNodeById(b.id), 'b')
    expect(bNode.itemSpacing).toBe(0)
    // Mixed op C: padding applied despite bogus
    const cNode = expectDefined(figma.getNodeById(c.id), 'c')
    expect(cNode.paddingTop).toBe(8)
    expect(cNode.paddingLeft).toBe(8)
  })

  test('missing node id alongside unknown key on a real node still surfaces both', () => {
    const { figma } = setupToolTest()
    const real = figma.createRectangle()
    const tool = getTool('batch_update')

    const result = tool.execute(figma, {
      operations: JSON.stringify([
        { id: '0:999', props: { spacing: 1 } },
        { id: real.id, props: { whoops: 2, spacing: 3 } }
      ])
    }) as ToolResult

    expect(result.partial).toBe(true)
    const errs = result.errors as string[]
    expect(errs.length).toBe(2)
    expect(errs.some((m) => m.includes('0:999') && m.includes('not found'))).toBe(true)
    expect(errs.some((m) => m.includes(real.id) && m.includes('"whoops"'))).toBe(true)
    // real node still got its known prop
    expect(expectDefined(figma.getNodeById(real.id), 'real').itemSpacing).toBe(3)
  })

  test('description advertises supported keys and the partial contract', () => {
    const tool = getTool('batch_update')
    for (const key of SUPPORTED_KEYS) {
      expect(tool.description).toContain(key)
    }
    expect(tool.description).toContain('partial')
  })
})

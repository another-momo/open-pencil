import { expect, test } from 'bun:test'

import { SceneGraph } from '@open-pencil/core'
import { getMarketingState } from '@open-pencil/core/tools'

import { expectDefined } from '#tests/helpers/assert'
import { getTool, setupToolTest } from '#tests/helpers/tools'

import { setActiveMaterialType, setActiveMaterialTypes } from '../../../../packages/core/src/tools/marketing/setup'

function run(id: string, opts?: { width?: number; height?: number; mode?: 'new' | 'continue' }) {
  const { graph, figma } = setupToolTest()
  const args: { id: string; width?: number; height?: number; mode?: 'new' | 'continue' } = { id }
  if (opts?.width !== undefined) args.width = opts.width
  if (opts?.height !== undefined) args.height = opts.height
  if (opts?.mode) args.mode = opts.mode
  const result = getTool('setup_material_type').execute(figma, args) as Record<string, unknown>
  return { graph, figma, result }
}

test('setup_material_type creates root frame at the resolved size', () => {
  setActiveMaterialType({ id: 'product_long', label: '产品长图', size: { width: 750, height: null } })
  const { graph, result } = run('product_long')
  expect(result.error).toBeUndefined()

  const rootFrameId = result.rootFrameId as string
  const rootFrame = expectDefined(graph.getNode(rootFrameId))
  expect(rootFrame.type).toBe('FRAME')
  expect(rootFrame.width).toBe(750)
  expect(rootFrame.layoutMode).toBe('VERTICAL')
  expect(rootFrame.primaryAxisSizing).toBe('HUG')
})

test('setup_material_type with fixed-size type uses FIXED sizing', () => {
  setActiveMaterialType({ id: 'wechat_moments', label: '朋友圈广告', size: { width: 1080, height: 1080 } })
  const { graph, result } = run('wechat_moments')
  expect(result.rootFrameId).toBeDefined()

  const rootFrame = expectDefined(graph.getNode(result.rootFrameId as string))
  expect(rootFrame.width).toBe(1080)
  expect(rootFrame.height).toBe(1080)
  expect(rootFrame.primaryAxisSizing).toBe('FIXED')
})

test('custom material type creates root frame at the given size', () => {
  setActiveMaterialType(undefined)
  const { graph, result } = run('custom', { width: 600, height: 400 })
  expect(result.error).toBeUndefined()

  const rootFrame = expectDefined(graph.getNode(result.rootFrameId as string))
  expect(rootFrame.width).toBe(600)
  expect(rootFrame.height).toBe(400)
})

test('custom material type without dimensions returns an error', () => {
  setActiveMaterialType(undefined)
  const { result } = run('custom')
  expect(result.error).toBeDefined()
  expect((result.error as string).toLowerCase()).toContain('width')
})

test('unknown material type returns a clear error', () => {
  setActiveMaterialType(undefined)
  const { result } = run('totally_made_up_type')
  expect(result.error).toBeDefined()
})

test('repeat call with the same id on the same page adopts the existing design', () => {
  setActiveMaterialType({ id: 'wechat_moments', label: '朋友圈广告', size: { width: 1080, height: 1080 } })
  const { figma, result: first } = run('wechat_moments')
  const firstRootId = first.rootFrameId as string
  const result2 = getTool('setup_material_type').execute(figma, { id: 'wechat_moments' }) as Record<string, unknown>
  expect(result2.rootFrameId).toBe(firstRootId)
  expect(result2.adopted).toBe(true)
})

test('mode "new" creates a fresh frame even when a same-type design exists on the page', () => {
  setActiveMaterialType({ id: 'wechat_moments', label: '朋友圈广告', size: { width: 1080, height: 1080 } })
  const { figma, result: first } = run('wechat_moments')
  const firstRootId = first.rootFrameId as string
  const result2 = getTool('setup_material_type').execute(figma, {
    id: 'wechat_moments',
    mode: 'new'
  }) as Record<string, unknown>
  expect(result2.rootFrameId).not.toBe(firstRootId)
  expect(result2.adopted).toBe(false)
})

test('setup stamps the material-type marker on the root frame', () => {
  setActiveMaterialType({ id: 'wechat_moments', label: '朋友圈广告', size: { width: 1080, height: 1080 } })
  const { graph, result } = run('wechat_moments')
  const rootFrame = expectDefined(graph.getNode(result.rootFrameId as string))
  expect((rootFrame as { pluginData?: { pluginId: string; key: string; value: string }[] }).pluginData).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ pluginId: 'open-pencil-marketing', key: 'material-type', value: 'wechat_moments' })
    ])
  )
})

test('setup writes a marketing state entry the registry can read back', () => {
  setActiveMaterialType({ id: 'wechat_moments', label: '朋友圈广告', size: { width: 1080, height: 1080 } })
  const { figma, result } = run('wechat_moments')
  const state = getMarketingState(figma.graph as unknown as SceneGraph, result.rootFrameId as string)
  expect(state?.materialTypeId).toBe('wechat_moments')
  expect(state?.rootFrameId).toBe(result.rootFrameId)
})

test('multiple registered types each resolve in the same session', () => {
  setActiveMaterialTypes([
    { id: 'product_long', label: '产品长图', size: { width: 750, height: null } },
    { id: 'wechat_moments', label: '朋友圈广告', size: { width: 1080, height: 1080 } }
  ])

  const { result: longResult } = run('product_long')
  expect(longResult.error).toBeUndefined()
  expect(longResult.size).toEqual({ width: 750, height: null })

  const { result: momentsResult } = run('wechat_moments')
  expect(momentsResult.error).toBeUndefined()
  expect(momentsResult.size).toEqual({ width: 1080, height: 1080 })
})
import { expect, test } from 'bun:test'

import { expectDefined } from '#tests/helpers/assert'
import { attachMiniLibrary } from '#tests/helpers/marketing-library'
import { getTool, setupToolTest } from '#tests/helpers/tools'

import { restoreStateFromCanvas } from '../../../../packages/core/src/tools/marketing/restore'
import { setActiveMaterialType } from '../../../../packages/core/src/tools/marketing/setup'

function setupDesign(typeId: string) {
  setActiveMaterialType({ id: typeId, label: '产品长图', size: { width: 750, height: null } })
  const env = setupToolTest()
  attachMiniLibrary(env.graph)
  const result = getTool('setup_material_type').execute(env.figma, { id: typeId }) as Record<
    string,
    unknown
  >
  expect(result.error).toBeUndefined()
  return { env, rootFrameId: result.rootFrameId as string }
}

test('restoreStateFromCanvas rebuilds registry entries from canvas markers', () => {
  const { env, rootFrameId } = setupDesign('product_long')
  const restored = restoreStateFromCanvas(env.graph)
  expect(restored).toHaveLength(1)
  expect(restored[0]?.materialTypeId).toBe('product_long')
  expect(restored[0]?.rootFrameId).toBe(rootFrameId)
})

test('restoreStateFromCanvas restores multiple coexisting designs', () => {
  setActiveMaterialType({
    id: 'product_long',
    label: '产品长图',
    size: { width: 750, height: null }
  })
  const env = setupToolTest()
  attachMiniLibrary(env.graph)
  const r1 = getTool('setup_material_type').execute(env.figma, { id: 'product_long' }) as Record<
    string,
    unknown
  >
  expect(r1.error).toBeUndefined()
  setActiveMaterialType({
    id: 'wechat_moments',
    label: '朋友圈广告',
    size: { width: 1080, height: 1080 }
  })
  const r2 = getTool('setup_material_type').execute(env.figma, { id: 'wechat_moments' }) as Record<
    string,
    unknown
  >
  expect(r2.error).toBeUndefined()

  const restored = restoreStateFromCanvas(env.graph)
  expect(restored).toHaveLength(2)
})

test('documents without marketing markers restore nothing', () => {
  const { graph } = setupToolTest()
  expect(restoreStateFromCanvas(graph)).toEqual([])
})

test('restored root frame can be fetched from the graph', () => {
  const { env, rootFrameId } = setupDesign('product_long')
  const restored = restoreStateFromCanvas(env.graph)
  const node = expectDefined(env.graph.getNode(restored[0]?.rootFrameId ?? rootFrameId))
  expect(node.type).toBe('FRAME')
})

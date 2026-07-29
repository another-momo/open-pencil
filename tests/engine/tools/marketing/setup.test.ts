import { expect, test } from 'bun:test'

import { getMarketingState } from '@open-pencil/core/tools'

import { expectDefined } from '#tests/helpers/assert'
import { getTool, setupToolTest } from '#tests/helpers/tools'

interface AnchorResult {
  template: string
  position: string
  instanceId: string
}

interface SetupToolResult {
  error?: string
  rootFrameId?: string
  anchors?: AnchorResult[]
  repaired?: string[]
}

function run(id: string) {
  const { graph, figma } = setupToolTest()
  const result = getTool('setup_material_type').execute(figma, { id }) as SetupToolResult
  return { graph, figma, result }
}

test('setup_material_type creates root frame and anchors for anchored type', () => {
  const { graph, result } = run('product_long')
  expect(result.error).toBeUndefined()

  const rootFrameId = result.rootFrameId as string
  const rootFrame = expectDefined(graph.getNode(rootFrameId))
  expect(rootFrame.type).toBe('FRAME')
  expect(rootFrame.width).toBe(750)
  expect(rootFrame.layoutMode).toBe('VERTICAL')

  const anchors = result.anchors ?? []
  expect(anchors.map((a) => a.template)).toEqual(['BrandBar', 'CTABar'])

  const rootChildren = rootFrame.childIds.map((id) => expectDefined(graph.getNode(id)))
  expect(rootChildren[0].type).toBe('INSTANCE')
  expect(rootChildren[0].name).toBe('BrandBar')
  expect(rootChildren[rootChildren.length - 1].type).toBe('INSTANCE')
  expect(rootChildren[rootChildren.length - 1].name).toBe('CTABar')
})

test('setup_material_type creates shared Components page with component definitions', () => {
  const { graph } = run('product_long')
  const state = expectDefined(getMarketingState(graph))

  const componentsPage = expectDefined(graph.getNode(state.componentsPageId))
  expect(componentsPage.name).toBe('Components')

  const componentNodes = componentsPage.childIds
    .map((id) => expectDefined(graph.getNode(id)))
    .filter((node) => node.type === 'COMPONENT')
  expect(componentNodes.map((node) => node.name).sort()).toEqual(['BrandBar', 'CTABar'])
})

test('setup_material_type registers readonly baseline for instance children', () => {
  const { graph } = run('product_long')
  const state = expectDefined(getMarketingState(graph))
  expect(state.readonly.size).toBeGreaterThan(0)

  for (const [nodeId, info] of state.readonly) {
    const node = expectDefined(graph.getNode(nodeId))
    expect(info.props).toContain('fills')
    expect(info.originalValues.fills).toBeDefined()
    expect(node.type === 'TEXT' ? info.props.includes('text') : true).toBe(true)
  }
})

test('setup_material_type with anchorless type creates only the root frame', () => {
  const { graph, result } = run('wechat_moments')
  expect(result.error).toBeUndefined()

  const rootFrame = expectDefined(graph.getNode(result.rootFrameId as string))
  expect(rootFrame.width).toBe(1080)
  expect(rootFrame.height).toBe(1080)
  expect(result.anchors?.length ?? -1).toBe(0)
})

test('repeat call is a no-op when anchors are intact', () => {
  const { figma } = setupToolTest()
  const first = getTool('setup_material_type').execute(figma, {
    id: 'product_long'
  }) as SetupToolResult
  const firstInstanceIds = (first.anchors ?? []).map((a) => a.instanceId)

  const second = getTool('setup_material_type').execute(figma, {
    id: 'product_long'
  }) as SetupToolResult
  const secondInstanceIds = (second.anchors ?? []).map((a) => a.instanceId)
  expect(secondInstanceIds).toEqual(firstInstanceIds)
  expect(second.repaired).toBeUndefined()
})

test('repair mode re-materializes a deleted anchor instance', () => {
  const { graph, figma } = setupToolTest()
  const first = getTool('setup_material_type').execute(figma, {
    id: 'product_long'
  }) as SetupToolResult
  const cta = expectDefined((first.anchors ?? []).find((a) => a.template === 'CTABar'))
  graph.deleteNode(cta.instanceId)

  const second = getTool('setup_material_type').execute(figma, {
    id: 'product_long'
  }) as SetupToolResult
  expect(second.repaired).toEqual(['CTABar'])

  const state = expectDefined(getMarketingState(graph))
  const ctaAnchor = expectDefined(state.anchors.find((a) => a.templateId === 'CTABar'))
  expect(graph.getNode(ctaAnchor.instanceId)).toBeDefined()
})

test('repair mode re-materializes an anchor with missing readonly children', () => {
  const { graph, figma } = setupToolTest()
  const first = getTool('setup_material_type').execute(figma, {
    id: 'product_long'
  }) as SetupToolResult
  const brandBar = expectDefined((first.anchors ?? []).find((a) => a.template === 'BrandBar'))

  const stateBefore = expectDefined(getMarketingState(graph))
  const entry = expectDefined(
    [...stateBefore.readonly.entries()].find(
      ([, info]) => info.anchorInstanceId === brandBar.instanceId
    )
  )
  const [readonlyNodeId] = entry
  graph.deleteNode(readonlyNodeId)

  const second = getTool('setup_material_type').execute(figma, {
    id: 'product_long'
  }) as SetupToolResult
  expect(second.repaired).toEqual(['BrandBar'])

  const stateAfter = expectDefined(getMarketingState(graph))
  const brandBarAfter = expectDefined(stateAfter.anchors.find((a) => a.templateId === 'BrandBar'))
  expect(brandBarAfter.instanceId).not.toBe(brandBar.instanceId)
  expect(graph.getNode(brandBarAfter.instanceId)).toBeDefined()

  const reregistered = [...stateAfter.readonly.values()].filter(
    (info) => info.anchorInstanceId === brandBarAfter.instanceId
  )
  expect(reregistered.length).toBeGreaterThan(0)
  const stale = [...stateAfter.readonly.values()].filter(
    (info) => info.anchorInstanceId === brandBar.instanceId
  )
  expect(stale).toEqual([])
})

test('setting up a second type creates a coexisting design and preserves the first', () => {
  const { graph, figma } = setupToolTest()
  const first = getTool('setup_material_type').execute(figma, {
    id: 'product_long'
  }) as SetupToolResult
  const oldInstanceIds = (first.anchors ?? []).map((a) => a.instanceId)

  const second = getTool('setup_material_type').execute(figma, {
    id: 'wechat_moments'
  }) as SetupToolResult
  expect(second.error).toBeUndefined()
  expect(second.rootFrameId).not.toBe(first.rootFrameId)

  for (const instanceId of oldInstanceIds) {
    expect(graph.getNode(instanceId)).toBeDefined()
  }

  // Default resolution returns the most recently active design
  const state = expectDefined(getMarketingState(graph))
  expect(state.materialTypeId).toBe('wechat_moments')
  expect(state.anchors.length).toBe(0)

  // The first design is still registered under its own root frame
  const firstState = expectDefined(getMarketingState(graph, first.rootFrameId as string))
  expect(firstState.materialTypeId).toBe('product_long')
  expect(firstState.anchors.length).toBe(2)
})

test('custom material type creates root frame at the given size', () => {
  const { graph, figma } = setupToolTest()
  const result = getTool('setup_material_type').execute(figma, {
    id: 'custom',
    width: 640,
    height: 960
  }) as SetupToolResult
  expect(result.error).toBeUndefined()

  const rootFrame = expectDefined(graph.getNode(result.rootFrameId as string))
  expect(rootFrame.width).toBe(640)
  expect(rootFrame.height).toBe(960)
})

test('custom material type without dimensions returns an error', () => {
  const { figma } = setupToolTest()
  const result = getTool('setup_material_type').execute(figma, { id: 'custom' }) as SetupToolResult
  expect(result.error).toContain('width and height')
})

test('unknown material type returns error with available ids', () => {
  const { result } = run('nonexistent')
  expect(result.error).toBeDefined()
  expect(result.error as string).toContain('wechat_moments')
})

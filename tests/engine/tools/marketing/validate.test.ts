import { expect, test } from 'bun:test'

import { SceneGraph } from '@open-pencil/core'
import { getMarketingState, setLibrarySession } from '@open-pencil/core/tools'

import { expectDefined } from '#tests/helpers/assert'
import { attachMiniLibrary } from '#tests/helpers/marketing-library'
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
}

interface ValidateViolation {
  type: string
  message: string
  nodeId?: string
  fix: string
}

interface ValidateToolResult {
  valid: boolean
  violations?: ValidateViolation[]
  note?: string
}

function setup(id: string) {
  const { graph, figma } = setupToolTest()
  attachMiniLibrary(graph)
  const result = getTool('setup_material_type').execute(figma, { id }) as SetupToolResult
  return { graph, figma, setup: result }
}

function runValidate(
  figma: Parameters<ReturnType<typeof getTool>['execute']>[0],
  rootFrameId?: string
) {
  return getTool('validate').execute(
    figma,
    rootFrameId ? { id: rootFrameId } : {}
  ) as ValidateToolResult
}

function findInstanceChild(
  graph: ReturnType<typeof setupToolTest>['graph'],
  instanceId: string,
  name: string
) {
  const instance = expectDefined(graph.getNode(instanceId))
  const walk = (nodeId: string): ReturnType<typeof graph.getNode> => {
    const node = graph.getNode(nodeId)
    if (!node) return undefined
    if (node.name === name) return node
    for (const childId of node.childIds) {
      const found = walk(childId)
      if (found) return found
    }
    return undefined
  }
  return walk(instance.id)
}

test('batch_update on instance child records override on instance root', () => {
  const { graph, figma, setup: setupResult } = setup('product_long')
  const brandBar = expectDefined(setupResult.anchors?.find((a) => a.template === 'BrandBar'))
  const ctaText = expectDefined(findInstanceChild(graph, brandBar.instanceId, 'brandName'))

  getTool('batch_update').execute(figma, {
    operations: JSON.stringify([{ id: ctaText.id, props: { opacity: 0.5 } }])
  })

  const instance = expectDefined(graph.getNode(brandBar.instanceId))
  expect(instance.overrides[`${ctaText.id}:opacity`]).toBe(true)
})

test('update_node text on instance child records override', () => {
  const { graph, figma, setup: setupResult } = setup('product_long')
  const ctaBar = expectDefined(setupResult.anchors?.find((a) => a.template === 'CTABar'))
  const ctaText = expectDefined(findInstanceChild(graph, ctaBar.instanceId, 'ctaText'))

  getTool('update_node').execute(figma, { id: ctaText.id, text: '立即抢购' })

  const instance = expectDefined(graph.getNode(ctaBar.instanceId))
  expect(instance.overrides[`${ctaText.id}:text`]).toBe(true)
})

test('batch_update outside instances records nothing', () => {
  const { graph, figma, setup: setupResult } = setup('product_long')
  const rootFrameId = expectDefined(setupResult.rootFrameId)

  getTool('batch_update').execute(figma, {
    operations: JSON.stringify([{ id: rootFrameId, props: { spacing: 24 } }])
  })

  const rootFrame = expectDefined(graph.getNode(rootFrameId))
  expect(Object.keys(rootFrame.overrides).length).toBe(0)
})

test('validate passes on a clean setup', () => {
  const { figma } = setup('product_long')
  const result = runValidate(figma)
  expect(result.valid).toBe(true)
})

test('validate detects anchor instance deletion', () => {
  const { graph, figma, setup: setupResult } = setup('product_long')
  const ctaBar = expectDefined(setupResult.anchors?.find((a) => a.template === 'CTABar'))
  graph.deleteNode(ctaBar.instanceId)

  const check = runValidate(figma)
  expect(check.valid).toBe(false)
  expect(check.violations?.some((v) => v.type === 'anchor_deleted')).toBe(true)
})

test('validate detects anchor misplacement', () => {
  const { graph, figma, setup: setupResult } = setup('product_long')
  const state = expectDefined(getMarketingState(graph))
  const rootFrame = expectDefined(graph.getNode(state.rootFrameId))
  const brandBar = expectDefined(setupResult.anchors?.find((a) => a.template === 'BrandBar'))

  graph.reorderChild(brandBar.instanceId, rootFrame.id, rootFrame.childIds.length - 1)

  const check = runValidate(figma)
  expect(check.valid).toBe(false)
  expect(check.violations?.some((v) => v.type === 'anchor_misplaced')).toBe(true)
})

test('validate reports root_deleted when the root frame is gone', () => {
  const { graph, figma, setup: setupResult } = setup('product_long')
  const rootFrameId = expectDefined(setupResult.rootFrameId)

  graph.deleteNode(rootFrameId)

  const check = runValidate(figma, rootFrameId)
  expect(check.valid).toBe(false)
  expect(check.violations?.some((v) => v.type === 'root_deleted')).toBe(true)
})

test('validate works without a library session (checks derive from anchor records)', () => {
  const { graph, figma, setup: setupResult } = setup('product_long')
  const ctaBar = expectDefined(setupResult.anchors?.find((a) => a.template === 'CTABar'))

  // Simulate the custom-library-missing scenario (§6.1): no session at all
  setLibrarySession(graph, {
    name: 'other-library.fig',
    graph: new SceneGraph(),
    index: { types: [], profiles: [], components: [], references: [], warnings: [] }
  })

  graph.deleteNode(ctaBar.instanceId)
  const check = runValidate(figma)
  expect(check.valid).toBe(false)
  expect(check.violations?.some((v) => v.type === 'anchor_deleted')).toBe(true)
})

test('validate without marketing state reports setup hint', () => {
  const { figma } = setupToolTest()
  const result = runValidate(figma)
  expect(result.valid).toBe(false)
  expect(result.note).toContain('setup_material_type')
})

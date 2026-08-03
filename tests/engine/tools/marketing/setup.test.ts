import { expect, test } from 'bun:test'

import { SceneGraph } from '@open-pencil/core'
import {
  getMarketingState,
  listDocumentLibraryNames,
  setLibrarySession
} from '@open-pencil/core/tools'

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
  repaired?: string[]
}

function run(id: string) {
  const { graph, figma } = setupToolTest()
  attachMiniLibrary(graph)
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

test('setup_material_type with anchorless type creates only the root frame', () => {
  const { graph, result } = run('wechat_moments')
  expect(result.error).toBeUndefined()

  const rootFrame = expectDefined(graph.getNode(result.rootFrameId as string))
  expect(rootFrame.width).toBe(1080)
  expect(rootFrame.height).toBe(1080)
  expect(result.anchors?.length ?? -1).toBe(0)
})

test('repeat call is a no-op when anchors are intact', () => {
  const { graph, figma } = setupToolTest()
  attachMiniLibrary(graph)
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
  attachMiniLibrary(graph)
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

test('setting up a second type creates a coexisting design and preserves the first', () => {
  const { graph, figma } = setupToolTest()
  attachMiniLibrary(graph)
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
  const { graph, figma } = setupToolTest()
  attachMiniLibrary(graph)
  const result = getTool('setup_material_type').execute(figma, { id: 'custom' }) as SetupToolResult
  expect(result.error).toContain('width and height')
})

test('unknown material type returns error with available ids', () => {
  const { result } = run('nonexistent')
  expect(result.error).toBeDefined()
  expect(result.error as string).toContain('wechat_moments')
})

test('unknown id for a design present in the document gets the re-submit hint (§6.1)', () => {
  const { graph, figma } = setupToolTest()
  attachMiniLibrary(graph)
  const first = getTool('setup_material_type').execute(figma, {
    id: 'product_long'
  }) as SetupToolResult
  expect(first.error).toBeUndefined()

  // Swap in a library that does not contain product_long
  const empty = new SceneGraph()
  setLibrarySession(graph, {
    name: 'other-library.fig',
    graph: empty,
    index: { types: [], profiles: [], components: [], references: [], warnings: [] }
  })

  const second = getTool('setup_material_type').execute(figma, {
    id: 'product_long'
  }) as SetupToolResult
  expect(second.error).toContain('re-submit that library')
  expect(second.error).toContain('other-library.fig')
})

// P8v5 (2026-08-04): profile state lives in `profileSelection` (app
// ref) and is invisible to setup entirely. The earlier P8v3 "陈旧 lock"
// tests were dropped because `MarketingPrefs` is gone — setup no
// longer has any per-graph profile cache to consult.

test('re-setup with the same id is a no-op for profile state (P8v5)', () => {
  const { figma } = setupToolTest()
  attachMiniLibrary(figma.graph)
  const first = getTool('setup_material_type').execute(figma, {
    id: 'product_long'
  }) as SetupToolResult & { activeProfileId?: string }
  expect(first.error).toBeUndefined()

  const second = getTool('setup_material_type').execute(figma, {
    id: 'product_long'
  }) as SetupToolResult & { activeProfileId?: string }
  expect(second.error).toBeUndefined()
  expect(second.rootFrameId).toBe(first.rootFrameId)
  expect((second.anchors ?? []).map((a) => a.instanceId)).toEqual(
    (first.anchors ?? []).map((a) => a.instanceId)
  )
  expect(second.repaired).toBeUndefined()
  expect('activeProfileId' in second).toBe(false)
})

test('setup stamps the library name on the root frame marker', () => {
  const { graph } = run('product_long')
  expect(listDocumentLibraryNames(graph)).toEqual(['test-library.fig'])
})

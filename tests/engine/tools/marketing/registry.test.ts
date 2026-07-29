import { describe, expect, test } from 'bun:test'

import {
  clearMarketingState,
  getMarketingState,
  listMarketingDesigns,
  setMarketingState,
  touchMarketingState
} from '#core/tools/marketing/registry'

import { setupToolTest } from '#tests/helpers/tools'

function design(rootFrameId: string, materialTypeId = 'wechat_moments') {
  return {
    materialTypeId,
    rootFrameId,
    componentsPageId: 'components',
    anchors: [],
    readonly: new Map()
  }
}

describe('marketing registry (per-rootFrame)', () => {
  test('single design resolves by default', () => {
    const { graph } = setupToolTest()
    const frame = graph.createNode('FRAME', graph.getPages()[0].id, { name: 'A' })
    setMarketingState(graph, design(frame.id))

    expect(getMarketingState(graph)?.rootFrameId).toBe(frame.id)
    expect(listMarketingDesigns(graph)).toHaveLength(1)
  })

  test('multiple designs resolve to the most recently active', () => {
    const { graph } = setupToolTest()
    const pageId = graph.getPages()[0].id
    const frameA = graph.createNode('FRAME', pageId, { name: 'A' })
    const frameB = graph.createNode('FRAME', pageId, { name: 'B' })
    setMarketingState(graph, design(frameA.id))
    setMarketingState(graph, design(frameB.id, 'xiaohongshu'))

    expect(getMarketingState(graph)?.rootFrameId).toBe(frameB.id)

    touchMarketingState(graph, frameA.id)
    expect(getMarketingState(graph)?.rootFrameId).toBe(frameA.id)
  })

  test('multiple designs with the active root frame deleted resolve to undefined', () => {
    const { graph } = setupToolTest()
    const pageId = graph.getPages()[0].id
    const frameA = graph.createNode('FRAME', pageId, { name: 'A' })
    const frameB = graph.createNode('FRAME', pageId, { name: 'B' })
    setMarketingState(graph, design(frameA.id))
    setMarketingState(graph, design(frameB.id, 'xiaohongshu'))
    graph.deleteNode(frameB.id)

    expect(getMarketingState(graph, frameB.id)?.rootFrameId).toBe(frameB.id)
    expect(getMarketingState(graph)).toBeUndefined()
    expect(listMarketingDesigns(graph)).toHaveLength(2)
  })

  test('explicit rootFrameId bypasses recency', () => {
    const { graph } = setupToolTest()
    const pageId = graph.getPages()[0].id
    const frameA = graph.createNode('FRAME', pageId, { name: 'A' })
    const frameB = graph.createNode('FRAME', pageId, { name: 'B' })
    setMarketingState(graph, design(frameA.id))
    setMarketingState(graph, design(frameB.id, 'xiaohongshu'))

    expect(getMarketingState(graph, frameA.id)?.rootFrameId).toBe(frameA.id)
  })

  test('clearMarketingState with rootFrameId only clears that design', () => {
    const { graph } = setupToolTest()
    const pageId = graph.getPages()[0].id
    const frameA = graph.createNode('FRAME', pageId, { name: 'A' })
    const frameB = graph.createNode('FRAME', pageId, { name: 'B' })
    setMarketingState(graph, design(frameA.id))
    setMarketingState(graph, design(frameB.id, 'xiaohongshu'))

    clearMarketingState(graph, frameB.id)
    expect(listMarketingDesigns(graph)).toHaveLength(1)
    expect(getMarketingState(graph)?.rootFrameId).toBe(frameA.id)

    clearMarketingState(graph)
    expect(listMarketingDesigns(graph)).toHaveLength(0)
  })
})

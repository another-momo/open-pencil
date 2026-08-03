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
    anchors: []
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

  test('stale active root in a multi-design document returns undefined and surfaces candidates', () => {
    const { graph } = setupToolTest()
    const pageId = graph.getPages()[0].id
    const frameA = graph.createNode('FRAME', pageId, { name: 'A' })
    const frameB = graph.createNode('FRAME', pageId, { name: 'B' })
    setMarketingState(graph, design(frameA.id))
    setMarketingState(graph, design(frameB.id, 'xiaohongshu'))
    graph.deleteNode(frameB.id)

    // default resolution: latest is gone, return undefined, KEEP the
    // stale entry so the caller can show the candidate list.
    expect(getMarketingState(graph)).toBeUndefined()
    expect(listMarketingDesigns(graph)).toHaveLength(2)
  })

test('explicit id on a deleted root prunes the stale entry', () => {
    const { graph } = setupToolTest()
    const pageId = graph.getPages()[0].id
    const frameA = graph.createNode('FRAME', pageId, { name: 'A' })
    setMarketingState(graph, design(frameA.id))
    graph.deleteNode(frameA.id)

    // explicit id on a stale single-design entry prunes it
    expect(getMarketingState(graph, frameA.id)).toBeUndefined()
    expect(listMarketingDesigns(graph)).toHaveLength(0)
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

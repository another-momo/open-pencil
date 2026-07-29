import { describe, expect, test } from 'bun:test'

import { getMarketingState } from '@open-pencil/core/tools'

import {
  clearMarketingState,
  listMarketingDesigns
} from '#core/tools/marketing/registry'
import { restoreStateFromCanvas } from '#core/tools/marketing/restore'

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
}

function setupDesign(id: string) {
  const env = setupToolTest()
  const result = getTool('setup_material_type').execute(env.figma, { id }) as SetupToolResult
  expect(result.error).toBeUndefined()
  return { ...env, result }
}

describe('restoreStateFromCanvas', () => {
  test('restores a design after the registry is wiped (document reopen)', () => {
    const { graph, result } = setupDesign('product_long')
    const rootFrameId = result.rootFrameId as string
    const anchorInstances = (result.anchors ?? []).map((a) => a.instanceId)

    // Wiping the registry simulates a fresh session; the next state access
    // lazily rebuilds it from canvas markers
    clearMarketingState(graph)
    expect(listMarketingDesigns(graph)).toHaveLength(1)

    const state = expectDefined(getMarketingState(graph, rootFrameId))
    expect(state.materialTypeId).toBe('product_long')
    expect(state.rootFrameId).toBe(rootFrameId)
    expect(state.anchors.map((a) => a.instanceId).sort()).toEqual(anchorInstances.sort())
    expect(state.readonly.size).toBeGreaterThan(0)
  })

  test('restored readonly baselines make validate work again', () => {
    const { graph, figma } = setupDesign('product_long')
    clearMarketingState(graph)

    const validate = getTool('validate').execute(figma, {}) as { valid: boolean; note?: string }
    expect(validate.valid).toBe(true)
  })

  test('restores multiple coexisting designs', () => {
    const { graph, figma } = setupDesign('product_long')
    const second = getTool('setup_material_type').execute(figma, {
      id: 'wechat_moments'
    }) as SetupToolResult
    expect(second.error).toBeUndefined()

    clearMarketingState(graph)
    const restored = restoreStateFromCanvas(graph)
    expect(restored).toBe(2)
    expect(listMarketingDesigns(graph)).toHaveLength(2)
  })

  test('documents without marketing markers restore nothing', () => {
    const { graph } = setupToolTest()
    graph.createNode('FRAME', graph.getPages()[0].id, { name: 'unrelated' })
    expect(restoreStateFromCanvas(graph)).toBe(0)
  })
})

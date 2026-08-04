import { expect, test } from 'bun:test'

import { computeAllLayouts } from '@open-pencil/core/layout'
import {
  BRIEF_ENTRY_NAME,
  BRIEF_NAME,
  BRIEF_ZONE_AI_NAME,
  BRIEF_ZONE_MATERIALS_NAME,
  BRIEF_ZONE_USER_NAME,
  appendToBriefAiZone,
  createBrief,
  findBrief,
  isBrief
} from '@open-pencil/core/tools'

import { expectDefined } from '#tests/helpers/assert'
import { setupToolTest } from '#tests/helpers/tools'

test('createBrief builds the three-zone structure with pluginData marker', () => {
  const { graph, figma } = setupToolTest()
  const brief = createBrief(figma, 100, 200)

  expect(brief.type).toBe('FRAME')
  expect(brief.name).toBe(BRIEF_NAME)
  expect(brief.x).toBe(100)
  expect(brief.y).toBe(200)
  expect(isBrief(brief)).toBe(true)

  const topNames = brief.childIds.map((id) => expectDefined(graph.getNode(id)).name)
  expect(topNames).toContain(BRIEF_ZONE_AI_NAME)

  const mainId = expectDefined(brief.childIds.find((id) => graph.getNode(id)?.name === '需求内容'))
  const mainZoneNames = expectDefined(graph.getNode(mainId)).childIds.map(
    (id) => expectDefined(graph.getNode(id)).name
  )
  expect(mainZoneNames).toContain(BRIEF_ZONE_USER_NAME)
  expect(mainZoneNames).toContain(BRIEF_ZONE_MATERIALS_NAME)
})

test('createBrief includes one sample material entry (image slot + caption)', () => {
  const { graph, figma } = setupToolTest()
  const brief = createBrief(figma)

  const walk = (id: string, visit: (nodeId: string) => void): void => {
    visit(id)
    for (const childId of expectDefined(graph.getNode(id)).childIds) walk(childId, visit)
  }
  let entryId: string | undefined
  walk(brief.id, (id) => {
    if (graph.getNode(id)?.name === BRIEF_ENTRY_NAME) entryId = id
  })

  const entryChildren = expectDefined(graph.getNode(expectDefined(entryId))).childIds.map((id) =>
    expectDefined(graph.getNode(id))
  )
  expect(entryChildren.some((node) => node.name === '图片位')).toBe(true)
  expect(entryChildren.some((node) => node.type === 'TEXT')).toBe(true)
})

test('findBrief locates the marked brief and ignores lookalikes', () => {
  const { graph, figma } = setupToolTest()
  const brief = createBrief(figma)

  const lookalike = graph.createNode('FRAME', figma.currentPage.id, { name: BRIEF_NAME })
  expect(isBrief(graph.getNode(lookalike.id))).toBe(false)

  expect(findBrief(figma)?.id).toBe(brief.id)
})

test('brief layout computes sane geometry (no sizing collapse)', () => {
  const { graph, figma } = setupToolTest()
  const brief = createBrief(figma, 0, 0)
  computeAllLayouts(graph, figma.currentPage.id)

  const fresh = expectDefined(graph.getNode(brief.id))
  expect(fresh.width).toBe(560)
  expect(fresh.height).toBeGreaterThan(100)

  const mainId = expectDefined(fresh.childIds.find((id) => graph.getNode(id)?.name === '需求内容'))
  const main = expectDefined(graph.getNode(mainId))
  const aiCard = expectDefined(
    graph.getNode(
      expectDefined(fresh.childIds.find((id) => graph.getNode(id)?.name === BRIEF_ZONE_AI_NAME))
    )
  )
  expect(main.width).toBe(560 - 32 - 16 - 172)
  expect(aiCard.width).toBe(172)
  expect(aiCard.height).toBe(fresh.height - 32)

  const gridId = expectDefined(
    (function find(nodeId: string): string | undefined {
      const node = graph.getNode(nodeId)
      if (!node) return undefined
      if (node.name === 'MaterialGrid') return nodeId
      for (const childId of node.childIds) {
        const found = find(childId)
        if (found) return found
      }
      return undefined
    })(brief.id)
  )
  const slotWidths = expectDefined(graph.getNode(gridId)).childIds.map(
    (id) => expectDefined(graph.getNode(id)).width
  )
  for (const w of slotWidths) expect(w).toBeGreaterThan(40)
})

test('appendToBriefAiZone appends text only into the AI conclusions list', () => {
  const { graph, figma } = setupToolTest()
  const brief = createBrief(figma)

  expect(appendToBriefAiZone(figma, brief.id, '方向B：活力潮流')).toBe(true)

  const walk = (id: string, visit: (nodeId: string) => void): void => {
    visit(id)
    for (const childId of expectDefined(graph.getNode(id)).childIds) walk(childId, visit)
  }
  const texts: string[] = []
  walk(brief.id, (id) => {
    const node = graph.getNode(id)
    if (node?.type === 'TEXT' && node.text) texts.push(node.text)
  })
  expect(texts.some((t) => t.includes('方向B：活力潮流'))).toBe(true)

  expect(appendToBriefAiZone(figma, 'nonexistent', 'x')).toBe(false)
})

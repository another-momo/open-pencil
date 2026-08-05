import { expect, test } from 'bun:test'

import { computeAllLayouts } from '@open-pencil/core/layout'
import {
  BRIEF_EMPTY_HINT_NAME,
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

test('createBrief starts with an empty MaterialGrid (no sample entry, no add slots) and a visible EmptyHint', () => {
  const { graph, figma } = setupToolTest()
  const brief = createBrief(figma)

  const names: string[] = []
  const walk = (id: string): void => {
    const node = expectDefined(graph.getNode(id))
    names.push(node.name)
    for (const childId of node.childIds) walk(childId)
  }
  walk(brief.id)

  expect(names).not.toContain(BRIEF_ENTRY_NAME)
  expect(names).not.toContain('添加位')
  expect(names).toContain(BRIEF_EMPTY_HINT_NAME)

  const mainId = expectDefined(brief.childIds.find((id) => graph.getNode(id)?.name === '需求内容'))
  const cardId = expectDefined(
    graph
      .getNode(mainId)
      ?.childIds.find((id) => graph.getNode(id)?.name === BRIEF_ZONE_MATERIALS_NAME)
  )
  const gridId = expectDefined(
    graph.getNode(cardId)?.childIds.find((id) => graph.getNode(id)?.name === 'MaterialGrid')
  )
  expect(expectDefined(graph.getNode(gridId)).childIds).toEqual([])

  const emptyHintId = expectDefined(
    graph.getNode(cardId)?.childIds.find((id) => graph.getNode(id)?.name === BRIEF_EMPTY_HINT_NAME)
  )
  expect(expectDefined(graph.getNode(emptyHintId)).visible).not.toBe(false)
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
  expect(fresh.width).toBe(1252)
  expect(fresh.height).toBeGreaterThan(200)

  const mainId = expectDefined(fresh.childIds.find((id) => graph.getNode(id)?.name === '需求内容'))
  const main = expectDefined(graph.getNode(mainId))
  const aiCard = expectDefined(
    graph.getNode(
      expectDefined(fresh.childIds.find((id) => graph.getNode(id)?.name === BRIEF_ZONE_AI_NAME))
    )
  )
  // main = brief width - padding*2 - itemSpacing - AI card width
  expect(main.width).toBe(1252 - 72 - 36 - 384)
  expect(aiCard.width).toBe(384)
  expect(aiCard.height).toBe(fresh.height - 72)
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

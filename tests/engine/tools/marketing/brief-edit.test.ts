import { expect, test } from 'bun:test'

import {
  BRIEF_ENTRY_NAME,
  BRIEF_ZONE_MATERIALS_NAME,
  addBriefMaterialEntry,
  appendToBriefAiZone,
  createBrief,
  readBrief,
  removeBriefMaterial,
  updateBriefContent,
  updateMaterialCaption
} from '@open-pencil/core/tools'

import { expectDefined } from '#tests/helpers/assert'
import { setupToolTest } from '#tests/helpers/tools'

function findChildId(
  graph: ReturnType<typeof setupToolTest>['graph'],
  parentId: string,
  name: string
): string | undefined {
  return graph.getNode(parentId)?.childIds.find((id) => graph.getNode(id)?.name === name)
}

function findGridId(graph: ReturnType<typeof setupToolTest>['graph'], briefId: string): string {
  const mainId = expectDefined(findChildId(graph, briefId, '需求内容'))
  const cardId = expectDefined(findChildId(graph, mainId, BRIEF_ZONE_MATERIALS_NAME))
  return expectDefined(findChildId(graph, cardId, 'MaterialGrid'))
}

test('readBrief reads back default content, sample entry, and empty conclusions', () => {
  const { figma } = setupToolTest()
  const brief = createBrief(figma)

  const view = expectDefined(readBrief(figma))
  expect(view.briefId).toBe(brief.id)
  expect(view.content).toContain('XX奶茶')
  expect(view.materials.length).toBe(1)
  const sample = expectDefined(view.materials[0])
  expect(sample.caption).toBe('主视觉')
  // Sample entry ships with a SOLID placeholder fill, not a real image
  expect(sample.imageHash).toBe(null)
  expect(view.conclusions).toEqual([])
})

test('readBrief returns conclusions appended via appendToBriefAiZone', () => {
  const { figma } = setupToolTest()
  const brief = createBrief(figma)

  expect(appendToBriefAiZone(figma, brief.id, '方向B：活力潮流')).toBe(true)
  const view = expectDefined(readBrief(figma))
  expect(view.conclusions).toEqual(['· 方向B：活力潮流'])
})

test('updateBriefContent writes back to the ContentExample text', () => {
  const { graph, figma } = setupToolTest()
  const brief = createBrief(figma)
  const view = expectDefined(readBrief(figma))

  expect(updateBriefContent(figma, view.briefId, '品牌：新茶记，活动：第二杯半价')).toBe(true)

  const mainId = expectDefined(findChildId(graph, brief.id, '需求内容'))
  const contentCardId = expectDefined(findChildId(graph, mainId, '内容区'))
  const contentInputId = expectDefined(findChildId(graph, contentCardId, 'ContentInput'))
  const contentTextId = expectDefined(findChildId(graph, contentInputId, 'ContentExample'))
  expect(expectDefined(graph.getNode(contentTextId)).text).toBe('品牌：新茶记，活动：第二杯半价')

  expect(expectDefined(readBrief(figma)).content).toBe('品牌：新茶记，活动：第二杯半价')
  expect(updateBriefContent(figma, 'nonexistent', 'x')).toBe(false)
})

test('addBriefMaterialEntry (bytes path) inserts an entry with an IMAGE fill before the add slots', () => {
  const { graph, figma } = setupToolTest()
  const brief = createBrief(figma)
  const bytes = new Uint8Array([1, 2, 3, 4])

  const result = addBriefMaterialEntry(figma, brief.id, bytes, '卡片配图')
  expect('entryId' in result).toBe(true)
  if (!('entryId' in result)) return
  const entryId = result.entryId

  const gridId = findGridId(graph, brief.id)
  const gridChildren = expectDefined(graph.getNode(gridId)).childIds.map((id) =>
    expectDefined(graph.getNode(id))
  )
  const entries = gridChildren.filter((node) => node.name === BRIEF_ENTRY_NAME)
  expect(entries.length).toBe(2)
  // Add slots stay at the tail
  expect(gridChildren.slice(-3).every((node) => node.name === '添加位')).toBe(true)
  expect(gridChildren[gridChildren.length - 4]?.id).toBe(entryId)

  const imageId = expectDefined(findChildId(graph, entryId, '图片位'))
  const fill = expectDefined(graph.getNode(imageId)).fills[0]
  expect(fill?.type).toBe('IMAGE')
  expect(fill?.type === 'IMAGE' ? fill.imageHash : undefined).toBeDefined()
  const hash = fill?.type === 'IMAGE' ? expectDefined(fill.imageHash) : ''
  expect(graph.images.get(hash)).toBeDefined()

  const captionId = expectDefined(findChildId(graph, entryId, 'Caption'))
  expect(expectDefined(graph.getNode(captionId)).text).toBe('卡片配图')

  const view = expectDefined(readBrief(figma))
  expect(view.materials.map((m) => m.caption)).toEqual(['主视觉', '卡片配图'])
  expect(expectDefined(view.materials[1]).imageHash).toBe(hash)
})

test('addBriefMaterialEntry accepts an existing image hash', () => {
  const { figma } = setupToolTest()
  const brief = createBrief(figma)
  const { hash } = figma.createImage(new Uint8Array([9, 9, 9]))

  const result = addBriefMaterialEntry(figma, brief.id, { hash }, '仅参考风格')
  expect('entryId' in result).toBe(true)
  const view = expectDefined(readBrief(figma))
  expect(expectDefined(view.materials[1]).imageHash).toBe(hash)
})

test('addBriefMaterialEntry errors on a missing brief', () => {
  const { figma } = setupToolTest()
  const result = addBriefMaterialEntry(figma, 'nonexistent', new Uint8Array([1]), 'x')
  expect('error' in result).toBe(true)
})

test('updateMaterialCaption and removeBriefMaterial mutate the entry', () => {
  const { figma } = setupToolTest()
  const brief = createBrief(figma)
  const entryId = expectDefined(readBrief(figma)).materials[0]?.entryId ?? ''

  expect(updateMaterialCaption(figma, entryId, '主视觉（定稿）')).toBe(true)
  expect(expectDefined(readBrief(figma)).materials[0]?.caption).toBe('主视觉（定稿）')
  expect(updateMaterialCaption(figma, 'nonexistent', 'x')).toBe(false)

  expect(removeBriefMaterial(figma, entryId)).toBe(true)
  expect(expectDefined(readBrief(figma)).materials).toEqual([])
  expect(removeBriefMaterial(figma, entryId)).toBe(false)

  expect(updateBriefContent(figma, brief.id, 'still works')).toBe(true)
})

test('readBrief returns null for a structurally broken brief (materials zone deleted)', () => {
  const { graph, figma } = setupToolTest()
  const brief = createBrief(figma)

  const mainId = expectDefined(findChildId(graph, brief.id, '需求内容'))
  const cardId = expectDefined(findChildId(graph, mainId, BRIEF_ZONE_MATERIALS_NAME))
  graph.deleteNode(cardId)

  expect(readBrief(figma)).toBe(null)
})

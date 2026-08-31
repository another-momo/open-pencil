/**
 * T52（S4 W2 / T-B1）brief-edit 面板读写原语契约测试（S3 §10 旧断言平移）。
 *
 * 平移自 open-pencil tests/engine/tools/marketing/brief-edit.test.ts：
 * 默认内容回读 / 结论回读（改结构化视图）/ updateBriefContent 覆写 /
 * addBriefMaterialEntry 字节与 hash 双路（新：返回 imageNodeId）/
 * caption 覆写与条目删除 / 结构破坏 read-as-null（四区任一缺失）。
 */

import { expect, test } from 'bun:test'

import {
  BRIEF_EMPTY_HINT_NAME,
  BRIEF_ENTRY_NAME,
  BRIEF_ZONE_CONCLUSIONS,
  BRIEF_ZONE_CONTENT,
  BRIEF_ZONE_DESIGNS,
  BRIEF_ZONE_MATERIALS,
  addBriefMaterialEntry,
  appendToBriefAIZone,
  createBrief,
  findBriefZone,
  type BriefZoneId
} from '#core/tools/fork/marketing/brief'
import {
  readBrief,
  removeBriefMaterial,
  updateBriefContent,
  updateMaterialCaption
} from '#core/tools/fork/marketing/brief-edit'

import { expectDefined } from '#tests/helpers/assert'
import { setupToolTest } from '#tests/helpers/tools'

type TestGraph = ReturnType<typeof setupToolTest>['graph']

function findChildId(graph: TestGraph, parentId: string, name: string): string | undefined {
  return graph.getNode(parentId)?.childIds.find((id) => graph.getNode(id)?.name === name)
}

function findZoneCardId(graph: TestGraph, briefId: string, zone: BriefZoneId): string {
  const brief = expectDefined(graph.getNode(briefId))
  return expectDefined(findBriefZone(graph, brief, zone), `zone ${zone}`).id
}

test('readBrief 回读默认内容、空素材、空结论、空关联设计区', () => {
  const { figma } = setupToolTest()
  const brief = createBrief(figma)

  const view = expectDefined(readBrief(figma))
  expect(view.briefId).toBe(brief.id)
  expect(view.content).toContain('XX奶茶')
  expect(view.materials).toEqual([])
  expect(view.conclusions).toEqual([])
  expect(view.designs).toEqual([])
})

test('素材区初始为空网格（无示例条目）且 EmptyHint 可见', () => {
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
  expect(names).toContain(BRIEF_EMPTY_HINT_NAME)

  const cardId = findZoneCardId(graph, brief.id, BRIEF_ZONE_MATERIALS)
  const gridId = expectDefined(findChildId(graph, cardId, 'MaterialGrid'))
  expect(expectDefined(graph.getNode(gridId)).childIds).toEqual([])

  const emptyHintId = expectDefined(findChildId(graph, cardId, BRIEF_EMPTY_HINT_NAME))
  expect(expectDefined(graph.getNode(emptyHintId)).visible).not.toBe(false)
})

test('readBrief 回读 appendToBriefAIZone 追加的结论', () => {
  const { figma } = setupToolTest()
  const brief = createBrief(figma)

  expect(appendToBriefAIZone(figma, brief.id, '方向B：活力潮流')).toBe(true)
  const view = expectDefined(readBrief(figma))
  expect(view.conclusions).toEqual([{ text: '方向B：活力潮流', designId: null, designName: null }])
})

test('updateBriefContent 覆写 ContentExample 文本', () => {
  const { graph, figma } = setupToolTest()
  const brief = createBrief(figma)
  const view = expectDefined(readBrief(figma))

  expect(updateBriefContent(figma, view.briefId, '品牌：新茶记，活动：第二杯半价')).toBe(true)

  const cardId = findZoneCardId(graph, brief.id, BRIEF_ZONE_CONTENT)
  const contentInputId = expectDefined(findChildId(graph, cardId, 'ContentInput'))
  const contentTextId = expectDefined(findChildId(graph, contentInputId, 'ContentExample'))
  expect(expectDefined(graph.getNode(contentTextId)).text).toBe('品牌：新茶记，活动：第二杯半价')

  expect(expectDefined(readBrief(figma)).content).toBe('品牌：新茶记，活动：第二杯半价')
  expect(updateBriefContent(figma, 'nonexistent', 'x')).toBe(false)
})

test('addBriefMaterialEntry（字节路）追加条目：IMAGE fill + 暴露 imageNodeId + 隐藏 EmptyHint', () => {
  const { graph, figma } = setupToolTest()
  const brief = createBrief(figma)
  const bytes = new Uint8Array([1, 2, 3, 4])

  const result = addBriefMaterialEntry(figma, brief.id, bytes, '卡片配图')
  if (!('entryId' in result)) throw new Error('expected entryId')
  const { entryId, imageNodeId } = result
  expect(typeof imageNodeId).toBe('string')

  const cardId = findZoneCardId(graph, brief.id, BRIEF_ZONE_MATERIALS)
  const gridId = expectDefined(findChildId(graph, cardId, 'MaterialGrid'))
  const grid = expectDefined(graph.getNode(gridId))
  const gridChildren = grid.childIds.map((id) => expectDefined(graph.getNode(id)))
  expect(gridChildren.map((node) => node.name)).toEqual([BRIEF_ENTRY_NAME])
  expect(gridChildren[0]?.id).toBe(entryId)

  // 条目固定宽换行排布
  expect(grid.layoutWrap).toBe('WRAP')
  expect(grid.counterAxisSpacing).toBe(grid.itemSpacing)
  expect(gridChildren[0]?.width).toBe(180)

  // EmptyHint 在有条目后隐藏
  const emptyHintId = expectDefined(findChildId(graph, cardId, BRIEF_EMPTY_HINT_NAME))
  expect(expectDefined(graph.getNode(emptyHintId)).visible).toBe(false)

  // imageNodeId 直指条目图片位节点（look 的数据源）
  const imageNode = expectDefined(graph.getNode(imageNodeId))
  expect(imageNode.name).toBe('图片位')
  const fill = imageNode.fills[0]
  expect(fill?.type).toBe('IMAGE')
  const hash = fill?.type === 'IMAGE' ? expectDefined(fill.imageHash) : ''
  expect(graph.images.get(hash)).toBeDefined()

  const captionId = expectDefined(findChildId(graph, entryId, 'Caption'))
  expect(expectDefined(graph.getNode(captionId)).text).toBe('卡片配图')

  const view = expectDefined(readBrief(figma))
  expect(view.materials.map((m) => m.caption)).toEqual(['卡片配图'])
  expect(expectDefined(view.materials[0]).imageHash).toBe(hash)
  expect(expectDefined(view.materials[0]).imageNodeId).toBe(imageNodeId)
})

test('addBriefMaterialEntry 接受已注册 image hash；缺失 brief 报错', () => {
  const { figma } = setupToolTest()
  const brief = createBrief(figma)
  const { hash } = figma.createImage(new Uint8Array([9, 9, 9]))

  const result = addBriefMaterialEntry(figma, brief.id, { hash }, '仅参考风格')
  expect('entryId' in result).toBe(true)
  const view = expectDefined(readBrief(figma))
  expect(expectDefined(view.materials[0]).imageHash).toBe(hash)

  const missing = addBriefMaterialEntry(figma, 'nonexistent', new Uint8Array([1]), 'x')
  expect('error' in missing).toBe(true)
})

test('updateMaterialCaption 与 removeBriefMaterial 改写条目', () => {
  const { figma } = setupToolTest()
  const brief = createBrief(figma)
  const added = addBriefMaterialEntry(figma, brief.id, new Uint8Array([1, 2, 3]), '主视觉')
  const entryId = 'entryId' in added ? added.entryId : ''
  expect(entryId).not.toBe('')

  expect(updateMaterialCaption(figma, entryId, '主视觉（定稿）')).toBe(true)
  expect(expectDefined(readBrief(figma)).materials[0]?.caption).toBe('主视觉（定稿）')
  expect(updateMaterialCaption(figma, 'nonexistent', 'x')).toBe(false)

  expect(removeBriefMaterial(figma, entryId)).toBe(true)
  expect(expectDefined(readBrief(figma)).materials).toEqual([])
  expect(removeBriefMaterial(figma, entryId)).toBe(false)

  expect(updateBriefContent(figma, brief.id, 'still works')).toBe(true)
})

test('结构破坏 read-as-null：素材区 / AI结论区 / 关联设计区任一被删', () => {
  const zones: BriefZoneId[] = [BRIEF_ZONE_MATERIALS, BRIEF_ZONE_CONCLUSIONS, BRIEF_ZONE_DESIGNS]
  for (const zone of zones) {
    const { graph, figma } = setupToolTest()
    const brief = createBrief(figma)
    graph.deleteNode(findZoneCardId(graph, brief.id, zone))
    expect(readBrief(figma)).toBe(null)
  }
})

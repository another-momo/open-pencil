/**
 * T52（S4 W2 / T-B1）placement 统一策略契约测试。
 *
 * 验收映射（T52-plan §3 第 1 条「放置」）：读当前页顶层节点
 * absoluteBounds union → 放右侧 +100、y = bounds 顶；空页 → (0,0)。
 * create_brief 走同一策略（工具级断言）。
 */

import { expect, test } from 'bun:test'

import { BRIEF_TOOLS } from '#core/tools/fork/marketing'
import {
  PLACEMENT_GAP,
  findPlacementPosition,
  getPageContentBounds
} from '#core/tools/fork/placement'

import { expectDefined } from '#tests/helpers/assert'
import { setupToolTest } from '#tests/helpers/tools'

test('PLACEMENT_GAP 钉扎为 100', () => {
  expect(PLACEMENT_GAP).toBe(100)
})

test('空页 → 原点 (0,0)；getPageContentBounds 为 null', () => {
  const { figma } = setupToolTest()
  expect(getPageContentBounds(figma)).toBe(null)
  expect(findPlacementPosition(figma, { width: 1252, height: 850 })).toEqual({ x: 0, y: 0 })
})

test('非空页 → 右侧 +100，y 跟随 bounds 顶（多节点 union）', () => {
  const { graph, figma } = setupToolTest()
  const pageId = figma.currentPage.id
  graph.createNode('FRAME', pageId, { x: 10, y: 20, width: 100, height: 50 })
  graph.createNode('FRAME', pageId, { x: -40, y: 60, width: 30, height: 30 })

  // union: x −40..110, y 20..80
  expect(getPageContentBounds(figma)).toEqual({ x: -40, y: 20, width: 150, height: 70 })
  expect(findPlacementPosition(figma, { width: 1252, height: 850 })).toEqual({
    x: 110 + PLACEMENT_GAP,
    y: 20
  })
})

test('单次调用结果随页面内容增长右移（批量循环每次重读 bounds 的语义基础）', () => {
  const { graph, figma } = setupToolTest()
  const pageId = figma.currentPage.id
  const first = findPlacementPosition(figma, { width: 100, height: 100 })
  expect(first).toEqual({ x: 0, y: 0 })
  graph.createNode('FRAME', pageId, { x: first.x, y: first.y, width: 100, height: 100 })
  const second = findPlacementPosition(figma, { width: 100, height: 100 })
  expect(second).toEqual({ x: 100 + PLACEMENT_GAP, y: 0 })
})

test('create_brief 经统一策略放置：空页原点 / 有内容时右侧 +100 且 y 对齐 bounds 顶', () => {
  const { graph, figma } = setupToolTest()
  const createBrief = expectDefined(
    BRIEF_TOOLS.find((tool) => tool.name === 'create_brief'),
    'create_brief tool'
  )

  const first = createBrief.execute(figma, {}) as { briefId: string; created: boolean }
  expect(first.created).toBe(true)
  const firstBrief = expectDefined(graph.getNode(first.briefId))
  expect(firstBrief.x).toBe(0)
  expect(firstBrief.y).toBe(0)

  // 既有内容时，新 brief 落在 union bounds 右侧且 y 对齐 bounds 顶
  const { graph: graph2, figma: figma2 } = setupToolTest()
  graph2.createNode('FRAME', figma2.currentPage.id, { x: 0, y: 30, width: 1080, height: 1080 })
  const placed = createBrief.execute(figma2, {}) as { briefId: string; created: boolean }
  const brief2 = expectDefined(graph2.getNode(placed.briefId))
  expect(brief2.x).toBe(1080 + PLACEMENT_GAP)
  expect(brief2.y).toBe(30)
})

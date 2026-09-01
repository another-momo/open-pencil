/**
 * T54：放置语义 + 批量放置竞态回归钉扎（验收锚 T54-plan §3.1，
 * 00 #10：批量帧创建循环内每次重读页面 bounds）。
 *
 * 竞态场景还原：旧实现把 bounds 读取提到循环外（或批量并发同时读），
 * 所有新帧落在同一位置重叠。修复后 = 逐个 begin（串行）+ 每次重读
 * bounds，后一帧必须落在前一帧右侧。
 */
import { describe, expect, test } from 'bun:test'

import { FigmaAPI, SceneGraph } from '@open-pencil/core'
import { IMAGE_GEN_TOOLS } from '@open-pencil/core/tools/fork/image-gen'
import {
  findPlacementPosition,
  findPlacementPositionOnPage,
  getPageContentBounds,
  getPageContentBoundsOnPage,
  PLACEMENT_GAP
} from '@open-pencil/core/tools/fork/placement'

import { expectDefined } from '#tests/helpers/assert'

function setup() {
  const graph = new SceneGraph()
  const figma = new FigmaAPI(graph)
  return { graph, figma, pageId: figma.currentPageId }
}

const beginTool = expectDefined(
  IMAGE_GEN_TOOLS.find((tool) => tool.name === 'image_gen_begin'),
  'image_gen_begin tool'
)

interface BeginPayload {
  id: string
  width: number
  height: number
  replaced: boolean
  images: string[]
  error?: string
}

async function begin(figma: FigmaAPI, prompt: string, width: number, height: number) {
  return (await beginTool.execute(figma, {
    prompt,
    width,
    height
  })) as BeginPayload
}

describe('findPlacementPosition', () => {
  test('空页 → 原点', () => {
    const { figma } = setup()
    expect(getPageContentBounds(figma)).toBeNull()
    expect(findPlacementPosition(figma, { width: 100, height: 100 })).toEqual({ x: 0, y: 0 })
  })

  test('有内容 → bounds 右侧 +100，y 跟随 bounds 顶', () => {
    const { graph, figma, pageId } = setup()
    graph.createNode('FRAME', pageId, { name: 'a', x: 50, y: 300, width: 400, height: 200 })
    graph.createNode('FRAME', pageId, { name: 'b', x: -500, y: 900, width: 100, height: 100 })
    const position = findPlacementPosition(figma, { width: 100, height: 100 })
    // bounds: x=-500..450, y=300..1000 → x = 450+100, y = 300
    expect(position).toEqual({ x: 450 + PLACEMENT_GAP, y: 300 })
  })
})

describe('findPlacementPositionOnPage（T66 ⑤ 跨页 seam）', () => {
  test('读指定页顶层 bounds，与 currentPage 无关；空页 → 原点', () => {
    const { graph, figma, pageId } = setup()
    const page2 = graph.addPage('Page 2')
    graph.createNode('FRAME', page2.id, { name: 'x', x: 10, y: 5, width: 90, height: 50 })

    // currentPage 仍是 pageId（空页），seam 读取的是显式指定的 page2
    expect(figma.currentPageId).toBe(pageId)
    expect(getPageContentBoundsOnPage(graph, page2.id)).toEqual({
      x: 10,
      y: 5,
      width: 90,
      height: 50
    })
    expect(findPlacementPositionOnPage(graph, page2.id, { width: 10, height: 10 })).toEqual({
      x: 10 + 90 + PLACEMENT_GAP,
      y: 5
    })

    // 空的指定页 → null / 原点
    expect(getPageContentBoundsOnPage(graph, pageId)).toBeNull()
    expect(findPlacementPositionOnPage(graph, pageId, { width: 1, height: 1 })).toEqual({
      x: 0,
      y: 0
    })
  })
})

describe('批量放置逐次重读 bounds（00 #10 竞态回归）', () => {
  test('连续两次 begin：第二帧落在第一帧右侧，不重叠', async () => {
    const { graph, figma } = setup()
    const first = await begin(figma, 'candidate A', 1024, 1024)
    const second = await begin(figma, 'candidate B', 1024, 1024)
    expect(first.error).toBeUndefined()
    expect(second.error).toBeUndefined()
    const firstNode = expectDefined(graph.getNode(first.id), 'first frame')
    const secondNode = expectDefined(graph.getNode(second.id), 'second frame')
    expect(secondNode.x).toBeGreaterThanOrEqual(firstNode.x + firstNode.width)
    expect(secondNode.y).toBe(firstNode.y)
  })

  test('第三次 begin 看到前两次（页 bounds 持续右移）', async () => {
    const { graph, figma } = setup()
    const a = await begin(figma, 'A', 1024, 1024)
    const b = await begin(figma, 'B', 1024, 1024)
    const c = await begin(figma, 'C', 1024, 1024)
    const xs = [a, b, c].map((item) => expectDefined(graph.getNode(item.id), 'frame').x)
    expect(xs[1]).toBeGreaterThan(xs[0])
    expect(xs[2]).toBeGreaterThan(xs[1])
  })
})

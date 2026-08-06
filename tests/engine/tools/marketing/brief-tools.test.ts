import { describe, expect, test } from 'bun:test'

import {
  BRIEF_CONTENT_GAP,
  BRIEF_ESTIMATED_HEIGHT,
  BRIEF_WIDTH,
  addBriefMaterialEntry,
  createBrief,
  findBrief,
  getPageContentBounds,
  resolveBriefPlacement
} from '@open-pencil/core/tools'

import { expectDefined } from '#tests/helpers/assert'
import { getTool, setupToolTest } from '#tests/helpers/tools'

interface ReadBriefResult {
  brief?: null
  briefId?: string
  content?: string
  materials?: Array<{
    entryId: string
    imageNodeId: string | null
    caption: string
    hasImage: boolean
  }>
  conclusions?: string[]
}

interface CreateBriefResult {
  briefId: string
  created: boolean
}

describe('read_brief tool', () => {
  test('returns { brief: null } when no brief exists', () => {
    const { figma } = setupToolTest()
    const result = getTool('read_brief').execute(figma, {}) as ReadBriefResult
    expect(result.brief).toBe(null)
    expect(result.briefId).toBeUndefined()
  })

  test('reads back content and empty materials/conclusions', () => {
    const { figma } = setupToolTest()
    const brief = createBrief(figma)

    const result = getTool('read_brief').execute(figma, {}) as ReadBriefResult
    expect(result.brief).toBeUndefined()
    expect(result.briefId).toBe(brief.id)
    expect(result.content).toContain('XX奶茶')
    expect(result.materials).toEqual([])
    expect(result.conclusions).toEqual([])
  })

  test('material entries expose imageNodeId, caption, and hasImage', () => {
    const { graph, figma } = setupToolTest()
    const brief = createBrief(figma)
    const added = addBriefMaterialEntry(figma, brief.id, new Uint8Array([1, 2, 3]), '主视觉')
    const entryId = 'entryId' in added ? added.entryId : ''

    const result = getTool('read_brief').execute(figma, {}) as ReadBriefResult
    const material = expectDefined(result.materials?.[0])
    expect(material.entryId).toBe(entryId)
    expect(material.caption).toBe('主视觉')
    expect(material.hasImage).toBe(true)

    // imageNodeId points at the entry's 图片位 node so look can read the image directly
    const imageNode = expectDefined(
      material.imageNodeId ? graph.getNode(material.imageNodeId) : undefined
    )
    expect(imageNode.name).toBe('图片位')
    expect(imageNode.fills[0]?.type).toBe('IMAGE')
  })
})

describe('create_brief tool', () => {
  test('creates an empty brief on an empty page', () => {
    const { figma } = setupToolTest()
    const result = getTool('create_brief').execute(figma, {}) as CreateBriefResult
    expect(result.created).toBe(true)
    const brief = expectDefined(findBrief(figma))
    expect(brief.id).toBe(result.briefId)
  })

  test('a second call creates nothing and returns the existing brief id', () => {
    const { figma } = setupToolTest()
    const first = getTool('create_brief').execute(figma, {}) as CreateBriefResult
    const second = getTool('create_brief').execute(figma, {}) as CreateBriefResult
    expect(second.created).toBe(false)
    expect(second.briefId).toBe(first.briefId)
  })
})

interface AppendConclusionResult {
  ok: boolean
  note?: string
}

describe('append_brief_conclusion tool', () => {
  test('returns { ok: false } when no brief exists', () => {
    const { figma } = setupToolTest()
    const result = getTool('append_brief_conclusion').execute(figma, {
      text: '方向A：水彩萌趣'
    }) as AppendConclusionResult
    expect(result.ok).toBe(false)
  })

  test('appends a styled line readable via read_brief, in call order', () => {
    const { figma } = setupToolTest()
    createBrief(figma)

    const tool = getTool('append_brief_conclusion')
    expect((tool.execute(figma, { text: '方向A：水彩萌趣' }) as AppendConclusionResult).ok).toBe(
      true
    )
    expect((tool.execute(figma, { text: '字体：Alibaba PuHuiTi' }) as AppendConclusionResult).ok).toBe(
      true
    )

    const view = getTool('read_brief').execute(figma, {}) as ReadBriefResult
    expect(view.conclusions).toEqual(['· 方向A：水彩萌趣', '· 字体：Alibaba PuHuiTi'])
  })

  test('rejects blank text without touching the brief', () => {
    const { figma } = setupToolTest()
    createBrief(figma)

    const result = getTool('append_brief_conclusion').execute(figma, {
      text: '   '
    }) as AppendConclusionResult
    expect(result.ok).toBe(false)

    const view = getTool('read_brief').execute(figma, {}) as ReadBriefResult
    expect(view.conclusions).toEqual([])
  })
})

describe('brief placement (collision detection)', () => {
  const center = { x: 0, y: 0 }

  test('centers on the viewport center when there is no content', () => {
    expect(resolveBriefPlacement(center, null)).toEqual({
      x: -BRIEF_WIDTH / 2,
      y: -BRIEF_ESTIMATED_HEIGHT / 2
    })
  })

  test('centers when the centered rect does not intersect content', () => {
    const bounds = { x: 2000, y: 2000, width: 500, height: 500 }
    expect(resolveBriefPlacement(center, bounds)).toEqual({
      x: -BRIEF_WIDTH / 2,
      y: -BRIEF_ESTIMATED_HEIGHT / 2
    })
  })

  test('moves right of content (+ gap), vertically centered, on intersection', () => {
    const bounds = { x: -100, y: -100, width: 200, height: 200 }
    expect(resolveBriefPlacement(center, bounds)).toEqual({
      x: bounds.x + bounds.width + BRIEF_CONTENT_GAP,
      y: -BRIEF_ESTIMATED_HEIGHT / 2
    })
  })

  test('getPageContentBounds unions top-level nodes and is null on an empty page', () => {
    const { graph, figma } = setupToolTest()
    expect(getPageContentBounds(figma)).toBe(null)

    const pageId = figma.currentPage.id
    graph.createNode('FRAME', pageId, { x: 10, y: 20, width: 100, height: 50 })
    graph.createNode('FRAME', pageId, { x: -40, y: 60, width: 30, height: 30 })

    expect(getPageContentBounds(figma)).toEqual({ x: -40, y: 20, width: 150, height: 70 })
  })

  test('create_brief places the brief right of existing content', () => {
    const { graph, figma } = setupToolTest()
    const pageId = figma.currentPage.id
    graph.createNode('FRAME', pageId, { x: 0, y: 0, width: 1080, height: 1080 })

    const result = getTool('create_brief').execute(figma, {}) as CreateBriefResult
    const brief = expectDefined(graph.getNode(result.briefId))
    expect(brief.x).toBe(1080 + BRIEF_CONTENT_GAP)
  })
})

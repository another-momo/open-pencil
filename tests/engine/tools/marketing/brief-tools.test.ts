import { describe, expect, test } from 'bun:test'

import {
  BRIEF_BINDING_LABEL_NAME,
  BRIEF_CONTENT_GAP,
  BRIEF_ESTIMATED_HEIGHT,
  BRIEF_WIDTH,
  addBriefMaterialEntry,
  createBrief,
  findBrief,
  getPageContentBounds,
  resolveBriefPlacement,
  setActiveMaterialType
} from '@open-pencil/core/tools'

import { expectDefined } from '#tests/helpers/assert'
import { attachMiniLibrary } from '#tests/helpers/marketing-library'
import { getTool, setupToolTest } from '#tests/helpers/tools'

// Default active type used by brief tests — historical default fixture
// (long-image product post). Tests that need a different type override it.
setActiveMaterialType({ id: 'product_long', label: '产品长图', size: { width: 750, height: null } })

interface ReadBriefResult {
  brief?: null
  ambiguous?: boolean
  candidates?: Array<{ briefId: string; boundDesigns: string[] }>
  briefId?: string
  boundDesigns?: Array<{ rootFrameId: string; name: string; page: string | null }>
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
  boundTo?: string
}

interface SetupLikeResult {
  error?: string
  rootFrameId?: string
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
    expect(
      (tool.execute(figma, { text: '字体：Alibaba PuHuiTi' }) as AppendConclusionResult).ok
    ).toBe(true)

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

describe('brief ↔ design binding', () => {
  function bindingLabelText(graph: ReturnType<typeof setupToolTest>['graph'], briefId: string) {
    const walk = (nodeId: string): string | undefined => {
      const node = graph.getNode(nodeId)
      if (!node) return undefined
      if (node.type === 'TEXT' && node.name === BRIEF_BINDING_LABEL_NAME) return node.text
      for (const childId of node.childIds) {
        const found = walk(childId)
        if (found) return found
      }
      return undefined
    }
    return walk(briefId)
  }

  test('create_brief seeds initial_content verbatim and binds to the active design', () => {
    const { figma } = setupToolTest()
    attachMiniLibrary(figma.graph)
    const setup = getTool('setup_material_type').execute(figma, {
      id: 'product_long'
    }) as SetupLikeResult

    const result = getTool('create_brief').execute(figma, {
      initial_content: '做一个「如何用AI做长图」的讲座邀请长图'
    }) as CreateBriefResult
    expect(result.created).toBe(true)
    expect(result.boundTo).toBe(setup.rootFrameId)

    const view = getTool('read_brief').execute(figma, {}) as ReadBriefResult
    expect(view.content).toBe('做一个「如何用AI做长图」的讲座邀请长图')
    expect(view.boundDesigns).toEqual([
      { rootFrameId: setup.rootFrameId, name: '产品长图', page: 'Page 1' }
    ])
  })

  test('setup binds an existing unbound brief and writes the visible binding line', () => {
    const { graph, figma } = setupToolTest()
    attachMiniLibrary(graph)
    const brief = createBrief(figma) // created before any design — unbound

    getTool('setup_material_type').execute(figma, { id: 'product_long' }) as SetupLikeResult

    const view = getTool('read_brief').execute(figma, {}) as ReadBriefResult
    expect(view.briefId).toBe(brief.id)
    expect(view.boundDesigns?.length).toBe(1)
    expect(bindingLabelText(graph, brief.id)).toBe('关联：产品长图 · Page 1')
  })

  test('the brief bound to the active design wins across pages', () => {
    const { graph, figma } = setupToolTest()
    attachMiniLibrary(graph)
    getTool('setup_material_type').execute(figma, { id: 'product_long' }) as SetupLikeResult
    const bound = getTool('create_brief').execute(figma, {}) as CreateBriefResult

    const page2 = graph.addPage('Page 2')
    figma.currentPage = expectDefined(figma.getNodeById(page2.id))
    createBrief(figma) // an unbound brief sitting on Page 2

    const view = getTool('read_brief').execute(figma, {}) as ReadBriefResult
    expect(view.briefId).toBe(bound.briefId)
  })

  test('multiple briefs with no binding to the active design read as ambiguous', () => {
    const { figma } = setupToolTest()
    createBrief(figma)
    createBrief(figma)

    const view = getTool('read_brief').execute(figma, {}) as ReadBriefResult
    expect(view.brief).toBe(null)
    expect(view.ambiguous).toBe(true)
    expect(view.candidates?.length).toBe(2)
  })

  test('conclusions are grouped under the active design name', () => {
    const { figma } = setupToolTest()
    attachMiniLibrary(figma.graph)
    getTool('setup_material_type').execute(figma, { id: 'product_long' }) as SetupLikeResult
    getTool('create_brief').execute(figma, {})

    const appended = getTool('append_brief_conclusion').execute(figma, {
      text: '方向B：活力几何'
    }) as AppendConclusionResult
    expect(appended.ok).toBe(true)

    const view = getTool('read_brief').execute(figma, {}) as ReadBriefResult
    expect(view.conclusions).toEqual(['产品长图', '· 方向B：活力几何'])
  })
})

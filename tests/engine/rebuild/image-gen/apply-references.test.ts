/**
 * T54：参考图提取三规则 + `[image N]` 错位防护 + protectedRedirect 钉扎
 * （验收锚 T54-plan §3.1；移植自源 image-gen/apply.ts 语义）。
 */
import { describe, expect, test } from 'bun:test'

import { FigmaAPI, SceneGraph } from '@open-pencil/core'
import { beginImageGen, extractReferenceImages } from '@open-pencil/core/tools/fork/image-gen/apply'
import { snapshotBeforeOverwrite } from '@open-pencil/core/tools/fork/image-gen/history'

import { expectDefined } from '#tests/helpers/assert'

const REF_BYTES_A = new Uint8Array([1, 2, 3, 4])
const REF_BYTES_B = new Uint8Array([5, 6, 7, 8])
const RENDERED_BYTES = new Uint8Array([9, 9, 9])

function setup() {
  const graph = new SceneGraph()
  const figma = new FigmaAPI(graph)
  return { graph, figma, pageId: figma.currentPageId }
}

function createImageNode(
  graph: SceneGraph,
  pageId: string,
  opts: { hash?: string; withChild?: boolean; name?: string } = {}
) {
  const hash = opts.hash ?? 'hash-a'
  graph.images.set(hash, REF_BYTES_A)
  const node = graph.createNode('RECTANGLE', pageId, {
    name: opts.name ?? 'img',
    width: 1024,
    height: 1024,
    fills: [
      {
        type: 'IMAGE',
        color: { r: 1, g: 1, b: 1, a: 1 },
        opacity: 1,
        visible: true,
        imageHash: hash,
        imageScaleMode: 'FILL'
      }
    ]
  })
  if (opts.withChild) {
    graph.createNode('TEXT', node.id, { name: 'caption', width: 100, height: 20 })
  }
  return node
}

describe('参考图提取三规则', () => {
  test('规则一：IMAGE fill 无 composite → 原始字节无损回出（不渲染）', async () => {
    const { graph, figma, pageId } = setup()
    const node = createImageNode(graph, pageId)
    let renderCalled = false
    figma.exportImage = async () => {
      renderCalled = true
      return RENDERED_BYTES
    }
    const { images, note } = await extractReferenceImages(figma, [{ id: node.id }], 'edit it')
    expect(images).toHaveLength(1)
    expect([...images[0]]).toEqual([...REF_BYTES_A])
    expect(renderCalled).toBe(false)
    expect(note).toBeUndefined()
  })

  test('规则二：IMAGE fill 但有子节点 → 仅图像字节 + teach 提示子节点未含', async () => {
    const { graph, figma, pageId } = setup()
    const node = createImageNode(graph, pageId, { withChild: true })
    const { images, note } = await extractReferenceImages(figma, [{ id: node.id }], 'edit it')
    expect(images).toHaveLength(1)
    expect(note).toContain('child node(s) (text/decoration) were NOT included')
    expect(note).toContain('"composite":true')
  })

  test('规则三：composite=true → 渲染外观；纯图节点提示 composite 冗余', async () => {
    const { graph, figma, pageId } = setup()
    const node = createImageNode(graph, pageId)
    figma.exportImage = async () => RENDERED_BYTES
    const { images, note } = await extractReferenceImages(
      figma,
      [{ id: node.id, composite: true }],
      'edit it'
    )
    expect([...images[0]]).toEqual([...RENDERED_BYTES])
    expect(note).toContain('drop "composite"')
  })

  test('无 IMAGE fill 节点 → 自动渲染', async () => {
    const { graph, figma, pageId } = setup()
    const frame = graph.createNode('FRAME', pageId, { name: 'layout', width: 100, height: 100 })
    figma.exportImage = async () => RENDERED_BYTES
    const { images } = await extractReferenceImages(figma, [{ id: frame.id }], 'ref')
    expect([...images[0]]).toEqual([...RENDERED_BYTES])
  })

  test('全部提取失败 → 抛错（不存在节点）', async () => {
    const { figma } = setup()
    await expect(extractReferenceImages(figma, [{ id: '9:99' }], 'ref')).rejects.toThrow(
      'Failed to extract all reference image(s): 9:99'
    )
  })

  test('存在但无 IMAGE fill 且 exportImage 不可用 → 错误带提示', async () => {
    const { graph, figma, pageId } = setup()
    const frame = graph.createNode('FRAME', pageId, { name: 'layout', width: 100, height: 100 })
    // figma.exportImage 缺省不可用
    await expect(extractReferenceImages(figma, [{ id: frame.id }], 'ref')).rejects.toThrow(
      'no IMAGE fill and could not be rendered'
    )
  })
})

describe('[image N] 错位防护', () => {
  test('有跳过 + prompt 含 [image N] → 响亮报错而非静默错位', async () => {
    const { graph, figma, pageId } = setup()
    const ok = createImageNode(graph, pageId, { hash: 'hash-a' })
    await expect(
      extractReferenceImages(
        figma,
        [{ id: ok.id }, { id: '9:99' }],
        'merge [image 1] and [image 2]'
      )
    ).rejects.toThrow('markers that would misalign')
  })

  test('有跳过但无 [image N] 标记 → 部分成功 + note 记录跳过', async () => {
    const { graph, figma, pageId } = setup()
    const ok = createImageNode(graph, pageId, { hash: 'hash-a' })
    const { images, note } = await extractReferenceImages(
      figma,
      [{ id: ok.id }, { id: '9:99' }],
      'merge these'
    )
    expect(images).toHaveLength(1)
    expect(note).toContain('Used 1/2 reference image(s); skipped: 9:99')
  })
})

describe('protectedRedirect（经 beginImageGen）', () => {
  test('replace_id 指向历史快照 → 不覆盖，改放新帧（尺寸随保护节点）', async () => {
    const { graph, figma, pageId } = setup()
    const target = createImageNode(graph, pageId, { hash: 'hash-b' })
    graph.images.set('hash-b', REF_BYTES_B)
    // 先把 target 快照进历史容器，再把 replace_id 指向该历史条目
    const snapshot = expectDefined(snapshotBeforeOverwrite(graph, target.id), 'history snapshot')
    const result = await beginImageGen(figma, {
      prompt: 'regenerate',
      replaceId: snapshot.id
    })
    expect(result.replaced).toBe(false)
    expect(result.targetId).not.toBe(snapshot.id)
    expect(result.note).toContain('was NOT overwritten')
    expect(result.width).toBe(1024)
    expect(result.height).toBe(1024)
    // 新帧已建且不在历史容器内
    const frame = expectDefined(graph.getNode(result.targetId), 'new frame')
    expect(frame.type).toBe('FRAME')
  })

  test('普通 replace_id → 直接用目标节点（不新建帧）', async () => {
    const { graph, figma, pageId } = setup()
    const target = createImageNode(graph, pageId)
    const result = await beginImageGen(figma, { prompt: 'edit', replaceId: target.id })
    expect(result.replaced).toBe(true)
    expect(result.targetId).toBe(target.id)
    // 目标无显式尺寸请求 → API 尺寸继承目标节点尺寸
    expect(result.width).toBe(1024)
  })
})

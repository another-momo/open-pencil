/**
 * T91a：sharedPluginData 在 .fig 序列化往返中保留的钉扎
 *
 * 验证点：brief / design 标识协议（`role` / `uniqueId` / `bound-designs` 等
 * `open-pencil-marketing` namespace 下的 shared pluginData）随 .fig 导出
 * → 重新导入后值不变。这是刷新页面恢复设计区状态不丢失的根底保障。
 *
 * 历史：T90 之前的测试只覆盖非 namespace 的 `pluginData`（Figma 内部
 * bookkeeping）；T91a 补上 namespace 入口的 round-trip 验证。
 */
import { beforeAll, describe, expect, test } from 'bun:test'

import {
  exportFigFile,
  FigmaAPI,
  initCodec,
  parseFigFile,
  SceneGraph
} from '@open-pencil/core'
import { parseFigBuffer } from '@open-pencil/fig'

const NS = 'open-pencil-marketing'

describe('fig roundtrip sharedPluginData', () => {
  beforeAll(async () => {
    await initCodec()
  })

  test('setSharedPluginData 多 key 在 .fig 导出/导入后值不变', async () => {
    const graph = new SceneGraph()
    const figma = new FigmaAPI(graph)
    const page = graph.getPages()[0]

    // 模拟一个 brief 根节点，写入三 key
    const brief = graph.createNode('FRAME', page.id, { name: '需求单 1' })
    const briefNode = figma.wrapNode(brief.id)
    briefNode.setSharedPluginData(NS, 'role', 'brief')
    briefNode.setSharedPluginData(NS, 'uniqueId', '550e8400-e29b-41d4-a716-446655440000')
    briefNode.setSharedPluginData(NS, 'bound-designs', '0:188')

    const reimported = await parseFigFile((await exportFigFile(graph)).buffer as ArrayBuffer)
    const reimportedBrief = [...reimported.getAllNodes()].find((n) => n.name === '需求单 1')

    expect(reimportedBrief).toBeDefined()
    if (!reimportedBrief) return
    const reFigma = new FigmaAPI(reimported)
    const reBrief = reFigma.wrapNode(reimportedBrief.id)

    expect(reBrief.getSharedPluginData(NS, 'role')).toBe('brief')
    expect(reBrief.getSharedPluginData(NS, 'uniqueId')).toBe(
      '550e8400-e29b-41d4-a716-446655440000'
    )
    expect(reBrief.getSharedPluginData(NS, 'bound-designs')).toBe('0:188')
  })

  test('多 namespace 互不干扰', async () => {
    const graph = new SceneGraph()
    const figma = new FigmaAPI(graph)
    const page = graph.getPages()[0]
    const node = graph.createNode('RECTANGLE', page.id, { name: 'Multi-ns node' })
    const proxy = figma.wrapNode(node.id)

    proxy.setSharedPluginData('open-pencil-marketing', 'role', 'brief')
    proxy.setSharedPluginData('open-pencil', 'foo', 'bar')
    proxy.setSharedPluginData('acme-plugin', 'token', 'xyz')

    const reimported = await parseFigFile((await exportFigFile(graph)).buffer as ArrayBuffer)
    const reimportedNode = [...reimported.getAllNodes()].find((n) => n.name === 'Multi-ns node')
    if (!reimportedNode) throw new Error('reimported node not found')
    const reFigma = new FigmaAPI(reimported)
    const re = reFigma.wrapNode(reimportedNode.id)

    expect(re.getSharedPluginData('open-pencil-marketing', 'role')).toBe('brief')
    expect(re.getSharedPluginData('open-pencil', 'foo')).toBe('bar')
    expect(re.getSharedPluginData('acme-plugin', 'token')).toBe('xyz')
  })

  test('写后清除（value = ""）也参与 round-trip', async () => {
    const graph = new SceneGraph()
    const figma = new FigmaAPI(graph)
    const page = graph.getPages()[0]
    const node = graph.createNode('RECTANGLE', page.id, { name: 'Cleared key' })
    const proxy = figma.wrapNode(node.id)

    proxy.setSharedPluginData(NS, 'role', 'brief')
    proxy.setSharedPluginData(NS, 'uniqueId', 'tmp')
    proxy.setSharedPluginData(NS, 'uniqueId', '') // 清除

    const reimported = await parseFigFile((await exportFigFile(graph)).buffer as ArrayBuffer)
    const reimportedNode = [...reimported.getAllNodes()].find((n) => n.name === 'Cleared key')
    if (!reimportedNode) throw new Error('reimported node not found')
    const reFigma = new FigmaAPI(reimported)
    const re = reFigma.wrapNode(reimportedNode.id)

    expect(re.getSharedPluginData(NS, 'role')).toBe('brief')
    expect(re.getSharedPluginData(NS, 'uniqueId')).toBe('')
  })

  test('UUID 含 dash 在序列化后不被破坏', async () => {
    const graph = new SceneGraph()
    const figma = new FigmaAPI(graph)
    const page = graph.getPages()[0]
    const node = graph.createNode('RECTANGLE', page.id, { name: 'UUID-stability' })
    const proxy = figma.wrapNode(node.id)
    const uuids = [
      '550e8400-e29b-41d4-a716-446655440000',
      '00000000-0000-0000-0000-000000000001',
      crypto.randomUUID()
    ]

    for (const [i, uuid] of uuids.entries()) {
      proxy.setSharedPluginData(NS, `id-${i}`, uuid)
    }

    const reimported = await parseFigFile((await exportFigFile(graph)).buffer as ArrayBuffer)
    const reimportedNode = [...reimported.getAllNodes()].find((n) => n.name === 'UUID-stability')
    if (!reimportedNode) throw new Error('reimported node not found')
    const reFigma = new FigmaAPI(reimported)
    const re = reFigma.wrapNode(reimportedNode.id)

    for (const [i, uuid] of uuids.entries()) {
      expect(re.getSharedPluginData(NS, `id-${i}`)).toBe(uuid)
    }
  })

  test('pluginData 在 .fig 字节里也可见（Kiwi schema 内部表示）', async () => {
    const graph = new SceneGraph()
    const figma = new FigmaAPI(graph)
    const page = graph.getPages()[0]
    const node = graph.createNode('RECTANGLE', page.id, { name: 'Raw pluginData' })
    figma.wrapNode(node.id).setSharedPluginData(NS, 'role', 'brief')

    const bytes = await exportFigFile(graph)
    const decoded = parseFigBuffer(
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
    )
    const rawNode = decoded.nodeChanges.find((nc) => nc.name === 'Raw pluginData')

    expect(rawNode?.pluginData).toBeDefined()
    if (!rawNode?.pluginData) return
    const hit = rawNode.pluginData.find(
      (e) => e.pluginID === NS && e.key === `${NS}/role`
    )
    expect(hit).toBeDefined()
    if (!hit) return
    expect(hit.value).toBe('brief')
  })
})

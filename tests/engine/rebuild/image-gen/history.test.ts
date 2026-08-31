/**
 * T54：snapshotBeforeOverwrite 钉扎（验收锚 T54-plan §3.1）——
 * 仅 IMAGE fill 才快照；同 hash 去重；容器/条目标记与 isInImageHistory；
 * 克隆剥离外来标记；营销根锚定。
 */
import { describe, expect, test } from 'bun:test'

import { FigmaAPI, SceneGraph } from '@open-pencil/core'
import {
  isInImageHistory,
  snapshotBeforeOverwrite
} from '@open-pencil/core/tools/fork/image-gen/history'

import { expectDefined } from '#tests/helpers/assert'

function setup() {
  const graph = new SceneGraph()
  const figma = new FigmaAPI(graph)
  return { graph, figma, pageId: figma.currentPageId }
}

function imageFill(hash: string) {
  return {
    type: 'IMAGE' as const,
    color: { r: 1, g: 1, b: 1, a: 1 },
    opacity: 1,
    visible: true,
    imageHash: hash,
    imageScaleMode: 'FILL' as const
  }
}

function createTarget(graph: SceneGraph, pageId: string, hash = 'hash-1', name = 'hero') {
  graph.images.set(hash, new Uint8Array([1, 2, 3]))
  return graph.createNode('RECTANGLE', pageId, {
    name,
    x: 0,
    y: 0,
    width: 1024,
    height: 1024,
    fills: [imageFill(hash)]
  })
}

function markerOf(graph: SceneGraph, id: string, key: string): string | undefined {
  return graph
    .getNode(id)
    ?.pluginData.find((entry) => entry.pluginId === 'open-pencil-image-gen' && entry.key === key)
    ?.value
}

describe('snapshotBeforeOverwrite', () => {
  test('IMAGE fill 目标 → 克隆进历史容器（标记齐全）', () => {
    const { graph, pageId } = setup()
    const target = createTarget(graph, pageId)
    const snapshot = expectDefined(snapshotBeforeOverwrite(graph, target.id), 'snapshot')

    const clone = expectDefined(graph.getNode(snapshot.id), 'clone node')
    expect(clone.name).toBe('hero · v1')
    expect(markerOf(graph, clone.id, 'role')).toBe('image-history-entry')
    expect(markerOf(graph, clone.id, 'source-target')).toBe(target.id)
    expect(markerOf(graph, clone.id, 'source-hash')).toBe('hash-1')
    expect(markerOf(graph, clone.id, 'version')).toBe('1')

    const container = expectDefined(graph.getNode(clone.parentId ?? ''), 'container')
    expect(container.name).toBe('历史图片备份')
    expect(markerOf(graph, container.id, 'role')).toBe('image-history-container')
    expect(container.parentId).toBe(pageId)

    // isInImageHistory：容器、条目、条目后代均为 true；普通节点 false
    expect(isInImageHistory(graph, container.id)).toBe(true)
    expect(isInImageHistory(graph, clone.id)).toBe(true)
    expect(isInImageHistory(graph, target.id)).toBe(false)
  })

  test('非 IMAGE fill（纯色）→ 不快照', () => {
    const { graph, pageId } = setup()
    const node = graph.createNode('RECTANGLE', pageId, {
      name: 'solid',
      width: 100,
      height: 100,
      fills: [{ type: 'SOLID', color: { r: 1, g: 0, b: 0, a: 1 }, opacity: 1, visible: true }]
    })
    expect(snapshotBeforeOverwrite(graph, node.id)).toBeUndefined()
  })

  test('同 hash 去重：连续两次快照同一未变图像 → 第二次 no-op', () => {
    const { graph, pageId } = setup()
    const target = createTarget(graph, pageId)
    expect(snapshotBeforeOverwrite(graph, target.id)).toBeDefined()
    expect(snapshotBeforeOverwrite(graph, target.id)).toBeUndefined()
  })

  test('hash 变化 → 新版本 v2', () => {
    const { graph, pageId } = setup()
    const target = createTarget(graph, pageId)
    snapshotBeforeOverwrite(graph, target.id)
    graph.images.set('hash-2', new Uint8Array([4, 5, 6]))
    graph.updateNode(target.id, { fills: [imageFill('hash-2')] })
    const second = expectDefined(snapshotBeforeOverwrite(graph, target.id), 'v2 snapshot')
    expect(markerOf(graph, second.id, 'version')).toBe('2')
    expect(second.name).toBe('hero · v2')
  })

  test('克隆剥离外来 pluginData 标记', () => {
    const { graph, pageId } = setup()
    const target = createTarget(graph, pageId)
    graph.updateNode(target.id, {
      pluginData: [{ pluginId: 'open-pencil-marketing', key: 'role', value: 'marketing-root' }]
    })
    const snapshot = expectDefined(snapshotBeforeOverwrite(graph, target.id), 'snapshot')
    const clone = expectDefined(graph.getNode(snapshot.id), 'clone')
    expect(
      clone.pluginData.find((entry) => entry.pluginId === 'open-pencil-marketing')
    ).toBeUndefined()
  })

  test('容器锚定营销根右侧（有 marketing-root 时）', () => {
    const { graph, pageId } = setup()
    const root = graph.createNode('FRAME', pageId, {
      name: 'root',
      x: 1000,
      y: 200,
      width: 1080,
      height: 5000
    })
    graph.updateNode(root.id, {
      pluginData: [{ pluginId: 'open-pencil-marketing', key: 'role', value: 'marketing-root' }]
    })
    const target = graph.createNode('RECTANGLE', root.id, {
      name: 'hero',
      x: 0,
      y: 0,
      width: 1024,
      height: 1024,
      fills: [imageFill('hash-1')]
    })
    graph.images.set('hash-1', new Uint8Array([1]))
    const snapshot = expectDefined(snapshotBeforeOverwrite(graph, target.id), 'snapshot')
    const container = expectDefined(
      graph.getNode(graph.getNode(snapshot.id)?.parentId ?? ''),
      'container'
    )
    expect(container.x).toBe(1000 + 1080 + 100)
    expect(container.y).toBe(200)
  })
})

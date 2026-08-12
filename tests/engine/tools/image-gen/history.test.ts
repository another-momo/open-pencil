import { describe, expect, test } from 'bun:test'

import { FigmaAPI, SceneGraph } from '@open-pencil/core'

import { createImageFill } from '#core/tools/image-fill'
import { isInImageHistory, snapshotBeforeOverwrite } from '#core/tools/image-gen/history'
import { markMarketingRoot } from '#core/tools/marketing/restore'

function setup() {
  const graph = new SceneGraph()
  graph.addPage('Test')
  const figma = new FigmaAPI(graph)
  return { graph, figma }
}

function createImageNode(figma: FigmaAPI, name: string, bytes: Uint8Array) {
  const node = figma.createFrame()
  node.name = name
  node.resize(200, 100)
  node.fills = [createImageFill(figma, bytes)]
  return node
}

function pageOf(graph: SceneGraph) {
  return graph.getPages()[0]
}

function containerOf(graph: SceneGraph) {
  return pageOf(graph)
    .childIds.map((id) => graph.getNode(id))
    .find((node) => node?.name === '生图历史')
}

describe('snapshotBeforeOverwrite', () => {
  test('image node → snapshot cloned into a new history container on the same page', () => {
    const { graph, figma } = setup()
    const target = createImageNode(figma, 'HeroImg', new Uint8Array([1, 2, 3]))

    const snapshot = snapshotBeforeOverwrite(graph, target.id)

    expect(snapshot).toBeDefined()
    if (!snapshot) return
    expect(snapshot.name).toBe('HeroImg · v1')
    const container = containerOf(graph)
    expect(container).toBeDefined()
    expect(container?.childIds).toContain(snapshot.id)
    const entry = graph.getNode(snapshot.id)
    expect(entry?.fills).toEqual(
      expect.arrayContaining([expect.objectContaining({ type: 'IMAGE' })])
    )
    expect(isInImageHistory(graph, snapshot.id)).toBe(true)
    expect(isInImageHistory(graph, target.id)).toBe(false)
  })

  test('same image hash → deduped, no second entry', () => {
    const { graph, figma } = setup()
    const bytes = new Uint8Array([1, 2, 3])
    const target = createImageNode(figma, 'HeroImg', bytes)

    expect(snapshotBeforeOverwrite(graph, target.id)).toBeDefined()
    expect(snapshotBeforeOverwrite(graph, target.id)).toBeUndefined()
    expect(containerOf(graph)?.childIds).toHaveLength(1)
  })

  test('changed image hash → next version entry', () => {
    const { graph, figma } = setup()
    const target = createImageNode(figma, 'HeroImg', new Uint8Array([1, 2, 3]))

    snapshotBeforeOverwrite(graph, target.id)
    target.fills = [createImageFill(figma, new Uint8Array([4, 5, 6]))]
    const second = snapshotBeforeOverwrite(graph, target.id)

    expect(second?.name).toBe('HeroImg · v2')
    expect(containerOf(graph)?.childIds).toHaveLength(2)
  })

  test('empty node (no fills, no children) → no snapshot, no container', () => {
    const { graph, figma } = setup()
    const empty = figma.createFrame()
    empty.name = 'placeholder'
    empty.resize(200, 100)

    expect(snapshotBeforeOverwrite(graph, empty.id)).toBeUndefined()
    expect(containerOf(graph)).toBeUndefined()
  })

  test('node with children but no IMAGE fill → no snapshot (children survive a fill swap)', () => {
    const { graph, figma } = setup()
    const parent = figma.createFrame()
    parent.name = 'group'
    const child = figma.createRectangle()
    graph.reparentNode(child.id, parent.id)

    expect(snapshotBeforeOverwrite(graph, parent.id)).toBeUndefined()
    expect(containerOf(graph)).toBeUndefined()
  })

  test('solid-fill-only placeholder → no snapshot (trivially recreatable)', () => {
    const { graph, figma } = setup()
    const placeholder = figma.createFrame()
    placeholder.name = 'HeroImg placeholder'
    placeholder.resize(750, 400)
    placeholder.fills = [
      { type: 'SOLID', color: { r: 0.9, g: 0.9, b: 0.9, a: 1 }, opacity: 1, visible: true }
    ]

    expect(snapshotBeforeOverwrite(graph, placeholder.id)).toBeUndefined()
    expect(containerOf(graph)).toBeUndefined()
  })

  test('container is placed right of the marketing root when one exists', () => {
    const { graph, figma } = setup()
    const root = figma.createFrame()
    root.name = '产品长图'
    root.resize(750, 4380)
    graph.updateNode(root.id, { x: 0, y: 0 })
    markMarketingRoot(graph, root.id, 'product_long')
    const target = createImageNode(figma, 'HeroImg', new Uint8Array([1, 2, 3]))

    snapshotBeforeOverwrite(graph, target.id)

    const container = containerOf(graph)
    expect(container?.x).toBe(750 + 100)
    expect(container?.y).toBe(0)
  })

  test('snapshot of a marketing root does not inherit the root marker', () => {
    const { graph, figma } = setup()
    const root = figma.createFrame()
    root.name = '产品长图'
    root.resize(750, 4380)
    markMarketingRoot(graph, root.id, 'product_long')
    root.fills = [createImageFill(figma, new Uint8Array([1, 2, 3]))]

    const snapshot = snapshotBeforeOverwrite(graph, root.id)

    expect(snapshot).toBeDefined()
    if (!snapshot) return
    const entry = graph.getNode(snapshot.id)
    expect(entry).toBeDefined()
    if (!entry) return
    // Foreign pluginData stripped — the entry must not look like a marketing root
    expect(entry.pluginData.filter((e) => e.pluginId === 'open-pencil-marketing')).toHaveLength(0)
  })
})

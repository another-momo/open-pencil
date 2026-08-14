import { beforeAll, describe, expect, test } from 'bun:test'

import { SceneGraph, SkiaRenderer } from '@open-pencil/core'
import type { Fill } from '@open-pencil/scene-graph'

import { initCanvasKit } from '#cli/headless'

import { expectDefined } from '#tests/helpers/assert'

let ck: Awaited<ReturnType<typeof initCanvasKit>>

beforeAll(async () => {
  ck = await initCanvasKit()
})

/** Encoded PNG bytes of a solid-color w×h image. */
function makePngBytes(width: number, height: number, color: number): Uint8Array {
  const surface = expectDefined(ck.MakeSurface(width, height), 'encode surface')
  try {
    const canvas = surface.getCanvas()
    canvas.clear(color)
    const image = expectDefined(surface.makeImageSnapshot(), 'snapshot')
    try {
      return new Uint8Array(expectDefined(image.encodeToBytes(ck.ImageFormat.PNG), 'png bytes'))
    } finally {
      image.delete()
    }
  } finally {
    surface.delete()
  }
}

function imageFill(imageHash: string): Fill {
  return {
    type: 'IMAGE',
    color: { r: 1, g: 1, b: 1, a: 1 },
    imageHash,
    imageScaleMode: 'FILL',
    visible: true,
    opacity: 1
  }
}

/** Decoded-cache estimate for one w×h image: RGBA + mipmap chain (mirrors applyImageFill). */
function estimatedBytes(width: number, height: number): number {
  return Math.ceil(width * height * 4 * (4 / 3))
}

function makeRenderer() {
  const surface = expectDefined(ck.MakeSurface(1, 1), 'surface')
  return new SkiaRenderer(ck, surface)
}

function makeImageNode(graph: SceneGraph, width: number, height: number) {
  const page = graph.getPages()[0]
  return graph.createNode('RECTANGLE', page.id, { x: 0, y: 0, width, height, fills: [] })
}

describe('image cache budget', () => {
  test('evicts least-recently-used entries once the byte budget is exceeded', () => {
    const size = 64
    const perImage = estimatedBytes(size, size)
    const renderer = makeRenderer()
    renderer.imageCacheBudgetBytes = perImage * 2.5 // holds two, evicts on the third
    const graph = new SceneGraph()
    const node = makeImageNode(graph, size, size)

    const hashes = ['a', 'b', 'c']
    for (const [index, hash] of hashes.entries()) {
      graph.images.set(hash, makePngBytes(size, size, 0xff000000 + index))
      expect(renderer.applyImageFill(imageFill(hash), node, graph)).toBe(true)
    }

    expect(renderer.imageCacheBytes).toBeLessThanOrEqual(renderer.imageCacheBudgetBytes)
    expect([...renderer.imageCache.keys()]).toEqual(['b', 'c'])

    renderer.destroy()
  })

  test('a cache hit refreshes LRU order and survives the next eviction', () => {
    const size = 64
    const perImage = estimatedBytes(size, size)
    const renderer = makeRenderer()
    renderer.imageCacheBudgetBytes = perImage * 2.5
    const graph = new SceneGraph()
    const node = makeImageNode(graph, size, size)

    for (const hash of ['a', 'b']) {
      graph.images.set(hash, makePngBytes(size, size, 0xff000000))
      renderer.applyImageFill(imageFill(hash), node, graph)
    }
    // Touch 'a' so 'b' becomes the oldest entry.
    expect(renderer.applyImageFill(imageFill('a'), node, graph)).toBe(true)

    graph.images.set('c', makePngBytes(size, size, 0xff000000))
    renderer.applyImageFill(imageFill('c'), node, graph)

    expect([...renderer.imageCache.keys()]).toEqual(['a', 'c'])

    renderer.destroy()
  })

  test('an evicted image is transparently re-decoded from graph.images on next use', () => {
    const size = 64
    const perImage = estimatedBytes(size, size)
    const renderer = makeRenderer()
    renderer.imageCacheBudgetBytes = perImage * 1.5 // holds one
    const graph = new SceneGraph()
    const node = makeImageNode(graph, size, size)

    for (const hash of ['a', 'b']) {
      graph.images.set(hash, makePngBytes(size, size, 0xff000000))
      renderer.applyImageFill(imageFill(hash), node, graph)
    }
    expect(renderer.imageCache.has('a')).toBe(false)

    expect(renderer.applyImageFill(imageFill('a'), node, graph)).toBe(true)
    expect(renderer.imageCache.has('a')).toBe(true)

    renderer.destroy()
  })

  test('destroy releases cached images and resets the byte counter', () => {
    const size = 64
    const renderer = makeRenderer()
    const graph = new SceneGraph()
    const node = makeImageNode(graph, size, size)
    graph.images.set('a', makePngBytes(size, size, 0xff000000))
    renderer.applyImageFill(imageFill('a'), node, graph)
    expect(renderer.imageCacheBytes).toBeGreaterThan(0)

    renderer.destroy()

    expect(renderer.imageCache.size).toBe(0)
    expect(renderer.imageCacheBytes).toBe(0)
  })
})

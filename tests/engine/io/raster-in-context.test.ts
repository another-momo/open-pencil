import { describe, expect, test } from 'bun:test'

import type { CanvasKit } from 'canvaskit-wasm'

import { SceneGraph } from '@open-pencil/scene-graph'

import { initCanvasKit } from '#cli/headless'
import { SkiaRenderer } from '#core/canvas'
import { renderNodesToImage } from '#core/io/formats/raster/render'

import { expectDefined } from '#tests/helpers/assert'

/**
 * Pixel-level contract for renderInContext (poster-quality experiment, look
 * tool L1): an in-context export must include what paints beneath the target
 * in the live page, while the default isolated export must not. Text-free
 * graph so no fonts are required.
 */
describe('renderNodesToImage — renderInContext pixels', () => {
  const W = 200
  const H = 400

  function makeGraph() {
    const g = new SceneGraph()
    const page = g.addPage('Page')
    const root = g.createNode('FRAME', page.id, {
      name: 'Root',
      width: W,
      height: H,
      layoutMode: 'NONE',
      fills: [{ type: 'SOLID', color: { r: 1, g: 1, b: 1, a: 1 }, opacity: 1, visible: true }]
    })
    // Red band at y=100..200 — the "design context" beneath the target.
    g.createNode('RECTANGLE', root.id, {
      name: 'Band',
      x: 0,
      y: 100,
      width: W,
      height: 100,
      fills: [{ type: 'SOLID', color: { r: 1, g: 0, b: 0, a: 1 }, opacity: 1, visible: true }]
    })
    // Transparent target floating over the band — nothing visible of its own.
    const ghost = g.createNode('FRAME', root.id, {
      name: 'Ghost',
      x: 0,
      y: 100,
      width: W,
      height: 100,
      fills: []
    })
    return { g, page, ghost }
  }

  function makeRenderer(ck: CanvasKit) {
    const surface = expectDefined(ck.MakeSurface(16, 16), 'surface')
    const renderer = new SkiaRenderer(ck, surface)
    renderer.viewportWidth = 16
    renderer.viewportHeight = 16
    renderer.dpr = 1
    renderer.worldViewport = { x: -1e9, y: -1e9, w: 2e9, h: 2e9 }
    return renderer
  }

  function countRedPixels(ck: CanvasKit, png: Uint8Array): number {
    const image = expectDefined(ck.MakeImageFromEncoded(png), 'decoded export')
    const pixels = image.readPixels(0, 0, {
      width: image.width(),
      height: image.height(),
      colorType: ck.ColorType.RGBA_8888,
      alphaType: ck.AlphaType.Unpremul,
      colorSpace: ck.ColorSpace.SRGB
    })
    image.delete()
    let red = 0
    for (let i = 0; i < pixels.length; i += 4) {
      if (pixels[i] > 200 && pixels[i + 1] < 80 && pixels[i + 2] < 80 && pixels[i + 3] > 200) red++
    }
    return red
  }

  test('in-context export paints the sibling band; isolated export does not', async () => {
    const ck = await initCanvasKit()
    const { g, page, ghost } = makeGraph()
    const renderer = makeRenderer(ck)
    const clip = { minX: 0, minY: 100, maxX: 200, maxY: 200 }

    const inContext = renderNodesToImage(ck, renderer, g, page.id, [ghost.id], {
      scale: 1,
      format: 'PNG',
      renderInContext: true,
      clip
    })
    const isolated = renderNodesToImage(ck, renderer, g, page.id, [ghost.id], {
      scale: 1,
      format: 'PNG'
    })

    const inContextRed = countRedPixels(ck, expectDefined(inContext, 'in-context export'))
    expect(inContextRed).toBeGreaterThan(10_000) // 200×100 region, mostly red

    // The isolated control: the transparent frame alone paints nothing.
    // (A null export — "nothing visible" — is also an acceptable isolated
    // outcome and proves the same point.)
    if (isolated !== null) {
      expect(countRedPixels(ck, isolated)).toBe(0)
    }
  })
})

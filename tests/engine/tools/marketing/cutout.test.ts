import { describe, expect, it, mock } from 'bun:test'

import { SceneGraph } from '@open-pencil/scene-graph'

import { cutoutTool } from '#core/tools/marketing/cutout'

/**
 * Tool-level tests for cutout. CanvasKit is stubbed: MakeImageFromEncoded
 * returns a synthetic image whose pixels we control; MakeImage pretends to
 * encode PNGs. The real pixel math is covered in cutout-pure.test.ts.
 */

const GREEN: [number, number, number] = [0, 255, 0]

function makePixels(width: number, height: number, fill: [number, number, number]): Uint8Array {
  const px = new Uint8Array(width * height * 4)
  for (let i = 0; i < width * height; i++) {
    px[i * 4] = fill[0]
    px[i * 4 + 1] = fill[1]
    px[i * 4 + 2] = fill[2]
    px[i * 4 + 3] = 255
  }
  return px
}

function paintRect(
  px: Uint8Array,
  width: number,
  rect: { x: number; y: number; width: number; height: number },
  color: [number, number, number]
): void {
  for (let y = rect.y; y < rect.y + rect.height; y++) {
    for (let x = rect.x; x < rect.x + rect.width; x++) {
      const i = (y * width + x) * 4
      px[i] = color[0]
      px[i + 1] = color[1]
      px[i + 2] = color[2]
      px[i + 3] = 255
    }
  }
}

function mockCanvasKit(pixels: Uint8Array, width: number, height: number) {
  const fakeImage = {
    width: () => width,
    height: () => height,
    readPixels: () => pixels,
    delete: () => {}
  }
  mock.module('#core/canvaskit', () => ({
    getCanvasKit: async () => ({
      MakeImageFromEncoded: () => fakeImage,
      MakeImage: () => ({
        encodeToBytes: () => new Uint8Array([0x89, 0x50, 0x4e, 0x47]),
        delete: () => {}
      }),
      AlphaType: { Unpremul: 0 },
      ColorSpace: { SRGB: 0 },
      ColorType: { RGBA_8888: 0 },
      ImageFormat: { PNG: 0 }
    })
  }))
}

function makeFigma(graph: SceneGraph) {
  return { graph } as never
}

function makeImageNode(g: SceneGraph, opts?: { withBytes?: boolean }) {
  const page = g.addPage('Page')
  const rect = g.createNode('RECTANGLE', page.id, {
    name: 'StickerSheet',
    width: 400,
    height: 400,
    fills: [
      {
        type: 'IMAGE',
        color: { r: 0, g: 0, b: 0, a: 0 },
        opacity: 1,
        visible: true,
        imageHash: 'deadbeef',
        imageScaleMode: 'FILL'
      }
    ]
  })
  if (opts?.withBytes !== false) g.images.set('deadbeef', new Uint8Array([1, 2, 3]))
  return rect
}

describe('cutout tool', () => {
  it('validates id, node existence, IMAGE fill, and loaded bytes', async () => {
    const g = new SceneGraph()
    expect(await cutoutTool.execute(makeFigma(g), { id: '' })).toEqual({
      error: expect.stringContaining('node id')
    })
    expect(await cutoutTool.execute(makeFigma(g), { id: 'nope' })).toEqual({
      error: expect.stringContaining('not found')
    })

    const g2 = new SceneGraph()
    const page = g2.addPage('Page')
    const plain = g2.createNode('RECTANGLE', page.id, {
      name: 'Plain',
      width: 10,
      height: 10,
      fills: [{ type: 'SOLID', color: { r: 1, g: 0, b: 0, a: 1 }, opacity: 1, visible: true }]
    })
    expect(await cutoutTool.execute(makeFigma(g2), { id: plain.id })).toMatchObject({
      error: expect.stringContaining('no IMAGE fill')
    })

    const g3 = new SceneGraph()
    const noBytes = makeImageNode(g3, { withBytes: false })
    expect(await cutoutTool.execute(makeFigma(g3), { id: noBytes.id })).toMatchObject({
      error: expect.stringContaining('not loaded')
    })
  })

  it('rejects a malformed chroma hex', async () => {
    const g = new SceneGraph()
    const node = makeImageNode(g)
    expect(await cutoutTool.execute(makeFigma(g), { id: node.id, chroma: 'green' })).toMatchObject({
      error: expect.stringContaining('not a valid 6-digit hex')
    })
  })

  it('cuts a single-subject image into one transparent asset node', async () => {
    const px = makePixels(16, 16, GREEN)
    paintRect(px, 16, { x: 4, y: 4, width: 8, height: 8 }, [220, 40, 40])
    mockCanvasKit(px, 16, 16)

    const g = new SceneGraph()
    const node = makeImageNode(g)
    const result = await cutoutTool.execute(makeFigma(g), { id: node.id, min_area: 16 })
    expect(result).not.toHaveProperty('error')
    const out = result as {
      elements: Array<{ id: string; nativeWidth: number; nativeHeight: number }>
      note: string
    }
    expect(out.elements.length).toBe(1)
    // Erode eats the 1px fringe: 8×8 subject → 6×6 content.
    expect(out.elements[0].nativeWidth).toBe(6)
    expect(out.elements[0].nativeHeight).toBe(6)
    const created = g.getNode(out.elements[0].id)
    expect(created?.type).toBe('RECTANGLE')
    expect(created?.fills[0]?.type).toBe('IMAGE')
    expect(created?.fills[0]?.imageScaleMode).toBe('FIT')
    // The encoded bytes were registered in the graph's image store.
    const hash = (created?.fills[0] as { imageHash?: string }).imageHash
    expect(hash && g.images.get(hash)).toBeDefined()
  })

  it('separates a sheet into one asset per element by connectivity (no grid needed)', async () => {
    const px = makePixels(32, 32, GREEN)
    paintRect(px, 32, { x: 4, y: 4, width: 8, height: 8 }, [220, 40, 40]) // top-left element
    paintRect(px, 32, { x: 20, y: 20, width: 8, height: 8 }, [40, 40, 220]) // bottom-right element
    mockCanvasKit(px, 32, 32)

    const g = new SceneGraph()
    const node = makeImageNode(g)
    const result = await cutoutTool.execute(makeFigma(g), { id: node.id, min_area: 16 })
    const out = result as { elements: unknown[]; note: string }
    expect(out.elements.length).toBe(2)
  })

  it('keeps an element that overflows its grid cell as ONE asset (no cell slicing)', async () => {
    // A wide element spanning what would be two cells of a 2x2 grid.
    const px = makePixels(32, 32, GREEN)
    paintRect(px, 32, { x: 4, y: 4, width: 24, height: 8 }, [220, 40, 40])
    mockCanvasKit(px, 32, 32)

    const g = new SceneGraph()
    const node = makeImageNode(g)
    const result = await cutoutTool.execute(makeFigma(g), { id: node.id, min_area: 16 })
    const out = result as {
      elements: Array<{ nativeWidth: number; nativeHeight: number }>
    }
    expect(out.elements.length).toBe(1)
    // 24×8 blob, eroded by 1px on each side → 22×6.
    expect(out.elements[0].nativeWidth).toBe(22)
    expect(out.elements[0].nativeHeight).toBe(6)
  })

  it('warns when the background is not uniform across corners', async () => {
    const px = makePixels(24, 24, GREEN)
    paintRect(px, 24, { x: 16, y: 16, width: 8, height: 8 }, [0, 190, 0]) // dark-green corner drift
    paintRect(px, 24, { x: 8, y: 8, width: 8, height: 8 }, [220, 40, 40]) // centered subject
    mockCanvasKit(px, 24, 24)

    const g = new SceneGraph()
    const node = makeImageNode(g)
    const result = await cutoutTool.execute(makeFigma(g), {
      id: node.id,
      chroma: '#00FF00',
      tolerance: 120,
      min_area: 16
    })
    const out = result as { note: string }
    expect(out.note).toContain('WARNING')
    expect(out.note).toContain('not uniform')
  })

  it('preserves subject-interior chroma (the mint-green case) and reports it', async () => {
    // Red subject with a pure-green core: the core must NOT be keyed out.
    const px = makePixels(24, 24, GREEN)
    paintRect(px, 24, { x: 4, y: 4, width: 16, height: 16 }, [220, 40, 40])
    paintRect(px, 24, { x: 9, y: 9, width: 6, height: 6 }, GREEN)
    mockCanvasKit(px, 24, 24)

    const g = new SceneGraph()
    const node = makeImageNode(g)
    const result = await cutoutTool.execute(makeFigma(g), { id: node.id, min_area: 16 })
    const out = result as {
      elements: Array<{ nativeWidth: number; nativeHeight: number }>
      note: string
    }
    expect(out.elements.length).toBe(1)
    // The full block survives as one asset (16 minus 1px erosion each side).
    expect(out.elements[0].nativeWidth).toBe(14)
    // And the preserved interior chroma is reported, not silent.
    expect(out.note).toContain('match the background color inside subjects')
  })

  it('warns when the found element count differs from the expected count', async () => {
    const px = makePixels(24, 24, GREEN)
    paintRect(px, 24, { x: 8, y: 8, width: 8, height: 8 }, [220, 40, 40])
    mockCanvasKit(px, 24, 24)

    const g = new SceneGraph()
    const node = makeImageNode(g)
    const result = await cutoutTool.execute(makeFigma(g), {
      id: node.id,
      expected: 9,
      min_area: 16
    })
    const out = result as { note: string }
    expect(out.note).toContain('expected 9')
    expect(out.note).toContain('WARNING')
  })

  it('returns an error with guidance when everything is background', async () => {
    const px = makePixels(8, 8, GREEN)
    mockCanvasKit(px, 8, 8)

    const g = new SceneGraph()
    const node = makeImageNode(g)
    const result = await cutoutTool.execute(makeFigma(g), { id: node.id, min_area: 16 })
    expect(result).toMatchObject({ error: expect.stringContaining('Nothing survived') })
  })

  it('exposes expected/chroma/tolerance/despill/erode params', () => {
    const params = cutoutTool.params
    expect(params.id.required).toBe(true)
    expect(params.expected.type).toBe('number')
    expect(params.tolerance.default).toBe(90)
    expect(params.despill.default).toBe(true)
    expect(params.erode.default).toBe(1)
  })
})

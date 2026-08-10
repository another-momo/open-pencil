import { describe, expect, it } from 'bun:test'

import { SceneGraph } from '@open-pencil/scene-graph'

import { composeBackdropTool } from '#core/tools/marketing/compose-backdrop'

/**
 * Tool-level integration tests for compose_backdrop. We exercise the
 * deterministic validation paths and the structure contract here; the
 * 100px overlap / position="absolute" / 8-digit-hex-alpha / gradient
 * transform details are visually verified by the smoke run.
 */
describe('compose_backdrop tool', () => {
  function makeFigma(graph: SceneGraph) {
    return { graph } as never
  }

  it('returns an error when root_id is missing', async () => {
    const g = new SceneGraph()
    const result = await composeBackdropTool.execute(makeFigma(g), {
      root_id: '',
      canvas_width: 750,
      canvas_height: 2120
    })
    expect(result).toEqual({ error: expect.stringContaining('root frame id') })
  })

  it('returns an error when canvas dimensions are missing', async () => {
    const g = new SceneGraph()
    const result = await composeBackdropTool.execute(makeFigma(g), {
      root_id: '0:1',
      canvas_width: undefined as never,
      canvas_height: 2120
    })
    expect(result).toMatchObject({ error: expect.stringContaining('canvas_width') })
  })

  it('returns an error when canvas is too small', async () => {
    const g = new SceneGraph()
    const page = g.addPage('Page')
    const result = await composeBackdropTool.execute(makeFigma(g), {
      root_id: page.id,
      canvas_width: 50,
      canvas_height: 50
    })
    expect(result).toMatchObject({ error: expect.stringContaining('Canvas too small') })
  })

  it('returns an error when hero_height is out of range', async () => {
    const g = new SceneGraph()
    const page = g.addPage('Page')
    const result = await composeBackdropTool.execute(makeFigma(g), {
      root_id: page.id,
      canvas_width: 750,
      canvas_height: 2120,
      hero_height: 5000
    })
    expect(result).toMatchObject({ error: expect.stringContaining('hero_height') })
  })

  it('returns an error when the root frame does not exist', async () => {
    const g = new SceneGraph()
    const result = await composeBackdropTool.execute(makeFigma(g), {
      root_id: 'missing',
      canvas_width: 750,
      canvas_height: 2120
    })
    expect(result).toMatchObject({ error: expect.stringContaining('not found') })
  })

  it('falls back to neutral gray when hero_color is not a valid hex', async () => {
    const g = new SceneGraph()
    const page = g.addPage('Page')
    const result = await composeBackdropTool.execute(makeFigma(g), {
      root_id: page.id,
      canvas_width: 750,
      canvas_height: 2120,
      hero_color: 'not-a-hex'
    })
    expect(result).toMatchObject({
      hero_color: '#888888FF',
      background_layer_id: expect.any(String)
    })
  })

  it('builds the Background Layer as the first child of root with the right structure', async () => {
    const g = new SceneGraph()
    const page = g.addPage('Page')
    const root = g.createNode('FRAME', page.id, {
      name: 'ProductLong',
      width: 750,
      height: 2120,
      layoutMode: 'VERTICAL'
    })

    const result = await composeBackdropTool.execute(makeFigma(g), {
      root_id: root.id,
      canvas_width: 750,
      canvas_height: 2120,
      hero_height: 500,
      hero_color: '#5A7F5BFF'
    })

    expect(result.error).toBeUndefined()
    const ids = result as {
      background_layer_id: string
      hero_img_id: string
      backdrop_overlay_id: string
      base_wash_id: string
      overlay_position: { x: number; y: number; width: number; height: number }
      overlap_px: number
    }

    // Background Layer is the first child of root — this is the z-order
    // contract that makes content sections paint on top.
    expect(root.childIds[0]).toBe(ids.background_layer_id)

    const layer = g.getNode(ids.background_layer_id)
    expect(layer?.name).toBe('BackgroundLayer')
    expect(layer?.layoutMode).toBe('NONE')
    expect(layer?.clipsContent).toBe(false)

    const baseWash = g.getNode(ids.base_wash_id)
    expect(baseWash?.name).toBe('BaseWash')
    expect(baseWash?.fills[0]?.type).toBe('GRADIENT_LINEAR')

    const heroImg = g.getNode(ids.hero_img_id)
    expect(heroImg?.name).toBe('HeroImg')
    expect(heroImg?.height).toBe(500)

    const overlay = g.getNode(ids.backdrop_overlay_id)
    expect(overlay?.name).toBe('BackdropOverlay')

    // The 100px overlap and the rest of the geometry are the entire point.
    expect(ids.overlap_px).toBe(100)
    expect(ids.overlay_position).toEqual({ x: 0, y: 400, width: 750, height: 1720 })
    expect(overlay?.y).toBe(400)
    expect(overlay?.height).toBe(1720)

    // The middle stop lands at hero_height − 100 inside the overlay,
    // expressed as a [0,1] position. With overlayHeight=1720 that is
    // exactly 100/1720.
    const overlayFill = overlay?.fills[0]
    expect(overlayFill?.type).toBe('GRADIENT_LINEAR')
    const stops = overlayFill?.gradientStops
    expect(stops?.length).toBe(3)
    expect(stops?.[0]?.color).toEqual({ r: 1, g: 1, b: 1, a: 0 })
    expect(stops?.[0]?.position).toBe(0)
    expect(stops?.[1]?.color).toMatchObject({ a: 1 })
    expect(stops?.[1]?.color.r).toBeCloseTo(90 / 255, 5)
    expect(stops?.[1]?.color.g).toBeCloseTo(127 / 255, 5)
    expect(stops?.[1]?.color.b).toBeCloseTo(91 / 255, 5)
    expect(stops?.[1]?.position).toBeCloseTo(100 / 1720, 10)
    expect(stops?.[2]?.color).toEqual({ r: 1, g: 1, b: 1, a: 1 })
    expect(stops?.[2]?.position).toBe(1)

    // Vertical gradient transform, not the right-to-left default.
    expect(overlayFill?.gradientTransform).toEqual({
      m00: 0,
      m01: 1,
      m02: 0,
      m10: -1,
      m11: 0,
      m12: 1
    })
  })

  it('exposes root_id, canvas_width, canvas_height, hero_height, hero_color as params', () => {
    const params = composeBackdropTool.params
    expect(params.root_id.type).toBe('string')
    expect(params.root_id.required).toBe(true)
    expect(params.canvas_width.type).toBe('number')
    expect(params.canvas_width.required).toBe(true)
    expect(params.canvas_height.type).toBe('number')
    expect(params.canvas_height.required).toBe(true)
    expect(params.hero_height.type).toBe('number')
    expect(params.hero_height.default).toBe(500)
    expect(params.hero_color.type).toBe('string')
    expect(params.hero_color.default).toBe('#888888FF')
  })
})
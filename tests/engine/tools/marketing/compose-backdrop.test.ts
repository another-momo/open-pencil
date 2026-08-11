import { describe, expect, it } from 'bun:test'

import { SceneGraph } from '@open-pencil/scene-graph'
import type { Rect } from '@open-pencil/scene-graph/primitives'

import { composeBackdropTool } from '#core/tools/marketing/compose-backdrop'

import { expectDefined } from '#tests/helpers/assert'

/**
 * Tool-level integration tests for compose_backdrop. The pinned contract:
 * BackgroundLayer (absolute, [0]) internally holds BaseWash < HeroImg <
 * BackdropOverlay; HeroContent (flow, [1]) reserves the hero slot; HeroImg
 * is hero_height + hero_bleed tall so the fade seam hides inside the next
 * section. Color priority: explicit hero_color > auto-sample > white.
 */
describe('compose_backdrop tool', () => {
  function makeFigma(graph: SceneGraph) {
    return { graph } as never
  }

  function makeRoot(g: SceneGraph) {
    const page = g.addPage('Page')
    return g.createNode('FRAME', page.id, {
      name: 'ProductLong',
      width: 750,
      height: 2120,
      layoutMode: 'VERTICAL'
    })
  }

  function makeImageFill() {
    return {
      type: 'IMAGE' as const,
      color: { r: 0, g: 0, b: 0, a: 0 },
      opacity: 1,
      visible: true,
      imageHash: 'deadbeef',
      imageScaleMode: 'FILL' as const
    }
  }

  function graph_updateFill(g: SceneGraph, nodeId: string) {
    g.updateNode(nodeId, {
      fills: [{ type: 'SOLID', color: { r: 1, g: 1, b: 1, a: 1 }, opacity: 1, visible: true }]
    })
  }

  interface Built {
    background_layer_id: string
    base_wash_id: string
    hero_img_id: string
    hero_content_id: string
    backdrop_overlay_id: string
    hero_color: string
    color_source: string
    hero_height: number
    hero_bleed: number
    overlay_position: Rect
    note: string
  }

  async function build(g: SceneGraph, rootId: string, extra: Record<string, unknown> = {}) {
    const result = (await composeBackdropTool.execute(makeFigma(g), {
      root_id: rootId,
      canvas_width: 750,
      canvas_height: 2120,
      ...extra
    })) as Built | { error: string }
    expect(result).not.toHaveProperty('error')
    return result as Built
  }

  describe('validation', () => {
    it('returns an error when root_id is missing', async () => {
      const g = new SceneGraph()
      const result = await composeBackdropTool.execute(makeFigma(g), {
        root_id: '',
        canvas_width: 750,
        canvas_height: 2120
      })
      expect(result).toEqual({ error: expect.stringContaining('root frame id') })
    })

    it('returns an error when canvas dimensions are missing or NaN', async () => {
      const g = new SceneGraph()
      const missing = await composeBackdropTool.execute(makeFigma(g), {
        root_id: '0:1',
        canvas_width: undefined as never,
        canvas_height: 2120
      })
      expect(missing).toMatchObject({ error: expect.stringContaining('canvas_width') })
      const nan = await composeBackdropTool.execute(makeFigma(g), {
        root_id: '0:1',
        canvas_width: Number.NaN,
        canvas_height: 2120
      })
      expect(nan).toMatchObject({ error: expect.stringContaining('finite') })
    })

    it('returns an error when canvas is too small', async () => {
      const g = new SceneGraph()
      const root = makeRoot(g)
      const result = await composeBackdropTool.execute(makeFigma(g), {
        root_id: root.id,
        canvas_width: 50,
        canvas_height: 50
      })
      expect(result).toMatchObject({ error: expect.stringContaining('Canvas too small') })
    })

    it('returns an error when hero_height or hero_height+bleed is out of range', async () => {
      const g = new SceneGraph()
      const root = makeRoot(g)
      const tooTall = await composeBackdropTool.execute(makeFigma(g), {
        root_id: root.id,
        canvas_width: 750,
        canvas_height: 2120,
        hero_height: 5000
      })
      expect(tooTall).toMatchObject({ error: expect.stringContaining('hero_height') })
      const bleedOverflow = await composeBackdropTool.execute(makeFigma(g), {
        root_id: root.id,
        canvas_width: 750,
        canvas_height: 2120,
        hero_height: 2050,
        hero_bleed: 100
      })
      expect(bleedOverflow).toMatchObject({ error: expect.stringContaining('hero_bleed') })
    })

    it('returns an error when the root does not exist or is not a FRAME', async () => {
      const g = new SceneGraph()
      const missing = await composeBackdropTool.execute(makeFigma(g), {
        root_id: 'missing',
        canvas_width: 750,
        canvas_height: 2120
      })
      expect(missing).toMatchObject({ error: expect.stringContaining('not found') })
      const page = g.addPage('Page')
      const notFrame = await composeBackdropTool.execute(makeFigma(g), {
        root_id: page.id,
        canvas_width: 750,
        canvas_height: 2120
      })
      expect(notFrame).toMatchObject({ error: expect.stringContaining('not a FRAME') })
    })

    it('returns an error when hero_image_from does not exist', async () => {
      const g = new SceneGraph()
      const root = makeRoot(g)
      const result = await composeBackdropTool.execute(makeFigma(g), {
        root_id: root.id,
        canvas_width: 750,
        canvas_height: 2120,
        hero_image_from: 'missing-hero'
      })
      expect(result).toMatchObject({ error: expect.stringContaining('not found') })
    })

    it('returns an error when hero_image_from has no IMAGE fill and nothing was transferred before', async () => {
      const g = new SceneGraph()
      const root = makeRoot(g)
      const empty = g.createNode('FRAME', root.id, {
        name: 'HeroContent',
        width: 750,
        height: 750
      })
      const result = await composeBackdropTool.execute(makeFigma(g), {
        root_id: root.id,
        canvas_width: 750,
        canvas_height: 2120,
        hero_image_from: empty.id
      })
      expect(result).toMatchObject({ error: expect.stringContaining('no IMAGE fill') })
    })

    it('returns an error when canvas or hero params exceed the declared maxima', async () => {
      const g = new SceneGraph()
      const root = makeRoot(g)
      const wide = await composeBackdropTool.execute(makeFigma(g), {
        root_id: root.id,
        canvas_width: 9000,
        canvas_height: 2120
      })
      expect(wide).toMatchObject({ error: expect.stringContaining('maximum') })
      const tall = await composeBackdropTool.execute(makeFigma(g), {
        root_id: root.id,
        canvas_width: 750,
        canvas_height: 99999
      })
      expect(tall).toMatchObject({ error: expect.stringContaining('maximum') })
      const bleed = await composeBackdropTool.execute(makeFigma(g), {
        root_id: root.id,
        canvas_width: 750,
        canvas_height: 2120,
        hero_bleed: 5000
      })
      expect(bleed).toMatchObject({ error: expect.stringContaining('hero_bleed') })
      const hero = await composeBackdropTool.execute(makeFigma(g), {
        root_id: root.id,
        canvas_width: 750,
        canvas_height: 20000,
        hero_height: 4001
      })
      expect(hero).toMatchObject({ error: expect.stringContaining('hero_height') })
    })

    it('returns an error when the root has no auto-layout', async () => {
      const g = new SceneGraph()
      const page = g.addPage('Page')
      const root = g.createNode('FRAME', page.id, {
        name: 'FreeRoot',
        width: 750,
        height: 2120,
        layoutMode: 'NONE'
      })
      const result = await composeBackdropTool.execute(makeFigma(g), {
        root_id: root.id,
        canvas_width: 750,
        canvas_height: 2120
      })
      expect(result).toMatchObject({ error: expect.stringContaining('auto-layout') })
    })

    it('warns in the note when canvas_width disagrees with the root width', async () => {
      const g = new SceneGraph()
      const root = makeRoot(g)
      const ids = await build(g, root.id, { canvas_width: 700, hero_color: '#5A7F5BFF' })
      expect(ids.note).toContain('WARNING')
      expect(ids.note).toContain('canvas_width (700)')
      expect(ids.note).toContain('750')
    })
  })

  describe('topology', () => {
    it('inserts BackgroundLayer [0] and HeroContent [1] under the root', async () => {
      const g = new SceneGraph()
      const root = makeRoot(g)
      const ids = await build(g, root.id, { hero_color: '#5A7F5BFF' })

      expect(root.childIds[0]).toBe(ids.background_layer_id)
      expect(root.childIds[1]).toBe(ids.hero_content_id)

      const layer = expectDefined(g.getNode(ids.background_layer_id), 'layer')
      expect(layer.layoutPositioning).toBe('ABSOLUTE')
      expect(layer.childIds).toEqual([ids.base_wash_id, ids.hero_img_id, ids.backdrop_overlay_id])

      const heroContent = expectDefined(g.getNode(ids.hero_content_id), 'hero content')
      expect(heroContent.layoutPositioning).toBe('AUTO')
      expect(heroContent.height).toBe(750)
      expect(heroContent.fills).toEqual([])
    })

    it('keeps existing content sections in the flow after HeroContent', async () => {
      const g = new SceneGraph()
      const root = makeRoot(g)
      const part2 = g.createNode('FRAME', root.id, { name: 'Part2', width: 750, height: 400 })
      const ids = await build(g, root.id, { hero_color: '#5A7F5BFF' })

      expect(root.childIds.indexOf(part2.id)).toBeGreaterThan(
        root.childIds.indexOf(ids.hero_content_id)
      )
      expect(g.getNode(part2.id)?.layoutPositioning).toBe('AUTO')
    })

    it('extends HeroImg by hero_bleed past the hero slot, default 100', async () => {
      const g = new SceneGraph()
      const root = makeRoot(g)
      const ids = await build(g, root.id, { hero_color: '#5A7F5BFF' })

      expect(ids.hero_height).toBe(750)
      expect(ids.hero_bleed).toBe(100)
      expect(g.getNode(ids.hero_img_id)?.height).toBe(850)
      expect(ids.overlay_position).toEqual({ x: 0, y: 750, width: 750, height: 1370 })
    })

    it('hero_bleed=0 makes the image flush with the hero slot', async () => {
      const g = new SceneGraph()
      const root = makeRoot(g)
      const ids = await build(g, root.id, { hero_color: '#5A7F5BFF', hero_bleed: 0 })

      expect(g.getNode(ids.hero_img_id)?.height).toBe(750)
      expect(ids.overlay_position).toEqual({ x: 0, y: 650, width: 750, height: 1470 })
    })
  })

  describe('gradient contract', () => {
    it('gives BaseWash a faint top tint — stop alpha 0.05, not full-strength color', async () => {
      const g = new SceneGraph()
      const root = makeRoot(g)
      const ids = await build(g, root.id, { hero_color: '#5A7F5BFF' })

      const fill = expectDefined(g.getNode(ids.base_wash_id)?.fills[0], 'basewash fill')
      const stops = expectDefined(fill.gradientStops, 'basewash stops')
      expect(stops.length).toBe(2)
      expect(stops[0].color.a).toBeCloseTo(0.05, 10)
      expect(stops[0].color.r).toBeCloseTo(90 / 255, 5)
      expect(stops[1].color).toEqual({ r: 1, g: 1, b: 1, a: 1 })
    })

    it('pins the overlay 3-stop gradient and vertical transform', async () => {
      const g = new SceneGraph()
      const root = makeRoot(g)
      const ids = await build(g, root.id, { hero_color: '#5A7F5BFF' })

      const overlay = expectDefined(g.getNode(ids.backdrop_overlay_id), 'overlay')
      const overlayFill = expectDefined(overlay.fills[0], 'overlay fill')
      const stops = expectDefined(overlayFill.gradientStops, 'overlay stops')
      expect(stops.length).toBe(3)
      const [top, middle, bottom] = stops
      // Top stop: the THEME color at alpha 0 — a pure-alpha ramp so the hero
      // bottom melts into its own hue (a transparent-WHITE start would wash
      // the kiss zone with a pale halo).
      expect(top.color.r).toBeCloseTo(90 / 255, 5)
      expect(top.color.g).toBeCloseTo(127 / 255, 5)
      expect(top.color.b).toBeCloseTo(91 / 255, 5)
      expect(top.color.a).toBe(0)
      expect(top.position).toBe(0)
      expect(middle.color.r).toBeCloseTo(90 / 255, 5)
      expect(middle.color.g).toBeCloseTo(127 / 255, 5)
      expect(middle.color.b).toBeCloseTo(91 / 255, 5)
      expect(middle.color.a).toBe(1)
      // Middle stop lands exactly on the hero image bottom edge: 100/1370.
      expect(middle.position).toBeCloseTo(100 / 1370, 10)
      expect(bottom.color).toEqual({ r: 1, g: 1, b: 1, a: 1 })
      expect(bottom.position).toBe(1)
      expect(overlayFill.gradientTransform).toEqual({
        m00: 0,
        m01: 1,
        m02: 0,
        m10: -1,
        m11: 0,
        m12: 1
      })
    })

    it('white fallback degenerates the top stop to the legacy transparent white', async () => {
      const g = new SceneGraph()
      const root = makeRoot(g)
      const ids = await build(g, root.id)

      const overlay = expectDefined(g.getNode(ids.backdrop_overlay_id), 'overlay')
      const stops = expectDefined(overlay.fills[0]?.gradientStops, 'overlay stops')
      expect(stops[0].color).toEqual({ r: 1, g: 1, b: 1, a: 0 })
    })
  })

  describe('color pipeline', () => {
    it('uses explicit hero_color when given (color_source: explicit)', async () => {
      const g = new SceneGraph()
      const root = makeRoot(g)
      const ids = await build(g, root.id, { hero_color: '#5A7F5BFF' })
      expect(ids.hero_color).toBe('#5A7F5BFF')
      expect(ids.color_source).toBe('explicit')
    })

    it('falls back to white when there is no hero image yet (color_source: fallback)', async () => {
      const g = new SceneGraph()
      const root = makeRoot(g)
      const ids = await build(g, root.id)
      expect(ids.hero_color).toBe('#FFFFFFFF')
      expect(ids.color_source).toBe('fallback')
      expect(ids.note).toContain('white')
    })

    it('falls back to white when image bytes are not loaded (sampling degrades, no error)', async () => {
      const g = new SceneGraph()
      const root = makeRoot(g)
      const hero = g.createNode('FRAME', root.id, {
        name: 'HeroContent',
        width: 750,
        height: 750,
        fills: [makeImageFill()]
      })
      const ids = await build(g, root.id, { hero_image_from: hero.id })
      expect(ids.color_source).toBe('fallback')
      expect(ids.hero_color).toBe('#FFFFFFFF')
      // ...but the structure and transfer still happened.
      expect(g.getNode(ids.hero_img_id)?.fills[0]?.type).toBe('IMAGE')
    })

    it('ignores an invalid hero_color string and falls through to sampling/fallback', async () => {
      const g = new SceneGraph()
      const root = makeRoot(g)
      const ids = await build(g, root.id, { hero_color: 'not-a-hex' })
      expect(ids.color_source).toBe('fallback')
      expect(ids.hero_color).toBe('#FFFFFFFF')
    })

    it('warns in the note when a provided hero_color fails hex validation', async () => {
      const g = new SceneGraph()
      const root = makeRoot(g)
      const ids = await build(g, root.id, { hero_color: 'not-a-hex' })
      expect(ids.note).toContain('WARNING')
      expect(ids.note).toContain('"not-a-hex"')
      expect(ids.note).toContain('ignored')
    })

    it('does not warn when no hero_color was provided at all', async () => {
      const g = new SceneGraph()
      const root = makeRoot(g)
      const ids = await build(g, root.id)
      expect(ids.note).not.toContain('WARNING')
    })
  })

  describe('hero_image_from (fill transfer)', () => {
    it('moves the IMAGE fill into HeroImg and clears HeroContent when the source IS HeroContent', async () => {
      const g = new SceneGraph()
      const root = makeRoot(g)
      const hero = g.createNode('FRAME', root.id, {
        name: 'HeroContent',
        width: 750,
        height: 750,
        fills: [makeImageFill()]
      })

      const ids = await build(g, root.id, { hero_image_from: hero.id })

      expect(g.getNode(ids.hero_img_id)?.fills[0]?.type).toBe('IMAGE')
      // Source IS the HeroContent node (found by name) → cleared to transparent.
      expect(g.getNode(hero.id)?.fills).toEqual([])
      expect(ids.hero_content_id).toBe(hero.id)
      // HeroContent keeps its height as the slot; the image bleeds past it.
      expect(ids.hero_height).toBe(750)
      expect(g.getNode(ids.hero_img_id)?.height).toBe(850)
    })

    it('leaves non-HeroContent source nodes untouched', async () => {
      const g = new SceneGraph()
      const root = makeRoot(g)
      const asset = g.createNode('RECTANGLE', root.id, {
        name: 'UserPhoto',
        width: 750,
        height: 600,
        fills: [makeImageFill()]
      })

      const ids = await build(g, root.id, { hero_image_from: asset.id })

      expect(g.getNode(ids.hero_img_id)?.fills[0]?.type).toBe('IMAGE')
      expect(g.getNode(asset.id)?.fills[0]?.type).toBe('IMAGE')
      // External source: its height IS the hero display height — HeroImg
      // matches it 1:1 (no upscale), and the slot is bleed shorter.
      expect(g.getNode(ids.hero_img_id)?.height).toBe(600)
      expect(g.getNode(ids.hero_content_id)?.height).toBe(500)
    })

    it('adopts a generated-size external image at native height (the 768×864 smoke-run case)', async () => {
      const g = new SceneGraph()
      const root = makeRoot(g)
      // The API-aligned generation the smoke run produced: agent generated
      // standalone instead of into HeroContent, source node = 768×864.
      const generated = g.createNode('FRAME', root.id, {
        name: 'Watercolor wash illustration',
        width: 768,
        height: 864,
        fills: [makeImageFill()]
      })

      const ids = await build(g, root.id, { hero_image_from: generated.id })

      // HeroImg = 864 (image native height, not 864+100=964), slot = 764.
      expect(g.getNode(ids.hero_img_id)?.height).toBe(864)
      expect(ids.hero_height).toBe(764)
      expect(g.getNode(ids.hero_content_id)?.height).toBe(764)
      // Overlay fade spans the image's actual bottom 100px.
      expect(ids.overlay_position.y).toBe(764)

      // Idempotent re-call with the now-synced HeroContent stays at the
      // fixed point (slot 764 → HeroImg 864), no geometric drift.
      const second = await build(g, root.id, { hero_image_from: ids.hero_content_id })
      expect(second.hero_height).toBe(764)
      expect(g.getNode(second.hero_img_id)?.height).toBe(864)
    })

    it('returns a helpful error when an external source is too short for hero_bleed', async () => {
      const g = new SceneGraph()
      const root = makeRoot(g)
      const tiny = g.createNode('RECTANGLE', root.id, {
        name: 'TinyPhoto',
        width: 750,
        height: 150,
        fills: [makeImageFill()]
      })

      const result = await composeBackdropTool.execute(makeFigma(g), {
        root_id: root.id,
        canvas_width: 750,
        canvas_height: 2120,
        hero_image_from: tiny.id
      })
      // NOTE: bun's toMatchObject writes asymmetric matchers into the received
      // object — two toMatchObject calls with different stringContaining on
      // the same property make the second see the first's matcher. Match the
      // error string directly instead.
      if (!('error' in result)) throw new Error('expected an error result')
      expect(result.error).toEqual(expect.stringContaining('hero_bleed'))
      expect(result.error).toEqual(expect.stringContaining('150px'))
    })

    it('says "copied" (not "moved") in the note and flags the uncleared source as a stray image', async () => {
      const g = new SceneGraph()
      const root = makeRoot(g)
      const asset = g.createNode('RECTANGLE', root.id, {
        name: 'UserPhoto',
        width: 750,
        height: 600,
        fills: [makeImageFill()]
      })

      const ids = await build(g, root.id, { hero_image_from: asset.id })

      expect(ids.note).toContain('copied')
      expect(ids.note).not.toContain('moved')
      expect(ids.note).toContain('left untouched')
      // The uncleared source still paints above the overlay — the note must
      // surface that instead of failing silently.
      expect(ids.note).toContain('WARNING')
      expect(ids.note).toContain('"UserPhoto"')
    })

    it('reports the HeroContent transfer without a stray-image warning', async () => {
      const g = new SceneGraph()
      const root = makeRoot(g)
      const hero = g.createNode('FRAME', root.id, {
        name: 'HeroContent',
        width: 750,
        height: 750,
        fills: [makeImageFill()]
      })

      const ids = await build(g, root.id, { hero_image_from: hero.id })

      expect(ids.note).toContain('copied')
      expect(ids.note).toContain('cleared')
      expect(ids.note).not.toContain('WARNING')
    })

    it('tolerates an idempotent re-call whose source was already cleared', async () => {
      const g = new SceneGraph()
      const root = makeRoot(g)
      const hero = g.createNode('FRAME', root.id, {
        name: 'HeroContent',
        width: 750,
        height: 750,
        fills: [makeImageFill()]
      })

      const first = await build(g, root.id, { hero_image_from: hero.id })
      const second = await build(g, root.id, { hero_image_from: hero.id })

      expect(second.hero_img_id).toBe(first.hero_img_id)
      expect(g.getNode(second.hero_img_id)?.fills[0]?.type).toBe('IMAGE')
    })

    it('implicitly adopts the HeroContent IMAGE fill when hero_image_from is omitted', async () => {
      const g = new SceneGraph()
      const root = makeRoot(g)
      // The agent generated the hero into HeroContent, then re-called WITHOUT
      // hero_image_from. Previously this silently destroyed the fresh pixels
      // (upsert forces fills=[]) and the note even claimed "No hero image yet".
      const hero = g.createNode('FRAME', root.id, {
        name: 'HeroContent',
        width: 750,
        height: 750,
        fills: [makeImageFill()]
      })

      const ids = await build(g, root.id)

      expect(g.getNode(ids.hero_img_id)?.fills[0]?.type).toBe('IMAGE')
      expect(ids.hero_content_id).toBe(hero.id)
      expect(g.getNode(hero.id)?.fills).toEqual([])
      expect(ids.note).toContain('adopted as the source automatically')
    })

    it('treats a node merely NAMED HeroContent (not the root slot) as an external source', async () => {
      const g = new SceneGraph()
      const root = makeRoot(g)
      const section = g.createNode('FRAME', root.id, { name: 'Section', width: 750, height: 900 })
      // A nested node that happens to be named HeroContent — identity, not
      // name, decides slot semantics. External: its height IS the display
      // height, so the slot is bleed shorter and pixels are never upscaled.
      const nested = g.createNode('FRAME', section.id, {
        name: 'HeroContent',
        width: 750,
        height: 864,
        fills: [makeImageFill()]
      })

      const ids = await build(g, root.id, { hero_image_from: nested.id })

      expect(ids.hero_height).toBe(764)
      expect(g.getNode(ids.hero_img_id)?.height).toBe(864)
      // The nested source keeps its fill (not the root slot → not cleared)...
      expect(g.getNode(nested.id)?.fills[0]?.type).toBe('IMAGE')
      // ...and a fresh HeroContent slot is created at root.
      expect(ids.hero_content_id).not.toBe(nested.id)
      expect(g.getNode(ids.hero_content_id)?.height).toBe(764)
    })

    it('does not flag a section frame whose IMAGE fill carries content children', async () => {
      const g = new SceneGraph()
      const root = makeRoot(g)
      const hero = g.createNode('FRAME', root.id, {
        name: 'HeroContent',
        width: 750,
        height: 750,
        fills: [makeImageFill()]
      })
      // A legitimate photo-backed section: IMAGE fill + content children.
      const section = g.createNode('FRAME', root.id, {
        name: 'PhotoSection',
        width: 750,
        height: 600,
        fills: [makeImageFill()]
      })
      g.createNode('TEXT', section.id, { text: 'caption' })

      const ids = await build(g, root.id, { hero_image_from: hero.id })
      expect(ids.note).not.toContain('WARNING')
    })
  })

  describe('idempotent re-call', () => {
    it('updates nodes in place instead of duplicating them (recolor path)', async () => {
      const g = new SceneGraph()
      const root = makeRoot(g)
      const first = await build(g, root.id, { hero_color: '#5A7F5BFF' })
      const childCount = root.childIds.length
      const layer = expectDefined(g.getNode(first.background_layer_id), 'layer')
      const layerChildCount = layer.childIds.length

      const second = await build(g, root.id, { hero_color: '#A04030FF' })

      expect(second.background_layer_id).toBe(first.background_layer_id)
      expect(second.hero_img_id).toBe(first.hero_img_id)
      expect(second.hero_content_id).toBe(first.hero_content_id)
      expect(second.backdrop_overlay_id).toBe(first.backdrop_overlay_id)
      expect(root.childIds.length).toBe(childCount)
      expect(layer.childIds.length).toBe(layerChildCount)

      const stops = expectDefined(
        g.getNode(second.backdrop_overlay_id)?.fills[0]?.gradientStops,
        'overlay stops'
      )
      expect(stops[1].color.r).toBeCloseTo(160 / 255, 5)

      // Z-positions re-pinned on every call.
      expect(root.childIds[0]).toBe(second.background_layer_id)
      expect(root.childIds[1]).toBe(second.hero_content_id)
    })

    it('forces HeroContent back to transparent if the agent gave it a fill between calls', async () => {
      const g = new SceneGraph()
      const root = makeRoot(g)
      const first = await build(g, root.id, { hero_color: '#5A7F5BFF' })

      // Agent mistakenly paints the hero slot between calls — an opaque fill
      // here would hide the whole BackgroundLayer.
      graph_updateFill(g, first.hero_content_id)

      const second = await build(g, root.id, { hero_color: '#5A7F5BFF' })
      expect(g.getNode(second.hero_content_id)?.fills).toEqual([])
    })
  })

  it('exposes the expected params', () => {
    const params = composeBackdropTool.params
    expect(params.root_id.required).toBe(true)
    expect(params.canvas_width.required).toBe(true)
    expect(params.canvas_height.required).toBe(true)
    expect(params.hero_height.default).toBe(750)
    expect(params.hero_bleed.default).toBe(100)
    expect(params.hero_color.required).toBeUndefined()
    expect(params.hero_image_from.type).toBe('string')
  })
})

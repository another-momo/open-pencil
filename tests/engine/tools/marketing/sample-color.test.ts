import { describe, expect, it } from 'bun:test'

import { SceneGraph } from '@open-pencil/scene-graph'

import { sampleHeroColorTool } from '#core/tools/marketing/sample-color'

/**
 * Tool-level integration tests for sample-hero-color. We exercise only the
 * deterministic failure paths here (the success path needs CanvasKit and is
 * covered by the smoke run); the pure math that the success path uses lives
 * in sample-color-pure.test.ts.
 */
describe('sample_hero_color tool', () => {
  function makeFigmaStub(graph: SceneGraph) {
    return { graph, getCk: async () => null } as never
  }

  it('returns an error when the id is missing or empty', async () => {
    const g = new SceneGraph()
    expect(await sampleHeroColorTool.execute(makeFigmaStub(g), { id: '' })).toEqual({
      error: expect.stringContaining('hero node id')
    })
    expect(await sampleHeroColorTool.execute(makeFigmaStub(g), { id: 42 })).toMatchObject({
      error: expect.any(String)
    })
  })

  it('returns an error when the node does not exist', async () => {
    const g = new SceneGraph()
    const result = await sampleHeroColorTool.execute(makeFigmaStub(g), { id: 'nope' })
    expect(result).toEqual({ error: expect.stringContaining('not found') })
  })

  it('returns an error when the node has no IMAGE fill', async () => {
    const g = new SceneGraph()
    const page = g.addPage('Page')
    const rect = g.createNode('RECTANGLE', page.id, {
      name: 'NotAnImage',
      width: 100,
      height: 100,
      fills: [{ type: 'SOLID', color: { r: 1, g: 1, b: 1, a: 1 }, opacity: 1, visible: true }]
    })
    const result = await sampleHeroColorTool.execute(makeFigmaStub(g), { id: rect.id })
    expect(result).toMatchObject({ error: expect.stringContaining('no IMAGE fill') })
  })

  it('returns an error when image bytes are not loaded into the graph', async () => {
    const g = new SceneGraph()
    const page = g.addPage('Page')
    const rect = g.createNode('RECTANGLE', page.id, {
      name: 'HeroNoBytes',
      width: 100,
      height: 100,
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
    const result = await sampleHeroColorTool.execute(makeFigmaStub(g), { id: rect.id })
    expect(result).toMatchObject({ error: expect.stringContaining('bytes') })
  })

  it('accepts lighten values in [0,1] and band_height in [16,1024]', () => {
    const band = sampleHeroColorTool.params.band_height
    const lighten = sampleHeroColorTool.params.lighten
    expect(band.type).toBe('number')
    expect(band.min).toBe(16)
    expect(band.max).toBe(1024)
    expect(lighten.type).toBe('number')
    expect(lighten.min).toBe(0)
    expect(lighten.max).toBe(1)
    expect(lighten.default).toBe(0.4)
  })
})
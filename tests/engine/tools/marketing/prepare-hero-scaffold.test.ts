import { describe, expect, it } from 'bun:test'

import { SceneGraph } from '@open-pencil/scene-graph'

import { prepareHeroScaffoldTool } from '#core/tools/marketing/prepare-hero-scaffold'

import { expectDefined } from '#tests/helpers/assert'

/**
 * Tool-level tests for prepare_hero_scaffold. The pinned contract: the
 * scaffold is a PAGE-LEVEL sibling of root (never a child — a hug-height
 * root would be inflated), sized HeroContent.width × (HeroContent.height +
 * hero_bleed), placed at root.x + root.width + 100 / root.y; HeroContent's
 * children are deep-cloned with x/y verbatim and layoutPositioning ABSOLUTE.
 * Idempotent re-calls update geometry and REPLACE the clones, while an
 * existing IMAGE fill (hero already generated) is preserved.
 */
describe('prepare_hero_scaffold tool', () => {
  function makeFigma(graph: SceneGraph) {
    return { graph } as never
  }

  function makeRoot(g: SceneGraph) {
    const page = g.addPage('Page')
    return g.createNode('FRAME', page.id, {
      name: 'ProductLong',
      x: 200,
      y: 300,
      width: 750,
      height: 2120,
      layoutMode: 'VERTICAL'
    })
  }

  function makeHeroContent(g: SceneGraph, rootId: string) {
    const hero = g.createNode('FRAME', rootId, {
      name: 'HeroContent',
      width: 750,
      height: 750
    })
    g.createNode('TEXT', hero.id, {
      name: 'Title',
      x: 60,
      y: 120,
      width: 630,
      height: 120,
      text: '端午安康'
    })
    g.createNode('TEXT', hero.id, {
      name: 'Subtitle',
      x: 60,
      y: 280,
      width: 400,
      height: 40,
      text: '粽叶飘香'
    })
    return hero
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

  interface Built {
    scaffold_id: string
    width: number
    height: number
    hero_bleed: number
    cloned_children: number
    note: string
  }

  async function build(g: SceneGraph, rootId: string, extra: Record<string, unknown> = {}) {
    const result = (await prepareHeroScaffoldTool.execute(makeFigma(g), {
      root_id: rootId,
      ...extra
    })) as Built | { error: string }
    expect(result).not.toHaveProperty('error')
    return result as Built
  }

  describe('validation', () => {
    it('returns an error when root_id is missing', async () => {
      const g = new SceneGraph()
      const result = await prepareHeroScaffoldTool.execute(makeFigma(g), { root_id: '' })
      expect(result).toEqual({ error: expect.stringContaining('root frame id') })
    })

    it('returns an error when the root does not exist or is not a FRAME', async () => {
      const g = new SceneGraph()
      const missing = await prepareHeroScaffoldTool.execute(makeFigma(g), { root_id: 'missing' })
      expect(missing).toMatchObject({ error: expect.stringContaining('not found') })
      const page = g.addPage('Page')
      const notFrame = await prepareHeroScaffoldTool.execute(makeFigma(g), { root_id: page.id })
      expect(notFrame).toMatchObject({ error: expect.stringContaining('not a FRAME') })
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
      const result = await prepareHeroScaffoldTool.execute(makeFigma(g), { root_id: root.id })
      expect(result).toMatchObject({ error: expect.stringContaining('auto-layout') })
    })

    it('returns a guiding error when HeroContent is missing', async () => {
      const g = new SceneGraph()
      const root = makeRoot(g)
      const result = await prepareHeroScaffoldTool.execute(makeFigma(g), { root_id: root.id })
      // NOTE: bun's toMatchObject writes asymmetric matchers into the received
      // object — two stringContaining assertions on the same property must
      // match the string directly instead (see compose-backdrop.test.ts).
      if (!('error' in result)) throw new Error('expected an error result')
      expect(result.error).toEqual(expect.stringContaining('HeroContent'))
      expect(result.error).toEqual(expect.stringContaining('骨架阶段'))
    })

    it('rejects a non-finite or out-of-range hero_bleed', async () => {
      const g = new SceneGraph()
      const root = makeRoot(g)
      makeHeroContent(g, root.id)
      const negative = await prepareHeroScaffoldTool.execute(makeFigma(g), {
        root_id: root.id,
        hero_bleed: -5
      })
      expect(negative).toMatchObject({ error: expect.stringContaining('hero_bleed') })
      const huge = await prepareHeroScaffoldTool.execute(makeFigma(g), {
        root_id: root.id,
        hero_bleed: 5000
      })
      expect(huge).toMatchObject({ error: expect.stringContaining('1000px maximum') })
    })
  })

  describe('geometry and topology', () => {
    it('creates the scaffold as a page-level sibling to the right of root', async () => {
      const g = new SceneGraph()
      const root = makeRoot(g)
      makeHeroContent(g, root.id)

      const built = await build(g, root.id)

      const scaffold = expectDefined(g.getNode(built.scaffold_id), 'scaffold')
      // Page-level sibling — NOT a root child (a hug-height root must not be
      // inflated by the scaffold).
      expect(scaffold.parentId).toBe(root.parentId)
      expect(root.childIds).not.toContain(scaffold.id)
      expect(scaffold.x).toBe(200 + 750 + 100)
      expect(scaffold.y).toBe(300)
    })

    it('sizes the scaffold as HeroContent.width × (HeroContent.height + hero_bleed)', async () => {
      const g = new SceneGraph()
      const root = makeRoot(g)
      makeHeroContent(g, root.id)

      const built = await build(g, root.id)

      expect(built.width).toBe(750)
      expect(built.height).toBe(850)
      expect(built.hero_bleed).toBe(100)
      const scaffold = expectDefined(g.getNode(built.scaffold_id), 'scaffold')
      expect(scaffold.width).toBe(750)
      expect(scaffold.height).toBe(850)
      expect(scaffold.layoutMode).toBe('NONE')
      expect(scaffold.clipsContent).toBe(true)
      expect(scaffold.fills[0]?.type).toBe('SOLID')
    })

    it('honors a custom hero_bleed', async () => {
      const g = new SceneGraph()
      const root = makeRoot(g)
      makeHeroContent(g, root.id)
      const built = await build(g, root.id, { hero_bleed: 250 })
      expect(built.height).toBe(1000)
    })

    it('clones HeroContent children with coordinates verbatim and ABSOLUTE positioning', async () => {
      const g = new SceneGraph()
      const root = makeRoot(g)
      makeHeroContent(g, root.id)

      const built = await build(g, root.id)

      expect(built.cloned_children).toBe(2)
      const scaffold = expectDefined(g.getNode(built.scaffold_id), 'scaffold')
      expect(scaffold.childIds.length).toBe(2)
      const title = expectDefined(g.getNode(scaffold.childIds[0] as string), 'title clone')
      expect(title.name).toBe('Title')
      // Verbatim coordinates — the slot occupies the scaffold's top 750px,
      // so no conversion is applied.
      expect(title.x).toBe(60)
      expect(title.y).toBe(120)
      expect(title.width).toBe(630)
      expect(title.height).toBe(120)
      expect(title.layoutPositioning).toBe('ABSOLUTE')
      const subtitle = expectDefined(g.getNode(scaffold.childIds[1] as string), 'subtitle clone')
      expect(subtitle.y).toBe(280)
    })

    it('points the note at generate_image and compose_backdrop with the scaffold id', async () => {
      const g = new SceneGraph()
      const root = makeRoot(g)
      makeHeroContent(g, root.id)
      const built = await build(g, root.id)
      expect(built.note).toContain(`replace_id = "${built.scaffold_id}"`)
      expect(built.note).toContain('"composite": true')
      expect(built.note).toContain('compose_backdrop')
      expect(built.note).toContain(`hero_image_from: "${built.scaffold_id}"`)
    })
  })

  describe('idempotent re-call', () => {
    it('updates geometry in place and replaces the cloned children', async () => {
      const g = new SceneGraph()
      const root = makeRoot(g)
      const hero = makeHeroContent(g, root.id)

      const first = await build(g, root.id)
      const firstScaffold = expectDefined(g.getNode(first.scaffold_id), 'scaffold')
      const firstCloneIds = [...firstScaffold.childIds]

      // Copy changes between calls: a new child appears, an old one moves.
      g.createNode('TEXT', hero.id, { name: 'Logo', x: 60, y: 40, width: 80, height: 80 })
      g.updateNode(firstCloneIds[0] as string, { y: 999 }) // user nudged the stale clone
      const sourceTitle = expectDefined(
        hero.childIds.map((id: string) => g.getNode(id)).find((n) => n?.name === 'Title'),
        'source title'
      )
      g.updateNode(sourceTitle.id, { y: 140, text: '端午安康·2026' })

      const second = await build(g, root.id)

      expect(second.scaffold_id).toBe(first.scaffold_id)
      expect(second.cloned_children).toBe(3)
      const scaffold = expectDefined(g.getNode(second.scaffold_id), 'scaffold')
      expect(scaffold.childIds.length).toBe(3)
      // Stale clones are gone entirely — replaced, not patched.
      for (const staleId of firstCloneIds) {
        expect(g.getNode(staleId)).toBeUndefined()
      }
      const title = expectDefined(
        scaffold.childIds.map((id: string) => g.getNode(id)).find((n) => n?.name === 'Title'),
        'refreshed title clone'
      )
      expect(title.y).toBe(140)
      expect(scaffold.childIds.map((id: string) => g.getNode(id)?.name)).toContain('Logo')
    })

    it('preserves an existing IMAGE fill (hero already generated) and only refreshes children', async () => {
      const g = new SceneGraph()
      const root = makeRoot(g)
      makeHeroContent(g, root.id)

      const first = await build(g, root.id)
      // Hero got generated into the scaffold between calls.
      g.updateNode(first.scaffold_id, { fills: [makeImageFill()] })

      const second = await build(g, root.id)

      const scaffold = expectDefined(g.getNode(second.scaffold_id), 'scaffold')
      expect(scaffold.fills[0]?.type).toBe('IMAGE')
      expect(scaffold.childIds.length).toBe(2)
    })

    it('resets fills to white SOLID on re-call when no IMAGE fill exists', async () => {
      const g = new SceneGraph()
      const root = makeRoot(g)
      makeHeroContent(g, root.id)

      const first = await build(g, root.id)
      g.updateNode(first.scaffold_id, {
        fills: [{ type: 'SOLID', color: { r: 1, g: 0, b: 0, a: 1 }, opacity: 1, visible: true }]
      })

      const second = await build(g, root.id)

      const fill = expectDefined(g.getNode(second.scaffold_id)?.fills[0], 'scaffold fill')
      expect(fill.type).toBe('SOLID')
      expect(fill.color).toEqual({ r: 1, g: 1, b: 1, a: 1 })
    })

    it('moves the scaffold when the root moved between calls', async () => {
      const g = new SceneGraph()
      const root = makeRoot(g)
      makeHeroContent(g, root.id)
      const first = await build(g, root.id)

      g.updateNode(root.id, { x: 500, y: 100 })
      const second = await build(g, root.id)

      const scaffold = expectDefined(g.getNode(second.scaffold_id), 'scaffold')
      expect(scaffold.id).toBe(first.scaffold_id)
      expect(scaffold.x).toBe(500 + 750 + 100)
      expect(scaffold.y).toBe(100)
    })
  })

  it('exposes the expected params', () => {
    const params = prepareHeroScaffoldTool.params
    expect(params.root_id.required).toBe(true)
    expect(params.hero_bleed.default).toBe(100)
    expect(params.hero_bleed.min).toBe(0)
    expect(params.hero_bleed.max).toBe(1000)
    expect(prepareHeroScaffoldTool.mutates).toBe(true)
  })
})

import { describe, expect, it } from 'bun:test'

import { renderJSX } from '@open-pencil/core'

import { linearGradientEndpoints } from '#core/canvas/fills'

import { expectDefined, getNodeOrThrow } from '#tests/helpers/assert'
import { makeSceneGraph } from '#tests/helpers/scene'

/**
 * Pins the composition primitives that the marketing prompt and the
 * watercolor_poster_v1 profile use. Each test mirrors a recipe verbatim —
 * if a recipe silently stops producing the intended node, the agent would
 * emit valid-looking JSX that renders nothing, which is exactly the
 * failure mode these tests must not allow to slip through.
 */
describe('composition primitives (prompt recipes)', () => {
  it('vertical-gradient transform runs top-to-bottom, unlike the identity default', async () => {
    const g = makeSceneGraph()
    const [result] = await renderJSX(
      g,
      `<Rectangle name="Backdrop" w={750} h={600} fills={[
         linearGradient([["#E8F0E2", 0], ["#FDFCF7", 1]],
           { transform: { m00: 0, m01: 1, m02: 0, m10: -1, m11: 0, m12: 1 } })
       ]} />`
    )

    const node = getNodeOrThrow(g, expectDefined(result, 'render result').id)
    const fill = expectDefined(node.fills[0], 'gradient fill')
    expect(fill.type).toBe('GRADIENT_LINEAR')
    expect(fill.gradientStops?.length).toBe(2)

    const endpoints = linearGradientEndpoints(
      node.width,
      node.height,
      expectDefined(fill.gradientTransform, 'gradient transform')
    )
    expect(endpoints.start).toEqual({ x: 0, y: 0 })
    expect(endpoints.end).toEqual({ x: 0, y: 600 })
  })

  it('omitting the transform yields right-to-left, which is why the prompt always passes one', async () => {
    const g = makeSceneGraph()
    const [result] = await renderJSX(
      g,
      `<Rectangle w={750} h={600} fills={[linearGradient([["#000000", 0], ["#FFFFFF", 1]])]} />`
    )

    const node = getNodeOrThrow(g, expectDefined(result, 'render result').id)
    const fill = expectDefined(node.fills[0], 'gradient fill')
    const endpoints = linearGradientEndpoints(
      node.width,
      node.height,
      expectDefined(fill.gradientTransform, 'gradient transform')
    )
    expect(endpoints.start).toEqual({ x: 750, y: 0 })
    expect(endpoints.end).toEqual({ x: 0, y: 0 })
  })

  it('mask="alpha" marks the node as an alpha mask over its following siblings', async () => {
    const g = makeSceneGraph()
    const [result] = await renderJSX(
      g,
      `<Frame name="SeamB" w={750} h={400}>
         <Rectangle name="SeamFeather" mask="alpha" w={750} h={120} fills={[
           linearGradient([["#FFFFFF00", 0], ["#FFFFFFFF", 1]],
             { transform: { m00: 0, m01: 1, m02: 0, m10: -1, m11: 0, m12: 1 } })
         ]} />
         <Rectangle name="ImgB" w={750} h={400} bg="#E2E8F0" />
       </Frame>`
    )

    const frame = getNodeOrThrow(g, expectDefined(result, 'render result').id)
    const mask = getNodeOrThrow(g, expectDefined(frame.childIds[0], 'mask child'))
    expect(mask.name).toBe('SeamFeather')
    expect(mask.isMask).toBe(true)
    expect(mask.maskType).toBe('ALPHA')
    // Figma semantics: the mask applies to siblings that come after it.
    const masked = getNodeOrThrow(g, expectDefined(frame.childIds[1], 'masked child'))
    expect(masked.name).toBe('ImgB')
    expect(masked.isMask).toBeFalsy()
  })

  it('blendMode="hue" reaches the node as HUE for the global tint layer', async () => {
    const g = makeSceneGraph()
    const [result] = await renderJSX(
      g,
      `<Rectangle name="GlobalTint" w={750} h={2400} bg="#4A7C3F" blendMode="hue" opacity={0.2} />`
    )

    const node = getNodeOrThrow(g, expectDefined(result, 'render result').id)
    expect(node.blendMode).toBe('HUE')
    expect(node.opacity).toBe(0.2)
  })

  it('stacks multiple fills in paint order for color-on-base', async () => {
    const g = makeSceneGraph()
    const [result] = await renderJSX(
      g,
      `<Rectangle w={750} h={600} fills={[
         solid("#FDFCF7"),
         linearGradient([["#4A7C3F33", 0], ["#4A7C3F00", 1]],
           { transform: { m00: 0, m01: 1, m02: 0, m10: -1, m11: 0, m12: 1 } })
       ]} />`
    )

    const node = getNodeOrThrow(g, expectDefined(result, 'render result').id)
    expect(node.fills.length).toBe(2)
    expect(expectDefined(node.fills[0], 'base fill').type).toBe('SOLID')
    expect(expectDefined(node.fills[1], 'overlay fill').type).toBe('GRADIENT_LINEAR')
  })

  it('radialGradient is in scope for glow/vignette decoration', async () => {
    const g = makeSceneGraph()
    const [result] = await renderJSX(
      g,
      `<Ellipse w={400} h={400} fills={[radialGradient([["#FFF6D8CC", 0], ["#FFF6D800", 1]])]} />`
    )

    const node = getNodeOrThrow(g, expectDefined(result, 'render result').id)
    expect(expectDefined(node.fills[0], 'radial fill').type).toBe('GRADIENT_RADIAL')
  })

  /**
   * Watercolor poster backdrop: a single hero image is overlaid by a
   * gradient rectangle whose three stops form a fade-in/cover over the
   * hero bottom and a fade-out into opaque white at the canvas foot.
   * The overlay y = heroBottom − 100; the middle stop sits at
   * 100 / overlayHeight so it lands exactly on the hero bottom edge.
   *
   * The middle stop's color comes from sample_hero_color and is opaque
   * here only because the test pins the recipe shape — a real run would
   * substitute whatever hex the tool returned.
   */
  it('watercolor backdrop: three-stop overlay with the middle stop pinned to the hero bottom edge', async () => {
    const g = makeSceneGraph()
    const heroBottom = 800
    const overlayHeight = 5400 - heroBottom
    const overlayTopY = heroBottom - 100
    const middlePos = 100 / overlayHeight
    const heroColor = '#4A7C3F'

    const [result] = await renderJSX(
      g,
      `<Rectangle name="FadeOverlay" x={0} y={${overlayTopY}} w={750} h={${overlayHeight}} fills={[
        linearGradient([
          ["#FFFFFF00", 0],
          ["${heroColor}", ${middlePos}],
          ["#FFFFFF", 1]
        ], { transform: { m00: 0, m01: 1, m02: 0, m10: -1, m11: 0, m12: 1 } })
      ]} />`
    )

    const node = getNodeOrThrow(g, expectDefined(result, 'render result').id)
    expect(node.x).toBe(0)
    expect(node.y).toBe(overlayTopY)
    expect(node.height).toBe(overlayHeight)

    const fill = expectDefined(node.fills[0], 'overlay fill')
    expect(fill.type).toBe('GRADIENT_LINEAR')
    const stops = expectDefined(fill.gradientStops, 'gradient stops')
    expect(stops.length).toBe(3)

    // Stop 0: pure white, fully transparent — #FFFFFF00 must be passed as
    // 8-digit hex (alpha channel), because #FFFFFF alone parses to a=1 and
    // the overlay would visibly cover the hero instead of fading out.
    const top = stops[0]
    expect(top.color).toEqual({ r: 1, g: 1, b: 1, a: 0 })
    expect(top.position).toBe(0)

    // Stop 1 (the hero bottom edge): the sampled hero color, fully opaque.
    expect(middlePos).toBeCloseTo(100 / overlayHeight, 10)
    expect(stops[1].position).toBeCloseTo(middlePos, 10)
    expect(stops[1].color.a).toBe(1)
    expect(stops[1].color).not.toEqual({ r: 1, g: 1, b: 1, a: 1 })

    // Stop 2: pure white again, fully opaque.
    const bottom = expectDefined(stops[2], 'bottom stop')
    expect(bottom.color).toEqual({ r: 1, g: 1, b: 1, a: 1 })
    expect(bottom.position).toBe(1)

    expect(stops[1].position).toBeGreaterThan(0)
    expect(stops[1].position).toBeLessThan(1)

    const endpoints = linearGradientEndpoints(
      node.width,
      node.height,
      expectDefined(fill.gradientTransform, 'gradient transform')
    )
    expect(endpoints.start).toEqual({ x: 0, y: 0 })
    expect(endpoints.end).toEqual({ x: 0, y: overlayHeight })
  })
})
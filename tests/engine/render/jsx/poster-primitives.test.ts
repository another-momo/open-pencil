import { describe, expect, it } from 'bun:test'

import { renderJSX } from '@open-pencil/core'

import { linearGradientEndpoints } from '#core/canvas/fills'

import { expectDefined, getNodeOrThrow } from '#tests/helpers/assert'
import { makeSceneGraph } from '#tests/helpers/scene'

/**
 * Pins the poster-composition primitives that system-prompt-base.md documents
 * (docs/plans/tasks/poster-quality-experiment.md T1). Each test mirrors a
 * recipe verbatim from the prompt — if a recipe silently stops producing the
 * intended node, the agent would emit valid-looking JSX that renders nothing,
 * which is exactly the failure mode the experiment must not confound with
 * "the model has no taste".
 */
describe('poster composition primitives (prompt recipes)', () => {
  it('VERTICAL_GRADIENT transform runs top-to-bottom, unlike the identity default', async () => {
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

    // The prompt tells the agent this transform means "top to bottom".
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

  it('stacks multiple fills in paint order for texture over base color', async () => {
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
})

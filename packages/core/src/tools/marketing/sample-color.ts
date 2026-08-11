/**
 * sample-hero-color tool (poster-quality experiment)
 *
 * Reads the actual pixels of an image-filled hero node and returns a
 * representative hex color from a configurable edge band. Used by profile
 * backdrop recipes to pick the middle stop of a transition gradient —
 * sampling from the image itself removes the "guess the theme color"
 * failure mode that leaves the gradient visually disconnected from the
 * hero above it.
 *
 * Direction is configurable (default bottom) so profiles can target any
 * edge. The averaging and region math live in sample-color-pure.ts and
 * are CanvasKit-free for unit testing.
 */

import type { Fill, SceneGraph, SceneNode } from '@open-pencil/scene-graph'
import type { Rect, Size } from '@open-pencil/scene-graph/primitives'

import { getCanvasKit } from '#core/canvaskit'
import { defineTool } from '#core/tools/schema'

import {
  averageRegion,
  bandColorToHex,
  bandRegion,
  type SampleDirection
} from './sample-color-pure'

const DEFAULT_DIRECTION: SampleDirection = 'bottom'
const DEFAULT_BAND_SIZE = 100

const DIRECTIONS: SampleDirection[] = ['top', 'bottom', 'left', 'right', 'center']

export const sampleHeroColorTool = defineTool({
  name: 'sample_hero_color',
  mutates: false,
  description:
    'Read the actual pixels of an image-filled hero node and return a representative hex color from a configurable edge band. Use this to pick gradient stops so the transition matches the hero image instead of guessing the theme color. Pass the hero node id (a Frame or Rectangle with an IMAGE fill, or a child of such a Frame). Returns "#RRGGBB".',
  params: {
    id: {
      type: 'string',
      description:
        'Node id of the hero element. May be the Frame/Rectangle that holds the IMAGE fill, or a text/image child of such a Frame.',
      required: true
    },
    direction: {
      type: 'string',
      description:
        'Which edge of the image to sample. Default "bottom" — typical for backdrop gradients that fade into a hero above. "top" for overlays above the hero, "left"/"right" for side-fade designs, "center" for flat moody fields.',
      default: DEFAULT_DIRECTION,
      enum: DIRECTIONS
    },
    band_size: {
      type: 'number',
      description:
        'Thickness of the band in pixels along the chosen direction (rows for top/bottom/center, columns for left/right). Default 100 covers a typical hero footer; raise it for moody/flat color fields, lower it for tight gradients.',
      default: DEFAULT_BAND_SIZE,
      min: 16,
      max: 1024
    }
  },
  execute: async (figma, args) => {
    const id = args.id
    if (typeof id !== 'string' || id.length === 0) {
      return { error: 'Pass a hero node id (non-empty string).' }
    }
    const direction =
      typeof args.direction === 'string' && DIRECTIONS.includes(args.direction as SampleDirection)
        ? (args.direction as SampleDirection)
        : DEFAULT_DIRECTION
    const bandSize = typeof args.band_size === 'number' ? args.band_size : DEFAULT_BAND_SIZE

    const node = figma.graph.getNode(id)
    if (!node) return { error: `Node "${id}" not found` }

    const imageBearing = findImageBearingNode(figma.graph, node)
    if (!imageBearing) {
      return {
        error:
          'Hero node has no IMAGE fill (also checked its ancestors). Pass the id of a Frame or Rectangle whose fill is an image, or a child of such a Frame.'
      }
    }
    const { imageNode, fill } = imageBearing

    const sampled = await sampleImageFillColor(figma.graph, fill, direction, bandSize)
    if ('error' in sampled) return { error: sampled.error }

    return {
      id,
      direction,
      region: sampled.region,
      imageSize: sampled.imageSize,
      hex: sampled.hex,
      note: `Averaged ${direction} band of hero "${imageNode.name}" (${sampled.imageSize.width}×${sampled.imageSize.height}, ${sampled.region.width}×${sampled.region.height} starting at ${sampled.region.x},${sampled.region.y}). Drop this hex into the gradient stop that sits on this edge.`
    }
  }
})

export type SampleResult = { hex: string; region: Rect; imageSize: Size } | { error: string }

/**
 * CanvasKit pixel path shared by sample_hero_color and compose_backdrop's
 * internalized auto-sampling. Reads the bytes behind an IMAGE fill and
 * averages the requested edge band. Pure math lives in sample-color-pure.
 */
export async function sampleImageFillColor(
  graph: SceneGraph,
  fill: Fill,
  direction: SampleDirection,
  bandSize: number
): Promise<SampleResult> {
  const imageHash = fill.imageHash
  if (!imageHash) {
    return { error: 'Hero image fill is missing its imageHash reference.' }
  }
  if (!graph.images.has(imageHash)) {
    return { error: `Image bytes for hash "${imageHash}" are not loaded in the graph.` }
  }
  const bytes = graph.images.get(imageHash) as Uint8Array

  const ck = await getCanvasKit()
  const skImg = ck.MakeImageFromEncoded(bytes)
  if (!skImg) {
    return { error: 'Could not decode hero image bytes.' }
  }

  const width = skImg.width()
  const height = skImg.height()
  const region = bandRegion(direction, width, height, bandSize)

  // Read the full image buffer, not a sub-region. `averageRegion` expects
  // a full-image buffer and uses `imageWidth` as the row stride — passing
  // a sub-region buffer causes out-of-bounds reads and produces NaN.
  const pixels = skImg.readPixels(0, 0, {
    alphaType: ck.AlphaType.Unpremul,
    colorSpace: ck.ColorSpace.SRGB,
    colorType: ck.ColorType.RGBA_8888,
    width,
    height
  })
  skImg.delete()

  if (!pixels || !(pixels instanceof Uint8Array)) {
    return { error: `Could not read pixels from hero image (${direction} band).` }
  }

  const avg = averageRegion(pixels, width, region.x, region.y, region.width, region.height)
  if (avg.samples === 0) {
    return { error: `Hero image returned no pixels in the ${direction} band.` }
  }
  if (!Number.isFinite(avg.r) || !Number.isFinite(avg.g) || !Number.isFinite(avg.b)) {
    // Defensive: NaN here means the buffer shape did not match the stride
    // we asked the pure function to use. Surface as an error rather than
    // returning a fake "#NANNANNAN" hex.
    return {
      error: `Sampled color is not finite (got r=${avg.r}, g=${avg.g}, b=${avg.b}). This is a tool bug — please report it.`
    }
  }
  return { hex: bandColorToHex(avg), region, imageSize: { width, height } }
}

/**
 * The documented contract allows passing a child of the image-bearing Frame
 * (e.g. a title text inside HeroImg) — walk up to the nearest ancestor with
 * an IMAGE fill. The visited-set guards against parentId cycles in a
 * corrupt graph.
 */
function findImageBearingNode(
  graph: SceneGraph,
  start: SceneNode
): { imageNode: SceneNode; fill: Fill } | undefined {
  let imageNode = start
  const visited = new Set<string>([start.id])
  for (;;) {
    const fill = imageNode.fills.find((f) => f.type === 'IMAGE')
    if (fill) return { imageNode, fill }
    const parentId = imageNode.parentId
    if (!parentId || visited.has(parentId)) return undefined
    visited.add(parentId)
    const parent = graph.getNode(parentId)
    if (!parent) return undefined
    imageNode = parent
  }
}

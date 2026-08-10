/**
 * sample-hero-color tool (poster-quality experiment)
 *
 * Reads the actual pixels of an image-filled hero node's bottom band and
 * returns a representative hex color. Used by the long-image backdrop recipe
 * to pick the middle stop of the white-tinted transition gradient — sampling
 * from the image itself removes the "guess the theme color" failure mode that
 * leaves the gradient visually disconnected from the hero above it.
 *
 * The averaging and color-adjustment logic is kept pure (see pure.ts) so it
 * can be tested without the CanvasKit runtime.
 */

import { getCanvasKit } from '#core/canvaskit'
import { defineTool } from '#core/tools/schema'
import { adjustChannel, averageBandColor, bandColorToHex } from './sample-color-pure'

const DEFAULT_BAND_HEIGHT = 100

export const sampleHeroColorTool = defineTool({
  name: 'sample_hero_color',
  description:
    'Read the actual pixels of an image-filled hero node and return a representative hex color from its bottom band (default 100px tall). Use this to pick the middle stop of a backdrop gradient so the transition matches the hero image instead of guessing the theme color. Pass the hero node id (a Frame or Rectangle with an IMAGE fill, or a child whose parent holds the image). Returns "#RRGGBB".',
  params: {
    id: {
      type: 'string',
      description:
        'Node id of the hero element. May be the Frame/Rectangle that holds the IMAGE fill, or a text/image child of such a Frame.',
      required: true
    },
    band_height: {
      type: 'number',
      description:
        'Pixel height of the band sampled from the bottom of the image. Default 100 covers a typical hero footer; raise it for moody/flat color fields.',
      default: DEFAULT_BAND_HEIGHT,
      min: 16,
      max: 1024
    },
    lighten: {
      type: 'number',
      description:
        'Pull the result toward white by this fraction (0–1, default 0.4). Long-image backdrops usually need a tinted, softer version of the hero color to coexist with white text.',
      default: 0.4,
      min: 0,
      max: 1
    }
  },
  execute: async (figma, args) => {
    const id = args.id
    if (typeof id !== 'string' || id.length === 0) {
      return { error: 'Pass a hero node id (non-empty string).' }
    }
    const bandHeight = typeof args.band_height === 'number' ? args.band_height : DEFAULT_BAND_HEIGHT
    const lighten = typeof args.lighten === 'number' ? args.lighten : 0.4

    const node = figma.graph.getNode(id)
    if (!node) return { error: `Node "${id}" not found` }

    const fill = node.fills.find((f) => f.type === 'IMAGE')
    if (!fill || fill.type !== 'IMAGE') {
      return {
        error:
          'Hero node has no IMAGE fill. Pass the id of a Frame or Rectangle whose fill is an image (or a child of such a Frame).'
      }
    }

    const imageHash = fill.imageHash as string | undefined
    if (!imageHash) {
      return { error: 'Hero image fill is missing its imageHash reference.' }
    }
    if (!figma.graph.images.has(imageHash)) {
      return { error: `Image bytes for hash "${imageHash}" are not loaded in the graph.` }
    }
    const bytes = figma.graph.images.get(imageHash) as Uint8Array

    const ck = await getCanvasKit()
    const skImg = ck.MakeImageFromEncoded(bytes)
    if (!skImg) {
      return { error: 'Could not decode hero image bytes.' }
    }

    const width = skImg.width()
    const height = skImg.height()
    const bandTop = Math.max(0, height - bandHeight)
    const pixels = skImg.readPixels(0, bandTop, {
      alphaType: ck.AlphaType.Unpremul,
      colorType: ck.ColorType.RGBA_8888,
      colorSpace: ck.ColorSpace.SRGB,
      width,
      height: bandHeight
    })
    skImg.delete()

    if (!pixels || !(pixels instanceof Uint8Array)) {
      return { error: 'Could not read pixels from hero image bottom band.' }
    }

    const avg = averageBandColor(pixels, width, bandHeight)
    const adjusted = {
      r: adjustChannel(avg.r, lighten),
      g: adjustChannel(avg.g, lighten),
      b: adjustChannel(avg.b, lighten)
    }
    const hex = bandColorToHex(adjusted)

    return {
        id,
        band: { top: bandTop, height: bandHeight, width, fullHeight: height },
        hex,
        note: `Averaged bottom band of hero "${node.name}" (${width}×${height}, sampled last ${bandHeight}px), lightened ${(lighten * 100).toFixed(0)}% toward white. Drop this hex into the middle stop of the backdrop gradient — it the hero theme color, not a guess.`
      }
  }
})
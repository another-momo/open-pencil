/**
 * cutout tool (decoration asset pipeline, see docs/research/2026-08-11-
 * design-technique-distillation-map.md §12).
 *
 * Turns an image generated against a solid chroma background (green screen)
 * into transparent PNG decoration assets: reads the pixels behind an IMAGE
 * fill, removes the corner-sampled chroma by FLOOD FILL from the edges
 * (subject interiors matching the chroma survive), despills, erodes the
 * fringe, then splits by CONNECTED COMPONENTS — sheet elements that drift
 * out of their grid cells are cut correctly, no grid assumption at all.
 *
 * Scope (honest boundary): solid-color backgrounds only — AI green-screen
 * generations and flat/white product shots. Complex photographic backgrounds
 * need model-based matting, which is a different route. Soft translucency
 * (smoke, glow) is never keyed — it belongs inside generated opaque images.
 *
 * The pixel math lives in cutout-pure.ts (CanvasKit-free, unit-tested).
 */

import type { Fill, SceneGraph, SceneNode } from '@open-pencil/scene-graph'
import { computeImageHash } from '@open-pencil/scene-graph/images'

import { getCanvasKit } from '#core/canvaskit'
import { defineTool } from '#core/tools/schema'

import {
  applyAlpha,
  cornerSpread,
  cropRegion,
  despill,
  erodeAlpha,
  floodBackground,
  labelComponents,
  parseChromaHex,
  preservedChromaCount,
  sampleCornerColor,
  type Rect
} from './cutout-pure'
import { findImageBearingNode } from './sample-color'

const DEFAULT_TOLERANCE = 90
const DEFAULT_ERODE = 1
const UNIFORM_SPREAD_LIMIT = 24
const MIN_COMPONENT_AREA = 256
const PRESERVED_CHROMA_WARN_RATIO = 0.005
const DISPLAY_WIDTH = 160
const DISPLAY_GAP = 24
const DISPLAY_OFFSET_Y = 40

interface CutoutElement {
  id: string
  name: string
  width: number
  height: number
  nativeWidth: number
  nativeHeight: number
  area: number
}

export const cutoutTool = defineTool({
  name: 'cutout',
  mutates: true,
  description:
    'Cut decoration assets out of a solid-color-background image (green screen) into transparent PNGs. Use after generate_image produces a chroma sheet — pass its node id. The background is removed by flood fill from the image edges (subject interiors that happen to match the chroma are preserved), then each connected element becomes its own asset node in reading order — grid drift in the sheet is fine, elements are found by connectivity, not sliced by cells. The background chroma is measured from the image corners (auto) unless pinned via chroma. Only works on solid backgrounds (AI green screens, flat product-shot backdrops) — not complex photo backgrounds, and never for smoke/glow translucency (bake those into the generated image instead).',
  params: {
    id: {
      type: 'string',
      description:
        'Node id of the image to cut out (a Frame/Rectangle with an IMAGE fill, or a child of such a Frame).',
      required: true
    },
    expected: {
      type: 'number',
      description:
        'How many elements the sheet should contain (e.g. 9 for a 3x3 sticker sheet). Optional — when given, a mismatch with the number of separated elements produces a WARNING (elements touching, missed, or split).',
      min: 1,
      max: 32
    },
    chroma: {
      type: 'string',
      description:
        'Background color as 6-digit hex (default "#00FF00" is NOT assumed — the actual background is measured from the image corners). Pass explicitly only for non-green screens, e.g. "#FF00FF" when the subject contains green.'
    },
    tolerance: {
      type: 'number',
      description: `RGB distance under which a pixel counts as background. Default ${DEFAULT_TOLERANCE}; raise it if the model rendered an uneven background, lower it if subject edges are being eaten.`,
      default: DEFAULT_TOLERANCE,
      min: 10,
      max: 200
    },
    despill: {
      type: 'boolean',
      description: 'Suppress chroma spill on kept edge pixels (green bounce light). Default true.',
      default: true
    },
    erode: {
      type: 'number',
      description: `Fringe erosion in pixels. Default ${DEFAULT_ERODE} removes the anti-aliased chroma fringe; 0 keeps edges as classified.`,
      default: DEFAULT_ERODE,
      min: 0,
      max: 4
    },
    min_area: {
      type: 'number',
      description: `Minimum component area in px² — smaller blobs are treated as keying noise. Default ${MIN_COMPONENT_AREA} suits megapixel sheets; lower it for small test images.`,
      default: MIN_COMPONENT_AREA,
      min: 1,
      max: 100000
    }
  },
  execute: async (figma, args) => {
    const id = args.id
    if (typeof id !== 'string' || id.length === 0) {
      return { error: 'Pass an image node id (non-empty string).' }
    }
    const graph = figma.graph
    const node = graph.getNode(id)
    if (!node) return { error: `Node "${id}" not found` }

    const imageBearing = findImageBearingNode(graph, node)
    if (!imageBearing) {
      return {
        error:
          'Node has no IMAGE fill (also checked its ancestors). Pass the generated sheet image node.'
      }
    }
    const { imageNode, fill } = imageBearing
    if (!fill.imageHash || !graph.images.has(fill.imageHash)) {
      return { error: 'Image bytes are not loaded in the graph for this fill.' }
    }

    const chromaArg = typeof args.chroma === 'string' ? args.chroma : undefined
    if (chromaArg !== undefined && !parseChromaHex(chromaArg)) {
      return { error: `chroma "${chromaArg}" is not a valid 6-digit hex (e.g. "#00FF00").` }
    }
    const tolerance =
      typeof args.tolerance === 'number' && Number.isFinite(args.tolerance)
        ? Math.max(10, Math.min(200, args.tolerance))
        : DEFAULT_TOLERANCE
    const doDespill = args.despill !== false
    const erode =
      typeof args.erode === 'number' && Number.isFinite(args.erode)
        ? Math.max(0, Math.min(4, Math.round(args.erode)))
        : DEFAULT_ERODE
    const expected =
      typeof args.expected === 'number' && Number.isFinite(args.expected) && args.expected >= 1
        ? Math.round(args.expected)
        : undefined
    const minArea =
      typeof args.min_area === 'number' && Number.isFinite(args.min_area) && args.min_area >= 1
        ? Math.round(args.min_area)
        : MIN_COMPONENT_AREA

    // --- Decode & read the full pixel buffer (same pipeline as sample_hero_color) ---
    const bytes = graph.images.get(fill.imageHash!) as Uint8Array
    const ck = await getCanvasKit()
    const skImg = ck.MakeImageFromEncoded(bytes)
    if (!skImg) return { error: 'Could not decode image bytes.' }
    const imgW = skImg.width()
    const imgH = skImg.height()
    const pixels = skImg.readPixels(0, 0, {
      alphaType: ck.AlphaType.Unpremul,
      colorSpace: ck.ColorSpace.SRGB,
      colorType: ck.ColorType.RGBA_8888,
      width: imgW,
      height: imgH
    })
    skImg.delete()
    if (!pixels || !(pixels instanceof Uint8Array)) {
      return { error: 'Could not read pixels from the image.' }
    }

    const chroma = chromaArg ? parseChromaHex(chromaArg)! : sampleCornerColor(pixels, imgW, imgH)
    const warnings: string[] = []
    const spread = cornerSpread(pixels, imgW, imgH)
    if (spread > UNIFORM_SPREAD_LIMIT) {
      warnings.push(
        `WARNING: the background is not uniform (corner color spread ${spread} > ${UNIFORM_SPREAD_LIMIT}) — the model likely added a gradient or vignette. Residue is likely; consider raising tolerance or regenerating with a flatter background.`
      )
    }

    // --- Flood-fill background removal, then split by connected components.
    // Connectivity, not grid cells: elements that drift out of their cells
    // are still cut correctly, and subject-interior chroma survives.
    const keyed = floodBackground(pixels, imgW, imgH, chroma, tolerance)
    const preserved = preservedChromaCount(pixels, keyed.alpha, chroma, tolerance)
    if (preserved > imgW * imgH * PRESERVED_CHROMA_WARN_RATIO) {
      warnings.push(
        `WARNING: ${Math.round((preserved / (imgW * imgH)) * 100)}% of kept pixels match the background color inside subjects — this is normal for green-tinted elements, but if look shows green HOLES (trapped background), regenerate on a different screen color.`
      )
    }
    if (doDespill) despill(pixels, keyed.alpha, imgW, imgH, chroma)
    const matte = erode > 0 ? erodeAlpha(keyed.alpha, imgW, imgH, erode) : keyed.alpha

    const components = labelComponents(matte, imgW, imgH, minArea)
    if (expected !== undefined && components.length !== expected) {
      warnings.push(
        `WARNING: expected ${expected} element(s) from the sheet but ${components.length} separated — elements may be touching (merge), missed by the model, or split into pieces. Inspect with look; regenerate the sheet with wider spacing if elements merged.`
      )
    }

    const elements: CutoutElement[] = []
    for (let i = 0; i < components.length; i++) {
      const bounds = components[i].bounds
      const trimmed = cropRegion(pixels, matte, imgW, bounds)
      applyAlpha(trimmed.pixels, trimmed.alpha)
      const out = encodePng(ck, trimmed.pixels, bounds.width, bounds.height)
      if (!out) {
        warnings.push(`WARNING: element ${i + 1} failed PNG encoding and was skipped.`)
        continue
      }
      const hash = computeImageHash(out)
      graph.images.set(hash, out)

      const created = createAssetNode(graph, imageNode, hash, bounds, i + 1, elements.length)
      elements.push({
        id: created.id,
        name: created.name,
        width: created.width,
        height: created.height,
        nativeWidth: bounds.width,
        nativeHeight: bounds.height,
        area: components[i].area
      })
    }

    if (elements.length === 0) {
      return {
        error: `Nothing survived keying (chroma rgb(${chroma.r},${chroma.g},${chroma.b}), tolerance ${tolerance}). Either the whole image reads as background — lower tolerance — or the background color was misdetected; pass chroma explicitly.`
      }
    }

    return {
      source: { id: imageNode.id, name: imageNode.name, imageSize: { width: imgW, height: imgH } },
      chroma: { r: chroma.r, g: chroma.g, b: chroma.b, sampled: chromaArg === undefined },
      tolerance,
      background_percent: Math.round((keyed.bgCount / (imgW * imgH)) * 100),
      elements,
      note: buildNote(elements, chroma, tolerance, expected, warnings)
    }
  }
})

type Ck = Awaited<ReturnType<typeof getCanvasKit>>

function encodePng(ck: Ck, pixels: Uint8Array, width: number, height: number): Uint8Array | null {
  const image = ck.MakeImage(
    {
      width,
      height,
      colorType: ck.ColorType.RGBA_8888,
      alphaType: ck.AlphaType.Unpremul,
      colorSpace: ck.ColorSpace.SRGB
    },
    pixels,
    width * 4
  )
  if (!image) return null
  const encoded = image.encodeToBytes(ck.ImageFormat.PNG, 100)
  image.delete()
  return encoded ?? null
}

/**
 * Place the asset in a deterministic row below the source image: fixed
 * display width, height follows the NATIVE aspect (never upscale, never
 * stretch — distillation-map §12.3 invariant 1).
 */
function createAssetNode(
  graph: SceneGraph,
  source: SceneNode,
  imageHash: string,
  nativeBounds: Rect,
  regionIndex: number,
  elementIndex: number
): SceneNode {
  const parentId = source.parentId ?? source.id
  const scale = Math.min(1, DISPLAY_WIDTH / nativeBounds.width)
  const width = Math.round(nativeBounds.width * scale)
  const height = Math.round(nativeBounds.height * scale)
  const name = `${source.name}-cutout-${regionIndex}`
  const fill: Fill = {
    type: 'IMAGE',
    color: { r: 0, g: 0, b: 0, a: 0 },
    opacity: 1,
    visible: true,
    imageHash,
    imageScaleMode: 'FIT'
  }
  return graph.createNode('RECTANGLE', parentId, {
    name,
    x: source.x + elementIndex * (DISPLAY_WIDTH + DISPLAY_GAP),
    y: source.y + source.height + DISPLAY_OFFSET_Y,
    width,
    height,
    fills: [fill]
  })
}

function buildNote(
  elements: CutoutElement[],
  chroma: { r: number; g: number; b: number },
  tolerance: number,
  expected: number | undefined,
  warnings: string[]
): string {
  const list = elements
    .map(
      (e) =>
        `${e.id} "${e.name}" (${e.nativeWidth}×${e.nativeHeight}px native, shown ${e.width}×${e.height})`
    )
    .join('; ')
  const expectedPart = expected !== undefined ? ` (expected ${expected})` : ''
  const parts = [
    `Cut ${elements.length} asset${elements.length === 1 ? '' : 's'} from the sheet${expectedPart} (chroma rgb(${chroma.r},${chroma.g},${chroma.b}), tolerance ${tolerance}): ${list}.`,
    'Place them at or below their native pixel size (never upscale) and verify with look: edges clean, no green fringe, no background residue.'
  ]
  parts.push(...warnings)
  return parts.join(' ')
}

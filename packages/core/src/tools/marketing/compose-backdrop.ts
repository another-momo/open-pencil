/**
 * compose_backdrop tool (poster-quality experiment)
 *
 * Builds the Background Layer (visual environment) of a long-image design
 * in one tool call. The Background Layer is a Frame that contains:
 *   - BaseWash: full-canvas vertical gradient (light tint → opaque white)
 *   - HeroImg: the hero placeholder Frame (fill via generate_image later)
 *   - BackdropOverlay: a 3-stop linear gradient that overlaps the hero's
 *     bottom 100px and fades into opaque white at the canvas foot
 *
 * The layer is inserted as the first child of the root frame so content
 * sections painted later naturally sit on top. z-order inside the layer is
 * by sibling order: BaseWash → HeroImg → BackdropOverlay (BackdropOverlay
 * is on top of HeroImg in the overlap region, which is what produces the
 * "kiss" effect — the alpha-0 top stop sits on the hero and fades to its
 * theme color over 100px before the canvas foot).
 *
 * The 100px overlap, `position="absolute"`, 8-digit hex alpha trick, and
 * vertical gradient transform are all handled internally. Agent callers
 * never write geometry; they call this tool with a sampled hero color.
 *
 * Expected agent sequence: render HeroImg placeholder → generate_image into
 * it → sample_hero_color → compose_backdrop (passing the sampled hex).
 */

import type { Fill } from '@open-pencil/scene-graph'

import { defineTool } from '#core/tools/schema'

const DEFAULT_HERO_HEIGHT = 500
const DEFAULT_HERO_COLOR = '#888888FF'
const OVERLAP_PX = 100

const VERTICAL_TRANSFORM = { m00: 0, m01: 1, m02: 0, m10: -1, m11: 0, m12: 1 }
const HEX_REGEX = /^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/

export const composeBackdropTool = defineTool({
  name: 'compose_backdrop',
  description:
    'Build the Background Layer (visual environment) for a long-image design in one tool call. Creates a Frame containing BaseWash (full-canvas vertical gradient), HeroImg (the hero placeholder — fill via generate_image later), and BackdropOverlay (a 3-stop linear gradient that overlaps the hero bottom by 100px and fades into opaque white). The layer is inserted as the first child of the root frame so content sections painted later sit on top. Pass hero_color as an 8-digit hex (e.g. "#5A7F5BFF"); run sample_hero_color first if you want a real hex from the hero image.',
  params: {
    root_id: {
      type: 'string',
      description: 'Node id of the root frame (the long-image canvas). The Background Layer will be inserted as its first child.',
      required: true
    },
    canvas_width: {
      type: 'number',
      description: 'Canvas width in pixels (e.g. 750 for product_long).',
      required: true,
      min: 100,
      max: 8000
    },
    canvas_height: {
      type: 'number',
      description: 'Canvas height in pixels. The total design height — the BackdropOverlay extends from hero_height − 100 to canvas_height.',
      required: true,
      min: 200,
      max: 20000
    },
    hero_height: {
      type: 'number',
      description: 'Height of the hero region in pixels. Default 500. The BackdropOverlay starts at hero_height − 100 to overlap the hero by 100px.',
      default: DEFAULT_HERO_HEIGHT,
      min: 100,
      max: 4000
    },
    hero_color: {
      type: 'string',
      description: '8-digit hex color for the BackdropOverlay middle stop (the hero theme color). For best results, call sample_hero_color first to get this from the actual hero pixels; the default is a neutral gray used only as fallback.',
      default: DEFAULT_HERO_COLOR
    }
  },
  execute: async (figma, args) => {
    const rootId = args.root_id
    if (typeof rootId !== 'string' || rootId.length === 0) {
      return { error: 'Pass a root frame id (non-empty string).' }
    }
    const canvasWidth = args.canvas_width
    const canvasHeight = args.canvas_height
    if (typeof canvasWidth !== 'number' || typeof canvasHeight !== 'number') {
      return { error: 'canvas_width and canvas_height are required numbers.' }
    }
    if (canvasWidth < 100 || canvasHeight < 200) {
      return { error: `Canvas too small (got ${canvasWidth}×${canvasHeight}, minimum 100×200).` }
    }
    const heroHeight = typeof args.hero_height === 'number' ? args.hero_height : DEFAULT_HERO_HEIGHT
    if (heroHeight < 100 || heroHeight >= canvasHeight) {
      return { error: `hero_height (${heroHeight}) must be in [100, canvas_height).` }
    }
    const heroColor =
      typeof args.hero_color === 'string' && HEX_REGEX.test(args.hero_color)
        ? args.hero_color
        : DEFAULT_HERO_COLOR

    const root = figma.graph.getNode(rootId)
    if (!root) return { error: `Root frame "${rootId}" not found.` }

    const backgroundLayer = figma.graph.createNode('FRAME', rootId, {
      name: 'BackgroundLayer',
      x: 0,
      y: 0,
      width: canvasWidth,
      height: canvasHeight,
      layoutMode: 'NONE',
      clipsContent: false,
      fills: []
    })

    const baseWash = createGradientRectangle(figma.graph, backgroundLayer.id, {
      name: 'BaseWash',
      x: 0,
      y: 0,
      width: canvasWidth,
      height: canvasHeight,
      stops: [
        { color: hexToColor(heroColor), position: 0, opacity: 0.05 },
        { color: { r: 1, g: 1, b: 1, a: 1 }, position: 1, opacity: 1 }
      ]
    })

    const heroImg = figma.graph.createNode('FRAME', backgroundLayer.id, {
      name: 'HeroImg',
      x: 0,
      y: 0,
      width: canvasWidth,
      height: heroHeight,
      layoutMode: 'NONE',
      clipsContent: true,
      fills: [
        { type: 'SOLID', color: { r: 0.886, g: 0.91, b: 0.949, a: 1 }, opacity: 1, visible: true }
      ]
    })

    const overlayY = heroHeight - OVERLAP_PX
    const overlayHeight = canvasHeight - overlayY
    const middleStopPosition = OVERLAP_PX / overlayHeight

    const backdropOverlay = createGradientRectangle(figma.graph, backgroundLayer.id, {
      name: 'BackdropOverlay',
      x: 0,
      y: overlayY,
      width: canvasWidth,
      height: overlayHeight,
      stops: [
        { color: { r: 1, g: 1, b: 1, a: 0 }, position: 0 },
        { color: hexToColor(heroColor), position: middleStopPosition },
        { color: { r: 1, g: 1, b: 1, a: 1 }, position: 1 }
      ]
    })

    if (typeof figma.graph.reorderChild === 'function') {
      figma.graph.reorderChild(backgroundLayer.id, rootId, 0)
    }

    return {
      root_id: rootId,
      background_layer_id: backgroundLayer.id,
      hero_img_id: heroImg.id,
      backdrop_overlay_id: backdropOverlay.id,
      base_wash_id: baseWash.id,
      hero_color: heroColor,
      overlap_px: OVERLAP_PX,
      overlay_position: { x: 0, y: overlayY, width: canvasWidth, height: overlayHeight },
      note: [
        `Background Layer (id ${backgroundLayer.id}) is now the first child of root "${root.name}" — everything else paints on top.`,
        `HeroImg (id ${heroImg.id}) sits at y=0..${heroHeight} within the Background Layer. Fill it with generate_image before building content sections.`,
        `BackdropOverlay (id ${backdropOverlay.id}) is at y=${overlayY}..${canvasHeight}, overlapping the hero by ${OVERLAP_PX}px for the kiss effect. Its middle stop uses ${heroColor}.`,
        `After filling HeroImg with an image, content sections (Part2/Part3/etc.) go in the root frame as auto-layout children after this layer — they will paint on top of the overlay's white bottom region.`,
        `Verify with look: the hero should fade smoothly into the overlay's middle color with no visible seam at y=${heroHeight}.`
      ].join(' ')
    }
  }
})

interface StopInput {
  color: { r: number; g: number; b: number; a: number }
  position: number
  opacity?: number
}

interface CreateSpec {
  name: string
  x: number
  y: number
  width: number
  height: number
  stops: Array<StopInput>
}

type GraphLike = {
  createNode: (
    type: 'RECTANGLE',
    parentId: string,
    overrides: Record<string, unknown>
  ) => { id: string }
}

function createGradientRectangle(
  graph: GraphLike,
  parentId: string,
  spec: CreateSpec
): { id: string } {
  const fill: Fill = {
    type: 'GRADIENT_LINEAR',
    color: spec.stops[0]?.color ?? { r: 1, g: 1, b: 1, a: 1 },
    opacity: 1,
    visible: true,
    gradientStops: spec.stops.map((s) => ({
      color: s.color,
      position: s.position
    })),
    gradientTransform: VERTICAL_TRANSFORM
  }
  const node = graph.createNode('RECTANGLE', parentId, {
    name: spec.name,
    x: spec.x,
    y: spec.y,
    width: spec.width,
    height: spec.height,
    layoutMode: 'NONE',
    fills: [fill]
  })
  return { id: node.id }
}

function hexToColor(hex: string): { r: number; g: number; b: number; a: number } {
  const clean = hex.replace('#', '')
  if (clean.length === 6) {
    return {
      r: parseInt(clean.slice(0, 2), 16) / 255,
      g: parseInt(clean.slice(2, 4), 16) / 255,
      b: parseInt(clean.slice(4, 6), 16) / 255,
      a: 1
    }
  }
  if (clean.length === 8) {
    return {
      r: parseInt(clean.slice(0, 2), 16) / 255,
      g: parseInt(clean.slice(2, 4), 16) / 255,
      b: parseInt(clean.slice(4, 6), 16) / 255,
      a: parseInt(clean.slice(6, 8), 16) / 255
    }
  }
  return { r: 0.5, g: 0.5, b: 0.5, a: 1 }
}
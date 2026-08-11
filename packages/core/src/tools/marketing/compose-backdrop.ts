/**
 * compose_backdrop tool (poster-quality experiment)
 *
 * Builds the visual environment of a long-image design in one call:
 *
 *   root (auto-layout, flex col):
 *     [0] BackgroundLayer  ABSOLUTE, fills=[] — the tool-owned visual layer:
 *           [0] BaseWash        full-canvas vertical gradient
 *                               (5% hero tint → opaque white)
 *           [1] HeroImg         hero image holder, h = heroHeight + heroBleed
 *           [2] BackdropOverlay 3-stop vertical gradient spanning
 *                               (hero bottom − 100) .. canvasHeight; fades
 *                               over the hero's bottom 100px (the "kiss")
 *                               and into opaque white at the canvas foot
 *     [1] HeroContent      flow child, transparent, h = heroHeight —
 *                          reserves the hero slot in the flow and hosts
 *                          overlay text (title/logo) ABOVE the whole
 *                          BackgroundLayer, so copy never gets washed
 *     [2+] content sections (appended later; paint on top)
 *
 * Why HeroImg is taller than HeroContent (heroBleed, default 100): the fade
 * zone then lands inside the NEXT section's content area instead of running
 * as one uninterrupted full-width horizontal edge — the single most visible
 * seam shape. Sections with transparent backgrounds let the extended image
 * show through while their content breaks up the transition line.
 *
 * The kiss invariant (BaseWash < HeroImg < BackdropOverlay) is INTERNAL to
 * the BackgroundLayer — sibling insertions elsewhere in the root can never
 * break it.
 *
 * Color pipeline (no agent color reasoning required):
 *   explicit hero_color > auto-sample of the hero's bottom OVERLAP_PX band
 *   > white fallback. The sampled band is exactly the strip the overlay
 *   covers, so sampled color and overlap geometry can never disagree.
 *
 * Typical agent sequence (hero pixels first, one compose call):
 *   1. Phase 2 skeleton renders HeroContent (flow frame, h=heroHeight)
 *   2. generate_image into HeroContent
 *   3. compose_backdrop({ root_id, canvas_width, canvas_height,
 *      hero_image_from: HeroContent.id }) — the IMAGE fill is MOVED into
 *      the layer's HeroImg (HeroContent becomes transparent), the hero's
 *      bottom band is auto-sampled, and the overlay is colored
 *   4. Verify with look. Re-call any time the hero pixels change — the
 *      tool is idempotent (nodes are found by name and updated in place).
 */

import type { Fill, SceneGraph, SceneNode } from '@open-pencil/scene-graph'
import type { Color } from '@open-pencil/scene-graph/primitives'

import { defineTool } from '#core/tools/schema'

import { sampleImageFillColor } from './sample-color'

const DEFAULT_HERO_HEIGHT = 750
const DEFAULT_HERO_BLEED = 100
const FALLBACK_COLOR = '#FFFFFFFF'
const OVERLAP_PX = 100
const BASE_WASH_TOP_OPACITY = 0.05

const VERTICAL_TRANSFORM = { m00: 0, m01: 1, m02: 0, m10: -1, m11: 0, m12: 1 }
const HEX_REGEX = /^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/

const LAYER_NAME = 'BackgroundLayer'
const BASE_WASH_NAME = 'BaseWash'
const HERO_IMG_NAME = 'HeroImg'
const HERO_CONTENT_NAME = 'HeroContent'
const OVERLAY_NAME = 'BackdropOverlay'

export const composeBackdropTool = defineTool({
  name: 'compose_backdrop',
  mutates: true,
  description:
    'Build the visual environment of a long-image design in one call. Creates/updates a BackgroundLayer (absolute, bottom of z-order) containing BaseWash (full-canvas gradient), HeroImg (hero image holder, extended hero_bleed past the hero slot so the fade seam hides inside the next section), and BackdropOverlay (3-stop gradient fading over the hero bottom into opaque white), plus a transparent HeroContent flow frame that reserves the hero slot and hosts overlay text. Typical sequence: render HeroContent in the skeleton → generate_image into it → compose_backdrop with hero_image_from = HeroContent id. The image fill is moved into HeroImg, the hero bottom band is auto-sampled for the overlay middle stop (pass hero_color only to override), and HeroContent is left transparent for text. Re-call after regenerating the hero — fully idempotent.',
  params: {
    root_id: {
      type: 'string',
      description: 'Node id of the root frame (the long-image canvas). Must be a FRAME.',
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
      description:
        'Canvas height in pixels. The total design height — the BackdropOverlay extends from the hero bottom − 100 to canvas_height.',
      required: true,
      min: 200,
      max: 20000
    },
    hero_height: {
      type: 'number',
      description:
        'Height of the hero slot in pixels (the HeroContent flow reservation). Default 750. Ignored when hero_image_from is given — the real height of the source node is used instead.',
      default: DEFAULT_HERO_HEIGHT,
      min: 100,
      max: 4000
    },
    hero_bleed: {
      type: 'number',
      description:
        "How many pixels the hero image extends PAST the hero slot (default 100, equal to the overlay fade). The fade seam then lands inside the next section's content area and gets visually broken up by it, instead of running as one full-width horizontal edge. Set 0 to make image and slot flush. NOTE: the hero image should be GENERATED at canvas_width × (hero_height + hero_bleed) — the final display size of HeroImg — so it fits without cover-cropping and the prompt's 'calm bottom 100px' maps exactly onto the fade zone.",
      default: DEFAULT_HERO_BLEED,
      min: 0,
      max: 1000
    },
    hero_color: {
      type: 'string',
      description:
        'Optional explicit 6- or 8-digit hex for the BackdropOverlay middle stop. Overrides auto-sampling — only pass this when you have a reason (e.g. a sample_hero_color result from a non-bottom band). When omitted, the hero bottom 100px is sampled automatically; when no hero image exists yet, falls back to white (a plain white transition, visually safe).'
    },
    hero_image_from: {
      type: 'string',
      description:
        "Optional. Node id whose IMAGE fill should become the hero — typically the HeroContent frame you generated into. The fill is COPIED onto the layer's HeroImg; when the source is HeroContent its fills are then cleared to transparent (other source nodes are left untouched). The hero slot height follows the source node's real height."
    }
  },
  execute: async (figma, args) => {
    const inputs = validateInputs(args)
    if ('error' in inputs) return { error: inputs.error }

    const root = figma.graph.getNode(inputs.rootId)
    if (!root) return { error: `Root frame "${inputs.rootId}" not found.` }
    if (root.type !== 'FRAME') {
      return {
        error: `Root "${inputs.rootId}" is a ${root.type}, not a FRAME. Pass the long-image canvas frame.`
      }
    }

    const source = resolveImageSource(figma.graph, inputs)
    if ('error' in source) return { error: source.error }
    const heroHeight = source.node ? source.node.height : inputs.heroHeight
    if (!Number.isFinite(heroHeight) || heroHeight < 100 || heroHeight >= inputs.canvasHeight) {
      return {
        error: `hero_height (${heroHeight}) must be a finite number in [100, canvas_height).`
      }
    }
    const heroImgHeight = heroHeight + inputs.heroBleed
    if (heroImgHeight >= inputs.canvasHeight) {
      return {
        error: `hero_height + hero_bleed (${heroImgHeight}) must be smaller than canvas_height (${inputs.canvasHeight}).`
      }
    }

    const graph = figma.graph
    const { rootId, canvasWidth, canvasHeight } = inputs

    // --- BackgroundLayer (absolute, bottom of root z-order) ---
    const layer = upsertLayer(graph, root, canvasWidth, canvasHeight)
    graph.reorderChild(layer.id, rootId, 0)

    // --- HeroImg inside the layer; adopt the source's IMAGE fill if given ---
    const heroImg = upsertHeroImg(graph, layer, canvasWidth, heroImgHeight)
    const transfer = transferImageFill(graph, heroImg, source)
    if ('error' in transfer) return { error: transfer.error }
    graph.reorderChild(heroImg.id, layer.id, 1)

    // --- HeroContent flow slot (transparent, reserves heroHeight in flow) ---
    const heroContent = upsertHeroContent(graph, root, canvasWidth, heroHeight)
    graph.reorderChild(heroContent.id, rootId, 1)
    // The image must not ALSO paint above the overlay from the flow slot.
    if (source.node && source.node.id === heroContent.id) {
      graph.updateNode(heroContent.id, { fills: [] })
    }

    // --- Color: explicit > auto-sample > white fallback ---
    const color = await resolveHeroColor(graph, heroImg, inputs.heroColor)

    const overlayY = heroImgHeight - OVERLAP_PX
    const overlayHeight = canvasHeight - overlayY
    const middleStopPosition = OVERLAP_PX / overlayHeight
    const theme = hexToColor(color.hex)

    const baseWash = upsertGradientRect(graph, layer, BASE_WASH_NAME, {
      name: BASE_WASH_NAME,
      x: 0,
      y: 0,
      width: canvasWidth,
      height: canvasHeight,
      stops: [
        { color: theme, position: 0, opacity: BASE_WASH_TOP_OPACITY },
        { color: { r: 1, g: 1, b: 1, a: 1 }, position: 1 }
      ]
    })
    graph.reorderChild(baseWash.id, layer.id, 0)

    const backdropOverlay = upsertGradientRect(graph, layer, OVERLAY_NAME, {
      name: OVERLAY_NAME,
      x: 0,
      y: overlayY,
      width: canvasWidth,
      height: overlayHeight,
      stops: [
        { color: { r: 1, g: 1, b: 1, a: 0 }, position: 0 },
        { color: theme, position: middleStopPosition },
        { color: { r: 1, g: 1, b: 1, a: 1 }, position: 1 }
      ]
    })
    graph.reorderChild(backdropOverlay.id, layer.id, 2)

    return {
      root_id: rootId,
      background_layer_id: layer.id,
      base_wash_id: baseWash.id,
      hero_img_id: heroImg.id,
      hero_content_id: heroContent.id,
      backdrop_overlay_id: backdropOverlay.id,
      hero_color: color.hex,
      color_source: color.source,
      hero_height: heroHeight,
      hero_bleed: inputs.heroBleed,
      overlap_px: OVERLAP_PX,
      overlay_position: { x: 0, y: overlayY, width: canvasWidth, height: overlayHeight },
      note: buildNote({
        rootName: root.name,
        heroHeight,
        heroImgHeight,
        overlayY,
        canvasHeight,
        transfer,
        color
      })
    }
  }
})

interface ValidatedInputs {
  rootId: string
  canvasWidth: number
  canvasHeight: number
  heroHeight: number
  heroBleed: number
  heroColor?: string
  heroImageFrom?: string
}

function validateInputs(args: Record<string, unknown>): { error: string } | ValidatedInputs {
  const rootId = args.root_id
  if (typeof rootId !== 'string' || rootId.length === 0) {
    return { error: 'Pass a root frame id (non-empty string).' }
  }
  const canvasWidth = args.canvas_width
  const canvasHeight = args.canvas_height
  if (typeof canvasWidth !== 'number' || typeof canvasHeight !== 'number') {
    return { error: 'canvas_width and canvas_height are required numbers.' }
  }
  if (!Number.isFinite(canvasWidth) || !Number.isFinite(canvasHeight)) {
    return {
      error: `canvas_width and canvas_height must be finite numbers (got ${canvasWidth}×${canvasHeight}).`
    }
  }
  if (canvasWidth < 100 || canvasHeight < 200) {
    return { error: `Canvas too small (got ${canvasWidth}×${canvasHeight}, minimum 100×200).` }
  }
  const heroHeight = typeof args.hero_height === 'number' ? args.hero_height : DEFAULT_HERO_HEIGHT
  const heroBleed = typeof args.hero_bleed === 'number' ? args.hero_bleed : DEFAULT_HERO_BLEED
  if (!Number.isFinite(heroBleed) || heroBleed < 0) {
    return { error: `hero_bleed must be a finite number ≥ 0 (got ${heroBleed}).` }
  }
  const heroColor =
    typeof args.hero_color === 'string' && HEX_REGEX.test(args.hero_color)
      ? args.hero_color
      : undefined
  const heroImageFrom =
    typeof args.hero_image_from === 'string' && args.hero_image_from.length > 0
      ? args.hero_image_from
      : undefined
  return { rootId, canvasWidth, canvasHeight, heroHeight, heroBleed, heroColor, heroImageFrom }
}

function resolveImageSource(
  graph: SceneGraph,
  inputs: ValidatedInputs
): { error: string } | { node?: SceneNode; fill?: Fill } {
  if (inputs.heroImageFrom === undefined) return { node: undefined, fill: undefined }
  const node = graph.getNode(inputs.heroImageFrom)
  if (!node) return { error: `hero_image_from node "${inputs.heroImageFrom}" not found.` }
  const fill = node.fills.find((f) => f.type === 'IMAGE')
  // A missing fill here is NOT an error on idempotent re-calls: the fill may
  // already have been transferred into HeroImg by a previous call. The
  // transfer step decides whether anything still needs copying.
  return { node, fill }
}

/**
 * Move semantics for the hero image: copy the source's IMAGE fill onto the
 * layer-owned HeroImg. If the source has no IMAGE fill but HeroImg already
 * does (idempotent re-call after a transfer), that is fine — nothing to do.
 */
function transferImageFill(
  graph: SceneGraph,
  heroImg: SceneNode,
  source: { node?: SceneNode; fill?: Fill }
): { transferred: boolean } | { error: string } {
  if (!source.node) return { transferred: false }
  if (source.fill) {
    graph.updateNode(heroImg.id, { fills: [source.fill] })
    return { transferred: true }
  }
  const existing = heroImg.fills.find((f) => f.type === 'IMAGE')
  if (existing) return { transferred: false }
  return {
    error: `hero_image_from node "${source.node.name}" has no IMAGE fill. Generate the hero image into it first (generate_image), then re-call.`
  }
}

type HeroColorResolution = {
  hex: string
  source: 'explicit' | 'sampled' | 'fallback'
  sampleError?: string
}

/**
 * explicit hero_color > auto-sample of the hero's bottom OVERLAP_PX band >
 * white fallback. The sampled band is exactly the strip the overlay covers,
 * so sampled color and overlap geometry can never disagree. Sampling
 * failures degrade to white (a plain white transition) rather than erroring —
 * structure must not fail because of pixels.
 */
async function resolveHeroColor(
  graph: SceneGraph,
  heroImg: SceneNode,
  explicitHex?: string
): Promise<HeroColorResolution> {
  if (explicitHex) return { hex: explicitHex, source: 'explicit' }
  const imageFill = heroImg.fills.find((f) => f.type === 'IMAGE')
  if (!imageFill) return { hex: FALLBACK_COLOR, source: 'fallback' }
  const sampled = await sampleImageFillColor(graph, imageFill, 'bottom', OVERLAP_PX)
  if ('error' in sampled) {
    return { hex: FALLBACK_COLOR, source: 'fallback', sampleError: sampled.error }
  }
  return { hex: sampled.hex, source: 'sampled' }
}

interface StopInput {
  color: Color
  position: number
  /** Multiplied into the stop color's alpha — a stop at opacity 0.05 is a faint tint, not full-strength color. */
  opacity?: number
}

interface GradientSpec {
  name: string
  x: number
  y: number
  width: number
  height: number
  stops: Array<StopInput>
}

function buildGradientFill(stops: Array<StopInput>): Fill {
  const gradientStops = stops.map((s) => ({
    color: s.opacity === undefined ? s.color : { ...s.color, a: s.color.a * s.opacity },
    position: s.position
  }))
  return {
    type: 'GRADIENT_LINEAR',
    color: gradientStops[0]?.color ?? { r: 1, g: 1, b: 1, a: 1 },
    opacity: 1,
    visible: true,
    gradientStops,
    gradientTransform: VERTICAL_TRANSFORM
  }
}

function findChildByName(
  parent: SceneNode,
  graph: SceneGraph,
  name: string
): SceneNode | undefined {
  for (const childId of parent.childIds) {
    const child = graph.getNode(childId)
    if (child?.name === name) return child
  }
  return undefined
}

function upsertLayer(
  graph: SceneGraph,
  root: SceneNode,
  canvasWidth: number,
  canvasHeight: number
): SceneNode {
  const geometry = {
    x: 0,
    y: 0,
    width: canvasWidth,
    height: canvasHeight,
    layoutPositioning: 'ABSOLUTE' as const
  }
  const existing = findChildByName(root, graph, LAYER_NAME)
  if (existing) {
    graph.updateNode(existing.id, geometry)
    return existing
  }
  return graph.createNode('FRAME', root.id, {
    ...geometry,
    name: LAYER_NAME,
    layoutMode: 'NONE',
    clipsContent: false,
    fills: []
  })
}

function upsertHeroImg(
  graph: SceneGraph,
  layer: SceneNode,
  canvasWidth: number,
  heroImgHeight: number
): SceneNode {
  const geometry = { x: 0, y: 0, width: canvasWidth, height: heroImgHeight }
  const existing = findChildByName(layer, graph, HERO_IMG_NAME)
  if (existing) {
    // Keep existing fills — a previously transferred/generated image must
    // survive idempotent re-calls.
    graph.updateNode(existing.id, geometry)
    return existing
  }
  return graph.createNode('FRAME', layer.id, {
    ...geometry,
    name: HERO_IMG_NAME,
    layoutMode: 'NONE',
    clipsContent: true,
    fills: [{ type: 'SOLID', color: { r: 1, g: 1, b: 1, a: 1 }, opacity: 1, visible: true }]
  })
}

function upsertHeroContent(
  graph: SceneGraph,
  root: SceneNode,
  canvasWidth: number,
  heroHeight: number
): SceneNode {
  const existing = findChildByName(root, graph, HERO_CONTENT_NAME)
  if (existing) {
    // Sync the flow reservation to the hero slot height; leave layout
    // settings and children (agent's title/logo) untouched.
    graph.updateNode(existing.id, { width: canvasWidth, height: heroHeight })
    return existing
  }
  return graph.createNode('FRAME', root.id, {
    name: HERO_CONTENT_NAME,
    x: 0,
    y: 0,
    width: canvasWidth,
    height: heroHeight,
    layoutMode: 'VERTICAL',
    clipsContent: false,
    fills: []
  })
}

/**
 * Create the named gradient rectangle as a child of `parent`, or update its
 * fills/geometry in place if it already exists. Caller re-pins z-position
 * via reorderChild afterwards.
 */
function upsertGradientRect(
  graph: SceneGraph,
  parent: SceneNode,
  name: string,
  spec: GradientSpec
): SceneNode {
  const geometry = { x: spec.x, y: spec.y, width: spec.width, height: spec.height }
  const existing = findChildByName(parent, graph, name)
  if (existing) {
    graph.updateNode(existing.id, { ...geometry, fills: [buildGradientFill(spec.stops)] })
    return existing
  }
  return graph.createNode('RECTANGLE', parent.id, {
    ...geometry,
    name: spec.name,
    fills: [buildGradientFill(spec.stops)]
  })
}

function describeColor(color: HeroColorResolution): string {
  if (color.source === 'sampled') {
    return `Overlay middle stop auto-sampled from the hero's bottom ${OVERLAP_PX}px: ${color.hex}.`
  }
  if (color.source === 'explicit') {
    return `Overlay middle stop uses your explicit hero_color ${color.hex}.`
  }
  if (color.sampleError) {
    return `Could not auto-sample the hero (${color.sampleError}) — overlay falls back to a plain white transition. Re-call after the hero image is in place to recolor.`
  }
  return 'No hero image yet — overlay is a plain white transition for now. Generate the hero into HeroContent, then re-call with hero_image_from to transfer and auto-sample.'
}

function buildNote(input: {
  rootName: string
  heroHeight: number
  heroImgHeight: number
  overlayY: number
  canvasHeight: number
  transfer: { transferred: boolean }
  color: HeroColorResolution
}): string {
  const transferPart = input.transfer.transferred
    ? "The image fill was moved into the BackgroundLayer's HeroImg; HeroContent is now transparent (title/logo there paint above everything)."
    : ''
  const bleed = input.heroImgHeight - input.heroHeight
  const bleedPart =
    bleed > 0
      ? `HeroImg extends ${bleed}px past the hero slot (to y=${input.heroImgHeight}) so the fade seam hides inside the next section's content area.`
      : ''
  return [
    `Backdrop built under root "${input.rootName}": BackgroundLayer (absolute, index 0: BaseWash < HeroImg < BackdropOverlay) + HeroContent (flow, index 1, h=${input.heroHeight}).`,
    transferPart,
    bleedPart,
    `BackdropOverlay spans y=${input.overlayY}..${input.canvasHeight}, fading over the hero's bottom ${OVERLAP_PX}px then into opaque white. ${describeColor(input.color)}`,
    `Content sections rendered later append after HeroContent and paint on top. Re-call this tool whenever the hero pixels change — it updates in place.`,
    `Verify with look: no visible seam around the hero bottom, overlay text in HeroContent stays crisp.`
  ]
    .filter(Boolean)
    .join(' ')
}

function hexToColor(hex: string): Color {
  const clean = hex.replace('#', '')
  if (clean.length === 6) {
    return {
      r: Number.parseInt(clean.slice(0, 2), 16) / 255,
      g: Number.parseInt(clean.slice(2, 4), 16) / 255,
      b: Number.parseInt(clean.slice(4, 6), 16) / 255,
      a: 1
    }
  }
  if (clean.length === 8) {
    return {
      r: Number.parseInt(clean.slice(0, 2), 16) / 255,
      g: Number.parseInt(clean.slice(2, 4), 16) / 255,
      b: Number.parseInt(clean.slice(4, 6), 16) / 255,
      a: Number.parseInt(clean.slice(6, 8), 16) / 255
    }
  }
  return { r: 1, g: 1, b: 1, a: 1 }
}

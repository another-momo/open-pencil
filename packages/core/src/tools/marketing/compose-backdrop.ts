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
 * The kiss invariant (BaseWash < HeroImg < BackdropOverlay) is INTERNAL to
 * the BackgroundLayer — root-sibling insertions can never break it.
 *
 * Why HeroImg is taller than HeroContent (heroBleed, default 100): the fade
 * zone then lands inside the NEXT section's content area instead of running
 * as one full-width horizontal edge — the most visible seam shape.
 *
 * Color pipeline (no agent color reasoning required): explicit hero_color >
 * auto-sample of the hero's bottom OVERLAP_PX band > white fallback. The
 * sampled band is exactly the strip the overlay covers when pixels map 1:1;
 * with cover-cropped user assets it is the pixel-space band — a nuance, not
 * an error.
 *
 * Typical agent sequence (hero pixels first, one compose call):
 *   1. Phase 2 skeleton renders HeroContent (flow frame, h=heroHeight)
 *   2. generate_image into HeroContent
 *   3. compose_backdrop({ ..., hero_image_from: HeroContent.id }) — the fill
 *      is COPIED into HeroImg (HeroContent's fills are cleared), the hero
 *      bottom band auto-sampled, the overlay colored
 *   4. Verify with look. Idempotent — re-call any time hero pixels change.
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
    'Build the visual environment of a long-image design in one call. Creates/updates a BackgroundLayer (absolute, bottom of z-order) containing BaseWash (full-canvas gradient), HeroImg (hero image holder, extended hero_bleed past the hero slot so the fade seam hides inside the next section), and BackdropOverlay (3-stop gradient fading over the hero bottom into opaque white), plus a transparent HeroContent flow frame that reserves the hero slot and hosts overlay text. Typical sequence: render HeroContent in the skeleton → generate_image into it → compose_backdrop with hero_image_from = HeroContent id. The image fill is copied into HeroImg (and HeroContent is cleared to transparent), the hero bottom band is auto-sampled for the overlay middle stop (pass hero_color only to override), and HeroContent is left transparent for text. If hero_image_from is omitted but HeroContent already carries an IMAGE fill, it is adopted automatically. Re-call after regenerating the hero — fully idempotent.',
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
        'Height of the hero slot in pixels (the HeroContent flow reservation). Default 750. Ignored when hero_image_from is given — the slot then follows the source: a HeroContent source keeps its height; an external source counts as the full display height and the slot is hero_bleed shorter.',
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
        "Optional. Node id whose IMAGE fill should become the hero — typically the HeroContent frame you generated into. The fill is COPIED onto the layer's HeroImg; when the source is HeroContent its fills are then cleared to transparent (other source nodes are left untouched). Geometry: HeroContent keeps its height as the slot (image bleeds hero_bleed past it); an external node's height is the full hero display height and the slot is hero_bleed shorter, so its pixels show 1:1 without upscaling."
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
    if (root.layoutMode === 'NONE') {
      return {
        error:
          'Root has no auto-layout — the backdrop topology needs a flow slot (HeroContent) plus an absolute BackgroundLayer. Give the root a vertical layout first.'
      }
    }
    // Width reconciliation: the backdrop is built from canvas_width, so a
    // slip here silently mis-sizes every layer. Warn, don't fail — the root
    // may legitimately differ if it hugs.
    const rootWidthWarning =
      Number.isFinite(root.width) && Math.abs(root.width - inputs.canvasWidth) > 1
        ? `canvas_width (${inputs.canvasWidth}) differs from the root frame's actual width (${root.width}) — the backdrop follows canvas_width.`
        : undefined

    const source = resolveImageSource(figma.graph, root, inputs)
    if ('error' in source) return { error: source.error }

    // Geometry. Invariant: HeroImg = hero slot + heroBleed. A HeroContent
    // source's height IS the slot (the image bleeds past it); an external
    // source's height IS the display height — derive the slot by subtracting
    // bleed, so adopted pixels are never upscaled. Identity check, not name:
    // a node merely NAMED HeroContent but not the root flow slot (nested
    // elsewhere, or a renamed user asset) gets external semantics.
    const existingHeroContent = findChildByName(root, figma.graph, HERO_CONTENT_NAME)
    const sourceIsSlot = source.node !== undefined && source.node.id === existingHeroContent?.id
    let heroHeight = inputs.heroHeight
    if (source.node) {
      heroHeight = sourceIsSlot ? source.node.height : source.node.height - inputs.heroBleed
    }
    if (!Number.isFinite(heroHeight) || heroHeight < 100 || heroHeight >= inputs.canvasHeight) {
      if (source.node && !sourceIsSlot) {
        return {
          error: `hero_image_from is ${source.node.height}px tall; minus hero_bleed (${inputs.heroBleed}) that leaves a ${heroHeight}px hero slot (minimum 100). Pass a smaller hero_bleed or a taller source.`
        }
      }
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
    // upsert forces fills=[] — the image must not ALSO paint above the
    // overlay from the flow slot.
    const heroContent = upsertHeroContent(graph, root, canvasWidth, heroHeight)
    graph.reorderChild(heroContent.id, rootId, 1)
    const sourceCleared = source.node?.id === heroContent.id

    // A second root-level node carrying an IMAGE fill means the hero likely
    // exists twice: inside the layer AND in the flow, where it paints above
    // the overlay and defeats the fade. Detect and warn via the note.
    const strayImageName = findStrayImageName(graph, root, layer.id, heroContent.id)

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
        // Transparent THEME (not transparent white): the fade-in is a pure
        // alpha ramp of the sampled color, so the hero's bottom band melts
        // directly into its own hue. A white start would contaminate the
        // kiss zone with a pale halo — the most visible seam shape. With
        // the white fallback this stop equals the old transparent white.
        { color: { ...theme, a: 0 }, position: 0 },
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
        sourceCleared,
        color,
        implicitAdopted: source.implicit === true,
        rootWidthWarning,
        heroColorRejected: inputs.heroColorRejected,
        strayImageName
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
  /** A hero_color the caller passed but that failed hex validation — surfaced as a note warning instead of silently dropped. */
  heroColorRejected?: string
  heroImageFrom?: string
}

function validateCanvasSize(canvasWidth: number, canvasHeight: number): string | undefined {
  if (!Number.isFinite(canvasWidth) || !Number.isFinite(canvasHeight)) {
    return `canvas_width and canvas_height must be finite numbers (got ${canvasWidth}×${canvasHeight}).`
  }
  if (canvasWidth < 100 || canvasHeight < 200) {
    return `Canvas too small (got ${canvasWidth}×${canvasHeight}, minimum 100×200).`
  }
  if (canvasWidth > 8000 || canvasHeight > 20000) {
    return `Canvas too large (got ${canvasWidth}×${canvasHeight}, maximum 8000×20000) — check for a typo.`
  }
  return undefined
}

function validateHeroBleed(heroBleed: number): string | undefined {
  if (!Number.isFinite(heroBleed) || heroBleed < 0) {
    return `hero_bleed must be a finite number ≥ 0 (got ${heroBleed}).`
  }
  if (heroBleed > 1000) {
    return `hero_bleed ${heroBleed} exceeds the 1000px maximum — check for a typo.`
  }
  return undefined
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
  const canvasError = validateCanvasSize(canvasWidth, canvasHeight)
  if (canvasError) return { error: canvasError }
  const heroHeight = typeof args.hero_height === 'number' ? args.hero_height : DEFAULT_HERO_HEIGHT
  const heroBleed = typeof args.hero_bleed === 'number' ? args.hero_bleed : DEFAULT_HERO_BLEED
  const bleedError = validateHeroBleed(heroBleed)
  if (bleedError) return { error: bleedError }
  if (typeof args.hero_height === 'number' && args.hero_height > 4000) {
    return {
      error: `hero_height ${args.hero_height} exceeds the 4000px maximum — check for a typo.`
    }
  }
  const heroColor =
    typeof args.hero_color === 'string' && HEX_REGEX.test(args.hero_color)
      ? args.hero_color
      : undefined
  const heroColorRejected =
    typeof args.hero_color === 'string' && args.hero_color.length > 0 && heroColor === undefined
      ? args.hero_color
      : undefined
  const heroImageFrom =
    typeof args.hero_image_from === 'string' && args.hero_image_from.length > 0
      ? args.hero_image_from
      : undefined
  return {
    rootId,
    canvasWidth,
    canvasHeight,
    heroHeight,
    heroBleed,
    heroColor,
    heroColorRejected,
    heroImageFrom
  }
}

function resolveImageSource(
  graph: SceneGraph,
  root: SceneNode,
  inputs: ValidatedInputs
): { error: string } | { node?: SceneNode; fill?: Fill; implicit?: boolean } {
  if (inputs.heroImageFrom === undefined) {
    // Implicit adoption: the HeroContent slot already carrying an IMAGE fill
    // (hero generated into it, then this call forgot hero_image_from) IS the
    // intended source. Without this, the upsert below would force HeroContent
    // to fills=[] and silently destroy the fresh hero pixels.
    const slot = findChildByName(root, graph, HERO_CONTENT_NAME)
    const fill = slot?.fills.find((f) => f.type === 'IMAGE')
    if (slot && fill) return { node: slot, fill, implicit: true }
    return { node: undefined, fill: undefined }
  }
  const node = graph.getNode(inputs.heroImageFrom)
  if (!node) return { error: `hero_image_from node "${inputs.heroImageFrom}" not found.` }
  const fill = node.fills.find((f) => f.type === 'IMAGE')
  // A missing fill here is NOT an error on idempotent re-calls: the fill may
  // already have been transferred into HeroImg by a previous call. The
  // transfer step decides whether anything still needs copying.
  return { node, fill }
}

/**
 * Copy the source's IMAGE fill onto the layer-owned HeroImg. A missing
 * source fill is fine on idempotent re-calls (already transferred).
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
 * white fallback. Sampling failures degrade to white rather than erroring —
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

/**
 * A root child other than the layer/HeroContent carrying an IMAGE fill means
 * the hero likely paints twice (the flow copy sits above the overlay and
 * defeats the fade). Only LEAF image bearers are flagged: a section frame
 * with an IMAGE fill AND children is a legitimate section background, not
 * a duplicate hero.
 */
function findStrayImageName(
  graph: SceneGraph,
  root: SceneNode,
  layerId: string,
  heroContentId: string
): string | undefined {
  for (const childId of root.childIds) {
    if (childId === layerId || childId === heroContentId) continue
    const child = graph.getNode(childId)
    if (child?.childIds.length === 0 && child.fills.some((f) => f.type === 'IMAGE')) {
      return child.name
    }
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
    // Sync the flow reservation to the hero slot height; leave layout and
    // children (title/logo) untouched. Force fills=[] — the slot must stay
    // transparent or it paints above the BackgroundLayer and hides it.
    graph.updateNode(existing.id, { width: canvasWidth, height: heroHeight, fills: [] })
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
  sourceCleared: boolean
  color: HeroColorResolution
  implicitAdopted?: boolean
  rootWidthWarning?: string
  heroColorRejected?: string
  strayImageName?: string
}): string {
  let transferPart = ''
  if (input.transfer.transferred) {
    const implicit = input.implicitAdopted
      ? 'hero_image_from was omitted — the HeroContent slot already carried an IMAGE fill, so it was adopted as the source automatically. '
      : ''
    transferPart = input.sourceCleared
      ? `${implicit}The image fill was copied into the BackgroundLayer's HeroImg and HeroContent's own fills were cleared — title/logo there paint above everything.`
      : `${implicit}The image fill was copied into the BackgroundLayer's HeroImg; the source node was left untouched (its IMAGE fill is still in place — remove it yourself if it should not keep painting).`
  }
  const bleed = input.heroImgHeight - input.heroHeight
  const bleedPart =
    bleed > 0
      ? `HeroImg extends ${bleed}px past the hero slot (to y=${input.heroImgHeight}) so the fade seam hides inside the next section's content area.`
      : ''
  const rejectedPart = input.heroColorRejected
    ? `WARNING: hero_color "${input.heroColorRejected}" is not valid 6- or 8-digit hex and was ignored.`
    : ''
  const widthPart = input.rootWidthWarning ? `WARNING: ${input.rootWidthWarning}` : ''
  const strayPart = input.strayImageName
    ? `WARNING: root child "${input.strayImageName}" also carries an IMAGE fill — the hero image may be painting twice (the flow copy sits above the overlay and breaks the fade). If that node was meant to be the hero, pass it as hero_image_from and use HeroContent as the slot name.`
    : ''
  return [
    `Backdrop built under root "${input.rootName}": BackgroundLayer (absolute, index 0: BaseWash < HeroImg < BackdropOverlay) + HeroContent (flow, index 1, h=${input.heroHeight}).`,
    transferPart,
    bleedPart,
    `BackdropOverlay spans y=${input.overlayY}..${input.canvasHeight}, fading over the hero's bottom ${OVERLAP_PX}px then into opaque white. ${describeColor(input.color)}`,
    `Content sections rendered later append after HeroContent and paint on top. Re-call this tool whenever the hero pixels change — it updates in place.`,
    `Verify with look: no visible seam around the hero bottom, overlay text in HeroContent stays crisp.`,
    rejectedPart,
    widthPart,
    strayPart
  ]
    .filter(Boolean)
    .join(' ')
}

function hexToColor(hex: string): Color {
  const clean = hex.replace('#', '')
  if (clean.length !== 6 && clean.length !== 8) return { r: 1, g: 1, b: 1, a: 1 }
  const channel = (i: number) => Number.parseInt(clean.slice(i, i + 2), 16) / 255
  return { r: channel(0), g: channel(2), b: channel(4), a: clean.length === 8 ? channel(6) : 1 }
}

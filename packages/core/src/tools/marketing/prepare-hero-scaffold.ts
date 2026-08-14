/**
 * prepare_hero_scaffold tool (pixel-first hero pipeline)
 *
 * Before the hero image is generated, this tool clones the hero copy
 * (title/logo already laid out inside HeroContent during the skeleton
 * phase) into a temporary scaffold frame sized EXACTLY like the final
 * hero image (slot height + hero_bleed). The scaffold is then both the
 * generation target and the composite reference for generate_image, so
 * the image model composes around the real text at real coordinates
 * instead of guessing from a cropped slot screenshot.
 *
 *   page
 *     root (auto-layout, hug height)
 *       […] HeroContent (flow slot, h = heroHeight, hosts the copy)
 *     Hero生成参考  ← page-level SIBLING of root, never a child:
 *                     a child would inflate root's hugged height.
 *       [0..] cloned HeroContent children, x/y copied verbatim
 *             (the slot occupies the scaffold's top heroHeight px,
 *             so no coordinate conversion is needed)
 *
 * Geometry: x = root.x + root.width + 100, y = root.y,
 * width = HeroContent.width, height = HeroContent.height + hero_bleed.
 *
 * Idempotent upsert by name: re-calling after the copy changed updates
 * the geometry and REPLACES the cloned children with fresh clones. A
 * previously generated IMAGE fill is kept untouched — only the ghost
 * text layer is refreshed.
 *
 * Typical agent sequence:
 *   1. Phase 2 skeleton renders HeroContent (flow frame) with the copy
 *   2. prepare_hero_scaffold({ root_id }) → scaffold id
 *   3. generate_image with replace_id = scaffold id and
 *      references = [{ id: scaffold id, composite: true }]
 *   4. compose_backdrop({ root_id, canvas_width, hero_image_from: scaffold id })
 *   5. derive_palette from a sampled hero color
 */

import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'
import type { Rect } from '@open-pencil/scene-graph/primitives'

import { defineTool } from '#core/tools/schema'

import {
  findChildByName,
  HERO_CONTENT_NAME,
  requireAutoLayoutRootFrame,
  validateHeroBleed
} from './hero-slot'

const DEFAULT_HERO_BLEED = 100
const SCAFFOLD_GAP = 100

const SCAFFOLD_NAME = 'Hero生成参考'

const WHITE_SOLID = {
  type: 'SOLID' as const,
  color: { r: 1, g: 1, b: 1, a: 1 },
  opacity: 1,
  visible: true
}

export const prepareHeroScaffoldTool = defineTool({
  name: 'prepare_hero_scaffold',
  mutates: true,
  description:
    'Pixel-first hero pipeline, step 1: clone the hero copy (children of the HeroContent flow slot) into a temporary scaffold frame sized exactly like the final hero image (slot height + hero_bleed), placed as a page-level sibling to the RIGHT of the root frame (never inside it — a hug-height root would be inflated). The scaffold is the generation target AND composite reference for generate_image, so the image model composes around the real text at real coordinates. Clone coordinates are copied verbatim — the slot occupies the scaffold\'s top heroHeight px, no conversion needed. Idempotent: re-call after the copy changed to refresh geometry and re-clone the children; an already-generated IMAGE fill on the scaffold is preserved. Next steps after this tool: generate_image with replace_id = scaffold id and references = [{"id": scaffold id, "composite": true}], then compose_backdrop({ root_id, canvas_width, hero_image_from: scaffold id }).',
  params: {
    root_id: {
      type: 'string',
      description:
        'Node id of the root frame (the long-image canvas). Must be a FRAME with auto-layout, containing a child named HeroContent.',
      required: true
    },
    hero_bleed: {
      type: 'number',
      description:
        'How many pixels the final hero image extends PAST the hero slot (default 100 — must match the hero_bleed you will pass to compose_backdrop). The scaffold is hero slot + bleed tall; the cloned copy occupies its top slot-height px.',
      default: DEFAULT_HERO_BLEED,
      min: 0,
      max: 1000
    }
  },
  execute: (figma, args) => {
    const inputs = validateInputs(args)
    if ('error' in inputs) return { error: inputs.error }

    const graph = figma.graph
    const resolvedRoot = requireAutoLayoutRootFrame(
      graph,
      inputs.rootId,
      'Root has no auto-layout — the hero slot (HeroContent) only exists in a flow layout. Give the root a vertical layout first.'
    )
    if ('error' in resolvedRoot) return { error: resolvedRoot.error }
    const root = resolvedRoot.root
    const pageId = root.parentId
    if (!pageId || !graph.getNode(pageId)) {
      return {
        error:
          'Root frame has no parent page — the scaffold must be created as a page-level sibling of the root.'
      }
    }

    const heroContent = findChildByName(root, graph, HERO_CONTENT_NAME)
    if (!heroContent) {
      return {
        error: `No child named "${HERO_CONTENT_NAME}" under root "${root.name}" — 先在骨架阶段渲染名为 HeroContent 的 hero 槽位（flow frame，内含 hero 文案），再调用本工具。`
      }
    }

    const scaffoldWidth = heroContent.width
    const scaffoldHeight = heroContent.height + inputs.heroBleed
    const geometry = {
      x: root.x + root.width + SCAFFOLD_GAP,
      y: root.y,
      width: scaffoldWidth,
      height: scaffoldHeight
    }

    const scaffold = upsertScaffold(graph, pageId, geometry)
    const cloned = recloneChildren(graph, heroContent, scaffold)

    return {
      scaffold_id: scaffold.id,
      width: scaffoldWidth,
      height: scaffoldHeight,
      hero_bleed: inputs.heroBleed,
      cloned_children: cloned,
      note: buildNote({
        rootName: root.name,
        rootId: root.id,
        scaffold,
        heroContent,
        cloned,
        heroBleed: inputs.heroBleed
      })
    }
  }
})

interface ValidatedInputs {
  rootId: string
  heroBleed: number
}

function validateInputs(args: Record<string, unknown>): { error: string } | ValidatedInputs {
  const rootId = typeof args.root_id === 'string' ? args.root_id : ''
  const heroBleed = typeof args.hero_bleed === 'number' ? args.hero_bleed : DEFAULT_HERO_BLEED
  const bleedError = validateHeroBleed(heroBleed)
  if (rootId.length === 0) return { error: 'Pass a root frame id (non-empty string).' }
  if (bleedError) return { error: bleedError }
  return { rootId, heroBleed }
}

/**
 * Create the scaffold as a page-level sibling of root, or update its
 * geometry in place. Fills: white SOLID by default, but an existing IMAGE
 * fill (hero already generated) is preserved — only geometry and children
 * refresh on re-calls.
 */
function upsertScaffold(graph: SceneGraph, pageId: string, geometry: Rect): SceneNode {
  const page = graph.getNode(pageId)
  if (!page) throw new Error('unreachable: pageId checked in execute')
  const existing = findChildByName(page, graph, SCAFFOLD_NAME)
  if (existing) {
    const hasImageFill = existing.fills.some((f) => f.type === 'IMAGE')
    graph.updateNode(existing.id, {
      ...geometry,
      ...(hasImageFill ? {} : { fills: [{ ...WHITE_SOLID, color: { ...WHITE_SOLID.color } }] })
    })
    return existing
  }
  return graph.createNode('FRAME', page.id, {
    ...geometry,
    name: SCAFFOLD_NAME,
    layoutMode: 'NONE',
    clipsContent: true,
    fills: [{ ...WHITE_SOLID, color: { ...WHITE_SOLID.color } }]
  })
}

/**
 * Replace the scaffold's children with fresh deep clones of HeroContent's
 * children. cloneTree copies x/y/width/height and all style props verbatim
 * (correct by construction — the slot occupies the scaffold's top
 * heroHeight px); layoutPositioning is forced ABSOLUTE so the scaffold's
 * layoutMode NONE never reflows them.
 */
function recloneChildren(graph: SceneGraph, heroContent: SceneNode, scaffold: SceneNode): number {
  for (const childId of scaffold.childIds.slice()) {
    graph.deleteNode(childId)
  }
  let cloned = 0
  for (const childId of heroContent.childIds) {
    const clone = graph.cloneTree(childId, scaffold.id, { layoutPositioning: 'ABSOLUTE' })
    if (clone) cloned++
  }
  return cloned
}

function buildNote(input: {
  rootName: string
  rootId: string
  scaffold: SceneNode
  heroContent: SceneNode
  cloned: number
  heroBleed: number
}): string {
  const keptImage = input.scaffold.fills.some((f) => f.type === 'IMAGE')
  const imagePart = keptImage
    ? 'The scaffold already carries an IMAGE fill — it was preserved; only the ghost text layer was refreshed.'
    : ''
  return [
    `Scaffold "${SCAFFOLD_NAME}" ready beside root "${input.rootName}": ${input.scaffold.width}×${input.scaffold.height} at (${input.scaffold.x}, ${input.scaffold.y}), ${input.cloned} child clone(s) from HeroContent (${input.heroContent.width}×${input.heroContent.height} + ${input.heroBleed} bleed), coordinates copied verbatim.`,
    imagePart,
    `Next: generate_image with replace_id = "${input.scaffold.id}" and references = [{"id": "${input.scaffold.id}", "composite": true}]. CRITICAL: the image model IGNORES the reference unless the prompt says how to use it — your prompt MUST state explicitly that the reference image shows the title text at its exact final position and size, that the composition must be built around that text (its region calm, low-detail, tone-matched), and that the text itself must NOT be painted into the image (it is a position reference only).`,
    `Then: compose_backdrop({ root_id: "${input.rootId}", canvas_width: ${input.scaffold.width}, hero_image_from: "${input.scaffold.id}" }) — the scaffold counts as an external source, so its height is the full hero display height and the slot becomes hero_bleed shorter. Pass the SAME hero_bleed (${input.heroBleed}) there.`,
    'Copy changed? Re-call this tool — it updates in place and re-clones the children.'
  ]
    .filter(Boolean)
    .join(' ')
}

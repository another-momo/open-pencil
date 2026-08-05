import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'

import { encodeBase64 } from '#core/bytes'
import type { FigmaAPI } from '#core/figma-api'
import {
  getMarketingState,
  listMarketingDesigns,
  touchMarketingState
} from '#core/tools/marketing/registry'
import {
  analyzeImageWithVisionModel,
  getVisionMode,
  isVisionChannelBReady
} from '#core/tools/marketing/vision'
import { defineTool } from '#core/tools/schema'

const MAX_LONG_EDGE = 1024
const MIN_LEGIBLE_TEXT_PX = 12
const JPEG_QUALITY = 80
const MAX_DRILL_DEPTH = 2
const MAX_DRILL_TARGETS = 5
const MAX_DRILL_NAME = 40

/**
 * Breadth-first TEXT-node drill targets for the legibility note, limited in
 * depth and count so large designs don't bloat the note.
 */
function collectDrillTargets(
  graph: SceneGraph,
  rootId: string
): { targets: string[]; total: number } {
  const targets: string[] = []
  let total = 0
  let frontier = graph.getChildren(rootId)
  for (let depth = 0; depth < MAX_DRILL_DEPTH; depth++) {
    const next: SceneNode[] = []
    for (const child of frontier) {
      if (child.type === 'TEXT') {
        total++
        if (targets.length < MAX_DRILL_TARGETS) {
          const name = child.name.trim()
          const label = name.length > MAX_DRILL_NAME ? `${name.slice(0, MAX_DRILL_NAME)}…` : name
          targets.push(label ? `${child.id} (${label})` : child.id)
        }
      } else {
        next.push(...graph.getChildren(child.id))
      }
    }
    frontier = next
  }
  return { targets, total }
}

function minFontSizeInSubtree(graph: SceneGraph, rootId: string): number | undefined {
  let min: number | undefined
  const stack: string[] = [rootId]
  while (stack.length > 0) {
    const id = stack.pop()
    if (id === undefined) break
    const node = graph.getNode(id)
    if (!node) continue
    if (node.type === 'TEXT' && (min === undefined || node.fontSize < min)) {
      min = node.fontSize
    }
    for (const childId of node.childIds) stack.push(childId)
  }
  return min
}

function resolveTargetId(
  figma: { graph: SceneGraph },
  id: string | undefined
): string | { error: string } {
  if (id) return id
  const state = getMarketingState(figma.graph)
  if (!state) {
    const designs = listMarketingDesigns(figma.graph)
    if (designs.length > 1) {
      return {
        error: `Multiple marketing designs — pass an explicit id. Candidates: ${designs.map((design) => `"${design.rootFrameId}" (${design.materialTypeId})`).join(', ')}`
      }
    }
    return {
      error: 'No id given and no marketing session root frame — pass an explicit node id'
    }
  }
  touchMarketingState(figma.graph, state.rootFrameId)
  return state.rootFrameId
}

function addTextLegibilityNote(
  graph: SceneGraph,
  targetId: string,
  scale: number,
  noteParts: string[]
): void {
  const minFontSize = minFontSizeInSubtree(graph, targetId)
  if (minFontSize === undefined) return
  const minTextPx = minFontSize * scale
  if (minTextPx >= MIN_LEGIBLE_TEXT_PX) return
  noteParts.push(
    `You can judge layout proportions, visual weight, and color distribution from this image. ⚠ Text renders at ~${Math.round(minTextPx)}px here — too small to read; do not judge text content or legibility from it.`
  )
  const { targets, total } = collectDrillTargets(graph, targetId)
  if (targets.length > 0) {
    const more =
      total > targets.length ? ` — and ${total - targets.length} more, look specific ids` : ''
    noteParts.push(
      `To inspect text, look at these text nodes individually: ${targets.join(' / ')}${more}.`
    )
  }
}

async function analyzeViaVisionChannel(
  figma: FigmaAPI,
  targetId: string,
  nodeInfo: { id: string; name: string; width: number; height: number },
  scale: number,
  noteParts: string[],
  focus: string | undefined
): Promise<
  | { error: string }
  | { analysis: string; channel: 'B'; node: typeof nodeInfo; focus?: string; note: string }
> {
  if (!isVisionChannelBReady()) {
    return {
      error:
        'Vision channel B is selected but credentials are incomplete — set vision API key, base URL, and model in AI settings, or switch the vision mode back to A'
    }
  }
  const data = await figma.exportImage?.([targetId], {
    scale,
    format: 'JPG',
    quality: JPEG_QUALITY
  })
  if (!data || data.length === 0) return { error: 'Nothing visible to inspect' }

  const analysis = await analyzeImageWithVisionModel({
    base64: encodeBase64(data),
    mimeType: 'image/jpeg',
    prompt: [
      'You are the vision subsystem of a design agent. Analyze this design screenshot factually and answer concisely.',
      ...noteParts,
      'If text is too small to read, say so explicitly instead of guessing its content.'
    ].join('\n')
  })
  return {
    analysis,
    channel: 'B' as const,
    node: nodeInfo,
    ...(focus ? { focus } : {}),
    note: `${noteParts.join(' ')} (Text analysis from the independent vision model.)`
  }
}

export const lookTool = defineTool({
  name: 'look',
  description:
    'Visually inspect a node by rendering it to an image you can actually see. Use for questions describe cannot answer: text over busy backgrounds, visual style consistency, generated-image content (e.g. garbled text in AI images), or what a user-provided image shows. Omit id to inspect the marketing design root frame. For text legibility on a large design, look at the section or text-bearing child node, not the root — the tool tells you when text is too small to read and lists child node ids to drill into. Observations are advisory — confirm structural or readonly concerns with validate, never from the image alone.',
  params: {
    id: {
      type: 'string',
      description: 'Node id to inspect. Omit to use the marketing design root frame.'
    },
    focus: {
      type: 'string',
      description:
        'What to check this time, e.g. "text readability", "consistency with locked palette", "what does this image show"'
    }
  },
  execute: async (figma, { id, focus }) => {
    if (!figma.exportImage) {
      return { error: 'Visual inspection is not available in this environment' }
    }
    const targetId = resolveTargetId(figma, id)
    if (typeof targetId !== 'string') return targetId

    const node = figma.graph.getNode(targetId)
    if (!node) return { error: `Node "${targetId}" not found` }

    const nodeInfo = { id: targetId, name: node.name, width: node.width, height: node.height }
    const longEdge = Math.max(node.width, node.height)
    const scale = longEdge > 0 ? Math.max(0.1, Math.min(1, MAX_LONG_EDGE / longEdge)) : 1

    const noteParts = [
      `Visual inspection of "${node.name}" (${node.width}×${node.height}, exported at ${Math.round(scale * 100)}%).`
    ]
    if (focus) noteParts.push(`Focus: ${focus}.`)
    if (node.width > 4 * node.height || node.height > 4 * node.width) {
      noteParts.push(
        'Aspect ratio distorted at this scale — judge colors and presence, not proportions.'
      )
    }

    addTextLegibilityNote(figma.graph, targetId, scale, noteParts)

    if (getVisionMode() === 'B') {
      return analyzeViaVisionChannel(figma, targetId, nodeInfo, scale, noteParts, focus)
    }

    const data = await figma.exportImage([targetId], {
      scale,
      format: 'JPG',
      quality: JPEG_QUALITY
    })
    if (!data || data.length === 0) return { error: 'Nothing visible to inspect' }

    return {
      base64: encodeBase64(data),
      mimeType: 'image/jpeg',
      byteLength: data.length,
      channel: 'A' as const,
      node: nodeInfo,
      ...(focus ? { focus } : {}),
      note: noteParts.join(' ')
    }
  }
})

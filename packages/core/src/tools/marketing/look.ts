import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'

import {
  getMarketingState,
  listMarketingDesigns,
  touchMarketingState
} from '#core/tools/marketing/registry'
import {
  analyzeImageWithVisionModel,
  cacheMaterialDescription,
  getCachedMaterialDescription,
  getVisionMode,
  isVisionChannelBReady
} from '#core/tools/marketing/vision'
import { defineTool } from '#core/tools/schema'
import { uint8ArrayToBase64 } from '#core/tools/vector/export'

const MAX_LONG_EDGE = 1024
const MIN_LEGIBLE_TEXT_PX = 12
const JPEG_QUALITY = 80

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

function imageHashOf(node: SceneNode): string | undefined {
  return node.fills.find((fill) => fill.imageHash)?.imageHash
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
    let targetId = id
    if (!targetId) {
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
      targetId = state.rootFrameId
    }
    const node = figma.graph.getNode(targetId)
    if (!node) return { error: `Node "${targetId}" not found` }

    const nodeInfo = { id: targetId, name: node.name, width: node.width, height: node.height }
    const longEdge = Math.max(node.width, node.height)
    const scale = longEdge > 0 ? Math.max(0.1, Math.min(1, MAX_LONG_EDGE / longEdge)) : 1

    const noteParts = [
      `Visual inspection of "${node.name}" (${node.width}×${node.height}, exported at ${Math.round(scale * 100)}%).`
    ]
    if (focus) noteParts.push(`Focus: ${focus}.`)

    const minFontSize = minFontSizeInSubtree(figma.graph, targetId)
    if (minFontSize !== undefined) {
      const minTextPx = minFontSize * scale
      if (minTextPx < MIN_LEGIBLE_TEXT_PX) {
        noteParts.push(
          `You can judge layout proportions, visual weight, and color distribution from this image. ⚠ Text renders at ~${Math.round(minTextPx)}px here — too small to read; do not judge text content or legibility from it.`
        )
        const drillTargets = figma.graph
          .getChildren(targetId)
          .filter((child) => child.childIds.length > 0 || child.type === 'TEXT')
          .map((child) => `${child.id} (${child.name})`)
        if (drillTargets.length > 0) {
          noteParts.push(
            `To inspect text, look at child nodes individually: ${drillTargets.join(' / ')}.`
          )
        }
      }
    }

    // Channel B: an independent vision model analyzes the image and returns
    // text — no base64 enters the main conversation (l2-visual-loop.md §3).
    if (getVisionMode() === 'B') {
      if (!isVisionChannelBReady()) {
        return {
          error:
            'Vision channel B is selected but credentials are incomplete — set vision API key, base URL, and model in AI settings, or switch the vision mode back to A'
        }
      }
      const imageHash = imageHashOf(node)
      if (imageHash) {
        const cached = getCachedMaterialDescription(figma.graph, imageHash)
        if (cached) {
          return {
            analysis: cached,
            cached: true,
            node: nodeInfo,
            ...(focus ? { focus } : {}),
            note: `${noteParts.join(' ')} (Cached analysis from the independent vision model — treat it as a secondary judgment.)`
          }
        }
      }
      const data = await figma.exportImage([targetId], {
        scale,
        format: 'JPG',
        quality: JPEG_QUALITY
      })
      if (!data || data.length === 0) return { error: 'Nothing visible to inspect' }

      const analysis = await analyzeImageWithVisionModel({
        base64: uint8ArrayToBase64(data),
        mimeType: 'image/jpeg',
        prompt: [
          'You are the vision subsystem of a design agent. Analyze this design screenshot factually and answer concisely.',
          ...noteParts,
          'If text is too small to read, say so explicitly instead of guessing its content.'
        ].join('\n')
      })
      if (imageHash) cacheMaterialDescription(figma.graph, imageHash, analysis)
      return {
        analysis,
        cached: false,
        node: nodeInfo,
        ...(focus ? { focus } : {}),
        note: `${noteParts.join(' ')} (Analysis from the independent vision model — treat it as a secondary judgment.)`
      }
    }

    const data = await figma.exportImage([targetId], {
      scale,
      format: 'JPG',
      quality: JPEG_QUALITY
    })
    if (!data || data.length === 0) return { error: 'Nothing visible to inspect' }

    noteParts.push(
      'Judge against the locked direction and section plan. Observations are advisory — confirm structural or readonly concerns with validate.'
    )

    return {
      base64: uint8ArrayToBase64(data),
      mimeType: 'image/jpeg',
      byteLength: data.length,
      node: nodeInfo,
      ...(focus ? { focus } : {}),
      note: noteParts.join(' ')
    }
  }
})

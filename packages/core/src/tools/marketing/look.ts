import { defineTool } from '#core/tools/schema'
import {
  getMarketingState,
  listMarketingDesigns,
  touchMarketingState
} from '#core/tools/marketing/registry'
import { uint8ArrayToBase64 } from '#core/tools/vector/export'

const MAX_LONG_EDGE = 1024

export const lookTool = defineTool({
  name: 'look',
  description:
    'Visually inspect a node by rendering it to an image you can actually see. Use for questions describe cannot answer: text over busy backgrounds, visual style consistency, generated-image content (e.g. garbled text in AI images), or what a user-provided image shows. Omit id to inspect the marketing design root frame. Observations are advisory — confirm structural or readonly concerns with validate, never from the image alone.',
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
        return { error: 'No id given and no marketing session root frame — pass an explicit node id' }
      }
      touchMarketingState(figma.graph, state.rootFrameId)
      targetId = state.rootFrameId
    }
    const node = figma.graph.getNode(targetId)
    if (!node) return { error: `Node "${targetId}" not found` }

    const longEdge = Math.max(node.width, node.height)
    const scale = longEdge > 0 ? Math.max(0.1, Math.min(1, MAX_LONG_EDGE / longEdge)) : 1
    const data = await figma.exportImage([targetId], { scale, format: 'JPG' })
    if (!data || data.length === 0) return { error: 'Nothing visible to inspect' }

    return {
      base64: uint8ArrayToBase64(data),
      mimeType: 'image/jpeg',
      byteLength: data.length,
      node: { id: targetId, name: node.name, width: node.width, height: node.height },
      ...(focus ? { focus } : {}),
      note: `Visual inspection of "${node.name}" (${node.width}×${node.height}, exported at ${Math.round(scale * 100)}%). Judge against the locked direction and section plan. Observations are advisory — confirm structural or readonly concerns with validate.`
    }
  }
})

import type { SceneNode } from '@open-pencil/scene-graph'

import { preserveInstanceChildReplacement } from '#core/tools/instance-overrides'
import { defineTool } from '#core/tools/schema'

export const nodeReplaceWith = defineTool({
  name: 'node_replace_with',
  mutates: true,
  description: 'Replace a node with JSX content.',
  params: {
    id: { type: 'string', description: 'Node ID to replace', required: true },
    jsx: { type: 'string', description: 'JSX string for the replacement', required: true }
  },
  execute: async (figma, args) => {
    const node = figma.getNodeById(args.id)
    if (!node) return { error: `Node "${args.id}" not found` }
    const parentId = node.parent?.id ?? figma.currentPageId
    const x = node.x
    const y = node.y
    const target = figma.graph.getNode(args.id)
    const replaced: Pick<SceneNode, 'type' | 'componentId'> | undefined = target
      ? { type: target.type, componentId: target.componentId }
      : undefined
    node.remove()
    const { renderJSX } = await import('#core/design-jsx/render.js')
    const results = await renderJSX(figma.graph, args.jsx, { parentId, x, y })
    const result = results[0]
    if (replaced) preserveInstanceChildReplacement(figma.graph, replaced, result.id)
    return {
      id: result.id,
      name: result.name,
      type: result.type,
      ...(result.warnings ? { warnings: result.warnings } : {}),
      children: results
        .slice(1)
        .map((child) => ({ id: child.id, name: child.name, type: child.type }))
    }
  }
})

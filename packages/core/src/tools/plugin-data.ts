/**
 * Shared pluginData upsert for tool-level canvas markers (marketing/restore,
 * image-gen/history): replaces a plugin's entries by key on a node while
 * keeping other plugins' data untouched.
 */

import type { SceneGraph } from '@open-pencil/scene-graph'

export function upsertPluginData(
  graph: SceneGraph,
  nodeId: string,
  pluginId: string,
  entries: Array<{ key: string; value: string }>
): void {
  const node = graph.getNode(nodeId)
  if (!node) return
  const kept = node.pluginData.filter(
    (entry) => !(entry.pluginId === pluginId && entries.some(({ key }) => key === entry.key))
  )
  graph.updateNode(nodeId, {
    pluginData: [...kept, ...entries.map(({ key, value }) => ({ pluginId, key, value }))]
  })
}

/**
 * Records instance overrides when tools directly edit nodes inside an
 * INSTANCE. Without this, component sync would silently revert such
 * edits (sync only skips props present in the instance's overrides map).
 */

import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'
import { INSTANCE_SYNC_PROPS, INSTANCE_SYNC_TEXT_PROPS } from '@open-pencil/scene-graph'

const SYNCED_PROPS = new Set<string>([...INSTANCE_SYNC_PROPS, ...INSTANCE_SYNC_TEXT_PROPS])

export function findEnclosingInstance(graph: SceneGraph, nodeId: string): SceneNode | undefined {
  let cursor = graph.getNode(nodeId)
  while (cursor) {
    if (cursor.type === 'INSTANCE') return cursor
    cursor = cursor.parentId ? graph.getNode(cursor.parentId) : undefined
  }
  return undefined
}

/**
 * Mark the given SceneNode props as overridden on the enclosing instance
 * root. `props` are SceneNode field names (e.g. 'fills', 'text');
 * non-synced props (x, y, visible, ...) are ignored — sync never touches
 * them anyway.
 */
export function recordInstanceOverrides(
  graph: SceneGraph,
  nodeId: string,
  props: Iterable<string>
): void {
  const instance = findEnclosingInstance(graph, nodeId)
  if (!instance) return

  const additions: Record<string, unknown> = {}
  for (const prop of props) {
    if (!SYNCED_PROPS.has(prop)) continue
    additions[nodeId === instance.id ? prop : `${nodeId}:${prop}`] = true
  }
  if (Object.keys(additions).length === 0) return

  graph.updateNode(instance.id, {
    overrides: { ...instance.overrides, ...additions }
  })
}

/**
 * Preserve the component-child mapping when a tool replaces a node inside an
 * INSTANCE with newly rendered content (render replace_id, node_replace_with).
 * Without this the replacement loses its `componentId` mapping, so the next
 * component sync clones the original component child back in alongside it and
 * the rendered content appears reverted.
 *
 * The new node keeps the old mapping, but all synced props are frozen as
 * overrides and child-sync recursion is stopped (`<id>:componentId`): a
 * rendered replacement is wholesale — its entire subtree is managed by the
 * new content, not by the component.
 */
export function preserveInstanceChildReplacement(
  graph: SceneGraph,
  replacedNode: Pick<SceneNode, 'type' | 'componentId'>,
  newNodeId: string
): void {
  if (replacedNode.type === 'INSTANCE' || !replacedNode.componentId) return
  const instance = findEnclosingInstance(graph, newNodeId)
  if (!instance) return

  graph.updateNode(newNodeId, { componentId: replacedNode.componentId })
  recordInstanceOverrides(graph, newNodeId, SYNCED_PROPS)

  const current = graph.getNode(instance.id)
  if (!current) return
  graph.updateNode(instance.id, {
    overrides: { ...current.overrides, [`${newNodeId}:componentId`]: true }
  })
}

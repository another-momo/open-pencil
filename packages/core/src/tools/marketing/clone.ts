/**
 * Cross-document subtree clone for the marketing library: copies a node
 * subtree from a source SceneGraph (the parsed Library .fig) into the
 * target document's SceneGraph (docs/plans/l2-resource-library.md §4).
 *
 * Image bytes are content-addressed, so IMAGE fills keep their hash and
 * only the bytes are carried over. Variables and nested instances are
 * rejected (Q10): variable references cannot be migrated across documents
 * and nested instances would require cross-component componentId remapping.
 * Component subtrees (COMPONENT + plain children) and plain frames need no
 * id remapping beyond what createNode does naturally.
 */

import { cloneNodeProps, type SceneGraph, type SceneNode } from '@open-pencil/scene-graph'

export interface CloneResult {
  rootId: string
}

function findUnsupported(node: SceneNode, graph: SceneGraph): string | undefined {
  if (node.type === 'INSTANCE') return `nested instance "${node.name}"`
  if (Object.keys(node.boundVariables).length > 0 || Object.keys(node.variableModes).length > 0) {
    return `variable-bound node "${node.name}"`
  }
  for (const childId of node.childIds) {
    const child = graph.getNode(childId)
    if (!child) continue
    const found = findUnsupported(child, graph)
    if (found) return found
  }
  return undefined
}

function carryImageBytes(node: SceneNode, source: SceneGraph, target: SceneGraph): void {
  for (const fill of [...node.fills, ...node.textDecorationFills]) {
    const imageHash = 'imageHash' in fill ? fill.imageHash : undefined
    if (!imageHash || target.images.has(imageHash)) continue
    const bytes = source.images.get(imageHash)
    if (bytes) target.images.set(imageHash, bytes)
  }
}

function cloneInto(
  source: SceneGraph,
  sourceId: string,
  target: SceneGraph,
  targetParentId: string
): string | undefined {
  const src = source.getNode(sourceId)
  if (!src) return undefined

  const props = cloneNodeProps(src, null)
  // Null out Figma source identifiers so the clone is treated as local
  // (same treatment as SceneGraph.cloneTree).
  if (props.source) {
    props.source = { ...props.source, id: null, orderKey: null }
  }
  // INSTANCE subtrees are rejected by findUnsupported, so componentId should
  // not point to a source-graph component here — but a clone may still carry
  // a legacy componentId from nodes that were copied from an instance at
  // some point. Drop it to avoid a dangling reference in the target graph.
  if (props.componentId) {
    delete props.componentId
  }
  carryImageBytes(src, source, target)

  const clone = target.createNode(src.type, targetParentId, props)
  for (const childId of src.childIds) {
    cloneInto(source, childId, target, clone.id)
  }
  return clone.id
}

/**
 * Clone the subtree rooted at `sourceId` from `source` into `target` under
 * `targetParentId`. Callers that clone into an auto-layout parent should
 * recompute layout afterwards.
 */
export function cloneSubtreeAcrossGraphs(
  source: SceneGraph,
  sourceId: string,
  target: SceneGraph,
  targetParentId: string
): CloneResult | { error: string } {
  const src = source.getNode(sourceId)
  if (!src) return { error: `Source node not found: ${sourceId}` }
  if (!target.getNode(targetParentId))
    return { error: `Target parent not found: ${targetParentId}` }

  const unsupported = findUnsupported(src, source)
  if (unsupported) {
    return {
      error: `Library subtree "${src.name}" contains ${unsupported} — variables and nested instances are not supported in library assets`
    }
  }

  const rootId = cloneInto(source, sourceId, target, targetParentId)
  if (!rootId) return { error: `Failed to clone subtree: ${sourceId}` }
  return { rootId }
}

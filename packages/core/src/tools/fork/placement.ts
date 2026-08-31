/**
 * Shared page-level placement strategy (T52, S3 §9「页面级放置统一」).
 *
 * Every "create" tool (brief, design root, generated image batches) places its
 * new top-level node via findPlacementPosition so content never lands on top
 * of existing content: the new node goes to the RIGHT of the union bounds of
 * the current page's top-level nodes (+ PLACEMENT_GAP), vertically aligned
 * with the bounds top. On an empty page the origin (0, 0) is used.
 *
 * Read-only w.r.t. the graph — callers place the node themselves. Batch
 * creation loops must re-call this per item so bounds stay fresh (00 #10).
 */

import type { SceneNode } from '@open-pencil/scene-graph'
import { computeAbsoluteBounds } from '@open-pencil/scene-graph/geometry'
import type { Rect, Size, Vector } from '@open-pencil/scene-graph/primitives'

import type { FigmaAPI } from '#core/figma-api'

/** Horizontal gap between existing page content and a node placed to its right */
export const PLACEMENT_GAP = 100

export type PlacementSize = Size

/** Union absolute bounds of all top-level nodes on the current page; null on an empty page */
export function getPageContentBounds(figma: FigmaAPI): Rect | null {
  const graph = figma.graph
  const page = graph.getNode(figma.currentPage.id)
  if (!page) return null
  const nodes = page.childIds
    .map((id) => graph.getNode(id))
    .filter((node): node is SceneNode => node !== undefined)
  if (nodes.length === 0) return null
  return computeAbsoluteBounds(nodes, (id) => graph.getAbsolutePosition(id))
}

/**
 * Where to place a new top-level node of `size`: right of the current page's
 * content bounds (+ PLACEMENT_GAP), y aligned with the bounds top; (0, 0) on
 * an empty page. `size` is part of the shared contract (future strategies may
 * avoid collisions using the footprint); the current strategy is size-agnostic.
 */
export function findPlacementPosition(figma: FigmaAPI, size: PlacementSize): Vector {
  void size
  const bounds = getPageContentBounds(figma)
  if (!bounds) return { x: 0, y: 0 }
  return { x: bounds.x + bounds.width + PLACEMENT_GAP, y: bounds.y }
}

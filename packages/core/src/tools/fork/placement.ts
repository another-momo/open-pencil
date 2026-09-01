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
 *
 * T66 ⑤：`*OnPage(graph, pageId, …)` 变体 = 同一策略的跨页 seam（显式 page
 * 的顶层 bounds），供备份容器等「目标页 ≠ 编辑器当前页」的放置场景使用；
 * 切换 figma.currentPage 做跨页放置是被否决的方案（全局可变状态副作用）。
 */

import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'
import { computeAbsoluteBounds } from '@open-pencil/scene-graph/geometry'
import type { Rect, Size, Vector } from '@open-pencil/scene-graph/primitives'

import type { FigmaAPI } from '#core/figma-api'

/** Horizontal gap between existing page content and a node placed to its right */
export const PLACEMENT_GAP = 100

export type PlacementSize = Size

/**
 * Union absolute bounds of all top-level nodes on page `pageId`; null on an
 * empty page. Graph-level seam (T66 ⑤): placement itself stays current-page
 * centric, but callers that deliberately target another page (e.g. the
 * image-history backup page, which is not the editor's current page) read
 * bounds through this without switching `figma.currentPage`.
 */
export function getPageContentBoundsOnPage(graph: SceneGraph, pageId: string): Rect | null {
  const page = graph.getNode(pageId)
  if (!page) return null
  const nodes = page.childIds
    .map((id) => graph.getNode(id))
    .filter((node): node is SceneNode => node !== undefined)
  if (nodes.length === 0) return null
  return computeAbsoluteBounds(nodes, (id) => graph.getAbsolutePosition(id))
}

/** Union absolute bounds of all top-level nodes on the current page; null on an empty page */
export function getPageContentBounds(figma: FigmaAPI): Rect | null {
  return getPageContentBoundsOnPage(figma.graph, figma.currentPageId)
}

/**
 * Same placement strategy as findPlacementPosition, but for an explicit page
 * (T66 ⑤ 跨页 seam): right of that page's content bounds (+ PLACEMENT_GAP),
 * y aligned with the bounds top; (0, 0) on an empty page.
 */
export function findPlacementPositionOnPage(
  graph: SceneGraph,
  pageId: string,
  size: PlacementSize
): Vector {
  void size
  const bounds = getPageContentBoundsOnPage(graph, pageId)
  if (!bounds) return { x: 0, y: 0 }
  return { x: bounds.x + bounds.width + PLACEMENT_GAP, y: bounds.y }
}

/**
 * Where to place a new top-level node of `size`: right of the current page's
 * content bounds (+ PLACEMENT_GAP), y aligned with the bounds top; (0, 0) on
 * an empty page. `size` is part of the shared contract (future strategies may
 * avoid collisions using the footprint); the current strategy is size-agnostic.
 */
export function findPlacementPosition(figma: FigmaAPI, size: PlacementSize): Vector {
  return findPlacementPositionOnPage(figma.graph, figma.currentPageId, size)
}

/**
 * Per-document marketing session state.
 *
 * Keyed by SceneGraph (one per document) and then by rootFrameId, so one
 * document can host multiple independent marketing designs (制作清单前置).
 * Workflow-scoped: not persisted into the document file — rebuilt when a
 * new marketing session starts on a reopened document.
 */

import type { SceneGraph } from '@open-pencil/scene-graph'

import type { ReadonlyNodeInfo } from '#core/tools/marketing/builder'

export interface AnchorRecord {
  templateId: string
  position: 'top' | 'bottom'
  componentId: string
  instanceId: string
}

export interface MarketingDocumentState {
  materialTypeId: string
  rootFrameId: string
  componentsPageId: string
  anchors: AnchorRecord[]
  /** Instance-child nodeId → readonly baseline (used by validate) */
  readonly: Map<string, ReadonlyNodeInfo>
  /** Monotonic sequence — higher = more recently active (not wall time) */
  lastActiveAt: number
}

const states = new WeakMap<SceneGraph, Map<string, MarketingDocumentState>>()
let activityClock = 0

function designsOf(graph: SceneGraph): Map<string, MarketingDocumentState> {
  let designs = states.get(graph)
  if (!designs) {
    designs = new Map()
    states.set(graph, designs)
  }
  return designs
}

/**
 * Resolve a design by rootFrameId, or the default when omitted: the only
 * design, or the most recently active one. When the most recently active
 * design's root frame is gone, resolution fails (returns undefined) so
 * tools surface the candidate list instead of silently falling back to an
 * older design.
 */
export function getMarketingState(
  graph: SceneGraph,
  rootFrameId?: string
): MarketingDocumentState | undefined {
  const designs = states.get(graph)
  if (!designs || designs.size === 0) return undefined
  if (rootFrameId) return designs.get(rootFrameId)
  if (designs.size === 1) return [...designs.values()][0]
  let latest: MarketingDocumentState | undefined
  for (const design of designs.values()) {
    if (!latest || design.lastActiveAt > latest.lastActiveAt) latest = design
  }
  if (!latest || !graph.getNode(latest.rootFrameId)) return undefined
  return latest
}

export function listMarketingDesigns(graph: SceneGraph): MarketingDocumentState[] {
  return [...(states.get(graph)?.values() ?? [])]
}

export function setMarketingState(
  graph: SceneGraph,
  state: Omit<MarketingDocumentState, 'lastActiveAt'>
): void {
  designsOf(graph).set(state.rootFrameId, { ...state, lastActiveAt: ++activityClock })
}

export function touchMarketingState(graph: SceneGraph, rootFrameId: string): void {
  const design = states.get(graph)?.get(rootFrameId)
  if (design) design.lastActiveAt = ++activityClock
}

export function clearMarketingState(graph: SceneGraph, rootFrameId?: string): void {
  if (!rootFrameId) {
    states.delete(graph)
    return
  }
  const designs = states.get(graph)
  if (!designs) return
  designs.delete(rootFrameId)
  if (designs.size === 0) states.delete(graph)
}

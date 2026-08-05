/**
 * Per-document marketing session state.
 *
 * Keyed by SceneGraph (one per document) and then by rootFrameId, so one
 * document can host multiple independent marketing designs (制作清单前置).
 * Workflow-scoped: not persisted into the document file — rebuilt when a
 * new marketing session starts on a reopened document.
 */

import type { SceneGraph } from '@open-pencil/scene-graph'

import { restoreStateFromCanvas, type MarketingDocumentState } from '#core/tools/marketing/restore'

const states = new WeakMap<SceneGraph, Map<string, MarketingDocumentState>>()
const restoredGraphs = new WeakSet<SceneGraph>()
let activityClock = 0

/**
 * First access per graph: rebuild state from canvas markers so reopened
 * documents recover their marketing designs without any app-level wiring
 * (covers chat, MCP, and CLI entry points).
 */
function ensureRestored(graph: SceneGraph): void {
  if (restoredGraphs.has(graph)) return
  restoredGraphs.add(graph)
  if (states.get(graph)?.size) return
  const designs = restoreStateFromCanvas(graph)
  for (const design of designs) {
    setMarketingState(graph, design)
  }
}

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
 * design, or the most recently active one. When the root frame for a
 * resolved design is gone, the entry is pruned from the registry and
 * resolution fails (returns undefined) so tools surface the candidate
 * list instead of silently serving stale state.
 */
export function getMarketingState(
  graph: SceneGraph,
  rootFrameId?: string
): MarketingDocumentState | undefined {
  ensureRestored(graph)
  const designs = states.get(graph)
  if (!designs || designs.size === 0) return undefined
  if (rootFrameId) {
    const design = designs.get(rootFrameId)
    if (!design) return undefined
    if (!graph.getNode(design.rootFrameId)) {
      designs.delete(design.rootFrameId)
      if (designs.size === 0) states.delete(graph)
      return undefined
    }
    return design
  }
  if (designs.size === 1) {
    const design = [...designs.values()][0]
    if (!graph.getNode(design.rootFrameId)) {
      designs.delete(design.rootFrameId)
      states.delete(graph)
      return undefined
    }
    return design
  }
  let latest: MarketingDocumentState | undefined
  for (const design of designs.values()) {
    if (!latest || design.lastActiveAt > latest.lastActiveAt) latest = design
  }
  if (!latest || !graph.getNode(latest.rootFrameId)) {
    // Multi-design with a stale active root: do NOT prune here.
    // The caller is expected to surface the candidate list
    // (via listMarketingDesigns) and ask the user for an explicit id,
    // so we leave the stale entry so it still shows up as a candidate.
    return undefined
  }
  return latest
}

export function listMarketingDesigns(graph: SceneGraph): MarketingDocumentState[] {
  ensureRestored(graph)
  // Read-only listing — stale entries are returned so callers can
  // detect ambiguity (multiple designs where the active root is gone)
  // and prompt the user for an explicit id. Pruning happens in the
  // unambiguous paths inside getMarketingState, or via clearMarketingState.
  return [...(states.get(graph)?.values() ?? [])]
}

export function setMarketingState(
  graph: SceneGraph,
  state: Omit<MarketingDocumentState, 'lastActiveAt'>
): void {
  designsOf(graph).set(state.rootFrameId, { ...state, lastActiveAt: ++activityClock })
}

export function clearMarketingState(graph: SceneGraph, rootFrameId?: string): void {
  if (!rootFrameId) {
    states.delete(graph)
    // Allow a later access to re-restore from canvas markers
    restoredGraphs.delete(graph)
    return
  }
  const designs = states.get(graph)
  if (!designs) return
  designs.delete(rootFrameId)
  if (designs.size === 0) states.delete(graph)
}

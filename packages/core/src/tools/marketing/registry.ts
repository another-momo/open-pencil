/**
 * Per-document marketing session state.
 *
 * Keyed by SceneGraph (one per document) and then by rootFrameId, so one
 * document can host multiple independent marketing designs (制作清单前置).
 * Workflow-scoped: not persisted into the document file — rebuilt when a
 * new marketing session starts on a reopened document.
 */

import type { SceneGraph } from '@open-pencil/scene-graph'

import {
  restoreStateFromCanvas,
  type MarketingDocumentState
} from '#core/tools/marketing/restore'

const states = new WeakMap<SceneGraph, Map<string, MarketingDocumentState>>()
const restoredGraphs = new WeakSet<SceneGraph>()
let activityClock = 0

/**
 * Per-graph user preferences (set via the config bar, not the AI): a locked
 * profile always wins over setup's auto-pick, so an explicit user choice
 * survives re-setup calls (docs/plans/l2-resource-library.md §2).
 */
export interface MarketingPrefs {
  profileId?: string
}

const prefs = new WeakMap<SceneGraph, MarketingPrefs>()

export function setMarketingPrefs(graph: SceneGraph, update: MarketingPrefs): void {
  prefs.set(graph, { ...prefs.get(graph), ...update })
}

export function getMarketingPrefs(graph: SceneGraph): MarketingPrefs {
  return prefs.get(graph) ?? {}
}

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
 * design, or the most recently active one. When the most recently active
 * design's root frame is gone, resolution fails (returns undefined) so
 * tools surface the candidate list instead of silently falling back to an
 * older design.
 */
export function getMarketingState(
  graph: SceneGraph,
  rootFrameId?: string
): MarketingDocumentState | undefined {
  ensureRestored(graph)
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
  ensureRestored(graph)
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
    // Allow a later access to re-restore from canvas markers
    restoredGraphs.delete(graph)
    return
  }
  const designs = states.get(graph)
  if (!designs) return
  designs.delete(rootFrameId)
  if (designs.size === 0) states.delete(graph)
}

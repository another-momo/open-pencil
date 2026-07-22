/**
 * Per-document marketing session state.
 *
 * Keyed by SceneGraph (one per document) so multiple documents/tabs stay
 * isolated. Workflow-scoped: not persisted into the document file —
 * rebuilt when a new marketing session starts on a reopened document.
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
}

const states = new WeakMap<SceneGraph, MarketingDocumentState>()

export function getMarketingState(graph: SceneGraph): MarketingDocumentState | undefined {
  return states.get(graph)
}

export function setMarketingState(graph: SceneGraph, state: MarketingDocumentState): void {
  states.set(graph, state)
}

export function clearMarketingState(graph: SceneGraph): void {
  states.delete(graph)
}

/**
 * validate tool implementation.
 *
 * Code-level structural checks for marketing designs — no AI judgment
 * involved. Checks anchor instances against their session records
 * (presence + placement). Expected placement derives from each anchor's
 * own recorded position (top ↔ first, bottom ↔ last), so validation is
 * self-contained and works even when the material type config is not in
 * the currently loaded library (docs/plans/l2-resource-library.md §6.1).
 * Reports violations only; fixes happen after the user confirms.
 */

import type { FigmaAPI } from '#core/figma-api'
import {
  getMarketingState,
  listMarketingDesigns,
  touchMarketingState
} from '#core/tools/marketing/registry'
import type { MarketingDocumentState } from '#core/tools/marketing/restore'

export interface ValidateViolation {
  type: 'anchor_deleted' | 'anchor_misplaced' | 'root_deleted'
  message: string
  nodeId?: string
  fix: string
}

export interface ValidateResult {
  valid: boolean
  violations?: ValidateViolation[]
  note?: string
}

function checkAnchors(
  figma: FigmaAPI,
  state: MarketingDocumentState,
  violations: ValidateViolation[]
): void {
  const graph = figma.graph
  const rootFrame = graph.getNode(state.rootFrameId)
  if (!rootFrame) {
    violations.push({
      type: 'root_deleted',
      message: `marketing root frame was deleted`,
      nodeId: state.rootFrameId,
      fix: 'Re-run setup_material_type on the same id to re-materialize the root frame, or delete the orphaned session state.'
    })
    return
  }

  const childIds = rootFrame.childIds
  for (const anchor of state.anchors) {
    if (!graph.getNode(anchor.instanceId)) {
      violations.push({
        type: 'anchor_deleted',
        message: `anchor instance "${anchor.templateId}" was deleted`,
        nodeId: anchor.instanceId,
        fix: 'Call setup_material_type with the same id — repair mode re-materializes only the missing anchor.'
      })
      continue
    }

    const expectedIndex = anchor.position === 'top' ? 0 : childIds.length - 1
    if (childIds[expectedIndex] !== anchor.instanceId) {
      violations.push({
        type: 'anchor_misplaced',
        message: `anchor "${anchor.templateId}" should be the ${anchor.position === 'top' ? 'first' : 'last'} child of the root frame`,
        nodeId: anchor.instanceId,
        fix: 'Move it back with reparent/reorder, or ask the user if the new arrangement is intentional.'
      })
    }
  }
}

export function validateMarketingDesign(figma: FigmaAPI, rootFrameId?: string): ValidateResult {
  const graph = figma.graph
  const state = getMarketingState(graph, rootFrameId)
  if (!state) {
    const designs = listMarketingDesigns(graph)
    // If an explicit id was given but resolved to nothing, it likely means
    // the root frame was deleted and the registry was pruned. Surface a
    // root_deleted violation so the user sees the specific reason.
    if (rootFrameId && !graph.getNode(rootFrameId)) {
      return {
        valid: false,
        violations: [
          {
            type: 'root_deleted',
            message: 'marketing root frame was deleted',
            nodeId: rootFrameId,
            fix: 'Re-run setup_material_type on the same id to re-materialize the root frame, or delete the orphaned session state.'
          }
        ]
      }
    }
    const message =
      !rootFrameId && designs.length > 1
        ? `Multiple marketing designs — pass an explicit id. Candidates: ${designs.map((design) => `"${design.rootFrameId}" (${design.materialTypeId})`).join(', ')}`
        : 'No marketing design state found. Call setup_material_type first to set up a marketing design.'
    return { valid: false, note: message }
  }
  touchMarketingState(graph, state.rootFrameId)

  const violations: ValidateViolation[] = []
  checkAnchors(figma, state, violations)

  if (violations.length > 0) return { valid: false, violations }
  return { valid: true, note: 'All anchor instances present and correctly placed.' }
}

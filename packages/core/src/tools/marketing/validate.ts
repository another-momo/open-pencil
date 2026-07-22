/**
 * validate tool implementation.
 *
 * Code-level constraint checks for marketing designs — no AI judgment
 * involved. Reports violations only; fixes happen after the user
 * confirms (restore via batch_update, or accept and re-baseline).
 */

import type { SceneNode } from '@open-pencil/scene-graph'

import type { FigmaAPI } from '#core/figma-api'
import { getMaterialType } from '#core/tools/marketing/material-types'
import { getMarketingState } from '#core/tools/marketing/registry'

export interface ValidateViolation {
  type:
    | 'readonly_modified'
    | 'readonly_deleted'
    | 'anchor_deleted'
    | 'anchor_misplaced'
    | 'section_count'
  message: string
  nodeId?: string
  prop?: string
  /** Baseline value from the session registry — restore target for readonly_modified */
  originalValue?: unknown
  fix: string
}

export interface ValidateResult {
  valid: boolean
  violations?: ValidateViolation[]
  accepted?: number
  note?: string
}

function sameValue(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}

function checkReadonly(figma: FigmaAPI, violations: ValidateViolation[]): number {
  const graph = figma.graph
  const state = getMarketingState(graph)
  if (!state) return 0

  let modified = 0
  for (const [nodeId, info] of state.readonly) {
    const node = graph.getNode(nodeId)
    if (!node) {
      violations.push({
        type: 'readonly_deleted',
        message: `readonly node ${nodeId} was deleted`,
        nodeId,
        fix: 'Call setup_material_type with the same id — repair mode re-materializes the anchor containing it.'
      })
      continue
    }
    for (const prop of info.props) {
      const current = node[prop as keyof SceneNode]
      if (!sameValue(current, info.originalValues[prop])) {
        modified++
        violations.push({
          type: 'readonly_modified',
          message: `readonly node "${node.name}" (${nodeId}) was modified: ${prop}`,
          nodeId,
          prop,
          originalValue: structuredClone(info.originalValues[prop]),
          fix: `Ask the user: restore via batch_update (id: "${nodeId}", ${prop}: originalValue), or accept the change.`
        })
      }
    }
  }
  return modified
}

function checkStructure(figma: FigmaAPI, violations: ValidateViolation[]): void {
  const graph = figma.graph
  const state = getMarketingState(graph)
  if (!state) return

  const config = getMaterialType(state.materialTypeId)
  const rootFrame = graph.getNode(state.rootFrameId)
  if (!config || !rootFrame) return

  const childIds = rootFrame.childIds
  let anchorsPresent = 0

  for (const constraint of config.structure.anchors) {
    const record = state.anchors.find((anchor) => anchor.templateId === constraint.template)
    if (!record) continue

    if (!graph.getNode(record.instanceId)) {
      violations.push({
        type: 'anchor_deleted',
        message: `anchor instance "${constraint.template}" was deleted`,
        nodeId: record.instanceId,
        fix: 'Call setup_material_type with the same id — repair mode re-materializes only the missing anchor.'
      })
      continue
    }
    anchorsPresent++

    const expectedIndex = constraint.position === 'first' ? 0 : childIds.length - 1
    if (childIds[expectedIndex] !== record.instanceId) {
      violations.push({
        type: 'anchor_misplaced',
        message: `anchor "${constraint.template}" should be the ${constraint.position} child of the root frame`,
        nodeId: record.instanceId,
        fix: `Move it back with reparent/reorder, or ask the user if the new arrangement is intentional.`
      })
    }
  }

  const sectionCount = childIds.length - anchorsPresent
  if (sectionCount > config.structure.maxSections) {
    violations.push({
      type: 'section_count',
      message: `root frame has ${sectionCount} sections, max allowed is ${config.structure.maxSections}`,
      fix: 'Ask the user whether to merge or remove sections.'
    })
  }
}

export function validateMarketingDesign(figma: FigmaAPI, accept: boolean): ValidateResult {
  const graph = figma.graph
  const state = getMarketingState(graph)
  if (!state) {
    return {
      valid: false,
      violations: [
        {
          type: 'readonly_deleted',
          message: 'No marketing design state found',
          fix: 'Call setup_material_type first to set up a marketing design.'
        }
      ]
    }
  }

  const violations: ValidateViolation[] = []
  checkReadonly(figma, violations)
  checkStructure(figma, violations)

  if (accept) {
    let accepted = 0
    for (const violation of violations) {
      if (violation.type !== 'readonly_modified' || !violation.nodeId || !violation.prop) continue
      const node = graph.getNode(violation.nodeId)
      const info = state.readonly.get(violation.nodeId)
      if (!node || !info) continue
      info.originalValues[violation.prop] = structuredClone(node[violation.prop as keyof SceneNode])
      accepted++
    }
    return {
      valid: true,
      accepted,
      note: `Baselines updated for ${accepted} change(s). Future validation compares against the new values.`
    }
  }

  if (violations.length > 0) return { valid: false, violations }
  return { valid: true, note: 'All readonly nodes and structure constraints intact.' }
}

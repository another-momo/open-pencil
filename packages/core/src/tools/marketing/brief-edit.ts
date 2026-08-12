/**
 * Brief form-panel editing primitives: read/update the existing brief node
 * tree. The canvas node tree stays the single source of truth — the panel
 * rebuilds its view via readBrief on every open and re-reads before every
 * apply. Children are located BY NAME (same convention as
 * appendToBriefAIZone); structurally broken briefs (user renamed zones) read
 * as null instead of attempting repair.
 */

import type { SceneGraph } from '@open-pencil/scene-graph'

import type { FigmaAPI } from '#core/figma-api'

import {
  BRIEF_CONCLUSIONS_NAME,
  BRIEF_ENTRY_NAME,
  BRIEF_ZONE_AI_NAME,
  BRIEF_ZONE_MATERIALS_NAME,
  BRIEF_ZONE_USER_NAME,
  briefBoundDesignIds,
  findBrief,
  isBrief
} from './brief'

export interface BriefMaterialView {
  entryId: string
  caption: string
  imageHash: string | null
  /** Node id of the entry's 图片位 image slot — pass to look to view the image */
  imageNodeId: string | null
}

/** One-shot view model for the brief panel */
export interface BriefView {
  briefId: string
  /** Root frame ids this brief is bound to (empty = unbound) */
  boundDesigns: string[]
  /** ContentExample text */
  content: string
  materials: BriefMaterialView[]
  /** One string per line in the AI conclusions list (per-design groups flattened: title line + lines) */
  conclusions: string[]
}

function findChildId(graph: SceneGraph, parentId: string, name: string): string | undefined {
  return graph.getNode(parentId)?.childIds.find((id) => graph.getNode(id)?.name === name)
}

function findContentTextId(graph: SceneGraph, briefId: string): string | undefined {
  const mainId = findChildId(graph, briefId, '需求内容')
  const contentCardId = mainId ? findChildId(graph, mainId, BRIEF_ZONE_USER_NAME) : undefined
  const contentInputId = contentCardId
    ? findChildId(graph, contentCardId, 'ContentInput')
    : undefined
  return contentInputId ? findChildId(graph, contentInputId, 'ContentExample') : undefined
}

function findMaterialGridId(graph: SceneGraph, briefId: string): string | undefined {
  const mainId = findChildId(graph, briefId, '需求内容')
  const materialCardId = mainId ? findChildId(graph, mainId, BRIEF_ZONE_MATERIALS_NAME) : undefined
  return materialCardId ? findChildId(graph, materialCardId, 'MaterialGrid') : undefined
}

function readMaterials(graph: SceneGraph, gridId: string): BriefMaterialView[] {
  const materials: BriefMaterialView[] = []
  for (const entryId of graph.getNode(gridId)?.childIds ?? []) {
    const entry = graph.getNode(entryId)
    if (entry?.name !== BRIEF_ENTRY_NAME) continue
    const imageId = findChildId(graph, entryId, '图片位')
    const imageFill = imageId ? graph.getNode(imageId)?.fills[0] : undefined
    const captionId = findChildId(graph, entryId, 'Caption')
    materials.push({
      entryId,
      caption: captionId ? (graph.getNode(captionId)?.text ?? '') : '',
      imageHash: imageFill?.type === 'IMAGE' ? (imageFill.imageHash ?? null) : null,
      imageNodeId: imageId ?? null
    })
  }
  return materials
}

function readConclusions(graph: SceneGraph, conclusionsId: string): string[] {
  const conclusions: string[] = []
  for (const id of graph.getNode(conclusionsId)?.childIds ?? []) {
    const node = graph.getNode(id)
    if (node?.type === 'TEXT') {
      conclusions.push(node.text)
      continue
    }
    // Per-design groups (结论组): group title line + its conclusion lines
    if (node?.type === 'FRAME') {
      for (const childId of node.childIds) {
        const child = graph.getNode(childId)
        if (child?.type === 'TEXT') conclusions.push(child.text)
      }
    }
  }
  return conclusions
}

/**
 * Read the current brief into a panel view model. Returns null when no brief
 * exists on the page OR when the brief's expected structure is broken
 * (renamed/deleted zones) — callers distinguish the two via findBrief.
 * With rootFrameId, the brief BOUND to that design is read (see findBrief).
 */
export function readBrief(figma: FigmaAPI, rootFrameId?: string): BriefView | null {
  const graph = figma.graph
  const brief = findBrief(figma, rootFrameId)
  if (!brief) return null

  const contentTextId = findContentTextId(graph, brief.id)
  const gridId = findMaterialGridId(graph, brief.id)
  const aiCardId = findChildId(graph, brief.id, BRIEF_ZONE_AI_NAME)
  const aiTopId = aiCardId ? findChildId(graph, aiCardId, 'Top') : undefined
  const conclusionsId = aiTopId ? findChildId(graph, aiTopId, BRIEF_CONCLUSIONS_NAME) : undefined
  if (!contentTextId || !gridId || !conclusionsId) return null

  return {
    briefId: brief.id,
    boundDesigns: briefBoundDesignIds(brief),
    content: graph.getNode(contentTextId)?.text ?? '',
    materials: readMaterials(graph, gridId),
    conclusions: readConclusions(graph, conclusionsId)
  }
}

/** Overwrite the brief's content-zone text. */
export function updateBriefContent(figma: FigmaAPI, briefId: string, text: string): boolean {
  const graph = figma.graph
  if (!isBrief(graph.getNode(briefId))) return false
  const contentTextId = findContentTextId(graph, briefId)
  if (!contentTextId) return false
  graph.updateNode(contentTextId, { text })
  return true
}

/** Overwrite one material entry's caption text. */
export function updateMaterialCaption(figma: FigmaAPI, entryId: string, caption: string): boolean {
  const graph = figma.graph
  const entry = graph.getNode(entryId)
  if (!entry || entry.name !== BRIEF_ENTRY_NAME) return false
  const captionId = findChildId(graph, entryId, 'Caption')
  if (!captionId) return false
  graph.updateNode(captionId, { text: caption })
  return true
}

/** Delete one material entry from the brief. */
export function removeBriefMaterial(figma: FigmaAPI, entryId: string): boolean {
  const graph = figma.graph
  const entry = graph.getNode(entryId)
  if (!entry || entry.name !== BRIEF_ENTRY_NAME) return false
  graph.deleteNode(entryId)
  return true
}

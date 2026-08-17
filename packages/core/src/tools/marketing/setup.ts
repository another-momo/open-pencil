/**
 * setup_material_type tool implementation.
 *
 * Reads the requested material type from the registered brand config
 * snapshot (fed via `setActiveMaterialTypes`) and creates a root frame at
 * the resolved size, binding the active brief when present.
 */

import type { SceneNode } from '@open-pencil/scene-graph'

import type { FigmaAPI } from '#core/figma-api'
import {
  bindBriefToDesign,
  briefBoundDesignIds,
  listBriefs,
  setBriefBindingLabel
} from '#core/tools/marketing/brief'
import {
  clearMarketingState,
  listMarketingDesigns,
  setMarketingState
} from '#core/tools/marketing/registry'
import { markMarketingRoot, marketingRootType, type MarketingDocumentState } from '#core/tools/marketing/restore'

export interface SetupResult {
  materialType: string
  label: string
  rootFrameId: string
  /** Display name of the root frame — differentiated ("产品长图 2") when same-type designs coexist */
  rootFrameName: string
  /** Page the root frame lives on */
  page: string
  /** true = an existing design was adopted (continue/repair); false = a fresh blank frame was created */
  adopted: boolean
  /** Top-level child count at adoption time — non-zero means the frame holds a previous design, not a blank canvas */
  existingChildren?: number
  /** Root frame size — height is null for HUG (long-image types grow with content) */
  size: { width: number; height: number | null }
  note: string
}

/**
 * "continue" (default): adopt the same-type design on the current page when
 * one exists (session resume). "new": always create a fresh root frame, even
 * when a same-type design already sits on the current page.
 */
export type SetupMode = 'continue' | 'new'

/** Walk parents up to the CANVAS node that owns `nodeId` (pages are CANVAS nodes). */
function pageOfNode(graph: FigmaAPI['graph'], nodeId: string): SceneNode | undefined {
  let current = graph.getNode(nodeId)
  while (current) {
    if (current.type === 'CANVAS') return current
    current = current.parentId ? graph.getNode(current.parentId) : undefined
  }
  return undefined
}

interface MaterialConfig {
  id: string
  label: string
  size: { width: number; height: number | null }
}

/** Resolve the material config from the active brand config snapshot. */
function resolveMaterialConfig(
  type: { id: string; label: string; size: { width: number; height: number | null } } | undefined,
  graph: FigmaAPI['graph'],
  id: string,
  size?: { width: number; height: number }
): MaterialConfig | { error: string } {
  if (id === 'custom') {
    if (!size || size.width <= 0 || size.height <= 0) {
      return { error: 'Custom material type requires positive width and height.' }
    }
    return {
      id: 'custom',
      label: `自定义 ${size.width}×${size.height}`,
      size: { width: size.width, height: size.height }
    }
  }

  if (type && type.id === id) {
    return { id: type.id, label: type.label, size: type.size }
  }

  const designOfType = listMarketingDesigns(graph).find((design) => design.materialTypeId === id)
  const resubmitHint = designOfType
    ? ` This document has a design of type "${id}" — verify the brand config still defines this type.`
    : ''
  return {
    error: `Unknown material type: "${id}". Use custom (width+height) if no preset covers this size.${resubmitHint}`
  }
}

/**
 * Find the same-type root frame ON THE GIVEN PAGE. Marker first
 * (rename-proof), but only adopt a root frame marked for THIS type — frames
 * of other types are sibling designs, not candidates. Page-scoped on
 * purpose: a same-type design on ANOTHER page is a separate work.
 */
function findRootFrame(
  graph: FigmaAPI['graph'],
  config: MaterialConfig,
  pageId: string
): SceneNode | undefined {
  const page = graph.getNode(pageId)
  if (!page) return undefined
  for (const childId of page.childIds) {
    const child = graph.getNode(childId)
    if (marketingRootType(child) === config.id) return child
  }
  return undefined
}

/** All same-type marketing root frames in the document (any page), marker-based. */
function listSameTypeRoots(graph: FigmaAPI['graph'], typeId: string): SceneNode[] {
  const roots: SceneNode[] = []
  const walk = (nodeId: string) => {
    const node = graph.getNode(nodeId)
    if (!node) return
    if (marketingRootType(node) === typeId) roots.push(node)
    for (const childId of node.childIds) walk(childId)
  }
  for (const page of graph.getPages()) {
    for (const childId of page.childIds) walk(childId)
  }
  return roots
}

/**
 * Display name for a NEW root frame: the bare label when it is the first of
 * its type, otherwise the smallest free "label N" (N ≥ 2). Names are display
 * only (the marker is the machine identity).
 */
function nextRootFrameName(graph: FigmaAPI['graph'], config: MaterialConfig): string {
  const taken = new Set(listSameTypeRoots(graph, config.id).map((root) => root.name))
  if (!taken.has(config.label)) return config.label
  for (let n = 2; ; n++) {
    const candidate = `${config.label} ${n}`
    if (!taken.has(candidate)) return candidate
  }
}

function createRootFrame(figma: FigmaAPI, config: MaterialConfig, name: string): string {
  const graph = figma.graph
  const pageId = figma.currentPage.id

  let x = 0
  const page = graph.getNode(pageId)
  if (page) {
    for (const childId of page.childIds) {
      const child = graph.getNode(childId)
      if (child) x = Math.max(x, child.x + child.width + 100)
    }
  }

  const frame = graph.createNode('FRAME', pageId, {
    name,
    x,
    y: 0,
    width: config.size.width,
    height: config.size.height ?? 400,
    layoutMode: 'VERTICAL',
    counterAxisSizing: 'FIXED',
    primaryAxisSizing: config.size.height === null ? 'HUG' : 'FIXED',
    clipsContent: true,
    fills: [{ type: 'SOLID', color: { r: 1, g: 1, b: 1, a: 1 }, opacity: 1, visible: true }]
  })
  markMarketingRoot(graph, frame.id, config.id)
  return frame.id
}

/**
 * Repair/continue targets the same-type design ON THE CURRENT PAGE; a
 * same-type design on another page is a separate work and is never adopted.
 * mode "new" skips adoption entirely so a fresh root frame is created.
 */
function resolveExistingDesign(
  graph: FigmaAPI['graph'],
  designs: MarketingDocumentState[],
  config: MaterialConfig,
  id: string,
  pageId: string,
  mode: SetupMode
): { existing: MarketingDocumentState | undefined; rootFrameId: string | undefined } {
  if (mode === 'new') return { existing: undefined, rootFrameId: undefined }
  for (const design of designs) {
    if (design.materialTypeId === id && !graph.getNode(design.rootFrameId)) {
      clearMarketingState(graph, design.rootFrameId)
    }
  }
  const sameType = designs.find(
    (design) =>
      design.materialTypeId === id &&
      graph.getNode(design.rootFrameId) &&
      pageOfNode(graph, design.rootFrameId)?.id === pageId
  )
  if (sameType) return { existing: sameType, rootFrameId: sameType.rootFrameId }
  const found = findRootFrame(graph, config, pageId)
  const existing = found ? designs.find((design) => design.rootFrameId === found.id) : undefined
  return { existing, rootFrameId: found?.id }
}

/** Pages (other than the current root's) hosting same-type designs — for the cross-page hint in the note. */
function siblingPagesOf(graph: FigmaAPI['graph'], typeId: string, rootFrameId: string): string[] {
  return [
    ...new Set(
      listSameTypeRoots(graph, typeId)
        .filter((root) => root.id !== rootFrameId)
        .map((root) => pageOfNode(graph, root.id)?.name)
        .filter((name): name is string => !!name)
    )
  ]
}

/**
 * Bind the current page's brief to this design so brief tools route to it:
 * prefer the brief already bound here; otherwise take the first brief that
 * is unbound or bound only to deleted designs — never steal a brief that
 * serves another live design. Returns the bound brief id, if any.
 */
function bindPageBrief(
  figma: FigmaAPI,
  rootFrameId: string,
  rootFrameName: string,
  pageName: string
): string | undefined {
  const bindableBrief = listBriefs(figma).find((brief) => {
    const bound = briefBoundDesignIds(brief)
    if (bound.includes(rootFrameId)) return true
    return bound.every((boundId) => !figma.graph.getNode(boundId))
  })
  if (!bindableBrief) return undefined
  bindBriefToDesign(figma, bindableBrief.id, rootFrameId)
  setBriefBindingLabel(figma, bindableBrief.id, `关联：${rootFrameName} · ${pageName}`)
  return bindableBrief.id
}

/** The "where did this root frame come from" sentence of the setup note. */
function buildOriginPart(input: {
  adopted: boolean
  rootFrameName: string
  rootFrameId: string
  pageName: string
  childCount: number
  siblingPages: string[]
  label: string
}): string {
  if (input.adopted) {
    return `ADOPTED the existing "${input.rootFrameName}" design (${input.rootFrameId}) on page "${input.pageName}" — it already has ${input.childCount} top-level children, i.e. a previously built design, NOT a blank frame. Its content belongs to an earlier session unless the user just asked to continue it. If the user wants a NEW design, call setup_material_type again with mode: "new".`
  }
  const siblingHint =
    input.siblingPages.length > 0
      ? ` A separate "${input.label}" design exists on page ${input.siblingPages
          .map((name) => `"${name}"`)
          .join(', ')} — to continue THAT one, switch to its page first and call setup_material_type again (adoption never crosses pages).`
      : ''
  return `Created NEW blank root frame "${input.rootFrameName}" (${input.rootFrameId}) on page "${input.pageName}".${siblingHint}`
}

/** Display facts about the resolved root frame, for result + note assembly. */
function describeRoot(
  graph: FigmaAPI['graph'],
  figma: FigmaAPI,
  rootFrameId: string,
  config: MaterialConfig
): { rootFrameName: string; pageName: string; childCount: number } {
  const rootNode = graph.getNode(rootFrameId)
  return {
    rootFrameName: rootNode?.name ?? config.label,
    pageName: pageOfNode(graph, rootFrameId)?.name ?? figma.currentPage.name,
    childCount: rootNode?.childIds.length ?? 0
  }
}

export function setupMaterialType(
  figma: FigmaAPI,
  id: string,
  size?: { width: number; height: number },
  mode: SetupMode = 'continue'
): SetupResult | { error: string } {
  const graph = figma.graph
  const brandType = getActiveMaterialType(id)

  const config = resolveMaterialConfig(brandType, graph, id, size)
  if ('error' in config) return config

  const pageId = figma.currentPage.id
  const designs = listMarketingDesigns(graph)
  const { existing, rootFrameId: adoptedId } = resolveExistingDesign(
    graph,
    designs,
    config,
    id,
    pageId,
    mode
  )
  const isRepair = existing?.materialTypeId === id

  // Type switch on an adopted root frame: clear the registry entry for
  // that design — sibling designs stay intact.
  if (existing && !isRepair) {
    clearMarketingState(graph, existing.rootFrameId)
  }

  const adoptable = !!(adoptedId && graph.getNode(adoptedId))
  const rootFrameId = adoptable
    ? adoptedId
    : createRootFrame(figma, config, nextRootFrameName(graph, config))

  setMarketingState(graph, {
    materialTypeId: id,
    rootFrameId
  })

  const { rootFrameName, pageName, childCount } = describeRoot(graph, figma, rootFrameId, config)
  bindPageBrief(figma, rootFrameId, rootFrameName, pageName)
  const originPart = buildOriginPart({
    adopted: adoptable,
    rootFrameName,
    rootFrameId,
    pageName,
    childCount,
    siblingPages: siblingPagesOf(graph, id, rootFrameId),
    label: config.label
  })
  return {
    materialType: id,
    label: config.label,
    rootFrameId,
    rootFrameName,
    page: pageName,
    adopted: adoptable,
    ...(adoptable ? { existingChildren: childCount } : {}),
    size: config.size,
    note: `Root frame is ready. ${originPart} CRITICAL: render every section INTO the root frame with render({ parent_id: "${rootFrameId}", jsx: ... }) — sections rendered without parent_id land on the page as orphaned siblings and w="fill" collapses. Never pass id as a JSX prop.`
  }
}

/**
 * Registry of material types from the active brand config, keyed by type id.
 * The frontend pushes the full list whenever the brand config (re)loads
 * (`setBrandConfig` in the marketing library service, plus a per-turn sync
 * from the chat transport) — tool execution happens in the same process for
 * both chat paths (in-browser ToolLoopAgent and the automation bridge), so
 * one push covers both. An empty registry means "unknown type" — the tool
 * then only accepts custom sizes.
 */
export interface ActiveMaterialType {
  id: string
  label: string
  size: { width: number; height: number | null }
}

let activeMaterialTypes = new Map<string, ActiveMaterialType>()

export function setActiveMaterialTypes(types: ActiveMaterialType[] | undefined): void {
  activeMaterialTypes = new Map((types ?? []).map((type) => [type.id, type]))
}

/** Single-type convenience wrapper — the shape existing tests push. */
export function setActiveMaterialType(type: ActiveMaterialType | undefined): void {
  setActiveMaterialTypes(type ? [type] : undefined)
}

function getActiveMaterialType(id: string): ActiveMaterialType | undefined {
  return activeMaterialTypes.get(id)
}

/**
 * Parse the wire-format size string (`"1080x1080"` / `"750x"` for HUG
 * height) into numbers. Returns undefined for malformed input so callers can
 * skip the offending type instead of failing the whole registration.
 */
export function parseMaterialTypeSize(
  size: string
): { width: number; height: number | null } | undefined {
  const match = size.match(/^(\d+)x(\d+)?$/)
  if (!match) return undefined
  const width = Number(match[1])
  const height = match[2] === undefined ? null : Number(match[2])
  if (!Number.isFinite(width) || width <= 0) return undefined
  if (height !== null && (!Number.isFinite(height) || height <= 0)) return undefined
  return { width, height }
}
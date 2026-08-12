/**
 * setup_material_type tool implementation (library-driven).
 *
 * Material type configs come from the loaded Library .fig (Types page) via
 * the session LibraryIndex — no code-side seed (Q5). `custom` remains the
 * always-available escape hatch. Anchor components are cloned from the
 * library's Components page (cloneSubtreeAcrossGraphs), not built from code
 * templates.
 *
 * One tool, three modes:
 * - first call: create root frame, materialize all anchors, write registry
 * - switch: different material type id — clear old anchors, rebuild
 * - repair: same id but anchor instances missing — re-materialize only
 *   the missing ones
 */

import type { SceneNode } from '@open-pencil/scene-graph'

import type { FigmaAPI } from '#core/figma-api'
import {
  bindBriefToDesign,
  briefBoundDesignIds,
  listBriefs,
  setBriefBindingLabel
} from '#core/tools/marketing/brief'
import { cloneSubtreeAcrossGraphs } from '#core/tools/marketing/clone'
import { getLibrarySession, type LibrarySession } from '#core/tools/marketing/library'
import {
  clearMarketingState,
  listMarketingDesigns,
  setMarketingState
} from '#core/tools/marketing/registry'
import {
  markMarketingAnchor,
  markMarketingRoot,
  marketingRootLibrary,
  marketingRootType,
  type AnchorRecord,
  type MarketingDocumentState
} from '#core/tools/marketing/restore'

const COMPONENTS_PAGE_NAME = 'Components'

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
  anchors: { template: string; position: string; instanceId: string }[]
  /** Library scan warnings (malformed entries, duplicates, unresolved anchors) */
  warnings?: string[]
  repaired?: string[]
  note: string
}

/**
 * "continue" (default): adopt the same-type design on the current page when
 * one exists (session resume / anchor repair). "new": always create a fresh
 * root frame, even when a same-type design already sits on the current page.
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
  anchors: { template: string; position: 'top' | 'bottom' }[]
}

function resolveMaterialConfig(
  session: LibrarySession | undefined,
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
      size: { width: size.width, height: size.height },
      anchors: []
    }
  }

  const type = session?.index.types.find((entry) => entry.id === id)
  if (type) return { id: type.id, label: type.label, size: type.size, anchors: type.anchors }

  const available = (session?.index.types ?? [])
    .map((entry) => `${entry.id} (${entry.label})`)
    .join(', ')
  // Repair intent with the wrong library loaded: the document has a design
  // of this type whose marker names a DIFFERENT library — the design was
  // made with that library, so guide a re-submit (§6.1). When the marker
  // matches the current library the id is simply wrong — no hint.
  const designOfType = listMarketingDesigns(graph).find((design) => design.materialTypeId === id)
  const madeWith = designOfType
    ? marketingRootLibrary(graph.getNode(designOfType.rootFrameId))
    : undefined
  const resubmitHint =
    madeWith && madeWith !== session?.name
      ? ` This document has a design of type "${id}" made with library "${madeWith}" — re-submit that library file to repair it (currently loaded: ${session?.name ?? 'none'}).`
      : ''
  return {
    error: `Unknown material type: "${id}". Available: ${available || '(none)'}, custom (needs width+height).${resubmitHint}`
  }
}

// P8v3 (2026-08-01): profile is no longer part of the setup tool surface.
// The user-driven lock is read at `bindMarketingLibrary` time and
// injected into the system prompt via `buildMarketingOverlay` — setup
// itself does not echo any profile information.

function ensureComponentsPage(figma: FigmaAPI, existingId?: string): string {
  const graph = figma.graph
  if (existingId && graph.getNode(existingId)) return existingId
  const pages = graph.getPages()
  const found = pages.find((page) => page.name === COMPONENTS_PAGE_NAME)
  if (found) return found.id
  return graph.addPage(COMPONENTS_PAGE_NAME).id
}

/**
 * Find the same-type root frame ON THE GIVEN PAGE. Marker first
 * (rename-proof), but only adopt a root frame marked for THIS type — frames
 * of other types are sibling designs, not candidates. Fall back to the label
 * naming convention (prefix-matched: differentiated names like "产品长图 2"
 * still resolve) for designs created before markers existed.
 * Page-scoped on purpose: a same-type design on ANOTHER page is a separate
 * work the user may still be editing — never adopt across pages.
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
  for (const childId of page.childIds) {
    const child = graph.getNode(childId)
    if (
      child?.type === 'FRAME' &&
      (child.name === config.label || child.name.startsWith(`${config.label} `))
    )
      return child
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
    if (page.name === COMPONENTS_PAGE_NAME) continue
    for (const childId of page.childIds) walk(childId)
  }
  return roots
}

/**
 * Display name for a NEW root frame: the bare label when it is the first of
 * its type, otherwise the smallest free "label N" (N ≥ 2). Names are display
 * only (the marker is the machine identity) but must differ so canvas users
 * and per-design brief sections can tell same-type designs apart.
 */
function nextRootFrameName(graph: FigmaAPI['graph'], config: MaterialConfig): string {
  const taken = new Set(listSameTypeRoots(graph, config.id).map((root) => root.name))
  if (!taken.has(config.label)) return config.label
  for (let n = 2; ; n++) {
    const candidate = `${config.label} ${n}`
    if (!taken.has(candidate)) return candidate
  }
}

function createRootFrame(
  figma: FigmaAPI,
  config: MaterialConfig,
  libraryName: string | undefined,
  name: string
): string {
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
  markMarketingRoot(graph, frame.id, config.id, libraryName)
  return frame.id
}

/** Marker texts are scan metadata (Q9) — they must not ship inside cloned components */
const LIBRARY_MARKER_TEXT_RE = /^readonly\s*:/i

function stripLibraryMarkerTexts(graph: FigmaAPI['graph'], rootId: string): void {
  const markerIds: string[] = []
  const walk = (nodeId: string) => {
    const node = graph.getNode(nodeId)
    if (!node) return
    for (const childId of node.childIds) {
      const child = graph.getNode(childId)
      if (!child) continue
      if (child.type === 'TEXT' && LIBRARY_MARKER_TEXT_RE.test(child.text.trim())) {
        markerIds.push(childId)
        continue
      }
      walk(childId)
    }
  }
  walk(rootId)
  for (const id of markerIds) graph.deleteNode(id)
}

/**
 * Ensure a COMPONENT named `componentName` exists on the target document's
 * Components page: reuse by name if present, otherwise clone it from the
 * library's Components page.
 */
function ensureLibraryComponent(
  figma: FigmaAPI,
  session: LibrarySession,
  componentName: string,
  componentsPageId: string
): string | { error: string } {
  const graph = figma.graph
  const page = graph.getNode(componentsPageId)
  for (const childId of page?.childIds ?? []) {
    const child = graph.getNode(childId)
    if (child?.type === 'COMPONENT' && child.name === componentName) return child.id
  }

  const component = session.index.components.find((entry) => entry.name === componentName)
  if (!component) {
    return {
      error: `Component "${componentName}" not found in the Components page of library "${session.name}" — fix the library, or use custom (width+height) for an anchorless design`
    }
  }
  const clone = cloneSubtreeAcrossGraphs(session.graph, component.nodeId, graph, componentsPageId)
  if ('error' in clone) return clone
  stripLibraryMarkerTexts(graph, clone.rootId)
  return clone.rootId
}

function materializeAnchor(
  figma: FigmaAPI,
  session: LibrarySession,
  anchorRef: { template: string; position: 'top' | 'bottom' },
  componentsPageId: string,
  rootFrameId: string
): AnchorRecord | { error: string } {
  const graph = figma.graph
  const componentId = ensureLibraryComponent(figma, session, anchorRef.template, componentsPageId)
  if (typeof componentId !== 'string') return componentId

  const instance = graph.createInstance(componentId, rootFrameId, {})
  if (!instance) return { error: `Failed to create instance of ${anchorRef.template}` }

  graph.updateNode(instance.id, { counterAxisSizing: 'FILL' })

  const rootFrame = graph.getNode(rootFrameId)
  if (rootFrame) {
    const index = anchorRef.position === 'top' ? 0 : rootFrame.childIds.length - 1
    graph.reorderChild(instance.id, rootFrameId, index)
  }

  markMarketingAnchor(graph, instance.id, {
    templateId: anchorRef.template,
    position: anchorRef.position,
    componentId
  })

  return {
    templateId: anchorRef.template,
    position: anchorRef.position,
    componentId,
    instanceId: instance.id
  }
}

/**
 * Re-materialize an anchor whose instance was deleted. Reuses the existing
 * component definition when possible; falls back to cloning from the
 * library when the component is also gone.
 */
function rebuildAnchorInstance(
  figma: FigmaAPI,
  session: LibrarySession,
  prev: AnchorRecord,
  componentsPageId: string,
  rootFrameId: string
): AnchorRecord | { error: string } {
  const graph = figma.graph
  if (graph.getNode(prev.instanceId)) graph.deleteNode(prev.instanceId)

  if (!graph.getNode(prev.componentId)) {
    return materializeAnchor(
      figma,
      session,
      { template: prev.templateId, position: prev.position },
      componentsPageId,
      rootFrameId
    )
  }

  const instance = graph.createInstance(prev.componentId, rootFrameId, {})
  if (!instance) return { error: `Failed to create instance of ${prev.templateId}` }

  graph.updateNode(instance.id, { counterAxisSizing: 'FILL' })

  const rootFrame = graph.getNode(rootFrameId)
  if (rootFrame) {
    const index = prev.position === 'top' ? 0 : rootFrame.childIds.length - 1
    graph.reorderChild(instance.id, rootFrameId, index)
  }

  markMarketingAnchor(graph, instance.id, {
    templateId: prev.templateId,
    position: prev.position,
    componentId: prev.componentId
  })

  return { ...prev, instanceId: instance.id }
}

function resolveAnchors(
  figma: FigmaAPI,
  session: LibrarySession,
  config: MaterialConfig,
  existing: MarketingDocumentState | undefined,
  isRepair: boolean,
  componentsPageId: string,
  rootFrameId: string
): { anchors: AnchorRecord[]; repaired: string[] } | { error: string } {
  const graph = figma.graph
  const anchors: AnchorRecord[] = []
  const repaired: string[] = []

  for (const anchorRef of config.anchors) {
    const prev = isRepair
      ? existing?.anchors.find((anchor) => anchor.templateId === anchorRef.template)
      : undefined

    const instanceAlive = prev !== undefined && graph.getNode(prev.instanceId) !== undefined

    if (prev && instanceAlive) {
      anchors.push(prev)
      continue
    }

    if (prev && graph.getNode(prev.componentId)) {
      const rebuilt = rebuildAnchorInstance(figma, session, prev, componentsPageId, rootFrameId)
      if ('error' in rebuilt) return rebuilt
      anchors.push(rebuilt)
      repaired.push(anchorRef.template)
      continue
    }

    const result = materializeAnchor(figma, session, anchorRef, componentsPageId, rootFrameId)
    if ('error' in result) return result
    anchors.push(result)
    if (prev) repaired.push(anchorRef.template)
  }

  return { anchors, repaired }
}

/**
 * Repair/continue targets the same-type design ON THE CURRENT PAGE; a
 * same-type design on another page is a separate work and is never adopted.
 * mode "new" skips adoption entirely so a fresh root frame is created.
 * Other designs in the same document are never touched.
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

function materializeAllAnchors(
  figma: FigmaAPI,
  session: LibrarySession | undefined,
  config: MaterialConfig,
  existing: MarketingDocumentState | undefined,
  isRepair: boolean,
  componentsPageId: string,
  rootFrameId: string
): { anchors: AnchorRecord[]; repaired: string[] } | { error: string } {
  if (config.anchors.length === 0) return { anchors: [], repaired: [] }
  if (!session) {
    return {
      error: `Material type "${config.id}" requires anchor components but no library is loaded. Load a library or use custom (width+height) for an anchorless design.`
    }
  }
  return resolveAnchors(figma, session, config, existing, isRepair, componentsPageId, rootFrameId)
}

function collectReadonlyNote(session: LibrarySession | undefined, config: MaterialConfig): string {
  const readonlyNames = new Set<string>()
  for (const anchorRef of config.anchors) {
    const component = session?.index.components.find((entry) => entry.name === anchorRef.template)
    for (const name of component?.readonlyNames ?? []) readonlyNames.add(name)
  }
  if (readonlyNames.size === 0) return ''
  return ` readonly-declared nodes (${[...readonlyNames].join(', ')}) must not be modified — fill only the editable slots.`
}

export function setupMaterialType(
  figma: FigmaAPI,
  id: string,
  size?: { width: number; height: number },
  mode: SetupMode = 'continue'
): SetupResult | { error: string } {
  const graph = figma.graph
  const session = getLibrarySession(graph)

  const config = resolveMaterialConfig(session, graph, id, size)
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

  // Type switch on an adopted root frame: replace only that design's
  // anchors and registry entry — sibling designs stay intact.
  if (existing && !isRepair) {
    for (const anchor of existing.anchors) {
      if (graph.getNode(anchor.instanceId)) graph.deleteNode(anchor.instanceId)
    }
    clearMarketingState(graph, existing.rootFrameId)
  }

  const adoptable = !!(adoptedId && graph.getNode(adoptedId))
  const rootFrameId = adoptable
    ? adoptedId
    : createRootFrame(figma, config, session?.name, nextRootFrameName(graph, config))

  const componentsPageId = ensureComponentsPage(
    figma,
    existing?.componentsPageId ?? designs[0]?.componentsPageId
  )

  const resolved = materializeAllAnchors(
    figma,
    session,
    config,
    existing,
    isRepair,
    componentsPageId,
    rootFrameId
  )
  if ('error' in resolved) return resolved
  const { anchors, repaired } = resolved

  setMarketingState(graph, {
    materialTypeId: id,
    rootFrameId,
    componentsPageId,
    anchors
  })

  const warnings = session?.index.warnings ?? []

  const rootNode = graph.getNode(rootFrameId)
  const rootFrameName = rootNode?.name ?? config.label
  const pageName = pageOfNode(graph, rootFrameId)?.name ?? figma.currentPage.name
  const siblingPages = [
    ...new Set(
      listSameTypeRoots(graph, id)
        .filter((root) => root.id !== rootFrameId)
        .map((root) => pageOfNode(graph, root.id)?.name)
        .filter((name): name is string => !!name)
    )
  ]

  // Bind the page's brief to this design so brief tools route to it: prefer
  // the brief already bound here; otherwise take the first brief that is
  // unbound or bound only to deleted designs — never steal a brief that
  // serves another live design.
  const bindableBrief = listBriefs(figma).find((brief) => {
    const bound = briefBoundDesignIds(brief)
    if (bound.includes(rootFrameId)) return true
    return bound.every((boundId) => !graph.getNode(boundId))
  })
  if (bindableBrief) {
    bindBriefToDesign(figma, bindableBrief.id, rootFrameId)
    setBriefBindingLabel(figma, bindableBrief.id, `关联：${rootFrameName} · ${pageName}`)
  }

  const anchorPart =
    anchors.length > 0 ? 'Root frame and anchor instances are ready.' : 'Root frame is ready.'
  const briefPart = bindableBrief ? ` Bound 需求单 (${bindableBrief.id}) to this design.` : ''
  const originPart = adoptable
    ? `ADOPTED the existing "${rootFrameName}" design (${rootFrameId}) on page "${pageName}" — it already has ${rootNode?.childIds.length ?? 0} top-level children, i.e. a previously built design, NOT a blank frame. Its content belongs to an earlier session unless the user just asked to continue it. If the user wants a NEW design, call setup_material_type again with mode: "new".`
    : `Created NEW blank root frame "${rootFrameName}" (${rootFrameId}) on page "${pageName}".${
        siblingPages.length > 0
          ? ` A separate "${config.label}" design exists on page ${siblingPages
              .map((name) => `"${name}"`)
              .join(
                ', '
              )} — to continue THAT one, switch to its page first and call setup_material_type again (adoption never crosses pages).`
          : ''
      }`
  return {
    materialType: id,
    label: config.label,
    rootFrameId,
    rootFrameName,
    page: pageName,
    adopted: adoptable,
    ...(adoptable ? { existingChildren: rootNode?.childIds.length ?? 0 } : {}),
    size: config.size,
    anchors: anchors.map((anchor) => ({
      template: anchor.templateId,
      position: anchor.position,
      instanceId: anchor.instanceId
    })),
    ...(warnings.length > 0 ? { warnings } : {}),
    ...(repaired.length > 0 ? { repaired } : {}),
    note: `${anchorPart}${briefPart} ${originPart} CRITICAL: render every section INTO the root frame with render({ parent_id: "${rootFrameId}", jsx: ... }) — sections rendered without parent_id land on the page as orphaned siblings and w="fill" collapses. Never pass id as a JSX prop.${collectReadonlyNote(session, config)}`
  }
}

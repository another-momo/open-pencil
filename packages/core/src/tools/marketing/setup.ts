/**
 * setup_material_type tool implementation (library-driven).
 *
 * Material type configs come from the loaded Library .fig (Types zone) via
 * the session LibraryIndex — no code-side seed (Q5). `custom` remains the
 * always-available escape hatch. Anchor components are cloned from the
 * library's Components zone (cloneSubtreeAcrossGraphs), not built from code
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
import { cloneSubtreeAcrossGraphs } from '#core/tools/marketing/clone'
import { getLibrarySession, type LibrarySession } from '#core/tools/marketing/library'
import {
  clearMarketingState,
  getMarketingPrefs,
  listMarketingDesigns,
  setMarketingState,
  type AnchorRecord,
  type MarketingDocumentState
} from '#core/tools/marketing/registry'
import {
  markMarketingAnchor,
  markMarketingRoot,
  marketingRootLibrary,
  marketingRootType
} from '#core/tools/marketing/restore'

const COMPONENTS_PAGE_NAME = 'Components'

export interface SetupResult {
  materialType: string
  label: string
  rootFrameId: string
  /** Root frame size — height is null for HUG (long-image types grow with content) */
  size: { width: number; height: number | null }
  anchors: { template: string; position: string; instanceId: string }[]
  /** Profile chosen for this design — the app injects its markdown into the system prompt overlay (Q6) */
  activeProfileId?: string
  /** Library scan warnings (malformed entries, duplicates, unresolved anchors) */
  warnings?: string[]
  repaired?: string[]
  note: string
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

function resolveProfile(
  session: LibrarySession | undefined,
  graph: FigmaAPI['graph'],
  typeId: string,
  requested?: string
): { activeProfileId?: string } | { error: string } {
  const profiles = session?.index.profiles ?? []
  if (profiles.length === 0) return {}
  if (requested) {
    const found = profiles.find((profile) => profile.id === requested)
    if (!found) {
      const available = profiles.map((profile) => profile.id).join(', ')
      return { error: `Unknown profile: "${requested}". Available: ${available}` }
    }
    return { activeProfileId: found.id }
  }
  // A user-locked profile (config bar) always wins over auto-pick
  const locked = getMarketingPrefs(graph).profileId
  if (locked) {
    const found = profiles.find((profile) => profile.id === locked)
    if (found) return { activeProfileId: found.id }
  }
  const applicable = profiles.find((profile) => profile.applicableTo.includes(typeId))
  return { activeProfileId: (applicable ?? profiles[0]).id }
}

function ensureComponentsPage(figma: FigmaAPI, existingId?: string): string {
  const graph = figma.graph
  if (existingId && graph.getNode(existingId)) return existingId
  const pages = graph.getPages()
  const found = pages.find((page) => page.name === COMPONENTS_PAGE_NAME)
  if (found) return found.id
  return graph.addPage(COMPONENTS_PAGE_NAME).id
}

function findRootFrame(graph: FigmaAPI['graph'], config: MaterialConfig): SceneNode | undefined {
  const pages = graph.getPages()
  // Marker first (rename-proof), but only adopt a root frame marked for
  // THIS type — frames of other types are sibling designs, not candidates.
  // Fall back to the label naming convention for designs created before
  // markers existed.
  for (const page of pages) {
    if (page.name === COMPONENTS_PAGE_NAME) continue
    for (const childId of page.childIds) {
      const child = graph.getNode(childId)
      if (marketingRootType(child) === config.id) return child
    }
  }
  for (const page of pages) {
    if (page.name === COMPONENTS_PAGE_NAME) continue
    for (const childId of page.childIds) {
      const child = graph.getNode(childId)
      if (child?.type === 'FRAME' && child.name === config.label) return child
    }
  }
  return undefined
}

function createRootFrame(
  figma: FigmaAPI,
  config: MaterialConfig,
  libraryName: string | undefined
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
    name: config.label,
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
 * library's Components zone.
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
      error: `Component "${componentName}" not found in the Components zone of library "${session.name}" — fix the library, or use custom (width+height) for an anchorless design`
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
 * Repair targets the design of the SAME type; otherwise adopt the root
 * frame named after this type's label (if any) and continue that design.
 * Other designs in the same document are never touched.
 */
function resolveExistingDesign(
  graph: FigmaAPI['graph'],
  designs: MarketingDocumentState[],
  config: MaterialConfig,
  id: string
): { existing: MarketingDocumentState | undefined; rootFrameId: string | undefined } {
  const sameType = designs.find((design) => design.materialTypeId === id)
  if (sameType && !graph.getNode(sameType.rootFrameId)) {
    clearMarketingState(graph, sameType.rootFrameId)
  }
  if (sameType && graph.getNode(sameType.rootFrameId)) {
    return { existing: sameType, rootFrameId: sameType.rootFrameId }
  }
  const found = findRootFrame(graph, config)
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
  profileId?: string
): SetupResult | { error: string } {
  const graph = figma.graph
  const session = getLibrarySession(graph)

  const config = resolveMaterialConfig(session, graph, id, size)
  if ('error' in config) return config

  const profile = resolveProfile(session, graph, id, profileId)
  if ('error' in profile) return profile

  const designs = listMarketingDesigns(graph)
  const { existing, rootFrameId: adoptedId } = resolveExistingDesign(graph, designs, config, id)
  const isRepair = existing?.materialTypeId === id

  // Type switch on an adopted root frame: replace only that design's
  // anchors and registry entry — sibling designs stay intact.
  if (existing && !isRepair) {
    for (const anchor of existing.anchors) {
      if (graph.getNode(anchor.instanceId)) graph.deleteNode(anchor.instanceId)
    }
    clearMarketingState(graph, existing.rootFrameId)
  }

  const rootFrameId =
    adoptedId && graph.getNode(adoptedId)
      ? adoptedId
      : createRootFrame(figma, config, session?.name)

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

  return {
    materialType: id,
    label: config.label,
    rootFrameId,
    size: config.size,
    anchors: anchors.map((anchor) => ({
      template: anchor.templateId,
      position: anchor.position,
      instanceId: anchor.instanceId
    })),
    ...(profile.activeProfileId ? { activeProfileId: profile.activeProfileId } : {}),
    ...(warnings.length > 0 ? { warnings } : {}),
    ...(repaired.length > 0 ? { repaired } : {}),
    note: `Root frame and anchor instances are ready. CRITICAL: render every section INTO the root frame with render({ parent_id: "${rootFrameId}", jsx: ... }) — sections rendered without parent_id land on the page as orphaned siblings and w="fill" collapses. Never pass id as a JSX prop.${collectReadonlyNote(session, config)}`
  }
}

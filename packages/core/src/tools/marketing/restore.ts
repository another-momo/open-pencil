/**
 * Rebuild marketing session state from canvas markers after a document
 * reopen (docs/plans/l2-context-engineering.md 任务 4).
 *
 * setup_material_type stamps pluginData markers on the root frame and each
 * anchor instance (rename-proof, following the brief.ts precedent). On a
 * fresh session the registry is empty; getMarketingState lazily calls
 * restoreStateFromCanvas once per graph to rebuild it — explicit state
 * (locked direction, campaign facts) is NOT restored here; that lives in
 * the 需求单 AI结论区 and is re-read by the agent.
 */

import type { PluginDataEntry, SceneGraph, SceneNode } from '@open-pencil/scene-graph'

export interface AnchorRecord {
  templateId: string
  position: 'top' | 'bottom'
  componentId: string
  instanceId: string
}

export interface MarketingDocumentState {
  materialTypeId: string
  rootFrameId: string
  /** Resolved lazily by setup when absent (restore may run before a Components page exists) */
  componentsPageId?: string
  anchors: AnchorRecord[]
  /** Monotonic sequence — higher = more recently active (not wall time) */
  lastActiveAt: number
}

const MARKETING_PLUGIN_ID = 'open-pencil-marketing'
const ROLE_KEY = 'role'
const ROLE_ROOT = 'marketing-root'
const ROLE_ANCHOR = 'marketing-anchor'
const TYPE_KEY = 'material-type'
const TEMPLATE_KEY = 'anchor-template'
const POSITION_KEY = 'anchor-position'
const COMPONENT_KEY = 'anchor-component'
const LIBRARY_KEY = 'library'
const ROLE_LIBRARY_REFERENCE = 'library-reference'
const LIBRARY_REF_KEY = 'library-ref'

function markerValue(node: SceneNode, key: string): string | undefined {
  return node.pluginData.find(
    (entry: PluginDataEntry) => entry.pluginId === MARKETING_PLUGIN_ID && entry.key === key
  )?.value
}

function upsertMarker(
  graph: SceneGraph,
  nodeId: string,
  entries: Array<{ key: string; value: string }>
): void {
  const node = graph.getNode(nodeId)
  if (!node) return
  const kept = node.pluginData.filter(
    (entry) =>
      !(entry.pluginId === MARKETING_PLUGIN_ID && entries.some(({ key }) => key === entry.key))
  )
  graph.updateNode(nodeId, {
    pluginData: [
      ...kept,
      ...entries.map(({ key, value }) => ({ pluginId: MARKETING_PLUGIN_ID, key, value }))
    ]
  })
}

export function markMarketingRoot(
  graph: SceneGraph,
  nodeId: string,
  materialTypeId: string,
  libraryName?: string
): void {
  upsertMarker(graph, nodeId, [
    { key: ROLE_KEY, value: ROLE_ROOT },
    { key: TYPE_KEY, value: materialTypeId },
    ...(libraryName ? [{ key: LIBRARY_KEY, value: libraryName }] : [])
  ])
}

export function markMarketingAnchor(
  graph: SceneGraph,
  nodeId: string,
  anchor: { templateId: string; position: string; componentId: string }
): void {
  upsertMarker(graph, nodeId, [
    { key: ROLE_KEY, value: ROLE_ANCHOR },
    { key: TEMPLATE_KEY, value: anchor.templateId },
    { key: POSITION_KEY, value: anchor.position },
    { key: COMPONENT_KEY, value: anchor.componentId }
  ])
}

export function isMarketingRoot(node: SceneNode | undefined): node is SceneNode {
  return !!node && node.type === 'FRAME' && markerValue(node, ROLE_KEY) === ROLE_ROOT
}

/**
 * Mark a node cloned from the library References page into this document
 * (§5): identifies it as a library-provided reference — not design output —
 * so it can be recognized and cleaned up later.
 */
export function markLibraryReference(graph: SceneGraph, nodeId: string, refId: string): void {
  upsertMarker(graph, nodeId, [
    { key: ROLE_KEY, value: ROLE_LIBRARY_REFERENCE },
    { key: LIBRARY_REF_KEY, value: refId }
  ])
}

/** The library reference id a marked node came from (undefined if not a library reference) */
export function libraryReferenceId(node: SceneNode | undefined): string | undefined {
  if (!node || markerValue(node, ROLE_KEY) !== ROLE_LIBRARY_REFERENCE) return undefined
  return markerValue(node, LIBRARY_REF_KEY)
}

/** The material type a marked root frame belongs to (undefined if unmarked) */
export function marketingRootType(node: SceneNode | undefined): string | undefined {
  if (!isMarketingRoot(node)) return undefined
  return markerValue(node, TYPE_KEY)
}

/** The library a marked root frame was made with (undefined if unmarked/unrecorded) */
export function marketingRootLibrary(node: SceneNode | undefined): string | undefined {
  if (!isMarketingRoot(node)) return undefined
  return markerValue(node, LIBRARY_KEY)
}

/**
 * Distinct library names referenced by marketing root frames in the
 * document — used at session start to detect designs made with a custom
 * library that is no longer loaded (docs/plans/l2-resource-library.md §6.1).
 * Recursive: users may nest root frames inside groups.
 */
export function listDocumentLibraryNames(graph: SceneGraph): string[] {
  const names = new Set<string>()
  const walk = (nodeId: string) => {
    const node = graph.getNode(nodeId)
    if (!node) return
    const name = marketingRootLibrary(node)
    if (name) names.add(name)
    for (const childId of node.childIds) walk(childId)
  }
  for (const page of graph.getPages()) {
    for (const childId of page.childIds) walk(childId)
  }
  return [...names]
}

function findComponentsPageId(graph: SceneGraph): string | undefined {
  return graph.getPages().find((page) => page.name === 'Components')?.id
}

function restoreAnchor(instance: SceneNode): AnchorRecord | undefined {
  const templateId = markerValue(instance, TEMPLATE_KEY)
  const componentId = markerValue(instance, COMPONENT_KEY)
  const position = markerValue(instance, POSITION_KEY)
  if (!templateId || !componentId) return undefined

  return {
    templateId,
    position: position === 'top' ? 'top' : 'bottom',
    componentId,
    instanceId: instance.id
  }
}

/**
 * Scan frames for marketing root markers and rebuild registry entries.
 * Returns the restored designs for the caller to register.
 * Recursive: users may nest root frames inside groups (mirrors
 * listDocumentLibraryNames).
 */
export function restoreStateFromCanvas(
  graph: SceneGraph
): Array<Omit<MarketingDocumentState, 'lastActiveAt'>> {
  const componentsPageId = findComponentsPageId(graph)
  const designs: Array<Omit<MarketingDocumentState, 'lastActiveAt'>> = []

  const walk = (nodeId: string) => {
    const rootFrame = graph.getNode(nodeId)
    if (!rootFrame) return
    if (isMarketingRoot(rootFrame)) {
      const materialTypeId = markerValue(rootFrame, TYPE_KEY)
      if (materialTypeId) {
        const anchors: AnchorRecord[] = []
        for (const instanceId of rootFrame.childIds) {
          const instance = graph.getNode(instanceId)
          if (!instance || markerValue(instance, ROLE_KEY) !== ROLE_ANCHOR) continue
          const anchor = restoreAnchor(instance)
          if (anchor) anchors.push(anchor)
        }

        designs.push({
          materialTypeId,
          rootFrameId: rootFrame.id,
          ...(componentsPageId ? { componentsPageId } : {}),
          anchors
        })
      }
    }
    for (const childId of rootFrame.childIds) walk(childId)
  }

  for (const page of graph.getPages()) {
    if (page.id === componentsPageId || page.name === 'Components') continue
    for (const childId of page.childIds) walk(childId)
  }
  return designs
}

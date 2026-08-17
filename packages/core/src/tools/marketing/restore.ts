/**
 * Rebuild marketing session state from canvas markers after a document
 * reopen. P3 reduced scope: only the root-frame marker is authoritative.
 * Anchor / library-reference machinery has been removed.
 */

import type { PluginDataEntry, SceneGraph, SceneNode } from '@open-pencil/scene-graph'

import { upsertPluginData } from '#core/tools/plugin-data'

export interface MarketingDocumentState {
  materialTypeId: string
  rootFrameId: string
  /** Monotonic sequence — higher = more recently active (not wall time) */
  lastActiveAt: number
}

const MARKETING_PLUGIN_ID = 'open-pencil-marketing'
const ROLE_KEY = 'role'
const ROLE_ROOT = 'marketing-root'
const TYPE_KEY = 'material-type'

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
  upsertPluginData(graph, nodeId, MARKETING_PLUGIN_ID, entries)
}

export function markMarketingRoot(graph: SceneGraph, nodeId: string, materialTypeId: string): void {
  upsertMarker(graph, nodeId, [
    { key: ROLE_KEY, value: ROLE_ROOT },
    { key: TYPE_KEY, value: materialTypeId }
  ])
}

export function isMarketingRoot(node: SceneNode | undefined): node is SceneNode {
  return !!node && node.type === 'FRAME' && markerValue(node, ROLE_KEY) === ROLE_ROOT
}

/** The material type a marked root frame belongs to (undefined if unmarked) */
export function marketingRootType(node: SceneNode | undefined): string | undefined {
  if (!isMarketingRoot(node)) return undefined
  return markerValue(node, TYPE_KEY)
}

/**
 * Scan frames for marketing root markers and rebuild registry entries.
 * Returns the restored designs for the caller to register.
 * Recursive: users may nest root frames inside groups.
 */
export function restoreStateFromCanvas(
  graph: SceneGraph
): Array<Omit<MarketingDocumentState, 'lastActiveAt'>> {
  const designs: Array<Omit<MarketingDocumentState, 'lastActiveAt'>> = []

  const walk = (nodeId: string) => {
    const rootFrame = graph.getNode(nodeId)
    if (!rootFrame) return
    if (isMarketingRoot(rootFrame)) {
      const materialTypeId = markerValue(rootFrame, TYPE_KEY)
      if (materialTypeId) {
        designs.push({
          materialTypeId,
          rootFrameId: rootFrame.id
        })
      }
    }
    for (const childId of rootFrame.childIds) walk(childId)
  }

  for (const page of graph.getPages()) {
    for (const childId of page.childIds) walk(childId)
  }
  return designs
}

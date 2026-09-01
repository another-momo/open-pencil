/**
 * T54（Phase 3 W2/T-B3）：生成历史（"历史图片备份"）——自 open-pencil 仓
 * feature/agent-backend @ 5d38aa4e 的 tools/image-gen/history.ts 移植。
 *
 * Before generate_image overwrites a node that holds an image, the old
 * subtree is cloned into a per-page history container so no superseded
 * version is ever lost — and a mistaken overwrite (e.g. a reference image
 * passed as `replace_id`) stays recoverable.
 * Only IMAGE fills are preserved: children survive a fill replacement and
 * solid/gradient fills are trivially recreatable.
 *
 * New images (no `replace_id`) are NOT snapshotted: the fresh node itself is
 * already on the canvas, so every version exists exactly once (lean-history
 * policy).
 *
 * Entries and the container carry pluginData markers (rename-proof) and must
 * not be used as overwrite targets — apply.ts redirects them to a new node.
 *
 * 与源的差异（目标仓适配）：
 * - upsertPluginData 内联（目标仓无 #core/tools/plugin-data；figma-api/
 *   plugin-data.ts 通用面的 shared 键编码形态与本标记协议不同，逐字保留源语义）
 * - marketing root 侦测收敛单源（T53 集成期归并）：isMarketingDesignRoot 走
 *   getSharedPluginData 通用面（编码键 + 旧格式兼容），本地常量副本删除
 */

import type { PluginDataEntry, SceneGraph, SceneNode } from '@open-pencil/scene-graph'

import { isMarketingDesignRoot } from '#core/tools/fork/marketing/setup'

const HISTORY_PLUGIN_ID = 'open-pencil-image-gen'
const ROLE_KEY = 'role'
const ROLE_CONTAINER = 'image-history-container'
const ROLE_ENTRY = 'image-history-entry'
const SOURCE_TARGET_KEY = 'source-target'
const SOURCE_HASH_KEY = 'source-hash'
const VERSION_KEY = 'version'
const CAPTURED_AT_KEY = 'captured-at'

const CONTAINER_NAME = '历史图片备份'
const CONTAINER_GUTTER = 100

// ── 本地插件数据 upsert（源 tools/plugin-data.ts 语义逐字） ──

function upsertPluginData(
  graph: SceneGraph,
  nodeId: string,
  pluginId: string,
  entries: Array<{ key: string; value: string }>
): void {
  const node = graph.getNode(nodeId)
  if (!node) return
  const kept = node.pluginData.filter(
    (entry) => !(entry.pluginId === pluginId && entries.some(({ key }) => key === entry.key))
  )
  graph.updateNode(nodeId, {
    pluginData: [...kept, ...entries.map(({ key, value }) => ({ pluginId, key, value }))]
  })
}

// ── marketing root 侦测：单源 = fork/marketing/setup.ts（T53） ──

export interface HistorySnapshot {
  id: string
  name: string
  /** 该目标的第几版快照（1 起） */
  version: number
}

function markerValue(node: SceneNode, key: string): string | undefined {
  return node.pluginData.find(
    (entry: PluginDataEntry) => entry.pluginId === HISTORY_PLUGIN_ID && entry.key === key
  )?.value
}

function upsertMarkers(
  graph: SceneGraph,
  nodeId: string,
  entries: Array<{ key: string; value: string }>
): void {
  upsertPluginData(graph, nodeId, HISTORY_PLUGIN_ID, entries)
}

function isHistoryContainer(node: SceneNode | undefined): boolean {
  return !!node && markerValue(node, ROLE_KEY) === ROLE_CONTAINER
}

function isHistoryEntry(node: SceneNode | undefined): boolean {
  return !!node && markerValue(node, ROLE_KEY) === ROLE_ENTRY
}

/** True when the node is a history entry, the container, or lives inside one */
export function isInImageHistory(graph: SceneGraph, nodeId: string): boolean {
  let current = graph.getNode(nodeId)
  while (current) {
    if (isHistoryEntry(current) || isHistoryContainer(current)) return true
    current = current.parentId ? graph.getNode(current.parentId) : undefined
  }
  return false
}

function pageIdOf(graph: SceneGraph, nodeId: string): string | undefined {
  let current = graph.getNode(nodeId)
  while (current) {
    if (current.type === 'CANVAS') return current.id
    current = current.parentId ? graph.getNode(current.parentId) : undefined
  }
  return undefined
}

/** Top-level ancestor of nodeId on its page (the direct child of the CANVAS) */
function topLevelAncestor(graph: SceneGraph, nodeId: string): SceneNode | undefined {
  let current = graph.getNode(nodeId)
  let top = current
  while (current?.parentId) {
    current = graph.getNode(current.parentId)
    if (current && current.type !== 'CANVAS') top = current
  }
  return top
}

function topImageHash(node: SceneNode): string | undefined {
  for (const fill of node.fills) {
    if (fill.type === 'IMAGE' && fill.visible && 'imageHash' in fill) {
      return fill.imageHash
    }
  }
  return undefined
}

function findContainer(graph: SceneGraph, pageId: string): SceneNode | undefined {
  const page = graph.getNode(pageId)
  if (!page) return undefined
  for (const childId of page.childIds) {
    const child = graph.getNode(childId)
    if (isHistoryContainer(child)) return child
  }
  return undefined
}

function createContainer(graph: SceneGraph, pageId: string, targetId: string): SceneNode {
  // Anchor next to the marketing root when the page has one; otherwise next
  // to the target's top-level ancestor. Never moved after creation.
  const page = graph.getNode(pageId)
  let anchor: SceneNode | undefined
  for (const childId of page?.childIds ?? []) {
    const child = graph.getNode(childId)
    if (isMarketingDesignRoot(child)) {
      anchor = child
      break
    }
  }
  if (!anchor) anchor = topLevelAncestor(graph, targetId)
  const x = anchor ? anchor.x + anchor.width + CONTAINER_GUTTER : 0
  const y = anchor?.y ?? 0

  const container = graph.createNode('FRAME', pageId, {
    name: CONTAINER_NAME,
    x,
    y,
    layoutMode: 'VERTICAL',
    itemSpacing: 24,
    primaryAxisSizing: 'HUG',
    counterAxisSizing: 'HUG',
    paddingTop: 24,
    paddingRight: 24,
    paddingBottom: 24,
    paddingLeft: 24,
    clipsContent: false,
    fills: [
      { type: 'SOLID', color: { r: 0.96, g: 0.96, b: 0.96, a: 1 }, opacity: 1, visible: true }
    ]
  })
  upsertMarkers(graph, container.id, [{ key: ROLE_KEY, value: ROLE_CONTAINER }])
  return container
}

function entriesOf(graph: SceneGraph, container: SceneNode, targetId: string): SceneNode[] {
  const entries: SceneNode[] = []
  for (const childId of container.childIds) {
    const child = graph.getNode(childId)
    if (child && isHistoryEntry(child) && markerValue(child, SOURCE_TARGET_KEY) === targetId) {
      entries.push(child)
    }
  }
  return entries
}

/**
 * Clone the target's current subtree into the page's history container.
 * Returns the snapshot, or undefined when there is nothing worth keeping
 * (empty node, or the same image already snapshotted for this target).
 */
export function snapshotBeforeOverwrite(
  graph: SceneGraph,
  targetId: string
): HistorySnapshot | undefined {
  const target = graph.getNode(targetId)
  if (!target) return undefined

  // Only IMAGE fills are irreplaceable (generated art / uploaded assets).
  // Children survive a fill replacement, and solid/gradient fills are
  // one-line recreations — snapshotting them would flood the history with
  // placeholder noise.
  const hash = topImageHash(target)
  if (!hash) return undefined

  const pageId = pageIdOf(graph, targetId)
  if (!pageId) return undefined

  const existingContainer = findContainer(graph, pageId)
  const prior = existingContainer ? entriesOf(graph, existingContainer, targetId) : []
  if (prior.length > 0) {
    const latestHash = markerValue(prior[prior.length - 1], SOURCE_HASH_KEY)
    if (latestHash === hash) return undefined
  }

  const container = existingContainer ?? createContainer(graph, pageId, targetId)
  const version = prior.length + 1
  const clone = graph.cloneTree(targetId, container.id, {
    name: `${target.name} · v${version}`,
    x: 0,
    y: 0,
    // The clone must not inherit fill/grow behavior from its old parent —
    // inside the history container it keeps its own fixed size.
    layoutGrow: 0,
    layoutAlignSelf: 'AUTO',
    layoutPositioning: 'AUTO'
  })
  if (!clone) return undefined

  // cloneTree copies pluginData — strip foreign markers so a snapshotted
  // marketing root (or other marked node) does not turn the history entry
  // into a phantom design/reference, then stamp our own.
  graph.updateNode(clone.id, { pluginData: [] })
  upsertMarkers(graph, clone.id, [
    { key: ROLE_KEY, value: ROLE_ENTRY },
    { key: SOURCE_TARGET_KEY, value: targetId },
    { key: SOURCE_HASH_KEY, value: hash },
    { key: VERSION_KEY, value: String(version) },
    { key: CAPTURED_AT_KEY, value: new Date().toISOString() }
  ])
  return { id: clone.id, name: clone.name, version }
}

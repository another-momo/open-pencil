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

import type { PluginDataEntry, SceneNode } from '@open-pencil/scene-graph'
import type { SceneGraph } from '@open-pencil/scene-graph'

import type { ReadonlyNodeInfo } from '#core/tools/marketing/builder'
import { getComponentTemplate } from '#core/tools/marketing/component-templates'
import {
  collectComponentReadonlyIds,
  deriveTemplateReadonlyNames,
  registerInstanceReadonly
} from '#core/tools/marketing/setup'
import { setMarketingState, type AnchorRecord } from '#core/tools/marketing/registry'

const MARKETING_PLUGIN_ID = 'open-pencil-marketing'
const ROLE_KEY = 'role'
const ROLE_ROOT = 'marketing-root'
const ROLE_ANCHOR = 'marketing-anchor'
const TYPE_KEY = 'material-type'
const TEMPLATE_KEY = 'anchor-template'
const POSITION_KEY = 'anchor-position'
const COMPONENT_KEY = 'anchor-component'

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

export function markMarketingRoot(graph: SceneGraph, nodeId: string, materialTypeId: string): void {
  upsertMarker(graph, nodeId, [
    { key: ROLE_KEY, value: ROLE_ROOT },
    { key: TYPE_KEY, value: materialTypeId }
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

/** The material type a marked root frame belongs to (undefined if unmarked) */
export function marketingRootType(node: SceneNode | undefined): string | undefined {
  if (!isMarketingRoot(node)) return undefined
  return markerValue(node, TYPE_KEY)
}

function findComponentsPageId(graph: SceneGraph): string | undefined {
  return graph.getPages().find((page) => page.name === 'Components')?.id
}

function restoreAnchor(
  graph: SceneGraph,
  instance: SceneNode,
  readonly: Map<string, ReadonlyNodeInfo>
): AnchorRecord | undefined {
  const templateId = markerValue(instance, TEMPLATE_KEY)
  const componentId = markerValue(instance, COMPONENT_KEY)
  const position = markerValue(instance, POSITION_KEY)
  if (!templateId || !componentId) return undefined

  const template = getComponentTemplate(templateId)
  if (template && graph.getNode(componentId)) {
    const readonlyIds = collectComponentReadonlyIds(
      graph,
      componentId,
      deriveTemplateReadonlyNames(template)
    )
    registerInstanceReadonly(graph, instance.id, readonlyIds, readonly)
  }

  return {
    templateId,
    position: position === 'top' ? 'top' : 'bottom',
    componentId,
    instanceId: instance.id
  }
}

/**
 * Scan top-level frames for marketing root markers and rebuild registry
 * entries. Returns the number of restored designs.
 */
export function restoreStateFromCanvas(graph: SceneGraph): number {
  const componentsPageId = findComponentsPageId(graph) ?? ''
  let restored = 0

  for (const page of graph.getPages()) {
    if (page.id === componentsPageId || page.name === 'Components') continue
    for (const childId of page.childIds) {
      const rootFrame = graph.getNode(childId)
      if (!isMarketingRoot(rootFrame)) continue
      const materialTypeId = markerValue(rootFrame, TYPE_KEY)
      if (!materialTypeId) continue

      const readonly = new Map<string, ReadonlyNodeInfo>()
      const anchors: AnchorRecord[] = []
      for (const instanceId of rootFrame.childIds) {
        const instance = graph.getNode(instanceId)
        if (!instance || markerValue(instance, ROLE_KEY) !== ROLE_ANCHOR) continue
        const anchor = restoreAnchor(graph, instance, readonly)
        if (anchor) anchors.push(anchor)
      }

      setMarketingState(graph, {
        materialTypeId,
        rootFrameId: rootFrame.id,
        componentsPageId,
        anchors,
        readonly
      })
      restored++
    }
  }
  return restored
}

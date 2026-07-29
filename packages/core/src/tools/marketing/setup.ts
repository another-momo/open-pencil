/**
 * setup_material_type tool implementation.
 *
 * One tool, three modes:
 * - first call: create root frame, materialize all anchors, write registry
 * - switch: different material type id — clear old anchors, rebuild
 * - repair: same id but anchor instances missing — re-materialize only
 *   the missing ones and re-register their readonly baselines
 */

import type { SceneNode } from '@open-pencil/scene-graph'

import type { FigmaAPI } from '#core/figma-api'
import {
  buildTemplate,
  snapshotReadonlyValues,
  type ReadonlyNodeInfo
} from '#core/tools/marketing/builder'
import {
  getComponentTemplate,
  type ComponentTemplate,
  type TemplateNode
} from '#core/tools/marketing/component-templates'
import {
  getMaterialType,
  listMaterialTypes,
  makeCustomMaterialType,
  type MaterialTypeConfig
} from '#core/tools/marketing/material-types'
import {
  clearMarketingState,
  listMarketingDesigns,
  setMarketingState,
  type AnchorRecord,
  type MarketingDocumentState
} from '#core/tools/marketing/registry'

const COMPONENTS_PAGE_NAME = 'Components'

export interface SetupResult {
  materialType: string
  label: string
  rootFrameId: string
  /** Root frame size — height is null for HUG (long-image types grow with content) */
  size: { width: number; height: number | null }
  anchors: { template: string; position: string; instanceId: string }[]
  sectionPlan: { id: string; weight: number; contentGuide: string }[]
  styleGuide: { colors: string[]; fonts: string[]; keywords: string[] }
  custom: Record<string, string>
  repaired?: string[]
  note: string
}

function ensureComponentsPage(figma: FigmaAPI, existingId?: string): string {
  const graph = figma.graph
  if (existingId && graph.getNode(existingId)) return existingId
  const pages = graph.getPages()
  const found = pages.find((page) => page.name === COMPONENTS_PAGE_NAME)
  if (found) return found.id
  return graph.addPage(COMPONENTS_PAGE_NAME).id
}

function findRootFrame(
  graph: FigmaAPI['graph'],
  config: MaterialTypeConfig
): SceneNode | undefined {
  const pages = graph.getPages()
  for (const page of pages) {
    if (page.name === COMPONENTS_PAGE_NAME) continue
    for (const childId of page.childIds) {
      const child = graph.getNode(childId)
      if (child?.type === 'FRAME' && child.name === config.label) return child
    }
  }
  return undefined
}

function createRootFrame(figma: FigmaAPI, config: MaterialTypeConfig): string {
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
  return frame.id
}

function collectComponentReadonlyIds(
  graph: FigmaAPI['graph'],
  componentId: string,
  readonlyNames: string[]
): Set<string> {
  const ids = new Set<string>()
  const walk = (nodeId: string) => {
    const node = graph.getNode(nodeId)
    if (!node) return
    if (readonlyNames.includes(node.name)) ids.add(node.id)
    for (const childId of node.childIds) walk(childId)
  }
  walk(componentId)
  return ids
}

function registerInstanceReadonly(
  graph: FigmaAPI['graph'],
  instanceId: string,
  componentReadonlyIds: Set<string>,
  readonly: Map<string, ReadonlyNodeInfo>
): void {
  const walk = (nodeId: string) => {
    const node = graph.getNode(nodeId)
    if (!node) return
    if (node.componentId && componentReadonlyIds.has(node.componentId)) {
      readonly.set(node.id, { ...snapshotReadonlyValues(node), anchorInstanceId: instanceId })
    }
    for (const childId of node.childIds) walk(childId)
  }
  walk(instanceId)
}

function materializeAnchor(
  figma: FigmaAPI,
  anchorRef: { template: string; position: 'top' | 'bottom' },
  componentsPageId: string,
  rootFrameId: string,
  readonly: Map<string, ReadonlyNodeInfo>
): AnchorRecord | { error: string } {
  const graph = figma.graph
  const template = getComponentTemplate(anchorRef.template)
  if (!template) return { error: `Unknown component template: ${anchorRef.template}` }

  const build = buildTemplate(figma, template, componentsPageId)
  if ('error' in build) return build

  const builtProxy = figma.getNodeById(build.rootId)
  if (!builtProxy) return { error: `Built node not found: ${build.rootId}` }
  const componentProxy = figma.createComponentFromNode(builtProxy)
  const componentId = componentProxy.id

  const componentReadonlyIds = collectComponentReadonlyIds(graph, componentId, build.readonlyNames)

  const instance = graph.createInstance(componentId, rootFrameId, {})
  if (!instance) return { error: `Failed to create instance of ${anchorRef.template}` }

  graph.updateNode(instance.id, { counterAxisSizing: 'FILL' })

  const rootFrame = graph.getNode(rootFrameId)
  if (rootFrame) {
    const index = anchorRef.position === 'top' ? 0 : rootFrame.childIds.length - 1
    graph.reorderChild(instance.id, rootFrameId, index)
  }

  registerInstanceReadonly(graph, instance.id, componentReadonlyIds, readonly)

  return {
    templateId: anchorRef.template,
    position: anchorRef.position,
    componentId,
    instanceId: instance.id
  }
}

function deriveTemplateReadonlyNames(template: ComponentTemplate): string[] {
  const names: string[] = []
  const walk = (node: TemplateNode) => {
    if (node.readonly) names.push(node.name)
    for (const child of node.children ?? []) walk(child)
  }
  walk(template.root)
  return names
}

/**
 * Re-materialize an anchor whose instance is alive but damaged (readonly
 * children missing). Reuses the existing component definition when possible;
 * falls back to a full template rebuild when the component is also gone.
 */
function rebuildAnchorInstance(
  figma: FigmaAPI,
  prev: AnchorRecord,
  componentsPageId: string,
  rootFrameId: string,
  readonly: Map<string, ReadonlyNodeInfo>
): AnchorRecord | { error: string } {
  const graph = figma.graph
  if (graph.getNode(prev.instanceId)) graph.deleteNode(prev.instanceId)

  if (!graph.getNode(prev.componentId)) {
    return materializeAnchor(
      figma,
      { template: prev.templateId, position: prev.position },
      componentsPageId,
      rootFrameId,
      readonly
    )
  }

  const template = getComponentTemplate(prev.templateId)
  if (!template) return { error: `Unknown component template: ${prev.templateId}` }

  const instance = graph.createInstance(prev.componentId, rootFrameId, {})
  if (!instance) return { error: `Failed to create instance of ${prev.templateId}` }

  graph.updateNode(instance.id, { counterAxisSizing: 'FILL' })

  const rootFrame = graph.getNode(rootFrameId)
  if (rootFrame) {
    const index = prev.position === 'top' ? 0 : rootFrame.childIds.length - 1
    graph.reorderChild(instance.id, rootFrameId, index)
  }

  const componentReadonlyIds = collectComponentReadonlyIds(
    graph,
    prev.componentId,
    deriveTemplateReadonlyNames(template)
  )
  registerInstanceReadonly(graph, instance.id, componentReadonlyIds, readonly)

  return { ...prev, instanceId: instance.id }
}

function resolveAnchors(
  figma: FigmaAPI,
  config: MaterialTypeConfig,
  existing: MarketingDocumentState | undefined,
  isRepair: boolean,
  componentsPageId: string,
  rootFrameId: string
):
  | { anchors: AnchorRecord[]; readonly: Map<string, ReadonlyNodeInfo>; repaired: string[] }
  | { error: string } {
  const graph = figma.graph
  const anchors: AnchorRecord[] = []
  const readonly: Map<string, ReadonlyNodeInfo> = new Map()
  const repaired: string[] = []

  for (const anchorRef of config.anchors) {
    const prev = isRepair
      ? existing?.anchors.find((anchor) => anchor.templateId === anchorRef.template)
      : undefined

    const prevReadonly = [...(existing?.readonly ?? [])].filter(
      ([, info]) => info.anchorInstanceId === prev?.instanceId
    )
    const instanceAlive = prev !== undefined && graph.getNode(prev.instanceId) !== undefined
    const intact = instanceAlive && prevReadonly.every(([nodeId]) => graph.getNode(nodeId))

    if (prev && intact) {
      anchors.push(prev)
      for (const [nodeId, info] of prevReadonly) readonly.set(nodeId, info)
      continue
    }

    if (prev && instanceAlive) {
      const rebuilt = rebuildAnchorInstance(figma, prev, componentsPageId, rootFrameId, readonly)
      if ('error' in rebuilt) return rebuilt
      anchors.push(rebuilt)
      repaired.push(anchorRef.template)
      continue
    }

    const result = materializeAnchor(figma, anchorRef, componentsPageId, rootFrameId, readonly)
    if ('error' in result) return result
    anchors.push(result)
    if (prev) repaired.push(anchorRef.template)
  }

  return { anchors, readonly, repaired }
}

export function setupMaterialType(
  figma: FigmaAPI,
  id: string,
  size?: { width: number; height: number }
): SetupResult | { error: string } {
  let config: MaterialTypeConfig | undefined
  if (id === 'custom') {
    if (!size || size.width <= 0 || size.height <= 0) {
      return { error: 'Custom material type requires positive width and height.' }
    }
    config = makeCustomMaterialType(size.width, size.height)
  } else {
    config = getMaterialType(id)
  }
  if (!config) {
    const available = listMaterialTypes()
      .map((type) => `${type.id} (${type.label})`)
      .join(', ')
    return { error: `Unknown material type: "${id}". Available: ${available}, custom (needs width+height)` }
  }

  const graph = figma.graph
  const designs = listMarketingDesigns(graph)

  // Repair targets the design of the SAME type; otherwise adopt the root
  // frame named after this type's label (if any) and continue that design.
  // Other designs in the same document are never touched.
  const sameType = designs.find((design) => design.materialTypeId === id)
  if (sameType && !graph.getNode(sameType.rootFrameId)) {
    clearMarketingState(graph, sameType.rootFrameId)
  }

  let existing: MarketingDocumentState | undefined
  let rootFrameId: string | undefined
  if (sameType && graph.getNode(sameType.rootFrameId)) {
    existing = sameType
    rootFrameId = sameType.rootFrameId
  } else {
    const found = findRootFrame(graph, config)
    rootFrameId = found?.id
    existing = rootFrameId ? designs.find((design) => design.rootFrameId === rootFrameId) : undefined
  }

  const isRepair = existing?.materialTypeId === id

  // Type switch on an adopted root frame: replace only that design's
  // anchors and registry entry — sibling designs stay intact.
  if (existing && !isRepair) {
    for (const anchor of existing.anchors) {
      if (graph.getNode(anchor.instanceId)) graph.deleteNode(anchor.instanceId)
    }
    clearMarketingState(graph, existing.rootFrameId)
  }

  if (!rootFrameId || !graph.getNode(rootFrameId)) {
    rootFrameId = createRootFrame(figma, config)
  }

  const componentsPageId = ensureComponentsPage(
    figma,
    existing?.componentsPageId ?? designs[0]?.componentsPageId
  )

  const resolved = resolveAnchors(figma, config, existing, isRepair, componentsPageId, rootFrameId)
  if ('error' in resolved) return resolved
  const { anchors, readonly, repaired } = resolved

  setMarketingState(graph, {
    materialTypeId: id,
    rootFrameId,
    componentsPageId,
    anchors,
    readonly
  })

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
    sectionPlan: config.sectionPlan,
    styleGuide: config.styleGuide,
    custom: config.custom,
    ...(repaired.length > 0 ? { repaired } : {}),
    note: `Root frame and anchor instances are ready. CRITICAL: render every section INTO the root frame with render({ parent_id: "${rootFrameId}", jsx: ... }) — sections rendered without parent_id land on the page as orphaned siblings and w="fill" collapses. Never pass id as a JSX prop. readonly-marked nodes (logo, brand name, QR code) must not be modified — fill only the editable slots.`
  }
}

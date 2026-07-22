/**
 * Component template builder: materializes TemplateNode trees into real
 * scene-graph nodes. Resolves imageRef fills through the asset registry
 * and reports which created nodes are readonly.
 */

import type { Fill, SceneNode } from '@open-pencil/scene-graph'

import { parseColor } from '#core/color'
import type { FigmaAPI } from '#core/figma-api'
import { createImageFill } from '#core/tools/image-fill'
import { getAsset } from '#core/tools/marketing/assets'
import type {
  ComponentTemplate,
  TemplateFill,
  TemplateNode
} from '#core/tools/marketing/component-templates'

export interface ReadonlyNodeInfo {
  props: string[]
  originalValues: Record<string, unknown>
  /** Anchor instance this readonly node belongs to (used by repair mode integrity checks) */
  anchorInstanceId?: string
}

export interface BuildResult {
  rootId: string
  /** Names of readonly nodes in the built tree (matched by name after component conversion) */
  readonlyNames: string[]
}

const ROOT_FALLBACK_WIDTH = 750

function resolveFill(figma: FigmaAPI, fill: TemplateFill): Fill | { error: string } {
  if (fill.type === 'SOLID') {
    return { type: 'SOLID', color: parseColor(fill.color), opacity: 1, visible: true }
  }
  const bytes = getAsset(fill.imageRef)
  if (!bytes) return { error: `Unknown asset: ${fill.imageRef}` }
  return createImageFill(figma, bytes)
}

function ownSizingProps(template: TemplateNode, isRoot: boolean): Partial<SceneNode> {
  const updates: Partial<SceneNode> = {}
  const layout = template.layoutMode ?? 'NONE'

  for (const axis of ['width', 'height'] as const) {
    const value = template[axis]
    const isPrimary =
      (axis === 'width' && layout === 'HORIZONTAL') || (axis === 'height' && layout === 'VERTICAL')
    const sizingKey = isPrimary ? ('primaryAxisSizing' as const) : ('counterAxisSizing' as const)

    if (typeof value === 'number') {
      updates[axis] = value
      if (layout !== 'NONE') updates[sizingKey] = 'FIXED'
    } else if (value === 'hug') {
      if (layout !== 'NONE') updates[sizingKey] = 'HUG'
      if (template.type === 'TEXT') updates.textAutoResize = 'WIDTH_AND_HEIGHT'
    } else if (value === 'fill' && isRoot) {
      updates[axis] = ROOT_FALLBACK_WIDTH
    }
  }
  return updates
}

/** Fill sizing inside an auto-layout parent, mirroring the proxy's layoutSizing accessors */
function childFillProps(template: TemplateNode, parent: TemplateNode): Partial<SceneNode> {
  const updates: Partial<SceneNode> = {}
  if (!parent.layoutMode) return updates

  if (template.width === 'fill') {
    if (parent.layoutMode === 'VERTICAL') updates.counterAxisSizing = 'FILL'
    else {
      updates.primaryAxisSizing = 'FILL'
      updates.layoutGrow = 1
    }
  }
  if (template.height === 'fill') {
    if (parent.layoutMode === 'HORIZONTAL') updates.counterAxisSizing = 'FILL'
    else {
      updates.primaryAxisSizing = 'FILL'
      updates.layoutGrow = 1
    }
  }
  return updates
}

function buildNode(
  figma: FigmaAPI,
  template: TemplateNode,
  parentId: string,
  isRoot: boolean,
  readonlyNames: string[]
): string | { error: string } {
  const graph = figma.graph
  const node = graph.createNode(template.type, parentId, { name: template.name })

  const updates: Partial<SceneNode> = { ...ownSizingProps(template, isRoot) }

  if (template.layoutMode) updates.layoutMode = template.layoutMode
  if (template.itemSpacing !== undefined) updates.itemSpacing = template.itemSpacing
  if (template.primaryAxisAlign) updates.primaryAxisAlign = template.primaryAxisAlign
  if (template.counterAxisAlign) updates.counterAxisAlign = template.counterAxisAlign
  if (template.padding) {
    updates.paddingTop = template.padding[0]
    updates.paddingBottom = template.padding[0]
    updates.paddingLeft = template.padding[1]
    updates.paddingRight = template.padding[1]
  }
  if (template.cornerRadius !== undefined) updates.cornerRadius = template.cornerRadius

  if (template.fills) {
    const fills: Fill[] = []
    for (const fill of template.fills) {
      const resolved = resolveFill(figma, fill)
      if ('error' in resolved) return resolved
      fills.push(resolved)
    }
    updates.fills = fills
  }

  if (template.type === 'TEXT') {
    if (template.characters !== undefined) updates.text = template.characters
    if (template.fontSize !== undefined) updates.fontSize = template.fontSize
    if (template.fontWeight !== undefined) updates.fontWeight = template.fontWeight
  }

  graph.updateNode(node.id, updates)

  if (template.readonly) readonlyNames.push(template.name)

  for (const child of template.children ?? []) {
    const childId = buildNode(figma, child, node.id, false, readonlyNames)
    if (typeof childId !== 'string') return childId
    const fillProps = childFillProps(child, template)
    if (Object.keys(fillProps).length > 0) graph.updateNode(childId, fillProps)
  }

  return node.id
}

/**
 * Build a component template tree under parentId.
 * Root 'fill' sizing falls back to a fixed width since the Components
 * page is not an auto-layout parent.
 */
export function buildTemplate(
  figma: FigmaAPI,
  template: ComponentTemplate,
  parentId: string
): BuildResult | { error: string } {
  const readonlyNames: string[] = []
  const result = buildNode(figma, template.root, parentId, true, readonlyNames)
  if (typeof result !== 'string') return result
  return { rootId: result, readonlyNames }
}

/** Snapshot current values of readonly props on a node */
export function snapshotReadonlyValues(node: SceneNode): ReadonlyNodeInfo {
  const props = node.type === 'TEXT' ? ['fills', 'text', 'fontSize', 'fontWeight'] : ['fills']
  const originalValues: Record<string, unknown> = {}
  for (const prop of props) {
    originalValues[prop] = structuredClone(node[prop as keyof SceneNode])
  }
  return { props, originalValues }
}

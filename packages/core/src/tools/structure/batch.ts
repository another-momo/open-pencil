import type { FigmaNodeProxy } from '#core/figma-api'
import { recordInstanceOverrides } from '#core/tools/instance-overrides'
import { parseJSONArrayParam } from '#core/tools/json-array'
import { defineTool } from '#core/tools/schema'

interface BatchOp {
  id: string
  props: Record<string, unknown>
}

const SCENE_PROP_MAP: Record<string, string[]> = {
  spacing: ['itemSpacing'],
  padding: ['paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft'],
  padding_horizontal: ['paddingLeft', 'paddingRight'],
  padding_vertical: ['paddingTop', 'paddingBottom'],
  counter_align: ['counterAxisAlign'],
  align: ['primaryAxisAlign'],
  sizing_horizontal: ['primaryAxisSizing', 'counterAxisSizing'],
  sizing_vertical: ['primaryAxisSizing', 'counterAxisSizing'],
  grow: ['layoutGrow'],
  name: ['name'],
  visible: ['visible'],
  corner_radius: ['cornerRadius'],
  opacity: ['opacity'],
  auto_resize: ['textAutoResize'],
  direction: ['layoutMode'],
  font_family: ['fontFamily'],
  font_weight: ['fontWeight']
}

function str(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function num(value: unknown): number {
  return typeof value === 'number' ? value : 0
}

function applyBatchProps(node: FigmaNodeProxy, props: Record<string, unknown>): string[] {
  const updated: string[] = []

  if (props.spacing !== undefined) {
    node.itemSpacing = num(props.spacing)
    updated.push('spacing')
  }
  if (props.padding !== undefined) {
    const value = num(props.padding)
    node.paddingTop = value
    node.paddingRight = value
    node.paddingBottom = value
    node.paddingLeft = value
    updated.push('padding')
  }
  if (props.padding_horizontal !== undefined) {
    node.paddingLeft = num(props.padding_horizontal)
    node.paddingRight = num(props.padding_horizontal)
    updated.push('padding_horizontal')
  }
  if (props.padding_vertical !== undefined) {
    node.paddingTop = num(props.padding_vertical)
    node.paddingBottom = num(props.padding_vertical)
    updated.push('padding_vertical')
  }
  if (props.counter_align !== undefined) {
    node.counterAxisAlignItems = str(props.counter_align)
    updated.push('counter_align')
  }
  if (props.align !== undefined) {
    node.primaryAxisAlignItems = str(props.align)
    updated.push('align')
  }
  if (props.sizing_horizontal !== undefined) {
    node.layoutSizingHorizontal = str(props.sizing_horizontal)
    updated.push('sizing_horizontal')
  }
  if (props.sizing_vertical !== undefined) {
    node.layoutSizingVertical = str(props.sizing_vertical)
    updated.push('sizing_vertical')
  }
  if (props.grow !== undefined) {
    node.layoutGrow = num(props.grow)
    updated.push('grow')
  }
  if (props.name !== undefined) {
    node.name = str(props.name)
    updated.push('name')
  }
  if (props.visible !== undefined) {
    node.visible = Boolean(props.visible)
    updated.push('visible')
  }
  if (props.corner_radius !== undefined) {
    node.cornerRadius = num(props.corner_radius)
    updated.push('corner_radius')
  }
  if (props.opacity !== undefined) {
    node.opacity = num(props.opacity)
    updated.push('opacity')
  }
  if (props.auto_resize !== undefined) {
    node.textAutoResize = str(props.auto_resize)
    updated.push('auto_resize')
  }
  if (props.direction !== undefined) {
    node.layoutMode = str(props.direction) as 'HORIZONTAL' | 'VERTICAL'
    updated.push('direction')
  }
  if (props.font_family !== undefined && node.type === 'TEXT') {
    node.fontName = { family: str(props.font_family), style: node.fontName.style }
    updated.push('font_family')
  }
  if (props.font_weight !== undefined && node.type === 'TEXT') {
    node.fontWeight = num(props.font_weight)
    updated.push('font_weight')
  }

  return updated
}

export const batchUpdate = defineTool({
  name: 'batch_update',
  mutates: true,
  description:
    'Execute multiple modifications in one call. Each operation is {id, props} where props can include: spacing, padding, padding_horizontal, padding_vertical, counter_align, sizing_horizontal, sizing_vertical, grow, name, visible, corner_radius, auto_resize (for text), direction, font_family (for text, preserves weight/style), font_weight (for text, 100-900). Unrecognized prop keys are reported per operation. Runs all updates with one layout recompute.',
  params: {
    operations: {
      type: 'string',
      description:
        'JSON array: [{"id":"0:5","props":{"spacing":8}},{"id":"0:6","props":{"sizing_horizontal":"FILL","grow":1}}]',
      required: true
    }
  },
  execute: (figma, { operations }) => {
    const parsed = parseJSONArrayParam(operations, 'operations')
    if ('error' in parsed) return { error: parsed.error }
    const ops = parsed.items as BatchOp[]

    const results: Array<{ id: string; updated: string[] }> = []
    const errors: string[] = []

    for (const op of ops) {
      const node = figma.getNodeById(op.id)
      if (!node) {
        errors.push(`Node "${op.id}" not found`)
        continue
      }
      const unknownKeys = Object.keys(op.props).filter((key) => !(key in SCENE_PROP_MAP))
      if (unknownKeys.length > 0) {
        errors.push(
          `Node "${op.id}": unknown props ${unknownKeys.map((key) => `"${key}"`).join(', ')} — supported: ${Object.keys(SCENE_PROP_MAP).join(', ')}`
        )
      }
      const updated = applyBatchProps(node, op.props)
      if (updated.length > 0) {
        results.push({ id: op.id, updated })
        recordInstanceOverrides(
          figma.graph,
          op.id,
          updated.flatMap((name) => SCENE_PROP_MAP[name] ?? [])
        )
      }
    }

    const out: Record<string, unknown> = { updated: results.length }
    if (results.length > 0) out.results = results
    if (errors.length > 0) out.errors = errors
    if (parsed.warning) out.warning = parsed.warning
    return out
  }
})

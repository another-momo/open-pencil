import { parse } from 'culori'
import { transform } from 'sucrase'

import type { SceneGraph } from '@open-pencil/scene-graph'

import type { RenderOptions as RenderJSXOptions } from '#core/design-jsx/types'

import { backgroundBlur, dropShadow, foregroundBlur, innerShadow, layerBlur } from './effects'
import * as React from './mini-react'
import {
  angularGradient,
  diamondGradient,
  gradient,
  linearGradient,
  radialGradient,
  solid
} from './paints'
import { fontWeightFromName, WEIGHT_NAME_LIST } from './props-overrides'
import { renderTree, type RenderResult } from './renderer'
import { isTreeNode, resolveToTree, type TreeNode } from './tree'

/**
 * Build a component function from a JSX string using sucrase.
 * Works in both Node/Bun and the browser (no native bindings).
 */
const SUPPORTED_PROPS = new Set([
  'name',
  'key',
  'flex',
  'flow',
  'dir',
  'gap',
  'wrap',
  'rowGap',
  'columnGap',
  'justify',
  'justifyContent',
  'items',
  'align',
  'alignItems',
  'grow',
  'w',
  'h',
  'width',
  'height',
  'minW',
  'maxW',
  'minH',
  'maxH',
  'x',
  'y',
  'top',
  'left',
  'position',
  'p',
  'padding',
  'px',
  'py',
  'pt',
  'pr',
  'pb',
  'pl',
  'bg',
  'fill',
  'fills',
  'background',
  'backgroundColor',
  'stroke',
  'border',
  'borderColor',
  'strokeWidth',
  'borderWidth',
  'strokeAlign',
  'strokeDash',
  'rounded',
  'borderRadius',
  'roundedTL',
  'roundedTR',
  'roundedBL',
  'roundedBR',
  'cornerRadius',
  'cornerSmoothing',
  'opacity',
  'blendMode',
  'rotate',
  'rotation',
  'overflow',
  'shadow',
  'blur',
  'effects',
  'size',
  'fontSize',
  'font',
  'fontFamily',
  'weight',
  'fontWeight',
  'color',
  'text',
  'characters',
  'content',
  'value',
  'title',
  'textAlign',
  'textAlignHorizontal',
  'textHorizontalAlignment',
  'textAlignVertical',
  'textVerticalAlignment',
  'textAutoResize',
  'lineHeight',
  'letterSpacing',
  'textDecoration',
  'textCase',
  'maxLines',
  'truncate',
  'grid',
  'columns',
  'rows',
  'colStart',
  'rowStart',
  'col',
  'row',
  'colSpan',
  'rowSpan',
  'points',
  'pointCount',
  'innerRadius',
  'label',
  'style',
  'bind',
  'component',
  'componentId',
  'of'
])

function stripHTMLComments(jsxString: string): string {
  return jsxString.replace(/<!--[\s\S]*?-->/g, '')
}

/** Literal `<jsx>`/`</jsx>` tags models sometimes wrap their output in */
const JSX_WRAPPER_TAG_RE = /<\/?jsx\b[^>]*>/gi
/** Self-closing tag immediately followed by its own closing tag: `<Frame .../></Frame>` */
const SELF_CLOSE_PLUS_CLOSE_RE = /(<([A-Za-z][A-Za-z0-9]*)\b[^>]*\/>)\s*<\/\2\s*>/g

/**
 * Collapse self-closing tags trailed by their own closing tag
 * (`<Frame .../></Frame>` → `<Frame .../>`), a common model slip that
 * otherwise surfaces as a hard parse failure.
 *
 * RECOVERY ONLY — never run this on input that might be valid: the regex is
 * nesting-blind and also matches a self-closing last child followed by its
 * parent's same-named closing tag (`<Frame><Frame .../></Frame>`), which is
 * legal JSX. Applied only after the raw parse has failed, it can only help.
 */
function collapseRedundantClosingTags(jsxString: string): string {
  let out = jsxString
  let prev: string
  do {
    prev = out
    out = out.replace(SELF_CLOSE_PLUS_CLOSE_RE, '$1')
  } while (out !== prev)
  return out
}

function unsupportedPropWarnings(tree: TreeNode): string[] {
  const warnings: string[] = []
  collectUnsupportedPropWarnings(tree, warnings)
  return warnings
}

const SVG_ROOT_PROPS = new Set([...SUPPORTED_PROPS, 'viewBox', 'body'])

function collectUnsupportedPropWarnings(tree: TreeNode, warnings: string[]): void {
  const supportedProps = tree.type === 'svg' ? SVG_ROOT_PROPS : SUPPORTED_PROPS
  for (const key of Object.keys(tree.props)) {
    if (!supportedProps.has(key)) {
      if (key === 'id') {
        warnings.push(
          `Unsupported prop "id" on <${tree.type}> is ignored. JSX cannot set node IDs or target a parent — to render INTO an existing frame, pass render's parent_id parameter; to replace a node, use replace_id.`
        )
      } else {
        warnings.push(`Unsupported prop "${key}" on <${tree.type}> is ignored.`)
      }
    }
  }

  // SVG descendants are parsed as markup by renderSvgNode, not as Design JSX nodes.
  if (tree.type === 'svg') return

  for (const child of tree.children) {
    if (isTreeNode(child)) collectUnsupportedPropWarnings(child, warnings)
  }
}

const COLOR_PROPS = new Set(['bg', 'color', 'stroke'])

function collectInvalidColorWarnings(tree: TreeNode, warnings: string[]): void {
  for (const [key, value] of Object.entries(tree.props)) {
    if (COLOR_PROPS.has(key) && typeof value === 'string' && !parse(value)) {
      warnings.push(
        `Invalid color "${value}" in prop "${key}" on <${tree.type}> — fell back to black. Fix the hex value and re-render with replace_id.`
      )
    }
  }
  for (const child of tree.children) {
    if (isTreeNode(child)) collectInvalidColorWarnings(child, warnings)
  }
}

const WEIGHT_PROPS = ['weight', 'fontWeight'] as const

function collectUnknownWeightWarnings(tree: TreeNode, warnings: string[]): void {
  if (tree.type === 'text') {
    for (const key of WEIGHT_PROPS) {
      const value = tree.props[key]
      if (typeof value === 'string' && fontWeightFromName(value) === undefined) {
        warnings.push(
          `Unknown weight "${value}" in prop "${key}" on <text> — fell back to 400. Supported names: ${WEIGHT_NAME_LIST} (case-insensitive), or a number 100-900.`
        )
      }
    }
  }
  for (const child of tree.children) {
    if (isTreeNode(child)) collectUnknownWeightWarnings(child, warnings)
  }
}

export function buildComponent(jsxString: string): React.ComponentType {
  const trimmed = stripHTMLComments(jsxString).replace(JSX_WRAPPER_TAG_RE, '').trim()

  const aliases = `
    const __h = React.createElement
    const __frag = ''
    const Frame = 'frame', Text = 'text', Rectangle = 'rectangle', Ellipse = 'ellipse'
    const Line = 'line', Star = 'star', Polygon = 'polygon', Vector = 'vector'
    const Group = 'group', Section = 'section', View = 'frame', Rect = 'rectangle'
    const Component = 'component', ComponentSet = 'component-set', Instance = 'instance'
    const Icon = 'icon'
    const svg = 'svg'
    const dropShadow = __helpers.dropShadow
    const innerShadow = __helpers.innerShadow
    const layerBlur = __helpers.layerBlur
    const backgroundBlur = __helpers.backgroundBlur
    const foregroundBlur = __helpers.foregroundBlur
    const solid = __helpers.solid
    const gradient = __helpers.gradient
    const linearGradient = __helpers.linearGradient
    const radialGradient = __helpers.radialGradient
    const angularGradient = __helpers.angularGradient
    const diamondGradient = __helpers.diamondGradient
    const __varSymbol = Symbol.for('open-pencil.variable')
    const designVar = (def, value) => typeof def === 'string'
      ? ({ [__varSymbol]: true, id: def, name: def, value })
      : ({ [__varSymbol]: true, id: def.id, name: def.name ?? def.id ?? '', value: def.value })
    const defineVars = (vars) => Object.fromEntries(
      Object.entries(vars).map(([key, def]) => [key, designVar(def)])
    )
  `
  const opts = {
    transforms: ['typescript', 'jsx'] as Array<'typescript' | 'jsx'>,
    jsxPragma: '__h',
    jsxFragmentPragma: '__frag',
    production: true
  }

  let code: string | undefined
  let parseError: unknown
  // Try the raw JSX first. collapseRedundantClosingTags is nesting-blind and
  // rewrites legal nesting, so it runs only as a recovery pass once the
  // untouched input has failed to parse.
  const candidates = [trimmed]
  const recovered = collapseRedundantClosingTags(trimmed)
  if (recovered !== trimmed) candidates.push(recovered)
  for (const candidate of candidates) {
    for (const source of [
      `${aliases}\nreturn function __render() { return ${candidate} }`,
      `${aliases}\nreturn function __render() { return <>${candidate}</> }`
    ]) {
      try {
        code = transform(source, opts).code
        break
      } catch (error) {
        parseError = error
      }
    }
    if (code !== undefined) break
  }
  if (code === undefined) {
    const detail = parseError instanceof Error ? ` — parser said: ${parseError.message}` : ''
    throw new Error(
      `JSX failed to parse. Check for unclosed or mismatched tags, fix the JSX, and retry.${detail}`
    )
  }

  // eslint-disable-next-line typescript-eslint/no-implied-eval -- sucrase output must be evaluated at runtime
  return new Function('React', '__helpers', code)(React, {
    backgroundBlur,
    dropShadow,
    foregroundBlur,
    innerShadow,
    layerBlur,
    angularGradient,
    diamondGradient,
    gradient,
    linearGradient,
    radialGradient,
    solid
  }) as React.ComponentType
}

/**
 * Render a JSX string into the scene graph.
 * Works in both Node/Bun and the browser.
 */
export async function renderJSX(
  graph: SceneGraph,
  jsxString: string,
  options?: RenderJSXOptions
): Promise<RenderResult[]> {
  const Component = buildComponent(jsxString)
  const element = React.createElement(Component, null)
  const tree = resolveToTree(element)

  if (!tree) {
    throw new Error('JSX must return a Figma element (Frame, Text, etc)')
  }

  const warnings = unsupportedPropWarnings(tree)
  collectInvalidColorWarnings(tree, warnings)
  collectUnknownWeightWarnings(tree, warnings)

  if (tree.type === '' && tree.children.length > 0) {
    const results: RenderResult[] = []
    for (const child of tree.children) {
      if (typeof child === 'string') continue
      results.push(await renderTree(graph, child, options))
    }
    if (results.length === 0) {
      throw new Error('JSX must return a Figma element (Frame, Text, etc)')
    }
    if (warnings.length > 0) results[0].warnings = warnings
    return results
  }

  const result = await renderTree(graph, tree, options)
  if (warnings.length > 0) result.warnings = warnings
  return [result]
}

export { renderTree as renderTreeNode }

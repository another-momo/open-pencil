/**
 * 需求单 (design brief): a specially-marked FRAME that serves as the
 * dedicated human↔AI communication carrier for marketing design inputs.
 *
 * Marked via pluginData (rename-proof). Layout: amber sticky-note with
 * white content cards on the left (内容区 / 素材区, the latter initially
 * empty with an EmptyHint row) and a deeper-amber AI结论区 card on the
 * right. NOT a new node type — plain FRAME/TEXT/RECTANGLE nodes so .fig
 * round-trip is unaffected.
 *
 * Visual design follows the UI-design-mode reference (RequirementCard):
 * amber palette, white cards, typographic hierarchy. All dimensions are
 * scaled ×√5 (≈2.236, area ×5) from the original 8px-grid values so the
 * brief stays legible on the canvas. Material entries are added via the
 * brief panel — the canvas shows no placeholder slots.
 */

import type { Fill, SceneNode } from '@open-pencil/scene-graph'

import { TRANSPARENT } from '#core/constants'
import type { FigmaAPI } from '#core/figma-api'

export const BRIEF_PLUGIN_ID = 'open-pencil-marketing'
export const BRIEF_ROLE_KEY = 'role'
export const BRIEF_ROLE_VALUE = 'brief'
export const BRIEF_NAME = '需求单'

export const BRIEF_ZONE_USER_NAME = '内容区'
export const BRIEF_ZONE_MATERIALS_NAME = '素材区'
export const BRIEF_ZONE_AI_NAME = 'AI结论区'
export const BRIEF_ENTRY_NAME = '素材条目'
export const BRIEF_CONCLUSIONS_NAME = '结论列表'
export const BRIEF_EMPTY_STATE_NAME = '空状态'
export const BRIEF_EMPTY_HINT_NAME = 'EmptyHint'
/** Legacy empty 'add' slots — no longer created, still recognized when inserting entries into old documents */
const BRIEF_ADD_SLOT_NAME = '添加位'

const BRIEF_BG = { r: 0.996, g: 0.965, b: 0.839 }
const CARD_BG = { r: 1, g: 1, b: 1 }
const CARD_STROKE = { r: 0.953, g: 0.91, b: 0.722 }
const INPUT_BG = { r: 0.984, g: 0.973, b: 0.933 }
const INPUT_STROKE = { r: 0.937, g: 0.902, b: 0.784 }
const ACCENT = { r: 0.961, g: 0.62, b: 0.043 }
const AI_ZONE_BG = { r: 0.988, g: 0.827, b: 0.302 }
const TITLE_COLOR = { r: 0.259, g: 0.125, b: 0.024 }
const LABEL_COLOR = { r: 0.706, g: 0.325, b: 0.035 }
const SUB_COLOR = { r: 0.572, g: 0.251, b: 0.055 }
const MUTED_COLOR = { r: 0.631, g: 0.384, b: 0.027 }
const EXAMPLE_COLOR = { r: 0.573, g: 0.38, b: 0.29 }
const SLOT_BG = { r: 0.961, g: 0.941, b: 0.886 }
const SLOT_STROKE = { r: 0.898, g: 0.875, b: 0.784 }

export function isBrief(node: SceneNode | undefined): node is SceneNode {
  if (node?.type !== 'FRAME') return false
  return node.pluginData.some(
    (entry) =>
      entry.pluginId === BRIEF_PLUGIN_ID &&
      entry.key === BRIEF_ROLE_KEY &&
      entry.value === BRIEF_ROLE_VALUE
  )
}

/** Find the first brief frame on the current page (top-level only) */
export function findBrief(figma: FigmaAPI): SceneNode | undefined {
  const page = figma.graph.getNode(figma.currentPage.id)
  if (!page) return undefined
  for (const childId of page.childIds) {
    const child = figma.graph.getNode(childId)
    if (isBrief(child)) return child
  }
  return undefined
}

interface TextOptions {
  fontSize?: number
  fontWeight?: number
  color?: { r: number; g: number; b: number }
  lineHeight?: number
  letterSpacing?: number
  opacity?: number
  align?: 'LEFT' | 'CENTER'
  /** Wrap at parent width (fill + height-resize); default hugs content */
  wrap?: boolean
}

function createText(
  figma: FigmaAPI,
  parentId: string,
  name: string,
  characters: string,
  options: TextOptions = {}
): string {
  const graph = figma.graph
  const node = graph.createNode('TEXT', parentId, { name })
  graph.updateNode(node.id, {
    text: characters,
    fontSize: options.fontSize ?? 26,
    fontWeight: options.fontWeight ?? 400,
    textAutoResize: options.wrap ? 'HEIGHT' : 'WIDTH_AND_HEIGHT',
    ...(options.wrap ? { layoutAlignSelf: 'STRETCH' as const } : {}),
    ...(options.lineHeight !== undefined ? { lineHeight: options.lineHeight } : {}),
    ...(options.letterSpacing !== undefined ? { letterSpacing: options.letterSpacing } : {}),
    ...(options.opacity !== undefined ? { opacity: options.opacity } : {}),
    ...(options.align ? { textAlignHorizontal: options.align } : {}),
    fills: [
      {
        type: 'SOLID',
        color: { r: 0.29, g: 0.25, b: 0.13, a: 1, ...options.color },
        opacity: 1,
        visible: true
      }
    ]
  })
  return node.id
}

interface CardOptions {
  bg?: { r: number; g: number; b: number }
  stroke?: { r: number; g: number; b: number }
  gap?: number
  padding?: number
  rounded?: number
  /** Sizing along the PARENT's primary axis */
  primary?: 'FIXED' | 'FILL' | 'HUG'
  /** Sizing along the PARENT's counter axis */
  counter?: 'FIXED' | 'FILL' | 'HUG'
  width?: number
  justify?: 'SPACE_BETWEEN'
}

function createCard(
  figma: FigmaAPI,
  parentId: string,
  name: string,
  options: CardOptions = {}
): string {
  const graph = figma.graph
  const card = graph.createNode('FRAME', parentId, { name })
  const padding = options.padding ?? 26
  graph.updateNode(card.id, {
    layoutMode: 'VERTICAL',
    itemSpacing: options.gap ?? 13,
    paddingTop: padding,
    paddingBottom: padding,
    paddingLeft: padding,
    paddingRight: padding,
    cornerRadius: options.rounded ?? 22,
    primaryAxisSizing: options.primary ?? 'HUG',
    counterAxisSizing: options.counter ?? 'FILL',
    ...(options.width ? { width: options.width } : {}),
    ...(options.justify ? { primaryAxisAlign: options.justify } : {}),
    fills: [
      {
        type: 'SOLID',
        color: { ...(options.bg ?? CARD_BG), a: 1 },
        opacity: 1,
        visible: true
      }
    ],
    strokes: options.stroke
      ? [
          {
            color: { ...options.stroke, a: 1 },
            weight: 1,
            opacity: 1,
            visible: true,
            align: 'INSIDE'
          }
        ]
      : []
  })
  return card.id
}

function createLabelRow(figma: FigmaAPI, parentId: string, label: string, badge: string): void {
  const graph = figma.graph
  const row = graph.createNode('FRAME', parentId, { name: 'LabelRow' })
  graph.updateNode(row.id, {
    layoutMode: 'HORIZONTAL',
    primaryAxisSizing: 'FILL',
    counterAxisSizing: 'HUG',
    primaryAxisAlign: 'SPACE_BETWEEN',
    counterAxisAlign: 'CENTER',
    fills: []
  })
  createText(figma, row.id, 'Label', label, {
    fontSize: 24,
    fontWeight: 700,
    letterSpacing: 1.8,
    color: LABEL_COLOR
  })
  createText(figma, row.id, 'Badge', badge, {
    fontSize: 22,
    opacity: 0.75,
    color: MUTED_COLOR
  })
}

/** A material entry: image slot on top, usage-note caption below. Fixed width so wrapped rows stay uniform. */
function createSlot(figma: FigmaAPI, parentId: string, name: string, caption: string): string {
  const graph = figma.graph
  const slot = graph.createNode('FRAME', parentId, { name })
  graph.updateNode(slot.id, {
    layoutMode: 'VERTICAL',
    itemSpacing: 18,
    counterAxisAlign: 'CENTER',
    primaryAxisSizing: 'HUG',
    counterAxisSizing: 'FIXED',
    width: 180,
    fills: []
  })
  const image = graph.createNode('FRAME', slot.id, { name: '图片位' })
  graph.updateNode(image.id, {
    width: 143,
    height: 143,
    cornerRadius: 22,
    layoutMode: 'HORIZONTAL',
    primaryAxisAlign: 'CENTER',
    counterAxisAlign: 'CENTER',
    fills: [{ type: 'SOLID', color: { ...SLOT_BG, a: 1 }, opacity: 1, visible: true }],
    strokes: [
      {
        color: { ...SLOT_STROKE, a: 1 },
        weight: 1,
        opacity: 1,
        visible: true,
        align: 'INSIDE'
      }
    ]
  })
  createText(figma, slot.id, 'Caption', caption, {
    fontSize: 22,
    align: 'CENTER',
    color: SUB_COLOR,
    wrap: true
  })
  return slot.id
}

/** Create the brief frame at (x, y) with the full three-zone structure */
export function createBrief(figma: FigmaAPI, x = 0, y = 0): SceneNode {
  const graph = figma.graph
  const brief = graph.createNode('FRAME', figma.currentPage.id, { name: BRIEF_NAME, x, y })
  graph.updateNode(brief.id, {
    width: 1252,
    layoutMode: 'HORIZONTAL',
    itemSpacing: 36,
    paddingTop: 36,
    paddingBottom: 36,
    paddingLeft: 36,
    paddingRight: 36,
    cornerRadius: 36,
    primaryAxisSizing: 'FIXED',
    counterAxisSizing: 'HUG',
    counterAxisAlign: 'STRETCH',
    fills: [{ type: 'SOLID', color: { ...BRIEF_BG, a: 1 }, opacity: 1, visible: true }],
    effects: [
      {
        type: 'DROP_SHADOW',
        color: { ...SUB_COLOR, a: 0.1 },
        offset: { x: 0, y: 13 },
        radius: 45,
        spread: 0,
        visible: true,
        blendMode: 'NORMAL'
      }
    ],
    pluginData: [{ pluginId: BRIEF_PLUGIN_ID, key: BRIEF_ROLE_KEY, value: BRIEF_ROLE_VALUE }]
  })

  const main = graph.createNode('FRAME', brief.id, { name: '需求内容' })
  graph.updateNode(main.id, {
    layoutMode: 'VERTICAL',
    itemSpacing: 36,
    primaryAxisSizing: 'HUG',
    counterAxisSizing: 'FILL',
    layoutGrow: 1,
    fills: []
  })

  const header = graph.createNode('FRAME', main.id, { name: 'Header' })
  graph.updateNode(header.id, {
    layoutMode: 'VERTICAL',
    itemSpacing: 18,
    primaryAxisSizing: 'HUG',
    counterAxisSizing: 'FILL',
    fills: []
  })
  const titleRow = graph.createNode('FRAME', header.id, { name: 'TitleRow' })
  graph.updateNode(titleRow.id, {
    layoutMode: 'HORIZONTAL',
    itemSpacing: 18,
    counterAxisAlign: 'CENTER',
    primaryAxisSizing: 'FILL',
    counterAxisSizing: 'HUG',
    fills: []
  })
  const accentBar = graph.createNode('RECTANGLE', titleRow.id, { name: 'AccentBar' })
  graph.updateNode(accentBar.id, {
    width: 9,
    height: 49,
    cornerRadius: 4,
    fills: [{ type: 'SOLID', color: { ...ACCENT, a: 1 }, opacity: 1, visible: true }]
  })
  createText(figma, titleRow.id, 'Title', BRIEF_NAME, {
    fontSize: 44,
    fontWeight: 700,
    color: TITLE_COLOR
  })
  createText(figma, header.id, 'Subtitle', '填好后对 AI 说：按需求单做一张朋友圈广告', {
    lineHeight: 40,
    color: SUB_COLOR,
    wrap: true
  })

  const contentCard = createCard(figma, main.id, BRIEF_ZONE_USER_NAME, {
    stroke: CARD_STROKE,
    gap: 26
  })
  createLabelRow(figma, contentCard, BRIEF_ZONE_USER_NAME, '支持长文本 · 双击替换示例')
  const contentInput = createCard(figma, contentCard, 'ContentInput', {
    bg: INPUT_BG,
    stroke: INPUT_STROKE,
    rounded: 18
  })
  createText(
    figma,
    contentInput,
    'ContentExample',
    '例如：「XX奶茶」夏季新品买一送一，主推芒果冰沙，单价 9.9 元，活动时间 6 月 1 日 — 6 月 7 日。文案方向：年轻、清爽、突出「夏日解暑」的感觉。',
    { lineHeight: 44, color: EXAMPLE_COLOR, wrap: true }
  )
  createText(
    figma,
    contentCard,
    'FieldsHint',
    '需要的字段：品牌名 · 优惠活动 · 价格 · 时间 · 想要的文案',
    {
      fontSize: 24,
      color: MUTED_COLOR
    }
  )

  const materialCard = createCard(figma, main.id, BRIEF_ZONE_MATERIALS_NAME, {
    stroke: CARD_STROKE,
    gap: 26
  })
  createLabelRow(figma, materialCard, BRIEF_ZONE_MATERIALS_NAME, '在需求单面板中添加')
  const grid = graph.createNode('FRAME', materialCard, { name: 'MaterialGrid' })
  graph.updateNode(grid.id, {
    layoutMode: 'HORIZONTAL',
    layoutWrap: 'WRAP',
    itemSpacing: 26,
    counterAxisSpacing: 26,
    primaryAxisSizing: 'FILL',
    counterAxisSizing: 'HUG',
    fills: []
  })
  createText(figma, materialCard, BRIEF_EMPTY_HINT_NAME, '暂无素材 · 在需求单面板中添加', {
    fontSize: 22,
    opacity: 0.75,
    color: MUTED_COLOR
  })
  createText(
    figma,
    materialCard,
    'MaterialNote',
    '每张图可备注用途（主视觉 / 卡片配图 / 仅参考风格）',
    {
      fontSize: 24,
      color: MUTED_COLOR
    }
  )

  const aiCard = createCard(figma, brief.id, BRIEF_ZONE_AI_NAME, {
    bg: AI_ZONE_BG,
    width: 384,
    gap: 18,
    primary: 'FILL',
    counter: 'FIXED',
    justify: 'SPACE_BETWEEN'
  })
  const aiTop = graph.createNode('FRAME', aiCard, { name: 'Top' })
  graph.updateNode(aiTop.id, {
    layoutMode: 'VERTICAL',
    itemSpacing: 18,
    primaryAxisSizing: 'HUG',
    counterAxisSizing: 'FILL',
    fills: []
  })
  createText(figma, aiTop.id, 'Label', BRIEF_ZONE_AI_NAME, {
    fontSize: 24,
    fontWeight: 700,
    letterSpacing: 1.8,
    color: SUB_COLOR
  })
  createText(figma, aiTop.id, 'Hint', 'AI 确认的结论会记在这里，不用管', {
    lineHeight: 40,
    color: TITLE_COLOR,
    wrap: true
  })
  const conclusions = graph.createNode('FRAME', aiTop.id, { name: BRIEF_CONCLUSIONS_NAME })
  graph.updateNode(conclusions.id, {
    layoutMode: 'VERTICAL',
    itemSpacing: 13,
    primaryAxisSizing: 'HUG',
    counterAxisSizing: 'FILL',
    fills: []
  })
  const emptyState = graph.createNode('FRAME', aiCard, { name: BRIEF_EMPTY_STATE_NAME })
  graph.updateNode(emptyState.id, {
    layoutMode: 'VERTICAL',
    itemSpacing: 18,
    counterAxisAlign: 'CENTER',
    primaryAxisSizing: 'HUG',
    counterAxisSizing: 'FILL',
    fills: []
  })
  const divider = graph.createNode('RECTANGLE', emptyState.id, { name: 'Divider' })
  graph.updateNode(divider.id, {
    width: 107,
    height: 2,
    opacity: 0.4,
    fills: [{ type: 'SOLID', color: { ...ACCENT, a: 1 }, opacity: 1, visible: true }]
  })
  createText(figma, emptyState.id, 'Status', '（尚无结论）', {
    fontSize: 22,
    opacity: 0.75,
    color: SUB_COLOR
  })

  return brief
}

/** Append one confirmed conclusion line into the brief's AI zone */
export function appendToBriefAiZone(figma: FigmaAPI, briefId: string, text: string): boolean {
  const graph = figma.graph
  const brief = graph.getNode(briefId)
  if (!isBrief(brief)) return false
  const aiCardId = brief.childIds.find((id) => graph.getNode(id)?.name === BRIEF_ZONE_AI_NAME)
  if (!aiCardId) return false

  const findChild = (parentId: string, name: string) =>
    graph.getNode(parentId)?.childIds.find((id) => graph.getNode(id)?.name === name)
  const topId = findChild(aiCardId, 'Top')
  const conclusionsId = topId ? findChild(topId, BRIEF_CONCLUSIONS_NAME) : undefined
  if (!conclusionsId) return false

  createText(figma, conclusionsId, '结论', `· ${text}`, {
    fontSize: 24,
    color: TITLE_COLOR,
    wrap: true
  })
  const emptyStateId = findChild(aiCardId, BRIEF_EMPTY_STATE_NAME)
  if (emptyStateId) graph.updateNode(emptyStateId, { visible: false })
  return true
}

/**
 * Add a real material entry (image + caption) to the brief's MaterialGrid.
 * Implemented here (not in brief-edit.ts) to reuse the internal createSlot
 * without exporting it. When a legacy document still has 添加位 hint slots,
 * the new entry is inserted before the first one; otherwise it is appended.
 * Also hides the material zone's EmptyHint row. Accepts raw bytes
 * (figma.createImage) or an already-registered image hash.
 */
export function addBriefMaterialEntry(
  figma: FigmaAPI,
  briefId: string,
  image: Uint8Array | { hash: string },
  caption: string
): { entryId: string } | { error: string } {
  const graph = figma.graph
  const brief = graph.getNode(briefId)
  if (!isBrief(brief)) return { error: 'Brief not found' }
  const mainId = brief.childIds.find((id) => graph.getNode(id)?.name === '需求内容')
  const materialCardId = mainId
    ? graph
        .getNode(mainId)
        ?.childIds.find((id) => graph.getNode(id)?.name === BRIEF_ZONE_MATERIALS_NAME)
    : undefined
  const gridId = materialCardId
    ? graph
        .getNode(materialCardId)
        ?.childIds.find((id) => graph.getNode(id)?.name === 'MaterialGrid')
    : undefined
  if (!gridId) return { error: 'Brief material grid not found' }

  // Legacy briefs predate the wrapped grid — upgrade on first entry add so
  // entries wrap instead of squeezing into one row.
  const grid = graph.getNode(gridId)
  if (grid && grid.layoutWrap !== 'WRAP') {
    graph.updateNode(gridId, { layoutWrap: 'WRAP', counterAxisSpacing: grid.itemSpacing })
  }

  const hash = image instanceof Uint8Array ? figma.createImage(image).hash : image.hash
  const entryId = createSlot(figma, gridId, BRIEF_ENTRY_NAME, caption)

  const addSlotIndex =
    graph
      .getNode(gridId)
      ?.childIds.findIndex((id) => graph.getNode(id)?.name === BRIEF_ADD_SLOT_NAME) ?? -1
  if (addSlotIndex >= 0) graph.insertChildAt(entryId, gridId, addSlotIndex)

  const emptyHintId = materialCardId
    ? graph
        .getNode(materialCardId)
        ?.childIds.find((id) => graph.getNode(id)?.name === BRIEF_EMPTY_HINT_NAME)
    : undefined
  if (emptyHintId) graph.updateNode(emptyHintId, { visible: false })

  const imageId = graph
    .getNode(entryId)
    ?.childIds.find((id) => graph.getNode(id)?.name === '图片位')
  if (!imageId) return { error: 'Brief entry image slot missing' }
  const imageFill: Fill = {
    type: 'IMAGE',
    imageHash: hash,
    imageScaleMode: 'FILL',
    color: TRANSPARENT,
    opacity: 1,
    visible: true
  }
  graph.updateNode(imageId, { fills: [imageFill] })
  return { entryId }
}

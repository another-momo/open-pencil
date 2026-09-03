import type { Canvas, CanvasKit, Font, Paint, Typeface } from 'canvaskit-wasm'

import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'

import type { SkiaRenderer } from '#core/canvas/renderer'
import {
  COMPONENT_LABEL_FONT_SIZE,
  DEFAULT_FONT_FAMILY,
  DEFAULT_FONT_SIZE,
  LABEL_FONT_SIZE,
  SECTION_TITLE_FONT_SIZE,
  SIZE_FONT_SIZE
} from '#core/constants'
import { fontFallbackScriptForCharacter } from '#core/text/coverage'
import { fontManager } from '#core/text/fonts'
import { collectGraphFontRequirements } from '#core/text/requirements'
import { missingGraphFontScripts } from '#core/text/resolved-requirements'
import type { FontResolutionSnapshot } from '#core/text/resolver'

/** T88：直画字体用途——决定 pickFontForText 取哪一档 size。 */
export type LabelKind = 'text' | 'label' | 'size' | 'sectionTitle' | 'componentLabel'

const LABEL_KIND_FONT_SIZE: Record<LabelKind, number> = {
  text: DEFAULT_FONT_SIZE,
  label: LABEL_FONT_SIZE,
  size: SIZE_FONT_SIZE,
  sectionTitle: SECTION_TITLE_FONT_SIZE,
  componentLabel: COMPONENT_LABEL_FONT_SIZE
}

/** bundled CJK / Arabic 家族名（T88）：直画路径 fallback typeface 来源 */
const CJK_FALLBACK_FAMILY = 'Alibaba PuHuiTi'
const ARABIC_FALLBACK_FAMILY = 'Noto Naskh Arabic'

export function syncFontGeneration(r: SkiaRenderer): void {
  r.fontGeneration = fontManager.generation()
}

export function trackFontDemand(r: SkiaRenderer, node: SceneNode, key: string): void {
  const pending = r.pendingFontNodes.get(node.id) ?? { node, keys: new Set<string>() }
  pending.node = node
  pending.keys.add(key)
  r.pendingFontNodes.set(node.id, pending)
}

interface TextPictureGenerationState {
  fontGeneration: number
  textPictureGenerations: Map<string, { data: Uint8Array; generation: number }>
}

export function isTextPictureCurrent(r: TextPictureGenerationState, node: SceneNode): boolean {
  const data = node.textPicture
  if (!data) {
    r.textPictureGenerations.delete(node.id)
    return false
  }
  const cached = r.textPictureGenerations.get(node.id)
  if (!cached || cached.data !== data) {
    r.textPictureGenerations.set(node.id, { data, generation: r.fontGeneration })
    return true
  }
  return cached.generation === r.fontGeneration
}

function settleFontDemand(
  r: SkiaRenderer,
  snapshot: FontResolutionSnapshot,
  nodeIds: readonly string[]
): void {
  syncFontGeneration(r)
  for (const nodeId of nodeIds) {
    const pending = r.pendingFontNodes.get(nodeId)
    if (pending) {
      pending.node.textPicture = null
      pending.keys.delete(snapshot.key)
      if (pending.keys.size === 0) r.pendingFontNodes.delete(nodeId)
    }
    r.textPictureGenerations.delete(nodeId)
    r.invalidateNodePicture(nodeId)
  }
}

export function getFontProvider(r: SkiaRenderer) {
  return r.isDestroyed() || !r.fontProvider ? null : r.fontProvider
}

interface ScriptFontEntry {
  family: string
  typeface: Typeface | null
  fonts: Partial<Record<LabelKind, Font | null>>
}

function makeScriptFonts(ck: CanvasKit, typeface: Typeface | null): ScriptFontEntry['fonts'] {
  if (!typeface) {
    return {
      text: null,
      label: null,
      size: null,
      sectionTitle: null,
      componentLabel: null
    }
  }
  return {
    text: new ck.Font(typeface, LABEL_KIND_FONT_SIZE.text),
    label: new ck.Font(typeface, LABEL_KIND_FONT_SIZE.label),
    size: new ck.Font(typeface, LABEL_KIND_FONT_SIZE.size),
    sectionTitle: new ck.Font(typeface, LABEL_KIND_FONT_SIZE.sectionTitle),
    componentLabel: new ck.Font(typeface, LABEL_KIND_FONT_SIZE.componentLabel)
  }
}

/** T88：把 makeScriptFonts 出的 5 个 Font 实例写进 r 的对应字段 */
function assignScriptFonts(
  r: SkiaRenderer,
  typeface: Typeface | null,
  script: 'latin' | 'cjk' | 'arabic'
): void {
  const fonts = makeScriptFonts(r.ck, typeface)
  const target = scriptFontTarget(r, script)
  for (const kind of ['text', 'label', 'size', 'sectionTitle', 'componentLabel'] as const) {
    target[kind] = fonts[kind] ?? null
  }
}

interface ScriptFontTarget {
  text: Font | null
  label: Font | null
  size: Font | null
  sectionTitle: Font | null
  componentLabel: Font | null
}

function scriptFontTarget(r: SkiaRenderer, script: 'latin' | 'cjk' | 'arabic'): ScriptFontTarget {
  if (script === 'latin') {
    return {
      text: r.textFont,
      label: r.labelFont,
      size: r.sizeFont,
      sectionTitle: r.sectionTitleFont,
      componentLabel: r.componentLabelFont
    }
  }
  if (script === 'cjk') {
    return {
      text: r.cjkTextFont,
      label: r.cjkLabelFont,
      size: r.cjkSizeFont,
      sectionTitle: r.cjkSectionTitleFont,
      componentLabel: r.cjkComponentLabelFont
    }
  }
  return {
    text: r.arabicTextFont,
    label: r.arabicLabelFont,
    size: r.arabicSizeFont,
    sectionTitle: r.arabicSectionTitleFont,
    componentLabel: r.arabicComponentLabelFont
  }
}

/** T88：清理 r 上的 15 个 Font 实例（5 latin + 5 cjk + 5 arabic） */
function disposeAllFontInstances(r: SkiaRenderer): void {
  const all: Array<Font | null> = [
    r.textFont,
    r.labelFont,
    r.sizeFont,
    r.sectionTitleFont,
    r.componentLabelFont,
    r.cjkTextFont,
    r.cjkLabelFont,
    r.cjkSizeFont,
    r.cjkSectionTitleFont,
    r.cjkComponentLabelFont,
    r.arabicTextFont,
    r.arabicLabelFont,
    r.arabicSizeFont,
    r.arabicSectionTitleFont,
    r.arabicComponentLabelFont
  ]
  for (const font of all) font?.delete()
}

/**
 * T88：按字符 script 选直画 Font 实例。
 * - 空字符串 / 拉丁 / 数字 → 走 latinFont（Inter typeface，永不为 null，loadFonts 阶段已构造）
 * - CJK（含 cjk-sc/cjk-tc/cjk-jp/cjk-kr）→ 走 cjkFont（PuHuiTi typeface，null 时降级 latin）
 * - Arabic → 走 arabicFont（Noto Naskh Arabic typeface，null 时降级 latin）
 *
 * fail-safe：缺失 fallback typeface 时统一降级到 latin，不抛、不返 null。
 */
export function pickFontForText(r: SkiaRenderer, text: string, kind: LabelKind): Font | null {
  if (!text) return fontForKind(r, 'latin', kind)
  const firstChar = text[0]
  if (!firstChar) return fontForKind(r, 'latin', kind)
  const script = fontFallbackScriptForCharacter(firstChar, null)
  if (script?.startsWith('cjk')) return fontForKind(r, 'cjk', kind) ?? fontForKind(r, 'latin', kind)
  if (script === 'arabic') return fontForKind(r, 'arabic', kind) ?? fontForKind(r, 'latin', kind)
  return fontForKind(r, 'latin', kind)
}

function fontForKind(
  r: SkiaRenderer,
  script: 'latin' | 'cjk' | 'arabic',
  kind: LabelKind
): Font | null {
  if (script === 'latin') {
    switch (kind) {
      case 'text':
        return r.textFont
      case 'label':
        return r.labelFont
      case 'size':
        return r.sizeFont
      case 'sectionTitle':
        return r.sectionTitleFont
      case 'componentLabel':
        return r.componentLabelFont
    }
  }
  if (script === 'cjk') {
    switch (kind) {
      case 'text':
        return r.cjkTextFont
      case 'label':
        return r.cjkLabelFont
      case 'size':
        return r.cjkSizeFont
      case 'sectionTitle':
        return r.cjkSectionTitleFont
      case 'componentLabel':
        return r.cjkComponentLabelFont
    }
  }
  switch (kind) {
    case 'text':
      return r.arabicTextFont
    case 'label':
      return r.arabicLabelFont
    case 'size':
      return r.arabicSizeFont
    case 'sectionTitle':
      return r.arabicSectionTitleFont
    case 'componentLabel':
      return r.arabicComponentLabelFont
  }
  return null
}

/**
 * T88：按字符 script 分段画——直画路径的 fallback 出口。
 * - 按 `fontFallbackScriptForCharacter` 把 text 切成多段，每段内部相邻同 script 合并
 * - 每段用对应 typeface 的 Font 实例调 getGlyphIDs/getGlyphWidths/drawText
 * - 累加 advanceX 返回
 * - 三个 font 任一为 null 时该 script 段降级 latin font（永不抛）
 */
export function drawTextByScript(
  r: SkiaRenderer,
  canvas: Canvas,
  paint: Paint,
  text: string,
  x: number,
  y: number,
  kind: LabelKind
): { advanceX: number } {
  if (!text) return { advanceX: 0 }
  const latinFont = fontForKind(r, 'latin', kind)
  if (!latinFont) return { advanceX: 0 }

  const segments = segmentByScript(text)
  let cursorX = x
  for (const segment of segments) {
    const font = pickSegmentFont(r, segment.script, kind, latinFont)
    const glyphIds = font.getGlyphIDs(segment.text)
    const widths = font.getGlyphWidths(glyphIds)
    let segW = 0
    for (const w of widths) segW += w
    canvas.drawText(segment.text, cursorX, y, paint, font)
    cursorX += segW
  }
  return { advanceX: cursorX - x }
}

/**
 * T88：测宽度（hit-test / ellipsize 用），返回按 script 分段后总宽。
 * 与 drawTextByScript 复用分段逻辑，零 glyph 渲染开销。
 */
export function measureTextByScript(
  r: SkiaRenderer,
  text: string,
  kind: LabelKind
): { width: number; glyphCount: number } {
  if (!text) return { width: 0, glyphCount: 0 }
  const latinFont = fontForKind(r, 'latin', kind)
  if (!latinFont) return { width: 0, glyphCount: 0 }

  const segments = segmentByScript(text)
  let width = 0
  let glyphCount = 0
  for (const segment of segments) {
    const font = pickSegmentFont(r, segment.script, kind, latinFont)
    const glyphIds = font.getGlyphIDs(segment.text)
    const widths = font.getGlyphWidths(glyphIds)
    for (const w of widths) width += w
    glyphCount += glyphIds.length
  }
  return { width, glyphCount }
}

interface ScriptSegment {
  text: string
  script: 'latin' | 'cjk' | 'arabic'
}

function segmentByScript(text: string): ScriptSegment[] {
  const segments: ScriptSegment[] = []
  let buf = ''
  let curScript: 'latin' | 'cjk' | 'arabic' | null = null
  // 按 code point 遍历（保护 surrogate pair），不按 UTF-16 code unit
  for (const ch of text) {
    const s = charToScript(ch)
    if (s !== curScript) {
      if (buf) segments.push({ text: buf, script: curScript ?? 'latin' })
      buf = ch
      curScript = s
    } else {
      buf += ch
    }
  }
  if (buf) segments.push({ text: buf, script: curScript ?? 'latin' })
  return segments
}

function charToScript(ch: string): 'latin' | 'cjk' | 'arabic' {
  const script = fontFallbackScriptForCharacter(ch, null)
  if (script === 'arabic') return 'arabic'
  if (script?.startsWith('cjk')) return 'cjk'
  return 'latin'
}

function pickSegmentFont(
  r: SkiaRenderer,
  script: 'latin' | 'cjk' | 'arabic',
  kind: LabelKind,
  latinFallback: Font
): Font {
  const candidate = fontForKind(r, script, kind)
  return candidate ?? latinFallback
}

export async function loadFonts(
  r: SkiaRenderer,
  onFallbackFontsLoaded?: () => void
): Promise<void> {
  if (r.isDestroyed()) return
  r.onFontResolutionSettled = (snapshot, nodeIds) => {
    if (r.isDestroyed()) return
    settleFontDemand(r, snapshot, nodeIds)
    onFallbackFontsLoaded?.()
  }
  r.fontProvider?.delete()
  r.fontProvider = r.ck.TypefaceFontProvider.Make()

  fontManager.attachProvider(r.ck, r.fontProvider)
  syncFontGeneration(r)

  // T88：并行加载三 typeface（Inter / PuHuiTi / Noto Naskh Arabic）。
  // 任一失败时对应字段留 null，pickFontForText 自动降级到 latin。
  const [latinData, cjkData, arabicData] = await Promise.all([
    fontManager.loadFont(DEFAULT_FONT_FAMILY, 'Regular'),
    fontManager.loadFont(CJK_FALLBACK_FAMILY, 'Regular'),
    fontManager.loadFont(ARABIC_FALLBACK_FAMILY, 'Regular')
  ])
  if (r.isDestroyed()) return

  const latinTypeface = latinData ? r.ck.Typeface.MakeFreeTypeFaceFromData(latinData) : null
  const cjkTypeface = cjkData ? r.ck.Typeface.MakeFreeTypeFaceFromData(cjkData) : null
  const arabicTypeface = arabicData ? r.ck.Typeface.MakeFreeTypeFaceFromData(arabicData) : null

  // 清理旧实例
  disposeAllFontInstances(r)

  // Latin 构造（Inter）
  assignScriptFonts(r, latinTypeface, 'latin')
  // CJK 构造（PuHuiTi；typeface 失败时字段保持 null → pickFontForText 降级）
  assignScriptFonts(r, cjkTypeface, 'cjk')
  // Arabic 构造（Noto Naskh Arabic）
  assignScriptFonts(r, arabicTypeface, 'arabic')

  if (latinTypeface) {
    r.profiler.setTypeface(latinTypeface)
  }
  if (latinData) {
    r.fontMgr = r.ck.FontMgr.FromData(latinData) ?? null
  }

  r.fontsLoaded = true
  syncFontGeneration(r)
  r.invalidateAllPictures()
}

export async function prepareForExport(
  r: SkiaRenderer,
  graph: SceneGraph,
  pageId: string,
  nodeIds: string[]
): Promise<() => void> {
  const { getTextMeasurer, setTextMeasurer, computeAllLayouts } = await import('#core/layout')

  const previousTextMeasurer = getTextMeasurer()
  setTextMeasurer((node, maxWidth) => r.measureTextNode(node, maxWidth))

  const fontKeys = fontManager.collectFontKeys(graph, nodeIds)
  const requirements = collectGraphFontRequirements(graph, nodeIds)
  await Promise.all(
    fontKeys.map(([family, style]) => fontManager.loadFont(family, style, requirements.characters))
  )
  await fontManager.ensureFallbackPack(
    missingGraphFontScripts(requirements),
    requirements.characters
  )
  syncFontGeneration(r)
  computeAllLayouts(graph, pageId)

  return () => setTextMeasurer(previousTextMeasurer)
}

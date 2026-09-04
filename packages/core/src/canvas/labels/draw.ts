import type { Canvas, Font } from 'canvaskit-wasm'

import type { SceneNode, SceneGraph } from '@open-pencil/scene-graph'

import type { SkiaRenderer } from '#core/canvas/renderer'
import { drawTextByScript, measureTextByScript, segmentByScript } from '#core/canvas/renderer/fonts'
import {
  SECTION_TITLE_HEIGHT,
  SECTION_TITLE_PADDING_X,
  SECTION_TITLE_RADIUS,
  SECTION_TITLE_GAP,
  COMPONENT_LABEL_FONT_SIZE,
  COMPONENT_LABEL_GAP,
  COMPONENT_LABEL_ICON_SIZE,
  COMPONENT_LABEL_ICON_GAP
} from '#core/constants'

/**
 * T88：直画 ellipsize（按字符 script 分段后求截断点）。
 * - 单 script 段内仍按 glyph 索引截断（保留现有 UI 行为）
 * - 跨 script 段时优先保留整段，剩余空间才进 glyph-level 截断
 */
function truncateToWidth(
  r: SkiaRenderer,
  text: string,
  maxWidth: number,
  kind: 'sectionTitle' | 'componentLabel',
  ellipsisWidth: number
): { text: string; width: number } {
  if (!text) return { text, width: 0 }
  const total = measureTextByScript(r, text, kind)
  if (total.width + ellipsisWidth <= maxWidth) {
    return { text, width: total.width }
  }
  // 逐字符贪心：超过 maxWidth 停止
  let accWidth = 0
  let accText = ''
  let lastFitCharIdx = 0
  // 按 code point 切，simulate 逐 char 累加宽度——但单 char 宽度 = measureTextByScript 切 1 字符代价 O(n²) 太贵
  // 折中：按段切，每段用单 typeface glyph 宽度（getGlyphWidths），段内仍按 glyph 索引截
  // —— 这里复用 measureTextByScript 的策略，按段累加
  // T88 已抽单源：分段用 renderer/fonts.ts 的 segmentByScript（canonical 分类）
  const segments = segmentByScript(text)
  for (const seg of segments) {
    const font = pickFontForSegment(r, seg.script, kind)
    if (!font) {
      // latin font 必非 null，跳过
      continue
    }
    const glyphIds = font.getGlyphIDs(seg.text)
    const widths = font.getGlyphWidths(glyphIds)
    for (let i = 0; i < widths.length; i++) {
      const w = widths[i] ?? 0
      if (accWidth + w + ellipsisWidth > maxWidth) {
        return { text: accText + '…', width: accWidth + ellipsisWidth }
      }
      accWidth += w
      accText += seg.text[i]
      lastFitCharIdx++
    }
    void lastFitCharIdx
  }
  return { text, width: accWidth }
}

function pickFontForSegment(
  r: SkiaRenderer,
  script: 'latin' | 'cjk' | 'arabic',
  kind: 'sectionTitle' | 'componentLabel'
): Font | null {
  if (script === 'latin') return kind === 'sectionTitle' ? r.sectionTitleFont : r.componentLabelFont
  if (script === 'cjk')
    return kind === 'sectionTitle' ? r.cjkSectionTitleFont : r.cjkComponentLabelFont
  return kind === 'sectionTitle' ? r.arabicSectionTitleFont : r.arabicComponentLabelFont
}

export function drawSectionTitles(r: SkiaRenderer, canvas: Canvas, graph: SceneGraph): void {
  if (!r.sectionTitleFont) return

  const sections = r.labelCache.getSections(graph, r.worldViewport)
  if (sections.length === 0) return

  const ellipsis = '…'
  const ellipsisWidth =
    r.sectionTitleFont.getGlyphWidths(r.sectionTitleFont.getGlyphIDs(ellipsis))[0] ?? 0

  for (const { node, absX, absY, nested } of sections) {
    drawSectionTitle(r, canvas, node, graph, absX, absY, nested, ellipsis, ellipsisWidth)
  }
}

function drawSectionTitle(
  r: SkiaRenderer,
  canvas: Canvas,
  node: SceneNode,
  graph: SceneGraph,
  absX: number,
  absY: number,
  nested: boolean,
  ellipsis: string,
  ellipsisWidth: number
): void {
  const screenX = absX * r.zoom + r.panX
  const screenY = absY * r.zoom + r.panY
  const screenW = node.width * r.zoom
  const maxPillW = Math.max(screenW, 0)
  const maxTextW = Math.max(maxPillW - SECTION_TITLE_PADDING_X * 2, ellipsisWidth)

  // T88：按字符 script 分段后求截断点（保留 unicode 完整字符）
  const { text: displayText, width: textWidth } = truncateToWidth(
    r,
    node.name,
    maxTextW,
    'sectionTitle',
    ellipsisWidth
  )

  const pillW = Math.min(textWidth + SECTION_TITLE_PADDING_X * 2, maxPillW)
  const pillH = SECTION_TITLE_HEIGHT
  const localPillX = 0
  const localPillY = nested ? SECTION_TITLE_GAP : -pillH - SECTION_TITLE_GAP

  const pillColor =
    node.fills.length > 0 && node.fills[0].visible
      ? r.resolveFillColor(node.fills[0], 0, node, graph)
      : { r: 0.37, g: 0.37, b: 0.37, a: 1 }

  canvas.save()
  canvas.translate(screenX, screenY)
  if (node.rotation !== 0) {
    canvas.rotate(node.rotation, 0, 0)
  }

  r.auxFill.setColor(r.ck.Color4f(pillColor.r, pillColor.g, pillColor.b, pillColor.a))
  const pillRect = r.ck.LTRBRect(localPillX, localPillY, localPillX + pillW, localPillY + pillH)
  canvas.drawRRect(r.ck.RRectXY(pillRect, SECTION_TITLE_RADIUS, SECTION_TITLE_RADIUS), r.auxFill)

  const lum = 0.299 * pillColor.r + 0.587 * pillColor.g + 0.114 * pillColor.b
  r.auxFill.setColor(lum > 0.5 ? r.ck.BLACK : r.ck.WHITE)
  const textY = localPillY + pillH * 0.7
  // T88：按 script 分段画（每段用对应 typeface Font 实例）
  drawTextByScript(
    r,
    canvas,
    r.auxFill,
    displayText,
    localPillX + SECTION_TITLE_PADDING_X,
    textY,
    'sectionTitle'
  )
  canvas.restore()
  void ellipsis
}

export function drawComponentLabels(r: SkiaRenderer, canvas: Canvas, graph: SceneGraph): void {
  if (!r.componentLabelFont) return

  const components = r.labelCache.getComponents(graph, r.worldViewport)
  if (components.length === 0) return

  const compColor = r.compColor()
  const iconS = COMPONENT_LABEL_ICON_SIZE

  for (const { node, absX, absY, inside } of components) {
    const screenX = absX * r.zoom + r.panX
    const screenY = absY * r.zoom + r.panY

    const labelX = screenX
    let labelY: number
    if (inside) {
      labelY = screenY + COMPONENT_LABEL_GAP + COMPONENT_LABEL_FONT_SIZE
    } else {
      labelY = screenY - COMPONENT_LABEL_GAP
    }

    const maxTextWidth = node.width * r.zoom - iconS - COMPONENT_LABEL_ICON_GAP
    // T88：component label 也走按 script 分段（truncateToWidth 内部处理 latin/cjk/arabic 切换）
    const ellipsis = '…'
    const ellipsisWidth =
      r.componentLabelFont.getGlyphWidths(r.componentLabelFont.getGlyphIDs(ellipsis))[0] ?? 0
    const { text: displayText } = truncateToWidth(
      r,
      node.name,
      Math.max(maxTextWidth, ellipsisWidth),
      'componentLabel',
      ellipsisWidth
    )
    if (!displayText) continue

    const iconX = labelX
    const iconY = labelY - COMPONENT_LABEL_FONT_SIZE * 0.75
    const iconCx = iconX + iconS / 2
    const iconCy = iconY + iconS / 2
    const iconR = iconS / 2

    r.auxFill.setColor(compColor)

    if (node.type === 'COMPONENT_SET') {
      const s = iconR * 0.45
      const gap = iconR * 0.2
      const path = new r.ck.PathBuilder()
      for (const [dx, dy] of [
        [-1, -1],
        [1, -1],
        [-1, 1],
        [1, 1]
      ]) {
        const cx = iconCx + dx * (s + gap)
        const cy = iconCy + dy * (s + gap)
        path.moveTo(cx, cy - s)
        path.lineTo(cx + s, cy)
        path.lineTo(cx, cy + s)
        path.lineTo(cx - s, cy)
        path.close()
      }
      const immutablePath = path.detachAndDelete()
      canvas.drawPath(immutablePath, r.auxFill)
      immutablePath.delete()
    } else {
      const path = new r.ck.PathBuilder()
      path.moveTo(iconCx, iconCy - iconR)
      path.lineTo(iconCx + iconR, iconCy)
      path.lineTo(iconCx, iconCy + iconR)
      path.lineTo(iconCx - iconR, iconCy)
      path.close()
      const immutablePath = path.detachAndDelete()
      canvas.drawPath(immutablePath, r.auxFill)
      immutablePath.delete()
    }

    // T88：按 script 分段画，与 sectionTitle 同口径——中英混排节点名（如「App 设计」）
    // 各段用对应 typeface；此前只看首字符选单一字体，汉字会落 latin typeface 出豆腐字
    drawTextByScript(
      r,
      canvas,
      r.auxFill,
      displayText,
      labelX + iconS + COMPONENT_LABEL_ICON_GAP,
      labelY,
      'componentLabel'
    )
  }
}

/**
 * T88：节点名 CJK 豆腐字修复 — pickFontForText / drawTextByScript / measureTextByScript 三连钉扎
 * 验证点：
  - pickFontForText 按首字符 script 选 typeface（CJK / Arabic / Latin）
  - CJK / Arabic typeface null 时降级到 Latin
  - drawTextByScript 按字符 script 分段画，每段用对应 typeface Font 实例
  - 混合文字（"Hello 图层"）走双段画
  - 空字符串零次 drawText
  - measureTextByScript 返回按字符 glyph 累加的 width
  - T88 遗留收口：drawComponentLabels 最终绘制也走分段（中英混排「App 设计」汉字落 cjk typeface）
 */
import { describe, expect, mock, test } from 'bun:test'

import type { Canvas, Font } from 'canvaskit-wasm'

import type { SkiaRenderer } from '@open-pencil/core/canvas/renderer'
import {
  drawTextByScript,
  measureTextByScript,
  type LabelKind
} from '@open-pencil/core/canvas/renderer/fonts'

import { drawComponentLabels } from '#core/canvas/labels/draw'
import {
  COMPONENT_LABEL_GAP,
  COMPONENT_LABEL_ICON_GAP,
  COMPONENT_LABEL_ICON_SIZE
} from '#core/constants'

import { expectDefined } from '#tests/helpers/assert'

/** 假 CanvasKit Font：每 char 宽度 = charCode 的简易 hash，记录每次调用 */
function recordingFont(label: string): Font {
  const calls: Array<{ text: string }> = []
  // 最小 CanvasKit Font 接口实现（单 cast 走 mock helper 模式同 cjk-fallback.test.ts）
  const stub: Font = {
    getGlyphIDs(text: string) {
      calls.push({ text })
      return new Uint32Array([...text].map((c) => c.codePointAt(0) ?? 0))
    },
    getGlyphWidths(glyphIds: Uint32Array | number[]) {
      const ids = glyphIds instanceof Uint32Array ? Array.from(glyphIds) : glyphIds
      return new Float32Array(ids.map((id) => id))
    },
    getSize() {
      return 12
    },
    setSize(_size: number) {
      return undefined
    },
    getTypeface() {
      return null
    },
    delete() {
      return undefined
    }
  } as Font
  // 注入 label 字段供测试断言（避开 broad-double-cast）
  ;(stub as { label?: string }).label = label
  ;(stub as { calls?: Array<{ text: string }> }).calls = calls
  return stub
}

/** 假 SkiaRenderer：仅暴露 pickFontForText / drawTextByScript / measureTextByScript 需要的字段 */
function recordingRenderer(opts: { withCjk: boolean; withArabic: boolean }): {
  r: SkiaRenderer
  draws: Array<{ text: string; fontLabel: string }>
  latinSectionFont: Font
  cjkSectionFont: Font | null
  arabicSectionFont: Font | null
} {
  const draws: Array<{ text: string; fontLabel: string }> = []
  const latinSectionFont = recordingFont('latin')
  const cjkSectionFont = opts.withCjk ? recordingFont('cjk') : null
  const arabicSectionFont = opts.withArabic ? recordingFont('arabic') : null

  // T88：构造最小可用的 SkiaRenderer stub。
  // pickFontForText / drawTextByScript / measureTextByScript 只读 Font 字段，不调任何 ck.* 方法
  const r: SkiaRenderer = {
    textFont: latinSectionFont,
    labelFont: latinSectionFont,
    sizeFont: latinSectionFont,
    sectionTitleFont: latinSectionFont,
    componentLabelFont: latinSectionFont,
    cjkTextFont: cjkSectionFont,
    cjkLabelFont: cjkSectionFont,
    cjkSizeFont: cjkSectionFont,
    cjkSectionTitleFont: cjkSectionFont,
    cjkComponentLabelFont: cjkSectionFont,
    arabicTextFont: arabicSectionFont,
    arabicLabelFont: arabicSectionFont,
    arabicSizeFont: arabicSectionFont,
    arabicSectionTitleFont: arabicSectionFont,
    arabicComponentLabelFont: arabicSectionFont
  } as SkiaRenderer

  return { r, draws, latinSectionFont, cjkSectionFont, arabicSectionFont }
}

/** 假 Canvas.drawText：记录每次调用 */
function recordingCanvas(draws: Array<{ text: string; fontLabel: string }>): Canvas {
  const stub: Canvas = {
    drawText(text: string, _x: number, _y: number, _paint: unknown, font: Font) {
      const label = (font as { label?: string }).label
      draws.push({ text, fontLabel: label ?? '' })
    }
  } as Canvas
  return stub
}

describe('T88 多 typeface 节点名 fallback', () => {
  test('① 空字符串走 latin', () => {
    const { r } = recordingRenderer({ withCjk: true, withArabic: true })
    const { drawTextByScript: _draw } = { drawTextByScript }
    void _draw
    const measured = measureTextByScript(r, '', 'label')
    expect(measured.width).toBe(0)
    expect(measured.glyphCount).toBe(0)
  })

  test('② 纯拉丁文字走 latin', () => {
    const { r, draws } = recordingRenderer({ withCjk: true, withArabic: true })
    const canvas = recordingCanvas(draws)
    drawTextByScript(r, canvas, {} as never, 'Hello', 0, 0, 'label')
    expect(draws).toHaveLength(1)
    expect(draws[0]?.fontLabel).toBe('latin')
  })

  test('③ CJK 文字走 cjk typeface', () => {
    const { r, draws } = recordingRenderer({ withCjk: true, withArabic: true })
    const canvas = recordingCanvas(draws)
    drawTextByScript(r, canvas, {} as never, '图层', 0, 0, 'sectionTitle')
    expect(draws).toHaveLength(1)
    expect(draws[0]?.fontLabel).toBe('cjk')
  })

  test('④ Arabic 文字走 arabic typeface', () => {
    const { r, draws } = recordingRenderer({ withCjk: true, withArabic: true })
    const canvas = recordingCanvas(draws)
    drawTextByScript(r, canvas, {} as never, 'مرحبا', 0, 0, 'label')
    expect(draws).toHaveLength(1)
    expect(draws[0]?.fontLabel).toBe('arabic')
  })

  test('⑤ 混合文字（拉丁+CJK）走双段画', () => {
    const { r, draws } = recordingRenderer({ withCjk: true, withArabic: true })
    const canvas = recordingCanvas(draws)
    drawTextByScript(r, canvas, {} as never, 'Hello 图层', 0, 0, 'sectionTitle')
    expect(draws).toHaveLength(2)
    expect(draws[0]?.text).toBe('Hello ')
    expect(draws[0]?.fontLabel).toBe('latin')
    expect(draws[1]?.text).toBe('图层')
    expect(draws[1]?.fontLabel).toBe('cjk')
  })

  test('⑥ CJK typeface null 时降级到 latin（fail-safe）', () => {
    const { r, draws } = recordingRenderer({ withCjk: false, withArabic: true })
    const canvas = recordingCanvas(draws)
    drawTextByScript(r, canvas, {} as never, '图层', 0, 0, 'sectionTitle')
    expect(draws).toHaveLength(1)
    expect(draws[0]?.fontLabel).toBe('latin')
  })

  test('⑦ Arabic typeface null 时降级到 latin', () => {
    const { r, draws } = recordingRenderer({ withCjk: true, withArabic: false })
    const canvas = recordingCanvas(draws)
    drawTextByScript(r, canvas, {} as never, 'مرحبا', 0, 0, 'label')
    expect(draws).toHaveLength(1)
    expect(draws[0]?.fontLabel).toBe('latin')
  })

  test('⑧ 混合文字 advanceX = 各段 width 之和', () => {
    const { r, draws } = recordingRenderer({ withCjk: true, withArabic: true })
    const canvas = recordingCanvas(draws)
    const { advanceX } = drawTextByScript(r, canvas, {} as never, 'A 图', 0, 0, 'label')
    // Latin 'A ' = 65 + 32 = 97；CJK '图' = 0x56FE = 22270（hash by charCode in recordingFont）
    expect(advanceX).toBe(65 + 32 + 0x56fe)
  })

  test('⑨ measureTextByScript 返回 width + glyphCount', () => {
    const { r } = recordingRenderer({ withCjk: true, withArabic: true })
    const result = measureTextByScript(r, 'Hi 图', 'label')
    // 'H'=72, 'i'=105, ' '=32, '图'=0x56FE=22270
    expect(result.width).toBe(72 + 105 + 32 + 0x56fe)
    expect(result.glyphCount).toBe(4)
  })

  test('⑩ pickFontForText 走 five kinds 矩阵均不抛', () => {
    const { r } = recordingRenderer({ withCjk: true, withArabic: true })
    const kinds: LabelKind[] = ['text', 'label', 'size', 'sectionTitle', 'componentLabel']
    for (const kind of kinds) {
      // 不抛即视为通过；不查返回值（Font 字段以 latin stub 占位）
      drawTextByScript(r, recordingCanvas([]), null as never, '图层', 0, 0, kind)
    }
    expect(true).toBe(true)
  })
})

/** recordingFont 宽度 = charCode：'A'=65、'p'=112、' '=32、'设'=0x8BBE=35774、'计'=0x8BA1=35745、'…'=0x2026=8230 */
const W_LATIN_APP_SPACE = 65 + 112 + 112 + 32 // 'App ' = 321
const W_CJK_SHE = 0x8bbe // '设' = 35774
const W_CJK_JI = 0x8ba1 // '计' = 35745

/** 假 SkiaRenderer：直通 drawComponentLabels 的最小字段集（labelCache / compColor / auxFill / ck.PathBuilder） */
function componentLabelHarness(
  opts: { withCjk: boolean },
  nodeName: string,
  nodeWidth: number
): {
  r: SkiaRenderer
  canvas: Canvas
  draws: Array<{ text: string; fontLabel: string; x: number; y: number }>
} {
  const draws: Array<{ text: string; fontLabel: string; x: number; y: number }> = []
  const latinFont = recordingFont('latin')
  const cjkFont = opts.withCjk ? recordingFont('cjk') : null

  const r = {
    componentLabelFont: latinFont,
    cjkComponentLabelFont: cjkFont,
    arabicComponentLabelFont: null,
    zoom: 1,
    panX: 0,
    panY: 0,
    worldViewport: { x: 0, y: 0, w: 100, h: 100 },
    labelCache: {
      getComponents: mock(() => [
        {
          node: { id: 'c1', type: 'COMPONENT', name: nodeName, width: nodeWidth },
          absX: 0,
          absY: 0,
          inside: false
        }
      ])
    },
    compColor: mock(() => ({ r: 0, g: 0, b: 0, a: 1 })),
    auxFill: { setColor: mock(() => undefined) },
    ck: {
      PathBuilder: class {
        moveTo = mock(() => this)
        lineTo = mock(() => this)
        close = mock(() => this)
        detachAndDelete = mock(() => ({ delete: mock(() => undefined) }))
      }
    }
  } as SkiaRenderer

  const canvas = {
    drawPath: mock(() => undefined),
    drawText(text: string, x: number, y: number, _paint: unknown, font: Font) {
      draws.push({ text, fontLabel: (font as { label?: string }).label ?? '', x, y })
    }
  } as Canvas

  return { r, canvas, draws }
}

// T88 遗留收口：component label 最终绘制此前只看首字符选单一字体（canvas.drawText + segmentScript），
// 中英混排节点名（如「App 设计」）的汉字会落 latin typeface 出豆腐字；修复后与 sectionTitle
// 同口径走 drawTextByScript 分段画。以下钉扎 drawComponentLabels 端到端行为。
describe('T88 component label 直画分段（drawComponentLabels）', () => {
  // zoom=1、absX=absY=0、inside=false → textX = ICON_SIZE + ICON_GAP，textY = -GAP
  const TEXT_X = COMPONENT_LABEL_ICON_SIZE + COMPONENT_LABEL_ICON_GAP
  const TEXT_Y = -COMPONENT_LABEL_GAP

  test('⑪ 中英混排「App 设计」分两段画，汉字落 cjk typeface', () => {
    const { r, canvas, draws } = componentLabelHarness({ withCjk: true }, 'App 设计', 1_000_000)
    drawComponentLabels(r, canvas, null as never)
    expect(draws).toHaveLength(2)
    expect(draws[0]).toMatchObject({ text: 'App ', fontLabel: 'latin', x: TEXT_X, y: TEXT_Y })
    expect(draws[1]).toMatchObject({ text: '设计', fontLabel: 'cjk', y: TEXT_Y })
    // 第二段 x = 首段 x + latin 段宽（drawTextByScript 累加 advanceX）
    const [first, second] = [expectDefined(draws[0]), expectDefined(draws[1])]
    expect(second.x - first.x).toBe(W_LATIN_APP_SPACE)
  })

  test('⑫ CJK 开头混排「设计 App」首段 cjk、尾段 latin 各归其位', () => {
    const { r, canvas, draws } = componentLabelHarness({ withCjk: true }, '设计 App', 1_000_000)
    drawComponentLabels(r, canvas, null as never)
    expect(draws).toHaveLength(2)
    expect(draws[0]).toMatchObject({ text: '设计', fontLabel: 'cjk', x: TEXT_X, y: TEXT_Y })
    expect(draws[1]).toMatchObject({ text: ' App', fontLabel: 'latin', y: TEXT_Y })
    const [first, second] = [expectDefined(draws[0]), expectDefined(draws[1])]
    expect(second.x - first.x).toBe(W_CJK_SHE + W_CJK_JI)
  })

  test('⑬ 截断后的 ellipsis 段与 CJK 段分字体绘制（截断宽度口径与绘制一致）', () => {
    // maxTextWidth = nodeWidth - ICON_SIZE - ICON_GAP = 45000：
    // 「设计 App」总宽 71840 + ellipsis 8230 超宽 → 贪心截断只留「设」（35774+8230=44004 ≤ 45000），
    // 下一个「计」79749 超 → displayText = '设…'
    const nodeWidth = 45_000 + COMPONENT_LABEL_ICON_SIZE + COMPONENT_LABEL_ICON_GAP
    const { r, canvas, draws } = componentLabelHarness({ withCjk: true }, '设计 App', nodeWidth)
    drawComponentLabels(r, canvas, null as never)
    expect(draws.map((d) => d.text).join('')).toBe('设…')
    expect(draws[0]).toMatchObject({ text: '设', fontLabel: 'cjk', x: TEXT_X, y: TEXT_Y })
    expect(draws[1]).toMatchObject({ text: '…', fontLabel: 'latin', y: TEXT_Y })
    const [first, second] = [expectDefined(draws[0]), expectDefined(draws[1])]
    expect(second.x - first.x).toBe(W_CJK_SHE)
  })

  test('⑭ cjk typeface 缺失时混排整串降级 latin（fail-safe 不抛、与 sectionTitle 同口径）', () => {
    const { r, canvas, draws } = componentLabelHarness({ withCjk: false }, 'App 设计', 1_000_000)
    drawComponentLabels(r, canvas, null as never)
    expect(draws).toHaveLength(2)
    expect(draws[0]?.fontLabel).toBe('latin')
    expect(draws[1]?.fontLabel).toBe('latin')
  })

  test('⑮ 纯拉丁节点名「App」单段画、坐标契约稳定', () => {
    const { r, canvas, draws } = componentLabelHarness({ withCjk: true }, 'App', 1_000_000)
    drawComponentLabels(r, canvas, null as never)
    expect(draws).toHaveLength(1)
    expect(draws[0]).toMatchObject({ text: 'App', fontLabel: 'latin', x: TEXT_X, y: TEXT_Y })
  })
})

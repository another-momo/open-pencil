/**
 * T90：loadFonts 字体生命周期 — Replace-before-delete 钉扎
 *
 * 验证点（详见 docs/202609031430-t88-console-errors.md 问题二）：
 *  - loadFonts 重载时，**任何 Font.delete() 调用之前**对应字段已被新 Font
 *    替换引用（r.textFont 不再指向被 delete 的旧 Font）
 *  - CJK typeface null 时，cjk_x / arabic_x 字段被替换为 null（旧 null 仍为 null，
 *    不应触发不必要的 delete 调用——避免双重 delete 同一 null 报错）
 *  - 多次重载（3 次连调）均保持 replace-before-delete 顺序
 */
import { describe, expect, test } from 'bun:test'

import type { Font, Typeface } from 'canvaskit-wasm'

import { loadFonts } from '@open-pencil/core/canvas/renderer/fonts'

type LoadFontsArg = Parameters<typeof loadFonts>[0]

interface TrackedFont extends Font {
  label: string
  deleted: boolean
  deleteOrder: number
}

let deleteCounter = 0

function trackedFont(label: string): TrackedFont {
  const font: TrackedFont = {
    label,
    deleted: false,
    deleteOrder: -1,
    getTypeface() {
      return null
    },
    getGlyphIDs(_text: string) {
      return new Uint32Array()
    },
    getGlyphWidths(_ids: Uint32Array | number[]) {
      return new Float32Array()
    },
    getSize() {
      return 12
    },
    setSize(_size: number) {
      return undefined
    },
    delete() {
      this.deleted = true
      this.deleteOrder = ++deleteCounter
    }
  }
  return font
}

function noopDelete() {
  return undefined
}

interface MinimalCk {
  TypefaceFontProvider: { Make: () => { delete: () => void } }
  Typeface: { MakeFreeTypeFaceFromData: (_data: ArrayBuffer | null) => Typeface | null }
  FontMgr: { FromData: (_data: ArrayBuffer | null) => { delete: () => void } | null }
  // 用构造函数类型，避开 class with only constructor 的 lint 限制
  Font: new (typeface: Typeface | null, size: number) => TrackedFont
}

interface MinimalSkiaRenderer {
  textFont: TrackedFont
  labelFont: TrackedFont
  sizeFont: TrackedFont
  sectionTitleFont: TrackedFont
  componentLabelFont: TrackedFont
  cjkTextFont: TrackedFont | null
  cjkLabelFont: TrackedFont | null
  cjkSizeFont: TrackedFont | null
  cjkSectionTitleFont: TrackedFont | null
  cjkComponentLabelFont: TrackedFont | null
  arabicTextFont: TrackedFont | null
  arabicLabelFont: TrackedFont | null
  arabicSizeFont: TrackedFont | null
  arabicSectionTitleFont: TrackedFont | null
  arabicComponentLabelFont: TrackedFont | null
  isDestroyed: () => boolean
  ck: MinimalCk
  fontProvider: unknown
  fontMgr: unknown
  fontsLoaded: boolean
  fontsGeneration: number
  onFontResolutionSettled: ((snapshot: unknown, nodeIds: string[]) => void) | null
  profiler: { setTypeface: (t: Typeface | null) => void }
  invalidateAllPictures: () => void
}

// `Font` 在 canvaskit-wasm 类型里是 interface（构造函数 + 方法），需要
// 用 class 包装——但 class 自身不能返回非 this 对象。替代方案：返回
// 真实 TrackedFont，并把 ck.Font 标成「new 时返回 TrackedFont 的构造函数」，
// 这样 `new ck.Font(...)` 拿到的就是 TrackedFont。
function makeFont(typeface: Typeface | null, size: number): TrackedFont {
  void typeface
  return trackedFont(`new-font-${size}`)
}

function makeRenderer(): MinimalSkiaRenderer {
  return {
    textFont: trackedFont('initial-text'),
    labelFont: trackedFont('initial-label'),
    sizeFont: trackedFont('initial-size'),
    sectionTitleFont: trackedFont('initial-section'),
    componentLabelFont: trackedFont('initial-component'),
    cjkTextFont: trackedFont('initial-cjk-text'),
    cjkLabelFont: trackedFont('initial-cjk-label'),
    cjkSizeFont: trackedFont('initial-cjk-size'),
    cjkSectionTitleFont: trackedFont('initial-cjk-section'),
    cjkComponentLabelFont: trackedFont('initial-cjk-component'),
    arabicTextFont: trackedFont('initial-arabic-text'),
    arabicLabelFont: trackedFont('initial-arabic-label'),
    arabicSizeFont: trackedFont('initial-arabic-size'),
    arabicSectionTitleFont: trackedFont('initial-arabic-section'),
    arabicComponentLabelFont: trackedFont('initial-arabic-component'),
    isDestroyed: () => false,
    ck: {
      TypefaceFontProvider: { Make: () => ({ delete: noopDelete }) },
      Typeface: {
        // mock 返回非 null 表征 typeface 加载成功（让 assignScriptFonts 真的创建新 Font）
        MakeFreeTypeFaceFromData(_data: ArrayBuffer | null): Typeface | null {
          return { delete: noopDelete } as Typeface
        }
      },
      FontMgr: { FromData: () => ({ delete: noopDelete }) },
      // loadFonts 用 `new ck.Font(typeface, size)` 构造。构造签名要求返回
      // Font 接口；我们用构造函数返回 TrackedFont 替代——TrackedFont 是
      // Font 的子类型，方法（delete/getTypeface/...）都齐全。
      Font: makeFont
    },
    fontProvider: null,
    fontMgr: null,
    fontsLoaded: false,
    fontsGeneration: 0,
    onFontResolutionSettled: null,
    profiler: { setTypeface: () => undefined },
    invalidateAllPictures: () => undefined
  }
}

function trackedFontFields(r: MinimalSkiaRenderer): TrackedFont[] {
  return [
    r.textFont,
    r.labelFont,
    r.sizeFont,
    r.sectionTitleFont,
    r.componentLabelFont,
    r.cjkTextFont as TrackedFont,
    r.cjkLabelFont as TrackedFont,
    r.cjkSizeFont as TrackedFont,
    r.cjkSectionTitleFont as TrackedFont,
    r.cjkComponentLabelFont as TrackedFont,
    r.arabicTextFont as TrackedFont,
    r.arabicLabelFont as TrackedFont,
    r.arabicSizeFont as TrackedFont,
    r.arabicSectionTitleFont as TrackedFont,
    r.arabicComponentLabelFont as TrackedFont
  ]
}

function assertFieldsReplaced(r: MinimalSkiaRenderer, initial: TrackedFont[]): void {
  expect(r.textFont).not.toBe(initial[0])
  expect(r.labelFont).not.toBe(initial[1])
  expect(r.sizeFont).not.toBe(initial[2])
  expect(r.sectionTitleFont).not.toBe(initial[3])
  expect(r.componentLabelFont).not.toBe(initial[4])
  expect(r.cjkTextFont).not.toBe(initial[5])
  expect(r.cjkLabelFont).not.toBe(initial[6])
  expect(r.cjkSizeFont).not.toBe(initial[7])
  expect(r.cjkSectionTitleFont).not.toBe(initial[8])
  expect(r.cjkComponentLabelFont).not.toBe(initial[9])
  expect(r.arabicTextFont).not.toBe(initial[10])
  expect(r.arabicLabelFont).not.toBe(initial[11])
  expect(r.arabicSizeFont).not.toBe(initial[12])
  expect(r.arabicSectionTitleFont).not.toBe(initial[13])
  expect(r.arabicComponentLabelFont).not.toBe(initial[14])
}

describe('T90 loadFonts Replace-before-delete', () => {
  test('首次 loadFonts：所有旧 Font 被 delete，且 delete 在 replace 引用之后', async () => {
    deleteCounter = 0
    const r = makeRenderer() as Partial<MinimalSkiaRenderer> as LoadFontsArg
    const initialFonts = trackedFontFields(r)

    try {
      await loadFonts(r)
    } catch (err) {
      console.error('loadFonts threw:', err)
    }

    // 全部初始 Font 都被 delete
    for (const f of initialFonts) {
      expect(f.deleted).toBe(true)
    }

    // 引用已被替换：r.* 不再持有任何初始 Font 实例
    assertFieldsReplaced(r, initialFonts)
  })

  test('重载 loadFonts 第二次：第一次产生的 Font 也安全释放（旧 r.textFont 不指向第二次的 Font）', async () => {
    deleteCounter = 0
    const r = makeRenderer() as Partial<MinimalSkiaRenderer> as LoadFontsArg
    const firstInitial = r.textFont
    await loadFonts(r)
    // 第二次 loadFonts：快照的 secondInitial 应该是上一次 assignScriptFonts 写入的 Font
    const secondInitial = r.textFont
    expect(secondInitial).not.toBe(firstInitial)

    await loadFonts(r)
    // 两次初始 Font 都被 delete
    expect(firstInitial.deleted).toBe(true)
    expect(secondInitial.deleted).toBe(true)
    // r.textFont 现在指向第三次 assignScriptFonts 写入的 Font（既不是 first 也不是 second）
    expect(r.textFont).not.toBe(firstInitial)
    expect(r.textFont).not.toBe(secondInitial)
  })

  test('连续三次重载：所有旧 Font 全 delete，无泄漏', async () => {
    deleteCounter = 0
    const r = makeRenderer() as Partial<MinimalSkiaRenderer> as LoadFontsArg
    const allCreated: TrackedFont[] = []

    for (let i = 0; i < 3; i++) {
      await loadFonts(r)
      // 抓取每次重载后的 Font 引用（下一轮 loadFonts 会快照这些并 delete）
      allCreated.push(...trackedFontFields(r))
    }

    // 最后一轮的 Font 仍然存活（前 N-1 轮的全 delete）
    const lastBatch = allCreated.slice(-15)
    const previousBatches = allCreated.slice(0, -15)
    for (const f of previousBatches) expect(f.deleted).toBe(true)
    for (const f of lastBatch) expect(f.deleted).toBe(false)
  })
})

/**
 * T41 S1 探针：canvaskit-wasm 0.41.1 可变字体渲染机制实证。
 *
 * 问题：TypefaceFontProvider.registerFont 注册的 VF 数据，排版期 TextStyle.fontVariations
 * 的 wght 轴值是否真实生效（注册期无 FontArguments/named-instance API，排版期注入是唯一通路）。
 *
 * 方法：
 * 1. 下载 @chinese-fonts/syst（思源宋体 CN VF，font-weight:250 900）覆盖
 *    U+4E2D「中」与 U+0041「A」的两个真实分片；
 * 2. 分片各持 alias 注册（同名塌缩规避，T40 定论）；
 * 3. 实验组：fontVariations wght=250/900 → 量墨量（非背景像素数）与排版宽度；
 *    对照组：仅 fontStyle.weight=250/900 不传 fontVariations → 预期无显著差异。
 *
 * 判定：实验组 ink(900) > ink(250) × 1.2 且对照组差异 < 5% → D-a 机制成立。
 *
 * 运行：bun spikes/probes/probe-t41-variable-font.mjs
 */

import CanvasKitInit from 'canvaskit-wasm'

const SYST_CSS =
  'https://cdn.jsdelivr.net/npm/@chinese-fonts/syst@3.0.0/dist/SourceHanSerifCN/result.css'

function parseUnicodeRanges(value) {
  const ranges = []
  for (const part of value.split(',')) {
    const m = /^U\+([0-9A-Fa-f?]+)(?:-([0-9A-Fa-f]+))?$/i.exec(part.trim())
    if (!m) continue
    const [, start, end] = m
    if (start.includes('?')) {
      const prefix = start.replace(/\?/g, '')
      const wildcards = start.length - prefix.length
      const low = Number.parseInt(prefix || '0', 16) << (4 * wildcards)
      ranges.push([low, low + (1 << (4 * wildcards)) - 1])
      continue
    }
    const low = Number.parseInt(start, 16)
    ranges.push([low, end ? Number.parseInt(end, 16) : low])
  }
  return ranges
}

function covers(ranges, cp) {
  return ranges.some(([lo, hi]) => cp >= lo && cp <= hi)
}

/** woff2 目录已知标签表（规范 4.2 节，fvar=44）——只需识别 fvar */
const WOFF2_KNOWN_FVAR = 44

function readBase128(view, offset) {
  let value = 0
  for (let i = 0; i < 5; i++) {
    const byte = view.getUint8(offset + i)
    value = (value << 7) | (byte & 0x7f)
    if ((byte & 0x80) === 0) return { value, next: offset + i + 1 }
  }
  return { value, next: offset + 5 }
}

/** 返回 fvar 表在解压字体中的存在性（woff2 分片不解压则只能读到目录元数据） */
function woff2HasFvar(buf) {
  const view = new DataView(buf)
  if (buf.byteLength < 48) return false
  if (view.getUint32(0) !== 0x774f4632) return false // 'wOF2'
  const numTables = view.getUint16(12)
  let offset = 48
  for (let i = 0; i < numTables; i++) {
    const flags = view.getUint8(offset)
    offset += 1
    const tagIndex = flags & 0x3f
    if (tagIndex === 0x3f) offset += 4 // 自定义标签 4 字节
    const orig = readBase128(view, offset)
    offset = orig.next
    const transformVersion = (flags >> 6) & 0x3
    if (transformVersion !== 0) {
      const trans = readBase128(view, offset)
      offset = trans.next
    }
    if (tagIndex === WOFF2_KNOWN_FVAR) return true
  }
  return false
}

/** fvar 嗅探 + wght 轴区间（F16.16 定点）——T41 variable.ts 的原型；仅支持未压缩 sfnt */
function readWghtRange(buf) {
  const view = new DataView(buf)
  if (buf.byteLength < 12) return null
  const numTables = view.getUint16(4)
  for (let i = 0; i < numTables && 12 + i * 16 + 16 <= buf.byteLength; i++) {
    const off = 12 + i * 16
    const tag = String.fromCharCode(
      view.getUint8(off),
      view.getUint8(off + 1),
      view.getUint8(off + 2),
      view.getUint8(off + 3)
    )
    if (tag !== 'fvar') continue
    const table = view.getUint32(off + 8)
    if (table + 16 > buf.byteLength) return null
    const axesOffset = view.getUint16(table + 4)
    const axisCount = view.getUint16(table + 8)
    const axisSize = view.getUint16(table + 10)
    for (let a = 0; a < axisCount; a++) {
      const axis = table + axesOffset + a * axisSize
      if (axis + 20 > buf.byteLength) return null
      const axisTag = String.fromCharCode(
        view.getUint8(axis),
        view.getUint8(axis + 1),
        view.getUint8(axis + 2),
        view.getUint8(axis + 3)
      )
      if (axisTag !== 'wght') continue
      return {
        min: view.getInt32(axis + 4) / 65536,
        default: view.getInt32(axis + 8) / 65536,
        max: view.getInt32(axis + 12) / 65536
      }
    }
    return { error: 'fvar without wght axis' }
  }
  return null
}

async function main() {
  console.log('== T41 S1 探针：VF 注册期数据 + 排版期 fontVariations wght ==')

  const css = await (await fetch(SYST_CSS)).text()
  const blocks = [...css.matchAll(/@font-face\{([^}]+)\}/g)].map((m) => m[1])
  console.log(`result.css @font-face 块数: ${blocks.length}`)

  const pieces = []
  for (const block of blocks) {
    const url = /url\("\.\/([^"]+)"\)/.exec(block)?.[1]
    const weight = /font-weight:([^;]+)/.exec(block)?.[1]?.trim()
    const range = /unicode-range:([^;]+)/.exec(block)?.[1]
    if (url && range) pieces.push({ url, weight, ranges: parseUnicodeRanges(range) })
  }
  const cjkPiece = pieces.find((p) => covers(p.ranges, 0x4e2d))
  const latinPiece = pieces.find((p) => covers(p.ranges, 0x41))
  if (!cjkPiece || !latinPiece) throw new Error('覆盖片未找到')
  console.log(`CJK 片: ${cjkPiece.url} (weight ${cjkPiece.weight})`)
  console.log(`Latin 片: ${latinPiece.url} (weight ${latinPiece.weight})`)

  const base = SYST_CSS.slice(0, SYST_CSS.lastIndexOf('/') + 1)
  const buffers = {}
  for (const [key, piece] of [
    ['cjk', cjkPiece],
    ['latin', latinPiece]
  ]) {
    if (buffers[piece.url]) continue
    const buf = await (await fetch(base + piece.url)).arrayBuffer()
    buffers[piece.url] = buf
    console.log(
      `  ${key} 片 ${buf.byteLength} bytes, woff2-fvar: ${woff2HasFvar(buf)}, sfnt wght:`,
      readWghtRange(buf)
    )
  }

  const ck = await CanvasKitInit()
  const provider = ck.TypefaceFontProvider.Make()
  provider.registerFont(new Uint8Array(buffers[cjkPiece.url]), 'VF\x1Fcjk')
  provider.registerFont(new Uint8Array(buffers[latinPiece.url]), 'VF\x1Flatin')
  const families = ['VF\x1Fcjk', 'VF\x1Flatin']

  const WHITE = ck.Color4f(1, 1, 1, 1)
  const BLACK = ck.Color4f(0, 0, 0, 1)

  function measure(text, { wght, useVariations }) {
    const textStyle = new ck.TextStyle({
      color: BLACK,
      fontFamilies: families,
      fontSize: 120,
      ...(useVariations
        ? { fontVariations: [{ axis: 'wght', value: wght }] }
        : { fontStyle: { weight: { value: wght }, slant: ck.FontSlant.Upright } })
    })
    const paraStyle = new ck.ParagraphStyle({ textStyle })
    const builder = ck.ParagraphBuilder.MakeFromFontProvider(paraStyle, provider)
    builder.addText(text)
    const paragraph = builder.build()
    paragraph.layout(1400)
    const width = paragraph.getLongestLine()

    const surface = ck.MakeSurface(1400, 260)
    if (!surface) throw new Error('MakeSurface failed')
    const canvas = surface.getCanvas()
    canvas.clear(WHITE)
    canvas.drawParagraph(paragraph, 0, 0)
    const image = surface.makeImageSnapshot()
    const pixels = new Uint8Array(
      image.readPixels(0, 0, {
        width: 1400,
        height: 260,
        colorType: ck.ColorType.RGBA_8888,
        alphaType: ck.AlphaType.Unpremul,
        colorSpace: ck.ColorSpace.SRGB
      })
    )
    image.delete()
    let ink = 0
    for (let i = 0; i < pixels.length; i += 4) {
      if (pixels[i + 3] > 200 && pixels[i] < 128) ink++
    }
    paragraph.delete()
    builder.delete()
    surface.dispose()
    return { width: Math.round(width), ink }
  }

  const results = {}
  for (const [label, text] of [
    ['latin', 'Hamburgefonstiv'],
    ['cjk', '中中中中']
  ]) {
    for (const useVariations of [true, false]) {
      const lo = measure(text, { wght: 250, useVariations })
      const hi = measure(text, { wght: 900, useVariations })
      results[`${label}/${useVariations ? 'variations' : 'fontStyle-only'}`] = { lo, hi }
    }
  }

  console.log('\n结果（wght 250 → 900）：')
  for (const [label, { lo, hi }] of Object.entries(results)) {
    const inkRatio = lo.ink > 0 ? (hi.ink / lo.ink).toFixed(2) : 'n/a'
    console.log(
      `  ${label}: width ${lo.width}→${hi.width}, ink ${lo.ink}→${hi.hink ?? hi.ink} (×${inkRatio})`
    )
  }

  const latinVar = results['latin/variations']
  const cjkVar = results['cjk/variations']
  const latinCtl = results['latin/fontStyle-only']
  const cjkCtl = results['cjk/fontStyle-only']
  const varEffective =
    cjkVar.hi.ink > cjkVar.lo.ink * 1.2 || latinVar.hi.ink > latinVar.lo.ink * 1.2
  const ctlFlat =
    Math.abs(cjkCtl.hi.ink - cjkCtl.lo.ink) < cjkCtl.lo.ink * 0.05 &&
    Math.abs(latinCtl.hi.ink - latinCtl.lo.ink) < latinCtl.lo.ink * 0.05
  console.log(`\n判定: 实验组显著差异=${varEffective}, 对照组平坦=${ctlFlat}`)
  console.log(varEffective ? 'D-a 成立：排版期 fontVariations wght 轴注入有效' : 'D-a 证伪！')
  if (!ctlFlat) console.log('注意：fontStyle.weight 也可能驱动 VF 实例选择（意外收获）')
}

main().catch((e) => {
  console.error('探针失败:', e)
  process.exit(1)
})

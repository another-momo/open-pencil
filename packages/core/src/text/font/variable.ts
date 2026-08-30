/**
 * 可变字体（Variable Font）容器嗅探与 fvar 解析（T41 S2，D-b 收口）。
 *
 * font/style.ts 的 isVariableFont 只认未压缩 sfnt（TTF/OTF）目录；CDN 分片是 woff2、
 * 历史 woff 也可能出现——本模块覆盖三种容器：
 * - sfnt（0x00010000 / 'OTTO' / 'true'）：表目录直读，fvar 全解析（wght 轴区间）；
 * - woff（'wOFF'）：20 字节目录项，fvar 未压缩（compLen === origLen）时解析区间，
 *   压缩态只能报存在性；
 * - woff2（'wOF2'）：目录走已知标签表（fvar = 44，WOFF2 规范 §4.2）+ base128 变长
 *   长度，fvar 数据在 brotli 压缩流内，只报存在性（区间留给 FontFace 全区间兜底）。
 *
 * 防御：截断/畸形数据全程不 throw，返回保守值。
 * 探针实证（workbench/probe-t41-variable-font.mjs，2026-08-30）：syst woff2 分片
 * 目录可读出 fvar=44 标签；canvaskit-wasm 0.41.1 排版期 fontVariations wght 注入有效。
 */

export interface VariableFontInfo {
  variable: boolean
  /** fvar wght 轴区间（仅容器允许直读时给出） */
  wght?: { min: number; default: number; max: number }
}

/** fvar 表内解析 wght 轴（F16.16 定点）。数据越界返回 undefined。 */
function readWghtAxis(view: DataView, table: number): VariableFontInfo['wght'] {
  if (table + 16 > view.byteLength) return undefined
  const axesOffset = view.getUint16(table + 4)
  const axisCount = view.getUint16(table + 8)
  const axisSize = view.getUint16(table + 10)
  for (let a = 0; a < axisCount; a++) {
    const axis = table + axesOffset + a * axisSize
    if (axis + 20 > view.byteLength) return undefined
    const tag = String.fromCharCode(
      view.getUint8(axis),
      view.getUint8(axis + 1),
      view.getUint8(axis + 2),
      view.getUint8(axis + 3)
    )
    if (tag !== 'wght') continue
    return {
      min: view.getInt32(axis + 4) / 65536,
      default: view.getInt32(axis + 8) / 65536,
      max: view.getInt32(axis + 12) / 65536
    }
  }
  return undefined
}

function tagAt(view: DataView, offset: number): string {
  return String.fromCharCode(
    view.getUint8(offset),
    view.getUint8(offset + 1),
    view.getUint8(offset + 2),
    view.getUint8(offset + 3)
  )
}

function sniffSfnt(data: ArrayBuffer): VariableFontInfo {
  const view = new DataView(data)
  const numTables = view.getUint16(4)
  for (let i = 0; i < numTables && 12 + i * 16 + 16 <= data.byteLength; i++) {
    const entry = 12 + i * 16
    if (tagAt(view, entry) !== 'fvar') continue
    return { variable: true, wght: readWghtAxis(view, view.getUint32(entry + 8)) }
  }
  return { variable: false }
}

function sniffWoff(data: ArrayBuffer): VariableFontInfo {
  const view = new DataView(data)
  const numTables = view.getUint16(12)
  for (let i = 0; i < numTables && 44 + i * 20 + 20 <= data.byteLength; i++) {
    const entry = 44 + i * 20
    if (tagAt(view, entry) !== 'fvar') continue
    const offset = view.getUint32(entry + 4)
    const compressed = view.getUint32(entry + 8) !== view.getUint32(entry + 12)
    return {
      variable: true,
      wght: compressed ? undefined : readWghtAxis(view, offset)
    }
  }
  return { variable: false }
}

/** woff2 base128 变长整数（规范 §4.2 UIntBase128） */
function readBase128(view: DataView, offset: number): { value: number; next: number } | null {
  let value = 0
  for (let i = 0; i < 5; i++) {
    if (offset + i >= view.byteLength) return null
    const byte = view.getUint8(offset + i)
    value = (value << 7) | (byte & 0x7f)
    if ((byte & 0x80) === 0) return { value, next: offset + i + 1 }
  }
  return null
}

/** woff2 已知标签表 fvar 索引（WOFF2 规范 §4.2 Known Table Tags，fvar = 44） */
const WOFF2_KNOWN_TAG_FVAR = 44

function sniffWoff2(data: ArrayBuffer): VariableFontInfo {
  const view = new DataView(data)
  const numTables = view.getUint16(12)
  let offset = 48
  for (let i = 0; i < numTables; i++) {
    if (offset + 1 > view.byteLength) return { variable: false }
    const flags = view.getUint8(offset)
    offset += 1
    const tagIndex = flags & 0x3f
    if (tagIndex === 0x3f) offset += 4 // 自定义标签：4 字节 tag 直跟
    const orig = readBase128(view, offset)
    if (!orig) return { variable: false }
    offset = orig.next
    if (((flags >> 6) & 0x3) !== 0) {
      const transformed = readBase128(view, offset)
      if (!transformed) return { variable: false }
      offset = transformed.next
    }
    // fvar 数据在 brotli 压缩流内，目录只能报存在性
    if (tagIndex === WOFF2_KNOWN_TAG_FVAR) return { variable: true }
  }
  return { variable: false }
}

/**
 * 三容器可变字体嗅探。返回 { variable: false } 表示非 VF 或数据不可识别（保守）。
 * woff2 命中时 wght 区间缺失——调用方需要区间时按 CSS 全区间（1 1000）兜底。
 */
export function sniffVariableFont(data: ArrayBuffer): VariableFontInfo {
  if (data.byteLength < 12) return { variable: false }
  try {
    const view = new DataView(data)
    const signature = view.getUint32(0)
    if (signature === 0x00010000 || signature === 0x4f54544f || signature === 0x74727565) {
      return sniffSfnt(data)
    }
    if (signature === 0x774f4646) return sniffWoff(data) // 'wOFF'
    if (signature === 0x774f4632) return sniffWoff2(data) // 'wOF2'
    return { variable: false }
  } catch {
    return { variable: false }
  }
}

/** 家族级 wght 区间兜底：fvar 直读失败（woff2 压缩流）时的 CSS 合法全区间 */
export const FULL_WEIGHT_RANGE = { min: 1, default: 400, max: 1000 } as const

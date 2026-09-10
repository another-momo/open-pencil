/**
 * T33（generate_image 透明背景特性，2026-09-10）：local 路径后处理核心——
 * 键色背景抠图。
 *
 * 设计来源：参考项目/gpt_image_playground/src/lib/transparentImage.ts
 * （owner 已研读，详见 docs/202609101102-transparent-bg-research.md §3）。
 * 移植要点：
 * - 参考实现基于浏览器 Canvas（document.createElement('canvas') + getImageData/
 *   putImageData/toDataURL）；pi-backend 跑在 Node/bun 运行时，**无 DOM 无 Canvas**，
 *   禁引入新 npm 依赖，故本模块自实现最小 PNG 8-bit RGB/RGBA 编解码
 *   （IHDR/IDAT chunk 解析 + inflate/unfilter + deflate + CRC32 小表），像素
 *   数据走 Uint8ClampedArray 与参考一致。
 * - 四步算法（detectKeyColorFromPixels → buildConnectedBackgroundMask +
 *   addInteriorKeyColorIslands → writeTransparentPixels/computeDistanceToBackground/
 *   getEdgeTransparency → removeColorSpill）逐函数照搬，阈值/参数与参考一致。
 * - KEY_COLOR_PROMPT_SUFFIX 原文移植自参考 transparentImage.ts:17-23 的四段
 *   中文规则——T82 钉扎：prompt 规则只能活在 studio/ 体系，但键色规则属于
 *   工具内部运行时常量（不是给 agent 看的 description/schema hint），注入
 *   发生在 generate 段模型输入、begin 段元数据保持原 prompt（generate.ts
 *   runGeneratePhase 控制）。
 *
 * 输出：RGBA PNG（透明必须 alpha 通道）。
 * 失败：解码/编码抛错；调用方 try/catch 回退原 bytes（见 generate.ts）。
 */

import { deflateSync, inflateSync } from 'node:zlib'

// ── prompt suffix ─────────────────────────────────────────────────────────

/**
 * T33：键色背景规则 prompt 后缀（生成段注入，begin 段元数据保持原 prompt）。
 * 原文移植自参考项目 transparentImage.ts:17-23 的四段中文规则——智能让模型
 * 根据主体色自选绿/洋红，避免「主体色=键色」冲突；并对画布/主体/禁止项做硬约束。
 */
export const KEY_COLOR_PROMPT_SUFFIX = [
  '[背景指令]',
  '背景色选择规则：如果主体包含绿色系（绿、青绿、黄绿、草绿等）颜色，使用纯洋红色(#FF00FF)背景；否则一律使用纯绿色(#00FF00)背景。',
  '背景要求：整张画布仅由所选纯色填充，无任何渐变、纹理、阴影、光照变化、地面或环境元素。',
  '主体要求：单主体、完整呈现、轮廓清晰锐利。主体与背景之间保持干净的边缘分离，不要有颜色溢出或混合。',
  '禁止：主体本身、描边、光晕、投影或反射中不能出现所选背景色。'
].join('\n')

// ── key color constants ───────────────────────────────────────────────────

interface RGB {
  r: number
  g: number
  b: number
}

const GREEN_KEY: RGB = { r: 0, g: 255, b: 0 }
const MAGENTA_KEY: RGB = { r: 255, g: 0, b: 255 }

/**
 * 边缘像素投票距离阈值（参考 transparentImage.ts:95-96 阈值 100 投票）。
 * 不依赖 prompt 成功——模型即便用错键色，自动检测阶段会兜底。
 */
const KEY_DISTANCE_THRESHOLD = 100

// ── public API ────────────────────────────────────────────────────────────

/**
 * T33：从 RGBA 像素数据 + 边缘投票检测键色——返回绿或洋红。
 * 暴露供 transparent.ts 单测与外部场景复用。
 */
export function detectKeyColorFromPixels(
  data: Uint8ClampedArray,
  width: number,
  height: number
): 'green' | 'magenta' {
  let greenScore = 0
  let magentaScore = 0
  for (let x = 0; x < width; x += 1) {
    const top = x * 4
    if (colorDistance(data, top, GREEN_KEY) < KEY_DISTANCE_THRESHOLD) greenScore += 1
    if (colorDistance(data, top, MAGENTA_KEY) < KEY_DISTANCE_THRESHOLD) magentaScore += 1
    const bottom = ((height - 1) * width + x) * 4
    if (colorDistance(data, bottom, GREEN_KEY) < KEY_DISTANCE_THRESHOLD) greenScore += 1
    if (colorDistance(data, bottom, MAGENTA_KEY) < KEY_DISTANCE_THRESHOLD) magentaScore += 1
  }
  for (let y = 1; y < height - 1; y += 1) {
    const left = y * width * 4
    if (colorDistance(data, left, GREEN_KEY) < KEY_DISTANCE_THRESHOLD) greenScore += 1
    if (colorDistance(data, left, MAGENTA_KEY) < KEY_DISTANCE_THRESHOLD) magentaScore += 1
    const right = (y * width + (width - 1)) * 4
    if (colorDistance(data, right, GREEN_KEY) < KEY_DISTANCE_THRESHOLD) greenScore += 1
    if (colorDistance(data, right, MAGENTA_KEY) < KEY_DISTANCE_THRESHOLD) magentaScore += 1
  }
  return magentaScore > greenScore ? 'magenta' : 'green'
}

/**
 * T33：PNG 字节流 → 去键色背景 RGBA PNG 字节流。失败抛错，调用方决定
 * 回退策略（generate.ts：try/catch 回退原 bytes 并在该结果项上标注
 * 后处理失败）。
 */
export function removeKeyedBackgroundFromPNG(bytes: Uint8Array): Uint8Array {
  const decoded = decodePNGRgba8(bytes)
  const key = detectKeyColorFromPixels(decoded.data, decoded.width, decoded.height)
  const keyRGB = key === 'magenta' ? MAGENTA_KEY : GREEN_KEY
  applyKeyedTransparency(decoded.data, decoded.width, decoded.height, keyRGB)
  return encodePNGRgba8(decoded.data, decoded.width, decoded.height)
}

/** 检测 RGBA 像素块是否含键色背景——测试用（验证 transparent 出口） */
export function hasAlphaChannel(bytes: Uint8Array): boolean {
  const decoded = decodePNGRgba8(bytes)
  return decoded.colorType === 6
}

// ── core algorithm（参考 transparentImage.ts，逐函数移植） ────────────────

/** @internal — exported for unit tests; not part of public API */
export const __test__ = {
  colorDistance,
  getBackgroundConfidence,
  clamp01,
  clampByte,
  applyKeyedTransparency,
  buildBackgroundMask,
  buildConnectedBackgroundMask,
  addInteriorKeyColorIslands,
  computeDistanceToBackground,
  addDistanceNeighbor,
  getEdgeTransparency,
  getKeyChannelMix,
  removeColorSpill,
  decodePNGRgba8,
  encodePNGRgba8,
  applyRowFilter,
  paethPredictor,
  GREEN_KEY,
  MAGENTA_KEY
}

function colorDistance(data: Uint8ClampedArray, offset: number, key: RGB): number {
  const dr = (data[offset] ?? 0) - key.r
  const dg = (data[offset + 1] ?? 0) - key.g
  const db = (data[offset + 2] ?? 0) - key.b
  return Math.hypot(dr, dg, db)
}

function getBackgroundConfidence(data: Uint8ClampedArray, index: number, keyRGB: RGB): number {
  const offset = index * 4
  const dist = colorDistance(data, offset, keyRGB)
  return clamp01((150 - dist) / 150)
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v))
}

function clampByte(v: number): number {
  return Math.max(0, Math.min(255, Math.round(v)))
}

function applyKeyedTransparency(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  keyRGB: RGB
): void {
  const mask = buildBackgroundMask(data, width, height, keyRGB)
  const distance = computeDistanceToBackground(mask, width, height, 4)
  const pixelCount = width * height

  for (let index = 0; index < pixelCount; index += 1) {
    const offset = index * 4
    const red = data[offset] ?? 0
    const green = data[offset + 1] ?? 0
    const blue = data[offset + 2] ?? 0
    const confidence = getBackgroundConfidence(data, index, keyRGB)
    let alpha = 255

    if (mask[index]) {
      alpha = 0
    } else {
      const d = distance[index] ?? 0
      if (d > 0) {
        const transparency = getEdgeTransparency(red, green, blue, confidence, d, keyRGB)
        if (transparency > 0) alpha = Math.round(255 * (1 - transparency))
        let minAlpha = 196
        if (d === 1) minAlpha = 48
        else if (d === 2) minAlpha = 128
        alpha = Math.max(alpha, minAlpha)
      } else {
        const isolatedSpill = getKeyChannelMix(red, green, blue, keyRGB)
        if (confidence >= 0.46 && isolatedSpill >= 0.45) {
          alpha = Math.round(255 * (1 - isolatedSpill * 0.75))
          alpha = Math.max(alpha, 96)
        }
      }
    }

    const cleaned = removeColorSpill(
      red,
      green,
      blue,
      alpha,
      keyRGB,
      confidence,
      distance[index] ?? 0
    )
    data[offset] = cleaned.r
    data[offset + 1] = cleaned.g
    data[offset + 2] = cleaned.b
    data[offset + 3] = alpha
  }
}

function buildBackgroundMask(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  keyRGB: RGB
): Uint8Array {
  const mask = buildConnectedBackgroundMask(data, width, height, keyRGB)
  addInteriorKeyColorIslands(data, width, height, keyRGB, mask)
  return mask
}

function buildConnectedBackgroundMask(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  keyRGB: RGB
): Uint8Array {
  const pixelCount = width * height
  const mask = new Uint8Array(pixelCount)
  const visited = new Uint8Array(pixelCount)
  const queue = new Uint32Array(pixelCount)
  let queueStart = 0
  let queueEnd = 0

  const enqueue = (index: number) => {
    if (visited[index]) return
    visited[index] = 1
    if (getBackgroundConfidence(data, index, keyRGB) < 0.18) return
    mask[index] = 1
    queue[queueEnd] = index
    queueEnd += 1
  }

  for (let x = 0; x < width; x += 1) {
    enqueue(x)
    enqueue((height - 1) * width + x)
  }
  for (let y = 1; y < height - 1; y += 1) {
    enqueue(y * width)
    enqueue(y * width + (width - 1))
  }

  while (queueStart < queueEnd) {
    const index = queue[queueStart]
    queueStart += 1
    const x = index % width
    const y = Math.floor(index / width)
    if (x > 0) enqueue(index - 1)
    if (x < width - 1) enqueue(index + 1)
    if (y > 0) enqueue(index - width)
    if (y < height - 1) enqueue(index + width)
  }

  return mask
}

function addInteriorKeyColorIslands(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  keyRGB: RGB,
  mask: Uint8Array
): void {
  const pixelCount = width * height
  const visited = new Uint8Array(pixelCount)
  const queue = new Uint32Array(pixelCount)
  const component = new Uint32Array(pixelCount)

  for (let seed = 0; seed < pixelCount; seed += 1) {
    if (mask[seed] || visited[seed]) continue
    if (getBackgroundConfidence(data, seed, keyRGB) < 0.68) continue

    let queueStart = 0
    let queueEnd = 0
    let componentLength = 0
    let confidenceSum = 0
    let strictCount = 0
    let strongCount = 0

    visited[seed] = 1
    queue[queueEnd] = seed
    queueEnd += 1

    const enqueueNeighbor = (neighborIndex: number) => {
      if (neighborIndex < 0 || mask[neighborIndex] || visited[neighborIndex]) return
      if (getBackgroundConfidence(data, neighborIndex, keyRGB) < 0.24) return
      visited[neighborIndex] = 1
      queue[queueEnd] = neighborIndex
      queueEnd += 1
    }

    while (queueStart < queueEnd) {
      const index = queue[queueStart]
      queueStart += 1
      const confidence = getBackgroundConfidence(data, index, keyRGB)
      component[componentLength] = index
      componentLength += 1
      confidenceSum += confidence
      if (confidence >= 0.68) strictCount += 1
      if (confidence >= 0.86) strongCount += 1

      const x = index % width
      const y = Math.floor(index / width)
      enqueueNeighbor(x > 0 ? index - 1 : -1)
      enqueueNeighbor(x < width - 1 ? index + 1 : -1)
      enqueueNeighbor(y > 0 ? index - width : -1)
      enqueueNeighbor(y < height - 1 ? index + width : -1)
    }

    const averageConfidence = confidenceSum / componentLength
    const strictRatio = strictCount / componentLength
    const strongRatio = strongCount / componentLength
    const shouldRemove =
      averageConfidence >= 0.42 ||
      strictRatio >= 0.18 ||
      strongRatio >= 0.05 ||
      (componentLength <= 3 && averageConfidence >= 0.34)

    if (shouldRemove) {
      for (let i = 0; i < componentLength; i += 1) {
        mask[component[i]] = 1
      }
    }
  }
}

function computeDistanceToBackground(
  mask: Uint8Array,
  width: number,
  height: number,
  maxDistance: number
): Uint8Array {
  const pixelCount = width * height
  const distance = new Uint8Array(pixelCount)
  let frontier: number[] = []

  for (let index = 0; index < pixelCount; index += 1) {
    if (mask[index]) continue
    const x = index % width
    const y = Math.floor(index / width)
    const touchesBackground =
      (x > 0 && mask[index - 1]) ||
      (x < width - 1 && mask[index + 1]) ||
      (y > 0 && mask[index - width]) ||
      (y < height - 1 && mask[index + width])

    if (touchesBackground) {
      distance[index] = 1
      frontier.push(index)
    }
  }

  for (let currentDistance = 1; currentDistance < maxDistance; currentDistance += 1) {
    const nextFrontier: number[] = []
    for (const index of frontier) {
      const x = index % width
      const y = Math.floor(index / width)
      addDistanceNeighbor(distance, mask, nextFrontier, x > 0 ? index - 1 : -1, currentDistance)
      addDistanceNeighbor(
        distance,
        mask,
        nextFrontier,
        x < width - 1 ? index + 1 : -1,
        currentDistance
      )
      addDistanceNeighbor(distance, mask, nextFrontier, y > 0 ? index - width : -1, currentDistance)
      addDistanceNeighbor(
        distance,
        mask,
        nextFrontier,
        y < height - 1 ? index + width : -1,
        currentDistance
      )
    }
    frontier = nextFrontier
    if (!frontier.length) break
  }

  return distance
}

function addDistanceNeighbor(
  distance: Uint8Array,
  mask: Uint8Array,
  nextFrontier: number[],
  neighborIndex: number,
  currentDistance: number
): void {
  if (neighborIndex < 0 || mask[neighborIndex] || distance[neighborIndex] !== 0) return
  distance[neighborIndex] = currentDistance + 1
  nextFrontier.push(neighborIndex)
}

function getEdgeTransparency(
  red: number,
  green: number,
  blue: number,
  confidence: number,
  distance: number,
  keyRGB: RGB
): number {
  let edgeStrength: number
  if (distance <= 1) edgeStrength = 1
  else if (distance === 2) edgeStrength = 0.75
  else if (distance === 3) edgeStrength = 0.45
  else edgeStrength = 0.25
  const distanceEstimate = clamp01(((confidence - 0.08) / 0.84) * edgeStrength)
  const channelEstimate = getKeyChannelMix(red, green, blue, keyRGB) * edgeStrength
  return clamp01(Math.max(distanceEstimate, channelEstimate))
}

function getKeyChannelMix(red: number, green: number, blue: number, keyRGB: RGB): number {
  if (keyRGB.g === 255) return clamp01((green - Math.min(red, blue)) / 255)
  return clamp01((Math.min(red, blue) - green * 0.65) / 255)
}

function removeColorSpill(
  red: number,
  green: number,
  blue: number,
  alpha: number,
  keyRGB: RGB,
  confidence: number,
  distanceToBackground: number
): RGB {
  if (alpha === 0) return { r: red, g: green, b: blue }

  let edgeStrength: number
  if (distanceToBackground <= 0) {
    edgeStrength = confidence >= 0.46 ? 0.35 : 0
  } else if (distanceToBackground === 1) {
    edgeStrength = 0.55
  } else if (distanceToBackground === 2) {
    edgeStrength = 0.32
  } else {
    edgeStrength = 0.16
  }
  const spillMix = getKeyChannelMix(red, green, blue, keyRGB) * edgeStrength
  const backgroundMix = clamp01(
    Math.max((255 - alpha) / 255, ((confidence - 0.1) / 0.9) * edgeStrength, spillMix)
  )
  if (backgroundMix <= 0) return { r: red, g: green, b: blue }

  const foregroundMix = Math.max(0.08, 1 - backgroundMix)
  return {
    r: clampByte((red - keyRGB.r * backgroundMix) / foregroundMix),
    g: clampByte((green - keyRGB.g * backgroundMix) / foregroundMix),
    b: clampByte((blue - keyRGB.b * backgroundMix) / foregroundMix)
  }
}

// ── minimal PNG encoder/decoder（pi-backend 无 DOM/Canvas） ────────────────

interface DecodedPNG {
  width: number
  height: number
  /** 2 = RGB, 6 = RGBA */
  colorType: number
  /** Always RGBA after decoding（RGB expanded to RGBA） */
  data: Uint8ClampedArray
}

const PNG_SIGNATURE = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

interface PNGChunks {
  width: number
  height: number
  bitDepth: number
  colorType: number
  interlace: number
  idatData: Uint8Array
}

/** PNG chunk 遍历：解析 IHDR + 收集全部 IDAT（多 IDAT 拼接，spec §11.2.4），
 * 未知 ancillary chunk（sRGB/sBIT/gAMA/tEXt/iTXt 等）一律跳过不校验。 */
function walkPNGChunks(bytes: Uint8Array): PNGChunks {
  if (bytes.length < 8) throw new Error('Invalid PNG: header too short')
  for (let i = 0; i < 8; i += 1) {
    if (bytes[i] !== PNG_SIGNATURE[i]) throw new Error('Invalid PNG: bad signature')
  }

  let pos = 8
  let width = 0
  let height = 0
  let bitDepth = 0
  let colorType = 0
  let interlace = 0
  const idatChunks: Uint8Array[] = []

  while (pos < bytes.length) {
    const length = readUInt32BE(bytes, pos)
    const type = readChunkType(bytes, pos + 4)
    const dataStart = pos + 8
    const dataEnd = dataStart + length
    if (dataEnd + 4 > bytes.length) throw new Error(`Invalid PNG: chunk ${type} out of bounds`)

    if (type === 'IHDR') {
      if (length !== 13) throw new Error('Invalid PNG: IHDR length')
      width = readUInt32BE(bytes, dataStart)
      height = readUInt32BE(bytes, dataStart + 4)
      bitDepth = bytes[dataStart + 8] ?? 0
      colorType = bytes[dataStart + 9] ?? 0
      if ((bytes[dataStart + 10] ?? 0) !== 0 || (bytes[dataStart + 11] ?? 0) !== 0) {
        throw new Error('Unsupported PNG: non-zero compression/filter method')
      }
      interlace = bytes[dataStart + 12] ?? 0
    } else if (type === 'IDAT') {
      // 生产样本常见多 IDAT 分片（如 seedream 124×8KB 分片）
      idatChunks.push(bytes.subarray(dataStart, dataEnd))
    } else if (type === 'IEND') {
      break
    }
    // pos 推进 4 + length + 4（chunk header + data + CRC）
    pos = dataEnd + 4
  }

  return { width, height, bitDepth, colorType, interlace, idatData: concatBytes(idatChunks) }
}

/** 逐行 unfilter（PNG spec §9：0=None 1=Sub 2=Up 3=Average 4=Paeth）并展开为 RGBA */
function unfilterToRgba(
  inflated: Uint8Array,
  width: number,
  height: number,
  channels: number
): Uint8ClampedArray {
  const rowBytes = width * channels
  const expected = (rowBytes + 1) * height
  if (inflated.length !== expected) {
    throw new Error(
      `Invalid PNG: IDAT decompressed to ${inflated.length} bytes, expected ${expected}`
    )
  }

  const out = new Uint8ClampedArray(width * height * 4)
  for (let y = 0; y < height; y += 1) {
    const filterByte = inflated[y * (rowBytes + 1)] ?? 0
    applyRowFilter(inflated, y, rowBytes, channels, filterByte)
    for (let x = 0; x < width; x += 1) {
      const src = y * (rowBytes + 1) + 1 + x * channels
      const dst = (y * width + x) * 4
      out[dst] = inflated[src] ?? 0
      out[dst + 1] = inflated[src + 1] ?? 0
      out[dst + 2] = inflated[src + 2] ?? 0
      out[dst + 3] = channels === 4 ? (inflated[src + 3] ?? 255) : 255
    }
  }
  return out
}

function decodePNGRgba8(bytes: Uint8Array): DecodedPNG {
  const { width, height, bitDepth, colorType, interlace, idatData } = walkPNGChunks(bytes)

  if (width <= 0 || height <= 0) throw new Error('Invalid PNG: missing IHDR')
  if (bitDepth !== 8)
    throw new Error(`Unsupported PNG bit depth: ${bitDepth} (only 8-bit supported)`)
  if (colorType !== 2 && colorType !== 6) {
    throw new Error(`Unsupported PNG color type: ${colorType} (only RGB=2 / RGBA=6 supported)`)
  }
  // Adam7 隔行扫描的像素排列完全不同，静默解会产出垃圾图——必须抛错走回退
  if (interlace !== 0)
    throw new Error(`Unsupported PNG interlace: ${interlace} (Adam7 not supported)`)

  const channels = colorType === 6 ? 4 : 3
  const data = unfilterToRgba(inflateSync(idatData), width, height, channels)
  return { width, height, colorType, data }
}

/**
 * Apply PNG row filter in place. `buf` is the inflated IDAT stream; row y
 * starts at byte offset `y * (rowBytes + 1)`, where byte 0 is the filter type
 * and bytes 1..rowBytes are the scanline (potentially still filtered).
 * After this call, those rowBytes are the true pixel values.
 * Algorithm reference: PNG spec §9 (Filtering).
 */
function filterSubRow(buf: Uint8Array, rowStart: number, rowBytes: number, channels: number): void {
  for (let i = 0; i < rowBytes; i += 1) {
    const left = i >= channels ? (buf[rowStart + i - channels] ?? 0) : 0
    buf[rowStart + i] = ((buf[rowStart + i] ?? 0) + left) & 0xff
  }
}

function filterUpRow(
  buf: Uint8Array,
  rowStart: number,
  prevRowStart: number,
  rowBytes: number,
  hasPrev: boolean
): void {
  for (let i = 0; i < rowBytes; i += 1) {
    const up = hasPrev ? (buf[prevRowStart + i] ?? 0) : 0
    buf[rowStart + i] = ((buf[rowStart + i] ?? 0) + up) & 0xff
  }
}

function filterAverageRow(
  buf: Uint8Array,
  rowStart: number,
  prevRowStart: number,
  rowBytes: number,
  channels: number,
  hasPrev: boolean
): void {
  for (let i = 0; i < rowBytes; i += 1) {
    const left = i >= channels ? (buf[rowStart + i - channels] ?? 0) : 0
    const up = hasPrev ? (buf[prevRowStart + i] ?? 0) : 0
    buf[rowStart + i] = ((buf[rowStart + i] ?? 0) + Math.floor((left + up) / 2)) & 0xff
  }
}

function filterPaethRow(
  buf: Uint8Array,
  rowStart: number,
  prevRowStart: number,
  rowBytes: number,
  channels: number,
  hasPrev: boolean
): void {
  for (let i = 0; i < rowBytes; i += 1) {
    const left = i >= channels ? (buf[rowStart + i - channels] ?? 0) : 0
    const up = hasPrev ? (buf[prevRowStart + i] ?? 0) : 0
    const upLeft = hasPrev && i >= channels ? (buf[prevRowStart + i - channels] ?? 0) : 0
    buf[rowStart + i] = ((buf[rowStart + i] ?? 0) + paethPredictor(left, up, upLeft)) & 0xff
  }
}

function applyRowFilter(
  buf: Uint8Array,
  y: number,
  rowBytes: number,
  channels: number,
  filterByte: number
): void {
  const rowStart = y * (rowBytes + 1) + 1
  const prevRowStart = y > 0 ? (y - 1) * (rowBytes + 1) + 1 : 0
  switch (filterByte) {
    case 0:
      return
    case 1:
      filterSubRow(buf, rowStart, rowBytes, channels)
      return
    case 2:
      filterUpRow(buf, rowStart, prevRowStart, rowBytes, y > 0)
      return
    case 3:
      filterAverageRow(buf, rowStart, prevRowStart, rowBytes, channels, y > 0)
      return
    case 4:
      filterPaethRow(buf, rowStart, prevRowStart, rowBytes, channels, y > 0)
      return
    default:
      throw new Error(`Invalid PNG filter type: ${filterByte}`)
  }
}

function paethPredictor(a: number, b: number, c: number): number {
  const p = a + b - c
  const pa = Math.abs(p - a)
  const pb = Math.abs(p - b)
  const pc = Math.abs(p - c)
  if (pa <= pb && pa <= pc) return a
  if (pb <= pc) return b
  return c
}

function encodePNGRgba8(data: Uint8ClampedArray, width: number, height: number): Uint8Array {
  const channels = 4
  const rowBytes = width * channels
  // Prepend filter byte (0 = None) per scanline.
  const raw = new Uint8Array((rowBytes + 1) * height)
  for (let y = 0; y < height; y += 1) {
    raw[y * (rowBytes + 1)] = 0
    for (let x = 0; x < width; x += 1) {
      const src = (y * width + x) * 4
      const dst = y * (rowBytes + 1) + 1 + x * 4
      raw[dst] = data[src] ?? 0
      raw[dst + 1] = data[src + 1] ?? 0
      raw[dst + 2] = data[src + 2] ?? 0
      raw[dst + 3] = data[src + 3] ?? 0
    }
  }

  const compressed = deflateSync(raw)
  const ihdr = new Uint8Array(13)
  writeUInt32BE(ihdr, 0, width)
  writeUInt32BE(ihdr, 4, height)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // color type RGBA
  ihdr[10] = 0 // compression
  ihdr[11] = 0 // filter
  ihdr[12] = 0 // interlace

  const ihdrChunk = makeChunk('IHDR', ihdr)
  const idatChunk = makeChunk('IDAT', compressed)
  const iendChunk = makeChunk('IEND', new Uint8Array(0))

  const total = 8 + ihdrChunk.length + idatChunk.length + iendChunk.length
  const out = new Uint8Array(total)
  out.set(PNG_SIGNATURE, 0)
  let off = 8
  out.set(ihdrChunk, off)
  off += ihdrChunk.length
  out.set(idatChunk, off)
  off += idatChunk.length
  out.set(iendChunk, off)
  return out
}

// ── low-level PNG byte utilities ──────────────────────────────────────────

function readUInt32BE(bytes: Uint8Array, pos: number): number {
  return (
    ((bytes[pos] ?? 0) << 24) |
    ((bytes[pos + 1] ?? 0) << 16) |
    ((bytes[pos + 2] ?? 0) << 8) |
    (bytes[pos + 3] ?? 0)
  )
}

function writeUInt32BE(out: Uint8Array, pos: number, value: number): void {
  out[pos] = (value >>> 24) & 0xff
  out[pos + 1] = (value >>> 16) & 0xff
  out[pos + 2] = (value >>> 8) & 0xff
  out[pos + 3] = value & 0xff
}

function readChunkType(bytes: Uint8Array, pos: number): string {
  return String.fromCharCode(
    bytes[pos] ?? 0,
    bytes[pos + 1] ?? 0,
    bytes[pos + 2] ?? 0,
    bytes[pos + 3] ?? 0
  )
}

function makeChunk(type: string, data: Uint8Array): Uint8Array {
  const len = data.length
  const out = new Uint8Array(8 + len + 4)
  writeUInt32BE(out, 0, len)
  for (let i = 0; i < 4; i += 1) out[4 + i] = type.charCodeAt(i)
  out.set(data, 8)
  const crc = crc32(out.subarray(4, 8 + len))
  writeUInt32BE(out, 8 + len, crc)
  return out
}

/**
 * Standard CRC32 (PNG polynomial 0xedb88320). Pre-computed table for byte
 * chunks — small (~1KB), eliminates per-call polynomial arithmetic.
 */
const CRC_TABLE: Uint32Array = (() => {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n += 1) {
    let c = n
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    }
    table[n] = c >>> 0
  }
  return table
})()

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff
  for (const byte of bytes) {
    crc = (crc >>> 8) ^ (CRC_TABLE[(crc ^ byte) & 0xff] ?? 0)
  }
  return (crc ^ 0xffffffff) >>> 0
}

function concatBytes(chunks: Uint8Array[]): Uint8Array {
  let total = 0
  for (const chunk of chunks) total += chunk.length
  const out = new Uint8Array(total)
  let off = 0
  for (const chunk of chunks) {
    out.set(chunk, off)
    off += chunk.length
  }
  return out
}

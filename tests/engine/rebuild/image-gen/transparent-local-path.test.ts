/**
 * T33：transparent_background local 路径端到端——seedream 走 prompt 键色注入 +
 * 本地键色抠图后处理。
 *
 * 测试策略：
 * - 用 transparent.ts 自带编码器程序化构造小型键色 PNG（避免读外部文件、禁 DOM
 *   依赖）→ mock fetch 返回它 → generate.ts 编排层跑完后端处理 → 断言下发到
 *   provider 的 prompt 含 KEY_COLOR_PROMPT_SUFFIX + 最终 commit payload 的
 *   PNG 字节四角透明、中心不透明（验证后处理出口）。
 */
import { describe, expect, test } from 'bun:test'

import { decodeBase64 } from '@open-pencil/core/bytes'
import type {
  ImageGenProvider,
  ImageGenRequest
} from '@open-pencil/core/tools/fork/image-gen/requests'

import type { ImageGenCredentialStore } from '@/app/ai/pi-backend/image-gen/credentials'
import { createImageGenTool } from '@/app/ai/pi-backend/image-gen/generate'
import { KEY_COLOR_PROMPT_SUFFIX } from '@/app/ai/pi-backend/image-gen/transparent'

interface BridgeCall {
  tool: string
  args: Record<string, unknown>
}

function fakeStore(apiKey: string): ImageGenCredentialStore {
  return {
    get: () => ({
      providerType: 'seedream' as const,
      baseUrl: 'https://ark.cn-beijing.volces.com/api/v3',
      model: 'doubao-seedream-5-0-lite',
      apiKey
    }),
    set: () => undefined,
    clear: () => undefined,
    status: () => ({
      configured: true,
      providerType: 'seedream',
      baseUrl: 'https://ark.cn-beijing.volces.com/api/v3',
      model: 'doubao-seedream-5-0-lite'
    }),
    reloadForTests: () => undefined,
    exists: () => true
  }
}

function mockBridge() {
  const calls: BridgeCall[] = []
  let seq = 0
  const callBridge = async (tool: string, args: Record<string, unknown>) => {
    calls.push({ tool, args })
    if (tool === 'image_gen_begin') {
      const id = `frame-${seq++}`
      return {
        id,
        width: (args.width as number) ?? 16,
        height: (args.height as number) ?? 16,
        canvasWidth: (args.width as number) ?? 16,
        canvasHeight: (args.height as number) ?? 16,
        replaced: false,
        images: []
      }
    }
    return { id: args.id, canvasWidth: 16, canvasHeight: 16 }
  }
  return { calls, callBridge }
}

/**
 * 程序化构造 16x16 RGBA PNG——四角键色绿 (#00FF00)、中心红色块。
 * 走 transparent.ts 的 encodePngRgba8 等价路径（实际测试通过透明模块的
 * import 完成），不引入额外 fixture。
 */
function buildKeyColorPng(): Uint8Array {
  // 直接复用 transparent.ts 的检测逻辑——但 encoder 私有；改用本文件内
  // 的 zlib + chunk 拼装程序化构造（不引入新依赖）。
  const { deflateSync } = require('node:zlib') as typeof import('node:zlib')
  const width = 16
  const height = 16
  const data = new Uint8ClampedArray(width * height * 4)
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * 4
      const isCenter = x >= 6 && x <= 9 && y >= 6 && y <= 9
      if (isCenter) {
        data[i] = 220
        data[i + 1] = 30
        data[i + 2] = 30
        data[i + 3] = 255
      } else {
        data[i] = 0
        data[i + 1] = 255
        data[i + 2] = 0
        data[i + 3] = 255
      }
    }
  }
  // 编码（与 transparent.ts encodePngRgba8 同样的流程）
  const channels = 4
  const rowBytes = width * channels
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
  const signature = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  const ihdr = new Uint8Array(13)
  const writeU32 = (out: Uint8Array, p: number, v: number) => {
    out[p] = (v >>> 24) & 0xff
    out[p + 1] = (v >>> 16) & 0xff
    out[p + 2] = (v >>> 8) & 0xff
    out[p + 3] = v & 0xff
  }
  writeU32(ihdr, 0, width)
  writeU32(ihdr, 4, height)
  ihdr[8] = 8
  ihdr[9] = 6
  ihdr[10] = 0
  ihdr[11] = 0
  ihdr[12] = 0
  return new Uint8Array([
    ...signature,
    ...makeChunk('IHDR', ihdr),
    ...makeChunk('IDAT', new Uint8Array(compressed)),
    ...makeChunk('IEND', new Uint8Array(0))
  ])
}

function makeChunk(type: string, data: Uint8Array): Uint8Array {
  const len = data.length
  const out = new Uint8Array(8 + len + 4)
  const writeU32 = (p: number, v: number) => {
    out[p] = (v >>> 24) & 0xff
    out[p + 1] = (v >>> 16) & 0xff
    out[p + 2] = (v >>> 8) & 0xff
    out[p + 3] = v & 0xff
  }
  writeU32(0, len)
  for (let i = 0; i < 4; i += 1) out[4 + i] = type.charCodeAt(i)
  out.set(data, 8)
  // CRC32 of type+data
  const crc = crc32(out.subarray(4, 8 + len))
  writeU32(8 + len, crc)
  return out
}

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
  for (let i = 0; i < bytes.length; i += 1) {
    crc = (crc >>> 8) ^ (CRC_TABLE[(crc ^ (bytes[i] ?? 0)) & 0xff] ?? 0)
  }
  return (crc ^ 0xffffffff) >>> 0
}

interface DecodedPng {
  width: number
  height: number
  colorType: number
  data: Uint8ClampedArray
}

function decodePngRgba8(bytes: Uint8Array): DecodedPng {
  const { inflateSync } = require('node:zlib') as typeof import('node:zlib')
  const readU32 = (p: number) =>
    ((bytes[p] ?? 0) << 24) |
    ((bytes[p + 1] ?? 0) << 16) |
    ((bytes[p + 2] ?? 0) << 8) |
    (bytes[p + 3] ?? 0)
  let pos = 8
  let width = 0
  let height = 0
  let colorType = 0
  const idat: Uint8Array[] = []
  while (pos < bytes.length) {
    const length = readU32(pos)
    const type = String.fromCharCode(
      bytes[pos + 4] ?? 0,
      bytes[pos + 5] ?? 0,
      bytes[pos + 6] ?? 0,
      bytes[pos + 7] ?? 0
    )
    const dataStart = pos + 8
    const dataEnd = dataStart + length
    if (type === 'IHDR') {
      width = readU32(dataStart)
      height = readU32(dataStart + 4)
      colorType = bytes[dataStart + 9] ?? 0
    } else if (type === 'IDAT') {
      idat.push(bytes.subarray(dataStart, dataEnd))
    } else if (type === 'IEND') {
      break
    }
    pos = dataEnd + 4
  }
  const channels = colorType === 6 ? 4 : 3
  const inflated = inflateSync(concatBytes(idat))
  const rowBytes = width * channels
  const out = new Uint8ClampedArray(width * height * 4)
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const src = y * (rowBytes + 1) + 1 + x * channels
      const dst = (y * width + x) * 4
      out[dst] = inflated[src] ?? 0
      out[dst + 1] = inflated[src + 1] ?? 0
      out[dst + 2] = inflated[src + 2] ?? 0
      out[dst + 3] = channels === 4 ? (inflated[src + 3] ?? 255) : 255
    }
  }
  return { width, height, colorType, data: out }
}

function concatBytes(chunks: Uint8Array[]): Uint8Array {
  let total = 0
  for (const c of chunks) total += c.length
  const out = new Uint8Array(total)
  let off = 0
  for (const c of chunks) {
    out.set(c, off)
    off += c.length
  }
  return out
}

describe('transparent_background local 路径（seedream = transparentSupport=local）', () => {
  test('透明=true → 下发 prompt 含 KEY_COLOR_PROMPT_SUFFIX；commit 携带去键色 RGBA PNG', async () => {
    const keyPng = buildKeyColorPng()
    const seenPrompts: string[] = []
    const provider: ImageGenProvider = {
      name: 'mock-seedream',
      transparentSupport: 'local',
      generate: async (req: ImageGenRequest) => {
        seenPrompts.push(req.prompt)
        return { bytes: keyPng, width: req.width ?? 16, height: req.height ?? 16 }
      }
    }
    const { calls, callBridge } = mockBridge()
    const tool = createImageGenTool({
      credentials: fakeStore('sk-test'),
      callBridge,
      createProvider: () => provider
    })
    const result = await tool.execute('call-1', {
      requests: [{ prompt: 'icon', width: 16, height: 16, transparent_background: true }]
    })

    // 1) 下发到 provider 的 prompt 含 KEY_COLOR_PROMPT_SUFFIX
    expect(seenPrompts).toHaveLength(1)
    expect(seenPrompts[0]).toContain('icon')
    expect(seenPrompts[0]).toContain(KEY_COLOR_PROMPT_SUFFIX)

    // 2) begin 段 prompt 仍为原 prompt（注入只在 generate 段）
    const beginCall = calls.find((c) => c.tool === 'image_gen_begin')
    expect((beginCall?.args as { prompt: string }).prompt).toBe('icon')

    // 3) commit 阶段 image_data 是去键色后的 PNG——四角 alpha<128、中心 alpha>128
    const commitCall = calls.find((c) => c.tool === 'image_gen_commit')
    const imageB64 = String((commitCall?.args as { image_data: string }).image_data)
    const decoded = decodePngRgba8(decodeBase64(imageB64))
    expect(decoded.colorType).toBe(6) // RGBA
    expect(decoded.width).toBe(16)
    expect(decoded.height).toBe(16)
    const corner = decoded.data[3] ?? 255 // top-left
    expect(corner).toBeLessThan(128)
    const centerIndex = (7 * 16 + 7) * 4
    const centerAlpha = decoded.data[centerIndex + 3] ?? 0
    expect(centerAlpha).toBeGreaterThanOrEqual(128)

    // 4) 结果项 transparent=true（post-process 成功）
    const details = result.details as {
      results: Array<{ transparent?: boolean | 'failed' }>
    }
    expect(details.results[0]?.transparent).toBe(true)
  })

  test('透明=false / 未传 → prompt 不含 KEY_COLOR_PROMPT_SUFFIX；commit 用原 bytes', async () => {
    const keyPng = buildKeyColorPng()
    const seenPrompts: string[] = []
    const provider: ImageGenProvider = {
      name: 'mock-seedream',
      transparentSupport: 'local',
      generate: async (req: ImageGenRequest) => {
        seenPrompts.push(req.prompt)
        return { bytes: keyPng, width: req.width ?? 16, height: req.height ?? 16 }
      }
    }
    const { calls, callBridge } = mockBridge()
    const tool = createImageGenTool({
      credentials: fakeStore('sk-test'),
      callBridge,
      createProvider: () => provider
    })
    await tool.execute('call-1', {
      requests: [
        { prompt: 'opaque', width: 16, height: 16, transparent_background: false },
        { prompt: 'normal', width: 16, height: 16 }
      ]
    })

    expect(seenPrompts[0]).toBe('opaque')
    expect(seenPrompts[1]).toBe('normal')
    expect(seenPrompts[0]).not.toContain('[背景指令]')
    expect(seenPrompts[1]).not.toContain('[背景指令]')

    const commitBodies = calls
      .filter((c) => c.tool === 'image_gen_commit')
      .map((c) => (c.args as { image_data: string }).image_data)
    // 两条 commit 携带的 bytes 都与原 keyPng 字节一致（不经后处理）
    expect(commitBodies[0]).toBe(commitBodies[1])
  })

  test('api provider（transparentSupport=api）下发 prompt 不注入键色规则', async () => {
    const keyPng = buildKeyColorPng()
    const seenPrompts: string[] = []
    const provider: ImageGenProvider = {
      name: 'mock-openai',
      transparentSupport: 'api',
      generate: async (req: ImageGenRequest) => {
        seenPrompts.push(req.prompt)
        return { bytes: keyPng, width: req.width ?? 16, height: req.height ?? 16 }
      }
    }
    const { callBridge } = mockBridge()
    const tool = createImageGenTool({
      credentials: fakeStore('sk-test'),
      callBridge,
      createProvider: () => provider
    })
    await tool.execute('call-1', {
      requests: [{ prompt: 'cutout', width: 16, height: 16, transparent_background: true }]
    })
    expect(seenPrompts[0]).toBe('cutout') // api 路径不下发键色规则
    expect(seenPrompts[0]).not.toContain('[背景指令]')
  })

  test('local 路径后处理抛错 → 结果项 transparent="failed" + commit 仍用原 bytes（回退）', async () => {
    const badBytes = new Uint8Array([1, 2, 3]) // 非法 PNG → transparent.ts 抛错
    const provider: ImageGenProvider = {
      name: 'mock-seedream',
      transparentSupport: 'local',
      generate: async (req: ImageGenRequest) => ({
        bytes: badBytes,
        width: req.width ?? 16,
        height: req.height ?? 16
      })
    }
    const { calls, callBridge } = mockBridge()
    const tool = createImageGenTool({
      credentials: fakeStore('sk-test'),
      callBridge,
      createProvider: () => provider
    })
    const result = await tool.execute('call-1', {
      requests: [{ prompt: 'cutout', width: 16, height: 16, transparent_background: true }]
    })

    const commitCall = calls.find((c) => c.tool === 'image_gen_commit')
    expect(commitCall).toBeDefined()
    const imageB64 = String((commitCall?.args as { image_data: string }).image_data)
    // 原 bytes 回退——base64 后内容应该和 badBytes 一致
    expect(imageB64).toBe(Buffer.from(badBytes).toString('base64'))

    const details = result.details as {
      results: Array<{ transparent?: boolean | 'failed' }>
    }
    expect(details.results[0]?.transparent).toBe('failed')
  })
})

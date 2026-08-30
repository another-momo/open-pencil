import { describe, expect, test } from 'bun:test'

import type { CanvasKit, TypefaceFontProvider } from 'canvaskit-wasm'

import { FontManager } from '@open-pencil/core/text'

import {
  CN_FONT_MAX_PIECES_PER_REQUEST,
  CnFontSubsetResolver,
  formatUnicodeRanges,
  parseCnFontResultCSS,
  parseUnicodeRanges,
  pickCnFontSubfamily,
  selectCnFontPieces,
  subfamilyDirWeight,
  type CnFontPieceCache
} from '#core/text/web-font/cn-fonts'

const CSS_URL =
  'https://cdn.jsdelivr.net/npm/@chinese-fonts/mock@latest/dist/Mock-Regular/result.css'

const FIXTURE_CSS = `
@font-face{font-family:"Mock Kai";src:local("Mock Kai"),url("./aaaa1111.woff2")format("woff2");font-style:normal;font-display:swap;font-weight:400;unicode-range:U+4E00-4E7F,U+FF0C;}
@font-face{font-family:"Mock Kai";src:url("./bbbb2222.woff2")format("woff2");font-style:normal;font-weight:400;unicode-range:U+4E80-4FFF;}
@font-face{font-family:"Mock Kai";src:url("./cccc3333.woff2")format("woff2");font-style:normal;font-weight:700;unicode-range:U+4E00-4FFF;}
@font-face{font-family:"Mock Kai";src:url("./dddd4444.woff2")format("woff2");font-style:italic;font-weight:400;unicode-range:U+41-5A,U+4??;}
@font-face{font-family:"Mock Kai";src:url("./eeee5555.woff2")format("woff2");font-style:normal;font-weight:400;unicode-range:U+5900-59FF;}
`

function pieceURL(name: string): string {
  return `https://cdn.jsdelivr.net/npm/@chinese-fonts/mock@latest/dist/Mock-Regular/${name}`
}

describe('parseUnicodeRanges', () => {
  test('parses single values, intervals and wildcards', () => {
    expect(parseUnicodeRanges('U+4E2D')).toEqual([[0x4e2d, 0x4e2d]])
    expect(parseUnicodeRanges('U+4E00-9FFF')).toEqual([[0x4e00, 0x9fff]])
    expect(parseUnicodeRanges('U+4??')).toEqual([[0x400, 0x4ff]])
    expect(parseUnicodeRanges('U+30F5F,U+30F7C-30F7D, U+FF0C')).toEqual([
      [0x30f5f, 0x30f5f],
      [0x30f7c, 0x30f7d],
      [0xff0c, 0xff0c]
    ])
    expect(parseUnicodeRanges('garbage')).toEqual([])
  })

  test('formatUnicodeRanges round-trips parsed ranges for FontFace descriptors', () => {
    expect(
      formatUnicodeRanges([
        [0x4e00, 0x9fff],
        [0xff0c, 0xff0c]
      ])
    ).toBe('U+4E00-9FFF, U+FF0C')
  })
})

describe('subfamilyDirWeight / pickCnFontSubfamily', () => {
  test('infers weight from directory suffix, longest token first', () => {
    expect(subfamilyDirWeight('LXGWWenKaiMono-Light')).toBe(300)
    expect(subfamilyDirWeight('Yozai-ExtraBold')).toBe(800)
    expect(subfamilyDirWeight('ChillRoundFBold')).toBe(700)
    expect(subfamilyDirWeight('SourceHanSerifCN')).toBeNull()
  })

  test('picks exact weight, then nearest, excluding mono for proportional families', () => {
    const dirs = [
      'LXGWWenKai-Light',
      'LXGWWenKai-Medium',
      'LXGWWenKai-Regular',
      'LXGWWenKaiMono-Light',
      'LXGWWenKaiMono-Regular'
    ]
    expect(pickCnFontSubfamily(dirs, 400, 'LXGW WenKai')).toBe('LXGWWenKai-Regular')
    expect(pickCnFontSubfamily(dirs, 500, 'LXGW WenKai')).toBe('LXGWWenKai-Medium')
    // 请求 600（SemiBold）无精确命中 → 最近邻 Medium(500)，且不得选 Mono
    expect(pickCnFontSubfamily(dirs, 600, 'LXGW WenKai')).toBe('LXGWWenKai-Medium')
    expect(pickCnFontSubfamily(dirs, 300, 'LXGW WenKai Mono')).toBe('LXGWWenKaiMono-Light')
    // 无字重后缀的单字重包：回退第一个候选
    expect(pickCnFontSubfamily(['SourceHanSerifCN'], 400, 'Source Han Serif CN')).toBe(
      'SourceHanSerifCN'
    )
    expect(pickCnFontSubfamily([], 400, 'X')).toBeNull()
  })
})

describe('parseCnFontResultCSS / selectCnFontPieces', () => {
  const pieces = parseCnFontResultCSS(FIXTURE_CSS, CSS_URL)

  test('parses font-face blocks with absolute piece URLs', () => {
    expect(pieces).toHaveLength(5)
    expect(pieces[0].url).toBe(pieceURL('aaaa1111.woff2'))
    expect(pieces[0].weight).toBe(400)
    expect(pieces[0].italic).toBe(false)
    expect(pieces[3].italic).toBe(true)
  })

  test('selects covering pieces per character with weight and italic filtering', () => {
    // 你 U+4F60 → bbbb（400）；中 U+4E2D → aaaa；，U+FF0C → aaaa
    expect(selectCnFontPieces(pieces, '你中，', 400, false).map((p) => p.url)).toEqual([
      pieceURL('bbbb2222.woff2'),
      pieceURL('aaaa1111.woff2')
    ])
    // Bold 你 → cccc（700 片覆盖全区间）
    expect(selectCnFontPieces(pieces, '你', 700, false).map((p) => p.url)).toEqual([
      pieceURL('cccc3333.woff2')
    ])
    // italic A → dddd（U+41-5A + 通配 U+4??）
    expect(selectCnFontPieces(pieces, 'A', 400, true).map((p) => p.url)).toEqual([
      pieceURL('dddd4444.woff2')
    ])
    // 无覆盖字符 → 空
    expect(selectCnFontPieces(pieces, '✈', 400, false)).toEqual([])
  })
})

interface MockFetch {
  calls: string[]
  fetcher: (url: string) => Promise<Response>
}

/**
 * unifont provider 初始化会拉 fonts.google.com/metadata/fonts 与
 * api.fontsource.org/v1/fonts，失败时内部按 1s 退避重试 3 次（单测会超时）。
 * mock 直接回空清单让其快速初始化成功；其余未知 URL 一律 404。
 */
function createMockFetch(
  options: { failWoff2?: boolean; css?: string; packages?: string[] } = {}
): MockFetch {
  const calls: string[] = []
  const css = options.css ?? FIXTURE_CSS
  const packages = options.packages ?? ['@chinese-fonts/mock']
  return {
    calls,
    fetcher: async (url: string) => {
      calls.push(url)
      if (url.includes('fonts.google.com/metadata/fonts')) {
        return new Response(JSON.stringify({ familyMetadataList: [] }), {
          status: 200
        })
      }
      if (url.includes('api.fontsource.org/v1/fonts')) {
        return new Response('[]', { status: 200 })
      }
      // unifont resolveFont 的 css2/单族 API 返回空 200：避免 404 触发 1s×3 退避重试
      if (url.includes('fonts.googleapis.com/css2')) return new Response('', { status: 200 })
      if (url.includes('api.fontsource.org')) return new Response('{}', { status: 200 })
      if (packages.some((name) => url.includes(`/npm/${name}@`))) {
        if (url.endsWith('/dist/index.json')) {
          return new Response(JSON.stringify(['Mock-Regular']), {
            status: 200
          })
        }
        if (url.endsWith('/result.css')) return new Response(css, { status: 200 })
        if (url.endsWith('.woff2')) {
          if (options.failWoff2) return new Response('nope', { status: 404 })
          return new Response(new Uint8Array([1, 2, 3, 4]), { status: 200 })
        }
      }
      return new Response('not found', { status: 404 })
    }
  }
}

describe('CnFontSubsetResolver', () => {
  const descriptor = { package: '@chinese-fonts/mock' }

  test('fetches only the pieces covering the demanded characters', async () => {
    const mock = createMockFetch()
    const resolver = new CnFontSubsetResolver({ fetcher: mock.fetcher })
    const result = await resolver.fetch('Mock Kai', descriptor, 'Regular', '你中')

    expect(result).not.toBeNull()
    expect(result?.pieces).toHaveLength(2)
    expect(result?.coveredCharacters.sort()).toEqual(['中', '你'])
    // index.json + result.css + 2 片，共 4 次网络
    expect(mock.calls).toHaveLength(4)
    expect(mock.calls.filter((url) => url.endsWith('.woff2'))).toEqual([
      pieceURL('bbbb2222.woff2'),
      pieceURL('aaaa1111.woff2')
    ])
  })

  test('incremental characters only fetch new pieces; session caches css and pieces', async () => {
    const mock = createMockFetch()
    const resolver = new CnFontSubsetResolver({ fetcher: mock.fetcher })
    await resolver.fetch('Mock Kai', descriptor, 'Regular', '你')
    const afterFirst = mock.calls.length

    // 好 U+597D → eeee 新片；你 已在 piecePromises 缓存，零网络
    const second = await resolver.fetch('Mock Kai', descriptor, 'Regular', '你好')
    expect(second?.coveredCharacters.sort()).toEqual(['你', '好'])
    const newCalls = mock.calls.slice(afterFirst)
    expect(newCalls.filter((url) => url.endsWith('.woff2'))).toEqual([pieceURL('eeee5555.woff2')])
    expect(newCalls.filter((url) => url.endsWith('result.css'))).toEqual([])
  })

  test('piece cache serves bytes without network', async () => {
    const store = new Map<string, ArrayBuffer>()
    const cache: CnFontPieceCache = {
      read: async (url) => store.get(url) ?? null,
      write: async (url, data) => void store.set(url, data)
    }
    const mock = createMockFetch()
    const first = new CnFontSubsetResolver({ fetcher: mock.fetcher, cache })
    await first.fetch('Mock Kai', descriptor, 'Regular', '你')

    // 全新 resolver（无会话缓存）+ 同一磁盘缓存：CSS 要重抓，woff2 不抓
    const fresh = new CnFontSubsetResolver({ fetcher: mock.fetcher, cache })
    const result = await fresh.fetch('Mock Kai', descriptor, 'Regular', '你')
    expect(result?.pieces).toHaveLength(1)
    const woff2Calls = mock.calls.filter((url) => url.endsWith('.woff2'))
    expect(woff2Calls).toHaveLength(1) // 仅第一次真实抓取
  })

  test('returns null when the package or coverage is missing, never throws', async () => {
    const mock = createMockFetch()
    const resolver = new CnFontSubsetResolver({ fetcher: mock.fetcher })

    expect(
      await resolver.fetch('Ghost', { package: '@chinese-fonts/ghost' }, 'Regular', '你')
    ).toBeNull()
    expect(await resolver.fetch('Mock Kai', descriptor, 'Regular', '✈')).toBeNull()

    // 全部片 404 → pieces 为空，coveredCharacters 为空
    const failing = new CnFontSubsetResolver({
      fetcher: createMockFetch({ failWoff2: true }).fetcher
    })
    const result = await failing.fetch('Mock Kai', descriptor, 'Regular', '你')
    expect(result).not.toBeNull()
    expect(result?.pieces).toEqual([])
    expect(result?.coveredCharacters).toEqual([])
  })

  test('refuses pathological piece counts above the anomaly threshold', async () => {
    const count = CN_FONT_MAX_PIECES_PER_REQUEST + 1
    const blocks: string[] = []
    let characters = ''
    for (let index = 0; index < count; index++) {
      const codePoint = 0x1000 + index
      characters += String.fromCodePoint(codePoint)
      blocks.push(
        `@font-face{font-family:"Mock Kai";src:url("./p${index}.woff2")format("woff2");font-weight:400;unicode-range:U+${codePoint.toString(16).toUpperCase()};}`
      )
    }
    const resolver = new CnFontSubsetResolver({
      fetcher: createMockFetch({ css: blocks.join('\n') }).fetcher
    })
    expect(await resolver.fetch('Mock Kai', descriptor, 'Regular', characters)).toBeNull()
  })
})

describe('FontManager cn-font routing (T40 S4)', () => {
  test('registry CDN family loads through cn-font resolver with cdn source and coverage', async () => {
    const manager = new FontManager()
    const mock = createMockFetch({ packages: ['@chinese-fonts/lxgwwenkai'] })
    manager.setWebFontFetch(mock.fetcher)
    // 隔离应用侧 P117 接线可能装进单例 resolver 的磁盘缓存：网络行为断言只认 mock
    manager.setCnFontPieceCache(null)

    // 注册表家族 LXGW WenKai 的 descriptor 指到 @chinese-fonts/lxgwwenkai，
    // 本用例把 mock 的 index/css 挂到该包路径下验证路由本身
    const buffer = await manager.loadRemoteFont('LXGW WenKai', 'Regular', '你')
    expect(buffer).not.toBeNull()
    expect(manager.loadedFontSource('LXGW WenKai', 'Regular')).toBe('cdn')
    expect(manager.isStyleLoaded('LXGW WenKai', 'Regular')).toBe(true)
    expect(manager.remoteStyleNeedsCoverage('LXGW WenKai', 'Regular', ['你'])).toBe(false)
    expect(manager.remoteStyleNeedsCoverage('LXGW WenKai', 'Regular', ['好'])).toBe(true)
    // 路由只走 cn-font：无任何 unifont provider 请求
    expect(mock.calls.some((url) => url.includes('fonts.googleapis.com'))).toBe(false)
    manager.evictFont('LXGW WenKai', 'Regular')
  })

  test('cdn failure falls back to the unifont provider chain', async () => {
    const manager = new FontManager()
    // cn-font 片全 404 → 回本链；unifont 各 provider 拿到快速空响应 → 最终 null
    const mock = createMockFetch({
      packages: ['@chinese-fonts/lxgwwenkai'],
      failWoff2: true
    })
    manager.setWebFontFetch(mock.fetcher)
    // 隔离应用侧 P117 接线可能装进单例 resolver 的磁盘缓存：网络行为断言只认 mock
    manager.setCnFontPieceCache(null)

    const buffer = await manager.loadRemoteFont('LXGW WenKai', 'Regular', '你')
    expect(buffer).toBeNull()
    expect(mock.calls.some((url) => url.includes('lxgwwenkai'))).toBe(true)
    expect(
      mock.calls.some((url) => url.includes('fonts.googleapis.com') || url.includes('fontsource'))
    ).toBe(true)
  }, 15000)

  test('unreachable provider does not block the family list (T40 S2 配套)', async () => {
    const manager = new FontManager()
    manager.setWebFontListTimeout(50)
    manager.setWebFontFetch(async (url) => {
      // google 元数据永不返回（模拟不可达）；其余快速失败
      if (url.includes('fonts.google.com')) {
        return new Promise<Response>(() => {
          // 永不 resolve：模拟不可达 provider
        })
      }
      if (url.includes('api.fontsource.org/v1/fonts')) return new Response('[]', { status: 200 })
      return new Response('not found', { status: 404 })
    })

    const started = Date.now()
    const options = await manager.listFamilyOptions()
    expect(Date.now() - started).toBeLessThan(5000)
    expect(options.some((option) => option.family === 'Inter')).toBe(true)
    expect(
      options.some((option) => option.family === 'LXGW WenKai' && option.source === 'cdn')
    ).toBe(true)
  })

  test('non-registry families keep the unifont path; CDN hidden when providers disabled', async () => {
    const manager = new FontManager()
    const mock = createMockFetch()
    manager.setWebFontFetch(mock.fetcher)
    // 隔离应用侧 P117 接线可能装进单例 resolver 的磁盘缓存：网络行为断言只认 mock
    manager.setCnFontPieceCache(null)

    const options = await manager.listFamilyOptions()
    const cdn = options.filter((option) => option.source === 'cdn').map((option) => option.family)
    expect(cdn).toEqual(
      expect.arrayContaining([
        'LXGW WenKai',
        'Xiaolai SC',
        'Yozai',
        'MaokenAssortedSans',
        '寒蝉全圆体'
      ])
    )
    expect(options.find((option) => option.family === 'Inter')?.source).toBe('bundled')

    // 关停全部在线 provider → CDN 家族从枚举隐藏（在线能力同一隐私开关）
    manager.setOnlineFontProviders({ google: false, fontsource: false })
    const offline = await manager.listFamilyOptions()
    expect(offline.some((option) => option.source === 'cdn')).toBe(false)
    expect(offline.some((option) => option.family === 'Inter')).toBe(true)

    // 在线全关时 CDN 家族 loadRemoteFont 不触网
    const before = mock.calls.length
    expect(await manager.loadRemoteFont('LXGW WenKai', 'Regular', '你')).toBeNull()
    expect(mock.calls.slice(before).some((url) => url.includes('lxgwwenkai'))).toBe(false)
    manager.setOnlineFontProviders({ google: true, fontsource: true })
  })
})

describe('FontManager cn-font render aliases (T40 同名塌缩修复)', () => {
  function mockProvider() {
    const registrations: Array<{ family: string; bytes: number }> = []
    const provider = {
      registerFont(data: ArrayBuffer, family: string) {
        registrations.push({ family, bytes: data.byteLength })
      }
    } as TypefaceFontProvider
    return { provider, registrations }
  }

  test('each piece registers under a unique alias plus one real-name primary', async () => {
    const manager = new FontManager()
    const { provider, registrations } = mockProvider()
    manager.attachProvider({} as CanvasKit, provider)
    const mock = createMockFetch({ packages: ['@chinese-fonts/lxgwwenkai'] })
    manager.setWebFontFetch(mock.fetcher)
    // 隔离应用侧 P117 接线可能装进单例 resolver 的磁盘缓存：网络行为断言只认 mock
    manager.setCnFontPieceCache(null)

    // 你 U+4F60 → bbbb 片；中 U+4E2D → aaaa 片
    await manager.loadRemoteFont('LXGW WenKai', 'Regular', '你中')
    const aliases = manager.renderFamilyAliases('LXGW WenKai', 'Regular')
    expect(aliases).toHaveLength(2)
    expect(new Set(aliases).size).toBe(2)
    for (const alias of aliases) {
      expect(alias.startsWith('LXGW WenKai')).toBe(true)
      expect(alias).not.toBe('LXGW WenKai')
    }

    const families = registrations.map((registration) => registration.family)
    // 同名只注册一次（primary）：互斥分片挂同名会被 CanvasKit 塌缩成单 typeface
    expect(families.filter((family) => family === 'LXGW WenKai')).toHaveLength(1)
    expect(families.slice(1).sort()).toEqual([...aliases].sort())
    manager.evictFont('LXGW WenKai', 'Regular')
  })

  test('incremental loads register only new pieces; bytes account every piece once', async () => {
    const manager = new FontManager()
    const { provider, registrations } = mockProvider()
    manager.attachProvider({} as CanvasKit, provider)
    const mock = createMockFetch({ packages: ['@chinese-fonts/lxgwwenkai'] })
    manager.setWebFontFetch(mock.fetcher)
    // 隔离应用侧 P117 接线可能装进单例 resolver 的磁盘缓存：网络行为断言只认 mock
    manager.setCnFontPieceCache(null)

    await manager.loadRemoteFont('LXGW WenKai', 'Regular', '你')
    expect(manager.renderFamilyAliases('LXGW WenKai', 'Regular')).toHaveLength(1)
    expect(manager.fontMemoryStats().loadedBytes).toBe(4)
    const afterFirst = registrations.length

    // 增量 '好' → 请求合并累计覆盖（你好），bbbb 片按 url 去重不重复注册
    await manager.loadRemoteFont('LXGW WenKai', 'Regular', '好')
    expect(manager.renderFamilyAliases('LXGW WenKai', 'Regular')).toHaveLength(2)
    expect(registrations.length - afterFirst).toBe(1)
    expect(registrations.at(-1)?.family).not.toBe('LXGW WenKai')
    expect(manager.fontMemoryStats().loadedBytes).toBe(8)
    manager.evictFont('LXGW WenKai', 'Regular')
  })

  test('attachProvider replays aliases instead of real-name supplementals; eviction clears', async () => {
    const manager = new FontManager()
    const mock = createMockFetch({ packages: ['@chinese-fonts/lxgwwenkai'] })
    manager.setWebFontFetch(mock.fetcher)
    // 隔离应用侧 P117 接线可能装进单例 resolver 的磁盘缓存：网络行为断言只认 mock
    manager.setCnFontPieceCache(null)
    await manager.loadRemoteFont('LXGW WenKai', 'Regular', '你中')
    const aliases = manager.renderFamilyAliases('LXGW WenKai', 'Regular')

    const { provider: second, registrations } = mockProvider()
    manager.attachProvider({} as CanvasKit, second)
    const families = registrations.map((registration) => registration.family)
    expect(families.filter((family) => family === 'LXGW WenKai')).toHaveLength(1)
    expect(families.slice(1).sort()).toEqual([...aliases].sort())

    manager.evictFont('LXGW WenKai', 'Regular')
    expect(manager.renderFamilyAliases('LXGW WenKai', 'Regular')).toEqual([])
  })
})

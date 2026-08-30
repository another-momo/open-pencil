import type { CanvasKit, TypefaceFontProvider } from 'canvaskit-wasm'

import type { SceneGraph } from '@open-pencil/scene-graph'

import { hasWindowGlobal, IS_BROWSER } from '#core/constants'
import { FontMemoryLedger } from '#core/text/font/memory'
import type { FontMemoryStats } from '#core/text/font/memory'
import { cdnFontEntry, FONT_REGISTRY, isBundledFamilyAllowed } from '#core/text/font/registry'
import {
  chooseLocalFontMatch,
  isVariableFont,
  normalizeFontFamily,
  styleToWeight,
  weightToStyle
} from '#core/text/font/style'

export * from '#core/text/font/sources'
export * from '#core/text/font/style'
export * from '#core/text/font/memory'
import { fontFallbackEntry } from '#core/text/fallbacks'
import type { FontFallbackScript } from '#core/text/fallbacks'
import type {
  DownloadedFontCache,
  FontFamilyOption,
  FontInfo,
  FontLoadedSource,
  HostFontLoader,
  LocalFontAccessState
} from '#core/text/font/sources'
import { collectGraphFontKeys } from '#core/text/requirements'
import { cnFontSubsetResolver, formatUnicodeRanges } from '#core/text/web-font/cn-fonts'
import type { CnFontPieceCache } from '#core/text/web-font/cn-fonts'
import { normalizedCoverageText, WebFontResolver } from '#core/text/web-fonts'
import type { WebFontFetch, WebFontProviderId } from '#core/text/web-fonts'

type FindLocalFontOptions = { allowVariable?: boolean }

/** bundled 字体清单：键 = 'Family|Style'，值 = public/ 与 assets/ 双份同名路径。 */
const BUNDLED_FONTS: Record<string, string> = {
  'Inter|Regular': '/Inter-Regular.ttf',
  'Inter|Medium': '/Inter-Medium.ttf',
  'Inter|SemiBold': '/Inter-SemiBold.ttf',
  'Inter|Bold': '/Inter-Bold.ttf',
  'Inter|ExtraBold': '/Inter-ExtraBold.ttf',
  'Noto Naskh Arabic|Regular': '/NotoNaskhArabic-Regular.ttf'
}

// Alibaba PuHuiTi 9 字重（T39，CJK 骨干）：从注册表派生避免双源漂移。
for (const weight of FONT_REGISTRY.find((e) => e.family === 'Alibaba PuHuiTi')?.weights ?? []) {
  BUNDLED_FONTS[`Alibaba PuHuiTi|${weight}`] = `/AlibabaPuHuiTi-${weight}.ttf`
}

/**
 * JS 侧字体字节默认预算（T40 S1，13 册 §3 策略 A）：超预算按 LRU 逐出 JS 引用。
 * CanvasKit 无法注销已注册 typeface，WASM 侧残留 2-10MB 属预期；逐出键会联动
 * fontResolver.reset（见 onFontEvicted），下次引用时经 demand 链重载。
 */
export const DEFAULT_FONT_MEMORY_BUDGET = 50 * 1024 * 1024

/**
 * CDN 子集分片的渲染 alias 分隔符（T40 修复）：CanvasKit TypefaceFontProvider 对同一
 * family 名只保留单个 style 匹配 typeface，互斥覆盖的分片挂同名会塌缩成「只有一片有字形」。
 * 每片各持别名注册，排版时经 fontFamilies 回退链合流（probe 实证：18/18 glyph、0 notdef）。
 */
const CN_FONT_ALIAS_SEPARATOR = '\u001F'

interface RenderAliasEntry {
  url: string
  alias: string
  data: ArrayBuffer
}

export class FontManager {
  private loadedFamilies = new Map<string, ArrayBuffer>()
  private loadedFamilySources = new Map<string, FontLoadedSource>()
  private supplementalFamilyData = new Map<string, ArrayBuffer[]>()
  private remoteCoverage = new Map<string, Set<string>>()
  private blockedNodeIds = new Set<string>()
  private fontProvider: TypefaceFontProvider | null = null
  private fontProviders = new Set<TypefaceFontProvider>()
  private registrationGeneration = 0
  private providerRegistrations = new WeakMap<TypefaceFontProvider, Map<string, Set<ArrayBuffer>>>()
  private localFonts: FontInfo[] | null = null
  private localFontAccessState: LocalFontAccessState = IS_BROWSER ? 'prompt' : 'unsupported'
  private downloadedFontCache: DownloadedFontCache | null = null
  private fallbackUserAgent: string | undefined
  private hostFontLoader: HostFontLoader | null = null
  private webFonts = new WebFontResolver()
  private cjkFallbackFamilies: string[] = []
  private cjkFallbackPromise: Promise<string[]> | null = null
  private arabicFallbackFamilies: string[] = []
  private arabicFallbackPromise: Promise<string[]> | null = null
  private readonly fontMemory = new FontMemoryLedger()
  private fontMemoryBudget = DEFAULT_FONT_MEMORY_BUDGET
  private fontEvictions = 0
  private browserFontFaces = new Map<string, FontFace[]>()
  private fontEvictListener: ((family: string, style: string) => void) | null = null
  /** CDN 键的分片 alias 注册表：键 = 'Family|Style'，条目按注册顺序（alias 序即回退链序） */
  private renderAliasFamilies = new Map<string, RenderAliasEntry[]>()

  attachProvider(_canvasKit: CanvasKit, provider: TypefaceFontProvider): void {
    this.fontProviders.add(provider)
    this.fontProvider = provider
    this.providerRegistrations.set(provider, new Map())
    this.registrationGeneration++
    for (const [cacheKey, data] of this.loadedFamilies) {
      const separator = cacheKey.indexOf('|')
      const family = cacheKey.slice(0, separator)
      this.registerFontInProvider(provider, family, data)
      const aliases = this.renderAliasFamilies.get(cacheKey)
      if (aliases) {
        // CDN 键：补充片（互斥覆盖的分片）挂同名会塌缩，只回放 alias 注册
        for (const entry of aliases) this.registerFontInProvider(provider, entry.alias, entry.data)
        continue
      }
      for (const supplemental of this.supplementalFamilyData.get(cacheKey) ?? []) {
        this.registerFontInProvider(provider, family, supplemental)
      }
    }
  }

  detachProvider(provider?: TypefaceFontProvider | null): void {
    if (!provider) {
      this.fontProviders.clear()
      this.fontProvider = null
      this.providerRegistrations = new WeakMap()
      return
    }
    this.fontProviders.delete(provider)
    this.providerRegistrations.delete(provider)
    if (this.fontProvider === provider) {
      this.fontProvider = Array.from(this.fontProviders).at(-1) ?? null
    }
  }

  provider(): TypefaceFontProvider | null {
    return this.fontProvider
  }

  generation(): number {
    return this.registrationGeneration
  }

  blockNodesUntilFontsResolve(nodeIds: readonly string[]): void {
    for (const nodeId of nodeIds) this.blockedNodeIds.add(nodeId)
  }

  unblockNodes(nodeIds: readonly string[]): void {
    for (const nodeId of nodeIds) this.blockedNodeIds.delete(nodeId)
  }

  isNodeBlocked(nodeId: string): boolean {
    return this.blockedNodeIds.has(nodeId)
  }

  localAccessState(): LocalFontAccessState {
    return this.localFontAccessState
  }

  setDownloadedFontCache(cache: DownloadedFontCache | null): void {
    this.downloadedFontCache = cache
  }

  setFontMemoryBudget(bytes: number): void {
    this.fontMemoryBudget = Math.max(0, Math.floor(bytes))
    this.enforceFontMemoryBudget()
  }

  /** 逐出联动挂钩（T40 S1）：由 resolver/index.ts 注册，逐出时复位对应 demand 键。 */
  onFontEvicted(listener: ((family: string, style: string) => void) | null): void {
    this.fontEvictListener = listener
  }

  fontMemoryStats(): FontMemoryStats {
    return {
      budgetBytes: this.fontMemoryBudget,
      loadedBytes: this.fontMemory.totalBytes(),
      entries: this.fontMemory.size(),
      evictions: this.fontEvictions,
      overBudgetKeys: this.fontMemory.overBudgetKeys(this.fontMemoryBudget)
    }
  }

  /** 手动逐出某家族字重（释放 JS 引用；下次引用时经 demand 链重载）。 */
  evictFont(family: string, style = 'Regular'): boolean {
    const key = `${family}|${style}`
    if (!this.loadedFamilies.has(key)) return false
    this.evictFontKey(key)
    return true
  }

  setFallbackUserAgent(userAgent: string | undefined): void {
    this.fallbackUserAgent = userAgent
  }

  setHostFontLoader(loader: HostFontLoader | null): void {
    this.hostFontLoader = loader
  }

  setOnlineFontProviders(settings: Partial<Record<WebFontProviderId, boolean>>): void {
    this.webFonts.setEnabled(settings)
  }

  setWebFontFetch(fetcher: WebFontFetch | null): void {
    this.webFonts.setRemoteFetch(fetcher)
    if (fetcher) cnFontSubsetResolver.setFetcher(fetcher)
  }

  /** 注入 cn-font piece 级磁盘缓存（T40 S5，浏览器侧 IndexedDB 实现）。 */
  setCnFontPieceCache(cache: CnFontPieceCache | null): void {
    cnFontSubsetResolver.setCache(cache)
  }

  enabledOnlineFontProviders(): WebFontProviderId[] {
    return this.webFonts.enabledProviders()
  }

  async loadCachedFont(
    family: string,
    style = 'Regular',
    characters = ''
  ): Promise<ArrayBuffer | null> {
    const cached = await this.readDownloadedFont(family, style, characters)
    if (!cached) return null
    return this.registerAndCache(family, style, cached, 'cache')
  }

  async requestLocalFontAccess(): Promise<FontInfo[]> {
    if (!hasWindowGlobal() || !window.queryLocalFonts) {
      this.localFontAccessState = 'unsupported'
      this.localFonts = []
      return []
    }
    try {
      const fonts = await window.queryLocalFonts()
      const seen = new Set<string>()
      const result: FontInfo[] = []
      for (const f of fonts) {
        const key = `${f.family}|${f.style}`
        if (seen.has(key)) continue
        seen.add(key)
        result.push({
          family: f.family,
          fullName: f.fullName,
          style: f.style,
          postscriptName: f.postscriptName
        })
      }
      this.localFonts = result
      this.localFontAccessState = 'granted'
      return result
    } catch {
      this.localFonts = []
      this.localFontAccessState = 'denied'
      return []
    }
  }

  async listFamilies(): Promise<string[]> {
    const options = await this.listFamilyOptions()
    return options.map((option) => option.family)
  }

  async listFamilyOptions(): Promise<FontFamilyOption[]> {
    // 不隐式触发本地字体权限请求：'prompt' 状态下 queryLocalFonts 会一直挂起
    // （自动化/无头环境无人响应权限弹窗），bundled/web 家族列表会被一并卡住。
    // 本地字体由字体选择器的“允许访问”按钮显式调 requestLocalFontAccess 载入。
    const fonts = this.localFonts ?? []
    const webFontFamilies = await Promise.all(
      this.enabledOnlineFontProviders().map(async (provider) => ({
        provider,
        families: await this.listProviderFamiliesWithTimeout(provider)
      }))
    )
    const byFamily = new Map<string, FontFamilyOption>()
    // 字体注册表（白名单）枚举 bundled 家族：'Inter' 等字面值避免对
    // #core/constants 的循环 import（constants ← fonts 经 FontManager 消费）。
    // CDN 家族（T40 S4）同属在线能力：用户关停全部在线 provider 时一并隐藏。
    const onlineEnabled = this.enabledOnlineFontProviders().length > 0
    for (const entry of FONT_REGISTRY) {
      if (entry.source === 'cdn') {
        if (onlineEnabled) byFamily.set(entry.family, { family: entry.family, source: 'cdn' })
        continue
      }
      byFamily.set(entry.family, { family: entry.family, source: 'bundled' })
    }
    for (const { provider, families } of webFontFamilies) {
      for (const family of families) {
        if (!byFamily.has(family)) byFamily.set(family, { family, source: provider })
      }
    }
    for (const font of fonts) byFamily.set(font.family, { family: font.family, source: 'local' })
    return [...byFamily.values()].sort((a, b) => a.family.localeCompare(b.family))
  }

  preloadWebFontFamilies(): void {
    this.webFonts.preloadFamilies()
  }

  /**
   * provider 家族枚举带超时（T40 S2 门禁解除的配套）：浏览器直连后，不可达的
   * provider（如本网络下 fonts.google.com）不再被门禁短路，其初始化重试会
   * 拖住整个 picker 列表。超时只放弃本次枚举，后台 promise 继续跑完并入缓存，
   * 下次打开即命中。
   */
  private webFontListTimeoutMs = 6000

  setWebFontListTimeout(ms: number): void {
    this.webFontListTimeoutMs = Math.max(0, Math.floor(ms))
  }

  private async listProviderFamiliesWithTimeout(provider: WebFontProviderId): Promise<string[]> {
    let timer: ReturnType<typeof setTimeout> | undefined
    try {
      return await Promise.race([
        this.webFonts.listFamilies(provider),
        new Promise<string[]>((_, reject) => {
          timer = setTimeout(
            () => reject(new Error(`web font family list timeout: ${provider}`)),
            this.webFontListTimeoutMs
          )
        })
      ])
    } catch {
      return []
    } finally {
      clearTimeout(timer)
    }
  }

  async fetchBundledFont(url: string): Promise<ArrayBuffer | null> {
    if (IS_BROWSER) {
      const response = await fetch(url)
      return response.arrayBuffer()
    }
    const { readFile } = await import(/* @vite-ignore */ 'node:fs/promises')
    const { resolve, dirname } = await import(/* @vite-ignore */ 'node:path')
    const { fileURLToPath } = await import(/* @vite-ignore */ 'node:url')
    const packageJSONURL = import.meta.resolve('@open-pencil/core/package.json')
    const packageRoot = dirname(fileURLToPath(packageJSONURL))
    const assetPath = resolve(packageRoot, `assets${url}`)
    const buf = await readFile(assetPath)
    return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)
  }

  async loadLocalFont(family: string, style = 'Regular'): Promise<ArrayBuffer | null> {
    const cacheKey = `${family}|${style}`
    const loaded = this.loadedFamilies.get(cacheKey)
    if (loaded) {
      this.registerFontInCanvasKit(family, loaded)
      return loaded
    }

    const hostBuffer = await this.loadHostFont(family, style)
    if (hostBuffer) return this.registerAndCache(family, style, hostBuffer, 'local')
    const localBuffer = await this.findLocalFont(family, style)
    if (localBuffer) return this.registerAndCache(family, style, localBuffer, 'local')

    const bundledURL = BUNDLED_FONTS[cacheKey]
    if (!bundledURL) return null
    if (!isBundledFamilyAllowed(family)) {
      console.warn(`Bundled font "${family}" is not in the font registry allowlist`)
      return null
    }
    try {
      const buffer = await this.fetchBundledFont(bundledURL)
      return buffer && !isVariableFont(buffer)
        ? this.registerAndCache(family, style, buffer, 'bundled')
        : null
    } catch (e) {
      console.warn(`Bundled font load failed for "${family}" ${style}:`, e)
      return null
    }
  }

  async loadRemoteFont(
    family: string,
    style = 'Regular',
    characters = ''
  ): Promise<ArrayBuffer | null> {
    if (typeof fetch === 'undefined') return null
    const coverage = this.remoteCoverage.get(`${family}|${style}`)
    if (
      characters &&
      coverage &&
      Array.from(characters).every((character) => coverage.has(character))
    ) {
      return this.loadedData(family, style)
    }
    try {
      const requestedCharacters = normalizedCoverageText(
        `${coverage ? Array.from(coverage).join('') : ''}${characters}`
      )
      const normalized = normalizeFontFamily(family)

      // T40 S4：注册表 CDN 家族走中文网字计划子集分片（D-g：失败回退 unifont 链）。
      const cdnLoaded = await this.loadCnFontSubset(family, normalized, style, requestedCharacters)
      if (cdnLoaded) return cdnLoaded

      const families = normalized === family ? [family] : [family, normalized]
      const resolved = await this.webFonts.fetchFont(families, style, requestedCharacters)
      if (!resolved || resolved.buffers.length === 0) return null
      const primary = resolved.buffers[0]
      await this.writeDownloadedFont(family, style, primary, requestedCharacters)
      const registered = this.registerAndCache(family, style, primary, resolved.provider)
      const loadedCoverage = this.remoteCoverage.get(`${family}|${style}`) ?? new Set<string>()
      for (const character of requestedCharacters) loadedCoverage.add(character)
      this.remoteCoverage.set(`${family}|${style}`, loadedCoverage)
      for (const supplemental of resolved.buffers.slice(1)) {
        this.registerSupplemental(family, style, supplemental)
      }
      return registered
    } catch (e) {
      console.warn(`Web font fetch failed for "${family}" ${style}:`, e)
      return null
    }
  }

  async loadFont(family: string, style = 'Regular', characters = ''): Promise<ArrayBuffer | null> {
    const loaded = this.loadedData(family, style)
    if (loaded) {
      this.registerFontInCanvasKit(family, loaded)
      const remoteCoverage = this.remoteCoverage.get(`${family}|${style}`)
      const missingRemoteCoverage = Boolean(
        characters &&
        remoteCoverage &&
        Array.from(characters).some((character) => !remoteCoverage.has(character))
      )
      return missingRemoteCoverage
        ? ((await this.loadRemoteFont(family, style, characters)) ?? loaded)
        : loaded
    }

    return (
      (await this.loadLocalFont(family, style)) ??
      (await this.loadCachedFont(family, style, characters)) ??
      (await this.loadRemoteFont(family, style, characters))
    )
  }

  async ensureNodeFont(family: string, weight: number): Promise<void> {
    await this.loadFont(family, weightToStyle(weight))
  }

  markLoaded(
    family: string,
    style: string,
    data: ArrayBuffer,
    source: FontLoadedSource = 'registered'
  ): void {
    this.registerAndCache(family, style, data, source)
  }

  loadedFontSource(family: string, style: string): FontLoadedSource | null {
    return this.loadedFamilySources.get(`${family}|${style}`) ?? null
  }

  isLoaded(family: string): boolean {
    return [...this.loadedFamilies.keys()].some((k) => k.startsWith(`${family}|`))
  }

  isStyleLoaded(family: string, style: string): boolean {
    const key = `${family}|${style}`
    const loaded = this.loadedFamilies.has(key)
    if (loaded) this.fontMemory.touch(key)
    return loaded
  }

  remoteStyleNeedsCoverage(family: string, style: string, characters: readonly string[]): boolean {
    const coverage = this.remoteCoverage.get(`${family}|${style}`)
    return !!coverage && characters.some((character) => !coverage.has(character))
  }

  loadedData(family: string, style: string): ArrayBuffer | null {
    const key = `${family}|${style}`
    const data = this.loadedFamilies.get(key) ?? null
    if (data) this.fontMemory.touch(key)
    return data
  }

  renderFamily(family: string, _style: string): string {
    // CanvasKit can shape metrics but paint no glyphs for some CJK/Arabic faces registered under a
    // synthetic alias. Keep every shard under the font's source family; character-aware remote
    // requests already fetch cumulative coverage before replacing the primary buffer.
    // 例外：CDN 互斥分片不挂本名（同名塌缩），每片各持 alias，由 renderFamilyAliases
    // 经段落 fontFamilies 回退链合流——本名 primary 仍在回退链首位提供度量。
    return family
  }

  collectFontKeys(graph: SceneGraph, nodeIds: string[]): Array<[string, string]> {
    return collectGraphFontKeys(graph, nodeIds)
  }

  async ensureCJKFallback(): Promise<string[]> {
    if (this.cjkFallbackFamilies.length > 0) return this.cjkFallbackFamilies
    if (this.cjkFallbackPromise) return this.cjkFallbackPromise

    this.cjkFallbackPromise = this.ensureFallbackFamilies('cjk', this.cjkFallbackFamilies, {
      allowVariableLocalFonts: true
    })
    return this.cjkFallbackPromise
  }

  getCJKFallbackFamilies(): string[] {
    return this.cjkFallbackFamilies
  }

  setCJKFallbackFamily(family: string): void {
    if (!this.cjkFallbackFamilies.includes(family)) {
      this.cjkFallbackFamilies.push(family)
    }
  }

  async ensureArabicFallback(): Promise<string[]> {
    if (this.arabicFallbackFamilies.length > 0) return this.arabicFallbackFamilies
    if (this.arabicFallbackPromise) return this.arabicFallbackPromise

    this.arabicFallbackPromise = this.ensureFallbackFamilies('arabic', this.arabicFallbackFamilies)
    return this.arabicFallbackPromise
  }

  async ensureFallbackPack(
    scripts: FontFallbackScript[] = ['cjk', 'arabic'],
    characters = ''
  ): Promise<Partial<Record<FontFallbackScript, string[]>>> {
    const result: Partial<Record<FontFallbackScript, string[]>> = {}
    await Promise.all(
      scripts.map(async (script) => {
        if (script === 'arabic' && !characters) result[script] = await this.ensureArabicFallback()
        else if (script === 'cjk' && !characters) result[script] = await this.ensureCJKFallback()
        else {
          const target =
            script === 'arabic' ? this.arabicFallbackFamilies : this.cjkFallbackFamilies
          result[script] = await this.ensureFallbackFamilies(script, target, {}, characters)
        }
      })
    )
    return result
  }

  getArabicFallbackFamilies(): string[] {
    return this.arabicFallbackFamilies
  }

  setArabicFallbackFamily(family: string): void {
    if (!this.arabicFallbackFamilies.includes(family)) {
      this.arabicFallbackFamilies.push(family)
    }
  }

  private async ensureFallbackFamilies(
    script: FontFallbackScript,
    targetFamilies: string[],
    options: { allowVariableLocalFonts?: boolean } = {},
    characters = ''
  ): Promise<string[]> {
    const manifest = fontFallbackEntry(script, this.fallbackUserAgent)

    for (const family of manifest.localFamilies) {
      const buffer =
        (await this.loadHostFont(family, 'Regular')) ??
        (await this.findLocalFont(family, undefined, {
          allowVariable: options.allowVariableLocalFonts
        }))
      if (
        buffer &&
        this.registerAndCache(family, 'Regular', buffer, 'fallback') &&
        !targetFamilies.includes(family)
      ) {
        targetFamilies.push(family)
      }
    }

    if (targetFamilies.length === 0 || characters) {
      const results = await Promise.allSettled(
        manifest.remoteFamilies.map(async (family) => {
          const data = await this.loadRemoteFont(family, 'Regular', characters)
          return data ? family : null
        })
      )
      for (const result of results) {
        if (
          result.status === 'fulfilled' &&
          result.value &&
          !targetFamilies.includes(result.value)
        ) {
          targetFamilies.push(result.value)
        }
      }
    }

    return targetFamilies
  }

  /**
   * 注册表 CDN 家族的中文网字计划子集加载（T40 S4）。
   * CDN 同属在线能力：用户关停全部在线 provider 时不触网；
   * 未命中注册表 / 取片失败 → 返回 null，调用方回退 unifont 链（D-g）。
   *
   * 分片注册策略：首片兼作 real-name primary（保持 isStyleLoaded/测量等既有语义），
   * 每片另持 alias 注册进 CanvasKit——同名多片会被 TypefaceFontProvider 塌缩成单
   * typeface（互斥 unicode-range 下只有一片出字形），alias 经 renderFamilyAliases →
   * 段落 fontFamilies 回退链合流。增量请求会重选已注册片，按 url 去重。
   */
  private async loadCnFontSubset(
    family: string,
    normalized: string,
    style: string,
    requestedCharacters: string
  ): Promise<ArrayBuffer | null> {
    const descriptor =
      cdnFontEntry(family)?.cdn ??
      (normalized !== family ? cdnFontEntry(normalized)?.cdn : undefined)
    if (!descriptor || this.enabledOnlineFontProviders().length === 0) return null

    const result = await cnFontSubsetResolver.fetch(family, descriptor, style, requestedCharacters)
    if (!result || result.pieces.length === 0) return null

    const key = `${family}|${style}`
    const aliases = this.renderAliasFamilies.get(key) ?? []
    const seenURLs = new Set(aliases.map((entry) => entry.url))
    let primary = this.loadedFamilies.get(key) ?? null

    for (const piece of result.pieces) {
      if (seenURLs.has(piece.url)) continue
      const unicodeRange = formatUnicodeRanges(piece.ranges)
      if (primary) {
        this.trackSupplementalData(family, style, piece.buffer)
        this.registerFontInBrowser(family, style, piece.buffer, unicodeRange)
      } else {
        primary = this.registerAndCache(family, style, piece.buffer, 'cdn', unicodeRange)
      }
      const alias = `${family}${CN_FONT_ALIAS_SEPARATOR}${aliases.length}`
      aliases.push({ url: piece.url, alias, data: piece.buffer })
      seenURLs.add(piece.url)
      this.registerFontInCanvasKit(alias, piece.buffer)
    }
    this.renderAliasFamilies.set(key, aliases)

    const loadedCoverage = this.remoteCoverage.get(key) ?? new Set<string>()
    for (const character of result.coveredCharacters) loadedCoverage.add(character)
    this.remoteCoverage.set(key, loadedCoverage)
    return primary
  }

  /** CDN 键的分片 alias 名（排版 fontFamilies 回退链用；非 CDN 键恒为空数组） */
  renderFamilyAliases(family: string, style: string): string[] {
    return (this.renderAliasFamilies.get(`${family}|${style}`) ?? []).map((entry) => entry.alias)
  }

  private async loadHostFont(family: string, style: string): Promise<ArrayBuffer | null> {
    if (!this.hostFontLoader) return null
    try {
      return await this.hostFontLoader(family, style)
    } catch (e) {
      console.warn(`Host fallback font load failed for "${family}" ${style}:`, e)
      return null
    }
  }

  private async readDownloadedFont(
    family: string,
    style: string,
    characters = ''
  ): Promise<ArrayBuffer | null> {
    if (!this.downloadedFontCache) return null
    try {
      return await this.downloadedFontCache.read(family, style, characters)
    } catch (e) {
      console.warn(`Downloaded font cache read failed for "${family}" ${style}:`, e)
      return null
    }
  }

  private async writeDownloadedFont(
    family: string,
    style: string,
    data: ArrayBuffer,
    characters = ''
  ): Promise<void> {
    if (!this.downloadedFontCache) return
    try {
      await this.downloadedFontCache.write(family, style, data, characters)
    } catch (e) {
      console.warn(`Downloaded font cache write failed for "${family}" ${style}:`, e)
    }
  }

  private async findLocalFont(
    family: string,
    style?: string,
    options: FindLocalFontOptions = {}
  ): Promise<ArrayBuffer | null> {
    if (!hasWindowGlobal() || !window.queryLocalFonts) return null
    if (this.localFontAccessState !== 'granted') return null
    try {
      const fonts = await window.queryLocalFonts()
      const match = chooseLocalFontMatch(fonts, family, style)
      if (!match) return null
      const blob: Blob = await match.blob()
      const buffer = await blob.arrayBuffer()
      if (!options.allowVariable && isVariableFont(buffer)) return null
      return buffer
    } catch (e) {
      console.warn(`Local font access failed for "${family}" ${style ?? ''}:`, e)
      return null
    }
  }

  /** 补充片记账（不含注册）：返回 false 表示该 buffer 已在账上（调用方应跳过重注册） */
  private trackSupplementalData(family: string, style: string, buffer: ArrayBuffer): boolean {
    const key = `${family}|${style}`
    const supplemental = this.supplementalFamilyData.get(key) ?? []
    if (supplemental.includes(buffer)) return false
    supplemental.push(buffer)
    this.supplementalFamilyData.set(key, supplemental)
    this.recountFontMemory(key)
    this.enforceFontMemoryBudget(key)
    return true
  }

  private registerSupplemental(family: string, style: string, buffer: ArrayBuffer): void {
    if (!this.trackSupplementalData(family, style, buffer)) return
    this.registerFontInCanvasKit(family, buffer)
    this.registerFontInBrowser(family, style, buffer)
  }

  /**
   * 重述某键的账本字节数（primary + 全部补充片）。重述而非增量：
   * registerAndCache 替换 primary 时会把旧 primary 降级为补充片，总字节不变，
   * 增量记账在此场景必然漂移（T40 S1）。
   */
  private recountFontMemory(key: string): void {
    const primary = this.loadedFamilies.get(key)
    if (!primary) {
      this.fontMemory.remove(key)
      return
    }
    let bytes = primary.byteLength
    for (const supplemental of this.supplementalFamilyData.get(key) ?? []) {
      bytes += supplemental.byteLength
    }
    this.fontMemory.set(key, bytes)
  }

  private enforceFontMemoryBudget(excludeKey?: string): void {
    const over = this.fontMemory.totalBytes() - this.fontMemoryBudget
    if (over <= 0) return
    const exclude = new Set(excludeKey ? [excludeKey] : [])
    for (const victim of this.fontMemory.lruVictims(over, exclude, this.fontMemoryBudget)) {
      this.evictFontKey(victim)
    }
  }

  private evictFontKey(key: string): void {
    const separator = key.indexOf('|')
    const family = key.slice(0, separator)
    const style = key.slice(separator + 1)
    // 先复位 resolver 再删引用：resolver 残留 'loaded' 快照会让 demand 直接返回旧
    // promise、字体被逐出后永不重载（T40 S1）；在途 load 完成后重新入账视为复活。
    this.fontEvictListener?.(family, style)
    this.loadedFamilies.delete(key)
    this.supplementalFamilyData.delete(key)
    this.remoteCoverage.delete(key)
    this.loadedFamilySources.delete(key)
    this.renderAliasFamilies.delete(key)
    const faces = this.browserFontFaces.get(key)
    if (faces) {
      for (const face of faces) {
        try {
          document.fonts.delete(face)
        } catch (error) {
          // document.fonts 不可用时忽略——JS 引用随 map 清除即释放
          console.warn(`Font face removal failed for "${family}" (${style}):`, error)
        }
      }
      this.browserFontFaces.delete(key)
    }
    this.fontMemory.remove(key)
    this.fontEvictions++
  }

  private registerAndCache(
    family: string,
    style: string,
    buffer: ArrayBuffer,
    source?: FontLoadedSource,
    unicodeRange?: string
  ): ArrayBuffer | null {
    const key = `${family}|${style}`
    const existing = this.loadedFamilies.get(key)
    if (existing === buffer) {
      if (source) this.loadedFamilySources.set(key, source)
      this.registerFontInCanvasKit(family, buffer)
      this.fontMemory.touch(key)
      return buffer
    }
    if (existing) this.registerSupplemental(family, style, existing)
    this.loadedFamilies.set(key, buffer)
    if (source) this.loadedFamilySources.set(key, source)
    this.registerFontInCanvasKit(family, buffer)
    this.registerFontInBrowser(family, style, buffer, unicodeRange)
    this.recountFontMemory(key)
    this.enforceFontMemoryBudget(key)
    return buffer
  }

  private registerFontInCanvasKit(family: string, data: ArrayBuffer): boolean {
    let registered = false
    for (const provider of this.fontProviders) {
      registered = this.registerFontInProvider(provider, family, data) || registered
    }
    return registered
  }

  private registerFontInProvider(
    provider: TypefaceFontProvider,
    family: string,
    data: ArrayBuffer
  ): boolean {
    if (data.byteLength < 4) return false
    const registrations = this.providerRegistrations.get(provider) ?? new Map()
    const registeredData = registrations.get(family)
    if (registeredData?.has(data)) return true
    try {
      provider.registerFont(data, family)
      const familyRegistrations = registeredData ?? new Set<ArrayBuffer>()
      familyRegistrations.add(data)
      registrations.set(family, familyRegistrations)
      this.providerRegistrations.set(provider, registrations)
      this.registrationGeneration++
      return true
    } catch {
      return false
    }
  }

  private registerFontInBrowser(
    family: string,
    style: string,
    data: ArrayBuffer,
    unicodeRange?: string
  ) {
    // 以真实能力为准：测试环境可能 mock window（IS_BROWSER 为真）却无 FontFace 实现
    if (!IS_BROWSER || typeof FontFace === 'undefined') return
    const weight = styleToWeight(style)
    const italic = style.toLowerCase().includes('italic') ? 'italic' : 'normal'
    const face = new FontFace(family, data, {
      weight: String(weight),
      style: italic,
      ...(unicodeRange ? { unicodeRange } : {})
    })
    // 按键跟踪 FontFace 实例，逐出时 document.fonts.delete 真正释放浏览器侧内存（T40 S1）
    const key = `${family}|${style}`
    const faces = this.browserFontFaces.get(key) ?? []
    faces.push(face)
    this.browserFontFaces.set(key, faces)
    face
      .load()
      .then(() => document.fonts.add(face))
      .catch(() => {
        console.warn(`Failed to load font "${family}" (${style})`)
      })
  }
}

export const fontManager = new FontManager()

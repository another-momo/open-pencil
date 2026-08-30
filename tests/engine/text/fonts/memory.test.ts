import { describe, expect, test } from 'bun:test'

import {
  DEFAULT_FONT_MEMORY_BUDGET,
  FontManager,
  FontMemoryLedger,
  fontFaceDemand,
  fontManager,
  fontResolver
} from '@open-pencil/core/text'

describe('FontMemoryLedger', () => {
  test('accounts bytes per key and reports totals', () => {
    const ledger = new FontMemoryLedger()
    ledger.set('A|Regular', 100)
    ledger.set('B|Regular', 200)
    expect(ledger.totalBytes()).toBe(300)
    expect(ledger.size()).toBe(2)

    ledger.set('A|Regular', 150)
    expect(ledger.totalBytes()).toBe(350)

    ledger.remove('B|Regular')
    expect(ledger.totalBytes()).toBe(150)
    expect(ledger.size()).toBe(1)
  })

  test('picks victims in least-recently-used order, honoring touch', () => {
    const ledger = new FontMemoryLedger()
    ledger.set('A|Regular', 100)
    ledger.set('B|Regular', 200)
    ledger.set('C|Regular', 300)
    ledger.touch('A|Regular')

    // 需释放 200：B 最久未用先逐（200 即达标），A 因 touch 续命，C 最新保留
    expect(ledger.lruVictims(200, new Set(), 1000)).toEqual(['B|Regular'])
    // 需释放 400：B + C（A 被 touch 过排在最后）
    expect(ledger.lruVictims(400, new Set(), 1000)).toEqual(['B|Regular', 'C|Regular'])
  })

  test('skips excluded and over-budget keys when picking victims', () => {
    const ledger = new FontMemoryLedger()
    ledger.set('A|Regular', 100)
    ledger.set('Huge|Regular', 5000)

    expect(ledger.lruVictims(50, new Set(['A|Regular']), 1000)).toEqual([])
    // 单条目超预算不逐（逐了也无法达标）
    expect(ledger.lruVictims(4000, new Set(), 1000)).toEqual(['A|Regular'])
    expect(ledger.overBudgetKeys(1000)).toEqual(['Huge|Regular'])
  })
})

describe('FontManager memory governance (T40 S1)', () => {
  test('tracks bytes across primary replacement and supplemental demotion', () => {
    const manager = new FontManager()
    manager.markLoaded('MemA', 'Regular', new ArrayBuffer(100))
    expect(manager.fontMemoryStats().loadedBytes).toBe(100)

    // 同键换 primary：旧 buffer 降级为补充片，总字节 = 新 100 + 旧 150
    manager.markLoaded('MemA', 'Regular', new ArrayBuffer(150))
    expect(manager.fontMemoryStats().loadedBytes).toBe(250)
    expect(manager.fontMemoryStats().entries).toBe(1)
  })

  test('evicts least-recently-used faces when over budget', () => {
    const manager = new FontManager()
    const evicted: string[] = []
    manager.onFontEvicted((family, style) => evicted.push(`${family}|${style}`))

    manager.markLoaded('MemB', 'Regular', new ArrayBuffer(100))
    manager.markLoaded('MemC', 'Regular', new ArrayBuffer(200))
    manager.markLoaded('MemD', 'Regular', new ArrayBuffer(300))

    manager.setFontMemoryBudget(400)
    expect(evicted).toEqual(['MemB|Regular', 'MemC|Regular'])
    expect(manager.isStyleLoaded('MemB', 'Regular')).toBe(false)
    expect(manager.isStyleLoaded('MemC', 'Regular')).toBe(false)
    expect(manager.isStyleLoaded('MemD', 'Regular')).toBe(true)

    const stats = manager.fontMemoryStats()
    expect(stats.loadedBytes).toBe(300)
    expect(stats.evictions).toBe(2)
    expect(stats.budgetBytes).toBe(400)
  })

  test('touch via isStyleLoaded protects a face from eviction', () => {
    const manager = new FontManager()
    manager.markLoaded('MemE', 'Regular', new ArrayBuffer(100))
    manager.markLoaded('MemF', 'Regular', new ArrayBuffer(200))
    manager.markLoaded('MemG', 'Regular', new ArrayBuffer(300))

    expect(manager.isStyleLoaded('MemE', 'Regular')).toBe(true)
    manager.setFontMemoryBudget(400)
    expect(manager.isStyleLoaded('MemE', 'Regular')).toBe(true)
    expect(manager.isStyleLoaded('MemF', 'Regular')).toBe(false)
    expect(manager.isStyleLoaded('MemG', 'Regular')).toBe(true)
  })

  test('keeps a single entry larger than the budget and flags it', () => {
    const manager = new FontManager()
    manager.markLoaded('MemH', 'Regular', new ArrayBuffer(100))
    manager.markLoaded('MemI', 'Regular', new ArrayBuffer(500))

    manager.setFontMemoryBudget(400)
    // MemI 单条目超预算：保留并计入 overBudgetKeys；MemH 被逐以回血
    expect(manager.isStyleLoaded('MemI', 'Regular')).toBe(true)
    expect(manager.isStyleLoaded('MemH', 'Regular')).toBe(false)
    expect(manager.fontMemoryStats().overBudgetKeys).toEqual(['MemI|Regular'])
  })

  test('never evicts the face that was just registered', () => {
    const manager = new FontManager()
    manager.markLoaded('MemJ', 'Regular', new ArrayBuffer(300))
    manager.setFontMemoryBudget(200)
    // 预算 200、新入账 300：逐出受害者只剩自己 → 豁免，记入 overBudgetKeys
    expect(manager.isStyleLoaded('MemJ', 'Regular')).toBe(true)
    expect(manager.fontMemoryStats().overBudgetKeys).toEqual(['MemJ|Regular'])
  })

  test('manual evictFont releases the face and reports it', () => {
    const manager = new FontManager()
    manager.markLoaded('MemK', 'Bold', new ArrayBuffer(64))
    expect(manager.evictFont('MemK', 'Bold')).toBe(true)
    expect(manager.evictFont('MemK', 'Bold')).toBe(false)
    expect(manager.isStyleLoaded('MemK', 'Bold')).toBe(false)
    expect(manager.fontMemoryStats().loadedBytes).toBe(0)
  })

  test('default budget is the 50MB guardrail from the blueprint', () => {
    expect(DEFAULT_FONT_MEMORY_BUDGET).toBe(50 * 1024 * 1024)
    expect(new FontManager().fontMemoryStats().budgetBytes).toBe(DEFAULT_FONT_MEMORY_BUDGET)
  })
})

describe('eviction ↔ resolver integration (T40 S1)', () => {
  test('evicting a loaded face resets its resolver entry so it reloads on demand', async () => {
    const family = 'EvictIntegration'
    fontManager.markLoaded(family, 'Regular', new ArrayBuffer(64))

    const demand = fontFaceDemand(family, 'Regular')
    const settled = await fontResolver.demand(demand)
    expect(settled.state).toBe('loaded')

    expect(fontManager.evictFont(family, 'Regular')).toBe(true)
    expect(fontManager.isStyleLoaded(family, 'Regular')).toBe(false)
    expect(fontResolver.state(demand).state).toBe('idle')

    // 重新 demand 能再次走通 registered 候选之外的重载链。关停在线 provider，
    // 避免 remote 候选对测试环境发起真实网络请求（此处无源 → exhausted）。
    fontManager.setOnlineFontProviders({
      google: false,
      fontsource: false,
      bunny: false,
      fontshare: false
    })
    try {
      const reloaded = await fontResolver.demand(demand)
      expect(reloaded.state).toBe('exhausted')
    } finally {
      fontManager.setOnlineFontProviders({ google: true, fontsource: true })
      fontResolver.reset(demand)
    }
  })
})

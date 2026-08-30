/**
 * cn-font piece 级磁盘缓存策略层（T40 S5，13 册 §4.4 Phase 4）。
 *
 * 分层：本模块是**策略**（LRU 逐出 / 字节预算 / touch），不感知存储介质；
 * 存储由 `CnFontPieceStore` 接口抽象——浏览器侧 IndexedDB 绑定（Blob 存储，
 * 避免 ArrayBuffer 结构化克隆的内存峰）在 src/app/editor/fonts/idb-cache.ts，
 * 本模块自带 InMemoryCnFontPieceStore 作降级与单测替身。
 *
 * 键 = piece 绝对 URL（D-c 内容寻址）：同一片被任意重叠字符集请求共享，
 * 不会像请求级缓存那样重复存储。
 */

import type { CnFontPieceCache } from '#core/text/web-font/cn-fonts'

/** 浏览器磁盘缓存默认预算（13 册：200MB LRU） */
export const CN_FONT_PIECE_CACHE_BUDGET = 200 * 1024 * 1024

export interface CnFontPieceStoreEntry {
  url: string
  bytes: number
  lastAccess: number
}

export interface CnFontPieceStore {
  read(url: string): Promise<ArrayBuffer | null>
  write(url: string, data: ArrayBuffer): Promise<void>
  remove(url: string): Promise<void>
  entries(): Promise<CnFontPieceStoreEntry[]>
  touch(url: string, lastAccess: number): Promise<void>
}

export class InMemoryCnFontPieceStore implements CnFontPieceStore {
  private readonly records = new Map<string, { data: ArrayBuffer; lastAccess: number }>()

  async read(url: string): Promise<ArrayBuffer | null> {
    return this.records.get(url)?.data ?? null
  }

  async write(url: string, data: ArrayBuffer): Promise<void> {
    this.records.set(url, { data, lastAccess: Date.now() })
  }

  async remove(url: string): Promise<void> {
    this.records.delete(url)
  }

  async entries(): Promise<CnFontPieceStoreEntry[]> {
    return [...this.records.entries()].map(([url, record]) => ({
      url,
      bytes: record.data.byteLength,
      lastAccess: record.lastAccess
    }))
  }

  async touch(url: string, lastAccess: number): Promise<void> {
    const record = this.records.get(url)
    if (record) record.lastAccess = lastAccess
  }
}

export class LruCnFontPieceCache implements CnFontPieceCache {
  private clock = 0

  constructor(
    private readonly store: CnFontPieceStore,
    private readonly budgetBytes = CN_FONT_PIECE_CACHE_BUDGET
  ) {}

  async read(url: string): Promise<ArrayBuffer | null> {
    try {
      const data = await this.store.read(url)
      if (data) await this.store.touch(url, ++this.clock).catch(() => undefined)
      return data
    } catch {
      return null
    }
  }

  async write(url: string, data: ArrayBuffer): Promise<void> {
    try {
      await this.store.write(url, data)
    } catch {
      return
    }
    await this.store.touch(url, ++this.clock).catch(() => undefined)
    await this.evictUntilUnderBudget(url)
  }

  /** 逐出最久未用条目直到总账达标；刚写入的键本轮豁免 */
  private async evictUntilUnderBudget(excludeURL: string): Promise<void> {
    let entries
    try {
      entries = await this.store.entries()
    } catch {
      return
    }
    let total = entries.reduce((sum, entry) => sum + entry.bytes, 0)
    if (total <= this.budgetBytes) return
    const victims = entries
      .filter((entry) => entry.url !== excludeURL)
      .sort((a, b) => a.lastAccess - b.lastAccess)
    for (const victim of victims) {
      if (total <= this.budgetBytes) break
      await this.store.remove(victim.url).catch(() => undefined)
      total -= victim.bytes
    }
  }
}

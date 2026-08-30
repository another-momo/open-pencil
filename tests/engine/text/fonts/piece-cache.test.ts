import { describe, expect, test } from 'bun:test'

import {
  CN_FONT_PIECE_CACHE_BUDGET,
  InMemoryCnFontPieceStore,
  LruCnFontPieceCache,
  type CnFontPieceStoreEntry
} from '@open-pencil/core/text'

function bytes(kilobytes: number): ArrayBuffer {
  return new ArrayBuffer(kilobytes * 1024)
}

describe('LruCnFontPieceCache (T40 S5)', () => {
  test('write/read roundtrip through the store', async () => {
    const cache = new LruCnFontPieceCache(new InMemoryCnFontPieceStore())
    await cache.write('https://cdn.example/p1.woff2', bytes(4))
    expect((await cache.read('https://cdn.example/p1.woff2'))?.byteLength).toBe(4096)
    expect(await cache.read('https://cdn.example/missing.woff2')).toBeNull()
  })

  test('evicts least-recently-used pieces over budget, keeping the just-written piece', async () => {
    const store = new InMemoryCnFontPieceStore()
    const cache = new LruCnFontPieceCache(store, 10 * 1024)
    await cache.write('https://cdn.example/a.woff2', bytes(4))
    await cache.write('https://cdn.example/b.woff2', bytes(4))
    // 读 a 续命 → b 成为最久未用
    await cache.read('https://cdn.example/a.woff2')
    await cache.write('https://cdn.example/c.woff2', bytes(4))

    const urls = (await store.entries()).map((entry) => entry.url)
    expect(urls).toContain('https://cdn.example/a.woff2')
    expect(urls).toContain('https://cdn.example/c.woff2')
    expect(urls).not.toContain('https://cdn.example/b.woff2')
  })

  test('keeps the just-written piece even when it alone exceeds budget', async () => {
    const store = new InMemoryCnFontPieceStore()
    const cache = new LruCnFontPieceCache(store, 1024)
    await cache.write('https://cdn.example/huge.woff2', bytes(4))
    expect(await cache.read('https://cdn.example/huge.woff2')).not.toBeNull()
  })

  test('default budget is the 200MB blueprint value', () => {
    expect(CN_FONT_PIECE_CACHE_BUDGET).toBe(200 * 1024 * 1024)
  })

  test('store failures degrade to cache misses instead of throwing', async () => {
    const failingStore = {
      read: async () => {
        throw new Error('idb down')
      },
      write: async () => {
        throw new Error('idb down')
      },
      remove: async () => undefined,
      entries: async (): Promise<CnFontPieceStoreEntry[]> => {
        throw new Error('idb down')
      },
      touch: async () => undefined
    }
    const cache = new LruCnFontPieceCache(failingStore)
    await cache.write('https://cdn.example/a.woff2', bytes(1))
    expect(await cache.read('https://cdn.example/a.woff2')).toBeNull()
  })
})

describe('InMemoryCnFontPieceStore (降级/替身)', () => {
  test('touch updates lastAccess ordering surfaced by entries()', async () => {
    const store = new InMemoryCnFontPieceStore()
    await store.write('u1', bytes(1))
    await store.write('u2', bytes(1))
    await store.touch('u1', Date.now() + 60_000)
    const ordered = (await store.entries()).sort((a, b) => a.lastAccess - b.lastAccess)
    expect(ordered.at(-1)?.url).toBe('u1')
  })
})

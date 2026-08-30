/**
 * 浏览器侧 cn-font piece 磁盘缓存（T40 S5）：IndexedDB 绑定。
 *
 * - 键 = piece 绝对 URL（D-c 内容寻址），值 = Blob（非 ArrayBuffer——IDB 存 Blob
 *   不经结构化克隆进内存，读时才 materialize，避免大字体字节缓存的内存峰）；
 * - LRU 策略（200MB 预算、touch、逐出）在 core 的 LruCnFontPieceCache，
 *   本模块只做介质绑定；indexedDB 缺失/打开失败（隐私模式等）降级内存存储，
 *   加载主链不受影响（resolver 对缓存读写全程 catch）。
 */

import { InMemoryCnFontPieceStore, LruCnFontPieceCache } from '@open-pencil/core/text'
import type {
  CnFontPieceCache,
  CnFontPieceStore,
  CnFontPieceStoreEntry
} from '@open-pencil/core/text'

const DB_NAME = 'op-cn-font-piece-cache'
const DB_VERSION = 1
const STORE = 'pieces'

interface IdbPieceRecord {
  url: string
  blob: Blob
  lastAccess: number
}

class IdbCnFontPieceStore implements CnFontPieceStore {
  private dbPromise: Promise<IDBDatabase | null> | null = null

  private open(): Promise<IDBDatabase | null> {
    if (!this.dbPromise) {
      this.dbPromise = new Promise((resolve) => {
        try {
          const request = indexedDB.open(DB_NAME, DB_VERSION)
          request.onupgradeneeded = () => {
            if (!request.result.objectStoreNames.contains(STORE)) {
              request.result.createObjectStore(STORE, { keyPath: 'url' })
            }
          }
          request.onsuccess = () => resolve(request.result)
          request.onerror = () => resolve(null)
          request.onblocked = () => resolve(null)
        } catch {
          resolve(null)
        }
      })
    }
    return this.dbPromise
  }

  private async transaction<T>(
    mode: IDBTransactionMode,
    run: (store: IDBObjectStore) => IDBRequest<T>
  ): Promise<T | null> {
    const db = await this.open()
    if (!db) return null
    return new Promise((resolve) => {
      try {
        const request = run(db.transaction(STORE, mode).objectStore(STORE))
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => resolve(null)
      } catch {
        resolve(null)
      }
    })
  }

  async read(url: string): Promise<ArrayBuffer | null> {
    const record = await this.transaction('readonly', (store) => store.get(url))
    if (!record || typeof record !== 'object' || !('blob' in record)) return null
    const blob = (record as IdbPieceRecord).blob
    return blob instanceof Blob ? blob.arrayBuffer() : null
  }

  async write(url: string, data: ArrayBuffer): Promise<void> {
    const record: IdbPieceRecord = {
      url,
      blob: new Blob([data]),
      lastAccess: Date.now()
    }
    await this.transaction('readwrite', (store) => store.put(record))
  }

  async remove(url: string): Promise<void> {
    await this.transaction('readwrite', (store) => store.delete(url))
  }

  async entries(): Promise<CnFontPieceStoreEntry[]> {
    const records = await this.transaction('readonly', (store) => store.getAll())
    if (!Array.isArray(records)) return []
    return records
      .filter((record): record is IdbPieceRecord =>
        Boolean(record && typeof record === 'object' && 'url' in record && 'blob' in record)
      )
      .map((record) => ({
        url: record.url,
        bytes: record.blob.size,
        lastAccess: record.lastAccess
      }))
  }

  async touch(url: string, lastAccess: number): Promise<void> {
    const record = await this.transaction('readonly', (store) => store.get(url))
    if (!record || typeof record !== 'object' || !('blob' in record)) return
    await this.transaction('readwrite', (store) =>
      store.put({ ...(record as IdbPieceRecord), lastAccess })
    )
  }
}

/**
 * 创建 cn-font piece 缓存：IndexedDB 可用时走磁盘（LRU 200MB），
 * 否则降级内存 Map。Tauri webview 同样有 IndexedDB，与请求级磁盘缓存并存。
 */
export function createCnFontPieceCache(): CnFontPieceCache {
  const store =
    typeof indexedDB === 'undefined' ? new InMemoryCnFontPieceStore() : new IdbCnFontPieceStore()
  return new LruCnFontPieceCache(store)
}

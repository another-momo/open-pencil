import 'fake-indexeddb/auto'
import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test'

import { createIdbRecoveryStore } from '@/app/document/recovery/idb'
import { createMemoryRecoveryStore } from '@/app/document/recovery/memory'

const bytes = new Uint8Array([1, 2, 3, 4])

// T91c：fake-indexeddb 在 CI Linux runner 偶发超时，timeout 提到 20s——防抖
// 护栏，不改测试语义。
const CI_SAFE_TIMEOUT = 20_000

// T91h：CI（bun 1.3.10，run 33840822799）实证 fake-indexeddb 的任务派发通道
// setImmediate 在 bun test 多文件同进程负载下偶发 stall——事件循环空闲但
// macrotask 不派发，openDB 挂满 20s watchdog；而 setTimeout 通道同轮实证可用
// （bun 的 20001ms/5000ms watchdog 与 figma-images 的 AbortSignal.timeout(5)
// 均精确触发）。fake-indexeddb 的 queueTask 在调用时读 globalThis.setImmediate
// 并优雅降级 setTimeout(0)——本文件测试期间遮蔽它，强制走 setTimeout 通道。
// 全仓 src/packages/tests 及 idb 包均无 setImmediate 直接调用（grep 实证），
// 遮蔽窗口限本文件 beforeAll→afterAll，并发文件受影响面为零。
let stashedSetImmediate: typeof globalThis.setImmediate

beforeAll(() => {
  stashedSetImmediate = globalThis.setImmediate
  // Reflect.set 精确写单属性，避开 as unknown as 双转（no-broad-double-cast）
  Reflect.set(globalThis, 'setImmediate', undefined)
})

afterAll(() => {
  Reflect.set(globalThis, 'setImmediate', stashedSetImmediate)
})

describe('document recovery store', () => {
  beforeEach(async () => {
    await new Promise<void>((resolve) => {
      const request = indexedDB.deleteDatabase('open-pencil-recovery')
      request.onsuccess = () => resolve()
      request.onerror = () => resolve()
      request.onblocked = () => resolve()
    })
  }, CI_SAFE_TIMEOUT)

  test(
    'stores metadata and FIG bytes atomically in IndexedDB',
    async () => {
      const store = createIdbRecoveryStore()
      const metadata = await store.write({
        id: 'recovery-1',
        documentName: 'Agent draft',
        sceneVersion: 12,
        figBytes: bytes
      })

      expect(metadata).toMatchObject({
        id: 'recovery-1',
        documentName: 'Agent draft',
        sceneVersion: 12,
        byteLength: 4,
        formatVersion: 1
      })
      expect(await store.list()).toEqual([metadata])
      expect(await store.read('recovery-1')).toEqual({ ...metadata, figBytes: bytes })

      await store.remove('recovery-1')
      expect(await store.list()).toEqual([])
      expect(await store.read('recovery-1')).toBeNull()
    },
    CI_SAFE_TIMEOUT
  )

  test('memory store owns input and output bytes', async () => {
    const store = createMemoryRecoveryStore()
    const input = new Uint8Array(bytes)
    await store.write({ id: 'one', documentName: 'Draft', sceneVersion: 1, figBytes: input })
    input[0] = 99

    const first = await store.read('one')
    expect(first?.figBytes[0]).toBe(1)
    if (first) first.figBytes[0] = 88
    expect((await store.read('one'))?.figBytes[0]).toBe(1)
  })
})

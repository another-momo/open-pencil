/**
 * Batch 2g：节点缩略图 chip——node-preview 纯函数面钉扎（组件本体为最薄
 * 渲染壳，逻辑全部下沉 src/components/assistant/node-preview.ts）。
 *
 * 验收映射：
 *  - token→chip 适配（resolveSelectionTokenChips）：文本流实扫已采集 token
 *    → chip props（n + pageId + 首节点 nodeId + fallbackName + 名称 label）；
 *    live 名优先/快照兜底（与 serializeSelectionManifest 同口径）；多节点
 *    ` + ` 连接；手打无登记占位串不进 chip；同 token 去重；未引用登记条目
 *    不产 chip；首现序保持
 *  - request-id 竞态守卫（createPreviewRequestGuard）：id 单调递增；
 *    仅最新 id 通过 isCurrent（旧请求结果作废）
 *  - 渲染失败降级决策（resolvePreviewRender）：renderer 缺席/节点已删
 *    → null（组件降级 box 图标 + 名称）；scale = 40/max(w,h,1)（0 尺寸
 *    钳 1 防除零，同上游）
 */

import { describe, expect, test } from 'bun:test'

import {
  createPreviewRequestGuard,
  NODE_PREVIEW_TARGET_SIZE,
  resolvePreviewRender,
  resolveSelectionTokenChips
} from '@/components/assistant/node-preview'
import {
  selectionTokenText,
  type SelectionNodeReader,
  type SelectionTokenRegistry
} from '@/components/assistant/selection-capture'

/** 纯 reader 假实现（同 selection-capture.test.ts 的 fakeReader 面） */
function fakeReader(nodes: Record<string, { name: string; type: string }>): SelectionNodeReader {
  return { getNode: (id) => nodes[id] }
}

function makeRegistry(
  entries: Array<{ n: number; nodeIds: string[]; names?: string[]; pageId?: string }>
): SelectionTokenRegistry {
  const registry: SelectionTokenRegistry = new Map()
  for (const entry of entries) {
    registry.set(entry.n, {
      n: entry.n,
      pageId: entry.pageId ?? '0:1',
      nodeIds: entry.nodeIds,
      snapshot: entry.nodeIds.map((nodeId, i) => ({
        nodeId,
        name: entry.names?.[i] ?? nodeId,
        type: 'FRAME'
      }))
    })
  }
  return registry
}

// ── token → chip 适配 ────────────────────────────────────────────────────────

describe('resolveSelectionTokenChips', () => {
  test('单节点 token → chip props（n + pageId + nodeId + live 名 label）', () => {
    const registry = makeRegistry([{ n: 1, nodeIds: ['1:23'], names: ['主标题'] }])
    const reader = fakeReader({ '1:23': { name: '主标题', type: 'TEXT' } })
    const chips = resolveSelectionTokenChips(
      `改一下${selectionTokenText(1)}的颜色`,
      registry,
      reader
    )
    expect(chips).toEqual([
      {
        n: 1,
        preview: { nodeId: '1:23', pageId: '0:1', fallbackName: '主标题' },
        label: '主标题'
      }
    ])
  })

  test('采集后改名以读取瞬间 graph 实况为准（live 优先）', () => {
    const registry = makeRegistry([{ n: 1, nodeIds: ['1:23'], names: ['主标题'] }])
    const reader = fakeReader({ '1:23': { name: '新标题', type: 'TEXT' } })
    const chips = resolveSelectionTokenChips(selectionTokenText(1), registry, reader)
    expect(chips[0]?.label).toBe('新标题')
    expect(chips[0]?.preview?.fallbackName).toBe('新标题')
  })

  test('节点已删（reader 查无）→ 采集快照名兜底', () => {
    const registry = makeRegistry([{ n: 1, nodeIds: ['1:23'], names: ['主标题'] }])
    const chips = resolveSelectionTokenChips(selectionTokenText(1), registry, fakeReader({}))
    expect(chips[0]?.label).toBe('主标题')
    expect(chips[0]?.preview?.fallbackName).toBe('主标题')
  })

  test('reader 缺席（store 不在场）→ 全部快照名', () => {
    const registry = makeRegistry([{ n: 1, nodeIds: ['1:23'], names: ['主标题'] }])
    const chips = resolveSelectionTokenChips(selectionTokenText(1), registry, null)
    expect(chips[0]?.label).toBe('主标题')
  })

  test('多节点 token：label ` + ` 连接，缩略图取首节点', () => {
    const registry = makeRegistry([{ n: 2, nodeIds: ['4:56', '4:57'], names: ['主视觉', '装饰'] }])
    const reader = fakeReader({
      '4:56': { name: '主视觉', type: 'FRAME' },
      '4:57': { name: '装饰', type: 'VECTOR' }
    })
    const chips = resolveSelectionTokenChips(selectionTokenText(2), registry, reader)
    expect(chips).toEqual([
      {
        n: 2,
        preview: { nodeId: '4:56', pageId: '0:1', fallbackName: '主视觉' },
        label: '主视觉 + 装饰'
      }
    ])
  })

  test('手打无登记占位串不进 chip 条（清单侧会标「未采集的引用」）', () => {
    const chips = resolveSelectionTokenChips(selectionTokenText(9), new Map(), fakeReader({}))
    expect(chips).toEqual([])
  })

  test('同 token 重复引用 → 去重一条 chip；登记但未被引用的条目不产 chip', () => {
    const registry = makeRegistry([
      { n: 1, nodeIds: ['1:23'], names: ['主标题'] },
      { n: 2, nodeIds: ['4:56'], names: ['主视觉'] }
    ])
    const text = `把${selectionTokenText(1)}复刻到${selectionTokenText(1)}`
    const chips = resolveSelectionTokenChips(text, registry, fakeReader({}))
    expect(chips.map((c) => c.n)).toEqual([1])
  })

  test('多 token 按首现序排列（非序号序）', () => {
    const registry = makeRegistry([
      { n: 1, nodeIds: ['1:23'], names: ['主标题'] },
      { n: 2, nodeIds: ['4:56'], names: ['主视觉'] }
    ])
    const text = `将${selectionTokenText(2)}变成${selectionTokenText(1)}的风格`
    const chips = resolveSelectionTokenChips(text, registry, fakeReader({}))
    expect(chips.map((c) => c.n)).toEqual([2, 1])
  })

  test('无 token 文本 → 空 chip 条', () => {
    const registry = makeRegistry([{ n: 1, nodeIds: ['1:23'], names: ['主标题'] }])
    expect(resolveSelectionTokenChips('普通消息', registry, fakeReader({}))).toEqual([])
  })

  test('半删残串不识别（占位串契约的原子边界）', () => {
    const registry = makeRegistry([{ n: 1, nodeIds: ['1:23'], names: ['主标题'] }])
    expect(resolveSelectionTokenChips('「@画布选区-1', registry, fakeReader({}))).toEqual([])
  })
})

// ── request-id 竞态守卫 ──────────────────────────────────────────────────────

describe('createPreviewRequestGuard', () => {
  test('next() 从 1 单调递增', () => {
    const guard = createPreviewRequestGuard()
    expect(guard.next()).toBe(1)
    expect(guard.next()).toBe(2)
    expect(guard.next()).toBe(3)
  })

  test('仅最新请求 id 通过 isCurrent——watch 重入时旧请求结果作废', () => {
    const guard = createPreviewRequestGuard()
    const stale = guard.next()
    const current = guard.next()
    expect(guard.isCurrent(stale)).toBe(false)
    expect(guard.isCurrent(current)).toBe(true)
    // 再取一个新 id，原 current 也变旧
    const newer = guard.next()
    expect(guard.isCurrent(current)).toBe(false)
    expect(guard.isCurrent(newer)).toBe(true)
  })

  test('守卫实例相互独立（每个 chip 组件实例各持一个）', () => {
    const a = createPreviewRequestGuard()
    const b = createPreviewRequestGuard()
    const ra = a.next()
    b.next()
    b.next()
    expect(a.isCurrent(ra)).toBe(true)
    expect(b.isCurrent(ra)).toBe(false)
  })
})

// ── 渲染尝试决策（降级路径） ─────────────────────────────────────────────────

describe('resolvePreviewRender', () => {
  test('renderer 缺席 → null（组件降级 box 图标 + 名称）', () => {
    expect(resolvePreviewRender(null, { width: 100, height: 100 })).toBeNull()
    expect(resolvePreviewRender(undefined, { width: 100, height: 100 })).toBeNull()
  })

  test('节点已删（undefined）→ null（同一降级路径）', () => {
    expect(resolvePreviewRender({}, undefined)).toBeNull()
  })

  test('scale = 40 / max(width, height)（最长边压到目标边长）', () => {
    expect(resolvePreviewRender({}, { width: 400, height: 200 })).toEqual({ scale: 0.1 })
    expect(resolvePreviewRender({}, { width: 20, height: 80 })).toEqual({ scale: 0.5 })
    // 小于目标边长的节点放大到 40px
    expect(resolvePreviewRender({}, { width: 10, height: 20 })).toEqual({ scale: 2 })
  })

  test('0 尺寸节点钳 1 防除零（同上游 Math.max(w, h, 1)）', () => {
    expect(resolvePreviewRender({}, { width: 0, height: 0 })).toEqual({
      scale: NODE_PREVIEW_TARGET_SIZE
    })
  })
})

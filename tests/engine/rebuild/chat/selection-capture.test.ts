/**
 * T70：画布选区采集——selection-capture 纯函数面 + 提交拼接格式钉扎。
 *
 * 验收映射（T70-plan §4 / 实现点 1-6）：
 *  - 采集（captureSelection/FromStore）：空选区 → null；单/多节点快照
 *    （id + 名称 + 类型，顺序保持）；选中 id 已失效 → 跳过
 *  - 扫描（scanSelectionTokens）：混排文本占位串定位（start/end 精确）；
 *    半删残串不识别
 *  - 原子删除（atomicTokenDeletionRange）：Backspace/Delete 光标紧邻完整
 *    占位串 → 整段区间；光标落中间/不紧邻 → null（走默认逐字删）
 *  - 清单（serializeSelectionManifest，§1.4 逐字钉扎）：单节点行 / 多节点
 *    ` + ` 连接 / 两 token 验收句「将「@画布选区-1」变成「@画布选区-2」的风格」
 *    / 已删节点标（已删除）/ 手打无登记占位串标「未采集的引用」/ 采集后改名
 *    以发送瞬间为准 / 同 token 重复引用一行 / 未引用登记条目不出现
 *  - 草稿状态：序号重置（reset）+ T27 快照-恢复往返（snapshot/restore）
 *  - 回填剥尾（stripSelectionManifest）：提交文本剥清单还原草稿；手打相似
 *    文本无「空行 + 全格式行」结构时不动
 */

import { describe, expect, test } from 'bun:test'

import { createEditorStore } from '@/app/editor/session'
import {
  atomicTokenDeletionRange,
  captureSelection,
  captureSelectionFromStore,
  createSelectionDraftState,
  resetSelectionDraftState,
  restoreSelectionDraftState,
  scanSelectionTokens,
  selectionTokenText,
  serializeSelectionManifest,
  snapshotSelectionDraftState,
  stripSelectionManifest,
  type SelectionNodeReader,
  type SelectionTokenRegistry
} from '@/components/assistant/selection-capture'

import { expectDefined } from '#tests/helpers/assert'

/** 纯 reader 假实现（不依赖 graph——格式钉扎用确定 id/名称/类型） */
function fakeReader(nodes: Record<string, { name: string; type: string }>): SelectionNodeReader {
  return { getNode: (id) => nodes[id] }
}

function makeRegistry(
  entries: Array<{ n: number; nodeIds: string[]; names?: string[]; types?: string[] }>
): SelectionTokenRegistry {
  const registry: SelectionTokenRegistry = new Map()
  for (const entry of entries) {
    registry.set(entry.n, {
      n: entry.n,
      pageId: '0:1',
      nodeIds: entry.nodeIds,
      snapshot: entry.nodeIds.map((nodeId, i) => ({
        nodeId,
        name: entry.names?.[i] ?? nodeId,
        type: entry.types?.[i] ?? 'FRAME'
      }))
    })
  }
  return registry
}

// ── 采集 ─────────────────────────────────────────────────────────────────────

describe('captureSelection（T70 实现点 1）', () => {
  test('空选区 → null（不产生 token）', () => {
    const store = createEditorStore()
    expect(store.state.selectedIds.size).toBe(0)
    expect(captureSelectionFromStore(store, 1)).toBeNull()
  })

  test('单节点：登记 pageId + nodeIds + 名称/类型快照', () => {
    const store = createEditorStore()
    const pageId = store.state.currentPageId
    const frame = store.graph.createNode('FRAME', pageId, {
      name: '主视觉',
      width: 100,
      height: 100
    })
    store.select([frame.id])

    const entry = captureSelectionFromStore(store, 1)
    expect(entry).not.toBeNull()
    expect(entry?.n).toBe(1)
    expect(entry?.pageId).toBe(pageId)
    expect(entry?.nodeIds).toEqual([frame.id])
    expect(entry?.snapshot).toEqual([{ nodeId: frame.id, name: '主视觉', type: 'FRAME' }])
  })

  test('多节点：选区顺序保持；选中 id 已失效 → 跳过', () => {
    const store = createEditorStore()
    const pageId = store.state.currentPageId
    const a = store.graph.createNode('FRAME', pageId, { name: 'A', width: 10, height: 10 })
    const b = store.graph.createNode('TEXT', pageId, { name: 'B', width: 10, height: 10 })
    store.select([a.id, 'missing:id', b.id])

    const entry = captureSelectionFromStore(store, 7)
    expect(entry?.nodeIds).toEqual([a.id, b.id])
    expect(entry?.snapshot.map((s) => s.type)).toEqual(['FRAME', 'TEXT'])
  })

  test('captureSelection 纯函数：全部选中 id 失效 → null', () => {
    const entry = captureSelection(
      { pageId: '0:1', selectedIds: ['gone:1', 'gone:2'] },
      fakeReader({}),
      1
    )
    expect(entry).toBeNull()
  })
})

// ── 占位串扫描 ───────────────────────────────────────────────────────────────

describe('scanSelectionTokens（T70 实现点 2/3）', () => {
  test('混排文本：start/end 精确定位（含前后文字）', () => {
    const text = `把${selectionTokenText(1)}变成${selectionTokenText(2)}的风格`
    const tokens = scanSelectionTokens(text)
    expect(tokens).toEqual([
      { n: 1, start: 1, end: 1 + selectionTokenText(1).length },
      { n: 2, start: 1 + selectionTokenText(1).length + 2, end: text.length - 3 }
    ])
    expect(text.slice(tokens[0].start, tokens[0].end)).toBe(selectionTokenText(1))
    expect(text.slice(tokens[1].start, tokens[1].end)).toBe(selectionTokenText(2))
  })

  test('半删残串不识别（缺角括号/缺序号都不是 token）', () => {
    expect(scanSelectionTokens('「@画布选区-1')).toEqual([])
    expect(scanSelectionTokens('@画布选区-1」')).toEqual([])
    expect(scanSelectionTokens('「@画布选区-」')).toEqual([])
    expect(scanSelectionTokens('「@画布选区-1」残「@画布选区-2」')).toHaveLength(2)
  })
})

// ── 原子删除区间 ─────────────────────────────────────────────────────────────

describe('atomicTokenDeletionRange（T70 实现点 3）', () => {
  const token = selectionTokenText(1)
  const text = `前${token}后`

  test('Backspace：光标紧邻 token 尾 → 整段区间', () => {
    const cursor = 1 + token.length
    expect(atomicTokenDeletionRange(text, cursor, 'backward')).toEqual({
      start: 1,
      end: cursor
    })
  })

  test('Delete：光标紧贴 token 头 → 整段区间', () => {
    expect(atomicTokenDeletionRange(text, 1, 'forward')).toEqual({
      start: 1,
      end: 1 + token.length
    })
  })

  test('光标落 token 中间/不紧邻 → null（默认逐字删）', () => {
    // token 中间（backward/forward 都不拦）
    expect(atomicTokenDeletionRange(text, 3, 'backward')).toBeNull()
    expect(atomicTokenDeletionRange(text, 3, 'forward')).toBeNull()
    // 紧邻 token 尾但方向反了（光标后是「后」字）
    expect(atomicTokenDeletionRange(text, 1 + token.length, 'forward')).toBeNull()
    // 紧邻 token 头但方向反了（光标前是「前」字）
    expect(atomicTokenDeletionRange(text, 1, 'backward')).toBeNull()
    // 文档起止边界
    expect(atomicTokenDeletionRange(token, 0, 'backward')).toBeNull()
    expect(atomicTokenDeletionRange(token, token.length, 'forward')).toBeNull()
  })

  test('token 在文末：Backspace 删整段后不留残串', () => {
    const tail = `文字${token}`
    const range = expectDefined(atomicTokenDeletionRange(tail, tail.length, 'backward'))
    expect(range).toEqual({ start: 2, end: tail.length })
    expect(tail.slice(0, range.start) + tail.slice(range.end)).toBe('文字')
  })
})

// ── 提交清单（§1.4 逐字钉扎） ────────────────────────────────────────────────

describe('serializeSelectionManifest（T70 实现点 4）', () => {
  test('无 token → 原文返回（不追加清单）', () => {
    const result = serializeSelectionManifest('普通消息', new Map(), fakeReader({}))
    expect(result.text).toBe('普通消息')
    expect(result.referencedNs).toEqual([])
    expect(result.uncollectedNs).toEqual([])
  })

  test('单 token 单节点：逐字格式（空行 + [画布选区] 头 + 清单行）', () => {
    const registry = makeRegistry([{ n: 1, nodeIds: ['1:23'], names: ['主标题'], types: ['TEXT'] }])
    const reader = fakeReader({ '1:23': { name: '主标题', type: 'TEXT' } })
    const result = serializeSelectionManifest(
      `参考${selectionTokenText(1)}改一版`,
      registry,
      reader
    )
    expect(result.text).toBe(
      `参考${selectionTokenText(1)}改一版\n\n[画布选区]\n@画布选区-1 = 节点 1:23「主标题」(TEXT)`
    )
    expect(result.referencedNs).toEqual([1])
    expect(result.uncollectedNs).toEqual([])
  })

  test('多节点 token：一行内 ` + ` 连接（§1.4 第二行形态）', () => {
    const registry = makeRegistry([
      { n: 2, nodeIds: ['4:56', '4:57'], names: ['主视觉', '装饰'], types: ['FRAME', 'VECTOR'] }
    ])
    const reader = fakeReader({
      '4:56': { name: '主视觉', type: 'FRAME' },
      '4:57': { name: '装饰', type: 'VECTOR' }
    })
    const result = serializeSelectionManifest(selectionTokenText(2), registry, reader)
    expect(result.text).toBe(
      `${selectionTokenText(2)}\n\n[画布选区]\n@画布选区-2 = 节点 4:56「主视觉」(FRAME) + 节点 4:57「装饰」(VECTOR)`
    )
  })

  test('两 token 验收句：「将@画布选区-1变成@画布选区-2的风格」→ 尾部两行', () => {
    const registry = makeRegistry([
      { n: 1, nodeIds: ['1:23'], names: ['主标题'], types: ['TEXT'] },
      { n: 2, nodeIds: ['4:56'], names: ['主视觉'], types: ['FRAME'] }
    ])
    const reader = fakeReader({
      '1:23': { name: '主标题', type: 'TEXT' },
      '4:56': { name: '主视觉', type: 'FRAME' }
    })
    const draft = `将${selectionTokenText(1)}变成${selectionTokenText(2)}的风格`
    const result = serializeSelectionManifest(draft, registry, reader)
    expect(result.text).toBe(
      `${draft}\n\n[画布选区]\n@画布选区-1 = 节点 1:23「主标题」(TEXT)\n@画布选区-2 = 节点 4:56「主视觉」(FRAME)`
    )
    expect(result.referencedNs).toEqual([1, 2])
  })

  test('采集后删除节点 → 清单标（已删除），名称回落采集快照', () => {
    const registry = makeRegistry([{ n: 1, nodeIds: ['1:23'], names: ['主标题'], types: ['TEXT'] }])
    const result = serializeSelectionManifest(selectionTokenText(1), registry, fakeReader({}))
    expect(result.text).toBe(
      `${selectionTokenText(1)}\n\n[画布选区]\n@画布选区-1 = 节点 1:23「主标题」(已删除)`
    )
  })

  test('采集后改名 → 清单以发送瞬间 graph 状态为准（新名 + 新类型）', () => {
    const registry = makeRegistry([{ n: 1, nodeIds: ['1:23'], names: ['旧名'], types: ['TEXT'] }])
    const reader = fakeReader({ '1:23': { name: '改名后', type: 'TEXT' } })
    const result = serializeSelectionManifest(selectionTokenText(1), registry, reader)
    expect(result.text).toContain('节点 1:23「改名后」(TEXT)')
    expect(result.text).not.toContain('旧名')
  })

  test('手打无登记占位串 → 清单标「未采集的引用」+ uncollectedNs', () => {
    const result = serializeSelectionManifest(
      `看看${selectionTokenText(9)}`,
      new Map(),
      fakeReader({})
    )
    expect(result.text).toBe(
      `看看${selectionTokenText(9)}\n\n[画布选区]\n@画布选区-9 = 未采集的引用`
    )
    expect(result.uncollectedNs).toEqual([9])
  })

  test('同 token 文中重复引用 → 清单只出一行；未引用登记条目不出现', () => {
    const registry = makeRegistry([
      { n: 1, nodeIds: ['1:23'], names: ['主标题'], types: ['TEXT'] },
      { n: 2, nodeIds: ['4:56'], names: ['未被引用的'], types: ['FRAME'] }
    ])
    const reader = fakeReader({ '1:23': { name: '主标题', type: 'TEXT' } })
    const draft = `${selectionTokenText(1)}再提一次${selectionTokenText(1)}`
    const result = serializeSelectionManifest(draft, registry, reader)
    expect(result.text).toBe(`${draft}\n\n[画布选区]\n@画布选区-1 = 节点 1:23「主标题」(TEXT)`)
  })

  test('清单行序 = token 首现序（非序号大小序）', () => {
    const registry = makeRegistry([
      { n: 1, nodeIds: ['1:23'], names: ['一'], types: ['TEXT'] },
      { n: 2, nodeIds: ['4:56'], names: ['二'], types: ['FRAME'] }
    ])
    const reader = fakeReader({
      '1:23': { name: '一', type: 'TEXT' },
      '4:56': { name: '二', type: 'FRAME' }
    })
    const draft = `${selectionTokenText(2)}先于${selectionTokenText(1)}`
    const result = serializeSelectionManifest(draft, registry, reader)
    expect(result.referencedNs).toEqual([2, 1])
    const lines = result.text.split('\n')
    // [draft, '', '[画布选区]', 行1, 行2]——空行占位
    expect(lines[3]).toBe('@画布选区-2 = 节点 4:56「二」(FRAME)')
    expect(lines[4]).toBe('@画布选区-1 = 节点 1:23「一」(TEXT)')
  })

  test('store 端到端：采集 → 删除节点 → 清单标（已删除）', () => {
    const store = createEditorStore()
    const pageId = store.state.currentPageId
    const frame = store.graph.createNode('FRAME', pageId, {
      name: '主视觉',
      width: 100,
      height: 100
    })
    store.select([frame.id])
    const entry = expectDefined(captureSelectionFromStore(store, 1))
    const registry: SelectionTokenRegistry = new Map([[entry.n, entry]])

    store.graph.updateNode(frame.id, { name: '主视觉 v2' })
    const live = serializeSelectionManifest(selectionTokenText(1), registry, store.graph)
    expect(live.text).toContain(`节点 ${frame.id}「主视觉 v2」(FRAME)`)

    store.graph.deleteNode(frame.id)
    const gone = serializeSelectionManifest(selectionTokenText(1), registry, store.graph)
    expect(gone.text).toContain(`节点 ${frame.id}「主视觉」(已删除)`)
  })
})

// ── 草稿状态（序号生命周期 + T27 快照往返） ──────────────────────────────────

describe('草稿期 token 状态（T70 实现点 1/5）', () => {
  test('序号从 1 递增；reset 后归 1（发送后重置纪律）', () => {
    const state = createSelectionDraftState()
    expect(state.nextSeq).toBe(1)
    state.registry.set(state.nextSeq, { n: 1, pageId: '0:1', nodeIds: ['1:1'], snapshot: [] })
    state.nextSeq += 1
    state.registry.set(state.nextSeq, { n: 2, pageId: '0:1', nodeIds: ['1:2'], snapshot: [] })
    state.nextSeq += 1
    expect(state.nextSeq).toBe(3)

    resetSelectionDraftState(state)
    expect(state.nextSeq).toBe(1)
    expect(state.registry.size).toBe(0)
  })

  test('T27 快照-恢复往返：提交前快照 → reset → 恢复后登记表/序号原样', () => {
    const state = createSelectionDraftState()
    const reader = fakeReader({ '1:23': { name: '主标题', type: 'TEXT' } })
    const entry = expectDefined(
      captureSelection({ pageId: '0:1', selectedIds: ['1:23'] }, reader, state.nextSeq)
    )
    state.registry.set(entry.n, entry)
    state.nextSeq += 1

    const snapshot = snapshotSelectionDraftState(state)
    resetSelectionDraftState(state)
    expect(state.registry.size).toBe(0)
    expect(state.nextSeq).toBe(1)

    restoreSelectionDraftState(state, snapshot)
    expect(state.nextSeq).toBe(2)
    expect(state.registry.get(1)).toEqual(entry)
  })

  test('快照深拷贝独立：提交后原地改 state 不污染快照', () => {
    const state = createSelectionDraftState()
    state.registry.set(1, {
      n: 1,
      pageId: '0:1',
      nodeIds: ['1:23'],
      snapshot: [{ nodeId: '1:23', name: '主标题', type: 'TEXT' }]
    })
    const snapshot = snapshotSelectionDraftState(state)
    state.registry.get(1)?.nodeIds.push('9:99')
    state.registry.get(1)?.snapshot.push({ nodeId: '9:99', name: 'X', type: 'FRAME' })
    expect(snapshot.registry.get(1)?.nodeIds).toEqual(['1:23'])
    expect(snapshot.registry.get(1)?.snapshot).toHaveLength(1)
  })
})

// ── 回填剥尾 ─────────────────────────────────────────────────────────────────

describe('stripSelectionManifest（T70 实现点 5，T27 回填）', () => {
  test('含清单的提交文本 → 剥尾还原草稿（占位串保留）', () => {
    const draft = `将${selectionTokenText(1)}变成${selectionTokenText(2)}的风格`
    const registry = makeRegistry([
      { n: 1, nodeIds: ['1:23'], names: ['主标题'], types: ['TEXT'] },
      { n: 2, nodeIds: ['4:56'], names: ['主视觉'], types: ['FRAME'] }
    ])
    const reader = fakeReader({
      '1:23': { name: '主标题', type: 'TEXT' },
      '4:56': { name: '主视觉', type: 'FRAME' }
    })
    const submitted = serializeSelectionManifest(draft, registry, reader).text
    expect(stripSelectionManifest(submitted)).toBe(draft)
  })

  test('无清单原文不动；手打相似文本（无空行分隔结构）不动', () => {
    expect(stripSelectionManifest('普通消息')).toBe('普通消息')
    const handTyped = '[画布选区]\n@画布选区-1 = 节点 1:23「主标题」(TEXT)'
    expect(stripSelectionManifest(handTyped)).toBe(handTyped)
  })
})

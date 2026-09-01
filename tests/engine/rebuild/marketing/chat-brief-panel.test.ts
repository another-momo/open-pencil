/**
 * T66（Phase 3 W3，决策①②③）：ChatContextBar 双段式 trigger 计数口径 +
 * createBriefOnPage 排版结算四件套 + ChatBriefDialog 素材写回通路。
 *
 * 验收映射（T66-plan §4）：
 *  - ② createBriefOnPage 收尾：computeAllLayouts 排版结算（brief 子树高度不
 *    塌缩 / AI 结论卡满高，brief.test.ts:235-247 同口径）+ select 选中 +
 *    undo 登记（undo/redo 往返）
 *  - ② 素材写回（dialog 单测面）：上传 bytes 内容寻址入库 + 条目挂载 +
 *    结算后条目图片位宽高非 0；标题/内容写回；删除；每次变更一次 undo 事务
 *  - ② 选区添加：IMAGE fill 扫描（findSelectionImageNodes）+ 一律复制
 *    语义（原节点保留——移动选择器简化偏差的钉扎）
 *  - ③ fieldsHint 新文案落画布（createBrief 产物 FieldsHint 文本节点）
 *  - ① scanCurrentPageBriefs 即 trigger 计数口径 = 当前页（跨页 brief 不计）
 */

import { describe, expect, test } from 'bun:test'

import { makeFigmaFromStore } from '@/app/automation/bridge/figma-factory'
import { createEditorStore } from '@/app/editor/session'
import {
  addBriefMaterialFromUpload,
  addBriefMaterialsFromSelection,
  createBriefOnPage,
  findSelectionImageNodes,
  readBriefView,
  removeBriefMaterialEntry,
  saveBriefContent,
  saveMaterialCaption,
  scanCurrentPageBriefs
} from '@/components/chat/active-design'

import {
  BRIEF_WIDTH,
  BRIEF_ZONE_CONCLUSIONS,
  createBrief,
  findBriefZone
} from '#core/tools/fork/marketing/brief'
import { BRIEF_TEXTS } from '#core/tools/fork/marketing/texts'

import { expectDefined } from '#tests/helpers/assert'

// makeFigmaFromStore 读 window.innerWidth/innerHeight 构造 viewport（bun 无 DOM；
// allowlist.test.ts:52 同范式 stub）。IS_BROWSER 在 core constants 加载时已定型
// 为 false，store 侧 viewport 走 1920x1080 兜底——stub 仅服务桥这一处直读。
;(globalThis as typeof globalThis & { window?: unknown }).window = {
  innerWidth: 1920,
  innerHeight: 1080
}

function makeImageFill(hash: string) {
  return {
    type: 'IMAGE' as const,
    color: { r: 0, g: 0, b: 0, a: 0 },
    opacity: 1,
    visible: true,
    imageHash: hash,
    imageScaleMode: 'FILL' as const
  }
}

describe('createBriefOnPage 收尾四件套（T66 决策②根因修复）', () => {
  test('排版结算 + 选中定位 + undo 登记（undo/redo 往返）', () => {
    const store = createEditorStore()
    const briefId = createBriefOnPage(store, '夏季新品买一送一')

    const page = expectDefined(store.graph.getNode(store.state.currentPageId))
    expect(page.childIds).toContain(briefId)

    // computeAllLayouts 已跑：根高 HUG 结算 > 200、AI 结论卡 384 宽满高——
    // 未结算态文字节点未测量、auto-layout 折叠/叠块（T65 回归实证）
    const brief = expectDefined(store.graph.getNode(briefId))
    expect(brief.width).toBe(BRIEF_WIDTH)
    expect(brief.height).toBeGreaterThan(200)
    const aiCard = expectDefined(findBriefZone(store.graph, brief, BRIEF_ZONE_CONCLUSIONS))
    expect(aiCard.width).toBe(384)
    expect(aiCard.height).toBe(brief.height - 72)

    // 内容播种落画布（updateBriefContent）
    const view = expectDefined(readBriefView(store, briefId))
    expect(view.content).toBe('夏季新品买一送一')

    // select 生效（zoomToSelection 随行——viewport 有兜底，断言选中即可）
    expect([...store.state.selectedIds]).toEqual([briefId])

    // undo 登记：撤销 → brief 消失；重做 → 回来（排版随快照恢复）
    expect(store.undo.canUndo).toBe(true)
    store.undo.undo()
    expect(store.graph.getNode(briefId)).toBeUndefined()
    store.undo.redo()
    const restored = expectDefined(store.graph.getNode(briefId))
    expect(restored.height).toBeGreaterThan(200)
  })

  test('fieldsHint 新文案落画布（T66 决策③：引导式，不写死字段清单）', () => {
    const store = createEditorStore()
    const briefId = createBriefOnPage(store, '')

    const texts: string[] = []
    const stack = [briefId]
    while (stack.length > 0) {
      const node = store.graph.getNode(expectDefined(stack.pop()))
      if (!node) continue
      if (node.type === 'TEXT') texts.push(node.text)
      stack.push(...node.childIds)
    }
    expect(texts).toContain(
      '把需求写在这里：要做什么、给谁看、必须出现的内容、素材怎么用——写得越完整，AI 越少猜'
    )
    expect(BRIEF_TEXTS.fieldsHint).not.toContain('需要的字段')
  })
})

describe('需求单大面板写回通路（T66 决策②：结算 + undo 包裹 core 原语）', () => {
  test('上传素材：bytes 内容寻址入库 + 条目挂载 + 条目布局结算非 0', () => {
    const store = createEditorStore()
    const briefId = createBriefOnPage(store, '')

    const bytes = new Uint8Array([1, 2, 3, 4, 5])
    const entryId = addBriefMaterialFromUpload(store, briefId, bytes)
    expect(entryId).not.toBeNull()

    const view = expectDefined(readBriefView(store, briefId))
    const material = expectDefined(view.materials.find((m) => m.entryId === entryId))
    const hash = expectDefined(material.imageHash)
    // 图像入库通路：figma.createImage → graph.images（figma-api/index.ts:524）
    expect(store.graph.images.get(hash)).toEqual(bytes)

    // 排版结算信号：条目图片位宽高非 0（未结算态 HUG 折叠为 0）
    const imageNode = expectDefined(store.graph.getNode(expectDefined(material.imageNodeId)))
    expect(imageNode.width).toBeGreaterThan(0)
    expect(imageNode.height).toBeGreaterThan(0)

    // undo：撤销 add-material → 条目移除（图像字节留内容寻址缓存，与旧分支同律）
    store.undo.undo()
    const after = expectDefined(readBriefView(store, briefId))
    expect(after.materials).toHaveLength(0)
  })

  test('内容/标题写回：落画布 + 各自 undo 事务（撤销逐层回滚）', () => {
    const store = createEditorStore()
    const briefId = createBriefOnPage(store, '原始内容')
    const entryId = expectDefined(
      addBriefMaterialFromUpload(store, briefId, new Uint8Array([9, 9, 9]))
    )

    expect(saveMaterialCaption(store, entryId, '主视觉')).toBe(true)
    expect(saveBriefContent(store, briefId, '改写后的内容')).toBe(true)

    let view = expectDefined(readBriefView(store, briefId))
    expect(view.content).toBe('改写后的内容')
    expect(view.materials[0]?.caption).toBe('主视觉')

    // LIFO：撤销内容写回 → 回播种值；再撤销标题写回 → 回空串
    store.undo.undo()
    view = expectDefined(readBriefView(store, briefId))
    expect(view.content).toBe('原始内容')
    store.undo.undo()
    view = expectDefined(readBriefView(store, briefId))
    expect(view.materials[0]?.caption).toBe('')
  })

  test('素材删除：条目移除 + undo 可恢复', () => {
    const store = createEditorStore()
    const briefId = createBriefOnPage(store, '')
    const entryId = expectDefined(
      addBriefMaterialFromUpload(store, briefId, new Uint8Array([7, 7]))
    )

    expect(removeBriefMaterialEntry(store, entryId)).toBe(true)
    expect(expectDefined(readBriefView(store, briefId)).materials).toHaveLength(0)

    store.undo.undo()
    expect(expectDefined(readBriefView(store, briefId)).materials).toHaveLength(1)
  })

  test('从画布选区添加：IMAGE fill 扫描 + 一律复制（原节点保留）', () => {
    const store = createEditorStore()
    const briefId = createBriefOnPage(store, '')
    const rect = store.graph.createNode('RECTANGLE', store.state.currentPageId, {
      name: 'img',
      fills: [makeImageFill('deadbeef')]
    })
    // 非图像节点不入选
    store.graph.createNode('RECTANGLE', store.state.currentPageId, { name: 'plain' })
    store.select([rect.id])

    expect(findSelectionImageNodes(store)).toEqual([{ nodeId: rect.id, hash: 'deadbeef' }])
    expect(addBriefMaterialsFromSelection(store, briefId)).toBe(1)

    const view = expectDefined(readBriefView(store, briefId))
    expect(view.materials).toHaveLength(1)
    expect(view.materials[0]?.imageHash).toBe('deadbeef')
    // 复制语义钉扎：画布原节点保留（移动选择器简化偏差，self-check 已记录）
    expect(store.graph.getNode(rect.id)).toBeDefined()

    // 空选区 → 0 条，不产生 undo 条目
    store.select([])
    const undoDepthBefore = store.undo.canUndo
    expect(addBriefMaterialsFromSelection(store, briefId)).toBe(0)
    expect(store.undo.canUndo).toBe(undoDepthBefore)
  })
})

describe('trigger 需求单计数口径（T66 决策①：当前页，与面板列表同函数）', () => {
  test('scanCurrentPageBriefs 只计当前页 brief', () => {
    const store = createEditorStore()
    const briefId = createBriefOnPage(store, '')
    expect(scanCurrentPageBriefs(store).map((entry) => entry.briefId)).toEqual([briefId])

    // 另一页的 brief 不计入（T65 决策 D4 口径沿用——拍板⑩）
    const page2 = store.graph.addPage('Page 2')
    createBrief(makeFigmaFromStore(store, page2.id))
    expect(scanCurrentPageBriefs(store).map((entry) => entry.briefId)).toEqual([briefId])
  })
})

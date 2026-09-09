/**
 * T91a 回归：active-design 端点探针（生成的桥 eval 串）× 真实数据形态接线测试。
 *
 * 事故背景：T91a（d1809c1d）把 design.briefId / bound-designs 迁 UUID 后，
 * host 生成的探针 eval 串仍按节点 id 解析、且不捕 design uniqueId——host
 * 单测全部 mock probeCandidate，生成串从未在测试里执行过，「切换到此」
 * 对全部新文档 100% 422 brief_mismatch（owner 实测撞见，2026-09-09）。
 *
 * 本文件经 createBridgeSlotIO 的执行器注入缝，把同一份生成串放到真实
 * store（setupToolTest + createBrief + setupDesign 全真 T91a 产线）上跑，
 * 覆盖「生成代码 × 真实数据形态」接线面；另钉老文档形态（node id）兼容。
 */
import { describe, expect, test } from 'bun:test'

import type { FigmaAPI } from '@open-pencil/core/figma-api'
import { getSharedPluginData, setSharedPluginData } from '@open-pencil/core/figma-api/plugin-data'
import { wrapEvalCode } from '@open-pencil/core/tools'
import { ACTIVE_DESIGN_KEY } from '@open-pencil/core/tools/fork/marketing/active-design'
import {
  BRIEF_BINDING_KEY,
  BRIEF_PLUGIN_NAMESPACE,
  BRIEF_ROLE_KEY,
  BRIEF_ROLE_VALUE,
  DESIGN_BRIEF_KEY,
  briefBoundDesignIds,
  createBrief
} from '@open-pencil/core/tools/fork/marketing/brief'
import { MARKETING_ROLE_ROOT, setupDesign } from '@open-pencil/core/tools/fork/marketing/setup'

import {
  createBridgeSlotIO,
  setActiveDesignViaBridge,
  type ActiveDesignBridgeIO
} from '@/app/ai/pi-backend/active-design-host'

import { setupToolTest } from '#tests/helpers/tools'

/** 与桥 eval-handler 同形态执行生成串（AsyncFunction + wrapEvalCode） */
async function evalInPage(figma: FigmaAPI, code: string): Promise<unknown> {
  const AsyncFunction = Object.getPrototypeOf(async function () {
    /* noop */
  }).constructor
  const fn = new AsyncFunction('figma', wrapEvalCode(code)) as (figma: FigmaAPI) => Promise<unknown>
  return fn(figma)
}

function bridgeOn(figma: FigmaAPI): ActiveDesignBridgeIO {
  return createBridgeSlotIO((code) => evalInPage(figma, code))
}

/** 全真 T91a 产线：一页一 brief 一设计根（briefId/bound-designs 均 UUID 形态） */
function setupT91aPage() {
  const { graph, figma } = setupToolTest()
  const brief = createBrief(figma)
  const result = setupDesign(figma, {
    modeId: 'general',
    briefId: brief.id,
    confirmedNewIntent: true
  })
  if ('error' in result) throw new Error(`setup_design failed: ${result.error}`)
  return { graph, figma, brief, rootId: result.rootId }
}

describe('active-design 端点探针 × 真实数据形态（生成 eval 串直跑真实 store）', () => {
  test('T91a 形态（UUID）：探针解析 + 切换成功 + 落槽 + briefId 归一节点 id', async () => {
    const { graph, figma, brief, rootId } = setupT91aPage()

    // 钉扎前提：产线写的确实是 UUID 形态——若未来改回节点 id，本测试应重审而非空转
    const designNode = graph.getNode(rootId)
    const rawBriefId = designNode
      ? getSharedPluginData(designNode, BRIEF_PLUGIN_NAMESPACE, DESIGN_BRIEF_KEY)
      : ''
    expect(rawBriefId).not.toBe(brief.id)
    expect(rawBriefId).not.toBe('')
    expect(briefBoundDesignIds(graph.getNode(brief.id))).not.toContain(rootId)

    const result = await setActiveDesignViaBridge(rootId, undefined, bridgeOn(figma))
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.modeId).toBe('general')
      expect(result.briefId).toBe(brief.id) // 归一为节点 id（snapshotDesignRoot 同语义）
    }

    const docRoot = graph.getNode(graph.rootId)
    expect(
      docRoot ? getSharedPluginData(docRoot, BRIEF_PLUGIN_NAMESPACE, ACTIVE_DESIGN_KEY) : ''
    ).toBe(rootId)
  })

  test('老文档形态（节点 id + 无 uniqueId）：兼容路径不回归', async () => {
    const { graph, figma } = setupToolTest()
    const pageId = figma.currentPage.id
    const design = graph.createNode('FRAME', pageId, {
      name: 'Old Design',
      x: 0,
      y: 0,
      width: 100,
      height: 100
    })
    setSharedPluginData(graph, design, BRIEF_PLUGIN_NAMESPACE, BRIEF_ROLE_KEY, MARKETING_ROLE_ROOT)
    const brief = graph.createNode('FRAME', pageId, {
      name: 'Old Brief',
      x: 0,
      y: 200,
      width: 100,
      height: 100
    })
    setSharedPluginData(graph, brief, BRIEF_PLUGIN_NAMESPACE, BRIEF_ROLE_KEY, BRIEF_ROLE_VALUE)
    // 老形态：design.briefId = brief 节点 id；bound-designs = design 节点 id；均无 uniqueId
    setSharedPluginData(graph, design, BRIEF_PLUGIN_NAMESPACE, DESIGN_BRIEF_KEY, brief.id)
    setSharedPluginData(graph, brief, BRIEF_PLUGIN_NAMESPACE, BRIEF_BINDING_KEY, design.id)

    const result = await setActiveDesignViaBridge(design.id, undefined, bridgeOn(figma))
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.briefId).toBe(brief.id)
  })

  test('T91a 形态下 brief 真不一致（bound 列表为空）仍 422——校验没有被放宽', async () => {
    const { graph, figma, brief, rootId } = setupT91aPage()
    // 拆掉绑定：bound-designs 清空（design.briefId 仍指向 brief UUID）
    const briefNode = graph.getNode(brief.id)
    if (briefNode)
      setSharedPluginData(graph, briefNode, BRIEF_PLUGIN_NAMESPACE, BRIEF_BINDING_KEY, '')

    const result = await setActiveDesignViaBridge(rootId, undefined, bridgeOn(figma))
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toBe('brief_mismatch')
  })
})

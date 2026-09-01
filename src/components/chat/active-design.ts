/**
 * T61（Phase 3 W3/T-B10）：选择器 UI 重做的共享前端助手——
 *
 *  - 新建意图信封序列化（共享契约 1，逐字：`[新建意图确认 modeId=<id> profileId=<id>
 *    canvas=<值>]`，全字段可缺省——canvas 为 T65 §2.4 扩展；T60/T65 宿主侧剥离正则
 *    见 pi-backend/active-design-host.ts）与宿主发起的 data part 类型（确认卡 /
 *    同意决定记录 / T65 上下文切换分割线回执）。
 *  - 物化判据（共享契约 4）：单一事实源 = core active-design.ts 的
 *    isDesignMaterialized（根框子树内 ①任一节点 fills 含 IMAGE fill ②任一节点
 *    携带 hero-geometry 骨架分区标记；T52 zone 标记在 brief 侧不作判据——
 *    T60-plan 定谳 6 钉扎）——本文件只 re-export，不双写判定逻辑。
 *  - 切换端点客户端（共享契约 2：POST /api/pi/active-design {nodeId} →
 *    身份三元组 {modeId, profileId, briefId}）——面板「设为当前」与同意卡共用。
 *  - 面板读画布通路：makeFigmaFromStore seam（automation/bridge）+ core
 *    scanMarketingDesigns / brief-edit 读写原语。
 */

import {
  isDesignMaterialized as isDesignMaterializedCore,
  walkSubtree
} from '@open-pencil/core/tools/fork/marketing/active-design'
import {
  BRIEF_ESTIMATED_HEIGHT,
  BRIEF_WIDTH,
  briefBoundDesignIds,
  createBrief,
  isBrief
} from '@open-pencil/core/tools/fork/marketing/brief'
import {
  readBrief,
  updateBriefContent,
  updateMaterialCaption
} from '@open-pencil/core/tools/fork/marketing/brief-edit'
import type { BriefView } from '@open-pencil/core/tools/fork/marketing/brief-edit'
import { scanMarketingDesigns } from '@open-pencil/core/tools/fork/marketing/setup'
import type {
  CanvasSizePreset,
  MarketingDesignRef
} from '@open-pencil/core/tools/fork/marketing/setup'
import { findPlacementPosition } from '@open-pencil/core/tools/fork/placement'

import { makeFigmaFromStore } from '@/app/automation/bridge/figma-factory'
import type { EditorStore } from '@/app/editor/active-store'

// ── 新建意图信封（共享契约 1；T65 §2.4 扩展 canvas 字段） ─────────────────────

/**
 * 逐字契约：`[新建意图确认 modeId=<id> profileId=<id> canvas=<值>]`（全字段可缺省；
 * canvas 值 = 预设/自由 canvas 字符串，`750x` 高 HUG 或 `750x2000` 固定高）。
 * 置于消息首行；宿主（T60/T65）剥离置旗标，剩余文本进 run。
 */
export function serializeNewIntentEnvelope(selection: {
  modeId?: string | null
  profileId?: string | null
  canvas?: string | null
}): string {
  const fields: string[] = []
  if (selection.modeId) fields.push(`modeId=${selection.modeId}`)
  if (selection.profileId) fields.push(`profileId=${selection.profileId}`)
  if (selection.canvas) fields.push(`canvas=${selection.canvas}`)
  return fields.length > 0 ? `[新建意图确认 ${fields.join(' ')}]` : '[新建意图确认]'
}

// ── 尺寸预设（T65 §2.3 契约 [{label, canvas}]；core setup.ts CanvasSizePreset 单源） ──

/** 形状与 core CanvasSizePreset 全等 → 别名不双写（type-shapes 门禁；
 *  同 manifest.ts PiStudioModeEntry = StudioMode 先例） */
export type NewIntentSizeChoice = CanvasSizePreset

/** canvas 值格式（共享契约 §2.2：`750x` 高 HUG / `750x2000` 固定高） */
export const CANVAS_VALUE_PATTERN = /^\d+x(\d+)?$/

/** sizes 清单防御性归一（输入未知形状 → 只留 {label, canvas} 全合法条目，否则 []） */
export function normalizeSizeChoices(input: unknown): NewIntentSizeChoice[] {
  if (!Array.isArray(input)) return []
  const choices: NewIntentSizeChoice[] = []
  for (const entry of input) {
    if (typeof entry !== 'object' || entry === null) continue
    const label = (entry as { label?: unknown }).label
    const canvas = (entry as { canvas?: unknown }).canvas
    if (
      typeof label === 'string' &&
      label !== '' &&
      typeof canvas === 'string' &&
      CANVAS_VALUE_PATTERN.test(canvas)
    ) {
      choices.push({ label, canvas })
    }
  }
  return choices
}

/**
 * manifest modes[].sizes 投影（T65 对账契约：subagent X 落 manifest 数据面）。
 * 形状缺席/不符 → []（确认卡尺寸行只剩自定义输入，不崩）。
 */
export function modeSizeChoices(mode: unknown): NewIntentSizeChoice[] {
  if (typeof mode !== 'object' || mode === null) return []
  return normalizeSizeChoices((mode as { sizes?: unknown }).sizes)
}

// ── 宿主发起的 data part 类型 ────────────────────────────────────────────────

/** 新建意图确认卡（宿主发起非工具 part，T56 卡片范式） */
export const NEW_INTENT_PART_TYPE = 'data-new-intent-confirm'

export interface NewIntentReferenceCandidate {
  nodeId: string
  label: string
}

export interface NewIntentPartData {
  modeId: string | null
  profileId: string | null
  /** Case A = 物化前（一行话术）；Case B = 物化后（四项） */
  caseKind: 'A' | 'B'
  /** 被替换的当前目标名（无 active 时 null） */
  activeDesignName: string | null
  /** T65：尺寸预设行（按选中 mode 的 manifest.sizes 投影；空 = 只有自定义输入） */
  sizeChoices: NewIntentSizeChoice[]
  /** Case B 携带物候选：当前设计区已生成图片（可选 references） */
  references: NewIntentReferenceCandidate[]
  resolved: 'confirmed' | 'cancelled' | null
}

/** set_active_design 同意决定记录（本地系统行同消息挂载；重载后派生置灰） */
export const ACTIVE_DESIGN_DECISION_PART_TYPE = 'data-active-design-decision'

export interface ActiveDesignDecisionPartData {
  toolCallId: string
  decision: 'agreed' | 'declined'
  designName: string
}

/**
 * 画布上下文切换回执（T65 决策 D3）：渲染为对话流分割线（—— 已切换到「XX」——），
 * 非 assistant 气泡。切换端点 200 后由 ChatPanel 注入；set_active_design 同意
 * 路径同形态（替换原本地系统行）。
 */
export const CONTEXT_SWITCH_PART_TYPE = 'data-context-switch'

export interface ContextSwitchPartData {
  name: string
}

/**
 * set_active_design 工具 part input 解析（共享契约 3：{proposed:{nodeId,...}}，
 * mutates:false 不落槽）。同意卡（显示）与 ChatPanel（端点调用）共用单源；
 * 防御性归一——形状不符 → null 字段（卡片显示回退 nodeId，端点调用转失败行）。
 */
export function parseSetActiveDesignProposed(input: unknown): {
  nodeId: string | null
  name: string | null
} {
  const empty = { nodeId: null, name: null }
  if (typeof input !== 'object' || input === null || !('proposed' in input)) return empty
  const proposed = input.proposed
  if (typeof proposed !== 'object' || proposed === null) return empty
  const nodeId = 'nodeId' in proposed ? proposed.nodeId : null
  const name = 'name' in proposed ? proposed.name : null
  return {
    nodeId: typeof nodeId === 'string' && nodeId !== '' ? nodeId : null,
    name: typeof name === 'string' && name !== '' ? name : null
  }
}

// ── 物化判据（共享契约 4——core 单源 re-export，判定逻辑不双写） ─────────────

/**
 * 设计区是否已物化：core active-design.ts isDesignMaterialized（根框子树内
 * IMAGE fill 或 hero-geometry 骨架标记）。false = 物化前（确认卡 Case A 话术）。
 */
export function isDesignRootMaterialized(store: EditorStore, rootId: string): boolean {
  return isDesignMaterializedCore(store.graph, rootId)
}

/** Case B 携带物候选：根框子树内已生成图片（IMAGE fill 节点，封顶 12 个） */
export function collectDesignImageRefs(
  store: EditorStore,
  rootId: string
): NewIntentReferenceCandidate[] {
  const graph = store.graph
  const refs: NewIntentReferenceCandidate[] = []
  walkSubtree(graph, [rootId], (node) => {
    if (refs.length >= 12) return true
    if (node.fills.some((fill) => fill.type === 'IMAGE')) {
      refs.push({ nodeId: node.id, label: node.name || node.id })
    }
    return undefined
  })
  return refs
}

// ── 切换端点（共享契约 2） ───────────────────────────────────────────────────

/** 端点返回的身份三元组（T60 供） */
export interface ActiveDesignSwitchResult {
  modeId: string
  profileId: string | null
  briefId: string | null
}

/** POST /api/pi/active-design {nodeId}；校验/网络失败 → null（调用方显式报错） */
export async function postActiveDesign(nodeId: string): Promise<ActiveDesignSwitchResult | null> {
  try {
    const res = await fetch('/api/pi/active-design', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ nodeId })
    })
    if (!res.ok) return null
    return (await res.json()) as ActiveDesignSwitchResult
  } catch {
    return null
  }
}

// ── 面板读画布通路 ───────────────────────────────────────────────────────────

/** 设计列表面板：扫描当前页营销设计区（core scanMarketingDesigns 复用） */
export function scanCurrentPageDesigns(store: EditorStore): MarketingDesignRef[] {
  return scanMarketingDesigns(makeFigmaFromStore(store))
}

export interface BriefListEntry {
  briefId: string
  name: string
  /** 读穿比较得出（不存储）：本 brief 绑定条目含 active 设计 */
  boundDesignIds: string[]
}

/** 需求单列表段：只扫当前页（T65 决策 D4 从全文档收回，与单槽同页口径一致；
 *  面板文案明示「当前页面」） */
export function scanCurrentPageBriefs(store: EditorStore): BriefListEntry[] {
  const graph = store.graph
  const page = graph.getNode(store.state.currentPageId)
  if (!page) return []
  const briefs: BriefListEntry[] = []
  walkSubtree(graph, page.childIds, (node) => {
    if (isBrief(node)) {
      briefs.push({
        briefId: node.id,
        name: node.name,
        boundDesignIds: briefBoundDesignIds(node)
      })
    }
    // brief 内部递归无害（结构内不会再嵌 brief；同 core scanMarketingDesigns 先例）
    return undefined
  })
  return briefs
}

/**
 * 新建需求单（T65 决策 D1）：core create_brief 原语经桥直调——只建 brief 节点
 * 落画布（不触发 setup_design；AI 后续语言认领）。放置走共享 findPlacementPosition
 * （页面内容右侧 +100，同 create_brief 工具）；返回新 briefId 供列表重扫 + 定位。
 */
export function createBriefOnPage(store: EditorStore, content: string): string {
  const figma = makeFigmaFromStore(store)
  const position = findPlacementPosition(figma, {
    width: BRIEF_WIDTH,
    height: BRIEF_ESTIMATED_HEIGHT
  })
  const brief = createBrief(figma, position.x, position.y)
  const text = content.trim()
  if (text) updateBriefContent(figma, brief.id, text)
  return brief.id
}

/** 详情编辑视图读模型（结构不完整 → null，面板显式提示） */
export function readBriefView(store: EditorStore, briefId: string): BriefView | null {
  return readBrief(makeFigmaFromStore(store), briefId)
}

/** 需求单内容写回（既有桥通路：core updateBriefContent 直改画布文本节点） */
export function saveBriefContent(store: EditorStore, briefId: string, text: string): boolean {
  return updateBriefContent(makeFigmaFromStore(store), briefId, text)
}

/** 素材条目标题写回 */
export function saveMaterialCaption(store: EditorStore, entryId: string, caption: string): boolean {
  return updateMaterialCaption(makeFigmaFromStore(store), entryId, caption)
}

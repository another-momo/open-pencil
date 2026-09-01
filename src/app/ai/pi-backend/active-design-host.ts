/**
 * T60（Phase 3 W3/T-B9）active_design 宿主路由与每回合组装——pi 后端进程侧。
 *
 * 职责（T60-plan §2 定谳）：
 *  - 单槽读穿：文档根 sharedPluginData `activeDesignNodeId` 经桥 eval 探针取回
 *    （桥只剩 'tool' 指令面，core `eval` 工具在 ALL_TOOLS 内天然可达——不新增
 *    桥指令、不碰桥代码；键面常量 import core active-design.ts 单源插值）。
 *    合法性四条件判定跑在后端（core 纯函数 checkActiveDesignCandidate /
 *    evaluateActiveDesignSlot，桥只取裸数据——宿主永不猜测，也不把判定串化进
 *    eval 片段）。
 *  - 四事件移槽：①setup_design 成功回调（tools.ts 缝）→ 写槽；②/③端点
 *    POST /api/pi/active-design（setActiveDesignViaBridge，校验四条件 → 移槽 →
 *    返回身份三元组）；④ask_user_question 工具调用记录 formId→当时槽位
 *    （会话内不落盘），[表单作答 formId=…] 信封到达且节点仍合法 → 移槽。
 *  - 删除悬空清槽：每回合读穿发现槽位节点不存在/不再是设计区根框 → 清槽 +
 *    context 注入一行系统提示。
 *  - 每回合组装：system = base + workflow(落盘 mode body) + profile 全文
 *    （顺序固定）；context = 身份封套 + 系统提示行（pi before_agent_start 的
 *    result.message custom 通道注入——convertToLlm 转 user role 进模型上下文，
 *    不进 UI 流、不进历史回填）。空槽 = general（无 workflow 段）+ 无 profile
 *    + 无封套；落盘 mode 的 workflow 缺失 → 一行提示 + 按 general 组装。
 *  - 新建意图一次性旗标：首行信封 `[新建意图确认 modeId=<id> profileId=<id>]`
 *    （字段可缺省）剥离 → 本回合 newIntentConfirmed() 返真 → run 结束
 *    finalizeTurn（runPrompt finally）强制复位。
 *
 * 桥失败语义：探针不可达（无 discovery / 桥 502 / 无活动文档）→ 本回合按空槽
 * 组装并 warn（冒烟环境无浏览器即此路径；工具调用届时会各自显式失败）；
 * 端点路径则显式 502 bridge_unavailable（红线 #8 不静默）。
 *
 * 仅运行于独立后端进程；只允许相对导入与 node/依赖包导入（同 service.ts 纪律）。
 */

import {
  ACTIVE_DESIGN_PROBE_KEYS,
  checkActiveDesignCandidate,
  evaluateActiveDesignSlot,
  type ActiveDesignRejectReason,
  type ActiveDesignSlotState,
  type BriefLinkSnapshot,
  type DesignRootSnapshot
} from '@open-pencil/core/tools/fork/marketing/active-design'
import { parseAskAnswer } from '@open-pencil/core/tools/fork/marketing/ask-user-question'
import { ACTIVE_DESIGN_TEXTS } from '@open-pencil/core/tools/fork/marketing/texts'
import { readDiscoveryFile } from '@open-pencil/mcp/discovery'

import { postBridgeRPC } from './bridge-rpc'
import type { StudioRegistry } from './studio/types'

// ── 新建意图信封（共享契约：首行 `[新建意图确认 modeId=<id> profileId=<id>]`，字段可缺省）──

const NEW_INTENT_MARKER =
  /^\[新建意图确认(?:\s+modeId=([^\]\s]+))?(?:\s+profileId=([^\]\s]+))?\]\r?$/

export interface NewIntentEnvelope {
  modeId?: string
  profileId?: string
}

/** 剥首行信封；仅首行精确命中才剥离（容错：非首行/畸形一律不动原文） */
export function stripNewIntentEnvelope(text: string): {
  envelope: NewIntentEnvelope | null
  stripped: string
} {
  const newline = text.indexOf('\n')
  const firstLine = newline === -1 ? text : text.slice(0, newline)
  const match = NEW_INTENT_MARKER.exec(firstLine)
  if (!match) return { envelope: null, stripped: text }
  const [, modeId, profileId] = match
  return {
    envelope: {
      // 可选捕获组运行时可为 undefined（索引签名类型不含），truthy 守卫兼排两种
      ...(modeId ? { modeId } : {}),
      ...(profileId ? { profileId } : {})
    },
    stripped: newline === -1 ? '' : text.slice(newline + 1)
  }
}

// ── 每回合组装（纯函数；base→workflow→profile 顺序固定，前缀缓存友好）─────────

export interface TurnAssembly {
  systemPrompt: string
  /** context 注入行（身份封套 + 系统提示）；空槽 → 空数组 */
  contextLines: string[]
}

/** 身份封套首行（三元组 + 节点 id；profileId 缺省字段省略，同信封风格） */
export function designTargetEnvelope(design: DesignRootSnapshot): string {
  const profile = design.profileId === '' ? '' : ` profileId=${design.profileId}`
  return `[当前设计目标 nodeId=${design.nodeId} modeId=${design.modeId}${profile} briefId=${design.briefId}]`
}

/**
 * 组装一回合的 system/context。规则（T60-plan 定谳 4）：
 *  - 空槽 = base only（general 无 workflow 文件）+ 无封套
 *  - 有槽：base + workflow(落盘 modeId 的文件 body，general 无段) + profile 全文
 *    （profileId 命中注册表时；未命中跳过——资产失败面经 manifest failures 暴露）
 *  - 落盘 mode 的 workflow 缺失 → 一行系统提示 + 按 general 组装（base only，
 *    不注 profile），身份封套保留（目标事实仍在）
 *  - brief 悬空（需求单被删）→ 一行系统提示（S1 §5 删除边界态）
 */
export function assembleTurn(
  registry: StudioRegistry,
  slot: ActiveDesignSlotState,
  extraNotices: string[] = []
): TurnAssembly {
  const base = registry.base?.body ?? ''
  if (slot.status !== 'ok') {
    return { systemPrompt: base, contextLines: [...extraNotices] }
  }
  const { design } = slot
  const contextLines = [designTargetEnvelope(design), ...extraNotices]
  if (slot.briefMissing) contextLines.push(ACTIVE_DESIGN_TEXTS.briefMissing)
  if (design.modeId === 'general') {
    const profile = profileBody(registry, design.profileId)
    return { systemPrompt: joinSegments([base, profile]), contextLines }
  }
  const workflow = registry.workflows.get(design.modeId)
  if (!workflow) {
    contextLines.push(ACTIVE_DESIGN_TEXTS.workflowMissing(design.modeId))
    return { systemPrompt: base, contextLines }
  }
  const segments = [base, workflow.body, profileBody(registry, design.profileId)]
  return { systemPrompt: joinSegments(segments), contextLines }
}

function profileBody(registry: StudioRegistry, profileId: string): string {
  if (profileId === '') return ''
  return registry.profiles.get(profileId)?.body ?? ''
}

function joinSegments(segments: string[]): string {
  return segments.filter((segment) => segment !== '').join('\n\n')
}

// ── 桥探针 / 写槽（经 core `eval` 工具，键面常量单源插值）──────────────────────

export interface SlotProbeData {
  slotNodeId: string
  currentPageId: string
  design: DesignRootSnapshot | null
  brief: BriefLinkSnapshot | null
  materialized: boolean
}

export interface CandidateProbeData {
  currentPageId: string
  design: DesignRootSnapshot | null
  brief: BriefLinkSnapshot | null
  materialized: boolean
}

export interface ActiveDesignBridgeIO {
  /** 桥不可达 → null（调用方按空槽降级 + warn） */
  probeSlot(documentId?: string): Promise<SlotProbeData | null>
  probeCandidate(nodeId: string, documentId?: string): Promise<CandidateProbeData | null>
  /** nodeId '' = 清槽；桥不可达/执行失败 → false */
  writeSlot(nodeId: string, documentId?: string): Promise<boolean>
}

const K = ACTIVE_DESIGN_PROBE_KEYS

/** 探针 eval 片段：只取裸数据（快照 + 页归属 + 物化判据原料），判定在后端 */
function buildProbeSource(candidateNodeId?: string): string {
  return `const NS = ${JSON.stringify(K.namespace)};
const CANDIDATE = ${JSON.stringify(candidateNodeId ?? '')};
const pageOf = (n) => { let cur = n; while (cur) { if (cur.type === 'CANVAS') return cur.id; cur = cur.parent; } return null; };
const snap = (id) => {
  const n = figma.getNodeById(id);
  if (!n) return null;
  return { nodeId: n.id, name: n.name, type: n.type, pageId: pageOf(n),
    marketingRoot: n.getSharedPluginData(NS, ${JSON.stringify(K.roleKey)}) === ${JSON.stringify(K.roleRoot)},
    modeId: n.getSharedPluginData(NS, ${JSON.stringify(K.modeKey)}),
    profileId: n.getSharedPluginData(NS, ${JSON.stringify(K.profileKey)}),
    briefId: n.getSharedPluginData(NS, ${JSON.stringify(K.briefKey)}) };
};
const briefSnap = (briefId) => {
  if (!briefId) return null;
  const b = figma.getNodeById(briefId);
  if (!b || b.getSharedPluginData(NS, ${JSON.stringify(K.roleKey)}) !== ${JSON.stringify(K.roleBrief)}) return null;
  const raw = b.getSharedPluginData(NS, ${JSON.stringify(K.bindingKey)});
  return { briefId: b.id, pageId: pageOf(b), boundDesignIds: raw ? raw.split(',').filter(Boolean) : [] };
};
const hasMaterial = (rootId) => {
  const root = figma.getNodeById(rootId);
  if (!root) return false;
  const stack = [root];
  while (stack.length > 0) {
    const n = stack.pop();
    if ((n.fills || []).some((f) => f.type === 'IMAGE')) return true;
    if (n.getSharedPluginData(NS, ${JSON.stringify(K.heroGeometryKey)})) return true;
    stack.push(...(n.children || []));
  }
  return false;
};
const currentPageId = figma.currentPage.id;
const slotNodeId = figma.root.getSharedPluginData(NS, ${JSON.stringify(K.slotKey)});
const targetId = CANDIDATE || slotNodeId;
const design = targetId ? snap(targetId) : null;
const brief = design ? briefSnap(design.briefId) : null;
return { slotNodeId, currentPageId, design, brief, materialized: design ? hasMaterial(design.nodeId) : false };`
}

function buildWriteSlotSource(nodeId: string): string {
  return `figma.root.setSharedPluginData(${JSON.stringify(K.namespace)}, ${JSON.stringify(K.slotKey)}, ${JSON.stringify(nodeId)});
return { ok: true };`
}

async function callBridgeEval(code: string, documentId?: string): Promise<unknown> {
  const discovery = await readDiscoveryFile()
  if (!discovery) throw new Error('bridge discovery missing')
  const args = documentId ? { code, document_id: documentId } : { code }
  const res = await postBridgeRPC(discovery, 'tool', { name: 'eval', args })
  const body = (await res.json().catch(() => null)) as { ok?: boolean; result?: unknown } | null
  if (!res.ok || body?.ok !== true) throw new Error(`bridge eval failed: HTTP ${res.status}`)
  return body.result ?? null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function parseDesignSnapshot(raw: unknown): DesignRootSnapshot | null {
  if (!isRecord(raw)) return null
  if (typeof raw.nodeId !== 'string' || typeof raw.type !== 'string') return null
  return {
    nodeId: raw.nodeId,
    name: asString(raw.name),
    type: raw.type,
    pageId: typeof raw.pageId === 'string' ? raw.pageId : null,
    marketingRoot: raw.marketingRoot === true,
    modeId: asString(raw.modeId),
    profileId: asString(raw.profileId),
    briefId: asString(raw.briefId)
  }
}

function parseBriefSnapshot(raw: unknown): BriefLinkSnapshot | null {
  if (!isRecord(raw) || typeof raw.briefId !== 'string') return null
  return {
    briefId: raw.briefId,
    pageId: typeof raw.pageId === 'string' ? raw.pageId : null,
    boundDesignIds: Array.isArray(raw.boundDesignIds)
      ? raw.boundDesignIds.filter((id): id is string => typeof id === 'string')
      : []
  }
}

/** 生产桥实现：eval 探针/写槽；一切桥故障 → null/false（调用方定降级语义） */
export function createBridgeSlotIO(): ActiveDesignBridgeIO {
  async function probe(nodeId?: string, documentId?: string): Promise<SlotProbeData | null> {
    let raw: unknown
    try {
      raw = await callBridgeEval(buildProbeSource(nodeId), documentId)
    } catch {
      return null
    }
    if (!isRecord(raw)) return null
    return {
      slotNodeId: asString(raw.slotNodeId),
      currentPageId: asString(raw.currentPageId),
      design: parseDesignSnapshot(raw.design),
      brief: parseBriefSnapshot(raw.brief),
      materialized: raw.materialized === true
    }
  }
  return {
    probeSlot: (documentId) => probe(undefined, documentId),
    probeCandidate: async (nodeId, documentId) => {
      const data = await probe(nodeId, documentId)
      if (!data) return null
      return {
        currentPageId: data.currentPageId,
        design: data.design,
        brief: data.brief,
        materialized: data.materialized
      }
    },
    writeSlot: async (nodeId, documentId) => {
      try {
        await callBridgeEval(buildWriteSlotSource(nodeId), documentId)
        return true
      } catch {
        return false
      }
    }
  }
}

// ── 宿主会话态（每 session 一份；formId 映射会话内不落盘）─────────────────────

/** 表单作答移槽的节点合法性（④）：存在 + 仍是设计区根框 + 同页（brief 可能已删，不作驳回依据） */
export function isFormTargetStillValid(probe: CandidateProbeData): boolean {
  const { design } = probe
  if (design === null) return false
  return design.marketingRoot && design.pageId !== null && design.pageId === probe.currentPageId
}

export interface ActiveDesignHostDeps {
  registry(): StudioRegistry
  bridge: ActiveDesignBridgeIO
}

export interface ActiveDesignHost {
  /** setup_design 注入缝真源：本回合新建意图旗标（run 结束 finalizeTurn 复位） */
  newIntentConfirmed(): boolean
  /** 工具结果观察：ask_user_question awaiting 信封 → 记录 formId→当时槽位 */
  observeToolExecution(toolName: string, isError: boolean, details: unknown): void
  /** 事件①：setup_design 成功（结果含新 root id）→ 移槽（失败只 warn，设计已建不回吐） */
  onDesignCreated(rootId: string, documentId?: string): Promise<void>
  /** 回合入口：剥信封 → 置旗标 → ④移槽 → 槽位读穿/清悬空 → 组装 */
  prepareTurn(text: string, documentId?: string): Promise<{ promptText: string }>
  /** before_agent_start 钩子读取的当回合组装结果（prepareTurn 后恒非空） */
  turnAssembly(): TurnAssembly | null
  /** run 结束 finally：旗标复位 + 回合态清零（信封永不跨回合滞留） */
  finalizeTurn(): void
}

export function createActiveDesignHost(deps: ActiveDesignHostDeps): ActiveDesignHost {
  let intentConfirmed = false
  let turn: TurnAssembly | null = null
  let currentSlotNodeId = ''
  const formDesignByFormId = new Map<string, string>()

  async function moveSlot(nodeId: string, documentId?: string): Promise<void> {
    const ok = await deps.bridge.writeSlot(nodeId, documentId)
    if (ok) {
      currentSlotNodeId = nodeId
    } else {
      console.warn('[pi-backend] active_design 移槽写桥失败（忽略，下回合探针读穿为准）')
    }
  }

  async function resolveFormAnswer(text: string, documentId?: string): Promise<void> {
    const answer = parseAskAnswer(text)
    // 仅 [表单作答] 移槽（共享契约字面）；[表单跳过] 不构成目标授权
    if (!answer || answer.aborted) return
    const mapped = formDesignByFormId.get(answer.formId)
    if (!mapped) return // 刷新丢映射 → 事件④静默不发生（已知边界，T60-plan 定谳 2）
    const probe = await deps.bridge.probeCandidate(mapped, documentId)
    if (probe && isFormTargetStillValid(probe)) await moveSlot(mapped, documentId)
  }

  async function probeSlotState(documentId?: string): Promise<{
    slot: ActiveDesignSlotState
    notices: string[]
  }> {
    const probe = await deps.bridge.probeSlot(documentId)
    if (!probe) {
      console.warn(
        '[pi-backend] active_design 桥探针不可用——本回合按空槽组装（桥不可达或无活动文档）'
      )
      return { slot: { status: 'empty' }, notices: [] }
    }
    const slot = evaluateActiveDesignSlot(probe.slotNodeId, probe.design, probe.brief)
    if (slot.status !== 'dangling') return { slot, notices: [] }
    // 定谳 3：槽位节点删除/失格 → 清槽 + 一行系统提示
    await moveSlot('', documentId)
    return { slot: { status: 'empty' }, notices: [ACTIVE_DESIGN_TEXTS.slotCleared] }
  }

  return {
    newIntentConfirmed: () => intentConfirmed,
    observeToolExecution(toolName, isError, details) {
      if (toolName !== 'ask_user_question' || isError || !isRecord(details)) return
      if (details.status !== 'awaiting_user' || typeof details.formId !== 'string') return
      formDesignByFormId.set(details.formId, currentSlotNodeId)
    },
    async onDesignCreated(rootId, documentId) {
      await moveSlot(rootId, documentId)
    },
    async prepareTurn(text, documentId) {
      // 回合开始强制清零（防御：finalizeTurn 遗漏也不跨回合滞留）
      intentConfirmed = false
      const { envelope, stripped } = stripNewIntentEnvelope(text)
      if (envelope) intentConfirmed = true
      await resolveFormAnswer(text, documentId)
      const { slot, notices } = await probeSlotState(documentId)
      currentSlotNodeId = slot.status === 'ok' ? slot.design.nodeId : ''
      turn = assembleTurn(deps.registry(), slot, notices)
      return { promptText: stripped }
    },
    turnAssembly: () => turn,
    finalizeTurn() {
      intentConfirmed = false
      turn = null
    }
  }
}

// ── 端点（②面板点选 / ③AI 声明+同意 共用）─────────────────────────────────────

export type SetActiveDesignResult =
  | {
      ok: true
      modeId: string
      profileId: string
      briefId: string
      name: string
      /** 物化判据结果（Case A/B 分叉数据，T61 消费；判据见 core active-design.ts 头注） */
      materialized: boolean
    }
  | { ok: false; error: ActiveDesignRejectReason | 'bridge_unavailable'; message: string }

/**
 * POST /api/pi/active-design 的处理本体：四条件校验 → 移槽 → 身份三元组。
 * documentId 缺省 = 桥当前活动 tab（同工具 document_id 缺省语义）。
 */
export async function setActiveDesignViaBridge(
  nodeId: string,
  documentId?: string,
  bridge: ActiveDesignBridgeIO = createBridgeSlotIO()
): Promise<SetActiveDesignResult> {
  const probe = await bridge.probeCandidate(nodeId, documentId)
  if (!probe) {
    return {
      ok: false,
      error: 'bridge_unavailable',
      message: '画布桥不可达——确认 dev server 已启动且浏览器已打开 app，然后重试。'
    }
  }
  const check = checkActiveDesignCandidate(nodeId, probe.design, probe.brief, probe.currentPageId)
  if (!check.ok) return { ok: false, error: check.reason, message: check.message }
  const moved = await bridge.writeSlot(nodeId, documentId)
  if (!moved) {
    return {
      ok: false,
      error: 'bridge_unavailable',
      message: '画布桥写槽失败——确认 dev server 已启动且浏览器已打开 app，然后重试。'
    }
  }
  return {
    ok: true,
    modeId: check.design.modeId,
    profileId: check.design.profileId,
    briefId: check.design.briefId,
    name: check.design.name,
    materialized: probe.materialized
  }
}

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
 *    T85 起尾段追加「按需参考」索引节（active 资产 references 并集非空时），
 *    并集即本回合 read_reference 允许集（read-reference.ts）。
 *  - 新建意图一次性旗标：首行信封 `[新建意图确认 modeId=<id> profileId=<id>
 *    canvas=<值>]`（字段可缺省，顺序固定；canvas 自 T65 起）剥离 → 本回合
 *    newIntentConfirmed() 返真 → run 结束 finalizeTurn（runPrompt finally）
 *    强制复位。T65 集成缺口修复：剥离时把确认参数组装成一行系统提示注入
 *    本回合 context（「用户已为本次新建确认参数：…（选择即锁定，不得覆盖）」，
 *    缺省字段省略；裸信封无参数不注入）——确认参数此前对 AI 不可见。
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
import type { NewIntentState } from '@open-pencil/core/tools/fork/marketing/brief'
import { ACTIVE_DESIGN_TEXTS } from '@open-pencil/core/tools/fork/marketing/texts'

import { readDiscoveryFile } from '@/app/automation/bridge/server/discovery'

import { postBridgeRPC } from './bridge-rpc'
import { referenceBucketKey } from './studio/types'
import type { StudioBase, StudioProfile, StudioRegistry, StudioWorkflow } from './studio/types'

// ── 新建意图信封（共享契约：首行 `[新建意图确认 modeId=<id> profileId=<id> canvas=<值>]`，
//    字段可缺省、顺序固定；canvas = 尺寸覆盖值，T65 §2.4）──────────────────────────

const NEW_INTENT_MARKER =
  /^\[新建意图确认(?:\s+modeId=([^\]\s]+))?(?:\s+profileId=([^\]\s]+))?(?:\s+canvas=([^\]\s]+))?\]\r?$/

export interface NewIntentEnvelope {
  modeId?: string
  profileId?: string
  /** 尺寸覆盖值（canvas 串原样透传；格式校验在 core setup_design，非法 → invalid_canvas） */
  canvas?: string
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
  const [, modeId, profileId, canvas] = match
  return {
    envelope: {
      // 可选捕获组运行时可为 undefined（索引签名类型不含），truthy 守卫兼排两种
      ...(modeId ? { modeId } : {}),
      ...(profileId ? { profileId } : {}),
      ...(canvas ? { canvas } : {})
    },
    stripped: newline === -1 ? '' : text.slice(newline + 1)
  }
}

// ── 每回合组装（纯函数；base→workflow→profile 顺序固定，前缀缓存友好）─────────

export interface TurnAssembly {
  systemPrompt: string
  /** context 注入行（身份封套 + 系统提示）；空槽 → 空数组 */
  contextLines: string[]
  /**
   * T85 定谳 4：本回合 read_reference 允许集（声明 path → 加载期解析绝对路径；
   * 空 = 本回合不可读任何 reference）。宿主持有于 turn 缓存袋，finalizeTurn
   * 随 turn=null 一并复位（同 intentConfirmed 一次性态纪律）。
   */
  allowedReferences: ReadonlyMap<string, string>
}

/** 索引节标题（T85 定谳 3 字面口径） */
const REFERENCES_INDEX_HEADING = '## 按需参考（read_reference 工具按需读取）'

/** 本回合 active 资产的 references 并集：base 恒在 + 命中的 workflow + 命中的 profile */
function collectActiveReferences(
  registry: StudioRegistry,
  assets: Array<StudioBase | StudioWorkflow | StudioProfile>
): { indexSection: string; allowed: Map<string, string> } {
  const lines: string[] = []
  const allowed = new Map<string, string>()
  for (const asset of assets) {
    if (!asset.references || asset.references.length === 0) continue
    const source = asset.kind === 'base' ? 'base' : `${asset.kind}: ${asset.id}`
    const bucket = registry.resolvedReferences.get(referenceBucketKey(asset.kind, asset.id))
    for (const ref of asset.references) {
      lines.push(`- ${ref.path} —— ${ref.description}（${source}）`)
      const abs = bucket?.get(ref.path)
      // 同 path 多资产声明冲突：先声明先赢（索引首条与允许集指向一致）
      if (abs && !allowed.has(ref.path)) allowed.set(ref.path, abs)
    }
  }
  return {
    indexSection: lines.length === 0 ? '' : `${REFERENCES_INDEX_HEADING}\n${lines.join('\n')}`,
    allowed
  }
}

/** 组装收尾：references 索引节追加进 systemPrompt 尾段（并集非空时）+ 允许集入 TurnAssembly */
function finishTurn(
  registry: StudioRegistry,
  segments: string[],
  contextLines: string[],
  activeAssets: Array<StudioBase | StudioWorkflow | StudioProfile>
): TurnAssembly {
  const { indexSection, allowed } = collectActiveReferences(registry, activeAssets)
  return {
    systemPrompt: joinSegments([...segments, indexSection]),
    contextLines,
    allowedReferences: allowed
  }
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
 *  - T85 定谳 3：本回合 active 资产（base 恒在 + 命中 workflow + 命中 profile）的
 *    references 并集非空时，systemPrompt 尾段追加「按需参考」索引节；并集即本回合
 *    read_reference 允许集（allowedReferences，finalizeTurn 复位）。空槽 = base only
 *    ——base 有 references 才出现该节（mode 作用域隔离，不污染其他 mode 上下文）
 */
export function assembleTurn(
  registry: StudioRegistry,
  slot: ActiveDesignSlotState,
  extraNotices: string[] = []
): TurnAssembly {
  const base = registry.base?.body ?? ''
  const baseAsset = registry.base ? [registry.base] : []
  if (slot.status !== 'ok') {
    return finishTurn(registry, [base], [...extraNotices], baseAsset)
  }
  const { design } = slot
  const contextLines = [designTargetEnvelope(design), ...extraNotices]
  if (slot.briefMissing) contextLines.push(ACTIVE_DESIGN_TEXTS.briefMissing)
  const profile = design.profileId === '' ? undefined : registry.profiles.get(design.profileId)
  if (design.modeId === 'general') {
    return finishTurn(registry, [base, profile?.body ?? ''], contextLines, [
      ...baseAsset,
      ...(profile ? [profile] : [])
    ])
  }
  const workflow = registry.workflows.get(design.modeId)
  if (!workflow) {
    contextLines.push(ACTIVE_DESIGN_TEXTS.workflowMissing(design.modeId))
    return finishTurn(registry, [base], contextLines, baseAsset)
  }
  return finishTurn(registry, [base, workflow.body, profile?.body ?? ''], contextLines, [
    ...baseAsset,
    workflow,
    ...(profile ? [profile] : [])
  ])
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
  /**
   * T91b：读 document root sharedPluginData 上的 newIntent 三键（modeId /
   * profileId / confirmed）。桥不可达 → null（调用方按未确认降级）。
   * 信源真源在浏览器端，宿主必须经桥 eval 探针拿——不通过 FigmaAPI 句柄。
   */
  probeNewIntent(documentId?: string): Promise<NewIntentState | null>
  /**
   * T91b：setup_design 成功后清 document root pluginData 三键（避免下次
   * 装配误用旧 modeId）。桥不可达/执行失败 → false（不影响主流程——设计已落图）。
   */
  clearNewIntent(documentId?: string): Promise<boolean>
}

/** T91b：pluginData 三键快照形状复用 brief.ts NewIntentState（避免双写） */

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

/** T91b：探针 / 清键 桥 eval 片段共享的命名常量前缀 */
const NEW_INTENT_EVAL_PROLOGUE = (): string => {
  const NS = JSON.stringify(K.namespace)
  const M = JSON.stringify(K.newIntentModeIdKey)
  const P = JSON.stringify(K.newIntentProfileIdKey)
  const C = JSON.stringify(K.newIntentConfirmedKey)
  return `const NS = ${NS};
const M = ${M};
const P = ${P};
const C = ${C};`
}

/** T91b：探针读 document root sharedPluginData 三键（modeId / profileId / confirmed） */
function buildProbeNewIntentSource(): string {
  return `${NEW_INTENT_EVAL_PROLOGUE()}
return { modeId: figma.root.getSharedPluginData(NS, M),
  profileId: figma.root.getSharedPluginData(NS, P),
  confirmed: figma.root.getSharedPluginData(NS, C) === 'true' };`
}

/** T91b：清 document root 上 newIntent 三键（空串置位 = 读侧视为缺省） */
function buildClearNewIntentSource(): string {
  return `${NEW_INTENT_EVAL_PROLOGUE()}
figma.root.setSharedPluginData(NS, M, '');
figma.root.setSharedPluginData(NS, P, '');
figma.root.setSharedPluginData(NS, C, '');
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
    briefId: asString(raw.briefId),
    uniqueId: asString(raw.uniqueId)
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
    },
    probeNewIntent: async (documentId) => {
      try {
        const raw = await callBridgeEval(buildProbeNewIntentSource(), documentId)
        if (!isRecord(raw)) return null
        return {
          modeId: asString(raw.modeId),
          profileId: asString(raw.profileId),
          confirmed: raw.confirmed === true
        }
      } catch {
        return null
      }
    },
    clearNewIntent: async (documentId) => {
      try {
        await callBridgeEval(buildClearNewIntentSource(), documentId)
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
  /** 回合入口：剥信封 → 置旗标 + 确认参数系统提示行（T65）→ ④移槽 → 槽位读穿/清悬空 → 组装 */
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

  /** T91b：探针读 pluginData，组装 intentConfirmed 旗标（OR 信封兼容路径） */
  async function probeIntentFlag(documentId?: string): Promise<boolean> {
    const snap = await deps.bridge.probeNewIntent(documentId)
    return snap?.confirmed === true
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
      // T91b：设计落图后清 document root pluginData 三键——避免下次装配读到
      // 旧 modeId 误用。失败仅 warn（设计已建不需回吐；下回合探针自然读空）
      await deps.bridge.clearNewIntent(documentId)
    },
    async prepareTurn(text, documentId) {
      // 回合开始强制清零（防御：finalizeTurn 遗漏也不跨回合滞留）
      intentConfirmed = false
      const { envelope, stripped } = stripNewIntentEnvelope(text)
      const intentNotices: string[] = []
      if (envelope) {
        intentConfirmed = true
        // T65 集成缺口修复：确认参数随本回合 context 对 AI 可见（选择即锁定）；
        // 裸信封（无任何参数）不注入——无可锁定字段
        const confirmedLine = ACTIVE_DESIGN_TEXTS.newIntentConfirmed(envelope)
        if (confirmedLine !== '') intentNotices.push(confirmedLine)
      }
      // T91b：pluginData 探针确认（二级信源；前端 ChatNewIntentCard 确认后写入）。
      // OR 信封兼容路径——任一为真即放行。探针不可达按未确认降级（warn）。
      if (!intentConfirmed && (await probeIntentFlag(documentId))) {
        intentConfirmed = true
      }
      await resolveFormAnswer(text, documentId)
      const { slot, notices } = await probeSlotState(documentId)
      currentSlotNodeId = slot.status === 'ok' ? slot.design.nodeId : ''
      turn = assembleTurn(deps.registry(), slot, [...intentNotices, ...notices])
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

// ── 端点：newIntent 确认（T91b）──────────────────────────────────────────────

export type ConfirmNewIntentResult =
  | { ok: true; modeId: string; profileId: string }
  | { ok: false; error: 'bridge_unavailable' | 'invalid_args'; message: string }

/** T91b：写 document root sharedPluginData 三键（modeId / profileId / confirmed=true）。 */
function buildWriteNewIntentSource(modeId: string, profileId: string): string {
  return `const NS = ${JSON.stringify(K.namespace)};
const M = ${JSON.stringify(K.newIntentModeIdKey)};
const P = ${JSON.stringify(K.newIntentProfileIdKey)};
const C = ${JSON.stringify(K.newIntentConfirmedKey)};
figma.root.setSharedPluginData(NS, M, ${JSON.stringify(modeId)});
figma.root.setSharedPluginData(NS, P, ${JSON.stringify(profileId)});
figma.root.setSharedPluginData(NS, C, 'true');
return { ok: true };`
}

/**
 * POST /api/pi/intent-confirm 的处理本体：写 pluginData 三键（modeId /
 * profileId / confirmed=true）。前端 ChatNewIntentCard 确认按钮触发。
 * documentId 缺省 = 桥当前活动 tab（同工具 document_id 缺省语义）。
 */
export async function confirmNewIntentViaBridge(
  args: { modeId: string; profileId?: string },
  documentId?: string
): Promise<ConfirmNewIntentResult> {
  if (!args.modeId) {
    return { ok: false, error: 'invalid_args', message: 'modeId 不能为空' }
  }
  const profileId = args.profileId ?? ''
  try {
    const discovery = await readDiscoveryFile()
    if (!discovery) throw new Error('bridge discovery missing')
    const code = buildWriteNewIntentSource(args.modeId, profileId)
    const res = await postBridgeRPC(discovery, 'tool', {
      name: 'eval',
      args: documentId ? { code, document_id: documentId } : { code }
    })
    const body = (await res.json().catch(() => null)) as { ok?: boolean } | null
    if (!res.ok || body?.ok !== true) throw new Error(`bridge eval failed: HTTP ${res.status}`)
    return { ok: true, modeId: args.modeId, profileId }
  } catch {
    return {
      ok: false,
      error: 'bridge_unavailable',
      message: '画布桥不可达——确认 dev server 已启动且浏览器已打开 app，然后重试。'
    }
  }
}

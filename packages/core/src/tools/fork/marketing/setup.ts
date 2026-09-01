/**
 * setup_design core（T53，S3 §2 窄化：仅「新建」时调用）。
 *
 * 移植自 open-pencil 仓 feature/agent-backend @ 5d38aa4e
 * tools/marketing/setup.ts，差异（S3 §2 L47 删除不移植）：
 * - 领养发现逻辑（resolveExistingDesign / findRootFrame / ADOPTED 教学 note）
 *   与 registry.ts 进程态（WeakMap+clock）整体删除——窄化后重复调用 = 恒新建。
 * - activeMaterialTypes 进程内推送废弃 → catalog 快照注入（宿主随调用外层
 *   附加，不进工具 schema、不进模型视野；T22 documentId 注入同缝）。
 * - 标记面走通用 get/setSharedPluginData（namespace 'open-pencil-marketing'，
 *   键面复用 brief.ts 单源常量），逐键写、每键写前重读防 stale 快照。
 * - 放置走共享 findPlacementPosition（页面 bounds 右侧 +100、y 跟随），
 *   创建后 scrollAndZoomIntoView。
 *
 * 四职责（S3 §2）：① 以解析尺寸建根 frame（T65 优先序：显式 canvas 参数 >
 * mode 首选预设 > 750 宽 + HUG 高缺省）；② 设尺寸与最小空闲「label N」名；
 * ③ 设计身份三元组 + schemaVersion 落盘；④ brief 关联设计区登记
 * （registerBriefDesignEntry）。
 *
 * T62：type 机制整体删除（owner 2026-09-01 v8 拍板过度设计）——设计身份 =
 * 三元组 {modeId, profileId, briefId}，读穿侧容忍旧画布残留键（天然忽略，
 * schemaVersion 不 bump）。
 *
 * T65（owner 2026-09-01 拍板 C）：尺寸语义落地——workflow frontmatter
 * `sizes: [{label, canvas}]` 预设清单经 catalog 投影透传（sizes[0] = 首选
 * 预设），可选 `canvas` 参数覆盖（预设值或自由值 `宽x`/`宽x高`，非法 →
 * invalid_canvas）；缺省恒为 750 宽 + HUG。落盘 size 语义不变
 * （{width, height|null}，null = HUG）。
 */

import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'
import type { Vector } from '@open-pencil/scene-graph/primitives'

import type { FigmaAPI } from '#core/figma-api'
import { getSharedPluginData, setSharedPluginData } from '#core/figma-api/plugin-data'
import { findPlacementPosition } from '#core/tools/fork/placement'

import {
  BRIEF_PLUGIN_NAMESPACE,
  BRIEF_ROLE_KEY,
  BRIEF_SCHEMA_VERSION,
  BRIEF_SCHEMA_VERSION_KEY,
  DESIGN_BRIEF_KEY,
  DESIGN_MODE_KEY,
  DESIGN_PROFILE_KEY,
  bindBriefToDesign,
  findBrief,
  registerBriefDesignEntry,
  setBriefBindingLabel,
  type BriefCandidate
} from './brief'
import { BRIEF_TEXTS, SETUP_TEXTS } from './texts'

/** 设计根 role 标记值（单源；image-gen/history.ts 的同名本地常量集成时改 import） */
export const MARKETING_ROLE_ROOT = 'marketing-root'

/** 内置 general mode：恒过校验（catalog 缺省时唯一可用路径） */
const SETUP_GENERAL_MODE_ID = 'general'
/** 缺省尺寸：750 宽 + HUG 高（长图默认，T62 定谳 1——所有 mode 同口径） */
const SETUP_GENERAL_DEFAULT_WIDTH = 750
/** HUG 高根 frame 的初始高度（随内容生长前的占位） */
const SETUP_HUG_INITIAL_HEIGHT = 400

// ── 尺寸契约（T65 §2）：预设清单 + canvas 串解析（前后端校验共用单源）────────────

/**
 * 尺寸预设：label 中文名 + canvas 串（`宽x` = 高 HUG 随内容生长 / `宽x高` = 定高）。
 * studio frontmatter `sizes` 清单、catalog 投影、确认卡尺寸行共用本形状
 * （type-shapes 门禁禁同构双写——消费侧一律 import type 或别名）。
 */
export interface CanvasSizePreset {
  label: string
  canvas: string
}

/** canvas 串格式（T65 §2.1/§2.2）：`宽x`（HUG 高）或 `宽x高`（定高） */
const CANVAS_SIZE_RE = /^(\d+)x(\d+)?$/

/** canvas 串 → 落盘尺寸语义（height null = HUG）；格式非法 → null */
export function parseCanvasSize(canvas: string): { width: number; height: number | null } | null {
  const match = CANVAS_SIZE_RE.exec(canvas)
  if (!match) return null
  const [, width, height] = match
  // 可选捕获组运行时可为 undefined（索引签名类型不含），truthy 守卫兼排两种
  return { width: Number(width), height: height ? Number(height) : null }
}

// ── catalog 注入契约（宿主快照，不进模型视野）────────────────────────────────

export interface SetupCatalogMode {
  id: string
  label: string
  /** mode 尺寸预设清单（T65：workflow frontmatter sizes 透传；首条 = 首选预设；缺席 → 缺省 750 宽 HUG） */
  sizes?: CanvasSizePreset[]
}

/** 宿主注入的注册表快照；缺省（MCP/headless 无注入）时仅 general 可用 */
export interface SetupCatalog {
  modes: SetupCatalogMode[]
  profileIds: string[]
}

export interface SetupDesignArgs {
  modeId: string
  profileId?: string
  briefId: string
  /** 尺寸覆盖（T65）：预设 canvas 值或自由值 `宽x`/`宽x高`；格式非法 → invalid_canvas */
  canvas?: string
  /** 宿主随 args 外层注入的新建意图确认（缺省 false；!== true → 不建框） */
  confirmedNewIntent?: boolean
}

// ── 信封 ───────────────────────────────────────────────────────────────────

export type SetupDesignErrorCode =
  | 'brief_not_found'
  | 'ambiguous_brief'
  | 'unknown_mode'
  | 'unknown_profile'
  | 'invalid_canvas'
  | 'unconfirmed_new_intent'
  | 'catalog_unavailable'

export interface SetupDesignError {
  error: SetupDesignErrorCode
  /** 用户语言化说明（zh-cn，SETUP_TEXTS 外置） */
  message: string
  modeId?: string
  profileId?: string
  briefId?: string
  candidates?: BriefCandidate[]
}

export interface SetupDesignSuccess {
  rootId: string
  name: string
  /** 尺寸快照语义：height null = HUG（长图随内容生长，初始高占位 400） */
  size: { width: number; height: number | null }
  modeId: string
  profileId?: string
  briefId: string
  placement: Vector
}

export type SetupDesignResult = SetupDesignSuccess | SetupDesignError

// ── 标记读写（逐键写、写前重读，同 setBriefMarker 先例）───────────────────────

function setDesignMarker(graph: SceneGraph, nodeId: string, key: string, value: string): void {
  const node = graph.getNode(nodeId)
  if (!node) return
  setSharedPluginData(graph, node, BRIEF_PLUGIN_NAMESPACE, key, value)
}

function designMarker(node: SceneNode, key: string): string {
  return getSharedPluginData(node, BRIEF_PLUGIN_NAMESPACE, key)
}

export function isMarketingDesignRoot(node: SceneNode | undefined): node is SceneNode {
  if (node?.type !== 'FRAME') return false
  return designMarker(node, BRIEF_ROLE_KEY) === MARKETING_ROLE_ROOT
}

// ── 校验（T62：mode → profile 两级；type 层级已整体删除）─────────────────────

function validateProfileId(
  profileId: string | undefined,
  catalog: SetupCatalog | undefined
): SetupDesignError | null {
  if (profileId === undefined) return null
  if (!catalog) {
    return { error: 'catalog_unavailable', message: SETUP_TEXTS.catalogUnavailable, profileId }
  }
  if (!catalog.profileIds.includes(profileId)) {
    return { error: 'unknown_profile', message: SETUP_TEXTS.unknownProfile(profileId), profileId }
  }
  return null
}

interface ResolvedMode {
  /** 命名基底（mode label；general 用默认名） */
  label: string
  size: { width: number; height: number | null }
}

/**
 * 尺寸解析优先序（T65 §2.2）：显式 canvas 参数（非法 → invalid_canvas）>
 * mode 首选预设（catalog sizes[0]；宿主注入数据绕过加载期校验时容忍落缺省）>
 * 750 宽 + HUG 缺省。
 */
function resolveSize(
  args: SetupDesignArgs,
  mode?: SetupCatalogMode
): { width: number; height: number | null } | SetupDesignError {
  if (args.canvas !== undefined) {
    const parsed = parseCanvasSize(args.canvas)
    if (!parsed) {
      return { error: 'invalid_canvas', message: SETUP_TEXTS.invalidCanvas(args.canvas) }
    }
    return parsed
  }
  const preset = mode?.sizes?.[0]
  if (preset) {
    const parsed = parseCanvasSize(preset.canvas)
    if (parsed) return parsed
  }
  return { width: SETUP_GENERAL_DEFAULT_WIDTH, height: null }
}

/** mode 校验 + 命名基底与尺寸解析（T65：尺寸三段优先序，见 resolveSize） */
function resolveMode(
  args: SetupDesignArgs,
  catalog: SetupCatalog | undefined
): ResolvedMode | SetupDesignError {
  const { modeId } = args

  // general 恒过校验（无文件内置特例：无预设清单，不查 catalog）
  if (modeId === SETUP_GENERAL_MODE_ID) {
    const profileError = validateProfileId(args.profileId, catalog)
    if (profileError) return profileError
    const size = resolveSize(args)
    if ('error' in size) return size
    return { label: SETUP_TEXTS.generalDesignName, size }
  }

  if (!catalog) {
    return { error: 'catalog_unavailable', message: SETUP_TEXTS.catalogUnavailable, modeId }
  }
  const mode = catalog.modes.find((entry) => entry.id === modeId)
  if (!mode) {
    return { error: 'unknown_mode', message: SETUP_TEXTS.unknownMode(modeId), modeId }
  }
  const profileError = validateProfileId(args.profileId, catalog)
  if (profileError) return profileError
  const size = resolveSize(args, mode)
  if ('error' in size) return size
  return { label: mode.label, size }
}

// ── 建框 ───────────────────────────────────────────────────────────────────

/**
 * 新根 frame 显示名：当前页同 mode 设计根间取最小空闲「label N」（首个用
 * 裸 label，N 自 2 递增）。名称仅展示用，机器身份看标记。命名去重域 =
 * 仅 modeId（T62 定谳 2——旧画布既有名称仅为展示字符串，无兼容动作）。
 */
function nextDesignRootName(figma: FigmaAPI, label: string, modeId: string): string {
  const graph = figma.graph
  const page = graph.getNode(figma.currentPage.id)
  const taken = new Set<string>()
  for (const childId of page?.childIds ?? []) {
    const child = graph.getNode(childId)
    if (!isMarketingDesignRoot(child)) continue
    if (designMarker(child, DESIGN_MODE_KEY) !== modeId) continue
    taken.add(child.name)
  }
  if (!taken.has(label)) return label
  for (let n = 2; ; n++) {
    const candidate = `${label} ${n}`
    if (!taken.has(candidate)) return candidate
  }
}

/** 几何移植（保留值）：VERTICAL / counter FIXED / 高 HUG|'FIXED' / 白底 / clipsContent */
function createDesignRoot(
  figma: FigmaAPI,
  name: string,
  size: { width: number; height: number | null },
  position: Vector
): SceneNode {
  return figma.graph.createNode('FRAME', figma.currentPage.id, {
    name,
    x: position.x,
    y: position.y,
    width: size.width,
    height: size.height ?? SETUP_HUG_INITIAL_HEIGHT,
    layoutMode: 'VERTICAL',
    counterAxisSizing: 'FIXED',
    primaryAxisSizing: size.height === null ? 'HUG' : 'FIXED',
    clipsContent: true,
    fills: [{ type: 'SOLID', color: { r: 1, g: 1, b: 1, a: 1 }, opacity: 1, visible: true }]
  })
}

/**
 * 新建一张营销设计：校验（确认意图 → brief → mode → profile）→ 建框 →
 * 身份落盘 → brief 关联登记 → 视口聚焦。窄化后无领养无幂等——同参数再调
 * 恒新建第二框（最小空闲名递增）。
 */
export function setupDesign(
  figma: FigmaAPI,
  args: SetupDesignArgs,
  catalog?: SetupCatalog
): SetupDesignResult {
  const graph = figma.graph

  // 新建意图确认拦截（双层之 core 层；宿主 wrapper 短路层走 T-B9/T-B10 接线）
  if (args.confirmedNewIntent !== true) {
    return { error: 'unconfirmed_new_intent', message: SETUP_TEXTS.unconfirmedNewIntent }
  }

  const resolution = findBrief(figma, args.briefId === '' ? undefined : args.briefId)
  if (resolution.status === 'not-found') {
    return {
      error: 'brief_not_found',
      message: SETUP_TEXTS.briefNotFound(resolution.briefId),
      briefId: resolution.briefId
    }
  }
  if (resolution.status === 'none') {
    return { error: 'brief_not_found', message: SETUP_TEXTS.briefNone }
  }
  if (resolution.status === 'ambiguous') {
    return {
      error: 'ambiguous_brief',
      message: SETUP_TEXTS.ambiguousBrief,
      candidates: resolution.candidates
    }
  }
  const brief = resolution.brief

  const resolved = resolveMode(args, catalog)
  if ('error' in resolved) return resolved

  const name = nextDesignRootName(figma, resolved.label, args.modeId)
  const position = findPlacementPosition(figma, {
    width: resolved.size.width,
    height: resolved.size.height ?? SETUP_HUG_INITIAL_HEIGHT
  })
  const root = createDesignRoot(figma, name, resolved.size, position)

  // 设计身份落盘（PD-19）：role 标记 + 三元组 + schemaVersion；profileId 缺省不写
  setDesignMarker(graph, root.id, BRIEF_ROLE_KEY, MARKETING_ROLE_ROOT)
  setDesignMarker(graph, root.id, DESIGN_MODE_KEY, args.modeId)
  if (args.profileId !== undefined)
    setDesignMarker(graph, root.id, DESIGN_PROFILE_KEY, args.profileId)
  setDesignMarker(graph, root.id, DESIGN_BRIEF_KEY, brief.id)
  setDesignMarker(graph, root.id, BRIEF_SCHEMA_VERSION_KEY, BRIEF_SCHEMA_VERSION)

  // brief 关联：bound-designs 指针 + 可见绑定行 + 关联设计区条目
  // （登记在身份落盘之后——条目/读侧投影读穿三元组）
  bindBriefToDesign(figma, brief.id, root.id)
  setBriefBindingLabel(
    figma,
    brief.id,
    `${BRIEF_TEXTS.bindingPrefix}${name} · ${figma.currentPage.name}`
  )
  registerBriefDesignEntry(figma, brief.id, root.id)

  const proxy = figma.getNodeById(root.id)
  if (proxy) figma.viewport.scrollAndZoomIntoView([proxy])

  return {
    rootId: root.id,
    name,
    size: resolved.size,
    modeId: args.modeId,
    ...(args.profileId !== undefined ? { profileId: args.profileId } : {}),
    briefId: brief.id,
    placement: position
  }
}

// ── 无状态三态解析（v1 同页限定；无进程态，结果完全由图面标记决定）────────────

export interface MarketingDesignRef {
  rootId: string
  name: string
  /** 三元组读穿（缺省键 = ''；旧画布的 type 残留键天然忽略，T62 定谳 2） */
  modeId: string
  profileId: string
  briefId: string
}

export type MarketingDesignResolution =
  | { status: 'ok'; design: MarketingDesignRef }
  | { status: 'none' }
  | { status: 'not-found'; rootId: string }
  | { status: 'ambiguous'; candidates: MarketingDesignRef[] }

function toDesignRef(node: SceneNode): MarketingDesignRef {
  return {
    rootId: node.id,
    name: node.name,
    modeId: designMarker(node, DESIGN_MODE_KEY),
    profileId: designMarker(node, DESIGN_PROFILE_KEY),
    briefId: designMarker(node, DESIGN_BRIEF_KEY)
  }
}

/** 扫当前页全部营销设计根（递归走查——用户可能把根 frame 编组；死节点读不到标记天然不出现） */
export function scanMarketingDesigns(figma: FigmaAPI): MarketingDesignRef[] {
  const graph = figma.graph
  const page = graph.getNode(figma.currentPage.id)
  if (!page) return []
  const designs: MarketingDesignRef[] = []
  const stack = [...page.childIds]
  while (stack.length > 0) {
    const id = stack.pop()
    if (id === undefined) break
    const node = graph.getNode(id)
    if (!node) continue
    if (isMarketingDesignRoot(node)) designs.push(toDesignRef(node))
    stack.push(...node.childIds)
  }
  return designs
}

/**
 * 解析目标设计：显式 rootId > 当前页唯一设计 > 歧义信号。「最近活跃」兜底
 * 已废除（S1 §9）——多个设计且无显式 id 时必须问用户，绝不静默猜。
 */
export function resolveMarketingDesign(
  figma: FigmaAPI,
  rootId?: string
): MarketingDesignResolution {
  if (rootId !== undefined && rootId !== '') {
    const node = figma.graph.getNode(rootId)
    return isMarketingDesignRoot(node)
      ? { status: 'ok', design: toDesignRef(node) }
      : { status: 'not-found', rootId }
  }
  const designs = scanMarketingDesigns(figma)
  if (designs.length === 0) return { status: 'none' }
  const [first] = designs
  if (designs.length === 1) return { status: 'ok', design: first }
  return { status: 'ambiguous', candidates: designs }
}

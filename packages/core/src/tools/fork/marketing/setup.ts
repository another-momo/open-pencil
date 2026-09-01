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
 * 四职责（S3 §2）：① 按 mode 的 type 蓝图读一次尺寸（快照语义）建根 frame；
 * ② 设尺寸与最小空闲「label N」名；③ 设计身份四元组 + schemaVersion 落盘；
 * ④ brief 关联设计区登记（registerBriefDesignEntry）。
 *
 * W3 注记：type 蓝图机制已被裁决退役（T-B11/T62）——typeId 校验集中于本
 * 文件 resolveBlueprint 单一模块，切除时只动这里。
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
  DESIGN_TYPE_KEY,
  bindBriefToDesign,
  findBrief,
  registerBriefDesignEntry,
  setBriefBindingLabel,
  type BriefCandidate
} from './brief'
import { BRIEF_TEXTS, SETUP_TEXTS } from './texts'

/** 设计根 role 标记值（单源；image-gen/history.ts 的同名本地常量集成时改 import） */
export const MARKETING_ROLE_ROOT = 'marketing-root'

/** 内置 general mode：恒过校验、无 type 蓝图（catalog 缺省时唯一可用路径） */
const SETUP_GENERAL_MODE_ID = 'general'
/** general / 无蓝图 mode 的默认尺寸：750 宽 + HUG 高（长图默认） */
const SETUP_GENERAL_DEFAULT_WIDTH = 750
/** HUG 高根 frame 的初始高度（随内容生长前的占位） */
const SETUP_HUG_INITIAL_HEIGHT = 400

// ── catalog 注入契约（宿主快照，不进模型视野）────────────────────────────────

export interface SetupCatalogType {
  id: string
  label: string
  /** 蓝图尺寸串：'WxH' 定高 / 'Wx' HUG 高（同构旧 parseMaterialTypeSize 线格式） */
  size: string
}

export interface SetupCatalogMode {
  id: string
  label: string
  /** 'none' = 该 mode 无 type 蓝图（同 general 走默认尺寸，不得传 typeId） */
  types: 'none' | SetupCatalogType[]
}

/** 宿主注入的注册表快照；缺省（MCP/headless 无注入）时仅 general 无 typeId 可用 */
export interface SetupCatalog {
  modes: SetupCatalogMode[]
  profileIds: string[]
}

export interface SetupDesignArgs {
  modeId: string
  typeId?: string
  profileId?: string
  briefId: string
  /** 宿主随 args 外层注入的新建意图确认（缺省 false；!== true → 不建框） */
  confirmedNewIntent?: boolean
}

// ── 信封 ───────────────────────────────────────────────────────────────────

export type SetupDesignErrorCode =
  | 'brief_not_found'
  | 'ambiguous_brief'
  | 'unknown_mode'
  | 'type_not_in_mode'
  | 'type_forbidden'
  | 'type_required'
  | 'unknown_profile'
  | 'unconfirmed_new_intent'
  | 'catalog_unavailable'

export interface SetupDesignError {
  error: SetupDesignErrorCode
  /** 用户语言化说明（zh-cn，SETUP_TEXTS 外置） */
  message: string
  modeId?: string
  typeId?: string
  profileId?: string
  briefId?: string
  /** type_required 时该 mode 可选的蓝图 type id 列表 */
  types?: string[]
  candidates?: BriefCandidate[]
}

export interface SetupDesignSuccess {
  rootId: string
  name: string
  /** 蓝图尺寸快照语义：height null = HUG（长图随内容生长，初始高占位 400） */
  size: { width: number; height: number | null }
  modeId: string
  typeId?: string
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

// ── 校验（W3 切除 type 蓝图机制时只动本段）──────────────────────────────────

/** 解析蓝图尺寸串；畸形返回 undefined，该 type 视为不可用（旧「跳过畸形注册」语义） */
function parseBlueprintSize(size: string): { width: number; height: number | null } | undefined {
  const match = /^(\d+)x(\d+)?$/.exec(size)
  if (!match) return undefined
  const width = Number(match[1])
  const height = match[2] ? Number(match[2]) : null
  if (!Number.isFinite(width) || width <= 0) return undefined
  if (height !== null && (!Number.isFinite(height) || height <= 0)) return undefined
  return { width, height }
}

interface ResolvedBlueprint {
  /** 命名基底（type label > mode label > general 默认名） */
  label: string
  size: { width: number; height: number | null }
}

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

function resolveBlueprint(
  args: SetupDesignArgs,
  catalog: SetupCatalog | undefined
): ResolvedBlueprint | SetupDesignError {
  const { modeId, typeId } = args

  // general 恒过校验、不得传 typeId（内置默认尺寸，不查 catalog）
  if (modeId === SETUP_GENERAL_MODE_ID) {
    if (typeId !== undefined) {
      return {
        error: 'type_forbidden',
        message: SETUP_TEXTS.typeForbidden(modeId, typeId),
        modeId,
        typeId
      }
    }
    const profileError = validateProfileId(args.profileId, catalog)
    if (profileError) return profileError
    return {
      label: SETUP_TEXTS.generalDesignName,
      size: { width: SETUP_GENERAL_DEFAULT_WIDTH, height: null }
    }
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

  if (mode.types === 'none') {
    if (typeId !== undefined) {
      return {
        error: 'type_forbidden',
        message: SETUP_TEXTS.typeForbidden(modeId, typeId),
        modeId,
        typeId
      }
    }
    return { label: mode.label, size: { width: SETUP_GENERAL_DEFAULT_WIDTH, height: null } }
  }
  if (typeId === undefined) {
    return {
      error: 'type_required',
      message: SETUP_TEXTS.typeRequired(mode.label),
      modeId,
      types: mode.types.map((entry) => entry.id)
    }
  }
  const type = mode.types.find((entry) => entry.id === typeId)
  const size = type ? parseBlueprintSize(type.size) : undefined
  if (!type || !size) {
    return {
      error: 'type_not_in_mode',
      message: SETUP_TEXTS.typeNotInMode(typeId, mode.label),
      modeId,
      typeId
    }
  }
  return { label: type.label, size }
}

// ── 建框 ───────────────────────────────────────────────────────────────────

/**
 * 新根 frame 显示名：当前页同身份（modeId+typeId 标记）设计根间取最小空闲
 * 「label N」（首个用裸 label，N 自 2 递增）。名称仅展示用，机器身份看标记。
 */
function nextDesignRootName(
  figma: FigmaAPI,
  label: string,
  modeId: string,
  typeId: string | undefined
): string {
  const graph = figma.graph
  const page = graph.getNode(figma.currentPage.id)
  const taken = new Set<string>()
  for (const childId of page?.childIds ?? []) {
    const child = graph.getNode(childId)
    if (!isMarketingDesignRoot(child)) continue
    if (designMarker(child, DESIGN_MODE_KEY) !== modeId) continue
    if (designMarker(child, DESIGN_TYPE_KEY) !== (typeId ?? '')) continue
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
 * 新建一张营销设计：校验（确认意图 → brief → mode/type/profile）→ 建框 →
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

  const blueprint = resolveBlueprint(args, catalog)
  if ('error' in blueprint) return blueprint

  const name = nextDesignRootName(figma, blueprint.label, args.modeId, args.typeId)
  const position = findPlacementPosition(figma, {
    width: blueprint.size.width,
    height: blueprint.size.height ?? SETUP_HUG_INITIAL_HEIGHT
  })
  const root = createDesignRoot(figma, name, blueprint.size, position)

  // 设计身份落盘（PD-19）：role 标记 + 四元组 + schemaVersion；typeId/profileId 缺省不写
  setDesignMarker(graph, root.id, BRIEF_ROLE_KEY, MARKETING_ROLE_ROOT)
  setDesignMarker(graph, root.id, DESIGN_MODE_KEY, args.modeId)
  if (args.typeId !== undefined) setDesignMarker(graph, root.id, DESIGN_TYPE_KEY, args.typeId)
  if (args.profileId !== undefined)
    setDesignMarker(graph, root.id, DESIGN_PROFILE_KEY, args.profileId)
  setDesignMarker(graph, root.id, DESIGN_BRIEF_KEY, brief.id)
  setDesignMarker(graph, root.id, BRIEF_SCHEMA_VERSION_KEY, BRIEF_SCHEMA_VERSION)

  // brief 关联：bound-designs 指针 + 可见绑定行 + 关联设计区条目
  // （登记在身份落盘之后——条目/读侧投影读穿四元组）
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
    size: blueprint.size,
    modeId: args.modeId,
    ...(args.typeId !== undefined ? { typeId: args.typeId } : {}),
    ...(args.profileId !== undefined ? { profileId: args.profileId } : {}),
    briefId: brief.id,
    placement: position
  }
}

// ── 无状态三态解析（v1 同页限定；无进程态，结果完全由图面标记决定）────────────

export interface MarketingDesignRef {
  rootId: string
  name: string
  /** 四元组读穿（缺省键 = ''） */
  modeId: string
  typeId: string
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
    typeId: designMarker(node, DESIGN_TYPE_KEY),
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

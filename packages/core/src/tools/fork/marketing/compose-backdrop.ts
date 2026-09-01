/**
 * compose_backdrop core（T58，S3 §8）：消费 T57 几何记录的长图背景合成。
 *
 * 移植自 open-pencil 仓 feature/agent-backend tools/marketing/compose-backdrop.ts
 * （662 行）+ sample-color.ts + sample-color-pure.ts（采样纯函数随迁本文件，
 * 不再单设 sample-* 前缀文件），契约修订：
 * - hero_height/hero_bleed 散参删除：管线内几何只从 scaffold 的 pluginData
 *   几何记录读（readHeroGeometry，T57）；缺记录/畸形 → geometry_missing
 *   结构化报错引导回 prepare_hero_scaffold（跳步 = 显式失败，不静默默认）。
 *   外部来源（无 scaffold_id）维持旧语义分支：来源节点高度即 Hero 显示高度，
 *   槽位短 DEFAULT_UNDERLAP_PX，画布宽取根 frame 实际宽度。
 * - OVERLAP 常量删除：渐变过渡带与采样带 bandSize 一律取记录
 *   transitionZonePx（外部来源取 DEFAULT_TRANSITION_ZONE_PX）。
 * - 隐式收养 + stray-image 侦测删除：HeroContent 含 IMAGE fill 且未指定
 *   hero_image_from → hero_content_has_image 结构化报错；discard_hero:true
 *   显式丢弃。
 * - 颜色降级链不变：显式 hero_color（非 hex 拒收进 note WARNING，不报错）
 *   > 采样 Hero 底部过渡带 > 白兜底。采样走注入 seam（第 3 参 sampler，
 *   缺省 sampleHeroBottomBand——lazy import CanvasKit，测试注假采样器）。
 * - note 瘦身：只事实 + WARNING，无「Re-call…/Verify with look…」指令链
 *   （工作流引导归 workflow Fix Playbook）。
 *
 * 本体不变量原样平移：kiss 三明治 z 序（BaseWash < HeroImg < BackdropOverlay
 * 锁在 BackgroundLayer 内）；HeroImg = slot + underlap，接缝藏进下一分区；
 * HeroContent 流式槽位强制 fills=[]；幂等重调（canvas_height 缺省跟随根
 * 实际高度）。
 */

import type { Fill, SceneGraph, SceneNode } from '@open-pencil/scene-graph'
import type { Color, Rect } from '@open-pencil/scene-graph/primitives'

import type { FigmaAPI } from '#core/figma-api'

import { DEFAULT_TRANSITION_ZONE_PX, DEFAULT_UNDERLAP_PX, readHeroGeometry } from './hero-scaffold'

/**
 * 画布文案外置（zh-cn 错误文案 + 英文事实 note，同 HERO_TEXTS 纪律；暂放本
 * 文件——texts.ts 本波次归 T53 独占，避免并行撞车）。层名沿用 S3 §8 的英文
 * 结构标识（BaseWash < HeroImg < BackdropOverlay 锁于 BackgroundLayer）。
 */
export const COMPOSE_TEXTS = {
  layerName: 'BackgroundLayer',
  baseWashName: 'BaseWash',
  heroImgName: 'HeroImg',
  overlayName: 'BackdropOverlay',
  heroContentName: 'HeroContent',

  toolDescription:
    '一次性搭建长图设计的视觉环境：在根 frame 内创建/更新 BackgroundLayer（绝对定位、z 序最底），内含 BaseWash（全画布渐变）、HeroImg（Hero 图像承载层，按几何记录向下延伸 underlap 像素，让淡化接缝藏进下一分区）、BackdropOverlay（三段渐变，在 Hero 底部过渡带处吻合并渐变为不透明白），以及透明的 HeroContent 流式槽位（为 Hero 占位并承载标题文案，绘制在整层背景之上）。管线内路径传 scaffold_id：几何（宽度/Hero 高度/underlap/过渡带）一律从 scaffold 的几何记录读取——先调 prepare_hero_scaffold；scaffold 上已生成的图像填充会被复制进 HeroImg。外部来源（用户上传图）传 hero_image_from：来源节点高度即 Hero 显示高度，槽位短 100px，画布宽取根 frame 实际宽度。颜色降级链：显式 hero_color > 自动采样 Hero 底部过渡带 > 白兜底。HeroContent 已有图像填充但未指定 hero_image_from 时报错——指定来源，或传 discard_hero:true 确认丢弃。canvas_height 可省略（缺省取根 frame 当前高度，适合内容分区渲染完、根高度稳定后的收尾重调）。幂等，可重复调用。',
  paramRootId: '根 frame（长图画布）的节点 id。必须是带自动布局（layoutMode ≠ NONE）的 FRAME。',
  paramScaffoldId:
    '管线内路径：prepare_hero_scaffold 产出的 scaffold 节点 id。几何从它的几何记录读取；scaffold 上已生成的 IMAGE 填充会被复制进 HeroImg（scaffold 本身不动）。与 hero_image_from 至少传一个。',
  paramHeroImageFrom:
    '其 IMAGE 填充要成为 Hero 的节点 id——通常是已生成图像的 scaffold 或 HeroContent。填充复制到 HeroImg；来源是 HeroContent 时其填充随后清空为透明（其他来源节点不动）。外部来源（无 scaffold_id）时来源节点高度即 Hero 显示高度。',
  paramDiscardHero:
    '传 true 显式确认丢弃 HeroContent 上已有的图像填充（不指定来源时的误生成防护）。与 hero_image_from 互斥。',
  paramCanvasHeight:
    '画布总高度（BackdropOverlay 从 Hero 底部 − 过渡带延伸到此高度）。可省略：缺省取根 frame 当前高度——内容分区渲染完、根高度 Hug 稳定后的收尾重调就该省略它。',
  paramHeroColor:
    '可选的 6 或 8 位 hex，覆盖自动采样作为 BackdropOverlay 中间 stop。省略时自动采样 Hero 底部过渡带；无 Hero 图像时白兜底（纯白过渡，视觉安全）。',

  missingRootId: '请传根 frame 的节点 id（root_id）。',
  missingSource:
    '请传 scaffold_id（管线内几何记录）或 hero_image_from（外部图像来源）——二者至少其一。',
  discardWithSource: 'discard_hero 与 hero_image_from 互斥——丢弃与指定来源只能选一个。',
  invalidCanvasHeight: (value: number) =>
    `canvas_height 必须是有限数值（收到 ${value}）——检查参数是否有误。`,
  rootNotFound: (rootId: string) => `找不到根 frame「${rootId}」。`,
  rootNotFrame: (rootId: string, type: string) =>
    `节点「${rootId}」是 ${type}，不是 FRAME——请传长图画布的根 frame。`,
  rootNotAutoLayout:
    '根 frame 没有自动布局（layoutMode 为 NONE）——背景拓扑需要流式槽位（HeroContent）加绝对定位 BackgroundLayer，请先给根 frame 设置自动布局。',
  scaffoldNotFound: (scaffoldId: string) =>
    `找不到 Hero scaffold「${scaffoldId}」——请先调用 prepare_hero_scaffold 准备 Hero 参考。`,
  geometryMissing:
    'scaffold 缺少几何记录（或记录已损坏）——请重新调用 prepare_hero_scaffold 写入几何记录，再合成背景（跳步 = 显式失败，不做静默默认）。',
  sourceNotFound: (sourceId: string) => `找不到 hero_image_from 节点「${sourceId}」。`,
  sourceNoImage: (sourceName: string) =>
    `hero_image_from 节点「${sourceName}」没有图像填充——请先把 Hero 图像生成进去，再调用本工具。`,
  heroContentHasImage:
    'HeroContent 含图像填充且未指定 hero_image_from：请指定来源，或传 discard_hero:true 确认丢弃。',
  canvasNotFinite: (width: number, height: number) =>
    `画布尺寸必须是有限数值（收到 ${width}×${height}）。`,
  canvasTooSmall: (width: number, height: number) =>
    `画布过小（收到 ${width}×${height}，最小 100×200）。`,
  canvasTooLarge: (width: number, height: number) =>
    `画布过大（收到 ${width}×${height}，最大 8000×20000）——检查是否有笔误。`,
  invalidHeroHeight: (heroHeight: number, canvasHeight: number) =>
    `Hero 槽高 ${heroHeight}px 不合法（须为 [100, canvas_height=${canvasHeight}) 内的有限值）——管线内请回 prepare_hero_scaffold 调整 underlap_px。`,
  heroImgTooTall: (heroImgHeight: number, canvasHeight: number) =>
    `Hero 图像高度 ${heroImgHeight}px 必须小于 canvas_height（${canvasHeight}px）。`,

  sampleMissingHash: 'hero image fill is missing its imageHash reference',
  sampleBytesMissing: (imageHash: string) =>
    `image bytes for hash "${imageHash}" are not loaded in the graph`,
  sampleDecodeFailed: 'could not decode hero image bytes',
  sampleReadFailed: 'could not read pixels from the hero image bottom band',
  sampleEmpty: 'hero image returned no pixels in the bottom band',
  sampleNonFinite: (r: number, g: number, b: number) =>
    `sampled color is not finite (r=${r}, g=${g}, b=${b})`,

  rootWidthWarning: (width: number, rootWidth: number) =>
    `the backdrop width (${width}) differs from the root frame's actual width (${rootWidth}) — the backdrop follows its own width.`
} as const

// ── 契约常量 ─────────────────────────────────────────────────────────────────

const FALLBACK_HEX = '#FFFFFFFF'
const BASE_WASH_TOP_OPACITY = 0.05
const MIN_CANVAS_WIDTH = 100
const MIN_CANVAS_HEIGHT = 200
const MAX_CANVAS_WIDTH = 8000
const MAX_CANVAS_HEIGHT = 20000
const MIN_HERO_HEIGHT = 100

const VERTICAL_TRANSFORM = { m00: 0, m01: 1, m02: 0, m10: -1, m11: 0, m12: 1 }
const HEX_REGEX = /^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/
const WHITE: Color = { r: 1, g: 1, b: 1, a: 1 }

// ── 信封 ─────────────────────────────────────────────────────────────────────

export type ComposeBackdropErrorCode =
  | 'invalid_params'
  | 'root_not_found'
  | 'root_not_frame'
  | 'root_not_auto_layout'
  | 'scaffold_not_found'
  | 'geometry_missing'
  | 'source_not_found'
  | 'source_no_image'
  | 'hero_content_has_image'
  | 'invalid_geometry'

export interface ComposeBackdropError {
  error: ComposeBackdropErrorCode
  /** 用户语言化说明（zh-cn，COMPOSE_TEXTS 外置） */
  message: string
}

export type ComposeColorSource = 'explicit' | 'sampled' | 'fallback'

export interface ComposeBackdropSuccess {
  root_id: string
  background_layer_id: string
  base_wash_id: string
  hero_img_id: string
  hero_content_id: string
  backdrop_overlay_id: string
  hero_color: string
  color_source: ComposeColorSource
  hero_height: number
  underlap_px: number
  /** 渐变过渡带高度（= 记录 transitionZonePx；外部来源取默认 100） */
  overlap_px: number
  overlay_position: Rect
  /** 仅事实 + WARNING，无后续工具指令链 */
  note: string
}

export type ComposeBackdropResult = ComposeBackdropSuccess | ComposeBackdropError

export interface ComposeBackdropArgs {
  rootId: string
  scaffoldId?: string
  heroImageFrom?: string
  discardHero?: boolean
  canvasHeight?: number
  heroColor?: string
}

/**
 * 采样 seam：读 IMAGE fill 的底部 bandSize 像素带并平均成 hex。测试注入假
 * 采样器；缺省实现 sampleHeroBottomBand lazy import CanvasKit。
 */
export type HeroColorSampler = (
  graph: SceneGraph,
  fill: Fill,
  bandSize: number
) => Promise<{ hex: string } | { error: string }>

// ── 采样纯函数（sample-color-pure.ts 随迁；只保留 bottom 方向特化）─────────────

interface BandColor {
  r: number
  g: number
  b: number
  samples: number
}

/** 图像底部 size 像素高的采样带区域（厚度 clamp 到图像高度） */
export function bottomBandRegion(imageWidth: number, imageHeight: number, size: number): Rect {
  const height = Math.max(1, Math.min(size, imageHeight))
  return { x: 0, y: imageHeight - height, width: imageWidth, height }
}

/**
 * 平均 RGBA_8888 buffer 中指定矩形区域的 sRGB 像素。pixels 是整图 buffer，
 * imageWidth 作行 stride；alpha 通道忽略（未预乘 RGB 原样计入）。
 */
export function averageRegion(
  pixels: Uint8Array,
  imageWidth: number,
  x: number,
  y: number,
  width: number,
  height: number
): BandColor {
  let r = 0
  let g = 0
  let b = 0
  let samples = 0
  const stride = imageWidth * 4
  for (let row = 0; row < height; row++) {
    const rowStart = (y + row) * stride + x * 4
    for (let col = 0; col < width; col++) {
      const i = rowStart + col * 4
      r += pixels[i]
      g += pixels[i + 1]
      b += pixels[i + 2]
      samples++
    }
  }
  if (samples === 0) return { r: 0, g: 0, b: 0, samples: 0 }
  return {
    r: Math.round(r / samples),
    g: Math.round(g / samples),
    b: Math.round(b / samples),
    samples
  }
}

export function bandColorToHex(color: { r: number; g: number; b: number }): string {
  const toHex = (n: number) => Math.max(0, Math.min(255, n)).toString(16).padStart(2, '0')
  return `#${toHex(color.r)}${toHex(color.g)}${toHex(color.b)}`.toUpperCase()
}

/**
 * 真采样实现（CanvasKit 像素路径，sample-color.ts 随迁）。lazy import
 * '#core/canvaskit'——测试环境注入假采样器，不加载 CanvasKit。
 */
export const sampleHeroBottomBand: HeroColorSampler = async (graph, fill, bandSize) => {
  const imageHash = fill.imageHash
  if (!imageHash) return { error: COMPOSE_TEXTS.sampleMissingHash }
  const bytes = graph.images.get(imageHash)
  if (!bytes) return { error: COMPOSE_TEXTS.sampleBytesMissing(imageHash) }

  const { getCanvasKit } = await import('#core/canvaskit')
  const canvasKit = await getCanvasKit()
  const skImage = canvasKit.MakeImageFromEncoded(bytes)
  if (!skImage) return { error: COMPOSE_TEXTS.sampleDecodeFailed }

  const width = skImage.width()
  const height = skImage.height()
  const region = bottomBandRegion(width, height, bandSize)

  // 读整图 buffer 而非子区域：averageRegion 以 imageWidth 为行 stride，
  // 传子区域 buffer 会越界读出 NaN
  const pixels = skImage.readPixels(0, 0, {
    alphaType: canvasKit.AlphaType.Unpremul,
    colorSpace: canvasKit.ColorSpace.SRGB,
    colorType: canvasKit.ColorType.RGBA_8888,
    width,
    height
  })
  skImage.delete()

  if (!pixels || !(pixels instanceof Uint8Array)) {
    return { error: COMPOSE_TEXTS.sampleReadFailed }
  }
  const average = averageRegion(pixels, width, region.x, region.y, region.width, region.height)
  if (average.samples === 0) return { error: COMPOSE_TEXTS.sampleEmpty }
  if (!Number.isFinite(average.r) || !Number.isFinite(average.g) || !Number.isFinite(average.b)) {
    return { error: COMPOSE_TEXTS.sampleNonFinite(average.r, average.g, average.b) }
  }
  return { hex: bandColorToHex(average) }
}

// ── 参数校验 ─────────────────────────────────────────────────────────────────

interface ValidatedInputs {
  rootId: string
  scaffoldId?: string
  heroImageFrom?: string
  discardHero: boolean
  /** undefined = 调用方省略，execute 内解析为根 frame 当前高度 */
  canvasHeight?: number
  heroColor?: string
  /** 传了但不合 hex 的 hero_color——进 note WARNING 而非静丢（旧行为） */
  heroColorRejected?: string
}

function nonEmpty(value: string | undefined): string | undefined {
  return value !== undefined && value.length > 0 ? value : undefined
}

function validateInputs(args: ComposeBackdropArgs): ValidatedInputs | ComposeBackdropError {
  if (args.rootId.length === 0) {
    return { error: 'invalid_params', message: COMPOSE_TEXTS.missingRootId }
  }
  const scaffoldId = nonEmpty(args.scaffoldId)
  const heroImageFrom = nonEmpty(args.heroImageFrom)
  if (scaffoldId === undefined && heroImageFrom === undefined) {
    return { error: 'invalid_params', message: COMPOSE_TEXTS.missingSource }
  }
  const discardHero = args.discardHero === true
  if (discardHero && heroImageFrom !== undefined) {
    return { error: 'invalid_params', message: COMPOSE_TEXTS.discardWithSource }
  }
  if (args.canvasHeight !== undefined && !Number.isFinite(args.canvasHeight)) {
    return {
      error: 'invalid_params',
      message: COMPOSE_TEXTS.invalidCanvasHeight(args.canvasHeight)
    }
  }
  const heroColor =
    args.heroColor !== undefined && HEX_REGEX.test(args.heroColor) ? args.heroColor : undefined
  const heroColorRejected =
    args.heroColor !== undefined && args.heroColor.length > 0 && heroColor === undefined
      ? args.heroColor
      : undefined
  return {
    rootId: args.rootId,
    scaffoldId,
    heroImageFrom,
    discardHero,
    canvasHeight: args.canvasHeight,
    heroColor,
    heroColorRejected
  }
}

function validateCanvasSize(
  canvasWidth: number,
  canvasHeight: number
): ComposeBackdropError | undefined {
  if (!Number.isFinite(canvasWidth) || !Number.isFinite(canvasHeight)) {
    return {
      error: 'invalid_geometry',
      message: COMPOSE_TEXTS.canvasNotFinite(canvasWidth, canvasHeight)
    }
  }
  if (canvasWidth < MIN_CANVAS_WIDTH || canvasHeight < MIN_CANVAS_HEIGHT) {
    return {
      error: 'invalid_geometry',
      message: COMPOSE_TEXTS.canvasTooSmall(canvasWidth, canvasHeight)
    }
  }
  if (canvasWidth > MAX_CANVAS_WIDTH || canvasHeight > MAX_CANVAS_HEIGHT) {
    return {
      error: 'invalid_geometry',
      message: COMPOSE_TEXTS.canvasTooLarge(canvasWidth, canvasHeight)
    }
  }
  return undefined
}

// ── 结构校验与几何解析 ───────────────────────────────────────────────────────

function resolveRootFrame(
  graph: SceneGraph,
  rootId: string
): { root: SceneNode } | ComposeBackdropError {
  const root = graph.getNode(rootId)
  if (!root) return { error: 'root_not_found', message: COMPOSE_TEXTS.rootNotFound(rootId) }
  if (root.type !== 'FRAME') {
    return { error: 'root_not_frame', message: COMPOSE_TEXTS.rootNotFrame(rootId, root.type) }
  }
  if (root.layoutMode === 'NONE') {
    return { error: 'root_not_auto_layout', message: COMPOSE_TEXTS.rootNotAutoLayout }
  }
  return { root }
}

function findChildByName(
  parent: SceneNode,
  graph: SceneGraph,
  name: string
): SceneNode | undefined {
  for (const childId of parent.childIds) {
    const child = graph.getNode(childId)
    if (child?.name === name) return child
  }
  return undefined
}

interface ResolvedGeometry {
  canvasWidth: number
  heroHeight: number
  heroImgHeight: number
  underlapPx: number
  overlapPx: number
  /** discard_hero 时 undefined（无来源、不转移） */
  sourceNode?: SceneNode
  /** hero_image_from 显式指定：无填充且 HeroImg 也无图 → source_no_image 报错 */
  sourceExplicit: boolean
}

/**
 * 几何解析。管线内（scaffold_id）：宽高/underlap/过渡带一律读几何记录，
 * 缺记录/畸形 → geometry_missing 引导回 prepare_hero_scaffold。外部来源
 * （仅 hero_image_from）：维持旧语义分支——来源高度即显示高度，槽位短
 * underlap，画布宽取根实际宽度（几何记录不适用）。
 */
function resolveGeometry(
  graph: SceneGraph,
  root: SceneNode,
  inputs: ValidatedInputs
): ResolvedGeometry | ComposeBackdropError {
  if (inputs.scaffoldId !== undefined) {
    const scaffold = graph.getNode(inputs.scaffoldId)
    if (!scaffold) {
      return {
        error: 'scaffold_not_found',
        message: COMPOSE_TEXTS.scaffoldNotFound(inputs.scaffoldId)
      }
    }
    const record = readHeroGeometry(graph, scaffold)
    if (!record) {
      return { error: 'geometry_missing', message: COMPOSE_TEXTS.geometryMissing }
    }
    let sourceNode: SceneNode | undefined = scaffold
    if (inputs.heroImageFrom !== undefined) {
      const explicitSource = graph.getNode(inputs.heroImageFrom)
      if (!explicitSource) {
        return {
          error: 'source_not_found',
          message: COMPOSE_TEXTS.sourceNotFound(inputs.heroImageFrom)
        }
      }
      sourceNode = explicitSource
    }
    return {
      canvasWidth: record.width,
      heroHeight: record.height - record.underlapPx,
      heroImgHeight: record.height,
      underlapPx: record.underlapPx,
      overlapPx: record.transitionZonePx,
      sourceNode: inputs.discardHero ? undefined : sourceNode,
      sourceExplicit: inputs.heroImageFrom !== undefined
    }
  }
  if (inputs.heroImageFrom === undefined) {
    return { error: 'invalid_params', message: COMPOSE_TEXTS.missingSource }
  }
  const externalSource = graph.getNode(inputs.heroImageFrom)
  if (!externalSource) {
    return {
      error: 'source_not_found',
      message: COMPOSE_TEXTS.sourceNotFound(inputs.heroImageFrom)
    }
  }
  return {
    canvasWidth: root.width,
    heroHeight: externalSource.height - DEFAULT_UNDERLAP_PX,
    heroImgHeight: externalSource.height,
    underlapPx: DEFAULT_UNDERLAP_PX,
    overlapPx: DEFAULT_TRANSITION_ZONE_PX,
    sourceNode: externalSource,
    sourceExplicit: true
  }
}

// ── 来源填充转移 ─────────────────────────────────────────────────────────────

/**
 * 把来源的 IMAGE fill 复制到层内 HeroImg。来源无填充时：幂等重调（已转移
 * 过）容忍；hero_image_from 显式来源 → source_no_image 报错；scaffold 隐式
 * 来源 → 容忍（图像尚未生成，白兜底）。
 */
function transferImageFill(
  graph: SceneGraph,
  heroImg: SceneNode,
  sourceNode: SceneNode | undefined,
  sourceExplicit: boolean
): { transferred: boolean } | ComposeBackdropError {
  if (!sourceNode) return { transferred: false }
  const fill = sourceNode.fills.find((candidate) => candidate.type === 'IMAGE')
  if (fill) {
    graph.updateNode(heroImg.id, { fills: [fill] })
    return { transferred: true }
  }
  const existing = heroImg.fills.find((candidate) => candidate.type === 'IMAGE')
  if (existing) return { transferred: false }
  if (sourceExplicit) {
    return { error: 'source_no_image', message: COMPOSE_TEXTS.sourceNoImage(sourceNode.name) }
  }
  return { transferred: false }
}

// ── 颜色管线 ─────────────────────────────────────────────────────────────────

interface HeroColorResolution {
  hex: string
  source: ComposeColorSource
  sampleError?: string
}

/**
 * 显式 hero_color > 采样 Hero 底部 bandSize 像素带 > 白兜底。采样失败降级
 * 为白而非报错——结构不得因像素失败。
 */
async function resolveHeroColor(
  graph: SceneGraph,
  heroImg: SceneNode,
  explicitHex: string | undefined,
  bandSize: number,
  sampler: HeroColorSampler
): Promise<HeroColorResolution> {
  if (explicitHex !== undefined) return { hex: explicitHex, source: 'explicit' }
  const imageFill = heroImg.fills.find((candidate) => candidate.type === 'IMAGE')
  if (!imageFill) return { hex: FALLBACK_HEX, source: 'fallback' }
  const sampled = await sampler(graph, imageFill, bandSize)
  if ('error' in sampled) {
    return { hex: FALLBACK_HEX, source: 'fallback', sampleError: sampled.error }
  }
  return { hex: sampled.hex, source: 'sampled' }
}

// ── 拓扑建造 ─────────────────────────────────────────────────────────────────

interface StopInput {
  color: Color
  position: number
  /** 乘进 stop 颜色的 alpha——opacity 0.05 是淡染色而非全强度色 */
  opacity?: number
}

interface GradientSpec {
  x: number
  y: number
  width: number
  height: number
  stops: StopInput[]
}

function buildGradientFill(stops: StopInput[]): Fill {
  const gradientStops = stops.map((stop) => ({
    color:
      stop.opacity === undefined ? stop.color : { ...stop.color, a: stop.color.a * stop.opacity },
    position: stop.position
  }))
  return {
    type: 'GRADIENT_LINEAR',
    color: gradientStops[0]?.color ?? WHITE,
    opacity: 1,
    visible: true,
    gradientStops,
    gradientTransform: VERTICAL_TRANSFORM
  }
}

function upsertLayer(
  graph: SceneGraph,
  root: SceneNode,
  canvasWidth: number,
  canvasHeight: number
): SceneNode {
  const geometry = {
    x: 0,
    y: 0,
    width: canvasWidth,
    height: canvasHeight,
    layoutPositioning: 'ABSOLUTE' as const
  }
  const existing = findChildByName(root, graph, COMPOSE_TEXTS.layerName)
  if (existing) {
    graph.updateNode(existing.id, geometry)
    return existing
  }
  return graph.createNode('FRAME', root.id, {
    ...geometry,
    name: COMPOSE_TEXTS.layerName,
    layoutMode: 'NONE',
    clipsContent: false,
    fills: []
  })
}

function upsertHeroImg(
  graph: SceneGraph,
  layer: SceneNode,
  canvasWidth: number,
  heroImgHeight: number
): SceneNode {
  const geometry = { x: 0, y: 0, width: canvasWidth, height: heroImgHeight }
  const existing = findChildByName(layer, graph, COMPOSE_TEXTS.heroImgName)
  if (existing) {
    // 保留既有 fills——之前转移/生成的图像必须挺过幂等重调
    graph.updateNode(existing.id, geometry)
    return existing
  }
  return graph.createNode('FRAME', layer.id, {
    ...geometry,
    name: COMPOSE_TEXTS.heroImgName,
    layoutMode: 'NONE',
    clipsContent: true,
    fills: [{ type: 'SOLID', color: { ...WHITE }, opacity: 1, visible: true }]
  })
}

function upsertHeroContent(
  graph: SceneGraph,
  root: SceneNode,
  canvasWidth: number,
  heroHeight: number
): SceneNode {
  const existing = findChildByName(root, graph, COMPOSE_TEXTS.heroContentName)
  if (existing) {
    // 同步流式占位到槽高；布局与子节点（标题/logo）不动。强制 fills=[]——
    // 槽位必须保持透明，否则盖在 BackgroundLayer 上把它整个遮住
    graph.updateNode(existing.id, { width: canvasWidth, height: heroHeight, fills: [] })
    return existing
  }
  return graph.createNode('FRAME', root.id, {
    name: COMPOSE_TEXTS.heroContentName,
    x: 0,
    y: 0,
    width: canvasWidth,
    height: heroHeight,
    layoutMode: 'VERTICAL',
    clipsContent: false,
    fills: []
  })
}

/** 具名渐变矩形 upsert：存在则原位更新 fills/几何；调用方随后 reorderChild 重钉 z 位 */
function upsertGradientRect(
  graph: SceneGraph,
  parent: SceneNode,
  name: string,
  spec: GradientSpec
): SceneNode {
  const geometry = { x: spec.x, y: spec.y, width: spec.width, height: spec.height }
  const existing = findChildByName(parent, graph, name)
  if (existing) {
    graph.updateNode(existing.id, { ...geometry, fills: [buildGradientFill(spec.stops)] })
    return existing
  }
  return graph.createNode('RECTANGLE', parent.id, {
    ...geometry,
    name,
    fills: [buildGradientFill(spec.stops)]
  })
}

function hexToColor(hex: string): Color {
  const clean = hex.slice(1)
  if (clean.length !== 6 && clean.length !== 8) return { ...WHITE }
  const channel = (i: number) => Number.parseInt(clean.slice(i, i + 2), 16) / 255
  return { r: channel(0), g: channel(2), b: channel(4), a: clean.length === 8 ? channel(6) : 1 }
}

// ── note（只事实 + WARNING，无工作流指令链）──────────────────────────────────

function describeColor(color: HeroColorResolution, overlapPx: number): string {
  if (color.source === 'sampled') {
    return `Overlay middle stop auto-sampled from the hero's bottom ${overlapPx}px: ${color.hex}.`
  }
  if (color.source === 'explicit') {
    return `Overlay middle stop uses explicit hero_color ${color.hex}.`
  }
  if (color.sampleError !== undefined && color.sampleError.length > 0) {
    return `Could not auto-sample the hero (${color.sampleError}) — overlay falls back to a plain white transition.`
  }
  return 'No hero image — overlay is a plain white transition.'
}

function buildFactsNote(input: {
  rootName: string
  heroHeight: number
  heroImgHeight: number
  underlapPx: number
  overlapPx: number
  overlayY: number
  canvasHeight: number
  transfer: { transferred: boolean }
  sourceCleared: boolean
  discardHero: boolean
  color: HeroColorResolution
  heightDefaulted: boolean
  rootWidthWarning?: string
  heroColorRejected?: string
}): string {
  let transferPart = ''
  if (input.transfer.transferred) {
    transferPart = input.sourceCleared
      ? "The image fill was copied into the BackgroundLayer's HeroImg and HeroContent's own fills were cleared — title/logo there paint above everything."
      : "The image fill was copied into the BackgroundLayer's HeroImg; the source node was left untouched."
  } else if (input.discardHero) {
    transferPart =
      'discard_hero confirmed — HeroContent stays transparent and no hero image is used.'
  }
  const underlapPart =
    input.underlapPx > 0
      ? `HeroImg extends ${input.underlapPx}px past the hero slot (to y=${input.heroImgHeight}) so the fade seam hides inside the next section's content area.`
      : ''
  const rejectedPart =
    input.heroColorRejected !== undefined
      ? `WARNING: hero_color "${input.heroColorRejected}" is not valid 6- or 8-digit hex and was ignored.`
      : ''
  const widthPart = input.rootWidthWarning === undefined ? '' : `WARNING: ${input.rootWidthWarning}`
  const heightPart = input.heightDefaulted
    ? `canvas_height was omitted — used the root frame's current height (${input.canvasHeight}px).`
    : ''
  return [
    `Backdrop composed under root "${input.rootName}": BackgroundLayer (absolute, index 0: BaseWash < HeroImg < BackdropOverlay) + HeroContent (flow, index 1, h=${input.heroHeight}).`,
    transferPart,
    underlapPart,
    `BackdropOverlay spans y=${input.overlayY}..${input.canvasHeight}, fading over the hero's bottom ${input.overlapPx}px then into opaque white. ${describeColor(input.color, input.overlapPx)}`,
    rejectedPart,
    widthPart,
    heightPart
  ]
    .filter((part) => part.length > 0)
    .join(' ')
}

// ── 主流程 ───────────────────────────────────────────────────────────────────

/**
 * 合成背景：校验（参数 → root → 几何/尺寸 → HeroContent 图像防护）→
 * BackgroundLayer/HeroImg/HeroContent upsert → 填充转移 → 颜色管线 →
 * 双渐变 upsert + z 序重钉 → 事实 note。
 */
export async function composeBackdrop(
  figma: FigmaAPI,
  args: ComposeBackdropArgs,
  sampler: HeroColorSampler = sampleHeroBottomBand
): Promise<ComposeBackdropResult> {
  const graph = figma.graph

  const inputs = validateInputs(args)
  if ('error' in inputs) return inputs

  const rootResult = resolveRootFrame(graph, inputs.rootId)
  if ('error' in rootResult) return rootResult
  const root = rootResult.root

  // canvas_height 缺省解析为根 frame 当前高度：内容分区渲染完、HUG 根高度
  // 稳定后的收尾重调省略它，白色页脚淡化落在真实画布底
  const canvasHeight = inputs.canvasHeight ?? root.height

  const geometry = resolveGeometry(graph, root, inputs)
  if ('error' in geometry) return geometry
  const { canvasWidth, heroHeight, heroImgHeight, underlapPx, overlapPx } = geometry

  const sizeError = validateCanvasSize(canvasWidth, canvasHeight)
  if (sizeError) return sizeError
  if (!Number.isFinite(heroHeight) || heroHeight < MIN_HERO_HEIGHT || heroHeight >= canvasHeight) {
    return {
      error: 'invalid_geometry',
      message: COMPOSE_TEXTS.invalidHeroHeight(heroHeight, canvasHeight)
    }
  }
  if (heroImgHeight >= canvasHeight) {
    return {
      error: 'invalid_geometry',
      message: COMPOSE_TEXTS.heroImgTooTall(heroImgHeight, canvasHeight)
    }
  }

  // 隐式收养删除后的显式防护：HeroContent 已含图像而未指定来源 = 疑似误生成
  const existingHeroContent = findChildByName(root, graph, COMPOSE_TEXTS.heroContentName)
  const heroContentHasImage =
    existingHeroContent?.fills.some((fill) => fill.type === 'IMAGE') ?? false
  if (inputs.heroImageFrom === undefined && !inputs.discardHero && heroContentHasImage) {
    return { error: 'hero_content_has_image', message: COMPOSE_TEXTS.heroContentHasImage }
  }

  // 宽度对账：背景按几何记录/根宽建造，滑一丝就静默错尺寸——警告不报错
  const rootWidthWarning =
    Number.isFinite(root.width) && Math.abs(root.width - canvasWidth) > 1
      ? COMPOSE_TEXTS.rootWidthWarning(canvasWidth, root.width)
      : undefined

  // BackgroundLayer（绝对定位，根 z 序最底）
  const layer = upsertLayer(graph, root, canvasWidth, canvasHeight)
  graph.reorderChild(layer.id, root.id, 0)

  // HeroImg（slot + underlap，接缝藏进下一分区）；按来源复制 IMAGE fill
  const heroImg = upsertHeroImg(graph, layer, canvasWidth, heroImgHeight)
  const transfer = transferImageFill(graph, heroImg, geometry.sourceNode, geometry.sourceExplicit)
  if ('error' in transfer) return transfer
  graph.reorderChild(heroImg.id, layer.id, 1)

  // HeroContent 流式槽位（透明，在流内占 heroHeight）
  const heroContent = upsertHeroContent(graph, root, canvasWidth, heroHeight)
  graph.reorderChild(heroContent.id, root.id, 1)
  const sourceCleared = geometry.sourceNode?.id === heroContent.id

  // 颜色：显式 > 采样底部过渡带 > 白兜底
  const color = await resolveHeroColor(graph, heroImg, inputs.heroColor, overlapPx, sampler)
  const theme = hexToColor(color.hex)

  const overlayY = heroImgHeight - overlapPx
  const overlayHeight = canvasHeight - overlayY
  const middleStopPosition = overlapPx / overlayHeight

  const baseWash = upsertGradientRect(graph, layer, COMPOSE_TEXTS.baseWashName, {
    x: 0,
    y: 0,
    width: canvasWidth,
    height: canvasHeight,
    stops: [
      { color: theme, position: 0, opacity: BASE_WASH_TOP_OPACITY },
      { color: WHITE, position: 1 }
    ]
  })
  graph.reorderChild(baseWash.id, layer.id, 0)

  const backdropOverlay = upsertGradientRect(graph, layer, COMPOSE_TEXTS.overlayName, {
    x: 0,
    y: overlayY,
    width: canvasWidth,
    height: overlayHeight,
    stops: [
      // 透明 THEME（非透明白）：淡入是纯 alpha 渐变，Hero 底带直接融进自身
      // 色相；白色起点会在吻区染上苍白光晕——最显眼的接缝形状
      { color: { ...theme, a: 0 }, position: 0 },
      { color: theme, position: middleStopPosition },
      { color: WHITE, position: 1 }
    ]
  })
  graph.reorderChild(backdropOverlay.id, layer.id, 2)

  return {
    root_id: root.id,
    background_layer_id: layer.id,
    base_wash_id: baseWash.id,
    hero_img_id: heroImg.id,
    hero_content_id: heroContent.id,
    backdrop_overlay_id: backdropOverlay.id,
    hero_color: color.hex,
    color_source: color.source,
    hero_height: heroHeight,
    underlap_px: underlapPx,
    overlap_px: overlapPx,
    overlay_position: { x: 0, y: overlayY, width: canvasWidth, height: overlayHeight },
    note: buildFactsNote({
      rootName: root.name,
      heroHeight,
      heroImgHeight,
      underlapPx,
      overlapPx,
      overlayY,
      canvasHeight,
      transfer,
      sourceCleared,
      discardHero: inputs.discardHero,
      color,
      heightDefaulted: inputs.canvasHeight === undefined,
      rootWidthWarning,
      heroColorRejected: inputs.heroColorRejected
    })
  }
}

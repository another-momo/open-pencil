/**
 * T43（S4 W1 / T-A1）studio 资产文件机制——契约类型。
 *
 * 三类资产（base / workflow / profile）统一「文件即资产」：一个资产 = 一个
 * markdown 文件（frontmatter 元数据 + 正文）。规格真源见仓外
 * doc/S2-asset-files-spec.md v2（§1 机制总览 / §2 目录布局 / §8 加载失败纪律）。
 *
 * 正文小节索引口径（parse.ts 产出，validate 与后续组装共用单源）：
 * `## X` 与 `### X` 标题均入索引，节内容 = 标题行之后到下一个标题（任意级）之间的文本。
 *
 * T65（owner 2026-09-01 拍板 C）：workflow frontmatter 可选 `sizes: [{label, canvas}]`
 * 尺寸预设清单（label 中文名 + canvas `宽x` 高 HUG / `宽x高` 定高），registry 透传进
 * StudioMode → manifest/catalog 投影；缺席 → 缺省 750 宽 HUG（语义不变）。
 *
 * T85（owner 2026-09-02 拍板「资产 references 按需读取机制」）：三类资产 frontmatter
 * 统一可选 `references: [{path, description}]`——声明即白名单，正文经 read_reference
 * 后端本地工具按需读取（唯一读取缝，pi 内建 read 保持禁用）。path 相对资产文件所在
 * 目录、仅 .md、禁 `..` / 绝对路径 / 盘符；校验在 validate.ts（纯函数），文件存在性
 * 在 registry 加载期检查（缺失条目摘出 + failures 显式条目，S2 §8 不静默）。
 */

import type { CanvasSizePreset } from '@open-pencil/core/tools/fork/marketing/setup'

/** 尺寸预设（T65 §2.1）——形状单源在 core setup.ts（type-shapes 门禁禁同构双写） */
export type StudioSizePreset = CanvasSizePreset

export type StudioAssetKind = 'base' | 'workflow' | 'profile'

/** 资产来源：内置集（随应用分发）或用户目录（~/.openpencil/studio/，同 id 覆盖内置） */
export type StudioOrigin = 'builtin' | 'user'

/**
 * 资产声明的按需参考条目（T85 定谳 1，单源——type-shapes 门禁禁同构双写，
 * 测试 fixture 一律 import 此型）。path 存储形态 = 归一后正斜杠相对路径
 * （validate 期反斜杠归一），read_reference 请求侧同口径归一后匹配。
 * 解析基 = 按资产分目录（`<资产文件所在目录>/<资产 id>/`，定谳 2 布局）。
 */
export interface StudioAssetReference {
  /** 相对资产分目录的相对路径（如 `references/imagery.md`）；仅 .md，禁 `..` / 绝对路径 / 盘符 */
  path: string
  /** 非空一行用途描述——assembleTurn 索引注入时随 path 列出 */
  description: string
}

export interface StudioBase {
  kind: 'base'
  id: 'base'
  body: string
  sections: Record<string, string>
  /** 按需参考声明（T85；缺席 = 无） */
  references?: StudioAssetReference[]
  origin: StudioOrigin
  path: string
}

export interface StudioWorkflow {
  kind: 'workflow'
  id: string
  label: string
  subtitle?: string
  stepBudget?: number
  /** 尺寸预设清单（T65：frontmatter `sizes`；首条 = 首选预设；缺席 → 缺省 750 宽 HUG） */
  sizes?: StudioSizePreset[]
  /** 按需参考声明（T85；缺席 = 无） */
  references?: StudioAssetReference[]
  body: string
  sections: Record<string, string>
  origin: StudioOrigin
  path: string
}

export interface StudioProfile {
  kind: 'profile'
  id: string
  label: string
  /** 描述性元信息（gallery 展示用，不构成选择器过滤，PD-17） */
  applicableTo: string[]
  heroComposition?: string
  version?: number
  deprecated: boolean
  /** 按需参考声明（T85；缺席 = 无） */
  references?: StudioAssetReference[]
  body: string
  sections: Record<string, string>
  origin: StudioOrigin
  path: string
}

/** 加载失败显式暴露条目（S2 §8：失败文件 + 原因 + 修复指引） */
export interface StudioFailure {
  /** 相对 origin 目录的相对路径（base 双源同缺时为 `base.md`、整体态为 `.`）——
   *  绝对路径不进注册表，manifest 投影因此天然脱敏（T45，T24 D7 信任边界延伸） */
  path: string
  /** 失败文件来源；base 双源同缺等无单一来源时缺省 */
  origin?: StudioOrigin
  kind: StudioAssetKind | 'studio'
  reason: string
  hint: string
}

/** mode 投影（PD-16：文件存在 = mode 可用；general 为无文件的内置特例） */
export interface StudioMode {
  id: string
  label: string
  subtitle?: string
  /** workflow 来源 mode 透传 frontmatter sizes（T65）；general 无此字段（消费侧走缺省 750 宽 HUG） */
  sizes?: StudioSizePreset[]
  source: 'general' | 'workflow'
}

export interface StudioRegistry {
  base: StudioBase | null
  workflows: ReadonlyMap<string, StudioWorkflow>
  profiles: ReadonlyMap<string, StudioProfile>
  /** general 恒在 + 每个成功注册的 workflow 派生一个 mode */
  modes: StudioMode[]
  failures: StudioFailure[]
  /**
   * T85 内部面（registry 加载期填充，供 read_reference 允许集解析）：
   * 桶键 `${kind}:${id}`（`base:base` / `workflow:<id>` / `profile:<id>`）→
   * 声明 path → 存在性已检的解析绝对路径。**绝对路径不进 manifest 投影**
   * （T45 脱敏纪律延伸，同 failures.path 相对路径口径——manifest.ts 不读本字段）。
   */
  resolvedReferences: ReadonlyMap<string, ReadonlyMap<string, string>>
}

/** resolvedReferences 桶键（T85；registry 写入侧与 assembleTurn 消费侧共用单源） */
export function referenceBucketKey(kind: StudioAssetKind, id: string): string {
  return `${kind}:${id}`
}

/**
 * T43（S4 W1 / T-A1）studio 资产文件机制——契约类型。
 *
 * 三类资产（base / workflow / profile）统一「文件即资产」：一个资产 = 一个
 * markdown 文件（frontmatter 元数据 + 正文）。规格真源见仓外
 * doc/S2-asset-files-spec.md v2（§1 机制总览 / §2 目录布局 / §8 加载失败纪律）。
 *
 * 正文小节索引口径（parse.ts 产出，validate 与后续组装共用单源）：
 * `## X` 与 `### X` 标题均入索引，节内容 = 标题行之后到下一个标题（任意级）之间的文本。
 */

export type StudioAssetKind = 'base' | 'workflow' | 'profile'

/** 资产来源：内置集（随应用分发）或用户目录（~/.openpencil/studio/，同 id 覆盖内置） */
export type StudioOrigin = 'builtin' | 'user'

/** workflow frontmatter 的 type 条目（PD-17：type 折叠进 workflow 文件） */
export interface StudioWorkflowType {
  id: string
  label: string
  /** 'WxH' 固定尺寸 或 'Wx'（HUG 自适应高），S2 §4 */
  size: string
  safeArea?: string
}

export interface StudioBase {
  kind: 'base'
  id: 'base'
  body: string
  sections: Record<string, string>
  origin: StudioOrigin
  path: string
}

export interface StudioWorkflow {
  kind: 'workflow'
  id: string
  label: string
  subtitle?: string
  stepBudget?: number
  /** 'none' = 无 type 的 mode（如创意生图）；否则为 type 列表（S2 §4 必填） */
  types: 'none' | StudioWorkflowType[]
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
  body: string
  sections: Record<string, string>
  origin: StudioOrigin
  path: string
}

/** 加载失败显式暴露条目（S2 §8：失败文件 + 原因 + 修复指引） */
export interface StudioFailure {
  path: string
  kind: StudioAssetKind | 'studio'
  reason: string
  hint: string
}

/** mode 投影（PD-16：文件存在 = mode 可用；general 为无文件的内置特例） */
export interface StudioMode {
  id: string
  label: string
  subtitle?: string
  source: 'general' | 'workflow'
}

export interface StudioRegistry {
  base: StudioBase | null
  workflows: ReadonlyMap<string, StudioWorkflow>
  profiles: ReadonlyMap<string, StudioProfile>
  /** general 恒在 + 每个成功注册的 workflow 派生一个 mode */
  modes: StudioMode[]
  failures: StudioFailure[]
}

/**
 * T45（S4 W1 / T-A3）studio manifest 契约 + 投影（type 单源，前后端
 * `import type` 共用，同 chat-mode.ts 先例——type-shapes 门禁禁止同构重复定义）。
 *
 * GET /api/pi/studio/manifest 的响应形状（T45 由 T24 brand 端点更名改源而来，
 * brand/ 目录同批退役）。信任边界（T24 D7 延伸）：profile 正文不下发前端；
 * failures 的 path 在注册表内已是相对 origin 目录的相对路径（registry.ts），
 * 绝对路径不出后端进程。
 */

import type { StudioFailure, StudioMode, StudioRegistry } from './types'

/** mode 条目：general 恒在首位 + 每注册 workflow 一条（T62：types 数据面删除；
 *  形状与 StudioMode 全等 → 别名不双写（type-shapes 门禁）） */
export type PiStudioModeEntry = StudioMode

/** profile 摘要（gallery 展示用；applicableTo 为描述性元信息，PD-17 不构成过滤） */
export type PiStudioProfileSummary = {
  id: string
  label: string
  applicableTo: string[]
}

/** 加载失败条目（S2 §8 显式暴露数据面；path 相对 origin 目录） */
export type PiStudioFailureEntry = {
  origin?: 'builtin' | 'user'
  path: string
  kind: StudioFailure['kind']
  reason: string
  hint: string
}

export type PiStudioManifest = {
  modes: PiStudioModeEntry[]
  profiles: PiStudioProfileSummary[]
  failures: PiStudioFailureEntry[]
}

/**
 * registry → manifest 脱敏投影（纯函数）。
 * deprecated profile 不进选择器数据面（deprecated 语义即「不展示」，S2 §5 字段）；
 * 其文件仍注册在案，failures 之外不另行报告。
 */
export function toStudioManifest(registry: StudioRegistry): PiStudioManifest {
  const modes: PiStudioModeEntry[] = registry.modes.map((mode) => ({
    id: mode.id,
    label: mode.label,
    ...(mode.subtitle ? { subtitle: mode.subtitle } : {}),
    source: mode.source
  }))
  const profiles: PiStudioProfileSummary[] = [...registry.profiles.values()]
    .filter((p) => !p.deprecated)
    .map((p) => ({ id: p.id, label: p.label, applicableTo: p.applicableTo }))
  const failures: PiStudioFailureEntry[] = registry.failures.map((f) => ({
    ...(f.origin ? { origin: f.origin } : {}),
    path: f.path,
    kind: f.kind,
    reason: f.reason,
    hint: f.hint
  }))
  return { modes, profiles, failures }
}

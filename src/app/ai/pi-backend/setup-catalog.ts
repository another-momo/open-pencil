/**
 * T53（S4 W2/T-B2）：setup_design 的 schema 外注入缝。
 *
 * mode/profile 注册表仅后端进程可达（studio/registry.ts 走 node:fs），而
 * fork 工具在浏览器桥端执行——数据层 ≠ 执行层。裁决（T53-plan §1 定谳 1/2）：
 * 注册表投影（catalog）+ 新建意图确认旗标作为调用级参数经桥 args 外层注入
 * （T22 document_id 先例，tools.ts），不进工具 schema、不进模型视野。
 *
 * confirmedNewIntent 的真源通道 = T61（T-B10）UI 指令块；落地前恒 false，
 * setup_design 对 AI 恒返回 unconfirmed_new_intent（S3 §2 契约内行为，
 * S4 §7 尾巴表已登记该依赖）。
 *
 * T62：type 机制删除——投影收为 {modes:[{id,label}], profileIds[]}（尺寸
 * 语义重钉为 workflow frontmatter 可选 canvas 键，core 侧恒用缺省）。
 *
 * T65（owner 2026-09-01 拍板 C）：modes[] 条目带 `sizes: [{label, canvas}]`
 * 尺寸预设清单（workflow frontmatter 透传，首条 = 首选预设）——catalogJSON
 * 注入后 AI 据此按语义选尺寸（setup_design 可选 canvas 参数覆盖，core 侧
 * 优先序：显式 canvas > 首选预设 > 750 宽 HUG 缺省）。
 */

import type { SetupCatalog } from '@open-pencil/core/tools/fork/marketing/setup'

import type { StudioRegistry } from './studio/types'

/**
 * catalog 投影形状 = core SetupCatalog（消费侧契约单源——别名不双写，
 * type-shapes 门禁；见 packages/core/src/tools/fork/marketing/setup.ts）。
 */
export type SetupCatalogProjection = SetupCatalog

/**
 * 注册表 → catalog 投影。只列 workflow 来源 mode（general 是无文件内置特例，
 * core 侧恒过处理）；profileId 校验口径 = 「在注册表内」（含 deprecated——
 * 选择器过滤是 UI 面职责，校验只认注册事实）。
 */
export function buildSetupCatalog(registry: StudioRegistry): SetupCatalogProjection {
  const modes = [...registry.workflows.values()].map((workflow) => ({
    id: workflow.id,
    label: workflow.label,
    ...(workflow.sizes ? { sizes: workflow.sizes } : {})
  }))
  return { modes, profileIds: [...registry.profiles.keys()] }
}

/** 工具执行期注入源（service 每 session 闭包提供；tools.ts 仅在 setup_design 调用时读取） */
export interface SetupDesignContext {
  /** 注册表投影 JSON 字符串；不可用（注册表加载失败等）时 undefined → core 走 catalog-less 语义 */
  catalogJSON(): string | undefined
  /** 新建意图确认旗标（T61 UI 指令块落地前恒 false） */
  newIntentConfirmed(): boolean
}

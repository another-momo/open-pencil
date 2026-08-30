/**
 * T43 studio 机制——按类加载期校验（lint）。
 *
 * 规格真源：doc/S2-asset-files-spec.md v2 §3（base）/ §4（workflow，type 蓝图
 * 必填体节）/ §5（profile 必需小节 / applicable_to 引用完整性 / hex / 字体白名单）。
 * 校验失败 = 该文件不注册 + failure 进注册表 failures（S2 §8），本模块只产出
 * 失败原因与修复指引文案，不做注册副作用。
 *
 * 字体白名单经 core 字体注册表（T39 建成）结构性校验——`fontRegistryEntry`
 * 未命中即失败（2026-08-30 实测 `@open-pencil/core/text` 静态 import 无副作用，
 * T43-plan §6 风险行排除）。
 */

import { fontRegistryEntry } from '@open-pencil/core/text'

import { isAssetId, type ParsedAsset } from './parse'
import type { StudioWorkflowType } from './types'

export interface ValidationIssue {
  reason: string
  hint: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function stringField(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

/** 通用：id/label 与「id = 文件名」一致性强校验（S2 §2 id 规则；T43-plan D-d①） */
export function validateCommon(
  fm: Record<string, unknown>,
  filenameId: string,
  kindLabel: string
): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  const id = stringField(fm.id)
  if (!id) {
    issues.push({ reason: 'frontmatter 缺 `id`', hint: `补 \`id: ${filenameId}\`` })
  } else if (id !== filenameId) {
    issues.push({
      reason: `frontmatter id「${id}」与文件名「${filenameId}」不一致`,
      hint: 'id 必须与文件名（去 .md）一致——覆盖与引用都以它为准'
    })
  } else if (!isAssetId(id)) {
    issues.push({
      reason: `id「${id}」不是合法机读 id`,
      hint: 'id 只允许小写字母/数字/连字符/下划线（如 `watercolor_poster_v3` 或 `longform`）'
    })
  }
  if (!stringField(fm.label)) {
    issues.push({ reason: 'frontmatter 缺 `label`', hint: `补 \`label: <${kindLabel}显示名>\`` })
  }
  return issues
}

const SIZE_RE = /^\d+x\d*$/

type WorkflowTypeParse =
  | { ok: true; type: StudioWorkflowType }
  | { ok: false; issue: ValidationIssue }

function parseWorkflowType(value: unknown): WorkflowTypeParse {
  if (!isRecord(value)) {
    return {
      ok: false,
      issue: {
        reason: 'types 条目不是 map',
        hint: '每条形如 `- id: xxx\\n  label: xxx\\n  size: 750x`'
      }
    }
  }
  const id = stringField(value.id)
  const label = stringField(value.label)
  const size = stringField(value.size)
  if (!id || !label) {
    return {
      ok: false,
      issue: { reason: 'types 条目缺 id/label', hint: '每个 type 必须有 id 与 label' }
    }
  }
  if (!isAssetId(id)) {
    return {
      ok: false,
      issue: {
        reason: `type id「${id}」不是合法机读 id`,
        hint: '改用小写字母/数字/连字符/下划线（如 `ecommerce_detail`）'
      }
    }
  }
  if (!size || !SIZE_RE.test(size)) {
    return {
      ok: false,
      issue: {
        reason: `type「${id}」的 size「${size ?? ''}」不合法`,
        hint: 'size 取 `宽x高`（固定，如 750x1334）或 `宽x`（HUG 自适应高，如 750x）'
      }
    }
  }
  const safeArea = stringField(value.safeArea)
  return { ok: true, type: { id, label, size, ...(safeArea ? { safeArea } : {}) } }
}

/**
 * workflow 校验：types 必填（列表或 `none`）；列表每 type 需 id/label/size 合法，
 * 且正文存在同名（三级节）蓝图节且非空（S2 §4 必填体节）；step_budget 若存在须正整数。
 */
export function validateWorkflow(
  parsed: ParsedAsset & { ok: true },
  filenameId: string
): {
  issues: ValidationIssue[]
  types: 'none' | StudioWorkflowType[]
  stepBudget?: number
  subtitle?: string
} {
  const { frontmatter: fm, sections } = parsed
  const issues = validateCommon(fm, filenameId, 'mode')

  let types: 'none' | StudioWorkflowType[] = 'none'
  if (!('types' in fm)) {
    issues.push({
      reason: 'frontmatter 缺 `types`',
      hint: '无 type 的 mode 写 `types: none`；否则列 type 清单（id/label/size）'
    })
  } else if (fm.types === 'none') {
    types = 'none'
  } else if (Array.isArray(fm.types)) {
    const seen = new Set<string>()
    const list: StudioWorkflowType[] = []
    for (const entry of fm.types) {
      const parsedType = parseWorkflowType(entry)
      if (!parsedType.ok) {
        issues.push(parsedType.issue)
        continue
      }
      const type = parsedType.type
      if (seen.has(type.id)) {
        issues.push({ reason: `type id「${type.id}」重复`, hint: 'type id 在 mode 内唯一' })
        continue
      }
      seen.add(type.id)
      list.push(type)
      // S2 §4：type 的真正载荷是结构蓝图——必填体节，防空心化成纯尺寸表
      if (!Object.hasOwn(sections, type.id)) {
        issues.push({
          reason: `type「${type.id}」缺同名正文蓝图节`,
          hint: `在 \`## type 蓝图\` 下补 \`### ${type.id}\` 小节（结构蓝图：分区章节序 + 每节内容要求）`
        })
      } else if (!sections[type.id]) {
        issues.push({
          reason: `type「${type.id}」的蓝图节为空`,
          hint: '蓝图节必须非空（章节序 + 每节内容要求；平台约束可选）'
        })
      }
    }
    types = list
  } else {
    issues.push({
      reason: '`types` 既不是列表也不是 `none`',
      hint: '写 `types: none` 或 YAML 列表（外部目录形态 `types: dir:...` 为 v1 不实现的预留，PD-17）'
    })
  }

  let stepBudget: number | undefined
  if ('step_budget' in fm) {
    const raw = fm.step_budget
    if (typeof raw === 'number' && Number.isInteger(raw) && raw > 0) {
      stepBudget = raw
    } else {
      issues.push({
        reason: '`step_budget` 不是正整数',
        hint: '写正整数（如 `step_budget: 50`）或删除该字段'
      })
    }
  }

  return { issues, types, stepBudget, subtitle: stringField(fm.subtitle) }
}

/** profile 必需小节（S2 §5；节空但显式写 `no-op` 合法——09 §C-1 空节矛盾的解法） */
export const PROFILE_REQUIRED_SECTIONS = [
  'Fixed system',
  'Variable system',
  'Anti-identity',
  'Tone',
  'Recipe'
] as const

/**
 * 非法 hex 侦测（v1 启发式，宁可漏报不可误报）：
 * - 长度 5/7 且全 hex 字符（几乎必然是写坏的色值，如 #12345）；
 * - 长度 6/8 但混有非 hex 字符（如 #ff00gg）。
 * 短 token（<5 字符，如「#1」编号）不报，防误伤正文编号。
 */
const HEX_CANDIDATE_RE = /#([0-9a-zA-Z]{5,8})\b/g
const PURE_HEX_RE = /^[0-9a-fA-F]+$/

function findInvalidHex(text: string): string[] {
  const bad: string[] = []
  for (const m of text.matchAll(HEX_CANDIDATE_RE)) {
    const token = m[0]
    const body = m[1]
    if ((body.length === 5 || body.length === 7) && PURE_HEX_RE.test(body)) bad.push(token)
    else if ((body.length === 6 || body.length === 8) && !PURE_HEX_RE.test(body)) bad.push(token)
  }
  return [...new Set(bad)]
}

/** frontmatter 中疑似字体字段（键名含 font/lettering/pairing）的取值收集 */
function collectFontRefs(fm: Record<string, unknown>): string[] {
  const out: string[] = []
  for (const [key, value] of Object.entries(fm)) {
    if (!/font|lettering|pairing/i.test(key)) continue
    if (typeof value === 'string') out.push(value)
    else if (Array.isArray(value)) {
      for (const entry of value) if (typeof entry === 'string') out.push(entry)
    }
  }
  return out
}

/**
 * profile 校验：必需小节非空或显式 `no-op`；applicable_to 引用完整性（引用的
 * mode 必须存在于注册表或为 general，PD-16）；非法 hex；字体白名单（注册表命中）。
 *
 * `knownModeIds` 由 registry 在 workflow 注册完成后传入（含 general）。
 */
export function validateProfile(
  parsed: ParsedAsset & { ok: true },
  filenameId: string,
  knownModeIds: ReadonlySet<string>
): {
  issues: ValidationIssue[]
  applicableTo: string[]
  heroComposition?: string
  version?: number
  deprecated: boolean
} {
  const { frontmatter: fm, sections, body } = parsed
  const issues = validateCommon(fm, filenameId, 'profile')

  for (const name of PROFILE_REQUIRED_SECTIONS) {
    if (!Object.hasOwn(sections, name)) {
      issues.push({
        reason: `缺必需小节 \`## ${name}\``,
        hint: `补 \`## ${name}\` 小节；确无内容时节内写 \`no-op\`（显式空节，S2 §5）`
      })
    } else if (!sections[name]) {
      issues.push({
        reason: `必需小节 \`## ${name}\` 为空`,
        hint: '填入内容，或节内写 `no-op` 显式声明空节'
      })
    }
  }

  let applicableTo: string[] = []
  if ('applicable_to' in fm) {
    if (!Array.isArray(fm.applicable_to) || fm.applicable_to.some((v) => typeof v !== 'string')) {
      issues.push({
        reason: '`applicable_to` 不是字符串列表',
        hint: '形如 `applicable_to: [longform]`'
      })
    } else {
      applicableTo = fm.applicable_to as string[]
      for (const modeId of applicableTo) {
        if (!knownModeIds.has(modeId)) {
          issues.push({
            reason: `applicable_to 引用了不存在的 mode「${modeId}」`,
            hint: 'mode id = workflows/ 下的文件名（或 general）；检查拼写，或先补对应 workflow 文件'
          })
        }
      }
    }
  }

  for (const token of findInvalidHex(`${body}\n${JSON.stringify(fm)}`)) {
    issues.push({
      reason: `疑似非法 hex 色值「${token}」`,
      hint: 'hex 合法长度为 3/4/6/8 位且仅含 0-9a-f；修辞性色相描述不受影响（PD-4）'
    })
  }

  for (const family of collectFontRefs(fm)) {
    if (!fontRegistryEntry(family)) {
      issues.push({
        reason: `字体「${family}」不在字体注册表白名单`,
        hint: '家族须存在于字体注册表（T39 机制，T0/T1 授权 tier）；改用注册表内家族或先登记'
      })
    }
  }

  let version: number | undefined
  if ('version' in fm) {
    if (typeof fm.version === 'number' && Number.isInteger(fm.version) && fm.version > 0)
      version = fm.version
    else
      issues.push({
        reason: '`version` 不是正整数',
        hint: '写正整数（如 `version: 3`）或删除该字段'
      })
  }

  return {
    issues,
    applicableTo,
    heroComposition: stringField(fm.hero_composition),
    version,
    deprecated: fm.deprecated === true
  }
}

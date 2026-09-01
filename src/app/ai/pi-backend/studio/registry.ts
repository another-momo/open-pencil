/**
 * T43 studio 机制——两源扫描 / 同 id 覆盖 / 注册表 / reload。
 *
 * 规格真源：doc/S2-asset-files-spec.md v2 §1（机制总览）/ §2（目录与文件布局）/
 * §8（加载失败与空态）。加载顺序：内置 → 用户目录覆盖 → 校验 → 注册表（内存）。
 * 热重载 v1 降级为显式 `reloadStudio()`（S2 §2 授权；fs.watch 不做，T43-plan D-c）。
 *
 * 路径约定：调用方注入 rootDir（仓库根），内置目录 =
 * `<rootDir>/src/app/ai/pi-backend/studio/`；用户目录 = `~/.openpencil/studio/`
 * （rootDir 注入模型与 service.ts 一致，T24 起在线）。
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

import { splitFrontmatter, type ParsedAsset } from './parse'
import type {
  StudioBase,
  StudioFailure,
  StudioMode,
  StudioOrigin,
  StudioProfile,
  StudioRegistry,
  StudioWorkflow
} from './types'
import { validateProfile, validateWorkflow } from './validate'

const BUILTIN_STUDIO_SUBPATH = join('src', 'app', 'ai', 'pi-backend', 'studio')
const USER_STUDIO_SUBPATH = join('.openpencil', 'studio')

interface Candidate {
  id: string
  origin: StudioOrigin
  path: string
  /** 相对 origin 目录的相对路径，统一正斜杠（failures 数据面用——绝对路径不进注册表，T45；跨平台渲染口径一致） */
  relPath: string
}

function listMarkdownFiles(dir: string): string[] {
  if (!existsSync(dir)) return []
  try {
    return readdirSync(dir, { withFileTypes: true })
      .filter((e) => e.isFile() && e.name.endsWith('.md'))
      .map((e) => e.name)
      .sort()
  } catch {
    return []
  }
}

/** 内置 → 用户顺序收集候选；同 id 用户覆盖内置（S2 §2 分层覆盖） */
function collectCandidates(builtinDir: string, userDir: string, subdir: string): Candidate[] {
  const byId = new Map<string, Candidate>()
  for (const [dir, origin] of [
    [join(builtinDir, subdir), 'builtin'],
    [join(userDir, subdir), 'user']
  ] as const) {
    for (const name of listMarkdownFiles(dir)) {
      const id = name.slice(0, -'.md'.length)
      byId.set(id, {
        id,
        origin,
        path: join(dir, name),
        relPath: join(subdir, name).replaceAll('\\', '/')
      })
    }
  }
  return [...byId.values()]
}

function readAndParse(candidate: Candidate): ParsedAsset {
  let raw: string
  try {
    raw = readFileSync(candidate.path, 'utf8')
  } catch (e) {
    return {
      ok: false,
      reason: `文件读取失败：${e instanceof Error ? e.message : String(e)}`,
      hint: '检查文件权限与编码（须为 utf-8）'
    }
  }
  return splitFrontmatter(raw)
}

function fail(
  failures: StudioFailure[],
  candidate: Candidate | null,
  kind: StudioFailure['kind'],
  reason: string,
  hint: string
): void {
  failures.push({
    path: candidate?.relPath ?? 'base.md',
    ...(candidate ? { origin: candidate.origin } : {}),
    kind,
    reason,
    hint
  })
}

/** base 唯一槽位：用户覆盖内置；双源皆缺 → 显式缺失态（S2 §8） */
function loadBase(
  builtinDir: string,
  userDir: string,
  failures: StudioFailure[]
): StudioBase | null {
  const baseCandidates = [
    {
      id: 'base',
      origin: 'builtin' as const,
      path: join(builtinDir, 'base.md'),
      relPath: 'base.md'
    },
    { id: 'base', origin: 'user' as const, path: join(userDir, 'base.md'), relPath: 'base.md' }
  ].filter((c) => existsSync(c.path))
  const baseCandidate = baseCandidates.at(-1) // 用户覆盖内置
  if (!baseCandidate) {
    fail(
      failures,
      null,
      'base',
      'base.md 缺失（内置集与用户目录均无）',
      'base 是所有 mode 共享的行为基座（每回合必组装，S2 §3）——补 `studio/base.md`'
    )
    return null
  }
  const parsed = readAndParse(baseCandidate)
  if (!parsed.ok) {
    fail(failures, baseCandidate, 'base', parsed.reason, parsed.hint)
    return null
  }
  if (parsed.frontmatter.id !== undefined && parsed.frontmatter.id !== 'base') {
    fail(
      failures,
      baseCandidate,
      'base',
      'base.md 的 frontmatter id 不是 `base`',
      'base 全局唯一：写 `id: base` 或删除 id 字段'
    )
    return null
  }
  return {
    kind: 'base',
    id: 'base',
    body: parsed.body,
    sections: parsed.sections,
    origin: baseCandidate.origin,
    path: baseCandidate.path
  }
}

/** workflows 先于 profiles 校验：applicable_to 引用完整性需要已注册 mode 集合 */
function loadWorkflows(
  builtinDir: string,
  userDir: string,
  failures: StudioFailure[]
): Map<string, StudioWorkflow> {
  const workflows = new Map<string, StudioWorkflow>()
  for (const candidate of collectCandidates(builtinDir, userDir, 'workflows')) {
    const parsed = readAndParse(candidate)
    if (!parsed.ok) {
      fail(failures, candidate, 'workflow', parsed.reason, parsed.hint)
      continue
    }
    const { issues, stepBudget, subtitle, sizes } = validateWorkflow(parsed, candidate.id)
    if (issues.length > 0) {
      for (const issue of issues) fail(failures, candidate, 'workflow', issue.reason, issue.hint)
      continue
    }
    workflows.set(candidate.id, {
      kind: 'workflow',
      id: candidate.id,
      label: String(parsed.frontmatter.label),
      ...(subtitle ? { subtitle } : {}),
      ...(stepBudget !== undefined ? { stepBudget } : {}),
      ...(sizes ? { sizes } : {}),
      body: parsed.body,
      sections: parsed.sections,
      origin: candidate.origin,
      path: candidate.path
    })
  }
  return workflows
}

function loadProfiles(
  builtinDir: string,
  userDir: string,
  knownModeIds: ReadonlySet<string>,
  failures: StudioFailure[]
): Map<string, StudioProfile> {
  const profiles = new Map<string, StudioProfile>()
  for (const candidate of collectCandidates(builtinDir, userDir, 'profiles')) {
    const parsed = readAndParse(candidate)
    if (!parsed.ok) {
      fail(failures, candidate, 'profile', parsed.reason, parsed.hint)
      continue
    }
    const { issues, applicableTo, heroComposition, version, deprecated } = validateProfile(
      parsed,
      candidate.id,
      knownModeIds
    )
    if (issues.length > 0) {
      for (const issue of issues) fail(failures, candidate, 'profile', issue.reason, issue.hint)
      continue
    }
    profiles.set(candidate.id, {
      kind: 'profile',
      id: candidate.id,
      label: String(parsed.frontmatter.label),
      applicableTo,
      ...(heroComposition ? { heroComposition } : {}),
      ...(version !== undefined ? { version } : {}),
      deprecated,
      body: parsed.body,
      sections: parsed.sections,
      origin: candidate.origin,
      path: candidate.path
    })
  }
  return profiles
}

/**
 * 纯函数加载：给定内置/用户两目录，产出完整注册表（含 failures）。
 * 测试经本函数注入 fixture 目录，不依赖真实文件布局。
 */
export function loadStudioFromDirs(builtinDir: string, userDir: string): StudioRegistry {
  const failures: StudioFailure[] = []
  const base = loadBase(builtinDir, userDir, failures)
  const workflows = loadWorkflows(builtinDir, userDir, failures)
  const knownModeIds = new Set<string>(['general', ...workflows.keys()])
  const profiles = loadProfiles(builtinDir, userDir, knownModeIds, failures)

  // ── mode 投影（PD-16：文件存在 = mode 可用；general 恒在内置特例，S2 §2）──
  const modes: StudioMode[] = [
    { id: 'general', label: '通用设计', source: 'general' },
    ...[...workflows.values()].map((w) => ({
      id: w.id,
      label: w.label,
      ...(w.subtitle ? { subtitle: w.subtitle } : {}),
      ...(w.sizes ? { sizes: w.sizes } : {}),
      source: 'workflow' as const
    }))
  ]

  // 默认集整体缺失/全坏（S2 §8）：零注册成功且有失败 → 记整体态供错误条消费
  if (base === null && workflows.size === 0 && profiles.size === 0 && failures.length > 0) {
    failures.push({
      path: '.',
      origin: 'builtin',
      kind: 'studio',
      reason: 'studio 默认集整体缺失/全坏（无任何资产注册成功）',
      hint: '检查内置 studio/ 目录是否随应用分发；逐条修复上方文件级失败后重新加载'
    })
  }

  return { base, workflows, profiles, modes, failures }
}

// ── 进程级单例（启动加载 + 显式 reload；T43-plan D-c：fs.watch 不做）──

let current: StudioRegistry | null = null
let currentKey: string | null = null

function defaultDirs(rootDir: string): { builtinDir: string; userDir: string } {
  return {
    builtinDir: join(rootDir, BUILTIN_STUDIO_SUBPATH),
    userDir: join(homedir(), USER_STUDIO_SUBPATH)
  }
}

/** 启动/重载加载（幂等）；rootDir = 仓库根（与 service.ts 的 rootDir 约定一致） */
export function reloadStudio(rootDir: string): StudioRegistry {
  const { builtinDir, userDir } = defaultDirs(rootDir)
  current = loadStudioFromDirs(builtinDir, userDir)
  currentKey = `${builtinDir}|${userDir}`
  return current
}

/**
 * 读当前注册表。未加载时按 rootDir 惰性加载一次；rootDir 缺省且从未加载 →
 * 抛错（调用方必须先经 reloadStudio(rootDir) 初始化——与 service 启动序一致）。
 */
export function getStudioRegistry(rootDir?: string): StudioRegistry {
  if (rootDir) {
    const { builtinDir, userDir } = defaultDirs(rootDir)
    const key = `${builtinDir}|${userDir}`
    if (current === null || currentKey !== key) return reloadStudio(rootDir)
    return current
  }
  if (current === null) {
    throw new Error('studio 注册表未初始化——先经 reloadStudio(rootDir) 加载')
  }
  return current
}

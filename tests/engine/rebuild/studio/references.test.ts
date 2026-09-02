/**
 * T85（资产 references 按需读取机制）registry/validate 侧单测。
 *
 * 验收映射（T85-plan §3.8）：references 解析/校验矩阵（合法 + `..` + 绝对 +
 * 缺文件 + 空 description）+ 扫描器不吞 references 钉扎（定谳 2 布局：
 * `workflows/<id>/references/*.md` 永不被当 workflow 注册）+ 分层覆盖下
 * 用户目录 references 解析到用户侧。全程 tmp fixture 目录，不依赖真实内置资产。
 */

import { afterEach, beforeEach, expect, test } from 'bun:test'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { loadStudioFromDirs, type StudioRegistry } from '@/app/ai/pi-backend/studio'

let builtinDir = ''
let userDir = ''

beforeEach(() => {
  builtinDir = mkdtempSync(join(tmpdir(), 'studio-builtin-'))
  userDir = mkdtempSync(join(tmpdir(), 'studio-user-'))
})

afterEach(() => {
  rmSync(builtinDir, { recursive: true, force: true })
  rmSync(userDir, { recursive: true, force: true })
})

function put(root: string, rel: string, content: string): void {
  const abs = join(root, rel)
  mkdirSync(join(abs, '..'), { recursive: true })
  writeFileSync(abs, content, 'utf8')
}

const BASE_MD = `---
id: base
---

## 红线

事实零虚构。
`

/** workflow fixture 工厂：references YAML 段可换（缺省 = 合法两条） */
function workflowMd(referencesYaml = REFS_YAML): string {
  return `---
id: editable-design
label: 海报设计
${referencesYaml}---

## 执行总纲

一段式构建流。
`
}

const REFS_YAML = `references:
  - path: references/imagery.md
    description: 图像决策纪律
  - path: references/typography.md
    description: 版式排印原则
`

/** 配套 references 文件（按资产分目录布局：workflows/<id>/references/） */
function putWorkflowRefs(
  root: string,
  files: Record<string, string> = {
    'references/imagery.md': '# 图像\n',
    'references/typography.md': '# 版式\n'
  }
): void {
  for (const [rel, content] of Object.entries(files)) {
    put(root, join('workflows', 'editable-design', rel), content)
  }
}

function loadBoth(): StudioRegistry {
  return loadStudioFromDirs(builtinDir, userDir)
}

// ── 合法注册与解析 ──────────────────────────────────────────────────────────

test('合法 references：注册 + 解析绝对路径进 resolvedReferences 桶（绝对路径不进资产投影面）', () => {
  put(builtinDir, 'base.md', BASE_MD)
  put(builtinDir, join('workflows', 'editable-design.md'), workflowMd())
  putWorkflowRefs(builtinDir)
  const r = loadBoth()
  expect(r.failures).toEqual([])
  const w = r.workflows.get('editable-design')
  expect(w?.references).toEqual([
    { path: 'references/imagery.md', description: '图像决策纪律' },
    { path: 'references/typography.md', description: '版式排印原则' }
  ])
  const bucket = r.resolvedReferences.get('workflow:editable-design')
  expect(bucket?.size).toBe(2)
  const abs = bucket?.get('references/imagery.md')
  expect(abs).toBe(join(builtinDir, 'workflows', 'editable-design', 'references', 'imagery.md'))
})

test('base 与 profile 同机制（三类统一）', () => {
  put(
    builtinDir,
    'base.md',
    BASE_MD.replace(
      '---\n\n## 红线',
      'references:\n  - path: references/house.md\n    description: 团队纪律\n---\n\n## 红线'
    )
  )
  put(builtinDir, join('base', 'references', 'house.md'), '# 团队纪律\n')
  put(builtinDir, join('workflows', 'editable-design.md'), workflowMd())
  putWorkflowRefs(builtinDir)
  put(
    builtinDir,
    join('profiles', 'watercolor.md'),
    `---
id: watercolor
label: 水彩
applicable_to: [editable-design]
references:
  - path: references/recipe.md
    description: 配方细节
---

## Fixed system

固定。

## Variable system

可变。

## Anti-identity

不做。

## Tone

克制。

## Recipe

配方。
`
  )
  put(builtinDir, join('profiles', 'watercolor', 'references', 'recipe.md'), '# 配方\n')
  const r = loadBoth()
  expect(r.failures).toEqual([])
  expect(r.base?.references?.[0].path).toBe('references/house.md')
  expect(r.resolvedReferences.get('base:base')?.get('references/house.md')).toBe(
    join(builtinDir, 'base', 'references', 'house.md')
  )
  expect(r.profiles.get('watercolor')?.references?.[0].description).toBe('配方细节')
  expect(r.resolvedReferences.get('profile:watercolor')?.size).toBe(1)
})

test('反斜杠 path 归一为正斜杠存储与解析（\\ → /）', () => {
  put(builtinDir, 'base.md', BASE_MD)
  put(
    builtinDir,
    join('workflows', 'editable-design.md'),
    workflowMd('references:\n  - path: references\\imagery.md\n    description: 图像决策纪律\n')
  )
  putWorkflowRefs(builtinDir, { 'references/imagery.md': '# 图像\n' })
  const r = loadBoth()
  expect(r.failures).toEqual([])
  expect(r.workflows.get('editable-design')?.references).toEqual([
    { path: 'references/imagery.md', description: '图像决策纪律' }
  ])
  expect(r.resolvedReferences.get('workflow:editable-design')?.has('references/imagery.md')).toBe(
    true
  )
})

// ── 校验矩阵（病态 → 整条不注册 + failure 带指引）─────────────────────────────

test('references 非清单 / 空清单 / 非键值条目 → workflow 不注册', () => {
  put(builtinDir, 'base.md', BASE_MD)
  for (const bad of [
    'references: references/imagery.md',
    'references: []',
    'references:\n  - references/imagery.md'
  ]) {
    put(builtinDir, join('workflows', 'editable-design.md'), workflowMd(`${bad}\n`))
    const r = loadBoth()
    expect(r.workflows.size).toBe(0)
    expect(r.failures.some((f) => f.reason.includes('`references`'))).toBe(true)
  }
})

test('references 条目级非法：`..` 上跳 / 绝对路径 / 盘符 / 非 .md → 不注册', () => {
  put(builtinDir, 'base.md', BASE_MD)
  const cases: Array<[string, string]> = [
    ['../escape.md', '`..` 上跳'],
    ['references/../../escape.md', '`..` 上跳'],
    ['/abs/imagery.md', '绝对路径'],
    ['C:\\abs\\imagery.md', '盘符'],
    ['references/imagery.txt', '不是 .md']
  ]
  for (const [path, needle] of cases) {
    put(
      builtinDir,
      join('workflows', 'editable-design.md'),
      workflowMd(`references:\n  - path: ${path}\n    description: 描述\n`)
    )
    const r = loadBoth()
    expect(r.workflows.size).toBe(0)
    const f = r.failures.find((x) => x.reason.includes('references'))
    expect(f?.reason.includes(needle)).toBe(true)
    expect(f?.hint.length).toBeGreaterThan(0)
  }
})

test('references 条目缺/空 description 或缺/空 path → 不注册', () => {
  put(builtinDir, 'base.md', BASE_MD)
  const cases = [
    'references:\n  - path: references/imagery.md\n',
    'references:\n  - path: references/imagery.md\n    description: ""\n',
    'references:\n  - description: 只有描述\n',
    'references:\n  - path: ""\n    description: 描述\n'
  ]
  for (const bad of cases) {
    put(builtinDir, join('workflows', 'editable-design.md'), workflowMd(bad))
    const r = loadBoth()
    expect(r.workflows.size).toBe(0)
    expect(
      r.failures.some((f) => f.reason.includes('description') || f.reason.includes('path'))
    ).toBe(true)
  }
})

test('references 病态连坐 profile 不注册（validate 口径三类一致）', () => {
  put(builtinDir, 'base.md', BASE_MD)
  put(
    builtinDir,
    join('profiles', 'watercolor.md'),
    `---
id: watercolor
label: 水彩
references:
  - path: ../escape.md
    description: 逃逸
---

## Fixed system

固定。

## Variable system

可变。

## Anti-identity

不做。

## Tone

克制。

## Recipe

配方。
`
  )
  const r = loadBoth()
  expect(r.profiles.size).toBe(0)
  expect(r.failures.some((f) => f.kind === 'profile' && f.reason.includes('`..` 上跳'))).toBe(true)
})

// ── 加载期存在性检查（缺失不连坐资产本体）─────────────────────────────────────

test('缺文件：条目摘出 + failures 显式条目（资产仍注册）；全部缺失 → references 字段缺席', () => {
  put(builtinDir, 'base.md', BASE_MD)
  put(builtinDir, join('workflows', 'editable-design.md'), workflowMd())
  // 只补 imagery，typography 缺失
  putWorkflowRefs(builtinDir, { 'references/imagery.md': '# 图像\n' })
  let r = loadBoth()
  const w = r.workflows.get('editable-design')
  expect(w?.references).toEqual([{ path: 'references/imagery.md', description: '图像决策纪律' }])
  const f = r.failures.find((x) => x.reason.includes('references/typography.md'))
  expect(f?.reason.includes('文件不存在')).toBe(true)
  expect(f?.hint.length).toBeGreaterThan(0)
  expect(f?.path).toBe('workflows/editable-design.md') // 相对路径口径（绝对路径不进注册表）
  expect(r.resolvedReferences.get('workflow:editable-design')?.size).toBe(1)
  expect(
    r.resolvedReferences.get('workflow:editable-design')?.has('references/typography.md')
  ).toBe(false)

  // 全部缺失 → 资产注册但无 references 字段、无 resolved 桶
  put(builtinDir, join('workflows', 'editable-design.md'), workflowMd())
  rmSync(join(builtinDir, 'workflows', 'editable-design'), { recursive: true, force: true })
  r = loadBoth()
  expect('references' in (r.workflows.get('editable-design') ?? {})).toBe(false)
  expect(r.resolvedReferences.has('workflow:editable-design')).toBe(false)
  expect(r.failures.filter((x) => x.reason.includes('文件不存在'))).toHaveLength(2)
})

// ── 定谳 2 钉扎：扫描器不吞 references ─────────────────────────────────────

test('扫描器钉扎：workflows/<id>/references/*.md 永不被注册为 workflow（listMarkdownFiles 非递归）', () => {
  put(builtinDir, 'base.md', BASE_MD)
  put(builtinDir, join('workflows', 'editable-design.md'), workflowMd())
  putWorkflowRefs(builtinDir)
  const r = loadBoth()
  expect(r.failures).toEqual([])
  expect([...r.workflows.keys()]).toEqual(['editable-design'])
  expect(r.modes.map((m) => m.id)).toEqual(['general', 'editable-design'])
  // references 目录名与 .md 文件名均不洩进任何资产集合
  expect(r.workflows.has('references')).toBe(false)
  expect(r.workflows.has('imagery')).toBe(false)
})

// ── 分层覆盖：用户侧 references 解析到用户目录 ────────────────────────────────

test('用户目录同 id 覆盖：references 解析到用户侧资产分目录（内置侧文件不参与）', () => {
  put(builtinDir, 'base.md', BASE_MD)
  put(builtinDir, join('workflows', 'editable-design.md'), workflowMd())
  putWorkflowRefs(builtinDir)
  // 用户覆盖版只声明一条 references，文件只在用户侧
  put(
    userDir,
    join('workflows', 'editable-design.md'),
    workflowMd('references:\n  - path: references/custom.md\n    description: 用户版纪律\n')
  )
  put(userDir, join('workflows', 'editable-design', 'references', 'custom.md'), '# 用户版\n')
  const r = loadBoth()
  expect(r.failures).toEqual([])
  expect(r.workflows.get('editable-design')?.references).toEqual([
    { path: 'references/custom.md', description: '用户版纪律' }
  ])
  expect(r.resolvedReferences.get('workflow:editable-design')?.get('references/custom.md')).toBe(
    join(userDir, 'workflows', 'editable-design', 'references', 'custom.md')
  )
})

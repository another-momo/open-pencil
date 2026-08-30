/**
 * T43（S4 W1 / T-A1）studio 资产文件机制内核单测。
 *
 * 验收映射（T43-plan §4）：C1 两源扫描与同 id 覆盖 / C2 解析纪律 / C3 workflow
 * 校验 / C4 profile 校验 / C5 base 唯一性与 general 特例 / C6 reload 幂等与修复路径。
 * 全程 tmp fixture 目录，不依赖真实内置资产（T-A2/A4/A5 前内置目录为空是设计态）。
 */

import { afterEach, beforeEach, expect, test } from 'bun:test'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import {
  getStudioRegistry,
  loadStudioFromDirs,
  reloadStudio,
  type StudioRegistry
} from '@/app/ai/pi-backend/studio'

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
label: 工作守则
---

## 红线

事实零虚构。
`

const LONGFORM_MD = `---
id: longform
label: 长图设计
subtitle: 电商详情 / 产品长文 / 小红书长图
step_budget: 50
types:
  - id: ecommerce_detail
    label: 电商详情页
    size: 750x
---

## 阶段定义

阶段 0-4。

## type 蓝图

### ecommerce_detail

首屏 hero → 卖点分区 → 详情 → 行动区。

## 纪律

Fix Playbook。
`

const PROFILE_MD = `---
id: watercolor-poster-v3
label: 水彩海报 v3
applicable_to: [longform]
hero_composition: center_left_counterweight
version: 3
deprecated: false
latin_pairing: Alibaba PuHuiTi
---

## Fixed system

水彩纸纹 + 手绘笔触。

## Variable system

主色倾向：青蓝 #a0c4e8。

## Anti-identity

不做廉价渐变。

## Tone

克制、留白。

## Recipe

按 longform 分区物化。
`

function loadBoth(): StudioRegistry {
  return loadStudioFromDirs(builtinDir, userDir)
}

// ── C1：两源扫描与同 id 覆盖 ──────────────────────────────────────────────

test('C1: 内置三类资产注册成功，modes 含 general + workflow 派生 mode', () => {
  put(builtinDir, 'base.md', BASE_MD)
  put(builtinDir, join('workflows', 'longform.md'), LONGFORM_MD)
  put(builtinDir, join('profiles', 'watercolor-poster-v3.md'), PROFILE_MD)
  const r = loadBoth()
  expect(r.failures).toEqual([])
  expect(r.base?.origin).toBe('builtin')
  expect(r.workflows.get('longform')?.label).toBe('长图设计')
  expect(r.workflows.get('longform')?.stepBudget).toBe(50)
  expect(r.profiles.get('watercolor-poster-v3')?.heroComposition).toBe('center_left_counterweight')
  expect(r.modes.map((m) => m.id)).toEqual(['general', 'longform'])
  expect(r.modes[0].source).toBe('general')
})

test('C1: 用户目录同 id 覆盖内置（workflow 与 base 各一例），用户独有 profile 追加注册', () => {
  put(builtinDir, 'base.md', BASE_MD)
  put(builtinDir, join('workflows', 'longform.md'), LONGFORM_MD)
  put(
    userDir,
    join('workflows', 'longform.md'),
    LONGFORM_MD.replace('长图设计', '长图设计（用户改写）')
  )
  put(userDir, 'base.md', BASE_MD.replace('事实零虚构。', '用户守则优先。'))
  put(
    userDir,
    join('profiles', 'my-style.md'),
    PROFILE_MD.replace('watercolor-poster-v3', 'my-style').replace('水彩海报 v3', '我的风格')
  )
  const r = loadBoth()
  expect(r.failures).toEqual([])
  expect(r.workflows.get('longform')?.label).toBe('长图设计（用户改写）')
  expect(r.workflows.get('longform')?.origin).toBe('user')
  expect(r.base?.origin).toBe('user')
  expect(r.base?.body).toContain('用户守则优先。')
  expect(r.profiles.get('my-style')?.origin).toBe('user')
})

test('C1: 用户目录不存在为正常态（只用内置集）', () => {
  put(builtinDir, 'base.md', BASE_MD)
  const r = loadStudioFromDirs(builtinDir, join(userDir, 'never-created'))
  expect(r.base?.id).toBe('base')
  expect(r.failures).toEqual([])
})

// ── C2：解析纪律 ──────────────────────────────────────────────────────────

test('C2: 坏 frontmatter 不注册且 failures 带原因与指引，其余文件不受影响', () => {
  put(builtinDir, 'base.md', BASE_MD)
  put(builtinDir, join('workflows', 'longform.md'), LONGFORM_MD)
  put(builtinDir, join('workflows', 'no-frontmatter.md'), '## 直接正文\n\n没有头。\n')
  put(
    builtinDir,
    join('profiles', 'bad-yaml.md'),
    '---\nid: bad-yaml\nlabel: [未闭合\n---\n\n## x\n'
  )
  put(builtinDir, join('profiles', 'list-fm.md'), '---\n- 1\n- 2\n---\n\n## x\n')
  const r = loadBoth()
  expect(r.workflows.get('longform')).toBeDefined()
  expect(r.workflows.get('no-frontmatter')).toBeUndefined()
  expect(r.profiles.size).toBe(0)
  const reasons = r.failures.map((f) => `${f.path}::${f.reason}`)
  expect(reasons.some((s) => s.includes('no-frontmatter') && s.includes('缺 frontmatter'))).toBe(
    true
  )
  expect(reasons.some((s) => s.includes('bad-yaml') && s.includes('YAML 语法错误'))).toBe(true)
  expect(reasons.some((s) => s.includes('list-fm') && s.includes('不是键值 map'))).toBe(true)
  for (const f of r.failures) expect(f.hint.length).toBeGreaterThan(0)
})

test('C2: frontmatter id 与文件名不一致 → 失败（覆盖引用一致性防线）', () => {
  put(builtinDir, 'base.md', BASE_MD)
  put(
    builtinDir,
    join('workflows', 'longform.md'),
    LONGFORM_MD.replace('id: longform', 'id: other-name')
  )
  const r = loadBoth()
  expect(r.workflows.size).toBe(0)
  expect(r.failures.some((f) => f.reason.includes('与文件名') && f.reason.includes('不一致'))).toBe(
    true
  )
})

// ── C3：workflow 校验 ─────────────────────────────────────────────────────

test('C3: types 缺失 → 失败；types: none 合法', () => {
  put(builtinDir, 'base.md', BASE_MD)
  const noTypes = LONGFORM_MD.replace(/types:[\s\S]*?\n---/, '---')
  put(builtinDir, join('workflows', 'longform.md'), noTypes)
  let r = loadBoth()
  expect(r.workflows.size).toBe(0)
  expect(r.failures.some((f) => f.reason.includes('缺 `types`'))).toBe(true)

  put(
    builtinDir,
    join('workflows', 'longform.md'),
    LONGFORM_MD.replace(
      /types:[\s\S]*?\n  - id: ecommerce_detail\n    label: 电商详情页\n    size: 750x/,
      'types: none'
    )
  )
  r = loadBoth()
  expect(r.workflows.get('longform')?.types).toBe('none')
  expect(r.failures).toEqual([])
})

test('C3: type 缺同名蓝图节 / 蓝图节为空 → 失败', () => {
  put(builtinDir, 'base.md', BASE_MD)
  put(
    builtinDir,
    join('workflows', 'longform.md'),
    LONGFORM_MD.replace('### ecommerce_detail', '### other_section')
  )
  let r = loadBoth()
  expect(r.workflows.size).toBe(0)
  expect(r.failures.some((f) => f.reason.includes('缺同名正文蓝图节'))).toBe(true)

  put(
    builtinDir,
    join('workflows', 'longform.md'),
    LONGFORM_MD.replace(
      '### ecommerce_detail\n\n首屏 hero → 卖点分区 → 详情 → 行动区。',
      '### ecommerce_detail'
    )
  )
  r = loadBoth()
  expect(r.failures.some((f) => f.reason.includes('蓝图节为空'))).toBe(true)
})

test('C3: size 非法 / step_budget 非正整数 → 失败', () => {
  put(builtinDir, 'base.md', BASE_MD)
  put(builtinDir, join('workflows', 'longform.md'), LONGFORM_MD.replace('size: 750x', 'size: 750*'))
  let r = loadBoth()
  expect(r.failures.some((f) => f.reason.includes('size') && f.reason.includes('不合法'))).toBe(
    true
  )

  put(
    builtinDir,
    join('workflows', 'longform.md'),
    LONGFORM_MD.replace('step_budget: 50', 'step_budget: -3')
  )
  r = loadBoth()
  expect(r.failures.some((f) => f.reason.includes('step_budget'))).toBe(true)
})

// ── C4：profile 校验 ──────────────────────────────────────────────────────

test('C4: 必需小节缺失/为空 → 失败；显式 no-op 合法', () => {
  put(builtinDir, 'base.md', BASE_MD)
  put(builtinDir, join('workflows', 'longform.md'), LONGFORM_MD)
  put(
    builtinDir,
    join('profiles', 'watercolor-poster-v3.md'),
    PROFILE_MD.replace('## Tone\n\n克制、留白。', '## Tone')
  )
  let r = loadBoth()
  expect(r.profiles.size).toBe(0)
  expect(r.failures.some((f) => f.reason.includes('`## Tone` 为空'))).toBe(true)

  put(
    builtinDir,
    join('profiles', 'watercolor-poster-v3.md'),
    PROFILE_MD.replace('## Tone\n\n克制、留白。', '## Tone\n\nno-op')
  )
  r = loadBoth()
  expect(r.profiles.size).toBe(1)
  expect(r.failures).toEqual([])

  put(
    builtinDir,
    join('profiles', 'watercolor-poster-v3.md'),
    PROFILE_MD.replace('## Anti-identity\n\n不做廉价渐变。\n\n', '')
  )
  r = loadBoth()
  expect(
    r.failures.some((f) => f.reason.includes('缺必需小节') && f.reason.includes('Anti-identity'))
  ).toBe(true)
})

test('C4: applicable_to 引用不存在的 mode → 失败；general 与真实 workflow 合法', () => {
  put(builtinDir, 'base.md', BASE_MD)
  put(
    builtinDir,
    join('profiles', 'watercolor-poster-v3.md'),
    PROFILE_MD.replace('[longform]', '[kv]')
  )
  let r = loadBoth()
  expect(r.profiles.size).toBe(0)
  expect(r.failures.some((f) => f.reason.includes('不存在的 mode「kv」'))).toBe(true)

  put(builtinDir, join('workflows', 'longform.md'), LONGFORM_MD)
  put(
    builtinDir,
    join('profiles', 'watercolor-poster-v3.md'),
    PROFILE_MD.replace('[longform]', '[general, longform]')
  )
  r = loadBoth()
  expect(r.profiles.size).toBe(1)
})

test('C4: 非法 hex → 失败；合法 hex 与短编号不误报', () => {
  put(builtinDir, 'base.md', BASE_MD)
  put(builtinDir, join('workflows', 'longform.md'), LONGFORM_MD)
  put(
    builtinDir,
    join('profiles', 'watercolor-poster-v3.md'),
    PROFILE_MD.replace('#a0c4e8', '#a0c4e')
  )
  let r = loadBoth()
  expect(r.failures.some((f) => f.reason.includes('非法 hex') && f.reason.includes('#a0c4e'))).toBe(
    true
  )

  put(
    builtinDir,
    join('profiles', 'watercolor-poster-v3.md'),
    PROFILE_MD.replace('#a0c4e8', '#zzc4e8')
  )
  r = loadBoth()
  expect(r.failures.some((f) => f.reason.includes('#zzc4e8'))).toBe(true)

  put(
    builtinDir,
    join('profiles', 'watercolor-poster-v3.md'),
    PROFILE_MD.replace(
      '主色倾向：青蓝 #a0c4e8。',
      '主色倾向：青蓝 #a0c4e8 / 辅助 #fff / 候选 #1 稿。'
    )
  )
  r = loadBoth()
  expect(r.failures).toEqual([])
})

test('C4: 字体白名单——注册表外家族 → 失败；注册表内家族通过', () => {
  put(builtinDir, 'base.md', BASE_MD)
  put(builtinDir, join('workflows', 'longform.md'), LONGFORM_MD)
  put(
    builtinDir,
    join('profiles', 'watercolor-poster-v3.md'),
    PROFILE_MD.replace('latin_pairing: Alibaba PuHuiTi', 'latin_pairing: No Such Font Family')
  )
  let r = loadBoth()
  expect(r.failures.some((f) => f.reason.includes('不在字体注册表白名单'))).toBe(true)

  put(builtinDir, join('profiles', 'watercolor-poster-v3.md'), PROFILE_MD)
  r = loadBoth()
  expect(r.failures).toEqual([])
})

// ── C5：base 唯一性与 general 特例 ────────────────────────────────────────

test('C5: 双源皆无 base → failures 记缺失态；默认集全坏 → 记整体态', () => {
  const r = loadBoth()
  expect(r.base).toBeNull()
  expect(r.failures.some((f) => f.kind === 'base' && f.reason.includes('base.md 缺失'))).toBe(true)
  // 空目录无任何文件 → 只有 base 缺失一条；塞一个坏文件 → 触发整体态
  put(builtinDir, join('workflows', 'broken.md'), '无 frontmatter')
  const r2 = loadBoth()
  expect(r2.failures.some((f) => f.kind === 'studio' && f.reason.includes('整体缺失'))).toBe(true)
})

test('C5: general mode 恒在且无文件', () => {
  const r = loadBoth()
  const general = r.modes.find((m) => m.id === 'general')
  expect(general).toBeDefined()
  expect(general?.source).toBe('general')
  expect(r.workflows.get('general')).toBeUndefined()
})

// ── C6：reload 幂等与修复路径 ─────────────────────────────────────────────

test('C6: loadStudioFromDirs 幂等；文件修复后重载反映新态', () => {
  put(builtinDir, 'base.md', BASE_MD)
  put(builtinDir, join('workflows', 'broken.md'), '无 frontmatter')
  let r = loadBoth()
  expect(r.workflows.size).toBe(0)
  expect(r.failures.length).toBeGreaterThan(0)

  // 修复 → 重载 → 注册成功且 failure 消失
  put(
    builtinDir,
    join('workflows', 'broken.md'),
    LONGFORM_MD.replace('id: longform', 'id: broken').replace('label: 长图设计', 'label: 修复件')
  )
  r = loadBoth()
  expect(r.workflows.get('broken')?.label).toBe('修复件')
  expect(r.failures).toEqual([])

  // 删除 → 重载 → mode 消失
  rmSync(join(builtinDir, 'workflows', 'broken.md'))
  r = loadBoth()
  expect(r.modes.map((m) => m.id)).toEqual(['general'])
})

test('C6: reloadStudio(rootDir) 与 getStudioRegistry(rootDir) 走约定目录', () => {
  const rootDir = mkdtempSync(join(tmpdir(), 'studio-root-'))
  try {
    put(rootDir, join('src', 'app', 'ai', 'pi-backend', 'studio', 'base.md'), BASE_MD)
    const r = reloadStudio(rootDir)
    expect(r.base?.body).toContain('事实零虚构。')
    expect(getStudioRegistry(rootDir).base?.id).toBe('base')
    expect(getStudioRegistry().base?.id).toBe('base')
  } finally {
    rmSync(rootDir, { recursive: true, force: true })
  }
})

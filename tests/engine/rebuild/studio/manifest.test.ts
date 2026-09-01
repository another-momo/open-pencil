/**
 * T45（S4 W1 / T-A3）studio manifest 投影 + overlay 输入适配单测。
 *
 * 验收映射（T45-plan §4）：C1 的投影形状（modes 投影 / profiles 摘要 /
 * failures 相对路径脱敏 / deprecated 不进数据面 / 整体缺失态）+ C3 的
 * overlay 改源适配（profiles markdown=body；T62 起 types 数据面整段删除）。
 * 全程 tmp fixture 目录经 loadStudioFromDirs 构造真实注册表，不手糊对象。
 */

import { afterEach, beforeEach, expect, test } from 'bun:test'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { studioOverlayInput } from '@/app/ai/pi-backend/prompt-overlay'
import { loadStudioFromDirs } from '@/app/ai/pi-backend/studio'
import { toStudioManifest } from '@/app/ai/pi-backend/studio/manifest'

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

通用守则正文。
`

const LONGFORM_MD = `---
id: longform
label: 长图设计
subtitle: 分区物料
canvas: 750x
---

## 阶段定义

阶段序。

## 画布尺寸

750 宽，高度随内容。

## 纪律

纪律。
`

const PROFILE_MD = `---
id: watercolor_poster_v3
label: 水彩海报 v3
applicable_to: [longform]
version: 3
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

配方正文——只进 prompt，不下发前端。
`

const DEPRECATED_MD = `---
id: old_poster
label: 旧海报
applicable_to: [longform]
deprecated: true
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

test('投影：modes 收两级（general 首位 + longform 带 subtitle，无 types 数据面）', () => {
  put(builtinDir, 'base.md', BASE_MD)
  put(builtinDir, join('workflows', 'longform.md'), LONGFORM_MD)
  put(builtinDir, join('profiles', 'watercolor_poster_v3.md'), PROFILE_MD)
  const m = toStudioManifest(loadStudioFromDirs(builtinDir, userDir))

  expect(m.modes.map((mode) => mode.id)).toEqual(['general', 'longform'])
  const general = m.modes[0]
  expect(general.source).toBe('general')
  const longform = m.modes[1]
  expect(longform.source).toBe('workflow')
  expect(longform.subtitle).toBe('分区物料')
  // T62：types 数据面删除（chips 按数据驱动渲染自然两级）
  for (const mode of m.modes) expect('types' in mode).toBe(false)
})

test('投影：profiles 摘要无 body；deprecated 不进数据面', () => {
  put(builtinDir, 'base.md', BASE_MD)
  put(builtinDir, join('workflows', 'longform.md'), LONGFORM_MD)
  put(builtinDir, join('profiles', 'watercolor_poster_v3.md'), PROFILE_MD)
  put(builtinDir, join('profiles', 'old_poster.md'), DEPRECATED_MD)
  const registry = loadStudioFromDirs(builtinDir, userDir)
  expect(registry.profiles.size).toBe(2) // deprecated 仍注册在案
  const m = toStudioManifest(registry)

  expect(m.profiles.map((p) => p.id)).toEqual(['watercolor_poster_v3'])
  const summary = m.profiles[0]
  expect(summary.label).toBe('水彩海报 v3')
  expect(summary.applicableTo).toEqual(['longform'])
  expect('body' in summary).toBe(false) // 信任边界：正文不下发
  expect(Object.keys(summary).sort()).toEqual(['applicableTo', 'id', 'label'])
})

test('投影：failures 相对路径 + origin；整体缺失态 path=.', () => {
  // 文件级失败：坏 frontmatter 的 profile（workflows 空 → applicable_to 不拦）
  put(builtinDir, 'base.md', BASE_MD)
  put(builtinDir, join('profiles', 'broken.md'), '无 frontmatter')
  const m = toStudioManifest(loadStudioFromDirs(builtinDir, userDir))
  const fileFailure = m.failures.find((f) => f.kind === 'profile')
  if (!fileFailure) throw new Error('缺 profile 失败条目')
  expect(fileFailure.path).toBe('profiles/broken.md') // 统一正斜杠（跨平台口径）
  expect(fileFailure.origin).toBe('builtin')
  expect(fileFailure.path).not.toContain(builtinDir) // 绝对路径不下发

  // 整体缺失态：双源全空 → base 缺失 + 整体态（零注册且有失败即触发，T43 口径）
  const m2 = toStudioManifest(
    loadStudioFromDirs(mkdtempSync(join(tmpdir(), 'studio-empty-')), userDir)
  )
  expect(m2.failures.length).toBe(2)
  expect(m2.failures.some((f) => f.kind === 'studio' && f.path === '.')).toBe(true)
  const m3 = toStudioManifest(loadStudioFromDirs(builtinDir, mkdtempSync(join(tmpdir(), 's-u-'))))
  // builtinDir 此刻有 base 注册成功 → 非整体态（仅文件级失败一条）
  expect(m3.failures.some((f) => f.kind === 'studio')).toBe(false)
})

test('整体缺失态：零注册且有失败 → studio 级 failure 入投影', () => {
  const empty = mkdtempSync(join(tmpdir(), 'studio-broken-'))
  put(empty, join('workflows', 'bad.md'), '无 frontmatter')
  const m = toStudioManifest(loadStudioFromDirs(empty, userDir))
  const total = m.failures.find((f) => f.kind === 'studio')
  if (!total) throw new Error('缺整体缺失态条目')
  expect(total.path).toBe('.')
  expect(total.origin).toBe('builtin')
  expect(m.modes.map((mode) => mode.id)).toEqual(['general']) // general 恒在
  rmSync(empty, { recursive: true, force: true })
})

test('overlay 适配：profiles markdown=body（types 段已随 T62 整段删除）', () => {
  put(builtinDir, 'base.md', BASE_MD)
  put(builtinDir, join('workflows', 'longform.md'), LONGFORM_MD)
  put(
    builtinDir,
    join('workflows', 'creative.md'),
    LONGFORM_MD.replace('id: longform', 'id: creative').replace(
      'label: 长图设计',
      'label: 创意生图'
    )
  )
  put(builtinDir, join('profiles', 'watercolor_poster_v3.md'), PROFILE_MD)
  const registry = loadStudioFromDirs(builtinDir, userDir)
  const input = studioOverlayInput(registry)

  // T62：overlay 输入仅余 profiles；无 types 键
  expect('types' in input).toBe(false)
  expect(registry.workflows.has('creative')).toBe(true)
  expect(input.profiles.map((p) => p.id)).toEqual(['watercolor_poster_v3'])
  expect(input.profiles[0].markdown).toContain('配方正文')

  // 投影侧：creative mode 在列且无 types 键
  const creativeMode = toStudioManifest(registry).modes.find((m) => m.id === 'creative')
  expect(creativeMode).toBeDefined()
  expect('types' in (creativeMode ?? {})).toBe(false)
})

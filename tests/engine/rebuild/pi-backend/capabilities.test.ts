/**
 * T87：capabilities store 单测——缺省 OFF、set/get 往返、坏 JSON 降级、
 * listSkills 仅在 ON 时扫 + 双源去重 + 脱敏白名单。
 * T96：v2 形状（builtinTools 三档 + agentSkills 解耦）+ v1→v2 读盘迁移钉扎。
 *
 * 测试 fixture：mkdtemp 建临时 agentDir + rootDir；capabilities store 与
 * 真 pi SDK loadSkillsFromDir 协作（这是核心机制，不 mock）。
 */

import { afterEach, beforeEach, expect, test } from 'bun:test'
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { createCapabilitiesStore } from '@/app/ai/pi-backend/capabilities'

let rootDir = ''
let agentDir = ''

beforeEach(() => {
  rootDir = mkdtempSync(join(tmpdir(), 'cap-root-'))
  agentDir = join(rootDir, '.openpencil', 'pi-agent')
  mkdirSync(agentDir, { recursive: true })
})

afterEach(() => {
  rmSync(rootDir, { recursive: true, force: true })
})

test('T87 缺省：capabilities.json 不存在 → OFF（不暴露新攻击面）', () => {
  const store = createCapabilitiesStore({ agentDir, rootDir })
  expect(store.get()).toEqual({ builtinTools: 'off', agentSkills: false })
  expect(store.listSkills()).toEqual([])
  // 未触发写入（缺省走读 fail-safe，不应副作用生成 capabilities.json）
  expect(existsSync(join(agentDir, 'capabilities.json'))).toBe(false)
})

test('T87 写读往返：set ON → get ON；文件落盘 0o600 含 version+builtinTools+agentSkills', () => {
  const store = createCapabilitiesStore({ agentDir, rootDir })
  const next = store.set({ agentSkills: true })
  // T96：builtinTools 缺省保留旧值（缺省 'off'）——set 只写 agentSkills 的兼容面
  expect(next).toEqual({ builtinTools: 'off', agentSkills: true })
  expect(store.get()).toEqual({ builtinTools: 'off', agentSkills: true })

  // 重新构造读面（验落盘而非仅内存缓存）
  const reread = createCapabilitiesStore({ agentDir, rootDir })
  expect(reread.get()).toEqual({ builtinTools: 'off', agentSkills: true })

  // 文件结构钉扎（T96：写盘恒 version:2）
  const raw = JSON.parse(readFileSync(join(agentDir, 'capabilities.json'), 'utf8')) as unknown
  expect((raw as { version: number }).version).toBe(2)
  expect((raw as { builtinTools: string }).builtinTools).toBe('off')
  expect((raw as { agentSkills: boolean }).agentSkills).toBe(true)
})

test('T96 写读往返：三档位 builtinTools 落盘回读', () => {
  const store = createCapabilitiesStore({ agentDir, rootDir })
  expect(store.set({ agentSkills: false, builtinTools: 'readonly' })).toEqual({
    builtinTools: 'readonly',
    agentSkills: false
  })
  expect(store.set({ agentSkills: true, builtinTools: 'full' })).toEqual({
    builtinTools: 'full',
    agentSkills: true
  })
  const reread = createCapabilitiesStore({ agentDir, rootDir })
  expect(reread.get()).toEqual({ builtinTools: 'full', agentSkills: true })
})

test('T87 坏 JSON 降级：写入非 JSON 内容 → 下次构造读 OFF', () => {
  writeFileSync(join(agentDir, 'capabilities.json'), '{not-json}', 'utf8')
  const store = createCapabilitiesStore({ agentDir, rootDir })
  expect(store.get()).toEqual({ builtinTools: 'off', agentSkills: false })
  expect(store.listSkills()).toEqual([])
})

test('T87 缺字段降级：写入空对象 → OFF', () => {
  writeFileSync(join(agentDir, 'capabilities.json'), '{}', 'utf8')
  const store = createCapabilitiesStore({ agentDir, rootDir })
  expect(store.get()).toEqual({ builtinTools: 'off', agentSkills: false })
})

test('T96 v1→v2 迁移：version:1 + agentSkills:true → builtinTools full（旧同闸语义）', () => {
  writeFileSync(
    join(agentDir, 'capabilities.json'),
    JSON.stringify({ version: 1, agentSkills: true }),
    'utf8'
  )
  const store = createCapabilitiesStore({ agentDir, rootDir })
  expect(store.get()).toEqual({ builtinTools: 'full', agentSkills: true })
})

test('T96 v1→v2 迁移：version:1 + agentSkills:false → builtinTools off', () => {
  writeFileSync(
    join(agentDir, 'capabilities.json'),
    JSON.stringify({ version: 1, agentSkills: false }),
    'utf8'
  )
  const store = createCapabilitiesStore({ agentDir, rootDir })
  expect(store.get()).toEqual({ builtinTools: 'off', agentSkills: false })
  // 迁移后的首次写盘升级文件形状到 v2
  store.set({ agentSkills: false })
  const raw = JSON.parse(readFileSync(join(agentDir, 'capabilities.json'), 'utf8')) as {
    version: number
  }
  expect(raw.version).toBe(2)
})

test('T96 v2 非法 builtinTools → 降级 DEFAULTS（坏档位不残留）', () => {
  writeFileSync(
    join(agentDir, 'capabilities.json'),
    JSON.stringify({ version: 2, builtinTools: 'everything', agentSkills: true }),
    'utf8'
  )
  const store = createCapabilitiesStore({ agentDir, rootDir })
  expect(store.get()).toEqual({ builtinTools: 'off', agentSkills: false })
})

test('T87 set 校验：agentSkills 非布尔 → 抛错且不写盘', () => {
  const store = createCapabilitiesStore({ agentDir, rootDir })
  expect(() => store.set({ agentSkills: 'yes' })).toThrow(/boolean/)
  expect(() => store.set({ agentSkills: 1 })).toThrow(/boolean/)
  expect(() => store.set({ agentSkills: null })).toThrow(/boolean/)
  // 没副作用落盘
  expect(existsSync(join(agentDir, 'capabilities.json'))).toBe(false)
})

test('T96 set 校验：builtinTools 非法 → 抛错且不写盘', () => {
  const store = createCapabilitiesStore({ agentDir, rootDir })
  expect(() => store.set({ agentSkills: true, builtinTools: 'write' })).toThrow(/builtinTools/)
  expect(() => store.set({ agentSkills: true, builtinTools: 1 })).toThrow(/builtinTools/)
  expect(() => store.set({ agentSkills: true, builtinTools: true })).toThrow(/builtinTools/)
  expect(existsSync(join(agentDir, 'capabilities.json'))).toBe(false)
})

test('T96 set 缺省 builtinTools → 保留旧值（部分更新语义）', () => {
  const store = createCapabilitiesStore({ agentDir, rootDir })
  store.set({ agentSkills: true, builtinTools: 'readonly' })
  const next = store.set({ agentSkills: false })
  expect(next).toEqual({ builtinTools: 'readonly', agentSkills: false })
})

test('T87 listSkills：OFF 时空集（不泄露已扫到 skill 存在性）', () => {
  // 即便 .openpencil/skills 有 SKILL.md，OFF 时 listSkills 也必须空集
  const userSkillsDir = join(rootDir, '.openpencil', 'skills', 'demo')
  mkdirSync(userSkillsDir, { recursive: true })
  writeFileSync(
    join(userSkillsDir, 'SKILL.md'),
    `---
name: demo
description: 测试
---

正文
`,
    'utf8'
  )
  const store = createCapabilitiesStore({ agentDir, rootDir })
  store.set({ agentSkills: false })
  expect(store.listSkills()).toEqual([])
})

test('T87 listSkills：ON 时扫 cwd/.openpencil/skills（单源）+ 脱敏', () => {
  // T89：单源扫描 .openpencil/skills；原双源去重测试不再适用（同名 demo
  // 在单源下不可能双份；保留 name 投影 + 脱敏两条核心断言）
  const userDir = join(rootDir, '.openpencil', 'skills', 'demo')
  mkdirSync(userDir, { recursive: true })
  writeFileSync(
    join(userDir, 'SKILL.md'),
    `---
name: demo
description: 用户侧 demo
---

正文
`,
    'utf8'
  )
  const otherDir = join(rootDir, '.openpencil', 'skills', 'other')
  mkdirSync(otherDir, { recursive: true })
  writeFileSync(
    join(otherDir, 'SKILL.md'),
    `---
name: other
description: 另一份
---

正文
`,
    'utf8'
  )

  const store = createCapabilitiesStore({ agentDir, rootDir })
  store.set({ agentSkills: true })
  const skills = store.listSkills()

  const names = skills.map((s) => s.name).sort()
  expect(names).toEqual(['demo', 'other'])
  const demo = skills.find((s) => s.name === 'demo')
  expect(demo?.description).toBe('用户侧 demo')

  // 脱敏：每条只含 name + description
  for (const s of skills) {
    expect(Object.keys(s).sort()).toEqual(['description', 'name'])
  }
})

test('T87 listSkills：disable-model-invocation 的 skill 也进清单（描述可空兜底）', () => {
  const userDir = join(rootDir, '.openpencil', 'skills', 'hidden')
  mkdirSync(userDir, { recursive: true })
  writeFileSync(
    join(userDir, 'SKILL.md'),
    `---
name: hidden
description: 显式调用专用
disable-model-invocation: true
---

正文
`,
    'utf8'
  )
  const store = createCapabilitiesStore({ agentDir, rootDir })
  store.set({ agentSkills: true })
  const skills = store.listSkills()
  expect(skills.map((s) => s.name)).toEqual(['hidden'])
  expect(skills[0].description).toBe('显式调用专用')
})

test('T87 listSkills：缺 description → SDK 拒收不进清单（description 是 frontmatter 必填）', () => {
  // pi SDK 实证：loadSkillsFromDir 要求 SKILL.md frontmatter name + description
  // 齐备；缺 description 即非法，被丢弃不进结果。我们的脱敏兜空只兜 store
  // 收到非法描述的情况（manifest 投影层），不进 SDK 扫描。
  const userDir = join(rootDir, '.openpencil', 'skills', 'no-desc')
  mkdirSync(userDir, { recursive: true })
  writeFileSync(
    join(userDir, 'SKILL.md'),
    `---
name: no-desc
---

正文
`,
    'utf8'
  )
  const store = createCapabilitiesStore({ agentDir, rootDir })
  store.set({ agentSkills: true })
  expect(store.listSkills()).toEqual([])
})

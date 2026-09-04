/**
 * T87：service.ts 装配 capabilities seam——store 实例接进 service，
 * getStudioManifest 透传 capabilities + skills，getCapabilities/setCapabilities
 * 委托给 store。session 装配按 capabilities 切换 noTools/noSkills 留给
 * 真后端 t24/t87 冒烟钉扎（mock.createAgentSession 拿不到真 config 字段
 * 的副作用，本测试聚焦装配 seam 不深挖）。
 */
import { beforeEach, describe, expect, mock, test } from 'bun:test'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

// mock pi SDK 同 service-abort.test：只桩 createAgentSession + DefaultResourceLoader，
// 其余走真实现（capabilities.ts 依赖真 loadSkillsFromDir）
mock.module('@earendil-works/pi-coding-agent', () => ({
  createAgentSession: async () => ({
    session: {
      prompt: () => Promise.resolve(),
      subscribe: () => () => undefined,
      abort: () => Promise.resolve(),
      sessionManager: { getSessionFile: () => null }
    }
  }),
  DefaultResourceLoader: class {
    async reload(): Promise<void> {
      // eslint-disable-next-line no-promise-executor-return -- 同步桩返回
      return Promise.resolve() as Promise<void>
    }
  },
  SessionManager: {
    create: () => ({ getSessionFile: () => null }),
    open: () => ({ getSessionFile: () => null })
  },
  defineTool: (def: unknown) => def,
  // T91c 修复：mock.module 是 process 级（bun:test 语义），
  // 同批跑的 marketing/ask-user-question-roundtrip.test.ts 用 readPiHistoryFile
  // 依赖真 parseSessionEntries；stub 成 () => [] 会让 roundtrip 测试拿到空历史。
  parseSessionEntries: (content: string): unknown[] => {
    const entries: unknown[] = []
    for (const line of content.trim().split('\n')) {
      if (!line.trim()) continue
      try {
        entries.push(JSON.parse(line))
        // oxlint-disable-next-line open-pencil/no-silent-catch -- 容错 skip 是 SDK 真语义：malformed 行静默跳过，非错误吞没
      } catch {
        // skip malformed
      }
    }
    return entries
  }
}))

import { createPiChatService } from '@/app/ai/pi-backend/service'

function makeService(rootDir: string) {
  return createPiChatService({
    rootDir,
    admin: { resolveModel: async () => ({ modelRuntime: null, model: null }) } as never,
    imageGenCredentials: {} as never
  })
}

describe('pi-backend service.ts capabilities seam（T87）', () => {
  let rootDir = ''

  beforeEach(() => {
    rootDir = mkdtempSync(join(tmpdir(), 'pi-svc-cap-'))
    mkdirSync(join(rootDir, '.openpencil', 'pi-agent'), { recursive: true })
  })

  test('getCapabilities：缺省 OFF（capabilities.json 不存在 → 失败安全）', () => {
    const svc = makeService(rootDir)
    expect(svc.getCapabilities()).toEqual({ agentSkills: false })
  })

  test('setCapabilities → getCapabilities 往返：与 capabilitiesStore 实例共享', () => {
    const svc = makeService(rootDir)
    expect(svc.setCapabilities({ agentSkills: true })).toEqual({ agentSkills: true })
    expect(svc.getCapabilities()).toEqual({ agentSkills: true })

    // 落盘后可被新实例读出（验证持久化层一致）
    const svc2 = makeService(rootDir)
    expect(svc2.getCapabilities()).toEqual({ agentSkills: true })
  })

  test('setCapabilities 非布尔 → 抛错', () => {
    const svc = makeService(rootDir)
    expect(() => svc.setCapabilities({ agentSkills: 'yes' })).toThrow(/boolean/)
  })

  test('getStudioManifest：含 capabilities + skills 字段（OFF 时 skills=[]）', () => {
    const svc = makeService(rootDir)
    const manifest = svc.getStudioManifest()
    expect(manifest.capabilities).toEqual({ agentSkills: false })
    expect(manifest.skills).toEqual([])
  })

  test('getStudioManifest：capabilities ON 时 listSkills 反映 .openpencil/skills 扫描', () => {
    // T89：扫描目录由 `.pi/skills` 改 `.openpencil/skills`
    const skillDir = join(rootDir, '.openpencil', 'skills', 'svc-test')
    mkdirSync(skillDir, { recursive: true })
    writeFileSync(
      join(skillDir, 'SKILL.md'),
      `---
name: svc-test
description: service 装配 seam 测试
---

正文
`,
      'utf8'
    )

    const svc = makeService(rootDir)
    svc.setCapabilities({ agentSkills: true })
    const manifest = svc.getStudioManifest()
    expect(manifest.capabilities).toEqual({ agentSkills: true })
    expect(manifest.skills).toEqual([{ name: 'svc-test', description: 'service 装配 seam 测试' }])
  })

  test('setCapabilities OFF → manifest.skills=[]（listSkills 守门）', () => {
    const skillDir = join(rootDir, '.openpencil', 'skills', 'svc-test')
    mkdirSync(skillDir, { recursive: true })
    writeFileSync(
      join(skillDir, 'SKILL.md'),
      `---
name: svc-test
description: x
---

`,
      'utf8'
    )
    const svc = makeService(rootDir)
    expect(svc.getStudioManifest().skills).toEqual([])
  })
})

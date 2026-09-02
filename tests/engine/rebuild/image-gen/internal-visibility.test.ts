/**
 * T72：内部流水线段可见性钉扎（docs/202609010000-tool-internal-visibility-review.md
 * 方案 A 落地）——image_gen_begin/commit 是 generate_image 编排器的桥端点：
 * ① agent 工具集（createOpenPencilTools）不透出（防 agent 直调绕过凭证检查/
 * 编排/批量/快照逻辑）；② MCP 注册面不透出（registration.ts 的 internal 跳过）；
 * ③ ALL_TOOLS 保留（桥执行面 tool-handlers.ts 按名分发——编排器 RPC 必须仍可达）。
 */
import { describe, expect, test } from 'bun:test'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import { ALL_TOOLS, FORK_TOOLS } from '@open-pencil/core/tools'

import { createOpenPencilTools } from '@/app/ai/pi-backend/tools'

const INTERNAL_NAMES = ['image_gen_begin', 'image_gen_commit']

/** 本测试文件 → 仓根（tests/engine/rebuild/image-gen 上四级） */
const REPO_ROOT = join(import.meta.dir, '..', '..', '..', '..')

describe('T72 内部工具可见性', () => {
  test('两工具在 FORK_TOOLS 带 internal 标记（机器可读，非描述文本约定）', () => {
    const internals = FORK_TOOLS.filter((def) => def.internal === true).map((def) => def.name)
    expect(internals.sort()).toEqual([...INTERNAL_NAMES].sort())
  })

  test('agent 工具集不透出 internal 段，其余 fork 工具不受影响', () => {
    const exposed = createOpenPencilTools().map((tool) => tool.name)
    for (const name of INTERNAL_NAMES) expect(exposed).not.toContain(name)
    // 同族非 internal 工具仍在（防过滤面误伤）
    expect(exposed).toContain('read_brief')
    expect(exposed).toContain('setup_design')
  })

  test('ALL_TOOLS 保留两工具（桥按名分发面不断——编排器 RPC 仍可达）', () => {
    const all = ALL_TOOLS.map((def) => def.name)
    for (const name of INTERNAL_NAMES) expect(all).toContain(name)
  })

  test('全仓 internal 工具清单 = 已知两件（新增 internal 工具须显式更新本钉扎）', () => {
    const internals = ALL_TOOLS.filter((def) => def.internal === true).map((def) => def.name)
    expect(internals.sort()).toEqual([...INTERNAL_NAMES].sort())
  })

  /**
   * T75（review-2026-09-01-code-review P1-01）反向钉扎：现有三个过滤面
   * （pi-backend/mcp.registration/mcp.manifest）之外，CLI 包当前零消费
   * ALL_TOOLS/FORK_TOOLS/toolsToAI——若未来 CLI 接入这些面而未挂 internal
   * 过滤，本钉扎即 fail，防 internal 工具从新增消费面静默外泄。
   */
  test('CLI 包不直接消费 ALL_TOOLS/FORK_TOOLS/toolsToAI（新增消费面须先挂 internal 过滤）', () => {
    const cliSrc = join(REPO_ROOT, 'packages', 'cli', 'src')
    // 目录消失时钉扎必须显式失败（防空转假绿）
    expect(existsSync(cliSrc)).toBe(true)
    const offenders: string[] = []
    const stack = [cliSrc]
    for (;;) {
      const dir = stack.pop()
      if (!dir) break
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const path = join(dir, entry.name)
        if (entry.isDirectory()) {
          stack.push(path)
        } else if (entry.name.endsWith('.ts')) {
          const text = readFileSync(path, 'utf8')
          if (/\b(?:ALL_TOOLS|FORK_TOOLS|toolsToAI)\b/.test(text)) offenders.push(path)
        }
      }
    }
    expect(offenders).toEqual([])
  })
})

/**
 * T72：内部流水线段可见性钉扎（docs/202609010000-tool-internal-visibility-review.md
 * 方案 A 落地）——image_gen_begin/commit 是 generate_image 编排器的桥端点：
 * ① agent 工具集（createOpenPencilTools）不透出（防 agent 直调绕过凭证检查/
 * 编排/批量/快照逻辑）；② MCP 注册面不透出（registration.ts 的 internal 跳过）；
 * ③ ALL_TOOLS 保留（桥执行面 tool-handlers.ts 按名分发——编排器 RPC 必须仍可达）。
 */
import { describe, expect, test } from 'bun:test'

import { ALL_TOOLS, FORK_TOOLS } from '@open-pencil/core/tools'

import { createOpenPencilTools } from '@/app/ai/pi-backend/tools'

const INTERNAL_NAMES = ['image_gen_begin', 'image_gen_commit']

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
})

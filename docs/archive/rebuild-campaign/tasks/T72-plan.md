# T72 计划 · 内部工具泄露修复（image_gen_begin/commit 可见性）

> 日期：2026-09-01。来源：仓外评审文档 `docs/202609010000-tool-internal-visibility-review.md`（owner 指令「修它」）。方案 = 文档推荐**方案 A**（ToolDef 增 `internal` 字段 + 消费面过滤）。

## 1. 问题

image_gen_begin / image_gen_commit 是 generate_image 双段流水线的内部段（描述里只有无强制力的 "INTERNAL" 字样），经 FORK_TOOLS → ALL_TOOLS 泄漏到：AI agent 工具集（pi-backend tools.ts 全量平铺）、MCP 注册面（registration.ts 全量循环）。风险（文档 §5）：绕过凭证检查 / 孤立 pipeline 状态 / 绕过编排与快照 / 暴露桥 payload 格式。

## 2. 关键约束（实探）

- 桥执行面 `tool-handlers.ts:172` 用 ALL_TOOLS.find 按名分发——编排器（generate.ts）经 bridge RPC 调这两段，**此面绝不能过滤**。
- CLI 无 ALL_TOOLS 消费（grep 实证；CLI eval 走桥按名调用，无列出面）。
- 唯一合法调用者 = pi-backend generate_image 编排器（桥 RPC）。

## 3. 改动

| 文件 | 改动 |
|---|---|
| `packages/core/src/tools/schema.ts` | ToolDef + defineTool 增 `internal?: boolean`（zones P138） |
| `packages/core/src/tools/fork/image-gen/tools.ts` | 两工具 `internal: true`；头注可见性段改写（从「集成期决策待定」到 T72 落地事实） |
| `src/app/ai/pi-backend/tools.ts` | FORK_TOOLS 装配处 `.filter((def) => !def.internal)` |
| `packages/mcp/src/tool/registration.ts` | 注册循环 `if (def.internal) continue`（zones P139） |
| `tests/engine/rebuild/image-gen/internal-visibility.test.ts` | 新增 4 例钉扎（internal 标记在案 / agent 面不透出且无误伤 / ALL_TOOLS 保留桥可达 / 全仓 internal 清单钉扎防静默新增） |
| 仓外评审文档 §9 | 决策记录翻转为「方案 A 已实施」 |

## 4. 验收

- 新钉扎 4/4 绿；agent 工具集无两件、ALL_TOOLS 保留两件。
- 门禁全绿（含 build:packages 后 lint——core 类型面变更需重建产物，否则 mcp 包 TS2339）。

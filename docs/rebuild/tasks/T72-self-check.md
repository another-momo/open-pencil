# T72 自检 · 内部工具泄露修复

> 日期：2026-09-01。实施 = 主 agent。

## 1. 交付（对照 T72-plan §3 六项，全落地）

- schema.ts：`ToolDef.internal?: boolean` + defineTool 入参面同步（注释标明过滤面/不过滤面）。
- image-gen/tools.ts：imageGenBegin:23 邻 / imageGenCommit:72 邻各 `internal: true`；头注改为 T72 落地事实（桥执行面不受影响的分发路径写明）。
- pi-backend/tools.ts:259：FORK_TOOLS 过滤 + 注释（绕过凭证检查/编排语义的理由）。
- mcp/registration.ts:82 邻：`if (def.internal) continue` + 注释。
- internal-visibility.test.ts 新增 4 例（钉扎含「全仓 internal 清单 = 已知两件」防未来静默新增）。
- 仓外评审文档 §9 决策记录翻转。

## 2. 关键事实核验

- 编排器不受影响：generate 链路经 bridge RPC 按名调用 → tool-handlers.ts:172 ALL_TOOLS.find 分发面**未动**；钉扎 ③ 显式断言 ALL_TOOLS 保留两件。
- CLI 面无 ALL_TOOLS 消费（grep 实证），无需改动。
- EXTENDED_WHITELIST 过滤模式与本次 filter 并存，互不影响（tools.ts:255/:259）。

## 3. 门禁（unpiped 实录）

- `bun test ./tests/engine/rebuild` exit 0（377 pass / 0 fail = 373 + 新 4 例）
- `bun run test:type-shapes` 0 / `test:tools` 0 / `smoke:pi` 0 / `typecheck` 0
- `bun run lint`：首跑 1 error（mcp 包 TS2339 Property 'internal' does not exist）→ 根因 = mcp 经 core 构建产物取类型 → `bun run build:packages` 重建后 0。**记录：core 类型面变更须重建产物再过 lint。**
- `format:check` 0（触碰文件已 oxfmt --write）；`check:zones` 0（P138/P139 登记后）

## 4. 偏差

- 净改动 21 行 +4/-7（加新测试文件）；小于大改动阈值但仍按三件套成文（owner 点名修的问题，留痕）。

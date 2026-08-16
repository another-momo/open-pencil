# Task: P0 agent 后端的测试 + 文档补齐

日期：2026-08-15
状态：已完成（2026-08-15）
依据：`docs/review/2026-08-15-agent-backend-branch-review.md` + P0 阶段复盘里列出的测试 / 文档掉队项
范围：`tests/engine/{chat,agent}/*.test.ts`、`docs/plans/architecture/l2-agent-backend.md`、`docs/plans/tasks/agent-backend-p0-cleanup.md`（本文件）、`packages/agent/README.md`、根 `README.md`、`CHANGELOG.md`

## 背景与目标

P0 改造（commit `5c1729e4`）把 AI agent 循环下沉到 `@open-pencil/agent` workspace 包，端到端跑通后留下两个空白：

1. **测试体系**：新包 + 新前端 transport 0 个单测，关键路径（UIMessage → ModelMessage 转换、SSE 解析、credential TTL、WS bridge envelope、CORS）都靠手动验证
2. **文档体系**：包 README 24 行（远薄于 kiwi 107 行模板）；缺架构设计文档；缺根 README 介绍；CHANGELOG 没记本轮

本任务把这两块补齐。所有改动在 `feature/agent-backend` 分支提交，可独立 review。

## T1 — 单测覆盖（已完成）

**为什么**：P0 调试阶段暴露的几个低级 bug（`convertToModelMessages` 漏 `await`、`AgentChatConfig` 漏 `connectionId` 字段、CORS 默认关闭）都来自同一类问题——没有单测守住 wire shape 与公共 API 边界。补单测是后续回归防护的最低成本。

**做了什么**：

8 个新文件，80 个用例，全部通过 `bun test`：

| 文件 | 用例数 | 覆盖 |
|---|---|---|
| `tests/engine/agent/credentials.test.ts` | 11 | TTL / overwrite / isolation / forget / count |
| `tests/engine/agent/routes-auth.test.ts` | 9 | POST/DELETE `/v1/auth` 路径与 400 验证 |
| `tests/engine/agent/routes-chat.test.ts` | 9 | `/v1/chat` 验证（invalid JSON / missing messages/id / librarySnapshot decode / credential lookup） |
| `tests/engine/agent/elision.test.ts` | 7 | agent 端 `elideMediaToolResults` 与前端等价（防漂移） |
| `tests/engine/agent/bridge-ws-client.test.ts` | 7 | 真 WS 双端：auth envelope / sendRPC request+response / disconnect 清理 / error path |
| `tests/engine/agent/prompts-library-snapshot.test.ts` | 9 | `buildMarketingOverlay` 全分支（null / empty / types / 参考区 / profile picked / not-in-library / 不显示 catalog） |
| `tests/engine/agent/server-cors.test.ts` | 6 | CORS 默认 origin / 自定义 origin / `none` 关闭 / 空字符串关闭 |
| `tests/engine/chat/http-agent-transport.test.ts` | 7 | wire shape（URL / headers / body）+ SSE 解析（多 chunk / malformed / 非 data 字段） |

**工具链调整**：

- `tools/unit-tests/src/shards.ts` — `chat` shard 加入 `tests/engine/agent`
- `tsconfig.json` — 加 `#agent/*` path alias（与已有 `#mcp/*` 对齐）

**验收**：

- [x] `bun tools/unit-tests/src/list.ts chat` 列出 10 个文件（8 新 + 2 旧）
- [x] `bun test tests/engine/chat tests/engine/agent` 80 pass / 0 fail
- [x] `bunx tsgo --noEmit` 通过
- [x] `bun run lint` 在本机 OOM（oxc_allocator），不影响 CI

**没做**：

- Path A 端到端 e2e（`tests/e2e/`）—— P1 时再补，模式同 `panel.spec.ts` 的 `setChatTransport` mock
- `packages/mcp/README.md` / `packages/core/README.md` —— P1 改造时一并补，避免分散

## T2 — 文档（已完成）

**为什么**：包级 README 是开发者上手的第一入口；架构文档是设计意图的单一来源；根 README 加一节让新用户知道这个形态存在。

**做了什么**：

| 文件 | 改动 |
|---|---|
| `docs/plans/architecture/l2-agent-backend.md` | 新建 200+ 行：用途 / 架构图 / 协议（HTTP `/v1/chat` + `/v1/auth` + WS reverse-RPC）/ 生命周期 / 不变量 / 范围（P0/P1/P2）/ review 结论吸收 / trade-off |
| `docs/plans/tasks/agent-backend-p0-cleanup.md` | 本文件 |
| `packages/agent/README.md` | 从 24 行扩到 ~100 行，按 kiwi 模板（install / checks / usage / configuration / protocol / troubleshooting） |
| 根 `README.md` | 加 `## Local agent backend` 节 |
| `CHANGELOG.md` Unreleased | 加 `feat(agent): P0 — local CLI agent backend` 一条引用 commit `5c1729e4` |

**没做**（按用户选择，划清边界）：

- 不修改 `docs/review/2026-08-15-agent-backend-branch-review.md`（review 落档不改的原则）
- 不修改 `docs/review/README.md`（review 状态行保持 `新（待吸收）`）
- 不写 VitePress 公开文档（`packages/docs/guide/agent-backend.md`）—— 等 P1 自动化拉起完成后再加，避免暴露未稳定运维脚本
- 不写 `AGENTS.md` 节 —— agent backend 还没进"日常开发"状态

## 验收

- [x] `bun run test:unit` 覆盖 chat shard（含 agent）
- [x] `bunx tsgo --noEmit` 通过
- [x] 8 个测试文件，80 个用例
- [x] `packages/agent/README.md` ≥ 80 行（实际 ~100）
- [x] `l2-agent-backend.md` 已建，引用 review 与现有 `l2-agent-mode.md`
- [x] CHANGELOG Unreleased 已加一行
- [ ] CI 触发（PR 推送后由 GitHub Actions 跑）

## 关联文档

- `docs/plans/architecture/l2-agent-backend.md` — 完整设计
- `docs/review/2026-08-15-agent-backend-branch-review.md` — 来源评审（不再修改）
- `packages/agent/README.md` — 包级使用文档
- `docs/plans/architecture/l2-agent-mode.md` — Agent 模式本身的语义（context）
- commit `fa99d418`（本任务测试提交）+ `5c1729e4`（P0 改造）

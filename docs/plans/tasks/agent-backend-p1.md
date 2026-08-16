# Task: P1 — agent backend 体验硬化与凭证下沉

> 日期：2026-08-15
> 状态：计划已批，待开工
> 依据：`docs/review/2026-08-15-agent-backend-branch-review.md` + `docs/plans/architecture/l2-agent-backend.md` §6.2 P1 清单 + P0 复盘里的体验痛点
> 范围：`packages/agent/**`、`src/app/automation/bridge/**`（新增 vite plugin + 测试钩子）、`src/app/ai/chat/{use,agent-transport,browser-bridge}.ts`、`tests/engine/agent/**`、`tests/e2e/chat/**`、`docs/**`、`package.json`
> 不在本轮范围：ACP 真接 Claude Code / 文档所有权反转 / 生图 provider 下沉 / chat state 持久化 / Path A e2e 中除 agent-backend 注入外的扩展

## 背景与目标

P0 把 agent 循环下沉到 Node，端到端跑通后留下 4 类体验痛点（开发期 / 恢复期 / 取消期 / 凭证期）。本轮把这些痛点逐项收掉，让 Path A（agent backend 路径）成为日常开发的默认形态而不是"手动模式"。

**4 个痛点对应 4 个目标**：

1. **开发期** — `bun run dev` 自动拉起 agent，不让 Path B fallback 成为常态
2. **恢复期** — WS 桥死掉后能自动恢复（agent 重启 / 前端重连 / OOM kill 之后无需手动重启）
3. **取消期** — 用户点 stop 时工具 RPC 也被取消，而不是白白消耗 provider 配额
4. **凭证期** — API key 从内存明文迁到 OS keychain，凭证明文不再出现在内存里（哪怕只 1h）

外加一项交叉支撑：**Path A 的 e2e 覆盖** —— 当前 e2e 全部走 Path B（mock transport），新增 `window.openPencil.setAgentBackend` 注入点，让 e2e 也能跑 Path A 端到端（防回归）。

## 总览

| 模块 | 工作量 | 提交粒度 |
|---|---|---|
| T1 — `bun run dev` 自动拉起 agent | 1d | 1 commit |
| T2 — WS 心跳 + 无限重连 + 崩溃主动通知 | 2d | 1 commit |
| T3 — abortSignal 透传到 tool handler | 1d | 1 commit |
| T4 — 凭证下沉 OS keychain | 1-2d | 1 commit |
| T5 — Path A e2e + 文档补齐 + CI 验证 | 1d | 1 commit |

总计 ~7-8 工作日，按提交顺序逐 PR review。

---

## T1 — `bun run dev` 自动拉起 agent

**为什么**：当前 `bun run dev` 只跑 Vite，agent 必须手动 `bun run agent:dev` 起。两次操作 + 两个终端 ≈ Path B fallback 常态。

**方案**：参照 `src/app/automation/bridge/vite-plugin.ts` 已有的 `automationPlugin` 模式，新增 `agentPlugin`，挂到 `vite.config.ts`。注意：用户确认"只在 `bun run dev` 时拉起"，tauri dev 和生产部署不纳入。

**做哪些事**：

1. **新建 `src/app/automation/bridge/agent-vite-plugin.ts`** —— 完全对称 `automationPlugin`：
   - `spawn('bun', ['--watch', 'packages/agent/src/start.ts'])`，传 `OPENPENCIL_AGENT_PORT=7601`、`OPENPENCIL_AGENT_HOST=127.0.0.1`、`OPENPENCIL_AGENT_CORS_ORIGINS=http://localhost:1420`
   - `configureServer` 启子进程，`buildEnd` 杀
   - stderr 监听 `EADDRINUSE` 报错（agent 端没有 MCP 那种端口冲突，因为只 7601）
   - 注意：`@open-pencil/agent` 用的是 `dist/start.mjs` 生产产物，但 dev 期应走 `bun --watch src/start.ts`（用户答案"只在 bun run dev 时拉起"已锁定 watch 模式），跟 `agent:dev` 一致

2. **更新 `vite/automation.ts`**（或新建 `vite/agent.ts`）—— 注入 agent plugin
3. **`vite.config.ts`** 注册 agent plugin
4. **新增 `scripts/start-agent-vite.mjs`** —— 给 agent plugin 复用一份 token 生成器（如果需要）

**可观察性**：vite 启动日志加一行 `[agent] spawning bun --watch packages/agent/src/start.ts on :7601`，跟现有 `[MCP]` 风格一致。

**测试**：
- 不做 e2e（vortex 启动检测复杂）
- 加 `tests/engine/agent/agent-vite-plugin.test.ts` 单测：mock `child_process.spawn`，验证 spawn 调用参数（端口 / CORS origin / env vars），验证 EADDRINUSE 触发 kill

**不做**：
- 不在 production 部署场景自动拉起（保留手动 `openpencil-agent` bin）
- 不做 tauri dev 拉起（用户答案锁定只 bun run dev）
- 不改 `bun run agent` / `bun run agent:dev` 脚本（已存在且语义正确）

---

## T2 — WS 心跳 + 无限重连 + 崩溃主动通知

**为什么**：调研发现 agent ↔ frontend bridge 当前没有客户端心跳。server 侧 `wireConnectionHandling` 已有 5s ping/pong，但客户端 `FrontendBridge` 只看 `ws.readyState === OPEN`。结果是：
- agent → frontend 中间断网时，TCP 半死连接要等 5min RPC 超时才暴露
- `authRetries` 上限 5 次后放弃，需要用户手动重启 agent
- 前端 5s `/health` 缓存是唯一健康信号，agent 崩溃后用户发的消息会拿到莫名错误

**做哪些事**：

### T2.1 客户端心跳（agent 端）

`packages/agent/src/bridge/ws-client.ts`：
- 新增常量 `HEARTBEAT_INTERVAL_MS = 15_000`、`HEARTBEAT_TIMEOUT_MS = 30_000`（服务端 pong 超时门限）
- 在 `openSocket` 内 `ws.on('pong', ...)` 把 `lastPong = Date.now()` 记录下来
- `setInterval(heartbeat, HEARTBEAT_INTERVAL_MS)` 触发 `ws.ping()`（client 主动 ping 模式 — 用户答案）
- 每 5s 检查 `now - lastPong > HEARTBEAT_TIMEOUT_MS` → 主动 `ws.terminate()` 触发重连

### T2.2 无限重连 + 重置计数器

- 移除 `AUTH_RETRY_MAX`，改成无限重连
- 退避：1s → 2s → 4s → 8s → 上限 30s（指数退避）
- 在 `connect()` 里 `authRetries = 0`（**修复隐藏 bug**：调研发现 `connect()` 不重置 counter，会让"用过 agent 的中途崩溃"少 2-3 次重试机会）

### T2.3 崩溃主动通知前端

`FrontendBridgeEvents` 加 `stale: []` 事件：
- heartbeat 检测到 3 次连续 miss pong 后 emit `'stale'`
- 路由层 `routes/chat.ts` 订阅 `'stale'` → 立即调用 `disposeBridge()` + reset module state，使下一次 chat 直接 503（LLM 拿到明确错误）
- **新事件 vs SSE 流中断**：当 agent 进程崩溃但 SSE 流未断时，前端从 `http-agent-transport` 的 SSE 不会收到事件，5s 健康缓存过期才暴露。T2.3 之后，前端 `agentBackend` ref 可以订阅一个 agent 进程的"健康状态"流（通过现有 /health polling 收紧到 1s 检测 stale），更早让 UI 反映。

### T2.4 前端订阅 stale

`src/app/ai/chat/agent-transport.ts` 新增 `subscribeAgentHealth(listener)` API（纯前端）—— 把 PROBE_TTL_MS 从 5s 缩到 1s（stale 期间），正常后恢复 5s。

**测试**：
- `tests/engine/agent/bridge-ws-client.test.ts` 扩充用例：
  - 客户端发 ping，服务端 pong，`stale` 不触发
  - 服务端 3 次不响应 pong → 客户端触发 `terminate` + 重连 + emit `'stale'`
  - 显式 `connect()` 后 `authRetries = 0`（修复验证）
  - 指数退避：第 1 次 1s、第 2 次 2s、第 3 次 4s（用 `setSystemTime` + 检查定时器触发时间）

**不做**：
- 不改 `BRIDGE_RPC_TIMEOUT_MS`（已 300s 合理）
- 不改 `wireConnectionHandling`（server 端已 OK）
- 不在前端做反向 ping（用户答案锁定 client-only ping）

---

## T3 — abortSignal 透传到 tool handler

**为什么**：调研发现：
- 路径 A（agent backend）：`stop()` → `AbortController.abort()` → `fetch` signal abort → SSE body close。但 in-flight 工具 RPC 不会被取消，仍在前端跑到完成（5min 超时为止）。白白消耗 image-gen / 文件 IO 等耗时操作的 provider 配额。
- 路径 C（ACP，已有 `acp/transport.ts:179-182`）：已经实现 `connection.cancel({ sessionId })` —— 是模板。

**做哪些事**：

### T3.1 RPC envelope 加 abort 通知

`packages/mcp/src/browser-rpc.ts` 接受新 envelope：`{type:'abort', id:<rpcId>}`：
- 找到 pending 中对应 id 的 entry
- 调 `frontend handler abort()`（具体机制见下）
- 返回 `{type:'response', id, ok:false, error:'aborted by agent'}`

`packages/agent/src/bridge/ws-client.ts`：
- `sendRPC` 返回的 promise 加一个 `cancel()` 方法（`AbortController` 包裹）
- `abortSignal` 参数透传进 `tools-bridge.ts`：当 signal abort → 发 `{type:'abort', id:<rpcId>}` 给 server

### T3.2 前端 tool handler 接受 abort

`src/app/automation/bridge/handlers/` —— 检查现有 tool handler（`tool-handlers.ts` 之类的）是否已经是 `async (args, ctx)` 签名带 abort controller：
- 如果是：让 handler 内的耗时操作（image fetch、proxy writes）监听 ctx.signal
- 如果否：在 RPC dispatch 处增加 `AbortController`，abort 时 `controller.abort()`

### T3.3 agent-loop 透传 abortSignal 到 tools

`packages/agent/src/agent-loop.ts` 的 ToolLoopAgent 配置：`execute` 包装时接收 `options.abortSignal`，转给 `bridge.sendRPC(..., { signal })`。

`packages/agent/src/tools-bridge.ts:49-59`：`bridgeToolsToAI` 给每个工具的 `execute` 加 `async (args, options) => bridge.sendRPC('tool', {name, args, signal: options.abortSignal})`。

**测试**：
- `tests/engine/agent/bridge-ws-client.test.ts` 新增：`sendRPC` 返回的 promise 有 `cancel()`，调用后 RPC 走 abort envelope
- `tests/engine/agent/routes-chat.test.ts` 新增：客户端 abort signal abort 后，agent 不再发后续 chunk
- `tests/engine/chat/http-agent-transport.test.ts` 扩充：`abortSignal` abort 后 SSE stream `cancel()` 触发

**不做**：
- 不动 Path B（in-browser `DirectChatTransport`），工具同步执行无 cancel 语义
- 不把 `image-gen` 之类的 provider 改造成可中途取消（provider API 不支持）
- 不做 ACP path 改造（已支持）

---

## T4 — 凭证下沉 OS keychain

**为什么**：当前 agent 端 `credentials.ts` 把 API key 明文存内存 1h。用户答案锁定 `@napi-rs/keyring`（napi-rs 实现，跨平台，无需 node-gyp）。

**做哪些事**：

### T4.1 引入 @napi-rs/keyring

- `packages/agent/package.json` 加 `@napi-rs/keyring` 依赖
- 本地 `bun add @napi-rs/keyring` 验证 install 通畅

### T4.2 抽象 CredentialStore 接口

`packages/agent/src/credentials.ts` 改造：

```ts
export interface CredentialStore {
  put(connectionId: string, apiKey: string): Promise<{ expiresIn: number }>
  consume(connectionId: string): Promise<string | null>
  forget(connectionId: string): Promise<void>
  activeCount(): Promise<number>
}
```

新增 `KeychainCredentialStore` 实现（用 `@napi-rs/keyring`）：
- service 名：`net.openpencil.agent-credentials`（与 Tauri 侧 `net.dannote.open-pencil.credentials` 不同命名空间，因为 Rust 端 service 是给 Tauri app 用，Node 端 service 是给 agent 用）
- account 名：`openpencil:agent:${connectionId}`
- 存储值：`<expiresAtMs>:<apiKey>` —— keychain entry 不支持 metadata，必须把 TTL 内嵌进 value

新增 `MemoryCredentialStore` —— 把当前 Map 实现迁过来（测试 + fallback 用）。

工厂 `createCredentialStore()`：默认 Keychain；如果 keyring 不可用（无 GUI session / Linux 无 dbus）→ 降级 Memory + console.warn。

### T4.3 异步化 credentials.ts 调用方

`routes/auth.ts` + `routes/chat.ts` 改 `await`：
- `putCredential` → `await store.put(...)`
- `consumeCredential` → `await store.consume(...)`
- `forgetCredential` → `await store.forget(...)`

`/health` endpoint 仍返回 `activeConnections`，但 `activeCount()` 现在是 async → healthRoute 改 `async`。

### T4.4 进程间安全考虑

- 文档化："keychain entry 进程退出后仍在；TTL 过期检查在前端 consume 时做"
- 前端 `forgetCredential` 调 `keychain.delete()`，但用户重启 agent 进程后 keychain entry 还在 → 下次 `consume` 时发现过期（value 头部 expiresAtMs < Date.now()）→ 当作 miss → 401 → 前端重新 POST `/v1/auth`

**测试**：
- `tests/engine/agent/credentials.test.ts` 改造：所有用例改为 async；新增 `KeychainCredentialStore` 用真实 keyring 的 integration test（标记 `process.env.RUN_KEYRING_TESTS=1` 时启用，平时 mock keyring 模块）
- `tests/engine/agent/routes-auth.test.ts` + `routes-chat.test.ts` 改 await 形式

**不做**：
- 不做端到端"agent 重启后 key 还在"的 e2e（keychain 行为依赖 OS，CI 不跑）
- 不删旧的 `putCredential`/`consumeCredential` 同步版本（保留作 deprecation shim 1 个 release 后再删）

---

## T5 — Path A e2e + 文档 + CI 验证

**为什么**：当前 e2e 全走 Path B，Path A 的 SSE wire shape / provision credential / abort 流程全靠手动验证。用户答案：扩 `window.openPencil.setAgentBackend` 注入点 + 写一个 e2e spec。

**做哪些事**：

### T5.1 setAgentBackend 注入点

`src/app/browser-bridge.ts`：`OpenPencilWindowAPI` 加 `setAgentBackend(info: AgentBackendInfo | null): void`：
- 注入时直接覆盖 `use.ts` 里 `agentBackend` ref + `resetAgentBackendCache()`
- 注入 `null` 时还原 probe-based 行为

`src/app/ai/chat/agent-transport.ts`：`probeAgentBackend` 之前查 `window.openPencil?.test?.forcedAgentBackend`（如果 setAgentBackend 设置了）—— 跳过 HTTP probe，直接返回。

### T5.2 e2e spec

新建 `tests/e2e/chat/agent-backend.spec.ts`：
- 不起真 agent 子进程（CI 稳定性 + Windows CI 慢），改用 `Bun.serve` mock 一个 Hono 应用：返回 `/health` 200、`/v1/auth` 200、`/v1/chat` 走 SSE 发 `{type:'start'}, {type:'text-delta', delta:'mock agent response'}, {type:'finish'}` —— 跟 `panel.spec.ts` 的 mock transport 模式类似
- spec 流程：
  1. `await page.exposeFunction('mockAgentUp', () => mockAgentPort)` + `await page.evaluate(() => window.openPencil.setAgentBackend({...}))`
  2. 切到 AI tab，配 API key
  3. 发消息，断言看到 "mock agent response"
  4. 验证 `POST /v1/auth` 被命中（mock 服务端断言）
  5. 验证 `POST /v1/chat` 被命中

### T5.3 文档补齐

- `packages/agent/README.md`：更新 Troubleshooting 段（加 WS reconnect 行为 / keychain 后备方案说明）
- `packages/mcp/README.md` / `packages/core/README.md`：新建（用户 P0 cleanup 时延后）
- `docs/plans/architecture/l2-agent-backend.md` §6.2 P1 列表逐项标记完成 + commit SHA
- `docs/plans/README.md` review 状态行更新：吸收进 agent-backend-p1（按 P0 cleanup 同样的"review 状态行"原则）
- `CHANGELOG.md` Unreleased 加 5 条新 commit 的 feat/fix 条目

### T5.4 CI 验证

- `bun run test:unit` 跑通 chat shard（应包含新增的 agent-vite-plugin / 扩充的 bridge-ws-client / 异步 credentials 用例）
- `bun run check` 通过
- 触发 PR 跑 GitHub Actions 的 unit-tests job

---

## 提交策略

按 T1-T5 各一个 commit：

1. **`feat(dev): auto-spawn agent backend on bun run dev`**（T1）
2. **`feat(bridge): heartbeat + exponential-backoff reconnect + stale signal`**（T2）
3. **`feat(agent): propagate abortSignal to bridge RPC and tool handler`**（T3）
4. **`feat(agent): persist credentials via OS keychain (@napi-rs/keyring)`**（T4）
5. **`test(agent): Path A e2e + docs(agent): P1 hardening changelog`**（T5，2 个主题合并到一 commit，文档与测试同源）

每个 commit 前必须 `bun run check` + `bun run test:unit` 通过。

---

## 不在本轮范围（划线）

- ACP 真接 Claude Code 进程（已确认本 fork 不做）
- 文档所有权反转（marketing library 从前端迁到 agent store）
- 生图 provider 下沉到 agent
- chat state 持久化（agent 重启不丢历史）
- Path A 之外的 e2e 扩展（multi-tab / Tauri 模式）
- Linux Wayland session 下 keyring 不可用的 UI 提示（console.warn 足够）
- WS server 侧（mcp/browser-rpc.ts）的 ping 改动（已 OK）

---

## 风险

| 风险 | 缓解 |
|---|---|
| T1 vite plugin 在 Windows spawn `bun --watch` 不稳 | 跟 MCP plugin 共用同一 spawn 模式，MCP 已验证 Windows OK |
| T2 无限重连 + 指数退避在 dev 期太激进导致 agent 启动风暴 | 设最大 30s 间隔 + 显式 `disconnect()` 不重连 |
| T3 abort 透传破坏现有 tool handler 契约 | 先扫所有 tool handler 的签名（grep），确认都是 `(args, ctx)` 或 `(args)`，再定改造策略 |
| T4 `@napi-rs/keyring` 在 Windows CI 装不上 | fallback Memory store + 显式 warn。CI 跑通 Memory 路径，integration test 留作本地 |
| T5 e2e mock 服务端会被 lint 规则误判为"未使用的变量" | 模仿 `panel.spec.ts` 的 injectMockTransport 写法，已验证 OK |

---

## 工时估算

| 模块 | 工时 |
|---|---|
| T1 vite plugin | 1d |
| T2 WS heartbeat + 重连 | 2d |
| T3 abortSignal 透传 | 1d |
| T4 OS keychain | 1-2d |
| T5 e2e + 文档 + CI | 1d |
| **总计** | **~7-8 工作日** |

按每天一个 commit 节奏，最快一周交付。可中途穿插 review 反馈调整。

---

## 关联文档

- `docs/plans/architecture/l2-agent-backend.md` — P0 设计，本任务改造范围在其 §6.2
- `docs/review/2026-08-15-agent-backend-branch-review.md` — 评审结论来源（不再修改）
- `docs/plans/tasks/agent-backend-p0-cleanup.md` — 上一个 task（本任务的直接前置）
- `docs/plans/architecture/l2-agent-mode.md` — Agent 模式本身的设计
- `src/app/automation/bridge/vite-plugin.ts` — T1 的直接模板
- `src/app/ai/acp/transport.ts:179-182` — T3 的直接模板（abort 处理）

# 本地 Agent 后端：架构与协议

> 本文档定义 OpenPencil "本地 CLI 后端 + localhost Web UI" 形态下 AI agent 循环下沉到本地 Node 进程的设计。**状态与任务进度见 `../README.md`（唯一状态来源）**；评审记录见 `../../review/`。

## 1. 用途

把 AI agent 循环（ToolLoopAgent、provider 调用、elision、prompt 拼装、library snapshot 解析）从浏览器进程移到一个独立的本地 Node 服务，让 Web 版 AI chat 跑在 localhost 上的同时，**不再受限于 CORS / Anthropic 浏览器危险头 / 凭证安全 三大痛点**。工具执行仍在前端，避免破坏 figma 上下文、Undo 与 UI 钩子。

## 2. 架构

```
┌────────────────────────────────────────────────────────────────────┐
│  browser (localhost:1420)                                           │
│                                                                    │
│   src/app/ai/chat/transports.ts  ── Path A 命中 → http-agent-transport│
│   src/app/ai/chat/use.ts  ── probe /health on 7601                │
│   src/app/automation/mcp/*  ── 现有 WS 桥（packages/mcp/src）        │
│                                                                    │
│         │  HTTP /v1/chat (SSE)                                     │
│         ▼                                                           │
│  ─────────────────────────  localhost loopback  ──────────────────── │
│         │                                                           │
│         ▼                                                           │
│  agent 进程 (localhost:7601)                                        │
│                                                                    │
│   packages/agent/src/server.ts         Hono + @hono/node-server    │
│   packages/agent/src/agent-loop.ts      ToolLoopAgent.stream()      │
│   packages/agent/src/credentials.ts     内存 Map，1h TTL            │
│   packages/agent/src/elision.ts         mirror of frontend         │
│   packages/agent/src/prompts/          system + marketing overlays │
│                                                                    │
│         │  WS reverse-RPC (auth + request)                          │
│         ▼  (port 7600 / unix socket — discovery)                   │
│                                                                    │
│   packages/agent/src/bridge/ws-client.ts →  →  →  ─┐               │
│                                                    │               │
│  ┌─────────────────────────────────────────────────│───────────┐   │
│  │  frontend mcp server (already running, no change)          │   │
│  │  packages/mcp/src/browser-rpc.ts                            │   │
│  │       ←  dispatch to existing tool handlers ────→           │   │
│  │       figma.createImage / createNode / etc.                 │   │
│  └─────────────────────────────────────────────────────────────�   │
│                                                                    │
│         │                                                           │
│         ▼  HTTPS (server-to-server)                                 │
│   LLM provider  (Anthropic / OpenAI / Google / dmxapi / ...)         │
└────────────────────────────────────────────────────────────────────┘
```

## 3. 协议

### 3.1 HTTP `/v1/chat`

请求：

```http
POST /v1/chat HTTP/1.1
Host: 127.0.0.1:7601
Content-Type: application/json
x-op-connection-id: web-<uuid>
x-op-chat-id: web-tab-<n>

{
  "id": "web-tab-<n>",
  "messages": [ /* ModelMessage[] — converted via convertToModelMessages in the frontend transport */ ],
  "trigger": "submit-message",
  "agent": {
    "connectionId": "web-<uuid>",
    "providerID": "anthropic",
    "modelID": "claude-sonnet-4-5",
    "customModelID": "",
    "customBaseURL": "",
    "customAPIType": "completions",
    "maxOutputTokens": 4096,
    "chatMode": "design",
    "lookImagesKept": 0
  },
  "librarySnapshot": { /* null when chatMode='design' or no library bound */
    "userPickedProfileId": "p-bold",
    "types": [/* ... */],
    "profiles": [/* ... */],
    "references": [/* ... */],
    "hasReferencesPage": false
  }
}
```

响应：`text/event-stream` 标准 SSE，`x-vercel-ai-data-stream: v1`，每行 `data: <UIMessageChunk JSON>\n\n`。

### 3.2 HTTP `/v1/auth`

| 方法 | 路径 | 请求体 | 响应 |
|---|---|---|---|
| `POST` | `/v1/auth` | `{ connectionId, apiKey }` | `{ ok: true, expiresIn: 3600 }` |
| `DELETE` | `/v1/auth/:connectionId` | — | `{ ok: true }` |

凭证明文存于内存 Map（`credentials.ts`），1h TTL，由前端在打开 chat 时推一次；进程重启即丢。**P1 计划下沉到 OS keychain**。

### 3.3 WebSocket（agent ↔ 前端 mcp server）

agent 端在 `bridge/ws-client.ts#FrontendBridge` 跑：

1. 打开 WS 到 `ws://127.0.0.1:<httpPort>`（Unix 平台优先 Unix socket）
2. 立即发 `{type:'auth', token:<discovery.authToken>}` —— **不是 `register`**（详见 §5.1）
3. 每次工具调用发 `{type:'request', id:<uuid>, command:'tool', args:{name, args}}`
4. 收 `{type:'response', id, ok, result, target}` 解出工具返回值

`result` 是 `toolsToAI.execute(figma, args)` 的返回值，由前端 `tool-handlers.ts` 包成 `{ok:true, result}`。

### 3.4 RPC 超时

`BRIDGE_RPC_TIMEOUT_MS = 300_000`（agent 端，`bridge/ws-client.ts`），`RPC_TIMEOUT = 300_000`（mcp server 端，`packages/mcp/src/browser-rpc.ts`）。覆盖 `imageGenTimeoutMs = 240_000`（`packages/core/src/tools/image-gen/providers.ts`）并留 60s 余量给 WS overhead + 图片字节回传。

## 4. 生命周期

| 阶段 | 行为 |
|---|---|
| 启动 | `node packages/agent/dist/start.mjs` → Hono listen `127.0.0.1:7601` → `writeAgentDiscovery` 写到 `%LOCALAPPDATA%\OpenPencil\agent.json` |
| 前端探测 | `src/app/ai/chat/agent-transport.ts#probeAgentBackend` 5s TTL fetch `/health`，缓存 `AgentBackendInfo` |
| Chat 打开 | `transports.ts:createHttpAgentTransport` 走 Path A：先 `provisionAgentCredential` POST `/v1/auth`，再返回 transport；`connectionId` 来自 `useLocalStorage('open-pencil:agent-connection-id', ...)` |
| 消息 | `http-agent-transport.sendMessages` 转 UI→Model 后 POST `/v1/chat`（SSE），流式回放 UIMessageChunk |
| Chat state | 仅存 agent 进程内存（ToolLoopAgent 实例），**进程重启 = 对话历史丢**；前端 `currentChatMessages` WeakMap 缓存可恢复 UI，但下一条消息会从新 agent 拿 |
| Shutdown | SIGINT/SIGTERM → `disposeBridge` → 关 HTTP → 删 discovery 文件 → exit 0 |

## 5. 不变量

### 5.1 agent 不抢 `browserWs` slot

`packages/mcp/src/browser-rpc.ts:228-237` 只允许一个 `register` 客户端拥有 `browserWs` slot —— 这是工具 RPC 的转发目标。第二个 `register` 会挤掉前端，导致 editor 操作全部 503。

agent 进程**永远发 `auth`，不发 `register`**：`auth` 仅做认证，不占 slot；之后用 `request` 走 mcp server 内部的 RPC 转发逻辑，最终调到 `browserWs`。这条边界由 `bridge/ws-client.ts` 的注释显式声明，并由 `tests/engine/agent/bridge-ws-client.test.ts` 的 "sends an auth envelope" 用例守住。

### 5.2 agent 不能 import SceneGraph / Vue / 前端代码

`packages/agent/src/` 内的 `import` 必须落在 `@open-pencil/core`（公开 API）或 workspace 别名上。**禁止**：
- `import ... from '@/app/...'`（前端 Vue 代码）
- `import ... from '#vue/...'`
- 直接 `import` `SceneGraph` 实例（agent 看到的 graph 是通过 `librarySnapshot` 序列化后的 JSON 子集）

`steiger` 架构规则在 `check:arch` 阶段守住这条边界。

### 5.3 library snapshot 来自前端

agent 永远不接触 editor 的 SceneGraph。marketing 模式下前端 `serializeLibrarySnapshot(store.graph)` 拍平 `userPickedProfileId / types / profiles / references / hasReferencesPage` 五个字段塞进请求 body；后端 `decodeLibrarySnapshot` 验形状后喂给 `prepareCall` 拼 overlay。

形状契约：见 `packages/agent/src/prompts/library-snapshot.ts#LibrarySnapshot` 与 `src/app/ai/marketing/library.ts#serializeLibrarySnapshot`，**两端任何字段变动都必须同步修改**。`tests/engine/agent/prompts-library-snapshot.test.ts` 与 `tests/engine/chat/serialize-library-snapshot.test.ts`（如存在）共同守住。

### 5.4 工具执行始终在前端

agent 的 `bridgeToolsToAI` 把每个工具的 `execute` 替换成 `bridge.sendRPC('tool', {name, args})`。`@open-pencil/core/tools` 里的 `figma` 实例**不**在 agent 进程出现 —— 它只活在前端，前端工具 handler 收到 RPC 后才调用。

后果：
- figma 写操作、Undo、RunState、UI 钩子零侵入
- image 生成 API key、baseURL、provider 配置仍存前端 settings
- 前端停服 / 切 tab → RPC 503，agent 报 503 给 LLM，LLM 看到 "OpenPencil editor is not running"（见 `routes/chat.ts#getBridge` 错误）

## 6. 范围

### 6.1 P0（本轮已做）

- ✅ agent loop 下沉到 `@open-pencil/agent`
- ✅ 双 transport 路径（Path A agent / Path B fallback in-browser）
- ✅ Library snapshot 走请求体 JSON
- ✅ CORS 默认放行 dev server origin（`OPENPENCIL_AGENT_CORS_ORIGINS=none` 可关）
- ✅ RPC envelope 300s（覆盖 240s 图片生成）
- ✅ 80 个单测覆盖 credentials / routes / bridge / SSE parse / elision / snapshot / CORS
- ✅ review 7 个问题全部修复（C1-C3 / M1-M4 / m3），见 §7

### 6.2 P1（下一轮）

| 项 | 理由 |
|---|---|
| `bun run dev` 自动拉起 agent | 否则 Path B fallback 成为常态 |
| WS 桥心跳 + 重连 | agent 进程被 OOM kill / 切换网络后自动恢复 |
| 前端 abortSignal 透传到 tool handler | 用户取消时节省 provider 配额 |
| Agent 崩溃时主动通知前端 | 当前 5s 缓存过期才暴露，期间用户发消息会拿到莫名错误 |
| `bun run agent` / `bun run agent:dev` 脚本 | 跟 mcp 一样的入口约定 |
| 凭证下沉 OS keychain | 消除"凭证明文内存"最后痛点 |
| 单测 + e2e 持续补 | 本轮已补 80 个；P1 加 Path A 的 e2e（`window.openPencil.setAgentBackend(info)` mock）|

### 6.3 P2 / P3（不做 / 留待后续）

- ACP 真接 Claude Code 进程 — **本 fork 不做**（已确认聚焦内置 agent 模式）
- 文档所有权反转（marketing library 从前端迁到 agent store） — 大重构
- 生图 provider 下沉到 agent — 解耦前端 provider 凭证

## 7. Review 结论吸收

`docs/review/2026-08-15-agent-backend-branch-review.md` 在 P0 合并时记的 7 个问题，全部已修复，commit `5c1729e4`：

| ID | 严重度 | 摘要 | 修复位置 |
|---|---|---|---|
| C1 | 🔴 | `@ts-expect-error` 误用 | `src/app/ai/chat/transports.ts` + `src/app/ai/chat/agent-transport.ts`（用 `void getActiveEditorStore` 引用规避） |
| C2 | 🔴 | `getChatId` 误用 `currentPageId`（per-page 而非 per-tab） | `src/app/ai/chat/transports.ts#getChatId` 改用 `getTabForStore(store).id` |
| C3 | 🔴 | `LibrarySnapshot` 形状与前端不对齐 | `packages/agent/src/prompts/library-snapshot.ts` 重写为 `userPickedProfileId + types/profiles/references/hasReferencesPage`；`src/app/ai/marketing/library.ts` 同步 |
| M1 | 🟡 | `resolveAPIKey` null 路径无清晰错误 | `src/app/ai/chat/transports.ts` Path A 加 `if (!apiKey) throw new Error(...)` |
| M2 | � | agent 与前端 `MEDIA_OUTPUT_TOOLS` 可能漂移 | `packages/agent/src/elision.ts` 改为 `import { MEDIA_OUTPUT_TOOLS } from '@open-pencil/core/tools'`；单测守住 |
| M3 | 🟡 | `credentials.ts` 无单测 | `tests/engine/agent/credentials.test.ts`（11 个用例） |
| M4 | 🟡 | `RPC_TIMEOUT` 20s 偏紧 | `packages/mcp/src/browser-rpc.ts` 与 `packages/agent/src/bridge/ws-client.ts` 同时提到 300s |
| m3 | 🟢 | `authRetries++` 在 `open` 内计数会双倍消耗 | 移到 `close` 处理器内单点计数 |

review 文档本身保持 immutable（`../README.md` line 6 原则），不修改。

## 8. 已知 trade-off

### 8.1 痛点消除进度

| 痛点 | 状态 | 说明 |
|---|---|---|
| CORS | ✅ 消除 | agent → provider 走 Node，无 CORS |
| Anthropic 浏览器危险头 | ✅ 消除 | 同上 |
| 凭证安全 | ⏸ P0 妥协 | 1h TTL 明文内存；真消除要 P1 走 OS keychain |
| vLLM 流式 bug | N/A | 你不用 vLLM provider；该痛点原本是 AI SDK 上游问题，与本改造无关 |

### 8.2 架构层代价

| 代价 | 缓解 |
|---|---|
| Chat state 仅存 agent 进程内存，重启丢历史 | 前端 WeakMap 缓存可恢复 UI；下一条消息是新 agent；用户接受 "刷新页面即新会话" 的现实 |
| 双进程调试（vite + agent） | `bun run dev` 一键拉 vite；agent 手动启；P1 自动拉起 |
| 单测覆盖不到 Path A 端到端 | e2e `tests/e2e/chat/panel.spec.ts` 通过 mock transport 覆盖 Path B；Path A 留到 P1 |
| abortSignal 不能跨进程 | 当前 cancel 只能截断 SSE 流，前端工具 handler 还会跑完；P1 透传 |

## 9. 关联文档

- `docs/plans/architecture/l2-agent-mode.md` — Agent 模式本身的语义、流程、约束
- `docs/plans/architecture/l2-context-engineering.md` — Library snapshot 来源（context engineering）
- `docs/review/2026-08-15-agent-backend-branch-review.md` — 本设计的来源评审
- `packages/agent/README.md` — 包级使用文档（启停 / 配置 / 排错）
- `src/app/ai/chat/transports.ts` — Path A / Path B 路由
- `src/app/ai/chat/http-agent-transport.ts` — 手写 ChatTransport

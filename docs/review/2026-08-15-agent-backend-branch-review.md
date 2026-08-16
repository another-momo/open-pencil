# Agent Backend 分支 Review（2026-08-15）

> 评审对象：`feature/agent-backend` 分支的完整改动范围——新增 `packages/agent`（~17 源文件 / ~1100 LOC）+ 前端接入层（2 个新文件 + 5 个修改文件），实现"无头编排器 + WebSocket 反向 RPC"的本地 Agent 后端架构。
> 评审范围：架构设计（分层边界、通信模型、凭证流）+ 实现质量（错误处理、并发安全、类型正确性）+ 工程规范（测试覆盖、代码重复、命名约定）+ 真实缺陷清单。依据 = 全量 diff + 源文件逐行核对 + 既有评审约定对照。
> 评审结果：**架构方向正确、分层克制、实现质量中上**。核心价值在于"后端不碰 SceneGraph，工具执行全部反向 RPC 回前端"的干净边界。主要风险：① 3 个 Critical 级缺陷（`@ts-expect-error` 阻塞 TypeScript、`getChatId` 用 pageId 而非 documentId 导致切页丢对话、`buildMarketingOverlay` 前后端语义不一致）；② 零测试覆盖（~1100 新 LOC 无任何单测）；③ 凭证空值路径产生不透明 500 错误。

---

## 一、改动范围（分支全景）

### 1.1 新增：`packages/agent`（Node.js Agent 后端）

| 文件 | 职责 | LOC |
|---|---|---|
| `server.ts` | Hono HTTP 服务器 + 启动生命周期 + 进程发现文件写入 | 73 |
| `agent-loop.ts` | Vercel AI SDK `ToolLoopAgent` 组装（模型、工具、提示词、elision、media rewrite） | 149 |
| `tools-bridge.ts` | 将 `CORE_TOOLS` 转为 AI SDK tool，`execute` 替换为 WebSocket RPC | 78 |
| `bridge/ws-client.ts` | WebSocket 反向 RPC 客户端（认证、多路复用、超时、自动重连） | 209 |
| `credentials.ts` | 内存凭证注册表（1h TTL，前端持有密钥、后端不持久化） | 47 |
| `model-resolver.ts` | `LanguageModel` 工厂（委托 provider registry） | 26 |
| `catalog.ts` | 从 models.dev 获取模型目录（24h 磁盘缓存） | ~120 |
| `discovery.ts` | 平台特定进程发现文件（原子写入 + PID 存活检查） | 103 |
| `elision.ts` | 图像上下文裁剪（保留最新 K 张，替换旧图为文本占位符） | 80 |
| `media-rewriter.ts` | chat-completions provider 的 media tool result 改写 | 156 |
| `provider-helpers.ts` | Provider 能力检测（image-as-user-message / Anthropic cache） | 39 |
| `providers/registry.ts` | 10+ provider 适配器注册表 | 70 |
| `providers/compatible.ts` | OpenAI/Anthropic 兼容适配器工厂 | ~80 |
| `prompts/index.ts` | 系统提示词组装 + marketing overlay 导出 | 18 |
| `prompts/library-snapshot.ts` | `LibrarySnapshot` 类型定义 + `buildMarketingOverlay` 纯函数 | 101 |
| `routes/chat.ts` | `POST /v1/chat` 流式端点（核心路由） | 145 |
| `routes/auth.ts` | `POST /v1/auth` + `DELETE /v1/auth/:id` 凭证管理 | 35 |
| `routes/health.ts` | `GET /health` 健康检查 | ~15 |
| `routes/catalog.ts` | `GET /v1/catalog/resolve` 模型目录查询 | 22 |

### 1.2 新增：前端接入层

| 文件 | 职责 |
|---|---|
| `src/app/ai/chat/agent-transport.ts` | Agent 后端探测（5s TTL 缓存）、凭证推送、连接 ID 管理 |
| `src/app/ai/chat/http-agent-transport.ts` | 基于 `DefaultChatTransport` 的 HTTP 代理传输层 |

### 1.3 修改：前端现有文件

| 文件 | 改动 |
|---|---|
| `src/app/ai/chat/transports.ts` | 新增 Path A（agent 后端可达时走 HTTP 代理）/ Path B（fallback 到浏览器内 ToolLoopAgent） |
| `src/app/ai/chat/use.ts` | Agent 后端探测初始化 + 配置变更时重新探测 + `agentBackend` ref 暴露 |
| `src/app/ai/marketing/library.ts` | 新增 `LibrarySnapshot` 类型 + `serializeLibrarySnapshot()` 序列化函数 |
| `packages/core/src/tools/ai-adapter.ts` | 导出 `MEDIA_OUTPUT_TOOLS` 和 `paramToValibot`（供 agent 包使用） |
| `packages/core/src/tools/index.ts` | Re-export 新导出 |
| `package.json` | 添加 `packages/agent` workspace + `agent` / `agent:dev` scripts |
| `bun.lock` | 锁定 agent 包依赖 |

---

## 二、架构评审

### 2.1 核心设计：无头编排器 + WebSocket 反向 RPC

```
┌─────────────────────────────────────────────────────┐
│  浏览器前端 (Vue 3 + CanvasKit)                      │
│                                                     │
│  ┌─────────────┐    ┌──────────────────────────┐   │
│  │ Chat UI     │───▶│ HttpAgentTransport        │   │
│  │ (use.ts)    │    │ POST /v1/chat (SSE)       │   │
│  └─────────────┘    └──────────┬───────────────┘   │
│                                │                    │
│  ┌─────────────────────────────▼──────────────┐   │
│  │ 自动化 WebSocket 桥 (port 7600)              │   │
│  │ - 接收 tool RPC 请求                         │   │
│  │ - 执行 SceneGraph 操作                       │   │
│  │ - 返回 { ok, result }                        │   │
│  └─────────────────────────────▲──────────────┘   │
│                                │                    │
└────────────────────────────────┼────────────────────┘
                                 │ WebSocket (反向连接)
┌────────────────────────────────┼────────────────────┐
│  Agent 后端 (Node.js, port 7601)                    │
│                                │                    │
│  ┌─────────────────────────────┴──────────────┐   │
│  │ FrontendBridge (ws-client.ts)               │   │
│  │ - 认证为 secondary client                    │   │
│  │ - 多路复用 tool RPC                          │   │
│  │ - 30s 超时 + 5 次自动重连                     │   │
│  └─────────────────────────────▲──────────────┘   │
│                                │                    │
│  ┌─────────────────────────────┴──────────────┐   │
│  │ ToolLoopAgent (agent-loop.ts)               │   │
│  │ - Vercel AI SDK streamText                  │   │
│  │ - tools-bridge: execute → WS RPC            │   │
│  │ - elision + media-rewriter                  │   │
│  │ - marketing overlay (from snapshot header)  │   │
│  └────────────────────────────────────────────┘   │
│                                                     │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────┐ │
│  │ Provider    │  │ Credential   │  │ Discovery│ │
│  │ Registry    │  │ Store (1h)   │  │ File     │ │
│  └─────────────┘  └──────────────┘  └──────────┘ │
└─────────────────────────────────────────────────────┘
```

**设计亮点**：

1. **SceneGraph 零接触**：Agent 后端从不导入或操作 SceneGraph。所有工具执行通过 WebSocket RPC 回传前端，前端的自动化桥已有完整的 SceneGraph 操作封装。这避免了后端需要加载 .fig 文件、维护独立 SceneGraph 实例的复杂性。

2. **凭证不落地**：前端持有 API Key（通过 CredentialStore），后端仅在内存中暂存（1h TTL）。后端重启后前端重新推送。这符合 P0 阶段"本地 CLI 后端 + 本地 Web UI"的安全模型。

3. **SDK 兼容传输**：`createHttpAgentTransport` 基于 AI SDK 的 `DefaultChatTransport`，返回标准 SSE 流。前端消费方式与浏览器内路径完全一致，SDK 升级不会破坏。

4. **进程发现**：后端写入平台特定位置的 JSON 文件（macOS ~/Library, Windows %LOCALAPPDATA%, Linux $XDG_RUNTIME_DIR），前端通过 MCP discovery 读取。原子写入 + PID 存活检查。

### 2.2 双路径路由（Path A / Path B）

`transports.ts` 中的 `createTransport()` 实现了双路径：

- **Path A**（agent 可达）：`getAgentBackend()` 返回非 null → 创建 `HttpAgentTransport` → 后端编排
- **Path B**（agent 不可达）：fallback → 浏览器内 `ToolLoopAgent`（原有行为）

路由判定基于 5s 缓存的探测结果。配置变更时缓存失效并重新探测。

---

## 三、缺陷清单

### 🔴 Critical（阻塞合并）

#### C1: `@ts-expect-error` 指令错误 — 阻塞 TypeScript 编译

**位置**：`src/app/ai/chat/transports.ts:34`

```ts
// @ts-expect-error -- used at runtime via destructure + closure call site
import { getActiveEditorStore, type EditorStore } from '@/app/editor/active-store'
```

**问题**：`active-store/index.ts` 同时导出 `getActiveEditorStore`（value，line 18）和 `type EditorStore`（type，line 5）。`{ getActiveEditorStore, type EditorStore }` 是合法的 TypeScript 内联类型注解语法。不存在需要抑制的错误。`@ts-expect-error` 指令本身会触发 TS2578（Unused `@ts-expect-error` directive）。

**根因**：旧代码使用 `import type { getActiveEditorStore }` + `ReturnType<typeof getActiveEditorStore>` 派生类型。新写法正确但残留了错误的抑制指令。

**修复**：删除第 34 行的 `// @ts-expect-error` 注释及其下方的 comment。

---

#### C2: `getChatId` 使用 pageId 而非 documentId — 切页丢失对话

**位置**：`src/app/ai/chat/transports.ts:291-296`

```ts
function getChatId(store: EditorStore): string {
  // Per-document chat session id — the backend keeps an in-memory
  // ToolLoopAgent per chatId so re-connects resume instead of starting over.
  const pageId = store.state.currentPageId ?? 'default'
  return `web-${pageId}`
}
```

**问题**：注释声称是"Per-document chat session id"，但实现使用 `currentPageId`（页面标识符），而非文档/文件标识符。用户在同一文档内从页面 1 切换到页面 2 时，`chatId` 变化，Agent 后端创建全新的 `ToolLoopAgent`，对话上下文丢失。

**影响**：用户在多页文档中工作时，每次切换页面都会丢失 AI 对话历史。

**修复**：使用文档级标识符（如文件路径或文档 ID）替代 pageId。例如：

```ts
function getChatId(store: EditorStore): string {
  const docId = store.state.documentId ?? store.graph.id ?? 'default'
  return `web-${docId}`
}
```

---

#### C3: `buildMarketingOverlay` 前后端语义不一致

**位置**：前端 `src/app/ai/marketing/library.ts:218-276` vs Agent `packages/agent/src/prompts/library-snapshot.ts:43-100`

**语义差异对照**：

| 行为 | 前端 (library.ts) | Agent (library-snapshot.ts) |
|---|---|---|
| Profiles 目录 | 用户未选时不展示 | 始终展示（含空态） |
| Active profile | 用户选中且存在时展示 | 始终展示（含"No style profile"回退） |
| "Profile not in library" | 展示错误状态 | 未处理 |
| Types 空态 | 特殊提示词（引导用户操作） | 简单空文本 |
| References | 不在 overlay 中展示 | 始终展示 |
| 前导换行 | `\n\n${parts.join('\n\n')}` | `sections.join('\n')`（无前导换行） |

**问题**：Agent 版本暴露了更多信息（完整 profile 目录、未选择时的 profile 区段、references 区段），与前端版本的"最小信息"策略不一致。这导致 Path A（agent）和 Path B（浏览器）的 AI 行为可能不同——agent 路径下 LLM 可能看到用户尚未选择的 profiles，或在前端本应忽略时引用了 references。

**修复**：统一两侧的 `buildMarketingOverlay` 语义。建议以前端版本为基准（信息更克制），将 agent 版本对齐。注释已标注"Mirrored from..."但实际实现有差异。

---

### 🟡 Major（应修复后合并）

#### M1: `resolveAPIKey()` null 传播产生不透明 500 错误

**位置**：`src/app/ai/chat/transports.ts:251-252`

```ts
const apiKey = await resolveAPIKey()
await provisionAgentCredential(agentInfo, apiKey)
```

**问题**：`resolveAPIKey()` 返回 `Promise<string | null>`（不抛异常）。`provisionAgentCredential` 在 `apiKey` 为 null 时静默返回。随后 `createAgent()` 调用 `consumeCredential(connectionId)` 返回 null，抛出 `"API key not available — POST /v1/auth first"`。chat 路由返回 500。

**对比**：Path B（浏览器内）会在 `isConfigured` 检查阶段就展示配置 UI；Path A（agent）静默失败后返回不透明服务器错误。

**修复**：在 `createTransport` 的 Path A 中提前检查：

```ts
const apiKey = await resolveAPIKey()
if (!apiKey) {
  throw new Error('API key not configured — set it in Settings before chatting through the agent backend')
}
```

---

#### M2: `MEDIA_OUTPUT_TOOLS` 在 3 处独立定义

| 位置 | 文件 |
|---|---|
| `packages/core/src/tools/ai-adapter.ts:139` | 已导出 |
| `src/app/ai/chat/elision.ts:15` | 本地副本 |
| `packages/agent/src/elision.ts:11` | 本地副本 |

**问题**：新增 media 工具时需同步更新 3 处。agent 包的 `tools-bridge.ts` 已从 core 导入，但 `elision.ts` 和 `media-rewriter.ts` 使用本地副本。

**修复**：agent 包的 `elision.ts` 改为从 `@open-pencil/core/tools` 导入 `MEDIA_OUTPUT_TOOLS`。前端 `elision.ts` 同理（已可从 core 导入）。

---

#### M3: 零测试覆盖（~1100 新 LOC）

`packages/agent/test/` 目录为空。以下纯函数可直接单测：

| 函数 | 文件 | 可测性 |
|---|---|---|
| `elideMediaToolResults` | `elision.ts` | 纯函数，输入/输出明确 |
| `inlineMediaToolResultsAsUserMessages` | `media-rewriter.ts` | 纯函数 |
| `censusMediaToolResults` | `media-rewriter.ts` | 纯函数 |
| `buildMarketingOverlay` | `prompts/library-snapshot.ts` | 纯函数 |
| `putCredential` / `consumeCredential` | `credentials.ts` | TTL 逻辑可测 |
| `bridgeToolsToAI` | `tools-bridge.ts` | mock bridge 即可 |
| `resolveAgentBackendURL` | `agent-transport.ts` | 环境变量/mock |

**建议**：至少覆盖 `elision.ts`、`media-rewriter.ts`、`credentials.ts` 的核心路径。

---

#### M4: 服务器关闭时 WebSocket 桥未断开

**位置**：`packages/agent/src/server.ts:52-59` + `packages/agent/src/routes/chat.ts:19-20`

```ts
// chat.ts - 模块级桥缓存
let bridge: FrontendBridge | null = null

// server.ts - 关闭逻辑
const closeAll = async () => {
  if (runtimeHandle) return
  runtimeHandle = { close: async () => undefined }
  await close()          // no-op placeholder
  nodeServer.close()     // 未 await
  await removeAgentDiscovery()
  process.exit(0)
}
```

**问题**：`closeAll` 未断开 `bridge` 连接，导致进程退出后 WebSocket 连接残留。`nodeServer.close()` 未 await，SSE 流可能在响应完成前被强制终止。

**修复**：

```ts
const closeAll = async () => {
  if (runtimeHandle) return
  runtimeHandle = { close: async () => undefined }
  bridge?.disconnect()   // 新增
  bridge = null          // 新增
  await close()
  await new Promise<void>((resolve) => nodeServer.close(() => resolve()))
  await removeAgentDiscovery()
  process.exit(0)
}
```

---

### 🟢 Minor（建议修复）

#### m1: 系统提示词在 app 和 agent 包中各存一份

`src/app/ai/chat/system-prompt*.md` 和 `packages/agent/src/prompts/system-prompt*.md` 是独立副本。编辑一处不会同步另一处。agent 包通过 `scripts/inline-prompts.ts` 生成 TypeScript 常量。

**建议**：将 prompt markdown 文件移至共享位置（如 `packages/core/src/tools/prompts/` 或 `docs/prompts/`），两侧从同一源文件读取。

---

#### m2: WebSocket 认证使用任意 50ms 延迟

**位置**：`packages/agent/src/bridge/ws-client.ts:95-110`

```ts
ws.once('open', () => {
  ws.send(JSON.stringify({ type: 'auth', token: this.authToken }))
  this.authRetries++
  setTimeout(() => {
    if (this.ws === ws && ws.readyState === WebSocket.OPEN) {
      this.emit('authenticated')
      resolve()
    } else {
      fail(new Error('Bridge closed before authentication completed'))
    }
  }, 50)  // 任意延迟
})
```

**问题**：50ms 是经验值，慢系统上可能不够。更好的做法是等待桥端返回显式认证成功消息。

**建议**：改为监听桥端的 `auth-ok` 消息或使用 Promise + 超时。

---

#### m3: `authRetries` 在认证失败时双倍计数

**位置**：`packages/agent/src/bridge/ws-client.ts:100` + `ws-client.ts:155`

```ts
ws.once('open', () => {
  this.authRetries++   // open 时 +1
  ...
})
ws.on('close', () => {
  if (!this.explicitClose && this.info && this.authRetries < AUTH_RETRY_MAX) {
    this.authRetries++  // close 时又 +1
    ...
  }
})
```

**问题**：单次认证失败（open → auth → close）消耗 2 次重试预算，实际有效重试次数减半（5 次预算 → 最多 2-3 次实际重试）。

**修复**：仅在 `close` handler 中计数，移除 `open` 中的 `authRetries++`。

---

#### m4: Agent 包依赖 `@open-pencil/mcp/discovery`

**位置**：`packages/agent/src/routes/chat.ts:6`

```ts
import { readDiscoveryFile } from '@open-pencil/mcp/discovery'
```

**问题**：Agent 与 MCP 包耦合。MCP 发现文件格式变更会波及 Agent。

**建议**：考虑将发现文件读取提取为共享工具，或在 Agent 包中自行实现（代码量很小）。

---

#### m5: `agentBackend` ref 未包装 readonly

**位置**：`src/app/ai/chat/use.ts:116`

```ts
return {
  ...
  agentBackend,  // 直接暴露 ref
  ...
}
```

**问题**：消费者可意外修改 `agentBackend.value`。虽然现有代码库中 `activeTab`、`lookImagesKept` 等也直接暴露，但 Agent 后端状态不应被外部修改。

**建议**：使用 `readonly(agentBackend)` 包装。

---

## 四、凭证流端到端分析

```
1. 用户配置 API Key (Settings UI)
   ↓
2. CredentialStore 加密存储 (浏览器 IndexedDB / Tauri 系统钥匙串)
   ↓
3. use.ts 模块加载 → probeAgentBackend()
   → fetch GET http://127.0.0.1:7601/health
   → 缓存 AgentBackendInfo (5s TTL)
   ↓
4. 用户发送消息 → ensureChat() → createTransport()
   → getAgentBackend() 返回缓存 info
   → resolveAPIKey() → 从 CredentialStore 解密获取 key
   → provisionAgentCredential(info, apiKey)
     → POST http://127.0.0.1:7601/v1/auth { connectionId, apiKey }
     → Agent 内存存储 (1h TTL)
   → createHttpAgentTransport(info, chatId, store, config)
   ↓
5. Chat 发送消息 → POST /v1/chat
   → Agent: consumeCredential(connectionId) → 获取 apiKey
   → Agent: createLanguageModel(config, apiKey)
   → Agent: createAgent() → ToolLoopAgent
   → Agent: streamText() → SSE 流返回前端
   ↓
6. Agent 执行工具 → bridge.sendRPC('tool', { name, args })
   → WebSocket → 前端自动化桥 → SceneGraph 操作 → 返回结果
   → Agent 继续 LLM 循环
```

**安全边界**：

- ✅ API Key 不写入磁盘（Agent 仅内存暂存）
- ✅ 连接 ID 为随机 UUID（`web-${crypto.randomUUID()}`）
- ✅ Agent 探测有 800ms 超时 + 5s 缓存
- ⚠️ localhost HTTP 明文传输（P0 可接受，P1 应加 TLS）
- ⚠️ `btoa(json)` 不处理 Unicode（见 m6）

---

## 五、合并建议

### 必须修复（合并前）

1. **C1** — 删除 `@ts-expect-error`（1 行改动）
2. **C2** — `getChatId` 改用 documentId（~3 行改动）
3. **C3** — 对齐 `buildMarketingOverlay` 语义（~30 行改动）

### 强烈建议（合并前）

4. **M1** — `resolveAPIKey` null 检查（~5 行改动）
5. **M3** — 为 `elision.ts`、`credentials.ts` 补基础单测（~100-200 LOC）

### 可后续跟进

6. **M2** — `MEDIA_OUTPUT_TOOLS` 统一导入
7. **M4** — 服务器关闭时断开桥连接
8. **m1-m5** — Minor 改进项

---

## 六、总结

Agent 后端的架构设计是本分支最大的亮点——**"后端不碰 SceneGraph，工具执行全部反向 RPC"**这一约束使得后端保持轻量（~1100 LOC）、无状态（凭证不落地）、可测试（mock bridge 即可）。这与 AGENTS.md 中"packages/core 是框架无关的编辑器内核"的分层哲学一致。

主要风险不在架构，而在实现细节：3 个 Critical 缺陷（TypeScript 编译阻塞、切页丢对话、前后端 prompt 语义不一致）需要在合并前修复。零测试覆盖是工程债务，建议至少为核心纯函数补单测。

整体评价：**方向正确、分层干净、细节需打磨**。修复 C1-C3 + M1 后可合并。

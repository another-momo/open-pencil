# localhost 形态落地方案：`changjuan serve`（CLI + Web UI）

> 状态：**方向已定案；M1/M2 已落地**（`feature/agent-backend`：agent loop 后端化 + `/v1/chat` 及 `/v1/brand` 路由 + WS 工具桥 + 前端 RemoteChatTransport）；M3（字体/文件 API 替换 Tauri 分支）与 M4（headless 编辑器实例）待做。后续施工以 `docs/plans/architecture/end-state-follow-model.md` 为准。2026-08-18 标注
> 创建日期：2026-08-13
> 背景：`2026-08-12-productization.md` §5 定了"本地 CLI 后端 + localhost Web UI"的形态方向，本文回答"具体怎么改"。结论来自对 monorepo 三个子系统（应用启动与平台分支、MCP server 骨架与 automation bridge、AI 编排链路）的逐文件调研。
> 关联文档：`docs/idea/2026-08-12-productization.md`（产品化总方案，§5 是本文的决策前提）

---

## 一、核心判断

**改造比看起来便宜。** "后端发起、浏览器执行工具"的桥已经存在且在服役（MCP 的 browser-RPC 通道，CLI 和 MCP client 今天都在用）；agent loop 是纯 Vercel AI SDK 逻辑、无 DOM 依赖，可整体搬；字体和凭据各有干净的注入接口。真正要新写的是：4 组 REST API（fonts / files / credentials / agent）、静态托管 + SPA fallback、`serve` 入口命令、一个 `RemoteChatTransport`。

## 二、现状里可直接复用的资产

1. **server 骨架**（`packages/mcp`）：Hono app（`server.ts:89 createHonoApp`）、token 鉴权（`auth.ts`，timingSafeEqual）、Unix socket + Windows TCP 双监听与优雅关停（`server/lifecycle.ts`）、路径安全（`tool/output.ts` 的 `resolveSafePath`）。加路由就是 `app.post('/api/...')`。
2. **后端↔浏览器 RPC 桥**（`packages/mcp/src/browser-rpc.ts` + `src/app/automation/bridge/`）：浏览器主动 WebSocket 连 server、发 `{type:'register', token}` 注册；server `sendRPC({command:'tool', ...})` 推给浏览器；浏览器侧 `tool-handlers.ts` 已能执行任意 ALL_TOOLS 工具（含 ensureFonts / computeAllLayouts / requestRender 后处理）。"agent 在后端、工具在浏览器"的回路今天就在跑。
3. **无头 core**（`packages/cli/src/headless.ts`）：读文档、`computeAllLayouts`、全格式导出（raster 走 `canvaskit-wasm/full`，Node/Bun 下已验证可用）——server 侧文档解析/导出不用新写。
4. **transport 替换接缝**：`window.openPencil.setChatTransport`（`src/app/browser-bridge.ts:40`）已是运行时注入 chat transport 的现成钩子；`ACPChatTransport`（`src/app/ai/acp/transport.ts`）已示范"外部进程事件流 → UIMessageChunk 流"的写法。
5. **抽象接口**：字体的 `HostFontLoader`（`font-sources.ts:23`，family+style → ArrayBuffer）和凭据的 `CredentialStore`（`settings/credentials/types.ts`，5 方法）都是切好的缝，HTTP 实现直接实现接口即可。

## 三、目标架构

```
changjuan serve（packages/cli 子命令或新 bin）
  └─ 内嵌 startServer()（不再 spawn 子进程）
       ├─ 静态托管前端 dist + SPA fallback            ← 新写
       ├─ GET /api/bootstrap → 同源 token 下发         ← 新写
       ├─ /api/fonts  /api/files  /api/credentials    ← 新写 3 组
       ├─ /api/agent（POST 消息 + SSE 回 UIMessageChunk）← 新写
       ├─ /rpc + WebSocket（现有 browser-RPC 桥，原样保留）
       └─ agent loop（从 src/app/ai/chat 搬到 server）
浏览器（用户自开，Chrome/Edge）
  ├─ Chat / ChatPanel / ChatMessage 不动，只换 transport
  └─ connectAutomation 无条件连同源 WS，执行 tool 命令操作场景图
```

同源带来的免费收益：CORS 配置整层删除；token 不再走 discovery 文件（浏览器侧）；`tauriFetch` 代理退役。

## 四、逐块改法

### 4.1 server 底座（新写为主，量最大但最机械）

- `changjuan serve` 命令内嵌 `startServer()`；现在 server 是被编辑器拉起的（dev 走 `vite-plugin.ts` spawn 子进程，Tauri 走 `automation/mcp/spawn.ts`），产品模式反转为"server 为主、浏览器为客"。固定端口 7600 改可配 + 冲突自增。
- 静态托管挂 dist，**必须配 SPA fallback**——路由是 `createWebHistory()`，直刷 `/storage`、`/share/:id` 会 404（现在靠 PWA workbox 兜底，server 形态下不可靠）。
- token 分发：`GET /api/bootstrap` 或 HTML 内联注入，浏览器不再读 discovery 文件。
- `vite-plugin.ts` 是 dev-only（生产构建里什么都不做，文件里已留 production TODO），整条 spawn 路径退役。

### 4.2 前端连接改造（小改）

- `EditorView.vue:93` 的连接门槛（`import.meta.env.DEV || (isTauri() && mcp)`）改为产品模式无条件 `connectAutomation`。
- `bridge/server.ts:30` 写死的 `ws://127.0.0.1:7600` 改为同源推导。
- `IS_TAURI` 是模块加载时求值的常量（`packages/core/src/constants.ts:4`）——新增形态需要加 `IS_LOCAL_SERVER` 或改启动期注入；散点实测 23 个文件，每处是机械分支替换。

### 4.3 agent loop 后端化（核心改造，接缝都已存在）

- **搬**：`transports.ts` 的 ToolLoopAgent 编排（`prepareCall`/`prepareStep`、媒体 elision、prompt caching）是纯逻辑无 DOM 依赖；provider registry 的 SDK provider 包 Node 兼容。
- **改**：`createAITools` 的 `execute` 从本地 `def.execute(figma, args)` 改为经 WS `sendRPC({command:'tool'})`。工具本体（core tools、`apply.ts`、`history.ts`）留在浏览器——依赖 renderer/CanvasKit/字体。
- **回 UI 的流**：新写 `RemoteChatTransport`：POST 消息到 `/api/agent`，SSE 回 `UIMessageChunk` 流（与 AI SDK data stream 协议天然同构，Hono 有 `streamSSE`）。工具执行走已有的 WS RPC 通道，两通道互不阻塞（生图 120s 不卡流式文本）。

**两个待拍板的设计点：**

1. **undo 归属**：现在 AI 修改的 undo entry 由调用侧钩子（`onAfterExecute`，before/after 快照）生成，而远端 `tool` 命令路径不做 undo。倾向方案：给 `tool` RPC 加 `undo: true` 选项，快照逻辑挪进浏览器侧命令内——改动最小。
2. **marketing overlay 数据源**：prompt 组装搬到后端后，overlay 依赖浏览器里的 library session + profileSelection + graph。简单方案：前端 sendMessage 时随请求带 overlay 上下文；一致性方案：server 经桥查询。倾向先简单方案。

### 4.4 生图管线（接缝已切好）

`ImageGenProvider.generate(req, images)` 接口本身就是缝：新写 `RemoteImageGenProvider` POST 到 server，server 持 key 调上游，顺带补上现在没有的重试/进度（现状 `retry: 0`、120s 裸超时）。`apply.ts`/`history.ts` 不动。注意参考图 bytes（可能几 MB base64）随工具调用过桥上传。`vision.ts`、stock-photo 的 core 模块级单例同理处理。

### 4.5 字体 API（替换点干净）

`HostFontLoader` 接口不动。前端改动集中在 `src/app/editor/fonts/index.ts` 一个文件：`getTauriFonts()` → `GET /api/fonts`，`loadSystemFont()` → `GET /api/fonts/:family/:style`（session 缓存 Map 保留）。server 侧新写字体目录扫描 + 字节读取（替代 `desktop/src/fonts.rs`；Node 侧无 font-kit 等价物，自扫目录 + 解析或引纯 JS 库）。`BUNDLED_FONTS` 同源静态路径天然兼容。

### 4.6 文件 API（机械的多点替换）

所有分支以 `isTauri()` + `filePath` 为轴，新增第三分支是体力活：`files.ts`（打开）、`write.ts:46`（保存）、`save-targets.ts`（另存为）、`watch-targets.ts`（监听，改 HTTP 轮询或走已有 WS 推送）、`reload-source.ts`。server 侧 `/api/files` 复用 `resolveSafePath`。`DocumentSourceAccess.filePath` 语义原样复用。Tauri 文件关联（`take_pending_open`）换成 CLI 参数 → URL query。

### 4.7 凭据（有现成模板）

`native.ts` 就是模板：`invoke(cmd, ...)` 换成 `fetch('/api/credentials/...')` 即得 `HttpCredentialStore`。`CredentialBackend` union 加新值；marketing settings 的 7 个 `useLocalStorage` 键（生图/vision key）一并迁 server 配置文件——正好还掉 §7.2.1 的工程债。

### 4.8 构建与瘦身

- **PWA 去掉**：localhost 形态下 SW 预缓存只会钉死旧版 UI；离线能力对"server 不在 UI 也没意义"的形态无价值。删 `vite/pwa.ts` + `main.ts:15` 注册分支。
- dev 的 `/proxy/minimax-anthropic` 代理（`vite/server.ts:33`）不再需要——请求从后端发出。

## 五、分期

| 期 | 内容 | 解锁的价值 |
|---|---|---|
| **M1 能跑** | serve 入口 + 静态托管 + SPA fallback + bootstrap token + 前端无条件连同源 WS | 形态成立（AI 仍在前端） |
| **M2 核心价值** | agent loop 搬后端 + RemoteChatTransport + tool RPC 加 undo 选项 + 凭据/生图 key 迁 server | CORS、key 安全、AI 卡住三层痛点 |
| **M3 体验** | /api/fonts + /api/files 替换 Tauri 分支；删 tauriFetch、PWA、IS_TAURI 散点 | 字体库=磁盘目录、真实文件系统 |
| **M4 v2** | 后端持有 headless 编辑器实例，浏览器变纯视图 | §5.3 的执行层根治 |

M4 缺口明确：headless 路径没有 EditorStore（undo/selection/tabs/save 都在 src/app store 里），server 侧系统字体枚举由 M3 铺路。

## 六、风险（调研确认，非想象）

- **WS upgrade 无路径隔离**：任何 upgrade 请求都进 browser-RPC（`WebSocketServer({noServer:true})`），新增 WS 端点要避开冲突。
- **单浏览器语义**：重连踢掉旧连接并拒绝在途请求——"用户多开两个 tab"的场景要有产品层处理。
- **discovery 文件明文 token 落盘**：浏览器侧干掉后只剩 CLI 客户端用，沿用 0o600 约定即可。
- **`/health` 无鉴权**泄露版本与连接状态——localhost 场景可接受。

## 七、待拍板

1. undo 归属（倾向 `tool` RPC 加 undo 选项，见 §4.3）。
2. marketing overlay 数据来源（倾向前端随请求带上下文，见 §4.3）。
3. server 字体枚举的技术选型（自扫解析 vs 纯 JS 库）。
4. 多 tab/多浏览器窗口的产品语义（单浏览器语义的现状是否要改）。
5. `changjuan serve` 放 `packages/cli` 子命令还是新 bin——结合第二刀时 `packages/cli` 改造为产品入口的规划（产品化文档 §5.6）。

<!--
  写作纪律（改本文前必读）：
  - 事实性声明必须附核验命令 + 日期，否则标为【假设】
  - 计划被实测推翻时，直接改本文为新版本，完整理由记入 records/ 子文档
  - 本文只保留当前态，不保留修正历史
  - 改完后刷新本文头部的「状态」字段
  - 详细规则见 docs/rebuild/05-process.md §4
-->

# tasks/T20-plan.md · T20 任务计划

> **T 编号**：T20（Phase 1-pi 实施 · 工具链路：后端独立进程化 + hello-tool 全链 + 工具事件映射）
> **分支**：`rebuild/pi`（D24 主线；T19 已收口 ✅）
> **状态**：🔄 开工（注册期 recon 已完成，见 [T20-self-check.md §2.1](T20-self-check.md)）
> **三件套**：
> - 计划：[T20-plan.md](T20-plan.md)（本文件）
> - 自检：[T20-self-check.md](T20-self-check.md)（开工后持续回填）
> - 核验：[T20-verify.md](T20-verify.md)（收口时 subagent 填报）

## 1. 任务概述

### 1.1 背景与目标

T19 打通了文本回路（pi SDK 薄 service + UIMessage v1 SSE + 前端 Chat 类零改动），但 `noTools: 'all'` 下 AI 只会说话不会动手。本任务接通**工具链路**：一句话 → pi session 里的自定义工具被调起 → 经 7600 桥在活编辑器画布上建出 frame → 工具卡片与回复在 ChatPanel 可见 → 重启后 session 恢复且工具仍可用。

随本任务一并落实 owner 两个拍板（2026-08-23 会话）：

1. **pi 后端是唯一 agent 能力来源**——浏览器端 ToolLoop 直连路径不再需要保留（旧路径的裁撤清理单列后续任务，不在本任务面内；本任务只保证新链不依赖它）
2. **后端是独立进程，不是 vite 中间件**——T19 的 `piBackendPlugin` 中间件形态升级为：vite 插件 spawn 独立 bun 子进程（照 `src/app/automation/bridge/vite-plugin.ts:131` spawn `packages/mcp/src/index.ts` 的既有模式，2026-08-23 实证在仓），vite 经 `server.proxy` 把 `/api/pi-chat` 代理过去。后端同时可脱离 vite 独立启动（`bun run dev:backend`）

### 1.2 关键决策（本 task 内拍板，理由随附）

1. **独立进程形态 = vite 插件 spawn 子进程 + proxy 转发**——dev 单命令（`bun run dev`）体验不变，进程边界真实（独立 PID、独立崩溃域）；proxy 用 vite 内置 `server.proxy`（http-proxy 流式转发，SSE 无缓冲【假设，P4 冒烟实证】）；前端 transport 零改动（仍打同源 `/api/pi-chat`）
2. **工具注册 = `customTools` + `noTools: 'builtin'`**——pi SDK 语义实证（`node_modules/@earendil-works/pi-coding-agent/dist/core/sdk.d.ts:28-47`，2026-08-23）：`'all'` 会连 custom 工具一起禁，`'builtin'` 只禁内建（read/bash/edit/write）而保留 custom——正是本任务要的「只挂我们的设计工具」
3. **工具执行走 7600 桥 `/rpc`**——`POST http://127.0.0.1:7600/rpc`，Bearer 鉴权，body `{command:'tool', args:{name, args}}`（`packages/mcp/src/server.ts:157-170` 实证）；token 与端口经 discovery 文件获得（`readDiscoveryFile()`，`@open-pencil/mcp/discovery` 公开导出且 bun condition 直映射源码，`packages/mcp/package.json:31-36` 实证；文件含 `httpPort`+`authToken`，`packages/mcp/src/transport/discovery.ts:15-24` 实证）。编辑器侧浏览器在 WorkspaceView mount 时自动连桥（`src/views/WorkspaceView.vue:70` → `startMCPRuntime`，DEV 下自动，`src/app/automation/mcp/runtime.ts:163` 实证）
4. **hello-tool = `create_shape`**（core `ALL_TOOLS` 既有工具，`packages/core/src/tools/create/basic.ts:5` 实证注册名），参数面 {type: FRAME/RECTANGLE/…, x, y, width, height, name?}；pi 侧 defineTool 同名注册，execute 只做参数透传 + 桥调用 + 结果包装
5. **工具事件映射照上游先例 `providerExecuted: true`**（`src/app/ai/harness/transport.ts:44-57` 实证）：`toolcall_start` → `tool-input-start`，`toolcall_end` → `tool-input-available`（input 取 `toolCall.arguments`），`tool_execution_end` → `tool-output-available` / `tool-output-error`；`toolcall_delta` 不转发（end 给全量参数）；`tool_execution_start/update` 不产生 chunk。事件源实证：`AssistantMessageEvent` 的 `toolcall_*` 三组（`pi-agent-core/dist/proxy.d.ts:36-49`）+ session 级 `tool_execution_*` 三组（`pi-agent-core/dist/types.d.ts:396-412`）
6. **前端零改动**——`ChatMessage.vue:27-110` 已实证渲染 toolCallId  keyed parts（pending/done/error 三态 + 可展开详情），ai SDK Chat 类自动把 tool chunk 落成 `tool-*` part；`providerExecuted: true` 使前端不尝试客户端再执行
7. **live 冒烟在本地做**（沿袭 T19 口径）：工具链冒烟需浏览器开着 app（编辑器连桥），Playwright 驱动真实 UI；CI 只跑静态面

### 1.3 非目标（明确划掉）

- 全量工具面挂载（core ~30 工具的 schema 翻译与逐个验收，后续任务）；MCP-adapter 备选路线（pi 经 MCP 协议直连 7600 `/mcp` 端点，上游 `src/app/integrations/mcp/pi.ts:31-51` 有先例，本任务不采用，理由：defineTool 直挂的 schema 与错误语义可控，hello-tool 阶段无需 MCP 协议机）
- 浏览器 ToolLoop 旧路径裁撤（owner 已拍板不再保留，清理单列任务）
- T21 凭证双链；T22 session↔文件绑定；T23 prompt 装配；审批 extension
- 后端生产化部署形态（systemd/安装包等）；多用户/多实例

## 2. 验收清单（收口时逐项核验）

| # | 验收项 | 通过标准 |
|---|---|---|
| A1 | 后端独立进程 | pi 后端以独立 bun 进程运行（dev 下由 vite 插件 spawn，或 `bun run dev:backend` 独立起）；`/api/pi-chat` 经 vite proxy 到达；后端自带 `/health`；vite 退出子进程随之回收 |
| A2 | hello-tool 全链 | 一句「创建一个 frame」→ SSE 流出现 `tool-input-start`/`tool-input-available`（toolName=create_shape）→ `tool-output-available`（含新节点 id）→ 画布真实建出 frame（经 7600 `/rpc` `get_node` 回读 id 一致） |
| A3 | 工具卡片可见 | 浏览器 ChatPanel 渲染工具调用卡片（pending→done 状态迁移），Playwright 截图证据 |
| A4 | session 连续 + 重启恢复 | 同 session 二轮对话 AI 记得刚建的 frame；杀掉后端进程重启后同 sessionId 继续对话且工具仍可调（SessionManager.open 恢复 + customTools 重注册） |
| A5 | 前端零改动 | `src/components/` 与 `src/app/ai/chat/` `git diff` 为零 |
| A6 | T19 文本回路回归 | 既有 backend-smoke R1/R2 断言在新进程拓扑下全过 |
| A7 | CI 绿 + 纪律 | rebuild/pi HEAD run 全绿；无占位；key 卫生（token/key 不入仓、不打印） |

## 3. 执行面（P1-P5）

- **P1 后端独立进程化**：新增 `server.ts`（node:http，路由 `POST /api/pi-chat` + `GET /health`）与 `main.ts`（进程入口，端口 `OPENPENCIL_PI_BACKEND_PORT` ?? 7700，rootDir=cwd）；重写 `vite-plugin.ts` 为 spawn 子进程 + `config()` hook 注入 `server.proxy`；package.json 加 `dev:backend` 脚本（P17 扩因）
- **P2 hello-tool**：新增 `tools.ts`（defineTool `create_shape`，typebox 参数 schema，execute → discovery 读桥 → POST /rpc → AgentToolResult 包装，失败重读 discovery 重试一次后抛错）；`service.ts` 改 `noTools: 'builtin'` + `customTools`
- **P3 事件映射**：`mapping.ts` 激活 toolcall_* / tool_execution_end 五组映射（§1.2-5 表），头注释更新
- **P4 冒烟**：新增 `spikes/s-pi/backend-smoke/tool-smoke.mjs`（node 侧全链断言：帧序列 + /rpc 回读 + 重启恢复 + 回归）；扩展或新增浏览器冒烟（真实 UI 发话 → 工具卡片截图 → 画布 frame 实证）
- **P5 收口**：本地 CI 同构全量 → 推送 → 远端 CI 绿 → subagent 独立核验 → verify 判决 → tracker/records 更新

总计 ~2 人日。

## 4. 风险与回退

| 风险 | 应对 |
|---|---|
| openrouter/free meta 路由模型工具调用能力参差（部分底层模型不支持/不稳定 tool calling） | S-pi-2 主线活模型面已实证真实模型调自定义工具并消费返回（`spikes/s-pi/live-tool-result.mjs`，T18 P3 通过）；smoke 层保留 ≤3 次换 session 重试 + 提示词明确指令；连续失败如实上报不伪造 |
| vite `server.proxy` 对 SSE 长连接有缓冲/超时 | P1 落地后第一件事实测流式（逐帧到达断言）；若缓冲则退回插件中间件形态仅做转发（手 pipe `http.request`，仍保持独立进程拓扑） |
| discovery 文件 stale（PID 存活检查之外的桥重启窗口） | `readDiscoveryFile()` 自带 PID 存活校验（`discovery.ts:64-` 实证）；execute 失败重读一次再试；终败抛带行动指引的错误文本 |
| Windows 下 bun spawn 子进程信号回收差异 | 照抄 automation vite-plugin 的 stopChild 模式（kill + 2s 超时 + SIGKILL 兜底，`vite-plugin.ts:109-127` 实证） |
| `tool_execution_end.result` 形状为 `any` | 防御性序列化：output 取 `details ?? content 文本拼装`，不可序列化时降级为 String(result) |
| 浏览器未开 app 时工具调用失败（桥无执行端） | 工具返回如实错误（「编辑器未连接 7600 桥」）；冒烟前置 `/health` 检查桥状态（`status: no_app` 时给清晰报错） |

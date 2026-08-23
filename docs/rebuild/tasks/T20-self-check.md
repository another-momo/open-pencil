<!--
  写作纪律（改本文前必读）：
  - 事实性声明必须附核验命令 + 日期，否则标为【假设】
  - 本文只保留当前态，不保留修正历史
  - 详细规则见 docs/rebuild/05-process.md §4
-->

# tasks/T20-self-check.md · T20 自检记录

> **T 编号**：T20（Phase 1-pi 实施 · 工具链路：后端独立进程化 + hello-tool 全链 + 工具事件映射）
> **状态**：🔄 进行中（P1 开工前，注册期 recon 已完成）

## 1. 任务清单对照

| 执行面 | 内容 | 状态 |
|---|---|---|
| P1 | 后端独立进程化（server.ts + main.ts + vite 插件 spawn + proxy） | ⬜ 未开工 |
| P2 | hello-tool defineTool 注册 + 7600 /rpc 执行 | ⬜ 未开工 |
| P3 | 工具事件映射激活 | ⬜ 未开工 |
| P4 | 工具链冒烟 + 浏览器证据 | ⬜ 未开工 |
| P5 | CI + subagent 核验 + 收口 | ⬜ 未开工 |

验收项 A1-A7 见 [T20-plan.md §2](T20-plan.md)，收口时逐项回填。

## 2. 自检实录

### 2.1 注册期 recon（2026-08-23，全部源码实证）

1. **pi 工具注册语义**：`CreateAgentSessionOptions.customTools?: ToolDefinition[]`（`node_modules/@earendil-works/pi-coding-agent/dist/core/sdk.d.ts:47`）；`noTools: 'all'` = 无工具启用（含 custom），`'builtin'` = 只禁内建保留 custom（同文件 :28-35 注释实证）——故 T20 用 `'builtin'` + customTools
2. **defineTool 签名**：`execute(toolCallId, params, signal, onUpdate, ctx) => Promise<AgentToolResult<TDetails>>`，`AgentToolResult<T> = { content: (TextContent|ImageContent)[], details: T, ... }`（`pi-coding-agent/dist/core/extensions/types.d.ts:372`、`pi-agent-core/dist/types.d.ts:316` 实证）；typebox 1.3.7 T19 已钉入 package.json
3. **事件源**：`AssistantMessageEvent` 含 `toolcall_start{id,toolName}` / `toolcall_delta{delta}` / `toolcall_end{toolCall}`（`pi-agent-core/dist/proxy.d.ts:36-49`；`ToolCall = {id, name, arguments}` 见 `pi-ai/dist/types.d.ts:246-254`）；session 级 `AgentEvent` 含 `tool_execution_start/update/end{toolCallId, toolName, result, isError}`（`pi-agent-core/dist/types.d.ts:396-412`），经 `session.subscribe` 同一事件流到达
4. **7600 桥调用面**：`POST /rpc` Bearer 鉴权，body `{command:'tool', args:{name, args}}`，响应 `{ok, result}|{ok:false, error}`（`packages/mcp/src/server.ts:141-170` 实证）；discovery 文件含 `httpPort`+`authToken` 明文（`packages/mcp/src/transport/discovery.ts:15-24`，0o600 原子写 + PID 存活校验）；`@open-pencil/mcp/discovery` 是公开导出且 bun condition 直映射 `src/transport/discovery.ts`（`packages/mcp/package.json:31-36`）
5. **编辑器侧自动连桥**：`WorkspaceView.vue:70` mount 调 `startMCPRuntime(getActiveStore)` → DEV 下 `connectAutomation` WS 注册（`src/app/automation/mcp/runtime.ts:163`、`src/app/automation/bridge/server.ts:14-44` 实证）；vite 插件 configureServer 即 spawn MCP 子进程（`src/app/automation/bridge/vite-plugin.ts:204`）
6. **桥内工具派发**：`command:'tool'` → `handleTool` → `ALL_TOOLS.find(t => t.name === toolName)` → `def.execute(figma, toolArgs)`（`src/app/automation/bridge/tool-handlers.ts:35-61` 实证）；`create_shape` 注册名实证（`packages/core/src/tools/create/basic.ts:5`），回读用 `get_node`（`packages/core/src/tools/read/nodes.ts:80`）
7. **前端工具卡片已就绪**：`ChatMessage.vue:27-110` 渲染 toolCallId keyed parts（pending/done/error + 可展开详情）；上游 harness 映射先例 `providerExecuted: true`（`src/app/ai/harness/transport.ts:44-57`）
8. **ai SDK chunk 类型**：`tool-input-start/tool-input-delta/tool-input-available/tool-output-available/tool-output-error` 全在 `node_modules/ai/dist/index.d.ts:2313-2380`（ai 7.x）
9. **独立进程 spawn 模板**：`src/app/automation/bridge/vite-plugin.ts:94-210`（spawn bun 子进程 + env 传递 + stopChild kill/SIGKILL 兜底 + EADDRINUSE 提示），本任务照抄该模式
10. **端口选型**：`AUTOMATION_HTTP_PORT=7600`（`packages/core/src/constants.ts:359`）、vite dev 1420；pi 后端取 7700（全仓 grep 零命中，2026-08-23），env 覆盖 `OPENPENCIL_PI_BACKEND_PORT`

### 2.2 实施事实（随 P 进度回填）

（待填）

### 2.3 计划偏差记录

（待填）

## 3. 已知边界与遗留

（收口时回填）

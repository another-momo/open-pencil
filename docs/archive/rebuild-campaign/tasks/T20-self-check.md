<!--
  写作纪律（改本文前必读）：
  - 事实性声明必须附核验命令 + 日期，否则标为【假设】
  - 本文只保留当前态，不保留修正历史
  - 详细规则见 docs/rebuild/05-process.md §4
-->

# tasks/T20-self-check.md · T20 自检记录

> **T 编号**：T20（Phase 1-pi 实施 · 工具链路：后端独立进程化 + hello-tool 全链 + 工具事件映射）
> **状态**：🔄 进行中（P1-P4 实施完毕、冒烟全绿；待 CI + subagent 核验收口）

## 1. 任务清单对照

| 执行面 | 内容 | 状态 |
|---|---|---|
| P1 | 后端独立进程化（server.ts + main.ts + vite 插件 spawn + proxy） | ✅ 全绿 |
| P2 | hello-tool defineTool 注册 + 7600 /rpc 执行 | ✅ 全绿 |
| P3 | 工具事件映射激活 | ✅ 全绿（含 willRetry 修复，§2.3） |
| P4 | 工具链冒烟 + 浏览器证据 | ✅ 全绿（API 18/18 + 浏览器 9/9 + T19 回归 14/14） |
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

### 2.2 实施事实（2026-08-23）

**文件面**（新增/修改均在 ownedRoot 或已登记 patch）：

- 新增 `src/app/ai/pi-backend/config.ts`（端口常量，零依赖——vite.config esbuild 链与独立进程两侧共用，避免 vite-plugin import server 把 pi SDK 重新拖进 config 打包）
- 新增 `src/app/ai/pi-backend/server.ts`（node:http 服务：`POST /api/pi-chat` SSE 处理器自 T19 vite-plugin.ts 迁入 + `GET /health`；`requestTimeout=0` 防长回合被 300s 默认值斩断）
- 新增 `src/app/ai/pi-backend/main.ts`（进程入口：env 端口、EADDRINUSE 清晰报错、SIGINT/SIGTERM 回收）
- 新增 `src/app/ai/pi-backend/tools.ts`（defineTool create_shape + callBridgeTool：discovery 读桥 → POST /rpc → AgentToolResult 包装；401/连接失败重读 discovery 重试一次；502 附「确认浏览器已打开 app」行动指引）
- 重写 `src/app/ai/pi-backend/vite-plugin.ts`（middleware → spawn `bun run main.ts` 子进程 + `config()` hook 注入 `server.proxy`；health 就绪轮询 15s；stopChild kill+SIGKILL 兜底照抄 automation 桥）
- 修改 `src/app/ai/pi-backend/service.ts`（`noTools: 'all'` → `'builtin'` + `customTools`；env 门控事件调试日志 PI_BACKEND_DEBUG）
- 修改 `src/app/ai/pi-backend/mapping.ts`（工具映射激活 + willRetry 守卫，§2.3）
- 修改 `package.json`（+`dev:backend` 脚本，P17 扩因）
- 新增 `spikes/s-pi/backend-smoke/tool-smoke.mjs`（API 级 18 断言）、`browser-tool-smoke.mjs`（编排器：开 app → 跑 tool-smoke → UI 全链 → 截图）

**冒烟结果**（dev server 以 `set -a; source .openpencil/key-env; set +a; VITE_PI_BACKEND=1 bun run dev` 起）：

- `node spikes/s-pi/backend-smoke/tool-smoke.mjs`：**18/18 PASS**——帧序列（start 首帧 / tool-input-available 参数逐字正确 / tool-output-available 含 nodeId / 顺序 / finish+[DONE]）、7600 桥 get_node 画布回读属性一致、同 session 追问记得节点 id、**T4 后端重启恢复**（独立端口 7701 新进程同一 state 目录：旧 session 从磁盘恢复记得 id + 工具仍可调建 RECTANGLE + 回读存在）
- `node spikes/s-pi/backend-smoke/browser-tool-smoke.mjs`：**9/9 PASS**——真实 Chromium 打开 app 自动连桥 → 真实输入框发话 → 工具卡片出现（Create Shape）→ 完成态迁移 → 非错误态 → 卡片详情 nodeId → 画布 FRAME 计数 +1 → 卡片 nodeId 经桥回读存在（UI↔画布对账闭环）；截图证据 `.openpencil/t20-tool-card-{pending,done,detail}.png`、`t20-canvas.png`
- `node spikes/s-pi/backend-smoke/smoke.mjs`（T19 文本回路回归，新进程拓扑 + proxy 路径）：**14/14 PASS**

### 2.3 计划偏差记录（实测推翻原计划两处，plan §1.2-5/A2 已就地改写为新版本）

1. **不发 `tool-input-start`**——原计划映射五组含 toolcall_start → tool-input-start。实测发现：① pi 的 `AssistantMessageEvent.toolcall_start` 不直接带 id/toolName（需从 `partial.content[contentIndex]` 反查，pi-ai types.d.ts:422-425）；② 上游 harness 先例本就不发此帧（transport.ts:44-57）；③ 卡片自 `tool-input-available` 起即 pending 态（ChatMessage.vue toolState 对无输出 part 判 pending），提前开帧收益为零。收敛为上游同款最小对（input-available + output-*）
2. **`agent_end` 必须判 `willRetry`**——原计划「agent_end → finish」。实测帧序畸形（finish 先于工具 chunk 出现、全流两个 finish）：pi 0.84.2 在模型返回空消息时进入自动重试（事件流实测 `agent_end → auto_retry_start → agent_start → … → agent_end → agent_settled`），中途的 `agent_end` 带 `willRetry: true`。第一个 finish 会让 ai SDK Chat 提前关流、后续工具 chunk 不落 part——这是「卡片永远 pending」的真根因（路由抓包 + DOM 解剖实证）。修复：`willRetry=true` 不出 finish。T19 纯文本回合未触发重试路径，故该缺陷为 T20 工具链新暴露
3. **冒烟断言三处环境校正**（不改产品代码）：① 工具卡片状态文本随 locale（zh=完成/en=Done，运行实例 zh——route 抓包 + DOM 解剖实证），匹配器改双写；② 画布断言从「按名命中」改「FRAME 计数差」（模型对 name 参数逐字服从非确定，实测改名一次）；③ tool-smoke 增 OPENROUTER_API_KEY 存在性前置检查（T4 段自起恢复探针进程需 env 有 key，报错给行动指引）
4. **`.openpencil/key-env` 无 `export` 前缀**——dev 进程注入需 `set -a; source .openpencil/key-env; set +a`（T19 文档只写「source 进」，T20 独立进程形态下 env 继承链变长才暴露：vite → spawn 子进程 env 继承。冒烟脚本头注释已写明正确形态）

### 2.4 已知边界与遗留

- **后端代码热更新**：vite spawn 的后端子进程不随源码变动重启——改 pi-backend/* 需重启 dev server（或单独 `bun run dev:backend` 迭代）。与 automation 桥子进程行为一致，属既有 dev 拓扑约束
- **7700 僵尸场景**：vite 异常退出若遗留后端子进程占端口，下一次 spawn 的子进程 EADDRINUSE 退出，health 轮询会命中僵尸（功能上经磁盘持久化自愈，但日志会有误导性 ready）。如实记录，dev 场景可接受
- **空消息自动重试**：openrouter/free 偶发空响应触发 pi auto_retry（事件流实测），对流式 UI 表现为同一回合内重跑——willRetry 守卫后帧序正确；属上游模型侧方差非本链缺陷
- **图层面板空显示**：headless 截图中图层面板未渲染桥创建节点（画布对账以桥 get_node/find_nodes 为准，已闭环）；怀疑 headless 下 UI 刷新节奏问题【假设】，不影响链路真实性
- **check-tasks pre-commit 语义**：pre-commit 钩子对 HEAD（上一 commit）做 task 指针校验而非当前 commit——CI 的 rebuild-discipline job（--base event.before）才是当前 commit 的实际拦截面；本任务 commit message 均含 `task: T20`，CI 面会真实校验

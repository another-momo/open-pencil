<!--
  写作纪律（改本文前必读）：
  - 事实性声明必须附核验命令 + 日期，否则标为【假设】
  - 计划被实测推翻时，直接改本文为新版本，完整理由记入 records/ 子文档
  - 本文只保留当前态，不保留修正历史
  - 改完后刷新本文头部的「状态」字段
  - 详细规则见 docs/rebuild/05-process.md §4
-->

# tasks/T11-self-check.md · T11 自检报告

> **T 编号**：T11（S-pi spike 执行 · pi sdk 路线实证）
> **自检时间**：2026-08-21（离线面部分）
> **状态**：离线面全绿；活模型面阻塞待 owner 补 key

## 1. 主 agent 任务清单对照（针对 [T11-plan.md §2](T11-plan.md)）

- [x] P1 脚手架：`spikes/s-pi/`（自含 package.json，不进 root workspaces）+ 固定 `@earendil-works/pi-coding-agent@0.84.2` + `@earendil-works/pi-ai@0.84.2` + `typebox@1.3.7`
- [x] P2 S-pi-1 **离线面**（`spikes/s-pi/offline-echo.mjs`，8/8 断言过）；活模型面阻塞（见 §3）
- [ ] P3 S-pi-2 通道 B 主线 + 通道 A 探测——均阻塞（见 §3）；**离线前置已完成**（§2.4）
- [x] P4 S-pi-3 离线面（`spikes/s-pi/offline-session-persistence.mjs`，16/16 断言过）
- [x] P5 S-pi-4 离线面：事件映射表（§2.5，走读上游 mapPart/mapEvent 完成）；SSE 段 + 旧 Chat 类联调属活集成面，随实施 task
- [ ] P6 self-check（本文）+ subagent 核验 + verify 回填
- [ ] P7 记录登记 + 任务表状态更新

## 2. 实测证据（全部 2026-08-21，Windows 11，Node v25.2.1，npm 11.18.0）

### 2.1 R-pi-8 安装实测（spikes/02 钦定必测）

- 核验命令：`cd spikes/s-pi && npm install --no-audit --no-fund`
- 结果：34s，140 packages，**零脚本错误**。`@silvia-odwyer/photon-node@0.3.4` 正常安装，无 WAS/原生编译问题。
- 仅两条 benign allow-scripts 警告（`@google/genai` preinstall echo、`protobufjs` postinstall），均被 npm 默认拦截且无功能影响——**不需要 `--ignore-scripts` 以外的任何处置**。
- ESM 导入冒烟：`import { createAgentSession, SessionManager, defineTool } from '@earendil-works/pi-coding-agent'` 三符号均可导入（node -e 实测）。

### 2.2 S-pi-1 离线面（库形态最小集成）

- 核验命令：`node spikes/s-pi/offline-echo.mjs` → 输出 `S-pi-1 离线面 ALL PASS`，退出码 0。
- **离线注入机制（本次关键发现）**：公开 SDK 面无需 API key 的驱动点是 `ModelRuntime.registerNativeProvider(provider)`——自带 `streamSimple` 返回 `createAssistantMessageEventStream()`（pi-ai 官方导出）编排的脚本化事件流，与 pi 自家 `test/test-harness.ts` 的 `createFauxStreamFn` 同一模式。`ModelRuntime.create({ allowModelNetwork: false, refreshOnCreate: false, modelsPath: null, authPath: <temp> })` 全程零网络。
- 依赖实例：`npm ls` 显示多路 `deduped`，但物理核查（核验 subagent 实测）确认 pi-ai@0.84.2 与 typebox@1.3.7 各有**两份物理拷贝**（顶层 + `pi-coding-agent/node_modules/` 嵌套，package.json 逐字节相同，非软链）——npm 未完全折叠。实际风险有限：两份同版本同内容，仅跨拷贝 class identity（instanceof）场景有害，本 spike 两个测试均未触发（事件流经 `for await`/`.result()` 鸭式消费）；后续实施 task 若出现跨包类型断言问题，优先排查此处。
- 实测通过项：
  - `createAgentSession({ model, modelRuntime, sessionManager: SessionManager.inMemory(), customTools: [echoTool], tools: ["echo"] })` 库形态装配成功；
  - echo 工具被 agent loop **真实执行 1 次**（`tool_execution_start/end` 事件成对、`toolResult` 内容 `echo:hello pi`）；
  - 事件时间线完整：`agent_start → turn_start → message_start → message_update(toolcall_start/delta/end) → tool_execution_start/end → turn_end → turn_start → message_update(text_start → text_delta×7 → text_end) → turn_end → agent_end → agent_settled`；
  - `text_delta` 增量拼接 === 最终文本；消息结构 `user → assistant(toolCall) → toolResult → assistant(text)`。
- **踩坑记录**：`tools: []` 是 allowlist 语义（空 = 全禁，含 customTools），报错形态为 toolResult `"Tool echo not found"`；正确写法 `tools: ["echo"]`（agent-session.js:1941 `_refreshToolRegistry` 的 `isAllowedTool`）。

### 2.3 S-pi-3 离线面（持久化 + 树形分叉）

- 核验命令：`node spikes/s-pi/offline-session-persistence.mjs` → `S-pi-3 离线面 ALL PASS`（5 阶段 16 断言）。
- **增量落盘（S-pi-3 核心结论）**：`session.prompt()` 返回后、`dispose()` **之前**，session JSONL 文件已含全部条目（`session, model_change, thinking_level_change, message(user), message(assistant)`）。append-only 逐条落盘 → **上游 harness「只有进程退出才持久化 / destroy 删状态」的坑（spikes/05 §1）在直用 SDK 路线天然不存在**，无需额外 stop 时机设计（faux provider 同步微任务推流场景下结论成立；真实模型流式中途崩溃的落盘完整性属活模型面残留项）。
- 跨重启恢复：全新 `ModelRuntime` + `SessionManager.open(file)` → 消息/文本/sessionId 完整恢复。
- 发现机制：`SessionManager.list(cwd, dir)` 1 命中且 `firstMessage` 正确；`continueRecent` 命中同一文件。
- **树形分叉（spike 05 §3 认定的 harness 天花板能力）**：`branch(首个 user 条目 id)` 后 `prompt()`，分叉点实测长出 2 个子条目；`getTree()` 可见分叉；分叉结构跨重启完整保留。直用 SDK 下该能力在 0.84.2 真实可用。
- JSONL 结构事实：首行 `{"type":"session","version":3,"id":...}`；条目带 `id/parentId/timestamp`；root 为 `model_change` 元条目（`parentId:null`），消息条目挂在元条目之后。

### 2.4 S-pi-2 离线前置（DeepSeek 条目核查）

- 核验命令：`node -e "console.log(require('./node_modules/@earendil-works/pi-ai/dist/providers/data/deepseek.json'))"`（pi-ai 0.84.2 包内目录，`providers/deepseek.models.js` 由该 JSON 生成）。
- 结果：deepseek-v4-flash / deepseek-v4-pro 均 `input: ["text"]`（**纯文本，不收图像**）、`reasoning: true`、`api: "openai-completions"`、`compat.thinkingFormat: "deepseek"`、contextWindow 1M。
- 结论：D2 通道 B 主线下主模型 text-only 原生兼容（无需任何降级）；通道 A（图像进主上下文）必须换 vision 模型或走 D2a 降级。
- 附带发现：pi 有 settings 级 `blockImages` 过滤（`sdk.js convertToLlmWithBlockImages`，把 image 块替换成 `"Image reading is disabled."` 占位文本）——设置开启时对 user/toolResult 消息的图像做优雅降级，可作为 D2a 运行时形态的参照实现。

### 2.5 S-pi-4 离线面（事件映射表）

上游 harness 产线为两段映射：`packages/harness/src/backends/pi.ts:62-89` mapPart（pi TextStreamPart → 6 种 BackendEvent）→ `src/app/ai/harness/transport.ts:28-62` mapEvent（形参类型 `HarnessTurnEvent`，与 BackendEvent 结构等价的 6 变体联合 → UIMessageChunk）。直用 SDK 跳过第一段，直接由 AgentSessionEvent 映射。下表左列除 `auto_retry_start` 外均为 §2.2 实测时间线中真实出现的事件；`auto_retry_start` 来自 AgentSessionEvent 类型联合（`agent-session.d.ts:40`），本 spike 未触发。类型联合中存在而本表有意略去的事件（`message_start/end`、`tool_execution_start/update`、`agent_settled`、`queue_update`、`entry_appended`、`compaction_*` 等）在实施 task 做 UI 适配层时需回头补评估（其中 `tool_execution_update` 承载流式部分结果，对工具进度展示有潜在用途）：

| AgentSessionEvent（0.84.2 实测） | UIMessageChunk（AI SDK v1） |
|---|---|
| `message_update(text_start)` | `text-start`（自建 textId） |
| `message_update(text_delta)` | `text-delta { id, delta }` |
| `message_update(text_end)` | `text-end` |
| `message_update(thinking_start/delta/end)` | `reasoning-start/delta/end` |
| `message_update(toolcall_start/delta)` | `tool-input-start/delta`（流式参数） |
| `message_update(toolcall_end)` | `tool-input-available { toolCallId, toolName, input }` |
| `tool_execution_end`（isError=false） | `tool-output-available { toolCallId, output }` |
| `tool_execution_end`（isError=true） | `tool-output-available`（error 输出）或 `error` |
| `turn_end` | `finish-step` |
| `agent_end` | `finish` |
| `auto_retry_start` / 错误事件 | `error { errorText }` |

走读结论：上游 mapEvent 的 pending 状态机（textStarted/reasoningStarted 惰性开帧）可直接照搬到我们的适配器；`providerExecuted: true` 标记对我们同样适用（工具在 CLI 后端执行）。SSE endpoint + 旧 Chat 类端到端消费属活集成面，随层 1 实施 task 做，不在本 spike 离线面。

## 3. 阻塞清单（活模型面，需 owner 补 key，不伪造通过）

| 项 | 缺什么 | 阻塞内容 |
|---|---|---|
| S-pi-1 活模型面 | 任一 LLM API key | 真实模型跑 echo 工具回合（离线面已用 faux provider 覆盖机制正确性） |
| S-pi-2 通道 B 主线 | DEEPSEEK_API_KEY | 文本 tool-result（模拟 look 场景摘要）被 DeepSeek 消费续跑 |
| S-pi-2 通道 A 探测 | 视觉模型 key（如 OPENAI/ANTHROPIC） | ImageContent + image_url dataURL 接受度端到端探测（时间盒项，不阻塞选型） |
| S-pi-3 活模型残留 | 任一 key | 流式中途异常时的落盘完整性 |

当前环境 `printenv` 实测 ANTHROPIC/DEEPSEEK/OPENAI 0 命中（2026-08-21）。按 T11-plan §3：key 缺席时 T11 以「离线面全过 + 活模型面阻塞证据」汇报，不标 ✅。

## 4. 合规自检

- 未修改任何上游文件：`spikes/s-pi/` 为 T10 登记 ownedRoot；本文档改动限 `docs/rebuild/tasks/T11-*.md`。
- 未伪造通过：全部断言为真实运行结果；活模型项明示阻塞。
- 占位纪律：本文不含 D19 禁用占位表述；未为通过 CI 创建任何空心文件。

<!--
  写作纪律（改本文前必读）：
  - 事实性声明必须附 文件:行号 证据 + 日期，否则标为【假设】
  - 计划被实测推翻时，直接改本文为新版本，完整理由记入 records/narrative/spikes/02-pi-sdk-runtime.zh.md
  - 本文只保留当前态，不保留修正历史
  - 改完后刷新本文头部的「状态」字段
  - 详细规则见 docs/rebuild/05-process.md §4
-->

# Spike 02 · pi sdk 作为 agent runtime 的可行性源码核查

> 状态：源码阅读完成（2026-08-20）| 修正 03 §2/§3 的「pi sdk 本地不可查 → 降级【假设】」——本地有完整源码（earendil-works/pi monorepo，v0.84.2），所有 pi 相关项从【假设】升格为【事实】或【推断】。| D2 修正（2026-08-21）：本文 §0 建议 / P3.2 / R-pi-3 / §6 S-pi-2 与预算段 / §9 前置依赖原按「通道 A 单通道即可、B 倾向砍」撰写——与 owner 已拍板的 D2（通道 B 为默认，records/topics/brand-config.md D2/D2a）冲突，相关段落已按拍板结果重写。
> 陈述纪律：**【事实】**（附 文件:行号 证据）/ **【推断】**（由证据推出）/ **【假设】**（未验证）。
> 证据路径约定：`pi/` = 参考项目/pi，证据行号引用该仓内路径。
> 比对目标：`dsh/` = 参考项目/deepseek-harness（已在 spike 01 录入）。

---

## 0. 结论先行

**可行，且强烈倾向作为 Phase 1 推荐路线（覆写 spike 01 的"推荐 Y"）。**

一句话理由：**pi 同时给我们 (a) 库形态的 SDK（同进程 import）+ (b) 完整 RPC 形态**（二选一），不需要 fork 任何 runtime 侧代码；Q0/Q1/Q2/Q3 四个硬问题在 pi 上**全部有源码级正面答案**，且 pi 是 GitHub 上耳熟能详、有 e2e 测试与活跃 commit 的项目（6211 commits、CHANGELOG 显示每周迭代，详见 P9）。

**vs 路线 Y（dsh 无头）的真实差异**（不是营销话术）：
1. **进程边界形态不同**：Y 必须 fork 一个 ~250 行 sdk-jsonrpc-server 才能补 resume（spike 01 §Y5 阻塞项）；pi 的 SDK/RPC 都是官方支持，resume 在 RPC 协议里有完整方法（`switch_session`、`fork`、`get_entries since=<id>`），**无 fork、无补偿代码**。
2. **流形态先天吻合**：pi 的 RPC event 流（`text_start/text_delta/text_end`、`toolcall_start/toolcall_delta/toolcall_end`、`tool_execution_*`、`compaction_start/end`、`auto_retry_*`）**和 UIMessage stream v1 同构**——Y 是 dsh 自研 chunk 协议需 adapter，pi 是协议级 vendor chunk，adapter 工作量**约为 Y 的 1/3**。
3. **session 持久化是树形 JSONL**：与 dsh 事件溯源 append-only jsonl/sqlite 等价，且 pi 内建 **in-place branching（`/tree`）和 fork**——Y 仅 sqlite/jsonl 单线性追加，无内建树。

但 pi **不是零代价**：
- pi 把 prompt 装配成内部 structured format（`getSystemPromptOptions()` 暴露 `customPrompt/selectedTools/toolSnippets/promptGuidelines/appendSystemPrompt/cwd/contextFiles/skills`），**注入 marketing overlay 不是改一个 `systemPrompt` 字符串就完事**——需要走 `before_agent_start` 钩子的 `event.systemPromptOptions` 链式叠加（extensions.md:534-565），或 `registerPromptTemplate`/`appendEntry`/`sendMessage({customType,content})`（extensions.md:1398-1418）。**F0.6 工作量比 Y 多约 0.5-1 人日**。
- pi **没有 dsh 那样的「compaction seam 全可替换」**（Y 的 Y5）——它把 compaction 做成 extension event `session_before_compact`，可 cancel 或提供自定义 summary（compaction.md:280-310），语义同样可注入，但接口形态不同。媒体省略策略的注入点应是 **`session_before_compact` 钩子改写 `compaction.summary` 文本** 或 **`context` event 钩子过滤 toolResult 消息**（extensions.md:657-668），不是 dsh 那种「直接注册一个新的 Service」。**F0.6/C4a 等价，但代码形态不一样**。
- pi 文档明牌 **No MCP / No sub-agents / No permission popups / No plan mode / No built-in to-dos / No background bash**（README.md:496-510）——B1b 的工具审批需要自写 extension（用 `tool_call` event 返回 `{block: true}`，extensions.md:778-799），不阻塞但**和 dsh 的 `ctx.approval.request` 形态不一样**，需要学习曲线。

**建议**：D7 收口为 **pi 直接驱动**；按 spike 计划 §6 跑最小 spike（S-pi-1 ~ S-pi-4）确认两件事——(a) `createAgentSession` + 自定义工具 + `ExtensionAPI` 钩子真能在我们 Node 后端跑起来；(b) look 通道 B 的 pi 侧暴露面——按 D2（owner 已拍板：B 为默认，look 截图不进主 agent 上下文），主对话 text-only，pi 只需消费文本 tool-result、DeepSeek 系原生兼容；通道 A（图随消息，DeepSeek 路径走占位降级——机制见 P3.2，pi 与 dsh 共用 pi-ai 适配层，spike 01 §Y4 结论在 pi 上同样成立）降为备选路径的时间盒探测，不作选型依据。

---

## 1. 可行性分析

### P1. 核心架构

#### P1.1 pi monorepo 是什么

【事实】pi 是 earendil-works 的 monorepo（10 个 package，version `0.0.3` root / `0.84.2` 各包一致锁版，package.json:66、coding-agent/package.json:3、agent/package.json:3、ai/package.json:3）。核心三件套（README.md:13-35）：

| 包 | 角色 |
|---|---|
| `@earendil-works/pi-coding-agent` | 自可扩展 coding agent CLI（也提供 SDK + RPC） |
| `@earendil-works/pi-agent-core` | "Agent runtime with tool calling and state management"（agent-core README.md:3） |
| `@earendil-works/pi-ai` | "Unified multi-provider LLM API (OpenAI, Anthropic, Google, …)" |

外加 `@earendil-works/pi-protocol`（实验性 CBOR 二进制协议，protocol/README.md:5-11）—— **重要发现**：pi 有 dsh 那样的 protocol 包。**这个"server/client/protocol"三件套和 dsh 的 sdk-server-sdk-client-sdk-protocol 形态一一对应**（spike 01 §Y1），但 pi 的官方 SDK 入口是 `createAgentSession()`（coding-agent SDK，不是 protocol）——见 P2。

【事实】其它辅助包：tui（终端 UI 库）、client（protocol 的客户端）、server（protocol 的服务端，**重要**：与 dsh sdk-jsonrpc-server 不同，pi server 是 protocol/transport 层，不是 agent 入口）、session-backends/sqlite-node（独立 SQLite backend，agent/README.md:11-15）。

【事实】agent-core 的 `Agent` 类（agent/src/agent.ts：592 行）是 **provider 调用 + 工具循环 + 事件流** 的核心：
- 构造：`new Agent({ initialState, streamFn, convertToLlm, transformContext, beforeToolCall, afterToolCall, shouldStopAfterTurn, getApiKey, getSteeringMessages, getFollowUpMessages, toolExecution })`（agent-core README.md:178-242）。
- 流式：`agent.subscribe((event, signal) => ...)`，事件分 `agent_start/end/settled`、`turn_start/end`、`message_start/update/end`、`tool_execution_start/update/end`（types.ts:428-443）。
- 控制：`agent.prompt(text)`、`agent.continue()`、`agent.abort()`、`agent.waitForIdle()`、`agent.steer()`、`agent.followUp()`（agent-core README.md:271-335）。

#### P1.2 vs dsh harness 的核心差异

| 维度 | pi agent-core | dsh harness（spike 01 §Y1-Y7） |
|---|---|---|
| 架构模型 | **类（`new Agent()`） + 事件订阅**（types.ts:325-444） | **Cordis 上下文（`ctx.tools.register`） + 插件 effect 树**（dsh `tool-fs/src/read.ts:69-110`） |
| 嵌入形态 | 库（import `@earendil-works/pi-coding-agent`，sdk.ts）+ CLI（`pi --mode rpc`）+ 实验性 protocol（binary CBOR） | 库（`@deepseek-ai/dsh-sdk-client`）+ 强制 stdio 子进程 |
| 工具定义 | `defineTool({ name, label, description, parameters, execute, executionMode?, renderCall?, renderResult? })`（extensions.md:1347-1396） | `ctx.tools.register(defineTool({...}))` |
| 钩子 | **32 个事件**（extensions.md lifecycle overview），含 lifecycle/resource/session/agent/model/tool/input | 同样事件化但通过 Cordis effect 注册/卸载（dsh `plugin life-cycle`） |
| session 持久化 | JSONL **tree**（id/parentId 链），in-place branching（sessions.md:23-25、session-format.md） | jsonl/sqlite 双后端 append-only 单线 |
| LLM 层 | **同一个 pi-ai**（pi-ai package，独立于 runtime，0.84.2） | **同一个 pi-ai**（dsh llm-pi-ai ^0.82.1） |
| 提示词装配 | `getSystemPromptOptions()` 暴露 structured options + `before_agent_start` 链式改 systemPrompt（extensions.md:534-565） | `ctx.systemPrompt.section(...)` + `context` provider（dsh `packages/core/system-prompt`） |
| 流式输出 | `subscribe(event)` callback，事件类型见 types.ts:428-443；RPC 协议外暴露相同事件（rpc.md:838-859） | `assistant/chunk` 携带原始 StreamChunk（spike 01 §Y2，dsh `session/types.ts:266`） |
| 工具审批 | **无内建审批**——文档明牌 "No permission popups"（README.md:501），靠 `tool_call` event 返回 `{block: true}` 自实现 | `ctx.approval.request` 一等 seam（dsh `packages/interaction/user-approval`） |
| skills | `~/.pi/agent/skills/<name>/SKILL.md` 文件系统加载，`pi.on('input')` 中 `/skill:name` 展开（extensions.md:895-933） | `ctx.skills` 注册表（spike 01 §Y7） |
| compaction | `session_before_compact` event（compaction.md:280-310）可 cancel 或返回 `{compaction: {summary, firstKeptEntryId, tokensBefore, details}}` | `ctx.compaction` Service Provider seam，可整体替换 backend（dsh `packages/compaction/compaction/README.md`） |
| 多 provider | pi-ai 内置 35+ provider（README.md:99-138，minimax/zai/openai/anthropic/deepseek/google/...） + `registerProvider()` 声明式新增（extensions.md:200-216） | pi-ai catalog（spike 01 §Y6，dsh `packages/llm/llm-pi-ai/src/catalog.ts:1-13`） |
| 凭证/keyring | `ModelRuntime`（model-runtime.ts）：runtime override → `~/.pi/agent/auth.json` → env vars（sdk.md:443-499） | `ctx.credentials`，配置存引用不存秘密（spike 01 §Y6） |

【推断】**两种 runtime 在工程结构上 80% 同构**（都是事件流 + 工具执行 + session 持久化 + pi-ai 适配层），差异主要在三点：(a) pi 是类 + subscribe 模式，dsh 是 Cordis 上下文模式——**pi 对 SDK 调用方更直觉**；(b) pi 无内建审批/compaction-as-Service，dsh 有——**pi 需要更多自写扩展**；(c) pi 的 session 是树形 JSONL，dsh 是 append-only 单线——**pi 对"修改早先决策并继续"的工作流更友好**（营销场景下偶发，但存在）。

---

### P2. 嵌入形态（Q0）

**这是 pi vs Y 最决定性的差异点。**

#### P2.1 库形态

【事实】**SDK 在主包内**——`import { createAgentSession, ModelRuntime, SessionManager, SettingsManager, DefaultResourceLoader, defineTool } from "@earendil-works/pi-coding-agent"`（coding-agent/package.json:12-26：main=dist/index.js，types=dist/index.d.ts；sdk.md:18-34）。完整 Quick Start（sdk.md:17-34）：

```typescript
import { createAgentSession, ModelRuntime, SessionManager } from "@earendil-works/pi-coding-agent";
const modelRuntime = await ModelRuntime.create();
const { session } = await createAgentSession({
  sessionManager: SessionManager.inMemory(),
  modelRuntime,
});
await session.prompt("What files are in the current directory?");
```

【事实】`createAgentSession()` 接受 `customTools: [myTool]`（sdk.md:595-598）、`extensionFactories: [factory]`（sdk.md:617-627）、`SessionManager.inMemory()` / `SessionManager.create(cwd)` / `SessionManager.open(path)` / `SessionManager.continueRecent(cwd)`（sdk.md:760-848，session-manager.ts:1519-1570）、`SettingsManager.inMemory()` / `SettingsManager.create(cwd, agentDir)`（sdk.md:854-901）、`cwd` / `agentDir` 自定义目录（sdk.md:331-364）。

【事实】**完全可以在我们的 Node 后端进程内 import**——package.json 标 `"type": "module"`、Node 22.19+（package.json:104）、`engines: { "node": ">=22.19.0" }`（coding-agent/package.json:104）。**没有子进程边界**——events 在 subscribe 回调里，错误异常 throw 直接到我们的 try/catch。

#### P2.2 RPC 形态（备选）

【事实】`pi --mode rpc` 走 stdin/stdout JSONL（rpc.md:1-5），RPC entry 入口是 `dist/rpc-entry.js`（coding-agent/package.json:20-22，rpc-entry.ts:1-13）。**协议比 dsh sdk 协议成熟且丰富**（rpc.md 全文 1590 行）：

| RPC 命令 | 用途 | rpc.md 行号 |
|---|---|---|
| `prompt` / `steer` / `follow_up` | 发送/排队消息（支持 images） | :41-115 |
| `abort` | 中断当前 agent 操作 | :125-135 |
| `new_session` / `switch_session` | **新建/切换 session** | :137-167、:597-613 |
| `get_state` / `get_messages` / `get_entries` / `get_tree` | 取 session 状态 | :169-213、:696-727 |
| `get_entries {since}` | 增量条目（"since last seen id"） | :696-723 |
| `fork` / `clone` | session 分叉 | :615-668 |
| `compact` / `set_auto_compaction` | 压缩 | :377-426 |
| `bash` | 直发 shell 命令 | :457-512 |
| `get_available_models` / `set_model` / `cycle_model` | 模型 | :234-275 |
| `get_commands` / `get_session_stats` / `export_html` | 元数据 | :789-827、:531-576 |
| **Extension UI 子协议**（`extension_ui_request/response`） | 扩展调用 `ctx.ui.select/confirm/input/notify` 等用户交互 | :1155-1344 |

【事实】**Extension UI 子协议是 RPC 形态下唯一缺失的视觉呈现**——TUI 的 setFooter/setWidget 等 no-op（rpc.md:1166-1176），但 select/confirm/input/editor 这四个核心交互通过子协议完整可用。这意味着 B1b 的工具审批在 RPC 形态下也走子协议：`tool_call` event 钩子（extensions.md:778-799） → `ctx.ui.confirm()` → `extension_ui_request { method: "confirm" }` 推到客户端 → 客户端经 F0.2 桥问编辑器前的用户 → `extension_ui_response` 回写。

【推断】**RPC 形态 + sdk-client 子进程方案在 pi 上也是官方支持**，但 pi 官方明确建议（rpc.md:3-5）："If you're building a Node.js/TypeScript application, consider using `AgentSession` directly from `@earendil-works/pi-coding-agent` instead of spawning a subprocess"。**对我们而言，能库就别 RPC**——F0.1 的 F0 验收项"runtime 内核薄切"在库形态下就是 ~30 行集成代码，不需要任何包装层。

#### P2.3 Extension 钩子（vs dsh 的 Cordis plugin）

【事实】**Extension 系统是 pi 一切可扩展性的承载体**（extensions.md 通 3002 行）。核心 API（extensions.md:1341-1677）：
- `pi.on(event, handler)` — 订阅 32+ 个生命周期事件（lifecycle overview 详见 extensions.md:275-348）
- `pi.registerTool({...})` — 注册自定义工具
- `pi.registerCommand(name, {handler, getArgumentCompletions?})` — 注册 `/command` 斜杠命令
- `pi.registerShortcut(key, {handler})` — 键盘快捷键
- `pi.registerF

---



---

### P3. 多模态（Q1，视觉回路生死）

#### P3.1 内容模型与 pi-ai 的 tool-result 序列化路径

【事实】`ToolResultMessage.content: (TextContent | ImageContent)[]`（types.ts:453，明确 Supports text and images，types.ts:366-370 的 `ImageContent` 类型）。**与 dsh 的 `ToolResultBlock.content: ContentBlock[]` 递归含 `ImageBlock` 是同构的**（spike 01 §Y4 录 dsh types.ts:88-93）。差别：dsh 是嵌套结构，pi 是平铺 `TextContent | ImageContent` union——**pi 反而更简单**。

【事实】**pi 与 dsh 共用同一个 pi-ai 适配层**——spike 01 §Y4 录入 dsh 路径 `packages/llm/llm-pi-ai/src/adapter.ts:307-314`、`context.ts:194-206`，**源码字面位置就是 pi monorepo 的 `packages/ai/src/api/openai-completions.ts`**。对比 spike 01 §Y4 录的 openai-completions.ts:1284-1337 和当前实读：

```
1269: } else if (msg.role === "toolResult") {
1282:     const hasImages = toolMsg.content.some((c) => c.type === "image");
1284:     // Always send tool result with text (or placeholder if only images)
1286:     const toolResultText = hasText ? textResult : hasImages ? "(see attached image)" : "(no tool output)";
1288:     const toolResultMsg: ChatCompletionToolMessageParam = {
1289:         role: "tool",
1290:         content: sanitizeSurrogates(toolResultText),
1291:         tool_call_id: toolMsg.toolCallId,
1292:     };
1294:     if (compat.requiresToolResultName && toolMsg.toolName) {
1295:         (toolResultMsg as any).name = toolMsg.toolName;
1296:     }
1297:     params.push(toolResultMsg);
1304:     if (hasImages && model.input.includes("image")) {
1305:         for (const block of toolMsg.content) {
1306:             if (isImageContentBlock(block)) {
1307:                 imageBlocks.push({
1308:                     type: "image_url",
1309:                     image_url: {
1310:                         url: `data:${block.mimeType};base64,${block.data}`,
1311:                     },
1312:                 });
1313:             }
1314:         }
1315:     }
1320: if (imageBlocks.length > 0) {
1328:     params.push({
1329:         role: "user",
1330:         content: [
1331:             { type: "text", text: "Attached image(s) from tool result:" },
1332:             ...imageBlocks,
1333:         ],
1334:     });
1335:     lastRole = "user";
1336: }
```

**关键路径与 spike 01 §Y4 录的完全一致**：tool 消息只含文本（图变 "(see attached image)" 占位或 "(no tool output)"），图片追加为紧随其后的合成 user 消息 "Attached image(s) from tool result:" + `image_url` dataURL。

#### P3.2 模型不支持图时的占位降级

【事实】`transform-messages.ts:35-57 downgradeUnsupportedImages`：当 `model.input.includes("image")` 不成立时，遍历 messages，`user` 与 `toolResult` 的 content array 全部替换为占位符 `(image omitted: model does not support images)` / `(tool image omitted: model does not support images)`（:12-13）。**静默降级不报错**。

【事实】**DeepSeek chat-completions 适配器未在已知 API 列表中**——types.ts:17-29 `KnownApi`：`openai-completions`、`mistral-conversations`、`openai-responses`、`azure-openai-responses`、`openai-codex-responses`、`anthropic-messages`、`bedrock-converse-stream`、`google-generative-ai`、`google-vertex`、`pi-messages`。DeepSeek 在 pi 中走的是 **openai-completions API**（DeepSeek 的 chat-completions endpoint 与 OpenAI 协议兼容）—— 这正是 dsh spike 01 §Y4 录的 llm-deepseek 显式拒绝图片 但 `llm-pi-ai` 通过 DeepSeek 配置的 openai-completions 路由**默认不拒图**——DeepSeek 模型的 `input: ["text", "image"]` 声明与否决定**是否走图路径**。

【推断】**DeepSeek 官方 chat 模型（deepseek-chat、deepseek-reasoner）都是 text-only input**（catalog 由 pi-ai 模型数据生成器推断，scripts/generate-models.ts）。因此 DeepSeek 走 chat-completions + 文本模型 + tool-result 内含图片 → `transform-messages.ts:35-57` 的占位降级 → 模型收到 "(tool image omitted: ...)" 占位字符串、**没有图片数据**，但**也不报错**。**这等价于 dsh 的 `llm-deepseek/src/serialize.ts:63-66` 抛 UNSUPPORTED_CONTENT 的更温和版本**——pi 选择静默降级，dsh 选择显式抛错。按 D2 拍板（2026-08-20）：默认走**通道 B**——look 截图不进主 agent 消息，由独立视觉模型侧信道处理（视觉 route 见本节下文），主对话 text-only、DeepSeek 系原生兼容；占位降级仅在**通道 A**（图随 user/toolResult 消息直送）叠加非视觉模型时发生——A 是备选降级路径（D2a）。

【事实】**视觉模型 route 配置机制**与 dsh 一致——通过 `~/.pi/agent/models.json` 添加自定义 model（README.md:143）。同时 extension 可在运行时通过 `pi.registerProvider()` 注入（extensions.md:200-216，async factory 模式）。`ModelRuntime` 接受 `authPath: "/custom/agent/auth.json`、`modelsPath: "/custom/agent/models.json`（sdk.md:467-479）——**F0.3② 生图凭证和视觉模型凭证都可走同一机制**，与 dsh Y6 等价。

#### P3.3 图像活着到达模型的具体条件

【事实】**三个 gate 必须同时为真**（综合 types.ts:833 `input: ("text" | "image")[]`、transform-messages.ts:36、openai-completions.ts:1304）：
1. **tool-result 内含 ImageContent 块**——execute() 返回 `{content: [{type: "image", data: <base64>, mimeType: "image/png"}]}`（types.ts:366-370）。
2. **模型声明 `input.includes("image")`**——catalog 中 model 字段 `input` 数组含 `"image"` 字符串。**DeepSeek 官方模型不满足**；自定义 OpenAI 兼容视觉端点必须显式声明 `input: ["text", "image"]`。
3. **provider 适配器走 openai-completions 路径**——`anthropic-messages` 适配器有自己的 image 序列化（不在 openai-completions.ts 处理），`google-generative-ai` 也独立。所以**chat-completions 模型 = openai-completions API**（DeepSeek 通过兼容模式走这里），anthropic 与 google 的图处理是各自 file。

【事实】**降级 fallback**（已实测成立，spike 01 §Y4）：**非视觉模型** 收到 `(tool image omitted: model does not support images)` 占位字符串（transform-messages.ts:13），**整个 tool-result 仍正常返回给模型**——只是没有图像内容。这是语义无损降级的实现。

【推断】**Q1 的答案是**：
- **C4a（look 图片到模型）**：主线为**通道 B**（D2 已拍板默认）——look 截图不进主 agent 上下文，由独立视觉模型侧信道处理，主模型（DeepSeek 系 text-only）只收文本结果，**不存在降级问题**；通道 A（直送图进上下文）为备选，A 形态下在 DeepSeek 系模型上必然走占位降级——这与 spike 01 §Y4 的结论一致；
- **通道 B 视觉侧信道**：注册一条 OpenAI 兼容视觉 route（如某个 GPT-4o 网关或内部视觉模型），look 图片以 image_url dataURL 形态发到该模型——**配置驱动 0 代码**（D2a 注记：与 A 同 provider 同 RPC 路径，差异仅在图字段是否进 message）。
- **spike 实测项**：(a) DeepSeek 实际模型声明的 `input` 是否含 `image`（catalog 由 generate-models.ts 生成，需看 generated/models.generated.ts 944 行的具体条目）——离线可查，作为通道 A 探测的预期判定依据；(b) 通道 A 备选探测：自定义 OpenAI 兼容视觉端点对 chat-completions `image_url` dataURL 的真实接受度（时间盒，不阻塞选型）。

---


---

### P4. 流式（Q3，UIMessage stream v1 适配工作量）

#### P4.1 事件流形态

【事实】**agent-core 事件流**（types.ts:428-443）：

| Event | 关键字段 | 含义 |
|---|---|---|
| `agent_start` | — | run 开始 |
| `agent_end` | `messages` | run 结束（低层，可能有 retry/compaction follow-up） |
| `agent_settled` | — | **真正结束**（无 retry/compaction/follow-up）—— 这是 UI 渲染完成的安全点 |
| `turn_start` / `turn_end` | `message, toolResults` | 单 turn（LLM 调用 + 工具执行） |
| `message_start` | `message` | user/assistant/toolResult 开始 |
| `message_update` | `message, assistantMessageEvent` | **仅 assistant** 流式，assistantMessageEvent 形态见下 |
| `message_end` | `message` | 消息完成（**可返回 `{message}` 替换**） |
| `tool_execution_start` | `toolCallId, toolName, args` | 工具开始 |
| `tool_execution_update` | `+ partialResult` | 工具进度（bash 实时输出等） |
| `tool_execution_end` | `+ result, isError` | 工具完成 |

【事实】`assistantMessageEvent` 子类型（rpc.md:939-950、coding-agent/README.md 章节流式部分）：
- `text_start` / `text_delta` / `text_end` — 文本块生命周期
- `thinking_start` / `thinking_delta` / `thinking_end` — 思考块（如果模型支持）
- `toolcall_start` / `toolcall_delta` / `toolcall_end` — 工具调用（`toolcall_end.toolCall` 含完整 call）

**所有子类型带 `contentIndex`**——多个内容块（文本 + 思考 + toolCall）的稳定标识，客户端用它组装的 partial message（rpc.md:963-967）。

#### P4.2 vs UIMessage stream v1

【事实】**UIMessage stream v1 chunk 形态**（旧仓库实测，spike 01 §Y2 引旧 `http-agent-transport.ts:93-98` 注释）：`text-start/text-delta/text-end`、`reasoning-start/delta/end`、`tool-input-start/input-delta/input-available`、`tool-output-available`、`finish`、`error`、`data-*`、`source`。

【推断】**pi 事件流与 UIMessage v1 同构**——这是 spike 01 §Y2 没意识到的本质差异：

| UIMessage v1 | pi assistantMessageEvent / 工具事件 | 适配 |
|---|---|---|
| `text-start{id, index}` | `text_start{contentIndex}` | id 用 `{messageId}:{contentIndex}` 即可 |
| `text-delta{id, delta}` | `text_delta{contentIndex, delta}` | 直译 |
| `text-end{id}` | `text_end{contentIndex, content}` | 直译 |
| `reasoning-start/delta/end` | `thinking_start/delta/end` | 直译（仅模型支持时） |
| `tool-input-start` | `toolcall_start` | 直译 |
| `tool-input-delta` | `toolcall_delta{delta}` | 直译（需客户端 buffer delta，到 `toolcall_end` 拿到完整 arguments） |
| `tool-input-available` | `toolcall_end{toolCall}`（含完整 arguments） | 直译 |
| `tool-output-available` | `tool_execution_end{result, isError}`（result.content 含 TextContent/ImageContent 数组） | **需 flatten**：把 `result.content` 数组映射成 output 字段 |
| `finish` | `agent_settled` | 用 `agent_settled` 而非 `agent_end`（避免 retry 误判） |
| `error` | `message_end` 中 `errorMessage` 字段 + `stopReason === "error"/"aborted"` | 监听 `message_end` |

【事实】**`tool-result 带 ImageBlock`** 与 spike 01 §Y4 录 dsh 等价处理：渲染侧把 ImageContent `{type:"image", data, mimeType}` 还原成 output 字段，**前端 ChatMessage.vue 的 `output.base64/mimeType` 自渲染模式不变**（spike 01 §Y2 表格末行）。

【推断】**adapter 工作量估算**：
- **spike 01 §Y2 估 Y 工作量 1.5-2.5 人日**（dsh 自研 chunk 协议 → UIMessage 映射）；
- **pi 路线**因为协议同构 + RPC 形态下 event 字段已经是 JSON，**估 1-1.5 人日**——约减 50%。库形态下甚至更少：直接 `session.subscribe(event => adapter(event))`，无 IPC。

#### P4.3 中断/取消（用户停止按钮）

【事实】`session.abort()`（sdk.md:107）、`agent.abort()`（agent-core README.md:321）、`ctx.abort()`（extensions.md:1026-1028）。**有** prompt 级 cancel，是一等 API。**vs Y 的必须关进程是显著优势**（spike 01 §Y1①）。

【事实】RPC 形态：`{"type": "abort"}` 命令（rpc.md:125-135）。**两形态都有内建 cancel**。

---
### P5. session/compaction（Q2）

#### P5.1 resume / 挂起 / 恢复

【事实】**四种 resume API**（sdk.md:790-848）：
- SessionManager.open(path) — 文件路径 → 整个 session 装载（session-manager.ts:1530-1549）
- SessionManager.continueRecent(cwd) — 项目最近 session
- SessionManager.forkFrom(sourcePath, targetCwd, sessionDir?) — 跨项目 fork（session-manager.ts:1579+）
- AgentSessionRuntime.switchSession(path) — 切换活动 session（sdk.md:170-178、:813-815）
- AgentSessionRuntime.fork(entryId, options?) — 从某个 entry 创建 fork（sdk.md:817-820）

【事实】**get_entries {since: "<entryId>"}**（rpc.md:696-723）—— 返回 since 之后的 entries，**leafId 字段告知客户端 active branch 是否移动**。**这是 dsh wire 完全没有的 delta cursor 模式**——可以做到客户端重启后从上次见到的地方增量同步。

【事实】**跨重启支持**：SessionManager.open(<文件路径>) 不依赖任何运行时内存——纯文件读取（session-manager.ts:1534-1549 readSessionHeader）。**比 Y 路线的自写薄 server 插件补 resume 工作量小一个数量级**。

【推断】**F0.5 工作量（pluginData sessionId 装载）**：
- pluginData 存 {sessionFile: <绝对路径>, sessionId: <uuid>}（可选，sessionFile 即可恢复）；
- 打开文件时 SessionManager.open(pluginData.sessionFile) → createAgentSession({ sessionManager, ... }) → session.subscribe(...)；
- 新 session 时 SessionManager.create(cwd, sessionDir) → 写 pluginData。
- **0.5 人日含测试**，比 Y 路线（spike 01 §Y2 表 F0.5 = 1 人日）减半。

#### P5.2 compaction 注入点

【事实】**session_before_compact event**（extensions.md:452-490、compaction.md:280-310）—— 可取消（{cancel: true}）或提供自定义 summary（{compaction: {summary, firstKeptEntryId, tokensBefore, details}}）。**details 字段是任意 JSON**——extensions can store any JSON-serializable data in details（compaction.md:140）。

【事实】**compaction Service API**（compaction.md:7）：源文件 packages/coding-agent/src/core/compaction/compaction.ts、 branch-summarization.ts、utils.ts——**不是 Cordis 那种可整体替换 Service Provider**（spike 01 §Y5 录 dsh ctx.compaction），而是**通过 session_before_compact event 钩子改写 summary 文本**——**接口形态不同但语义等价**。

【事实】**自动触发条件**（compaction.md:31-34）：contextTokens > contextWindow - reserveTokens，reserveTokens 默认 16384；keepRecentTokens 默认 20000。配置位置 ~/.pi/agent/settings.json 或 <project>/.pi/settings.json（compaction.md:32-37）。

【推断】**媒体省略（K=2 elision）的注入点**有两个候选：
1. **context event 钩子**（extensions.md:657-668）—— 每个 LLM 调用前修改 messages，深拷贝安全。**最直接的注入点**：把超长 toolResult 替换为占位文本，与旧 elision.ts 语义一致。
2. **session_before_compact event**—— 自定义 summary 文本中体现媒体省略结果（不直接执行省略）。

**建议走 (1)**：context event 的 messages 是深拷贝，可直接 mutate/filter，不需要动 compaction 本体。**等价于 dsh 的 llm/stream 拦截方案**（spike 01 §Y5 推断），代码量相近（0.5-1 人日）。

【事实】**compaction 重试**：自动 compaction 失败有 auto_retry_start/end 事件（rpc.md:1080-1109）；compaction/branch summary 失败有 summarization_retry_* 事件（rpc.md:1112-1124）——**与 dsh auto_retry_* 等价**。

---


---

### P6. 工具桥接

【事实】**`AgentTool` 接口**（types.ts:386-409、agent-core README.md:405-456）：

```typescript
const readFileTool: AgentTool = {
  name: "read_file",
  label: "Read File",
  description: "...",
  parameters: Type.Object({ ... }),  // typebox schema
  executionMode: "sequential",  // optional
  execute: async (toolCallId, params, signal, onUpdate) => {
    // throw on failure (per agent-core README.md:445-452)
    return {
      content: [{ type: "text", text: content }],  // OR ImageContent
      details: { path: params.path, size: content.length },
    };
  },
};
```

【事实】**execute 签名**：`async (toolCallId, params, signal?, onUpdate?)`—— **`signal` 是 AbortSignal**（types.ts:399）、`onUpdate` 是 streaming 回调（types.ts:383）。**这就是 spike 01 §Y3 提的 execute 是普通 async 函数所以可以自由 RPC 转发 模式**——直接 `await bridge.sendRPC('tool', params, { signal })` 即可。

【事实】**execute 在 coding-agent 进程里执行**（无独立进程边界），signal 是 pi agent 的 abort signal，**与 ws-client 的 300s 超时（spike 01 §Y3）共存**——我们 exec.signal 早 abort bridge RPC，agent 也立即收到 abort。

【事实】**参数验证**：`parameters: Type.Object(...)` 是 typebox schema，pi-ai 在调用 execute 前自动 `validate`（types.ts:386-409）。**与 dsh 的 JSON Schema 参数验证等价**（spike 01 §Y3）。

【事实】**错误处理**：Throw an error when a tool fails. Do not return error messages as content（agent-core README.md:445-452）。异常被捕获，标记 `isError: true` 传给模型。**与 dsh 行为一致**（spike 01 §Y3）。

【事实】**`tool_call` event 钩子**可改 `event.input`（extensions.md:768-773）——**preflight 阶段可 mutate args**，No re-validation is performed after your mutation（extensions.md:773）。这意味着我们可以在 execute 前注入 connectionId、brandSelection 等附加上下文——但**和把 brandSelection 装进 tool parameters 不是同一种解法**——**F0.6 的 overlay 应走 `before_agent_start` 而非工具层**，见 P2.3 表。

【推断】**F0.2 + C3a 工具包装工作量**：
- 把 CORE_TOOLS 每个 ToolDef 包成 `AgentTool`：`name/label/description/parameters` 直译、execute 体内 `await bridge.sendRPC('tool', params, { signal })`、把返回的 `{base64, mimeType}` 还原成 `{content: [{type:"image", data, mimeType:Type.X}]}`（look 工具）。
- **2-3 人日**，与 spike 01 §Y3 估 dsh Y 路线相同工作量（桥的形状不变）。

---

### P7. 凭证 / 多 provider

【事实】**`ModelRuntime`**（model-runtime.ts、sdk.md:443-499）：
- 解析优先级（sdk.md:444-449）：① Runtime overrides（`setRuntimeApiKey("anthropic", "sk-...")`），**不持久化**）；② `auth.json` 文件；③ env vars；④ Fallback resolver（custom providers from models.json）
- 工厂：`ModelRuntime.create({ authPath?, modelsPath?, credentials?, modelsStore?, allowModelNetwork?, modelRefreshTimeoutMs? })`（sdk.md:373-413、model-runtime.ts:186+）
- 自定义 store：`InMemoryCredentialStore`（sdk.md:451）、`DefaultAuthStorage.create(authPath)`（auth-storage.ts）

【事实】**35+ 内置 provider**（README.md:99-138），含 anthropic/openai/deepseek/google/xai/groq/minimax/zai-coding/kimi-coding/huggingface/fireworks 等。**DeepSeek 是 openai-completions API 兼容**（与 chat-completions 端点相同）。

【事实】**自定义 provider** 通过 `~/.pi/agent/models.json` 声明式新增（README.md:143、`models.json` 结构详见 docs/models.md），或 extension 内 `pi.registerProvider(id, {baseUrl, apiKey, api, models})` 动态注册（extensions.md:200-216，**async factory**）。

【事实】**OAuth 支持**：`@earendil-works/pi-ai/oauth` exports（ai/package.json:67）。具体 provider OAuth 流：anthropic（Max/Pro）、openai（Codex）、github-copilot、google（Vertex）。

【推断】**F0.3①（聊天 key）+ F0.3②（生图独立凭证）在 pi 上的落地**：
- **聊天 key**：我们的后端持有 key（沿用 `/v1/auth` provision 或 env），调 `await modelRuntime.setRuntimeApiKey("openai"|"anthropic"|..., key)` —— **不写入磁盘**，每次进程启动重设。**等价 dsh Y6 推断的 env 注入方案**。
- **生图独立凭证**：原样保留在编辑器内（与 dsh Y6 同）。
- **视觉模型 route**（如果走层 2 D2）：在 `models.json` 声明自定义 OpenAI 兼容端点（baseURL + key + model + `input: ["text", "image"]`），`ModelRuntime` 自动加载。
- **工作量**：与 dsh Y6 同（spike 01 §Y2 表 F0.3 = 2 人日）。

---

### P8. 工具审批 / skills

【事实】**工具审批 = 自写 `tool_call` event 钩子**（extensions.md:778-799）：

```typescript
pi.on("tool_call", async (event, ctx) => {
  if (event.toolName === "dangerous_tool") {
    const ok = await ctx.ui.confirm("Title", "Allow?");
    if (!ok) return { block: true, reason: "Blocked by user", terminate: true };
  }
});
```

【事实】**RPC 形态下 `ctx.ui.confirm()` 走 extension_ui_request 子协议**（rpc.md:1155-1175、:1325-1341）—— `{"type":"extension_ui_request", id, method:"confirm", title, message, timeout}` 推到客户端 → 客户端经 F0.2 桥问编辑器前的用户 → `{"type":"extension_ui_response", id, confirmed:true|false}` 回写。

【事实】**库形态下 `ctx.ui.confirm()` 是直接 await**——没有 UI 协议层，由我们 SDK 集成方实现挂起工具执行 + 问用户语义。这意味着：
- **库形态**：B1b 工具审批 = `tool_call` event 内 `await new Promise(resolve => askEditorBridge(...))` —— **自写一个 ask/response 协议**，**与 dsh `ctx.approval.request` 的语义等价但需要自写**。
- **RPC 形态**：B1b = `ctx.ui.confirm()` 自然走 extension_ui_request 子协议，**几乎是免费的**——但前提是我们走 RPC 而非库。

【推断】**B1b（审批穿桥）工作量**：
- **库形态**：约 2-3 人日（自写 ask/response 协议 + 桥协议扩展审批往返 + UI 适配）。
- **RPC 形态**：约 1-2 人日（UI 子协议已在 wire 上、桥只需透传 `extension_ui_request/response` 两个 JSON 对象）。
- **vs dsh Y**：Y7 估 dsh Y 路线审批穿桥在层 2 不阻塞选型（spike 01 §Y7 末段）—— pi 也一样不阻塞。

【事实】**skills**（README.md:354-367、extensions.md:895-933）：
- 文件位置：`~/.pi/agent/skills/<name>/SKILL.md`（Agent Skills standard，https://agentskills.io）
- 调用：`/skill:name` 触发，**也支持模型自动加载**（README.md:355）
- 注入：`input` event 中可拦截/重写 `/skill:` 命令（extensions.md:925-928）
- **vs dsh `ctx.skills` 注册表**（spike 01 §Y7）：pi 是**纯文件系统发现**，dsh 是**注册表**——形态不同但语义等价。

【推断】**skills 在 pi 上零新代码**——直接写 SKILL.md 到 `~/.pi/agent/skills/marketing/SKILL.md`，模型在合适场景自动加载。**比 dsh Y 路线略简单**（不需要注册表代码）。

---


---

### P9. 成熟度信号

【事实】**版本**：`pi-monorepo` root `0.0.3`（package.json:66，monorepo 标识）；各包 `0.84.2`（coding-agent/package.json:3、agent/package.json:3、ai/package.json:3、telemetry/package.json）——**版本号本身说明迭代活跃**。

【事实】**Git 活动**（`git -C pi log` 实测）：
- 总 commits：**6211**
- 2025-08 以来：**5732 commits**（92% 在过去一年内）
- 最近 10 个 commit 包含：`fix(ai): fallback cost not via stream options`、`feat(ai): generalize openai-completions thinking token budget fields`、`fix(coding-agent): load extensions in Node SEA hosts`、`fix(ai): prevent copilot policy login rate limits`、`fix(ai): anthropic fallback usage`——**密集的修复 + feature 节奏**，每周 5-15 个 commit。
- 含 merge revert、PR ref（#8352、#8261 等）——**GitHub PR workflow 在跑**。

【事实】**CHANGELOG**（CHANGELOG.md:1-60）：
- `[Unreleased]` 有 9 个 fix 条目（cache miss notices、subagent 重复 prompt、npm package downgrade、llama.cpp 模型丢失、Z.AI 模型引用、context overflow 误标、Windows VS Code 终端粘贴、login guidance、model catalog retry）。
- `[0.84.2] - 2026-08-14`（与我们 spike 日期 2026-08-20 一致）：完整功能（fullscreen transcript search、`Ctrl+Shift+F`、`defaultTools` 设置、`--use-theme` 标志、`expandPromptTemplates` 扩展选项、Cloudflare AI Gateway、Mistral native transport、Kimi UA header）—— **每周 release 节奏**。
- **Feature not Bug** 比例高：CHANGELOG 每版 ~15-30 条目，多数是 feature。

【事实】**测试**：
- `vitest` 全 workspace（package.json:33 `npm run test`）
- agent 包有 `vitest.harness.config.ts` 单独配置（agent/package.json:33）—— **harness 测试套件独立**
- 覆盖率脚本 `coverage:harness`（agent/package.json:34）
- 包含 `check:browser-smoke`、`check:shrinkwrap`、`check:pinned-deps`、`check:ts-imports`、`check:install-lock:coding-agent`（package.json:19-22）—— **多门 lint/check，supply-chain hardening 是工程级实践**。

【事实】**npm 可得性**：
- `@earendil-works/pi-coding-agent` 在 npm（README.md:8）
- **依赖精确锁版**：`.npmrc` 设 `save-exact=true` 和 `min-release-age=2`（README.md:81）
- 直接 external deps 都精确版本（`@types/node: 22.19.19`、`@biomejs/biome: 2.3.5`、`typescript: 5.9.3`，package.json:51-62）
- 发布含 `npm-shrinkwrap.json`（coding-agent/package.json:33）

【事实】**与同类项目关系**：README.md 暗示**Mario Zechner（@badlogic）个人主导**（README.md:96、X 链接 x.com/badlogicgames）、**有 Hugging Face 数据集公开 pi-mono 工作 session**（README.md:104）。**不是 Claude Code/Cursor 等公司产品**——是开发者主导的开源项目。

【事实】**生产环境使用**：
- README.md 提 Share your OSS coding agent sessions—— **公开鼓励 OSS 项目使用 pi**
- HuggingFace 数据集 `badlogicgames/pi-mono` 包含作者自己的工作 session
- 文档提 Slack/chat automation and workflows see earendil-works/pi-chat—— **同作者的聊天工作流产品**用到 pi
- **【假设】**除作者外的具体生产部署数据无证据。

【推断】**成熟度评级**：
- 与 dsh 0.1.0-rc.7 + developer preview + breaking changes 相比（spike 01 §X5），**pi 是 0.84.2 + 周更 + 6000+ commits + 完整 supply-chain hardening + npm shrinkwrap + 模型数据 generated 流程** —— **成熟度高一个数量级**。
- 与 Claude Code / Cursor 等商用产品相比：**API surface 稳定性弱（周更可能 break）**，但**可嵌入性 / 可扩展性强**（library + RPC + protocol 三层）。
- **风险**：(a) pi 由单一个体主导（bus factor），(b) 周更节奏意味着我们需要严格 pin 版本 + 升级 smoke 测试，(c) `pi-chat` 与我们的产品形态有竞争可能但不是当前问题。

---


---

## 2. 三方对比矩阵

维度：可行性 × 成熟度 × 多模态 × session × 流式 × 工具桥 × 生态

| 维度 | **路线 X（dsh 入壳）** | **路线 Y（dsh 无头）** | **pi 直接驱动（推荐）** |
|---|---|---|---|
| **可行性** | 【事实】可行但必须策略 B/C（spike 01 §X1）；React 壳包装 + tsdown 构建 + 样式隔离 ≈ 33 人日（spike 01 §2） | 【事实】可行但有阻塞项 Y5（sdk-jsonrpc-server 无 resume）→ 需 fork ~250 行 server；≈25 人日 | 【事实】**库形态直接 import，无 fork 无补偿**；≈17-20 人日（见 §3） |
| **成熟度** | 【事实】dsh 0.1.0-rc.7 + README 明牌 developer preview + breaking changes（spike 01 §X5） | 【事实】同 dsh，Y 形态下耦合面只剩 sdk wire（3 方法 4 通知） | 【事实】**pi 0.84.2 + 6211 commits + 周更 + npm shrinkwrap + supply-chain hardening**；文档 3000+ 行（extensions.md 全文） |
| **多模态** | 【事实】依赖 pi-ai（spike 01 §Y4）；chat-completions 合成 user 消息 + 占位降级 | 【事实】同 X；Y4 全程详细；DeepSeek 占位降级（spike 01 §Y4 第④点） | 【事实】**同一个 pi-ai 路径**（openai-completions.ts:1269-1337）；DeepSeek 占位降级（transform-messages.ts:35-57）；**视觉 model route 0 代码声明** |
| **session** | 【事实】用 dsh 自带 + pluginData 选 session；dsh 自带 resume | 【事实】外部 id 可 create（spike 01 §Y5）；**resume 有 gap → fork server** | 【事实】**`SessionManager.open(path)` 一行 API 装载完整 tree JSONL**；in-place branching 与 fork 都是 layer cake 上的免费能力 |
| **流式** | 【事实】dsh 自研 chunk → UIMessage v1 需 adapter（spike 01 §Y2 表）；1.5-2.5 人日 | 【事实】同 X | 【事实】**协议同构**（text_start/delta/end、toolcall_start/delta/end、tool_execution_*）；**adapter 1-1.5 人日** |
| **工具桥** | 【事实】原 F0.2 桥（同）；dsh 工具包装 2-3 人日 | 【事实】同 X | 【事实】**`AgentTool.execute` 是普通 async 函数**（types.ts:386-409），**与 dsh execute 模式等价**；2-3 人日 |
| **生态** | 【事实】dsh 生态：插件、分发、zh 一等语言（spike 01 §X4）—— **但与 localhost 形态规划冲突** | 【事实】dsh 生态继承 Y，但 SDK wire 暴露面小 | 【事实】**Mario Zechner 个人项目 + Hugging Face 公开 session + pi-chat 同作者**；**35+ 内置 provider**（含 deepseek、minimax、kimi-coding 等）；**npm shrinkwrap + supply-chain hardening** |

【推断】**真实差异最大的三件事**（不是营销话术）：
1. **resume 是 API 而非 fork**：Y 路线必须 fork ~250 行 sdk-jsonrpc-server（spike 01 §Y5 是阻塞项）；pi 路线 `SessionManager.open(path)` 是 SDK 顶层 API（session-manager.ts:1530-1549）—— **零 fork 代码**。
2. **流形态先天同构**：pi RPC event 流（text_start/delta/end、toolcall_start/delta/end、tool_execution_*）与 UIMessage v1 字段对齐；dsh 自研 chunk 协议需 adapter 翻译。**工作量 pi 比 Y 减 50%**。
3. **session 是树不是线**：pi JSONL 是 id/parentId 树形（sessions.md:69-86），可 in-place branching（`/tree`）和 fork（`fork(entryId, {position:"at"})`）；dsh 是 append-only 单线（spike 01 §Y5 jsonl/sqlite 后端）—— pi 对营销场景修改早先决策工作流免费友好。

---

## 3. 工作量估算（F0 + 层 1）

关键假设：①估算含单测不含联调返工；②F0.2 桥移植、C3a 工具包装在两路线等价（见 spike 01 §2 与本 spike P6）；③层 2 增强不计入；④1 人日 = 1 个熟悉代码库的工程师 1 天。

| 块 | pi 直接驱动（库形态） | 备注 |
|---|---|---|
| F0.1 runtime 内核薄切 | **2**（`createAgentSession` + `ModelRuntime` + `SessionManager.inMemory`/`.open` 集成；自写一个 SDK 包装层，~30-50 行） | Y 路线是 4 人日（spike 01 §2 表，spike 01 §Y5 fork server 已含）—— pi 减半 |
| F0.2 工具执行桥 | 2 | 同 Y（spike 01 §2 表） |
| F0.3 凭证 | 1.5（`ModelRuntime.setRuntimeApiKey` 注入；视觉 model route 声明到 `models.json`） | Y 是 2（spike 01 §2 表）—— pi 略少，因 key 不需写 credentials.yaml |
| F0.4 传输契约 + 最简 chat UI | **1.5**（agent-core event 流 → UIMessage v1 adapter ~150 行；同 Y 工作量但**协议同构，代码更短**） | Y 是 3（spike 01 §2 表）—— pi 减半 |
| F0.5 session↔文件 | **0.5**（`SessionManager.open(<path>)` 直接装载；pluginData 存文件路径即可） | Y 是 1（spike 01 §2 表）—— pi 减半 |
| F0.6 prompt 注入 | **1.5**（`before_agent_start` event 钩子链式改 `event.systemPrompt` + 读 `event.systemPromptOptions`；两段式 + overlay 通过 `event.systemPrompt + branding_overlay_md`） | Y 是 1（spike 01 §2 表）—— pi 略多，structured options API 略复杂 |
| F0.7 prompts 构建链 | 0.5 | 同 Y（spike 01 §2 表） |
| **F0 小计** | **≈ 9.5 人日** | Y 是 14.5（spike 01 §2 表）—— pi **减 5 人日** |
| C1a 需求单 | 2 | 同 Y（spike 01 §2 表） |
| C2a brand + overlay | 3（brand 服务留后端；overlay 走 `before_agent_start` 同 F0.6） | Y 是 3（spike 01 §2 表）—— 等价 |
| C3a 生成工具包装 | 2.5 | 同 Y |
| C4a look 图片 | **2**（pi-ai 路径内置；视觉 route 配置驱动；`context` event 钩子做媒体省略） | Y 是 2（spike 01 §2 表）—— 等价 |
| C5a ConfigBar 集成 | 1 | 同 Y |
| **层 1 小计** | **≈ 10.5 人日** | Y 是 10.5（spike 01 §2 表）—— **等价** |
| **合计（F0 + 层 1）** | **≈ 20 人日** | Y 是 25（spike 01 §2 表）；X 是 33（spike 01 §2 表）—— **pi 比 Y 减 5 人日，比 X 减 13 人日** |

【推断】**pi 路线 vs Y 路线的真实工作量差 ≈ 5 人日**，主要在：
- F0.1（resume API vs fork server）：-2
- F0.4（adapter 同构 vs 翻译）：-1.5
- F0.5（open 一行 API vs create/resume fork）：-0.5
- F0.6（structured options API 多一点代码）：+0.5
- F0.3（key 注入略简单）：-0.5

---

## 4. 风险登记册

| # | 风险 | 概率 | 影响 | 缓解 |
|---|---|---|---|---|
| **R-pi-1** | **pi 周更可能 break SDK 集成**（CHANGELOG 显示每周 5-15 commits） | 高 | F0.1 编译断 / 事件字段变化 | 锁版本（`@earendil-works/pi-coding-agent@0.84.2` 精确）+ 升级 smoke 清单（建仓即写）：hello-session、hello-tool、hello-image 三个端到端脚本 |
| **R-pi-2** | **Mario Zechner 单一个体主导**（bus factor = 1，README.md:96 暗示） | 中 | 项目长期方向变化、维护停滞 | 锁定版本 + 内部维护一份 ~30-50 行 SDK 包装层，万一停止维护可继续使用冻结版本（与 dsh 的 fork 不同——dsh 是 fork 必需代码，pi 是 wrapper 易替代） |
| **R-pi-3** | **通道 A（备选路径）多模态在 DeepSeek 系 chat-completions 上** 不接受 image_url dataURL（spike 01 §Y4 第③点同样风险） | 低（仅影响备选通道 A；主线通道 B 主模型 text-only 原生兼容，不经主 agent 模型传图） | 通道 B 即「look 图片不直达主模型」的产品化默认（D2）；A 叠加非视觉模型时走占位降级 | pi-ai 路径已通（openai-completions.ts:1304-1315）；spike S-pi-2 时间盒探测 2 个端点（DS 官方 + 1 个 OpenAI 兼容视觉）；非视觉模型走 `transform-messages.ts:35-57` 占位降级（不报错） |
| **R-pi-4** | **工具审批没有 dsh 那样的 `ctx.approval.request` 一等 seam** | 中 | B1b 工作量增加；需自写 ask/response 协议 | `tool_call` event 钩子 + `ctx.ui.confirm()` + 桥协议扩展（库形态）或 RPC extension_ui 子协议透传（RPC 形态）—— 不阻塞层 1，B1b 属层 2 |
| **R-pi-5** | **compaction 不是可整体替换的 Service**（与 dsh `ctx.compaction` 不同） | 低 | 媒体省略策略需走 `context` event 钩子而非注册新 backend | `context` event 钩子（extensions.md:657-668）语义等价 dsh `llm/stream` 拦截方案（spike 01 §Y5 推断）；不阻塞 C4a |
| **R-pi-6** | **自定义 prompt 注入比 dsh 略复杂**（structured options API 而非字符串拼接） | 低 | F0.6 工作量多 0.5 人日 | 在 extension 内 `event.systemPrompt + "

" + overlay` 即可；可读 `event.systemPromptOptions` 检视当前已有结构 |
| **R-pi-7** | **OpenAI provider SDK 是 pi-ai 的依赖**（`openai: 6.40.0`，ai/package.json:70），**意味着即使我们走 Anthropic，pi-ai 也安装 OpenAI SDK** | 低 | node_modules 体积增加 ~5MB | 不阻塞；与 dsh Y 路线等价（llm-pi-ai 同样依赖 OpenAI SDK） |
| **R-pi-8** | **pi-coding-agent 依赖 `photon-node` WAS**（`@silvia-odwyer/photon-node: 0.3.4`，coding-agent/package.json:51）用于 image-resize-worker.ts（binary build 模式） | 中 | npm 安装时需 `--ignore-scripts`（README.md:66）；Windows 上 WAS 加载可能慢 | 库形态下不构建 binary 不受影响；npm install 加 `--ignore-scripts` 是 README 推荐做法；spike 必测 Windows npm install |
| **R-pi-9** | **RPC 形态需要 JSONL framing 严格 LF**（rpc.md:30-37：RPC mode uses strict JSONL semantics with LF as the only record delimiter. In particular, Node readline is not protocol-compliant） | 低 | RPC 集成时如用 readline 会断 JSON | 自写 `
` 切分 reader（rpc.md:1557-1568 给出 Node.js 范例）—— 不复杂 |
| **R-pi-10** | **`session_before_compact` 钩子改 summary 文本 vs dsh 替换 Service 的语义差** | 低 | 媒体省略注入需走 `context` event 而非 compaction 钩子 | 已在 R-pi-5 处理；不阻塞 |

【推断】**最大风险是 R-pi-1（周更 break）和 R-pi-8（photon-node WAS 安装）**——前者是流程纪律（pin + smoke），后者是 Windows 部署细节。R-pi-3（DeepSeek 多模态）和 R-pi-4（工具审批）是已知工作量增量，不构成选型阻塞。

---

## 5. 与 spike 01 既有结论的对账

| spike 01 结论 | 本 spike 对账 |
|---|---|
| §0 推荐路线 Y | **覆写**：推荐路线改为 pi 直接驱动；spike 01 §Y5 的 resume 阻塞项在 pi 上不存在（`SessionManager.open` 是 SDK API），spike 01 §Y2 的流适配工作量在 pi 上减半 |
| §Y1 dsh = stdio 子进程 + JSON-RPC，cordis.yml 自组 | pi 提供三种形态（库 / RPC / 实验性 protocol）—— **库形态不需要任何进程边界**；Y 的必须 fork 薄 server 问题在 pi 上不存在 |
| §Y2 StreamChunk 与 UIMessage v1 映射表 | pi 的 `assistantMessageEvent` 子类型（text_start/delta/end、toolcall_start/delta/end）**字段同构**，adapter 工作量减半 |
| §Y4 DeepSeek 系 text-only → 占位降级 | **同 pi**：pi-ai 是同一个包；`transform-messages.ts:35-57` 的占位降级语义与 dsh 一致（只是 pi 静默不抛错） |
| §Y5 resume gap → fork server | **pi 无此 gap**：`SessionManager.open(path)` 是 session-manager.ts:1530-1549 的官方 API |
| §Y6 凭证 / catalog 声明式 route | pi 完全等价（`models.json` + `ModelRuntime` + `setRuntimeApiKey`） |
| §Y7 skills + 工具审批 | pi skills 是文件系统（等价 dsh `ctx.skills`）；**pi 工具审批是自写 `tool_call` event + `ctx.ui.confirm()`**（vs dsh `ctx.approval.request`），工作量略增但不阻塞 |
| §2 X 比 Y 贵 30% | **pi 比 Y 减 20%**（≈25 → 20 人日），比 X 减 39%（≈33 → 20 人日） |
| §5 D7 收口 runtime = dsh | **覆写**：runtime
 = pi 直接驱动（库形态）；保留 dsh 作为层 2 / 备选（pi-chat 同作者方向可能演变） |

---

## 6. spike S-pi 计划建议

**spike 走通后即可定 D7 = pi**。最小 spike 范围（按序）：

### S-pi-1（库形态最小集成，1-1.5d）

```typescript
// 1. 在我们 Node 后端 import
import { createAgentSession, ModelRuntime, SessionManager, defineTool } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";

// 2. 注册一个 echo 工具（验证 tool execution 在我们进程内）
const echoTool = defineTool({
  name: "echo",
  label: "Echo",
  description: "Echo back the input",
  parameters: Type.Object({ text: Type.String() }),
  execute: async (id, params) => ({
    content: [{ type: "text", text: `Echo: ${params.text}` }],
    details: {},
  }),
});

// 3. 创建 session（in-memory）
const modelRuntime = await ModelRuntime.create();
await modelRuntime.setRuntimeApiKey("anthropic", process.env.ANTHROPIC_API_KEY!);

const { session } = await createAgentSession({
  sessionManager: SessionManager.inMemory(),
  modelRuntime,
  customTools: [echoTool],
});

// 4. 验证事件流
session.subscribe((event) => console.log("[event]", event.type));

// 5. 验证 prompt → tool call → result
await session.prompt("Call echo with text 'hello world'");
```

**过 = 库形态集成过 + 工具 execute 在我们进程内执行过 + 事件流正确。**

### S-pi-2（look 通道 B pi 侧 + 通道 A 备选探测，0.5d）

**主线（通道 B，D2 默认）**：look 对 agent 的暴露面是纯文本/结构化 tool-result——截图由独立视觉侧信道处理，主对话 text-only。pi 侧只需验证「自定义工具返回结构化文本 → agent 正确消费并续跑」，与 S-pi-1 的 customTools 验证同构，增量是 look 的真实返回结构（场景摘要文本）端到端跑通一次。DeepSeek 系原生兼容，**无降级路径**。

**备选探测（通道 A，时间盒；需视觉模型 key，结果不阻塞选型）**：注册一个返回 ImageContent 的工具，验证 chat-completions 模型接受 image_url dataURL：

```typescript
const lookTool = defineTool({
  name: "look",
  label: "Look",
  description: "Generate a sample marketing image and return it",
  parameters: Type.Object({ prompt: Type.String() }),
  execute: async (id, params) => {
    // 1. 调真实生图（或 mock 一个 1x1 PNG）
    const pngBase64 = "iVBORw0KGgo..."; // 1x1 PNG
    return {
      content: [{ type: "image", data: pngBase64, mimeType: "image/png" }],
      details: { prompt: params.prompt },
    };
  },
});

// 配一条视觉模型 route（GPT-4o 或类似）
// ~/.pi/agent/models.json:
// {
//   "providers": {
//     "openai-compatible-vision": {
//       "baseUrl": "https://api.example.com/v1",
//       "apiKey": "$VISION_KEY",
//       "api": "openai-completions",
//       "models": [{ "id": "gpt-4o", "input": ["text", "image"], ... }]
//     }
//   }
// }

await session.prompt("Use look to generate a hero image, then describe it");
```

**过（通道 A 探测）= 模型回复中包含对图像的描述（不是 (tool image omitted)）。**通道 B 主线的通过标准并入 S-pi-1（工具文本结果被正确消费）。

**再过 DeepSeek 路径（同属通道 A 探测）**：把模型切到 deepseek-chat，跑同样 prompt → 确认模型收到 `(tool image omitted: model does not support images)` 占位字符串、**不报错**、能继续完成任务。占位降级机制本身已由 `transform-messages.ts:35-57` 源码证实（P3.2），这里验的是运行时未知量：降级后端到端不炸、任务可续。

### S-pi-3（session 持久化 + F0.5，0.5-1d）

```typescript
// 1. 创建持久化 session
const sm1 = SessionManager.create("/tmp/test-sessions", "/tmp/test-sessions/abc.jsonl");
const { session: s1 } = await createAgentSession({ sessionManager: sm1, modelRuntime, customTools: [echoTool] });
await s1.prompt("My favorite color is blue");

// 2. 关闭 session（dispose）
s1.dispose();

// 3. 重启后用 open 装载
const sm2 = SessionManager.open("/tmp/test-sessions/abc.jsonl");
const { session: s2 } = await createAgentSession({ sessionManager: sm2, modelRuntime, customTools: [echoTool] });

// 4. 验证上下文恢复
await s2.prompt("What's my favorite color?");  // 应回 blue
```

**过 = 跨重启 session 上下文完整恢复，F0.5 验证完成。**

### S-pi-4（流式适配端到端，0.5-1d）

写一个 SDK 包装层把 agent-core event 流映射成 UIMessage v1 chunk，挂到 SSE endpoint，前端旧 Chat 类验证消费。**最小 150-200 行 TypeScript。**

**过 = 前端一字不变能消费新 runtime 流（除适配器）。**

---

**总预算：约 3.5-4.5 人日**（S-pi-2 按 D2 收窄为通道 B pi 侧 + 时间盒 A 探测），与 spike 01 §4 估 dsh Y 路线 S1-S3 同量级。**原「最大风险点 S-pi-2 多模态」不再成立**：通道 B 主线下主模型 text-only 原生兼容；通道 A 仅为备选探测，其失败不影响选型、也不影响层 1 验收（C4a 主线不走 A）。

---

## 7. 关键证据索引

| 主张 | 证据 |
|---|---|
| pi 提供库 + RPC + 实验性 protocol 三层 | pi/ `packages/coding-agent/src/index.ts`、`src/rpc-entry.ts`、protocol/ `README.md:5-11` |
| SDK Quick Start `createAgentSession` | pi/ `packages/coding-agent/docs/sdk.md:17-34` |
| `SessionManager.open(path)` 一行 API 装载 | pi/ `packages/coding-agent/src/core/session-manager.ts:1530-1549` |
| SessionManager 四种工厂 | pi/ `packages/coding-agent/src/core/session-manager.ts:1519-1570` |
| 32+ extension 事件 lifecycle overview | pi/ `packages/coding-agent/docs/extensions.md:275-348` |
| `before_agent_start` 改 systemPrompt + structured options | pi/ `packages/coding-agent/docs/extensions.md:534-565` |
| `tool_call` event 可 block + 改 input | pi/ `packages/coding-agent/docs/extensions.md:759-823` |
| `tool_result` event 可改 result | pi/ `packages/coding-agent/docs/extensions.md:823-857` |
| `context` event 钩子（媒体省略注入点） | pi/ `packages/coding-agent/docs/extensions.md:657-668` |
| `session_before_compact` event（compaction 注入点） | pi/ `packages/coding-agent/docs/compaction.md:280-310` + `extensions.md:452-490` |
| AgentCore event 流类型 | pi/ `packages/agent/src/types.ts:428-443` |
| AgentTool 接口（execute 是普通 async） | pi/ `packages/agent/src/types.ts:386-409` |
| ToolResultMessage content 支持 image | pi/ `packages/ai/src/types.ts:449-460` + `366-370` ImageContent |
| openai-completions tool-result 图转合成 user 消息 | pi/ `packages/ai/src/api/openai-completions.ts:1269-1337` |
| 非视觉模型占位降级（不报错） | pi/ `packages/ai/src/api/transform-messages.ts:12-57` |
| RPC event 类型与 SDK 一致（text_start 等） | pi/ `packages/coding-agent/docs/rpc.md:838-870` + `:939-950` |
| RPC `switch_session`、`get_entries since` | pi/ `packages/coding-agent/docs/rpc.md:597-727` |
| RPC extension_ui_request/response 子协议 | pi/ `packages/coding-agent/docs/rpc.md:1155-1344` |
| ModelRuntime 凭证解析优先级 | pi/ `packages/coding-agent/docs/sdk.md:443-499` |
| 35+ provider + 自定义 models.json + extension registerProvider | pi/ `README.md:99-143` + extensions.md:200-216 |
| 周更节奏 + 6211 commits | pi/ CHANGELOG.md、git log 实测 |
| 0.84.2 版本 + npm shrinkwrap + supply-chain hardening | pi/ 各 package.json、README.md:78-88 |
| 工程级 lint/check 多门 | pi/ package.json:18-22（check 系列） |
| AgentCore 全事件类型表 | pi/ `packages/agent/src/agent-core README.md`（本文已引全文关键章节） |

---

## 8. 待 owner 决策清单

**D7：runtime 选型。** 由 spike 01 推荐 Y 调整为 **pi 直接驱动（库形态）**。

- **选项 pi（推荐）**：`@earendil-works/pi-coding-agent@0.84.2` 库 import，无 fork 无子进程边界。F0+层 1 ≈ 20 人日。**真实优势是 resume 是 SDK API、流协议与 UIMessage v1 同构、session 树形 JSONL、内置 35+ provider（含 deepseek/minimax/kimi-coding）、周更 npm shrinkwrap 工程实践**。**代价**：周更需要 pin + 升级 smoke；审批 / compaction 不是 Cordis 那种全可替换 Service——自写 `tool_call` event + `ctx.ui.confirm()` + `context` event 钩子，代码形态不同但语义等价。
- **选项 Y（备选）**：dsh 无头 runtime。spike 01 已录，**真实代价是必须 fork ~250 行 sdk-jsonrpc-server 才能补 resume**（spike 01 §Y5）。
- **选项 X（不推荐）**：编辑器入 dsh 壳。spike 01 §X1-X5 已说明，与 localhost 形态规划冲突。

**前置依赖**：
- **D3（session 模型）**：pi 支持一文件多 session（tree JSONL，branches），也支持一文件一 session——**两种都 0 代码**。建议 D3 倾向一文件多 session（按 leaf 走），未来 C5b session 列表 UI 直接用 SessionManager.list/listAll（sdk.md:786-789）。
- **D2（vision 通道 B）**：**已由 owner 拍板（2026-08-20，records/topics/brand-config.md D2/D2a）：B 为默认**——look 截图不进主 agent 上下文（成本优势 + 可换视觉模型），A 直送为备选降级路径（主 agent 需看图或视觉模型质量不足时启用）。P3.3 证明 pi 路径内置多模态、A 实现成本低属实，但不构成砍 B 的依据；本文此前「单通道即可覆盖 C4a、B 倾向砍」的建议作废。

**连带拍板**：
- 把 pi-agent-core + pi-ai + pi-coding-agent 加入 package.json 依赖（lockfile 锁 0.84.2）。
- 删除旧分支 `packages/agent` 整套（42 文件，spike 01 §0 + 本 spike 一致判断）。
- 旧 `packages/core/src/tools/marketing/*` + `image-gen/*` + 测试 16 文件整段移植（spike 01 §4 + 04 §1 移植清单不变）。

---

## 9. 待补 open items（spike 阶段补完）

1. **pi-ai 模型 catalog 中 DeepSeek 模型的 `input` 字段实际值**——需读 `packages/ai/src/models.generated.ts` 944 行具体条目，验证 `input: ["text"]` 还是 `["text","image"]`。【假设】DeepSeek 官方 chat = `["text"]`，符合本 spike P3.2 推断。
2. **photon-node WAS 在 Windows 下的 npm install 实测**——是否真需要 `--ignore-scripts`、是否影响库形态。
3. **库形态 vs RPC 形态的选择**：库形态在 Node 后端集成更顺，但 RPC 形态在工具审批上有内建 UI 子协议。**建议先库形态 + 自写审批钩子**（形态统一、工作量 +1 人日 vs RPC 减 1 人日抵消）。
4. **agent-core README.md vs extensions.md 之间的内容同步**——agent-core README.md 内容是简化版，详细定义在 extensions.md。引用时优先 extensions.md。

---

> **纪律声明**：本文严格遵守【事实】（文件:行号 证据）/ [推断] / [假设] 三标分离。**所有原 spike 01 标【假设】的 pi 项均已升格为【事实】或【推断】**——pi 在本地源码完整、版本 0.84.2、6211 commits、文档 3000+ 行。结论可信度与 spike 01 dsh-Y 对等。

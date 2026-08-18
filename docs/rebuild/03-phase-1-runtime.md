# 03 · Phase 1：runtime 选型 spike（硬门）

> 状态：已核验（2026-08-18，R4：前端契约 + 本地 dsh 仓库实况对账）| **硬门：runtime 未定，对话层一行代码不写。**

## 1. 为什么 runtime 是第一关键路径

实测（00 §4）：对话机器是 runtime 形状的。支撑底座 F0 的一半块（F0.1/0.4/0.6）直接建在 runtime 上，视觉回路依赖其媒体模型。在错误地基上建闭环 = 返工。

## 2. spike 要回答的问题（用能跑的代码，按可预判性排序）

**Q0 嵌入形态（新增，最先回答）**：runtime 能否作为库跑在我们的后端进程里、调远程工具？
- dsh 实测：无 widget/库形态；官方嵌入 API 是 `@deepseek-ai/dsh-sdk-client`——**stdio JSON-RPC 驱动完整 harness 子进程**，已知限制：无 prompt 级 cancel、无 per-prompt result、client→server notifications 未实现。
- pi sdk：【假设】本地两仓库均无其包，嵌入形态未知，spike 时联网验证。

**Q1 多模态 tool-result（可预判 70%，仍必须实测）**：图片能否活着到达模型？
- dsh 实测：内容模型结构化支持——`ToolResultBlock.content: ContentBlock[]` 递归含 `ImageBlock`，`contentHasImage` 显式递归 tool-result（`packages/llm/llm/src/types.ts:86-92`、`content.ts:13-15`）。**但**：适配器当前声明 text-only output（types.ts:66-69 注释），tool-result 消息固定 user role；图片经 pi-ai 适配器序列化到具体 provider（尤其 DeepSeek 系 chat-completions）后是否存活，**只有跑代码知道**——旧仓库已实测该类 provider 不吃 media tool-result，需改写层。
- pi sdk：【假设】未知。

**Q2 session 挂起/恢复 + 媒体省略插入点（可预判 80%）**：
- dsh 实测：session 是一等能力——事件溯源持久化（jsonl/sqlite 双后端）、resume/fork/崩溃修复（`packages/session/`）。**compaction 是可整体替换的 Service Provider seam**（`ctx.compaction`，默认 `dsh-compaction-basic`）——自定义媒体省略可作为 compaction 后端或工具 output render 策略注入，比「在固定 runtime 里找钩子」宽松。
- 真正要实测的是凭 **pluginData 里存的 sessionId** 恢复的具体链路（open-pencil 侧粘合代码，非 runtime 能力）。
- pi sdk：【假设】其文档声称内建 session 管理/compaction，待验证。

**Q3 流格式 → 前端可消费（必须实测，先验下调）**：
- 前端现状（实测）：`@ai-sdk/vue` 的 `Chat` 类 + 自写 `parseUIMessageStream` 消费 UIMessage stream v1 SSE。
- dsh 实测：自研 chunk 协议（`block-start/text-delta/.../finish`），与 UIMessage stream 不同构；无现成 HTTP SSE 出口——接前端必须自写 adapter（chunk → UIMessageChunk），工作量与旧仓库自写解析器同级、方向相反。
- pi sdk：【假设】「有 AI SDK harness 适配器可保 UIMessage 流」——本地无法证实，spike 联网验证前不得作选型依据。
- 无论选谁：「前端零影响」不成立，传输层必写 adapter，ChatPanel 改造预算按此编制。

## 3. 选型基线（用 spike 数据修正）

| | pi sdk | dsh（deepseek-harness） |
|---|---|---|
| 版本/稳定性 | 【假设】待查 | `0.1.0-rc.5`，README 明牌 developer preview + breaking changes |
| 架构 | 【假设】extension API | Cordis 全插件化：`ctx.tools.register(defineTool(...))`、`ctx.systemPrompt.section(...)`，注册即 effect、卸载即回滚（实测 `tool-fs/src/read.ts:69-110`） |
| LLM 层 | 待查 | 自研 `ctx.llm` + 适配器；**多 provider 能力由 `@earendil-works/pi-ai@0.82.1` 提供**——选 dsh 并不绕开 pi 生态 |
| 嵌入形态 | 待查（Q0） | stdio 子进程 + 事件订阅（实测，有已知限制） |
| session/compaction | 待查（Q2） | 一等能力 + 可替换 seam（实测） |

**正确的对立面**（R4 修正）：不是「pi vs 非 pi」，而是「pi sdk 直接驱动」 vs 「Cordis 插件树 + pi-ai 适配器」。

## 4. 能力契约（F0.1 的验收标准，spike 即按此测试）

- session 持久化：pluginData 关联文件，恢复完整上下文
- 工具审批：危险操作可挂起等用户确认，审批往返穿 WebSocket 桥
- skills：营销工作流可封装
- 多 provider：主模型 +（可选）视觉模型的统一凭证（dsh 侧注意 pi-ai 的声明式 route 机制）
- 流式输出：前端可消费（Q3）
- 多模态 tool-result：look 图片到模型（Q1）

## 5. 触发的重分类（按 02 §3.3 仪式执行）

- spike 接桥协议时：`src/app/automation/` + `packages/mcp` + `src/app/browser-bridge.ts`（扩审批往返）
- F0.4 搭建时：`src/app/ai/chat/`（9 文件）、`src/components/ChatPanel.vue` + `src/components/chat/` 相关组件

## 6. 产出

- 选型结论 + Q0-Q3 实测答案（spike 报告进 `docs/rebuild/spikes/`）
- 新 runtime 内核出生：F0.1/F0.4/F0.6 + 能力契约测试全绿
- 失败预案：spike 失败只是删一个 spike 分支，Phase 0 骨架不伤筋骨

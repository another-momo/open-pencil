# 营销 Agent 模式切换：设计决策存档

> **⚠️ 已归档** — 实现工作于 2026-07-21 完成（L2 Phase 0）。本文档仅保留设计决策与"为什么"。
> **最终实现**：`src/app/ai/chat/storage.ts`、`transports.ts`、`src/components/chat/ProviderSettings/`。
> **主规划文档**：`../00-overview.md`。

## 1. 现有架构约束

### 1.1 AI SDK 版本

Vercel AI SDK **v6**（`ai@^6.0.174`，`@ai-sdk/vue@^3.0.174`）。`ToolLoopAgent` 构造函数已接受 `instructions` 和 `tools` 参数——这是模式切换的天然入口点。

### 1.2 当前 Prompt / Tool / Transport

| 组件 | 现状 | 文件 |
|---|---|---|
| System Prompt | 静态 `?raw` import，模块级常量 | `src/app/ai/chat/transports.ts:10,87` |
| Tool 注册 | 固定 `CORE_TOOLS` 数组 | `src/app/ai/tools/index.ts:85-133` |
| Transport | `createToolLoopTransport()` 集中创建 | `transports.ts:62-115` |
| 状态持久化 | `useLocalStorage` (VueUse) | `storage.ts` |

### 1.3 Transport Dirty 机制

provider 切换已用 `markTransportDirty()`：设置变更 → dirty → 下次 `ensureChat()` 重建 transport。**模式切换复用同一机制**。

## 2. 共享与差异化分析

### 2.1 共享组件（两模式完全相同）

ToolDef 定义 / 工具执行引擎 / FigmaAPI 层 / `onAfterExecute` 钩子 / AI Provider 配置 / 图片生成配置 / Chat 消息存储 / Transport 架构。

### 2.2 差异化组件

| 组件 | UI 模式 | 营销模式 |
|---|---|---|
| System Prompt | `system-prompt.md` | `system-prompt-marketing.md` |
| Step Budget | 50 步 | 50 步（默认一致，可独立配置） |
| Tool 过滤 | 全部 CORE_TOOLS | 全部 CORE_TOOLS（不做过滤） |
| 模式标识 | 无 | localStorage 存当前模式 |

### 2.3 不需要差异化的组件

Tool 执行逻辑 / 画布操作 / Undo/Redo / MCP/CLI 接口。

## 3. 关键决策依据

### 3.1 SDK 是否有内置模式切换？

**没有。** Vercel AI SDK v6 不提供 "system prompt preset" 或 "mode" 概念。SDK 哲学是"组合而非配置"——由应用层决定传什么 prompt 和 tools。`ToolLoopAgent({ instructions, tools, stopWhen })` 是模式切换的全部入口。

### 3.2 切换模式后清空对话历史（决策 #1）

调用 `resetChat()` 简化实现。两种模式 prompt/工作流差异大，保留历史反而增加 AI 推理负担。

### 3.3 ACP 模式暂不支持（决策 #2）

Phase 0 仅 Direct transport。ACP 是外部 agent 进程，营销 prompt 的 tool 调用模式可能不兼容；ACP 用户占比小。

### 3.4 营销 prompt 命名（决策 #4）

`system-prompt-marketing.md`，与 `system-prompt.md` 同前缀一致性，目录位置相同。

## 4. 一句话总结

营销 Agent 模式 = 同一 transport 架构 + 同一 tool 集 + 不同 `instructions` + 切换时清空对话历史 + localStorage 持久化当前模式。
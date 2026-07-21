# 营销 Agent 模式切换：设计与实现

> 最后更新 2026-07-21。定义营销 Agent 模式的切换机制，分析共享与差异化的组件，基于 Vercel AI SDK v6 的实际架构给出实现方案。

## 1. 现有架构约束

### 1.1 AI SDK 版本

Vercel AI SDK **v6**（`ai@^6.0.174`，`@ai-sdk/vue@^3.0.174`）。

### 1.2 当前 Prompt 与 Tool 加载方式

| 组件 | 当前实现 | 文件 |
|---|---|---|
| System Prompt | 静态 `?raw` import，模块级常量 | `src/app/ai/chat/transports.ts:10,87` |
| Tool 注册 | 固定 `CORE_TOOLS` 数组 | `src/app/ai/tools/index.ts:85-133` |
| Transport 创建 | `createToolLoopTransport()` 集中创建 | `src/app/ai/chat/transports.ts:62-115` |
| 状态持久化 | `useLocalStorage` (VueUse) | `src/app/ai/chat/storage.ts` |

**关键事实**：`ToolLoopAgent` 构造函数已接受 `instructions` 和 `tools` 参数——这两个是模式切换的天然入口点。

### 1.3 Transport Dirty 机制

现有 provider 切换已通过 `markTransportDirty()` 实现：设置变更 → dirty → 下次 `ensureChat()` 重建 transport。模式切换可复用同一机制。

## 2. 共享与差异化分析

### 2.1 共享组件（两种模式完全相同）

| 组件 | 原因 |
|---|---|
| ToolDef 定义 | render、describe、calc 等核心工具在两种模式下都需要 |
| Tool 执行引擎 | `toolsToAI()` 转换逻辑与模式无关 |
| FigmaAPI 层 | 画布操作接口与模式无关 |
| `onAfterExecute` 钩子 | 自动 layout/render/undo 在两种模式下都需要 |
| AI Provider 配置 | LLM 模型选择与模式无关 |
| 图片生成配置 | generate_image 的 key/baseURL/model 与模式无关 |
| Chat 消息存储 | WeakMap per-editor-store 机制与模式无关 |
| Transport 架构 | DirectChatTransport / ACPChatTransport 与模式无关 |

### 2.2 差异化组件（按模式切换）

| 组件 | UI 设计模式 | 营销设计模式 |
|---|---|---|
| **System Prompt** | `system-prompt.md`（593 行，4 阶段） | `system-prompt-marketing.md`（待编写，6 阶段） |
| **Step Budget** | 50 步（`MAX_AGENT_STEPS`） | 50 步（默认与 UI 模式一致，支持独立配置） |
| **Tool 过滤** | 全部 CORE_TOOLS | 可选：移除部分 UI 专用工具（如 evalCode） |
| **模式标识** | 无 | 存入 localStorage，UI 展示当前模式 |

### 2.3 不需要差异化的组件

- **Tool 执行逻辑**：render、generate_image、describe 的 execute 函数在两种模式下完全相同
- **画布操作**：createFrame、createImage、fills 等底层操作与模式无关
- **Undo/Redo**：pushUndoEntry 机制与模式无关
- **MCP/CLI 接口**：MCP server 和 CLI eval 不受模式影响

## 3. Vercel AI SDK v6 的标准方案

### 3.1 SDK 是否有内置模式切换？

**没有。** Vercel AI SDK v6 不提供 "system prompt preset" 或 "mode" 概念。它是底层工具箱：

- `ToolLoopAgent` 接受 `instructions: string` 和 `tools: ToolSet`
- `DirectChatTransport` 包装 Agent 为 ChatTransport 接口
- `Chat` 类管理消息状态和流式响应

SDK 的设计哲学是"组合而非配置"——由应用层决定传什么 prompt 和 tools。

### 3.2 SDK 提供的扩展点

| 扩展点 | 用途 | 适合模式切换？ |
|---|---|---|
| `ToolLoopAgent({ instructions })` | 传入 system prompt | ✅ **核心入口** |
| `ToolLoopAgent({ tools })` | 传入工具集 | ✅ 可选过滤 |
| `ToolLoopAgent({ stopWhen })` | 步数限制 | ✅ 可配置 step budget |
| `DirectChatTransport({ agent })` | 包装 transport | ✅ 可按模式创建不同 agent |
| `setOverrideTransport()` | 替换整个 transport | ⚠️ 过重，不推荐 |
| `Chat({ transport })` | 实例化 chat | ✅ transport 变则 chat 重建 |

### 3.3 推荐模式：参数化 Transport 创建

不改变 SDK 使用方式，在应用层根据模式选择不同参数：

```typescript
// 简化示意
function createToolLoopTransport(mode: 'ui' | 'marketing') {
  const prompt = mode === 'marketing' ? MARKETING_PROMPT : UI_PROMPT

  const agent = new ToolLoopAgent({
    instructions: prompt,
    tools,
    stopWhen: stepCountIs(50),  // 默认相同，可按模式配置
    ...
  })
  return new DirectChatTransport({ agent })
}
```

这是最轻量的方案——不引入新架构，只在现有 transport 创建逻辑中加一个分支。

## 4. 实现设计

### 4.1 状态管理

在 `storage.ts` 中新增模式状态：

```typescript
export type ChatMode = 'ui' | 'marketing'

export const chatMode = useLocalStorage<ChatMode>(
  `${STORAGE_PREFIX}chat-mode`,
  'ui'  // 默认 UI 设计模式
)
```

复用现有 `registerAIChatEffects()` 中的 watch 机制：

```typescript
watch(chatMode, () => {
  markTransportDirty()  // 模式切换 → 重建 transport
})
```

### 4.2 Prompt 加载

**方案 A：动态 import（推荐）**

```typescript
const PROMPTS: Record<ChatMode, string> = {
  ui: UI_SYSTEM_PROMPT,           // 已有 import
  marketing: MARKETING_PROMPT     // 新增 import
}

// createToolLoopTransport 中：
const prompt = PROMPTS[chatMode.value]
```

两个 `.md` 文件都用 `?raw` import，模块加载时解析，运行时按模式选择。

**方案 B：运行时动态 import**

```typescript
async function loadPrompt(mode: ChatMode): Promise<string> {
  if (mode === 'marketing') {
    const mod = await import('@/app/ai/chat/system-prompt-marketing.md?raw')
    return mod.default
  }
  return UI_SYSTEM_PROMPT
}
```

更灵活（按需加载），但增加异步复杂度。当前 prompt 文件不大（<20KB），静态 import 足够。

**推荐方案 A**——简单直接，与现有 `?raw` import 模式一致。

### 4.3 Step Budget

`MAX_AGENT_STEPS` 当前是模块级常量（50）。改为按模式可配置，默认保持 50 步不变：

```typescript
const STEP_BUDGETS: Record<ChatMode, number> = {
  ui: 50,
  marketing: 50  // 默认与 UI 模式一致，后续可根据实测调整
}

// createToolLoopTransport 中：
stopWhen: stepCountIs(STEP_BUDGETS[chatMode.value])
```

**决策**：两种模式默认使用相同的 50 步预算。营销模式的 prompt 设计本身会约束 AI 的行为（如更少的 section、更明确的阶段划分），而非通过硬性步数限制。如果实测发现营销场景确实需要不同的步数上限，可以独立调整 `STEP_BUDGETS.marketing`。

### 4.4 Tool 过滤（可选）

当前两种模式使用相同工具集。如果营销模式需要移除某些工具（如 `evalCode` 在营销场景无意义）：

```typescript
function getToolsForMode(mode: ChatMode): ToolDef[] {
  if (mode === 'marketing') {
    return CORE_TOOLS.filter(t => !MARKETING_EXCLUDED.includes(t.name))
  }
  return CORE_TOOLS
}
```

**当前建议**：不做过滤，保持两种模式工具集一致。理由：
- 工具定义 token 开销小（~3K），对 context 影响有限
- AI 自然不会在营销场景调用无关工具
- 减少维护复杂度

### 4.5 UI 改动

**模式选择器**：在设置面板中新增：

```
┌─────────────────────────────────────────┐
│ AI Chat Settings                        │
├─────────────────────────────────────────┤
│ Design Mode:  [UI Design ▾]            │  ← 新增
│                                         │
│ Provider:     [OpenRouter ▾]            │  ← 已有
│ API Key:      [****]                    │
│ ...                                     │
└─────────────────────────────────────────┘
```

**模式指示器**：在 `ChatPanel.vue` 输入框上方显示当前模式，作为快捷切换入口：

```
[营销模式 ▾] | 当前: gpt-4o
```

点击弹出下拉菜单切换模式。

切换模式时：
1. 更新 `chatMode` localStorage
2. **清空当前对话历史**（调用现有 `resetChat()`，简化实现，避免旧 prompt 上下文干扰）
3. `markTransportDirty()` 触发 transport 重建
4. 下次发消息时加载新模式的 prompt，从空白对话开始

### 4.6 完整流程

```
用户在设置中切换模式
  → chatMode.value = 'marketing'
  → resetChat() 清空当前对话历史
  → watch 触发 markTransportDirty()
  → 下次 ensureChat() 调用
  → createTransport() 检测 dirty
  → createToolLoopTransport() 读取 chatMode
  → 加载 marketing prompt + 50 步限制
  → 创建新 ToolLoopAgent + DirectChatTransport
  → Chat 实例重建（空对话）
  → 用户发消息时使用新 prompt
```

## 5. 文件改动清单

| 文件 | 改动 | 说明 |
|---|---|---|
| `src/app/ai/chat/storage.ts` | 新增 `chatMode` ref + watch | 模式状态管理 |
| `src/app/ai/chat/transports.ts` | 修改 `createToolLoopTransport()` | 按模式选择 prompt 和 step budget |
| `src/app/ai/chat/system-prompt-marketing.md` | **新建** | 营销专用 system prompt |
| `src/components/chat/ProviderSettings/` | 新增模式选择 UI | 设置面板中的切换器 |

**不需要改动的文件：**
- `packages/core/src/tools/*` — 工具定义不变
- `packages/core/src/tools/registry-core.ts` — 工具注册不变
- `packages/core/src/tools/ai-adapter.ts` — 转换逻辑不变
- `src/app/ai/tools/index.ts` — 工具创建不变

## 6. 已确认决策

1. **切换模式后清空对话历史**：调用现有 `resetChat()`（`src/app/ai/chat/use.ts:70`）。简化实现，避免旧 prompt 上下文干扰。两种模式的 prompt 和工作流差异大，保留历史反而增加 AI 的推理负担。用户如需保留对话，可在切换前手动导出或截图。
2. **ACP 模式暂不支持**：Phase 0 仅支持 Direct transport 的模式切换。理由：ACP 是外部 agent 进程，有自己的 tool 执行逻辑，营销 prompt 的 tool 调用模式可能不兼容；ACP 用户占比小。如未来需要，可在 `ACPChatTransport.sendMessages()` 中按模式拼接不同 prompt。
3. **需要模式指示器**：在 `ChatPanel.vue` 输入框上方显示当前模式，可点击切换。防止用户忘记所在模式，走错工作流浪费步骤。
4. **营销 prompt 命名**：`system-prompt-marketing.md`，与现有 `system-prompt.md` 保持 `system-prompt-` 前缀一致性，目录位置相同（`src/app/ai/chat/`）。
5. **Step Budget 保持 50 步不变**：两种模式默认使用相同步数上限。营销模式的行为约束通过 prompt 设计实现（更少的 section、更明确的阶段划分），而非硬性步数限制。如实测需要不同上限，可独立调整。

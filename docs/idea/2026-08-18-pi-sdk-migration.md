# Agent Backend 迁移方案：Pi SDK 作为后端

> 状态：构思阶段 | 日期：2026-08-18 | 作者：AI Agent

## 一、背景与动机

### 当前架构的问题

1. **Session 管理在前端**：Agent Backend 是无状态的，每次请求创建新的 `ToolLoopAgent`
2. **无 Skills 系统**：无法封装可复用的设计工作流
3. **无工具审批机制**：无法防止 AI 误删重要节点
4. **Tab ID 不稳定**：使用内存递增计数器，重启后变化，无法作为稳定的 session 标识符

### Pi SDK 的优势

| 能力 | 当前架构 | Pi SDK |
|------|----------|--------|
| **LLM 调用** | ✅ Vercel AI SDK | ✅ 内置 |
| **Session 管理** | ❌ 前端负责 | ✅ 内置（支持挂起/恢复、compaction） |
| **Skills 系统** | ❌ 无 | ✅ 内置 |
| **工具审批** | ❌ 无 | ✅ 内置 |
| **多提供商支持** | ⚠️ 自己适配 | ✅ 内置 |

## 二、架构设计

### 当前架构

```
┌─────────────────────────────────────────────────────────────┐
│  Frontend (浏览器)                                          │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  Session 管理                                         │  │
│  │  - 维护 messages[] 历史                               │  │
│  │  - 维护 sessionId (tab ID)                           │  │
│  │  - 负责多轮对话                                        │  │
│  └───────────────────┬───────────────────────────────────┘  │
│                      │ 每次请求发送完整 messages             │
└──────────────────────┼──────────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────────┐
│  Agent Backend (Node.js)                                    │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  ToolLoopAgent (无状态)                               │  │
│  │  - 每次请求创建新的 agent                             │  │
│  │  - 不维护任何状态                                      │  │
│  │  - 通过 WebSocket bridge 调用前端工具                 │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### 新架构（Pi SDK）

```
┌─────────────────────────────────────────────────────────────┐
│  Frontend (浏览器)                                          │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  聊天界面                                             │  │
│  │  - Session 列表展示                                   │  │
│  │  - 消息流展示                                         │  │
│  │  - 不再负责 Session 管理                              │  │
│  └───────────────────┬───────────────────────────────────┘  │
│                      │ 只发送最新消息                        │
└──────────────────────┼──────────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────────┐
│  Agent Backend (Node.js)                                    │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  Pi SDK                                               │  │
│  │  - Session 管理（挂起/恢复、compaction）              │  │
│  │  - Skills 系统                                        │  │
│  │  - 工具审批机制                                        │  │
│  │  - 多提供商支持                                        │  │
│  └───────────────────┬───────────────────────────────────┘  │
│                      │                                      │
│  ┌───────────────────▼───────────────────────────────────┐  │
│  │  OpenPencil Extension                                 │  │
│  │  - 桥接 WebSocket bridge                              │  │
│  │  - 注册 SceneGraph 工具                               │  │
│  │  - 管理 Session 与文件的映射                          │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## 三、核心设计

### 1. 标识符体系：chatId/tabId vs sessionId vs 文件

```
chatId/tabId（不稳定）
├── 用途：当前 turn 的工具调用，操作正确的 tab
├── 生命周期：只在当前 turn 有效
├── 特点：重启后变化，每次获取最新值
└── 生成方式：基于 tab ID，如 `web-${tab.id}`

sessionId（持久）
├── 用途：恢复对话历史
├── 生命周期：跨重启持久化
├── 特点：稳定，通过 pluginData 与文件关联
└── 存储位置：pluginData 中

文件（持久）
├── 用途：设计文件本身
├── 生命周期：用户保存
├── 特点：稳定，通过 pluginData 与 session 关联
└── 存储位置：文件系统

pluginData（持久）
├── 用途：关联 session 和文件
├── 生命周期：跨重启持久化
├── 特点：稳定，存储在 SceneGraph 根节点
└── 存储位置：SceneGraph 的 SharedPluginData
```

#### 关键区别

| 概念 | 用途 | 生命周期 | 稳定性 |
|------|------|----------|--------|
| **chatId/tabId** | 当前 turn 的工具调用 | 只在当前 turn 有效 | 不稳定 |
| **sessionId** | 恢复对话历史 | 跨重启持久化 | 稳定 |
| **文件** | 设计文件本身 | 用户保存 | 稳定 |
| **pluginData** | 关联 session 和文件 | 跨重启持久化 | 稳定 |

#### 当前机制

```typescript
// src/app/ai/chat/transports.ts
function getChatId(store: EditorStore): string {
  // 基于 tab ID 生成，不稳定
  const tab = getTabForStore(store)
  if (tab) return `web-${tab.id}`
  return `web-${store.state.documentName || 'default'}`
}

// src/app/ai/chat/http-agent-transport.ts
async sendMessages({ messages, abortSignal, ...options }) {
  const body = {
    id: chatId,           // ← 基于 tab ID（不稳定）
    messages: modelMessages,
    trigger: options.trigger,
    agent: config,        // ← chatMode, lookImagesKept 等
    brandSelection: {     // ← 用户选择的 profile
      pickedProfileId: pickedProfileId ?? null
    }
  }

  const response = await fetch(`${info.baseUrl}/v1/chat`, {
    headers: {
      'x-op-chat-id': chatId,  // ← tab ID（不稳定）
      'x-op-connection-id': info.connectionId
    },
    body: JSON.stringify(body)
  })
}
```

#### 数据流

```
用户打开文件 A
    ↓
创建 session 1，关联到文件 A（pluginData）
    ↓
用户输入消息，带上 chatId（基于 tabId，不稳定）
    ↓
后端处理消息，使用 chatId 调用工具
    ↓
工具在正确的 tab 上执行，返回结果
    ↓
用户关闭文件，session 1 挂起
    ↓
用户重新打开文件 A
    ↓
从 pluginData 恢复 session 1
    ↓
用户输入新的消息，带上新的 chatId（基于新的 tabId）
    ↓
后端继续处理，使用新的 chatId 调用工具
```

#### Pi SDK 迁移后的方案

```typescript
// 后端处理
const chatHandler = async (c: Context) => {
  const body = await c.req.json()
  const chatId = c.req.header('x-op-chat-id')  // 从 header 获取
  
  // 使用 chatId 来标识当前 turn 的工具调用
  // 使用 sessionId 来恢复对话历史
  const session = piSessions.get(body.sessionId)
  
  await agent.stream({
    session,
    prompt: userMessage,
    metadata: {
      chatId: chatId,  // 传递给工具调用
      tabId: tabId
    }
  })
}
```

### 2. Session 与文件的多对一关系

```
设计文件 (design.fig)
├── pluginData
│   └── open-pencil-agent
│       └── sessions: [
│             { id: "session-1", title: "按钮设计", ... },
│             { id: "session-2", title: "布局调整", ... },
│             { id: "session-3", title: "颜色方案", ... }
│           ]
│       └── activeSessionId: "session-3"
│
├── Session 1 (Pi SDK)
│   ├── 历史消息
│   ├── 工具调用记录
│   └── 状态（可挂起/恢复）
│
├── Session 2 (Pi SDK)
│   └── ...
│
└── Session 3 (Pi SDK)
    └── 当前活跃
```

### 3. PluginData 存储方案

```typescript
// Session 列表数据结构
type AgentSessionEntry = {
  id: string           // 稳定的 session ID
  title: string        // 对话标题（自动生成或用户命名）
  createdAt: number    // 创建时间
  updatedAt: number    // 最后更新时间
  messageCount: number // 消息数量
}

// 写入 pluginData
function saveSessionsToPluginData(store: EditorStore, sessions: AgentSessionEntry[]) {
  const root = store.graph.getNode(store.graph.rootId)
  root.setSharedPluginData(
    'open-pencil-agent',
    'sessions',
    JSON.stringify(sessions)
  )
}

// 读取 pluginData
function loadSessionsFromPluginData(store: EditorStore): AgentSessionEntry[] {
  const root = store.graph.getNode(store.graph.rootId)
  const data = root.getSharedPluginData('open-pencil-agent', 'sessions')
  return data ? JSON.parse(data) : []
}
```

### 4. Session 管理流程

```typescript
// 1. 打开文件时，加载 session 列表
async function loadFileSessions(store: EditorStore) {
  const sessions = loadSessionsFromPluginData(store)
  
  for (const entry of sessions) {
    const resumeState = await loadResumeState(entry.id)
    const session = await agent.createSession({
      sessionId: entry.id,
      resumeFrom: resumeState
    })
    piSessions.set(entry.id, session)
  }
  
  const activeId = sessions.find(s => s.id === activeSessionId)
  activePiSession = piSessions.get(activeId)
}

// 2. 切换 session 时
async function switchSession(sessionId: string) {
  if (activePiSession) {
    const resumeState = await activePiSession.detach()
    await saveResumeState(activePiSession.sessionId, resumeState)
  }
  
  activePiSession = piSessions.get(sessionId)
  updateActiveSessionInPluginData(store, sessionId)
}

// 3. 新建 session 时
async function createNewSession(store: EditorStore) {
  const sessionId = crypto.randomUUID()
  const session = await agent.createSession({ sessionId })
  
  addSessionToPluginData(store, {
    id: sessionId,
    title: '新对话',
    createdAt: Date.now(),
    ...
  })
  
  piSessions.set(sessionId, session)
  activePiSession = session
}
```

### 5. 流格式兼容

```typescript
// 使用 @ai-sdk/harness-pi 适配器
import { HarnessAgent } from "@ai-sdk/harness/agent"
import { pi } from "@ai-sdk/harness-pi"

const agent = new HarnessAgent({
  harness: pi,
  sandbox: createVercelSandbox({ runtime: "node24" }),
})

// 流式响应自动转换为 Vercel AI SDK 格式
const result = await agent.stream({
  session: activePiSession,
  prompt: userMessage
})

// 直接兼容前端 useChat
return result.toUIMessageStreamResponse()
```

### 6. System Prompt 动态注入

```typescript
// 使用 Pi Extension 动态注入 overlay
export default function (pi: ExtensionAPI) {
  let currentChatMode: ChatMode = 'ui'
  let currentBrandSelection: BrandSelection | null = null
  
  // 监听 turn 开始事件
  pi.on('turn_start', async (event) => {
    if (currentChatMode === 'marketing') {
      const overlay = buildMarketingOverlay(
        currentBrandSelection, 
        brandRepository
      )
      event.session.appendInstructions(overlay)
    }
  })
}
```

## 四、数据流

### 用户发送消息

```
┌─────────────────────────────────────────────────────────────┐
│  用户输入 "帮我设计一个红色按钮"                              │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│  Frontend                                                   │
│  POST /chat {                                               │
│    sessionId: "session-3",  // 持久标识符                    │
│    chatId: "web-tab-123",   // 临时标识符（基于 tabId）      │
│    message: "..."                                            │
│  }                                                          │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│  Agent Backend                                              │
│  1. 使用 sessionId 恢复对话历史                              │
│  2. 使用 chatId 进行工具调用（操作正确的 tab）               │
│  3. 调用: agent.stream({ session, prompt })                 │
│  4. Pi SDK 内部处理                                         │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│  SSE Stream (Vercel AI SDK 格式)                             │
│  { type: "text-delta", text: "好的，我来..." }               │
│  { type: "tool-call", toolName: "look", args: {...} }       │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│  Frontend                                                   │
│  1. 收到 tool-call，使用 chatId 确定目标 tab                 │
│  2. 在正确的 tab 上执行工具                                  │
│  3. 返回结果给后端                                          │
│  4. useChat() 消费流式响应，渲染聊天界面                     │
└─────────────────────────────────────────────────────────────┘
```

### 工具调用流程

```
Pi SDK 调用工具
    ↓
OpenPencil Extension 接收
    ↓
使用 chatId 确定目标 tab
    ↓
WebSocket bridge 转发到前端
    ↓
前端 MCP Server 执行工具（在正确的 tab 上）
    ↓
返回结果给 Extension
    ↓
Extension 返回给 Pi SDK
    ↓
Pi SDK 继续处理
```

## 五、需要修改的模块

| 模块 | 修改内容 | 工作量 |
|------|----------|--------|
| **Agent Backend** | 替换 ToolLoopAgent 为 Pi SDK | 3-4 天 |
| **OpenPencil Extension** | 编写扩展，桥接 WebSocket | 2-3 天 |
| **Session 管理** | 使用 pluginData 存储 session 列表 | 2-3 天 |
| **前端聊天界面** | 添加 session 列表选择 | 1-2 天 |
| **凭证管理** | 适配 Pi SDK 的认证方式 | 1 天 |
| **测试和调试** | 集成测试、边界情况 | 2-3 天 |
| **总计** | | **11-16 天** |

## 六、收益评估

| 收益 | 价值 | 说明 |
|------|------|------|
| **Session 管理** | ⭐⭐⭐⭐⭐ | 支持挂起/恢复、compaction |
| **Skills 系统** | ⭐⭐⭐⭐ | 可封装设计工作流 |
| **工具审批** | ⭐⭐⭐⭐ | 防止误删节点 |
| **多提供商支持** | ⭐⭐⭐ | Pi 内置更多提供商 |
| **对话历史** | ⭐⭐⭐⭐ | 跨重启持久化 |
| **代码简化** | ⭐⭐ | 减少 LLM 调用相关代码 |

## 七、风险评估

| 风险 | 影响 | 概率 | 缓解措施 |
|------|------|------|----------|
| **Pi SDK API 不稳定** | 高 | 中 | 锁定版本，定期评估 |
| **流格式不兼容** | 中 | 低 | 使用官方适配器 |
| **Session 状态丢失** | 中 | 低 | pluginData + resumeState 双写 |
| **性能下降** | 中 | 低 | 基准测试 |
| **学习成本** | 低 | 中 | 文档和示例 |

## 八、前端影响分析

### 标识符体系的变化

| 概念 | 当前实现 | Pi SDK 迁移后 | 影响 |
|------|----------|---------------|------|
| **chatId/tabId** | 临时标识符，用于工具调用 | 继续使用，保持不变 | ✅ 无影响 |
| **sessionId** | 不明确（可能使用 tabId） | 持久标识符，用于恢复对话 | ⚠️ 需要适配 |
| **pluginData** | 未使用 | 用于关联 session 和文件 | ⚠️ 需要实现 |

### 好消息：前端无需修改

| 方面 | 当前实现 | Pi SDK 迁移后 | 影响 |
|------|----------|---------------|------|
| **消息类型** | `UIMessage` | `UIMessage`（兼容） | ✅ 无影响 |
| **类型判断** | `isTextUIPart()` | `isTextUIPart()`（兼容） | ✅ 无影响 |
| **流格式** | Vercel AI SDK | Vercel AI SDK（通过适配器） | ✅ 无影响 |
| **样式** | 自定义 Tailwind | 自定义 Tailwind | ✅ 无影响 |
| **Markdown 渲染** | `vue-stream-markdown` | `vue-stream-markdown` | ✅ 无影响 |

### 前端需要添加的功能

1. **Session 列表 UI**：展示历史对话，支持切换
2. **新建对话按钮**：创建新的 session
3. **Session 重命名**：修改对话标题
4. **Session 与文件的关联**：通过 pluginData 持久化

## 九、实施步骤

### 阶段 1：基础集成（3-4 天）
1. 安装 Pi SDK 和相关依赖
2. 创建 OpenPencil Extension
3. 桥接 WebSocket bridge
4. 注册 SceneGraph 工具
5. 适配标识符体系（chatId/tabId 继续使用，sessionId 持久化）

### 阶段 2：Session 管理（3-4 天）
1. 设计 pluginData 数据结构
2. 实现 session 列表存储
3. 实现 session 切换逻辑
4. 实现 resumeState 持久化

### 阶段 3：前端适配（2-3 天）
1. 添加 session 列表 UI
2. 适配流式响应
3. 测试聊天功能

### 阶段 4：测试和优化（3-5 天）
1. 集成测试
2. 性能优化
3. 边界情况处理
4. 文档更新

## 十、结论

**可行性：高**

| 方面 | 评估 |
|------|------|
| **技术可行性** | ✅ 高，有官方适配器 |
| **收益** | ⭐⭐⭐⭐⭐ Session 管理和 Skills 价值大 |
| **风险** | ⚠️ 中等，主要是学习成本 |
| **工作量** | ⚠️ 11-16 天，中等规模 |
| **前端影响** | ✅ 零影响，无需修改 |

**关键设计决策**：

1. **标识符体系**：
   - chatId/tabId：继续作为临时标识符，用于当前 turn 的工具调用
   - sessionId：作为持久标识符，用于恢复对话历史
   - 文件：通过 pluginData 与 session 关联

2. **数据流**：
   - 前端发送消息时带上 chatId（基于 tabId）
   - 后端使用 chatId 进行工具调用
   - session 通过 pluginData 持久化

**建议**：

1. **短期（1-2 周）**：实施迁移
   - 获得 Session 管理、Skills、工具审批等能力
   - 与 V7 生态对齐

2. **中期（1-2 月）**：优化和完善
   - 优化性能
   - 完善 Skills 系统
   - 添加更多设计工作流

3. **长期**：
   - 基于 Pi SDK 构建更强大的 Agent 能力
   - 支持多模态交互
   - 集成更多 AI 能力

## 附录：相关文档

- [Pi SDK 文档](https://github.com/earendil-works/pi)
- [AI SDK v7 迁移指南](https://ai-sdk.dev/docs/migration-guides/migration-guide-7-0)
- [HarnessAgent 文档](https://ai-sdk.dev/docs/ai-sdk-harnesses/harness-agent)
- [PluginData 机制](./2026-08-12-electron-migration.md)（参考）

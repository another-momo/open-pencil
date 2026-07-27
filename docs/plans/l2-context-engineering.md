# 营销 Agent 上下文工程：重构规划

> 最后更新 2026-07-24。本文档定义营销 Agent 模式的上下文工程机制重构方案，解决当前 system prompt 硬编码膨胀、对话历史无裁剪、设计状态不可验证三个核心问题。
> 营销 Agent 模式整体设计见 `l2-agent-mode.md`，三层架构见 `00-overview.md`。**本文档已经评审，修订意见见 `../review/2026-07-27-context-engineering-review.md`，实施时以评审为准合并。**

## 1. 现状问题

### 1.1 当前上下文数据流

```
每轮 LLM 调用:
  system prompt (360行, 静态 markdown 文件)
  + 全部对话历史 (逐轮累积, 从不裁剪)
  + 用户最新消息
  → 发送给模型
```

### 1.2 三个核心问题

**问题 A — System prompt 中 ~50% 是运行时数据，不应写死**

| 写死在 prompt 的内容 | 行数 | 应来自 |
|----------------------|------|--------|
| 素材类型 ID → label 映射 | 12 | `material-types.ts` 动态生成 |
| 尺寸变体默认值 | 6 | `MaterialTypeConfig.variants` |
| 图片生成尺寸枚举 | 6 | `image-gen` provider |
| 图片工具 API 细节 | 35 | 工具自身的 `description`（tool calling 已自动携带） |
| Typographic scale | 9 | `MaterialTypeConfig.typography` |
| 字体选择范围 | 2 | `styleGuide.fonts` |
| 4 个 JSX 模式示例 | 100 | 按素材类型筛选后注入 |
| **合计硬编码** | **~170 行 (47%)** | |

两份 prompt（UI + marketing）还共享约 100 行渲染/布局规则，维护成本翻倍。

**问题 B — 对话历史无裁剪，长图设计上下文膨胀失控**

一个 8 section 的 `product_long` 产生约 60-106 次工具调用。每步的工具输入/输出全部累积在对话历史中，到第 6 个 section 时前 5 个的完整 render/describe 结果仍被重新发送。实测估计膨胀到 60K-150K tokens。

**问题 C — 设计状态是 AI "自我见证"的，不可验证**

prompt 要求 AI "维护一个 2-4 行设计状态摘要"，但：
- AI 可能遗忘更新或在错误基础上继续
- 摘要存在于对话文本中，无法被代码校验
- 关闭文档后状态丢失，重开无法恢复

## 2. 设计目标

| 目标 | 衡量标准 | 优先级 |
|------|---------|--------|
| 消除 prompt 中所有运行时数据 | 360 行 → ~190 行，且 190 行全是策略性行为规则 | P0 |
| 长图设计 token 消耗降低 40%+ | 对比 8-section product_long 前后 token 用量（需先有计量基线，见 Phase A0） | P0 |
| 设计状态可验证、可持久化 | 状态从对话历史迁移到 canvas pluginData，代码写入非 AI 自述；关键状态写入带 canvas 交叉校验 | P0 |
| 静态前缀稳定，利于 provider prompt caching | 动态内容（Manifest/阶段/窗口化历史）全部位于 prompt 尾部，前 90% 字节在会话内不变 | P0 |
| 素材类型新增不修改 prompt | 新增类型只需改 `material-types.ts` | P1 |
| 两份 prompt 共享核心规则 | 渲染规则一处修改两处生效 | P1 |
| 上下文可观测 | `debug_prompt` 命令暴露当前完整 prompt 及各部分来源 | P2 |

## 3. 整体架构

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Prompt Assembly Pipeline                     │
│                                                                     │
│  会话创建时 (一次, 字节级稳定, 构成缓存友好的静态前缀):                  │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │ core-rules.md       → 渲染/布局/Props/禁止                    │   │
│  │ marketing-rules.md  → 工作流/Checkpoint/锚点                  │   │
│  │ strategy-rules.md   → 图片来源策略/风格一致性                  │   │
│  │ type list (gen)     → listMaterialTypes()                     │   │
│  │ few-shot anchor     → Price Tag (20行, 通用)                  │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                          ↓                                          │
│  setup_material_type 后 (一次, 变更频率低):                          │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │ type spec           → 当前类型尺寸/变体                        │   │
│  │ typography scale    → 当前类型字号表                           │   │
│  │ section patterns    → 当前类型 JSX 模式 (非全量)               │   │
│  │ context window      → 当前类型的窗口化参数                     │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                          ↓                                          │
│  每轮 LLM 调用前 (动态尾部, 不影响前缀缓存):                          │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │ design manifest    → 从 canvas pluginData 读                  │   │
│  │ phase indicator    → 当前阶段标记                              │   │
│  │ windowed history   → 裁剪后的对话历史                          │   │
│  │ step budget        → 当前步数                                 │   │
│  └──────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘

                           Attention 分布

  [HIGH]  系统角色定义 + 核心渲染规则 + 工作流规则        ← 静态前缀
  [HIGH]  素材类型列表 + Price Tag (头部 few-shot)        ← 静态前缀
  [HIGH]  当前类型规格/字号/模式 (类型级, 低频变更)
  [HIGH]  设计清单 + 阶段标记 (尾部, recency bias)        ← 动态尾部
  ─────────────────────────────────────
  [HIGH]  对话历史摘要 (窗口化后的精简描述)
  [HIGH]  最近 N 步的工具调用链 (完整体)
  [HIGH]  用户最新消息
```

工具 API 细节**不进入** system prompt：Vercel AI SDK 的 tool calling 已经把每个 ToolDef 的 `description` 和参数 schema 发给模型，在 prompt 中重复注入是同一份内容发两遍。图片工具 API 细节从 prompt 删除后，直接迁移/增强到对应 ToolDef 的 `description` 字段中（见 Phase A7）。

## 4. 分层设计

### Layer 0 — 会话注册表增强

文件: `packages/core/src/tools/marketing/registry.ts`

现有 `MarketingDocumentState` 扩展为完整的设计状态容器：

```typescript
export interface MarketingDocumentState {
  // 现有字段
  materialTypeId: string
  rootFrameId: string
  componentsPageId: string
  anchors: AnchorRecord[]
  readonly: Map<string, ReadonlyNodeInfo>

  // 新增: 阶段和设计决策
  phase: DesignPhase
  direction: {
    colors: string[]
    fonts: string[]
    keywords: string[]
    composition: string
  } | null
  campaign: Record<string, string>   // { brand, product, discount, dates, ... }

  // 新增: section 追踪
  sections: { id: string; status: 'pending' | 'active' | 'done'; imgSource?: string }[]

  // 新增: 上下文窗口化计数
  messageCount: number
}

export type DesignPhase = 'setup' | 'direction' | 'skeleton' | 'fill' | 'review'
```

### Layer 1 — Design Manifest（Canvas 持久化状态）

新增文件: `packages/core/src/tools/marketing/manifest.ts`

#### 存储方式

Manifest 存储在一个 pluginData 标记的隐藏节点上，与现有 `brief.ts` 的标记模式一致（`pluginData: PluginDataEntry[]`，`pluginId` + `key` + `value`，rename-proof）。JSON 存放在 pluginData entry 的 `value` 中，而非节点文本内容：

```typescript
const MANIFEST_PLUGIN_ID = 'open-pencil-marketing'
const MANIFEST_NODE_KEY = 'manifest-node'   // 标记: 这是 manifest 节点
const MANIFEST_DATA_KEY = 'manifest-data'   // 数据: JSON 字符串
```

节点本身是一个 `visible: false` 的 FRAME，通过 `pluginData` 查找（不依赖节点名）。

存储的 JSON：

```json
{
  "version": 1,
  "phase": "fill",
  "materialType": "product_long",
  "direction": {
    "colors": ["#0A0A0A", "#FFFFFF", "#C9A96E"],
    "font": "PingFang SC",
    "keywords": ["高级感", "叙事感"]
  },
  "campaign": {
    "brand": "XX咖啡",
    "product": "拿铁"
  },
  "sections": [
    { "id": "hero", "status": "done", "imgSource": "generate" },
    { "id": "features", "status": "done", "imgSource": "stock" },
    { "id": "scenario", "status": "active", "imgSource": null },
    { "id": "specs", "status": "pending", "imgSource": null }
  ]
}
```

#### 一致性规则（双数据源）

Manifest 与注册表（内存态）构成双数据源，规则如下：

| 场景 | 规则 |
|------|------|
| 正常运行时 | 注册表是唯一运行时真源；Manifest 是其持久化快照，只在决策性工具执行后写入 |
| 会话开始 / 文档重开 | 注册表为空时，从 Manifest 重建注册表（`restoreStateFromManifest()`） |
| 注册表有值但 Manifest 有值且不一致 | 以注册表为准，立即回写 Manifest 修正快照，并在 `debug_prompt` 输出中记录一次 divergence 警告 |
| Manifest 节点被用户删除 | 从注册表惰性重建；注册表也为空则视为无营销会话 |
| Undo | Manifest 写入走 `graph.updateNode` 的非 undoable 通道（不进入 undo 事务），undo/redo 不会回滚 Manifest |
| 导出 | Manifest 节点 `visible: false` 且无导出设置，不参与 PNG/SVG/PDF 导出；`.fig`/`.pen` 保存时随文档持久化（这是目的） |
| 协作 (Yjs) | Manifest 节点只由本端 AI 会话写入（single writer）；远端收到的变更仅作为只读快照，不做合并 |

#### 写入时机

每个"决策性"工具在 `onAfterExecute` 中同步写入 Manifest：

| 工具 | 触发条件 | 更新字段 |
|------|---------|---------|
| `setup_material_type` | 执行成功 | `materialType`, `phase → 'setup'`, 初始化 `sections` |
| `lock_direction` | 方向确认后 | `direction`, `phase → 'skeleton'` |
| `commit_campaign_fact` | CP1 收集到事实 | `campaign[key]` |
| `commit_section` | 每个 section 完成后（带 canvas 校验，见 §5） | `sections[n].status`, `sections[n].imgSource` |
| `set_image_source` | 图片来源决定后 | `sections[n].imgSource` |

**规则**: Manifest 由工具层的 `syncManifestToCanvas(figma)` 写入，不走 AI 文本。AI 不可直接修改 Manifest 节点。

#### 读取时机

每次 `ensureChat()` 时，从当前页面查找 pluginData 标记的 Manifest 节点 → 解析 JSON → 注入到 system prompt 尾部。

#### 跨 session 恢复

文档重开后，AI 在 Phase 0 查找需求单的同时，会话层从 Manifest 重建注册表状态。如果 Manifest 存在且 phase ≠ 'review'，AI 从恢复的设计上下文中继续，无需重新询问已确认的事实。

### Layer 2 — 动态 Prompt Assembly

新增文件: `src/app/ai/chat/prompt-assembly.ts`

#### 装配流程

```typescript
// prompt-assembly.ts

export interface AssemblyContext {
  materialTypeConfig?: MaterialTypeConfig
  manifest?: DesignManifest
  phase?: DesignPhase
}

export function buildMarketingPrompt(ctx: AssemblyContext): string {
  const parts: PromptPart[] = []

  // ── 静态前缀: 会话创建时一次装配, 会话内字节级不变 ──

  // 1. 核心规则
  parts.push({ source: 'file', path: 'system-prompt-core.md' })
  // 2. 工作流规则 (含 Checkpoint/锚点)
  parts.push({ source: 'file', path: 'system-prompt-marketing.md' })
  // 3. 策略规则 (图片来源/风格一致性)
  parts.push({ source: 'file', path: 'system-prompt-strategy.md' })
  // 4. 素材类型列表 (动态生成, 但会话内不变)
  parts.push({ source: 'gen', fn: generateTypeList })
  // 5. 通用 few-shot (Price Tag)
  parts.push({ source: 'inline', content: PRICE_TAG_FEW_SHOT })

  // ── 类型级: setup_material_type 后注入, 低频变更 ──
  if (ctx.materialTypeConfig) {
    // 6. 当前类型规格 + 字号
    parts.push({ source: 'gen', fn: () => generateTypeSpec(ctx.materialTypeConfig!) })
    // 7. 当前类型模式 (按类型筛选, 非全量)
    parts.push({ source: 'gen', fn: () => generateTypePatterns(ctx.materialTypeConfig!) })
  }

  // ── 动态尾部: 每轮 LLM 前重算 ──
  if (ctx.manifest) {
    parts.push({ source: 'gen', fn: () => formatManifest(ctx.manifest!) })
  }
  if (ctx.phase) {
    parts.push({ source: 'inline', content: `[Current Phase: ${ctx.phase}]` })
  }

  return assemble(parts)
}
```

`assemble()` 将 parts 拼接为最终字符串，并在各部分之间加入分隔符以帮助模型区分内容来源。装配顺序即缓存友好性顺序：静态 → 低频 → 高频动态，任何动态内容不得插入静态前缀中间。

#### 素材类型列表生成

```typescript
function generateTypeList(): string {
  return listMaterialTypes()
    .map(t => `- "${t.label}" → \`${t.id}\`${t.sizeNote ? ` (${t.sizeNote})` : ''}`)
    .join('\n')
}

// material-types.ts 增强
{
  id: 'event_poster',
  label: '活动海报',
  sizeNote: '默认 1080×1920',
  // ...
}
```

#### 工具 API 文档处理

不再向 prompt 注入工具文档。改为：

1. 原 prompt 中 35 行图片工具 API 细节（尺寸枚举、参数约束、失败处理）迁移到 `generate_image` / `stock_photo` 等 ToolDef 的 `description` 字段——tool calling 会自动携带给模型
2. `image-gen` provider 的尺寸枚举通过 provider 配置读取，写入 `generate_image` 的 description，而非 prompt

#### 当前类型模式注入

```typescript
function generateTypePatterns(config: MaterialTypeConfig): string {
  return (config.patterns ?? [])
    .map(id => PATTERNS[id])
    .filter(Boolean)
    .join('\n\n')
}

// material-types.ts 增强
{
  id: 'ecommerce_detail',
  patterns: ['PriceTag', 'SpecTable', 'ReviewCard'],
}
```

### Layer 3 — 上下文窗口化

新增文件: `src/app/ai/chat/windowed-transport.ts`

#### 设计

包装 `DirectChatTransport`，在消息发送前通过 `sendMessages` 拦截实施窗口化。

```typescript
class WindowedChatTransport implements ChatTransport<UIMessage> {
  // 窗口大小来自当前素材类型配置, 默认 15
  private keepRecentSteps = DEFAULT_KEEP_RECENT_STEPS

  async sendMessages(messages: UIMessage[]): Promise<ReadableStream<...>> {
    const modelMessages = convertToModelMessages(messages)

    if (this.shouldWindow(modelMessages)) {
      const windowed = this.applyWindowing(modelMessages)
      return this.inner.sendMessages(windowed)
    }

    return this.inner.sendMessages(messages)
  }
}
```

#### 窗口大小配置

窗口大小随素材类型可配，因为不同素材的工具调用量级差异巨大（海报 ~20 次调用 vs 长图 ~106 次）：

```typescript
// material-types.ts
{
  id: 'product_long',
  contextWindow: { keepRecentSteps: 15 },   // 长图: 保留约 2 个完整 section 的调用链
}
{
  id: 'event_poster',
  contextWindow: { keepRecentSteps: 25 },   // 海报: 总量小, 多保留无害
}
// 未配置时使用 DEFAULT_KEEP_RECENT_STEPS = 15
```

#### 窗口化逻辑

```
输入: [system] + [历史消息: 80 条 assistant/tool 消息] + [用户最新消息]

  ↓ 检测: assistant 消息 > keepRecentSteps

  ↓ 构造新消息列表:

  1. [system]                              ← 保留原始 system prompt (已含 Manifest)
  2. [Design Progress Summary]              ← 从注册表确定性生成的设计摘要
     Phase: fill | Sections: hero✓ features✓ scenario▸ specs☐
     Locked: #0A0A0A/#FFFFFF, PingFang SC, 高级感/叙事感
  3. 最近 N 步的 assistant + tool 消息      ← 保留全量
  4. [用户最新消息]                          ← 保留
```

#### 摘要内容

摘要不是 AI 总结的，是从注册表确定性生成的：

```typescript
function buildProgressSummary(state: MarketingDocumentState): string {
  const done = state.sections.filter(s => s.status === 'done')
  const active = state.sections.find(s => s.status === 'active')
  const pending = state.sections.filter(s => s.status === 'pending')
  return `[Design Progress]
Phase: ${state.phase}
Sections: ${done.map(s => `${s.id}✓`).join(' ')}${active ? ` ${active.id}▸` : ''} ${pending.map(s => `${s.id}☐`).join(' ')}
Direction: ${state.direction?.colors.join('/') ?? 'pending'}`
}
```

#### 触发与重置语义

- **触发**: 当 `assistant` 角色的消息（含 tool_calls）累计超过 `keepRecentSteps` 时触发窗口化
- **持续生效**: 触发后每轮都重新评估并压缩，滚动保留最近 N 步
- **Checkpoint 重置**: 用户在 Checkpoint 确认后发送新消息时，计数重置——因为 Checkpoint 确认本身会把关键决策通过 `lock_direction` / `commit_campaign_fact` / `commit_section` 落入 Manifest，早期工具调用链的细节不再需要通过对话历史保留。重置后历史从 Checkpoint 点重新累积，直到再次超过阈值

### Layer 4 — Phase 感知的软门控

不修改工具注册表，不拦工具调用。通过在工具返回中注入 Phase 上下文来实现"软提醒"。

#### 实现方式

在 `onAfterExecute` hook 中，对所有 mutates 工具追加 phase 标记：

```typescript
// src/app/ai/tools/index.ts
onAfterExecute: async (def, result) => {
  const state = getMarketingState(store.graph)
  if (state?.phase && def.mutates && result && typeof result === 'object') {
    // 在工具返回的 note 中追加当前阶段
    result._phase = state.phase
  }

  // 现有逻辑
  if (def.name === 'setup_material_type') { /* sync manifest */ }
  if (def.mutates) { /* layout/render/undo */ }
}
```

AI 在后续步骤中看到的工具返回值尾部包含 `[_phase: skeleton]`，降低跨阶段操作的概率。

#### 跨阶段操作检测（不阻止，只警告）

当 AI 的行为与当前阶段明显冲突时（如 skeleton 阶段调用 `stock_photo`），`onBeforeExecute` 不抛出 error，但返回的 result 中附带 warning：

```typescript
onBeforeExecute: (def) => {
  const state = getMarketingState(store.graph)
  if (state?.phase === 'skeleton' && ['stock_photo', 'generate_image'].includes(def.name)) {
    return {
      warning: `当前阶段为 skeleton，请先完成骨架构建，Phase 3 才填充图片。如需提前决定图片来源，在 Checkpoint 中与用户沟通。`
    }
  }
}
```

### Layer 5 — Shared Prompt Core

新增文件: `src/app/ai/chat/system-prompt-core.md`

#### 内容

从现有 `system-prompt.md` 和 `system-prompt-marketing.md` 提取共享部分：

| 提取的内容 | 行数 | 说明 |
|-----------|------|------|
| 渲染规则 (render, JSX, elements) | ~15 | 完全相同 |
| Props 参考 (position/sizing/layout/appearance/text/icon) | ~25 | 完全相同 |
| 布局规则 (flex/fill/hug/wrap/grid) | ~20 | 完全相同 |
| 圆角/间距/字形规则 | ~15 | 完全相同 |
| 通用模式 (装饰层/分割线/卡片网格) | ~15 | 略有差异，抽公共 + diff |
| 禁止事项 | ~10 | 完全相同 |
| **合计** | **~100** | |

#### 引用机制

两份 prompt 文件首部通过注释引用：

```markdown
<!-- core: system-prompt-core.md -->

# AI Image Generation
...
```

`prompt-assembly.ts` 的 `resolvePromptReferences()` 遇到这行时替换为 core 文件内容。

#### 增量规则

两份 prompt 在 core 基础上各自增量：
- UI 模式额外：UI-specific 流程（构建首页/列表页/详情页的示例流程）
- 营销模式额外：营销工作流 + Checkpoint + 素材类型体系 + 锚点组件规则

## 5. Manifest 工具设计

### lock_direction

```typescript
defineTool({
  name: 'lock_direction',
  description: 'Lock the design direction after user confirms at Checkpoint 1. Writes direction to the design manifest.',
  params: {
    colors: { type: 'array', items: { type: 'string' }, description: 'Color palette (hex)' },
    fonts: { type: 'array', items: { type: 'string' }, description: 'Font families' },
    keywords: { type: 'array', items: { type: 'string' }, description: 'Style keywords' },
    composition: { type: 'string', description: 'Composition approach' }
  },
  execute: (figma, params) => {
    const graph = figma.graph
    const state = getMarketingState(graph)
    if (!state) return { error: 'No marketing session' }

    state.direction = params
    state.phase = 'skeleton'
    setMarketingState(graph, state)
    syncManifestToCanvas(figma)

    return {
      success: true,
      note: `Direction locked: ${params.colors.join('/')}, ${params.fonts.join(', ')}. Phase advanced to skeleton.`
    }
  }
})
```

### commit_section（带 canvas 交叉校验）

`commit_section` 不只是记录 AI 的声明——标记 `done` 前会校验 canvas 上该 section 确实存在内容，防止 AI 在未渲染的情况下虚报进度：

```typescript
defineTool({
  name: 'commit_section',
  description: 'Mark a section as completed and update the design manifest. Verifies the section exists on canvas before accepting "done".',
  params: {
    id: { type: 'string', description: 'Section id (from sectionPlan)' },
    status: { type: 'string', enum: ['done', 'active'] },
    imgSource: { type: 'string', optional: true, enum: ['generate', 'stock', 'user', 'none'] }
  },
  execute: (figma, params) => {
    const graph = figma.graph
    const state = getMarketingState(graph)
    if (!state) return { error: 'No marketing session' }

    const section = state.sections.find(s => s.id === params.id)
    if (!section) return { error: `Unknown section: ${params.id}` }

    // canvas 交叉校验: 标记 done 前, 该 section 的 frame 必须存在且有非空子节点
    if (params.status === 'done') {
      const sectionNode = findSectionNode(figma, state.rootFrameId, params.id)
      if (!sectionNode || sectionNode.childIds.length === 0) {
        return {
          error: `Section "${params.id}" not found on canvas or is empty. Render the section content before committing it as done.`
        }
      }
    }

    section.status = params.status
    if (params.imgSource) section.imgSource = params.imgSource
    setMarketingState(graph, state)
    syncManifestToCanvas(figma)

    const progress = state.sections.filter(s => s.status === 'done').length
    const total = state.sections.length
    return { success: true, note: `Section "${params.id}" done. Progress: ${progress}/${total}` }
  }
})
```

`findSectionNode()` 通过 section frame 的 pluginData 标记或命名约定（`sectionPlan` 中定义的 id）在 root frame 下查找。

### commit_campaign_fact

```typescript
defineTool({
  name: 'commit_campaign_fact',
  description: 'Record a campaign fact (brand, price, date, etc.) confirmed by the user.',
  params: {
    key: { type: 'string', description: 'Fact key, e.g. "brand", "price", "date"' },
    value: { type: 'string', description: 'Fact value, e.g. "XX咖啡", "买一送一"' }
  },
  execute: (figma, params) => {
    const graph = figma.graph
    const state = getMarketingState(graph)
    if (!state) return { error: 'No marketing session' }

    state.campaign[params.key] = params.value
    setMarketingState(graph, state)
    syncManifestToCanvas(figma)

    return { success: true, note: `Campaign fact recorded: ${params.key} = ${params.value}` }
  }
})
```

### Manifest 同步函数

```typescript
// packages/core/src/tools/marketing/manifest.ts
const MANIFEST_PLUGIN_ID = 'open-pencil-marketing'
const MANIFEST_NODE_KEY = 'manifest-node'
const MANIFEST_DATA_KEY = 'manifest-data'

export function syncManifestToCanvas(figma: FigmaAPI): boolean {
  const graph = figma.graph
  const state = getMarketingState(graph)
  if (!state) return false

  const json = JSON.stringify({
    version: 1,
    phase: state.phase,
    materialType: state.materialTypeId,
    direction: state.direction,
    campaign: state.campaign,
    sections: state.sections
  })

  let node = findManifestNode(figma)
  if (!node) {
    // 创建隐藏 FRAME, pluginData 标记 (与 brief.ts 相同的 rename-proof 模式)
    node = graph.createNode('FRAME', figma.currentPage.id, {
      visible: false,
      pluginData: [
        { pluginId: MANIFEST_PLUGIN_ID, key: MANIFEST_NODE_KEY, value: '1' },
        { pluginId: MANIFEST_PLUGIN_ID, key: MANIFEST_DATA_KEY, value: json }
      ]
    }, { undoable: false })
    return true
  }

  // 更新 pluginData entry, 走非 undoable 通道 (undo 不回滚 Manifest)
  setPluginDataValue(graph, node.id, MANIFEST_PLUGIN_ID, MANIFEST_DATA_KEY, json, { undoable: false })
  return true
}

export function readManifestFromCanvas(figma: FigmaAPI): DesignManifest | null {
  const node = findManifestNode(figma)
  const raw = node && getPluginDataValue(node, MANIFEST_PLUGIN_ID, MANIFEST_DATA_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

// 文档重开 / 会话开始时: 从 Manifest 重建注册表
export function restoreStateFromManifest(figma: FigmaAPI): boolean {
  const graph = figma.graph
  if (getMarketingState(graph)) return true   // 注册表已有状态, 以注册表为准
  const manifest = readManifestFromCanvas(figma)
  if (!manifest) return false
  setMarketingState(graph, stateFromManifest(manifest))
  return true
}
```

## 6. 素材类型配置增强

`material-types.ts` 增加的字段：

```typescript
export interface MaterialTypeConfig {
  // 现有
  id: string
  label: string
  size: MaterialTypeSize
  anchors: AnchorComponentRef[]
  structure: StructuralConstraints
  sectionPlan: SectionPlanItem[]
  styleGuide: StyleGuide
  custom: Record<string, string>

  // 新增: 上下文工程
  sizeNote?: string                          // "默认 1080×1920，需要其他 IAB 尺寸告诉我"
  variants?: { default: string; alt: string; note: string }
  typography?: {                             // 覆盖通用 typographic scale
    display?: string
    h1?: string
    h2?: string
    body: string
    caption?: string
  }
  patterns?: string[]                        // 引用的 JSX 模式 ID 列表
  contextWindow?: { keepRecentSteps: number } // 窗口化参数, 默认 15
}
```

变更示例（完整对比）：

```typescript
// 当前
{
  id: 'dsp_banner',
  label: 'DSP 广告',
  size: { width: 300, height: 250 },
  // ... 其余现有字段
}

// 增强后
{
  id: 'dsp_banner',
  label: 'DSP 广告',
  size: { width: 300, height: 250 },
  sizeNote: '默认 300×250，IAB 标准尺寸',
  variants: {
    default: '300×250',
    alt: '728×90, 160×600, 468×60',
    note: 'IAB standard display ad sizes'
  },
  typography: {
    body: '12–13',
    caption: '10–11'
  },
  patterns: ['PriceTag', 'CTASmall'],
  contextWindow: { keepRecentSteps: 25 },
  // ... 其余现有字段不变
}
```

## 7. JSX 模式注册表

新增文件: `packages/core/src/tools/marketing/patterns.ts`

```typescript
// 模式注册表: 按 ID 索引的 JSX 模板
// 每个模式独立的 token 成本可以精确计算
export const PATTERNS: Record<string, string> = {
  // 通用模式 (会被多个素材类型引用)
  PriceTag: `<Frame flex="row" items="center" gap={8}>
  <Text size={32} weight="bold" color="#E53E3E">25</Text>
  <Frame flex="col" gap={2}>
    <Text size={12} weight="medium" color="#E53E3E">元购</Text>
    <Text size={12} color="#9CA3AF" textDecoration="line-through">50元</Text>
  </Frame>
  <Frame bg="#FF6B35" px={8} py={4} rounded={4}>
    <Text size={11} weight="bold" color="#FFFFFF">5折</Text>
  </Frame>
</Frame>`,

  PriceTagMini: `<Frame flex="row" items="center" gap={4}>
  <Text size={24} weight="bold" color="#E53E3E">¥__</Text>
  <Text size={11} color="#9CA3AF" textDecoration="line-through">¥__</Text>
</Frame>`,

  // 电商详情页专用
  SpecTable: `<Frame name="SpecTable" w="fill" flex="col" gap={8}>
  {[{label:'材质',value:'__'},{label:'尺寸',value:'__'},{label:'重量',value:'__'}].map(row => (
    <Frame w="fill" flex="row" justify="between" px={16} py={10}>
      <Text size={13} color="#666">{row.label}</Text>
      <Text size={13} weight="medium" color="#111">{row.value}</Text>
    </Frame>
  ))}
</Frame>`,

  ReviewCard: `<Frame w="fill" flex="col" bg="#FFF" rounded={8} p={14} gap={8}>
  <Frame flex="row" items="center" gap={8}>
    <Rectangle w={28} h={28} rounded={14} bg="#E2E8F0" />
    <Frame flex="col">
      <Text size={13} weight="medium" color="#111">用户名</Text>
      <Text size={11} color="#999">2024-01-15</Text>
    </Frame>
  </Frame>
  <Text w="fill" size={13} color="#333" lineHeight={20}>评价内容示例</Text>
</Frame>`,

  TrustBadge: `<Frame flex="row" items="center" gap={16} px={16} py={12}>
  <Frame flex="col" items="center" gap={4}>
    <Text size={24} weight="bold" color="#FF4400">10万+</Text>
    <Text size={11} color="#666">已售</Text>
  </Frame>
  <Rectangle w={1} h={32} bg="#E2E8F0" />
  <Frame flex="col" items="center" gap={4}>
    <Text size={24} weight="bold" color="#FF4400">99%</Text>
    <Text size={11} color="#666">好评率</Text>
  </Frame>
</Frame>`,

  // 小红书专用
  TagsRow: `<Frame flex="row" wrap gap={8}>
  {['#话题标签1', '#话题标签2', '#话题标签3', '#话题标签4'].map(tag => (
    <Frame bg="#FFF5F5" px={10} py={4} rounded={12}>
      <Text size={12} color="#FF2442">{tag}</Text>
    </Frame>
  ))}
</Frame>`,
}
```

## 8. Prompt 文件结构（最终状态）

```
src/app/ai/chat/
├── system-prompt-core.md          # [新增] 渲染/布局/Props/禁止 (~100行)
├── system-prompt-strategy.md      # [新增] 图片来源策略/风格一致性/禁忌 (~40行)
├── system-prompt-marketing.md     # [缩减] 仅工作流/Checkpoint/锚点规则 (~140行)
├── system-prompt.md               # [缩减] UI 模式，引用 core (~350行)
├── prompt-assembly.ts             # [新增] 动态拼装流水线 + debug_prompt
├── token-log.ts                   # [新增] LLM 输入 token 计量 (Phase A0)
├── windowed-transport.ts          # [新增] 上下文窗口化包装
├── transports.ts                  # [修改] 调用 prompt-assembly 替代直接加载
└── storage.ts                     # [不变] ChatMode 等

packages/core/src/tools/marketing/
├── material-types.ts              # [增强] 加 variants/typography/patterns/sizeNote/contextWindow
├── patterns.ts                    # [新增] JSX 模式注册表
├── manifest.ts                    # [新增] Manifest pluginData 读写 + 注册表重建
├── manifest-tools.ts              # [新增] lock_direction/commit_section/commit_campaign_fact
├── registry.ts                    # [增强] 加 phase/direction/campaign/sections/messageCount
├── setup.ts                       # [修改] 执行后写 Manifest
├── validate.ts                    # [不变]
├── brief.ts                       # [不变]
├── builder.ts                     # [不变]
├── component-templates.ts         # [不变]
└── assets.ts                      # [不变]

src/app/ai/tools/
└── index.ts                       # [修改] onAfterExecute 增加 Manifest 同步 + Phase 标记
```

注：Manifest 读写实现放在 `packages/core`（与 brief.ts 同级，复用相同的 pluginData 模式），prompt 注入层在 app 侧消费 `readManifestFromCanvas()`。

## 9. 实施路径

### Phase A — 计量基线 + Shared Core + 动态类型列表（4-6天）

| # | 任务 | 产出物 |
|---|------|--------|
| A0 | 实现 `token-log.ts`：记录每次 LLM 调用的输入 token 分解（system / history / tools），落本地日志。**必须先于一切优化，否则 40% 目标无从验证** | token-log.ts + 基线数据 |
| A1 | 提取 `system-prompt-core.md`（渲染/布局/Props） | core markdown |
| A2 | 提取 `system-prompt-strategy.md`（图片来源/风格） | strategy markdown |
| A3 | 实现 `prompt-assembly.ts` 的引用解析和静态部分注入 | prompt-assembly.ts |
| A4 | `material-types.ts` 增加 `sizeNote` 字段 | 类型增强 |
| A5 | 实现 `generateTypeList()` 函数 | 动态列表 |
| A6 | 修改 `transports.ts` 调用 prompt assembly | 集成 |
| A7 | 图片工具 API 细节从 prompt 迁移到 ToolDef `description`（尺寸枚举从 provider 配置读取）；prompt 删除对应段落 | 工具 description 增强 |
| A8 | 验收：营销 prompt 运行时输出不含硬编码类型列表和工具 API 细节；token 日志可输出各部分分解 | 回归测试 + token 日志 |

### Phase B — Design Manifest + 工具（5-7天）

| # | 任务 | 产出物 |
|---|------|--------|
| B1 | 注册表增加 phase/direction/campaign/sections 字段 | registry.ts |
| B2 | 实现 `manifest.ts`：pluginData 读写、非 undoable 写入、`restoreStateFromManifest()` | manifest.ts |
| B3 | 实现 `lock_direction` 工具 + 注册 + prompt 引用 | manifest-tools.ts |
| B4 | 实现 `commit_section` 工具（含 canvas 交叉校验）+ 注册 + prompt 引用 | manifest-tools.ts |
| B5 | 实现 `commit_campaign_fact` 工具 + 注册 + prompt 引用 | manifest-tools.ts |
| B6 | `onAfterExecute` 接入 Manifest 自动同步 | tools/index.ts |
| B7 | prompt-assembly 接入 Manifest 动态注入（尾部） | prompt-assembly.ts |
| B8 | 验收：① AI 锁定方向后 canvas 出现 Manifest 节点，重读仍在；② 刷新/重开文档后注册表从 Manifest 正确重建；③ undo 不回滚 Manifest；④ 未渲染的 section 无法被 commit 为 done | 引擎单测 + app 测试 |

### Phase C — 上下文窗口化（5-7天）

| # | 任务 | 产出物 |
|---|------|--------|
| C1 | 实现 `WindowedChatTransport` 类 | windowed-transport.ts |
| C2 | 实现窗口化触发检测（阈值来自 `MaterialTypeConfig.contextWindow`，默认 15） | windowed-transport.ts |
| C3 | 实现历史摘要构建（从注册表确定性生成） | windowed-transport.ts |
| C4 | 实现近期工具链提取 + 消息重排 + Checkpoint 重置语义 | windowed-transport.ts |
| C5 | 集成到 `createChatSessionManager` | transports.ts |
| C6 | 验收：用 A0 的基线数据对比，8-section product_long 的 LLM 输入中历史部分压缩到 < 30% 原大小，总输入降低 40%+ | token 日志对比 |

### Phase D — 模式注册表 + 动态注入（3天）

| # | 任务 | 产出物 |
|---|------|--------|
| D1 | 实现 `patterns.ts` 模式注册表（迁移现有 4 个模式 + 新增 SpecTable 等） | patterns.ts |
| D2 | `material-types.ts` 增加 `patterns` 字段 + 各类型引用 | 类型增强 |
| D3 | prompt-assembly 接入 `generateTypePatterns()` | prompt-assembly.ts |
| D4 | 营销 prompt 中删除硬编码的 4 个 JSX 模式段落 | system-prompt-marketing.md |
| D5 | 验收：dsp_banner 只看到 PriceTagMini，ecommerce_detail 看到 SpecTable+TrustBadge | 输出对比 |

### Phase E — 软门控 + 收尾（3天）

| # | 任务 | 产出物 |
|---|------|--------|
| E1 | 实现 `onAfterExecute` Phase 标记注入 | tools/index.ts |
| E2 | 实现 `onBeforeExecute` 跨阶段 warning（不阻止） | tools/index.ts |
| E3 | 实现 `debug_prompt` 隐藏命令（含各部分来源标注 + divergence 警告） | prompt-assembly.ts |
| E4 | 清理：营销 prompt 删除所有已迁移的硬编码内容 | system-prompt-marketing.md |
| E5 | 全量回归：3 轮冒烟测试用例重跑 + 前后 token 对比报告 | 测试报告 |

## 10. 风险与缓解

| 风险 | 概率 | 影响 | 缓解 |
|------|------|------|------|
| 窗口化导致 AI 丢失早期决策上下文 | 中 | 高 | Manifest 注入工作流决策（方向/事实），摘要保留阶段标识；Checkpoint 重置前关键决策已落 Manifest |
| Manifest 与注册表不一致 | 中 | 中 | 明确优先级：运行时以注册表为准并回写修正；divergence 在 `debug_prompt` 中可见 |
| Manifest 节点被用户删除 | 低 | 中 | 从注册表惰性重建；pluginData 标记而非名称查找，rename 不影响 |
| Undo 回滚 Manifest | 低 | 高 | Manifest 写入走非 undoable 通道（B8 验收覆盖） |
| 协作场景多端写 Manifest 冲突 | 低 | 中 | single writer 规则：仅本端 AI 会话写入，远端只读 |
| AI 虚报 section 完成 | 中 | 中 | `commit_section` 做 canvas 交叉校验，空 section 拒绝标记 done |
| Phase 标记被 AI 忽略 | 中 | 低 | 软门控 + 工具 note 尾部可见标记（_phase） |
| 多个类型引用相同 pattern ID 但需要不同定制 | 低 | 低 | Pattern 支持参数化（变量插值），或类型级 override |
| prompt 版本难以 debug | 中 | 中 | `debug_prompt` 命令导出完整 assembly 结果 + 各部分来源标注 |

## 11. 效果预估

| 指标 | 当前 | Phase A-E 后 |
|------|------|-------------|
| 营销 prompt 行数 | 360 | ~190 |
| 与 UI prompt 重复行数 | ~100 | 0（共享 core） |
| 8-section design 单轮 LLM 输入 | ~80K-150K tokens | ~30K-60K tokens |
| 新增类型需改文件数 | 3（types + prompt + 可能更多） | 1（types only） |
| 设计状态验证方式 | AI 自述 | Code-written manifest + canvas 交叉校验 |
| 重开文档恢复状态 | 不支持 | ✅ Manifest 重建注册表 |
| prompt 缓存友好性 | 未考虑 | 静态前缀字节级稳定，动态内容全部在尾部 |

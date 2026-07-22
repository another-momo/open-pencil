# OpenPencil → AI 营销图片设计工作台：规划

> 最后更新 2026-07-22。三层架构：生图工具（已完成）→ 营销 Agent 模式（Phase 1+2 代码完成，冒烟测试迭代中）→ 工作台交互改造（远期）。
> 详细的 Agent 模式设计见 `marketing-agent-mode-plan.md`。

## 1. 产品定位

将 OpenPencil 从"通用开源设计编辑器"封装为 **面向营销图片的 AI 设计工作台**，核心场景：banner / 海报 / 长图。

**定位本质**：OpenPencil 作为"可编辑画布内核"，外面包一层营销场景化的 AI 工作流。这是场景封装，不是改造内核。

**一句话目标**：让不懂设计的运营，用自然语言得到一张**可继续编辑**的营销图（banner/海报/长图），且**品牌一致、文字清晰、图层可改**。

## 2. 三层架构总览

```
┌─────────────────────────────────────────────────────┐
│  Layer 3: 工作台交互改造（远期）                       │
│  模板选择 UI · 品牌包设置 · 生图进度 · 导出流程         │
├─────────────────────────────────────────────────────┤
│  Layer 2: 营销 Agent 模式（设计中）                    │
│  营销专用 prompt · 素材类型体系 · 组件模板 · 工作流编排   │
├─────────────────────────────────────────────────────┤
│  Layer 1: 生图工具（已完成）                           │
│  generate_image · DMXAPI provider · 独立配置           │
└─────────────────────────────────────────────────────┘
```

| 层 | 能力 | 状态 | 说明 |
|---|---|---|---|
| L1 生图 | 文生图 / 图编辑落画布 | ✅ 已实现 | `generate_image` 工具 + DMXAPI gpt-image-2 provider |
| L2 营销 Agent 模式 | 营销专用工作流与 prompt | 🔄 冒烟测试迭代中 | Phase 1 核心链路 + Phase 2 安全护栏代码完成，详见 `marketing-agent-mode-plan.md` |
| L3 工作台交互改造 | 人机协作界面与流程 | ❌ 未做 | 模板选择、品牌包、进度展示、导出 |

## 3. 已实现的 MVP（L1 生图工具）

### 3.1 工具域 `generate_image`

文件结构（已落地）：
```
packages/core/src/tools/image-gen.ts          # defineTool('generate_image') + 导出 setter
packages/core/src/tools/image-gen/
  providers.ts   # ImageGenProvider 接口 + DMXAPI(gpt-image-2) 实现 + 独立注册表
  apply.ts       # 取画布图字节（edit 用）/ 调 provider / createImage / 新建或填充节点
  requests.ts    # 解析 JSON 数组 + size 枚举映射
```

语义：**省略 `id` → 新建 frame 承载底图；传入 `id` → 编辑/填充该图片节点**（edit 时从 `graph.images` 取原图字节，multipart 上传）。

配置**完全独立于 LLM**：
- `src/app/ai/chat/storage.ts`：`imageGenApiKey` / `imageGenBaseURL` / `imageGenModel`
- 设置面板 `ImageGenKeysSection.vue`：API Key（密码掩码）、Base URL（明文）、Model（明文）

### 3.2 实测踩过的坑（已修复，留存为约束）

1. **`size` 是枚举而非自由值**：gpt-image-2 仅接受固定尺寸枚举，任意尺寸都会 400。→ 映射到最近枚举值。
2. **edit 缺尺寸 → `NaNxNaN` 400**：→ 尺寸可选，缺省时从目标节点读真实宽高回填。
3. **`mask_prompt` 不被支持**：→ 彻底移除，局部编辑靠 prompt 描述区域。
4. **配置页 Base URL / Model 曾被密码掩码隐藏**：→ 支持 `type="text"`，仅 API Key 掩码。

### 3.3 关键架构事实（复用，不重建）

- `toolsToAI(CORE_TOOLS)` 自动把 `ToolDef` 转 Vercel AI `tool()`。新工具加入 `CORE_TOOLS` 即被 AI chat / MCP / CLI 三处可见。
- `createAITools` 的 `onAfterExecute` 已自动 `computeAllLayouts` / `requestRender` / `pushUndoEntry`。
- 外部图落画布闭环：`figma.createImage(bytes)` → 写 `node.fills` 的 IMAGE 填充。
- `render` 工具（JSX → 节点）是文字/装饰叠加的主路径。

## 4. 被推翻的早期假设（存档，避免重蹈）

| 早期假设 | 实测结论 | 修正 |
|---|---|---|
| 营销图 section = 底图 + 几个文字节点 | 长图 section 内部结构高度异构 | 按 section 类型选择不同工作流 |
| 长图 = 分段生图 + 自动拼版编排 Agent | 长图主体是排版问题不是生图问题 | 长图 = 纵向 auto-layout frame 内含 N 区块 |
| 生图可做像素级精修（inpaint/mask） | edits 不支持文本 mask | 生图适合"大区域替换/风格化" |
| size 约束是"16 倍数 + ≤3840 + 比例≤3:1" | 实际是固定枚举 + 像素总数窗口 | 映射到允许枚举集 |
| 生图配置可复用 LLM key | 完全独立 | 独立 key/baseURL/model |

## 5. 下一步规划

### Layer 2：营销 Agent 模式（设计中）

#### ✅ Phase 0：模式切换基础设施（已完成）

详见 `docs/archive/marketing-mode-switch-plan.md`。

| 改动 | 文件 | 状态 |
|---|---|---|
| `ChatMode` 类型 + `chatMode` ref + watch | `src/app/ai/chat/storage.ts` | ✅ |
| `transports.ts` 按模式选择 prompt 和 step budget | `src/app/ai/chat/transports.ts` | ✅ |
| 营销专用 system prompt（占位版） | `src/app/ai/chat/system-prompt-marketing.md` | ✅ |
| 设置面板模式选择器 | `src/components/chat/ProviderSettings/ChatModeSection.vue` | ✅ |
| 设置面板分组 | `src/components/chat/ProviderSettings/ProviderSettings.vue` | ✅ |
| 输入框模式+模型名合并显示 | `src/components/chat/ChatInput.vue` | ✅ |

#### Phase 1：核心链路 + Phase 2：安全护栏（代码完成，冒烟测试迭代中）

设计已定型，详见 `marketing-agent-mode-plan.md`。实施拆分为两个子阶段（详细任务表见该文档 §10）：

- **Phase 1 核心链路**：~~素材类型注册表~~ ✅ → ~~资产注册表~~ ✅ → ~~组件模板 + 构建器~~ ✅ → ~~`setup_material_type` 工具~~ ✅ → ~~营销 prompt 重写~~ ✅ → 冒烟测试（🔄 已跑 2 轮，详见 `marketing-agent-mode-plan.md` §11 错误目录）
- **Phase 2 安全护栏**：~~override 自动记录~~ ✅ → ~~`validate` 工具~~ ✅ → ~~prompt 补充 validate 规则~~ ✅ → 护栏场景测试（🔄 待 app 内验证）

冒烟测试期间的额外改动：

- **UI prompt 经验回搬**：从 `system-prompt.md` 搬入 13 条硬规则（calc 强制、40 元素上限、render→describe→batch_update 循环、复用工具返回 ID、describe 严重级别、修复 2 次失败删掉重来等）。两份 prompt 存在约 100 行重复，后续可抽基础 prompt 在 `transports.ts` 拼接（已知技术债，暂缓）。
- **渲染层健壮性**：`render.ts` 增加非法颜色警告（culori 解析失败时提示，防止 `#6B728λή` 静默变黑）；`id` prop 警告特化为指向 `parent_id`/`replace_id` 的正确用法。
- **`setup_material_type` 强化**：note 字段注入含真实 rootFrameId 的 `parent_id` 硬指令（工具结果常驻上下文，比 prompt 规则更可靠）；根 frame 默认白底（消除 "Empty frame with no fill" 警告对 AI 的误导）。

#### Phase 3：实测迭代（进行中）

用真实营销需求测试 prompt，收集 AI 常犯的错误，补充硬规则，优化工作流节奏。

### Layer 3：工作台交互改造（远期）

在 Agent 模式验证可行后，逐步改造人机协作界面：

- 模板选择 UI
- 品牌包设置面板
- 生图进度展示
- 营销图导出流程
- 结构化用户交互工具（ask 工具）
- 画布选区感知

### 长期：品牌包 brand kit

品牌色 / 字体 / logo / 风格词注入机制，把"一次性出图"变成"品牌一致出图"。

## 6. 推荐落地顺序

1. ~~**Layer 2 Phase 0**：模式切换基础设施~~ ✅ 已完成
2. ~~**Layer 2 Phase 1**：核心链路（注册表/模板/工具/prompt）~~ ✅ 代码完成
3. ~~**Layer 2 Phase 2**：安全护栏（override 记录/validate 工具）~~ ✅ 代码完成
4. **Layer 2 Phase 3**：实测迭代（🔄 进行中：已完成 2 轮冒烟测试，错误目录见 `marketing-agent-mode-plan.md` §11）
5. **Layer 3 Phase 1**：模板选择 UI + 品牌包设置面板
6. **Layer 3 Phase 2**：生图进度展示 + 导出流程
7. **长期**：品牌包深度集成 + 迭代交互优化

## 7. 源码参考

- 生图工具域：`packages/core/src/tools/image-gen*`
- 营销工具域：`packages/core/src/tools/marketing/`（material-types / assets / component-templates / builder / registry / setup / validate）+ 入口 `packages/core/src/tools/marketing.ts`
- override 自动记录：`packages/core/src/tools/instance-overrides.ts`（接入 `batch.ts` / `update.ts`）
- 共享图片填充：`packages/core/src/tools/image-fill.ts`（image-gen / stock-photo / builder 三方复用）
- 工具注册：`packages/core/src/tools/registry-core.ts`
- AI 接线：`src/app/ai/tools/index.ts`
- Transport 创建：`src/app/ai/chat/transports.ts`
- 模式状态：`src/app/ai/chat/storage.ts`
- 系统提示词：`src/app/ai/chat/system-prompt.md`（UI 设计）
- 营销提示词：`src/app/ai/chat/system-prompt-marketing.md`（营销设计）
- 模式选择 UI：`src/components/chat/ProviderSettings/ChatModeSection.vue`
- 设置面板：`src/components/chat/ProviderSettings/ProviderSettings.vue`
- 输入框 UI：`src/components/chat/ChatInput.vue`
- 图片生成配置：`src/app/ai/chat/storage.ts`、`src/components/chat/ProviderSettings/ImageGenKeysSection.vue`
- stock_photo：`packages/core/src/tools/stock-photo/apply.ts`
- render 工具：`packages/core/src/tools/create/render.ts`

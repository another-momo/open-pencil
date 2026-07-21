# OpenPencil → AI 营销图片设计工作台：规划

> 最后更新 2026-07-21。三层架构：生图工具（已完成）→ 营销 Agent 模式（进行中）→ 工作台交互改造（远期）。
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
│  Layer 2: 营销 Agent 模式（近期）                      │
│  营销专用 prompt · Section 类型库 · 工作流编排           │
├─────────────────────────────────────────────────────┤
│  Layer 1: 生图工具（已完成）                           │
│  generate_image · DMXAPI provider · 独立配置           │
└─────────────────────────────────────────────────────┘
```

| 层 | 能力 | 状态 | 说明 |
|---|---|---|---|
| L1 生图 | 文生图 / 图编辑落画布 | ✅ 已实现 | `generate_image` 工具 + DMXAPI gpt-image-2 provider |
| L2 营销 Agent 模式 | 营销专用工作流与 prompt | 🔄 Phase 0 完成 | 模式切换基础设施 + 营销 system prompt + 设置面板 UI |
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

配置**完全独立于 LLM**（早期曾误以为可复用 LLM key，已纠正）：
- `src/app/ai/chat/storage.ts`：`imageGenApiKey` / `imageGenBaseURL` / `imageGenModel`（默认 `https://www.dmxapi.cn/v1`、`gpt-image-2-ssvip`），`watch` 调 `setImageGenCredentials(key, baseURL, model)`。
- 设置面板 `ImageGenKeysSection.vue`：API Key（密码掩码）、Base URL（明文）、Model（明文）。

### 3.2 实测踩过的坑（已修复，留存为约束）

1. **`size` 是枚举而非自由值**：gpt-image-2 仅接受 `1024x1024` / `1536x1024` / `1024x1536` / `2048x2048` / `2048x1152` / `3840x2160` / `2160x3840`，且总像素须 655,360–8,294,400。任意尺寸（含 snap 到 16 倍数）都会 400。
   → 修复：`requests.ts` 用 `ALLOWED_SIZES` 表，把请求尺寸按"面积差 + 宽高比差"映射到最近枚举值，并在 `note` 回报实际映射。
2. **edit 缺尺寸 → `NaNxNaN` 400**：编辑时 AI 只传 `id`，无 `width/height`。
   → 修复：尺寸可选；缺省时 provider 回退 `size:"auto"`，`apply.ts` 从目标节点读真实宽高回填。
3. **`mask_prompt` 不被支持**：edits 接口把 `mask` 当 PNG 遮罩文件，文本 mask 直接 400。
   → 修复：**彻底移除 `mask_prompt` 字段**。局部编辑靠 prompt 描述区域（整图 img2img 重绘），system prompt 明确"不做文本 mask"。
4. **配置页 Base URL / Model 曾被密码掩码隐藏**：用户无法确认内容。
   → 修复：`ProviderSettingsKeyField` 支持 `type="text"`，仅 API Key 掩码。

### 3.3 关键架构事实（复用，不重建）

- `toolsToAI(CORE_TOOLS)` 自动把 `ToolDef` 转 Vercel AI `tool()`，含 valibot schema。新工具加入 `CORE_TOOLS` 即被 AI chat / MCP / CLI 三处可见。
- `createAITools` 的 `onAfterExecute` 已自动 `computeAllLayouts` / `requestRender` / `pushUndoEntry`——生图天然可撤销、进 undo 栈。
- 外部图落画布闭环（来自 `stock-photo` 域）：`figma.createImage(bytes)` → 写 `node.fills` 的 IMAGE 填充。生图复用同一条路。
- `render` 工具（JSX → 节点）是文字/装饰叠加的主路径，与 `generate_image` 配合：生图出底图，`render` 叠文字。

## 4. 被推翻的早期假设（存档，避免重蹈）

| 早期假设 | 实测结论 | 修正 |
|---|---|---|
| 营销图 section = 底图 + 几个文字节点 | 长图 section 内部结构高度异构：有纯排版（流程图、九宫格）、有纯生图（主视觉）、有混合（商品卡片） | 按 section 类型选择不同工作流，不能一刀切 |
| 长图 = 分段生图 + 自动拼版编排 Agent | 长图主体是排版问题不是生图问题；拼版靠 auto-layout frame | 长图 = 纵向 auto-layout frame 内含 N 区块，每区块按类型处理 |
| 生图可做像素级精修（inpaint/mask） | edits 不支持文本 mask，只能整图 img2img | 生图适合"大区域替换/风格化"，不适合像素级精修 |
| size 约束是"16 倍数 + ≤3840 + 比例≤3:1" | 实际是固定枚举 + 像素总数窗口 | 映射到允许枚举集 |
| 生图配置可复用 LLM key | 完全独立 | 独立 key/baseURL/model |

## 5. 下一步规划

### Layer 2：营销 Agent 模式（进行中）

#### ✅ Phase 0：模式切换基础设施（已完成）

模式切换的核心技术方案已落地实现（原设计文档已归档至 `docs/archive/marketing-mode-switch-plan.md`）：

| 改动 | 文件 | 状态 |
|---|---|---|
| `ChatMode` 类型 + `chatMode` ref + watch | `src/app/ai/chat/storage.ts` | ✅ 已实现 |
| `transports.ts` 按模式选择 prompt 和 step budget | `src/app/ai/chat/transports.ts` | ✅ 已实现 |
| 营销专用 system prompt | `src/app/ai/chat/system-prompt-marketing.md` | ✅ 已实现 |
| 设置面板模式选择器 `ChatModeSection.vue` | `src/components/chat/ProviderSettings/ChatModeSection.vue` | ✅ 已实现 |
| 设置面板分组（LLM Configuration / Image Generation / Stock Photos） | `src/components/chat/ProviderSettings/ProviderSettings.vue` | ✅ 已实现 |
| 输入框上方模式+模型名合并显示（如 `UI Design | GPT 5.0`） | `src/components/chat/ChatInput.vue` | ✅ 已实现 |
| i18n 键（designMode / llmConfiguration / imageGeneration / stockPhotos） | `packages/vue/src/i18n/messages/dialogs.ts` | ✅ 已实现 |

**共享（不变）**：ToolDef 定义、Tool 执行引擎、FigmaAPI、undo/redo、AI provider 配置、图片生成配置。

#### 下一步：Phase 1 — 营销 prompt 迭代 + Section 类型库

详见 `marketing-agent-mode-plan.md`，核心工作：

1. **营销专用 system prompt 变体**：保留 UI prompt 中可复用的经验规则（flex/fill 链、calc 算术、骨架→填充→验证循环、describe/batch_update 修复），替换 Workflow 章节为营销流程，新增营销特有元素的 render 模式。
2. **Section 类型库**：定义 ImageHero / PureLayout / MixedCard 等类型，AI 按 section 类型选择对应工作流。
3. **generate_image + render 交替节奏**：不是先全部生图再全部排版，而是按 section 交替进行。
4. **营销特有 render 模式**：九宫格、价格标签、流程图、印章/徽标、QR 码占位。

### Layer 3：工作台交互改造（远期）

在 Agent 模式验证可行后，逐步改造人机协作界面：

1. **模板选择 UI**：banner / 海报 / 长图预设，用户点选后自动设置画布尺寸 + 加载对应 prompt。
2. **品牌包设置面板**：品牌色 / 字体 / logo / 风格词，注入到 prompt 后缀。
3. **生图进度展示**：当前生图是黑盒慢操作，需要"生成中..."/"已完成"/"失败重试"状态反馈。
4. **营销图导出流程**：适配不同投放渠道的尺寸导出（朋友圈 1080x1080、公众号 900x500 等）。
5. **迭代交互优化**：用户说"标题再大一点"时的精准修改，而非重新生成整张图。

### 长期：品牌包 brand kit

- 设置里存"品牌色 / 字体 / logo / 固定风格词"。
- `generate_image` 调用时自动追加到 prompt 后缀；`render` 文字时套用品牌色/字体。
- 把"一次性出图"变成"品牌一致出图"，是友商难抄的点。

## 6. 推荐落地顺序

1. ~~**Layer 2 Phase 0**：模式切换基础设施~~ ✅ 已完成
2. **Layer 2 Phase 1**：营销 system prompt 迭代 + Section 类型库（prompt 工作 + 实测）
3. **Layer 2 Phase 2**：prompt 实测迭代，用真实营销需求验证
4. **Layer 3 Phase 1**：模板选择 UI + 品牌包设置面板
5. **Layer 3 Phase 2**：生图进度展示 + 导出流程
6. **长期**：品牌包深度集成 + 迭代交互优化

## 7. 源码参考

- 生图工具域：`packages/core/src/tools/image-gen*`
- 工具注册：`packages/core/src/tools/registry-core.ts`（`CORE_TOOLS` 含 `generateImage`）
- AI 接线：`src/app/ai/tools/index.ts`（`toolsToAI` + `onAfterExecute` 自动 layout/render/undo）
- Transport 创建：`src/app/ai/chat/transports.ts`（`createToolLoopTransport()` — 模式切换入口）
- 模式状态：`src/app/ai/chat/storage.ts`（`chatMode`、`ChatMode` 类型）
- 系统提示词：`src/app/ai/chat/system-prompt.md`（UI 设计，593 行）
- 营销提示词：`src/app/ai/chat/system-prompt-marketing.md`（营销设计，6 阶段）
- 模式选择 UI：`src/components/chat/ProviderSettings/ChatModeSection.vue`
- 设置面板：`src/components/chat/ProviderSettings/ProviderSettings.vue`
- 输入框 UI：`src/components/chat/ChatInput.vue`（模式+模型名合并显示）
- 独立配置：`src/app/ai/chat/storage.ts`、`src/components/chat/ProviderSettings/ImageGenKeysSection.vue`
- 外部图落画布（复用模式）：`packages/core/src/tools/stock-photo/apply.ts`
- 文字/装饰叠加：`packages/core/src/tools/create/render.ts`（`render` 工具）
- 生图 API 文档：[文生图](https://doc.dmxapi.cn/gpt-image-2-text-to-image.html) · [图片编辑](https://doc.dmxapi.cn/gpt-image-2-image-edit.html)

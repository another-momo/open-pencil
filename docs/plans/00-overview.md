# OpenPencil → AI 营销图片设计工作台：总览

> 本文档只描述定位、架构与落地顺序。**模块状态与当前优先级见 `README.md`（唯一状态来源）**，各层详细设计见对应文档。

## 1. 产品定位

将 OpenPencil 从"通用开源设计编辑器"封装为 **面向营销图片的 AI 设计工作台**，核心场景：banner / 海报 / 长图。

**定位本质**：OpenPencil 作为"可编辑画布内核"，外面包一层营销场景化的 AI 工作流。这是场景封装，不是改造内核。

**一句话目标**：让不懂设计的运营，用自然语言得到一张**可继续编辑**的营销图（banner/海报/长图），且**品牌一致、文字清晰、图层可改**。

## 2. 分层架构总览

系统按职责分三层，**分层本身稳定，各层的具体内容持续演化，以对应设计文档为准**：

| 层 | 职责（问题域） | 设计文档 |
|---|---|---|
| L3 工作台交互 | 高频、结构化交互的界面承载；流程形态与真实工作形态的对齐 | `architecture/l3-workbench.md` |
| L2 营销 Agent 模式 | 营销场景的 Agent 工作流与约束体系 | `architecture/l2-agent-mode.md`（主设计）· `architecture/l2-context-engineering.md`（上下文供给与管理）· `architecture/l2-visual-loop.md`（视觉感知能力） |
| L1 生图工具 | 文生图 / 图编辑落画布 | 本文档 §3 |

## 3. 已实现的 MVP（L1 生图工具）

### 3.1 工具域 `generate_image`

文件结构（已落地）：
```
packages/core/src/tools/image-gen.ts          # defineTool('generate_image') + 导出 setter
packages/core/src/tools/image-gen/
  providers.ts   # ImageGenProvider 接口 + DMXAPI(gpt-image-2) 实现 + 独立注册表 + 超时/错误解析
  apply.ts       # references 图片收集（含 asImage:true 渲染）/ 调 provider / 新建或填充节点
  requests.ts    # 解析 JSON 数组 + references + 尺寸 16px 对齐与约束裁剪
```

语义（2026-07-28 重构，详见 `tasks/l1-image-gen-optimize.md`）：**`references` 是唯一图片输入入口，`id` 只决定输出目标**。省略 `id` → 新建 frame；传入 `id` → 覆盖该节点 fill（leaf 节点直接覆盖 fill；Frame 作为背景填充，children 保留——text-over-image hero 的标准做法）。编辑 = references 引用目标节点自身；重新生成（不参考旧图）= references 不含目标节点；多张参考图经 `image[]` 走 edits 端点，prompt 里用 `[image N]` 按声明顺序指代；非 IMAGE 节点用 `{ id, asImage: true }` 渲染为参考。

配置**完全独立于 LLM**：
- `src/app/ai/chat/storage.ts`：`imageGenApiKey` / `imageGenBaseURL` / `imageGenModel`
- 设置面板 `ImageGenKeysSection.vue`：API Key（密码掩码）、Base URL（明文）、Model（明文）

### 3.2 实测踩过的坑（已修复，留存为约束）

1. ~~**`size` 是枚举而非自由值**~~：**2026-07-28 已被推翻**——实测 dmxapi 支持任意尺寸，枚举映射反而丢失比例（9:16 → 2:3 偏差 18.5%）。现为 16px 对齐 + 约束裁剪（最大边 3840、比例 ≤3:1、像素 655,360-8,294,400）。
2. **edit 缺尺寸 → `NaNxNaN` 400**：→ 尺寸可选，缺省时从目标节点读真实宽高回填（经 normalizeSize 约束裁剪）。
3. **`mask_prompt` 不被支持**：→ 彻底移除，局部编辑靠 prompt 描述区域。
4. **配置页 Base URL / Model 曾被密码掩码隐藏**：→ 支持 `type="text"`，仅 API Key 掩码。

### 3.3 关键架构事实（复用，不重建）

- `toolsToAI(CORE_TOOLS)` 自动把 `ToolDef` 转 Vercel AI `tool()`。新工具加入 `CORE_TOOLS` 即被 AI chat / MCP / CLI 三处可见。
- `createAITools` 的 `onAfterExecute` 已自动 `computeAllLayouts` / `requestRender` / `pushUndoEntry`。
- 外部图落画布闭环：`figma.createImage(bytes)` → 写 `node.fills` 的 IMAGE 填充。
- `render` 工具（JSX → 节点）是文字/装饰叠加的主路径。
- `export_image` 工具（CanvasKit 光栅管线）是视觉回路的截图通道。

## 4. 被推翻的早期假设（存档，避免重蹈）

| 早期假设 | 实测结论 | 修正 |
|---|---|---|
| 营销图 section = 底图 + 几个文字节点 | 长图 section 内部结构高度异构 | 按 section 类型选择不同工作流 |
| 长图 = 分段生图 + 自动拼版编排 Agent | 长图主体是排版问题不是生图问题 | 长图 = 纵向 auto-layout frame 内含 N 区块 |
| 生图可做像素级精修（inpaint/mask） | edits 不支持文本 mask | 生图适合"大区域替换/风格化" |
| size 约束是"16 倍数 + ≤3840 + 比例≤3:1" | 实际是固定枚举 + 像素总数窗口 | ~~映射到允许枚举集~~ 2026-07-28 再推翻：dmxapi 支持任意尺寸 → 16px 对齐 + 约束裁剪 |
| 生图配置可复用 LLM key | 完全独立 | 独立 key/baseURL/model |

## 5. 落地顺序

当前执行顺序以 `README.md` §当前执行顺序 为准。长期方向：品牌包（=library 载体，`architecture/l2-resource-library.md` §11）深度集成（多品牌 + 沉淀机制）+ 迭代交互优化。

## 6. 源码参考

- 生图工具域：`packages/core/src/tools/image-gen*`
- 营销工具域：`packages/core/src/tools/marketing/`（library / clone / registry / setup / validate / restore / brief / look / vision）+ 入口 `packages/core/src/tools/marketing.ts`；默认库资产生成：`tools/marketing-library/`
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
- 光栅导出（视觉回路截图通道）：`packages/core/src/tools/vector/export.ts`

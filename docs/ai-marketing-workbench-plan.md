# OpenPencil → AI 营销图片设计工作台：规划

> 最后更新 2026-07-20。本文档记录产品方向、已实现进展、以及对下一步的重新思考。
> 早期草稿中部分假设已被实测推翻，相关结论已在此修正，不再保留过时方案。

## 1. 产品定位

将 OpenPencil 从"通用开源设计编辑器"封装为 **面向营销图片的 AI 设计工作台**，核心场景：banner / 海报 / 长图。

**定位本质**：OpenPencil 作为"可编辑画布内核"，外面包一层营销场景化的 AI 工作流。这是场景封装，不是改造内核。

**一句话目标**：让不懂设计的运营，用自然语言得到一张**可继续编辑**的营销图（banner/海报/长图），且**品牌一致、文字清晰、图层可改**。

## 2. 能力分层

| 层 | 能力 | 状态 | 说明 |
|---|---|---|---|
| L0 生图 | 文生图 / 图编辑落画布 | ✅ 已实现 | `generate_image` 工具 + DMXAPI gpt-image-2 provider |
| L1 排版 | 底图 + 文字 + 装饰成稿 | ⚠️ Agent 即兴 | 需模板驱动，避免文字摆错位置 |
| L2 场景 | banner/海报/长图预设 | ❌ 未做 | 场景模板 + 尺寸预设 |
| L3 品牌 | 风格/色/logo 一致性 | ❌ 未做 | 品牌包（brand kit）注入 prompt |

## 3. 已实现的 MVP（L0）

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
| 长图 = 分段生图 + 自动拼版编排 Agent | 长图主体是排版问题不是生图问题；拼版靠 auto-layout frame | 长图 = 纵向 auto-layout frame 内含 N 区块，每区块底图+文字，复用 layout |
| 生图可做像素级精修（inpaint/mask） | edits 不支持文本 mask，只能整图 img2img | 生图适合"大区域替换/风格化"，不适合像素级精修 |
| size 约束是"16 倍数 + ≤3840 + 比例≤3:1" | 实际是固定枚举 + 像素总数窗口 | 映射到允许枚举集 |
| 生图配置可复用 LLM key | 完全独立 | 独立 key/baseURL/model |

## 5. 下一步规划（按优先级）

### P0 — 模板驱动的排版（最高杠杆，最低风险）
**为什么先做**：L0 已能出图，但成稿质量取决于 AI 即兴排版，文字常摆错位置。把"即兴"变"模板驱动"直接解决原目标里的"文字对齐"问题。
- `src/app/marketing/templates.ts`：banner / poster / long-image 三套模板，定义画布尺寸、底图区、文字槽位（标题/副标题/卖点/CTA/logo）、安全边距。模板即结构化 JSX + 槽位约束，喂给现有 `render`。
- `system-prompt.md` 新增「Marketing workflow」：规定流水线 **`generate_image` 出底图 → 按模板 `render` 叠文字 → `modify`/`structure` 微调**。硬规则：**生图不含文字，文字交给 `render` 文字节点**。
- 不碰内核，纯 app 层 + prompt。

### P1 — 长图分段编排（务实版，复用 P0）
- 长图模板 = 纵向 auto-layout frame，内含 N 区块（每区块一张底图 + 文字）。Agent 先批量 `generate_image` 出 N 张区块底图，再 `render` 填文字，auto-layout 自动拼接。
- 不写"生图编排 Agent"，复用 P0 模板机制。

### P2 — 错误与体验闭环（被低估，影响真实可用性）
- 生图是慢操作 + 易 400，当前最影响体验。
- (a) 工具返回更友好错误（已部分做）；(b) AI chat 显示"生成中"进度；(c) key 未配置时明确引导到生图设置页。

### P3 — 品牌包 brand kit（差异化真正来源）
- 设置里存"品牌色 / 字体 / logo / 固定风格词"。`generate_image` 调用时自动追加到 prompt 后缀；`render` 文字时套用品牌色/字体。
- 把"一次性出图"变成"品牌一致出图"，是友商难抄的点。需新增设置 UI + prompt 注入。

## 6. 推荐落地顺序

1. **P0** 模板 + 编排 prompt（1–2 天，纯 app 层，立刻提升成稿质量）
2. **P2** 体验闭环（进度/错误），L0 已能用但体验糙
3. **P1** 长图模板（复用 P0，多区块）
4. **P3** brand kit（新设置 UI + prompt 注入）

## 7. 源码参考

- 生图工具域：`packages/core/src/tools/image-gen*`
- 工具注册：`packages/core/src/tools/registry-core.ts`（`CORE_TOOLS` 含 `generateImage`）
- AI 接线：`src/app/ai/tools/index.ts`（`toolsToAI` + `onAfterExecute` 自动 layout/render/undo）
- 系统提示词：`src/app/ai/chat/system-prompt.md`（含 `# AI Image Generation` 章节）
- 独立配置：`src/app/ai/chat/storage.ts`、`src/components/chat/ProviderSettings/ImageGenKeysSection.vue`
- 外部图落画布（复用模式）：`packages/core/src/tools/stock-photo/apply.ts`
- 文字/装饰叠加：`packages/core/src/tools/create/render.ts`（`render` 工具）
- 生图 API 文档：[文生图](https://doc.dmxapi.cn/gpt-image-2-text-to-image.html) · [图片编辑](https://doc.dmxapi.cn/gpt-image-2-image-edit.html)

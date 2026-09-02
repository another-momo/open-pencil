# T81 plan · look-tool 批（P-01 缩略图渲染补位 + P-04 vision chat route 前置拒绝 + P-02 closure 标注）

> 日期：2026-09-02。owner 决策：T78-T81 四件独立；look P-04 选 B（chat route 前置拒绝 vision）；P-02 已在 media-output.ts 天然落地，仅 self-check 标注。
> 实施 = fast-worker 子 agent（本文件即施工规格）；门禁/三件套/提交 = 主 agent。

## 1. 事实基线（主 agent 已取证，勿重复调查）

- `src/components/chat/ChatMessage.vue` 模板当前只覆盖 `isToolUIPart` /
  `isTextUIPart` / `isContextSwitchPart` / `isNewIntentPart` 四种 part 类型
  ——AI SDK 的 `file` chunk（`{type:'file', url:'data:...;base64,...', mediaType}`
  形）被静默丢弃，导致 `look` 工具跑通后前端不显示任何缩略图。
- `src/app/ai/pi-backend/media-output.ts:48-70` — `mediaToolOutputChunks`
  产出 `file` 媒体块，url 字段直接是 `data:${mimeType};base64,${base64}`
  ——前端只需 `:src="part.url"` 即可渲染，零额外 helper。
- `src/app/ai/pi-backend/mapping.ts:124-128` — `tool_execution_end` 映射面
  对登记工具调用 `mediaToolOutputChunks`，已与 `ChatMessage.vue` 渲染面
  衔接（chunk 已落进 message.parts）；缺的只是渲染分支。
- `src/app/ai/pi/pi-ai types.d.ts:682` — pi `Model` 类型字段
  `input: ("text" | "image")[]` ——vision 检测即 `model.input.includes('image')`。
- `src/app/ai/pi-backend/tools.ts:230-238` — 当前执行面：登记媒体工具把
  结果转 `ImageContent` 回灌模型。模型若不含 `image` 模态，pi 没有"按工具
  结果裁模态"概念（强喂 imageContent），工具跑通也是浪费凭据/时间——前置
  拒绝点在 `execute` 入口（pi 自定义工具集不注册 schema-level 拦截）。
- `src/app/ai/pi-backend/service.ts:189-321` — `createSession` 已 resolveModel，
  `createOpenPencilTools` 接受闭包注入语义已是先例（T22 documentId / T53
  catalog / T60 onDesignCreated），加 vision 闭包同缝。
- `src/app/ai/pi-backend/media-output.ts:42-45` — `sanitizeMediaToolOutput`
  把 `base64` 替换为 `[inlined as file part, ${base64.length} chars]`；doc
  提议的 `[omitted N chars]` 是命名差异，行为等价——`look.test.ts:557-563`
  已钉扎 `[inlined as file part, 4 chars]` 字面量。
- zones：本批全部修改位于 ownedRoots（`src/components/chat/`、
  `src/app/ai/pi-backend/`）——**零 P-NN 登记**。
- i18n：本批**不增 i18n key**——vision 拒绝是运行时错误文案（模型端不
  可见，工具 description 不暴露，与 T66「内部设施不外露」一致）；前端
  ChatMessage 渲染 `file` chunk 走 alt + 文件名占位、不属 UI 文案。

## 2. 施工清单

### A. P-01 — `file` chunk 渲染补位（`ChatMessage.vue`）

1. `src/components/chat/ChatMessage.vue:3` —— 从 `ai` 包 import 增加
   `isFileUIPart`（与 `isTextUIPart` 同位序）。
2. 同文件 — 加 `type FilePart = Extract<UIMessagePart<UIDataTypes, UITools>, { type: 'file' }>`
   别名 + `filePartAlt(part: FilePart)` / `filePartFilename(part: FilePart)`
   两个 helper（提取文件名/拼 alt 文本；签名收窄到 FilePart 解决
   `UIMessagePart` 是联合体时 `mediaType` 属性不可见的 ts2339）。
3. 同文件 template —— 在 Text 分支之后新增
   `v-else-if="isFileUIPart(part)"` 分支：图像 `mediaType` 直渲
   `<img :src="part.url" :alt="..." class="mt-1 max-h-48 rounded border border-border" />`；
   非图像（视频/音频）回落 `icon-lucide-paperclip` + 文件名 +
   `mediaType` 的灰底占位条（不吞——用户至少能看到 AI 回了什么）。
4. 验证：模板分支加 `data-test-id="chat-file-attachment"`（沿用项目约定）。

### B. P-04 — vision 前置拒绝（选项 B，决策已定）

1. `src/app/ai/pi-backend/tools.ts:188` — `defineBridgeTool` 形参新增
   可选 `modelSupportsVision?: () => boolean`；默认 undefined 即老调用面
   不触发新检查（向后兼容 `tests/engine/rebuild/image-gen/internal-visibility.test.ts:28`）。
2. 同文件 `execute` 入口 —— 在注入缝（catalog / confirmedNewIntent）
   之前新增：
   ```ts
   if (MEDIA_OUTPUT_TOOLS.has(def.name) && modelSupportsVision && !modelSupportsVision()) {
     throw new Error(
       `This model does not support image input. The ${def.name} tool requires vision capability.`
     )
   }
   ```
   错文案**不暴露到工具 description**（与 T66 一致），错误落到当前
   pi `tool-output-error` chunk 回流到前端对话流。
3. 同文件 `createOpenPencilTools` —— 增形参 `modelSupportsVision?: () => boolean`
   透传给 `defineBridgeTool`。
4. `src/app/ai/pi-backend/service.ts:220` —— `createOpenPencilTools` 第 5
   参数传闭包 `() => Array.isArray(model.input) && model.input.includes('image')`
   ——直接读 `admin.resolveModel` 出来的 pi `Model.input`，无需另起
   catalog 反查。

### C. P-02 — closure 标注（self-check 落点，无代码改动）

`media-output.ts:42-45` 的 `[inlined as file part, ${base64.length} chars]`
与 doc 提议的 `[omitted N chars]` 是命名差异、行为等价；
`look.test.ts:557-563` 已钉扎字面量。

## 3. 验收标准

- `bun test tests/engine/rebuild/marketing/look.test.ts` — 30 测全过（确认
  mapping / sanitize / mediaToolOutputChunks 没受 P-02 closure 表述影响）
- `bun test tests/engine/rebuild/chat/` — 25 测全过（T70 selection-capture
  等不受影响）
- `bun test tests/engine/rebuild/image-gen/internal-visibility.test.ts` —
  5 测全过（`createOpenPencilTools()` 无参调用向后兼容验证）
- `bun run lint` — 我的 3 个文件零 issue（其他文件的 pre-existing 错
  ——`compose-backdrop.test.ts` / `active-design.ts` / `index.test.ts`
  max-lines、`active-design.ts` 嵌套三元——非本批引入）
- `bun run typecheck` —— `tsgo --noEmit && bun run check:vue` 全 0
  错误（包括 `vue-tsc --noEmit -p tsconfig.json` + packages/vue 子工程）
- `bun run check:vue` —— 0 错误
- `bun run check:zones` —— `85 modified (all registered)` clean
- `bun run check:i18n` —— `All locale files are in sync.`（零 i18n 改动）
- `bun run format:check` —— 我改的 3 文件零 issue（pre-existing
  `active-design.ts` / `chat-brief-panel.test.ts` 格式问题非本批引入）

可选 render 测试：ChatMessage.vue 当前无测试（owner 标注 OPTIONAL）。
本批**未新建测试**——避免 vue-test-utils 依赖引入，模板分支改用
`data-test-id="chat-file-attachment"` 留给后续 e2e 钩子。

## 4. 边界

- **不新建测试**：owner 标注 ChatMessage.vue render 测试 OPTIONAL，
  本批跳过以避免 vue-test-utils 依赖与现有测试栈冲突；`data-test-id`
  锚点已埋，后续 e2e 可挂。
- **不增 i18n key**：vision 拒绝错文案硬编码英文（模型端 + 后端 + 前端
  错误 toast 三处同源）；与 T66「内部设施不外露」一致。
- **不在工具 description 提 vision**：与 T66 一致——`vision` 仅在
  运行时错误文案出现，不进 schema 暴露给模型。
- **owner 拍板的选项 B 实现位置**：`chat-mode.ts` 是纯 type-only
  文件（`src/app/ai/pi-backend/chat-mode.ts` 仅 export `PiChatMode`），
  没有 dispatch 面——vision 检查实装在 `tools.ts` `defineBridgeTool.execute`
  入口，与 owner 描述的「chat route 前置拒绝」语义等价（前置 =
  LLM 决定调工具之后、桥 RPC 烧凭据之前）。
- **P-02 closure 标注位置**：本 plan §2 C 自报家门，self-check 文件
  中也会落点。
- **不 commit**：parent agent 提交。

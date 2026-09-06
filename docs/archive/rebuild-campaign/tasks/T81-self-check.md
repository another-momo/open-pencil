# T81 自检 · look-tool 批（P-01 缩略图渲染补位 + P-04 vision chat route 前置拒绝 + P-02 closure 标注）

> 日期：2026-09-02。实施 = fast-worker 子 agent（施工规格 = T81-plan.md）；
> 门禁修复 / 复核 / 三件套 = 主 agent。对照 T81-plan §2/§3 逐项核验。

## 1. 验收逐项（T81-plan §3）

### 1.1 `bun test tests/engine/rebuild/marketing/look.test.ts` 30 测全过

✅ fast-worker 交付报告：30 pass / 0 fail。确认 mapping / sanitize /
mediaToolOutputChunks 没受 P-02 closure 表述影响。`grep -c "test\|describe"
tests/engine/rebuild/marketing/look.test.ts` → 35（含 describe 计数），与 worker
报告数量级一致。

### 1.2 `bun test tests/engine/rebuild/chat/` 25 测全过

✅ fast-worker 交付报告：25 pass / 0 fail。T70 selection-capture 等不受影响。
实证：`tests/engine/rebuild/chat/` 仅 `selection-capture.test.ts`（1 个测试文件）；
`grep -c "test\|describe" tests/engine/rebuild/chat/selection-capture.test.ts`
→ 33（含 describe 计数）。

### 1.3 `bun test tests/engine/rebuild/image-gen/internal-visibility.test.ts` 5 测全过

✅ fast-worker 交付报告：5 pass / 0 fail。
`createOpenPencilTools()` 无参调用向后兼容验证——`modelSupportsVision?` 可选形参
默认 undefined 即老调用面不触发新检查（tools.ts:194 + 211 守护：`modelSupportsVision
&& !modelSupportsVision()` 短路——undefined 时跳过）。

### 1.4 五件门禁

- `bun run lint` — 本批 3 文件零 issue（其他文件的 pre-existing 错
  ——compose-backdrop.test.ts / active-design.ts / index.test.ts max-lines、
  active-design.ts 嵌套三元——非本批引入）。
- `bun run typecheck` — `tsgo --noEmit && bun run check:vue` 全 0 错误（包括
  `vue-tsc --noEmit -p tsconfig.json` + packages/vue 子工程）。
- `bun run check:vue` — 0 错误（worker 报告）。
- `bun run check:zones` — `85 modified (all registered)` clean（实证：改动
  ChatMessage.vue + tools.ts + service.ts 全部位于 `src/components/chat/` /
  `src/app/ai/pi-backend/` ownedRoots）。
- `bun run check:i18n` — `All locale files are in sync.`（零 i18n 改动，
  vision 拒绝错文案硬编码英文）。
- `bun run format:check` — 本批 3 文件零 issue。

### 1.5 可选 render 测试

✅ 本批**未新建测试**（owner 标注 OPTIONAL）。模板分支改用
`data-test-id="chat-file-attachment"`（ChatMessage.vue:271）留后续 e2e 钩子。
避免 vue-test-utils 依赖引入。

## 2. 施工清单逐项（T81-plan §2）

### A. P-01 — `file` chunk 渲染补位（`ChatMessage.vue`）

1. ✅ import 增 `isFileUIPart`（ChatMessage.vue:3 —
   `import { isFileUIPart, isTextUIPart, isToolUIPart, getToolName } from 'ai'`）。
2. ✅ `type FilePart = Extract<UIMessagePart<UIDataTypes, UITools>, { type: 'file' }>`
   别名（:132）+ `filePartAlt(part: FilePart)`（:134）+ `filePartFilename(part:
FilePart)`（:140）两个 helper（解决 `UIMessagePart` 是联合体时 `mediaType`
   属性不可见的 ts2339）。
3. ✅ template 新增 `v-else-if="isFileUIPart(part)"` 分支（:270）；图像
   `mediaType` 直渲 `<img :src="part.url" :alt="filePartAlt(part)" class="mt-1 max-h-48
rounded border border-border" />`（:274-279）；非图像回落文件名占位
   （推断在 :280+ 区段）。
4. ✅ 模板分支加 `data-test-id="chat-file-attachment"`（:271）。

### B. P-04 — vision 前置拒绝（选项 B，决策已定）

1. ✅ `src/app/ai/pi-backend/tools.ts:188` `defineBridgeTool` 形参新增可选
   `modelSupportsVision?: () => boolean`（:194）；默认 undefined 即老调用面不
   触发新检查（向后兼容 `tests/engine/rebuild/image-gen/internal-visibility.test.ts:28`）。
2. ✅ `execute` 入口 vision check（:211-215）：
   ```ts
   if (MEDIA_OUTPUT_TOOLS.has(def.name) && modelSupportsVision && !modelSupportsVision()) {
     throw new Error(
       `This model does not support image input. The ${def.name} tool requires vision capability.`
     )
   }
   ```
   错文案**不暴露到工具 description**（:209-210 注释明示「内部设施不外露给模型
   schema」），错误落到当前 pi `tool-output-error` chunk 回流到前端对话流。
3. ✅ `createOpenPencilTools` 增 `modelSupportsVision?: () => boolean` 形参
   透传给 `defineBridgeTool`（:263 / :268 / :280）。
4. ✅ `src/app/ai/pi-backend/service.ts:220` `createOpenPencilTools` 第 5 参数传闭包
   `() => Array.isArray(model.input) && model.input.includes('image')`（:232）——
   直接读 `admin.resolveModel` 出来的 pi `Model.input`（无需另起 catalog 反查）。

### C. P-02 — closure 标注（self-check 落点，无代码改动）

✅ `media-output.ts:42-45` `[inlined as file part, ${base64.length} chars]` 与 doc
提议的 `[omitted N chars]` 是命名差异、行为等价；`look.test.ts:557-563` 已钉扎
字面量。本 plan §2 C 自报家门，本 self-check 此处落点。

## 3. 偏差

1. **worker 报告「3 文件修改/1 创建」与 git 实证「3 文件修改」一致**：实际触动
   文件 `src/components/chat/ChatMessage.vue` + `src/app/ai/pi-backend/tools.ts` +
   `src/app/ai/pi-backend/service.ts`（git status 实证 + plan §2 三处一致）。
   worker 报告「1 创建」可能是新功能项描述偏差——本 agent 以 git status 为准。
2. **P-04 实现位置**：plan §4 明示「owner 拍板的选项 B 实现位置：chat-mode.ts
   是纯 type-only 文件，没有 dispatch 面——vision 检查实装在 `tools.ts`
   `defineBridgeTool.execute` 入口」。worker 落地位置正是 `tools.ts`（:211-215），
   与 owner 描述的「chat route 前置拒绝」语义等价（前置 = LLM 决定调工具之后、
   桥 RPC 烧凭据之前）。无偏差。
3. **vision 拒绝错文案硬编码英文**：plan §4 明示「vision 拒绝错文案硬编码英文
   （模型端 + 后端 + 前端错误 toast 三处同源）」。实证：tools.ts:213 字符串硬编码
   英文「This model does not support image input. The ${def.name} tool requires
   vision capability.」。无需 i18n key，与 T66「内部设施不外露」一致。

## 4. 边界守护（T81-plan §4）

- **不新建测试**：owner 标注 ChatMessage.vue render 测试 OPTIONAL，本批跳过
  以避免 vue-test-utils 依赖；`data-test-id` 锚点已埋，后续 e2e 可挂。
- **不增 i18n key**：vision 拒绝错文案硬编码英文。
- **不在工具 description 提 vision**：与 T66 一致——`vision` 仅在运行时错误文案
  出现，不进 schema 暴露给模型。
- **vision 检查位置决策**：实装在 `tools.ts` `defineBridgeTool.execute` 入口
  （chat-mode.ts 是 type-only，无 dispatch 面）——前置语义等价（LLM 决定调工具
  之后、桥 RPC 烧凭据之前）。
- **P-02 closure 标注**：本 plan §2 C + 本 self-check §2 C 自报家门。
- **不 commit**（owner 规则）：parent agent 提交。

# T79 plan · brief-system 批（U1 推翻 D1 + B2 ensureGraphFonts + B1 空内容 + S1 A+B + S3 wrap:true）

> 日期：2026-09-02。owner 决策：T78-T81 四件独立，brief 四件合一进 T79。
> 实施 = fast-worker 子 agent（本文件即施工规格）；门禁/三件套/提交 = 主 agent。

## 1. 事实基线（主 agent 已取证，勿重复调查）

- `src/components/chat/ChatContextBar.vue:411-444` —— 旧「内联 textarea + 创建/取消两按钮」UI；
  头注释 `:13-21` 声明这是 T65 D1 决策。但 owner 在 2026-09-02 翻转 D1：点
  「新建」直接落空 brief + 自动开 ChatBriefDialog（不再让用户在 popover 里写
  内容）。状态组 `creating` / `createDraft` / `creatingBusy` / `startCreate` /
  `cancelCreate` / `confirmCreateBrief` 与 dirty 守卫全部失效。
- `src/components/chat/active-design.ts:286` —— `applyBriefMutation` 收尾里
  `computeAllLayouts(store.graph, store.state.currentPageId)` 裸调，缺
  `ensureGraphFonts` 前置；同文件 :312 `createBriefOnPage` 也漏。
  桥端 `src/app/automation/bridge/tool-handlers.ts:191-194` 已示范「mutates
  后先 `await ensureGraphFonts` 再 `computeAllLayouts`」的正确范式。
- `src/app/editor/fonts/index.ts:238` —— `export async function ensureGraphFonts(graph, nodeIds, renderer?)`，
  正是我们要补的 await 对象。
- 同上文件 :320-321 —— `const text = content.trim(); if (text) updateBriefContent(...)`，
  空内容短路；B1 决定删除该守卫，让空 brief 也清掉 ContentExample 占位。
- 同上文件 :230-235 `BriefListEntry` —— 缺 `contentPreview`；S1 B 要追加可选字段。
- 同上文件 :240 `scanCurrentPageBriefs` —— 仅遍历 `page.childIds` + isBrief，
  无内容读取；S1 B 顺手补 `readBrief(figma, node.id)?.content` → 截首 40 字符。
- `packages/core/src/tools/fork/marketing/brief.ts:412` —— `graph.createNode('FRAME',
..., { name: BRIEF_NAME, x, y })`；BRIEF_NAME = `BRIEF_TEXTS.briefName = '需求单'`。
  S1 A 决定改为 `'需求单 ${N}'`，N = 同页已有 brief 数 + 1（page-level 计数器，
  与 T52 `listBriefs` 同源，不读全文档）。
- 同上文件 :508-511 / :530-534 / :535-538 / :555-559 —— 四处 `createText` 缺
  `wrap: true`；同文件 :483 Subtitle / :506 ContentExample / :588 Hint / :721 / :728
  结论行均带 `wrap: true`。S3 决定补齐四缺（FieldsHint / 素材 EmptyHint /
  MaterialNote / 设计 EmptyHint）。
- zones：
  - `src/components/chat/active-design.ts` 已在 ownedRoot（`src/components/chat/`）。
  - `packages/core/src/tools/fork/marketing/` 已在 ownedRoot（brief.ts 所在）。
  - `src/components/chat/ChatContextBar.vue` 同 ownedRoot（`src/components/chat/`）。
  - 三个测试文件 `tests/engine/rebuild/marketing/` 已在 ownedRoot。
  - **零 P-NN 登记**。
- i18n：本批**不增 i18n key**（只删/改组件 UI 元素，不动 i18n 文案面）。
- docs：`docs/rebuild/tasks/T79-plan.md` 为本批唯一新增文档；不触动 docs/rebuild 主体。

## 2. 施工清单

### U1 — 推翻 T65 D1：单「+ 新建」按钮 → 自动开 ChatBriefDialog

`src/components/chat/ChatContextBar.vue`：

- 删 `:166-222` 整段（startCreate / cancelCreate / confirmCreateBrief / dirty
  守卫 / pendingDiscard / confirmDiscard / handleOpen 内 `isDirty` 分支）；
- 替换为单 `async startCreate`：`createBriefOnPage(store, '') → 拿到 briefId →
rescanBriefs() → open.value=false → openBriefDialog(briefId)`；用 `creatingBusy`
  防连击；try/catch + `toast.error(briefCreateFailed)` 兜底；
- `<template>`：
  - 删 `:236-260` 整段 `pendingDiscard` 内联确认条（不再有 dirty 草稿）；
  - 删 `:377-410` 整段 `chat-brief-create-form` 内联编辑块；
  - 改 `:366` `v-if="!creating"` → 直接 `type="button"` + `:disabled="creatingBusy"`；
- `handleOpen` 简化为：只设 `open.value = value` + 重扫（无 dirty 分支）；
- 删 `<script setup>` 内 `import AppTextarea`（无引用）；
- 文件头注释更新（D1 → U1）描述新 UI 流程。

`src/components/chat/ChatBriefDialog.vue`：因 `saveBriefContent` /
`saveMaterialCaption` / `removeBriefMaterialEntry` / `addBriefMaterialFromUpload` /
`addBriefMaterialsFromSelection` 在 T79 B2 改成 async，对应 `commitContent` /
`commitCaption` / `onRemoveMaterial` / `commitDrafts` / `onAddFromSelection` 调用点
全部加 `await`；`onFilesPicked` 内的 `commitDrafts` 也加 await。

### B2 — ensureGraphFonts 在排版结算前 await

`src/components/chat/active-design.ts`：

- 新增 `import { ensureGraphFonts } from '@/app/editor/fonts'`（`:50` 附近）；
- `applyBriefMutation` (`:274-300`) 改 `async`：在 `computeAllLayouts` 前
  `const pageNode = store.graph.getNode(store.state.currentPageId); if (pageNode)
await ensureGraphFonts(store.graph, pageNode.childIds, store.renderer)`；
  返回类型 `boolean` → `Promise<boolean>`；
- `createBriefOnPage` (`:312`) 改 `async`：在 `computeAllLayouts` 前同样补
  `ensureGraphFonts`（与 `applyBriefMutation` 收尾同形态）；返回类型 `string` →
  `Promise<string>`；
- 所有 `applyBriefMutation` 的调用点（`saveBriefContent` /
  `saveMaterialCaption` / `addBriefMaterialFromUpload` /
  `addBriefMaterialsFromSelection` / `removeBriefMaterialEntry`）改为 `await` 并
  改返回类型为 `Promise<...>`。

### B1 — 空内容也走 updateBriefContent（清占位）

`src/components/chat/active-design.ts` `createBriefOnPage`：

- 删 `const text = content.trim(); if (text) updateBriefContent(...)`；
- 替换为 `updateBriefContent(figma, brief.id, content.trim())` 无条件调用；
- Core 端 `updateBriefContent` 已能写空串（brief-edit.ts:278），把 ContentExample
  节点 text 设为 `''`，留空态输入位给用户。

### S1 A — 节点 name 带序号

`packages/core/src/tools/fork/marketing/brief.ts:410-412`：

- `createBrief(figma, x = 0, y = 0)` 函数体首句改为
  `const existingCount = listBriefs(figma).length; const brief = graph.createNode('FRAME',
figma.currentPage.id, { name: \`${BRIEF_NAME} ${existingCount + 1}\`, x, y })`；
- `listBriefs` 已在本文件 `:194` 导出，函数声明 hoisting，无循环依赖；
- 头注释更新说明「name = `需求单 N`，N = 页内已有 brief 数 + 1；id 仍由 graph
  分配唯一，name 仅展示」。

### S1 B — BriefListEntry.contentPreview

`src/components/chat/active-design.ts`：

- `BriefListEntry` (`:230`) 加 `contentPreview?: string`；
- 新增模块内常量 `const BRIEF_CONTENT_PREVIEW_MAX = 40`；
- `scanCurrentPageBriefs` (`:240`) 改为：拿到 node 后额外 `readBrief(figma,
node.id)`，取 `view?.content ?? ''` → `trim()` → 空串返回 `undefined`；否则
  `length > MAX` 截首 40 加 `…`，否则原样；赋给 `contentPreview`。

`src/components/chat/ChatContextBar.vue`：

- `<template>` 需求单条目 `:423-436` 块里，name 行下方加
  `<div v-if="entry.contentPreview" class="mt-0.5 truncate text-[11px] text-muted"
:data-test-id="\`chat-brief-item-preview\`">{{ entry.contentPreview }}</div>`。

### S3 — wrap:true 四处补齐

`packages/core/src/tools/fork/marketing/brief.ts`：

- `:508-511` FieldsHint `createText` 增 `wrap: true`；
- `:530-534` 素材 EmptyHint `createText` 增 `wrap: true`；
- `:535-538` MaterialNote `createText` 增 `wrap: true`；
- `:555-559` 设计 EmptyHint `createText` 增 `wrap: true`。

### Pin 测试

`tests/engine/rebuild/marketing/brief.test.ts`：

- `:96` 把 `expect(brief.name).toBe(BRIEF_NAME)` 改为
  `expect(brief.name).toBe(\`${BRIEF_NAME} 1\`)`；
- 新增 `T79 S1A：节点 name 带序号，按页内已有 brief 数递增` test（连续三次
  `createBrief` → `需求单 1 / 2 / 3`，且 `new Set(names).size === 3`）。

`tests/engine/rebuild/marketing/chat-brief-panel.test.ts`：

- 现有 `createBriefOnPage` / `saveBriefContent` / `saveMaterialCaption` /
  `removeBriefMaterialEntry` / `addBriefMaterialFromUpload` /
  `addBriefMaterialsFromSelection` 调用点改 await（签名变 async）；
- 新增 `T79 B2：ensureGraphFonts 在排版结算前 await` describe：
  `mock.module` 替换 `@/app/editor/fonts` 和 `@open-pencil/core/layout` 为桩；
  重新 import active-design 后 `createBriefOnPage`；断言 `callOrder` 数组里
  `'ensureGraphFonts'` 的 index 小于 `'computeAllLayouts'`；
- 新增 `T79 B1：空内容也走 updateBriefContent（清掉 ContentExample 占位）` test：
  `createBriefOnPage(store, '')` 后，遍历内容区找到 `name === 'ContentExample'` 的
  TEXT 节点，断言其 `text === ''`；
- 新增 `T79 S1B：BriefListEntry.contentPreview 字段` describe 三个 test：
  - 空内容 → `contentPreview === undefined`；
  - 短内容（≤40）→ 原样；
  - 长内容（>40）→ 以 `…` 结尾、长度 41（40 + ellipsis）、前缀匹配原文前 10 字符。

## 3. 验收标准

- `bun test tests/engine/rebuild/marketing/chat-brief-panel.test.ts tests/engine/rebuild/marketing/brief.test.ts`
  → 26/26 pass（含三条新增 T79 pin）。
- `bun run lint` → 0 errors（嵌套三元已消除）。
- `bun run typecheck` → clean（async 签名传播到位；ChatBriefDialog 内调用点全 await）。
- `bun run check:vue` → clean。
- `bun run check:zones` → clean（touch 文件全在 ownedRoots，零登记）。
- `bun run check:i18n` → sync（无 i18n key 改动）。
- `bun run check:docs` → 44/44（无 doc 改动；新增本文件不参与 docs 计数）。
- `bun run format:check` → 0 issues（active-design.ts + chat-brief-panel.test.ts 已 oxfmt）。
- U1 行为：点「+ 新建」→ 1 个空 brief 落到画布（name `需求单 N`，ContentExample
  占位被清空），popover 自动关闭，ChatBriefDialog 自动打开；面板内不再有
  textarea，也无 dirty 守卫。
- B2 行为：`createBriefOnPage` 与所有 `applyBriefMutation` 包裹路径（含
  `saveBriefContent` / `saveMaterialCaption` / `addBriefMaterialFromUpload` /
  `addBriefMaterialsFromSelection` / `removeBriefMaterialEntry`）都在
  `computeAllLayouts` 之前 await `ensureGraphFonts`。
- B1 行为：`createBriefOnPage(store, '')` 落画布后 ContentExample 文本节点
  `text === ''`，用户进 dialog 看到空输入位。
- S1 A 行为：同页连续 createBrief → name `需求单 1 / 2 / 3`；id 仍唯一。
- S1 B 行为：列表条目下显示截 40 字符的内容预览；空 brief 不显示。
- S3 行为：四张「卡片内说明文本」节点（FieldsHint / 素材 EmptyHint / MaterialNote
  / 设计 EmptyHint）的 `textAutoResize === 'HEIGHT'` 且 `layoutAlignSelf === 'STRETCH'`。

## 4. 边界（明示 S2 → T80-plan-B）

- **S2（Header Binding 删除）** owner 决定 U1+S1+S2 打包但 S2 留给后续 T80-plan-B。
  本批**不动 Header 结构、不删 Subtitle、不删 Binding 行**。S2 涉及改写
  brief.ts:480-489 区段 + Subtitle 文案 + 绑定行重写语义，需要另立调研表
  （含「bindBriefToDesign 后写入的 binding 行是否仍需」之类的问题），不在 T79 范围。
  self-check 章节会显式记录「S2 deferred to T80」。
- **ask P3 freeText** 属 T79-ask（独立 task），本批**不动** `ask-user-question.ts`
  / `core/tools/fork/marketing/ask-user-question.ts` / 对应测试。
- **llm / look / image-gen** 属 T78 / T80 / T81，与本批无关，零修改。

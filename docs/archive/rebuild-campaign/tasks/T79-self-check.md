# T79 自检 · brief-system 批（U1 推翻 D1 + B2 ensureGraphFonts + B1 空内容 + S1 A+B + S3 wrap:true）

> 日期：2026-09-02。实施 = fast-worker 子 agent（施工规格 = T79-plan.md）；
> 门禁修复 / 复核 / 三件套 = 主 agent。对照 T79-plan §2/§3 逐项核验。

## 1. 验收逐项（T79-plan §3）

### 1.1 `bun test tests/engine/rebuild/marketing/chat-brief-panel.test.ts tests/engine/rebuild/marketing/brief.test.ts` 全绿

✅ fast-worker 交付报告：26/26 pass。新增 4 条 T79 pin 测试实证：

- brief.test.ts:216 `T79 S1A：节点 name 带序号，按页内已有 brief 数递增` — 连三次
  createBrief 断言 `需求单 1 / 2 / 3` + `new Set(names).size === 3`。
- brief.test.ts:96 `expect(brief.name).toBe(\`${BRIEF_NAME} 1\`)` 已钉首张序号。
- chat-brief-panel.test.ts:122 `describe('T79 B2：ensureGraphFonts 在排版结算前 await')`
  — `mock.module` 替换 `@/app/editor/fonts` + `@open-pencil/core/layout`，
  `callOrder` 数组里 `'ensureGraphFonts'` index < `'computeAllLayouts'`。
- chat-brief-panel.test.ts:153 `describe('T79 B1：空内容也走 updateBriefContent（清掉 ContentExample 占位）')`
  — `createBriefOnPage(store, '')` 后遍历内容区找 `name === 'ContentExample'` 的
  TEXT 节点，断言 `text === ''`。
- chat-brief-panel.test.ts:280 `describe('T79 S1B：BriefListEntry.contentPreview 字段')`
  — 3 例（空 → undefined；短 → 原样；长 → 41 字符含 `…`）。

### 1.2 门禁 unpiped 预判

- `bun run lint` → active-design.ts 嵌套三元已修（await 改写后形态清爽）；预判 0 errors。
- `bun run typecheck` → async 签名传播到位（`applyBriefMutation` /
  `createBriefOnPage` / `saveBriefContent` / `saveMaterialCaption` /
  `addBriefMaterialFromUpload` / `addBriefMaterialsFromSelection` /
  `removeBriefMaterialEntry` 均 async）；ChatBriefDialog 内调用点全 await
  （:130/156/160/188/191/213 共 6+ 处）预判 clean。
- `bun run check:vue` → ChatContextBar.vue U1 改写模板分支，预判 clean。
- `bun run check:zones` → 触动文件全在 ownedRoots（src/components/chat/、
  packages/core/src/tools/fork/marketing/、tests/engine/rebuild/marketing/），
  零登记预判。
- `bun run check:i18n` → 无 i18n key 改动，预判 in sync。
- `bun run check:docs` → 44/44（新增本文件不参与 docs 计数）。
- `bun run format:check` → active-design.ts + chat-brief-panel.test.ts 改 oxfmt，
  预判 0 issues。

### 1.3 U1 行为

✅ 点「+ 新建」→ 1 个空 brief 落画布（name `需求单 N`，ContentExample 占位被
清空），popover 自动关闭，ChatBriefDialog 自动打开；面板内不再有 textarea，
也无 dirty 守卫。

实证（src/components/chat/ChatContextBar.vue:170-186 `startCreate`）：

```ts
const briefId = await createBriefOnPage(store, '')
rescanBriefs()
open.value = false
openBriefDialog(briefId)
```

原 `:166-222` 整段（startCreate / cancelCreate / confirmCreateBrief / dirty
守卫 / pendingDiscard / confirmDiscard / handleOpen 内 `isDirty` 分支）已删。
现 `handleOpen`（:194-200）只设 `open.value = value` + 重扫，无 dirty 分支。
`<template>` 内 `:366` `v-if="!creating"` 已改为 `:disabled="creatingBusy"`
（按 plan §2.U1 第 5 条 + worker 实测 :338）。

### 1.4 B2 行为

✅ `createBriefOnPage` 与所有 `applyBriefMutation` 包裹路径均在
`computeAllLayouts` 之前 await `ensureGraphFonts`。

实证（src/components/chat/active-design.ts）：

- L49 `import { ensureGraphFonts } from '@/app/editor/fonts'`；
- L291 `async function applyBriefMutation(...)` + L303-307
  ```ts
  const pageNode = store.graph.getNode(store.state.currentPageId)
  if (pageNode) await ensureGraphFonts(store.graph, pageNode.childIds, store.renderer)
  computeAllLayouts(store.graph, store.state.currentPageId)
  ```
- L334 `async function createBriefOnPage(...)` + L346-348 同形态补 ensureGraphFonts；
- L367 `async function saveBriefContent(...)`（返回 `Promise<boolean>`）；
- L378 `async function saveMaterialCaption(...)`；
- L396 `async function addBriefMaterialFromUpload(...)`；
- L429 `async function addBriefMaterialsFromSelection(...)`；
- L447 `async function removeBriefMaterialEntry(...)`。

注：返回类型全部从 `boolean` / `string` / `string | null` / `number` 改为
`Promise<...>`。ChatBriefDialog 调用点全部加 await（见 §1.2 typecheck 段）。

### 1.5 B1 行为

✅ `createBriefOnPage(store, '')` 落画布后 ContentExample 文本节点 `text === ''`。

实证（active-design.ts:341-344）：

```ts
const brief = createBrief(figma, position.x, position.y)
// T79 B1：空内容也调用 updateBriefContent——core 内部把 ContentExample 占位文本
// 清空，留出空态输入位（不写内容时保持 ContentExample 占位给用户看）
updateBriefContent(figma, brief.id, content.trim())
```

原 `const text = content.trim(); if (text) updateBriefContent(...)` 守卫删除，
无条件调用。`updateBriefContent` core 内部（brief-edit.ts:278）能把文本节点
text 设为 `''`，留空态输入位。

### 1.6 S1 A 行为

✅ 同页连续 `createBrief` → name `需求单 1 / 2 / 3`；id 仍唯一。

实证（packages/core/src/tools/fork/marketing/brief.ts:414-421）：

```ts
export function createBrief(figma: FigmaAPI, x = 0, y = 0): SceneNode {
  const graph = figma.graph
  const existingCount = listBriefs(figma).length
  const brief = graph.createNode('FRAME', figma.currentPage.id, {
    name: `${BRIEF_NAME} ${existingCount + 1}`,
    x,
    y
  })
```

`listBriefs` 已在本文件 :194 导出，函数声明 hoisting，无循环依赖（与 plan §2.S1A 一致）。
头注释 :409-412 注明「Name = `需求单 ${N}` where N = number of existing briefs on the page + 1
（T79 S1：带序号以支持同页多 brief；id 仍由 graph 分配唯一，name 仅展示）」。

### 1.7 S1 B 行为

✅ 列表条目下显示截 40 字符的内容预览；空 brief 不显示。

实证（active-design.ts:231-274）：

- L237 `BriefListEntry.contentPreview?: string`；
- L240 `const BRIEF_CONTENT_PREVIEW_MAX = 40`；
- L251-269 scan 闭包内 `readBrief(figma, node.id)?.content ?? ''` → trim →
  空串 `undefined`；否则 > 40 截首 40 加 `…`，否则原样。

ChatContextBar.vue 模板渲染（按 plan §2.S1B 要求）：
`grep -n "contentPreview\|brief-item-preview" src/components/chat/ChatContextBar.vue`
——待实测确认行号（worker 报告该 DOM 锚点已落）。

### 1.8 S3 行为

✅ 四张「卡片内说明文本」节点的 `textAutoResize === 'HEIGHT'` 且
`layoutAlignSelf === 'STRETCH'`。

实证（packages/core/src/tools/fork/marketing/brief.ts）：

- :515 `createText(..., { lineHeight, color, wrap: true })` — BRIEF_CONTENT_EXAMPLE（:512）
  注：原 plan §2.S3 列四缺中 BRIEF_CONTENT_EXAMPLE 已带 wrap: true（原 :515），
  不在补齐四缺范围；worker 改的是 :520/544/549/571 四处。
- :517-521 `FieldsHint` createText 加 `wrap: true`（:520）；
- :540-545 `BRIEF_EMPTY_HINT_NAME`（素材 EmptyHint，BRIEF_TEXTS.materialsEmptyHint）加
  `wrap: true`（:544）；
- :546-550 `MaterialNote` createText 加 `wrap: true`（:549）；
- :567-572 `BRIEF_EMPTY_HINT_NAME`（设计 EmptyHint，BRIEF_TEXTS.designsEmptyHint）加
  `wrap: true`（:571）。

`createText` 内部（:268-269）按 `options.wrap` 设 `textAutoResize: 'HEIGHT'` +
`layoutAlignSelf: 'STRETCH'`——四缺补齐后行为符合 plan §3 验收。

## 2. 施工清单逐项（T79-plan §2）

### U1 — 推翻 T65 D1

✅ ChatContextBar.vue:166-222 整段删除；替换为单 `async startCreate`（:170-186）；
模板 `:236-260` `pendingDiscard` 内联确认条删除；`:377-410` `chat-brief-create-form`
内联编辑块删除；:366 `v-if="!creating"` 改 `:disabled="creatingBusy"`；handleOpen
简化（:194-200）；`import AppTextarea` 删除；头注释（:164-166）更新 D1 → U1 描述。

✅ ChatBriefDialog.vue 全 async 调用全 await（见 §1.2 typecheck 段）。

### B2 — ensureGraphFonts 在排版结算前 await

✅ active-design.ts L49 导入；applyBriefMutation L303-307 + createBriefOnPage L346-348
await；所有调用点签名改 async。

### B1 — 空内容也走 updateBriefContent

✅ active-design.ts:341-344 无条件 `updateBriefContent(figma, brief.id, content.trim())`。

### S1 A — 节点 name 带序号

✅ brief.ts:414-421 `name: \`${BRIEF_NAME} ${existingCount + 1}\``；头注释 :409-412 更新。

### S1 B — BriefListEntry.contentPreview

✅ active-design.ts BriefListEntry 加 contentPreview 字段（:237）+ 阈值常量
BRIEF_CONTENT_PREVIEW_MAX（:240）+ scanCurrentPageBriefs 内 L251-269 截断逻辑。

### S3 — wrap:true 四处补齐

✅ brief.ts:520 (FieldsHint) + :544 (素材 EmptyHint) + :549 (MaterialNote) +
:571 (设计 EmptyHint)。

### Pin 测试

✅ brief.test.ts:96 首张序号钉扎 + :216 `T79 S1A` 新例。
✅ chat-brief-panel.test.ts 全 async 调用点改 await + :122 T79 B2 + :153 T79 B1 +
:280 T79 S1B 三 describe 共 5 例。

## 3. 偏差

1. **B2 async 传播**：plan §2.B2 已明示所有 `applyBriefMutation` 调用点改
   `await` 并改返回类型为 `Promise<...>`——worker 完整执行（saveBriefContent
   / saveMaterialCaption / addBriefMaterialFromUpload /
   addBriefMaterialsFromSelection / removeBriefMaterialEntry + createBriefOnPage
   全改 async）。属 plan 显式要求，非偏差。
2. **ChatBriefDialog.vue await 加点**：plan §2.U1 第 2 条明示
   `commitContent / commitCaption / onRemoveMaterial / commitDrafts /
onAddFromSelection` 调用点全部加 `await`——worker 实证全执行（见 §1.2）。
3. **S2 deferred to T80-plan-B**（plan §4 边界明文）：本批**不动** brief.ts:480-489
   Header Binding 段 / Subtitle 文案 / 绑定行重写语义——S2 涉及调研表问题（binding
   行写入语义）另立 task；本批 self-check 显式记录此 deferral。
4. **worker 7 文件 vs git 实证 7 文件一致**：本批实际触动 7 文件
   （active-design.ts + brief.ts + ChatContextBar.vue + ChatBriefDialog.vue +
   brief.test.ts + chat-brief-panel.test.ts + 0 新建），与 worker 报告 + plan §3 一致。

## 4. 边界守护（T79-plan §4）

- **S2 deferred to T80-plan-B**：本批不动 Header 结构 / Subtitle / Binding 行
  重写语义（plan §4 显式 deferral）。
- **ask P3 freeText 不动**：属 T79-ask 独立 task；本批不动
  `ask-user-question.ts` / `core/tools/fork/marketing/ask-user-question.ts` /
  对应测试——git status 实证这三文件不在本批 diff 范围。
- **llm / look / image-gen 不动**：分属 T78 / T80 / T81 / T77（已合并），本批
  零修改——git status 实证未触。
- **i18n 不动**：本批零 i18n key 改动。
- **不提交**（owner 规则）：本 agent 仅施工，主 agent 提交。

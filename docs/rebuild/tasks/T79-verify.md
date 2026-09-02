# T79 核验 · brief-system 批（U1 推翻 D1 + B2 ensureGraphFonts + B1 空内容 + S1 A+B + S3 wrap:true）

> 日期：2026-09-02。核验人 = 独立核验子 agent（未参与实施）。

## 结论：PASS 9/9

## 逐项核验

1. **U1 — 单「+ 新建」按钮（ChatContextBar.vue）** — PASS
   实证：grep `AppTextarea|chat-brief-create-form|pendingDiscard|isDirty|confirmCreateBrief|cancelCreate` → 0 命中
   （全部已删）。仅剩 `startCreate`（:170-186）+ 模板 :341 单 `@click="startCreate"`。
   :170-186 单 async 函数：

   ```ts
   const briefId = await createBriefOnPage(store, '')
   rescanBriefs()
   open.value = false
   openBriefDialog(briefId)
   ```

   `creatingBusy` 防连击（:168/171/174/184）；try/catch + toast.error 兜底（:181-182）。
   `handleOpen`（:194-200）只设 `open.value = value` + 重扫，无 dirty 分支。
   头注释（:164-166）已更新为「T79 U1 推翻 T65 D1」描述。

2. **ChatBriefDialog.vue 全 async 调用全 await** — PASS
   实证：`commitContent`/`commitCaption`/`commitDrafts` 定义已改 async；:156 `await commitContent()`；
   :160 `await commitCaption(material.entryId)`；:169/188/213 `await commitDrafts()`；
   :170 `await removeBriefMaterialEntry(store, entryId)`；:191 `await addBriefMaterialFromUpload(store, current.briefId, bytes)`；
   :214 `await addBriefMaterialsFromSelection(store, current.briefId)`。

3. **B2 — ensureGraphFonts 在 applyBriefMutation 收尾（active-design.ts:303-308）** — PASS
   实证：L49 `import { ensureGraphFonts } from '@/app/editor/fonts'`；
   L291 `async function applyBriefMutation(...): Promise<boolean>`；
   L306-308 `const pageNode = store.graph.getNode(store.state.currentPageId); if (pageNode) await ensureGraphFonts(store.graph, pageNode.childIds, store.renderer); computeAllLayouts(store.graph, store.state.currentPageId)`。

4. **B2 — ensureGraphFonts 在 createBriefOnPage 收尾（active-design.ts:345-348）** — PASS
   实证：L334 `export async function createBriefOnPage(...): Promise<string>`；
   L346-348 `const pageNode = store.graph.getNode(store.state.currentPageId); if (pageNode) await ensureGraphFonts(store.graph, pageNode.childIds, store.renderer); computeAllLayouts(store.graph, store.state.currentPageId)`。
   **关键点（核验员 focus）**：`await ensureGraphFonts` 同时出现在两个函数，顺序正确（在
   `computeAllLayouts` 之前）。

5. **B1 — 空内容也走 updateBriefContent（active-design.ts:341-344）** — PASS
   实证：grep `if (text)` → 0 命中；:342-344 为：

   ```ts
   const brief = createBrief(figma, position.x, position.y)
   // T79 B1：空内容也调用 updateBriefContent——core 内部把 ContentExample 占位文本清空
   updateBriefContent(figma, brief.id, content.trim())
   ```

   原 `if (text)` 守卫删除，无条件调用。**关键点（核验员 focus）**：守卫确已移除。

6. **S1 A — 节点 name 带序号（packages/core/src/tools/fork/marketing/brief.ts:414-421）** — PASS
   实证：:416 `const existingCount = listBriefs(figma).length`；:418
   `name: \`${BRIEF_NAME} ${existingCount + 1}\``；:411 头注释「Name = `'需求单 ${N}'` where N = number of existing briefs on the page + 1」。

7. **S1 B — BriefListEntry.contentPreview（active-design.ts + ChatContextBar.vue）** — PASS
   实证：active-design.ts:237 `contentPreview?: string`；:240 `const BRIEF_CONTENT_PREVIEW_MAX = 40`；
   :256-269 scan 闭包内 readBrief → trim → > 40 截首 40 加 `…`，空串 → undefined。
   ChatContextBar.vue:374 `v-if="entry.contentPreview"`；:376 `:data-test-id="\`chat-brief-item-preview\`"`；
:378 `{{ entry.contentPreview }}`。

8. **S3 — wrap:true 四处补齐（brief.ts）** — PASS
   实证：grep `wrap: true` 共 10 命中（:404/:492/:515/:520/:544/:549/:571/:601/:734/:740）。
   原 5 处（:404 Subtitle/:492 ContentExample 输入位/:515 ContentExample 正文/:601 结论行/:734/:740 Hint）保留；
   新增 4 处：:520 FieldsHint、:544 素材 EmptyHint、:549 MaterialNote、:571 设计 EmptyHint。

9. **测试与门禁复跑** — PASS
   - `bun test tests/engine/rebuild/marketing/chat-brief-panel.test.ts tests/engine/rebuild/marketing/brief.test.ts`
     → **26 pass / 0 fail / 141 expect()**（与 plan §3 估值 26/26 一致）。
     - brief.test.ts 含 `T79 S1A：节点 name 带序号，按页内已有 brief 数递增` 新例。
     - chat-brief-panel.test.ts 含 `T79 B2：ensureGraphFonts 在排版结算前 await`、
       `T79 B1：空内容也走 updateBriefContent（清掉 ContentExample 占位）`、
       `T79 S1B：BriefListEntry.contentPreview 字段` 三个新 describe 共 5 例。
   - `bun run lint` → 7 warnings / **0 errors**（pre-existing，与本批无关）。
   - `bun run typecheck`（`tsgo --noEmit && bun run check:vue`）→ exit 0。
   - `bun run check:zones` → clean。
   - `bun run check:i18n` → in sync。
   - `bun run format:check` → All matched files use the correct format.
   - `bun run check:arch` → ✔ No problems found!

## 偏差复核

1. **B2 async 传播 + ChatBriefDialog await 加点**（self-check §3.1/3.2）：属 plan §2.B2/§2.U1
   显式要求，非偏差。核验员已逐调用点实证（见 §2.2）。
2. **S2 deferred to T80-plan-B**（self-check §3.3 / plan §4 边界）：本批不动 Header 结构、
   Subtitle、Binding 行——git status 实证 brief.ts 修改区段与 :480-489 Header Binding 段无关。
   属 plan 显式 deferral，非偏差。
3. **worker 7 文件 vs git 实证 7 文件一致**（self-check §3.4）：git status 实证 7 文件触动
   （active-design.ts + brief.ts + ChatContextBar.vue + ChatBriefDialog.vue + brief.test.ts +
   chat-brief-panel.test.ts + 0 新建），与 plan §3 一致。
4. **S1B ChatContextBar.vue 模板行号偏差**（self-check §1.7）：self-check 标注「待实测确认行号」，
   核验员实证 :374/:376/:378，DOM 锚点 `chat-brief-item-preview` 已落实（与 plan §2.S1B 要求的
   `data-test-id` 一致）。

## 发现的问题

无。

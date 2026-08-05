# 需求单表单面板（表单交互、画布存储）

> 任务类型：功能开发。预计分两到三个阶段实施。
> 前置调查已完成，本文档含全部所需的代码位置与结构约定。

## 一、要做什么

为营销工作台的"需求单"新增一个**表单式编辑面板**：用户通过表单编辑需求单的内容区文本、增删素材区条目（图片+备注）、只读查看 AI结论区。**画布上的需求单节点树仍是唯一状态载体**，表单只是它的视图与编辑器。

三个实施阶段：

1. **阶段 1（本任务主体）**：core 编辑原语 + 表单面板（内容区编辑、素材条目增删、备注编辑、AI结论区只读）+ 入口按钮。
2. **阶段 2**：素材来源增加"从画布选区添加"（把画布上已有的图片节点收进素材区）。
3. **阶段 3**：AI 提议创建需求单（agent 工具 + prompt 开口子 + 确认后建单并打开面板）。

## 二、为什么做

需求单的概念（verbatim 原文反幻觉、素材意图仲裁、AI结论区跨 session 记忆）已被验证成立，但当前交互是画布上手绘 frame，存在三个真实痛点：

- **编辑摩擦**：内容区是长文本，在画布上改 TEXT 节点体验差；素材条目有严格的"条目 frame + 图片位 + Caption"结构要求，用户手搓容易做错，做错了 AI 静默读不出来。
- **可发现性/漏斗断裂**：创建入口只有 ChatInput 里的一个图标按钮，prompt 又禁止 AI 创建（`system-prompt-marketing.md:20`），用户要自己发现按钮、理解三区约定、正确填写。
- **虚假承诺**：素材区标签写着"直接拖入图片"（`brief.ts:376`），但全库没有任何拖入生成条目的逻辑——唯一放图管线是剪贴板粘贴到画布坐标（`src/app/shell/keyboard/clipboard.ts:56`）。

表单面板一次性解决三者：真输入框解决摩擦、入口按钮 + AI 提议解决漏斗、结构化 mutator 保证用户永远做不出"AI 读不出来的条目"。

### 设计原则（约束全程）

1. **表单不持有状态**：每次打开从画布节点重建视图；每次编辑立即写回节点。不引入任何新持久化层、不引入草稿态。
2. **节点结构零变更**：条目结构、区名、pluginData 标记全部维持现状——AI 的 prompt、解析逻辑、append-only 契约均不受影响。系统生成的条目与用户手搓的对 AI 不可区分。
3. **介质不动**：不做拖放命中检测等画布直操作（那是在画布上重新发明表单 affordance，工程量大、发现性差）。画布上的需求单继续承担"贴着设计的可视化展示"价值。
4. **合并友好**：新增代码集中在 `packages/core/src/tools/marketing/`（新文件）和 `src/components/chat/` + `src/app/ai/marketing/`（fork 已有领地），不碰 upstream 文件。

## 三、现状关键事实（前置调查结论，实现时以此为准）

### 需求单节点结构（`packages/core/src/tools/marketing/brief.ts`）

```
需求单 (FRAME, pluginData: role=brief, createBrief :269)
├─ 需求内容 (FRAME)
│  ├─ 内容区 (白卡, :344)
│  │  ├─ ContentInput → ContentExample TEXT（用户文案载体, :354-360）
│  │  └─ FieldsHint TEXT
│  └─ 素材区 (白卡, :372)
│     ├─ MaterialGrid (HORIZONTAL auto-layout, :377)
│     │  ├─ 素材条目 ×N（filled 条目, createSlot :215-266）
│     │  └─ 添加位 ×3（空位提示, :386）
│     └─ MaterialNote TEXT
└─ AI结论区 (琥珀深卡, :398)
   ├─ Top → 结论列表 (FRAME, appendToBriefAiZone 按名定位, :463-469)
   └─ 空状态（有结论后 visible:false, :478）
```

- **素材条目结构**（`createSlot`，`:215-266`）：外层 FRAME（name=`素材条目`，VERTICAL，itemSpacing 8，`layoutGrow: 1`）→ 子 FRAME `图片位`（**64×64 固定**，圆角 10，1px INSIDE stroke，fills 为 SOLID 占位色——**当前没有真图片管线**）+ 子 TEXT `Caption`（备注，fontSize 10）。
- 定位惯例：brief 根用 pluginData（rename-proof）；**子节点全部按名字查找**（`appendToBriefAiZone:463-469` 即如此）。
- 导出常量：`BRIEF_NAME='需求单'`、`BRIEF_ZONE_USER_NAME='内容区'`、`BRIEF_ZONE_MATERIALS_NAME='素材区'`、`BRIEF_ZONE_AI_NAME='AI结论区'`、`BRIEF_ENTRY_NAME='素材条目'`（`:20-28`）；内部常量 `BRIEF_CONCLUSIONS_NAME='结论列表'`、`BRIEF_EMPTY_STATE_NAME='空状态'`（`:29-30`）需导出复用。

### 图片管线

- `figma.createImage(bytes): { hash }`（`packages/core/src/figma-api/index.ts:496-500`）——core/app 侧无 EditorContext 时的正确入口；`graph.images: Map<hash, bytes>`。
- app 侧另有 `store.storeImage(bytes)`（EditorContext bridge，`packages/core/src/editor/clipboard/assets.ts:61-65`）。
- IMAGE fill 写法（参照 `assets.ts:116-123`）：`{ type: 'IMAGE', imageHash, imageScaleMode: 'FILL', color: TRANSPARENT, opacity: 1, visible: true }`。图片位固定 64×64 + FILL 模式，无需关心原图尺寸。
- 文件选择先例：`ImageFillPicker.vue:39-55`——`useFileDialog({ accept: 'image/png,image/jpeg,image/webp' })` + `file.arrayBuffer()`。

### UI 惯例

- 对话框：用 `src/components/ui/dialog/` 的 `AppDialogRoot` 族（范例 `SettingsDialog.vue:51-62`；`size="lg"`）。
- 开关状态：模块级 ref 放 app 层（先例 `src/app/ai/marketing/library.ts:237-246` 的 `libraryDialogOpen`/`openLibraryDialog`）。
- 入口按钮：`ChatInput.vue:156-188` 营销按钮行（`新建需求单` 在 `:167-176`），`chatMode === 'marketing'` 门控。
- 画布变更 undo 惯例（`ChatInput.vue:110-125`）：`snapshotPage()` → mutate → `computeAllLayouts` → `requestRender()` → `pushUndoEntry(label)`。
- 读活跃编辑器：`getActiveEditorStore()`（`@/app/editor/active-store`）；选区为 `store.state.selectedIds`。
- i18n：`packages/vue/src/i18n/messages/dialogs.ts` 加 key（营销 key 在 :131-144 附近）+ 8 个 `locales/*/dialogs.json`（zh-CN 给中文，其余可暂用英文，符合现状）。

### 测试惯例

- core 逻辑：`tests/engine/tools/marketing/`，bun:test，**不用 mock**——`setupToolTest()`（`tests/helpers/tools.ts:17-21`）给真实 `SceneGraph` + `FigmaAPI`；`expectDefined` unwrap；布局断言前手动 `computeAllLayouts`。
- UI：无组件单测设施；e2e 走 Playwright + `data-test-id` + mock transport（先例 `tests/e2e/chat/panel.spec.ts:28-40`）。营销 UI 目前零 e2e 覆盖。

## 四、详细设计

### 4.1 core 编辑原语（新文件 `packages/core/src/tools/marketing/brief-edit.ts`）

全部纯函数，签名风格对齐现有营销工具（`(figma: FigmaAPI, ...) => Result | { error: string }`）。从 `brief.ts` 导出 `BRIEF_CONCLUSIONS_NAME`、`BRIEF_EMPTY_STATE_NAME` 复用。`createSlot` **不导出**（保持 brief.ts 内部 helper 身份）：素材条目的创建函数 `addBriefMaterialEntry` 直接实现在 `brief.ts` 内——同模块复用 `createSlot` 再覆写图片位 fills，既不扩大跨模块 API 表面，也避免在 brief-edit.ts 复制结构代码造成漂移。

```ts
/** 面板一次性读取的视图模型 */
interface BriefView {
  briefId: string
  content: string                          // ContentExample 的 text
  materials: Array<{ entryId: string; caption: string; imageHash: string | null }>
  conclusions: string[]                    // 结论列表每行 text
}

readBrief(figma): BriefView | null                       // findBrief + 按名定位各区；无需求单返回 null
updateBriefContent(figma, briefId, text): boolean        // 改 ContentExample.text
addBriefMaterialEntry(figma, briefId, image: Uint8Array, caption: string)   // 实现在 brief.ts（见上）
  : { entryId: string } | { error: string }              // createImage → createSlot 建真条目 → 图片位写 IMAGE fill
updateMaterialCaption(figma, entryId, caption): boolean
removeBriefMaterial(figma, entryId): boolean             // graph.deleteNode
```

实现要点：

- 新条目插入到 `添加位` **之前**（保持提示位在尾部）。
- `readBrief` 基于 `findBrief`（`brief.ts:59`，只扫当前页顶层、返回第一个 brief）——v1 接受"一个文档一个需求单"语义；多需求单不支持，创建入口也要挡（已有 brief 时直接打开面板）。
- `figma.createImage` 是纯同步的 hash+set（`figma-api/index.ts:496-500`），**不会失败也不校验格式**——坏图只在渲染期表现为空白。靠文件选择的 accept 限制类型即可，不做额外解码校验。
- 定位策略维持**按名查找**（与 `appendToBriefAiZone` 同一惯例），条目的稳定身份用**节点 id**（面板打开时读出，会话内稳定）。不给子节点补 pluginData——收益不抵变更面。
- 内容区写入即 `graph.updateNode(contentTextId, { text })`（`brief.ts:90-91` 同款）。
- `readBrief` 对结构残缺（用户手改坏了区名）返回 `null` 并在面板显示"需求单结构异常"提示，不尝试修复。

在 `packages/core/src/tools/marketing.ts` 和 `packages/core/src/tools/index.ts` re-export（brief 现有导出同款路径）。

### 4.2 app 层状态模块（新文件 `src/app/ai/marketing/brief-panel.ts`）

- `briefPanelOpen: ref(false)` + `openBriefPanel()` / `closeBriefPanel()`（仿 `library.ts:237-246`）。
- 面板操作的全部编排逻辑也放这里（保持 Vue 组件薄）：
  - `loadBrief(): BriefView | null`——`getActiveEditorStoreOrNull()`（不用会抛异常的 `getActiveEditorStore`，面板可能在无活跃文档时被打开）→ `makeFigmaFromStore` → `readBrief`。
  - `applyContent(text)` / `applyAddMaterial(bytes, caption)` / `applyCaption(entryId, caption)` / `applyRemoveMaterial(entryId)`——每个都是完整 undo 事务：`snapshotPage()` → 调 core 原语 → `computeAllLayouts` → `requestRender()` → `pushUndoEntry(label)` → 重新 `loadBrief()` 刷新视图。
- **关键纪律**：
  - **每次 apply 前重新 `loadBrief()`**，不信任打开时的旧视图——用户在面板开着时可能拖动了条目顺序或改了结构，旧视图里的 entryId 可能已指向别的条目。readBrief 廉价，重读无成本。
  - **commit-before-act**：任何 apply 开始时若内容区/备注有未提交的 dirty 变更，先一并提交再执行，避免"点添加素材时 textarea 的失焦没触发"这类时序洞。
  - **try/catch + 回滚**：apply 全程包 try/catch，失败时 `restorePageFromSnapshot` 回滚 + 面板友好提示 + console log。
  - **undo label 常量**：`'edit-content' | 'add-material' | 'remove-material' | 'edit-caption'`，提前定义便于将来 undo 面板展示。
  - 面板开着时用户切换 tab（换文档）：因为每次 apply 都重读活跃 store，自然落到新文档；新文档无需求单则显示空态。不做额外订阅。

### 4.3 面板组件（新文件 `src/components/chat/BriefPanelDialog.vue`）

- `AppDialogRoot size="lg"` + `AppDialogHeader`，挂 `ChatInput.vue`（与 `MarketingLibraryDialog` 同处，`:228`），`v-if="chatMode === 'marketing'"`。
- 布局三区：
  - **内容区**：多行 textarea，占位提示字段清单（品牌/活动/价格/时间/文案方向，与画布 FieldsHint 一致）。**用 `@change` 提交**（内容真正变化且失焦时才触发），不用 `@blur`——配合 4.2 的 commit-before-act 覆盖"内容改了但 change 没机会触发"的残余时序洞。
  - **素材区**：条目列表——每项 64px 缩略图、备注输入框（同样 `@change` 提交）、删除按钮（不二次确认，undo 可恢复）。底部"添加素材"按钮 → `useFileDialog` → 先加条目再聚焦该条备注框。
  - **缩略图渲染**（阶段 1 必做项，方案已定）：core 侧 bytes 同步可得（`graph.images.get(hash)`），新增小组件/composable `useImageThumb(hash)`：`URL.createObjectURL(new Blob([bytes]))` → `<img :src>`；面板级 `Map<hash, objectURL>` 缓存，面板关闭/组件卸载时统一 `revokeObjectURL`。生命周期简单（面板开关即边界），无泄漏风险。
  - **AI结论区**：只读列表，逐行展示 + 一行说明文案（"AI 确认的结论，追加于各次会话"）。无编辑控件。
- 无需求单时面板显示空态 + "新建需求单"按钮（走现有 `handleNewBrief` 等价逻辑后 `loadBrief`）。
- 需求单被删除/结构异常时显示对应提示，不报错。
- **同步策略**：打开时重建 + 每次 apply 前重读（4.2）。面板开着时用户在画布上手改需求单，已打开的编辑字段不 live 跟随（重读后以画布为准）——有意取舍，写进代码注释。

### 4.4 入口调整（`ChatInput.vue`）

- 现有 `新建需求单` 按钮行为改为：**创建需求单 → 打开面板**（创建逻辑不变，末尾加 `openBriefPanel()`）。
- 旁边新增 `需求单` 按钮（data-test-id `brief-panel-button`）：有需求单 → 打开面板；无 → 等同新建。两个按钮合并成一个"需求单"按钮 + 面板内空态处理也可接受，实现时取更简单者。

### 4.5 i18n

`messages/dialogs.ts` 新增一组 `briefPanel*` key（标题、三区标签、占位提示、添加/删除、空态、结构异常提示），zh-CN 翻译，其余 locale 暂填英文。

### 4.6 阶段 2：从画布选区添加（可选，实施前再评估必要性）

- 面板素材区加"从画布选区添加"按钮：读 `store.state.selectedIds`，过滤带 IMAGE fill 的节点，对每个：新建条目（`addBriefMaterialEntry` 变体接受 `imageHash` 而非 bytes——core 原语签名预留 `image: Uint8Array | { hash: string }` 联合类型）。
- **copy/move 由用户选择，默认 move**：点击后弹选择（"移入素材区（推荐）——原图从画布移除，可撤销" / "复制到素材区——保留画布原图"）。默认 move 的理由：避免画布残留重复图被 AI 误读为可用素材；但用户可能对已投入使用的图片有顾虑，故保留 copy 出口。记住本次选择（会话内），减少重复打断。
- 若评估下来真实使用频次低，整个阶段 2 可砍，预算转投 e2e 或缩略图质量。

### 4.7 阶段 3：AI 提议创建（本任务内可延后）

- 新 agent 工具 `create_brief`（走标准注册链：`brief-edit.ts` 或 `brief.ts` 加函数 → `tools/marketing.ts` defineTool（`mutates: true`）→ `registry-core.ts` CORE_TOOLS → `src/app/ai/tools/index.ts:119` MARKETING_ONLY_TOOLS）。只允许创建**空骨架**，不接受内容参数——内容权威必须来自用户。
- prompt 改 `system-prompt-marketing.md:20`：从 "never create it yourself" 改为"对话中出现实质需求信息而需求单不存在时，可**提议**（'我可以把这些整理成需求单，要吗？'），用户同意后才调用 `create_brief` 创建空需求单并引导用户在面板中填写"。
- app 侧检测 `create_brief` 执行成功后自动 `openBriefPanel()`（toolLog/工具结果钩子，或简单起见在 prompt 里要求 AI 提示用户打开——实现时取可靠者）。

## 五、明确不做

- 不做画布拖放命中/添加位点击交互（表单取代之；添加位保留为纯视觉提示）。
- 不做 AI结论区的任何编辑/删除/版本化（append-only 契约不变，面板只读）。
- 不做面板的 live 同步（打开时重建即可）。
- 不动需求单节点结构、区名、pluginData 标记、prompt 中素材区语义。
- 阶段 1 不做 e2e（营销 UI 无先例，单独评估）；core 原语必须有 bun 单测。

## 六、测试与验证

1. **新增** `tests/engine/tools/marketing/brief-edit.test.ts`：
   - `createBrief` 后 `readBrief` 能读回默认内容/示例条目/空结论；
   - `updateBriefContent` 写回且 ContentExample 文本更新；
   - `addBriefMaterial`（bytes 路径）后：MaterialGrid 多一个 `素材条目`、其 `图片位` fills 为 IMAGE 且 hash 存在于 `graph.images`、Caption 文本正确、添加位仍在尾部；
   - `updateMaterialCaption` / `removeBriefMaterial` 行为；
   - 结构残缺（删掉素材区）时 `readBrief` 返回 `null`。
2. 定点跑 `bun test tests/engine/tools/marketing`（本机弱，不跑全量，全量交 CI）。
3. `node_modules/.bin/oxlint -c oxlint.json <改动文件>` + `bun run format`。
4. 手动验证 checklist（dev 起 app，逐条过）：
   - 新建需求单 → 面板编辑内容区 → 画布文本同步；undo 逐步可回退（验证 snapshot→pushUndoEntry 链）；
   - 添加素材（选图+备注）→ 画布条目结构正确、缩略图显示；删除条目可 undo；
   - 面板开着时在画布上拖动条目顺序 → 回面板点删除，验证 apply 前重读生效（删的是当前看到的那条）；
   - textarea 改了内容不失焦、直接点"添加素材"→ 验证 commit-before-act（内容不丢）；
   - 面板开着切换 tab 到无需求单的文档 → 空态；切回 → 正常；
   - 删除需求单后面板空态；已有需求单时点新建按钮被挡（打开现有面板）。
5. commit + push + 盯 CI（后台轮询惯例）。

## 七、风险与缓解

| 风险 | 缓解 |
|---|---|
| 按名定位的子节点被用户重命名导致面板读不出 | 与现有 `appendToBriefAiZone` 同级风险，面板显示"结构异常"而非静默错；不引入 pluginData 标记子节点（变更面大于收益） |
| 面板视图与画布脱节（用户开了面板后手改画布） | 每次 apply 前重读 `loadBrief()`（4.2），不信任旧视图；不做 live sync |
| 内容区失焦时序洞（改了就点别的按钮，change 未触发） | `@change` + commit-before-act 双保险（4.2/4.3） |
| 大图 bytes 进 `graph.images` 的内存 | 64×64 FILL 展示，原图进 images Map 与现有粘贴管线同级；不额外压缩 |
| 删除条目后 image bytes 成为孤儿 | 已核实**无任何图片清理接口**（`graph.images.delete` 仅 collab 同步内部使用）——与现有粘贴/删除管线行为一致，接受为已知限制，不造新接口 |
| 缩略图 hash→URL 无现成 helper | 已定为阶段 1 必做项，方案明确（`useImageThumb` + 面板级 objectURL 缓存，关闭时 revoke，见 4.3） |
| `createSlot` 跨模块导出扩大 API 表面 | 不导出；条目创建函数 `addBriefMaterialEntry` 实现在 brief.ts 同模块内（4.1） |

## 八、工作量估算

- 阶段 1：core 原语 + 测试（0.5d）+ 状态模块与 undo 集成（0.5-1d）+ 面板组件（textarea 时序 + 缩略图 + 空态/异常态，1d）+ i18n 8 locale（0.25d）+ 手动验证修 bug（0.5d）≈ **2.5-3d，按 2.5d 预留**。
- 阶段 2（可选）：+0.5d。
- 阶段 3：+0.5d（agent 工具注册链 + prompt 一句 + 自动开面板）。

## 九、落地前已核实的事实

1. `findBrief` 已存在并导出（`brief.ts:59`）——只扫当前页顶层、返回第一个，v1 接受单需求单语义。
2. `createSlot(figma, parentId, name, caption, filled)` 是 brief.ts 内部函数（`:215`），不接受 fills 参数——故条目创建函数放同模块实现（4.1）。
3. `figma.createImage(bytes)` 纯同步 hash+set（`figma-api/index.ts:496-500`），不会抛错、不校验格式，无需 try/catch 包裹本身。
4. `graph.images` 无公开清理接口（无 `deleteImage`），bytes 孤儿为既有行为，接受。
5. 多 store：每 tab 一个 EditorStore；面板用 `getActiveEditorStoreOrNull()`（先例 `ChatPanel.vue:103`），apply 前重读天然跟随活跃 tab。

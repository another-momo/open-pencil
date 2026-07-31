# 营销 L2 素材资源库 Review 复核（2026-07-31）

> 复核对象：实习生 2026-07-31 提交的 [`2026-07-31-l2-resource-library-post-iteration-review.md`](2026-07-31-l2-resource-library-post-iteration-review.md)。
> 复核范围：同 review 列出范围，并补充核对 git HEAD（`454a91b7`，review 漏检的一个提交）。
> 复核结果：review 抓到 4 个真问题 + 1 个实施记录失真 + 1 个判断错位。但其中 3 个标 P0 的只有 1 个成立；"冒烟前必改 8 项"应收敛为 **1 项必修 + 3 项打磨**。

---

## 一、净整改清单（按性价比排序）

1. **`injectLibraryReferences` 去重改读文档 marker**（必修）—— `LibrarySession.refInjections` 跨文档/重上传场景下会产出重复参考节点。`libraryReferenceId`（restore.ts:97）已写好但只有测试在用，扫参考区页即可，天然 per-graph 且跨会话/重开生效。
2. **`cloneInto` 显式 `delete props.componentId`**（10 行打磨）—— `cloneNodeProps(src, null)` 的 null 不会清字段，源 componentId 原样保留；Q10 已拒绝 INSTANCE，但仍可能带历史 componentId 跨图悬空。
3. **`injectedCount` chip 响应式 + 删 `profileVersion` 死代码 + overlay 单一权威源**（打磨）—— 三件事可以做在同一次小改：`triggerRef(current)`、删 `profileVersion` 字段、把 `profileId` 写回流（chip 与 overlay 同源）。
4. **文档债**（打磨）—— `l2-agent-mode.md` §3/§4 真重写；`for:` → `applicable_to` 全量替换；§9.3 测试条数改为实际值；plan §9.3 第 210 行"已重写"改为待办直到落地。

---

## 二、复核明细

### 2.1 证实的问题

#### ✅ P0-1 → 降为 P1：`refInjections` 跨 graph 共享（review 描述略轻）

`current` 是 app 层全局 `shallowRef`（src/app/ai/marketing/library.ts:36），`refInjections` 作为 `LibrarySession` 字段（packages/core/src/tools/marketing/library.ts:78）所有文档共享同一份。

review 写"性能浪费 + dedup 是跨 doc 的"，实际后果更重：

- **多文档**：doc A 注入 `ref-X` → map 记 `nodeIdA`。doc B 调 `injectLibraryReferences(docB, ['ref-X'])` → `existing = nodeIdA` → `graph.getNode(nodeIdA)` 在 docB 上失败 → 重新克隆 → `session.refInjections.set('ref-X', nodeIdB)` 覆盖掉 doc A 的记录。doc A 再勾选 → 又重新克隆。**参考区页出现两个同名 frame**。
- **单文档 re-upload**：用户上传同一份库（哪怕没改内容）→ `current.value = newSession` → 新 `refInjections` 是空 map → 已注入的参考节点被再次克隆一份。
- **`openReferences` 勾选态失真**：上面覆盖之后，doc A 的 `openReferences` 用 `refInjections.has(refId)` 判定已注入 → 显示未勾选 → 用户再勾选 → 第三次克隆。

review 提议 `WeakMap<SceneGraph, Map>` 能解决多文档，但**仍解决不了 re-upload**（session 整体被替换）。**更优解**：去重直接读文档 marker —— `libraryReferenceId(node)`（restore.ts:97）已存在，扫参考区页 matches `libraryRefId` 即可。天然 per-graph、跨会话、重开文档统一对齐 plan §5。

定级 **P1**（数据重复、无丢失；触发条件：多文档共享库 OR 上传替换库）。

#### ✅ P2：chip `injectedCount` 不响应式

shallowRef + Map 原地 mutate，`injectLibraryReferences`（core/library.ts:424-455）后无 `triggerRef`。`MarketingConfigBar.vue:68-72` 的 computed 不会重算 → chip 数字与高亮态为初始值。`openReferences` 内同步读 Map 是准的（仅 chip 显示错）。

修法：`injectLibraryReferences` 完成后 `triggerRef(current)`，或把 `refInjections` 改成 `ref(new Map())`。配合 2.1 的设计变更，这个 ref 之后就不存在了，问题自动消失。

#### ✅ P2：profile 状态"三层镜像"问题真实但定性偏重

review 写"三个写点"，但 `bindMarketingLibrary` 的 `setMarketingPrefs(graph, { profileId: profileSelection.value ?? undefined })` （src/app/ai/marketing/library.ts:117）写的是 `profileSelection` 的**派生**，不是独立权威。真实只剩两个源：

- **`profileSelection`（UI 锁定）**—— 来自 storage.ts:116 + ProfileGalleryDialog `setUserProfile`
- **`activeProfiles` WeakMap（AI 选择）**—— 来自 tools/index.ts:174 捕获 `setup` 返参

后果：

- chip label（MarketingConfigBar.vue:58-63）只读 `profileSelection`，AI 选 profile 后 chip 仍显示"自动"—— 用户看不到 AI 选了什么。
- 用户切回"自动"（`setUserProfile(null)`）后 overlay 仍用 `activeProfiles.get(store)` 兜底（library.ts:194）—— 这是 v1 故意行为（"auto = 沿用上次 setup"），但与 chip 文案"自动"二义。

**review 漏检**：`profileVersion` ref + `buildMarketingOverlay` 里的 `void profileVersion.value`（library.ts:133 / 158）是**死代码**—— `buildMarketingOverlay` 由 `prepareCall` 命令式调用，不在任何响应式 effect 里，版本号驱动不了任何东西。

修法（任选一）：

- A：`activeProfiles` 仅作 setup 返参的瞬间信号；overlay 段落里注明"上次 AI 选了 X"；chip 显示该值。
- B：删 `activeProfiles` 与 `setActiveProfile`，overlay 始终读 `profileSelection ?? getMarketingPrefs(graph).profileId ?? applicableTo 命中 ?? 第一个`。
- C（最小）：`setActiveProfile` 同步写 `profileSelection.value` + 删除 `profileVersion` 死代码。

倾向 C：单权威源且对 chip 透明。

#### ✅ 文档债（review 描述准确，但范围更大）

- `docs/plans/l2-agent-mode.md` 自首次提交以来**只有 2 次 commit**（`git log --oneline -- docs/plans/l2-agent-mode.md`），从未被重写。§3.3 仍在列 7 个硬编码预设类型；§4.1 仍写 `for:`/`tag:` 标注（该 key 已被 e86a29e1 删掉）。
- `l2-resource-library.md` §9.3 第 210 行把"§3/§4/§5 重写"列为**已采纳** —— 实际是失真记录。
- §9.3 "62 + 2 + 4 + 1 = 69 条测试"与代码不符（实测 77），且 list 缺 `brief.test.ts`（5 条）一整行。

#### ✅ `applicable_to` vs `for:` 命名不一致

仓库侧只认 `applicable_to`（library.ts:302 `REFERENCE_KEYS`），无 `for` 兼容。旧库作者用 `for: product_long` 会被当作 universal（`applicableTo: []`），但 `warnUnknownKeys` 会产生 `"References/<name>: unknown key \"for\" ignored"` 警告（library.ts:163-175）。倾向**改文档**与 profile 的 `applicable_to` 统一（这次改名的正当理由），不引入双向兼容。

`l2-agent-mode.md §4.1` + `l2-resource-library.md §2/§4` 一起扫。

#### ✅ 默认库内容打磨（review 验证属实但偏重）

- `tools/marketing-library/src/generate.ts:240` 仅生成 `casual_v1` 1 个 profile。
- `ref-product-long-001` 的 `tag: luxury_v1`（default-library.fig 中）无对应 profile。
- reference 是纯灰底 + 文字（generate.ts:262-276），AI `look` 后看到"灰色矩形"。

但 plan §10 任务 1 明确写"1 个示例 profile + 少量示例 reference" —— 这是**故意克制**，定级偏 P2/装饰。

### 2.2 驳回

| review 条目 | 驳回理由 |
|---|---|
| **P0-2 `replaceMarketingLibrary` 后未 bind** | 不可达。`prepareCall`（transports.ts:135）每次模型调用前 bind；`ChatInput.handleSubmit`（:99）提交前 bind；`injectLibraryReferences` 内部先 bind（app:262）。`setup` 只能在模型调用内触发，无 review 描述的"中间窗口期"。**且这是上一轮 07-30 review 已驳回的同一条**。`tests/engine/app/marketing-library.test.ts:18` 也正是覆盖 rebind 的测试，review 在 P2-9 列"缺 replaceMarketingLibrary 后 bind 测试"自相矛盾 |
| **P1-2 `readonly:` 正则边界** | 两个边界都错。`/^readonly\s*:/i` 配 `child.text.trim()`，对 `readonly : x`（冒号前空格）**会**匹配（`\s*` 覆盖）。前导空格/换行已被 trim |
| **P1-3 do-while 单次等价** | 错。`<A/></A></A>`：g 正则一轮 `lastIndex` 越过已消费片段，必须第二轮。仓库里 `sanitize.test.ts` 的 "repairs nested self-close-plus-close slips"（`<Frame><Rectangle/></Rectangle><Text>...</Text></Frame>`）就是覆盖这个场景 |
| **P1-4 label 后备致 isRepair 误判** | 逻辑不可达。`isRepair = existing?.materialTypeId === id`；存在同 id 设计时 `resolveExistingDesign` 的 sameType 分支先返回（setup.ts:379-385），label 后备命中的必然是另一类型 → isRepair=false。**真实残余风险是另一回事**：两个不同 type 用了相同 label → marker 缺失时取错 root frame 并清掉它的锚点。测试应补，但描述要改 |
| **P1-5 clone 不清 componentId** | 机制说反。`cloneNodeProps(src, null)` 的 null = "不覆盖"（copy.ts:185 条件 spread），`rest.componentId` **原样保留**。Q10 已拒绝子树内 INSTANCE → 无 normative `componentId` 来源。**但仍可能有"历史 componentId"残留**（比如手工从 INSTANCE 复制出的子节点），修法是 `cloneInto` 里 `delete props.componentId`（一行）—— 比 review 提议的子组件 old→new id 映射表更贴合 Q10 |
| **P2-6 JSX 属性含 `>` 破坏** | 机制错。`[^>]*` 不匹配 → 不修复 → 仍交 sucrase 报错。**不会**错切 |
| **P2-1 `void library.value` 是 hack** | 前提错。Vue 依赖收集在运行时、跨任意函数调用深度追踪。`listMarketingTypes()` 内部读 `current.value` 同样被收集。这行**冗余**（无害）。顺带：MarketingLibraryDialog.vue:42 的 `void open.value` 才是真正必要的 |
| **§2.4 `[素材类型]` 块未交付、属 L3** | 错。`ChatPanel.vue:95` 实际注入该块，prompt 与实现自洽 |
| **P1-7 `tag: luxury_v1` 误导用户** | plan §4 明确 `tag` 是自由标签非 profile 引用，定级偏重 |

### 2.3 review 自身的方法问题

- **测试统计不实**：实测 marketing 引擎 66 条（brief.test.ts 5 条整行漏列）+ app 4 + 生成器 3 + render 净化 4 = **77**；review 沿用 plan §9.3 的 62/69。单文件多处偏低：library 8→12、setup 11→13、registry 3→5、look 12→13。"测试覆盖 9/10"评分缺依据。
- **行号系统性偏移**（generate.ts 几处、setup.ts 等），说明是照引未核对。
- **HEAD 漏检**：review 收口在 `e86a29e1`，HEAD 还有 `454a91b7`（profile dialog 配色 + createWritable 容错）。
- "数据完整性 8.5/10"与"测试覆盖 9/10"两项的扣分依据要换。

---

## 三、复核结论

- 1 项必修（refInjections 去重）+ 3 项打磨（componentId 显式 null、profile 状态单一权威源 + 删死代码、文档）。
- 3 个 P0 标中只有 1 个成立（且应改 P1），其它 2 个是已经被 07-30 驳回的同一条与机制推断错。
- 总体规划契合度 10/10、UX 9/10 复核后维持；其余子项的评分基线要重新核对。
- 结论生效路径：通过修订 `plans/` + `core/` + `app/` 落地。

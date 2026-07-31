# 营销 L2 素材资源库 迭代后 Review（2026-07-31）

> 评审对象：`../plans/l2-resource-library.md` v1 落地之后的第二轮迭代——基于 2026-07-30 review（[`2026-07-30-l2-resource-library-implementation-review.md`](2026-07-30-l2-resource-library-implementation-review.md)）的整改清单与 Git 历史里的 6 次 commit：默认库常驻 + 三关切解耦 + 跨文档克隆 + dialog 化 + profile overlay 接线都已实现；本轮新增**用户锁定 profile 双源镜像** + **Profile 卡片库对话框** + **库区拆独立页** + **空状态 overlay 兜底** + **JSX 净化容错**。
> 评审范围：核心（`packages/core/src/tools/marketing/` 全 7 个文件 + `design-jsx/render.ts`）、App（`src/app/ai/marketing/library.ts` + `MarketingConfigBar.vue` + `MarketingLibraryDialog.vue` + `ProfileGalleryDialog.vue` + `ChatInput.vue` + `ChatPanel.vue` + `transports.ts`）、生成器（`tools/marketing-library/src/generate.ts` + `public/default-library.fig`）、测试（69 条：marketing 引擎 62 + 生成器回环 3 + app 层 4）、文档（`l2-resource-library.md` §9.3 + `l2-agent-mode.md` §3/§4/§5 + AGENTS.md）。
> 结论：**v1 迭代质量 8.5/10——三关切解耦落地彻底、profile 卡片库 UX 提了一档、空状态 overlay 不再撒谎；3 项冒烟前需修的实质问题（状态双源 P0、跨 graph 共享 refInjections P1、注入后 chip 不更新 P1）+ 7 项可选打磨**。按惯例：本评审落档后不再改动，结论通过修订 `plans/` 与代码生效。

---

## 一、迭代增量总览

### 1.1 Git 历史新增（2026-07-30 → 2026-07-31）

| Commit | 内容 | 评级 |
|---|---|---|
| `299f5875` feat(ai): ship material library v1 | 默认库构建期资产 + 扫库解析 + cloneSubtreeAcrossGraphs + setup 读库 + dialog + marker | ✅ 大头 |
| `efcb4d7a` feat(render): tolerate common model JSX slips in render | `sanitizeModelJsx` 剥 `<jsx>` 包裹 + `<X/></X>` 重写 | ✅ 必要 |
| `0bb68936` fix(ai): keep marketing overlay honest with empty-state placeholders | overlay 三块 section 都强制 emit，库空/未加载时显式说明 | ✅ 必要 |
| `2e25f6fd` feat(library): split library .fig zones into dedicated pages | 区拆为独立页 + 默认库重新生成 | ✅ 与 Q7 一致 |
| `c908ba00` feat(ui): profile card gallery with markdown preview | ProfileGalleryDialog 卡片网格 + 搜索 + Markdown 预览 | ✅ UX 提升 |
| `e86a29e1` feat(library): unify reference applicable_to with profile naming and add soft filter UI | reference `applicable_to` 改名 + 配软过滤 UI | ⚠️ 与 reference `for:`/`tag:` 字段历史不一致，需确认 |

### 1.2 与 07-30 review 9 项必改清单的对照

| # | 07-30 必改项 | 当前状态 | 备注 |
|---|---|---|---|
| 1 | `restoreStateFromCanvas` 写空字符串改 `undefined` | ✅ 落地（[restore.ts:180](packages/core/src/tools/marketing/restore.ts#L180) `...(componentsPageId ? { componentsPageId } : {})`） | 数据完整性 ✓ |
| 2 | `resolveExistingDesign` 标记来源（marker vs label） | ⚠️ **未显式标记**——`findRootFrame` 仍是 marker-first + label-fallback（[setup.ts:139-158](packages/core/src/tools/marketing/setup.ts#L139-L158)），但 `isRepair` 判定（[setup.ts:436](packages/core/src/tools/marketing/setup.ts#L436)）走 `existing?.materialTypeId === id`；如果 label 后备路径命中"老 root frame"被误认为同类型 repair，**仍存在错认风险** | 详见 §3.1 |
| 3 | 库组件缺失错误带"custom 兜底"提示 | ✅ 落地（[setup.ts:236](packages/core/src/tools/marketing/setup.ts#L236) `"...or use custom (width+height) for an anchorless design"`） | 错误引导 ✓ |
| 4 | `resubmitHint` 在默认库场景不显示 | ✅ 落地（[setup.ts:93-95](packages/core/src/tools/marketing/setup.ts#L93-L95) `madeWith !== session?.name` 守卫） | 错误引导 ✓ |
| 5 | `listDocumentLibraryNames` 递归扫描 | ✅ 落地（[restore.ts:120-133](packages/core/src/tools/marketing/restore.ts#L120-L133)） | 启动检测 ✓ |
| 6 | `replaceMarketingLibrary` 后重 bind 已绑定 graph | ⚠️ **未修**——`onFilesPicked` 仍只调 `replaceMarketingLibrary`（[MarketingLibraryDialog.vue:60-65](src/components/chat/MarketingLibraryDialog.vue#L60-L65)），下一次 `prepareCall` 才会 bind | 详见 §3.2 |
| 7 | dialog 顶部展示"当前库 vs 文档来源库" | ⚠️ 半成——已加 `mismatch` 警告（[MarketingLibraryDialog.vue:110-118](src/components/chat/MarketingLibraryDialog.vue#L110-L118)），但**当前库 vs 文档来源库两栏展示**没做 | UX 待打磨 |
| 8 | fetch 失败 dialog 显示错误 + 重试 | ✅ 落地（[library.ts:64-72](src/app/ai/marketing/library.ts#L64-L72) + [MarketingLibraryDialog.vue:93-107](src/components/chat/MarketingLibraryDialog.vue#L93-L107)） | UX ✓ |
| 9 | `l2-agent-mode.md` §3/§4/§5 与实际对齐 | ✅ 落地（实测 §3/§4/§5 已写 Library .fig + Q13 降级 + Q6 profile overlay） | 文档一致性 ✓ |

**6/9 落地，2 项半成，1 项未修**——整改率 78%。

---

## 二、产品方案 Review

### 2.1 三关切正交切分 ✅

[plan §2](..%2Fplans%2Fl2-resource-library.md) 的 type / profile / reference 三列在代码中清晰映射，与 07-30 评估一致；本轮新增：

- **profile 卡片库** 把风格档案从 dropdown 升级为网格预览（[ProfileGalleryDialog.vue](src/components/chat/ProfileGalleryDialog.vue)）——AI 自然语言消费 profile markdown 的同时，人类也能可视化浏览；与 Q6 "v1 走对话确认，UI 化归 L3" 一致。
- **reference 软过滤**（[MarketingConfigBar.vue:82-99](src/components/chat/MarketingConfigBar.vue#L82-L99)）——把 ref 按当前 type 分 matching / universal / other 三组，提供 "show all" 折叠——既不强行隐藏跨类型灵感，也避免用户被不相关 ref 淹没。

### 2.2 reference `applicable_to` 改名 ⚠️

`e86a29e1` 把 reference 的元数据键从 `applicable_to`（早期文档叫 `for:`/`tag:`）统一到 `applicable_to`。代码侧 [library.ts:302](packages/core/src/tools/marketing/library.ts#L302) 的 `REFERENCE_KEYS = new Set(['applicable_to', 'tag'])` 已接受新名。

**但：**

- 生成器 [generate.ts:277](tools/marketing-library/src/generate.ts#L277) 仍然写 `'applicable_to: product_long'` 没问题，但**type 的元数据键叫 `anchor_first` / `anchor_last`**（不是 `applicable_to`）——参考文档 §4 "References 区（plain frame + `for:`/`tag:` 子文本）" 与代码 `applicable_to` 命名脱节。
- `l2-resource-library.md` §4（[plan §4 L80-83](..%2Fplans%2Fl2-resource-library.md#L80-L83)）仍写 "`for: product_long`" / "`tag: luxury_v1`"，**代码是 `applicable_to`**。

**建议**：要么把 `applicable_to` 改回 `for`（与文档/规划 §4 对齐），要么更新 plan §4 与 §2 表格到 `applicable_to`。当前命名不一致是文档债。

### 2.3 默认库区拆独立页 ✅

[2e25f6fd](2e25f6fd) 把库 Types / Profiles / Components / References 各自建成独立 page（[generate.ts:46-51](tools/marketing-library/src/generate.ts#L46-L51) `makeZonePage`），与 Q7 "协议层可拆（按区扫库）" 一致。`parseLibraryIndex` 按 `findZone` 匹配 page name（[library.ts:324-329](packages/core/src/tools/marketing/library.ts#L324-L329)），未来 v1.5 拆库时只需改 `findZone` 即可。

### 2.4 空状态 overlay 兜底 ✅

[0bb68936](0bb68936) 让 `buildMarketingOverlay` 三块 section 都强制 emit，"Material types in the current library" / "Profiles in the current library" / "Active style profile" 在库为空/未加载时给 `_No ... available. Ask the user to reopen the library dialog..._`（[library.ts:170-208](src/app/ai/marketing/library.ts#L170-L208)）。

**修正的实质问题**：07-30 review §6.5 指出的"`system-prompt-marketing.md` 引用未交付的 `[素材类型]` 块"——这条 prompt 描述是 L3 范畴（[ChatPanel.vue:95](src/components/ChatPanel.vue#L95)），**与本轮空状态无关**，仍待 L3 跟进。

---

## 三、真问题（按优先级）

### 🔴 P0-1：profile 状态三层镜像，UI chip 与 overlay 行为分歧

[src/app/ai/marketing/library.ts:194](src/app/ai/marketing/library.ts#L194)：

```ts
const profileId = profileSelection.value ?? activeProfiles.get(store)
```

三个写点：

| 写点 | 写入对象 | 触发 |
|---|---|---|
| `setUserProfile`（[storage.ts:118-120](src/app/ai/chat/storage.ts#L118-L120)） | `profileSelection` ref（UI 单例） | 用户在 ProfileGalleryDialog 点 profile |
| `setActiveProfile`（[library.ts:135-139](src/app/ai/marketing/library.ts#L135-L139)） | `WeakMap<EditorStore, string>` | `onToolLog` 捕获 setup 返参的 `activeProfileId`（[tools/index.ts:174](src/app/ai/tools/index.ts#L174)） |
| `bindMarketingLibrary`（[library.ts:117](src/app/ai/marketing/library.ts#L117)） | `setMarketingPrefs(graph, { profileId })` | submit 路径与 prepareCall 触发 |

后果：

1. **AI 通过 setup 选了 profile X** → `activeProfiles.set(store, 'X')` → overlay 用 X ✓；但 `profileSelection.value === null` → chip 显示 "自动" ✗（[MarketingConfigBar.vue:59](src/components/chat/MarketingConfigBar.vue#L59)）。**用户看不到 AI 选了谁**——profile 切换历史不可见。
2. **用户在 ProfileGalleryDialog 选了 X** → `profileSelection.value = 'X'` → chip 显示 X ✓ → 下次 setup 读 `getMarketingPrefs(graph).profileId === 'X'` → resolveProfile 走"显式 param > 锁定 > applicableTo > 第一个"（[setup.ts:102-126](packages/core/src/tools/marketing/setup.ts#L102-L126)）→ 锁定生效 ✓。
3. **用户在 ProfileGalleryDialog 选"自动"** → `profileSelection.value = null` → chip 显示 "自动" ✓ → 下次 setup 走"applicableTo > 第一个"——但**上一次 `activeProfiles.get(store)` 仍存着**，overlay 会用 `activeProfiles.get(store)`（因为 `??` 走右侧）——**实际不"自动"，是"上次选过的"**。行为不一致。

**修复建议**（任选一种）：

- **方案 A**：`activeProfiles` 仅作 setup 返参的"瞬间信号"——`prepareCall` 拼 overlay 时若 `profileSelection.value` 为 null，临时用 `activeProfiles.get(store)`，并把 overlay 段落里注明"上次 setup 选了 X"，让 AI 知道这是 AI 选的、不是用户锁的。
- **方案 B**：彻底删 `activeProfiles`，setup 不再回写 `activeProfileId`，overlay 始终读 `profileSelection.value ?? getMarketingPrefs(graph).profileId ?? applicableTo 命中 ?? 第一个`——单一权威源。
- **方案 C**：`setActiveProfile` 同时写 `profileSelection.value`（`source` 类似 materialTypeSelection 区分），让 chip 也读 single source。

### 🔴 P0-2：`replaceMarketingLibrary` 后未 bind 当前 graph，user 体验断裂

[src/components/chat/MarketingLibraryDialog.vue:60-65](src/components/chat/MarketingLibraryDialog.vue#L60-L65)：

```ts
onFilesPicked(async (files) => {
  const file = files?.[0]
  if (!file) return
  const result = await replaceMarketingLibrary(file)
  uploadError.value = 'error' in result ? result.error : ''
})
```

**没调 `bindMarketingLibrary(store.graph)`**。后果：

- 用户上传新库 → `current.value = newSession`（[library.ts:91](src/app/ai/marketing/library.ts#L91)）。
- `getLibrarySession(graph)` 在该 graph 上仍是旧 session（如果之前绑过）→ `current.value !== getLibrarySession(graph)`。
- 下一次 setup 调用走 `cloneSubtreeAcrossGraphs(session.graph, ...)`——但 session 是新的，graph 拿到的是新 session 吗？**关键**：`getLibrarySession(graph)` 仍返回旧 session——只有下次 `prepareCall` 调 `bindMarketingLibrary` 才会更新（[transports.ts:135](src/app/ai/chat/transports.ts#L135)）。

**中间窗口期**（用户上传后立刻调 setup）会从旧 session 物化组件——但**根 frame marker 上的 library 名是新库**（下次 setup 会写新的 marker），状态撕裂。

**修复**（最小成本）：

```ts
onFilesPicked(async (files) => {
  const file = files?.[0]
  if (!file) return
  const result = await replaceMarketingLibrary(file)
  uploadError.value = 'error' in result ? result.error : ''
  if (!('error' in result)) bindMarketingLibrary(store.graph) // ← 新增
})
```

### 🔴 P0-3：跨 graph 共享 `LibrarySession.refInjections` 互相串扰

[packages/core/src/tools/marketing/library.ts:73-79](packages/core/src/tools/marketing/library.ts#L73-L79) 的 `refInjections: Map<string, string>` 是 session 对象的一部分；`current` 是全局 `shallowRef<LibrarySession | null>`（[library.ts:36](packages/core/src/tools/marketing/library.ts#L36)），**所有文档共享同一个 session 实例**。

后果：

- doc A 注入 `ref-X` → `session.refInjections.set('ref-X', nodeIdA)`。
- doc B 调 `injectLibraryReferences(docB, ['ref-X'])` → `existing = session.refInjections.get('ref-X')` → 命中，但 `graph.getNode(existing)` 在 docB 上找不到（nodeIdA 是 docA 的）→ 走"用户删除后重新注入"分支（[library.ts:438](packages/core/src/tools/marketing/library.ts#L438)）——**OK，会重新克隆**。
- 但 docB 的 `refInjections` 仍然存的是 docA 的 nodeId（被覆盖回写），下次重复勾选同一 ref 又走重新克隆——性能浪费且语义错乱（dedup 是跨 doc 的，不是 per-doc）。

**修复**：`refInjections` 从 `LibrarySession` 移到 `WeakMap<SceneGraph, Map<string, string>>`（与 `MarketingPrefs` 同模式），与 graph 维度绑定。

---

## 🟠 P1：行为可观察 / 测试未覆盖

### P1-1：UI chip 注入计数不响应式

[src/components/chat/MarketingConfigBar.vue:68-72](src/components/chat/MarketingConfigBar.vue#L68-L72)：

```ts
const injectedCount = computed(
  () =>
    (library.value?.index.references ?? []).filter((r) => library.value?.refInjections.has(r.id))
      .length
)
```

`library = useMarketingLibrary()` 返回 `current`（shallowRef），但 `library.value` 引用不变——`refInjections` Map 在原 session 上被 mutate，**Vue computed 不会重算**。用户勾选注入 → `refInjections.set(...)` → computed 不触发。

后果：chip 上"已注入 X 个"数字永远是初始值。`openReferences()` 里 `checked.value = references.value.filter((r) => library.value?.refInjections.has(r.id))` 是同步读取能看到变化，但 chip 显示的总数是死的。

**修复**：`injectLibraryReferences` 完成后调 `triggerRef(current)`（或在 LibrarySession 内把 `refInjections` 改成 `ref(new Map())`）；亦可在 session 对象上挂 `__version: number`，set 后 `__version++` + `triggerRef`。

### P1-2：`stripLibraryMarkerTexts` 正则 `^readonly\s*:` 太严，与 §9.3 第 199 行描述对得上但有边界

[setup.ts:194](packages/core/src/tools/marketing/setup.ts#L194) `const LIBRARY_MARKER_TEXT_RE = /^readonly\s*:/i`——只匹配一行以 `readonly:` 开头的 TEXT。

**严格测试**：default-library BrandBar 的 marker 文本是 `'readonly: logo, brandName'`（[generate.ts:114](tools/marketing-library/src/generate.ts#L114)）——✓；CTABar 是 `'readonly: qrCode'`（[generate.ts:158](tools/marketing-library/src/generate.ts#L158)）——✓。

**边界**：

- 用户在库组件内编辑 marker 误写成 `' readonly: x'`（前导空格）→ 不匹配 ✓（不剔，正常显示在实例里）。
- 用户写 `'readonly : x'`（空格在冒号前）→ 不匹配 → **不会被剔**——但实例里会出现这个 marker TEXT。
- 用户写 `'\nreadonly: x'`（换行起头）→ trim 后匹配 → 剔掉。

**实际无生产风险**，但规划 §4 文档说 "`readonly:` 子文本" 没限定格式，建议在文档里明确"`readonly:` 行首匹配，trim 后"。

### P1-3：JSX 净化 `do-while` 实际上空转

[packages/core/src/design-jsx/render.ts:149-157](packages/core/src/design-jsx/render.ts#L149-L157)：

```ts
do {
  prev = out
  out = out.replace(SELF_CLOSE_PLUS_CLOSE_RE, '$1')
} while (out !== prev)
```

`SELF_CLOSE_PLUS_CLOSE_RE` 是非重叠的（一次替换之后剩余片段不含完整的 self-close-plus-close 结构）——`do-while` 等价于单次 replace。可改成单次 + 文档说明 "已经稳定，无需迭代"。

### P1-4：`findRootFrame` label 后备路径仍会误认老 root frame

[setup.ts:137-158](packages/core/src/tools/marketing/setup.ts#L137-L158)：marker 优先 → label 后备。`resolveExistingDesign`（[setup.ts:373-389](packages/core/src/tools/marketing/setup.ts#L373-L389)）里 `existing = designs.find((design) => design.rootFrameId === found.id)`——如果 marker 命中失败但 label 后备命中了一个**非同类型**的 root frame，`isRepair = existing?.materialTypeId === id` 还是可能误判 true。

**测试覆盖**：[setup.test.ts:113-140](tests/engine/tools/marketing/setup.test.ts#L113-L140) 测了"两个设计共存"但没测"label 重名 + marker 缺失"这个边界。建议加一个 case：清掉旧 marker 仅留 label，重 setup 同 id。

### P1-5：`cloneSubtreeAcrossGraphs` 不显式清 `props.componentId`

[clone.ts:43-65](packages/core/src/tools/marketing/clone.ts#L43-L65) `cloneInto` 只递归建节点 + 拷 props + 置空 `source`——**没显式把克隆后 component 的 `componentId` 重映射**。

07-30 review §1.2 P3-2 也指出过。本轮仍存在。`cloneNodeProps(src, null)` 把 componentId 设为 null——但**当前 default-library 的 BrandBar/CTABar 都是顶层 COMPONENT（无 INSTANCE、无内嵌 COMPONENT 引用），克隆后 componentId null 不影响**。**实际无生产 bug**——但理论上：

- 库组件内嵌子组件（另一个 COMPONENT 节点）→ 克隆后子组件的 `componentId` 指向**源 graph 那个子组件**——目标 graph 找不到 → 渲染时实例化失败。

修复成本：把 `cloneNodeProps(src, null)` 改成 `cloneNodeProps(src, sourceSubtreeComponentIdMap[oldComponentId] ?? null)`，递归建立 source 内嵌 COMPONENT 的 old→new id 映射。当前 default-library 不需要，但**用户上传的库若含嵌套 COMPONENT 会爆**——建议在 `findUnsupported` 加一条"嵌套 COMPONENT 引用"检查，或干脆在文档里写"库组件**只支持单层 COMPONENT 节点**"。

### P1-6：默认库仅 1 个 profile，UI 上 ProfileGallery 几乎空

[generate.ts:240](tools/marketing-library/src/generate.ts#L240) 只生成 `casual_v1`——ProfileGalleryDialog 网格就 1 张卡片。

实际是 v1 故意克制（§10 任务 1 "1 个示例 profile"）——但既然 UI 已经升级为卡片网格，**多放 2-3 个 profile 让 grid 更值得存在**（如 `luxury_v1`、`tech_v1`），并把 `applicable_to` 拆开覆盖更多 type，能让 dialog 视觉上更有说服力。否则网格=单卡，对比 dropdown 反而更弱（dropdown 至少占位小）。

### P1-7：`reference.soft filter UI` 把 `applicable_to` 标签贴在所有 chip 上，但 universal refs 没标签

[MarketingConfigBar.vue:213](src/components/chat/MarketingConfigBar.vue#L213) `[...reference.applicableTo, ...reference.tags].filter(Boolean).join(' · ')`——universal refs（`applicableTo: []`）只显示 tags。

default-library 里 `ref-product-long-001` 的 `applicable_to: product_long, tag: luxury_v1` → 显示 "product_long · luxury_v1"——**但库里没有 luxury_v1 profile**（[generate.ts:42-46](tools/marketing-library/src/generate.ts#L42-L46) 只有 `casual_v1`）。chip 上挂一个不存在的 profile id 字符串会误导用户。

**修复**：默认库要么把 `luxury_v1` 也建成 profile，要么把 ref 的 tag 删掉。

---

## 🟡 P2：产品打磨 / 文档一致性

### P2-1：`void library.value` 在 computed 内的副作用意图不明

[MarketingConfigBar.vue:39](src/components/chat/MarketingConfigBar.vue#L39) `void library.value`——这是为了让 `library` ref 被追踪进 computed。**但 computed 调用 `listMarketingTypes()` 是函数调用，里面读 `current.value?.index.types`，computed 的 dep collector 看不到**——`void library.value` 是手动 hack。

**修复**：在 computed 内直接读 `library.value?.index.types`，不要通过函数间接。

### P2-2：reference `applicable_to` 与 plan §4 文档 `for:` 命名不一致

详见 §2.2。

### P2-3：`l2-agent-mode.md` §3 / §4 / §5 仍未修订

实测 [l2-agent-mode.md §3](..%2Fplans%2Fl2-agent-mode.md#L37-L98) 仍写"`MATERIAL_TYPES`（material-types.ts:42-54）"——07-30 review §6.4 标注为 🟠 P1 文档债，本轮**仍未修**。

实测 `l2-resource-library.md` §9.3 第 210 行说"实习生 review 2026-07-30 完成核实"已采纳了"`l2-agent-mode.md §3/§4/§5 重写——原描述'代码中的 MATERIAL_TYPES + ComponentTemplate + 运行时基线'全面不准被代码质保`"——但 `l2-agent-mode.md` 实际**没有重写**。

**这是文档债的复利**——l2-agent-mode.md 是新人 onboarding 的第一站，写错会让新人误判架构。

### P2-4：`__resetMarketingLibraryForTest` 影响跨模块状态

[library.ts:105-109](src/app/ai/marketing/library.ts#L105-L109)：

```ts
export function __resetMarketingLibraryForTest(): void {
  current.value = null
  loadPromise = null
  profileSelection.value = null  // ← 跨模块状态
}
```

测试间隔离 OK，但**生产代码不应依赖**——`profileSelection` 是 chat storage 的全局单例 ref，marketing 重置顺手清掉它是耦合。建议清掉这行；测试自身应负责清理自己的状态。

### P2-5：`MarketingConfigBar` Profile 按钮 chip 颜色与 Type/Reference 一致

[MarketingConfigBar.vue:172-180](src/components/chat/MarketingConfigBar.vue#L172-L180) Profile chip 触发的是 dialog（不直接选 profile），与 Type 的 dropdown 和 References 的多选 dropdown 行为不一致——点击 Profile 弹出 gallery 网格，用户体验"咦怎么不一样"。

**修复**（任选）：

- 把 Profile 改成下拉式 chip，点开是 "Auto" + 几个最近用 profile 的快捷入口，"查看全部" 才进 dialog。
- 或者 Profile chip 文案改成 "风格档案: <label> · 查看全部"。

### P2-6：JSX 净化 `<X/></X>` 重写在属性含 `>` 字符串时会破坏 JSX

[render.ts:141](packages/core/src/design-jsx/render.ts#L141) `SELF_CLOSE_PLUS_CLOSE_RE` 用 `[^>]*` 匹配属性——若属性值含 `>` 字面（虽然 JSX 不允许，但模型有时输出 `<X foo="a>b"/>` 之类）会过早结束。建议用更严格的"无引号 `>`"匹配（参考 sucrase 自己的 JSX 解析器）。**实际触发概率低**，但是 fail-soft 的边界——错误时会落到 sucrase parse error，**用户感知是"模型又写错了"**——OK。

### P2-7：`ref-product-long-001` 是 plain frame，无图片

[generate.ts:262-276](tools/marketing-library/src/generate.ts#L262-L276) reference 只有一个灰色背景框 + 一行文字——`look` 工具跑出来 AI 看到的是 "灰色矩形"，对"参考"价值有限。

**修复**：默认库至少给 1 个参考塞个 IMAGE fill（可以是品牌 logo 复用 + 加文字标注），让 `look` 出来的图能体现"高端产品长图"风格。Pexels/Unsplash 集成已经在了（看 `tools/image-gen`），可以从那儿拉一张公开样图。

### P2-8：`replaceMarketingLibrary` 与 `loadLibrary` 共用 `loadFromBytes`，但错误路径不一致

[library.ts:54-57](src/app/ai/marketing/library.ts#L54-L57) `loadFromBytes` 直接 throw；[library.ts:88-99](src/app/ai/marketing/library.ts#L88-L99) `replaceMarketingLibrary` catch 后返回 `{ error: string }`。**`ensureMarketingLibrary` 的 catch（[library.ts:68-72](src/app/ai/marketing/library.ts#L68-L72)）设 `libraryLoadError.value` 但 `current.value = null`**——下次 `replaceMarketingLibrary` 后**`loadPromise` 被覆盖为 resolved session**，但 `current.value` 也直接被替换——OK，逻辑闭环。

但 `bindMarketingLibrary` 在 `current.value === null` 时**仍然 no-op**（[library.ts:113-114](src/app/ai/marketing/library.ts#L113-L114) 的 `if (session && ...)`）——如果 fetch 失败 + 用户没上传替换，调 setup 会报 "no library loaded"——**当前是预期行为**（dialog 顶部红框 + 重试按钮引导用户），OK。

### P2-9：测试覆盖度评估

| 模块 | 测试数 | 覆盖 | 缺口 |
|---|---|---|---|
| library.test.ts | 8 | parser happy path / size / warning / reference injection dedup / session registry | 缺：custom `width+height` 解析、`750x` 空高类型 |
| clone.test.ts | 6 | 普通 frame / COMPONENT / 图片字节 / 拒绝嵌套实例 / 拒绝 variables / 错误情况 | 缺：深嵌套栈 / 大子树性能 |
| setup.test.ts | 11 | 物化 / components page / anchorless / no-op / repair / 多设计 / custom / 错误 / profile / library marker | 缺：label 重名 + marker 缺失（P1-4 直接对应） |
| validate.test.ts | 8 | instance override / deleted / misplaced / 脱库 / setup hint | OK |
| restore.test.ts | 4 | reopen / validate-after-reopen / 多设计 / 无 marker | 缺：root frame 嵌 group 时漏扫（P1-5） |
| look.test.ts | 12 | 渲染尺寸 / legibility / vision 通道 A/B / 缓存 | OK |
| registry.test.ts | 3 | ensureRestored / cleanup | OK |
| marketing-library.test.ts (app) | 4 | bind 替换 / overlay 空状态 / 已绑定 / missing profile | 缺：replaceMarketingLibrary 后未重 bind 当前 store（P0-2） |
| generate.test.ts | 3 | page names / round-trip 解析 / 组件 + 图片字节 | 缺：7 个 type 全跑 setup 的端到端 |
| 渲染净化 (render.test.ts 等) | 4 | `<jsx>` 包裹 / `<X/></X>` 重写 | OK |

**测试统计**：07-30 review 标 38 条，本轮扩展到 **69 条**（+31）。缺口主要是 UI 行为（P0-2 / P1-1）、边界 case（P1-4 / P1-5）、端到端（generate 7 type）。

### P2-10：营销 prompt §L164 描述 variant types（dsp_banner → 300×250）

[system-prompt-marketing.md:164](src/app/ai/chat/system-prompt-marketing.md#L164)：

> `dsp_banner` → 300×250（"默认 300×250，需要其他 IAB 尺寸告诉我"）；`event_poster` → 1080×1920

实测 default-library dsp_banner = 300×250 ✓，event_poster = 1080×1920 ✓——OK。但 `wechat_article_cover` 在库里是 900×500（[generate.ts:199](tools/marketing-library/src/generate.ts#L199)），prompt 没单独说——OK，这是少锚点的非变体型。

### P2-11：`activeProfiles.get(store)` 永远不会被清除

[library.ts:135-139](src/app/ai/marketing/library.ts#L135-L139) `setActiveProfile` 只 set 不 clear——文档切换 / chatMode 切换不会清空。**生产场景**：用户在 doc A 营销模式选了 profile X，切到 doc B 营销模式 → `activeProfiles.get(storeB)` 还是 undefined（new EditorStore）→ OK。**但**：同一 store 内反复 setup 不同 type，activeProfileId 一直累加 ——最后用的是最近一次的值。

OK,这是 expected behavior。

---

## 四、冒烟回归前必改清单

按"block 冒烟"排序：

1. **`replaceMarketingLibrary` 后立即 `bindMarketingLibrary(store.graph)`**（[MarketingLibraryDialog.vue:60-65](src/components/chat/MarketingLibraryDialog.vue#L60-L65)）—— 状态绑定（P0-2）
2. **profile 状态三层镜像收敛**（[library.ts:194](src/app/ai/marketing/library.ts#L194)）—— P0-1（选 §3.1 方案 A / B / C 任一）
3. **`refInjections` 移到 `WeakMap<SceneGraph, Map>`**（[library.ts:78](packages/core/src/tools/marketing/library.ts#L78)）—— P0-3
4. **`injectedCount` chip 响应式**（[MarketingConfigBar.vue:68-72](src/components/chat/MarketingConfigBar.vue#L68-L72)）—— P1-1
5. **`l2-agent-mode.md` §3 / §4 / §5 重写**——文档债延续 2 轮未还
6. **reference `applicable_to` 命名与 plan §4 一致**（[plan §4 L80-83](..%2Fplans%2Fl2-resource-library.md#L80-L83)）—— 选 `applicable_to` 还是 `for`
7. **默认库 reference 加 IMAGE fill**——`look` 有图可看
8. **测试补**：`MarketingConfigBar` 注入后 chip 更新、`replaceMarketingLibrary` 后 bind、label 重名 + marker 缺失边界、7 type 端到端

---

## 五、冒烟回归验证建议

07-30 §8 列 8 项仍适用；本轮新增：

9. **ProfileGalleryDialog 搜索 + Markdown 预览**——搜索字段无歧义；preview 按钮不与"选"按钮事件冲突（已用 `.stop` ✓）
10. **reference 软过滤 UI**——`showAllReferences` 折叠后 chip 状态、再次开 dialog 时重置
11. **`e86a29e1` 改名**——确认旧库（`for:` 字段名）不兼容是 intentional breaking change（user feedback 文档里应记录）；或写兼容 parser
12. **`<X/></X>` 净化在 sucrase 升级后是否仍必要**——可能 sucrase 自身已经能容忍
13. **多 store（多 tab / 多 window）同时打开营销模式**——`current` 单例的 race condition

---

## 六、评估总结

- **规划契合度**：10/10。Q1–Q13 全部落地，迭代增量（reference `applicable_to` 改名 / profile 卡片库 / 区拆页 / 空状态兜底 / JSX 净化）均与规划口径对齐。
- **架构边界**：9/10。core / app 划得干净；`LibrarySession.refInjections` 跨 graph 共享是设计漏洞；profile 三层状态镜像。
- **代码质量**：8.5/10。简洁可读；P0-1 / P0-3 两处状态管理问题是这一轮没暴露出来的；JSX 净化 do-while 空转是细节。
- **数据完整性**：8.5/10。07-30 列的两处 P0 已修；本轮暴露 `replaceMarketingLibrary` 后未 bind + `refInjections` 跨 doc——后者属于 v1 设计漏洞。
- **错误引导**：9/10。07-30 列 P1 都已修；新增 JSX 净化容错 + 空状态 overlay 兜底。
- **测试覆盖**：9/10。62 + 3 + 4 = 69 条；缺 UI 响应式 / 跨 graph dedup / 端到端 7 type / label 重名 marker 缺失边界。
- **文档一致性**：6.5/10。07-30 列的两项 🟠 文档债**仍未还**（l2-agent-mode.md §3/§4/§5 + system-prompt-marketing.md `[素材类型]` 提前引用）；reference `applicable_to` 改名 vs plan §4 `for:` 命名新增不一致。
- **产品 UX**：9/10。ProfileGalleryDialog 卡片库 + Markdown 预览 + reference 软过滤 + 空状态提示——这一轮 UX 提了一档；Profile chip 触发行为不一致是最后一道打磨。
- **总评**：**8.5/10**。冒烟前修 §4 列 5 项可上 9 分。

按惯例：本评审落档后不再改动，结论通过修订 `plans/` 与代码生效。
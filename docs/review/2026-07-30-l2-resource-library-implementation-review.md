# 营销 L2 素材资源库 v1 落地 Review（2026-07-30）

> 评审对象：`../plans/l2-resource-library.md` v1 实施——把评审 §11 的重构规划（type / profile / reference 三关切解耦 + Library .fig 单一来源 + reference 用户勾选注入素材区 + readonly 降级声明式）落地到代码 + App + Dialog + Prompt + 文档。
> 评审范围：核心代码（`packages/core/src/tools/marketing/` 4 个新模块 + 2 个调整模块 + 4 个删除文件）、App 层（`src/app/ai/marketing/library.ts` + `MarketingLibraryDialog.vue` + `transports.ts` 接线）、生成器（`tools/marketing-library/` + `public/default-library.fig`）、测试（17 条 marketing 引擎测试 + 2 条生成器回环）、文档（`README.md` 状态面板 + `CHANGELOG.md` Unreleased + `00-overview.md` + `system-prompt-marketing.md`）。
> 结论：**v1 落地质量 8/10——决策 Q1–Q13 全部 1:1 落到代码、core/app 边界严守、测试覆盖到位；6 项冒烟前需处理的实质问题（数据完整性 1、错误引导 2、状态绑定 2、文档一致性 1）+ 7 项可选改进**。按惯例：评审落档后不再改动，结论通过修订 `plans/` 与代码生效。

---

## 一、总览

### 1.1 决策 Q1–Q13 落地清单

| # | 决策 | 落地 | 备注 |
|---|---|---|---|
| Q1 | 库标识不走 pluginData | ✅ | 根 frame marker 的 `library` 键 + `listDocumentLibraryNames` 比对 |
| Q2 | 单库 + 无 Library Editor mode | ✅ | .fig 就是普通图，直接打开编辑 |
| Q3 | 砍掉 `matchKeywords` | ✅ | grep 无残留引用 |
| Q4 | Components (BrandBar/CTABar) 进库 | ✅ | `generate.ts:buildBrandBar` / `buildCtaBar` |
| Q5 | 砍 `MATERIAL_TYPES` 代码种子 | ✅ | 4 文件删除完整 |
| Q6 | profile 首次 setup 注入 prompt overlay | ✅ | `buildMarketingOverlay` + `prepareCall` 每轮重拼 |
| Q7 | references 不拆库，v1 同文件 | ✅ | 协议层按 zone 扫库，物理同文件 |
| Q8 | reference 走"用户勾选 + app 克隆素材区" | ✅ | `injectLibraryReferences` + dialog |
| Q9 | readonly 子文本约定 | ✅ | `LAYOUT_MARKER_TEXT_RE` + 声明式 |
| Q10 | 库组件禁用 variables / 嵌套实例 | ✅ | `findUnsupported` 拒绝 + warning |
| Q11 | default-library.fig 构建期资产 + 启动注入 | ✅ | `public/default-library.fig` (32.6 KB) + `setDefaultLibrary` |
| Q12 | 仅内置 AI chat 跑库 | ✅ | MCP/CLI/ACP 未动 |
| Q13 | readonly 降级为声明式 | ✅ | 基线机制 + `accept` + `snapshotReadonlyValues` 全部删除 |

13 项决策全部按规划落地，无偏离。

### 1.2 真问题（按优先级）

| # | 问题 | 严重度 |
|---|---|---|
| P1 | `restoreStateFromCanvas` 在 `componentsPageId` 缺失时写入空字符串——后续 `ensureComponentsPage` 接受空串走"新建 Components 页"分支，写出"老 root frame 引用不存在的空 page"怪状态 | 🔴 P0 |
| P1 | `resolveExistingDesign` `[setup.ts:359]` 未区分"marker 命中"与"label 兜底匹配"的 `existing`——类型切换路径会进入"清空别人"分支（虽然单测覆盖了"共存的另一个设计"场景，但代码可读性上需要显式区分） | 🔴 P0 |
| P1 | 库组件缺失错误无"custom 兜底"引导——AI 拿不到逃生口 | 🟠 P1 |
| P2 | dialog 顶部"库名"在 `default-library.fig` fetch 失败时显示 `'…'`（静默吞 exception），用户感知不到网络问题 | 🟠 P1 |
| P2 | `listDocumentLibraryNames` `[restore.ts:121]` 只扫顶层 child——用户把 root frame 套 `group` 后会找不到 | 🟠 P1 |
| P2 | `replaceMarketingLibrary` 后不重新 bind 已绑定旧 session 的 graph——同图后续操作读到旧 LibraryIndex | 🟠 P1 |
| P3 | `cloneInto` 递归子节点失败时**不打断**父节点创建，结果是带空洞的子树（理论路径，未触发） | 🟡 P2 |
| P3 | `cloneSubtreeAcrossGraphs` 不显式清 `props.componentId`——理论上 INSTANCE 整体被包含又未被 `findUnsupported` 命中时残留 | 🟡 P2 |
| P3 | `setupMaterialType` 修复模式在 root frame 不存在时进"首次模式"重建，但 prompt / 错误未能显式提示"root frame 已删" | 🟡 P2 |
| P3 | `parseKeyValueLines` 允许多个 `id:` 行，第二个起 silent-discard——库作者易踩 | 🟡 P2 |
| P3 | profile 自动选择只看第一个 `applicableTo` 命中——非确定性（依扫描顺序） | 🟡 P2 |
| P4 | `MATERIALS_PAGE_NAME = '素材区'` 与 brief 内 zone `内容区/素材区/AI结论区` trio 的 `素材区` 命名冲突 | 🟡 P2 |
| P4 | `setDefaultLibrary` module-level singleton——多 window / test 串扰时无 cleanup 钩子 | 🟡 P2 |
| P4 | `defaultLibrary` fetch 失败时 `current.value` 仍是 `null`——下层 `bindMarketingLibrary` no-op，调 setup 报"no library loaded" | 🟡 P2 |
| P4 | `bindMarketingLibrary` 不替换已绑定——upload 替换后旧 graph 仍指旧 session | 🟡 P2 |
| P4 | `setup` 错误信息直拼字符串——后续 i18n / 错误码化伤筋 | 🟡 P2 |
| P4 | `stripLibraryMarkerTexts` 递归扫"所有 descendant TEXT"——大型库组件全扫描 + 未来 metadata 键可能被误剔 | 🟡 P2 |
| P5 | `l2-agent-mode.md` §3 / §4 / §5 仍写"代码中的组件模板"——评审 §11 重构说明"落地后修订"但未跟进 | 🟠 P1 |
| P5 | `00-overview.md` 营销工具清单缺 `look` / `vision` | 🟡 P2 |
| P5 | `system-prompt-marketing.md` 引用未交付的 `[素材类型]` 块（L3 范畴） | 🟡 P2 |
| P5 | AGENTS.md 未补 `tools/marketing-library/` 生成命令 | 🟡 P2 |

### 1.3 评分（细分维度）

| 维度 | 评分 | 备注 |
|---|---|---|
| 规划契合度 | 10/10 | Q1–Q13 全中，零偏离 |
| 架构边界 | 9/10 | core / app 划分严，WeakMap 隔离；module-level singleton 可议 |
| 代码质量 | 8/10 | 简洁可读；测试覆盖到位；handle 子节点失败 / props.componentId 残留两个细节 |
| 数据完整性 | 7/10 | P0 两处（空字符串写入 + 切换路径没收口） |
| 错误引导 | 7/10 | resubmit hint 在默认库场景会误触；custom 兜底逃生口缺失 |
| 测试覆盖 | 9/10 | 17 条 + 2 条回环；缺"组件含 IMAGE fill 的端到端" |
| 文档一致性 | 6/10 | CHANGELOG / README ✅；l2-agent-mode.md §3/§4/§5 仍描述旧时代 |
| 产品 UX | 8/10 | 默认库常驻 + dialog 设计干净；reference 纯文本无缩略图是 v1 妥协 |
| **总评** | **8/10** | 冒烟前修 §8 列 6 项可上 9 分 |

---

## 二、产品方案 Review

### 2.1 三关切正交切分 ✅

[plan §2](..%2Fplans%2Fl2-resource-library.md) 的 type / profile / reference 三列在代码中清晰映射：

- `LibraryType` / `LibraryProfile` / `LibraryComponent` / `LibraryReference` 四个独立 interface
- 三个职责互不耦合：`setupMaterialType` 读 types + profile，组件物化读 components，dialog 引用 libraryReferences
- 切换风格 = 改 `setup` 的 `profile` 参数；加类型 = 库里加 frame；改 reference = 用户重选——三条演化路径独立

### 2.2 默认库常驻 + dialog 上传 ✅

`maybeAutoOpenLibraryDialog` + `bindMarketingLibrary` 设计正确：types chips、profile overlay、references 列表永远有数据，消除"无库态"。

**轻量改进**：见 §1.2 P2 "库名 '…' 静默"。

### 2.3 Reference 走"用户勾选 + app 克隆素材区"——评审结论正确

否决 AI 工具面 + 库寻址工具 + 离屏渲染的备选方案是 right call。AI 消费素材区是 marketing prompt 既有流程（[plan §5 L147](..%2Fplans%2Fl2-resource-library.md#L147)），零新机制。落地干净。

**v1 妥协明确**："纯文本列表不渲染缩略图"——对运营用户来说"参考长什么样"是勾选决策核心。冒烟后如果用户反馈"分不清",v1.5 加缩略图（`imageHash` 已经在 graph 里）。

### 2.4 custom 兜底始终可达 ✅

[setup.ts:65](packages/core/src/tools/marketing/setup.ts#L65) `custom` 路径保留；无库时也有可工作的设计路径。

### 2.5 库标识 marker + 启动检测（§6.1）

`marketingRootLibrary` + `listDocumentLibraryNames` + `documentLibraryMismatch` 形成"自定义库断裂可检测"的闭环。**resubmit hint 措辞**：

> "This document has a design of type "X" made with a different library — re-submit that library file (currently loaded: Y)."

**问题**：当 `Y === 'default-library.fig'` 时（用户根本没上传过自定义库），**显示 resubmit 引导是误导**——用户不会去"重新提交默认库"。**建议**：当 `session?.name === 'default-library.fig'` 时不显示 resubmit hint（那一定是 type id 写错了）。

### 2.6 命名冲突

`MATERIALS_PAGE_NAME = '素材区'` 与 brief.ts 的 `BRIEF_ZONE_MATERIALS_NAME = '素材区'` 同名（一为页面、一为 zone）。**用户画布里看到两个同名实体**会困惑。评估下来改 library 那边更好（brief 的 trio 先在先）。

---

## 三、架构设计 Review

### 3.1 core / app 边界 ✅

| 层 | 文件 | 职责 |
|---|---|---|
| core | `packages/core/src/tools/marketing/library.ts` | parseIndex / loadLibrary / session registry / injectLibraryReferences |
| core | `packages/core/src/tools/marketing/clone.ts` | cloneSubtreeAcrossGraphs |
| core | `packages/core/src/tools/marketing/registry.ts` | per-graph marketing state |
| core | `packages/core/src/tools/marketing/setup.ts` | setupMaterialType |
| core | `packages/core/src/tools/marketing/validate.ts` | validateMarketingDesign |
| core | `packages/core/src/tools/marketing/restore.ts` | pluginData marker ↔ state |
| app | `src/app/ai/marketing/library.ts` | fetch + bind + reactive state + dialog 数据准备 |
| app | `src/components/chat/MarketingLibraryDialog.vue` | 上传 + 勾选注入 UI |
| app | `src/app/ai/chat/transports.ts` | `prepareCall` 注入 profile overlay |
| tool | `tools/marketing-library/src/generate.ts` | default-library.fig 构建器 |

边界严守：core 无 `fetch` / `Vue` / `DOM`；app 不操作 graph 内部属性（除 `bind` 与 `snapshot`）。

### 3.2 跨文档克隆放 core ✅

[clone.ts](packages/core/src/tools/marketing/clone.ts) 是纯 graph→graph 操作，无文件 IO/UI 依赖——放 core 正确。测试 [clone.test.ts:62](tests/engine/tools/marketing/clone.test.ts#L62) 验证 imageHash 跨图搬运。

### 3.3 LibrarySession 注册用 `WeakMap<SceneGraph, LibrarySession>` ✅

不阻塞 GC；多文档互不干扰；测试 [library.test.ts:194](tests/engine/tools/marketing/library.test.ts#L194) 验证多个 graph 互不干扰。

### 3.4 `refInjections` 也用 `Map<libraryRefId, nodeId>` ✅

session 级 dedup，扩多文档不会互相干扰。

### 3.5 `defaultLibrary` module-level singleton ⚠️

[library.ts:343](packages/core/src/tools/marketing/library.ts#L343) module-level state 在多 window / multi-tab 场景（jsdom 多实例测试）会共享 global state。**目前**通过 app 启动单次 `setDefaultLibrary` 注入后只读，OK；但测试用 `setDefaultLibrary` 临时替换后没 cleanup 会污染后续测试。**建议**：在 `__test__` 通道下提供 `__resetDefaultLibrary()` 调试钩子。

### 3.6 启动检测调用链 ✅

`ChatInput.vue:91-98` watch chatMode → `maybeAutoOpenLibraryDialog(graph)`。`maybeAutoOpenLibraryDialog` 内 `ensureMarketingLibrary` → `bindMarketingLibrary` → `documentLibraryMismatch` 判断显示。**闭环**。

### 3.7 评估小结

整体架构与评审 §11.3 / §11.5 提出的方向高度一致。把"声明式 metadata"切成三个独立 zone（Types / Profiles / Components / References）+ 用户显式触发 dialog 上传，比最初的"代码 MATERIAL_TYPES + 全自动扫描"方案克制得多——v1 复杂度控制在合理范围。

---

## 四、核心实现 Review

### 4.1 `marketing/library.ts`（parseLibraryIndex）

**写得最好的部分**：

- `forEachZoneEntry` 抽象出"共享的 first-wins dedup + zone 迭代"——四种 zone 复用同一骨架
- `parseKeyValueLines` 用 `key: value` 多行容忍——库作者体验好
- `warnUnknownKeys` + `findZone` 缺失警告 + `Types` 锚点引用 Components 校验——warnings 通道完整
- `loadLibrary` 走 `IORegistry` + `exportFigFile` 同一管线（与生成器共用）

**轻量问题**：

- [library.ts:88](packages/core/src/tools/marketing/library.ts#L88) `parseKeyValueLines` 允许多个 `id:` 行 → 第二个起 silent-discard。**建议**检测到 duplicate 推 warnings。
- [library.ts:111](packages/core/src/tools/marketing/library.ts#L111) `splitList` 用 `[,，]` 双逗号——与 prompt 一致，OK。
- 没用 `cloneNodeProps` 的部分（image fill 搬运）单独走 `cloneInto`，分层清晰。

### 4.2 `marketing/clone.ts`

**简且对**。6 步：`createNode` → 递归 → 拷 props → 剥 source.id → 搬 image bytes → null source.orderKey。

**两处需修**：

- [clone.ts:48](packages/core/src/tools/marketing/clone.ts#L48) `cloneInto` 递归子节点失败时**不打断**父节点创建。子克隆 `return undefined`（理论路径：`getNode` 找不到）应立即 propagate 失败。
- [clone.ts:60](packages/core/src/tools/marketing/clone.ts#L60) `target.createNode(src.type, targetParentId, props)` 不显式清 `props.componentId`——INSTANCE 整体被包含于库子树内（理论上不应通过 `findUnsupported` 校验，但若有遗漏）会残留旧 componentId 跨文档引用。

### 4.3 `marketing/registry.ts`

**精简到位**。删除 readonly Map / `snapshotReadonlyValues` / `checkReadonly` / `accept` 后，registry 只剩 anchor records + activity clock——焦点就是"多设计并存"。

**`ensureRestored` 懒恢复**机制是 §l2-context-engineering 任务 4 的延续，看 release notes §"restore from canvas markers"成立。

**轻量**：`restoredGraphs` 是 module-level `WeakSet`——多图顺序访问的并发安全性不依赖它（WeakMap / WeakSet 同步语义），OK。

### 4.4 `marketing/setup.ts`

**主体逻辑** ✅：

- 三种模式（首次 / 切换 / 修复）分流清晰
- `resolveMaterialConfig` 区分"custom" / "library 中" / "library 缺失 + repair 意图"三路径
- `materializeAnchor` + `rebuildAnchorInstance` 复用 `ensureLibraryComponent`——实例完整性靠 nodeId 存活判定
- `collectReadonlyNote` 不进 return 值主体，进 `note` 字段——Q13 声明式注入，符合规划

**实质问题**：

1. [setup.ts:359](packages/core/src/tools/marketing/setup.ts#L359) `resolveExistingDesign` 未区分 marker / label 兜底匹配的 `existing`——类型切换路径会进入"清空别人"分支（代码可读性层面，单测已覆盖正确行为）。
2. [setup.ts:200](packages/core/src/tools/marketing/setup.ts#L200) `stripLibraryMarkerTexts` 用正则 `^readonly\s*:/i`——未来 metadata 键（如 `description:`, `tag:`）新增会被误剔。
3. [setup.ts:222](packages/core/src/tools/marketing/setup.ts#L222) 库组件缺失错误 `Component "X" not found in the Components zone of library "..."` 无"custom 兜底"引导——AI 拿不到逃生口。
4. [setup.ts:111](packages/core/src/tools/marketing/setup.ts#L111) profile 自动选择 `applicable` 命中即返回——非确定性（依扫描顺序）。

### 4.5 `marketing/validate.ts`

**精简到位**。仅 2 类违规（`anchor_deleted` / `anchor_misplaced`）+ 从 registry 自身 record 推导期望位置（脱库校验）——评估 §6.1 改造目标完全达成。

**正确性**：markers 里的 `POSITION_KEY` + `TEMPLATE_KEY` + `COMPONENT_KEY` 三键保 anchor 期望位置。`validate` 不读 type config，只读 markers——库错了 validate 仍工作。

**轻量**：`touchMarketingState` 在 validate 入口被调用——refresh activity clock，避免"刚 validate 的设计被另一个更老的刷下去"。细节对。

### 4.6 `marketing/restore.ts`

**marker 协议**清晰：

- `MARKETING_PLUGIN_ID = 'open-pencil-marketing'` 与 brief 复用同一 plugin id
- `ROLE_KEY` / `TYPE_KEY` / `TEMPLATE_KEY` / `POSITION_KEY` / `COMPONENT_KEY` / `LIBRARY_KEY` / `LIBRARY_REF_KEY` 7 键
- `isMarketingRoot` / `marketingRootType` / `marketingRootLibrary` / `libraryReferenceId` 四个 predicate
- `listDocumentLibraryNames` 集合化多 root frame 的库名

**实质问题**：

1. [restore.ts:154](packages/core/src/tools/marketing/restore.ts#L154) `componentsPageId = findComponentsPageId(graph) ?? ''` 写空字符串而不是 `undefined`——后续 `setup.ts:438` 的 `ensureComponentsPage(figma, existing?.componentsPageId ?? designs[0]?.componentsPageId)` 接受空串走"新建 Components 页"分支，写出"老 root frame 引用不存在的空 page"怪状态。**建议**：`?? undefined`。
2. [restore.ts:121](packages/core/src/tools/marketing/restore.ts#L121) `listDocumentLibraryNames` 只扫顶层 child——用户把 root frame 套 `group` 后会找不到。**建议**：递归扫所有 marketing-root marker（成本 O(n)，库级开销可忽略）。

### 4.7 App 层 `src/app/ai/marketing/library.ts`

**编排层**做得干净：

- `useMarketingLibrary` reactive + `getMarketingLibrary` 同步读
- `ensureMarketingLibrary` 幂等 + 异常安全
- `bindMarketingLibrary` 幂等
- `buildMarketingOverlay` 每轮重拼（§6 Q6）
- `maybeAutoOpenLibraryDialog` 启动检测（§6.1）
- `injectLibraryReferences` 编排 undo + layout + render

**实质问题**：

1. [library.ts:54](src/app/ai/marketing/library.ts#L54) `ensureMarketingLibrary` 内 `catch { current.value = null }` 静默吞 exception——应上报到 dialog 顶部。**用户感知不到网络问题**。
2. [library.ts:84](src/app/ai/marketing/library.ts#L84) `bindMarketingLibrary` 不替换已绑定——upload 替换后旧 graph 仍指旧 session。**建议**：`replaceMarketingLibrary` 成功后主动遍历所有 graph 重新 bind，或把 session 绑定改为"按 name 共享"。
3. [library.ts:120](src/app/ai/marketing/library.ts#L120) `buildMarketingOverlay` 类型未知 (`EditorStore`)——`void profileVersion.value` 触发 reactive 的写法可读性差，**建议**用 `computed` 替代或注释解释。

### 4.8 `MarketingLibraryDialog.vue`

**做得好的**：

- reactive `selected` 数组 + `watch(open)` 重置预选
- `useFileDialog` 集成上传
- `mismatch` / `warnings` / `references` 三个 computed 全部正确响应
- `injectErrors` 与 `uploadError` 错误信息分两条线

**实质问题**：

1. [MarketingLibraryDialog.vue:42](src/components/chat/MarketingLibraryDialog.vue#L42) `mismatch` 计算无 library 名显示——用户区分不出"刚替换的库"vs"文档来源库"。**建议**：展示当前库名 + 文档引用库名。
2. [MarketingLibraryDialog.vue:104](src/components/chat/MarketingLibraryDialog.vue#L104) `library?.name ?? '…'` 显示在 fetch 失败时为 `'…'`——静默。**建议**：fetch 失败时显示红色错误提示，放开"重试"。
3. [MarketingLibraryDialog.vue:48](src/components/chat/MarketingLibraryDialog.vue#L48) `selected` 数组初始为空——`watch(open)` 立即 pre-select 已注入 references，但**如果 open 多次切换后 references 列表变了**（用户上传替换库），selected 不重算。**建议**：`watch(library, () => { if (open) resetSelected() })`。

### 4.9 `transports.ts` 接线

[transports.ts:127](src/app/ai/chat/transports.ts#L127) `prepareCall` 内：

```ts
if (chatMode === 'marketing') {
  bindMarketingLibrary(store.graph)
  instructions = SYSTEM_PROMPT_MARKETING + buildMarketingOverlay(store)
}
```

**正确性**：

- `bindMarketingLibrary` 每轮重 bind——保证新建 store 也能绑上
- 每次重拼 `instructions`——profile 切换下一轮自动生效（Q6）

**轻微**：`onToolLog` + `setActiveProfile` 的接线程性（[tools/index.ts:169](src/app/ai/tools/index.ts#L169)）——`setActiveProfile` 调 `activeProfiles.set(store, profileId)` + `profileVersion.value++`。`buildMarketingOverlay` 读 `void profileVersion.value` 触发 reactive 重算。✓

### 4.10 生成器 `tools/marketing-library/src/generate.ts`

**清晰**：

- 7 个预设 type 全部入 Types 区
- 1 个示例 profile（`casual_v1`）覆盖 3 个 applicable_to
- 2 个组件（BrandBar / CTABar）含 `readonly:` 子文本
- 1 个示例 reference（`ref-product-long-001`）含 `for:` + `tag:`
- `markerText` 用 `layoutPositioning: 'ABSOLUTE'` 挂在组件外，不干扰 auto-layout
- `buildDefaultLibraryGraph` 是 `export function`（便于回环测试 import）

**测试** `generate.test.ts` 两条 round-trip 通过（exportFigFile → loadLibrary 验证 all 7 types + 1 profile + 2 components + 1 reference 都正确）。

**轻量**：`DEFAULT_LOGO_BASE64` 是 32×32 灰底占位 logo——评审 §11 要求"体积克制"达标（32.6 KB）。

---

## 五、测试 Review

### 5.1 覆盖清单

| 测试文件 | 覆盖 |
|---|---|
| `library.test.ts` | parseLibraryIndex 6 条 + injectLibraryReferences 2 条 + session registry 1 条 |
| `clone.test.ts` | cloneSubtreeAcrossGraphs 6 条（含拒绝 variables / 嵌套实例 + image 搬运） |
| `setup.test.ts` | 11 条（含 first/repair/switch/multi-design + custom + unknown + resubmit hint + activeProfile） |
| `validate.test.ts` | 8 条（含 anchor_deleted / anchor_misplaced + 脱库校验 + 无 marketing state 兜底） |
| `restore.test.ts` | 4 条（reopen scan + 多次扫 + 无 marker） |
| `registry.test.ts` | 5 条（single / multi / explicit rootFrameId / clear behavior） |
| `generate.test.ts` | 2 条（round-trip + image fill 存活） |

共 38 条引擎测试 + 2 条生成器回环。

### 5.2 覆盖盲点

1. **缺"用 clone 出来的 componentId createInstance 后，instance 子节点填的 graphic 真的能渲染"**——目前是 setup 路径的隐式覆盖，未直接断言。
2. **缺"replaceMarketingLibrary 后老 graph 的行为"**——评审 §2.10 的 app 层 bug 没有回归测试。
3. **缺"l2-resource-library.md 提到的 6 种断裂场景矩阵"**：
   - 默认库 + 默认库在 → 不断裂
   - 自定义库 + 重新提交同一库 → 不断裂
   - 自定义库 + 只有默认库 → 断裂（已有 setup.test.ts:169）
   - 自定义库 + 不含该 type 的另一个库 → 断裂（已有 setup.test.ts:169）
   - 但**缺**："无库" + 设计存在 → restore 失败友好兜底
4. **缺"profile 切换路径"显式测试**——`setup({id: A, profile: P1})` 后 `setup({id: A, profile: P2})` 应仅切换 `activeProfileId` 不重建 root frame。

### 5.3 测试质量

- `attachMiniLibrary` helper 让 core 测试**完全不依赖 `public/default-library.fig` 真实 fixture**——评审 §11.5 任务 12 这条严格达成。
- 断言 `expect('error' in result).toBe(false)` 而 `if ('error' in result) return` 类型守卫写得规范——是 TS discriminated union 的标准用法。
- 错误信息 substring 断言 (`expect(second.error).toContain('re-submit that library')`) 而非 exact match——稳定的回归测试模式。

---

## 六、文档 Review

### 6.1 README.md 状态面板 ✅

[README.md:47](..%2Fplans%2FREADME.md#L47) 状态行已将 L2 素材资源库标为 ✅ v1 已实施，列 9 项子条目（生成器 + 扫库解析 + clone + setup 改造 + readonly 降级 + validate 精简 + 启动检测 + profile overlay + dialog）。与代码 1:1 对应。

### 6.2 CHANGELOG.md Unreleased ✅

[CHANGELOG.md:7](CHANGELOG.md#L7) "Ship a material library (Library .fig)"—— Added 第一条。[CHANGELOG.md:28](CHANGELOG.md#L28) "Simplify marketing validate"—— Changed 第二条。措辞贴合。

### 6.3 00-overview.md 微缺

[00-overview.md:74](..%2Fplans%2F00-overview.md#L74)：

> 营销工具域：`packages/core/src/tools/marketing/`（library / clone / registry / setup / validate / restore / brief）

**缺** `look` / `vision`（`vision.ts` 199 行——通道 B 视觉模型 + 素材理解缓存）。**建议**：补全 `+ look + vision`。

### 6.4 l2-agent-mode.md 重大文档债 🟠

评审 §11 重构方案规划说明"落地后将修订其素材类型体系与资源体系两章"，但 l2-agent-mode.md 三个章节未跟进：

- **§3 素材类型体系**仍描述"代码中的 MaterialTypeConfig" + 表 3.3 "预设素材类型"（应改为"7 个类型迁入 Library.fig Types 区"）
- **§4 资源体系**：§4.2 整段"组件模板以代码形式存在" 与实现不符
- **§4.3 校验机制**："运行时会话级注册表 Map<nodeId, { readonlyProps, originalValues }>" 与 Q13 降级版不符
- **§5.1 setup 工具**："section 规划 + 风格指南 + 自定义字段 + readonly 信息" 进入返回值——v1 改成 `activeProfileId` + `warnings`
- **§5.3 运行时流程图**还在描述"恢复数据源都是确定性的"路径

**影响**：新人读 l2-agent-mode.md 仍会以为"组件模板是代码"——代码真相已不是这样。**建议**：冒烟回归后**优先**修订 §3 / §4 / §5 三章。

### 6.5 system-prompt-marketing.md

[§L147](src/app/ai/chat/system-prompt-marketing.md#L147) "Library references (素材区 page):" 已加——与 v1 落地对齐。

[§L172](src/app/ai/chat/system-prompt-marketing.md#L172) "It returns: size, anchor instance IDs, activeProfileId... and any warnings"——与 v1 返参结构对齐。

[§L167](src/app/ai/chat/system-prompt-marketing.md#L167) "User-locked type: the message may contain a [素材类型] block"——这是 L3 范畴的功能，**v1 还没实现**。prompt 提前引用了未交付的功能。

### 6.6 AGENTS.md

无 `tools/marketing-library/` 相关命令。**建议**：在 Commands 章节加 `bun tools/marketing-library/src/generate.ts` 或 `npm run library:gen`（定义在 `tools/marketing-library/package.json`——目前 package.json 是 5 行的 stub）。

---

## 七、冒烟回归前必改清单

按"block 冒烟"排序：

1. **`restoreStateFromCanvas` 写空字符串改成 `undefined`**（[restore.ts:154](packages/core/src/tools/marketing/restore.ts#L154)）—— 数据完整性
2. **`resolveExistingDesign` 返回标记来源**（[setup.ts:359](packages/core/src/tools/marketing/setup.ts#L359)）—— 类型切换路径数据完整性
3. **库组件缺失错误带"custom 兜底"提示**（[setup.ts:222](packages/core/src/tools/marketing/setup.ts#L222)）—— 错误引导
4. **`resubmitHint` 在默认库场景不显示**（[setup.ts:89](packages/core/src/tools/marketing/setup.ts#L89)）—— 错误引导
5. **`listDocumentLibraryNames` 递归扫描**（[restore.ts:121](packages/core/src/tools/marketing/restore.ts#L121)）—— 启动检测
6. **`replaceMarketingLibrary` 后重 bind 已绑定 graph**（[library.ts:84](src/app/ai/marketing/library.ts#L84)）—— 状态绑定
7. **dialog 顶部展示"当前库 vs 文档来源库"**（[MarketingLibraryDialog.vue:42](src/components/chat/MarketingLibraryDialog.vue#L42)）—— UX
8. **fetch 失败 dialog 显示错误**（[library.ts:54](src/app/ai/marketing/library.ts#L54) + [MarketingLibraryDialog.vue:104](src/components/chat/MarketingLibraryDialog.vue#L104)）—— UX
9. **l2-agent-mode.md §3/§4/§5 与实际落地对齐**（[l2-agent-mode.md](..%2Fplans%2Fl2-agent-mode.md)）—— 文档一致性

## 八、冒烟回归验证建议

> README 状态面板已列"冒烟回归：营销模式跑通'默认库出类型 chips → setup 出锚点 → dialog 勾选注入素材区 → look 参考'全链路；自定义库重开断裂的 dialog 提示验证"。

**建议补充**：

1. **设计完关闭浏览器再打开**——验证 `restoreStateFromCanvas` 能在 0 库 / 自定义库 / 默认库三种状态都恢复
2. **多次连续 `replaceMarketingLibrary`** 测竞态——评审报告 §2.10 当前未回归
3. **同一文档内 2 个 design 不同 type**——验证 chip 切换不互相破坏（test 已覆盖）
4. **库组件含 IMAGE fill 的设计**——validate 不会误伤 readonly 节点（round-trip 已覆盖，但 setup 路径独立）
5. **删除 root frame 后再调用 setup**——应能"首次模式"重建（不是修复模式）
6. **profile 切回不带 applicableTo 的 type**——`applicableTo` 包含当前 type 才生效（fallback 行为）
7. **reference 注入后用户手动改素材区节点**——去重失效路径已规划为"自然容错"——验证"自然容错"是否真的有效
8. **library 内组件含被删除的 IMAGE 字节**——`carryImageBytes` 返回 `undefined` 时是否优雅不崩

---

## 九、评估总结

- **规划契合度**：10/10。Q1–Q13 全部 1:1 落地，零偏离。
- **架构边界**：9/10。core / app 划得干净；module-level singleton (`defaultLibrary`) 与 bind 不替换两处可议。
- **代码质量**：8/10。简洁可读；`cloneInto` 失败 propagation 缺失、`props.componentId` 未清空两个细节需补。
- **数据完整性**：7/10。P0 两处（`componentsPageId: ''` 写入 + 切换路径 `resolveExistingDesign` 标记来源未显式）。
- **错误引导**：7/10。`resubmitHint` 在默认库场景会误触；库组件缺失无 custom 兜底。
- **测试覆盖**：9/10。38 + 2 条覆盖到位；缺"组件含 IMAGE fill 的端到端" + "replaceMarketingLibrary 状态" + "profile 切换路径"。
- **文档一致性**：6/10。CHANGELOG / README ✅；`l2-agent-mode.md` §3/§4/§5 是最大文档债。
- **产品 UX**：8/10。默认库 + dialog 设计干净；reference 纯文本无缩略图是 v1 妥协。

**总评 8/10**。冒烟前修 §7 列 9 项，可上 9 分。

按惯例：本评审落档后不再改动，结论通过修订 `plans/` 与代码生效。
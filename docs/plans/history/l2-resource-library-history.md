# l2-resource-library-history (历史)

> **来源**：从 `../architecture/l2-resource-library.md` 切出的实施/时间线/误诊记录。
> 本文件按"只追加"原则归档；新讨论请开新 §。
> 当前正确设计见 `../architecture/l2-resource-library.md`。

## 7. 迁移路径（现状 → library）

| 现状 | 落到 library 后 |
|---|---|
| `MATERIAL_TYPES` const 数组（material-types.ts） | Library .fig Types 区；代码只留扫库 + 解析 |
| `listMaterialTypes()` | 扫库 + 合成（类型 chips 与 setup 类型列表同源） |
| `component-templates.ts` BrandBar/CTABar | Library .fig Components 区（跨文档克隆物化） |
| `assets.ts` 的 `brand-logo` 内置 base64 | Library .fig 资产 + 内置 fallback |
| profile（待新加） | Library .fig Profiles 区 |
| reference（待新加） | Library .fig References 区 + 用户勾选注入素材区（§5） |
| `matchKeywords` 字段 | 删（用 label + description） |
| `sectionPlan / styleGuide / custom`（type 内字段） | 删（迁入 profile.md，由 AI 自然语言理解） |
| `min/maxSections` | 删（validate 同步删除 section_count 校验类型） |
| readonly 基线机制（registry readonly Map / `snapshotReadonlyValues` / `checkReadonly` / `accept`） | **删（Q13）**；`readonly:` 声明保留，消费者为 prompt / setup note |
| setup 修复模式实例完整性检查 | **删（Q13）**；修复 = 锚点缺失重物化（实例存活判定即可） |

**validate 精简**：section_count 整类删除 + readonly 两类删除（Q13）；保留 anchor_deleted / anchor_misplaced 两类，且改为从 anchor 记录脱库校验（§6.1）。

**setup_material_type 返参精简**：删 bundled sectionPlan/styleGuide/custom；加 activeProfileId 指针 + warnings 带出（profile 内容**不进返回值**，由 setup 调用时灌入 system prompt overlay，仅内置 chat）。

## 8. 既有评审建议项的复核结论

| 评审结论 | 本规划下的处置 |
|---|---|
| P0: render 不挂 recordInstanceOverrides | ✅ **已修复（2026-07-29）**——见 §9.1；与库架构独立 |
| P1: 加 minSections 校验 | ❌ **撤销**——min/max 字段整体删除，section_count 校验类型去除（§7） |
| P1: 扩 readonly 快照范围（width/height/visibility/opacity） | ❌ **撤销**——readonly 运行时校验整体降级（Q13），快照机制删除 |
| P2: accept=true 范围澄清（prompt 注明只刷 readonly_modified） | ❌ **撤销**——accept 路径随 readonly 降级删除（Q13） |
| P2: prompt "after completing each section" 显式章节提醒 | ✅ 保留，随 v1 prompt 修订 |
| 评审 §3.2 "三层映射" 表 | ❌ 由本规划 §2 的三关切表取代 |

## 9. 实施记录与状态

> 任务进度以 `README.md` 为唯一状态来源；本节只记录已落档的实施事实。

### 9.1 P0 修复：render 路径实例 override 保留（2026-07-29 ✅）

评审 §3.3 指出 render 工具未挂 `recordInstanceOverrides`。实施时按 sync 引擎实际行为对补法做了修正：

- **真实损伤机制**：`render({ replace_id })` / `node_replace_with` 替换实例内已映射子节点时，新节点丢失 `componentId` 映射 → 下次组件 sync 把原组件子节点重新克隆回来，AI 的替换内容看似被"冲掉"（且出现重复节点）。评审建议的"renderer 内对每个新建节点记录 overrides"对此无效（新节点无映射，override 键不会被 sync 查阅）；而纯 `parent_id` 新增路径无需处理（未映射节点本身不被 sync 触碰）。
- **实际补法**：新增 `preserveInstanceChildReplacement`（`packages/core/src/tools/instance-overrides.ts`）——替换发生时把旧节点的 `componentId` 映射转移到新节点，冻结全部 sync 白名单 prop 为 overrides，并写 `<newId>:componentId` 停止子树递归同步（渲染替换是整体替换语义，子树由新内容全权管理）。接入 `tools/create/render.ts`（replace_id）与 `tools/structure/replace.ts`（node_replace_with）两处。
- **测试**：`tests/engine/tools/create.test.ts`（replace_id 保映射 + sync 后内容存活 + 非实例路径零副作用）、`tests/engine/tools/structure.test.ts`（node_replace_with 同等断言）。

### 9.2 评审出入点备查（落档修订，不回改评审原文）

- 评审 §5.1 注册表签名：实测为 `WeakMap<SceneGraph, Map<rootFrameId, MarketingDocumentState>>` 双层（registry.ts:33），评审写成单层。
- 评审 §5.4 跨域接线：`packages/fig/.../symbol/overrides.ts:37-43` 只做 kiwi → SceneGraph 的 overrides 导入；"跳过已覆盖属性"的同步逻辑在 `packages/scene-graph/src/instances.ts:152-160`。

### 9.3 v1 实施记录（2026-07-30 ✅） + 2026-07-30 续轮整改

按 §10 任务分解全部落地，与规划文本的出入：

- **代码结构**：核心新增 `marketing/library.ts`（扫库解析 LibraryIndex + 会话注册 + reference 注入 + 用户锁定 profile 偏好）、`marketing/clone.ts`（`cloneSubtreeAcrossGraphs`）；删除 `material-types.ts` / `component-templates.ts` / `builder.ts` / `assets.ts`。Q10 禁止嵌套实例使"子树内 componentId 重映射"无对象——克隆函数因此没有该分支，仅有 id 重新生成 + imageHash 搬运 + source 标识置空。
- **`assets.ts` 未保留**：规划说"保留 `assets.ts` fallback"，落地时它已无消费方（库组件内嵌 logo 字节，克隆自带图片搬运），死代码删除；默认库的 BrandBar logo 用的是同一组 base64 字节，行为等价。
- **readonly marker 的实现细节**：`readonly:` 子文本在库组件内以 `layoutPositioning: 'ABSOLUTE'` 挂在外面（不干扰组件自身的 auto-layout），克隆进工作文档时由 setup 统一剥离（`stripLibraryMarkerTexts`）。
  - **reference 注入核心在 core**：`injectLibraryReferences(graph, refIds)`（含参考区页创建、克隆、pluginData 标记、`libraryRefId → nodeId` 去重），app 层只包 undo/render——引擎测试可直接覆盖。
- **profile overlay 注入点**：`transports.ts` 的 `prepareCall` 每次调用重建 instructions（基础 prompt + 库类型清单 + activeProfile markdown），`activeProfileId` 由 `onToolLog` 从 setup 返参捕获——中途换 profile 重 setup 后下一轮自动生效，无需重建 transport。**用户锁定 profile**：app 层 MarketingConfigBar 选择时 `setMarketingPrefs(graph, {profileId})` 写入核心注册表，setup 的 resolveProfile 顺序：显式 param > 用户锁定 > applicableTo 命中 > 第一个（验证：测试 `切换 profiles via re-setup keeps the design intact` 保证 12 条安装/动错仍能覆盖首次锁定 → 不重 setup 不能被其他 setup 改变）。
- **默认库加载**：`public/default-library.fig`（32.6 KB，`tools/marketing-library/` 生成器产出，**所有文字设阿里巴巴普惠体**，含回环测试），首次进入营销模式时 fetch + 解析 + 绑定。fetch 失败表面化：dialog 顶部红框 + 重试按钮。
- **启动检测**：营销模式启动时比对 `listDocumentLibraryNames(graph)` 与当前库名（**递归扫描**——用户可能把 root frame 套在 group 里）；marker 库名 ≠ 当前库名时重新提交提示包含明确库名（默认库场景不误导：marker库名 === 当前库 → 不出提示）。
- **三配置项 UX（v1 迭代）**：以 user feedback 为驱动的第二轮重构，原 chips 行被 `MarketingConfigBar` 替代——3 个 dropdown 按钮选 类型/风格/参考，已选项醒目可选。具体设计：
  - **类型 dropdown**：选项 = 「自动」 + 全部库类型；选类型 = 用户锁定 = [`素材类型]` 注入下条消息；选自动 = 释放锁定。推断标记（虚文本）靠现有 `inferMaterialTypeFromText` 推断推断中 、老存推断 tag 一起在选项中提示结果。
  - **风格 dropdown**：选项 = 「自动」 + 全部库 profile；选 profile = `[风格档案]` 注入下条消息 + 写入营销 prefs，setup 确定性透传。
  - **参考 dropdown**：（從 dialog 移出）勾选 references → 注入参考区页；已注入未勾选仍保留，提示“已注入的参考不会被移除”。**Dialog 精简**：remaining sections = 库名 + 上传、fetch 错误重试、不匹配警告、解析 warnings、关闭。参数注入与重提交职责下沉到配置项。
- **render 容错**：观察到 `<X/></X>`（自闭合后紧跟闭合）与 ```<jsx>`/`</jsx>`包裹包裹两种频繁模型错遗漏；`buildComponent` 加 `sanitizeModelJsx`：剥离 ``<jsx>``包裹标签、重复应用 `<X/></X>` → `<X/>` 重写修复。两个 prompt（系统 + 营销）补一句"Output valid JSX only"从源头预防。4 条 render 净化测试验证不同错位修复。
- **设计实现偏差（**实习生 review 2026-07-30 完成核实**）**：
  - **采纳**：`restoreStateFromCanvas` 缺存时 `componentsPageId ?? ''` 改 `?? undefined` + 条件性 spread；组件缺失错误者加 custom 兑底提示；`listDocumentLibraryNames` 递归；重复 key 警告；fetch 错误 dialog 表面化；resubmit hint 改为 marker-aware；revdeps guard、profile 切换锁、重绑定测试补齐；00-overview + AGENTS.md 补生成命令与 look/vision。
  - **驳回**（实习生误读）："P0 resolveExistingDesign 清空别人"（代码本有善）；P0 空串“写不出 Components 页面”（setup 会立即重解析）；“replaceMarketingLibrary 不重 bind”（`bindMarketingLibrary` 以对象 identité 判定本来就重绑，加了重绑定测试为证）；"[素材类型] 未交付"（L3 chips 已完成）；profile “非确定性”（文件顺序恒定）；stripLibraryMarkerTexts 误剥（正则只严匹配 `readonly:`）。
- **测试**：marketing 引擎测试（brief / library / setup / validate / restore / clone / look / registry）、生成器回环测试、render 净化测试、app 层 marketing-library 测试——全绿；`lint` 无新增错误（修复了一处组件例外话后的复杂度超限与 restore 的重复 import）；`tsgo` / `check:vue` / `check:i18n` / `check:arch`(steiger) / `test:dupes` / `test:tools` 全绿；app 测试组 26/28（`figma-images` / `cli/eval` 两个文件在本机基线上同样卡死，环境存量问题，与本次改动无关）。具体条数随每次 commit 浮动，建议直接看 `bun test` 输出而非锁死数字。

### 9.4 P8 修复：profile 显式选择（2026-08-03/04 ⏳ 进行中）

**评审依据**：`../../review/2026-08-01-marketing-workbench-branch-review.md` §2.5.8（产品分析 + 建议）+ §2.4 P8（风险行）+ §3.2 第 4 项（profile 双源镜像）+ §五 阶段 1.2 第 3 项（执行指令）。

**设计原则**（用户拍板，2026-08-03 补充；2026-08-04 收紧）：
> **只有当用户指定了 profile，所有跟 profile 相关的信息才进入到 agent 的上下文中；静态 system prompt 完全不提 profile；setup 工具不返回任何 profile 信息。**

三个层级的"profile 不在场"语义：
1. **静态 system prompt**（常驻）——完全不提 profile；profile 不作为 prompt 的常驻概念存在。
2. **动态 overlay**（每轮拼接）——仅当 user-picked profile 时注入 "Active style profile: <id>" 段 + markdown；否则不输出任何 profile 段。
3. **setup 工具返回值**（一次性结果）——不返回 `activeProfileId`；不接收 `profile` 参数；profile 是 setup 工具完全不可见的概念。

**根因**：
1. `setup.ts:resolveProfile` 三条静默采用路径（auto-pick / 锁命中 / first fallback），AI 无法区分。
2. `library.ts:bindMarketingLibrary:126-128` 在 `profileSelection.source !== 'user'` 时覆盖写 `undefined`，破坏 user-picked profile。
3. `MarketingConfigBar` chip 的 "Auto" 文本表达错误。
4. `buildMarketingOverlay` 始终输出 `## Profiles in the current library` + `## Active style profile: (none)` 段——即使无 user-picked profile 也向 agent 泄漏 profile 目录。
5. `system-prompt-marketing.md` L162 + L172/L193/L202/L206 默认假设 profile 始终在场。
6. `storage.ts` 保留 `source: 'ai'` 分支 + `setAiProfile` 写入路径——P8 后死路径。
7. `tools/index.ts:174` 的 `setActiveProfile` 回调污染 `profileSelection`。
8. **（P8v3 新增）`setup.ts` 的 `activeProfileId` 返回字段 + `profile` 参数让 profile 概念进入 setup 工具表面**——即使 overlay 与 prompt 收紧，AI 看到工具返参里有这个字段仍会去用它。
9. **（P8v3 新增）`ChatPanel.vue` 拼接 `[风格档案]` 块告诉 AI 传 `profile` 参数**——profile v3 移除参数后这块变成误导。

**改动**：

**P8 基础修复**（4 处）：
- `packages/core/src/tools/marketing/setup.ts:resolveProfile` — 删 auto-pick + `(applicable ?? profiles[0])` 兜底（保留 caller-explicit + user-picked 两条路径）
- `src/app/ai/marketing/library.ts:bindMarketingLibrary` — 保留 user-picked profile
- `src/components/chat/MarketingConfigBar.vue` — Profile chip 显式
- `packages/vue/src/i18n/messages/dialogs.ts` + 8 个 locale — 新增 `profileChipUnset` key
- `src/app/ai/chat/system-prompt-marketing.md` L162（事实陈述）

**P8v2 收紧**（5 处）：
- `library.ts:buildMarketingOverlay` — Material types 段始终输出；Profile catalog + Active style 段**仅在 user-picked profile 时**输出
- `system-prompt-marketing.md` L172/L193/L202/L206 — profile 改「可选 binding spec」
- `marketing.ts:setupMaterialTypeTool.profile` — 描述改写
- `tools/index.ts:onToolLog` — 删 `setActiveProfile` 回调
- `storage.ts` — 收紧 type + 删 `setAiProfile`
- `library.ts` — 删 `setActiveProfile` 死路径
- `MarketingConfigBar.vue` — chip 三态 → 二态

**P8v3 全面清理**（4 处，与用户原则对齐）：
- `setup.ts` —— 删 `SetupResult.activeProfileId` 字段；删 `resolveProfile` 函数；删 `setupMaterialType` 的 `profileId` 参数；删 `getMarketingPrefs` import
- `marketing.ts:setupMaterialTypeTool` —— 删 `profile` 参数（含描述）；调整 `execute` 不再传 profile
- `system-prompt-marketing.md` —— 删 L162 整段；L172/L193/L202/L206 改"如果你的 system prompt 包含..."条件性表述
- `ChatPanel.vue:withSelectionContext` —— 删 `[风格档案]` 块；删 `profileSelection` import
- 测试：`setup.test.ts` 重写 3 个 P8 测试为 P8v3 断言（setup 不返回 activeProfileId 字段、不接受 profile 参数、user-picked profile 不影响 setup 结果）

**P8v4 UI 收尾**（Auto 卡片删除）：
- `ProfileGalleryDialog.vue` —— 删 "Auto (no lock)" 卡片（`data-test-id="profile-gallery-auto"`）；删 `pickAuto` 函数；`pick(id)` 参数收紧为 `string`（用户必须显式选一个 profile，auto-pick 已禁用）
- `packages/vue/src/i18n/messages/dialogs.ts` + 8 locale —— 删 `profileGalleryAutoHint` i18n key（无引用方）
- 注：`autoOption` i18n key 保留——被 Type chip 复用，与 profile 无关

**P8v5 MarketingPrefs 体系删除**：
- `registry.ts` —— 删 `MarketingPrefs` interface、`prefs` WeakMap、`setMarketingPrefs` / `getMarketingPrefs` 函数
- `marketing.ts` + `tools/index.ts` —— 删两个 re-export 点
- `library.ts:bindMarketingLibrary` —— 删 prefs 读写分支（profile 状态完全由 `profileSelection` (app ref) 承载，bind 不再缓存）
- 测试：删 2 个 P8v3 "陈旧 lock" 测试（prefs 不存在后无法测）；改写 1 个 bind 测试为 P8v5，断言 chip 切到 unset 立即清除 overlay 中的 profile 段（不再有"陈旧 lock 留存"的隐藏行为）
- **产品语义变化**：用户清除 chip = 立即清除 pick（与 chip UI 直觉一致）。之前 P8v2 设计的"bind 不覆盖陈旧 pick"在 v5 移除——chip 是 single source of truth，其状态就是真实意图。

**故意不做**：
- setActiveProfile 接 store 参数 → 留待多 tab 决策
- MarketingPrefs 持久化（pluginData）→ 同上
- system-prompt 里的 AI 行为改造（如"主动推荐 profile"）→ 留待 v1.5（profile 概念从 prompt 完全移除后，AI 也不会主动推荐——效果免费达成）
- 删除 `inferredTag` i18n key（保留以兼容旧 locale 文案；当前无引用方）

**commit hash**：待最终 commit 后回填

**回滚方案**：单 commit `git revert HEAD`，不破坏 Phase 0 / Phase 1.1 commit

## 10. 阶段路线

| 阶段 | 内容 | 状态 |
|---|---|---|
| **v0.5** | 评审落档 + P0 修复 | ✅ 完成（2026-07-29） |
| **v1 最小可用** | `default-library.fig` 落地（构建期资产注入）；扫库解析（四区 → LibraryIndex + warnings）；`cloneSubtreeAcrossGraphs` 跨文档克隆；`setup_material_type` 读库；profile md 注入 system prompt overlay（app chat 接线）；dialog（默认库常驻 + 上传替换 + references 勾选注入素材区）；`MATERIAL_TYPES` / `matchKeywords` / sectionPlan / styleGuide / min-maxSections / readonly 基线机制拆除；validate 收缩为两类结构校验并脱库；库标识 marker + 启动检测；prompt 修订 | ✅ 完成（2026-07-30，见 §9.3） |
| **v1.5** | 库按 zone 多文件拆分（references 独立）；跨库 profile id 空间 | 远期 |
| **v2** | IndexedDB / 后端持久化库文件免去重复提交；multi-library 组合；自定义库断裂根治 | 远期 |

### v1 任务分解（启动时细化到 README 状态表）

1. `default-library.fig` 制作：7 个预设 type 迁入 Types 区 + BrandBar/CTABar 迁入 Components 区（含 `readonly:` 子文本，Q9）+ 1 个示例 profile + 少量示例 reference；**体积克制**（构建期资产进 web 包，图片保持 placeholder 量级）
2. 扫库解析层：Library .fig → `LibraryIndex { types, profiles, components, references, warnings[] }`（§4 解析契约；zone 定位按页面结构约定，无 pluginData）
3. `cloneSubtreeAcrossGraphs`：跨文档子树克隆——递归建节点 + `cloneNodeProps` + old→new id 映射表 + 子树内 componentId 重映射 + imageHash 内容寻址搬运 + `computeAllLayouts`；含 variables / 嵌套实例的子树拒绝并告警（Q10）
4. `setup_material_type` 改造：读库替代 `MATERIAL_TYPES`；返参精简（§7）+ warnings 带出 + activeProfileId；类型列表出口（L3 chips / setup 错误列表）同源切到 LibraryIndex；custom 兜底保留；修复模式 = 锚点缺失重物化（删实例完整性检查）；unknown-id 错误含自定义库引导（§6.1）
5. 组件物化改造：从库 Components 区经 `cloneSubtreeAcrossGraphs` 克隆到目标文档 Components 页（替代 `component-templates.ts` + 构建器路径，保留 `assets.ts` fallback）
6. readonly 降级落地（Q13）：删 `ReadonlyNodeInfo` / `snapshotReadonlyValues` / `checkReadonly` / `accept` / registry readonly Map / restore 基线重建；`readonly:` 声明进 setup note 与 prompt
7. validate 精简：删 section_count 与 readonly 两类；保留 anchor_deleted / anchor_misplaced，改为从 anchor 记录脱库校验（§6.1）
8. 库标识 marker + 启动检测：根 marker 加 `library` 键；session 启动比对并在 dialog 提示重新提交（§6.1）
9. profile overlay 接线（仅内置 chat）：setup 返回 activeProfileId 后 app 层存下，后续轮次 system prompt 拼接 profile md；中途切换 = 重 setup 刷新
10. web dialog：默认库自动加载 + 上传替换 + references 勾选列表（勾选 → `cloneSubtreeAcrossGraphs` 克隆进参考区页 + 去重 + pluginData 标记；v1 纯文本列表不渲染缩略图）
11. prompt 修订：section 完成提醒强化 + profile / reference（素材区消费）行为说明 + readonly 声明式约束 + 同步改写对 setup 返参 sectionPlan/styleGuide/custom 字段的既有引用
12. 测试：扫库解析与 warnings、克隆（组件 + 图片搬运）、拒绝 variables / 嵌套实例、勾选注入去重、自定义库断裂（validate 脱库 + 启动检测 + 错误引导）、custom 兜底、setup 读库端到端、validate 两类违规回归；**marketing 单测用编程构造的迷你库 graph，不依赖真实 .fig fixture**

# 素材资源库（Library .fig）：重构规划

> 2026-07-29 起草。依据：`../review/2026-07-29-marketing-l2-resources-validate-review.md` §11（架构重构方向，讨论存档）。本规划把该节的方向落成可执行设计；评审第一至十节的现状对照不在此重复。
> 关联设计文档：`l2-agent-mode.md` §3/§4/§5（本规划落地后将修订其素材类型体系与资源体系两章）。
> 2026-07-30 评审修订：Reference 可见性定为 **copy-on-use 注入工作文档"素材区"页**（否决库寻址工具 + 离屏渲染，§5）；增补决策 Q8–Q11（§3）；补库解析契约与克隆机制（§4）；默认库分发与错误分档（§6）；v1 任务重排（§10）。

## 1. 问题陈述：当前 schema 的三层耦合

`MaterialTypeConfig`（`packages/core/src/tools/marketing/material-types.ts:42-54`）把三个性质不同的概念合并在一个配置对象里：

| 概念 | 性质 | 典型内容 | 消费者 |
|---|---|---|---|
| **硬约束** | 物理不变量 | size / anchors / structure.anchors（位置） | `validate` 引用 |
| **风格档案** | 软上下文 | sectionPlan / styleGuide / custom | 注入 prompt，AI 自然语言理解 |
| **参考样例** | 视觉参考，advisory | （schema 里**完全没有 slot**） | AI 用 `look` 自取 |

后果：

1. 换风格必须改整个 MaterialTypeConfig——风格与约束同生共死
2. 用户新增素材类型必须改代码、发版本
3. `min/maxSections` 这种软下限混进了 `structure` 硬约束字段，诱使 validate 去校验本不该代码强制的东西（评审 §4.4 的 minSections 缺口即源于此）
4. reference 整层缺位，与 L1 生图工具的 references 解耦模型（`l1-image-gen-optimize.md`）不对齐

## 2. 目标设计：三关切正交切分

| 维度 | 谁提供 | 存储位置 | 选择权 | 注入方式 |
|---|---|---|---|---|
| **Type**（硬约束） | 库 / 代码兜底 | Library .fig Types 区 | AI 推断 + CP1 user 确认 | `setup_material_type` 工具返回 |
| **Profile**（风格档案） | 用户 / 库 | Library .fig Profiles 区（plain TEXT 节点 = md 内容） | AI 推荐 + CP1 user 切换 | 首次 setup 调用时灌入 system prompt overlay |
| **Reference**（参考样例） | user 主动标记 | Library .fig References 区（plain frame + `for:`/`tag:` 子文本） | user opt-in | setup 返回 availableReferences 索引；AI 选中后 copy-on-use 注入工作文档"素材区"页，按形态消费：位图 = `look`、结构 = `describe` + `look`、纯文本 = 索引直出（§5） |

职责切开：**type 硬、profile 软、reference advisory**。三者独立演化：换风格 = 切 profile，不动 type；加类型 = 库里加 frame，不改代码；参考图 = 用户自己拖进 References 区。

## 3. 七项决策（评审 §11.3 落档）

| # | 议题 | 决定 |
|---|---|---|
| Q1 | library 标识是否需要 pluginData？ | **否**——文件位置 + Library Manager（v1 是 dialog）足够 |
| Q2 | 单库 + 是否需要读写模式切换？ | **单库；编辑就是正常打开 .fig**，无特殊模式，不引入 "Library Editor mode" |
| Q3 | `matchKeywords` 字段是否保留？ | **砍掉**——`id + label + description` 够 LLM 推断 |
| Q4 | 组件（BrandBar/CTABar）是否进库？ | **是**——四区齐全（Types / Profiles / Components / References） |
| Q5 | `MATERIAL_TYPES` 代码种子是否保留？ | **砍掉**——`default-library.fig` ship-with；空库 + custom 兜底 |
| Q6 | profile 注入时机？ | **首次 setup_material_type 调用时**入 system prompt overlay；中途切换 = 重 setup |
| Q7 | references 多到要拆库？ | **暂不拆**——协议层可拆（按区扫库），v1 同文件 |

### 2026-07-30 评审增补决策

| # | 议题 | 决定 |
|---|---|---|
| Q8 | reference 如何对 AI 可见？ | **copy-on-use 注入工作文档"素材区"页**——否决"库寻址工具 + 离屏渲染"：`look` / `describe` / `generate_image` 的 references 都只寻址当前文档 graph（`look.ts:57-79`、`apply.ts:42-51`），给它们加 `ref` 参数 + web 端专用离屏 SkiaRenderer（`headless.ts` 的 `node:url` 是 Node-only）是额外一套基础设施；而跨文档克隆函数为 Components 区必写，注入复用它近乎零新增，且与 L3"素材走画布"（`l3-workbench.md:124`）一致 |
| Q9 | 库组件的 readonly 标记载体？ | **子文本约定**——组件 frame 内放 `readonly: logo, brandName`；`collectComponentReadonlyIds` 按名匹配机制不变 |
| Q10 | 库组件能否用 variables？ | **禁止**——跨文档克隆不迁移变量引用，悬空难排查；扫库时检测进 warnings |
| Q11 | default-library.fig 如何分发？ | **构建期资产**——app 启动读 bytes 注入 core（core 保持无 DOM）；dialog 三选项（§6）；无头入口（MCP / CLI / eval）自动回落默认库 |

## 4. Library .fig 的具体形态

```
[default-library.fig]                ← ship-with，web 版经 dialog 提交；桌面端可复制到 ~/OpenPencil/Libraries/
└── 顶层 Page
    ├── Types 区
    │   └── wechat_moments           ← frame
    │       ├── "id: wechat_moments"     ← 子文本节点（字面值）
    │       ├── "label: 朋友圈广告"
    │       ├── "size: 1080x1080"
    │       ├── "anchor_first: "
    │       └── "anchor_last: "
    ├── Profiles 区
    │   └── casual_v1                ← frame
    │       ├── Text 节点：md 整段内容     ← 一段 plain TEXT，内容即 md
    │       └── Text 节点："applicable_to: wechat_moments, xiaohongshu"
    ├── Components 区
    │   ├── BrandBar                 ← 真正 COMPONENT 节点
    │   │   └── "readonly: logo, brandName"   ← 子文本：readonly 名清单（Q9）
    │   └── CTABar
    └── References 区
        └── ref-product-long-001     ← plain frame
            ├── "for: product_long"
            └── "tag: luxury_v1"
```

约束：

- **全部 plain nodes**——只有用户在画布里能直接操作的形态；`role=library` pluginData 已否决（Q1，位置约定已够）
- 用户编辑 = 正常打开 .fig，无特殊路径（Q2）
- Components 区是真 COMPONENT 节点，物化时跨文档克隆到目标文档的 Components 页面（替代当前 `component-templates.ts` 的代码模板 + 构建器物化路径）
- **解析契约**：zone frame 的子 TEXT 节点按 `key: value` 解析，key 枚举化——Types：`id` / `label` / `size` / `description` / `anchor_first` / `anchor_last`；Profiles：`applicable_to` + md 正文；Components：`readonly`；References：`for` / `tag`。未知 key 忽略并记 warning；`size` 支持 `750x` 空高（height null，长图）；anchor 引用按 Components 区 frame name 匹配
- **warnings 通道**：扫库时一次解析产出 `LibraryIndex { types, profiles, components, references, warnings[] }`；畸形 frame、zone 内重名（first-wins）、anchor 引用未命中、组件含 variables 全部进 warnings，由 setup 返参带出——AI 可转告用户具体修哪一行，而非静默失败
- **库组件禁用 variables**（Q10）——跨文档克隆不迁移变量引用
- **物化机制**：`cloneSubtreeAcrossGraphs`（v1 任务 3）做跨文档子树克隆——递归建节点 + `cloneNodeProps` 拷属性 + old→new id 映射表 + 子树内 componentId 重映射 + imageHash 内容寻址搬运（`targetGraph.images.set`），收尾 `computeAllLayouts`

## 5. Reference 可见性：copy-on-use 注入素材区（2026-07-30 评审决议，Q8）

**问题**：`look` / `describe` / `generate_image` 的 references 都只寻址当前文档 graph——库文件里的 reference 节点 AI 看不见，"AI 用 `look` 自取"原本不成立。

**选定方案：copy-on-use 注入工作文档**。AI 从 `availableReferences` 选中后，用与组件物化同一个 `cloneSubtreeAcrossGraphs` 把 reference frame 克隆进工作文档的"素材区"专用页（`ensureComponentsPage` 同模式），此后按形态消费，全部工具零改动：

| reference 形态 | 消费通道 |
|---|---|
| 位图样例 | `look` |
| 结构类（frame / 矢量 / 排版样例） | `describe` + `look` |
| 纯文本 | 无需注入——扫库时抽 TEXT 内容进 `availableReferences` 索引直出 |

约定：

- **落点**：专用"素材区"页，不进设计画布所在页；`look` / `describe` 按 node id 工作，跨页无碍
- **去重**：session registry 记 `libraryRefId → documentNodeId`；同会话复取返回已有节点，被用户删除后才重新注入
- **标记**：注入节点写 pluginData marker（`restore.ts` 既有模式；Q1 否决的是库文件上的 pluginData，工作文档内的系统标记是正当用途），供清理与"非设计产出"识别
- **可见性**：prompt 要求 AI 取参考时在对话中说明（"从库中取参考 X 放入素材区"）——注入是用户可见的文档变更；reference 本身是 user opt-in，取用无需再确认
- **生命周期**：v1 不自动清理素材区（持久化 = 可复现性资产，用户能看到 AI 用了什么参考）；AI 不修改素材区节点，被改后去重失效重新注入即可，容错自然
- **validate 无干扰**：注入的是 plain frame，不在 marketing root frame 内，结构校验与 readonly 注册表不受影响

## 6. Web-first 实操（评审 §11.5）

用户主要用 web 版测试，自动扫描本地文件不可行：

- marketing session 启动 → 弹 dialog 三选项：「使用默认库」（default-library.fig 随应用分发，一键加载，用户无需持有文件）/「上传自己的 .fig」/「无库继续（仅 custom）」
- 默认库分发（Q11）：default-library.fig 作构建期资产（web `public/` 或 `import ?url`），app 启动读 bytes 调 core 暴露的注入接口——core 保持无 DOM；无头入口（MCP / CLI / eval）无 dialog，自动回落默认库
- 选定后扫库 + 注入 + 后续行为不变
- 跨会话不持久化（每次重新提交）；v2 再考虑 IndexedDB / 后端持久化
- 桌面端同等使用 dialog；不实现 automatic folder watch
- 编辑库不需要特殊工具——直接打开 .fig 即可

`custom` 兜底始终可达：用户说"做 1080×1440" → AI 直接 `setup_material_type({ id: "custom", width: 1080, height: 1440 })`，不要求存在预定义 type。错误信息分档：库未加载时 setup 的 unknown-id 错误明说"仅 custom 可用"；库已加载时列库内类型。

## 7. 迁移路径（现状 → library）

| 现状 | 落到 library 后 |
|---|---|
| `MATERIAL_TYPES` const 数组（material-types.ts） | Library .fig Types 区；代码只留扫库 + 解析 |
| `listMaterialTypes()` | 扫库 + 合成 |
| `component-templates.ts` BrandBar/CTABar | Library .fig Components 区（跨文档复制物化） |
| `assets.ts` 的 `brand-logo` 内置 base64 | Library .fig 资产 + 内置 fallback |
| profile（待新加） | Library .fig Profiles 区 |
| reference（待新加） | Library .fig References 区 + copy-on-use 注入素材区（§5） |
| `matchKeywords` 字段 | 删（用 label + description） |
| `sectionPlan / styleGuide / custom`（type 内字段） | 删（迁入 profile.md，由 AI 自然语言理解） |
| `min/maxSections` | 删（validate 同步删除 section_count 校验类型） |

**validate 精简**：section_count 整类删除；保留 readonly_modified / readonly_deleted / anchor_deleted / anchor_misplaced 四类。

**setup_material_type 返参精简**：删 bundled sectionPlan/styleGuide/custom；加 availableReferences 列表 + activeProfileId 指针（profile 内容**不进返回值**，由 setup 调用时灌入 system prompt overlay）。

## 8. 既有评审建议项的复核结论

| 评审结论 | 本规划下的处置 |
|---|---|
| P0: render 不挂 recordInstanceOverrides | ✅ **已修复（2026-07-29）**——见 §9.1；与库架构独立 |
| P1: 加 minSections 校验 | ❌ **撤销**——min/max 字段整体删除，section_count 校验类型去除（§7） |
| P1: 扩 readonly 快照范围（width/height/visibility/opacity） | ✅ 保留，随 v1 实施——`builder.ts:160` 快照数组扩展 |
| P2: accept=true 范围澄清（prompt 注明只刷 readonly_modified） | ✅ 保留，随 v1 prompt 修订 |
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

## 10. 阶段路线

| 阶段 | 内容 | 状态 |
|---|---|---|
| **v0.5** | 评审落档 + P0 修复 | ✅ 完成（2026-07-29） |
| **v1 最小可用** | `default-library.fig` 落地；扫库解析（四区 → LibraryIndex + warnings）；`cloneSubtreeAcrossGraphs` 跨文档克隆；`setup_material_type` 读库；profile md 注入 system prompt overlay；reference copy-on-use 注入素材区；`MATERIAL_TYPES` / `matchKeywords` / sectionPlan / styleGuide / min-maxSections 拆除；validate 删 section_count；readonly 快照扩展；prompt 两处澄清；web dialog 三选项 + 默认库注入 | ⬜ 待启动 |
| **v1.5** | 库按 zone 多文件拆分（references 独立）；跨库 profile id 空间 | 远期 |
| **v2** | IndexedDB / 后端持久化库文件免去 web 重复上传；multi-library 组合 | 远期 |

### v1 任务分解（启动时细化到 README 状态表）

1. `default-library.fig` 制作：7 个预设 type 迁入 Types 区 + BrandBar/CTABar 迁入 Components 区（含 `readonly:` 子文本，Q9）+ 1 个示例 profile + 示例 reference + 空 References 区约定
2. 扫库解析层：Library .fig → `LibraryIndex { types, profiles, components, references, warnings[] }`（§4 解析契约；zone 定位按页面结构约定，无 pluginData；纯文本 reference 抽 TEXT 内容进索引）
3. `cloneSubtreeAcrossGraphs`：跨文档子树克隆——递归建节点 + `cloneNodeProps` + old→new id 映射表 + 子树内 componentId 重映射 + imageHash 内容寻址搬运 + `computeAllLayouts`；含 variables 的子树拒绝并告警（Q10）
4. `setup_material_type` 改造：读库替代 `MATERIAL_TYPES`；返参精简（§7）+ availableReferences 索引 + warnings 带出；profile 注入 system prompt overlay（Q6）；unknown-id 错误按库加载与否分档
5. 组件物化改造：从库 Components 区经 `cloneSubtreeAcrossGraphs` 克隆到目标文档 Components 页，按 `readonly:` 子文本注册 readonly 基线（替代 `component-templates.ts` + 构建器路径，保留 `assets.ts` fallback）
6. Reference 注入（§5）：素材区页（`ensureComponentsPage` 同模式）、copy-on-use、`libraryRefId → documentNodeId` 去重、pluginData 标记、注入告知 prompt
7. validate 精简：删 section_count 分支与 `min/maxSections` 字段；扩 readonly 快照至 `['fills', 'width', 'height', 'visible', 'opacity']`（TEXT 另含 text/fontSize/fontWeight）
8. prompt 修订：accept=true 范围澄清 + section 完成提醒强化 + profile/reference 行为说明 + 同步改写对 setup 返参 sectionPlan/styleGuide/custom 字段的既有引用
9. web dialog 三选项 + 默认库 bytes 注入（Q11）；不持久化
10. 测试：扫库解析与 warnings、克隆（组件 + 嵌套实例 + 图片搬运）、注入去重与被删重注、库缺区/空库兜底、custom 兜底、setup 读库端到端、validate 精简后四类违规回归

## 11. 与 L3 品牌包的对齐

`l3-workbench.md:41` 的"品牌规范：一次配置、永久生效"在 Library .fig 形态下概念统一：

- 品牌包 = library 中的若干 profile（`brand_acme_official` / `brand_acme_casual` …）
- 库文件可分享 = 品牌包分发的天然载体
- library 既是**素材库**也是**品牌包**——单一载体，L3 品牌包不再另起存储机制
- reference 注入"素材区"页与 L3「素材走画布」（`l3-workbench.md:124`）是同一习惯——L2 reference 体系与 L3 素材盘共用画布载体，素材区页约定直接前移

# 素材资源库（Library .fig）：重构规划

> 2026-07-29 起草。依据：`../review/2026-07-29-marketing-l2-resources-validate-review.md` §11（架构重构方向，讨论存档）。本规划把该节的方向落成可执行设计；评审第一至十节的现状对照不在此重复。
> 关联设计文档：`l2-agent-mode.md` §3/§4/§5（本规划落地后将修订其素材类型体系与资源体系两章）。
> 2026-07-30 评审修订（执行 ready）：Reference 定为**用户在 dialog 勾选后注入素材区**（无 AI 工具面）；运行范围收敛为**仅内置 AI chat**（MCP / CLI / ACP 暂不考虑）；默认库常驻，无库态消失；**readonly 降级为声明式元数据 + prompt 约束**，运行时基线校验机制删除；validate 脱库自检 + 库标识 marker 解决自定义库重开断裂。全部决策见 §3 Q1–Q13。

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
4. reference 整层缺位，与 L1 生图工具的 references 解耦模型（`../architecture/l1-image-gen.md`）不对齐

## 2. 目标设计：三关切正交切分

| 维度 | 谁提供 | 存储位置 | 选择权 | 注入方式 |
|---|---|---|---|---|
| **Type**（硬约束） | 库 / 代码兜底 | Library .fig Types 区 | AI 推断，或用户手动选择（L3 类型 chips，已实现） | `setup_material_type` 工具返回 |
| **Profile**（风格档案） | 用户 / 库 | Library .fig Profiles 区（plain TEXT 节点 = md 内容） | **用户显式选择**（MarketingConfigBar Profile chip），未选择 = 无 profile（"是否使用"与"使用哪个"两个决策都归用户）；旧"AI 推荐 + CP1 人确认"流程留待未来按需启用（触发条件见 review §2.5.8） | 用户显式选定后才灌入 system prompt overlay（仅内置 chat 通道，Q12）；无 profile → overlay 输出 `(none)` 提示 |
| **Reference**（参考样例） | user 主动标记 | Library .fig References 区（plain frame + `applicable_to` / `tag` 子文本） | **仅用户选择**（session 启动 dialog 勾选） | 勾选后 app 克隆进工作文档「参考区」页；AI 按既有需求单"素材区" zone 流程消费：位图 = `look`、结构 = `describe` + `look`（§5——参考区页 ≠ brief 内的素材区 zone） |

职责切开：**type 硬、profile 软、reference advisory**。三者独立演化：换风格 = 切 profile，不动 type；加类型 = 库里加 frame，不改代码；参考图 = 用户自己拖进 References 区。

## 3. 决策表

### 七项决策（评审 §11.3 落档）

| # | 议题 | 决定 |
|---|---|---|
| Q1 | library 标识是否需要 pluginData？ | **否**——文件位置 + Library Manager（v1 是 dialog）足够 |
| Q2 | 单库 + 是否需要读写模式切换？ | **单库；编辑就是正常打开 .fig**，无特殊模式，不引入 "Library Editor mode" |
| Q3 | `matchKeywords` 字段是否保留？ | **砍掉**——`id + label + description` 够 LLM 推断 |
| Q4 | 组件（BrandBar/CTABar）是否进库？ | **是**——四区齐全（Types / Profiles / Components / References） |
| Q5 | `MATERIAL_TYPES` 代码种子是否保留？ | **砍掉**——`default-library.fig` ship-with；custom 兜底 |
| Q6 | profile 注入时机？ | **首次 setup_material_type 调用时**入 system prompt overlay；中途切换 = 重 setup（范围：仅内置 chat，Q12） |
| Q7 | references 多到要拆库？ | **暂不拆**——协议层可拆（按区扫库），v1 同文件 |

### 2026-07-30 评审增补决策

| # | 议题 | 决定 |
|---|---|---|
| Q8 | reference 如何对 AI 可见？ | **用户 dialog 勾选 → app 克隆进素材区页**——否决 AI 工具面（reference 只能用户选，不需要 `use_reference` 之类的工具）与"库寻址工具 + 离屏渲染"（`look` / `describe` / `generate_image` 只寻址当前文档 graph，给它们加 `ref` 参数 + web 端专用离屏 SkiaRenderer 是额外一套基础设施）。AI 消费素材区是 marketing prompt 既有流程，零新机制，且与 L3"素材走画布"（`l3-workbench.md:124`）一致 |
| Q9 | 库组件的 readonly 标记载体？ | **子文本约定**——组件 frame 内放 `readonly: logo, brandName`；消费者是 prompt / setup note（声明式），**不做运行时基线校验**（Q13） |
| Q10 | 库组件能否用 variables / 嵌套实例？ | **都禁止**——跨文档克隆不迁移变量引用；嵌套实例使 componentId 重映射跨组件依赖化。扫库检测进 warnings |
| Q11 | default-library.fig 如何分发？ | **构建期资产**——app 启动读 bytes 注入 core（core 保持无 DOM）；默认库常驻，**无库态不存在**；不做无头入口回落（Q12） |
| Q12 | 营销场景的运行入口范围？ | **仅内置 AI chat**——MCP / CLI / ACP 暂不考虑，不为它们做库加载、profile 注入或错误回落 |
| Q13 | readonly 运行时校验是否保留？ | **降级为声明式元数据 + prompt 约束**——快照 / 基线 / `accept` / 基线重建机制删除；validate 收缩为 anchor_deleted / anchor_misplaced 结构校验。失败可见可恢复（prompt 约束 + 实例不透明容器 + Phase 4 视觉终检 + 用户随时可让 AI 改回）；registry 架构保留，将来要加回校验只是重新填充它 |
| Q14 | 无匹配 profile 时是否静默套用首个？ | **否**——P8 修复落地（2026-08-03，review §2.5.8 / §阶段 1.2 第 3 项）。`setup.ts:resolveProfile` 取消 auto-pick + `(applicable ?? profiles[0])` 兜底；无 user-picked profile 且无 caller 显式 id 时返回 `{}`（不挂载任何 activeProfileId），由 `buildMarketingOverlay` 输出 `(none)` 提示，由 `MarketingConfigBar` chip 显式渲染"未选"虚线灰状态。**只有"用户已在 config bar 显式选择 profile"或"调用方传 `profile` 参数"两条路径才会挂载 profile**——与"约束 + AI 自由"范式中"用户掌控约束"自洽 |

## 4. Library .fig 的具体形态

```
[default-library.fig]                ← ship-with 构建期资产，app 启动注入（Q11）；体积克制
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
    │   │   └── "readonly: logo, brandName"   ← 子文本：readonly 名清单（Q9；声明式，消费者为 prompt）
    │   └── CTABar
    └── References 区
        └── ref-product-long-001     ← plain frame
            ├── "applicable_to: product_long"
            └── "tag: luxury_v1"
```

约束：

- **全部 plain nodes**——只有用户在画布里能直接操作的形态；`role=library` pluginData 已否决（Q1，位置约定已够）
- 用户编辑 = 正常打开 .fig，无特殊路径（Q2）
- Components 区是真 COMPONENT 节点，物化时跨文档克隆到目标文档的 Components 页面（替代当前 `component-templates.ts` 的代码模板 + 构建器物化路径）
- **解析契约**：zone frame 的子 TEXT 节点按 `key: value` 解析，key 枚举化——Types：`id` / `label` / `size` / `description` / `anchor_first` / `anchor_last`；Profiles：`applicable_to` + md 正文；Components：`readonly`；References：`applicable_to` / `tag`。未知 key 忽略并记 warning；`size` 支持 `750x` 空高（height null，长图）；anchor 引用按 Components 区 frame name 匹配
- **warnings 通道**：扫库时一次解析产出 `LibraryIndex { types, profiles, components, references, warnings[] }`；畸形 frame、zone 内重名（first-wins）、anchor 引用未命中、组件含 variables / 嵌套实例全部进 warnings，由 setup 返参带出——AI 可转告用户具体修哪一行，而非静默失败
- **库组件禁用 variables 与嵌套实例**（Q10）——跨文档克隆不迁移变量引用；嵌套实例使 componentId 重映射跨组件依赖化
- **物化机制**：`cloneSubtreeAcrossGraphs`（v1 任务 3）做跨文档子树克隆——递归建节点 + `cloneNodeProps` 拷属性 + old→new id 映射表 + 子树内 componentId 重映射 + imageHash 内容寻址搬运（`targetGraph.images.set`），收尾 `computeAllLayouts`

### 4.1 2026-08-11 形态更新（海报感实验落地）

- **Profiles 区扩为 6 个**（`casual_v1` / `watercolor_poster_v0` / `watercolor_poster_v1` / `editorial_poster_v1` / `solid_poster_v1` / `watercolor_poster_v1_center_left`），海报系 profile 采用**三段式风格系统**（`## Fixed system` 不变量 / `## Variable system` 离散轴 / `## Anti-identity` 反模式）+ `## Visual environment setup (Phase 2.5)` 工序节——方法论依据见 `docs/research/2026-08-11-poster-quality-methodology-borrow.md`；`watercolor_poster_v0` 是方法论对照组（扁平四件套冻结基线，测试含反向断言防"升级"污染）
- **Profile 自包含规则（硬约束）**：profile markdown 是用户选中后**唯一**注入 agent 上下文的 profile 内容（`buildMarketingOverlay` 只注入选中者、目录不泄漏）——因此必须自包含，禁止跨 profile 引用（"read X first" 在运行时不可达）、禁止实验脚手架信息（对照组身份、A/B 目的、baseline 标签）。该规则源于三次同型的"注入面污染"（详见 `../knowledge/error-catalog.md` 错误分类约定），由 `tools/marketing-library/tests/generate.test.ts` 的跨引用守卫测试强制执行
- **Types 区锚点声明移除**：`anchor_first` / `anchor_last` 解析契约保留（机制与 Components 区均在），但 shipped 预设类型暂不再声明锚点——锚点机制待重新设计
- **条目横向排版**：生成器跑一次真实布局后把各区条目**横向**排列（长 profile 文本的真实高度只在 app 内测量才存在，纵向堆叠会互相压盖）；page 级坐标不持久化（.fig 不保存 page 位置）
- **同步守卫**：`generate.test.ts` 含 shipped `.fig` 与生成器的内容级同步健康检查——改了 `generate.ts` 忘跑 `bun run generate` 会测试红

## 5. Reference：用户勾选注入素材区（2026-07-30 评审决议，Q8）

**问题**：`look` / `describe` / `generate_image` 的 references 都只寻址当前文档 graph（`look.ts:57-79`、`apply.ts:42-51`）——库文件里的 reference 节点 AI 看不见。

**选定方案：用户在 dialog 勾选，app 注入工作文档"素材区"页**。reference 只能由用户选择（§2），因此注入是用户手势而非 AI 工具调用：

- session 启动 dialog 列出库 References 区（名称 + applicable_to + tag，v1 纯文本列表，不渲染缩略图），用户勾选
- app 用 `cloneSubtreeAcrossGraphs` 把选中 frame 克隆进"参考区"专用页（`ensureComponentsPage` 同模式；页名命名上特意避开 brief 的"素材区" zone 以免画布里两个同名实体）；所有勾选项统一注入（纯文本 reference 也是 frame）
- AI 零新机制：marketing prompt 既有"素材理解"步骤（`look` 素材区）自动覆盖注入的 reference；位图 = `look`，结构 = `describe` + `look`

约定：

- **落点**：专用"参考区"页（不与 brief 内"素材区" zone 同名），不进设计画布所在页；`look` / `describe` 按 node id 工作，跨页无碍
- **去重**：实际状态存在"参考区"页节点的 `library-ref` pluginData marker 上（`restore.ts:libraryReferenceId`）——天然 per-graph，跨会话与重开文档都生效；同会话重复勾选返回已有节点，被用户删除后才重新注入（实现：`packages/core/src/tools/marketing/library.ts:listInjectedReferenceIds`）
- **标记**：注入节点写 pluginData marker（`restore.ts` 既有模式；Q1 否决的是库文件上的 pluginData，工作文档内的系统标记是正当用途），供清理与"非设计产出"识别
- **AI 不修改素材区节点**——它是"参考"不是"素材"；被改后去重失效重新注入即可，容错自然
- **生命周期**：v1 不自动清理参考区页（持久化 = 可复现性资产）；重开后 reference 作为 plain frame 自然留存，AI 重扫参考区页即可，无跨会话还原工作
- **validate 无干扰**：注入的是 plain frame，不在 marketing root frame 内，结构校验与锚点记录不受影响

## 6. Web-first 实操（评审 §11.5）

用户主要用 web 版测试，自动扫描本地文件不可行：

- **默认库常驻（Q11）**：default-library.fig 作构建期资产（web `public/` 或 `import ?url`），app 启动读 bytes 调 core 暴露的注入接口——core 保持无 DOM。**无库态不存在**：类型 chips、setup 类型列表永远有数据
- marketing session 启动 → dialog：默认库自动加载；「上传自己的 .fig 替换」为可选动作；dialog 同时列出 References 区供勾选（§5）
- 运行范围：**仅内置 AI chat**（Q12）——MCP / CLI / ACP 不做库加载与回落
- 跨会话不持久化（自定义库每次重新提交）；v2 再考虑 IndexedDB / 后端持久化
- 桌面端同等使用 dialog；不实现 automatic folder watch
- 编辑库不需要特殊工具——直接打开 .fig 即可

`custom` 兜底始终可达：用户说"做 1080×1440" → AI 直接 `setup_material_type({ id: "custom", width: 1080, height: 1440 })`，不要求存在预定义 type。

### 6.1 重开文档与自定义库断裂（2026-07-30 修正）

默认库常驻消灭"无库"，但消灭不了"**错的库**"：

| 场景 | 重开后状态 |
|---|---|
| 默认库制作 + 默认库在 | 不断裂 |
| 自定义库制作 + 重新提交同一库 | 不断裂 |
| 自定义库制作 + 只有默认库（或提交了不含该 type 的另一个库） | **断裂**——marker 里的 type id 解析不到，setup 修复模式报 unknown type |

v1 无法根除（跨会话不持久化），做**可检测、可引导**：

- **validate 脱库自检**：结构校验从 restore 的 anchor 记录推导期望位置（marker 存 template + position；`top ↔ first`、`bottom ↔ last` 恒对应），不读 type 配置——库错了 validate 两类检查照常工作，断裂被压缩到只剩"修复 / 重物化"动作
- **修复必须有对的库**：重物化要从库 Components 区克隆组件定义，库不在则物理无源——这是物理约束不是设计缺陷
- **库标识 marker**：根 frame marker 加第六键 `library`（提交时的文件名）；session 启动（restore 懒重建后）比对文档引用库与当前库，不匹配 → dialog 提示"本文档由库 'xxx.fig' 制作，请重新提交该库以继续"
- setup 修复模式 unknown-id 错误分一档："类型 'xxx' 不在当前库中——若此设计由自定义库制作，请重新提交"
- **v2 持久化根治**：库跟着文档走，连检测都不需要

## 11. 与 L3 品牌包的对齐

> 2026-08-01 修订：确认**品牌包载体 = library**（既有四区形态），且品牌"自动挂载"机制已由
> type→组件 实现（载体即应用）。剩余缺口收敛为：多品牌 / 数据维度 / 用户视角 / 沉淀迭代机制
> （后者仅规划、缓做）。本节据此改写，替代旧"品牌包 = 若干 profile"的表述。

`l3-workbench.md:41` 的"品牌规范：一次配置、永久生效"在 Library .fig 形态下概念统一：

- **品牌包 = library**（Types + Profiles + Components + References 四区的组合），不再另起存储机制
- **载体即应用**：用户说"做个朋友圈广告" → `setup_material_type(wechat_moments)` → type 规格参数（尺寸/结构）生效，同时引用的锚点组件（BrandBar/CTABar，内嵌 logo 字节 + readonly 品牌名声明）被自动物化进根 frame——**品牌资产随 type→组件这条线自动挂载，用户无需重新解释品牌**。这是"自动带上品牌包"的执行路径，已实现（L3 §3.3 修订）
- 库文件可分享 = 品牌包分发的天然载体；`readonly:` 声明 = 品牌包的"禁改清单"
- reference 注入"参考区"页与 L3「素材走画布」（`l3-workbench.md:124`）是相辅的习惯——L2 reference 体系跟 L3 素材盘共用画布载体但用了区别名（参考区 vs brief 的素材区 zone）避免画布里重名

### 11.1 已确认的边界（品牌包应用机制不欠账）

- **品牌自动挂载**：type 规格 + 引用组件 → 已实现（见上）
- **品牌硬约束校验**：尺寸 / 锚点位置 / readonly 组件 → `validate` 已覆盖
- 因此**不需要另做"品牌包应用层"**；profile 的软维度（色/字/语气）维持 prompt 注入

### 11.2 真缺口清单

| 缺口 | 现状 | 是否动 library schema |
|---|---|---|
| 品牌自动挂载 | type→组件 已实现 | 否 |
| 品牌硬约束校验 | validate 覆盖（锚点/readonly 组件） | 否 |
| **数据维度**：产品图库 / 禁用元素 / 合规规则 | 不在四区 schema | 是（新区或约定） |
| **品牌软约束代码校验**（色/字/语气） | 仅 prompt | 可选（复用 validate 思路） |
| **用户视角**：从"库管理"到"我的品牌" | 无 | 否（UI 层） |

已决策项：**多品牌并存** = v1 一库=一品牌（§11.4）。**沉淀/生长/迭代机制**详见 §11.3（规划，缓做）。状态追踪统一归 `README.md`，本表不重复。

### 11.3 沉淀/生长/迭代机制（规划，缓做）

目标：品牌包从"手写静态 markdown"变成"随使用自动生长"，但**永不覆盖用户手写内容**。

- **数据源**：用户"好看"的稿子、用户反复改回的颜色/字体/间距、用户上传并采用的素材
- **触发点**：交付后反馈（保留 👍 / "换一版"时改了什么）
- **落点**：profile 旁新增"自动沉淀区"——机器生成的 profile 版本（如 `brand_acme_auto_v3`），与手写 profile 并列；setup 优先级：**用户显式选择**（P8 唯一通路，2026-08-04；无用户 pick 时 setup 不挂载任何 profile）**> 自动沉淀版 > 手写版**（沉淀机制启动后）
- **迭代**：多版本并存、对比展示、一键采纳/回滚；"换一版"历史聚类出风格方向
- **边界**：自动沉淀永不修改手写 profile，仅在手写缺席或用户采纳时生效

### 11.4 产品决策：多品牌（已定：v1 一库=一品牌）

> 2026-08-01 决策：**v1 一库=一品牌**（切换库文件即切品牌）。不引入 per-design 品牌选择层，避免改 profile 选择层与注册表键控。"我的品牌"管理 UI 归入用户视角缺口，沉淀机制相应缓做。

## 12. 待决

开放议题（按优先级排；状态追踪统一归 `README.md`，本表不重复）：

| 议题 | 建议方向 | 阻塞/可延 |
|---|---|---|
| **数据维度**（产品图库 / 禁用元素 / 合规规则） | 不在四区 schema，需新区或约定；具体形态待启动 | **阻塞**：多品牌启动前需定 |
| **品牌软约束代码校验**（色/字/语气） | 可选（复用 validate 思路）；不实现也不影响 v1 | 可延 |
| **用户视角**（"我的品牌"管理 UI） | 独立产品视角；与"库管理"解耦 | 可延 |
| **沉淀/生长/迭代机制** | 详见 §11.3（规划，缓做） | 🅿 缓做 |
| **多品牌并存** | ✅ 已决策 v1 一库=一品牌（§11.4） | — |

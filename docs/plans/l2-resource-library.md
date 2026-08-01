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
4. reference 整层缺位，与 L1 生图工具的 references 解耦模型（`l1-image-gen-optimize.md`）不对齐

## 2. 目标设计：三关切正交切分

| 维度 | 谁提供 | 存储位置 | 选择权 | 注入方式 |
|---|---|---|---|---|
| **Type**（硬约束） | 库 / 代码兜底 | Library .fig Types 区 | AI 推断，或用户手动选择（L3 类型 chips，已实现） | `setup_material_type` 工具返回 |
| **Profile**（风格档案） | 用户 / 库 | Library .fig Profiles 区（plain TEXT 节点 = md 内容） | AI 推荐 + CP1 人确认，或用户手动选择（v1 走对话确认，UI 化归 L3） | 首次 setup 调用时灌入 system prompt overlay（仅内置 chat 通道，Q12） |
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

| 缺口 | 现状 | 是否动 library schema | 状态 |
|---|---|---|---|
| 品牌自动挂载 | type→组件 已实现 | 否 | ✅ 已确认 |
| 品牌硬约束校验 | validate 覆盖（锚点/readonly 组件） | 否 | ✅ 已确认 |
| **多品牌并存** | 一库=一品牌；切换库文件即切品牌 | 否（应用/选择层） | ✅ 已决策 v1 一库=一品牌（§11.4） |
| **数据维度**：产品图库 / 禁用元素 / 合规规则 | 不在四区 schema | 是（新区或约定） | 待启动 |
| **品牌软约束代码校验**（色/字/语气） | 仅 prompt | 可选（复用 validate 思路） | 待定 |
| **用户视角**：从"库管理"到"我的品牌" | 无 | 否（UI 层） | 待启动 |
| **沉淀/生长/迭代机制** | 无 | 是（profile 旁自动沉淀区） | 🅿 规划，缓做（§11.3） |

### 11.3 沉淀/生长/迭代机制（规划，缓做）

目标：品牌包从"手写静态 markdown"变成"随使用自动生长"，但**永不覆盖用户手写内容**。

- **数据源**：用户"好看"的稿子、用户反复改回的颜色/字体/间距、用户上传并采用的素材
- **触发点**：交付后反馈（保留 👍 / "换一版"时改了什么）
- **落点**：profile 旁新增"自动沉淀区"——机器生成的 profile 版本（如 `brand_acme_auto_v3`），与手写 profile 并列；setup 优先级：**用户显式指定 > 自动沉淀版 > 手写版**
- **迭代**：多版本并存、对比展示、一键采纳/回滚；"换一版"历史聚类出风格方向
- **边界**：自动沉淀永不修改手写 profile，仅在手写缺席或用户采纳时生效

### 11.4 产品决策：多品牌（已定：v1 一库=一品牌）

> 2026-08-01 决策：**v1 一库=一品牌**（切换库文件即切品牌）。不引入 per-design 品牌选择层，避免改 profile 选择层与注册表键控。"我的品牌"管理 UI 归入用户视角缺口，沉淀机制相应缓做。

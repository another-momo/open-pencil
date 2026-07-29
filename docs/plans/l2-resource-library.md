# 素材资源库（Library .fig）：重构规划

> 2026-07-29 起草。依据：`../review/2026-07-29-marketing-l2-resources-validate-review.md` §11（架构重构方向，讨论存档）。本规划把该节的方向落成可执行设计；评审第一至十节的现状对照不在此重复。
> 关联设计文档：`l2-agent-mode.md` §3/§4/§5（本规划落地后将修订其素材类型体系与资源体系两章）。

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
| **Reference**（参考样例） | user 主动标记 | Library .fig References 区（plain frame + `for:`/`tag:` 子文本） | user opt-in | setup 返回 availableReferences；AI 用 `look` 自取 |

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
    │   └── CTABar
    └── References 区
        └── ref-product-long-001     ← plain frame
            ├── "for: product_long"
            └── "tag: luxury_v1"
```

约束：

- **全部 plain nodes**——只有用户在画布里能直接操作的形态；`role=library` pluginData 已否决（Q1，位置约定已够）
- 用户编辑 = 正常打开 .fig，无特殊路径（Q2）
- Components 区是真 COMPONENT 节点，物化时跨文档复制到目标文档的 Components 页面（替代当前 `component-templates.ts` 的代码模板 + 构建器物化路径）

## 5. Web-first 实操（评审 §11.5）

用户主要用 web 版测试，自动扫描本地文件不可行：

- marketing session 启动 → 弹 dialog：「拖入 / 选择一个 .fig 作为素材库」/「继续，无库」
- 选定后扫库 + 注入 + 后续行为不变
- 跨会话不持久化（每次重新提交）；v2 再考虑 IndexedDB / 后端持久化
- 桌面端同等使用 dialog；不实现 automatic folder watch
- 编辑库不需要特殊工具——直接打开 .fig 即可

`custom` 兜底始终可达：用户说"做 1080×1440" → AI 直接 `setup_material_type({ id: "custom", width: 1080, height: 1440 })`，不要求存在预定义 type。

## 6. 迁移路径（现状 → library）

| 现状 | 落到 library 后 |
|---|---|
| `MATERIAL_TYPES` const 数组（material-types.ts） | Library .fig Types 区；代码只留扫库 + 解析 |
| `listMaterialTypes()` | 扫库 + 合成 |
| `component-templates.ts` BrandBar/CTABar | Library .fig Components 区（跨文档复制物化） |
| `assets.ts` 的 `brand-logo` 内置 base64 | Library .fig 资产 + 内置 fallback |
| profile（待新加） | Library .fig Profiles 区 |
| reference（待新加） | Library .fig References 区 |
| `matchKeywords` 字段 | 删（用 label + description） |
| `sectionPlan / styleGuide / custom`（type 内字段） | 删（迁入 profile.md，由 AI 自然语言理解） |
| `min/maxSections` | 删（validate 同步删除 section_count 校验类型） |

**validate 精简**：section_count 整类删除；保留 readonly_modified / readonly_deleted / anchor_deleted / anchor_misplaced 四类。

**setup_material_type 返参精简**：删 bundled sectionPlan/styleGuide/custom；加 availableReferences 列表 + activeProfileId 指针（profile 内容**不进返回值**，由 setup 调用时灌入 system prompt overlay）。

## 7. 既有评审建议项的复核结论

| 评审结论 | 本规划下的处置 |
|---|---|
| P0: render 不挂 recordInstanceOverrides | ✅ **已修复（2026-07-29）**——见 §8.1；与库架构独立 |
| P1: 加 minSections 校验 | ❌ **撤销**——min/max 字段整体删除，section_count 校验类型去除（§6） |
| P1: 扩 readonly 快照范围（width/height/visibility/opacity） | ✅ 保留，随 v1 实施——`builder.ts:160` 快照数组扩展 |
| P2: accept=true 范围澄清（prompt 注明只刷 readonly_modified） | ✅ 保留，随 v1 prompt 修订 |
| P2: prompt "after completing each section" 显式章节提醒 | ✅ 保留，随 v1 prompt 修订 |
| 评审 §3.2 "三层映射" 表 | ❌ 由本规划 §2 的三关切表取代 |

## 8. 实施记录与状态

> 任务进度以 `README.md` 为唯一状态来源；本节只记录已落档的实施事实。

### 8.1 P0 修复：render 路径实例 override 保留（2026-07-29 ✅）

评审 §3.3 指出 render 工具未挂 `recordInstanceOverrides`。实施时按 sync 引擎实际行为对补法做了修正：

- **真实损伤机制**：`render({ replace_id })` / `node_replace_with` 替换实例内已映射子节点时，新节点丢失 `componentId` 映射 → 下次组件 sync 把原组件子节点重新克隆回来，AI 的替换内容看似被"冲掉"（且出现重复节点）。评审建议的"renderer 内对每个新建节点记录 overrides"对此无效（新节点无映射，override 键不会被 sync 查阅）；而纯 `parent_id` 新增路径无需处理（未映射节点本身不被 sync 触碰）。
- **实际补法**：新增 `preserveInstanceChildReplacement`（`packages/core/src/tools/instance-overrides.ts`）——替换发生时把旧节点的 `componentId` 映射转移到新节点，冻结全部 sync 白名单 prop 为 overrides，并写 `<newId>:componentId` 停止子树递归同步（渲染替换是整体替换语义，子树由新内容全权管理）。接入 `tools/create/render.ts`（replace_id）与 `tools/structure/replace.ts`（node_replace_with）两处。
- **测试**：`tests/engine/tools/create.test.ts`（replace_id 保映射 + sync 后内容存活 + 非实例路径零副作用）、`tests/engine/tools/structure.test.ts`（node_replace_with 同等断言）。

### 8.2 评审出入点备查（落档修订，不回改评审原文）

- 评审 §5.1 注册表签名：实测为 `WeakMap<SceneGraph, Map<rootFrameId, MarketingDocumentState>>` 双层（registry.ts:33），评审写成单层。
- 评审 §5.4 跨域接线：`packages/fig/.../symbol/overrides.ts:37-43` 只做 kiwi → SceneGraph 的 overrides 导入；"跳过已覆盖属性"的同步逻辑在 `packages/scene-graph/src/instances.ts:152-160`。

## 9. 阶段路线

| 阶段 | 内容 | 状态 |
|---|---|---|
| **v0.5** | 评审落档 + P0 修复 | ✅ 完成（2026-07-29） |
| **v1 最小可用** | `default-library.fig` 落地；扫库解析（四区 → 运行时配置）；`setup_material_type` 读库；profile md 注入 system prompt overlay；`MATERIAL_TYPES` / `matchKeywords` / sectionPlan / styleGuide / min-maxSections 拆除；validate 删 section_count；readonly 快照扩展；prompt 两处澄清；web dialog 选库 | ⬜ 待启动 |
| **v1.5** | 库按 zone 多文件拆分（references 独立）；跨库 profile id 空间 | 远期 |
| **v2** | IndexedDB / 后端持久化库文件免去 web 重复上传；multi-library 组合 | 远期 |

### v1 任务分解（启动时细化到 README 状态表）

1. `default-library.fig` 制作：7 个预设 type 迁入 Types 区 + BrandBar/CTABar 迁入 Components 区 + 1 个示例 profile + 空 References 区
2. 扫库解析层：Library .fig → `MaterialTypeConfig`（仅硬约束字段）+ profile md + reference 索引；zone 定位按页面结构约定，无 pluginData
3. `setup_material_type` 改造：读库替代 `MATERIAL_TYPES`；返参精简（§6）；profile 注入 system prompt overlay（Q6）
4. 组件物化改造：从库 Components 区跨文档复制，替代 `component-templates.ts` + 构建器路径（保留 `assets.ts` fallback）
5. validate 精简：删 section_count 分支与 `min/maxSections` 字段；扩 readonly 快照至 `['fills', 'width', 'height', 'visible', 'opacity']`（TEXT 另含 text/fontSize/fontWeight）
6. prompt 修订：accept=true 范围澄清 + section 完成提醒强化 + profile/reference 行为说明
7. web dialog：marketing session 启动选库 / 无库继续；不持久化
8. 测试：扫库解析、库缺区/空库兜底、custom 兜底、setup 读库端到端、validate 精简后四类违规回归

## 10. 与 L3 品牌包的对齐

`l3-workbench.md:41` 的"品牌规范：一次配置、永久生效"在 Library .fig 形态下概念统一：

- 品牌包 = library 中的若干 profile（`brand_acme_official` / `brand_acme_casual` …）
- 库文件可分享 = 品牌包分发的天然载体
- library 既是**素材库**也是**品牌包**——单一载体，L3 品牌包不再另起存储机制

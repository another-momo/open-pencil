# 长图设计质量评审：为什么产出是"UI 感"而不是"海报感"

日期：2026-08-07
对象：`src/app/ai/chat/system-prompt-base.md`（102 行）+ `packages/core/src/design-jsx/`（JSX → SceneGraph 属性映射）+ `packages/scene-graph/src/types.ts`（数据模型能力边界），对照 `architecture/l2-agent-mode.md` 的工作流设计
实证依据：`knowledge/error-catalog.md` 第 4 轮实测记录；用户提供的端午长图参考 spec（背景层 4 条 + 内容层 4 段）作为验收基准
范围：仅讨论**设计成品质量**，不涉及工作流正确性（后者由 `2026-08-06-system-prompt-marketing-review.md` 覆盖，结论是骨架健康）

## 整体判断

命题成立：用矢量编辑器 + Agent 做营销长图，是对的赌注——长图模块多、信息密度高、文字必须精确可编辑，恰好是纯生图的盲区，也恰好是"排版"而非"绘画"问题。

但"提升设计质量"的瓶颈**不在模型审美**。逐层查完代码后，问题收敛为三个机械性约束，且严重程度递减：

1. **能力披露缺口**（最严重，零代码可修）——引擎支持的渐变 / 多重填充 / 蒙版 / 混合模式，prompt 明确告诉 Agent "不存在"
2. **数值常量锁死比例**——base prompt 里的字阶与间距上限，机械地把长图压在 UI 比例上
3. **度量与流程只优化一致性**——没有任何"表现力"判据，逐段工作流在结构上无法产出全局构图

三者都不是"让模型更有品味"能解决的，都是系统给定的约束。

## 第一部分：能力披露缺口（本次最重要的实证发现）

**用户端午 spec 的全部背景层要求——线性渐变兜底、渐变蒙版接缝、`blendMode="hue"` 全局统一层——引擎今天就 100% 支持，而 prompt 明确否认这些能力存在。**

### 引擎侧：能力齐备

| 能力 | 支持情况 | 位置 |
|---|---|---|
| 4 种渐变（LINEAR / RADIAL / ANGULAR / DIAMOND） | ✅ Skia `MakeLinearGradient` 等完整实现 | `scene-graph/src/types.ts:102-112`；`core/src/canvas/fills.ts:343-381` |
| 17 种混合模式，含 `HUE` / `OVERLAY` / `SOFT_LIGHT` / `COLOR` | ✅ 全部映射到 CanvasKit | `scene-graph/src/types.ts:113-130`；`core/src/canvas/blend.ts:5-40` |
| 3 种蒙版（ALPHA / LUMINANCE / VECTOR） | ✅ | `core/src/canvas/masks.ts:31-108` |
| 多重填充叠加 | ✅ `SceneNode.fills: Fill[]` 顺序遍历 | `scene-graph/src/types.ts:369`；`fills.ts:23-37` |
| 填充级 / 图层级 / 效果级 blend mode | ✅ 三级独立 | `fills.ts:32`；`scene.ts:220-238`；`shadows.ts:246` |

### JSX 侧：语法通道已打通

`render` 工具的属性映射**已经支持**这些能力，无需任何代码改动：

| 写法 | 实现 | 位置 |
|---|---|---|
| `fills={[<Fill对象>]}` | `isFill()` 判定后 `structuredClone` 直通 | `design-jsx/props-overrides.ts:200-202` |
| `bg={<Fill对象>}` | 同上，单填充路径 | `props-overrides.ts:206-207` |
| `mask="alpha"\|"luminance"\|"vector"` | → `isMask: true` + `maskType` | `props-overrides.ts:249-253` |
| `blendMode="hue"` | `.toUpperCase()` 直通，任意值 | `props-overrides.ts:245-247` |

`design-jsx/paints.ts:75-89` 还提供了 `linearGradient()` / `radialGradient()` / `angularGradient()` / `diamondGradient()` 四个现成工厂。

### Prompt 侧：主动否认

| 位置 | 原文 | 后果 |
|---|---|---|
| `system-prompt-base.md:19` | "Colors are **hex only** (#RRGGBB or #RRGGBBAA)." | 排除渐变 |
| `system-prompt-base.md:23` | "These are ALL available props. **Nothing else exists.**" | 封闭属性表 |
| `system-prompt-base.md:31` | Appearance 段只列 `bg="#hex"`；`blendMode="multiply"\|etc` 出现但无枚举、无用途说明 | 无从使用 |
| `system-prompt-base.md:77` | "Background effects (**gradients**, glows, color blobs) use x/y absolute positioning." | 提了"渐变"这个词，**却从不给语法**，而 L19 刚说过只有 hex |
| 全文 grep | `fills` 数组、`mask`、渐变语法：**零次出现**（两个 prompt 文件合计仅 2 处命中，即上表 L31/L77） | — |

Agent 在这套指令下唯一的理性行为，是用堆叠纯色矩形模拟渐变，或直接放弃。**这不是能力问题，是能力披露问题。**

### 持久化不构成阻塞（初判有误，已修正）

初步分析时我怀疑 `.pen` 序列化会丢失渐变（`packages/pen/src/convert.ts:282-292` 的 `convertFill` 硬编码 `type: 'SOLID'`，且全包 grep 无 `GRADIENT`）。复核后**该顾虑不成立**：

- `.pen` 是**只读导入格式**——`penFormat.support = { readDocument: true }`，无写路径（`packages/core/src/io/formats.ts:201-219`；`packages/pen/src/` 只有 `read.ts` 无 `write.ts`）
- 实际持久化格式是 `.fig`（`figFormat`，label "OpenPencil Document"），其 `fillToKiwiPaint`（写）与 `applyGradientPaintFields`（读）双向完整往返渐变（`packages/fig/src/node-change/paint.ts:23,31,108-110`）

结论：渐变 / 多重填充 / blend mode / mask 在保存与重开后完整存活。**P0 无前置依赖。**

## 第二部分：把"UI 感"变成可判定的东西

"设计感"不可判定，但它的反面高度可判定。将 UI 感拆为 8 条机械特征，每条给出确定性代理指标——这直接构成后续 `critique` 工具的规格：

| # | 维度 | UI 感 | 海报感 | 可算的代理指标 |
|---|---|---|---|---|
| 1 | 背景 | 每段一色块，段界断开 | 贯穿全图的连续视觉场 | 是否存在跨越 ≥60% 画布高度的背景节点 |
| 2 | Z 轴 | 元素并排不重叠 | 文字压图、装饰垫底、元素跨段 | 内容节点与图片节点包围盒相交数 > 0 |
| 3 | 字阶 | Display/Body ≈ 2–3× | 极端对比 6–10× | `max(fontSize) / median(fontSize)` |
| 4 | 留白 | 均匀节奏 | 疏可走马，密不透风 | section 间距的**变异系数**（UI ≈ 0） |
| 5 | 装饰 | 近乎为零 | 笔触 / 肌理 / 飞白是主体一部分 | 非文字非主图节点占比 |
| 6 | 形状 | 矩形 + 圆角 + 圆 | 不规则、有机、斜切、旋转 | `rotation ≠ 0` 节点数；VECTOR 节点数 |
| 7 | 出血 | 内容在安全区内 | 图片顶边、元素被切 | 是否有节点触达画布边缘 |
| 8 | 文字图形化 | 就是文字 | 描边 / 渐变填充 / 压色块 | Text 节点 `fills[0].type ≠ SOLID` 或带 effects 的比例 |

**用户端午 spec 每一条都落在右列**：背景 3 图无缝拼接（#1）、笔触垫在标题下（#2、#5）、hero 标题夹阴影（#8）、全局 Hue 层（#1）。该 spec 本质就是一份"海报感检查表"的实例化，可直接作为验收基准。

## 第三部分：三层根因

### 根因 1 — 表达力天花板：DSL 是 UI DSL

即第一部分。`render` 的 JSX 词汇表能表达"盒子里放什么颜色"，不能表达"图层怎么合成"。**海报是合成的艺术，UI 是排列的艺术。**

真正需要写代码补的引擎缺口另见"第四部分"，但优先级低于"把已有能力披露出去"。

### 根因 2 — 数值常量把输出机械地锁在 UI 比例

`system-prompt-base.md` 的具体数字，换算到 750px 宽长图：

| 位置 | 原文约束 | 长图实际需要 | 差距 |
|---|---|---|---|
| L69 | `Display 32–40` | hero 标题 8 字撑满 750 宽 ≈ **80px** | 上限是所需的 **1/2** |
| L69 | Display/Body = 40/14 ≈ **2.9×** | 海报 6–8× | 层次对比腰斩 |
| L65 | 间距 `4px grid: 4…48`，上限 48 | section 间呼吸 80–160px | 上限是所需的 **1/3** |
| L71 | **"Hierarchy via one property at a time: size OR weight OR color"** | 海报标题 = size **AND** weight **AND** color **AND** shadow **AND** 笔触垫底 | **字面上禁止了海报标题** |
| L71 | `#111827 / #6B7280 / #9CA3AF`（Tailwind 灰阶） | 节日海报要情绪色调 | 语义色板 ≠ 氛围色调 |
| L61 | `Cards 16–24, buttons 8–12, chips 4–8` | — | 卡片/按钮/chip 词汇本身即 UI 心智 |

L71 那条尤其值得单独指出：**它是 UI 的克制美德，是海报的致命伤。**

**治理层面的问题**：`tasks/system-prompt-marketing-optimization.md:69` 明确写「**不动 base 文件（system-prompt-base.md）**」——当前进行中的优化任务，把恰好包含上述全部问题的文件划成了禁区。理由是 base 属于 UI 模式与营销模式的 shared vocabulary，但这两个模式要的根本不是同一套数值。

### 根因 3 — 度量与流程都在把设计往 UI 方向拽

**(a) 零成本路径退回（项目自身实测已记录机制）。** `knowledge/error-catalog.md:67`：

> Agent 不产出"文字压图"的 hero 布局——根因是叠层只能靠绝对定位（要 calc、碰 lint、无示例），**AI 在 think 里推演一屏后退回"图下文"的零成本路径**。

这是本次评审引用到的最重要一句既有结论。**Agent 系统性地退回成本最低的布局路径，而低成本路径恰好就是 UI 布局。** 针对 hero 已单点修复（Frame 背景图 + flex 子节点），但机制未被普遍消除：任何需要叠压的地方，"不叠压"永远更省事。

**(b) lint 在惩罚海报特征。** `error-catalog.md:63`（R4-5）记录 AI 为修 "gap 20 not on 8px grid" 把 height 在 648→644→648 之间抖动。8px 网格是 UI 可用性规范；海报的不规则留白在这套 lint 下永远是"问题"。已降级为 info，但方向性缺口仍在：**没有任何一条正向的"海报感"判据**。

**(c) Goodhart 定律。** `architecture/l2-agent-mode.md:19` 定"一致性是设计质量的底线"，随后整套机制（早期锁定、显式追踪、每 3 段强制校验）**全部**服务于一致性。一致性可判定，表现力不可判定，系统于是只优化了可判定的那个。**度量了一致性，就只得到一致性。**

**(d) 逐段填充 ≠ 全局构图。** Phase 3 逐 section 独立完成并验证（`l2-agent-mode.md` §2.1）。但海报构图是全局属性：视觉动线跨越所有 section、背景场跨越所有 section、重量平衡是整图的。**逐段工作流在结构上就无法产出全局构图。**

**(e) 风格知识近乎为零。** 默认库只有 1 个 profile，正文 6 行（`tools/marketing-library/src/generate.ts:239-255`），"版式"一项仅一句"留白充足，卖点用图标 + 短文案成组出现"。而 profile 是注入 system prompt overlay 的**最高优先级软上下文**——最佳的设计知识载体，目前基本空置。

## 第四部分：确需写代码的引擎缺口

以下为实打实缺失，但**全部排在前三部分之后**——因为前面全是"有能力没用上"。本节据能力矩阵扫描得出，未逐项复核：

文字描边（海报字效刚需）· 竖排文字（中文海报关键）· skew 倾斜（`Matrix` 无 `skewed` 工厂）· 图片色相/饱和度/对比度滤镜（`Effect` 仅 5 型，无 `ColorFilter`）· 描边渐变（`Stroke.color` 是 `Color` 而非 `Fill`）· CSS/HTML 导出端丢失 blend / mask / filter（仅影响 web 导出，不影响画布与 .fig）

## 横切问题

1. **能力披露 vs 能力建设的优先级被颠倒**。团队讨论集中在"要不要加工具/加能力"，但最大缺口是**已有能力没告诉 Agent**。修复成本几乎为零，收益覆盖用户 spec 的整个背景层。
2. **`base.md` 的禁区状态需要重新讨论**。它同时服务 UI 与营销两个模式，但两者的数值需求相反。继续冻结它，等于让营销模式永久继承 UI 比例。
3. **"表现力"缺少归宿字段**。`l2-resource-library.md` §2 的 type / profile / reference 三关切正交切分是自洽的，但**没有任何一层承载平面设计专业知识**——type 是硬约束，profile 事实上只写了色/字/语气，reference 是 advisory 且需用户提供。
4. **方法论 §1 的注入可靠性排序支持"工具化"而非"prompt 化"**。背景层合成这类确定性几何，应落到工具返回值层（最高可靠性），而非 prompt 指引（最低）。

## 优先行动建议

已具备执行条件（证据充分、无前置依赖）：

| # | 事项 | 类型 | 成本 | 预期收益 |
|---|---|---|---|---|
| **P0** | `base.md` 补 `fills=[]` / 渐变 / `mask` / `blendMode` 语法与三段配方（渐变兜底、alpha 渐变蒙版接缝、`blendMode="hue"` 统一层）；删 L19 "hex only" 与 L23 "Nothing else exists" 的能力否认 | prompt | 零代码 | **直接解锁用户 spec 背景层 4 条中的 3 条** |
| **P1** | 引入「表现力档位」：`信息型`（电商详情页 / DSP，保留现有 UI 数值）vs `表现型`（活动海报 / 长图 / 小红书，Display 64–120、间距 24–160、允许多属性叠加、删 L71 单属性限制）。档位由 Types 区新增 key 选择，不改代码 | prompt + 库 | 小 | 解除比例锁死 |
| **P2** | `compose_backdrop` 工具：一次生成完整背景层栈（铺底渐变 → 分段生图带重叠 → 接缝自动插 alpha 渐变蒙版 → 顶层 Hue 统一层） | 工具 | 中 | 单点杠杆最高；顺带解决 `l2-agent-mode.md` §9.3 多段一致性 |
| **P3** | `critique` 工具：把第二部分 8 条做成可判定指标，CP4 前跑，返回数值 + 阈值 + 建议 | 工具 | 中 | **元杠杆**——能被度量的才会被优化 |
| **P4** | 消灭零成本路径：三槽 section 模型（底图层 / 内容层 flex / 装饰层）+ `place_decor({target_id, anchor, asset, scale, rotate})` 语义化锚点，坐标由代码算 | 工具 + prompt | 中大 | 让叠压比不叠压更省事 |
| **P5** | 构图先行：Phase 2 骨架前增「构图契约」（视觉动线 / 全局重量分布（明确要求不均匀）/ 贯穿元素 / 色调坐标），用已有 `append_brief_conclusion` 写入 AI结论区作后续硬约束 | prompt + 流程 | 中 | 补上逐段工作流的结构性缺陷 |
| **P6** | profile 从"色/字/语气/版式"四件套升级为可执行设计配方（背景做法 / 标题处理 / 分隔方式 / 具体字阶数值 / 装饰元素库含生图 prompt 片段） | 文档 | 零代码 | 最快见效，空间最大 |
| **P7** | 内置「素材类型 × 风格」参考并**预先结构化拆解**；`look` 增加对照评审用法（参考图与产出图并排问差距） | 库 + prompt | 中 | 有参照的比较判断远比无参照的审美判断可靠，直接回应 `l2-visual-loop.md` §7 对"审美是多模态弱项"的担忧 |

## 待确认事项

1. **表现力分档（P1）是否认可为产品判断？** 本评审的立场是：电商详情页应当保持 UI 感（信息密度优先），不该被"海报化"。若认为所有营销图都需海报感，P1 应改为全局替换而非分档。
2. **`base.md` 解冻范围。** P0 与 P1 都要动 base。可选路径：(a) 直接改 base 并按模式分叉数值段；(b) 保持 base 不动，在 marketing 侧追加覆盖段（但存在后段覆盖前段的指令冲突风险，弱模型表现待测）。本评审倾向 (a)。
3. **验证方式。** 建议以用户提供的端午 spec 作为第 5 轮冒烟用例——它是现成的、完整的、可逐条打勾的验收标准。P0 + P6 落地后即可跑第一次，观察背景层 4 条能否落地。

## 与既有文档的关系

- 本评审不推翻 `2026-08-06-system-prompt-marketing-review.md` 的任何结论——该评审覆盖工作流正确性（结论：骨架健康），本评审覆盖设计成品质量，两者正交。
- P1 / P5 若采纳，需修订 `architecture/l2-agent-mode.md`：§1.2「结构先行，内容后置」应调整为「构图先行，结构次之」；§1.3「一致性是设计质量的底线」应补充"底线之上还需表现力度量"。
- P2 若采纳，`l2-agent-mode.md` §9.3（多段一致性）可简化——背景一次生成天然一致。
- P3 若采纳，需在 `knowledge/methodology.md` §4（可判定性划分）下补一类：**表现力代理指标**属确定性可判定，进代码；仍保持 advisory 不作硬门槛。

# poster-quality-experiment 分支深度 review（2026-08-11）

> 评审对象：`feature/poster-quality-experiment` 分支相对其父分支 `feature/marketing-workbench`（merge-base `44c650b0`）的全部改动——23 commits / 26 文件 / +3448 / −109。代码、prompt、profile、测试矩阵、方案文档逐条核对。
> 上游产物：`docs/plans/tasks/poster-quality-experiment.md`（task plan，含 8-10/8-11 三轮修复附记）、`docs/research/2026-08-11-poster-quality-methodology-borrow.md`（方法论借鉴评审）、`docs/review/2026-08-07-long-image-design-quality-review.md`（评审一）。
> 评审方法：静态走查（全部改动文件通读）+ **本地复跑全部相关测试** + **shipped `default-library.fig` 与生成器的语义级同步核对**（脚本临时编写、用完即删）。按方法论借鉴评审 R5 的"断言-复核"方法学，每条发现给出证据位置与复核状态。

---

## 一、总体判断

**方案质量高，可以进入端午冒烟验证阶段。** 实验设计（prompt-only 臂失败留痕 → 工具化归因、v0 方法论对照组、R6 三 profile 对照组、反向断言防污染）、base/marketing/profile 三层边界、sample → compose → look 工具链闭环，均与方案文档自述一致，且测试是真实钉扎（overlay 三段 stop 的 position/alpha/transform 逐项断言、in-context clip 坐标精确到 `{0,52,750,898}`、幂等不动点回归）。

发现 **1 个高风险问题**（直接污染 R6 对照实验 c 臂的结论有效性，冒烟前必须闭环）、**2 个中风险**、**3 个中低风险**与一组小口径问题。高风险问题本身不在三轮自审的雷达上——它是"profile 内容形态"与"profile 注入机制"两个子系统的接缝，单看任何一侧都成立。

## 二、验证性结论（本地实测，非静态推断）

| 项 | 方法 | 结果 |
|---|---|---|
| compose-backdrop / sample-color(±pure) / look / poster-primitives 测试 | `bun test` 复跑 5 文件 | **81/81 通过** |
| marketing-library generate 测试 | `bun test` 复跑 | **4/4 通过** |
| shipped `.fig` vs `generate.ts` 内容同步 | 脚本对比：重新导出 → 双端 `loadLibrary` 逐字段 diff | **6 个 profile markdown 逐字节一致**、types 一致（仅内部 nodeId 编号不同，无功能影响）、条目水平布局已烘焙进 shipped 文件、`warnings=[]` |
| `.fig` 字节级可复现性 | 连续两次 `exportFigFile` 对比 | **不存在**（zip 时间戳 + 节点编号遍历差）。现有 round-trip 测试钉的是**新鲜构建**而非 shipped 文件——shipped 文件的解析健康度目前没有测试兜底，仅有本次手工核对 |
| lint 存量复核（plan 称"5 错 8 警与本轮无关"） | 本机 `bun run lint` / 单文件 `oxlint` | **无法复核**——本机 oxlint 因 allocator 内存池 OOM 直接 panic（纯环境问题，与代码无关），建议 CI 上确认 |

## 三、按严重度分级的发现

### 🔴 Critical（冒烟前必须闭环）

**C1 — recipe-as-overlay 变体与"单 profile 注入"机制不兼容：R6 对照的 c 臂实际在无约束状态下运行**

`watercolor_poster_v1_center_left` 的正文是 overlay 形态（[generate.ts](tools/marketing-library/src/generate.ts) 中该 entry 的 TEXT）：

> "ALL Fixed system rules, Anti-identity rules, and the Phase 2.5 recipe of `watercolor_poster_v1` apply unchanged — **read that profile first and follow it exactly**."

但注入机制只注入用户选中的**那一个** profile 的 markdown：[library.ts:233](src/app/ai/marketing/library.ts#L233)（`parts.push('## Active style profile: ${profile.id}\n${profile.markdown}')`，且 profile 目录刻意不泄漏，见同文件 176-189 行注释）。用户选中 center_left 变体时，agent 上下文里**只有 3 条 locked picks**——Fixed system、Anti-identity、Phase 2.5 工序全部不可达。

后果有两层：

1. **实验层**：c 臂（验证"锁定 Variable 轴是否产出可辨布局"，plan 附记 8-11 §10-c）实际运行在无约束状态，A/B 结论失真且难以察觉——失真方向还是最坏的那种（变体看起来"也能出图"，但约束来源不明）。
2. **原则层**：打破了方案自己定的"profile 自包含、不反向引用"原则（plan T4："任何'突破 base 单属性限制'类指令删除"）——引用对象从 base/marketing 换成另一个 profile，不可达性相同。

值得注意的是 [generate.test.ts:100](tools/marketing-library/tests/generate.test.ts#L100) 把引用文本钉住了（`expect(variant.markdown).toContain('`watercolor_poster_v1`')`），说明 overlay 形态是有意设计而非笔误——但**没有任何测试验证 agent 运行时能拿到基底内容**。测试钉的是"引用存在"，而缺陷在于"引用不可解析"。

**修复三选一**（定后同步改测试）：
- (a) **变体自包含**：把基底全文复制进变体，接受重复——零机制改动，代价是配方双份维护；
- (b) **注入层支持 overlay 解析**：`buildMarketingOverlay` 检测引用并拼入基底 markdown——治本但动注入机制，且引入 profile 间依赖的新概念；
- (c) **放弃 overlay 形态**：变体只存在于评估者侧（id 命名 + 任务文档），不进库——与 8-11 §12"实验设计只存在于 id 命名、代码注释与任务文档"的原则最自洽，但放弃"recipe-as-overlay 形态验证"这一实验目的。

### 🟠 Major（真实缺陷，会咬人但不阻塞主流程）

**M1 — `compose_backdrop` 仍残留一条静默失败路径：漏传 `hero_image_from` 的重入会销毁已生成的 hero 图**

时序（[compose-backdrop.ts:118-176](packages/core/src/tools/marketing/compose-backdrop.ts#L118-L176)）：agent 重新 `generate_image` 到 HeroContent（fills=[IMAGE]）→ 调用 `compose_backdrop` 但漏传 `hero_image_from` → `resolveImageSource` 返回空 source → transfer 跳过 → **`upsertHeroContent` 强制 `fills: []`（[:491](packages/core/src/tools/marketing/compose-backdrop.ts#L491)）把新图静默清掉** → stray 检测明确排除 HeroContent（[:422-423](packages/core/src/tools/marketing/compose-backdrop.ts#L422-L423)）→ note 输出 "No hero image yet"——**误导**：图本来存在，是这个调用删掉的。

这个工具三轮修复的主题就是消除静默失败（附记 8-10 §5、8-11 §1-4 共修 8 处），而这条路恰好绕过了全部三道保险（stray 检测 / rejected 警告 / sampleError 说明）。现有测试钉住了"agent 给 HeroContent 上 SOLID 底色会被强制透明"（compose-backdrop.test.ts "forces HeroContent back to transparent"），但**未覆盖"IMAGE fill 被静默销毁且 note 谎报"这一变体**。

**修复建议**：`hero_image_from` 缺省且现有 HeroContent 携带 IMAGE fill 时，自动将 HeroContent 作为隐式 source（这正是文档主路径 "generate into HeroContent → compose_backdrop"，容错收益最大）；或至少在清空前检测并在 note 里 WARNING。前者更符合工具"零几何零转抄"的设计取向。

**M2 — `renderScale` 跟随输出尺度但无像素预算上限：大画布高倍导出内存回归**

[render.ts](packages/core/src/io/formats/raster/render.ts) 把固定的 `renderScale = 2` 改为调用处传入 `Math.max(2, options.scale)`。对 look 的小节点放大（≤4x、小目标）完全正确——消除了 >2x 放大的线性上采样模糊；但 `renderNodesToImage` 是**通用导出路径**（应用导出 UI 共用 `files.ts` → `renderExportImage`），用户 4x 导出 3000×4000 画布时峰值内存 ≈ (3000·4)·(4000·4)·4 B ≈ 768MB（此前 2x 渲染 ≈ 192MB），且全路径无像素总量 clamp。本分支自己刚修过低内存机器爆炸（`fd8618a1` CJK fallback），评审环境本机甚至跑不动 oxlint（§二）。

**修复建议**：按总像素预算封顶 renderScale（如 renderWidth·renderHeight 超阈值时回退 2x），或跟随 CanvasKit 最大 surface 尺寸。look 路径不受影响（scale ≤ 4 且目标小），回归风险集中在用户手动高倍导出大画布。

### 🟡 Minor（边缘 case / 误报 / 口径，记录并择机处理）

**m1 — `sourceIsSlot` 按名字而非身份判定**（[compose-backdrop.ts:137](packages/core/src/tools/marketing/compose-backdrop.ts#L137)）

`source.node?.name === HERO_CONTENT_NAME`：一个恰好叫 HeroContent 但不是 root 流内槽位的节点（嵌套他处、或用户重命名的素材）会走槽位语义 → HeroImg = 源高 + bleed → 图像被上采样——正是附记 8-11 §6 修掉的 850→964 问题的残留通道；同时 `upsertHeroContent` 会在 root 新建空槽位而源节点图像保留 → 双图且不被 stray 检测捕获（它只看 root 直接子节点）。建议改为身份判定（upsert 后比较 `source.node.id === heroContent.id`），或至少 `name + parentId === root.id` 双条件。

**m2 — stray-image 检测对合法 section 背景会误报**（[:416-428](packages/core/src/tools/marketing/compose-backdrop.ts#L416-L428)）

判定条件是"root 直接子节点带 IMAGE fill"。但把 IMAGE fill 直接挂在 section frame 上当背景是合法设计（photo-led 风格、通栏配图段）。命中后 note 警告 "hero may be painting twice"，可能诱导 agent 删除正常内容。措辞虽是条件式（"If that node was meant to be the hero"），仍建议收窄启发式（如排除已命名 section、或仅当尺寸接近 hero 槽位时告警）。

**m3 — 小口径问题集**（单条都不值得单独修，下一轮顺手）：

| # | 位置 | 问题 |
|---|---|---|
| m3-a | compose-backdrop.ts validateInputs / sample-color.ts | schema 声明的上限（canvas 8000/20000、bleed 1000、band 16–1024）未在 execute 层落实，只查了下限。无内存风险，但 `canvas_height` 多打一个 0 会静默产出荒谬几何 |
| m3-b | compose-backdrop.ts | `canvas_width/height` 不与 root 实际尺寸对账——agent 传错即全部几何按错值构建，无提示。可默认取 root 尺寸或不一致时 WARNING |
| m3-c | [sample-color.ts:67-70](packages/core/src/tools/marketing/sample-color.ts#L67-L70) | 非法 `direction` 静默回退 bottom（schema enum 只约束模型侧）——按本分支自己的反静默标准，note 里应声明一句 |
| m3-d | compose-backdrop.ts | root `layoutMode` 未校验——非 auto-layout root 下 flow/absolute 语义都不成立 |
| m3-e | [look.ts:53-60](packages/core/src/tools/marketing/look.ts#L53-L60) | 近白文字判定忽略 fill opacity——50% 透明的深灰字视觉上同样是浅字，不触发 in-context。边缘 case，记录在案即可 |
| m3-f | plan 文档 | 测试计数漂移：plan 写 compose 27 case / sample-pure 15，实际 29 / 17（测试随修复轮增长后的口径未回填）。纯文档口径 |
| m3-g | generate.ts | 三个 R6 profile 的 Phase 2.5 段落约 15 行 ×3 复制粘贴——可抽共享常量防配方漂移（与 m3-f 一样属维护性） |

## 四、肯定项（不逐条展开，仅记录评审确认成立的设计决策）

1. **三层边界**：base.md 还原为纯 DSL 词汇表并与 upstream 对齐（fork divergence 可控）；marketing.md 只装通用合成技术；profile 自包含（C1 是这一原则的唯一裂缝）。
2. **工具链闭环与幂等**：颜色管线 explicit > sampled > fallback 退化方向全部视觉安全；幂等不动点有测试；`sampleImageFillColor` 共享 helper 抽出后 sample/compose 两路行为一致。
3. **look 三层改造**：`needsContextExport` 的"宁可过触发"取向正确（漏判白-on-白比浪费一次导出代价高）；`exportInfo` 元数据 + vision 置信协议是对治"竖条纹误判"的正确方向；"不做重复 look 去重"的决策（附记 8-11 §7）论证成立——节点自身未变 ≠ 视觉上下文未变。
4. **底层 threading 干净**：`renderInContext`/`clip` 从 `FigmaAPI.exportImage` 经 `figma-factory` → `files.ts` → `renderNodesToImage` 全链路可选参数，向后兼容；不启用时走原 extractExportGraph 路径，行为零变化（有既有测试矩阵背书）。
5. **ProfileGalleryDialog 嵌套 Dialog 修复**：用 reka-ui dismissable-layer 栈替代手写 overlay 是正确解法，注释把"为什么不能手写"写清楚了。
6. **实验方法论的文档纪律**：prompt-only 臂失败留痕后才上工具化、v0 对照组的反向断言、profile 内容去开发信息（8-11 §12）——这套归因纪律本身就是方法论借鉴评审 R5 的兑现。

## 五、收尾建议（按优先级）

1. **先修 C1**（center_left 注入缺口）——直接污染 R6 对照实验 c 臂的结论有效性，是冒烟前唯一必须闭环的项。修复方案见 §三 C1 的三选一。
2. **M1 顺手修**——HeroContent 隐式 adopt 做进去后，工具的"零静默失败"承诺才真正完整；补一个"IMAGE fill 漏传 hero_image_from"的测试变体。
3. **M2 加像素预算**——低成本防回归，与 `fd8618a1` 的低内存机器治理同一方向。
4. m1/m2/m3 记入下一轮修复附记，不阻塞冒烟。
5. **冒烟执行时**：按 plan 要求记录 5 条量化指标的**实测数值**（字阶跨度 / 背景连续性 / 叠压率 / 留白 CV / 出血）；若结论为"成效明显"，固化三层边界前先跑修好的 c 臂——否则 plan 自述的 n=1 证据缺口（8-10 附记末段）依然成立。
6. **补一条 shipped `.fig` 解析健康测试**（可解析 + profile 清单正确）——目前 round-trip 只钉新鲜构建，shipped 文件的同步正确性靠本次手工核对（§二）。

## 附：审查覆盖清单

| 覆盖 | 文件 |
|---|---|
| 通读 + 逻辑走查 | compose-backdrop.ts、sample-color.ts、sample-color-pure.ts、look.ts、render.ts diff、figma-api/index.ts diff、figma-factory.ts diff、files.ts diff、setup.ts diff、registry-core.ts diff、system-prompt-base/marketing.md diff、ProfileGalleryDialog.vue diff、generate.ts diff、library.ts（注入机制） |
| 复跑验证 | 5 个 engine 测试文件（81 case）+ generate.test.ts（4 case） |
| 脚本实证 | shipped .fig 语义同步、.fig 导出确定性、shipped .fig 布局位置 |
| 未覆盖 | lint 存量复核（本机环境 OOM，§二）；renderInContext 像素级输出比对（plan 已自知无像素级测试，headless CanvasKit 路径留作未来加固）；default-library.fig 的应用内手工检查 |

## 附：2026-08-11 决议（评审后讨论 + 端午冒烟 log 分析）

- **C1 已闭环**：决议采用"变体自包含"方案（不动注入机制）。`watercolor_poster_v1_center_left` 已改写为自包含三段体系；"注入面污染"作为复发模式写入 `knowledge/error-catalog.md` 错误分类约定（三次同型：Purpose 节 / legacy 标签 / 跨 profile 引用），并由 `generate.test.ts` 跨引用守卫测试强制执行。
- **§五.5 指标对账取消，且超出本评审原判**：海报感量化指标**本阶段整体停用**——除字阶口径漂移外，背景连续性/叠压率/出血在 wrapper v2 后沦为同义反复（度量"工具跑没跑"而非海报感），留白 CV 阈值无参考分布。plan §验证的指标表与实测留痕要求已移除，指标体系留待 `critique` 工具阶段统一重构。
- **端午冒烟判定"部分成效"**：结构 6/6 全落地，主路径 3 调用如设计；新发现已转化为待落地项（透明主题色首 stop / Anti-identity 作用域 / 标题带影调-字色配对规则），详见 plan 附记 2026-08-11（之三）。
- M1 / M2 / m1-m3 仍为待办，优先级不变。

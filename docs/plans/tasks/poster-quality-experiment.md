# Task: 海报感实验

日期：2026-08-07（首版）/ 2026-08-10（重写 + P2 落地）/ 2026-08-11（两阶段叙事重写 + review 修复落地）
状态：阶段二交付中（prompt + sample_hero_color + compose_backdrop wrapper v2 + profile；历史见文末附记）
范围：`system-prompt-base.md`、`system-prompt-marketing.md`、`tools/marketing-library/src/generate.ts`、`public/default-library.fig`、`packages/core/src/tools/marketing/sample-color*.ts`、`packages/core/src/tools/marketing/compose-backdrop.ts`、对应测试
设计依据：`../../review/2026-08-07-long-image-design-quality-review.md`

## 背景与目标

评审结论：长图"像界面不像海报"的三层根因中，**第一层是能力披露缺口**——引擎支持 4 种渐变 / 多重填充 / 3 种蒙版 / 17 种混合模式，`design-jsx` 的属性通道全部打通，而 system prompt 明确写着 "Colors are hex only" 与 "These are ALL available props. Nothing else exists."

本实验验证的是：

> 把已有能力如实告诉 Agent，再给它一份带海报数值的风格档案，产出能否从"UI 感"跨到"海报感"？

## 实验设计：两阶段

**阶段一（prompt-only 臂）——已完成，结论已记录。** 最初刻意只动 prompt 不上工具，理由有三：

1. **可可证伪**。prompt层是方法论 §1 注入可靠性排序里的**次低档**（工具返回值 > prompt 硬规则 > prompt 指引）。如果只补 prompt 就能出效果，说明此前纯粹是能力被藏起来了；如果补了没效果，正好实证方法论 §1——确定性合成必须工具化。
2. **可归因**。两层同时动，成功也分不清是谁起的作用。
3. **成本**。改动集中在 prompt + 1 个工具 + 库生成器，完全可逆。

阶段一的结局是**失败但有信息量**：8-10 第三轮冒烟中 agent 按 prompt 配方手写 overlay 时连续踩坑（NaN 采样、overlay 压内容、overlap 丢失）——正是方法论 §1 预言的"prompt 层不足以约束确定性合成"。

**阶段二（prompt + 工具化）——当前交付。** `compose_backdrop` 从对照项转为正式交付，实验归因不受影响：prompt-only 臂的失败模式已被充分记录，工具化是阶段一的**结论**而非干扰项。阶段二验证的问题变为：

> 确定性合成工具化（compose_backdrop 一次调用、零几何零 hex 转抄）+ profile 数值档案，能否稳定跨过"海报感"阈值？

## 三层职责边界（已重写）

经过 8-10 评审后，base / marketing / profile 的边界明确为：

| 层 | 职责 | 内容 | **不**该有 |
|---|---|---|---|
| **base.md** | DSL 词汇表（共享） | props 字典、布局规则、可用元素、字体声明、Corner radius、4px 间距栅格、字阶**默认档**、Prohibited、Tool discipline | 任何 marketing 概念、Composition primitives、backdrop 配方、profile 反向引用 |
| **marketing.md** | 营销工作流 + 通用合成技术 | 5 阶段 + CP、需求单协议、图片来源、**30 行 Composition primitives**（通用技术：helpers、transform陷阱、8 位 hex、Global tint、Stacked fills）、Phase 2.5 backdrop setup 子步骤 | 任何具体风格配方、profile 反向引用 |
| **profile** | 风格化应用 | 字阶**覆盖值**、间距节奏、色彩哲学、**本风格的 backdrop 配方**、装饰词汇库、语气 | 反向引用 base/marketing、钦定具体 stop 数与位置、强加装饰元素库 |

## T1 — `system-prompt-base.md` 还原为纯 DSL 词汇表（已完成）

第二轮评审后整个 Composition primitives 段（87–200 行，约 113 行）从 base.md 删除。base 还原为 100 行纯 DSL 词汇表，与原 upstream `system-prompt.md` 共享段几乎一致，**不再有 marketing 痕迹**：

- 删 L73 末尾的"expressive formats 72–110px"override 段
- 删 L89"What separates a poster from a UI screen"哲学段
- 删整段 Composition primitives（移到 marketing.md）
- 删 brush stroke / 装饰叠加等审美要求
- 删"Color is hex only"的额外追加说明，恢复"Colors are hex only"原约束
- 恢复"Props reference — these are ALL available props. Nothing else exists."原约束

**base 完全不知道 profile 存在**。profile 优先规则归 marketing.md（"Style profile authority"段已在原文件存在）。

## T2 — `system-prompt-marketing.md` 增加简短 Composition primitives + Phase 2.5 backdrop setup（已完成）

在 Image Tools 后新增一段 **30 行的 Composition primitives**，只包含：

- 5 个可调用的 JSX helper（solid / linearGradient / radialGradient / angularGradient / diamondGradient）+ 5 个 shadow/blur helper
- **3 个通用陷阱**：
  - 渐变必须显式传 transform（默认右→左）
  - 8 位 hex = alpha 通道
  - 多重 fills 按数组顺序叠加
- **3 个通用技术**：
  - Global tint（多图时统一色调）
  - Stacked fills（基础色+纹理）
  - Text on busy image（shadow / scrim / 安静区域）
- **明确说**：per-style backdrop 配方归 profile，不在这里

新增 **Phase 2.5 — Backdrop Setup**（在 Phase 2 骨架完成后、Phase 3 内容填充前）：

1. 生/放置 hero 图到骨架 Frame
2. 若 profile 指定需要 sample color → 调用 `sample_hero_color({ id: hero.id, direction: <profile 推荐> })`
3. 按 profile 配方渲染 overlay 图层（渐变、blend 矩形、scrim）
4. describe + 修复错误再进入 Phase 3

若 profile 未挂载或无 backdrop 配方，本阶段整段跳过。

**CP3** 同步简化：原来是"逐段决定图片来源"，现在改为"第一个图片 section 前与用户定一次，后续沿用"——与 profile 配合后多数 section 不再含图片，CP3 不再每段触发。

## T3 — 新增 `sample_hero_color` 工具（已完成，重写）

`packages/core/src/tools/marketing/sample-color.ts` + 纯函数模块 `sample-color-pure.ts`。

**第一轮设计的 `lighten` 参数被判定为越权**：原 spec 说"hero 主题色 alpha=1"，没说"lighten0.4"。0.4 是我加的魔法值。删除。

**第二轮**：

| 参数 | 类型 | 默认 | 说明 |
|---|---|---|---|
| `id` | string | 必填 | hero节点 id |
| `direction` | enum: top/bottom/left/right/center | `bottom` | 从哪条边采样 |
| `band_size` | number 16–1024 | 100 | 该方向的采样厚度 |

返回：`{ id, direction, region, imageSize, hex, note }`。

实现结构：

- `sample-color.ts`：CanvasKit 读像素 + 编排参数与校验
- `sample-color-pure.ts`：`bandRegion`（按方向切片）+ `averageRegion`（任意矩形区域平均）+ `bandColorToHex`（格式化为 hex），全部 CanvasKit-free

测试覆盖：纯函数 14 case + 工具层 5 case（id 校验、节点存在、IMAGE fill、字节已加载、参数边界）。

## T4 — `watercolor_poster_v1` profile 重写（已完成）

`tools/marketing-library/src/generate.ts`。

**改名**：`chinese_festival_v1` → `watercolor_poster_v1`。脱离"中国节日"硬编码（端午/中秋/春节只是应用场景之一）。

**重写内容**：

| 段 | 内容 |
|---|---|
| Type scale | **区间值**（hero 72–110px / section title 36–48 / body 20–24 / caption 16–18），不再钉死数字 |
| Spacing rhythm | 方向性描述（"节奏不均匀；hero → 大留白 → 信息密集 → 紧 → 再留白"） |
| **Backdrop recipe** | 三段 stop配方整体搬入 profile（不再在 base 通用段出现）：top=白透、中=hero 主题色实（指向 sample_hero_color）、bottom=白实 |
| Tone | **明确写"不要依赖透明叠加装饰"**：AI 生图不能可靠产出 alpha 通道，所以竹叶、飞白、印章、祥云这一类"看起来美但实现不了"的装饰元素**全部删除** |

**自包含**：profile 不再反向引用 base.md / marketing.md。任何"突破 base 单属性限制"类指令删除（profile 不该教 agent 违反 base）。

`public/default-library.fig` 同步重生（40.5 KB）。

## 测试

**新增/更新**：

- `tests/engine/tools/marketing/sample-color-pure.test.ts`（15 case）——5 个 bandRegion 方向 + 1 个 clamp + 6 个 averageRegion 矩形切片 + 2 个 hex 格式
- `tests/engine/tools/marketing/sample-color.test.ts`（5 case）——id 校验、节点存在、IMAGE fill、字节已加载、参数边界（含 direction enum）
- `tests/engine/render/jsx/poster-primitives.test.ts`（7 case）——Composition primitives 通用段（helpers、transform陷阱、mask=alpha、blendMode=hue、多重 fills、radialGradient）+ watercolor backdrop 三段 stop 配方（含 hero bottom edge 定位 + alpha=0 必须用 8 位 hex 的坑）
- `tools/marketing-library/tests/generate.test.ts`——profile id 列表断言含 `watercolor_poster_v1`、断言关键 markdown 片段（`sample_hero_color` / `72–110px` / `three linear-gradient stops`）活过 `.fig` 往返

## 验证

冒烟用例：**用户提供的端午长图 spec**（背景层 4 条 + 内容层 4 段）。它是现成的、完整的、可逐条打勾的验收标准。

跑之前先按 `architecture/l2-visual-loop.md` §3.1 的 TEST-1234 法确认图片对模型可见，否则 look 空转。
在 MarketingConfigBar 手动选中 `Watercolor poster_v1` profile——P8 修复后 profile **只有用户显式选择才会挂载**，不选则 overlay 输出 `(none)`。

### 验收标准（精简版）

背景层（wrapper v2：`BackgroundLayer`（absolute, root[0]）内含 BaseWash < HeroImg < BackdropOverlay;`HeroContent`（flow, root[1], h=750）占住 hero 槽位并承载标题）：

| # | 条目 | 通过判据 |
|---|---|---|
| 1 | 结构落地 | root 子节点序 = BackgroundLayer（ABSOLUTE, [0]) → HeroContent（AUTO, [1], h=750) → 内容 sections；layer 内部子节点序 = BaseWash → HeroImg → BackdropOverlay |
| 2 | 三段 stop 落地 | overlay 的 fills[0] 包含 3 个 gradientStops；position 0 = 0、position 1 = 1、中间 stop position ≈ `100/overlayHeight` |
| 3 | 中间 stop 颜色真实 | `compose_backdrop` 返回 `color_source: "sampled"`（自动采样自 hero 底部 100px);Agent 没有编 hex |
| 4 | 全白底承接 | overlay 底部 stop 为 `#FFFFFF` alpha=1 |
| 5 | bleed 遮缝 | HeroImg 高度 = 750 + hero_bleed（默认 100),fade 区落在下一个内容 section 的内容区内，接缝被内容打断而非通长横线 |
| 6 | 标题不洗色 | HeroContent 透明底、位于整个 BackgroundLayer 之上；标题文字不被 overlay 淡入区覆盖 |

海报感指标（评审第二部分 8 条中取可快速判读的 5 条）：

| 指标 | 阈值 |
|---|---|
| 字阶跨度 `max/median fontSize` | ≥ 5 |
| 背景连续性 | overlay 跨越 ≥60% 画布高度 |
| 叠压率 | 内容节点与图片节点包围盒相交 > 0 |
| 留白变异系数 | > 0.3 |
| 出血 | ≥1 个元素触达画布边缘 |

**装饰元素检查**（必查）：设计中**不应**出现依靠"AI 生成透明 PNG"做垫底装饰的做法——这在 profile 里被明令禁止。

本轮**手工判读**，不建 `critique` 工具（那是 P3，取决于本轮结论）。

## 明确不做

- ~~**不做 `compose_backdrop`**（P2）~~——**已落地**（见文末附记）。原定为对照项，8-10 第三轮决定提前实现
- **不动 base.md 的字阶/间距数值本身**（P1）——base 已恢复纯 DSL 词汇表，不再有 marketing 痕迹；P1 字体分档若需要则在 profile 层做
- **不做 `critique` 工具**（P3）——本轮手工判读
- **不做三槽 section / `place_decor`**（P4）、**不做构图先行**（P5）、**不做参考库**（P7）
- **不做装饰元素库**（profile 显式删除——AI 生图做不出可靠透明底）
- **不实现 `compose_segmented_backdrop`**——multi-segment 风格暂无专用 helper，agent 按 profile 配方手写渐变蒙版

## 结论去向

跑完按 `knowledge/methodology.md` §7 归档到 `knowledge/error-catalog.md` 第 5 轮。两种结局各自的下一步：

- **成效明显** → 把 base/marketing/profile 三层边界固化下来；profile 配方升格为模板；P2 降级为可选优化
- **成效不明显** → 实证了方法论 §1（prompt 层不足以约束确定性合成），直接上 P2 `compose_backdrop` + P3 `critique`，并记录"prompt-only 不足"这个结论本身
- **部分成效**（预期最可能）→ 记录哪几条落地了、哪几条没有；没落地的条目按"是否确定性可代码化"分流到 P2/P4

## 附记 2026-08-10：P2 `compose_backdrop` 落地 + Review 修复轮

### 为什么 P2 提前落地

8-10 第三轮冒烟中 agent 按 prompt 配方手写 overlay 时连续踩坑（NaN 采样、overlay 压内容、overlap 丢失）——这正是方法论 §1 预言的"prompt 层不足以约束确定性合成"。`compose_backdrop` 从对照项转为正式交付，实验归因不受影响：prompt-only 臂的失败模式已被充分记录，工具化是结论而非干扰项。

### Review 发现并已修复的问题

1. **拓扑重设计：放弃 BackgroundLayer wrapper，改扁平三元组**。初版把 BaseWash/HeroImg/BackdropOverlay 包在一个 wrapper frame 里，但 wrapper 未设 `layoutPositioning: 'ABSOLUTE'` 时会以 2120px 全高参与 root 的 auto-layout 流，把所有内容顶出画布；且 wrapper 垫底与"overlay 必须压在 hero 上"结构上互斥。修复后三节点直接作为 root 子节点：BaseWash（absolute, [0]）→ HeroImg（flow, [1]，占住 hero 槽位）→ BackdropOverlay（absolute, [2]）——与冒烟验证过的 `poster-primitives.test.ts` 配方结构一致。
2. **HeroImg 双重创建 + 循环依赖**：初版 profile 让 agent 自建 HeroImg 并填图，工具又建一个空占位，且采样（依赖图已生成）在 compose（依赖采样色）之前成环。修复：工具新增 `hero_id` adopt 模式（复用已有 hero 节点，overlay 几何取 hero 真实高度），并按名字幂等重入——重复调用原地更新，给了"生成后回填采样色"一条路径。
3. **BaseWash 淡 tint 丢失**：`opacity: 0.05` 在构建 gradientStops 时被静默丢弃，实测 stop alpha=1（全强度主题色铺顶）。已修复为折进 `color.a`，并有回归测试钉住。
4. **`sample_hero_color` 文档承诺"可传子节点"但未实现**：已补上带循环保护的父级遍历。
5. **CI 质量门**：12 个 lint error（parseInt、inline 具名类型、超长行、测试复杂度）+ 3 个文件 oxfmt 不合格，全部修复；新增 NaN 校验、root 类型校验。

### 当前测试矩阵

- `sample-color-pure.test.ts`（15 case）+ `sample-color.test.ts`（6 case，含父级遍历）
- `compose-backdrop.test.ts`（18 case：校验 10 + 扁平拓扑 5 + adopt 1 + 幂等 1 + 参数形状 1）
- `poster-primitives.test.ts`（8 case，渲染层配方钉扎）
- `generate.test.ts`（profile markdown 关键片段 .fig 往返存活）

## 附记 2026-08-10（之二）：设计评审迭代 → wrapper v2 终稿

第一轮修复（扁平三元组 + hero_id adopt）经设计评审后被推翻，演进为当前的 **wrapper v2**。决策记录：

1. **回归 wrapper（带 HeroContent 分离）**。评审结论：扁平三元组把 z-order 不变量暴露在 root 的兄弟序里、没人把守（agent 重渲/插节点可拆散）；且标题只能作为 HeroImg 子节点，会被 overlay 淡入区洗色。wrapper v2:BackgroundLayer（absolute, root[0]）内部封装 BaseWash < HeroImg < BackdropOverlay(kiss 不变量外部不可破坏）;HeroContent（flow, root[1]，透明，h=750）占住流内槽位并承载标题/logo（压在整个背景层之上，永不洗色）。"spacer 魔法节点"批评不成立：HeroContent 是内容框，不是空占位。
2. **去掉 reparent adopt，改 `hero_image_from` 值拷贝**。"先建后搬"是 workaround;fills 是值对象，把 IMAGE fill 拷给层内 HeroImg、清空 HeroContent，节点身份零扰动。非 HeroContent 源（用户自带素材）只拷不清。
3. **采样内化**:`compose_backdrop` 自动采 hero 底部 100px（恰好=重叠带，几何必然一致），优先级 显式 `hero_color` > 自动采样 > 白色兜底（`#FFFFFFFF`，退化为纯白过渡，视觉安全）。`sample_hero_color` 保留给非常规方向（side-fade/center），结果走 `hero_color` 覆盖。验收第 3 条从抽查变为结构保证。
4. **hero 高度 500 → 750**;**新增 `hero_bleed`（默认 100 = OVERLAP_PX）**:HeroImg 比 hero 槽位高 100px,fade 区恰好全部没入下一 section 的内容区——通长水平接缝是人眼最敏感的形态，被内容打断后显著更隐蔽，且结构性满足叠压率指标。
5. **工作流时序修正**:profile 要求的读取点前移到 Phase 1 末/Phase 2 渲染前（hero 槽位、透明 section 属于骨架结构，必须在 checkpoint 确认前就位）;Phase 2.5 收窄为"物化"槽位（只含依赖像素的操作：generate_image → compose_backdrop 一次调用 → look)，无 profile 时整段不存在。
6. **无强制两段式调用**：主路径 = 先生图、后一次 compose；"重调一次"只在像素变化时发生（重新生图后重新同步颜色），幂等重入保证安全。

主路径 agent 负担：Phase 2.5 三个调用（generate_image / compose_backdrop / look)，零几何、零 hex 转抄、零采样参数。

### 当前测试矩阵（wrapper v2)

- `compose-backdrop.test.ts`(22 case：校验 7 + 拓扑 4 + 渐变契约 2 + 颜色管线 4 + fill 转移 3 + 幂等 1 + 参数 1)
- `sample-color-pure.test.ts`(15)+ `sample-color.test.ts`(6)——共享 helper `sampleImageFillColor` 抽出后行为不变
- `poster-primitives.test.ts`(8)+ `generate.test.ts`（往返）

## 附记 2026-08-11：第二轮深度 review + 修复

8-10 对整个分支做了一轮深度 review（代码 + prompt + profile + 测试矩阵一致性逐条核对），结论：设计前提成立（fill 值拷贝无几何缓存、z-order 内生化、默认流程采样带=覆盖带），但发现若干静默失败路径。本轮全部修复：

1. **note 语义 moved → copied**。非 HeroContent 源的 fill 转移是拷贝（源节点保留 IMAGE fill），旧 note 说 "moved" 会误导 agent 以为源节点已空。现在 note 区分两种清理行为：HeroContent 源 → "copied + cleared"；其他源 → "copied + left untouched"，并提示 agent 自行决定是否删除源节点图像。
2. **HeroContent 透明从约定升级为结构契约**。幂等重入路径原来只同步宽高、不动 fills——agent 若给 HeroContent 上过底色，作为 flow 子节点会糊住整个 BackgroundLayer 且静默通过。现在 upsert 强制 `fills: []`（标题/Logo 子节点不受影响）。
3. **双份图检测（命名契约的保险丝）**。工具的幂等与 adopt 都建立在"hero 槽命名 HeroContent"上；agent 用别的名字时会新建空 HeroContent 且源节点保留图像，hero 双份显示、fade 失效、无任何告警。现在检测 root 下其他携带 IMAGE fill 的子节点，命中即在 note 输出 WARNING 与修复指引。
4. **非法 hero_color 不再静默吞掉**。校验失败仍降级走采样/白色兜底（结构不因拼错的 hex 失败），但 note 显式输出 "WARNING: hero_color ... was ignored"，agent 能知道自己拼错了。
5. **注释与行为对齐**：`averageRegion` 的 alpha 注释改为描述真实行为（忽略 alpha 通道、透明像素贡献原始 RGB——对全不透明的 AI 生图精确），测试名同步修正；文件头的"采样带=覆盖带"不变量限定为默认流程成立（cover-crop 用户素材下见已知限制）。

**已知限制（记录，暂不修）**：`hero_image_from` 接 cover-crop 用户素材时，自动采样取的是图像素空间 bottom 100px，与 cover-crop 后实际显示的底带可能不重合——结果是中间 stop 颜色与视觉底带有色差，属颜色偏差而非结构错误。默认流程（按 holder 最终尺寸生图）不受影响。若未来要修：在工具内按 FILL 模式 cover-crop 公式把采样区换算到显示空间。

**测试矩阵更新**：`compose-backdrop.test.ts` 27 case（+非法 hex 警告 2、note 语义 2、stray 检测 1——其中 2 个复用现有 describe);50/50 全绿。

**冒烟记录要求（补）**：跑端午用例时，5 条量化指标（字阶跨度 / 背景连续性 / 叠压率 / 留白变异系数 / 出血）要记录**实测数值**，不是只打勾；手工判读的可靠性靠留痕弥补。若本轮结论为"成效明显"，固化三层边界前先补一个非水彩 profile（哪怕 solid-color）验证 Phase 2.5 骨架通用性——目前 profile-driven 抽象只有 n=1 证据。
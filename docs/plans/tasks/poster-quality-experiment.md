# Task: 海报感实验 — Prompt-only 臂

日期：2026-08-07（首版）/ 2026-08-10（重写）
状态：施工中（Prompt-only 臂，Prompt + sample_hero_color 工具 + profile）
范围：`system-prompt-base.md`、`system-prompt-marketing.md`、`tools/marketing-library/src/generate.ts`、`public/default-library.fig`、`packages/core/src/tools/marketing/sample-color*.ts`、对应测试
设计依据：`../../review/2026-08-07-long-image-design-quality-review.md`

## 背景与目标

评审结论：长图"像界面不像海报"的三层根因中，**第一层是能力披露缺口**——引擎支持 4 种渐变 / 多重填充 / 3 种蒙版 / 17 种混合模式，`design-jsx` 的属性通道全部打通，而 system prompt 明确写着 "Colors are hex only" 与 "These are ALL available props. Nothing else exists."

本实验只验证一件事：

> 把已有能力如实告诉 Agent，再给它一份带海报数值的风格档案，产出能否从"UI 感"跨到"海报感"？

## 三层职责边界（已重写）

经过 8-10 评审后，base / marketing / profile 的边界明确为：

| 层 | 职责 | 内容 | **不**该有 |
|---|---|---|---|
| **base.md** | DSL 词汇表（共享） | props 字典、布局规则、可用元素、字体声明、Corner radius、4px 间距栅格、字阶**默认档**、Prohibited、Tool discipline | 任何 marketing 概念、Composition primitives、backdrop 配方、profile 反向引用 |
| **marketing.md** | 营销工作流 + 通用合成技术 | 5 阶段 + CP、需求单协议、图片来源、**30 行 Composition primitives**（通用技术：helpers、transform陷阱、8 位 hex、Global tint、Stacked fills）、Phase 2.5 backdrop setup 子步骤 | 任何具体风格配方、profile 反向引用 |
| **profile** | 风格化应用 | 字阶**覆盖值**、间距节奏、色彩哲学、**本风格的 backdrop 配方**、装饰词汇库、语气 | 反向引用 base/marketing、钦定具体 stop 数与位置、强加装饰元素库 |

## 实验设计：为什么是 Prompt-only 臂

刻意**不**同时上 `compose_backdrop` 工具。理由：

1. **可可证伪**。prompt层是方法论 §1 注入可靠性排序里的**次低档**（工具返回值 > prompt 硬规则 > prompt 指引）。如果只补 prompt 就能出效果，说明此前纯粹是能力被藏起来了；如果补了没效果，正好实证方法论 §1——确定性合成必须工具化。
2. **可归因**。两层同时动，成功也分不清是谁起的作用。
3. **成本**。改动集中在 prompt + 1 个工具 + 库生成器，完全可逆。

**失败也是有信息量的结果**，不是白跑。

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

背景层（v2 单渐变 overlay）：

| # | 条目 | 通过判据 |
|---|---|---|
| 1 | 单 hero 图 + overlay | root frame 内存在 1 张 hero 图（AI生成）+ 1 块与之重叠 100px 的渐变矩形 |
| 2 | 三段 stop 落地 | overlay 的 fills[0] 包含 3 个 gradientStops；position 0 = 0、position 1 = 1、中间 stop position ≈ `100/overlayHeight` |
| 3 | 中间 stop 颜色真实 | `sample_hero_color` 工具被调用并返回 hex，Agent 没有编一个 |
| 4 | 全白底承接 | overlay 底部 stop 为 `#FFFFFF` alpha=1 |

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

- **不做 `compose_backdrop`**（P2）——本实验的对照项，取决于本轮结论
- **不动 base.md 的字阶/间距数值本身**（P1）——base 已恢复纯 DSL 词汇表，不再有 marketing 痕迹；P1 字体分档若需要则在 profile 层做
- **不做 `critique` 工具**（P3）——本轮手工判读
- **不做三槽 section / `place_decor`**（P4）、**不做构图先行**（P5）、**不做参考库**（P7）
- **不做装饰元素库**（profile 显式删除——AI 生图做不出可靠透明底）

## 结论去向

跑完按 `knowledge/methodology.md` §7 归档到 `knowledge/error-catalog.md` 第 5 轮。两种结局各自的下一步：

- **成效明显** → 把 base/marketing/profile 三层边界固化下来；profile 配方升格为模板；P2 降级为可选优化
- **成效不明显** → 实证了方法论 §1（prompt 层不足以约束确定性合成），直接上 P2 `compose_backdrop` + P3 `critique`，并记录"prompt-only 不足"这个结论本身
- **部分成效**（预期最可能）→ 记录哪几条落地了、哪几条没有；没落地的条目按"是否确定性可代码化"分流到 P2/P4
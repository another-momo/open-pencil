# 海报感方法论借鉴评审：gc-minimal-zine-poster 的风格系统学

日期：2026-08-11
对象：gc-minimal-zine-poster（外部 skill，v0.3，MIT，6 张示例图）对照 `feature/poster-quality-experiment` 分支（`docs/plans/tasks/poster-quality-experiment.md` + `docs/review/2026-08-07-long-image-design-quality-review.md` + `src/app/ai/chat/system-prompt-{base,marketing}.md` + `tools/marketing-library/src/generate.ts`）
实证依据：两份 SKILL.md + 4 份 references/*.md + 评审三轮 review 记录 + 当前 `watercolor_poster_v1` profile 全文
范围：仅讨论**风格系统学**（如何承载、组织与迭代一种"画风"），不重复评审一/二/三已论证的能力披露 / 数值常量 / 度量三件事

> ⚠ **本评审的角色**：作为海报感实验的**方法论输入**，不是新一轮执行任务。落地动作在文末"优先行动建议"列出，需另开 task 承接。

## 整体判断

**gc-minimal-zine-poster 最值得借鉴的不是视觉语言本身，而是它把"风格系统"作为一等工程产物来处理的方法论。** 这件事 openpencil 现在缺——`watercolor_poster_v1` profile 只有 6 行 / `casual_v1` 30 行，"风格系统"在 profile 层实质上空置。

两条路线面对的是**同一个问题**：AI 在设计上达不到人类设计师水平怎么办？

- **生图路线**的解法是**约束 prompt**（固定系统 + 可变轴 + 验收门）。
- **矢量路线**的解法是**约束工具 + 披露能力 + 度量表现力**。

两条路线的核心方法论其实是**同一套的两种表达**。下表把 6 个方法论元素一一对齐——这是本评审的中心论点。

| 方法论元素 | gc-minimal-zine-poster | openpencil |
|---|---|---|
| 风格的**固定 vs 可变** | `style-system.md`（Fixed / Variable / Anti-identity） | style profile |
| **变量空间**的离散化 | `variation-engine.md`（6 轴 × 多档 = recipe） | （缺失） |
| 从内容到产物的**编译过程** | `prompt-compiler.md`（10 字段顺序 + 四段式） | Marketing Workflow 5 phases |
| **验收门** | `quality-gate.md`（11 条可判定指标） | （缺失，`critique` 待实现） |
| **失败归因** | 4 个 Request Mode + Photo Input Mode | 评审两阶段叙事（prompt-only → 工具化） |
| **风格知识载体** | `references/*.md` + SKILL.md frontmatter | profile + base + marketing 三层 overlay |

> **可迁移的不是"诗性纸感"这件事**，是"风格系统作为独立产物"这件事。
>
> 落地证据：评审一（8-07）已经识别出 base.md 的字阶 32-40 把长图压成 UI 比例，**但没说"如何写一个不像 UI 比例的 profile"**——skill 的 `style-system.md` Fixed/Variable 框架正是这个缺口的标准答案。

## 第一部分：skill 的风格系统学拆解

skill 由 4 个 references/ 组成，每份对应一个独立的能力面。先把每个面的内核抽出：

### 1.1 `style-system.md`——"什么是这家人"

```text
Fixed system (永不变)
- 默认 3:5 竖版
- 70-90% 留白
- 一张视觉群组占 8-25%
- 一段视觉隐喻（不画场景）
- flat orthographic 扫描纸感
- 一个高纯度主色锚

Variable system (按内容选)
- 纸色 / 群组位置 / 锚形式 / 结构 / 排版分布 / 装饰标记 / 情绪

Anti-identity (本风格不做什么)
- 不商业广告 / 不全屏出血 / 不品牌 headline / 不长段可读文字 / 不复制样本残留
```

**这是"风格系统学"最关键的产出**——一个风格 = 一组**不可破**的不变量 + 一组**可旋钮**的变量 + 一组**显式拒绝**的反模式。

### 1.2 `prompt-compiler.md`——"怎么把内容转成 prompt"

10 个**强制字段顺序**：

```text
1. 画布 (比例 / 纸 / 边框)
2. 注意力几何 (留白% / 群组大小 / 位置)
3. 输入照片契约 (角色 / 保留级别 / 不变量)
4. 视觉隐喻 (一个 subject 或 relation)
5. 锚形式 (photo / clipping / silhouette / block / specimen / illustration / texture / typography / panels)
6. 材质处理 (halftone / xerox / risograph / letterpress / 扫描 / 套印错位)
7. 排版 (短语 / 微文本 / 字体 / 空间行为)
8. 颜色 (主色 hex / 材质载体 / 占比)
9. 复刻与情绪 (平面扫描 / 光 / 对比 / 温度)
10. 硬避免 (相关 anti-identity 子集)
```

**关键设计**：字段顺序就是**关注点顺序**——"先定画布与留白，再定主角，最后才颜色"。这与 openpencil marketing Workflow Phase 2（骨架先行）→ Phase 3（内容填充）的结构同构。

### 1.3 `variation-engine.md`——"同一家族里怎么换款式"

6 个**离散轴**，每轴多档：

| 轴 | 档数 |
|---|---|
| Layout family | 10（center-fragment / lower-left-float / upper-right-block / dual-panel / irregular-cutout / type-led / dot-orbit / single-specimen / diagonal-notes / edge-counterweight） |
| Anchor form | 10（tiny photo / clean crop / torn clipping / silhouette / opaque block / old illustration / specimen / translucent overlay / texture window / fragmented type） |
| Typography | 8（fragmented letters / edge-pressed / archive microtext / diagonal scattered / gray ghost / headline-as-object / text in block / nearly textless） |
| Texture mode | 9（xerox / risograph / letterpress / halftone / film-grain / scan fibers / aged mottling / misregistration / soft blur） |
| Decorative system | 6（dot+line / arrow+dashed / transparent rect+reg-mark / hand-drawn curve / color block+date / no decoration） |
| Mood | 多档（quiet / summer / solitude / childhood / seaside / afternoon / night / memory / surreal） |

**每张海报 = 6 维各选一档 → 一个 recipe 记录**。变体必须改变**视觉语法**，不能只改坐标。

且有强约束：

> "If the previous visible result is centered, prefer an off-axis, dual-panel, type-led, or edge-counterweight family next time."
> "Do not repeat the same layout + anchor pair on adjacent images."

### 1.4 `quality-gate.md`——"怎么验收自己"

11 条**可判定**检查（生成图）+ 5 条（输入照片保真）：

```text
生成图：
- 是 3:5 竖版吗
- 留白 70-90% 吗
- 主色占 0.8-2.5% 或群组 15-35% 吗
- 主色在缩略图下仍可见吗
- 视觉隐喻只表达一个关系吗（不是场景）
- 纸纤维/扫描/拼贴/标本质感可见吗
- 排版参与构图吗（没变成商业 headline）
- 选了 recipe 的 layout / anchor / 排版 / 质感 / 情绪 都在图里吗
- 避开 full-bleed / product-ad / mockup / cinematic / 3D / neon / cartoon / dense-scrapbook 了吗
- 没复制样本文字 / 品牌 / 日期 / 地点 / 构图 吗
```

**关键设计**：每条都是"过/不过"二元，不留"看起来还行"的中间地带。

且有这条不成文规矩——

> "If the second result still fails, return the better result and state the remaining limitation briefly; do not describe failed preservation as successful."

**系统显式拒绝粉饰**。这条直接对治评审一发现的 Goodhart 风险——只有"能接受失败"的系统才不会无脑重试到收敛。

## 第二部分：openpencil 当前的风格系统状态

把当前 `tools/marketing-library/src/generate.ts` 的两个 profile 拿出来对照：

### 2.1 `casual_v1`（30 行，4 件套）

```markdown
# 休闲活泼风格

- 配色：主色 #FF6B35，配白色与深灰，整体明快
- 字体：Alibaba PuHuiTi；标题加粗，正文 Regular
- 语气：年轻、直接、促销感；多用短句和行动词
- 版式：留白充足，卖点用图标 + 短文案成组出现
```

**问题**：

| 缺什么 | skill 对应产物 |
|---|---|
| 没有**不可破**的不变量 | `style-system.md` 的 Fixed system |
| 没有**反模式清单**——什么叫"不休闲活泼" | `style-system.md` 的 Anti-identity |
| 没有**变量空间**的离散轴 | `variation-engine.md` 的 6 轴 |
| "留白充足"是形容词，没有可算阈值 | `quality-gate.md` 的百分比约束 |
| 没有**从内容到产物**的工序 | `prompt-compiler.md` 的 10 字段顺序 |

### 2.2 `watercolor_poster_v1`（30 行，已经部分吸收方法论）

```markdown
# Watercolor poster

## Type scale
Extreme contrast. Hero title 72-110px ... Section titles 36-48 ...
## Spacing rhythm
Deliberately uneven. ...
## Visual environment setup (Phase 2.5)
[具体工序：generate_image + compose_backdrop + look]
## Tone
Restrained, atmospheric. ...
```

**优点**：已包含区间值（72-110px / 36-48）、不均匀节奏这种方向性描述、Phase 2.5 物化工序、显式禁止透明 PNG 装饰元素。

**仍缺的**：

| 缺什么 | 严重度 |
|---|---|
| **Anti-identity 段**："本风格不做什么" | 中（与其他 profile 区分度不够） |
| **变量空间**："同样水彩风可换哪几档 layout / anchor" | 高（无法复现"另一种水彩版面"） |
| **隐喻库**："本风格擅长表达哪些关系" | 中（section 模板化堆砌的根因） |
| **质量门**："本风格的验收判据" | 高（依赖人工判读） |
| **Recipe 记录**：每张设计稿的 6 轴选择 | 高（撞运气的多版生成无法复现） |

### 2.3 整体缺口（一句话版）

> **openpencil 把"风格"当作一段 markdown 注释，而不是一个工程产物。** skill 把"风格"当作 `references/` 目录——独立、可版本化、可复用、可被自动化消费。

## 第三部分：启发清单（7 条 + 3 条反向教训）

### 启发 1｜**Fixed / Variable / Anti-identity 三段式**

把每个 style profile 改写为：

```text
## Fixed system (永不变)
- [固定系统清单]

## Variable system (按内容选)
- [可选轴与档]

## Anti-identity (本风格不做什么)
- [显式拒绝清单]
```

**为什么最优先**：评审一（8-07）已经识别出 root cause 是"系统给定的约束"，而 skill 的 Fixed/Variable/Anti 框架是已经被验证过能稳定产出"诗性"结果的结构——直接借过来当 profile 的章节骨架。**零代码变更**。

### 启发 2｜**区间常量优于形容词**

把现有"留白充足"等翻译为可算阈值（评审一第二部分 8 条指标就是现成的翻译器）：

| 现有形容词 | 应替换为区间常量 |
|---|---|
| "留白充足" | section 间距 CV > 0.3 |
| "标题醒目" | `max(fontSize)/median(fontSize) ≥ 5` |
| "层次分明" | 字重跨度 ≥ 3 档 + 颜色跨度 ≥ 2 色系 |
| "贯穿感" | 背景节点占画布高度 ≥ 60% |
| "有叠压感" | 内容/图片包围盒相交数 > 0 |
| "出血有冲击" | ≥1 节点 `rotation ≠ 0` 或 VECTOR 节点 |
| "质感可见" | ≥1 节点 fills 含非 SOLID |

**为什么**：这是 P6（评审一已识别但未落地）的核心动作——profile 从"色/字/语气/版式"四件套升级为"区间值 + 阈值 + 配方"。

### 启发 3｜**质量门是可判定指标的集合，不是审美形容词**

实现 `critique` 工具——直接照搬 skill 的 quality-gate.md 的设计：

```text
检查项 = (指标名 + 算子 + 阈值 + 通过判据)
CP4 前自动跑一次
返回: { item, value, threshold, pass, advice }
```

**关键借鉴**——

> "If the second result still fails, return the better result and state the remaining limitation briefly."

把这条做成 `critique` 的**业务逻辑**——**不要自动重渲**。把"不达标的结果 + 未过指标清单"一起呈现给用户，让用户决定是否接受。这一条直接对治评审一发现的 Goodhart 风险。

**为什么**：这是元杠杆——一旦度量可判定，P0 的 profile 改造、P4 的零成本路径消除、P5 的构图先行都会被自动驱动。

### 启发 4｜**变体引擎 = 用多维离散轴，而不是随机种子**

```text
每个 style profile 写出本风格允许的轴与档。
生成多版时按轴各抽一档，记录每个版本的 recipe。
```

例如 `watercolor_poster_v1` 的允许 layout 轴：

```text
{ hero-led, dual-panel, segment-bridge }
```

`casual_v1` 的允许 layout 轴：

```text
{ nine-grid, product-row, vertical-stack }
```

**核心是 recipe 记录**——评审里反复出现的"可复现"原则，skill 落地为 `Recipe Record` 字段，openpencil 可以落地为**每张设计稿的 metadata**：

```text
recipe: {
  layout: "hero-led",
  anchor: "torn-paper-clipping",
  typography: "edge-pressed-phrase",
  hue: "cobalt-on-warm-paper",
  texture: "xerox-softness",
  mood: "quiet-summer",
  decorative: "no-decoration"
}
```

### 启发 5｜**照片输入的角色-保留级别契约**

为 `look` 工具引入"角色"参数：

```ts
look({ id, role: 'edit_target' | 'reference' | 'supporting_insert', preservation: 'high' | 'medium' | 'low' })
```

**业务逻辑**：

- HIGH（身份敏感主体：人物/宠物/产品/角色/艺术品）→ 工具**强制**列举 invariant 清单（必须在最终成稿可识别的特征）
- 跑完返回 invariant 清单，agent 在 CP3 时**必须**与用户确认
- 用户只说"做一张" + 一张图 → **默认是 edit_target**（静默丢弃是更破坏性解读）

**为什么**：评审一附记已识别"双份图 / HeroContent 命名"等静默失败路径——role/preservation 参数能从根本上避免 agent 误把用户素材当参考。

### 启发 6｜**从内容抽"视觉隐喻"，而不是把内容画出来**

借鉴 skill 的 **Subject Logic** 段：

```text
For abstract themes, prefer a small relation:
- two fragments nearly touching
- one interrupted line
- a window cut from a solid block
- a repeated form with one missing part
- two panels showing different states
- an object isolated from its expected context
```

落到 profile 层——每个 style 附**本风格擅长的隐喻库**：

```text
watercolor_poster_v1 隐喻库:
- 大量留白 + 单元素 → "隐于画面"
- 双联画 + 中线 → "对话"
- 飘落笔触 + 主图 → "沉淀"

casual_v1 隐喻库:
- 网格 + 单格突出 → "重点推荐"
- 平铺图标 + 短文案 → "一目了然"
```

每个 section 的 Phase 3 工序前增 **1-2 行"先写隐喻再选锚"**——明确禁止"图 + 标题 + 描述"模板化堆砌。

### 启发 7｜**观察证据 vs 推断 + 样本残留识别**

把评审一附记的"复核修正"段（"初判 .pen 渐变丢失为 P0 阻塞项，实为误判——.pen 是只读导入格式"）固化为方法学：

```markdown
## 断言（待核实）
- [P?] 原断言
- 引用: file:line

## 复核
- [✅/❌] 复核结论
- 引用: file:line

## 结论
- 修正后判断
```

同时把**样本残留**识别纳入：

- 复用一份参考风格时，**显式列出不可复用的样本特有内容**（具体物件 / 文案 / 配色 / 构图）
- 这些不是"风格"，是"这一次的内容"

### 反向教训 1｜**不要把"风格"写成一段清单**

skill 的 references/ 是**目录式工程产物**，不是 markdown 段落。每个轴是一份文件，每份文件有明确的输入输出。

openpencil 如果把 profile 写成一段 markdown 注释，会遇到：

- 难版本化（一段 markdown 没法做 schema 校验）
- 难消费（agent 只能顺序阅读，无法按字段查询）
- 难迭代（修改一处要重读全文）

**建议**：profile 的三个段（Fixed / Variable / Anti-identity）每段一个独立 markdown 子节点，与现有 `Watercolor poster` 单节点结构区分开。`.fig` 持久化仍走 TEXT 节点。

### 反向教训 2｜**不要用"形容词 + 例子"代替"区间 + 阈值"**

skill 的固定系统全是数字（70-90% / 8-25% / 0.8-2.5%），openpencil 当前 profile 是"留白充足 + 卖点用图标"。

**问题**：形容词在 agent 脑子里等价于"凭感觉做"，区间值等价于"按数字做"。前者必撞 Goodhart，后者可自动校验。

### 反向教训 3｜**不要把"风格知识"塞进 system-prompt-base.md**

skill 把通用规则（纸质感 / 留白 / 主色）放在 SKILL.md + references/style-system.md，**不是**放在每一次生图 prompt 里。

openpencil 评审一已识别这是 base.md 反模式——base 应该是**纯 DSL 词汇表**（已落地），营销/海报/活动相关的"风格系统"应放在 marketing.md + profile 层。

## 第四部分：优先行动建议（仅体系层）

| # | 事项 | 类型 | 借鉴自 | 预期收益 |
|---|---|---|---|---|
| **R0** | 第一个 style profile（如 `watercolor_poster_v1`）按 **Fixed / Variable / Anti-identity 三段**重写，作为样板 | 文档 | 启发 1+2 | profile 从硬清单升为可执行设计配方 |
| **R1** | `critique` 工具：评审一第二部分 8 条做成可算子，CP4 前自动跑 | 工具 | 启发 3 | 元杠杆——能让 P0 / P4 / P5 都自动可校验 |
| **R2** | recipe metadata：每张设计稿记录 6 轴选择（layout / anchor / typography / hue / texture / mood） | 工具 + 元数据 | 启发 4 | "水彩风格的另一种版面"可复现 |
| **R3** | `look` 工具加 `role` + `preservation` 参数与 invariant 清单 | 工具 | 启发 5 | 防止用户提供的素材被静默丢弃 |
| **R4** | 每个 profile 附**本风格隐喻库**，Phase 3 工序前增 1-2 行"先写隐喻再选锚" | 文档 + 流程 | 启发 6 | section 不再模板化堆砌 |
| **R5** | review / plan 文档引入**断言-证据-复核**模板 | 文档 | 启发 7 | 减少评审本身的误判成本 |
| **R6** | 加 1-2 个**新 profile**（非水彩）验证 Phase 2.5 骨架的通用性 | 库 | 启发 1+4 | 防过拟合到"水彩 = 海报感" |

> **R0 + R1 是元动作**，一旦落地，其余会自动受益。**R2-R6 是 R0+R1 落地后自然衍生**。

## 第五部分：与既有评审/任务的关系

| 既有产物 | 关系 |
|---|---|
| `2026-08-07-long-image-design-quality-review.md`（评审一） | 本评审**承接**评审一——评审一说"什么让长图像 UI"，本评审说"什么让矢量长图像海报"。评审一的 P6（profile 升级）正是 R0 的内容。 |
| `docs/plans/tasks/poster-quality-experiment.md` | 本评审是 poster-quality-experiment 的**方法论输入**。R0-R6 应作为下一轮实验的任务清单。 |
| `architecture/l2-resource-library.md`（§2 type/profile/reference 三关切解耦） | 本评审**不推翻**——三关切解耦是结构层，本评审是内容层（profile 应该装什么）。 |
| `knowledge/methodology.md` §1 注入可靠性排序 | 本评审**强化**——启发 3 的"critique 不要自动重渲"是该排序在风格系统层的具体兑现。 |
| `watercolor_poster_v1` profile | 本评审**提供重写样板**——R0 的执行对象。 |

## 待确认事项

1. **profile 的存储形态**：继续走 `.fig` 的 TEXT 节点（当前做法），还是迁移到独立 `.md` 文件由 marketing library 注入？前者与现有架构一致但单 profile 难做版本化；后者更易做 schema 校验但需要工具改造。
2. **R0 的样板**：是重写现有的 `watercolor_poster_v1`（最小代价、与当前进度对齐），还是新建一个更典型的非水彩 profile（如 `editorial_v1`）来**打破水彩 = 海报感的过拟合**？后者风险更大但收益更高。
3. **`critique` 工具的阈值**：评审一第二部分 8 条指标，是否全部进入 v1，还是先取最容易算的 5 条（字阶跨度 / 背景连续性 / 叠压率 / 留白 CV / 出血）？

## 结论去向

本评审不重复评审一的"三层根因"，而是补充**风格系统作为独立工程产物**这一方法论缺口。落地路径是 R0-R6 六件事，按 R0（profile 三段重写）+ R1（critique 工具）的元动作优先。

**最大启示不是"抄诗性纸感的视觉语言"，而是"风格系统要当工程产物"**——这件事 skill 做到了，openpencil 在 profile 层还没做到。
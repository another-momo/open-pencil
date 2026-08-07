# Task: 海报感实验（Prompt-only 臂）

日期：2026-08-07
状态：施工中（代码已落，待冒烟）
范围：`src/app/ai/chat/system-prompt-base.md`、`tools/marketing-library/src/generate.ts`、`public/default-library.fig`、对应测试
设计依据：`../../review/2026-08-07-long-image-design-quality-review.md`

## 背景与目标

评审结论：长图产出"像界面不像海报"的三层根因中，**第一层是能力披露缺口**——引擎支持 4 种渐变 / 多重填充 / 3 种蒙版 / 17 种混合模式，`design-jsx` 的属性通道全部打通，而 system prompt 明确写着 "Colors are hex only" 与 "These are ALL available props. Nothing else exists."

本实验只验证一件事：

> **把已有能力如实告诉 Agent，再给它一份带海报数值的风格档案，产出能否从"UI 感"跨到"海报感"？**

## 实验设计：为什么是单臂 prompt-only

刻意**不**同时上 `compose_backdrop` 工具。理由：

1. **可证伪**。prompt 层是方法论 §1 注入可靠性排序里的**次低档**（工具返回值 > prompt 硬规则 > prompt 指引）。如果只补 prompt 就能出效果，说明此前纯粹是能力被藏起来了，`compose_backdrop` 可以不做或缓做；如果补了没效果，正好实证方法论 §1 的预测——确定性合成必须工具化，那时再投 P2 就有了依据。
2. **可归因**。两层同时动，成功也分不清是谁起的作用。
3. **成本**。改动集中在 2 个文件 + 1 个构建资产，完全可逆。

**失败也是有信息量的结果**，不是白跑。

## T1 — `system-prompt-base.md` 能力披露（已完成）

三处改动：

**(a) 解除能力否认**
- L19 `Colors are hex only` → 改为 hex 为主、`fills` 另接受 paint helper 产出的渐变对象
- L23 `These are ALL available props. Nothing else exists.` → 改为"这是布局与外观属性；合成原语见下节；两张表之外不要臆造属性"
- Appearance 行补 `fills={[...]}`、`mask="alpha"|"luminance"|"vector"`，并把 `blendMode="multiply"|etc` 展开为真实枚举

**(b) 新增 `## Composition primitives` 段**

关键发现：JSX 沙箱**已经**把 `solid` / `linearGradient` / `radialGradient` / `angularGradient` / `diamondGradient` / `dropShadow` / `innerShadow` / `layerBlur` / `backgroundBlur` / `foregroundBlur` 注入为可直接调用的标识符（`packages/core/src/design-jsx/render.ts:218-229, 276-287`），prompt 此前一个都没提。所以配方不需要手写 Fill 对象，直接调 helper 即可。

段内含 5 条配方，全部来自实测：
1. BaseWash 竖向渐变兜底
2. 接缝 alpha 渐变蒙版羽化（含 Figma 语义提示：mask 作用于其**后**的兄弟节点）
3. 全画布 `blendMode="hue"` 色调统一层
4. 多重填充按数组顺序叠加
5. 文字图形化与叠压

**⚠ 记录一个坑**：`DEFAULT_GRADIENT_TRANSFORM` 是单位矩阵，代入 `linearGradientEndpoints`（`packages/core/src/canvas/fills.ts:300-311`）得到 `start(w,0) → end(0,0)`，即**右→左**——几乎不是任何人想要的方向。因此 prompt 强制要求每次显式传 `transform`，并给出竖向 / 横向两组矩阵值。

**(c) 字阶优先级注**

不改 base 的 UI 字阶数值（那属于 P1，需按素材类型分档，本轮不做），只在 Typography 段末尾加一条：该字阶面向信息密集版式；表现型格式的 hero 标题在 750 宽画布上通常 72–110px（约 5–8× 正文）且刻意同时叠加多个属性；**若 Active style profile 给了自己的字阶或间距，以 profile 为准**。

这把"两条互相矛盾的指令"变成"一个默认值 + 一条明示的覆盖规则"。

## T2 — 国风长图 profile（已完成）

`tools/marketing-library/src/generate.ts` 新增 `chinese_festival_v1`，`applicable_to: product_long, event_poster, xiaohongshu`。

profile 是最高优先级 overlay，因此把海报数值放这里 = **零 plumbing 实现 P1 的效果**，不需要给 Types 区加 `expressiveness` key、不需要改装配层。

档案内容（不再是"色/字/语气/版式"四件套）：配色（含"强调色全图只用一处"）· 字阶（主标题 88 / 段标题 40 / 正文 24，并显式解除 base 的单属性限制）· 间距（段间 96–160，并要求节奏不均匀）· 背景层四步 · 标题笔触垫底做法（含生图 prompt 片段）· 分隔方式（禁用分隔线）· 装饰元素库（4 类，各附生图 prompt 片段）· 语气。

`public/default-library.fig` 已重新生成（36.9 KB）。

## 测试

**新增** `tests/engine/render/jsx/poster-primitives.test.ts`（6 case，全绿）——逐条验证 prompt 里的配方语法真的生效，而不是产出"看起来合法但什么都不渲染"的 JSX。这是本实验最重要的护栏：**配方失效会伪装成"模型没审美"**，污染实验结论。

覆盖：竖向 transform 端点断言 · 默认 transform 为右→左（把坑本身钉成回归测试）· `mask="alpha"` 产出 `isMask/maskType` 且作用于后续兄弟 · `blendMode="hue"` 落为 `HUE` · 多重填充顺序 · `radialGradient` 在作用域内。

**扩展** `tools/marketing-library/tests/generate.test.ts`——断言新 profile 的 id / label / applicable_to，以及三个关键数值（`主标题 88`、`blendMode="hue"`、`段间 96–160`）能活过 `.fig` 往返。数值若在往返中丢失，实验会静默退回 UI 尺度。

## 验证

冒烟用例：**用户提供的端午长图 spec**（背景层 4 条 + 内容层 4 段）。它是现成的、完整的、可逐条打勾的验收标准。

跑之前先按 `architecture/l2-visual-loop.md` §3.1 的 TEST-1234 法确认图片对模型可见，否则 look 空转。
在 MarketingConfigBar 手动选中 `国风节日长图` profile——P8 修复后 profile **只有用户显式选择才会挂载**，不选则 overlay 输出 `(none)`，实验等于没做 T2。

### 验收标准

背景层（来自用户 spec）：

| # | 条目 | 通过判据 |
|---|---|---|
| 1 | 底层铺色兜底 | 存在跨全画布的渐变矩形，位于最底层 |
| 2 | 分段生图 + 重叠 | ≥2 张底图，相邻有重叠区 |
| 3 | 接缝渐变蒙版 | 接缝处存在 `isMask` 节点，无肉眼硬边 |
| 4 | 全局色调统一层 | 存在 `blendMode=hue\|overlay`、低 opacity 的全画布矩形 |

海报感指标（来自评审第二部分，8 条中取可快速判读的 5 条）：

| 指标 | 阈值 |
|---|---|
| 字阶跨度 `max/median fontSize` | ≥ 5（当前基线约 2.9） |
| 背景连续性 | 存在跨 ≥60% 画布高度的背景节点 |
| 叠压率 | 内容节点与图片节点包围盒相交数 > 0 |
| 留白变异系数 | > 0.3（均匀 ≈ 0） |
| 出血 | 至少一处元素触达画布边缘 |

本轮**手工判读**，不建 `critique` 工具（那是 P3，取决于本轮结论）。

### 本地验证命令

`bun test tests/engine/render/jsx tools/marketing-library/tests` · `oxlint -c oxlint.json --type-aware --type-check --threads 2 <改动文件>` · `bunx tsgo --noEmit`

## 明确不做

- **不做 `compose_backdrop`**（P2）——本实验的对照项，取决于本轮结论
- **不动 base.md 的字阶/间距数值本身**（P1）——只加优先级注；真正的分档需要 Types 区加 key + 装配层改造，且依赖"表现力分档"这个尚未拍板的产品判断
- **不做 `critique` 工具**（P3）——本轮手工判读
- **不做三槽 section / `place_decor`**（P4）、**不做构图先行**（P5）、**不做参考库**（P7）
- 不动 `system-prompt-marketing.md`（工作流部分本轮无责）

## 结论去向

跑完按 `knowledge/methodology.md` §7 归档到 `knowledge/error-catalog.md` 第 5 轮。两种结局各自的下一步：

- **成效明显** → 把 T1 的能力披露固化，P1 分档提上日程，P2 降级为可选优化
- **成效不明显** → 实证了方法论 §1（prompt 层不足以约束确定性合成），直接上 P2 `compose_backdrop` + P3 `critique`，并记录"prompt-only 不足"这个结论本身
- **部分成效**（预期最可能）→ 记录哪几条落地了、哪几条没有；没落地的条目按"是否确定性可代码化"分流到 P2/P4

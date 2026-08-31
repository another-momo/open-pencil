<!--
  写作纪律（改本文前必读）：
  - 事实性声明必须附核验命令 + 日期，否则标为【假设】
  - 计划被实测推翻时，直接改本文为新版本，完整理由记入 records/ 子文档
  - 本文只保留当前态，不保留修正历史
  - 改完后刷新本文头部的「状态」字段
  - 详细规则见 docs/rebuild/05-process.md §4
-->

# T46 计划 · base.md v0 落位 + 红线补洞 + base 候选清单建档（S4 W1 / T-A5）

> **状态**：✅ 已收口（2026-08-31；状态行遗留翻转由 T47 补正） | **时间**：2026-08-31 立项 | **负责人**：主 agent
> **⚠ 当前态修正（T49，2026-08-31）**：owner 指令——红线补洞段及配套机制（构建器 SECTION 常量/核验 BLOCK_RE/钉扎断言）已全部撤除（过度工程），base.md 回归 119 行纯转写、不承载显式红线段；本文补洞段相关段落为历史记录，现役口径见 [T49-plan.md](T49-plan.md)
> **⚠ 当前态修正（T47，2026-08-31）**：owner 指令 #6——转写源已由 system-prompt.md 576 行切换为 prompts/system-prompt-base.md 119 行（workflow 无关），本文 D-a/D-b/§1 的 576 行源口径与「system-prompt.md 双源」相关段落为历史记录，现役口径见 [T47-plan.md](T47-plan.md)
> **分支**：`rebuild/mode-arch`（worktree `open-pencil-mode`；T45 收口 c2fca16f 之后）
> **规格真源**：[S2 资产文件机制规格 v2](../../../doc/S2-asset-files-spec.md) §3（base.md 全局行为基座 + base v0 沿用两条守卫）；[S4 Phase 3 计划 v2](../../../doc/S4-phase3-plan.md) §4 W1 T-A5 行 + §3 前置批「base v0 红线补洞」行；[19 册 PD-20](../../../docs/202608251637-migration-proposal/19-product-design-decisions.md)（base 节奏拍板原文）

## 1. 背景与立项

T43 建成 studio 文件机制内核（base 唯一槽位已在注册表——双源皆缺时 failures 记显式缺失态），T44 迁入三份 profile 与 longform.md 骨架，T45 完成 manifest 投影改源。W1 最后一块：**base.md 落位**——S2 §3 规定 base 全局唯一、不可选、每回合必组装；PD-20 拍板 base v0 = 原 576 行自包含 UI prompt（`src/app/ai/chat/system-prompt.md`，`wc -l` 实测 576 行，2026-08-31——S4/PD-20 成文口径「572 行」为 2026-08-30 时点值，4 行偏差随本文登记）**沿用素材、不做重新设计**，配两条守卫：

1. **红线补洞（PD-20 ①，本任务）**：确认 base v0 中事实零虚构（红线 #3）/成本确认（#2）/可撤销（#6）/不静默降级（#8）齐全；**新增「修辞事实标注」纪律段**——AI 创作内容中可被解读为事实声明的元素（功效/数据/背书修辞）必须显式标注请用户确认（PD-8 放开文案的合规配套，中文广告法语境；CP 表单落点属 workflow 层，base 段写 mode 无关纪律）。
2. **base 候选清单（PD-20 ②，本任务建档）**：撰写长图 workflow 期间发现 base v0 中长图专属、应下放的内容逐笔记录的清单——T-C1/C2 持续记录、W5 归档（S4 §7 尾巴表已挂行）。

立项预检（2026-08-31，grep 实证）：

- 四红线在 576 行 prose 中**均无直接对应段**——`grep -c "虚构\|编造"` = 0；"撤销"仅命中示例 JSX 的 `undo-2` 图标名；"成本/确认/静默/降级"无纪律语义命中。可撤销/不静默降级实际由宿主与工具行为承载（undo burst、历史容器、错误用户语言化）——逐条判定落点（prompt 纪律 vs 宿主承载说明）是实现段工作，判定依据逐条记入自检。
- base 槽位校验现状（`registry.ts` loadBase，2026-08-31 Read 实证）：仅查 frontmatter id（缺省=base 合法；若写必须为 `base`），**无 label 要求、无必需节**——「base.md 免 label 校验」尾巴（S4 §7）的现状即如此，本任务成文 + 钉测试。
- 组装消费面：ui 基底 = `modes.ts:38` basePromptPath `src/app/ai/chat/system-prompt.md`；marketing 基底 = `system-prompt-base.md` + 工作流段（`modes.ts:43-44`）。消费 system-prompt.md 的还有六个冒烟 fixture（t21/t22/t23/t24/t28——复制进 tempRoot）。

## 2. 决策点（本任务开工前拍板/默认项登记）

- **D-a base.md 内容 = 576 行全文转写 + 补洞段**：逐字沿用（T44 保真核验先例——diff 脚本钉零偏差），frontmatter 仅 `id: base`（schema 见 D-e）。唯一内容新增 = D-c 补齐段（如检查判定需补）+ D-d 修辞事实标注段；除此零改写、零润色（PD-20：补洞非调优）。
- **D-b 组装侧不动，落位语义 = 注册表在案**：与 T44 longform.md 骨架同——W1 是地基波，每回合组装消费（S2 §6，PD-19）属 W2/W3。ui 基底继续读 system-prompt.md（modes.ts:38 不动，冒烟 byte 级断言不动）。**双源漂移防控**：base.md 头注声明「本文 = system-prompt.md 转写 + 红线补洞；组装接入（W2/W3）前 ui 基底仍以 system-prompt 文件为准」+ system-prompt.md 头注互指 + S4 §7 新增尾巴行「base.md/system-prompt.md 双源收编」指认时机 = W2 每回合组装改造。
- **D-c 红线齐全性检查方法**：四条红线逐条过 576 行——判据 = 有无 mode 无关的纪律命题落点；落点分两类（prompt 纪律段 / 宿主·工具承载的说明句），缺席者以最小纪律句补齐进新增节（非调优：不加行为规范之外的修辞）。判定表（红线 × 现状 × 处置 × 依据行号）记入 T46-self-check。
- **D-d 修辞事实标注段**：新增一节（位置施工时定，倾向靠近工作流纪律区；文风随文件惯例——英文节题 + 祈使纪律句式，与既有 Prohibited/Workflow 节同构）。语义覆盖 PD-20 ① 三例（功效/数据/背书修辞）+「显式标注请用户确认」动作；不写 CP 表单机制（workflow 层职责，S1 §7 层归属表）。
- **D-e base frontmatter schema 成文**：`id` 可缺省（缺省即 base；写了必须是 `base`）；**免 label**（base 不可选、无 UI 展示位，S2 §3 未定义 label 消费面）；无必需节（v0 沿用素材不强塞节结构——目标态节结构随 PD-20 触发式重设计再定）。现状注册表已如此，本任务钉测试 + S4 §7「base.md 免 label 校验」行标记已处置。
- **D-f 钉扎测试收编**：`studio-builtin-assets.test.ts` 的 failures 断言从「恰 1 条 base 缺失」收为 `failures: []`（文件头注 :7-8 已预约此收编），并加 base 注册断言（id=base、body 含四条红线语义锚点与修辞事实标注节题）；registry 单测不动（fixture 自带 BASE_MD）。
- **D-g base 候选清单建档位置 = 仓外 `doc/base-candidate-list.md`**：与 S 系列同目录（过程资产，T-C1/C2 将持续写；仓内 docs/rebuild 是任务档案不是工作文档）。骨架 = 来源（PD-20 ② 原文引）+ 条目格式约定（内容摘要 / base 中行号 / 下放理由 / 发现任务）+ 空表（T-C1 启动前无积累，不预填猜测项）。S4 §7「base 候选清单指认」行更新指向该文件。
- **D-h 用户目录覆盖语义不动**：`~/.openpencil/studio/base.md` 同 id 覆盖即生效（T43 机制）；「覆盖自担风险」S2 §3 已注明，不加额外保护。

## 3. 范围与修法

- **S1** `src/app/ai/pi-backend/studio/base.md`：frontmatter（`id: base`）+ 头注（D-b 声明）+ 576 行全文转写 + 补洞段（D-c/D-d）。
- **S2** `src/app/ai/chat/system-prompt.md`：头注一行互指（D-b），正文零改动。
- **S3** 红线齐全性检查：逐条判定 → 需要则最小补齐（随 S1 落进新增节）；判定表记自检。
- **S4** `tests/engine/rebuild/studio-builtin-assets.test.ts`：failures 收零 + base 断言（D-f）；按需加 base schema 钉扎（D-e：无 label 注册成功 + 非 base id 仍失败——后者 registry 测试已有，不重复）。
- **S5** 保真核验脚本 `tools/rebuild/verify-t46-base-fidelity.mjs`：base.md body 减补洞段后与 system-prompt.md 逐字 diff 为零（T44 verify-t44-migration-fidelity.mjs 先例——NORMALIZE 表登记任何被迫偏差，如 oxfmt 列表标记）。
- **S6** `doc/base-candidate-list.md` 建档（D-g）+ S4 §7 尾巴表两行更新（清单指向；免 label 行标已处置）+ 新增双源收编行（D-b）。
- **S7** 实证：probe/冒烟复跑确认端点 failures 从「base 缺失一条」收为空数组；登记 tracker/_index/三件套。

## 4. 验收标准

- **C1** base.md 落位保真：body 减补洞段与 system-prompt.md 逐字一致（保真脚本 0 diff，NORMALIZE 表逐笔登记）；frontmatter `id: base`；头注双源声明在。
- **C2** 红线补洞：四条红线判定表齐全（逐条落点/处置/依据）；修辞事实标注段存在且语义覆盖功效/数据/背书三例 + 请用户确认动作。
- **C3** 注册表收零实证：`bun test tests/engine/rebuild/` 全绿且钉扎断言 `failures: []`；`bun spikes/probes/probe-t45-old-route.mjs`（或等价探针）实证端点 failures 空数组。
- **C4** base schema 成文（D-e）+ 免 label 钉扎测试绿。
- **C5** 候选清单建档 + S4 §7 三处更新落地（清单指向 / 免 label 已处置 / 双源收编新增行）。
- **C6** 门禁九项全绿 + 全量回归对照 T45 基线（78 fail/2660）失败数不增、唯一化 diff 零本任务文件。

## 5. 不做（out of scope）

- 不动组装链：modes.ts/service.ts 装配零改动（每回合组装 = W2/W3，S2 §6）；ui/marketing 冒烟 byte 级断言面不动。
- 不重新设计 base 内容（PD-20 触发式任务：第二个 mode 的 workflow 开工前）。
- 不写 longform.md 内容填充（T-C2）、不分流 marketing prompt 静态段（T-C1）。
- 不收紧 `.MD` 大写扩展名尾巴（本任务不触碰 registry.ts 扫描逻辑；维持 S4 §7 悬挂）。
- 候选清单只建档不预填（T-C1/C2 期间积累，W5 归档）。

## 6. 风险与回退

| 风险 | 缓解 |
|---|---|
| 576 行转写产生静默偏差（全角/半角、列表标记被 oxfmt 改写——T44 已踩过 `1.（` 段落合并） | 保真脚本逐字 diff（S5）为硬卡口；base.md 在 oxfmt format 范围内，任何被迫偏差进 NORMALIZE 表登记 |
| 红线补齐尺度走样成「调优」（PD-20 明令禁止） | D-c 判据限定「最小纪律句」；判定表逐条留依据，subagent 核验可复查 |
| 双源暂行期漂移（base.md 与 system-prompt.md 内容重复） | D-b 三重防控（双向头注 + S4 §7 收编行）；暂行期跨 W2 前仅 W3 前数任务，漂移窗口小 |
| 回退 | base.md/清单/测试各为新增文件，system-prompt.md 仅一行头注——git revert 即回退 |

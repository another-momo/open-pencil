<!--
  写作纪律（改本文前必读）：
  - 事实性声明必须附核验命令 + 日期，否则标为【假设】
  - 计划被实测推翻时，直接改本文为新版本，完整理由记入 records/ 子文档
  - 本文只保留当前态，不保留修正历史
  - 改完后刷新本文头部的「状态」字段
  - 详细规则见 docs/rebuild/05-process.md §4
-->

# T49 核验 · base 红线补洞段及机制撤除 + S1 §7 层归属修正

> **状态**：✅ 核验通过（带 findings，全部处置完毕） | **时间**：2026-08-31 收口 | **核验人**：独立核验 subagent（只读约束）+ findings 处置后主 agent 复核
> **关联**：[T49-plan.md](T49-plan.md)（验收标准 C1-C6）/ [T49-self-check.md](T49-self-check.md)

## 核验结论

**通过带 findings**：C1-C6 全部独立实证通过（V1-V6 全 ✅）；findings F1-F3 均为仓外规格文档（doc/）同步欠账，已于 2026-08-31 当日处置完毕并复核一致。

核验执行面：HEAD = 15fa0613（实现提交）；核验 subagent 全程只读（禁写/禁 git 写/禁格式化写模式/禁构建脚本），门禁均无管道直读退出码。

## V1 纯转写（C1）—— ✅

- `grep -c "Trust & Safety" src/app/ai/pi-backend/studio/base.md` = 0 命中（exit 1）；
- `node tools/rebuild/src/verify/t46-base-fidelity.mjs` = 3/3 绿（exit 0）：frontmatter id=base / 双源头注两文各一 / 剥除后逐字保真零 diff；
- base.md = 123 行（wc -l），尾段止于「## Advanced tools」eval 段，无补洞段、无 T46 标记注释残留；构建器幂等 = 主 agent 收口复跑两连跑均 10887 bytes、`git diff --stat` 稳定 1+/16-（2026-08-31）；
- `git show 15fa0613 --stat` = 恰 12 文件（44+/94-）。

## V2 机制零残留（C2）—— ✅

- `grep -rn "补洞\|Trust & Safety\|修辞事实标注\|BLOCK_RE" src/ tests/ tools/ spikes/` = 零命中（exit 1）；
- docs/ 命中逐行核对全部属豁免面（T43/T46/T47 历史段落、T46-T49 指针行、tracker/_index 登记行、T49 三件套自身引用）。

## V3 规格面（C3，仓外 doc/）—— ✅

- S1-product-spec.md §7：删三行（事实零虚构 #3 / AI 可写文案 PD-8 / 修辞事实标注 PD-20 ①）确认不在表内；#2/#5/#6/#7/#10 层=宿主；#1=base+宿主；#8=宿主且带「base 侧纪律候选随 PD-20 触发式评估」注记；节首有 2026-08-31 owner 决策行；
- S1 §8「base 重新设计」守卫 = 撤销口径；derive_palette/sample_hero_color 行含「owner 2026-08-31 最终确认」；附录行已随 F1 处置改写（见下）；
- S4-phase3-plan.md：版本线含 v4（T49）与 v5（§7 尾巴拍板批次）；§7 前两行 = 已拍板（废弃 / run 终止续跑）；新建意图通道与 brief 呈现形态 = 🔶 讨论中；multi-segment/casual_v1/editorial-solid Recipe/hero_composition 四行 = 拓展批；§4 T-C3 = 单精品做透 + 首发选择待拍板（v2 先行 vs v3 改写先行，实施者建议 v2 先行）。

## V4 门禁与冒烟（C4）—— ✅

九门 exit 0（check:zones / check:docs 42/42 / check:tasks / check:bindings / lint 0 error / tsgo / check:vue / format:check / check:i18n），核验 subagent 与主 agent 收口复跑（2026-08-31）双证一致；`node spikes/s-pi/backend-smoke/t24/prompt-assembly-smoke.mjs` = 30/30；`bun test tests/engine/rebuild/` = 26 pass / 0 fail（110 expect）。

## V5 回归裁决独立性（C5，只读复查）—— ✅

- 两跑均 2560 pass / 78 fail / 2661；唯一化清单（doc/t49-failures.txt）73 条 vs T48 基线（doc/t48-failures.txt）71 条 = +2 零删除，两跑交叉增量并集恰为三条 flake：`eval CLI > findAll`（30s 超时，run1）/ `export subgraph extraction`（15s 超时，两跑）/ `MCP server concurrent startServer`（47ms EADDRINUSE 竞态，run2）；
- 三条宿文件均不在本任务触碰面；T48 基线 71 条原样在列（零修复零新增真实失败）；
- 三条 flake 的孤立复跑全过（subagent 实测留档 doc/t49-regression-run.log / run2.log / t49-failures-run1.txt / run2.txt）；78 = 76 + 2 当跑 flake，账目自洽。

## V6 登记面（C6）—— ✅

tracker.md T49 行（L60）/ _index.md T49 行（L83）三列真实链接齐；T46/T47 三件套六文档各一条「⚠ 当前态修正（T49，2026-08-31）」指针行（grep 6 命中，第 7 条为 T49-plan 自身 D-f 描述，符合预期）。

## V7 缺陷面独立判断 —— findings 三条（全部已处置）

- **F1（P2，文档矛盾）**：S1 §3 执行序仍以强制语气携带「修辞事实标注（PD-20 ①）必须显式标注」+ CP1 表单项「修辞事实标注确认」，与附录「已撤销」声明及 owner「从文档拿掉」指令矛盾；附录行对 §3 现状描述失真。**处置（2026-08-31）**：§3 删除该强制 bullet 与 CP1 表单项（连带去掉半悬空的「（红线 #3 维持）」括注）；附录行改写为「已拿掉（T49）……是否作为 workflow 效果层内容后期打磨再评，括注挂 S4-phase3-plan.md §4 T-C1/T-C2」。同步面：S4 §1 一句话范围与 §6 T-D2 验收口径的「含修辞事实标注/含修辞标注」表述一并去除；S2-asset-files-spec.md §6 静态段分流行补转出括注。
- **F2（P2，S3 同步欠账）**：S3-tool-contracts-spec.md 两处未随 v5 拍板同步——sample_hero_color 仍「废弃倾向待最终确认」、ask_user_question 挂起形态仍「实施时定」。**处置（2026-08-31）**：L24 改「废弃（owner 2026-08-31 最终确认，随 PD-4 定谳）」；§5 语义段改「run 终止续跑（owner 2026-08-31 拍板定谳）」，挂起期间 run 暂停表述重写为「run 正常终止、现场由落盘设计身份 + brief 承载、作答作为新回合触发续跑」。
- **F3（P3，观察项）**：S1 §1 差异化定位仍宣示「事实零虚构」。**处置（2026-08-31）**：保留不动——该行为产品定位宣示（08 §J 反超项），非纪律条款；定位层改写属 owner 拍板面，不在 T49 指令范围（owner 指令明确圈定 §7 安全纪律）。§3 的半悬空红线括注已随 F1 一并去除。
- **附带处置**：S2-asset-files-spec.md §5 红线补洞守卫行改撤销口径，并顺手修正 T47 同步欠账（「原 572 行 system-prompt.md」口径 → 119 行 workflow 无关源，T47 改源口径）。

## 收口证据清单（2026-08-31）

| 证据 | 命令 | 结果 |
|---|---|---|
| 保真核验 | `node tools/rebuild/src/verify/t46-base-fidelity.mjs` | 3/3 绿 exit 0 |
| 构建幂等 | `node tools/rebuild/src/build-t46-base.mjs` ×2 + `git diff --stat` | 10887 bytes 两跑一致，diff 稳定 |
| 九门 | `bun run check:zones / check:docs / check:tasks / check:bindings / lint / tsgo / check:vue / format:check / check:i18n` | 全 exit 0（lint 0 error） |
| 冒烟 | `node spikes/s-pi/backend-smoke/t24/prompt-assembly-smoke.mjs` | 30/30 exit 0 |
| 单测 | `bun test tests/engine/rebuild/` | 26/26 exit 0 |
| 回归 | 两跑日志 doc/t49-regression-run.log / run2.log | 78 fail = 基线 76 + 2 flake，裁决干净 |

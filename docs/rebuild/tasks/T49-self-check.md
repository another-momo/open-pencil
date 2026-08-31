<!--
  写作纪律（改本文前必读）：
  - 事实性声明必须附核验命令 + 日期，否则标为【假设】
  - 本文只保留当前态，不保留修正历史
  - 详细规则见 docs/rebuild/05-process.md §4
-->

# T49 自检 · base 红线补洞段及机制撤除 + S1 §7 层归属修正

> **状态**：✅ 已完成 | **时间**：2026-08-31 立项 / 2026-08-31 收口 | **负责人**：主 agent（实现段派 subagent 执行，主 agent 复核 diff 后提交）

## 1. 立项段自查（目标面实证，2026-08-31）

1. **补洞段当前形态**：`src/app/ai/pi-backend/studio/base.md` L125-138 为 `<!-- T46 红线补洞段 begin/end -->` 包裹的 Trust & Safety 节（sed -n '120,160p' 实测）；机制配套 = build-t46-base.mjs SECTION 常量 + verify-t46-base-fidelity.mjs BLOCK_RE + studio-builtin-assets.test.ts 两条钉扎（`grep -rln "Trust & Safety\|补洞\|修辞事实标注" src/ tests/ tools/ docs/` 命中清单在案）。
2. **S1 §7 现状**：11 行纪律表中 9 行层归属含 base（doc/S1-product-spec.md L125-142 实读）；§8 不做清单「base 重新设计」行守卫含「红线补洞现在做」；附录索引含「§3/§7 修辞事实标注」行。
3. **S4 牵涉面**：§3 前置工程批补洞行 / §4 T-A5 行 / T-C1·T-C2 修辞事实标注工作项 / §7 双源收编行「补洞段」表述（grep 实测）。
4. **决策记录**：owner 指令原文入 T49-plan 规格真源行；层归属目标形态 = D-d 表（删 3 行 / 5 行改宿主 / #1 保持 base+宿主与 #8 改宿主均标注 base 侧候选随 PD-20 触发式任务评估）。

## 2. 实现段核验

（subagent 执行，2026-08-31 实测填报；主 agent 复核 diff 后提交）

- **C1 base.md 纯转写**：`grep -c "Trust & Safety" src/app/ai/pi-backend/studio/base.md` = 0（grep exit 1 零命中）；`node tools/rebuild/verify-t46-base-fidelity.mjs` 3/3 绿（exit 0）——检查项 6→3：删「补洞段标记 begin/end 各恰好一次」「补洞段含四红线语义锚点」「补洞段含修辞事实标注」三项，保留 frontmatter id=base / 双源头注两文各一 / 逐字保真零 diff；构建器（node 跑）连续两跑 `git diff --stat` 零增长（幂等）；base.md 现 123 行 = frontmatter + 双源头注 + 119 行纯转写（wc -l 实测）。
- **C2 机制零残留**：`grep -rn "补洞\|Trust & Safety\|修辞事实标注\|BLOCK_RE" src/ tests/ tools/ spikes/` 零命中（exit 1）；docs/ 命中（T43/T46/T47 历史段落、T46-T49 指针行、tracker/_index 登记行、T49 三件套自身引用）逐行人工核对属豁免面。
- **C3 S1 §7 修正落位**（sed 实读复核）：§7 删三行（事实零虚构 #3 / AI 可写文案 PD-8 / 修辞事实标注 PD-20①）；五行层归属改宿主（#2/#5/#6/#7/#10）；#1 保持 base+宿主、#8 改宿主，两行实施落点均补「base 侧纪律候选随 PD-20 触发式 base 重新设计评估（T49 后 base.md 不承载显式红线段）」；节首引言补记 owner 2026-08-31 决策行；§8「base 重新设计」守卫改撤销口径；附录索引行标注「（已撤销，T49）」。S4 五处同步（§3 前置批行划线撤销 / §4 T-A5 划线撤销 / T-C1·T-C2 修辞事实标注括注 / §7 双源收编行去补洞段）+ 版本线 v4 记录。
- **C4 门禁与冒烟**（全部直读退出码）：check:zones=0 / check:docs=0 / check:tasks=0 / check:bindings=0 / lint=0 / `tsgo --noEmit`=0 / check:vue=0 / format:check=0 / check:i18n=0；`node spikes/s-pi/backend-smoke/t24/prompt-assembly-smoke.mjs` 30/30（exit 0）；`bun test tests/engine/rebuild/` 26/26（110 expect() calls）。
- **C5 回归**（两跑）：run1 = 2560 pass / 23 skip / 78 fail / 2661（日志 doc/t49-regression-run.log）；run2 = 2560 pass / 23 skip / 78 fail / 2661（doc/t49-regression-run2.log）。唯一化失败清单 doc/t49-failures.txt（= run2）73 条 vs T48 基线 doc/t48-failures.txt 71 条，diff = +2 零删除：run1 增 `eval CLI > findAll queries nodes`（30s 超时）+ `export subgraph extraction`（15s 超时）；run2 增 `MCP server concurrent startServer`（47ms 竞态）+ `export subgraph extraction`（15s 超时）——均为负载/计时 flake，孤立复跑全过（subgraph.test.ts 4/4；findAll 在 eval.test.ts 孤立跑中 pass，孤立 4 fail 恰为 T48 基线已有的 4 条环境性 eval CLI 失败；startServer 孤立 1/1）；diff 零本任务文件；T48 基线 71 条全部原样在列（零修复、零新增真实失败）。详见 §3 第 2 条。
- **C6 登记面**：T49 三件套齐（plan/self-check/verify 立项段已在）；tracker.md T49 行（L60）/ _index.md T49 行（L83）立项段已登记；T46/T47 六文档状态行后各加 T49 指针行（git diff 各 +1 行实测）。

## 3. 实测修正记录

1. **lint 初跑 exit 1（no-useless-concat，本任务引入）**：build-t46-base.mjs 改写初版 `` `---\n...` + `${HEADNOTE}\n\n` + forTranscription `` 的相邻模板字面量拼接触发 oxlint eslint(no-useless-concat)（lint:structure 覆盖 tools/；原文件四段拼接因末段紧随标识符未触发）。处置：合并为单一模板字面量 `` `---\nid: base\n---\n\n${HEADNOTE}\n\n${forTranscription}` ``；复跑 lint=0，重建 base.md 字节不变（10887 bytes）、verify 仍 3/3、幂等两跑零增长复确认。
2. **回归 78 fail 超 T48 基线 76 的定性**：两跑 diff 增量集合不一致（run1：findAll + subgraph；run2：MCP startServer + subgraph），三条均孤立复跑通过，subgraph 连续两跑满套负载下超 15s 上限（孤立整文件 11.5s）。判定 = 负载/计时 flake 旋转，非真实回归；未改任何测试代码；实证留档 doc/t49-regression-run.log / t49-regression-run2.log / t49-failures.txt / t49-failures-run1.txt / t49-failures-run2.txt。
3. **Windows 控制台 GBK 显示干扰**：grep docs/ 命中清单在控制台显示乱码，已逐行核对（文件:行号 + 内容关键词）确认全部属豁免面；不影响 C2 代码面零命中结论。

<!--
  写作纪律（改本文前必读）：
  - 事实性声明必须附核验命令 + 日期，否则标为【假设】
  - 本文只保留当前态，不保留修正历史
  - 详细规则见 docs/rebuild/05-process.md §4
-->

# tasks/T29-plan.md · T29 决策批文档面整改

> **T 编号**：T29（决策批落地 · 文档面）
> **状态**：✅ 已收口（实施+收口完成；独立核验见 [T29-verify.md](T29-verify.md)）

## 1. 背景与立项依据

2026-08-25 owner 对三方 review 整改报送清单 15 项逐项拍板（决策批，单一留痕口 = [records/topics/docs-governance.md 决策批总登记](../records/topics/docs-governance.md)）。T29 承载其中**文档面**的规则文写作与登记（T28 承载代码面机制实现）；#9/#11 拍板「维持现状/交上游」无落地动作，仅登记。

本文件为收口时补写的立项文档：实施期方案以主 agent 的 T29 subagent 任务书（T29-D1..D10 十项交办）为准。

## 2. 验收清单

- C1 补签组落地：D3（session 模型）/D5（chatMode）补签登记 + D16 形式关闭 + 治理冻结期「部分解冻」拍板登记（决策批 #3）
- C2 CI-14 分支保护登记（决策批 #4，主 agent 经 gh api 已落地，T29 负责记录）
- C3 规则文写作：05-process.md §3.2 zones.json 变更报警（#6）+ §3.3 补丁过堂（#5）与双周窗口（#15）+ §4 D 编号口径改口（#7）+ §2 tracker 归档机制注（#8）
- C4 全局 D 注册表补登 D25-D29 + records/_index.md §1 Tk-Dn 规则文（#7）
- C5 tracker 行数治理：T00-T20 长实录归档 tasks/_index.md §6，tracker ≤80 行预算重新可达（#8）
- C6 层 1 验收口径重建：01-target-state.md §3 改五环冒烟口径 + tracker Phase 3 行同步（#13）
- C7 根文档最小指针：README.md「OpenPencil Rebuild」节 + AGENTS.md Documentation 节两行（#14；CHANGELOG 不动）
- C8 决策批总登记条目（docs-governance.md）15 项逐项结论单一留痕口
- C9 纪律红线：records/ append-only 零违反；05 修改按 05 自身纪律登记决策；本机绝对路径不入库（D17）；4 处 `<待 T28 回填>` 标记由主 agent 收口回填

## 3. 交办十项（T29-D1..D10 编号为收口编排）

| # | 项 | 决策批 # | 落点 |
|---|---|---|---|
| T29-D1 | 补签组：D3/D5 补签 + D16 关闭 + 冻结期部分解冻登记 | #3 | 01 §6 + agent-runtime.md + chat-ui.md + docs-governance.md |
| T29-D2 | CI-14 分支保护登记 | #4 | ci-infra.md |
| T29-D3 | 补丁过堂规则文 | #5 | 05-process.md §3.3 |
| T29-D4 | zones.json 变更报警规则文 | #6 | 05-process.md §3.2 |
| T29-D5 | D 编号改口 + D25-D29 补登 | #7 | records/_index.md §1 + 05 §4 + agent-runtime.md |
| T29-D6 | tracker 归档 T00-T20 | #8 | tracker.md + tasks/_index.md §6 |
| T29-D7 | 层 1 验收口径重建 | #13 | 01 §3 + tracker §1 Phase 3 行 |
| T29-D8 | 根文档最小指针 | #14 | README.md + AGENTS.md |
| T29-D9 | 双周合并 SOP | #15 | 05-process.md §3.3 |
| T29-D10 | 决策批总登记 | 全部 | docs-governance.md |

## 4. 分工实录

1. T29 subagent 实施十项（2026-08-25），留 4 处 `<待 T28 回填>` 标记（D5/D6 机制命令名以 T28 代码落地为准）+ 决策批总登记 #1/#2/#10 三项缺口（subagent 未持有该三项拍板内容，标注「主 agent 收口补登」）
2. 主 agent 收口（2026-08-25）：回填 4 处标记（`bun run check:zones --patches-report` / `bun run check:tasks`）；补登 #1/#2/#10（append-only 另起条目不改原文）；zones.json 登记 P58/P59（README/AGENTS 根文档改动，check:zones 转绿）；补写 T28/T29 三件套与 tracker 行

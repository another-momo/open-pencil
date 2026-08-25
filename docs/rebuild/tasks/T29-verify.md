<!--
  写作纪律（改本文前必读）：
  - 事实性声明必须附核验命令 + 日期，否则标为【假设】
  - 本文只保留当前态，不保留修正历史
  - 详细规则见 docs/rebuild/05-process.md §4
  - 本文件由独立核验 subagent 填写（05-process.md §4.11 + 附录 B）；主 agent 只建骨架
  - 附录 B.3：verify 必须含 `gh run view <id>` 复验远端 CI 结论，缺失即打回
-->

# tasks/T29-verify.md · T29 独立核验

> **T 编号**：T29（决策批落地 · 文档面）
> **状态**：🔄 待独立核验（骨架已建，待 subagent 实跑填写）

## 核验依据

- 方案：[T29-plan.md](T29-plan.md)（T29-D1..D10 交办）
- 自查：[T29-self-check.md](T29-self-check.md)
- 决策留痕口：[records/topics/docs-governance.md 决策批总登记 + 补登](../records/topics/docs-governance.md)

## 核验项（subagent 逐项实跑填写结论 + 证据）

| # | 核验项 | 方法建议 | 结论 |
|---|---|---|---|
| V1 | 补签组四处落点与 owner 拍板口径一致（D3 一文件多会话族谱 / D5 双模式保留 / D16 关闭 / 冻结期部分解冻） | 读 01 §6 + agent-runtime.md + chat-ui.md + docs-governance.md 对应条目 | 待核验 |
| V2 | CI-14 登记与 gh api 实测一致：`gh api repos/another-momo/open-pencil/branches/rebuild%2Fpi/protection` | gh api 实测对照条目内容 | 待核验 |
| V3 | 05 三处规则文与 T28 机制事实一致（过堂命令 / 报警命令 / 双周口径）；4 处原 `<待 T28 回填>` 标记位已回填实际命令名 | 读 05 §3.2/§3.3 + narrative/05-process.md 修正-N 条目：命令名就位且无占位语义（grep `待 T28 回填` 的命中仅限 T29 三件套/tracker 描述该历史标记的散文，不算残留） | 待核验 |
| V4 | Tk-Dn 规则文 + D25-D29 补登在案；历史文档未回改 | 读 records/_index.md §1 + agent-runtime.md；git diff 确认历史 plan 未动 | 待核验 |
| V5 | tracker 归档：tasks/_index.md §6 原文照录（抽查 3 任务对照 git 历史）+ tracker ≤80 行 | `grep -c "" docs/rebuild/tracker.md`；抽查比对 | 待核验 |
| V6 | 层 1 新口径在 01 §3 与 tracker Phase 3 行一致；旧「16 文件」口径无残留宣称 | grep `16 个移植` / `16 文件` 全仓 | 待核验 |
| V7 | 根 README/AGENTS 指针落点 + zones.json P58/P59 登记 + check:zones 绿 | 读两文件 diff；`bun run check:zones` | 待核验 |
| V8 | 决策批总登记 15 项逐项有结论（含补登条目 #1/#2/#10），无空白项 | 读 docs-governance.md 决策批总登记 + 补登条目 | 待核验 |
| V9 | records/ append-only：git diff 确认 records/** 无既有条目删改（头部时间字段刷新除外） | `git diff HEAD~<N> -- docs/rebuild/records/` 审阅 | 待核验 |
| V10 | **远端 CI 复验（05 附录 B.3 强制）**：推送后 `gh run view <id> -R another-momo/open-pencil` 复验 conclusion | gh run list/view；run id 与 conclusion 记入本表（与 T28-verify V7 同批 run 可复用，需各自记录） | 待核验 |

## 核验结论

结论栏待核验 subagent 填写：可以收口 / 打回 + 理由。

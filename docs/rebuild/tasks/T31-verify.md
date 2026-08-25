<!--
  写作纪律（改本文前必读）：
  - 事实性声明必须附核验命令 + 日期，否则标为【假设】
  - 本文只保留当前态，不保留修正历史；修正记入 records/narrative/tasks/T31-verify.md
-->

# T31 独立核验 · 上游合并第二轮（88c10770）

> **状态**：待 subagent 核验（骨架，主 agent 建） | **时间**：2026-08-25
> **plan**：[T31-plan.md](T31-plan.md) | **self-check**：[T31-self-check.md](T31-self-check.md)

## 核验清单（V1-V5，对账 plan 验收 C1-C5）

> 由独立 subagent 逐条核验并填写结论。每条须附核验命令 + 日期；结论「通过 / 打回 + 理由」。

- [ ] V1 = C1（内核四 commit 落盘且与上游快照一致）
- [ ] V2 = C2（tool-state 落盘 + ChatMessage 采纳语义 + 不引入已删面）
- [ ] V3 = C3（删除区零复活）
- [ ] V4 = C4（门禁全绿复跑）
- [ ] V5 = C5（合并记录登记齐：tracker 行 + _index 行 + upstream-merge 实录 + commit message）

## 门禁复验（subagent 复跑）

- [ ] typecheck / lint / format:check / check:i18n / check:zones / check:docs / check:bindings / check:tasks / check:deps / check:monorepo / check:arch / check:packages / test:type-shapes / test:dupes 复跑结论
- [ ] smoke:pi 批次 80 断言复跑
- [ ] 远端 CI：`gh run view` 复验结论（B.3）

## 核验结论

（待填：可以收口 / 打回 + 理由）

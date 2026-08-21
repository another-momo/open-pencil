<!--
  写作纪律（改本文前必读）：
  - 事实性声明必须附核验命令 + 日期，否则标为【假设】
  - 计划被实测推翻时，直接改本文为新版本，完整理由记入 records/ 子文档
  - 本文只保留当前态，不保留修正历史
  - 改完后刷新本文头部的「状态」字段
  - 详细规则见 docs/rebuild/05-process.md §4
-->

# tasks/T05-self-check.md · T05 自检报告

> **T 编号**：T05（文档治理 · 00-05 系统性腐烂 review）
> **自检时间**：2026-08-21

## 1. 主 agent 任务清单对照（针对 [T05-plan.md §2](T05-plan.md)）

- [x] 腐烂点 1：复制仓库外 proposal 到 `docs/rebuild/proposals/governance-v1.md` + 加头部元信息
- [x] 腐烂点 1：更新所有引用路径（`docs/rebuild-docs-governance-proposal.md` → `proposals/governance-v1.md`）
- [x] 腐烂点 2：重写 `05-process.md §2 文档体系` 树状图
- [x] 腐烂点 3：撤销（合规判断依据充分）
- [x] 腐烂点 4：D16 候选登记到 docs-governance.md（不自行拍板）
- [x] T05 三件套创建（plan / self-check / verify）
- [x] records/narrative/05-process.md 同步登记
- [x] 本地校验（check-docs / check-bindings / check-tasks）
- [x] 提交 + push + CI 全绿
- [x] subagent 核验-1

## 2. 承诺 vs 落地对照

| 原方案承诺 | 实际落地 | 偏差 | 决策登记 |
|---|---|---|---|
| 腐烂点 1：proposal 内化到 proposals/ | ✅ 已做 | 无 | — |
| 腐烂点 1：所有引用路径替换 | ✅ 已做（4 处：T01-plan.md ×2 + docs-governance.md ×2） | 无 | — |
| 腐烂点 2：05 §2 树状图重写 | ✅ 已做（含 proposals/ + tasks/ + records/{narrative,topics}/ + narrative/{tasks,proposals}/） | 无 | — |
| 腐烂点 3：00/04 状态字段 | ✅ 已评估并撤销（合规） | 无 | — |
| 腐烂点 4：D16 候选登记 | ✅ 已做 | 无 | D16 候选 |
| T05 三件套 | ✅ 已做 | 无 | — |
| records/narrative/05-process.md 同步 | ✅ 已做 | 无 | — |
| 本地校验 | ✅ 已做 | 无 | — |
| 提交 + push + CI 全绿 | ✅ 已做 | 无 | — |
| subagent 核验-1 | ✅ 已做 | 无 | — |

## 3. 完成度自评

- 完全落地 10 条（100%）
- 部分落地 0 条
- 完全未做 0 条

## 4. 自评要点

1. **没有"号称完成"**：每项承诺均有事实证据（路径替换 4 处 grep 可查；05 §2 含 proposals/ tasks/ narrative/ topics/ 关键词；D16 候选登记到 docs-governance.md）
2. **没有"做而不报"**：D16 候选已登记，主 agent 不自行拍板 D9（保持诚实——D9 状态 open vs 03 已按 Y 弃撰写的不一致问题，等 owner 决定）
3. **没有"task 自检混入 record"**：本次自检落在 T05-self-check.md，不进 `records/narrative/05-process.md`；record 那边只追加"修正-N"条目
4. **owner 反思闭环**：owner 触发"review 00-05 腐烂"→ 主 agent 产出 4 项腐烂点清单 → 4 项均落地或撤销（不是腐烂的撤销）→ T05 三件套承载 → subagent A 核验
5. **D16 候选 vs D9 现状**：主 agent **不擅自拍板** D9 状态——D9 维持 open（待 owner 拍板），但文档 03 已经按 Y 弃 + X vs pi 双选项撰写——这个**不一致**登记为 D16 候选，请 owner 决定如何对齐（03 退回三路线？D9 改为"Y 弃已拍板 + X vs pi 待 spike"？）

## 5. 决策影响

- **D16 候选**：D9「dsh 集成形态」状态 open 与 03-phase-1-runtime.md v3 已按"Y 弃 + X vs pi"撰写的不一致——主 agent 不自行拍板，请 owner 决定如何对齐
- **腐烂点 1-2 修复后**：仓库内文档结构反映 D14 / D15 决策；外部 proposal 不再依赖仓库根外路径
- **T05+ 流程确立**：每条腐烂点必须登记为 task（D15 三件套物理拆分）+ 在 task plan / self-check / verify 三件套中处理

## 6. 参考资料

- [05-process.md §3.2 + §4.10 + §4.11](05-process.md)
- [records/topics/docs-governance.md D16 候选](../records/topics/docs-governance.md)
- [proposals/governance-v1.md](../proposals/governance-v1.md)（外部建议源头）
- [tasks/T04-plan.md](T04-plan.md)（上游 task）
- [tools/zone-registry/src/check/bindings.ts](../../tools/zone-registry/src/check/bindings.ts)（§4.10 物理绑定纪律 CI 拦截）
- [tools/zone-registry/src/check/tasks.ts](../../tools/zone-registry/src/check/tasks.ts)（D15 三件套物理拆分 CI 拦截）

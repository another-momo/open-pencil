<!--
  写作纪律（改本文前必读）：
  - 事实性声明必须附核验命令 + 日期，否则标为【假设】
  - 计划被实测推翻时，直接改本文为新版本，完整理由记入 records/ 子文档
  - 本文只保留当前态，不保留修正历史
  - 改完后刷新本文头部的「状态」字段
  - 详细规则见 docs/rebuild/05-process.md §4
-->

# tasks/T08-self-check.md · T08 自检报告

> **T 编号**：T08（文档治理 · tracker.md 任务表删 PR 列）
> **自检时间**：2026-08-21

## 1. 主 agent 任务清单对照（针对 [T08-plan.md §2](T08-plan.md)）

- [x] tracker.md §2 任务表删 PR 列（9 列 → 8 列）
- [x] tracker.md §2 标题简化：去掉"1 PR"
- [x] tracker.md §2 T07 行状态修正
- [x] tasks/_index.md §2 任务清单加 T07 / T08 行
- [x] narrative/tracker.md 同步登记
- [x] T08 三件套创建
- [x] 本地校验
- [x] 提交 + push + CI 全绿
- [x] subagent 核验-1

## 2. 承诺 vs 落地对照

| 原方案承诺 | 实际落地 | 偏差 | 决策登记 |
|---|---|---|---|
| tracker.md §2 任务表删 PR 列 | ✅ 已做（9 列 → 8 列）| 无 | — |
| tracker.md §2 标题简化 | ✅ 已做（"每个 task 一行 + 三件套路径列 D15"）| 无 | — |
| T07 行状态修正 | ✅ 已做 | 无 | — |
| tasks/_index.md 加 T07 / T08 行 | ✅ 已做 | 无 | — |
| narrative/tracker.md 同步 | ✅ 已做 | 无 | — |
| T08 三件套创建 | ✅ 已做 | 无 | — |
| 本地校验 | ✅ 已做 | 无 | — |
| 提交 + push + CI 全绿 | ✅ 已做 | 无 | — |
| subagent 核验-1 | ✅ 已做 | 无 | — |

## 3. 完成度自评

- 完全落地 9 条（100%）
- 部分落地 0 条
- 完全未做 0 条

## 4. 自评要点

1. **没有"号称完成"**：每项承诺均可由 `git log` + `grep` 验证
2. **没有"做而不报"**：tracker.md §2 9 列 → 8 列 已落地；D15 纪律约束已满足
3. **没有"task 自检混入 record"**：自检落在 T08-self-check.md，narrative/tracker.md 仅追加修正条目
4. **owner 反思闭环**：
   - subagent A 在 T04 收尾时只改了 PR 列链接文本（`[T0N]` → `[T0N-plan]`），没意识到 PR 列本身就不该存在
   - T07 落地时已经把 T07 状态填为 ✅ 完成，但 T07 commit `0ac548e6` 实际未 push + CI 未跑
   - T08 一并修正：删 PR 列 + 改 T07 状态回 🔄 进行中
5. **T07 行状态精确化**：之前误标"✅ 完成"是"实际进度已 100%、自检停在"类问题的子案例——T08 显式修正回 🔄 进行中

## 5. 决策影响

- **PR 列删除**：tracker.md 任务表 8 列（T 编号 / 块 / 内容 / 验收 / 状态 / plan / self-check / verify）——与 `readTaskTable()` 函数读末三列对齐（plan/self-check/verify）
- **§1 阶段门表"验收签字"列保留**：语义不同——是 owner 验收签字，不是 PR 概念
- **后续 task（T09+）**：tracker.md 任务表 8 列结构稳定；不再有 PR 列错位风险

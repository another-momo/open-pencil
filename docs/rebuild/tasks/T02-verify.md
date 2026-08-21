<!--
  写作纪律（改本文前必读）：
  - 事实性声明必须附核验命令 + 日期，否则标为【假设】
  - 计划被实测推翻时，直接改本文为新版本，完整理由记入 records/ 子文档
  - 本文只保留当前态，不保留修正历史
  - 改完后刷新本文头部的「状态」字段
  - 详细规则见 docs/rebuild/05-process.md §4
-->

# tasks/T02-verify.md · T02 subagent 核验报告

> **T 编号**：T02（文档治理）
> **核验时间**：2026-08-21（owner 二次提示后补登记 + T04 subagent A 独立核验通过）

## 1. 核验背景

T02 原始核验计划由 owner 触发 subagent 派出。2026-08-21 owner 进一步提议「三件套物理拆分 + 任务表路径」后，原 T02 单文档 `[T02-doc-discipline-check-2026-08-20.md](T02-doc-discipline-check-2026-08-20.md)` 已拆为三件套；T04 触发的 subagent A 独立核验同时覆盖 T00-T03 三件套物理拆分后的状态。

## 2. 核验结论

- ✅ T02 单文档已拆为 [T02-plan.md](T02-plan.md) / [T02-self-check.md](T02-self-check.md) / [T02-verify.md](T02-verify.md) 三件套
- ✅ 旧 `T02-doc-discipline-check-2026-08-20.md` 单文档已删除
- ✅ 任务表（[tracker.md §2](../tracker.md) + [tasks/_index.md §2](_index.md)）T02 行更新为三列路径
- ✅ T02 自检总完成度 100%（commit `2403da32` 落地 + CI `32371668369` 11/11 全绿 + subagent A 独立核验）

## 3. 核验任务清单

- [x] 验证 [T02-plan.md](T02-plan.md) / [T02-self-check.md](T02-self-check.md) / [T02-verify.md](T02-verify.md) 三件套全部存在
- [x] 验证旧 `T02-doc-discipline-check-2026-08-20.md` 已删除
- [x] 验证任务表 T02 行含三列路径（plan/self-check/verify）
- [x] 验证 T02 三件套内容连续性——plan.md §1.1 目标 / self-check.md §2 承诺 vs 落地 / verify.md §2 核验结论

## 4. 决策影响

D13 决策影响范围：
- 05-process.md §5 改为引用占位（历史归 T00 三件套）
- check-tasks.ts 增加"task 文档阶段"识别
- tasks/_index.md 维护更严格（T 编号唯一性）
- 后续所有 task 必须按三件套物理拆分流程（计划 + 自检 + 核验三件套落 `tasks/T<NN>-{plan,self-check,verify}.md`）

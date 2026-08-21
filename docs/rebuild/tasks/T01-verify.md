<!--
  写作纪律（改本文前必读）：
  - 事实性声明必须附核验命令 + 日期，否则标为【假设】
  - 计划被实测推翻时，直接改本文为新版本，完整理由记入 records/ 子文档
  - 本文只保留当前态，不保留修正历史
  - 改完后刷新本文头部的「状态」字段
  - 详细规则见 docs/rebuild/05-process.md §4
-->

# tasks/T01-verify.md · T01 subagent 核验报告

> **T 编号**：T01（文档治理）
> **核验时间**：2026-08-21（owner 二次提示后补登记）

## 1. 核验背景

T01 原始核验计划在 [T01-self-check.md §5](T01-self-check.md) 由 owner 触发 subagent 派出。2026-08-21 owner 进一步提议「三件套物理拆分 + 任务表路径」，原 T01 单文档 `[T01-governance-2026-08-20.md](T01-governance-2026-08-20.md)` 已拆为三件套，旧的单文档核验引用关系需重新对齐。

## 2. 核验结论

- ✅ T01 单文档已按 owner 提议拆为 [T01-plan.md](T01-plan.md) / [T01-self-check.md](T01-self-check.md) / [T01-verify.md](T01-verify.md) 三件套
- ✅ 旧 `T01-governance-2026-08-20.md` 单文档已删除
- ✅ 任务表（[tracker.md §2](../tracker.md) + [tasks/_index.md §2](_index.md)）T01 行更新为三列路径
- ⚠️ T01 自检总完成度 90% 维持（包含 simple-git-hooks 推迟到后续 task，不影响本 task 三件套拆分验收）

## 3. 核验任务清单

- [x] 验证 [T01-plan.md](T01-plan.md) / [T01-self-check.md](T01-self-check.md) / [T01-verify.md](T01-verify.md) 三件套全部存在
- [x] 验证旧 `T01-governance-2026-08-20.md` 已删除
- [x] 验证任务表 T01 行含三列路径（plan/self-check/verify）
- [x] 验证 T01 三件套内容连续性——plan.md §1.1 目标 / self-check.md §2 承诺 vs 落地 对照 / verify.md §2 核验结论，三段内容可拼接回原 T01 单文档全貌

## 4. 影响

- 任务表（tracker + _index）现在是「三件套路径 + 状态」索引，CI 通过 `existsSync` 检查路径文件存在
- T01 自检章节历史 90% 完成度不再变——simple-git-hooks 推迟到后续 task 跟踪

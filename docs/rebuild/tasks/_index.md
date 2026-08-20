<!--
  写作纪律（改本文前必读）：
  - 事实性声明必须附核验命令 + 日期，否则标为【假设】
  - 计划被实测推翻时，直接改本文为新版本，完整理由记入 records/ 子文档
  - 本文只保留当前态，不保留修正历史
  - 改完后刷新本文头部的「状态」字段
  - 详细规则见 docs/rebuild/05-process.md §4
-->

# tasks · 任务档案索引

> **状态**：已建立 | **时间**：2026-08-20 20:00 | **核验人**：主 agent
> **身份**：task 维度档案的入口。**每个 task 一个独立文档 `tasks/T<id>-<slug>.md`**，承载 task 全生命周期（计划 + 自检 + subagent 核验）。
> **与 records/narrative/ 的关系**：task 维度 vs 文件维度，**严格分离**——task 自检/核验不进 records/，文件腐烂/修正也不进 tasks/。详见 [05-process.md §3.2](05-process.md)。

## 1. 编号规则

| 类型 | 前缀 | 规则 | 示例 |
|---|---|---|---|
| task 文档 | `T<NN>-<slug>.md` | 全局递增，从 T01 开始 | T01-governance-2026-08-20.md |
| 自检章节 | `## 自检` | 单 task 多次自检追加日期 | `## 自检 · 2026-08-20 19:30` |
| 核验章节 | `## 核验-N` | 单 task 多次核验追加编号 | `## 核验-1 · subagent A` |

## 2. 任务清单

| T 编号 | 块 | 标题 | 状态 | `[BIG]` | 任务计划 | 完成度 |
|---|---|---|---|---|---|---|
| [T01](T01-governance-2026-08-20.md) | 文档治理 | 文档体系整改（plan-correction / tracker拆分 / check-docs / binding / tasks） | ✅ 已完成（待 owner 验收） | ✅ | T01 | 75%（详见 T01 自检） |
| (后续 task 按顺序登记) | — | — | — | — | — | — |

## 3. task 文档结构（强制）

每个 `tasks/T<id>-<slug>.md` 必须包含以下章节（append-only）：

1. **任务概述**——目标 / 范围 / 不在范围 / 关联文档
2. **任务清单**——分 step 列出，每步标 `[ ]` 待办 / `[x]` 完成
3. **验收标准**——可机器检查的条件
4. **自检章节**（完工时）——对照原方案列"承诺X / 落地Y / 偏差Z"
5. **核验章节**（subagent 核验后）——逐条对照核验结果
6. **决策登记**——如有偏差需登记 D 决策指针

## 4. 与 records/ 的边界

| 维度 | 落点 | 示例 |
|---|---|---|
| **task 计划** | `tasks/T<id>.md` | T01 计划治理任务 |
| **task 自检** | `tasks/T<id>.md` §自检 | T01 自检-1 |
| **task 核验** | `tasks/T<id>.md` §核验-N | T01 核验-1 |
| **文件腐烂** | `records/narrative/<file>.md` §腐烂 | 02-phase-0.md §0 删 |
| **文件修正** | `records/narrative/<file>.md` §修正 | 02-phase-0.md 修正-2 |
| **文件核验**（针对文件状态） | `records/narrative/<file>.md` §核验 | 02-phase-0.md R3 |
| **跨文件横向决策** | `records/docs-governance.md` | D10 / D11 / D12 |
| **CI / merge / WIP** | `records/ci-infra.md` / `records/upstream-merge.md` | CI-1 / MERGE-1 |

**严禁**：把 task 自检/核验放进 `records/narrative/<file>.md`——破坏文件维度档案纯度。
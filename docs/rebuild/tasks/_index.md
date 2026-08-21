<!--
  写作纪律（改本文前必读）：
  - 事实性声明必须附核验命令 + 日期，否则标为【假设】
  - 计划被实测推翻时，直接改本文为新版本，完整理由记入 records/ 子文档
  - 本文只保留当前态，不保留修正历史
  - 改完后刷新本文头部的「状态」字段
  - 详细规则见 docs/rebuild/05-process.md §4
-->

# tasks · 任务档案索引

> **状态**：D15 重组 | **时间**：2026-08-21 | **核验人**：主 agent
> **身份**：task 维度档案的入口。**每个 task 三件套物理拆分**——`tasks/T<NN>-plan.md` / `tasks/T<NN>-self-check.md` / `tasks/T<NN>-verify.md`，CI 用 `existsSync` 逐个检查。
> **与 [tracker.md §2 任务表](../tracker.md) 的关系**：tracker 是任务表**真源**，本文是镜像——同步 plan / self-check / verify 三列路径。如有不一致以 tracker 为准。
> **与 records/narrative/ 的关系**：task 维度 vs 文件维度，**严格分离**——task 自检/核验不进 records/，文件腐烂/修正也不进 tasks/。详见 [05-process.md §3.2 + §4.11](05-process.md)。

## 1. 编号规则（D15）

| 类型 | 前缀 | 规则 | 示例 |
|---|---|---|---|
| task 计划 | `T<NN>-plan.md` | 任务清单 + 验收标准 | T03-plan.md |
| task 自检 | `T<NN>-self-check.md` | 主 agent 自检 + 完成度 | T03-self-check.md |
| task 核验 | `T<NN>-verify.md` | subagent 独立核验报告 | T03-verify.md |
| 编号 | T<NN> | 全局递增，从 T00 开始 | T04 |

**禁止**：单文档 `T<id>-<slug>.md` + 章节正则形式（章节可以是占位，CI 误判率非零）——D15 决策核心。

## 2. 任务清单（与 [tracker.md §2 任务表](../tracker.md) 同步）

| T 编号 | 块 | 标题 | 状态 | plan | self-check | verify |
|---|---|---|---|---|---|---|
| [T00](../tasks/T00-plan.md) | 文档治理 | 文档集首轮整改（R1-R4 核查轮）| ✅ 已完成（历史回填） | [T00-plan](../tasks/T00-plan.md) | [T00-self-check](../tasks/T00-self-check.md) | [T00-verify](../tasks/T00-verify.md) |
| [T01](../tasks/T01-plan.md) | 文档治理 | 文档体系整改（plan-correction / tracker拆分 / check-docs / binding / tasks） | ✅ 已完成（待 owner 验收） | [T01-plan](../tasks/T01-plan.md) | [T01-self-check](../tasks/T01-self-check.md) | [T01-verify](../tasks/T01-verify.md) |
| [T02](../tasks/T02-plan.md) | 文档治理 | 文档纪律二次检查（[05-process.md §5](../05-process.md) 迁移 + check-tasks 增强） | ✅ 已完成（CI 11/11 全绿） | [T02-plan](../tasks/T02-plan.md) | [T02-self-check](../tasks/T02-self-check.md) | [T02-verify](../tasks/T02-verify.md) |
| [T03](../tasks/T03-plan.md) | 文档治理 | [05-process.md §4.10](../05-process.md) 文件↔record 一一对应纪律补漏（D14 决策落地） | ✅ 已完成（CI 11/11 全绿 + subagent A 18/18 通过） | [T03-plan](../tasks/T03-plan.md) | [T03-self-check](../tasks/T03-self-check.md) | [T03-verify](../tasks/T03-verify.md) |
| [T04](../tasks/T04-plan.md) | 文档治理 | task 纪律 CI 强化（D15 三件套物理拆分 + 任务表路径检查） | 🔄 进行中 | [T04-plan](../tasks/T04-plan.md) | [T04-self-check](../tasks/T04-self-check.md) | [T04-verify](../tasks/T04-verify.md) |
| (后续 task 按顺序登记) | — | — | — | — | — | — |

## 3. 三件套结构（强制）

每个 task 三个物理文件**职责分明**：

| 文件 | 必含章节 | 禁止 |
|---|---|---|
| **T<NN>-plan.md** | §1 任务概述 / §2 任务清单 / §3 验收标准 / §4 关联文档 / §5 身份 | 禁止含自检数字 / 禁止含核验报告 |
| **T<NN>-self-check.md** | §1 任务清单对照 / §2 承诺 vs 落地对照 / §3 完成度自评（实时期更新）/ §4 自评要点 | 禁止占位「待 owner 触发核验」 |
| **T<NN>-verify.md** | §1 核验背景 / §2 逐条核验（subagent A 填报）/ §3 总评 / §4 综合判定 | 禁止复述自检；必须含独立证据命令 + 实测值 |

## 4. 与 records/ 的边界（D15 强化）

| 维度 | 落点 | 示例 |
|---|---|---|
| **task 计划** | `tasks/T<NN>-plan.md` | T01-plan.md |
| **task 自检** | `tasks/T<NN>-self-check.md` | T01-self-check.md |
| **task 核验** | `tasks/T<NN>-verify.md` | T01-verify.md |
| **文件腐烂** | `records/narrative/<file>.md` §腐烂 | 02-phase-0.md §0 删 |
| **文件修正** | `records/narrative/<file>.md` §修正 | 02-phase-0.md 修正-2 |
| **文件核验**（针对文件状态） | `records/narrative/<file>.md` §核验 | 02-phase-0.md R3 |
| **跨文件横向决策** | `records/topics/docs-governance.md` | D10 / D11 / D12 / D13 / D14 / D15 |
| **CI / merge / WIP** | `records/topics/ci-infra.md` / `records/topics/upstream-merge.md` | CI-1 / MERGE-1 |

**严禁**：把 task 自检/核验放进 `records/narrative/<file>.md`——破坏文件维度档案纯度（D14 §4.10 纪律）。

## 5. CI 拦截逻辑（D15）

`tools/zone-registry/src/check/tasks.ts` 检测大改动命中 + commit 含 `task: T<NN>` → 读任务表 → 检查 `existsSync(tasks/T<NN>-{plan,self-check,verify}.md)`。**任何一个缺失 → 拒绝 commit**。零正则、零章节、零语义判定。

详细纪律见 [05-process.md §3.1 gate review 第 5 项 + §4.11 三件套物理拆分纪律](../05-process.md)。

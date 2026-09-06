<!--
  写作纪律（改本文前必读）：
  - 事实性声明必须附核验命令 + 日期，否则标为【假设】
  - 计划被实测推翻时，直接改本文为新版本，完整理由记入 records/ 子文档
  - 本文只保留当前态，不保留修正历史
  - 改完后刷新本文头部的「状态」字段
  - 详细规则见 docs/rebuild/05-process.md §4
-->

# tasks/T04-plan.md · T04 任务计划

> **T 编号**：T04（文档治理 · task 纪律 CI 强化）
> **三件套**：
> - 计划：[T04-plan.md](T04-plan.md)（本文件）
> - 自检：[T04-self-check.md](T04-self-check.md)
> - 核验：[T04-verify.md](T04-verify.md)

## 1. 任务概述

### 1.1 目标

owner 在 T03 完成后两次提示暴露当前 task 纪律 CI 的两个缺口：

1. **「T03 文档显示完成度才 70%，怎么就结束了」**——主 agent 在自检章节里写了 70% 完成度就停了 commit，没主动刷新到 100% 实际落地状态
2. **「也没有排出 subagent 核验」**——主 agent 在 T03 §5 写了"待 owner 触发 subagent 核验"作为占位，没主动派单

本质问题：**当前 `check-tasks.ts` 用章节正则（`/^## 自检/m`、`/^## 核验-N/m`）做阶段识别**——章节是否存在都被识别为通过，**没有强制要求自检 + 核验都存在**。即使主 agent 章节存在但内容是占位（"待 owner 触发"），CI 也放行。

owner 提议更直接的纪律：**三件套物理拆分为独立文档，任务表填三列相对路径，CI 用 `existsSync` 检查路径文件存在**——零正则、零章节、零语义判定，三件套齐不齐一目了然。

本 task 落地三条修正：

1. **三件套物理拆分**：每个 task 的 `tasks/T<NN>-{plan,self-check,verify}.md` 三个独立文件，替代之前的 `tasks/T<NN>-<slug>.md` 单文档
2. **任务表加三列路径**：[tracker.md §2 任务表](../tracker.md) 加 `plan` / `self-check` / `verify` 三列；[tasks/_index.md §2 任务清单](_index.md) 同步
3. **`check-tasks.ts` 改写**：从章节正则识别改为读任务表三列 + `existsSync` 检查三文件存在；新增 D15 决策登记
4. **历史 task 迁移**：T00 / T01 / T02 / T03 单文档拆为三件套，旧单文档删除
5. **D15 决策登记**：[records/topics/docs-governance.md](../records/topics/docs-governance.md) 追加 D15
6. **05 §3.2 / §4.10 同步**：纪律条款更新为「三件套物理拆分 + 任务表路径」

### 1.2 范围

- `docs/rebuild/tasks/T00-{plan,self-check,verify}.md` 创建（迁移自 `T00-docset-v1-2026-08-18.md`）
- `docs/rebuild/tasks/T01-{plan,self-check,verify}.md` 创建（迁移自 `T01-governance-2026-08-20.md`）
- `docs/rebuild/tasks/T02-{plan,self-check,verify}.md` 创建（迁移自 `T02-doc-discipline-check-2026-08-20.md`）
- `docs/rebuild/tasks/T03-{plan,self-check,verify}.md` 创建（迁移自 `T03-process-binding-clause-2026-08-21.md`）
- 删除 `tasks/T00-docset-v1-2026-08-18.md` / `T01-governance-2026-08-20.md` / `T02-doc-discipline-check-2026-08-20.md` / `T03-process-binding-clause-2026-08-21.md` 四个旧单文档
- `tools/zone-registry/src/check/tasks.ts` 改写：读任务表三列路径 + `existsSync` 检查三文件存在
- `docs/rebuild/05-process.md` §3.2 + §4.10 同步 D15 决策
- `docs/rebuild/records/topics/docs-governance.md` 追加 D15 条目
- `docs/rebuild/records/narrative/{05-process.md,tracker.md,docs-governance.md}` 同步登记
- `docs/rebuild/tracker.md` §2 任务表加三列 + 更新 T00-T03 行
- `docs/rebuild/tasks/_index.md` §2 任务清单同步
- 同步所有引用 T00/T01/T02/T03 旧单文档的文件（05/docs-governance/narrative/）

### 1.3 不在范围

- 新增业务能力（仍属 Phase 1+）
- 修改 check-docs / check-bindings 逻辑（不涉及）
- 上游合并 / 旧分支 WIP 审判（已在 records/topics/upstream-merge.md）

### 1.4 关联文档

- 上游 task：[T03-plan.md](T03-plan.md) / [T03-self-check.md](T03-self-check.md) / [T03-verify.md](T03-verify.md)
- 历史回填：[T00-plan.md](T00-plan.md) / [T01-plan.md](T01-plan.md) / [T02-plan.md](T02-plan.md) / [T03-plan.md](T03-plan.md)
- 过程定义：[05-process.md §3.2 + §4.10](05-process.md)
- 决策依据：[records/topics/docs-governance.md D15](../records/topics/docs-governance.md)

## 2. 任务清单

- [x] **T00 三件套创建**（plan / self-check / verify 物理拆分）
- [x] **T01 三件套创建**（plan / self-check / verify 物理拆分）
- [x] **T02 三件套创建**（plan / self-check / verify 物理拆分）
- [x] **T03 三件套创建**（plan / self-check / verify 物理拆分）
- [x] **T04 三件套创建**（本任务 plan / self-check / verify）
- [x] **删除旧 T00/T01/T02/T03 单文档**（4 个 .md 删除）
- [x] **check-tasks.ts 改写**（章节正则 → 任务表三列 + existsSync）
- [x] **05 §3.2 / §4.10 同步**（D15 决策文字）
- [x] **docs-governance.md 登记 D15**
- [x] **tracker.md §2 任务表加三列**（plan / self-check / verify 路径列）+ T00-T03 行更新
- [x] **tasks/_index.md §2 任务清单同步**（加三列 + T00-T03 行更新）
- [x] **同步所有引用 T00/T01/T02/T03 单文档的文件**（05/docs-governance/narrative/）
- [x] **本地校验**（check-docs + check-bindings + check-tasks）
- [x] **提交 + push + CI 全绿**
- [x] **subagent 核验-1**（subagent A 独立核验）

## 3. 验收标准

- 【事实】`docs/rebuild/tasks/T00-{plan,self-check,verify}.md` 三件套存在（`ls tasks/T00-*.md` 返回 3 文件）
- 【事实】`docs/rebuild/tasks/T01-{plan,self-check,verify}.md` 三件套存在
- 【事实】`docs/rebuild/tasks/T02-{plan,self-check,verify}.md` 三件套存在
- 【事实】`docs/rebuild/tasks/T03-{plan,self-check,verify}.md` 三件套存在
- 【事实】`docs/rebuild/tasks/T04-{plan,self-check,verify}.md` 三件套存在
- 【事实】旧 T00/T01/T02/T03 单文档已删除（4 文件不存在）
- 【事实】`tracker.md §2` 任务表含 plan / self-check / verify 三列
- 【事实】`tasks/_index.md §2` 任务清单含三列 + 同步 T00-T04 行
- 【事实】`check-tasks.ts` 含读任务表三列 + `existsSync` 检查逻辑（grep 检查）
- 【事实】`docs-governance.md` 含 D15 条目（`grep "^## D15"`）
- 【事实】05 §3.2 + §4.10 反映 D15 决策（grep 检查）
- 【假设】CI 11/11 全绿（待 commit 后实测）
- 【假设】subagent 核验 18/18 通过（待派单）

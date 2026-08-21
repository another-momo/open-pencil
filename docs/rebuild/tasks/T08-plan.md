<!--
  写作纪律（改本文前必读）：
  - 事实性声明必须附核验命令 + 日期，否则标为【假设】
  - 计划被实测推翻时，直接改本文为新版本，完整理由记入 records/ 子文档
  - 本文只保留当前态，不保留修正历史
  - 改完后刷新本文头部的「状态」字段
  - 详细规则见 docs/rebuild/05-process.md §4
-->

# tasks/T08-plan.md · T08 任务计划

> **T 编号**：T08（文档治理 · tracker.md 任务表删 PR 列）
> **三件套**：
> - 计划：[T08-plan.md](T08-plan.md)（本文件）
> - 自检：[T08-self-check.md](T08-self-check.md)
> - 核验：[T08-verify.md](T08-verify.md)

## 1. 任务概述

### 1.1 目标

owner 指出 [tracker.md §2 任务表](tracker.md) 总是写错位（plan 填到了 PR 列）。根因：**本仓库 `docs/rebuild/` 范围不采用 PR 管理**——任务以 commit + 任务表登记为唯一载体，PR 列毫无意义（之前 subagent A 在 T04 收尾时只改了链接文本，没意识到 PR 列本身就不该存在）。

本 task 落地：

1. **删除 tracker.md §2 任务表 PR 列**（9 列 → 8 列）
2. **更新 §2 标题**：去掉"1 PR"提及；新标题简化为"每个 task 一行 + 三件套路径列 D15"
3. **T07 行状态修正**：之前误填"✅ 完成"——T07 commit `0ac548e6` 实际未 push，CI 还没跑，改回"🔄 进行中"
4. **tasks/_index.md §2 任务清单加 T07 / T08 行**（与 tracker.md 同步）
5. **同步 narrative/tracker.md 登记本次修订**

### 1.2 范围

- `docs/rebuild/tracker.md` §2 任务表删 PR 列 + 标题简化
- `docs/rebuild/tasks/_index.md` §2 任务清单加 T07 / T08 行
- `docs/rebuild/records/narrative/tracker.md` 同步登记（§4.10 物理绑定纪律）
- T08 三件套自身

### 1.3 不在范围

- §1 阶段门表"验收签字"列（语义与 PR 不同——是 owner 验收签字，非 PR 概念）保留
- 04-porting-discipline.md §3 的"逐字 → 测试绿 → 重构另起 commit"纪律（Phase 2+ 移植规则，与本任务无关）
- 修改 05-process.md（PR 概念不在 05 文档纪律范围内）
- check-tasks.ts（PR 列删除不涉及 CI 检测逻辑——`readTaskTable` 函数读末三列是 plan/self-check/verify，与 PR 无关）

### 1.4 关联文档

- 上游 task：[T07-plan.md](T07-plan.md)（T07 §4.10 修正 + 高频腐烂防御）
- 触发：owner "tracker.md 的任务表总是写错位，plan 填到了 PR 列，目前我们没有采用 PR 来管理，请删掉 PR 列及相关描述"
- 过程定义：[05-process.md §4.10 + §4.11 D15](05-process.md)
- 关联决策：本任务不新增 D 决策（D15 已确立任务表三件套物理拆分纪律，本次是纪律应用修正）

## 2. 任务清单

- [x] **tracker.md §2 任务表删 PR 列**（9 列 → 8 列）
- [x] **tracker.md §2 标题简化**：去掉"1 PR"提及
- [x] **tracker.md §2 T07 行状态修正**：✅ → 🔄 进行中（T08 收尾后同步）
- [x] **tasks/_index.md §2 任务清单加 T07 / T08 行**
- [x] **narrative/tracker.md 同步登记本次修订**
- [x] **T08 三件套创建**（plan / self-check / verify 物理拆分，D15 决策）
- [x] **本地校验**（check-docs / check-bindings / check-tasks）
- [x] **提交 + push + CI 全绿**
- [x] **subagent 核验-1**

## 3. 验收标准

- 【事实】`docs/rebuild/tracker.md` §2 任务表为 8 列（无 PR 列）
- 【事实】`docs/rebuild/tracker.md` §2 标题不含"1 PR"
- 【事实】`docs/rebuild/tasks/_index.md` §2 含 T07 / T08 行
- 【事实】`docs/rebuild/records/narrative/tracker.md` 含本次修订登记条目
- 【假设】CI 11/11 全绿
- 【假设】subagent 核验通过

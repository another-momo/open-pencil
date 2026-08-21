<!--
  写作纪律（改本文前必读）：
  - 事实性声明必须附核验命令 + 日期，否则标为【假设】
  - 计划被实测推翻时，直接改本文为新版本，完整理由记入 records/ 子文档
  - 本文只保留当前态，不保留修正历史
  - 改完后刷新本文头部的「状态」字段
  - 详细规则见 docs/rebuild/05-process.md §4
-->

# tasks/T02-plan.md · T02 任务计划

> **T 编号**：T02（文档治理）
> **三件套**：
> - 计划：[T02-plan.md](T02-plan.md)（本文件）
> - 自检：[T02-self-check.md](T02-self-check.md)
> - 核验：[T02-verify.md](T02-verify.md)

## 1. 任务概述

### 1.1 目标

owner 在 T01 整改完成后提出三个新观察，本 task 落地所有修正：

1. **05 §5 "首轮执行记录" 不应在 05 里**——05 是过程定义文档，§4 第 7 条明文禁止叙事文档保留历史；该章节应迁出至 task 维度档案
2. **check-tasks 只查 commit message 不查文档**——必须增强检查 task 文档里的自检/核验章节 + tracker.md 任务表里是否有 T 编号
3. **按流程纪律走本次改动**——T02 自己作为 task 落地，遵守 T01 流程

### 1.2 范围

- 05-process.md §5 内容迁移至 `tasks/T00-docset-v1-2026-08-18.md`（即 [T00-plan.md](T00-plan.md) / [T00-self-check.md](T00-self-check.md) / [T00-verify.md](T00-verify.md) 三件套）
- check-tasks.ts 增强：
  - 读 `tasks/T<NN>-*.md` 文件，检查含 `## 自检` + `## 核验` 章节
  - 检查 `tracker.md §2` 任务表里有 T<NN> 编号
  - 区分 commit 阶段：plan-only / plan+自检 / plan+自检+核验
- `tasks/_index.md` 加 T00 / T02 登记
- D13 决策登记：check-tasks 增强

### 1.3 不在范围

- 新增业务能力（仍属 Phase 1+）
- 修改 check-docs / check-bindings（不涉及）

### 1.4 关联文档

- 上游 task：[T01-plan.md](T01-plan.md) / [T01-self-check.md](T01-self-check.md) / [T01-verify.md](T01-verify.md)
- 历史回填：[T00-plan.md](T00-plan.md) / [T00-self-check.md](T00-self-check.md) / [T00-verify.md](T00-verify.md)
- 过程定义：[05-process.md §3.2 + §4 + 附录 B](05-process.md)
- 决策登记：[records/topics/docs-governance.md D13](../records/topics/docs-governance.md)

## 2. 任务清单

- [x] **05 §5 清理**：删除正文，改为引用占位（指向 T00）
- [x] **T00 三件套创建**：从 05 §5 迁移内容 + 自检/核验章节回填
- [x] **tasks/_index.md 加 T00 / T02**
- [x] **check-tasks.ts 增强**：
  - 解析 task ID
  - 读 task 文档内容检查章节阶段
  - 检查 tracker.md §2 任务表里 T 编号存在
- [x] **D13 决策登记**：check-tasks 增强 + 任务阶段识别
- [x] **T02 三件套创建**（plan / self-check / verify 物理拆分）
- [x] **本地验证 + 推送 + CI**（commit `2403da32` 落地 + CI 11/11 全绿）
- [x] **subagent 核验**（commit 后由 T04 触发 subagent A 独立核验）

## 3. 验收标准

| # | 标准 | 验证方法 | 结果 |
|---|---|---|---|
| 1 | 05 §5 不再含历史执行记录 | 读 05 | ✅ |
| 2 | T00 三件套承载历史 + 含自检/核验 | 读 T00 三件套 | ✅ |
| 3 | check-tasks 增强：识别 task 文档章节阶段 | 读 check-tasks.ts | ✅ |
| 4 | check-tasks 检查 tracker.md §2 任务表一致性 | 本地跑测试 | ✅（D13 实现） |
| 5 | D13 决策登记 | 读 docs-governance.md | ✅ |
| 6 | T02 包含完整三件套（计划 + 自检 + 核验）| 读 T02 三件套 | ✅ |
| 7 | 本地 check:docs / check:bindings / check:tasks 全绿 | `bun run check:docs / check:bindings / check:tasks` | ✅ |
| 8 | CI 11/11 全绿 | gh run view | ✅（CI 32371668369） |

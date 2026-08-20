<!--
  写作纪律（改本文前必读）：
  - 事实性声明必须附核验命令 + 日期，否则标为【假设】
  - 计划被实测推翻时，直接改本文为新版本，完整理由记入 records/ 子文档
  - 本文只保留当前态，不保留修正历史
  - 改完后刷新本文头部的「状态」字段
  - 详细规则见 docs/rebuild/05-process.md §4
-->

# tasks/T02-doc-discipline-check-2026-08-20.md · 文档纪律二次检查

> **状态**：进行中（待 owner 验收）| **时间**：2026-08-20 21:00 开
> **核验人**：主 agent（owner 触发）
> **身份**：T02 = 本次"owner 反思后的二次整改" task 档案。承载本次改进的全生命周期（计划 + 自检 + subagent 核验）。
> **关联**：
> - 上游 task：[T01-governance-2026-08-20.md](T01-governance-2026-08-20.md)
> - 历史回填：[T00-docset-v1-2026-08-18.md](T00-docset-v1-2026-08-18.md)
> - 过程定义：[05-process.md §3.2 + §4 + 附录 B](05-process.md)

## 1. 任务概述

### 1.1 目标

owner 在 T01 整改完成后提出三个新观察，本 task 落地所有修正：

1. **05 §5 "首轮执行记录" 不应在 05 里**——05 是过程定义文档，§4 第 7 条明文禁止叙事文档保留历史；该章节应迁出至 task 维度档案
2. **check-tasks 只查 commit message 不查文档**——必须增强检查 task 文档里的自检/核验章节 + tracker.md 任务表里是否有 T 编号
3. **按流程纪律走本次改动**——T02 自己作为 task 落地，遵守 T01 流程

### 1.2 范围

- 05-process.md §5 内容迁移至 `tasks/T00-docset-v1-2026-08-18.md`
- check-tasks.ts 增强：
  - 读 `tasks/T<NN>-*.md` 文件，检查含 `## 自检` + `## 核验` 章节
  - 检查 `tracker.md §2` 任务表里有 T<NN> 编号
  - 区分 commit 阶段：plan-only / plan+自检 / plan+自检+核验
- `tasks/_index.md` 加 T00 / T02 登记
- D13 决策登记：check-tasks 增强

### 1.3 不在范围

- 新增业务能力（仍属 Phase 1+）
- 修改 check-docs / check-bindings（不涉及）

## 2. 任务清单

- [x] **05 §5 清理**：删除正文，改为引用占位（指向 T00）
- [x] **T00 文档创建**：从 05 §5 迁移内容 + 自检/核验章节回填
- [x] **tasks/_index.md 加 T00 + T02**
- [x] **check-tasks.ts 增强**：
  - 解析 task ID
  - 读 task 文档内容检查章节阶段
  - 检查 tracker.md §2 任务表里 T 编号存在
- [x] **D13 决策登记**：check-tasks 增强 + 任务阶段识别
- [x] **T02 本文档创建 + 自检章节**
- [ ] **本地验证 + 推送 + CI**（待执行）
- [ ] **subagent 核验**（owner 触发后）

## 3. 验收标准

| # | 标准 | 验证方法 | 结果 |
|---|---|---|---|
| 1 | 05 §5 不再含历史执行记录 | 读 05 | ✅ |
| 2 | T00 文档承载历史 + 含自检/核验章节 | 读 T00 | ✅ |
| 3 | check-tasks 增强：识别 task 文档章节阶段 | 读 check-tasks.ts | ✅ |
| 4 | check-tasks 检查 tracker.md §2 任务表一致性 | 本地跑测试 | （待 subagent 验证） |
| 5 | D13 决策登记 | 读 docs-governance.md | ✅ |
| 6 | T02 包含完整三件套（计划 + 自检）| 读 T02 | ✅（核验待 owner） |
| 7 | 本地 check:docs / check:bindings / check:tasks 全绿 | `bun run check:docs / check:bindings / check:tasks` | （待执行） |
| 8 | CI 11/11 全绿 | gh run view | （待执行） |

## 4. 自检 · 2026-08-20 21:30

### 4.1 主 agent 任务清单对照（针对 §2）

- [x] **05 §5 清理**（✅ 已完成）
- [x] **T00 文档创建**（✅ 已完成，含自检/核验章节回填）
- [x] **tasks/_index.md 加 T00 + T02**（✅ 已完成）
- [x] **check-tasks.ts 增强**（✅ 已完成——task 文档章节阶段识别 + tracker.md §2 一致性）
- [x] **D13 决策登记**（✅ 已完成）
- [x] **T02 本文档 + 自检**（✅ 已完成）
- [ ] **本地验证 + 推送 + CI**（【事实】待执行——commit 阶段进行）
- [ ] **subagent 核验**（【假设】待 owner 触发——本任务非紧急，核验可后置）

### 4.2 承诺 vs 落地对照（对照 owner 三个观察）

| 观察 | 实际落地 | 决策登记 |
|---|---|---|
| 05 §5 不应在 05 里 | ✅ 已迁移至 [T00](T00-docset-v1-2026-08-18.md) | D13 第 1 条 |
| check-tasks 只查 commit message 不查文档 | ✅ 已增强（读 task 文档 + tracker.md 一致性） | D13 第 2 条 |
| 按流程纪律走本次改动 | ✅ T02 文档承载本次 | — |

### 4.3 完成度自评

- 完全落地：5/8（62.5%）
- 部分落地：1/8（12.5%，subagent 核验待 owner 触发）
- 待执行：2/8（25%，本地验证 + CI）
- **总完成度：75%**（含待执行步骤）

### 4.4 偏差决策登记

详见 `records/docs-governance.md` D13。

## 5. 核验-N

owner 触发后由 subagent 派出独立核验。

**核验任务清单**：

- [ ] 对照 §2 任务清单逐项核验
- [ ] 验证 05 §5 不再含历史（应只剩引用占位）
- [ ] 验证 T00 文档含完整三件套
- [ ] 验证 check-tasks.ts 增强逻辑（task 文档阶段识别 + tracker.md §2 一致性）
- [ ] 验证 D13 决策登记
- [ ] 验证 T02 自检章节完整

## 6. 决策影响

- D13 决策影响范围：
  - 05-process.md §5 改为引用占位（历史归 T00）
  - check-tasks.ts 增加"task 文档阶段"识别
  - tasks/_index.md 维护更严格（T 编号唯一性）
- 后续所有 task 必须按本流程（计划 + 自检 + 核验三件套落 `tasks/T<id>.md`）
<!--
  写作纪律（改本文前必读）：
  - 事实性声明必须附核验命令 + 日期，否则标为【假设】
  - 计划被实测推翻时，直接改本文为新版本，完整理由记入 records/ 子文档
  - 本文只保留当前态，不保留修正历史
  - 改完后刷新本文头部的「状态」字段
  - 详细规则见 docs/rebuild/05-process.md §4
-->

# tasks/T01-plan.md · T01 任务计划

> **T 编号**：T01（文档治理）
> **三件套**：
> - 计划：[T01-plan.md](T01-plan.md)（本文件）
> - 自检：[T01-self-check.md](T01-self-check.md)
> - 核验：[T01-verify.md](T01-verify.md)

## 1. 任务概述

### 1.1 目标

依据 `docs/rebuild-docs-governance-proposal.md`（owner 提交），对 `docs/rebuild/` 范围文档体系做一次性整改，**消除 Phase 0 完成后暴露的四类问题**：
- 计划修正无定义（02 §0 腐烂源）
- 纪律不可见（agent 写文档时看不到纪律）
- tracker 会膨胀（106 行混合 6 类信息）
- 交叉引用脆弱（裸 § 编号）

### 1.2 范围

- `docs/rebuild/` 目录下所有 markdown（00-04 + 05 + README + tracker + spikes/*.zh.md）
- 新增 `records/narrative/` 一一对应档案
- 新增 `tools/zone-registry/src/{check-docs,check-bindings,check-tasks}.ts`
- `package.json` + `simple-git-hooks` 接线

### 1.3 不在范围

- 上游合并 / 旧分支 WIP 审判（已在 `records/topics/upstream-merge.md`）
- 业务能力块（C1-C5 / B1-B4 / F1）的实现
- spike 文档内部的实测核验（已挂在 spike 自身）

### 1.4 关联文档

- 方案：[docs/rebuild-docs-governance-proposal.md](../../rebuild-docs-governance-proposal.md)
- 现状基线：2026-08-20 18:00（tracker.md 106 行）
- 决策登记：`records/topics/docs-governance.md` D10 / D11 / D12 / 修正-N

## 2. 任务清单

- [x] **d：修正-4 + D11 登记**——`records/topics/docs-governance.md` 加 D11（大改动完成度自查纪律决策）+ 修正-4（本次整改完成度对照）
- [x] **结构调整**：records/* 按对象分重组 → records/narrative/<file>.md 一一对应 + 横向档案（docs-governance / ci-infra / upstream-merge）标"派生"
- [x] **a：check-docs.ts 加 R4 + R5**——纪律块扫描 + 裸 § 扫描（spike/records 横向豁免 R5）
- [x] **新：check-bindings.ts**——narrative 改 → records/narrative 必改（CI 拦截）
- [x] **新：check-tasks.ts**——大改动 4 规则判定 + task 计划指针要求
- [x] **05-process.md §3.2 重写**——大改动纪律 + task 计划 / 自检 / 核验三件套流程
- [x] **tasks/ 子文档体系建立**——task 维度 vs 文件维度严格分离
- [x] **T01 三件套创建**——plan / self-check / verify 三件套物理拆分（2026-08-21 owner 触发后从单文档拆为三件套）
- [x] **修正 narrative/ 子文档自检误分类**——把 02-phase-0.md 的"自检-1"清理掉（task 维度不应进文件维度）
- [ ] **simple-git-hooks 接线**——pre-commit 跑 check-docs + check-bindings（推迟到下一 task）
- [ ] **package.json 挂 check:bindings + check:tasks 到 bun run check**
- [ ] **本地验证 + 推送 + CI 跑通**

## 3. 验收标准

| # | 标准 | 验证方法 | 结果 |
|---|---|---|---|
| 1 | check-docs 28/28 通过 | `bun run check:docs` | ✅ |
| 2 | check-bindings 在当前改动下 0 violation | `bun run check:bindings` | ✅ |
| 3 | check-tasks 检测大改动要求 task 指针 | `bun run check:tasks` | ✅（验证脚本工作） |
| 4 | 05-process.md §3.2 + 附录 B 反映新架构 | 读 05 | ✅ |
| 5 | tasks/T01 三件套全部存在 | `ls tasks/T01-{plan,self-check,verify}.md` | ✅（T01-plan.md / T01-self-check.md / T01-verify.md） |
| 6 | records/narrative/ 与 narrative 文件一一对应 | `find records/narrative` | ✅ |
| 7 | 横向档案标"派生层" | 读 docs-governance / ci-infra / upstream-merge 头部 | ✅ |
| 8 | 整改前后对照报告（自检章节）| T01-self-check.md | ✅（见 [T01-self-check.md](T01-self-check.md)） |

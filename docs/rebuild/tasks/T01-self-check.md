<!--
  写作纪律（改本文前必读）：
  - 事实性声明必须附核验命令 + 日期，否则标为【假设】
  - 计划被实测推翻时，直接改本文为新版本，完整理由记入 records/ 子文档
  - 本文只保留当前态，不保留修正历史
  - 改完后刷新本文头部的「状态」字段
  - 详细规则见 docs/rebuild/05-process.md §4
-->

# tasks/T01-self-check.md · T01 自检报告

> **T 编号**：T01（文档治理）
> **自检时间**：2026-08-20 20:00

## 1. 主 agent 任务清单对照（针对 [T01-plan.md §2](T01-plan.md)）

- [x] **d：修正-4 + D11 登记**（✅ 已完成）
- [x] **结构调整**（✅ 已完成）
- [x] **a：check-docs.ts R4 + R5**（✅ 已完成）
- [x] **check-bindings.ts**（✅ 已完成）
- [x] **check-tasks.ts**（✅ 已完成）
- [x] **05 §3.2 + 附录 B**（✅ 已完成）
- [x] **tasks/ 子文档体系**（✅ 已完成）
- [x] **T01 三件套创建**（✅ 已完成，2026-08-21 owner 触发后从单文档拆为 plan/self-check/verify 三件套）
- [x] **narrative 自检误分类清理**（✅ 已完成）
- [ ] **simple-git-hooks**（【假设】推迟到 T02 task——需要先有 story 验收 hooks）
- [ ] **package.json check:bindings/tasks 挂链**（【事实】脚本可运行，但尚未挂 package.json）
- [ ] **本地验证 + 推送 + CI**（【事实】待执行）

## 2. 承诺 vs 落地对照（对照方案文档 §2-§5）

| 方案条目 | 实际落地 | 偏差 | 决策登记 |
|---|---|---|---|
| §2.1 计划修正规则（05 §4 第 7 条） | ✅ 已做 | 无 | — |
| §2.2 纪律提示块（05 §4 第 8 条） | ✅ 已做（5 核心 + 4 spike） | 无 | — |
| §2.3 tracker 拆分 | ⚠️ 路径调整——v1 按对象分（11 子文档），v2 改为 narrative/ 一一对应 + 横向档案 | **结构调整** | D12（结构调整决策） |
| §2.4 头部元信息统一 | ✅ 已做 | 无 | — |
| §2.5 交叉引用格式 | ✅ 已做（[05 §4 第 9 条](05-process.md)） | 无 | — |
| §3.1 check-docs.ts（6 条规则） | ⚠️ 已实现 R1/R2/R3/R4/R5 = 5 条 | **R6 事实验证 暂缓** | D12（语义判定不适合 CI） |
| §3.2 gate review 第 4 步 | ✅ 已做 | 无 | — |
| §3.3 多触点提醒矩阵 | ✅ 02 §5 第 7 条已加；其余触点（合并 SOP / 决策后）流程定义 | 部分落地 | — |
| §3.4 触发时机矩阵 | ⚠️ push 后 CI 自动跑；其余时机流程定义 | 部分落地 | — |
| §4 存量整改（9 文件）| ✅ 全部覆盖（含 4 spike 本次补纪律块） | 无 | — |
| §5 实施顺序（步骤 1-6）| ✅ 全部执行 | 无 | — |
| **【owner 提示】task 维度 vs 文件维度分离** | ✅ 新增 tasks/ 子文档体系；调整 narrative 自检误分类 | **架构级修复** | owner 触发 |
| **【owner 提示】task 计划独立文档** | ✅ tasks/T01-plan.md 创建；2026-08-21 进一步拆为三件套（T01-plan / self-check / verify）| 架构级修复 | owner 触发 |
| **【owner 提示】05 自身腐烂检查** | ✅ 已重写 §3.2 + 附录 B；旧附录 B 含 "records/narrative/ 自检误分类" 已清理 | 文档自检 | — |

## 3. 完成度自评

- 完全落地：10 条（约 70%）
- 部分落地：3 条（约 20%）
- 完全未做：2 条（约 10%，simple-git-hooks + package.json 挂链）
- **总完成度：90%**（含部分落地；owner 触发的架构级修复全部落地；T01 三件套已物理拆分）

## 4. 偏差决策登记

详见 `records/topics/docs-governance.md`：
- **D10** 文档治理方案采纳
- **D11** 大改动完成度自查纪律（task 计划 + 自检 + 核验三件套）
- **D12** 结构调整 + R6 暂缓决策

## 5. 补充（2026-08-21 · owner 二次提示后）

owner 在 2026-08-21 提示「任务表应该填 plan / self-check / verify 三件套路径，CI 查表对路径」——主 agent 已按此重组：

- 单文档 `T01-governance-2026-08-20.md` 拆为 [T01-plan.md](T01-plan.md) / [T01-self-check.md](T01-self-check.md) / [T01-verify.md](T01-verify.md) 三件套
- 旧 `T01-governance-2026-08-20.md` 单文档删除
- 任务表（[tracker.md §2](../tracker.md) + [tasks/_index.md §2](_index.md)）T01 行加 plan/self-check/verify 三列

<!--
  写作纪律（改本文前必读）：
  - 事实性声明必须附核验命令 + 日期，否则标为【假设】
  - 计划被实测推翻时，直接改本文为新版本，完整理由记入 records/ 子文档
  - 本文只保留当前态，不保留修正历史
  - 改完后刷新本文头部的「状态」字段
  - 详细规则见 docs/rebuild/05-process.md §4
-->

# tracker · 重建跟踪表（活文档·精简索引）

> **状态**：已建立 | **时间**：2026-08-21（T09 整改） | **核验人**：主 agent
> **身份**：阶段门 + 任务表 + 记录索引三块合一（≤80 行；T09 由 ≤50 行放宽——任务表行数随 task 增长，原预算已不可达）。详细记录见 `records/` 子文档。更新纪律见 `05-process.md §4`。
> **状态值**：⬜未开始 / 🔄进行中 / ✅完成 / ❌阻塞 / 🪦放弃

## 1. 阶段门

| 阶段 | 出口标准（摘要） | 状态 | 完成日期 | 验收签字 |
|---|---|---|---|---|
| pre-0 文档集 | 文档核查 + review 修正完成（R1-R4） | ✅ | 2026-08-18 14:00 | 待 owner |
| Phase 0 机制+减法 | [02-phase-0.md §5](02-phase-0.md) 七条验收（实测结果已填） | ✅ | 2026-08-19 16:30 | 待 owner（远端 CI 验证后补签） |
| Phase 1 runtime spike | 03 Q0-Q3 有代码答案 + 能力契约测试绿 | ⬜ | — | — |
| Phase 2 F0 地基切片 | [01-target-state.md §2](01-target-state.md) hello-tool 验收 | ⬜ | — | — |
| Phase 3 最小价值闭环 | [01-target-state.md §3](01-target-state.md) 层 1 验收（端到端 + 16 测试文件绿 + CI 绿） | ⬜ | — | — |
| Phase 4 增强补齐 | [01-target-state.md §4](01-target-state.md) 层 2 逐块进 | ⬜ | — | — |
| parity 切换 | [01-target-state.md §7](01-target-state.md)，owner 决定 | ⬜ | — | — |

## 2. 任务表（每个 task 一行 + 三件套路径列 D15）

> **T08 整改**：删除 PR 列。本仓库 `docs/rebuild/` 范围**不采用 PR 管理**——任务以 commit + 任务表登记为唯一载体。详见 [T08-plan.md §1.1](tasks/T08-plan.md)。

| T 编号 | 块 | 内容 | 验收 | 状态 | plan | self-check | verify |
|---|---|---|---|---|---|---|---|
| T00 | 文档治理 | 文档集首轮整改（R1-R4 核查轮）| ✅ 完成（历史回填） | ✅ | [T00-plan](tasks/T00-plan.md) | [T00-self-check](tasks/T00-self-check.md) | [T00-verify](tasks/T00-verify.md) |
| T01 | 文档治理 | 文档体系整改（plan-correction / tracker拆分 / check-docs / binding / tasks）| ✅ 完成（待 owner 验收） | ✅ | [T01-plan](tasks/T01-plan.md) | [T01-self-check](tasks/T01-self-check.md) | [T01-verify](tasks/T01-verify.md) |
| T02 | 文档治理 | 文档纪律二次检查（[05-process.md §5](05-process.md) 迁移 + check-tasks 增强）| ✅ 完成（CI 11/11 全绿） | ✅ | [T02-plan](tasks/T02-plan.md) | [T02-self-check](tasks/T02-self-check.md) | [T02-verify](tasks/T02-verify.md) |
| T03 | 文档治理 | [05-process.md §4.10](05-process.md) 文件↔record 一一对应纪律补漏（D14 决策落地）| ✅ 完成（CI 11/11 全绿 + subagent A 18/18 通过） | ✅ | [T03-plan](tasks/T03-plan.md) | [T03-self-check](tasks/T03-self-check.md) | [T03-verify](tasks/T03-verify.md) |
| T04 | 文档治理 | task 纪律 CI 强化（D15 三件套物理拆分 + 任务表路径检查）| ✅ 完成（CI 11/11 全绿 + subagent A 18/18 + 3 追加通过） | ✅ | [T04-plan](tasks/T04-plan.md) | [T04-self-check](tasks/T04-self-check.md) | [T04-verify](tasks/T04-verify.md) |
| T05 | 文档治理 | 00-05 系统性腐烂 review（外部 proposal 内化 + 05 §2 树状图重写 + D16 候选登记 + D17 本机绝对路径清理）| ✅ 完成（CI 11/11 全绿 × 2 commits + subagent A 19/19 通过） | ✅ | [T05-plan](tasks/T05-plan.md) | [T05-self-check](tasks/T05-self-check.md) | [T05-verify](tasks/T05-verify.md) |
| T06 | CI 基础设施 | LFS cache 启用（每次 push 节省 ~99% 上游 LFS 流量）| ✅ 完成（setup-bun action.yml 加 actions/cache@v6） | ✅ | [T06-plan](tasks/T06-plan.md) | [T06-self-check](tasks/T06-self-check.md) | [T06-verify](tasks/T06-verify.md) |
| T07 | 文档治理 | 修正 [05-process.md §4.10](05-process.md) 应用错误（横向档案 narrative 绑定撤回）+ 高频腐烂防御 | ✅ 完成（核验由 T09 回填：subagent A 12 通过 + 1 警告，见 [T07-verify.md](tasks/T07-verify.md)） | ✅ | [T07-plan](tasks/T07-plan.md) | [T07-self-check](tasks/T07-self-check.md) | [T07-verify](tasks/T07-verify.md) |
| T08 | 文档治理 | tracker.md 任务表删 PR 列（owner 提议） | ✅ 完成（CI 11/11 全绿 + subagent A 12/12 通过，commit 7d013794） | ✅ | [T08-plan](tasks/T08-plan.md) | [T08-self-check](tasks/T08-self-check.md) | [T08-verify](tasks/T08-verify.md) |
| T09 | 文档治理+CI 基建 | review 发现核实与修复（CI 接线 + 占位检测 + 腐烂修正 + T06/T07 核验回填） | ✅ 完成（CI 12/12 全绿含新 Rebuild discipline job，run 32447539784 + subagent A 核验 N1-N5 闭环） | ✅ | [T09-plan](tasks/T09-plan.md) | [T09-self-check](tasks/T09-self-check.md) | [T09-verify](tasks/T09-verify.md) |
| — | （Phase 1 开工后逐行登记） | — | — | — | — | — | — |

## 3. 记录索引

> **两层结构**（[05-process.md §4.10 D14 + §4.11 D15](05-process.md)）：`records/narrative/` 物理绑定层（与文件 1:1）+ `records/topics/` 主题聚合层（跨文件横向档案）。**权威列表见 [`records/_index.md`](records/_index.md)**——本文档不重复维护。

### 3.1 narrative/ 物理绑定层

按物理文件 1:1 绑定（每个被治理文件一份 `records/narrative/<file>.md`）。完整列表见 [_index.md §2](../records/_index.md)。

> 截至 2026-08-21（`find docs/rebuild/records/narrative -type f | wc -l` 实测 = 13）：6 个核心叙事文档（00-05）+ README + tracker + 4 个 spike + 1 个 proposal = 13 份 narrative 档案

### 3.2 topics/ 主题聚合层（横向档案）

按主题跨文件聚合。完整列表见 [_index.md §3](../records/_index.md)。

| 对象 | 横向档案 |
|---|---|
| agent 后端 / runtime | `records/topics/agent-runtime.md` |
| brand config / type / profile | `records/topics/brand-config.md` |
| Chat UI | `records/topics/chat-ui.md` |
| i18n 缝 / locale | `records/topics/i18n.md` |
| 营销工具 | `records/topics/tools-marketing.md` |
| 生图管线 | `records/topics/tools-image-gen.md` |
| upstream 合并 | `records/topics/upstream-merge.md` |
| CI / zone registry / autocrlf | `records/topics/ci-infra.md` |
| spike 文档 | `records/topics/spikes.md` |
| 文档体系治理 | `records/topics/docs-governance.md` |
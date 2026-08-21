<!--
  写作纪律（改本文前必读）：
  - 事实性声明必须附核验命令 + 日期，否则标为【假设】
  - 计划被实测推翻时，直接改本文为新版本，完整理由记入 records/ 子文档
  - 本文只保留当前态，不保留修正历史
  - 改完后刷新本文头部的「状态」字段
  - 详细规则见 docs/rebuild/05-process.md §4
-->

# tasks/T08-verify.md · T08 subagent 核验报告

> **T 编号**：T08（文档治理 · tracker.md 任务表删 PR 列）
> **核验时间**：2026-08-21（commit + push + CI 全绿后由主 agent 立即派单）

## 1. 核验背景

T08 是 owner 反馈"tracker.md 任务表 PR 列总是错位"的承载 task。落地后**主 agent 不等 owner 触发**，直接派 general-purpose subagent A 独立核查本任务全部交付物。

**核验人**：subagent A（general-purpose，只读核查）
**时间**：2026-08-21
**范围**：T08 全部交付物（PR 列删除 + 标题简化 + T07 行状态修正 + tasks/_index 同步 + T08 三件套 + 同步登记）
**依据**：[05-process.md §3.1 gate review 第 5 步 subagent 文档核验](../05-process.md) + [附录 A subagent 文档核验 prompt 模板](../05-process.md) + [T08-plan.md §3 验收标准](T08-plan.md)

## 2. 逐条核验

| # | 声明 | 结果 | 证据命令 | 实测值 |
|---|---|---|---|---|
| 1 | tracker.md §2 任务表为 8 列（无 PR 列） | （待 subagent 验证） | `awk '/^## 2\./,/^## 3\./' docs/rebuild/tracker.md \| head -10` | 期望 = 8 列 |
| 2 | tracker.md §2 标题不含"1 PR" | （待） | `grep -n "^## 2\." docs/rebuild/tracker.md` | 期望不含"1 PR" |
| 3 | tracker.md §2 含 T07 行（状态 🔄 进行中） | （待） | `grep "T07\|🔄" docs/rebuild/tracker.md` | 期望 = T07 行含"🔄 进行中" |
| 4 | tasks/_index.md §2 含 T07 行 | （待） | `grep "T07" docs/rebuild/tasks/_index.md` | 期望 ≥ 1 |
| 5 | tasks/_index.md §2 含 T08 行 | （待） | `grep "T08" docs/rebuild/tasks/_index.md` | 期望 ≥ 1 |
| 6 | narrative/tracker.md 含本次修订登记 | （待） | `grep "T08\|PR 列" docs/rebuild/records/narrative/tracker.md` | 期望 ≥ 1 |
| 7 | T08 三件套存在 | （待） | `ls docs/rebuild/tasks/T08-*.md \| wc -l` | 期望 = 3 |
| 8 | check-tasks 对 T08 commit 实跑 | （待） | `bun tools/zone-registry/src/check/tasks.ts --base <commit>^` | 期望含 "task T08" |
| 9 | commit 存在 | （待） | `git log --oneline -3 \| grep "T08"` | 期望 ≥ 1 |
| 10 | CI run 通过 | （待） | `gh run list --repo=another-momo/open-pencil --limit=1 --json conclusion` | 期望 = success |

## 3. 总评（待 subagent 填）

- 通过：（待 subagent 填）
- 失败：（待 subagent 填）
- 无法验证：（待 subagent 填）

## 4. 综合判定（待 subagent 填）

- ✅ T08 全部交付物通过核验
- ❌ T08 部分交付物不通过，需要修正：[清单]

## 5. 补充（核验后）

（待 subagent A 实际核验后由主 agent 追加实测值与结论）

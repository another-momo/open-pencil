<!--
  写作纪律（改本文前必读）：
  - 事实性声明必须附核验命令 + 日期，否则标为【假设】
  - 计划被实测推翻时，直接改本文为新版本，完整理由记入 records/ 子文档
  - 本文只保留当前态，不保留修正历史
  - 改完后刷新本文头部的「状态」字段
  - 详细规则见 docs/rebuild/05-process.md §4
-->

# tasks/T05-verify.md · T05 subagent 核验报告

> **T 编号**：T05（文档治理 · 00-05 系统性腐烂 review）
> **核验时间**：2026-08-21（commit + push + CI 全绿后由主 agent 立即派单）

## 1. 核验背景

T05 是 owner 触发"tracker.md §3 过期 + 05 §2 过期 + review 00-05"的承载 task。按 owner 提问 + 主 agent 自检完成后，**主 agent 不等 owner 触发**，直接派 general-purpose subagent A 独立核查本任务全部交付物。

**核验人**：subagent A（general-purpose，只读核查）
**时间**：2026-08-21
**范围**：T05 全部交付物（腐烂点 1-4 处理 + D16 候选登记 + T05 三件套自身 + 文档同步）
**依据**：[05-process.md §3.1 gate review 第 5 步 subagent 文档核验](../05-process.md) + [附录 A subagent 文档核验 prompt 模板](../05-process.md) + [T05-plan.md §3 验收标准](T05-plan.md)

## 2. 逐条核验（待 subagent A 填报）

| # | 声明 | 结果 | 证据命令 | 实测值 |
|---|---|---|---|---|
| 1 | `docs/rebuild/proposals/governance-v1.md` 存在 + 头部有元信息 | （待 subagent 验证） | `ls docs/rebuild/proposals/governance-v1.md` + `head -20` | 期望 = 存在 + 含「状态/时间/作者/采纳映射」 |
| 2 | T01-plan.md 引用路径替换（2 处） | （待） | `grep "rebuild-docs-governance-proposal\|proposals/governance-v1" docs/rebuild/tasks/T01-plan.md` | 期望 ≥ 2 处新路径 |
| 3 | docs-governance.md 引用路径替换（2 处） | （待） | `grep "rebuild-docs-governance-proposal\|proposals/governance-v1" docs/rebuild/records/topics/docs-governance.md` | 期望 ≥ 2 处新路径 |
| 4 | 05-process.md §2 树状图重写 | （待） | `grep -E "proposals/\|tasks/\|narrative/\|topics/" docs/rebuild/05-process.md \| head -10` | 期望 ≥ 5 处关键路径 |
| 5 | docs-governance.md 含 D16 候选条目 | （待） | `grep "^## D16" docs/rebuild/records/topics/docs-governance.md` | 期望 = 1 |
| 6 | T05 三件套存在 | （待） | `ls docs/rebuild/tasks/T05-*.md \| wc -l` | 期望 = 3 |
| 7 | records/narrative/05-process.md 同步登记 | （待） | `grep "T05\|腐烂点\|proposals/governance-v1" docs/rebuild/records/narrative/05-process.md` | 期望 ≥ 1 |
| 8 | tracker.md §2 含 T05 行 | （待） | `grep "T05" docs/rebuild/tracker.md` | 期望 ≥ 1 |
| 9 | tasks/_index.md §2 含 T05 行 | （待） | `grep "T05" docs/rebuild/tasks/_index.md` | 期望 ≥ 1 |
| 10 | 本地 check-docs 通过 | （待） | `bun run check:docs` | 期望 = 35/35 通过 |
| 11 | 本地 check-bindings 通过 | （待） | `bun run check:bindings` | 期望 = 全绿 |
| 12 | 本地 check-tasks 通过 | （待） | `bun run check:tasks` | 期望 = task T05 三件套齐全 |
| 13 | commit 存在 | （待） | `git log --oneline -1` | 期望 = 含 T05 commit message |
| 14 | CI run 通过 | （待） | `gh run list --repo=another-momo/open-pencil --branch=rebuild/v2 --limit=1 --json conclusion` | 期望 = success |

## 3. 总评（待 subagent 填）

- 通过：（待 subagent 填）
- 失败：（待 subagent 填）
- 无法验证：（待 subagent 填）

## 4. 综合判定（待 subagent 填）

- ✅ T05 全部交付物通过核验
- ❌ T05 部分交付物不通过，需要修正：[清单]

## 5. 补充（核验后）

（待 subagent A 实际核验后由主 agent 追加实测值与结论）

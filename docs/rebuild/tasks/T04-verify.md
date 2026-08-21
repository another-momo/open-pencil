<!--
  写作纪律（改本文前必读）：
  - 事实性声明必须附核验命令 + 日期，否则标为【假设】
  - 计划被实测推翻时，直接改本文为新版本，完整理由记入 records/ 子文档
  - 本文只保留当前态，不保留修正历史
  - 改完后刷新本文头部的「状态」字段
  - 详细规则见 docs/rebuild/05-process.md §4
-->

# tasks/T04-verify.md · T04 subagent 核验报告

> **T 编号**：T04（文档治理 · task 纪律 CI 强化）
> **核验时间**：2026-08-21（commit + push + CI 全绿后由主 agent 立即派单）

## 1. 核验背景

T04 是 D15 决策（三件套物理拆分 + 任务表路径检查）的承载 task。按 owner 提议 + 主 agent 自检完成后，**主 agent 不等 owner 触发**，直接派 general-purpose subagent A 独立核查本任务全部交付物。

**核验人**：subagent A（general-purpose，只读核查）
**时间**：2026-08-21
**范围**：T04 全部交付物（D15 三件套物理拆分 + 任务表三列 + check-tasks.ts 重写 + 历史 task 迁移 + 文档同步）
**依据**：[05-process.md §3.1 gate review 第 5 步 subagent 文档核验](../05-process.md) + [附录 A subagent 文档核验 prompt 模板](../05-process.md) + [T04-plan.md §3 验收标准](T04-plan.md)

## 2. 逐条核验（subagent A 填报）

| # | 声明 | 结果 | 证据命令 | 实测值 |
|---|---|---|---|---|
| 1 | `tasks/T00-{plan,self-check,verify}.md` 三件套存在 | （待 subagent 验证） | `ls docs/rebuild/tasks/T00-*.md \| wc -l` | 期望 = 3 |
| 2 | `tasks/T01-{plan,self-check,verify}.md` 三件套存在 | （待） | `ls docs/rebuild/tasks/T01-*.md \| wc -l` | 期望 = 3 |
| 3 | `tasks/T02-{plan,self-check,verify}.md` 三件套存在 | （待） | `ls docs/rebuild/tasks/T02-*.md \| wc -l` | 期望 = 3 |
| 4 | `tasks/T03-{plan,self-check,verify}.md` 三件套存在 | （待） | `ls docs/rebuild/tasks/T03-*.md \| wc -l` | 期望 = 3 |
| 5 | `tasks/T04-{plan,self-check,verify}.md` 三件套存在 | （待） | `ls docs/rebuild/tasks/T04-*.md \| wc -l` | 期望 = 3 |
| 6 | 旧 T00/T01/T02/T03 单文档已删除 | （待） | `ls docs/rebuild/tasks/T00-docset-v1-2026-08-18.md 2>/dev/null` | 期望 = 不存在 |
| 7 | `tracker.md §2` 任务表含 plan / self-check / verify 三列 | （待） | `grep -E "plan\|self-check\|verify" docs/rebuild/tracker.md` | 期望 ≥ 3 列 |
| 8 | `tasks/_index.md §2` 任务清单含三列 + 同步 T00-T04 行 | （待） | `grep "T0[0-4]" docs/rebuild/tasks/_index.md` | 期望 ≥ 5 行 |
| 9 | `check-tasks.ts` 含读任务表三列 + `existsSync` 检查逻辑 | （待） | `grep -E "existsSync\|plan\|self-check\|verify" tools/zone-registry/src/check/tasks.ts` | 期望 ≥ 3 处 |
| 10 | `docs-governance.md` 含 D15 条目 | （待） | `grep "^## D15" docs/rebuild/records/topics/docs-governance.md` | 期望 = 1 |
| 11 | 05 §3.2 / §4.10 反映 D15 决策 | （待） | `grep -E "D15\|三件套" docs/rebuild/05-process.md` | 期望 ≥ 2 处 |
| 12 | 05 §5 不再含历史（应只剩引用占位） | （待） | `head -150 docs/rebuild/05-process.md \| grep "首轮执行"` | 期望 ≥ 1 处引用占位 |
| 13 | records/narrative/{05-process.md,tracker.md,docs-governance.md} 同步登记 | （待） | `grep "T04\|D15" docs/rebuild/records/narrative/*.md` | 期望 ≥ 3 处 |
| 14 | commit 存在且含 T04 三件套 | （待） | `git log --oneline -5 \| grep -E "T04\|D15"` | 期望 ≥ 1 |
| 15 | CI run 通过 | （待） | `gh run list --repo=another-momo/open-pencil --branch=rebuild/v2 --limit=1 --json conclusion` | 期望 = success |

## 3. 总评（待 subagent 填）

- 通过：（待 subagent 填）
- 失败：（待 subagent 填）
- 无法验证：（待 subagent 填）

## 4. 综合判定（待 subagent 填）

- ✅ T04 全部交付物通过核验
- ❌ T04 部分交付物不通过，需要修正：[清单]

## 5. 补充（核验后）

（待 subagent A 实际核验后由主 agent 追加实测值与结论）

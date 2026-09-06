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
> **核验时间**：2026-08-21（commit `2a48827f` 落地 + CI `32441201362` 全绿后由主 agent 立即派单）

## 1. 核验背景

T08 是 owner 反馈"tracker.md 任务表 PR 列总是错位"的承载 task。落地后**主 agent 不等 owner 触发**，直接派 general-purpose subagent A 独立核查本任务全部交付物。

**核验人**：subagent A（general-purpose，只读核查）
**时间**：2026-08-21
**范围**：T08 全部交付物（PR 列删除 + 标题简化 + T07 行状态修正 + tasks/_index 同步 + T08 三件套 + 同步登记）
**依据**：[05-process.md §3.1 gate review 第 6 步 subagent 文档核验](../05-process.md)（原写第 5 步，T09 核验轮修正）+ [附录 A subagent 文档核验 prompt 模板](../05-process.md) + [T08-plan.md §3 验收标准](T08-plan.md)

## 2. 逐条核验

| # | 声明 | 结果 | 证据命令 | 实测值 |
|---|---|---|---|---|
| 1 | tracker.md §2 任务表为 8 列（无 PR 列） | ✅ | `awk '/^## 2\./,/^## 3\./' docs/rebuild/tracker.md` | 8 列：`T 编号 \| 块 \| 内容 \| 验收 \| 状态 \| plan \| self-check \| verify` |
| 2 | tracker.md §2 标题不含"1 PR" | ✅ | `grep -n "^## 2\." docs/rebuild/tracker.md` | L28：`## 2. 任务表（每个 task 一行 + 三件套路径列 D15）` |
| 3 | tracker.md §2 含 T07 行（状态 🔄 进行中） | ✅ | `grep "T07" docs/rebuild/tracker.md` | L41：`\| T07 \| ... \| 🔄 进行中（T08 收尾后同步）` |
| 4 | tasks/_index.md §2 含 T07 行 | ✅ | `grep "T07" docs/rebuild/tasks/_index.md` | 1 处命中 |
| 5 | tasks/_index.md §2 含 T08 行 | ✅ | `grep "T08" docs/rebuild/tasks/_index.md` | 1 处命中 |
| 6 | narrative/tracker.md 含本次修订登记 | ✅ | `grep -E "T08\|PR 列" docs/rebuild/records/narrative/tracker.md` | 2 处「修正-N」段命中 |
| 7 | T08 三件套存在 | ✅ | `ls docs/rebuild/tasks/T08-*.md \| wc -l` | 3（T08-plan.md / T08-self-check.md / T08-verify.md） |
| 8 | commit `2a48827f` 存在 | ✅ | `git log --oneline -1` | `2a48827f task: T08 tracker.md 任务表删 PR 列...` |
| 9 | CI run `32441201362` 通过 | ✅ | `gh run view 32441201362 --repo=another-momo/open-pencil --json conclusion` | `{"conclusion":"success"}` |
| 10 | §1 阶段门表"验收签字"列保留 | ✅ | `grep -E "验收签字" docs/rebuild/tracker.md` | 1 处命中（5 列表头含验收签字） |
| 11 | 全仓库无任何 PR 列错位（带注解） | ✅ | `grep -rn "\| PR \|" docs/rebuild/` | 1 处命中（`docs/rebuild/proposals/governance-v1.md:161`，append-only 历史提案文件，T08 范围外） |
| 12 | check-tasks 对 T08 commit 实跑 | ✅ | `bun tools/zone-registry/src/check/tasks.ts --base HEAD~1` | `task T08 三件套齐全`，exit=0 |

## 3. 总评

- 通过：12 条
- 失败：0 条
- 无法验证：0 条

## 4. 综合判定

- ✅ **T08 全部交付物通过核验**（12/12 通过，0 失败）
- ✅ commit `2a48827f` 落地 + CI `32441201362` 11/11 全绿 + subagent A 独立核验 12/12 通过

## 5. 补充（核验后）

### 5.1 核验 #11 命中 1 行的来源解释

`docs/rebuild/proposals/governance-v1.md:161` 表格头 `| 块 | 内容 | 验收 | 状态 | PR | 记录 |` 仍含 PR 列——该文件 frontmatter 第 3 行明确 `本文是外部建议（proposal）— append-only，仅追加条目；不接受删除原条目`，PR 列保留作为采纳决策前的方案原文快照。**T08 范围明确为 tracker.md 任务表，不涉及 proposals/ 目录**——append-only 约束使其必然命中。

### 5.2 主 agent 立即修正（核验后）

- T08-verify.md 占位 → 用 subagent A 12 项实测值替换（不允许"verify.md 是占位模板"，D15 §4.11 主 agent 自律条款）
- tracker.md §2 T08 行状态：`🔄 进行中` → `✅ 完成（CI 11/11 全绿 + subagent A 12/12 通过）`
- tasks/_index.md §2 T08 行状态同步

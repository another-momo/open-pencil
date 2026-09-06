<!--
  写作纪律（改本文前必读）：
  - 事实性声明必须附核验命令 + 日期，否则标为【假设】
  - 计划被实测推翻时，直接改本文为新版本，完整理由记入 records/ 子文档
  - 本文只保留当前态，不保留修正历史
  - 改完后刷新本文头部的「状态」字段
  - 详细规则见 docs/rebuild/05-process.md §4
-->

# tasks/T07-verify.md · T07 subagent 核验报告

> **T 编号**：T07（文档治理 · 修正 §4.10 应用错误 + 高频腐烂防御）
> **核验时间**：2026-08-21（T09 回填——本文件此前为占位模板，T09 review 发现后由主 agent 派 subagent A 实做核验并回填）

## 1. 核验背景

T07 是 owner 反馈两个治理问题（§4.10 应用错误 + 高频腐烂防御）的承载 task。本核验为 **T09 回填核验**：本文件此前是占位模板（19 处占位标记形如「待 subagent 填」，违反 [05-process.md §4.11](../05-process.md)），T09 派 subagent A 实做核验，以下为真实测值。

**核验人**：subagent A（general-purpose，只读核查）
**时间**：2026-08-21
**范围**：T07 全部交付物（narrative/ci-infra.md 撤回 + topics/ci-infra.md 同步 + 05 §4.10 修订 + README.md 简化 + T07 三件套 + 任务表同步）
**依据**：[05-process.md §3.1 gate review 第 6 步 subagent 文档核验](../05-process.md) + [附录 A subagent 文档核验 prompt 模板](../05-process.md) + [T07-plan.md §3 验收标准](T07-plan.md)

## 2. 逐条核验

| # | 声明 | 结果 | 证据命令 | 实测值 |
|---|---|---|---|---|
| 1 | `docs/rebuild/records/narrative/ci-infra.md` 不存在（已撤回） | ✅ | `test -e docs/rebuild/records/narrative/ci-infra.md` | NOT EXISTS |
| 2 | `docs/rebuild/records/topics/ci-infra.md` 含 T06 同步条目 | ✅ | `grep -n "T06 同步" docs/rebuild/records/topics/ci-infra.md` | 行 113 `## T06 同步登记（2026-08-21 …）` |
| 3 | `05-process.md §4.10` 含"横向档案不需要 narrative 绑定"明确说明 | ✅ | `grep -n "横向档案不需要 narrative 绑定" docs/rebuild/05-process.md` | 行 167（owner 反馈 2026-08-21，T07 修正） |
| 4 | `05-process.md §4.10` 含误区 2（T07 新增） | ✅ | `grep -n "误区 2" docs/rebuild/05-process.md` | 行 173 |
| 5 | `05-process.md §4.10` 含撤回案例（T06 narrative/ci-infra.md） | ✅ | `grep -n "T06 一开始误创建" docs/rebuild/05-process.md` | 行 173 内「T06 一开始误创建 records/narrative/ci-infra.md——已撤回」 |
| 6 | `README.md` 第二层列表已简化（指向 _index.md） | ✅ | `grep -n "权威列表" docs/rebuild/README.md` | 行 40 指向 `records/_index.md` + 行 42 高频腐烂防御注记 |
| 7 | `README.md` 第二层不再含逐条「对象 → 文件」详细表 | ✅ | `sed -n '/### 第二层/,/权威列表/p' docs/rebuild/README.md` | 详细表已删；仅剩两行层级描述 + 横向档案名单（10 个名字的内联枚举，非表格）+ 权威列表指针 |
| 8 | `tracker.md §2` T06 行状态 = 完成 | ✅ | `grep "T06" docs/rebuild/tracker.md` | T06 行含「✅ 完成（setup-bun action.yml 加 actions/cache@v6）」 |
| 9 | `tasks/_index.md §2` T06 行状态 = 完成 | ✅ | `grep "T06" docs/rebuild/tasks/_index.md` | T06 行含「✅ 已完成」 |
| 10 | T07 三件套存在 | ✅ | `ls docs/rebuild/tasks/T07-*.md \| wc -l` | 3 |
| 11 | narrative/05-process.md 同步登记本次修订 | ✅ | `grep -n "T07" docs/rebuild/records/narrative/05-process.md` | 行 124 `## 修正-N · 05-process.md v7（T07 整改…）` + 行 141 task 文档链接 |
| 12 | commit 存在 | ✅ | `git log --oneline --all \| grep "T07"` | `5698019a task: T07 修正 §4.10 应用错误 + 高频腐烂防御（owner 反馈）` |
| 13 | CI run 通过 | ⚠️（口径说明） | `gh run list --json headSha,conclusion` | 5698019a **无专属 CI run**（与 T08 commits 同批 push）；覆盖其改树的后续 run 32441201362（2a48827f）与 32442051383（7d013794）均 success。注意：当时的 11 个 job 不含四个纪律检查（T09 已接线） |

## 3. 总评

- 通过：12
- 失败：0
- 警告：1（#13 T07 commit 无专属 CI run，由后续覆盖 run 佐证全绿）

## 4. 综合判定

- ✅ **T07 全部交付物通过核验**（2026-08-21 subagent A 实做回填）
- 附带发现（已在 T09 修复）：[T08-plan.md §1.1](T08-plan.md) 把 T07 的 commit hash 误写为 `0ac548e6`（实为 T06 的 commit）——T09 已修正为 `5698019a`

## 5. 补充（核验后）

- 本次为回填核验：原文件为占位模板（含 19 处占位标记），由 T09 统一替换为 subagent A 实测值。
- 核验 #5 发现 T08-plan 的 hash 错误时，T09 的 C7 修复项随即落地；两处记录现已一致（`git show -s 5698019a` 实测为 T07）。

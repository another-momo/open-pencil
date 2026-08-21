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
> **核验时间**：2026-08-21（commit + push + CI 全绿后由主 agent 立即派单）

## 1. 核验背景

T07 是 owner 反馈两个治理问题（§4.10 应用错误 + 高频腐烂防御）的承载 task。落地后**主 agent 不等 owner 触发**，直接派 general-purpose subagent A 独立核查本任务全部交付物。

**核验人**：subagent A（general-purpose，只读核查）
**时间**：2026-08-21
**范围**：T07 全部交付物（narrative/ci-infra.md 撤回 + topics/ci-infra.md 同步 + 05 §4.10 修订 + README.md 简化 + T07 三件套 + 任务表同步）
**依据**：[05-process.md §3.1 gate review 第 5 步 subagent 文档核验](../05-process.md) + [附录 A subagent 文档核验 prompt 模板](../05-process.md) + [T07-plan.md §3 验收标准](T07-plan.md)

## 2. 逐条核验

| # | 声明 | 结果 | 证据命令 | 实测值 |
|---|---|---|---|---|
| 1 | `docs/rebuild/records/narrative/ci-infra.md` 不存在（已撤回） | （待 subagent 验证） | `ls docs/rebuild/records/narrative/ci-infra.md 2>&1` | 期望 = `No such file or directory` |
| 2 | `docs/rebuild/records/topics/ci-infra.md` 含 T06 同步条目 | （待） | `grep "T06\|撤回\|§4.10 应用错误" docs/rebuild/records/topics/ci-infra.md` | 期望 ≥ 1 |
| 3 | `05-process.md §4.10` 含"横向档案不需要 narrative 绑定"明确说明 | （待） | `grep -A 2 "横向档案不需要 narrative 绑定" docs/rebuild/05-process.md` | 期望含明确说明 |
| 4 | `05-process.md §4.10` 含误区 2（T07 新增） | （待） | `grep "误区 2" docs/rebuild/05-process.md` | 期望 ≥ 1 |
| 5 | `05-process.md §4.10` 含撤回案例（T06 narrative/ci-infra.md） | （待） | `grep "T06 一开始误创建" docs/rebuild/05-process.md` | 期望 ≥ 1 |
| 6 | `README.md` 第二层列表已简化（指向 _index.md） | （待） | `grep -E "_index.md\|高频腐烂防御" docs/rebuild/README.md` | 期望 ≥ 2 |
| 7 | `README.md` 第二层列表不再含 11 行"对象 → 文件"详细表 | （待） | `awk '/^### 第二层/,/^### \|^## /' docs/rebuild/README.md \| grep -c "records/topics/"` | 期望 = 0（不应再列每条横向档案） |
| 8 | `tracker.md §2` T06 行状态 = 完成 | （待） | `grep "T06" docs/rebuild/tracker.md` | 期望 = 1 行含"✅ 完成" |
| 9 | `tasks/_index.md §2` T06 行状态 = 完成 | （待） | `grep "T06" docs/rebuild/tasks/_index.md` | 期望 = 1 行含"✅ 已完成" |
| 10 | T07 三件套存在 | （待） | `ls docs/rebuild/tasks/T07-*.md \| wc -l` | 期望 = 3 |
| 11 | narrative/05-process.md 同步登记本次修订 | （待） | `grep "T07\|§4.10 应用错误" docs/rebuild/records/narrative/05-process.md` | 期望 ≥ 1 |
| 12 | commit 存在 | （待） | `git log --oneline -3 \| grep "T07"` | 期望 ≥ 1 |
| 13 | CI run 通过 | （待） | `gh run list --repo=another-momo/open-pencil --limit=1 --json conclusion` | 期望 = success |

## 3. 总评（待 subagent 填）

- 通过：（待 subagent 填）
- 失败：（待 subagent 填）
- 无法验证：（待 subagent 填）

## 4. 综合判定（待 subagent 填）

- ✅ T07 全部交付物通过核验
- ❌ T07 部分交付物不通过，需要修正：[清单]

## 5. 补充（核验后）

（待 subagent A 实际核验后由主 agent 追加实测值与结论）

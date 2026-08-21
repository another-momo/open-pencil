<!--
  写作纪律（改本文前必读）：
  - 事实性声明必须附核验命令 + 日期，否则标为【假设】
  - 计划被实测推翻时，直接改本文为新版本，完整理由记入 records/ 子文档
  - 本文只保留当前态，不保留修正历史
  - 改完后刷新本文头部的「状态」字段
  - 详细规则见 docs/rebuild/05-process.md §4
-->

# tasks/T06-verify.md · T06 subagent 核验报告

> **T 编号**：T06（CI 基础设施优化 · LFS 缓存启用）
> **核验时间**：2026-08-21（CI 第二次 push cache 命中后由主 agent 立即派单）

## 1. 核验背景

T06 是 owner 拍板"启用 LFS 缓存"的承载 task。落地后**主 agent 不等 owner 触发**，直接派 general-purpose subagent A 独立核查本任务全部交付物。

**核验人**：subagent A（general-purpose，只读核查）
**时间**：2026-08-21
**范围**：T06 全部交付物（D18 决策 + setup-bun action.yml 改动 + ci-infra.md 登记 + 任务表同步 + 流量实测）
**依据**：[05-process.md §3.1 gate review 第 5 步 subagent 文档核验](../05-process.md) + [附录 A subagent 文档核验 prompt 模板](../05-process.md) + [T06-plan.md §3 验收标准](T06-plan.md)

## 2. 逐条核验

| # | 声明 | 结果 | 证据命令 | 实测值 |
|---|---|---|---|---|
| 1 | `setup-bun/action.yml` 含 `actions/cache@v6` 步骤 | （待 subagent 验证） | `grep -A 5 "actions/cache" .github/actions/setup-bun/action.yml` | 期望含 path + key |
| 2 | cache path 为 `.git/lfs/objects` | （待） | `grep "path:" .github/actions/setup-bun/action.yml` | 期望 = `.git/lfs/objects` |
| 3 | cache key 形如 `lfs-${{ runner.os }}-${{ hashFiles('.gitattributes') }}` | （待） | `grep "key:" .github/actions/setup-bun/action.yml` | 期望含 lfs/os/gitattributes |
| 4 | `git lfs install --force` + `git lfs pull` 保留 | （待） | `grep "git lfs" .github/actions/setup-bun/action.yml` | 期望两条命令 |
| 5 | `records/topics/ci-infra.md` 含 D18 条目 | （待） | `grep "^## D18" docs/rebuild/records/topics/ci-infra.md` | 期望 = 1 |
| 6 | `tracker.md §2` 含 T06 行（plan/self-check/verify 三列） | （待） | `grep "T06" docs/rebuild/tracker.md` | 期望 ≥ 1 |
| 7 | `tasks/_index.md` 含 T06 行 | （待） | `grep "T06" docs/rebuild/tasks/_index.md` | 期望 ≥ 1 |
| 8 | `records/narrative/ci-infra.md` 含本次修订登记 | （待） | `grep "T06\|D18" docs/rebuild/records/narrative/ci-infra.md` | 期望 ≥ 1 |
| 9 | commit 存在 | （待） | `git log --oneline -3 \| grep "T06"` | 期望 ≥ 1 |
| 10 | 第一次 push CI 全绿（cache 未命中 baseline） | （待） | `gh run list --repo=another-momo/open-pencil --limit=2` | 期望最近 2 个 CI 全绿 |
| 11 | 第二次 push CI 全绿（cache 命中） | （待） | 同上 | 期望全绿 |
| 12 | check-tasks 对 T06 commit 实跑 | （待） | `bun tools/zone-registry/src/check/tasks.ts` | 期望 task T06 三件套齐全 |

## 3. 总评（待 subagent 填）

- 通过：（待 subagent 填）
- 失败：（待 subagent 填）
- 无法验证：（待 subagent 填）

## 4. 综合判定（待 subagent 填）

- ✅ T06 全部交付物通过核验
- ❌ T06 部分交付物不通过，需要修正：[清单]

## 5. 补充（核验后）

（待 subagent A 实际核验后由主 agent 追加实测值与结论）

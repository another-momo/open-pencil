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
> **核验时间**：2026-08-21（T09 回填——本文件此前为占位模板，T09 review 发现后由主 agent 派 subagent A 实做核验并回填）

## 1. 核验背景

T06 是 owner 拍板"启用 LFS 缓存"的承载 task。本核验为 **T09 回填核验**：本文件此前是占位模板（占位标记形如「待 subagent 填」，违反 [05-process.md §4.11](../05-process.md) 禁止占位条款），T09 派 subagent A 实做核验，以下为真实测值。

**核验人**：subagent A（general-purpose，只读核查）
**时间**：2026-08-21
**范围**：T06 全部交付物（D18 决策 + setup-bun action.yml 改动 + ci-infra.md 登记 + 任务表同步）
**依据**：[05-process.md §3.1 gate review 第 6 步 subagent 文档核验](../05-process.md) + [附录 A subagent 文档核验 prompt 模板](../05-process.md) + [T06-plan.md §3 验收标准](T06-plan.md)

## 2. 逐条核验

| # | 声明 | 结果 | 证据命令 | 实测值 |
|---|---|---|---|---|
| 1 | `setup-bun/action.yml` 含 `actions/cache@v6` 步骤 | ✅ | `grep -n "actions/cache" .github/actions/setup-bun/action.yml` | 行 20 `uses: actions/cache@v6`（行 36 另有 bun cache，与 LFS 无关） |
| 2 | cache path 为 `.git/lfs/objects` | ✅ | 同上 | 行 22 `path: .git/lfs/objects` |
| 3 | cache key 形如 `lfs-${{ runner.os }}-${{ hashFiles('.gitattributes') }}` | ✅ | `grep -n "lfs-"` | 行 23 key + 行 24 `restore-keys: lfs-${{ runner.os }}-` |
| 4 | `git lfs install --force` + `git lfs pull` 保留 | ✅ | `grep -n "lfs install\|lfs pull"` | 行 30 / 行 31 |
| 5 | `records/topics/ci-infra.md` 含 D18 条目 | ✅ | `grep -n "D18\|T06" docs/rebuild/records/topics/ci-infra.md` | 行 86 `## D18 · LFS cache 启用…`；行 113 T06 同步登记 |
| 6 | `tracker.md §2` 含 T06 行（三列路径） | ✅ | `grep "T06" docs/rebuild/tracker.md` | T06 行在（三件套路径齐全） |
| 7 | `tasks/_index.md` 含 T06 行 | ✅ | `grep "T06" docs/rebuild/tasks/_index.md` | T06 行在 |
| 8 | `records/narrative/ci-infra.md` 含本次修订登记 | ⚠️ 不适用 | `test -e docs/rebuild/records/narrative/ci-infra.md` | 文件**不存在**——T07 已撤回（横向档案不需要 narrative 绑定，[05-process.md §4.10](../05-process.md) 误区 2）；登记内容并入 topics/ci-infra.md（第 5 条已验） |
| 9 | commit 存在 | ✅ | `git log --oneline --all \| grep "T06"` | `0ac548e6 task: T06 LFS cache 启用…` |
| 10 | T06 commit 的 CI 全绿 | ✅（口径见实测值） | `gh run view 32440640994 --json conclusion,jobs` | conclusion=success，11/11 job success。**但**该 run 不含 check:zones/docs/bindings/tasks 四检查（当时未接线，T09 已接线） |
| 11 | 后续 push CI 全绿（cache 命中路径） | ✅ | `gh run list --repo=another-momo/open-pencil` | 2a48827f → run 32441201362 success；7d013794 → run 32442051383 success。流量实测（~1GB→~7MB）为 D18 登记值，本次未独立复测流量 |
| 12 | check-tasks 对 T06 commit 实跑 | ✅ | `bun tools/zone-registry/src/check/tasks.ts --base 0ac548e6^`（T09 环境复跑） | task T06 三件套齐全（注意：T06 当时 verify 为占位；占位检测为 T09 新增，不追溯） |

## 3. 总评

- 通过：11
- 失败：0
- 无法验证 / 不适用：1（#8 因 T07 撤回而不适用）

## 4. 综合判定

- ✅ **T06 全部交付物通过核验**（2026-08-21 subagent A 实做回填）
- 附带确认一个已修复缺陷：T06 commit 时 `zones.json` 未登记 setup-bun/action.yml 补丁（`git show 0ac548e6:tools/zone-registry/zones.json | grep -c "setup-bun"` = 0）——committed HEAD 上同样未登记，由 T09 P31 补登修复

## 5. 补充（核验后）

- 本次为回填核验：原文件为占位模板（含 18 处占位标记），由 T09 统一替换为 subagent A 实测值。
- T06/T07/T08 三 task 的 verify 占位问题是 T09 的核心发现之一，已登记 [records/topics/docs-governance.md](../records/topics/docs-governance.md) ROT 条目 + D19（占位检测机制化）。

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
**依据**：[05-process.md §3.1 gate review 第 6 步 subagent 文档核验](../05-process.md)（原写第 5 步，T09 核验轮修正）+ [附录 A subagent 文档核验 prompt 模板](../05-process.md) + [T05-plan.md §3 验收标准](T05-plan.md)

## 2. 逐条核验

| # | 声明 | 结果 | 证据命令 | 实测值 |
|---|---|---|---|---|
| 1 | `proposals/governance-v1.md` 存在 + 头部有元信息 | ✅ | `ls docs/rebuild/proposals/governance-v1.md && head -20 ...` | 文件存在；头部含 HTML 注释写作纪律块 + 状态/时间/作者/来源/身份/采纳映射/D10–D15 + 承载 task T01–T04 全套元信息 |
| 2 | 所有旧路径被替换为新路径 | ✅ | `grep -rln "rebuild-docs-governance-proposal" docs/` | 5 处命中全是历史/审计性提及；活引用（T01-plan.md ×2 + docs-governance.md ×2）已全部走新路径 |
| 3 | `narrative/proposals/governance-v1.md` 对应 record 存在 | ✅ | `ls docs/rebuild/records/narrative/proposals/governance-v1.md` | 文件存在 |
| 4 | 05 §2 树状图含 `proposals/` + `tasks/` + `records/{narrative,topics}/` | ✅ | `awk '/^## 2\./,/^## 3\./' docs/rebuild/05-process.md \| grep -nE "proposals/\|tasks/\|narrative/\|topics/"` | 7 处命中 |
| 5 | `docs-governance.md` 含 D16 候选条目 | ✅ | `grep "^## D16" docs/rebuild/records/topics/docs-governance.md` | line 320：「## D16 · dsh 集成形态 vs 03-phase-1-runtime.md 决策状态不一致（候选 · 待 owner 拍板）」 |
| 6 | D16 含「不自行拍板 D9」声明 | ✅ | `awk '/^## D16/,/^## D17/' docs/rebuild/records/topics/docs-governance.md \| grep -E "不自行\|D9"` | 6+ 命中，关键行："**主 agent 立场**：**不自行拍板 D9**" |
| 7 | T05 三件套存在 | ✅ | `ls docs/rebuild/tasks/T05-*.md` | T05-plan.md / T05-self-check.md / T05-verify.md 三文件齐全 |
| 8 | `tracker.md §2` 含 T05 行 | ✅ | `grep "T05" docs/rebuild/tracker.md` | line 37：T05 完整行 |
| 9 | `tasks/_index.md` 含 T05 行 | ✅ | `grep "T05" docs/rebuild/tasks/_index.md` | line 37：T05 完整行 |
| 10 | `narrative/05-process.md` 含 v6 修正条目 | ✅ | `grep -E "v6\|T05" docs/rebuild/records/narrative/05-process.md` | line 106：「修正-N · 05-process.md v6（T05 整改）」 |
| 11 | `narrative/tracker.md` 含 T05 同步登记 | ✅ | `grep "T05" docs/rebuild/records/narrative/tracker.md` | line 97：「修正-N · tracker.md §2 任务表加 T05 行（T05 收尾）」 |
| 12 | `docs-governance.md` 含 D17 条目 | ✅ | `grep "^## D17" docs/rebuild/records/topics/docs-governance.md` | line 336：「## D17 · 禁止本机绝对路径入库」 |
| 13 | 全仓库无本机绝对路径 | ✅ | `grep -rn "D:\\\\\|D:/\|C:\\\\Users\|C:/Users" docs/` | 0 命中（exit 0，无 stdout） |
| 14 | `narrative/spikes/03-weshop-case-deep-dive.zh.md` 同步登记 D17 修正 | ✅ | `grep -E "D17\|本机绝对路径" docs/rebuild/records/narrative/spikes/03-weshop-case-deep-dive.zh.md` | line 29 修正条目 + line 33 引用 D17 |
| 15 | commit `9ecda65e` 存在（T05 主体） | ✅ | `git log --oneline -5 \| grep "9ecda65e"` | `9ecda65e task: T05 00-05 系统性腐烂 review（...）` |
| 16 | commit `8323475d` 存在（T05 收尾 D17 清理） | ✅ | `git log --oneline -1 \| grep "8323475d"` | `8323475d task: T05 收尾——全仓库清除本机绝对路径（D17 owner 反馈）` |
| 17 | CI run `32438539671` (T05 commit) 通过 | ✅ | `gh run view 32438539671 --repo=another-momo/open-pencil --json conclusion` | `{"conclusion":"success"}` |
| 18 | CI run `32439113885` (T05 收尾 commit) 通过 | ✅ | `gh run view 32439113885 --repo=another-momo/open-pencil --json conclusion` | `{"conclusion":"success"}` |
| 19 | check-tasks 对 T05 commit 实跑 | ✅ | `bun tools/zone-registry/src/check/tasks.ts --base 9ecda65e~1 \| tail -20` | `check-tasks: 大改动（R1 文件数 14 >= 10 / R2 变更行数 836 >= 200 / R3 / R4），task T05 三件套齐全` |

## 3. 总评

- 通过：19 条
- 失败：0 条
- 无法验证：0 条

## 4. 综合判定

- ✅ **T05 全部交付物通过核验**（19/19 通过，0 失败）
- ✅ commits `9ecda65e` + `8323475d` 落地 + CI `32438539671` + `32439113885` 双 success
- ✅ D16 + D17 决策登记完整；本机绝对路径全清

## 5. 补充（核验后）

### 5.1 关于 #2 的备注（实质通过）

`grep "rebuild-docs-governance-proposal"` 仍有 5 处命中，但全部属于"腐烂点修复后的历史/审计性提及"——narrative/proposals/governance-v1.md、narrative/05-process.md、T05-plan.md、T05-self-check.md、T05-verify.md。活引用（T01-plan.md ×2 + docs-governance.md ×2）已全部走 `proposals/governance-v1.md` 新路径。这正是"腐烂点已修"的预期状态。

### 5.2 主 agent 立即修正（核验后）

subagent 报告全绿后，主 agent 立即把 T05-verify.md 占位替换为实测值——不允许"verify.md 是占位模板"（D15 §4.11 主 agent 自律条款）。

### 5.3 D17 决策影响

- 5 处本机绝对路径全清（narrative/proposals ×1 + narrative/05-process ×1 + T05-plan ×2 + spike 03 ×1）
- D17 候选等 owner 评估是否启用 `check-docs.ts` R6 检测（grep `D:\\|C:\\`）——本任务不擅自启用

### 5.4 T09 核验轮清理（2026-08-21）

- §2 实测表（19/19 ✅）下方残留了原占位模板的 14 行骨架（§5.2 粘贴实测值时未删模板行），T09 核验轮自查（repo-wide 占位探针）发现后已删除
- 依据行步骤号「第 5 步」→「第 6 步」（与现行 [05-process.md §3.1](../05-process.md) 一致）
- 登记：[records/topics/docs-governance.md](../records/topics/docs-governance.md) ROT-22

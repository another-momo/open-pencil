<!--
  写作纪律（改本文前必读）：
  - 事实性声明必须附核验命令 + 日期，否则标为【假设】
  - 计划被实测推翻时，直接改本文为新版本，完整理由记入 records/ 子文档
  - 本文只保留当前态，不保留修正历史
  - 改完后刷新本文头部的「状态」字段
  - 详细规则见 docs/rebuild/05-process.md §4
-->

# tasks/T09-self-check.md · T09 自检报告

> **T 编号**：T09（文档治理 + CI 基建 · review 发现核实与修复）
> **自检时间**：2026-08-21

## 1. 主 agent 任务清单对照（针对 [T09-plan.md §2](T09-plan.md)）

### A 组 · 核实（全部复核属实，证据随附）

| # | 发现 | 复核结论 | 关键证据（2026-08-21） |
|---|---|---|---|
| A1 | 四检查从未接线 CI | ✅ 属实 | `grep -rn "check:zones\|check:docs\|check:bindings\|check:tasks" .github/` 零命中；`git log --all -S "check:zones" -- .github/` 空 |
| A2 | pre-commit 未安装且不含 check:zones | ✅ 属实 | `git config core.hooksPath` 空（T09 前）；hook 原脚本只跑三 doc check 且仅 docs 改动触发 |
| A3 | zone check HEAD 3 处违规 | ✅ 属实 | 实跑输出：setup-bun/action.yml 未登记 + tools/hooks/ 两文件不在 ownedRoots |
| A4 | T06/T07/T08 verify 占位 | ✅ 属实 | `grep -c "（待"`：T06=18、T07=19、T08=19（T08 后由并行会话 7d013794 回填为实测值） |
| A5 | T08 hash 张冠李戴 | ✅ 属实 | `git show -s 0ac548e6` = T06 commit；T07 = 5698019a |
| A6 | X 工作量 15.5 vs 37-38 | ✅ 属实 | spike 04 全文仅 4.5 人日（`grep 人日`）；records 修正-1/SP-3 与 01 §8 均 ≈37-38 |
| A7 | 推荐方向矛盾 | ✅ 属实 | 03 §5.1「A 推荐」vs agent-runtime.md D9「c 推 1」 |
| A8 | weshop pi.ts 引用悬空 | ✅ 属实 | 文件不存在；weshop 全仓无 .ts；`git log --all -- src/integrations/pi.ts` 空 |
| A9 | pi 路径标签错误 | ✅ 属实 | 实为 `packages/coding-agent/src/core/session-manager.ts:1530`（行号命中） |
| A10 | tracker 缺 T08 行 + T07 状态列「—」 | ✅ 属实 | T08 落地时只加镜像（7d013794 补真源行但缺状态 cell，7 cell vs 8 列） |
| A11 | 05 §3.2 与 §4.11 矛盾 | ✅ 属实 | 「单个文档」「自检-N 章节」「[BIG]」残留（[BIG] 已于 cdf81eb4 从 checker 删除） |
| A12 | 脚本旧路径引用 | ✅ 属实 | 05 §3.1/§3.2 与 README 的 check-docs.ts 等，脚本已在 check/ 子目录 |
| A13 | tracker「≤50 行」 vs 69 行 | ✅ 属实 | `wc -l` = 69 |
| A14 | 05 §2 树状图腐烂 | ✅ 属实 | tasks 只列 T00-T04；`narrative/tasks/` 与 `archive/` 磁盘不存在（ls 实测） |
| A15 | _index §2「records 各文件」矛盾 | ✅ 属实 | 与 §4.10 横向档案豁免及 bindings.ts 口径（records/** 不绑定）均冲突 |
| A16 | 「逐块 PR」边界未显式化 | ✅ 属实 | 04 §4 与 05 §3.2/§4.11/附录 B.1 残留 PR 表述 |
| A17 | gate 步骤号引用混乱 | ✅ 属实（追加发现） | README「第 4 步」/ T08-verify「第 5 步」/ 05 §3.1 实际第 6 步 |

### B 组 · 机制修复

- [x] B1 zones.json：ownedRoots += `tools/hooks/`；P31（setup-bun LFS cache 补登）+ P32（ci.yml rebuild-discipline job）——`bun tools/zone-registry/src/check.ts` 实测 clean（29 modified all registered / 84 added owned / 951 deleted，2026-08-21 核验轮复测）
- [x] B2 ci.yml `rebuild-discipline` job：四检查接线 + upstream fetch（merge-base）+ push 区间 base 解析 + 免 bun install
- [x] B3 pre-commit：每次 commit 跑 check:zones；doc 三检查按 docs 改动触发
- [x] B4 check/tasks.ts 占位检测（D19）：正反探针实测——T06/T07 占位文件命中（占位词「待 subagent」样式），T08 实填文件不误伤
- [x] B5 `bun run hooks:install` 已执行（`git config core.hooksPath` = tools/hooks 实测）

### C 组 · 文档腐烂修正

- [x] C1 tracker.md：T07/T08 行补状态 cell + T09 行 + ≤80 行 + §3.1 计数 13
- [x] C2 05-process.md：§3.2 按 D15 重写、§3.1 脚本路径与步骤号、§2 树状图、PR 残留清除
- [x] C3 README.md：gate 第 6 步 + CI 声称准确化
- [x] C4 records/_index.md §2：绑定范围与 bindings.ts 口径对齐
- [x] C5 03：15.5→37-38、weshop 悬空引用替换、pi 路径标签、§5.2 实采数据填入、推荐不一致显式标注
- [x] C6 02 §5 #2「CI 已接线」证伪注记
- [x] C7 T08-plan/self-check hash 修正（0ac548e6→5698019a）
- [x] C8 04 §4 PR → commit 载体对齐

### D 组 · 核验实做

- [x] D1 T06/T07 verify.md 回填（subagent A 实做：T06 11 通过 + 1 不适用；T07 12 通过 + 1 警告；证据命令 + 实测值齐全）
- [x] D2 本自检
- [x] D3 T09 subagent 核验 → [T09-verify.md](T09-verify.md)（一轮 14✅/1❌/3⚠️ + N1-N5 新发现全部修复 + 二轮复测通过；远端 CI 项待 push 后补登）

### E 组 · 记录登记

- [x] E1 docs-governance.md：ROT-15~21 + D19 + 治理冻结期提案
- [x] E2 ci-infra.md：CI-6（接线 + 证伪 + 历史影响评估）
- [x] E3 agent-runtime.md：SP-5（数据实采）+ 修正-3（数字对齐 + 推荐不一致登记）
- [x] E4 narrative 绑定 ×6（02/03/04/05/README/tracker）

### F 组 · owner 决策备料

- [x] F1 D9 拍板材料：工作量数字单一口径（X 37-38 / pi 20）+ SP-5 外部数据 + 推荐不一致显式化
- [x] F2 治理冻结期提案已登记（docs-governance.md 末尾，待 owner 拍板）

## 2. 承诺 vs 落地对照

| 原方案承诺 | 实际落地 | 偏差 |
|---|---|---|
| A 组 17 项逐条核实 | ✅ 17/17 属实（含追加 A17） | 无 |
| B 组 5 项机制修复 | ✅ 5/5 | 无 |
| C 组 8 项文档修正 | ✅ 8/8 | 无 |
| D 组核验实做 | D1/D2/D3 ✅（D3 一轮核验产出 N1-N5，修复后二轮复测通过） | 远端 CI 项待 push 后补登 |
| E 组 4 项记录登记 | ✅ 4/4 | 无 |
| F 组 2 项备料 | ✅ 2/2 | 无 |
| 本地 check 全绿 | zones/docs/bindings/tasks 四绿（实测输出见上） | 无 |
| 远端 CI 绿（含新 job） | 待 push 后实测 | 假设项，见 T09-verify |

## 3. 完成度自评

- 完全落地 36 条（100%，本地口径）
- 部分落地 0 条
- 完全未做 0 条
- 待 push 补登 1 项：远端 CI 实测（含新 rebuild-discipline job 首跑）

## 4. 自评要点

1. **本次核验全部实做**：T06/T07 回填与 T09 核验均由 subagent 独立产出实测值，无占位——正是 ROT-16 的对治
2. **并行会话冲突处理**：T09 执行期间并行会话提交了 7d013794（T08 收尾），T09 范围随之调整（T08 verify 回填项移出、tracker 行修正项扩展）
3. **附带产物**：`tools/hooks/` 下 4 个 git-lfs shim（post-checkout/post-commit/post-merge/pre-push）由 git-lfs 在 hooksPath 切换后自动生成，随本 commit 一并入库（hooks:install 后团队成员自动获得 LFS 钩子）
4. **未越权**：D9 推荐方向只标注不一致、未改写推荐本身；治理冻结期仅登记提案

## 5. 决策影响

- D19（占位检测 + CI 接线）已登记；ROT-15~21 已登记
- 后续 task（T10+）：commit 引用 task 时占位 verify 将被 CI 拒收；「已自动化」类声称须有 workflow 佐证

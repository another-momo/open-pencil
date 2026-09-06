<!--
  写作纪律（改本文前必读）：
  - 事实性声明必须附核验命令 + 日期，否则标为【假设】
  - 计划被实测推翻时，直接改本文为新版本，完整理由记入 records/ 子文档
  - 本文只保留当前态，不保留修正历史
  - 改完后刷新本文头部的「状态」字段
  - 详细规则见 docs/rebuild/05-process.md §4
-->

# tasks/T09-verify.md · T09 subagent 核验报告

> **T 编号**：T09（文档治理 + CI 基建 · review 发现核实与修复）
> **核验时间**：2026-08-21（一轮 subagent A 独立核验 → N1-N5 修复 → 二轮主 agent 复验）

## 1. 核验背景

T09 是 owner 要求「核实 review 发现的所有问题、并逐一分析优化」的承载 task。主 agent 完成 A-F 组后，派 general-purpose subagent A 只读独立核验全部交付物。

**核验人**：subagent A（general-purpose，只读核查，一轮）；主 agent（二轮复验，仅机械重跑探针与四检查）
**时间**：2026-08-21
**范围**：T09 全部交付物（zones.json / ci.yml / pre-commit / 占位检测 / 文档修正 / T06/T07 回填 / records 登记 / 四检查实跑）
**依据**：[05-process.md §3.1 gate review 第 6 步 subagent 文档核验](../05-process.md) + [附录 A subagent 文档核验 prompt 模板](../05-process.md) + [T09-plan.md §3 验收标准](T09-plan.md)

## 2. 一轮逐条核验（subagent A 实测，18 项）

| # | 声明 | 结果 | 实测值（2026-08-21） |
|---|---|---|---|
| 1 | zone check 0 违规 | ✅ | `[zones] clean: 29 modified (all registered), 84 added (owned), 951 deleted (all registered), base 0332b062` |
| 2 | zones.json 含 tools/hooks/ + P31/P32 | ✅ | ownedRoots L6；P31 L211-214（setup-bun action.yml）；P32 L217-220（ci.yml），reason 注明 T09 补登 |
| 3 | ci.yml rebuild-discipline job 四检查 + upstream | ✅ | job L101；`git remote add upstream` L115；check:zones L119；check:docs L122；check/bindings.ts L130；check/tasks.ts L131 |
| 4 | pre-commit 每次 commit 跑 check:zones + hooksPath | ✅ | `bun run check:zones` 在 L29（docs 条件分支之外）；`git config core.hooksPath` = tools/hooks |
| 5 | PLACEHOLDER_RE 存在 + 历史命中 + 工作区不误伤 | ⚠️ | RE 在 tasks.ts L245；历史 T07 命中 ✅；**但工作区 T06/T07 verify 注记命中裸正则**（对旧占位词的字面引述）→ N1 类问题，见 §5 |
| 6 | T06/T07/T08 verify `grep -c "（待"` 全 0 + 含实测值 | ❌（字面） | T06=2、T07=2、T08=0——4 处命中全为回填注记对旧占位词的字面引述；实测值子项 ✅（run 号/行号/commit 齐全）→ 见 §5 N1 |
| 7 | tracker 含 T08/T09 行；行 8 cell；T07/T08 状态 ✅ | ✅ | T08 L42 / T09 L43；T00-T09 全部行 NF=10（8 逻辑列）与表头一致 |
| 8 | 05 §3.2 无「单个文档」/「[BIG]」；§3.1 新路径；列描述无 PR；§2 树 | ✅（附小残留） | §3.2 区间干净；§3.1 步骤 3/4/5 均为 check/ 子目录形式；残留：附录 B.5 表 L257-259 裸名 `check-tasks.ts` → 见 §5 N4 |
| 9 | 03 无 15.5 活数字；§5.2 三数字+日期；§5.1 不一致标注 | ⚠️ | 15.5 唯一命中在 L66 修正注记（引用旧值，非活数字）；37-38 在 L66/L131；175,615 / 648,007 / 1,904,277 + 2026-08-21 齐全；weshop pi.ts 与 packages/session/ 各 1 处均在「原引用已撤」注记语境 → 验收口径修订见 §5 N3 |
| 10 | 02 §5 #2 证伪注记 + CI-6 指针 | ✅ | L84「验收时『CI 已接线 check:zones』的声称**不实**……见 records/topics/ci-infra.md CI-6」 |
| 11 | T08 两文件 T07 commit = 5698019a | ✅ | T08-plan L28、T08-self-check L54；0ac548e6 仅在「原误写」注记中出现 |
| 12 | 04 §4 不含「逐块 PR」 | ✅ | §4 内 L49「逐块 commit」+「不采用 PR 管理（T08 决策）」 |
| 13 | docs-governance ROT-15~21 + D19 + 冻结期提案 | ✅ | ROT-15~21 逐条在案（L355-397）；D19 L403；冻结期提案 L414 |
| 14 | ci-infra CI-6；agent-runtime SP-5 + 修正-3 | ✅ | CI-6 = ci-infra.md L122；SP-5 = agent-runtime.md L101；修正-3 = L112 |
| 15 | narrative 六文件各含 T09 登记 | ✅ | 02=3 / 03=2 / 04=2 / 05=3 / README=3 / tracker=3 处 T09 提及，抽样为正式修正条目 |
| 16 | _index §2 豁免表述 + 无「records 各文件」 | ✅ | L30 准确枚举绑定范围；旧矛盾表述零命中 |
| 17 | 四检查工作区实跑全绿 | ✅ | zones clean；docs 36/36；bindings 31 文件全绿；tasks 三件套齐全（exit 全 0） |
| 18 | T09-plan §3 九条验收 | ⚠️ | 5✅/2❌字面/2⚠️——❌与⚠️全部由 N1/N2/N3/N4 解释，修复与口径修订见 §5；③⑨ 远端 CI 待 push 后补登 |

## 3. 一轮总评

- 通过：14
- 失败：1（#6 字面口径——注记引述旧占位词）
- 警告：3（#5 同类字面命中；#9 注记引用旧值；#18 含 push 后才能验的项）

## 4. 新发现问题（一轮核验产出）与处置

| # | 发现 | 级别 | 处置（2026-08-21 已完成） |
|---|---|---|---|
| N1 | T09-self-check L44 与 T06/T07 verify 注记字面引述占位词，命中 D19 占位检测正则——T09 commit 会被自己的占位检测拒收（自伤） | **commit 级阻塞** | 三处注记改写为角括号「待 subagent 填」样式（不触发 `（待` 字面）；T09-plan §1.1/B4 两处同类引述同步改写 |
| N2 | 步骤号修正不完整：README L29 表格行「第 4 步」、05 §4.10「第 4 步」、T08-verify「第 5 步」残留（一轮只改了 README 正文） | 文档腐烂 | 全部统一为第 6 步（T08-verify 附修正注记）；主 agent 复查时又发现 T05-verify 同类残留，一并修正 |
| N3 | 验收口径 vs 注记风格冲突：§3 要求「（待 / 15.5 零命中」，但修正注记引用旧值导致字面不可测 | 验收口径 | 注记改写后 `grep "（待"` 已字面零命中；T09-plan §3 补「验收口径修订」——15.5 按活数字口径（注记引用除外） |
| N4 | 轻微漂移：T09-self-check zone 计数 83→84；05 §3.3 `check-docs.ts` 与附录 B.5 表 `check-tasks.ts` ×3 裸名残留 | 文档腐烂 | 计数改 84（复测值）；§3.3 改 `check:docs`；B.5 三行改全路径并补「占位检测 D19」 |
| N5 | **T05-verify.md 占位骨架残留**（主 agent repo-wide 探针复查新发现）：§2 实测表 19/19 ✅ 下方残留原占位模板 14 行骨架 | 文档腐烂 | 骨架行已删除（T05-verify.md §5.4 注记）；ROT-16 占位实例计数 3→4 |

登记：[records/topics/docs-governance.md](../records/topics/docs-governance.md) ROT-22；narrative 绑定（README/05）同 commit 追记。

## 5. 二轮复验（主 agent 机械重跑，2026-08-21）

针对一轮 ❌/⚠️ 项的修复后复测：

| 项 | 命令 | 实测值 |
|---|---|---|
| 占位探针（D19 正则） | `grep -rnP '（待[)）]\|（待\s*subagent\|待\s*owner\s*触发' docs/rebuild/tasks/T05*.md T06*.md T07*.md T08*.md T09*.md` | T05/T06/T07/T08/T09 的 self-check/verify **全 0 命中**（剩余命中均在 records/05-process/T04 历史文件的合法引述语境，且不在检测扫描面内——检测只扫 commit 引用 task 的 self-check/verify，见 tasks.ts L247-268） |
| `grep -c "（待"` T06/T07/T08 verify | 字面验收口径 | 0 / 0 / 0 |
| 步骤号 | `grep -n "第 4 步\|第 5 步" README.md 05-process.md tasks/T0*-verify.md` | 零命中（全部第 6 步） |
| 15.5 | `grep -c "15\.5" 03-phase-1-runtime.md` | 1（仅 L66 修正注记引用旧值，按修订口径豁免） |

## 6. 综合判定

- ✅ **一轮 14/18 通过；唯一 ❌ 与 3 个 ⚠️ 的可修复部分（N1/N2/N4/N5）已全部修复并复测通过；N3 以验收口径修订闭环**
- ✅ **远端 CI 补登（2026-08-21，push 后实测）**：commit `75f2759f` → run `32447539784` **conclusion=success，12/12 job 全绿**，含新 `Rebuild discipline` job 首跑成功（`gh run view 32447539784 --json conclusion,jobs`）——验收 ③⑨ 达成，T09 机制接线在远端真实生效
- subagent A 附注：全程只读，未修改仓库任何文件（探针脚本写在系统临时目录）

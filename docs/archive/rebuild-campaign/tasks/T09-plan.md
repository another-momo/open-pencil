<!--
  写作纪律（改本文前必读）：
  - 事实性声明必须附核验命令 + 日期，否则标为【假设】
  - 计划被实测推翻时，直接改本文为新版本，完整理由记入 records/ 子文档
  - 本文只保留当前态，不保留修正历史
  - 改完后刷新本文头部的「状态」字段
  - 详细规则见 docs/rebuild/05-process.md §4
-->

# tasks/T09-plan.md · T09 任务计划

> **T 编号**：T09（文档治理 + CI 基建 · owner review 发现的系统性问题核实与修复）
> **三件套**：
> - 计划：[T09-plan.md](T09-plan.md)（本文件）
> - 自检：[T09-self-check.md](T09-self-check.md)
> - 核验：[T09-verify.md](T09-verify.md)

## 1. 任务概述

### 1.1 背景与目标

2026-08-21 owner 要求对重建文档集做整体 review。主 agent 复核后发现 16 项问题，其中两项击穿 gate 可信度：

1. **「CI 已接线」声明不实**：`check:zones` / `check:docs` / `check:bindings` / `check:tasks` 四个纪律检查从未出现在任何 workflow（`grep -rn "check:zones" .github/` 零命中；`git log --all -S "check:zones" -- .github/` 空，2026-08-21 实测）。pre-commit hook 本机未安装（`git config core.hooksPath` 空），且 hook 脚本不跑 check:zones。
2. **zone check 在 HEAD 上有 3 处违规未被拦截**（2026-08-21 实跑）：`.github/actions/setup-bun/action.yml` 修改未登记补丁（T06 LFS cache）、`tools/hooks/` 两文件不在 ownedRoots。
3. **T06/T07/T08 三份 verify.md 全是占位模板**（占位词「待 subagent 填」样式），而对应 self-check 均声称「subagent 核验-1 ✅ 已做」——`05-process.md §4.11` 明文禁止的占位核验，existsSync 机制查不出。

本 task 目标：**逐条核实 review 发现 → 修复机制层漏洞 → 修正文档腐烂 → 实做回填三份核验 → 备齐 D9 拍板材料**。

### 1.2 范围

- A 组：16 项发现逐条复核（证据命令 + 实测值）
- B 组 机制修复：zones.json 补登、ci.yml 接线 rebuild-discipline job、pre-commit 加 check:zones、check-tasks.ts 占位检测、本机 hooks:install
- C 组 文档腐烂修正：tracker / 05 / README / records\_index / 03 / 02 / 04 / T08 两文件
- D 组 核验实做：T06/T07/T08 verify.md 回填（subagent 独立核验）+ T09 自身三件套
- E 组 记录登记：docs-governance ROT + D19、ci-infra CI-6、agent-runtime SP-5、narrative 绑定更新
- F 组 owner 决策备料：D9 拍板材料（含 03 §5.2 前置数据实采）、治理冻结期提案登记

### 1.3 不在范围

- **D9 runtime 选型拍板**（owner 专属；本 task 只对齐数字与证据、登记不一致）
- **03 §5.1 推荐方向的改写**（与 D9 绑定；只做显式标注不一致，不替 owner 选边）
- Phase 1 spike 代码（S-X / S-pi 验证清单）
- 治理冻结期是否启用（登记为提案，owner 拍板）

### 1.4 关联文档

- 触发：owner「立一个新的task，核实你发现的所有问题、并逐一分析优化」（2026-08-21）
- 过程定义：[05-process.md §3.2 + §4.10 + §4.11 + 附录 B](../05-process.md)
- 决策登记：[records/topics/docs-governance.md](../records/topics/docs-governance.md)（D10-D17）、[records/topics/agent-runtime.md](../records/topics/agent-runtime.md)（D9、D16 相关）
- review 原始发现：主 agent 2026-08-21 review 报告（会话内，要点已登记进本计划 §2）

## 2. 任务清单

### A 组 · 核实（逐条留证据）

- [ ] A1 「CI 已接线」声明证伪（grep .github/ + git log -S）
- [ ] A2 pre-commit 未安装 + hook 不含 check:zones
- [ ] A3 zone check HEAD 3 处违规（实跑输出）
- [ ] A4 T06/T07/T08 verify.md 占位（grep「（待」）
- [ ] A5 T08-plan/self-check 引用错误 hash（0ac548e6 实为 T06 commit）
- [ ] A6 X 路线工作量 15.5 vs 37-38 矛盾（03 vs records/D9/修正-1 + 01 §8；spike 04 无 15.5）
- [ ] A7 推荐方向矛盾（03 §5.1「A 推荐」 vs D9「c 推 1」）
- [ ] A8 03 引用 `weshop-dsh-plugin/src/integrations/pi.ts:18` 悬空（文件不存在、全仓无 .ts、git 历史无）
- [ ] A9 03 引用 pi 路径标签错误（`packages/session/` → 实为 `packages/coding-agent/src/core/`）
- [ ] A10 tracker.md §2 缺 T08 行 + T07 状态列「—」非法值
- [ ] A11 05 §3.2 与 §4.11/附录 B 矛盾（单文档+章节+[BIG] 残留）
- [ ] A12 脚本旧路径引用（05 §3.1/§3.2、README 的 check-docs.ts 等，已迁 check/ 子目录）
- [ ] A13 tracker「≤50 行」声明 vs 实际 69 行
- [ ] A14 05 §2 树状图腐烂（tasks 只列 T00-T04、narrative/tasks/ 与 archive/ 磁盘不存在）
- [ ] A15 records/_index.md §2「records 各文件」与 §4.10 横向档案豁免矛盾
- [ ] A16 04 §4 / 05 §3.2「逐块 PR」与 T08「docs/rebuild 不采用 PR 管理」边界未显式化
- [ ] A17（追加发现）gate review 步骤号引用混乱：README 说「第 4 步 subagent 核验」、T08-verify 说「第 5 步」、05 §3.1 实际是第 6 步

### B 组 · 机制修复

- [ ] B1 zones.json：ownedRoots += `tools/hooks/`；P31 = `.github/actions/setup-bun/action.yml`（T06 LFS cache 补登）；P32 = `.github/workflows/ci.yml`（rebuild-discipline job）
- [ ] B2 ci.yml：新增 `rebuild-discipline` job（check:zones + check:docs + check:bindings + check:tasks；含 upstream remote fetch 供 merge-base；push 区间 diff 用 `github.event.before`）
- [ ] B3 pre-commit：触发面放宽到 `docs/rebuild/|tools/zone-registry/|.github/|tools/hooks/`，命中时加跑 check:zones
- [ ] B4 check-tasks.ts：self-check/verify 占位检测（空待办括号 /「待 subagent」前缀 /「待 owner…触发」句式 → 拒收），机器化 §4.11 禁止占位条款
- [ ] B5 本机执行 `bun run hooks:install`

### C 组 · 文档腐烂修正

- [ ] C1 tracker.md：补 T08 行 + T09 行；T07 状态列改 🔄；「≤50 行」声明改 ≤80 行（与现实对齐）
- [ ] C2 05-process.md：§3.2 大改动三件套段落按 D15 重写（删单文档/章节/[BIG] 残留）；§3.1 步骤 3-5 脚本路径修正（check/docs.ts 等）；§2 树状图修正（tasks 通用化、删 narrative/tasks/、archive/ 标注按需创建）；§3.1 步骤号与 README 对齐
- [ ] C3 README.md：「check-docs.ts 已挂 CI」改为准确表述（T09 接线后属实）
- [ ] C4 records/_index.md §2：绑定范围改为准确枚举（00-05/README/tracker/spikes/proposals 绑定；tasks/topics/\_index 不绑定）
- [ ] C5 03-phase-1-runtime.md：X 工作量 15.5 → 对齐 records 层 ≈37-38 人日（删无源引用）；weshop 悬空引用替换为 pi 源码证据；`packages/session/` 路径标签修正；§5.2 填入实采数据（2026-08-21：dsh 175,615 stars / 周下载 648,007；pi 周下载 1,904,277）；§5.1 推荐方向不一致显式标注（不改推荐本身）；§5.2 无效命令 `npm view weekly-downloads` 改为 npm downloads API
- [ ] C6 02-phase-0.md §5 #2「CI 已接线 check:zones」修正为真实状态（T09 接线后属实 + 历史声明证伪记录）
- [ ] C7 T08-plan.md §1.1 / T08-self-check.md §4：hash 0ac548e6 → 5698019a
- [ ] C8 04-porting-discipline.md §4「逐块 PR」对齐 T08 决策（commit + 任务表登记为载体）

### D 组 · 核验实做

- [ ] D1 派 subagent 对 T06/T07/T08 交付物独立核验 → 回填三份 verify.md（实测值，零占位）
- [ ] D2 T09 自检（承诺 vs 落地对照 + 完成度）
- [ ] D3 派 subagent 核验 T09 → 回填 T09-verify.md（实做，不占位）

### E 组 · 记录登记

- [ ] E1 docs-governance.md：ROT 条目组（CI 接线虚构 / verify 占位 ×3 / T08 hash / tracker 表 / 05 §3.2 残留 / 03 数字与引用 / 其余一致性打包）+ D19（占位检测机制化）
- [ ] E2 ci-infra.md：CI-6（rebuild-discipline job 接线 + 历史「已接线」证伪）
- [ ] E3 agent-runtime.md：SP-5（03 §5.2 前置数据实采，2026-08-21）+ 推荐方向不一致登记
- [ ] E4 narrative/ 绑定同步：narrative/02、03、05、README、tracker（§4.10 同 commit 纪律）

### F 组 · owner 决策备料（登记不动工）

- [ ] F1 D9 拍板材料：工作量数字对齐后 + SP-5 数据 + X/pi 双路线摘要
- [ ] F2 治理冻结期提案登记（Phase 1 期间只 ROT 登记、不新增治理机制）

## 3. 验收标准

- 【事实】`bun tools/zone-registry/src/check.ts` 0 违规（P31/P32 + ownedRoots 生效）
- 【事实】`bun run check:docs` / `check:bindings` / `check:tasks` 本地全绿
- 【事实】ci.yml 含 rebuild-discipline job；push 后远端该 job 绿（gh run 实测）
- 【事实】check-tasks.ts 占位检测探针：对含「（待」的 verify.md 拒收（exit 1）
- 【事实】T06/T07/T08 verify.md 无占位标记（`grep "（待" ` 零命中）且含 subagent 实测值
- 【事实】03 §5.2 三项数据填入并含日期；15.5 活数字消除（修正注记中对旧值的引用除外）
- 【事实】tracker.md §2 含 T08/T09 行；T07 状态列为合法值
- 【事实】05 §3.2 不再含「单个文档」/「[BIG]」表述；脚本路径全部为 check/ 子目录形式
- 【假设】远端 CI 全绿（含新 job，12/12）

> **验收口径修订**（2026-08-21，T09 核验轮 N3 发现后修订）：「占位零命中」与「15.5 消除」按**活占位/活数字**口径验收——修正注记中对旧值的引用（如「『15.5 人日』系 v3 误植」）不计命中；占位词在 T06/T07 verify 注记中已改写为不触发字面 grep 的形式（角括号「待 subagent 填」），故 `grep "（待"` 零命中仍可字面达成。

## 4. 关联文档

- 过程定义：[05-process.md](../05-process.md)
- 任务表真源：[tracker.md §2](../tracker.md)；镜像：[tasks/_index.md §2](_index.md)
- 记录落点：[records/topics/docs-governance.md](../records/topics/docs-governance.md) / [ci-infra.md](../records/topics/ci-infra.md) / [agent-runtime.md](../records/topics/agent-runtime.md)
- 前置 task：T06（LFS cache）、T07（§4.10 修正）、T08（PR 列删除）——本 task 回填其核验

## 5. 身份

本文件是 T09 的 task 计划（plan），按 [05-process.md §4.11 D15](../05-process.md) 三件套物理拆分纪律，自检与核验分别在 [T09-self-check.md](T09-self-check.md) / [T09-verify.md](T09-verify.md)。本文件不含自检数字与核验报告。

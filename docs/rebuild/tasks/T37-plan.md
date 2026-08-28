<!--
  写作纪律（改本文前必读）：
  - 事实性声明必须附核验命令 + 日期，否则标为【假设】
  - 计划被实测推翻时，直接改本文为新版本，完整理由记入 records/ 子文档
  - 本文只保留当前态，不保留修正历史
  - 改完后刷新本文头部的「状态」字段
  - 详细规则见 docs/rebuild/05-process.md §4
-->

# T37 计划 · 决策批次登记（D1/D4/D6/D8 闭环 + D34-D37 新登）

> **状态**：执行中 | **时间**：2026-08-28 | **负责人**：主 agent
> **分支**：`rebuild/t35-i18n-fork`（pi 线）
> **基线**：`abc5f1b5`（T36 收口后 HEAD）

## 1. 背景与立项

2026-08-28 owner 对 A 组待拍板清单分两批共拍板 8 项。按 05-process.md §1「owner = D 类决策唯一拍板人」与§4「【决策】必须附拍板人+日期+理由，登记进 records/ 对应对象子文档」，本任务把这 8 项登记入官方记录层，并同步 01-target-state.md §7 决策表状态。其中 D36（narrative 豁免）涉及 05-process.md 规则修订 + bindings.ts 机器口径配套，一并在本任务落地。

本任务命中 R3（01/05 叙事文档）+ R4（records 层），按 D11 产出三件套。

## 2. owner 拍板清单（2026-08-28，两批）

### 第一批：官方 §7 待拍板四项闭环

- **D1 参考图机制形态 → 已拍板**：不设专门参考图/参考区机制；需要参考时由用户指定画布节点作为 ref。影响：C2/C3 边界压力解除，C3a 生图工具的参考输入 = 画布节点引用。
- **D4 产品形态 → 已拍板**：短期 localhost serve（T33 host.ts 形态成立），中长期转 Electron，**不考虑 Tauri**（fork 删除 tauri/desktop 的减法获最终背书）。影响：B4（cli→serve 入口）与 packages/cli 处置解锁。
- **D6 中文字体策略 → 已拍板**：S3 混合——CDN 按需子集 + bundled 子集兜底（预研 13 册蓝图可作 S2 实施参考；O2 的具体化获确认）。公共前置：font-subset 工具链 + 字体授权 tier 登记。O3（本地字体字重匹配放宽）不在本次拍板范围，保持 open 另议。
- **D8 素材图理解 → 已拍板**：确认放弃。依据：chat-ui 档案 R2 实测旧分支声称能力全仓无代码，不从零新建。

### 第二批：新全局决策 D34-D37

- **D34 C3a 真实生图凭证链测试口径 → mock 进 CI + 真实走 live**：CI 跑「假桥 + 假生图服务」双 mock 自含套件；真实凭证链走 live 手动探针（t21 先例），不在 CI 管 secret。登记 ci-infra.md。
- **D35 t21 admin-smoke CI 化**：provider/凭据管理用 dummy key + auth 预检探针改造成自含套件进 smoke:pi 批次，消除凭据管理 CI 盲区。登记 ci-infra.md。
- **D36 narrative D14 绑定豁免高频活文档**：tracker.md 从「改动必须同 commit 追加 narrative」的 D14 强制口径中豁免（git 历史已足够；narrative/tracker.md 已 575 行，为活文档 57 行的 10 倍，边际收益不抵成本）；其他绑定文件（00-05/README/runbook/proposals/spikes/zones.json）维持不变。配套：05-process.md §4.10 修订 + bindings.ts 豁免清单 + records/_index.md §2 表更新。登记 docs-governance.md。
- **D37 预研集（docs/202608251637-migration-proposal，21 份）处置**：事实层（代码考据/上游三册 05-07/字体分析 13-14）采信可用；决策层一律视为未拍板——所有标「owner 裁决/定稿」的内容未在官方 records 登记，按纪律不成立；决策项逐条过会当场拍板（进行中）；已知冲突项（derive_palette/sample_hero_color 搁置说）在逐条过会前维持官方 01 §5 C3b「移植」口径；使用该集时注意编号撞车（预研 D1-D6 ≠ 官方 D1-D6）与 264 行错值（官方实测 303 行）。登记 docs-governance.md。

## 3. 任务清单

| # | 动作 | 目标文件 |
|---|---|---|
| S1 | D1/D6 拍板条目登记（D6 原无条目，新建） | records/topics/brand-config.md |
| S2 | D4 拍板条目登记（新建条目） | records/topics/agent-runtime.md |
| S3 | D8 拍板条目更新（open→已拍板） | records/topics/chat-ui.md |
| S4 | D34/D35 登记 | records/topics/ci-infra.md |
| S5 | D36/D37 登记 | records/topics/docs-governance.md |
| S6 | §7 决策表 D1/D4/D6/D8 四行翻「已拍板」+ 口径摘要 | 01-target-state.md |
| S7 | §4.10 D14 修订（D36 豁免条款） | 05-process.md |
| S8 | 豁免清单加 tracker.md（D36 注释） | tools/zone-registry/src/check/bindings.ts |
| S9 | §1 D 编号范围延展至 D37 + §2 绑定表 tracker 行标注 D36 豁免 + 头部时间刷新 | records/_index.md |
| S10 | narrative 追加（绑定义务） | records/narrative/01-target-state.md / 05-process.md / tracker.md（停更说明条） |
| S11 | tracker.md §2 + tasks/_index.md T37 行 | 两表 |

## 4. 验收标准

| # | 验收 | 结果 |
|---|---|---|
| C1 | 8 项拍板全部登记进对应 topics 档案，每条附拍板人（owner）+ 日期（2026-08-28）+ 理由 | ⏸ 待开工 |
| C2 | 01 §7 表 D1/D4/D6/D8 四行翻「已拍板」，口径与本表 §2 一致 | ⏸ 待开工 |
| C3 | D36 三配套（05 §4.10 修订 + bindings.ts 豁免 + records/_index §2 表）落地，改 tracker.md 不再触发 bindings 红（实测） | ⏸ 待开工 |
| C4 | check:zones / check:docs / check:bindings / check:tasks / format:check 全绿 | ⏸ 待开工 |
| C5 | subagent 独立核验「可以收口」 | ⏸ 待开工 |
| C6 | 三件套齐 + 收口 SOP 全做（verify 状态翻转 / _index 行翻 ✅ / tracker 行翻 ✅ / plan 状态刷新 / 绑定 narrative 追加） | ⏸ 待开工 |

## 5. 出栈（明确不做）

预研集 O1-O8 / 预研 D1-D6 逐条拍板（D37 登记了处置方式，逐条过会另行进行）；O3 字重匹配放宽；B4/cli 处置动工（D4 解锁后的实施）；D34/D35 的测试基建实施（本任务只登记决策）。

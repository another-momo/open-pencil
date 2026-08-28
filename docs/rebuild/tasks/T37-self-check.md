<!--
  写作纪律（改本文前必读）：
  - 事实性声明必须附核验命令 + 日期，否则标为【假设】
  - 计划被实测推翻时，直接改本文为新版本，完整理由记入 records/ 子文档
  - 本文只保留当前态，不保留修正历史
  - 改完后刷新本文头部的「状态」字段
  - 详细规则见 docs/rebuild/05-process.md §4
-->

# T37 自检 · 决策批次登记（D1/D4/D6/D8 闭环 + D34-D37 新登）

> **状态**：自检完成，待独立核验 | **时间**：2026-08-28 | **自检人**：主 agent

## 1. 承诺 / 落地对照（T37-plan §3 任务清单 S1-S11）

| # | 承诺 | 落地 | 偏差 |
|---|---|---|---|
| S1 | brand-config.md D1 翻已拍板 + D6 新建 | ✅ D1 条目改写（不设专门参考图机制，画布节点 ref）；D6 新条目（S3 混合 + 公共前置 + O3 另议）；头部时间刷新 | 无 |
| S2 | agent-runtime.md D4 登记 | ✅ 新增「D4 · 产品形态，owner 正式拍板」条目（短期 localhost / 中长期 Electron / 不考虑 Tauri；B4+cli 解锁） | 无 |
| S3 | chat-ui.md D8 open→已拍板 | ✅ 确认放弃，不立项 | 无 |
| S4 | ci-infra.md D34/D35 登记 | ✅ D34（mock 进 CI + 真实走 live）、D35（t21 CI 化）两条目追加于 CI-17 后 | 无 |
| S5 | docs-governance.md D36/D37 登记 | ✅ 两条目追加于 D33 后（D36 含三配套指针；D37 含伪拍板清单指针 + 编号撞车 + 264 错值两条防误读警示） | 无 |
| S6 | 01 §7 表 D1/D4/D6/D8 翻已拍板 | ✅ 四行改写 + 头部时间刷新 | 无 |
| S7 | 05 §4.10 D36 豁免条款 | ✅ 第 10 条新增「高频活文档豁免」子弹；头部时间刷新 | 无 |
| S8 | bindings.ts 豁免 tracker.md | ✅ isNarrative 加豁免分支（D36 注释）；实证：本 commit 改 tracker.md 未触发 bindings 红（check-bindings 15 文件变更全绿，2026-08-28） | 无 |
| S9 | records/_index.md 三处 | ✅ §1 D 编号延展至 D37 + §2 tracker 行 D36 标注 + 头部时间刷新 | 无 |
| S10 | narrative 追加（01/05/tracker） | ✅ 三档案各追加 T37 修正条；tracker 档含 D36 停更说明（强制口径下最后一条义务性追加） | 无 |
| S11 | tracker/_index T37 行 | ✅ tracker.md §2 + tasks/_index.md 各一行（🔄） | 微小：tracker 行首版 Edit 因 old_string 含转述偏差未命中，改锚点重写后落盘——过程问题，不影响产物 |

## 2. 验收标准对照（plan §4 C1-C6）

- C1 ✅ 8 项拍板全部登记，每条附拍板人 owner + 日期 2026-08-28 + 理由
- C2 ✅ 01 §7 四行口径与 plan §2 拍板清单一致
- C3 ✅ D36 三配套落地且机器口径实证（bindings 绿）
- C4 ✅ `bun run check:zones`（clean: 55 modified / 294 added / 1014 deleted，base 88c10770）/ `check:docs` 40/40 / `check:bindings` 全绿 / `check:tasks` 大改动识别 + 三件套检查通过 / `format:check` 2062 文件全过 / `bunx tsgo --noEmit` exit 0（bindings.ts 改动）（全部 2026-08-28 实跑）
- C5 ⏸ 待独立核验（本文件落盘后派单）
- C6 ⏸ 收口 SOP 随 verify 通过后执行

## 3. 分标声明

- 【事实】本文件全部完成度声明均附 2026-08-28 实跑命令（见 §2 C4 与各表行内注）
- 【决策】D1/D4/D6/D8/D34/D35/D36/D37 八项均为 owner 2026-08-28 两批拍板，本任务零自主决策
- 【假设】无

## 4. 遗留（出栈确认）

预研集 O1-O8 / 预研 D1-D6 逐条拍板（D37 已登记处置口径，过会另行进行）；O3 字重匹配放宽保持 open；B4/cli 处置与 D34/D35 测试基建的实施不属本任务。

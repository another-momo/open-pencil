<!--
  写作纪律（改本文前必读）：
  - 事实性声明必须附核验命令 + 日期，否则标为【假设】
  - 计划被实测推翻时，直接改本文为新版本，完整理由记入 records/ 子文档
  - 本文只保留当前态，不保留修正历史
  - 改完后刷新本文头部的「状态」字段
  - 详细规则见 docs/rebuild/05-process.md §4
-->

# T37 独立核验 · 决策批次登记（D1/D4/D6/D8 闭环 + D34-D37 新登）

> **状态**：✅ 已核验 | **时间**：2026-08-28 | **核验人**：独立 verify subagent

核验范围：`git log --oneline abc5f1b5..HEAD` = 恰 1 个 commit `a6e07e78`（`task: T37 决策批次登记——D1/D4/D6/D8 闭环…D34-D37 新登…+ T37-plan/self-check`，16 文件 +263/-54，2026-08-28 实测）。全程于 worktree `D:\Desktop\AgentLearn\00_DIYProjects\0720openpencil\open-pencil-rebuild`（分支 `rebuild/t35-i18n-fork`）实跑，不接受执行者结论。

---

## V1 决策表（01-target-state.md §7）—— ✅ 通过

- 实跑：`grep -n "^| D[1468] " docs/rebuild/01-target-state.md`（2026-08-28）→ 四行齐：
  - L94 **D1**：`**已拍板**（owner，2026-08-28：不设专门参考图/参考区机制；需要参考时由用户指定画布节点作为 ref）`——含「画布节点」
  - L97 **D4**：`**已拍板**（owner，2026-08-28：短期 localhost serve，中长期转 Electron，不考虑 Tauri）`——含「Electron」
  - L99 **D6**：`**已拍板**（owner，2026-08-28：S3 混合——CDN 按需子集 + bundled 子集兜底；O3 字重匹配放宽另议）`——含「S3」
  - L101 **D8**：`**已拍板**（owner，2026-08-28：确认放弃——旧分支声称能力全仓无代码，不从零新建）`——含「放弃」
- 实跑：`grep -n "open" docs/rebuild/01-target-state.md` → **exit 1**，全文零命中（强于「§7 表内无这四项 open 残留」的要求——全文任意语境均无 open 字样）
- 实跑：`sed -n '12p' docs/rebuild/01-target-state.md` → `> **状态**：已核验 | **时间**：2026-08-28 | **核验人**：主 agent`——头部时间字段已刷新为 2026-08-28

## V2 topics 登记（5 个档案）—— ✅ 通过

逐档实跑（2026-08-28）：

1. `grep -n -A6 "D1" docs/rebuild/records/topics/brand-config.md` → L19-24 D1 条目：`- **状态**：**已拍板**（owner，2026-08-28）`；`grep -n -B2 -A8 "## D6"` → L57-65 **D6 新条目**（`## D6 · 中文字体策略`）：`S3 混合路线——CDN 按需子集 + bundled 子集兜底`，`未决另议：O3 本地字体字重匹配放宽与否…保持 open`，`- **时间**：2026-08-28` + `- **拍板**：owner`
2. `tail -15 docs/rebuild/records/topics/agent-runtime.md` → 末尾 `## D4 · 产品形态，owner 正式拍板（2026-08-28）` 条目：内容含「短期 localhost serve，中长期转 Electron，不考虑 Tauri」，拍板 owner
3. `grep -n -A7 "D8" docs/rebuild/records/topics/chat-ui.md` → L26-30：`- **状态**：**已拍板**（owner，2026-08-28）：确认放弃，不立项`——「已拍板」「放弃」俱在
4. `grep -n -B1 -A8 "## D3[45]" docs/rebuild/records/topics/ci-infra.md` → L262-269 **D34**（`mock 进 CI + 真实走 live`——双 mock 自含套件 / 真实凭证链走 live 手动探针）+ L271-277 **D35**（t21 admin-smoke 用 dummy key + auth 预检探针改造纳入 smoke:pi 与 CI job）；两条目均含 `- **拍板**：owner` + `- **时间**：2026-08-28`
5. `grep -n -B1 -A9 "## D3[67]" docs/rebuild/records/topics/docs-governance.md` → L524-532 **D36**（tracker.md 豁免 D14 强制口径 + 三配套指针）+ L534-546 **D37**（预研集处置：事实层采信 / 决策层视为未拍板 / 逐条过会）；L544 含两条防误读警示——`编号撞车（预研 D1-D6 与官方 D1-D6 同号不同义）` 与 `config.yaml 行数 264 为错值（官方实测 303 行…）`；两条目均含拍板 owner + 时间 2026-08-28

## V3 D36 配套（05-process / bindings.ts / _index）—— ✅ 通过

- 实跑：`grep -n "D36" docs/rebuild/05-process.md`（2026-08-28）→ L175 `**高频活文档豁免（owner 拍板 2026-08-28 · D36）**：tracker.md 从本条「修改触发」强制口径中豁免…`；定位确认：该子弹属 §4 第 10 条（文件↔record 一一对应，D14）列表区间（下接「11. task 三件套物理拆分纪律」），即 §4.10 豁免条款
- 实跑：`grep -n "tracker.md\|D36" tools/zone-registry/src/check/bindings.ts` → L11 注释 + L91-94：`// D36（2026-08-28 owner 拍板）：高频活文档豁免——tracker.md 不再强制…` / `if (file === 'docs/rebuild/tracker.md') {`
- 实跑：`grep -n "D37\|D36" docs/rebuild/records/_index.md` → L20 §1 决策行含「全局：D1-D37…**D34-D37 为 2026-08-28 owner 两批拍板**」；L41 §2 绑定表 tracker 行含「`records/narrative/tracker.md`（**D36 豁免**：2026-08-28 owner 拍板——高频活文档不再强制同 commit 追加，档案保留停更；bindings.ts 已配套）」；L12 头部时间 2026-08-28

## V4 豁免实证（bindings.ts + 门禁 + 类型检查）—— ✅ 通过

- 实跑：`sed -n '85,105p' tools/zone-registry/src/check/bindings.ts`（2026-08-28）→ 豁免分支真实存在且结构完整：L94-96 `if (file === 'docs/rebuild/tracker.md') { return { counterpart: null, isNew: false } }`，位于 tasks/ 排除分支之后、基础设施排除分支之前，带 D36 三行注释（拍板人/日期/规则文指针）
- 实跑：`git show a6e07e78 -- docs/rebuild/tracker.md | head -8` → 非空（diff 头 `index 86d09ca1..d61de2cc 100644`）——本 commit 确改了 tracker.md，且在配套 narrative（narrative/tracker.md 同 commit 追加停更说明条）下 bindings 保持绿
- 实跑：`bun run check:bindings` → **exit 0**，输出 `check-bindings: 无变更，跳过`
- 实跑：`bunx tsgo --noEmit` → **exit 0**（bindings.ts 语法/类型无误）

## V5 三件套与任务表 —— ✅ 通过

- 实跑：`ls -la docs/rebuild/tasks/T37-plan.md docs/rebuild/tasks/T37-self-check.md`（2026-08-28）→ 5943 / 3599 字节，均存在
- 实跑：对 T37-plan.md / T37-self-check.md 两文件做占位模式 grep 扫描（模式 = 全角左括号 + 「待」字，2026-08-28）→ **exit 1** 零占位命中；人工通读两文——plan 含背景立项 / owner 两批 8 项拍板清单 / S1-S11 任务清单 / C1-C6 验收标准 / 出栈，self-check 含承诺-落地对照表（S1-S11 全 ✅ 含偏差注记）/ C1-C6 对照 / 分标声明 / 遗留，均非占位
- 实跑：`grep -c "T37" docs/rebuild/tracker.md docs/rebuild/tasks/_index.md` → `1` / `1`（各 ≥1）
- 定位：tracker.md T37 行在 L48，属 §2 任务表区间（§2 始 L28、§3 始 L50），状态列 `🔄`；tasks/_index.md L71 T37 行状态 `🔄 进行中`，三件套路径列齐（plan / self-check / verify）

## V6 narrative 追加 —— ✅ 通过

实跑：`grep -n -B2 -A4 "T37" docs/rebuild/records/narrative/{01-target-state,05-process,tracker}.md`（2026-08-28）：

- `records/narrative/01-target-state.md` L119-124：`## T37 修正-N（2026-08-28） · §7 决策表 D1/D4/D6/D8 四行翻「已拍板」`，含改动 / 拍板内容 / 登记处 / task 文档四要素
- `records/narrative/05-process.md` L215-220：`## T37 修正-N（2026-08-28） · §4.10 D14 增补 D36 豁免条款`，含改动 / 配套（bindings.ts + _index + topics）/ 豁免理由 / task 文档
- `records/narrative/tracker.md` L603-607：`## T37 修正-N（2026-08-28） · T37 行追加 + 本档案停更说明（D36）`——含「本档案保留停更，不再强制逐 commit 追加…本条为本档案在强制口径下的最后一条义务性追加」停更说明

## V7 门禁全绿（实跑）—— ✅ 通过

2026-08-28 逐项实跑（exit code + 末行输出）：

| 门禁 | exit | 末行输出 |
|---|---|---|
| `bun run check:zones` | 0 | `[zones] clean: 55 modified (all registered), 295 added (owned), 1014 deleted (all registered), 0 renamed (cross-checked), base 88c10770` |
| `bun run check:docs` | 0 | `check-docs: 40/40 通过（R1 状态 + R2 时间 + R3 身份 + R4 纪律块 + R5 引用格式）` |
| `bun run check:bindings` | 0 | `check-bindings: 无变更，跳过` |
| `bun run check:tasks` | 0 | `check-tasks: 无变更，跳过` |
| `bun run format:check` | 0 | `All matched files use the correct format. / Finished in 5981ms on 2062 files using 8 threads.` |

旁证：`bunx tsgo --noEmit` exit 0（见 V4）。

## V8 提交纪律 —— ✅ 通过

- 实跑：`git log --format=%s -1 a6e07e78`（2026-08-28）→ `task: T37 决策批次登记——…`，`grep -c "task: T37"` = 1
- 实跑：`git log --oneline abc5f1b5..HEAD` → 恰 1 个 commit（`a6e07e78`）
- 实跑：`git status --short | wc -l` → `0`（工作区干净，核验前）
- 实跑：`git branch -r --contains a6e07e78 | wc -l` → `0`（无任何远端分支含此 commit，未 push）；`git status -sb` 显示 `## rebuild/t35-i18n-fork...origin/rebuild/t35-i18n-fork [gone]`（远端跟踪分支已不存在，本地未推出）

---

## 打回项清单

无。V1-V8 八项全部实测通过，判 **✅ 已核验**。

## 核验后说明（非打回，留痕备查）

- 本文件落盘后工作区将含未跟踪文件 `docs/rebuild/tasks/T37-verify.md`（按派单要求不 commit，保持工作区含该新文件）——V8「工作区干净」结论针对落盘前状态（2026-08-28 实测 `git status --short` 为空）。
- T37-plan.md §4 验收表 C5/C6 为「⏸」系任务未收口前的正常中间态（self-check 已声明「待独立核验/收口 SOP 随 verify 通过后执行」），非占位模式，不计打回。

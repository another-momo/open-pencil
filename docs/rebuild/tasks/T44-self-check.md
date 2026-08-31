<!--
  写作纪律（改本文前必读）：
  - 事实性声明必须附核验命令 + 日期，否则标为【假设】
  - 计划被实测推翻时，直接改本文为新版本，完整理由记入 records/ 子文档
  - 本文只保留当前态，不保留修正历史
  - 改完后刷新本文头部的「状态」字段
  - 详细规则见 docs/rebuild/05-process.md §4
-->

# T44 自检 · config.yaml 拆解迁移 + longform.md 骨架（S4 W1 / T-A2）

> **状态**：✅ 已完成 | **时间**：2026-08-31 立项 / 2026-08-31 实现段自检 | **负责人**：主 agent
> **⚠ 当前态修正（T48，2026-08-31）**：watercolor_poster_v2 已补迁（四精品）；保真核验脚本源已修复为 git 钉扎（4ce51816），本文中读 brand/config.yaml 文件路径的核验口径为历史记录，现役口径见 T48 三件套
> **关联**：[T44-plan.md](T44-plan.md)（验收标准 C1-C5 以其 §4 为准）

## 1. 立项段自检（2026-08-31）

- [x] 迁移源已通读：`brand/config.yaml` 303 行、7 type + 8 profile（全文 Read，2026-08-31；行数核验观察项勘误：立项时照抄 S2 §2 旧数字 264，核验 subagent 实测 `wc -l` = 303 双证，T24 引入时即 303）。
- [x] 消费链已核对：service.ts:45/121/209/408（loadBrandSeed → overlay/manifest）、server.ts GET 路由、prompt-overlay.ts、mode-selection.ts、ChatStyleProfileSelect.vue——本任务零触碰（D-c，T-A3 范围）。
- [x] 既有测试对 config.yaml 零依赖（`grep -rln "config.yaml\|loadBrandSeed\|brand/manifest" tests/` 无命中，2026-08-31）→ 迁移不碰既有测试。
- [x] 校验面已逐条比对（validate.ts 实测）：
  - 五必需节精确名 `Fixed system`/`Variable system`/`Anti-identity`/`Tone`/`Recipe` → D-e 节名归一映射覆盖旧文件全部节名变体（中文括号版 + 英文括号版）。
  - `applicable_to` 引用完整性按 mode id（knownModeIds 含 general）→ D-d 改写 [longform]。
  - hex 启发式：v3 正文三个 6 位合法 hex 不触发拦截（逐个人工核对，2026-08-31）。
  - 字体白名单只查 frontmatter 的 font/lettering/pairing 键——三份 frontmatter 均不含这些键，不触发。
  - type size 正则 `/^\d+x\d*$/`：750x / 1080x HUG 形态合法。
- [x] T-A2/T-A4 重叠已裁决：D-a 三段吸收（机制 T43 / 骨架 T44 / 内容 T-C2），登记含注记。
- [x] 迁移取舍对照 S2 §5 迁移清单逐条落实：v3 保留为模板基准=迁；editorial/solid=迁（Recipe no-op，补齐挂 T-C3）；casual_v1=不迁（D-b）；watercolor v0/v1/v2 + v1_center_left=退役不进文件集（git 历史留存，无需动作）；目录扩张=不做。
- [x] 三件套立项即建档，无占位禁词。

## 2. 实现段自检（2026-08-31）

### C1 四文件落位 + 校验面 ✅

- 落位：`src/app/ai/pi-backend/studio/profiles/{watercolor_poster_v3,editorial_poster_v1,solid_poster_v1}.md` + `workflows/longform.md`。
- 钉扎测试 `tests/engine/rebuild/studio/builtin-assets.test.ts` 1/1 绿（`bun test tests/engine/rebuild/studio/builtin-assets.test.ts`，2026-08-31）：failures 恰含且仅含 base 缺失一条（kind=base）；longform 三 type 齐全（750x/750x/1080x）且蓝图节非空；profiles 恰好三份、applicableTo=[longform]；modes=[general, longform]。
- **计划 C1 口径修正**：plan 原文「零 failures」在 base.md 落位（T-A5）前不成立——实测断言收紧为「四迁移文件零失败 + 唯一 failure=base 缺失」，测试注释写明 T-A5 应收为 `failures: []`。

### C2 保真 ✅

- 核验脚本 `tools/rebuild/src/verify/t44-migration-fidelity.mjs`（`bun tools/rebuild/src/verify/t44-migration-fidelity.mjs`，2026-08-31）：**21/21**——三份 profile 文首/Fixed/Variable/Anti-identity/Tone/Recipe 逐节逐字一致 + 恰好五节无残留旧节名 + editorial/solid Recipe 旧空节→显式 no-op。
- **唯一内容偏差（已登记）**：v3 Recipe 步骤 1 列表标记 `1.（Phase 2 骨架）` → `1. （Phase 2 骨架）`（补半角空格）。源 config.yaml 该标记是非法 markdown 列表项，oxfmt 会把整个步骤列表并成单段（实测复现）；修标记后列表结构保留。脚本内 `NORMALIZE` 表登记此归一。

### C3 钉扎 + 不回归 ✅

- `bun test tests/engine/rebuild/`：20/20（4 文件——registry 16 + pin 1 + 既有 3），2026-08-31。

### C4 门禁 ✅（2026-08-31 全绿）

| 门禁 | 结果 |
|---|---|
| check:zones | clean（375 added 全 owned，新资产在 ownedRoot `src/app/ai/pi-backend/` 内） |
| check:docs | 42/42 |
| check:bindings | 6 文件变更全绿 |
| check:tasks | 绿 |
| lint | 0 errors（5 warnings，与立项前持平） |
| tsgo | exit 0 |
| check:vue | exit 0 |
| format:check | exit 0（oxfmt 事件修复后） |
| check:i18n | All locale files are in sync |

### C5 登记 + 全量回归 ✅

- 登记：tracker.md 任务表 T44 行 + tasks/_index.md §2 T44 行 + 三件套（立项 commit 61f13f5b）；S4 §7 尾巴表 +2 行（casual_v1 裁决 / editorial·solid Recipe 补齐，均挂 T-C3）+ T-A4 三段吸收注记（仓外 doc/S4-phase3-plan.md，2026-08-31）。
- 全量回归（`bun run test:unit:quick`，556s，2026-08-31）：2555 pass / 23 skip / **77 fail** / 2655 tests / 433 files。对照 T43 基线 78 fail/2654：**失败数不增**；唯一化 diff（`/tmp/t44-fails.txt` 72 行 vs `/tmp/t43-fails.txt` 73 行，sort -u 比对）**零新增**，且 1 例 T43 失败消失（fig export subgraph extraction flake）；零 T44 文件失败（`grep "^(fail)" | grep -iE "studio|pi-backend|builtin"` 无命中）。
- 首轮回归 exit 127 瞬断（io/fig 段中断，同 T43 首轮现象），复跑完整完成——两轮日志均在 /tmp（t44-unit.log / t44-unit2.log）。

### 2.6 实测修正记录（计划外事件）

1. **oxfmt 并段事件**：format:check 首轮判红 v3 profile；定位为源文件步骤 1 列表标记非法（见 C2）。修法 = 修标记（不改格式门禁、不豁免资产文件——门禁恰好拦住了一次真实的内容结构破坏，保留其约束力）。
2. 钉扎测试设计时对 Record 索引的存在性断言改用 `toBeTruthy()`（oxlint no-unnecessary-condition 规避，同 T43 经验）。

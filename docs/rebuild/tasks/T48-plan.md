<!--
  写作纪律（改本文前必读）：
  - 事实性声明必须附核验命令 + 日期，否则标为【假设】
  - 计划被实测推翻时，直接改本文为新版本，完整理由记入 records/ 子文档
  - 本文只保留当前态，不保留修正历史
  - 改完后刷新本文头部的「状态」字段
  - 详细规则见 docs/rebuild/05-process.md §4
-->

# T48 计划 · watercolor_poster_v2 profile 抢救性迁移 + T44 保真核验脚本修复

> **状态**：✅ 已完成 | **时间**：2026-08-31 立项 / 2026-08-31 收口 | **负责人**：主 agent
> **分支**：`rebuild/mode-arch`（worktree `open-pencil-mode`；T47 收口 0942c409 之后）
> **规格真源**：owner 指令（2026-08-31，本会话第二轮）：「补充抢救一下 watercolor_poster_v2 这个 profile，这个 profile 也还是有些价值」

## 1. 背景与立项

T44（S4 W1/T-A2）把旧 `src/app/ai/pi-backend/brand/config.yaml` 的 profile 集拆解迁移为 `studio/profiles/` 三精品（watercolor_poster_v3 / editorial_poster_v1 / solid_poster_v1）；同属该 yaml 的 `watercolor_poster_v2`（水彩海报 v2，英文版，带完整 compose_backdrop 四步物化配方）当时未迁。owner 现拍板补迁。

v2 的存续位置：T45 已删除 brand/ 目录，v2 仅存于 git 历史——`git show 4ce51816:src/app/ai/pi-backend/brand/config.yaml`（commit 钉扎；blob `ec9b22a3` 与 rebuild/pi 分支同 blob，`git rev-parse rebuild/pi:… 4ce51816:…` 双 ref 同值实测，2026-08-31）。

v2 的价值定位：内置集中**唯二的真 Recipe 携带者**（v3 之外的另一份非 no-op 物化配方），且工具链比 v3 轻（generate_image + compose_backdrop 四步，无 prepare_hero_scaffold/derive_palette 依赖）；英文书写，与 editorial/solid 同语料风格。

连带发现的存量伤口（本任务一并修复）：`tools/rebuild/verify-t44-migration-fidelity.mjs` 的核验源是被 T45 删除的 `brand/config.yaml`——脚本当前必崩（`node tools/rebuild/verify-t44-migration-fidelity.mjs` 实测 ENOENT，2026-08-31）。T44 的保真硬卡口自 T45 起事实上失效，须随本任务修复为 git 钉扎源。

## 2. 决策点（本任务开工前拍板/默认项登记）

- **D-a 迁移口径完全沿用 T44 规矩**：节名归一（T44 RENAME 映射已含 v2 全部英文节名条目：`Fixed system (never break)` → `Fixed system`、`Variable system (choose per design; record your picks)` → `Variable system`、`Anti-identity (this style never does)` → `Anti-identity`、`Visual environment setup (Phase 2.5)` → `Recipe`、`Tone` → `Tone`）；`applicable_to: [product_long, event_poster, xiaohongshu]` → `[longform]`（非长图 type 暂缓收录，同 T44 D-b）；frontmatter = `id / label: 水彩海报 v2 / applicable_to / version: 2`。
- **D-b Recipe = 真配方逐字**：v2 的 `Visual environment setup (Phase 2.5)` 节正文非空，按 T44 映射规则落 `## Recipe` 且**逐字保留**（对照 editorial/solid 的 no-op 空节，v2 是映射规则中「旧空节 → no-op」分支之外的另一分支）。
- **D-c 保真源 git 钉扎**：新建 `tools/rebuild/verify-t48-v2-rescue-fidelity.mjs`（源 = `git show 4ce51816:…config.yaml` 经 yaml parse 取 v2 markdown 块，逐节对照新文件）；同法修复 `verify-t44-migration-fidelity.mjs` 的源读取（其余断言不动）。commit 钉扎不用分支名，防分支推进/删除漂移。
- **D-d 不标 deprecated**：owner 定性「还有些价值」= 进选择器数据面（deprecated 语义 = 不展示，S2 §5，manifest.ts:46-47）。后续若要藏，加 `deprecated: true` 一行即可，机制已在。
- **D-e 钉扎测试更新**：`tests/engine/rebuild/studio-builtin-assets.test.ts` profiles 清单钉扎 3 → 4（「恰好三份精品」注释同步）；其余测试用临时 fixture 不受影响。
- **D-f 程序复制非人工重打**：v2 正文经脚本从 git 钉扎源提取 + 节名归一生成候选文件，人工只核对不手打（同 T46 构建器纪律）；生成物经 oxfmt  canonical 化后，保真核验以 canonical 形态为准对照，任何归一偏差如实登记进脚本 NORMALIZE 表与自检。

## 3. 范围与修法

1. 提取脚本（一次性，`node -e` 内联即可，不留仓）：git show 钉扎源 → yaml parse → v2 markdown 块 → 应用 D-a 改名映射 → 拼 frontmatter → 落 `src/app/ai/pi-backend/studio/profiles/watercolor_poster_v2.md`。
2. `oxfmt --write` 该文件（format 门禁覆盖 src/**/*.md）；若产生内容变化，差异登记进核验脚本 NORMALIZE 与自检。
3. 新建 `tools/rebuild/verify-t48-v2-rescue-fidelity.mjs`：文首逐字 + 五节逐字 + 恰好五节无残留旧节名 + frontmatter 四键钉扎（id/label/applicable_to/version）。
4. 修复 `tools/rebuild/verify-t44-migration-fidelity.mjs`：源读取改 `git show 4ce51816:…`（execSync），docstring 加注 T45 删除 brand/ 的缘由与钉扎 commit。
5. `tests/engine/rebuild/studio-builtin-assets.test.ts`：profiles 钉扎清单加 `watercolor_poster_v2`（排序位：editorial → solid → v2 → v3），注释「恰好三份精品」改「恰好四份精品」。
6. T44 三件套各加「⚠ 当前态修正（T48）」指针行（v2 补迁 + 核验脚本源修复）；tracker/_index 登记本任务。
7. 实证：九项门禁 + `bun test tests/engine/rebuild/` + 保真核验两脚本 + manifest dump 实跑（profiles 含 v2）+ 全量回归对照 T47 基线 77 fail/2661。

## 4. 验收标准

- **C1 保真（v2）**：`node tools/rebuild/verify-t48-v2-rescue-fidelity.mjs` 全绿——文首/Fixed/Variable/Anti-identity/Tone/Recipe 逐字一致、恰好五节、frontmatter 四键钉扎命中。
- **C2 T44 卡口复活**：`node tools/rebuild/verify-t44-migration-fidelity.mjs` 21/21 复绿（修复前 ENOENT 实测记录入自检）。
- **C3 注册与投影**：`bun test tests/engine/rebuild/` 全绿（含更新后的内置资产钉扎：4 profiles、failures 零）；`node tools/rebuild/verify-t45-manifest-dump.mjs` 实跑 profiles 含 `watercolor_poster_v2`、泄漏检查 CLEAN。
- **C4 门禁**：九项门禁全绿（zones/docs/tasks/bindings/lint/tsgo/vue/format/i18n），format:check 不接管验码（T47 修正记录 8 教训）。
- **C5 回归**：全量回归失败数不增于 T47 基线（77 fail/2661），唯一化 diff 零本任务文件；flake 按既有协议裁决。
- **C6 登记面**：T48 三件套齐 + tracker/_index 行 + T44 三件套指针行。

## 5. 不做（out of scope）

- `.MD` 大写扩展名收紧（S4 §7 行——留给首个触碰 registry.ts 的 W2 任务，本任务不动 registry）。
- `hero_composition` 键补带（v2 默认 lower-third 不携带；S4 §7 行留 T-C3 裁决）。
- 同 yaml 其余历史 profile（watercolor_poster_v0 / v1 / v1_center_left / casual_v1）的迁移——owner 未指名；casual_v1 已有 S4 §7 裁决行（T-C3）。
- studio 命名改动与 mode/workflow 词汇统一（均为 owner 待拍板问答项）。
- v2 正文的内容性润色/翻译/工具链升级（纯抢救性迁移，一字不改——改写属 T-C3 精品集定稿）。

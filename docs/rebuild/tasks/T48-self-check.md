<!--
  写作纪律（改本文前必读）：
  - 事实性声明必须附核验命令 + 日期，否则标为【假设】
  - 本文只保留当前态，不保留修正历史
  - 详细规则见 docs/rebuild/05-process.md §4
-->

# T48 自检 · watercolor_poster_v2 抢救性迁移 + T44 保真核验脚本修复

> **状态**：✅ 已完成 | **时间**：2026-08-31 立项 / 2026-08-31 实现段自检 | **负责人**：主 agent

## 1. 立项段自查（计划执行符合性）

| 决策点 | 执行情况 |
|---|---|
| D-a 迁移口径沿用 T44 | ✅ 节名归一沿用 T44 RENAME 英文条目；`applicable_to: [longform]`；frontmatter 四键 = id/label 水彩海报 v2/applicable_to/version: 2 |
| D-b Recipe 真配方逐字 | ✅ 旧 `Visual environment setup (Phase 2.5)` 节逐字落 `## Recipe`（核验脚本 PASS 项 8 钉扎「非 no-op」） |
| D-c 保真源 git 钉扎 | ✅ 两脚本统一 `git show 4ce51816:…`（blob ec9b22a3 与 rebuild/pi 同值，`git rev-parse` 双 ref 实测 2026-08-31） |
| D-d 不标 deprecated | ✅ frontmatter 无 deprecated 键，manifest 投影实测进选择器数据面（见 §2 C3） |
| D-e 钉扎测试更新 | ✅ studio-builtin-assets.test.ts 清单 3→4 + 测试名「三 profile」→「四 profile」+ 注释同步 |
| D-f 程序复制非人工重打 | ✅ 一次性 node 内联脚本提取（git show → yaml parse → RENAME 映射 → 拼 frontmatter 落盘），人工零手打正文 |

## 2. 实现段核验（验收标准逐条，2026-08-31 实测）

- **C1 保真（v2）**：`node tools/rebuild/verify-t48-v2-rescue-fidelity.mjs` → **9/9 PASS**（钉扎源条目存在 / frontmatter 四键 / 文首逐字 / Fixed / Variable / Anti-identity / Tone / Recipe 真配方逐字 / 恰好五节）。
- **C2 T44 卡口复活**：修复前 `node tools/rebuild/verify-t44-migration-fidelity.mjs` 实测 ENOENT 崩（`brand/config.yaml` 已被 T45 删除）；修复后同命令 → **21/21 PASS**。
- **C3 注册与投影**：`bun test tests/engine/rebuild/` → **26/26 pass**（含更新后内置资产钉扎：4 profiles、failures 零）；`node tools/rebuild/verify-t45-manifest-dump.mjs` 实跑 → profiles 含 `watercolor_poster_v2`（四份齐），泄漏检查 **CLEAN**。
- **C4 门禁**：format:check / lint（0 错误，基线 5 警告）/ tsgo / check:vue / check:i18n / check:zones / check:bindings / check:docs（42/42）全绿，**均不接管验码**（exit code 直读，T47 修正记录 8 教训）；check:tasks 随 commit 钩子跑。
- **C5 回归**：全量回归 `bun run test:unit:quick` 完整跑完（562.0s，仓外 `doc/t48-regression-run.log`）→ **76 fail / 2661**（2562 pass），对照 T47 基线 77 fail/2661 **失败数不增**；唯一化失败清单（`doc/t48-failures.txt`，71 条）对照 T47（72 条）diff 唯一变化 = 少 `MCP stdio transport > stderr does not contain JSON-RPC`（既有 flake 本次未复现），**零新增、零本任务文件**——按 flake 裁决协议判定干净，无新条目需隔离复跑。
- **C6 登记面**：T48 三件套 + tracker/_index 行（立项 commit 7a4e4d50）+ T44 三件套「⚠ 当前态修正（T48）」指针行（本 commit）。

## 3. 实测修正记录（实现段发现 → 处置）

1. **verify-t45-manifest-dump.mjs Windows 动态 import 崩**：`await import(join(repoRoot, …))` 裸绝对路径在 node 的 ESM loader 下报 `ERR_UNSUPPORTED_ESM_URL_SCHEME`（bun 容忍、node 不容忍）——T47 迁移时未以 node 复跑该脚本，伤口休眠。修复：动态 import 路径经 `pathToFileURL(...).href` 转换；docstring 加注。教训入档：迁移脚本须以声明的运行时（node）实跑一次才算迁移完成。
2. **oxfmt 对 v2 文件的 canonical 化**：生成稿 `## Tone` 前缺结构性空行，oxfmt 补上（diff 唯一变化，50a51）。节体按 trim 口径对照不受影响，核验脚本无需 NORMALIZE 条目——登记在案（对照 T44 的「一字符列表标记归一」先例，本次为零内容偏差）。
3. **dump 脚本 fixture 不含 base.md（存量观察，非本任务引入）**：verify-t45-manifest-dump.mjs 的临时目录只拷 workflows/profiles，故其输出 failures 恒含「base.md 缺失」一条——这是 fixture 覆盖面的历史形态（T45 起如此），真实内置目录的零失败门禁由 studio-builtin-assets.test.ts 钉扎承担。本任务不改该 fixture 形态。
4. **T44 核验脚本失效属 T45 的连带伤口**：brand/ 删除时未同步修复 verify-t44 的源读取，保真卡口自 T45 起事实失效（T46/T47 未触碰该脚本故未暴露）。本次修复 = 删除侧欠账的偿清，已在 T44 三件套加指针行。
5. **立项 commit 漏建三件套 skeleton（违反 D15 惯例，实现 commit 时被 check:tasks 拦下）**：T48 立项只提交了 plan + tracker/_index 的「—」占位列——check:tasks 读 HEAD commit message 定位任务号，立项 commit 时 HEAD 还是 T47 故漏网；实现 commit 时 HEAD=立项（T48），行解析失败触发 `big-change-task-table-missing`。对照 T46/T47 立项惯例（三件套物理文件随立项全建，verify.md 为「核验范围预告」非占位 skeleton），本任务在实现 commit 同批补齐 T48-verify.md skeleton + tracker/_index 行三列改实链。教训：立项 = 三件套齐，不是只有 plan。

## 4. 红线式复核（v2 内容定性）

- v2 正文为英文风格资产（同 editorial/solid 语料风格），内容零改写、零翻译、零工具链升级——纯转写 + 节名归一 + frontmatter 重述（T48-plan §5「不做」清单逐条遵守）。
- v2 Recipe 引用的工具（generate_image / compose_backdrop / look）与 v3 同属 W2 待建工具面——当前注册表在案语义与 v3 一致，不产生新的工具依赖缺口。
- hex/字体校验：`validateProfile` 启发式对 v2 正文零命中（`bun test tests/engine/rebuild/` 26/26 内含该路径覆盖，2026-08-31）。

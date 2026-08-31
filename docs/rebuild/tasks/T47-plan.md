<!--
  写作纪律（改本文前必读）：
  - 事实性声明必须附核验命令 + 日期，否则标为【假设】
  - 计划被实测推翻时，直接改本文为新版本，完整理由记入 records/ 子文档
  - 本文只保留当前态，不保留修正历史
  - 改完后刷新本文头部的「状态」字段
  - 详细规则见 docs/rebuild/05-process.md §4
-->

# T47 计划 · W1 收口后修正批：base 转写源切换 + workbench 归档迁移 + 生图路线乙登记

> **状态**：🔄 进行中 | **时间**：2026-08-31 立项 | **负责人**：主 agent
> **分支**：`rebuild/mode-arch`（worktree `open-pencil-mode`；T46 收口 1647e8ea 之后）
> **规格真源**：owner 复核指令六条（2026-08-31，本会话）——其中可执行三条（#6 转写源切换 / #4 workbench 改名迁移 / #1 生图路线乙）立本任务；问答三条（#2 studio 命名 / #3 产品面露出 / #5 D2 解释）随答复闭环、不入任务。

## 1. 背景与立项

T46 收口汇报后 owner 复核提出六条。三条构成对 W1 成果的修正指令：

- **#6 base 转写源切换**：T46 以 `src/app/ai/chat/system-prompt.md`（576 行，UI mode 全量自包含 prompt）为源转写 base.md；owner 拍板改用**更 workflow 无关的** `src/app/ai/pi-backend/prompts/system-prompt-base.md`（119 行，T24 移植的 marketing base 段 = 身份 + 设计 DSL 参考 + 工具纪律，`wc -l` 实测 119，2026-08-31）为 studio base v0 的转写源。此指令**推翻** S4 §3/§4「base v0 = 原 572 行 prompt 沿用」口径（S4 修文随本任务 T47c 段一并落）。
- **#4 workbench 目录正名**：`workbench/` 是已搁置的 DSH plugin 形态产品路线遗留物（README 实证：openpencil-marketing dsh bundle，cordis.patch.yml/presets/src 俱全；`.github/workflows/ci.yml:159` workbench-build job 仍在跑），T43-T46 期间误被当作通用工作区混入探针/核验/构建脚本与回归证据——改名归档 + 错放文件迁出。
- **#1 生图路线乙**：DMX（`https://www.dmxapi.cn/v1`，gpt-image-2-ssvip，`/images/generations` + `/images/edits` 形状，旧仓 `packages/core/src/tools/image-gen/providers.ts:79-217` 实证）**不走 pi-ai**——自写 GPT-image-2 形状 provider 为当前核心 provider；pi-ai `generateImages`（openrouter-images，chat.completions+modalities 形状，SP-a1 已钉）保留为未来可扩展支持项；DMX×pi-ai 探针取消（SP-a2 改定义）。provider 层未来可继续拓展（W2 generate_image 工具设计须留双后端可插抽象）。

## 2. 决策点（本任务开工前拍板/默认项登记）

- **D-a 转写源切换 = 重建 base.md**：构建器 SRC 改指 `prompts/system-prompt-base.md`；保真定义不变（strip 等式零 diff）；frontmatter/双源头注机制沿用。源文件自身 T24 头注视为元注释——转写时剔除、保真剥除对称剔除（不入 base.md 正文，避免 base.md 携带「marketing 模式 base 段」错位自述）。
- **D-b 补洞段适配新源**：位置 = 文末（119 行源无 `# Example: mobile app UI` 锚点）；四红线齐全性对 119 行**重新判定**（grep 证据入自检，预期四条全缺——stock_photo 401 规则在 system-prompt.md 长图 workflow 段而非本源，故规则 4 的「stock_photo 401 rule above」实例引用须删，改为通则表述）；修辞事实标注段不变。
- **D-c system-prompt.md 回退 + P123 撤除**：T46 互指头注从 system-prompt.md 移除（恢复上游态），zones.json P123 条目删除；新源在 ownedRoot `src/app/ai/pi-backend/` 内，互指头注免补丁。T46-verify 中「双源防控」结论同步改注（verify 文档只保留当前态）。
- **D-d workbench 改名 = `attic/dsh-workbench/`**：attic = 搁置区语义自明；目录整体 git mv（含 README/presets/src/scripts/package.json 等 DSH bundle 全套 + 其 .gitignore），README 头部加搁置声明；ci.yml workbench-build job 路径更新（working-directory + 三条 grep 路径 + 注释），zones.json P35 reason 同步。
- **D-e 错放文件迁出目的地**：构建/核验类（build-t46-base、verify-t44/t45/t46、verify-t45-manifest-dump.json、t45-rewire-assembly-smoke.py）→ `tools/rebuild/`（新 ownedRoot）；探针类（probe-sp-a1/sp-b/sp-c/t41/t45-old-route）→ `spikes/probes/`（spikes/ 已在 ownedRoots）；回归日志与失败清单（t45/t46-regression-run.log、t45/t46-failures.txt）→ **仓外 doc/**（站规：logs/截图仓外），仓内文档引用同步改写。workbench 顶层空壳删除。
- **D-f zones.json ownedRoots 调整**：删 `workbench/`，加 `attic/`、`tools/rebuild/`。attic 整体 owned（搁置区不再受 upstream 比对面约束——DSH bundle 本就是 fork-new）。
- **D-g 路线乙登记落点**：spike 06 SP-a2 节改写为「取消·路线乙决定登记」（保留原阻塞记录的事实性描述）；S4-phase3-plan.md §2 SP 表 SP-a 行修正 + §7 新增「生图 provider 路线」行（核心 = 自写 DMX GPT-image-2 形状，扩展位 = pi-ai generateImages，W2 工具层留双后端抽象）。S4 §3/§4 的「572 行」口径行随 #6 一并修正为 119 行源口径。
- **D-h 不做命名改动**：#2 studio/Recipe/Preset 命名评估为问答项，owner 未拍板改名前不动任何标识符（评估结论随答复给出）。

## 3. 范围与修法

**T47a 转写源切换**（预计 ~10 文件）：

1. `workbench/build-t46-base.mjs` → 迁移为 `tools/rebuild/build-t46-base.mjs`（随 D-e），SRC/HEADNOTE/SRC_NOTE/锚点逻辑改写（文末追加 + 头注剔除对称化 + 规则 4 删 stock_photo 引用）。
2. `workbench/verify-t46-base-fidelity.mjs` → `tools/rebuild/verify-t46-base-fidelity.mjs`：源路径、互指文件路径（system-prompt.md → prompts/system-prompt-base.md）、剥除对称化同步。
3. 重建 `src/app/ai/pi-backend/studio/base.md`；`src/app/ai/chat/system-prompt.md` 回退头注（恢复上游态）；`prompts/system-prompt-base.md` 加 T46 互指头注。
4. `tools/zone-registry/zones.json`：删 P123（T47b 的 ownedRoots 调整同 commit）。
5. 钉扎测试同步：`tests/engine/rebuild/studio-builtin-assets.test.ts`（锚点断言复查）、`spikes/s-pi/backend-smoke/t24/prompt-assembly-smoke.mjs`（头注/路径引用复查）、`spikes/probes/probe-t45-old-route.mjs`（迁移后路径）。
6. T46 三件套当前态修正（转写源口径 + 头注落点 + P123 退役；判定表随 119 行源重判）。

**T47b workbench 归档迁移**：

1. `git mv workbench attic/dsh-workbench`（先迁出 D-e 清单文件），attic README 加搁置声明。
2. `.github/workflows/ci.yml` workbench-build job 路径更新；zones.json P35 reason 更新 + ownedRoots 调整。
3. 全仓 `workbench/` 引用清扫：docs（T41/T44/T45/T46 三件套、spike 06、其他 rebuild 文档）、代码注释——指向迁移文件的改写新路径；历史叙事中「workbench/ dsh bundle」语义引用改 attic 路径。
4. 日志/失败清单迁仓外 `doc/`（t45/t46 各两件），仓内引用改写。

**T47c 路线乙登记**：

1. `docs/rebuild/spikes/06-p3-mode-arch-spikes.zh.md` SP-a2 节改写 + 头部状态行更新。
2. 仓外 `doc/S4-phase3-plan.md`：§2 SP 表 SP-a 行、§3 「base v0 红线补洞」行（572→新源口径）、§4 T-A5 行、§7 新增「生图 provider 路线」行 + 「双源收编」行口径随新源改写。

## 4. 验收标准

- **C1 转写保真（新源）**：`node tools/rebuild/verify-t46-base-fidelity.mjs` 6/6 绿；构建器连续两跑 `git diff` 零增长（幂等）；红线齐全性对 119 行源重新判定表入自检（grep 证据）。
- **C2 system-prompt.md 回退干净**：`git diff rebuild/pi -- src/app/ai/chat/system-prompt.md` 为空；zones.json 无 P123；`bun run check:zones` exit 0。
- **C3 迁移零残留**：`grep -rn "workbench/" --include=*.ts --include=*.vue --include=*.mjs src/ tests/ spikes/ tools/ .github/` 零命中（attic 内自指豁免）；`git status` 无 workbench 顶层残留；ci.yml job 路径 = attic/dsh-workbench。
- **C4 钉扎与冒烟复跑绿**：`bun test tests/engine/rebuild/` 26/26；`node spikes/s-pi/backend-smoke/t24/prompt-assembly-smoke.mjs` 30/30；`bun spikes/probes/probe-t45-old-route.mjs` 旧 404 新 failures=0（需 dev 链，实证记录）。
- **C5 登记落位**：spike 06 SP-a2 节 = 路线乙决定版；S4 四处修正（§2 SP-a 行 / §3 补洞行 / §4 T-A5 行 / §7 新生图 provider 行 + 双源收编行）grep 可验。
- **C6 门禁与回归**：九项门禁全绿（format/lint/tsgo/vue/i18n/docs/zones/bindings/tasks）；全量回归对照 T46 基线 79 fail/2661 失败数不增、唯一化 diff 零本任务文件。
- **C7 登记面**：tracker/_index T47 行；本任务三件套齐。

## 5. 不做（out of scope）

- studio/Recipe/Preset 命名改动（#2 问答项，待 owner 拍板）。
- 生图 provider 代码实现（路线乙只是登记；实现属 W2 T-B 批 generate_image 工具）。
- W2/W3 组装消费改造（base.md 落位语义仍是注册表在案）。
- attic 内 DSH bundle 的任何功能改动（纯归档，连注释都不润色——ci.yml 路径除外）。
- system-prompt.md 与 system-prompt-base.md 的内容重构（双源收编属 W2）。

## 6. 风险与回退

- **保真等式随源切换失效风险**：新源更短、无示例锚点，补洞段改文末追加——构建器/核验脚本同步改写 + 幂等复跑双验证（C1）。回退 = `git checkout` 两脚本与 base.md。
- **CI job 路径改错**：workbench-build 是真实 CI 守门（X1 raw-JSX 回归）；本地无法跑 CI——静态核验（yaml 路径 grep + npm script 存在性）+ push 后首跑观察（当前 push 阻塞，登记为观察项）。回退 = 单文件 revert。
- **引用清扫漏网**：以 C3 grep 零命中为硬卡口；文档类引用逐文件人工复查清单入自检。
- **attic 重入风险**：attic README 搁置声明 + zones reason 写明「勿在此新增文件」。

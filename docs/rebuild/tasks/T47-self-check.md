<!--
  写作纪律（改本文前必读）：
  - 事实性声明必须附核验命令 + 日期，否则标为【假设】
  - 计划被实测推翻时，直接改本文为新版本，完整理由记入 records/ 子文档
  - 本文只保留当前态，不保留修正历史
  - 改完后刷新本文头部的「状态」字段
  - 详细规则见 docs/rebuild/05-process.md §4
-->

# T47 自检 · W1 收口后修正批：base 转写源切换 + workbench 归档迁移 + 生图路线乙登记

> **状态**：✅ 已收口（独立核验通过，findings 2 条已修） | **时间**：2026-08-31 立项；2026-08-31 实现；2026-08-31 收口 | **负责人**：主 agent
> **⚠ 当前态修正（T49，2026-08-31）**：红线补洞段及配套机制已全部撤除（过度工程），base.md 回归 119 行纯转写；本文补洞段位置决策等补洞相关口径为历史记录，现役口径见 T49 三件套
> **关联**：[T47-plan.md](T47-plan.md)（验收标准 C1-C7 以其 §4 为准）

## 1. 立项段自检（2026-08-31）

- [x] 指令来源复核（2026-08-31，本会话原文）：#6「base 现在复制的是 system-prompt.md，而不是 system-prompt-base.md，请改过来，应该要暂用更加 workflow 无关的 system-prompt-base.md」；#4「workbench 目录是已经搁置的 DSH plugin 形态产品路线的遗留物，如果有误导应该改名 + 错误放置的文件迁移出来」；#1「生图走路线乙，自写 GPT image 2 形状 provider 作为当前核心 provider，pi-ai 的 generateImages 作为未来可拓展支持项，DMX 不走 pi-ai，不用做探针任务」。
- [x] #6 目标文件实证（2026-08-31）：`src/app/ai/pi-backend/prompts/system-prompt-base.md` 存在（`wc -l` = 119；T24 头注自述「marketing 模式 base 段，移植自上游 fork」）；modes.ts:43 实证 marketing basePromptPath 已指此文件。119 行源无 `# Example: mobile app UI` 锚点（grep 0 命中）→ 补洞段位置决策 = 文末（D-b）。
- [x] #4 目录来历实证（2026-08-31）：workbench/README.md 首行「openpencil-marketing（workbench/）… dsh bundle」+ cordis.patch.yml/presets/src 俱全 → DSH plugin 路线遗留物坐实；`.github/workflows/ci.yml:151-186` workbench-build job 在役（路径须随改名更新）；lint/format:check 范围均不含 workbench/（package.json:27/30 实证，改名零门禁联动）；workbench/.gitignore 自包含（node_modules/lib/assets，随目录走）。
- [x] #4 混入清单盘点（2026-08-31，`ls workbench/`）：T43-T46 期间混入 = build-t46-base.mjs、verify-t44/t45/t46 三件、verify-t45-manifest-dump.json、probe-sp-a1/sp-b/sp-c/t41/t45-old-route 五件、t45-rewire-assembly-smoke.py、t45/t46-failures.txt 两件、t45/t46-regression-run.log 两件（.log 未入库）。
- [x] #1 旧仓形状实证（2026-08-31）：`open-pencil/packages/core/src/tools/image-gen/providers.ts:79-217`——baseURL dmxapi.cn/v1、model gpt-image-2-ssvip、`/images/generations` + `/images/edits`；pi-ai 侧 openrouter-images 为 dist/api 唯一图像模块（`ls` 实证无 images/generations 模块）→ 路线分叉判据成立，路线乙 = 自写 provider。
- [x] 文档引用面盘点（2026-08-31，grep workbench）：docs/rebuild 下 T41/T44/T45/T46 三件套 + spike 06 共 ~25 处引用，实现段逐文件改写并清单化。
- [x] S4 修文点位盘点（2026-08-31）：§2 SP 表 SP-a 行（L19）、§3 补洞行（L33）、§4 T-A5 行（L44）、§7 双源收编行 + 新增生图 provider 行。

## 2. 实现段自检（2026-08-31）

### 红线齐全性判定表（119 行新源，grep 实证 2026-08-31）

| 红线 | 新源现状 | 处置 |
|---|---|---|
| #3 事实零虚构 | 0 命中（`invent\|fabricat\|hallucinat\|make up`） | 补洞段规则 1（豁免文案创作） |
| #2 成本确认 | 1 命中但为 eval 语义「counter ≠ confirmation」（L121），非成本纪律 | 补洞段规则 2 |
| #6 可撤销 | 0 命中（`undo`） | 补洞段规则 3（宿主 undo burst 承载 + prose 协作句） |
| #8 不静默降级 | 1 命中为字重回退带警告（L35「fall back to 400 with a warning」——带警示的降级恰是合格局部实例），无通则 | 补洞段规则 4 通则化（删 stock_photo 401 引用——该规则属 system-prompt.md 长图 workflow 段，不在本源） |

结论：四条红线在 119 行源中仍全缺/半缺，补洞段整体保留（内容随 T47 微调规则 4）。

### 实现项核验

- [x] **C1 转写保真（新源）**（2026-08-31）：`node tools/rebuild/src/verify/t46-base-fidelity.mjs` → 6/6；build → format → verify → build 循环字节稳定（12434 bytes 两次一致，`git status` 零增长）——幂等坐实。
- [x] **C2 回退干净**（2026-08-31）：`git diff rebuild/pi -- src/app/ai/chat/system-prompt.md` 输出为空；zones.json P123 已删；`bun run check:zones` clean。
- [x] **C3 迁移零残留**（2026-08-31）：`grep -rn "workbench/" src/ tests/ spikes/ tools/ .github/ --include=*.ts/vue/mjs/yml` 零命中（attic 内自指豁免）；`ls workbench` 不存在；ci.yml job working-directory 与三条 grep 均指 attic/dsh-workbench。docs 清扫豁免：T14-T18 DSH 时代叙事文档对 workbench/ 的引用为历史记录（目录本身的曾用名），由 attic README 搁置声明承载映射——不动。
- [x] **C4 钉扎复跑**（2026-08-31）：`bun test tests/engine/rebuild/` 26/26。
- [x] **C5 登记落位**（2026-08-31）：spike 06 SP-a2 节 = 路线乙决定版 + 头部状态行 + 结论区行 + 探针路径 ×3；records 镜像（narrative/06 §SP-a2 行、topics/spikes.md 两行）同步；S4 v3 修订行 + §2/§3/§4/§7 五处。
- [x] **T46 文档当前态修正**（2026-08-31）：T46 三件套各加「⚠ 当前态修正（T47）」指针行；T46-plan 状态行遗留翻转补正（🔄→✅）；全部迁移文件路径引用批量改写（12 文件 + 相对链接 4 处）。
- [x] **C6 门禁与回归**（2026-08-31）：format:check 全绿（2098 文件）；lint 0 errors/5 warnings（回基线）；`bunx tsgo --noEmit` exit 0；check:vue exit 0；check:i18n in sync；check:docs 42/42；check:zones clean（P123 删 / P35 改 / P124 增）；check:bindings/check:tasks 见 pre-commit 输出。全量回归（run 日志仓外 `doc/t47-regression-run.log` 492.32s 完整跑完）：**77 fail / 2661 tests**（对照 T46 基线 79/2661，失败数不增）；唯一化去抖 diff（74 → 72 行）：T46 三条 flake 本轮转绿，新增 1 条 MCP stdio transport「stderr does not contain JSON-RPC」——隔离复跑 9/9 全绿确为 flake；零本任务文件。
- [x] **C7 登记面**（2026-08-31）：tracker/_index T47 行 🔄 在案；三件套齐。
- [x] **D-b 补洞段适配**：位置 = 文末（119 行源无 `# Example` 锚点，grep 0 命中实证）；规则 4 去 stock_photo 引用；块前结构空行纳入 BLOCK_RE 剥除（保真等式修偏一处，见修正记录 1）。

### 实测修正记录

1. **BLOCK_RE 多一字偏差**：补洞段移文末后，首版等式 base 侧残留块前结构空行（构建器附加、源侧没有）→ 标记块剥除正则扩为含前导 `\n`（两脚本同步），等式复零。
2. **git mv workbench 失败**：Windows 下 `git mv`/`mv` 均 Permission denied（无进程占用实证，疑杀软/索引器瞬时锁）→ 改 `cp -r` + `rm -rf` + `git add -A`，git 按内容识别为 rename（`git status` R 标记确认）。
3. **zones.json P123 删尾条目留尾逗号**：JSON 语法错误被 check:zones 当场抓住 → 修正前一条目闭括号。
4. **文档批扫误伤 T47-plan 叙事**：迁移文件的「源路径 → 新路径」描述箭头源侧被批量替换吃掉 → 人工还原两处叙事行。
5. **oxfmt 重排新脚本**：build/verify 两脚本初写格式非典范 → format 一遍 + 构建器复跑字节不变，build→format 循环稳定（沿用 T46 F1 教训的验证法）。
6. **迁入 tools/ 激活 lint 新视野**：workbench/ 本在 lint:structure 范围外，迁入后 verify-t45-manifest-dump.mjs 两个休眠 error（no-promise-executor-return ×2、no-math-random ×1）被激活 → 诚实修代码（Promise executor 加花括号；端口随机化改 `process.pid % 200`）；no-console 警告类按 `tools/**/*.ts` 既有豁免同口径扩 `tools/**/*.mjs`（oxlint.json override 5，登记 P124）——lint 回基线 0 errors/5 warnings。
7. **文档链接批扫两轮**：第一轮路径 token 替换（12 文件）后，第二轮 `](../../../workbench/` 相对链接替换（T14/T15-self-check 证据图与 README 链接 4 处）——纯文本提及与相对链接是两套模式，一轮扫不干净。
8. **管道符吞 format:check 失败码**：`bun run format:check 2>&1 | tail -1 && …` 管道退出码取 tail，format 失败被吞，实现 commit a2b3f3f5 带着一处未典范化文件通过 → 补 commit 2c1c0b6e 典范化。教训：门禁命令串管道时必须 `${PIPESTATUS[0]}` 或分步执行。

<!--
  写作纪律（改本文前必读）：
  - 事实性声明必须附核验命令 + 日期，否则标为【假设】
  - 计划被实测推翻时，直接改本文为新版本，完整理由记入 records/ 子文档
  - 本文只保留当前态，不保留修正历史
  - 改完后刷新本文头部的「状态」字段
  - 详细规则见 docs/rebuild/05-process.md §4
-->

# T45 自检 · manifest 投影改源 + brand 链退役（S4 W1 / T-A3）

> **状态**：✅ 实现段自检完成（待独立核验） | **时间**：2026-08-31 立项；2026-08-31 实现 | **负责人**：主 agent
> **关联**：[T45-plan.md](T45-plan.md)（验收标准 C1-C6 以其 §4 为准）

## 1. 立项段自检（2026-08-31）

- [x] 消费面全景实证（逐一 Read/grep，2026-08-31）：service.ts（:45/:121/:209/:408）、server.ts（:246/:273）、prompt-overlay.ts（:16 + 文案）、mode-selection.ts（fetch+类型+符号）、ChatStyleProfileSelect.vue（只读 profiles 平铺）——共 5 文件，全部列入 T45-plan §1 表。
- [x] 测试/脚本零消费旧端点与 overlay：`grep -rln "buildMarketingOverlay|brand/manifest|brandManifest|getBrandManifest" tests/ scripts/ tools/` 无命中（2026-08-31）→ 更名无测试面连锁。
- [x] smoke:pi 脚本不涉端点：`grep -rn "brand" scripts/ tools/` 无命中（2026-08-31）。
- [x] docs 历史档案（T24 三件套、01 旧五环表）含旧端点字面——封存记录不改，已在 C2 口径中显式豁免。
- [x] studio 注册表公共 API 复核：`getStudioRegistry(rootDir)` 走约定目录（内置 `<rootDir>/src/app/ai/pi-backend/studio/` + 用户 `~/.openpencil/studio/`），与 service.ts 的 rootDir 注入模型一致（brand/index.ts 同先例）。
- [x] 信任边界两处维持：profile body 不下发（T24 D7）+ failures 绝对路径不下发（本任务新增相对化，D-a）。
- [x] 中间态明确：base.md 未落位 → manifest.failures 恒含 base 缺失一条（D-g），T44 钉扎测试不动。
- [x] 三件套立项即建档（本文 + T45-verify.md），无占位禁词。

## 2. 实现段自检（2026-08-31）

### C1 新端点实证 ✅

- 旧路径不命中：`bun workbench/probe-t45-old-route.mjs`（2026-08-31）→ `旧路径 GET /api/pi/brand/manifest → 404 Not Found`；同探针新路径 200，`modes=[general(0types), longform(3types)]；profiles=3；failures=1（base:base.md）`——modes 展开、摘要、failures 相对路径三段俱全。
- `bun spikes/s-pi/backend-smoke/t24/prompt-assembly-smoke.mjs`（2026-08-31）→ **29 passed / 0 failed**：manifest 断言组覆盖三 type 展开（750x/750x/1080x）、profiles 三摘要 applicableTo=[longform]、无任何 body/markdown 键、非 GET → 405、未鉴权 → 401、无资产后端降级（modes=[general]、profiles=[]、failures 含 kind=studio 整体态）。
- vite proxy 路径实证：截图阶段 `curl http://localhost:1421/api/pi/studio/manifest` → 200（2026-08-31）。

### C2 brand 链退休 ✅

- `git rm` 删除 `src/app/ai/pi-backend/brand/`（config.yaml / index.ts / manifest.ts 三文件）。
- 零残留（2026-08-31）：`grep -rn "loadBrandSeed|toBrandManifest|PiBrandManifest|api/pi/brand/manifest|piBrandManifest|ensurePiBrandManifest" src/ tests/ scripts/ tools/ spikes/` 无命中（docs/rebuild 历史档案按 C2 口径豁免）。

### C3 overlay 改源 ✅

- 适配纯函数 `studioOverlayInput(registry)`（prompt-overlay.ts）：types 从 workflows 拍平、profiles={id, markdown:body}；`tests/engine/rebuild/studio-manifest.test.ts` 第 5 测钉扎（5/5 绿，见 C5）。
- 端侧实证（prompt-assembly-smoke 29/29 内）：overlay 含注册表 type 条目 `- ecommerce_detail (电商详情页) — 750x`；picked watercolor_poster_v3 注入 `# 水彩海报` 正文；bogus id → `(not in studio registry)` re-pick 段；无资产后端 → fallback 引导段；ui 模式探针与 system-prompt.md byte 级一致（零 overlay）。

### C4 前端实证 ✅

- 脚本半：`node spikes/s-pi/backend-smoke/t24/mode-overlay-bind-smoke.mjs http://localhost:1421`（2026-08-31）→ **17 passed / 0 failed**：下拉列出注册表三精品（杂志封面海报/水彩海报 v3/扁平几何海报）+ No style profile；选中发送 pickedProfileId=watercolor_poster_v3 且载荷最小；刷新持久化；manifest 路由拦死 → 禁用空态降级。
- 截图半（Playwright MCP，2026-08-31）：仓外 `doc/t45-profile-dropdown.png`——marketing 模式下 profile 下拉经新端点列出三精品。
- 运行拓扑：本 worktree dev server（vite 1421 + 内嵌后端子进程 7701，`OPENPENCIL_PI_BACKEND_PORT=7701 bun run dev -- --port 1421`）；⚠ bind 冒烟必须 node（bun 卡 CDP 握手，脚本头注有实证记录）。

### C5 测试与门禁 ✅

- 新单测 + 范围回归：`bun test tests/engine/rebuild/`（2026-08-31）→ **25 pass / 0 fail / 5 文件**（studio-registry 16 + 钉扎 1 + studio-manifest 5 + 其余 3）。
- 门禁九项（2026-08-31）：check:zones clean（67 modified/379 added/1014 deleted 全登记）；check:docs 42/42；check:tasks 通过（T45 三件套齐全）；check:bindings 18 文件全绿；lint 0 errors / 5 warnings（基线告警）；`bunx tsgo --noEmit` exit 0；check:vue exit 0；format:check 全绿；check:i18n in sync。
- 全量回归（`bun run test:unit:quick`，558s，2026-08-31）：**78 fail / 2660 tests / 434 files**。对照 T44 基线 77 fail/2655：唯一化 diff（workbench/t45-failures.txt 73 行 vs /tmp/t44-fails.txt 72 行，sort -u）**仅 +1 行** = `export subgraph extraction > fig export preserves imported instance symbol overrides and guids`——即 T44 核验记录的那例 fig 导出 flake（T43 基线 78 含之、T44 两轮 77/76 消失、本轮复现），隔离复跑 `bun test tests/engine/io/subgraph.test.ts` → 4/4 通过，与 T45 文件零关联；零 T45 文件失败（`grep -iE "studio|pi-backend|brand|overlay|mode-selection|manifest" workbench/t45-failures.txt` 无命中）。测试数 +5 = 新增 studio-manifest.test.ts 五测（全绿）。

### C6 登记 ✅

- tracker.md / tasks/_index.md T45 行立项时已登记（🔄）；收口 commit 翻 ✅。
- 三件套：T45-plan.md（立项）+ 本文 + T45-verify.md（立项建档，独立核验后重写）。

## 3. 实测修正记录（实现段，2026-08-31）

1. **spikes/ 消费面漏圈**：立项 grep 只覆盖 src/tests/scripts/tools，未含 spikes/——两个 T24 冒烟（prompt-assembly / mode-overlay-bind）消费旧 brand 链（种子复制 + 端点 + overlay 断言）。属在射程内连带（冒烟套件是旧源的 executable check），均已改源并重跑绿（29/29、17/17）。计划 §1 消费面表实际为 5 src 文件 + 2 spikes 冒烟。
2. **空目录 failures 计数**：studio-manifest 测试初版断言空目录 1 条 failure，实测 2 条（base 缺失 + 整体缺失态——整体态在零注册且有 failures 时即触发，T43 收口语义）——按实测改断言与注释。
3. **service.ts:434 shorthand 漏改**：函数更名后返回字面量 `getBrandManifest,` 未同步 → tsgo 3 错 + lint 3 错（同根），Edit 修复后双门清零。
4. **oxfmt 两道**（registry.ts、studio-manifest.test.ts）→ `bun run format` 收编，重跑 rebuild 测试 25/25 绿。
5. **dev 端口冲突**：1420/7700 被 open-pencil-rebuild worktree 的 dev server 占用（实证 `Get-CimInstance Win32_Process` 命令行路径）→ 实证拓扑改 1421/7701 隔离，未动对方进程。
6. **回归两轮 transient**：首轮 exit 127（T43/T44 同款 runner 瞬断）、次轮 bun 崩溃 exit 3（1209 行处）；第三轮完整跑完 558s——以第三轮为准。

## 4. 关键决策回执

- **failures 相对化在源头做**（registry.ts `fail()` 直接产相对路径 + `origin` 字段，候选带 `relPath`），而非投影层剥前缀——注册表全程不持绝对路径，投影零加工。plan §6 风险表预案「顺手改 T43 类型并同步钉扎测试」已执行：T43 注册表测试仅对 path 做 substring 断言（`includes('no-frontmatter')` 等），相对化后零回归（25/25）。
- **整体态 failure 投影**：`{path: '.', origin: 'builtin', kind: 'studio'}`——`.` 表「整个 studio 目录」语义，manifest 测试钉扎。
- **C4 双证据口径**：plan S8 写的是 Playwright 截图法；实现段以脚本冒烟（含请求体/持久化/降级断言，强于像素证据）+ MCP 截图双证据覆盖，截图按纪律存仓外 doc/。

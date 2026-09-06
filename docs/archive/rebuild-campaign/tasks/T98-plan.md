# T98-plan · 上游大合并（88c10770 → d82aaff9e）——执行 runbook

> **任务来源**：owner 拍板启动大合并（2026-09-05）；移植收尾后第一次上游吸收。
> **关联**：[06-zone-governance.md §5 合并 ritual](../06-zone-governance.md)（本计划是其首次实战）+ 外部预研报告 `docs/202609052127-zone-review-merge-prep.md`（工作区根 docs/，不在本仓）§10-§13 冲突量化与 P0 手术单
> **日期**：2026-09-05
> **执行模式**：主 agent 规划 + 收口；subagent 后台执行（Phase A 三件并行 → Phase B 单执行者落地 → Phase C 主 agent 收口）

### 三方坐标

| 方 | 引用 | 说明 |
| --- | --- | --- |
| base | `88c10770`（2026-08-24） | merge-base |
| upstream | `d82aaff9e`（2026-09-05，PR #644） | 合并目标。**注意**：外部预研报告分析的是 `7964b99ba`（2026-09-04）；7964b99ba..d82aaff9e 增量 5 commit 纯 i18n（PR #644 占位符基线，31 文件 +636/-1225），落在 P192/P193 改锚工作面内，fonts/draw 分析不受影响 |
| ours | `merge/upstream-2026-09`（自 rebuild/mode-arch `770d98307`） | 合并分支，worktree `../open-pencil-merge` |

### 已拍板战略决策（owner 2026-09-05）

1. **draw.ts 采用上游 labelParagraphCache 方案**，本地 T88 `drawTextByScript`/`segmentByScript` 分段渲染随 draw.ts 退役——前置条件：主 agent 在真实浏览器按 A2 清单验证 CJK 标签渲染（外部报告的 fallback 证据来自 Windows/node 系统字体，浏览器 CanvasKit-wasm 无系统回退，必须以 provider 注册链为准）
2. **fonts.ts `options` 参数不机械恢复**——A1 考古本地删除动机后按证据裁定
3. **外部报告吸收**：§10-§13 整理进本计划 §2/§4；其 §2 与行动项 3/4（chat 残留删文件+登记）已落地（`77e32774a`+`925a0f7a4`），过时标注

### 1. 工作量全景（主 agent 按 checker 真实语义复算）

152 个双边改动文件 = **99 deletedPaths 覆盖**（含无尾斜杠目录前缀如 `packages/harness`，外部报告按 `/` 前缀只算到 86）+ **9 owned** + **7 tarball** + **38 patch 锚定** + **0 未登记**。零盲区是本次合并最硬的底盘。

删除区复活（upstream 在 deletedPaths 前缀下新增）：**21 文件 / 5 前缀**（外部报告漏算 `tests/engine/cli/` 2 件，以本表为准）：

| 前缀 | 新增数 | 拍板 |
| --- | --- | --- |
| `src/components/chat/` | 11 | 维持删除（ChatNodePreview/ReasoningBlock owner 已拍板不引入；attachment 4 件 → 悬而未决项登记 §6） |
| `src/app/ai/chat/` | 4 | 维持删除（context/presentation/submission；A3 扫描是否有值得移植 fork/ 的修复） |
| `packages/cli/` | 2 | 维持删除，但 `commands/fonts.ts` 字体预备逻辑先经 A3 移植裁定 |
| `packages/mcp/` | 2 | 维持删除 |
| `tests/engine/cli/` | 2 | 维持删除 |

失锚 patch 5 条：P74（clipboard/system.ts 被上游拆目录 #601——评估退役）、P159/P170（R100 rename，合并后改锚）、P192/P193（i18n 域命名空间迁移——改锚到新家并重删 25 键；注意 d82aaff9e 的 PR #644 又动了 i18n，改锚以合并后实况为准）。

### 2. Phase A 手术件契约（并行 subagent，各自 worktree）

| 代理 | worktree / 分支 | 交付物 | 状态 |
| --- | --- | --- | --- |
| A1 fonts.ts 融合 | `../open-pencil-ma-fonts` / merge-artifacts/fonts | `merge-artifacts/P0-fonts/{fonts.ts, DECISION.md, RISKS.md}`；含 options 考古裁定 | 进行中 |
| A2 draw.ts 采用 | `../open-pencil-ma-draw` / merge-artifacts/draw | `merge-artifacts/P0-draw/{draw.ts, NOTES.md, PATCH-DISPOSITIONS.md, BROWSER-VERIFY-CHECKLIST.md}` | 进行中 |
| A3 台账吸收裁定 | `../open-pencil-ma-reloc` / merge-artifacts/relocations | `merge-artifacts/relocations/{ABSORPTION-PLAN.md, ports/}` | 进行中 |

Phase B 执行前置：A1 + A2 交付。A3 不阻塞合并本体——cli fonts 移植件若裁定 ABSORB，作为合并分支上的独立后续 commit 落（core/io 不依赖合并冲突解决）。

### 3. Phase B 执行步骤（单执行者 subagent，在 `../open-pencil-merge` 内严格按序）

**Step 0 · 合并前 zones 预记账**（独立 commit，`task: T98`，CHECK_HOOKS_SKIP 落账先例）：
- T63 tarball 退役（paths 已空，从 `upstreamMergeTarball` 移除条目）
- P74 评估：读 P74 patch 内容 vs 上游 `src/app/editor/clipboard/system/` 新结构——上游已覆盖则 `disposition: revoked` 并注明「被上游 #601 吸收」；未覆盖则等合并落地后重锚到 system/ 继任文件
- A2 PATCH-DISPOSITIONS.md 中与 draw.ts 采用直接相关的 revoked 预先落账

**Step 1 · 起合并**：`git merge refs/remotes/upstream/master --no-commit --no-ff`。预期大量冲突，属正常。

**Step 2 · 机械性 ours**：`package.json`（见下方例外）、`AGENTS.md`、`README.md`、`CONTRIBUTING.md`、`lint/plugin.js`、`knip.json`、`oxlint.json`、`.oxfmtrc.json`、`SECURITY.md`、`.devcontainer/*`、`.github/ISSUE_TEMPLATE/*`、`src/app.css`、`src/theme/chat/markdown.*` 等 → `git checkout --ours`。
- **package.json 例外**：先 `git diff 88c10770..refs/remotes/upstream/master -- package.json` 扫上游新增 dependencies/devDependencies——合并后代码若需要（如 tools/i18n 新依赖），手工吸收进我们的 package.json 再 checkout ours 语义合并。
- `bun.lock`：取 ours，Step 8 用 `bun install` 依合并后 package.json 重生成。

**Step 3 · deleted-by-us 冲突（99 文件）**：`git status` 里 `deleted by us` 的全部 `git rm`——06 §5.3 拍板维持删除。

**Step 4 · P0 文件落手术件**：
- `packages/core/src/text/fonts.ts` ← A1 `merge-artifacts/P0-fonts/fonts.ts` 整文件覆盖，`git add`
- `packages/core/src/canvas/labels/draw.ts` ← A2 `merge-artifacts/P0-draw/draw.ts` 整文件覆盖，`git add`
- 若 A2 扫荡结论允许，同步删除 drawTextByScript/segmentByScript/truncateToWidth/pickFontForSegment 的死代码定义（仅当全仓零调用点后）

**Step 5 · 其余人工判断文件**（按外部报告 §10 难度列逐个三方比对）：
- `packages/core/src/constants.ts`（中）：合并上游 capabilities 字段，保住 P51 删 harness + P120 hasWindowGlobal——确认 harness 相关常量删除不与上游新增冲突
- `packages/core/src/canvas/scene.ts`（低）：本地 +19 行字体缓存复用，融入上游 +265 行版本
- `packages/core/src/canvas/renderer.ts` / `renderer/fonts.ts` / `renderer/lifecycle.ts` / `labels/selection.ts`（低）：本地 T88 改动 vs 上游小改，逐 hunk 融合；**renderer/fonts.ts 保留**（上游仅清理 import，我们的多 typeface 系统服务其他渲染路径——以 A2 扫荡结论为准）
- `packages/core/src/figma-api/index.ts`、`packages/core/src/clipboard.ts`、`packages/vue/src/canvas/useCanvasInput.ts`（低/极低）：常规三方融合
- **i18n 两件**（`packages/vue/src/i18n/messages/dialogs.ts` + `locales/zh-cn/dialogs.json`）：以上游为准——但这两个文件上游已删（be942783d 域命名空间迁移）！合并落地后按实况改锚：P192/P193 的「删 25 键」语义要在迁移后的新家文件上重放（先 `git log` 找到 25 键的新位置，在新文件上删对应键），zones.json patch.file 改指新路径

**Step 6 · rename 改锚**：合并落地后 `tests/engine/render/canvas/visual/boolean.test.ts` 与 `tools/visual-oracles/src/operations/export-fixtures.ts` 新路径就位——zones.json P159/P170 的 patch.file 改指新路径。

**Step 7 · 复活文件清除**：上游新增落 deletedPaths 前缀的 21 文件 `git rm`（`packages/cli/commands/fonts.ts` 若 A3 裁定 ABSORB，先确认移植件已另行落账再删）。

**Step 8 · 依赖与门禁**：`bun install`（重生成 bun.lock）→ `bun run check:zones` 必须 clean（含 RELOCATION_WATCH advisory 输出归档）→ 触碰文件过 oxfmt/oxlint → 串行单文件测试（资源纪律：一次一个，禁止全量 bun test）：
- `tests/engine/rebuild/` 下字体/渲染相关
- `tests/engine/render/canvas/visual/boolean.test.ts`（P159 改锚目标）
- i18n 相关测试
- 其余由执行者按 RISKS.md（A1）与改动面自选，单文件串行

**Step 9 · zones.json 总落账**（执行者起草 diff，主 agent 收口时逐条 review）：patch 改锚 3-4 条 + revoked 若干（A2 清单 + P74）+ T63 退役（Step 0 已做则核账）+ `$comment` 追加 T98 合并摘要。

**Step 10 · 提交**：分段 commit（建议：预记账 / 合并落地+冲突解决 / 复活清除 / 改锚落账 / lockfile+门禁绿），message 均含 `task: T98`。合并 commit message 记录三方坐标与关键战略决策。

### 4. Phase C 收口（主 agent）

1. review Phase B 全部 diff（重点：zones.json 每条改动、fonts.ts/draw.ts 手术件落点、i18n 25 键新家重删证据）
2. 浏览器验证（主 agent 独占）：A2 BROWSER-VERIFY-CHECKLIST.md 全项 + chat 输入框回归（ux6 战场不能破）
3. 四门禁 + T98 self-check/verify 填实
4. `rebuild/mode-arch` 合回 `merge/upstream-2026-09`（merge --no-ff），清理 4 个 worktree 与分支
5. 最终报告（含 A3 attachment 事实清单呈 owner 拍板）

### 5. 验收标准

1. 合并落地后 `bun run check:zones` exit 0（advisory 不计）
2. `bun run check:docs` / `check:bindings` / `check:tasks` 全绿
3. fonts.ts/draw.ts 手术件与 A1/A2 交付一致，options 裁定有考古证据链
4. i18n 25 键在上游新家完成重删（或证明键已不存在）
5. 浏览器验证清单全过（CJK/混合/阿拉伯语标签 + 截断 + 白名单场景）
6. ux6 chat 输入框浏览器回归无 pageerror

### 6. 悬而未决登记

| 项 | 状态 | 去向 |
| --- | --- | --- |
| attachment 全套（`src/app/ai/attachment/` + `src/components/chat/attachment/`） | owner 悬而未决 | A3 事实清单 → 合并后 owner 拍板，若要引入开新任务 |
| P74 退役/重锚 | Phase B Step 0 执行者提案 | 主 agent 收口确认 |
| fonts.ts `options` 恢复与否 | A1 考古中 | 证据裁定，DECISION.md 记录 |
| T88 分段渲染的仓内其他调用点 | A2 扫荡中 | 若零调用则随 draw.ts 一并退役死代码 |

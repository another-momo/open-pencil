<!--
  写作纪律（改本文前必读）：
  - 事实性声明必须附核验命令 + 日期，否则标为【假设】
  - 本文只保留当前态，不保留修正历史
  - 详细规则见 docs/rebuild/05-process.md §4
-->

# tasks/T27-verify.md · T27 独立核验记录

> **T 编号**：T27（Phase 1 收口后整改 · 代码与机制面）
> **状态**：✅ 已核验（2026-08-25 独立 subagent 执行；核验员非实施者）

## 核验项（预审自 [T27-plan.md §2](T27-plan.md) 验收清单 C1-C6 派生）

| #   | 核验项                                                                                       | 结果   | 证据节 |
| --- | -------------------------------------------------------------------------------------------- | ------ | ------ |
| V1  | 三分法处置真实性：抽查 A2/A5/A14/A16/A20 五条「已改进」项的代码落点与自述一致                  | ✅     | §V1    |
| V2  | 证伪项复核：抽查 B1（并发双创建不可达）与 knip latent 证的 git diff 0 行论证                   | ✅     | §V2    |
| V3  | 门禁复跑：tsgo / check:zones / check:docs / check:bindings / check:tasks / lint / check:i18n   | ✅     | §V3    |
| V4  | 冒烟复跑：`bun run smoke:pi` 59 断言全绿                                                       | ✅     | §V4    |
| V5  | 边界完整性：zones.json P51-P56 登记与 follow 区改动一一对应；无清单外文件改动                  | ✅     | §V5    |
| V6  | 远端 CI 复验（05 附录 B.3 口径）：`gh run view` 本任务收口 commit 的 rebuild/pi run 结论全绿   | ✅     | §V6    |

## 证据

### §V1 五条「已改进」落点抽查（全过）

- **A2（SSE 断连 abort）**：`src/app/ai/pi-backend/server.ts:129-131` 实有 `res.on('close', () => { if (!res.writableEnded) void service.abort(sessionId) })`（writableEnded 守卫不误伤正常收尾）；`service.ts:376-391` `abort()` 带 `entry?.running` 门（:378 空闲 session 直接 return）+ try/catch 吞错出声（:383-390），与自述「abort 只打活跃 run」一致
- **A5（旧 ToolLoop 死数据面切除）**：`ls src/app/ai/tools/` → No such file or directory（整删）；`grep -rn "didHitStepLimit" src/` → 零命中；`grep -n "showContinue\|Continue" src/components/ChatPanel.vue` → 零命中（ChatPanel 在 src/components/ 根目录，非 chat/ 子目录）
- **A14（catalog DTO 单源）**：`src/app/ai/pi-backend/catalog.ts` 存在，纯类型模块（头注释自述零运行时 import）；`client.ts:18` 与 `provider-admin.ts:26` 均为 `import type { PiCatalog, ... } from './catalog'`（type-only 消费）
- **A16（harness 死标识）**：`grep -rn "harness:pi\|HARNESS_PROVIDER_ID\|harnessThinking"` 在 src/、packages/core/src/、packages/vue/src/ 三路径逐一分跑均零命中；`ls src/components/settings/provider-select/` → No such file or directory（ProviderSelect.vue 整删）
- **A20（steiger drift 收口）**：`git diff 48a46385 39ce06a8 -- steiger.config.ts` 实有补注册 5 条（no-cross-package-reexport-shims / no-misplaced-engine-test-domain-paths / no-kitchen-sink-engine-basic-tests / no-production-test-ids-in-shared-layers / no-vue-template-ui-hooks-or-svg）+ 3 条挂起注记（17/4/1 处存量违规）；`tools/architecture/src/steiger-rules/index.ts` diff 实有 `import { readFileSync } from 'node:fs'` + `collectFiles` 导入补全与 `MACOS_MODIFIER_GLYPH_PATTERN` 加 `g` flag 两处修复

### §V2 证伪复核（成立）

- **B1 并发双创建窗口**：`service.ts:270-274` 复核注记在案——`get ?? await createSession` 窗口在 dev 单用户拓扑不可达；前端双重守卫实证：ChatInput.vue:29 `isStreaming` 禁输入（streaming/submitted 时 InputGroup disabled），ChatPanel.vue:204 `handleSubmit` 起始 `if (status.value === 'streaming' || status.value === 'submitted') return`（另 :188 同构守卫）。绕过 UI 的手工并发代价有界（后者顶掉 entry、JSONL 各自独立）——证伪结论可接受
- **knip latent**：`git diff 48a46385 39ce06a8 --stat -- src/app/tabs/` → 0 行（tabs 四项非本次引入成立）；spikes/ 两文件改动仅为头注释 stale 路径修正（A15 计划内，与 taskkill/tabs 无关）；`git log -S "taskkill" --reverse` 首现 = 7643ca39（T14，远早于 T27）——pre-existing latent 证实；knip.json diff 显示本 commit 仅追加 `/src/app/tabs/index.ts` 与 `taskkill` 两条白名单收口

### §V3 门禁复跑（2026-08-25 本机逐项实跑，全绿）

| 门禁 | 实测输出要点 | 结果 |
|---|---|---|
| `node_modules/.bin/tsgo --noEmit` | exit 0 无输出 | ✅ |
| `bun run check:zones` | `clean: 51 modified (all registered), 257 added (owned), 1014 deleted (all registered), base 5201404f` | ✅ |
| `bun run check:docs` | `39/39 通过（R1-R5）` | ✅ |
| `bun run check:bindings` | 净树默认跳过；`--base 48a46385` 覆盖 T26+T27 变更集 → `66 文件变更，binding 全绿` | ✅ |
| `bun run check:tasks` | 净树默认跳过；`--base 48a46385` → 大改动四规则命中，`task T26 三件套齐全` | ✅ |
| `bun run lint` | `Found 3 warnings and 0 errors`（max-lines 存量警告），1333 文件 | ✅ |
| `bun run check:i18n` | `All locale files are in sync.` | ✅ |
| `bun run check:arch`（steiger） | `No problems found!` | ✅ |
| `bun run test:type-shapes` | `No duplicate object type shapes found.` | ✅ |
| `bun run check:deps`（knip） | exit 0 零发现（白名单收口生效） | ✅ |

### §V4 冒烟复跑（2026-08-25 本机逐套件实跑）

- `bun spikes/s-pi/backend-smoke/t22/target-smoke.mjs` → `6 passed, 0 failed`
- `bun spikes/s-pi/backend-smoke/t22/history-smoke.mjs` → `12 passed, 0 failed`
- `bun spikes/s-pi/backend-smoke/t23/sessions-smoke.mjs` → `14 passed, 0 failed`
- `bun spikes/s-pi/backend-smoke/t24/prompt-assembly-smoke.mjs` → `27 passed, 0 failed`
- 合计 **59/59 断言全过**，与 self-check §3 自述一致

### §V5 边界完整性

- P51-P56 登记文件 vs `git diff 48a46385 39ce06a8 --stat` 实际改动一一对应：P51=packages/core/src/constants.ts、P52=src/app/ai/debug/index.ts、P53=tools/secret-scan/src/index.ts、P54=steiger.config.ts、P55=tools/architecture/src/steiger-rules/index.ts、P56=packages/mcp/src/browser-rpc.ts——六文件均在 diff 清单内
- 既有条目追加 T27 注记实证（zones.json diff）：ChatPanel.vue / ChatInput.vue / transports.ts / use.ts / package.json / .gitignore / dialogs.ts（P38）/ zh-cn dialogs.json 八处；deletedPaths += `src/app/ai/tools`、`src/components/settings/provider-select`；ownedRoots 移除 `src/app/ai/tools/`
- 其余 follow 区改动归属核实：knip.json=P34 登记、PiModelsPanel.vue=ownedFiles、tools/hooks/与 spikes/ 与 tools/zone-registry/ 与 docs/ 均为 ownedRoots——check:zones 绿即机器判据全登记
- 小观察（不阻断）：P34（knip.json）未追加 T27 注记（其余既有条目均有），登记本身在案且门禁绿
- `git status --porcelain` 输出为空（净树；tests/fixtures phantom 未出现）

### §V6 远端 CI 复验（05 附录 B.3 口径）

- `gh run view 32809703730 -R another-momo/open-pencil --json conclusion,status,headSha,headBranch` → `conclusion=success, status=completed, headBranch=rebuild/pi, headSha=ebaa0e1c`（2026-08-25 独立 subagent 实跑）
- headSha ebaa0e1c = T26 文档面 commit（T27 代码面 39ce06a8 为其父），rebuild/pi 最新 run 全绿——覆盖 T27 收口面

## 总结论

**可以收口。** V1-V6 全过：五条「已改进」抽查代码落点与自述逐条一致；两条证伪论证（B1 不可达性、knip latent 非本次引入）经独立读盘与 git 证据复核成立；十项门禁本机复跑全绿（bindings/tasks 净树跳过项以 --base 48a46385 补验真实变更集）；冒烟 59/59 断言全过；zones.json 登记与改动一一对应、工作树干净；远端 CI 经 `gh run view` 独立复验 success。唯一观察项：P34（knip.json）未追加 T27 注记（登记在案、门禁绿，不阻断收口）。

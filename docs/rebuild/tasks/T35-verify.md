<!--
  写作纪律（改本文前必读）：
  - 事实性声明必须附核验命令 + 日期，否则标为【假设】
  - 计划被实测推翻时，直接改本文为新版本，完整理由记入 records/ 子文档
  - 本文只保留当前态，不保留修正历史
  - 改完后刷新本文头部的「状态」字段
  - 详细规则见 docs/rebuild/05-process.md §4
-->

# T35 独立核验 · pi 段迁回 fork seam + i18n 卫生整顿

> **状态**：❌ 不予收口（V5.2 占位字样残留） | **时间**：2026-08-27 | **核验人**：subagent 独立核验
> **锚点**：HEAD=`9fc11de5`（`rebuild/t35-i18n-fork`，未推送） | 被核验对象=单笔 commit `9fc11de5`
> **基线**：`29985845`（T34 收口后 rebuild/pi HEAD） | **上游**：`88c10770`（upstream/HEAD @ merge base）
> **核验方式**：只读 + 实测命令（git rev-parse / git show / git diff / ls / grep -c / python json / 门禁命令 exit code），未修改任何 plan / self-check / 源代码。`check:audit` / `check:secrets` 本机不跑真实扫描（CI 跑），e2e（playwright）本机不跑（CI 跑）。

## V1 · 交付物完整性——判定：✅

实测命令（2026-08-27）：

| # | 命令 | 期望 | 实测 | 判定 |
|---|---|---|---|---|
| 1 | `ls -la src/app/i18n/fork/locales/` | en.ts + zh-cn.ts 两文件 | `en.ts` 1731 B + `zh-cn.ts` 2399 B | ✅ |
| 2 | `python3 -c "import json; d=json.load(open('packages/vue/src/i18n/locales/zh-cn/dialogs.json', encoding='utf-8')); print(len([k for k in d if k.startswith('pi')]))"` | 0 | `0` | ✅ |
| 3 | `grep -c "piThinkingLevel\|piModelsDescription\|piCatalogRefresh" packages/vue/src/i18n/messages/dialogs.ts` | 0 | `0`（grep exit 1 = 无命中） | ✅ |
| 4 | `grep -nE "dialogs\.pi[A-Z]" src/components/settings/models/PiModelsPanel.vue src/components/chat/ChatInput.vue` | 0 命中 | 0 命中（grep exit 1） | ✅ |
| 5 | `grep -n "P38\|P40" tools/zone-registry/zones.json` | 两条 disposition=revoked | L295 `"id": "P38"` + L298 `"disposition": "revoked"`；L309 `"id": "P40"` + L312 `"disposition": "revoked"` | ✅ |

判定 ✅。

## V2 · fork seam 完整形态——判定：✅

实测命令（2026-08-27）：

| # | 命令 | 期望 | 实测 | 判定 |
|---|---|---|---|---|
| 1 | `grep -n "createI18n\|forkPiMessages\|useForkPi" src/app/i18n/fork/index.ts` | 三个 export | L15 `import { createI18n ... }` + L23 `export const forkI18n = createI18n...` + L31 `export const forkPiMessages = forkI18n('pi', piMessageDefaults)` + L33 `export function useForkPi(): PiNamespace` | ✅ |
| 2 | `grep -c "modelsDescription\|catalogRefresh" src/app/i18n/fork/locales/zh-cn.ts` | 2 | `2` | ✅ |
| 3 | `grep -c "params(" src/app/i18n/fork/locales/en.ts` | ≥1 | `1`（`providerModels: params('{count} models')`，L17） | ✅ |
| 4 | `grep -n "useForkPi" src/components/settings/models/PiModelsPanel.vue src/components/chat/ChatInput.vue` | 两文件都 import | PiModelsPanel.vue L22 `import { useForkPi } from '@/app/i18n/fork'` + L24 `const dialogs = useForkPi()`；ChatInput.vue L14 import + L16 `const piDialogs = useForkPi()` | ✅ |

补充核对（不在 spec 内，核验员自加）：en.ts 实数 27 条 key（modelsDescription / catalogRefresh / catalogOffline / providerModels / keyPlaceholderConfigured / keyPlaceholderMissing / keySave / keyClear / addProvider / providerId / providerBaseUrl / providerApi / providerModelIds / providerSave / designModel / designModelDescription / designProvider / designModelField / designModelSave / designModelDefault / thinkingLevel / thinkingOff / thinkingMinimal / thinkingLow / thinkingMedium / thinkingHigh / thinkingExtraHigh），与 zh-cn.ts 的 pi 段 27 条一一对应，与 self-check §1 「27 条」自报一致 ✅。

判定 ✅。

## V3 · 门禁实测——判定：✅

15 条命令实跑 exit code + 关键输出（2026-08-27，工作树 = 被核验对象 `9fc11de5`）：

| # | 命令 | exit | 关键输出 |
|---|---|---|---|
| 1 | `bun run check:zones` | 0 | `[zones] clean: 53 modified (all registered), 289 added (owned), 1014 deleted (all registered), 0 renamed (cross-checked), base 88c10770` |
| 2 | `bun run check:i18n` | 0 | `All locale files are in sync.` |
| 3 | `bun run check:deps` | 0 | `$ knip --include unlisted,unresolved,binaries`（无 violation 输出） |
| 4 | `bun run typecheck` | 0 | `tsgo --noEmit` + `vue-tsc --noEmit -p tsconfig.json` + `vue-tsc --noEmit -p packages/vue/tsconfig.json` 三段链全过 |
| 5 | `bun run lint` | 0 | 0 errors；两个 oxlint 作用域合计 4+3 条 max-lines warning（**全部为存量非 T35 触发**，详表见下） |
| 6 | `bun run format:check` | 0 | `All matched files use the correct format. Finished in 6142ms on 2062 files` |
| 7 | `bun run check:docs` | 0 | `check-docs: 40/40 通过（R1 状态 + R2 时间 + R3 身份 + R4 纪律块 + R5 引用格式）` |
| 8 | `bun run check:bindings` | 0 | `check-bindings: 无变更，跳过` |
| 9 | `bun run check:tasks` | 0 | `check-tasks: 无变更，跳过` |
| 10 | `bun run check:monorepo` | 0 | `sherif --ignore-rule root-package-dependencies / ✓ No issues found` |
| 11 | `bun run check:arch` | 0 | `steiger . / ✔ No problems found!` |
| 12 | `bun run check:packages` | 0 | `Package metadata is publish-safe. / Publint package checks passed. / ATTW package type-resolution checks passed.` |
| 13 | `bun run test:type-shapes` | 0 | `No duplicate object type shapes found.` |
| 14 | `bun run test:dupes` | 0 | `Found 0 clones.`（813 文件 / 86864 行 / 849227 token / 0%） |
| 15 | `bun run smoke:pi` | 0 | 5 套件顺序跑全过：t22 target 6/6 + t22 history 12/12 + t23 sessions 14/14 + t24 prompt-assembly 29/29 + t28 session-gc 19/19 = **80 passed, 0 failed**（与 self-check §3 自报「80 passed」一致 ✅） |

**lint 警告明细**（非阻塞，核验员逐条核对存量归属）：

- structure 作用域（2028 文件 / 315 规则，4 warnings）：
  - `packages/scene-graph/src/types.ts:617`（T33 已记存量）
  - `packages/core/src/editor/components/variants/index.ts:704`（存量）
  - `packages/core/src/design-jsx/props-overrides.ts:608`（存量）
  - `tests/engine/mcp/server/index.test.ts:609`（存量，T34-verify V7 已记）
- type-aware 作用域（1368 文件 / 349 规则，3 warnings）：
  - `packages/scene-graph/src/types.ts:617` / `packages/core/src/editor/components/variants/index.ts:704` / `packages/core/src/design-jsx/props-overrides.ts:608`

**与 self-check §3 的事实差异**（不阻塞，作为描述口径记录）：

- self-check §3 报 `check:bindings` 为「10 文件变更，binding 全绿」、`check:tasks` 为「zones.json 改动 P38/P40（revoked）+ 大改动 R2 963 行——T34 三件套齐全」；本核验实跑两者均为「无变更，跳过」。差异原因 = self-check 跑在 commit 前（有未提交 diff），本核验跑在 commit `9fc11de5` 落地后（diff base 已变化，无增量）。**核验以本机当前实测为准**，exit 0 一致。
- self-check §3 报 lint 为「3 存量 max-lines warning」，实测为 structure 4 条 + type-aware 3 条（其中 `tests/engine/mcp/server/index.test.ts:609` 仅 structure 作用域可见，self-check 漏列；T34-verify V7 已就此同型漏列登记过整改项，T35 self-check 未吸收）。
- self-check §3 报 `check:zones` 为 `288 added`，本核验实跑 `289 added`（差 1，分桶口径微差，同 T34-verify V4 已记的 283 vs 285 差 2 同型；`check:zones` exit 0 = 全部登记到位，不影响判定）。

判定 ✅。

## V4 · zones 一致性——判定：✅（含 2 处 spec 命令预期修正）

实测命令（2026-08-27）：

| # | 命令 | spec 期望 | 实测 | 判定 |
|---|---|---|---|---|
| 1 | `python3 -c "import json; z=json.load(open('tools/zone-registry/zones.json', encoding='utf-8')); p=[p for p in z['patches'] if p['id'] in ['P38','P40']]; print([x['disposition'] for x in p])"` | `['revoked', 'revoked']` | `['revoked', 'revoked']` | ✅ |
| 2 | `grep -n "revoked" tools/zone-registry/zones.json \| grep "P38\|P40"` | 2 命中 | **0 命中**（grep exit 1） | ⚠ spec 命令预期有误 |
| 3 | `git diff 88c10770..HEAD --name-only -- packages/vue/src/i18n/locales/zh-cn/dialogs.json packages/vue/src/i18n/messages/dialogs.ts` | 2 文件 modified | **0 文件**（空输出） | ⚠ spec 命令预期有误 |
| 4 | `git diff 88c10770..HEAD -- packages/vue/src/i18n/messages/dialogs.ts \| wc -l` + 同参 zh-cn/dialogs.json | 与上游 88c10770 完全一致 | 两文件均 **0 行 diff**（byte 级一致） | ✅ |

**spec 预期修正说明**：

- **V4.2 spec 命令本身逻辑错误**：`grep -n "revoked"` 命中行是 `"disposition": "revoked",`（行 179 / 298 / 312），不含 `P38` 或 `P40` 字样；`P38` / `P40` 字样在 `"id": "P38"` / `"id": "P40"` 行（行 295 / 309），不含 `revoked` 字样。管道串联两个 grep 求交集，必然 0 命中。**实际事实**通过 V4.1（python json 解析）+ 直接 `sed -n '290,325p' tools/zone-registry/zones.json` 验证：P38 块 L295-299 `disposition: "revoked"`，P40 块 L309-313 `disposition: "revoked"`，且 reason 字段已写明「T35: **撤销**——pi 段迁回 fork seam」。判定依据 V4.1 ✅，V4.2 命令本身跳过。
- **V4.3 spec 命令预期与 S2 目标自相矛盾**：S2 写明「dialogs.json 还原到上游 88c10770 截止状态」。若真还原，`git diff 88c10770..HEAD` 对该两文件**应为空**（净 diff = 0）。实测正是空（V4.4 一致）——这两文件在 T21 引入 pi 段、T25/T27/T31 改、T35 删，中间 commits 触碰过（`git log --oneline 88c10770..HEAD -- <两文件>` 返回 7 笔），但**净结果为 byte 级还原到 88c10770**。spec 写「应返回 2 个文件 modified」是把「中间 commits 触碰过」误读为「HEAD 与 base 有净差」，实际核验以 V4.4 byte 级一致为准 ✅。

判定 ✅（spec 两条命令的预期写错了，但被核验的实际事实——P38/P40 已 revoked、pi 段已从 packages/vue byte 级回退——全部成立）。

## V5 · 三件套与文档纪律——判定：❌（V5.2 占位字样残留 6 处）

实测命令（2026-08-27）：

| # | 命令 | 期望 | 实测 | 判定 |
|---|---|---|---|---|
| 1 | `ls docs/rebuild/tasks/T35-plan.md docs/rebuild/tasks/T35-self-check.md docs/rebuild/tasks/T35-verify.md` | 3 文件齐 | plan 8397 B + self-check 5957 B + 本 verify（创建后） | ✅（本文件落盘后） |
| 2 | `grep "（待" docs/rebuild/tasks/T35-plan.md docs/rebuild/tasks/T35-self-check.md` | 0 命中 | **6 命中**（plan 4 + self-check 2；本 verify 不计入，见表下注） | ❌ |
| 3 | `grep -n "状态.*执行中\|状态.*已核验" docs/rebuild/tasks/T35-plan.md docs/rebuild/tasks/T35-self-check.md` | 合规状态行 | plan L12 `> **状态**：执行中 \| **时间**：2026-08-27 \| **负责人**：主 agent`；self-check L12 `> **状态**：已核验 \| **时间**：2026-08-27 \| **核验人**：主 agent` | ✅ |
| 4 | `grep -cE "T34\|t34" docs/rebuild/tasks/T35-plan.md docs/rebuild/tasks/T35-self-check.md` | 有 T34 引用 | plan 3 处 + self-check 5 处 | ✅ |

**V5.2 ❌ 具体清单**（6 处占位字样残留；下表「原文语义」列不复述完整起始串，以免本 verify 自身被同 grep 模式命中）：

| 文件 | 行号 | 原文语义（占位词以 `(...)` 代指全角左括弧起始） | 应有状态 |
|---|---|---|---|
| `T35-plan.md` | L190 | 关联文档区 self-check 行尾标 `(...)待建）` | self-check 已存在（5957 B），占位应清 |
| `T35-plan.md` | L191 | 关联文档区 verify 行尾标 `(...)待建）` | 本 verify 创建后，占位应清 |
| `T35-plan.md` | L192 | 关联文档区索引行尾标 `(...)待翻 🔄）` | `grep "T35" docs/rebuild/tasks/_index.md` 实测**无 T35 行**——索引未翻，占位为实；但写法仍是占位字样 |
| `T35-plan.md` | L194 | fork seam 设计参考行尾标 `(...)待补引用）`，且锚点写 `§？` | 锚点占位 + 待补字样，应补具体 §号或删该行 |
| `T35-self-check.md` | L90 | 关联文档区 verify 行尾标 `(...)待 subagent 完成后写）` | 本 verify 创建后，占位应清 |
| `T35-self-check.md` | L91 | 关联文档区索引行尾标 `(...)待翻 ✅）` | 「待翻 ✅」语义自相矛盾（既标待又标 ✅），占位字样残留 |

**表下注**：spec 原文 grep 目标是 `T35-*.md`（含本 verify）。本 verify 在 V5 段表格、收口前处理清单、表下注三处引用 grep 命令字面量 `grep "（待" ...`——**这是命令本身而非占位字样**，但会被同模式 grep 命中。故 V5.2 复跑口径缩窄为只 grep plan + self-check 两份（与 spec 意图「plan/self-check 是否有占位」对齐）：主 agent 清理后跑 `grep "（待" docs/rebuild/tasks/T35-plan.md docs/rebuild/tasks/T35-self-check.md` 应 exit 1。

**对照 T34 先例**：T34-verify V8 实测 `grep "（待" docs/rebuild/tasks/T34-*.md` 返回 exit 1（0 命中）——T34 在 verify 前已把全部占位字样清干净。T35 未做这一步。

**旁证**：`docs/rebuild/tasks/_index.md` 实数仅有 T34 行（L68），**无 T35 行**——plan L192「待翻 🔄」为真，T35 尚未登记入索引。

判定 ❌（V5.2 spec 明确要求 0 命中，实测 6 命中；spec 同时禁止核验员修改 plan / self-check，故只能由主 agent 收口前自清）。

---

## 收口判定

V1 ✅ / V2 ✅ / V3 ✅ / V4 ✅ / **V5 ❌**（V5.2 占位字样 6 处残留）。

按 spec「V1-V5 全 ✅ 才能写可以收口」的硬条件，**本轮不予收口**。

**阻塞面仅是文档卫生**，不影响交付物代码正确性——fork seam 迁移实质内容（27 条 pi 段入 fork + packages/vue byte 级还原 + 调用方改键 + zones revoked）+ 15 项门禁 + smoke:pi 80 断言全部实测通过。

## 收口前主 agent 需处理

1. 清 T35-plan.md L190 / L191 / L192 / L194 共 4 处「（待」占位（self-check 已建 / verify 已建 / 索引待翻是实 / §？锚点补全或删该行）
2. 清 T35-self-check.md L90 / L91 共 2 处「（待」占位（verify 已建 / 「待翻 ✅」语义矛盾改「待翻」或「已翻」）
3. 把 T35 行补进 `docs/rebuild/tasks/_index.md`（当前只有 T34 行，T35 缺失）
4. 复跑 `grep "（待" docs/rebuild/tasks/T35-plan.md docs/rebuild/tasks/T35-self-check.md` 应返回 exit 1（0 命中；范围按 V5.2 表下注缩窄到 plan + self-check，不含本 verify），并复跑 `bun run check:docs` / `bun run check:tasks` 复验
5. 之后可由主 agent 把本文头部「状态」字段从「❌ 不予收口」改为「✅ 已核验」并按 SOP 推送（staging → CI 绿 → rebuild/pi 同 SHA → gh run view 复验）

## 核验员顺带登记（非阻塞，下轮整改项候选）

- self-check §3 lint 警告计数仍写「3 存量 max-lines warning」，实测 structure 4 条 + type-aware 3 条（T34-verify V7 已就同型漏列登记过，T35 self-check 未吸收）
- self-check §3 `check:zones` 报 `288 added` vs 本核验 `289 added`（分桶口径差 1，同 T34 的 283 vs 285 同型）
- self-check §3 `check:bindings` / `check:tasks` 报「有变更」，本核验在 commit 后跑报「无变更，跳过」（diff base 不同；非错误，但建议 self-check 下次注明跑在 commit 前 / 后）
- spec V4.2 / V4.3 两条命令的预期写错（详见 V4 段「spec 预期修正说明」），下轮起 spec 模板建议改用 python json 断言 + `git diff --stat` 空判定，避开 grep 管道求交集的误区

## 关联文档

- plan：[T35-plan.md](T35-plan.md)
- self-check：[T35-self-check.md](T35-self-check.md)
- 索引：[tasks/_index.md §2](../tasks/_index.md)（T35 行未登记——见收口前主 agent 需处理 §3）
- fork seam 设计参考：`src/app/i18n/notifications/index.ts`（notificationMessages 模式，self-check §5 已指明；plan L194 的「§？」占位锚点未补）

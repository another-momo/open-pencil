<!--
  写作纪律（改本文前必读）：
  - 事实性声明必须附核验命令 + 日期，否则标为【假设】
  - 计划被实测推翻时，直接改本文为新版本，完整理由记入 records/ 子文档
  - 本文只保留当前态，不保留修正历史
  - 改完后刷新本文头部的「状态」字段
  - 详细规则见 docs/rebuild/05-process.md §4
-->

# T36 自检 · T31/T34 合并质量整改

> **状态**：已自检 | **时间**：2026-08-28 | **核验人**：主 agent
> **分支**：`rebuild/t35-i18n-fork`（基线 `3f85a3e9`，T35 收口后 HEAD）
> **commit 链**：`0db31e46`（docs）→ `74782ded`（代码）→ `4a1ea773`（zones.json）→ `086b1856`（check.ts 三规则）

## 1. 交付物

### W1 登记/文档大扫除

- **`tools/zone-registry/zones.json`**（`4a1ea773`）：删 P8（目标 `src/app/ai/chat/storage.ts` 已删且在 deletedPaths，双重记账）/ P60 / P61（两测试文件与 base 88c10770 字节一致，幻影 patch）/ P98-P102（5 个对象为 fork 新建文件，已在 ownedFiles，互斥违规）；改写 P74 理由（真相 = T31 eslint-complexity helper 重构 61+/47-，非原登记口径）；P6/P44/P45 追记 T36 实做 + lastReviewed 2026-08-28；新增 P106（credentials.spec.ts）；$comment 追加大扫除说明。
- **`docs/rebuild/tracker.md`**：T32 行勘误（「12 个 ghost 含 1 个 AppButton.vue」→「11 个 ghost 全为 e2e snapshot png」，`git show 0fbfd65e --name-status` 实测 11 个 D 行，2026-08-28）；追加 T35 行（含 CI 链注记）/ T36 行；§3.1 计数 15→16；头部时间刷新。
- **`docs/rebuild/tasks/_index.md`**：T36 行 + 头部时间。
- **T35 三件套翻正**：`T35-verify.md` 头部 ❌→✅ + 复验追记（5 命令复验全过，诚实标注「复验工件此前缺失，本条为补记」）；`T35-plan.md` 状态→已完成 + C1-C9 实填。
- **`docs/rebuild/records/_index.md`**：§2 补 zones.json 自愿绑定行；计数 15→16 修正（注明 2026-08-25 口径漏记）。
- **records 追认**：`topics/upstream-merge.md` T36 追写（静默反转机制 + 拍板①②③④ + 顺带勘误 T32）；`topics/ci-infra.md` CI-16（T34 五 run 台账，逐条 gh 核验）/ CI-17（T35 链）；`narrative/tracker.md` 追加 2 条修正-N（自述≠事实教训 + T36 行）；`narrative/04-porting-discipline.md` / `narrative/zones.json.md` 各追加 1 条。

### W2 代码整改（`74782ded`）

- **`src/app/ai/chat/transports.ts`**：L10 `import { recordChatCompleted, recordChatFailed } from '@/app/diagnostics'`；L59 `handleChatFinish` 内 `recordChatCompleted({ finishReason: finishReason ?? null })`；L107 `onError` 内 `recordChatFailed({ errorName: ... })`。语义对齐上游 88c10770 版（`git show 88c10770:src/app/ai/chat/transports.ts` L150/L255，2026-08-28 核）。差异说明：上游 L150 在 `!isAbort && !isDisconnect && !isError` 分支，fork 面无 isDisconnect 信号，落 `!isAbort && !isError` 分支；上游 L107 的 token 级 `recordModelStepCompleted` 经 pi 后端采数，**不在本任务范围**（登记排期，见 T36-plan §5）。
- **`src/components/settings/SettingsDialog.vue`**：删 mcp 僵尸 nav 按钮；L151 裸 `v-else` 收窄为 `v-else-if="settingsDialogSection === 'storage'"`；L155 新增显式空态 `<div v-else ... data-test-id="settings-unknown-section" />`（带 T36 注释说明动机）。
- **`src/app/settings/dialog.ts`**：`SettingsSection` union 删 `'mcp'` 成员（oxfmt 后为单行）。
- **`tests/e2e/settings/credentials.spec.ts`**：删两条 MCP 测试（五条僵尸断言的宿主），余 3 测试（L5 storage / L37 model library / L75 remembered credentials），全文 114 行。
- **i18n `settingsMCP` 键保留**（拍板③ 权衡：字节一致保留 = 未来合并零冲突，理由写入 P44 reason）。

### W3 SOP（`0db31e46`）

- **`docs/rebuild/04-porting-discipline.md` §6**「上游合并 SOP 清单（T36 增补，2026-08-28）」：12 条规则逐条带实证引用（裁定对账表 / `git show HEAD` 存在性检查 / nav→panel 链 / oxfmt+format:check / shell-feature grep callers / 登记健康三规则 / 双向 ghost 扫描 / e2e 僵尸 test-id grep / CI 修复任务指针 + base=github.event.before / verify 断言级+裁定对账 / CI run 链入 ci-infra.md / tarball 纪律）。

### W4 检查器三规则（`086b1856`）

- **`tools/zone-registry/src/check.ts`**：新增 `checkPatchFilesExist`（R-exist：patch 文件必须存在于磁盘，revoked 豁免）/ `checkPatchRealDiff`（R-diff：patch 必须与 resolveBase 有真实 diff，revoked + upstreamMergeTarball.paths 豁免，40 个/批分片 `git diff --name-only`）/ `checkPatchMutex`（R-mutex：patch 不得与 ownedFiles/stubs/deletedPaths 重叠，deletedPaths 支持目录前缀）；三条接入 main() 违规汇总（判红 exit 1）；头部注释规则 6 文档化。

## 2. 关键决策（owner 拍板落位）

| 拍板 | 内容 | 落位 |
|---|---|---|
| ① | T31「diagnostics/usage 壳不采纳」追认接受 + chat 级接线 T36 实做 | transports.ts L10/L59/L107；token 级出栈登记 |
| ② | changelog / cli-import / portless 三处静默反转全部接受 | records/topics/upstream-merge.md T36 追写 |
| ③ | mcp nav 删除 + i18n 键保留权衡 | SettingsDialog.vue / dialog.ts / credentials.spec.ts；P44 reason |
| ④ | 三规则判红（先大扫除后上规则，同任务内） | check.ts；zones.json 先行清理使新规则下全绿 |

## 3. 门禁实测（2026-08-28，全部本机实跑）

| 命令 | exit | 关键输出 |
|---|---|---|
| `bun run check:zones` | 0 | `[zones] clean: 55 modified (all registered), 291 added (owned), 1014 deleted (all registered), 0 renamed (cross-checked), base 88c10770`——**新三规则生效下全绿** |
| `bun run check:docs` | 0 | 40/40 通过（R1-R5） |
| `bun run check:bindings` | 0 | commit 1 前：18 文件变更 binding 全绿；当前无变更跳过 |
| `bun run check:tasks` | 0 | commit 1 前：zones 摘要正确（新增 P106；移除 P8/P60/P61/P98-P102；改动 P6/P44/P45/P74）+ 大改动 R1/R2/R3/R4 命中、proxy T35 三件套齐全 |
| `bun run format:check` | 0 | All matched files use the correct format（2062 files） |
| `bunx tsgo --noEmit` | 0 | 无输出 |
| `bun run check:vue`（vue-tsc ×2） | 0 | 全绿（在 `bun run check` 内执行） |
| `bun run lint` | 0 | 0 errors；7 个 max-lines warning 全部位于 T36 未触碰文件（tests/engine/mcp/server/index.test.ts、packages/scene-graph/types.ts、packages/core 2 个等），存量 |
| `bun run check:i18n` | 0 | All locale files are in sync |
| `bun run check:packages` | 0 | metadata / publint / ATTW 全过（见 §5.2 插曲） |
| `bun run check:deps` | 0 | knip 无违规 |
| `bun run check:audit` | **1** | `bun audit` 请求 404——**环境红**（registry audit 端点不可达），非 T36 引入：`git diff 3f85a3e9 HEAD -- bun.lock` 为空（lockfile 未动，2026-08-28 核），audit 结果与本任务无关 |
| `bun run check:secrets` | 0 | SKIPPED（gitleaks/go 未装，环境受限，CI 跑真扫描——脚本自身设计口径） |
| `bun run check:monorepo` | 0 | sherif No issues found |
| `bun run check:arch` | 0 | steiger No problems found |
| `bun run test:type-shapes` | 0 | No duplicate object type shapes found |
| `bun run test:tools` | 0 | 4 pass / 0 fail |
| `bun run test:dupes` | 0 | jscpd 0 clones（exit 0） |
| `bun run smoke:pi` | 0 | 5 脚本链：6 + 12 + 14 + 29 + 19 = **80 passed, 0 failed**（与 T34/T35 口径一致） |
| `bun test ./tests/engine/app/diagnostics ./tests/engine/app/ai` | 0 | 15 pass / 0 fail / 29 expect（含 AI chat failures diagnostics 用例） |
| `bun test ./tests/engine/app/settings` | 0 | 7 pass / 0 fail / 26 expect |

## 4. W4 三规则探针证据（2026-08-28 实跑）

方法：快照 `zones.json` → 注入违规条目 → `bun tools/zone-registry/src/check.ts` 判红 → 还原 → 复绿。探针条目均为临时注入，还原后 `git diff -- tools/zone-registry/zones.json` = 0 行。

| 探针 | 注入 | exit | 判红输出 |
|---|---|---|---|
| A（R-exist） | P998 → 已删文件 `src/app/ai/chat/storage.ts` | 1 | `PATCH file missing on disk: P998 src/app/ai/chat/storage.ts (remove the patch entry or restore the file)`（附带 R-mutex 次报——该路径同在 deletedPaths，行为正确） |
| B（R-diff） | P997 → 与 base 字节一致 `tests/engine/vue/input/node-edit-snap.test.ts`（原 P60 目标） | 1 | `PATCH has no diff vs base: P997 ... (byte-identical to base — remove the phantom patch or make the change it claims)` |
| C（R-mutex） | P996 → ownedFiles 成员 `src/components/chat/ChatModeSelect.vue`（原 P98 目标） | 1 | `PATCH overlaps owned/deleted registration: P996 ... (a file is either a patch on upstream content or owned/deleted — never both)` |
| 还原复跑 | — | 0 | `[zones] clean: 55 modified / 291 added / 1014 deleted, base 88c10770` |

check.ts 无既有单测（`git grep` 无测试文件引用），按任务口径以「构造违规→判红→还原」实证替代。

## 5. 实施过程发现的问题 / 与指令的偏差

### 5.1 commit 2 被迫拆分（check-tasks proxy 机制）

原规划 commit 2 = 代码 4 文件 + zones.json（合计 204 行）。commit 1 落地后 HEAD 变为 T36 commit，pre-commit proxy 随之切到 T36——204 行 ≥ 200 触发 R2 大改动判定，要求 T36 三件套已存在（self-check/verify 此时尚未产生），被 hook 拒绝。**处置**：拆为 2a（代码 117 行，小改动）+ 2b（zones.json 87 行，小改动 + zones 报警凭 2a 的 `task: T36` 指针通过）。commit 数从规划 4 变为 5，语义边界反而更干净。【事实】`git log --oneline 3f85a3e9..HEAD`，2026-08-28。

### 5.2 check:packages 一度红——我方 timeout 工件，非真红

首跑 `bun run check` 用 `timeout 600` 包裹，ATTW 对 packages/vue 执行 `npm pack` 触发 tsdown 重建（先清 dist），600s 到点 SIGTERM 杀进程树 → dist 被清一半 → 复跑时 publint 报「dist/index.js 不存在」。**处置**：`bun run build:packages` 重建（exit 0）后 `bun run check:packages` 全过（metadata/publint/ATTW）。【事实】2026-08-28 两次实跑输出。教训：全量 check 不得用会杀进程树的 timeout 包裹。

### 5.3 check:audit 环境红（唯一非绿门禁）

`bun audit` 对 registry audit 端点请求返回 404。与本任务无关：T36 未触碰 lockfile 与任何依赖清单（`git diff 3f85a3e9 HEAD --stat -- bun.lock package.json 'packages/*/package.json'` 为空，2026-08-28 核）。登记为环境红遗留项。

### 5.4 与任务指令的偏差（以仓库实际为准）

- 指令称 tracker T32 行勘误 = 「AppButton.vue → AppTextButton.vue」，并提示可能自相矛盾。实测 `git show 0fbfd65e --name-status` = 11 个 D 行**全为 e2e snapshot png**，AppButton.vue 与 AppTextButton.vue 均不在删除列（AppTextButton.vue 同 commit 入 ownedFiles）。故按仓库真相改写为「11 个 ghost 全为 e2e snapshot png」，不采用指令字面。
- 指令未含 `records/_index.md` 计数修正，但同口径陈旧事实（15→16）一并修正并在文中注明原因。

### 5.5 诚实声明：接线无新增自动化测试

transports.ts 的 `recordChatCompleted/recordChatFailed` 接线**未新增单测**——diagnostics 记录器本身有测（15 pass），但 Chat transport 层无既有测试骨架，且真实链路 e2e 需真后端（出栈项）。接线语义为单行调用 + 与上游逐字对齐（§1 W2 行号对照），typecheck/lint/既有测试全绿。此缺口如实登记，不谎称已测。

### 5.6 遗留登记（非本任务范围）

- `docs/rebuild/tasks/T34-plan.md` 头部状态仍「执行中」（T34 已收口，历史文档状态字段未翻）——出栈，未改。
- credentials.spec.ts 余 3 测试内仍存在指向已删 UI 的 test-id 死引用风险——出栈，见 T36-plan §5。
- tracker.md T34 行拓扑描述（「octopus 8 commits」）与实际上游拓扑（8 commits 为线性链 0f981ff2→…→88c10770）措辞精度不足——出栈。

## 6. 关联文档

- plan：[T36-plan.md](T36-plan.md)
- verify：[T36-verify.md](T36-verify.md)（独立 subagent 核验后回填）
- 索引：[tasks/_index.md](../tasks/_index.md) / [tracker.md](../tracker.md)
- 追认记录：[records/topics/upstream-merge.md](../records/topics/upstream-merge.md) T36 追写 / [records/topics/ci-infra.md](../records/topics/ci-infra.md) CI-16/CI-17
- SOP：[04-porting-discipline.md §6](../04-porting-discipline.md)

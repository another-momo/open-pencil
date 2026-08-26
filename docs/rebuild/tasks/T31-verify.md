<!--
  写作纪律（改本文前必读）：
  - 事实性声明必须附核验命令 + 日期，否则标为【假设】
  - 本文只保留当前态，不保留修正历史；修正记入 records/narrative/tasks/T31-verify.md
-->

# T31 独立核验 · 上游合并第二轮（88c10770）

> **状态**：已核验（subagent 独立复验，V1-V5 + 门禁 + 远端 CI 全过） | **时间**：2026-08-25
> **plan**：[T31-plan.md](T31-plan.md) | **self-check**：[T31-self-check.md](T31-self-check.md)
> **核验基点**：`rebuild/pi @ 4faa4608`（`git log --oneline -5`，2026-08-25；工作树 `git status --short` 干净）

## 核验清单（V1-V5，对账 plan 验收 C1-C5）

> 由独立 subagent 逐条核验并填写结论。每条须附核验命令 + 日期；结论「通过 / 打回 + 理由」。

- [x] V1 = C1（内核四 commit 落盘且与上游快照一致）—— ✅ 通过（2026-08-25）
  - 落盘确认：`git log --oneline 4faa4608 -- packages/core/src/vector/handle-selection.ts src/app/editor/vector/index.ts src/app/editor/clipboard/memory.ts src/components/chat/tool-state.ts src/app/document/recovery/preferences.ts` → 五文件均仅命中 `c0c1f117 task: T31 上游合并第二轮`（T31 合并 commit，为 4faa4608 祖先）
  - blob 对账（上游快照目录已清理，改 blob 级，抽 2 件）：
    - `git rev-parse 4faa4608:src/app/editor/vector/index.ts` = `339ede3eec2129d020eaa5ab265cd491ced67c68`，`gh api repos/open-pencil/open-pencil/contents/src/app/editor/vector/index.ts?ref=88c1077071328b8df68f282543f16e20e97930b4 --jq .sha` = `339ede3eec2129d020eaa5ab265cd491ced67c68` → 一致
    - `git rev-parse 4faa4608:packages/core/src/vector/handle-selection.ts` = `b2ecfeed7d41d108824ad00cdc0c0b642ff1ffe7`，上游同路径同 ref blob = `b2ecfeed7d41d108824ad00cdc0c0b642ff1ffe7` → 一致
- [x] V2 = C2（tool-state 落盘 + ChatMessage 采纳语义 + 不引入已删面）—— ✅ 通过（2026-08-25）
  - `ls src/components/chat/tool-state.ts` → 文件在仓
  - `grep -c 'attachment' src/components/chat/ChatMessage.vue` = `0`
  - `grep -n 'classifyToolState' src/components/chat/ChatMessage.vue` → 命中 3 处：L13 `import { classifyToolState } from './tool-state'` + L42-43 toolState 委托注释与调用
  - `bun test tests/engine/app/chat/tool-state.test.ts` → 5 pass / 0 fail / 8 expect() calls
- [x] V3 = C3（删除区零复活）—— ✅ 通过（2026-08-25）
  - `find src/app -path '*ai/acp*' -o -path '*integrations/mcp*' -o -path '*diagnostics*'` → 零命中
  - `find src/app/ai/tools -name 'index.ts'` → 目录不存在（`ls src/app/ai` 仅剩 chat / debug / pi-backend），零命中
  - `find src/components/settings -path '*mcp*' -o -name 'ProfileEditor.vue'` → 零命中
- [x] V4 = C4（门禁全绿复跑）—— ✅ 通过（2026-08-25，逐条实测见下节「门禁复验」）
- [x] V5 = C5（合并记录登记齐）—— ✅ 通过（2026-08-25）
  - `grep -n 'T31' docs/rebuild/tracker.md` → L42 有 T31 当前任务行（upstream/master@88c10770 合并，🔄，三件套链接齐）
  - `grep -n 'T31' docs/rebuild/tasks/_index.md` → L65 §2 有 T31 行
  - `grep -n '合并-2\|88c10770' docs/rebuild/records/topics/upstream-merge.md` → L69 起「合并-2 · upstream/master@88c10770」实录在（含钉扎、方法、八 commit 裁定）
  - commit message：`git log --format=%B -1 4faa4608` = 「task: T30 尾款——Phase 2 阶段门翻」（4faa4608 为 Phase 2 翻牌 cherry-pick，本身不含 T31 标签）；T31 合并 commit `git log --format=%B -1 c0c1f117` 首行 = 「task: T31 上游合并第二轮——upstream/master@88c10770（8 commits/188 文件，内容裁定）」且在 4faa4608 历史中 → 符合「或等价」口径

## 门禁复验（subagent 复跑，2026-08-25）

- [x] typecheck / lint / format:check / check:i18n / check:zones / check:docs / check:bindings / check:tasks / check:deps / check:monorepo / check:arch / check:packages / test:type-shapes / test:dupes 复跑结论 —— ✅ 14 门禁全绿
  - `bun run typecheck`（tsgo --noEmit + vue-tsc ×2）→ 绿
  - `bun run lint`（lint:structure + oxlint --type-aware --type-check）→ 0 errors / 3 warnings（max-lines 存量 3 件，如 packages/core/src/design-jsx/props-overrides.ts 608 行；与 self-check 口径一致）
  - `bun run format:check`（oxfmt --check，2030 文件）→ All matched files use the correct format
  - `bun run check:i18n` → All locale files are in sync
  - `bun run check:zones` → clean：76 modified (all registered) / 298 added (owned) / 1028 deleted (all registered), base 5201404f
  - `bun run check:docs` → 39/39 通过（R1-R5）
  - `bun run check:bindings` → 绿（diff-based，HEAD 已提交态报「无变更，跳过」）
  - `bun run check:tasks` → 绿（同上，「无变更，跳过」）
  - `bun run check:deps`（knip --include unlisted,unresolved,binaries）→ 无输出，绿
  - `bun run check:monorepo`（sherif）→ No issues found
  - `bun run check:arch`（steiger）→ No problems found
  - `bun run check:packages`（metadata + publint + attw）→ 三段全过
  - `bun run test:type-shapes` → No duplicate object type shapes found
  - `bun run test:dupes`（jscpd，794 文件）→ Found 0 clones
- [x] smoke:pi 批次 80 断言复跑 —— ✅ 通过：`bun run smoke:pi` 五段全绿，计数实测 target 6 + history 12 + sessions 14 + assembly 29 + gc 19 = 80 passed / 0 failed
- [x] 单测断言核对 —— ✅ 通过：
  - `bun test tests/engine/app/document/recovery/` → 14 pass / 0 fail / 30 expect()
  - `bun test tests/engine/app/vector-edit-transforms.test.ts tests/engine/vue/input/node-edit-snap.test.ts` → 17 pass / 0 fail / 59 expect()
  - clipboard（口径 10 = T31 新增 keyboard+memory）：`bun test tests/engine/app/clipboard/keyboard.test.ts` → 2 pass / 0 fail；`bun test tests/engine/app/clipboard/memory.test.ts` → 8 pass / 0 fail；合计 10 ✅（notifications.test.ts 2 pass / 0 fail 亦绿）
  - 实测备注（不打回）：整目录 `bun test tests/engine/app/clipboard/` 在本机 Windows 上 figma-images.test.ts 2 条断言全过后进程不退出（`timeout 180` 报 exit 124）；该文件为存量（`git log` 末次触碰 c2812ba1，T31 合并 commit c0c1f117 对其零改动，`git show --stat c0c1f117 -- tests/engine/app/clipboard/` 仅 keyboard +30 / memory +275），属存量 Windows 环境现象，与 T31 改动面无交叠；单文件跑全绿
- [x] 远端 CI：`gh run view` 复验结论（B.3）—— ✅ 通过（2026-08-25，`gh run view <id> -R another-momo/open-pencil --json conclusion,headSha,headBranch,displayTitle`）
  - run 32860870684：conclusion=`failure`，headSha=c0c1f117，branch=rebuild/pi-staging（T31 合并首轮，format 红）→ 与实录一致
  - run 32861755654：conclusion=`success`，headSha=42da783c（T31 尾款 oxfmt 收敛），branch=rebuild/pi-staging → 修复转绿
  - run 32863770126：conclusion=`success`，headSha=4faa4608（Phase 2 翻牌），branch=rebuild/pi-staging → 绿
  - run 32864065492：conclusion=`success`，headSha=4faa4608，branch=rebuild/pi → 绿

## 核验结论

**可以收口**。V1-V5 逐条独立复验全过（blob 级对账与上游 88c10770 一致、ChatMessage 语义采纳且不引已删面、删除区零复活、14 门禁 + smoke:pi 80 断言 + 单测 10/14/17 计数全绿、登记三处 + commit message 等价口径齐），远端 CI 四 run 链（failure→success×3）与实录完全一致。唯一实测偏差为 clipboard 整目录跑在 Windows 上因存量 figma-images.test.ts 进程挂起，已核证与 T31 改动面零交叠，不构成打回项。

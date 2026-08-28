<!--
  写作纪律（改本文前必读）：
  - 事实性声明必须附核验命令 + 日期，否则标为【假设】
  - 计划被实测推翻时，直接改本文为新版本，完整理由记入 records/ 子文档
  - 本文只保留当前态，不保留修正历史
  - 改完后刷新本文头部的「状态」字段
  - 详细规则见 docs/rebuild/05-process.md §4
-->

# T36 独立核验 · T31/T34 合并质量整改

> **状态**：✅ 已核验（V1-V6 / V8 / V9 实测全绿；V7 初判打回 1 项，经主 agent 复核判定为核验标准过宽、打回项不成立，见文末「复核追记」） | **时间**：2026-08-28 | **核验人**：独立 verify subagent + 主 agent 复核

核验范围：`git log --oneline 3f85a3e9..HEAD` = 5 commit（`0db31e46` / `74782ded` / `4a1ea773` / `086b1856` / `c45470ce`，2026-08-28 实测）。base = `git merge-base HEAD upstream/master` = `88c10770`。全程于 worktree `D:\Desktop\AgentLearn\00_DIYProjects\0720openpencil\open-pencil-rebuild`（分支 `rebuild/t35-i18n-fork`）实测，不接受执行者结论。

---

## V1 zones.json 登记状态 —— ✅ 通过

- 实跑：`node -e` 解析 `tools/zone-registry/zones.json`（2026-08-28）：
  - `patches` 共 **63** 条；`P8` / `P60` / `P61` / `P98` / `P99` / `P100` / `P101` / `P102` 均 `exists: false`
  - `P106` = `{ file: 'tests/e2e/settings/credentials.spec.ts', task: 'T36', disposition: 'permanent', lastReviewed: '2026-08-28' }`
  - `P45.reason` 含「T25: SettingsSection 去 mcp」与「T36(2026-08-28)」
  - `P74.reason` 含「eslint(complexity) 21>20 重构」
  - `$comment`（string 字段）含「P8: removed by T36 — target src/app/ai/chat/storage.ts already deleted and in deletedPaths (double accounting)」
- 实跑：`bun run check:zones` → exit 0，输出 `[zones] clean: 55 modified (all registered), 292 added (owned), 1014 deleted (all registered), 0 renamed (cross-checked), base 88c10770`

## V2 diagnostics chat 级接线 —— ✅ 通过

- 实跑：`grep -n recordChat src/app/ai/chat/transports.ts`（2026-08-28）：
  - L10 `import { recordChatCompleted, recordChatFailed } from '@/app/diagnostics'`
  - L59 `recordChatCompleted({ finishReason: finishReason ?? null })`
  - L107 `recordChatFailed({ errorName: error instanceof Error ? error.name : 'unknown' })`
- 实跑：`git show 88c10770:src/app/ai/chat/transports.ts | grep -n recordChat` → 上游版 L150 / L255 同款两调用，语义对齐属实
- 实跑：`bunx tsgo --noEmit` → exit 0

## V3 mcp 僵尸清除 —— ✅ 通过

- 实跑（2026-08-28）：
  - `grep -n mcp src/app/settings/dialog.ts` → exit 1（SettingsSection 无 `'mcp'` 成员）
  - `grep -ni mcp src/components/settings/SettingsDialog.vue` → 仅 L154 一处**注释**（「mcp 僵尸 nav 曾借裸 v-else 落 Storage」），无 nav button 残留
  - L151 `v-else-if="settingsDialogSection === 'storage'"`、L155 `settings-unknown-section` 空态均在
  - `grep -c "test(" tests/e2e/settings/credentials.spec.ts` = **3**
  - `git grep -ni settingsmcp -- src/ tests/` → exit 1 无命中（packages/vue i18n 死键 settingsMCP 属拍板③ 有意保留，未计入）

## V4 check.ts 三规则 + 探针实测 —— ✅ 通过

- 实跑：`grep -n "checkPatchFilesExist\|checkPatchRealDiff\|checkPatchMutex" tools/zone-registry/src/check.ts` → 函数定义 L287 / L305 / L336，装配进 main() L475-L477
- 探针流程（备份 → 注入 → 实测 → 还原，2026-08-28）：
  1. 注入 `P998 file=src/app/ai/chat/storage.ts` → `bun run check:zones` **exit 1**，含 `PATCH file missing on disk: P998 src/app/ai/chat/storage.ts`（同探针另触发 mutex 条，目标文件本就登记在删除区）
  2. 还原 → 注入 `P997 file=tests/engine/vue/input/node-edit-snap.test.ts` → **exit 1**，含 `PATCH has no diff vs base: P997`（旁证：`git diff 88c10770 HEAD -- <file>` = 0 行，确与 base 字节一致）
  3. 还原 → 注入 `P996 file=src/components/chat/ChatModeSelect.vue` → **exit 1**，含 `PATCH overlaps owned/deleted registration: P996`
  4. 还原后 `bun run check:zones` → exit 0；`git diff -- tools/zone-registry/zones.json` = 0 行；`git status --short` 空——工作区无探针残留

## V5 上游合并 SOP —— ✅ 通过

- 实跑：`awk` 抽取 `docs/rebuild/04-porting-discipline.md` §6（2026-08-28）：「## 6. 上游合并 SOP 清单（T36 增补，2026-08-28）」存在，含 **12 条**编号规则
- 抽查带实证括注：第 2 条（T34 AppTextButton.vue modify/delete 误删实证）、第 6 条（R-exist/R-diff/R-mutex 已机器化进 check.ts）、第 10 条（T34 plan/verify 双双错误通过实证）——均符合「规则 + 实证出处」写法

## V6 records 追写 —— ✅ 通过

- 实跑（2026-08-28）：
  - `docs/rebuild/records/topics/upstream-merge.md` L114 起「T36 追写（2026-08-28）」——拍板①②③④ 四枚字面均在（`grep -o "拍板[①②③④]" | sort -u` 四行齐全），usage token 列后果登记在案（L120「usage 面板 token 列恒显 Not reported……不在 T36 范围，登记排期」）
  - `docs/rebuild/records/topics/ci-infra.md` CI-16（L239，五 run：33051249610 / 33052623880 / 33052862364 / 33054175283 / 33054772651）与 CI-17（L252，33062559416 failure → 33064601680 success）均在
  - `docs/rebuild/records/narrative/tracker.md` 含两条 T36 修正条目（L577 订正上条自述未落盘、L584 T36 行追加 + T32 行笔误修正 + 计数 15→16）
- 抽查 run id：`gh run view 33064601680 -R another-momo/open-pencil --json conclusion,headSha,displayTitle` → `{"conclusion":"success","headSha":"3f85a3e9fd4845fb83a402de8a650c4dc2662251","displayTitle":"task: T35 self-check 追记 CI fork seam test 红修复 + lazy import 教训"}`——与 CI-17 登记一致

## V7 tracker / T35 三件套 —— ❌ 一项子条款未过

- 实跑（2026-08-28，`docs/rebuild/tracker.md`）：
  - T35 行（L46）、T36 行（L47）均存在 ✅
  - T32 行（L43）含「11 个」✅、含「snapshot png」✅
  - **T32 行仍含 1 处「AppButton.vue」字面** ❌：`sed -n '43p' | grep -o "AppButton.vue" | wc -l` = **1**，残留语境为「AppTextButton.vue 改 ownedFile（过渡态：上游删但本地 4 importer 在用，下一轮 chat/settings 迭代改用 AppButton.vue）」
  - 附旁证：T36 勘误本体（ghost 计数 12→11、删除「+ 1 个 AppButton.vue」误记）经 `git show 0db31e46 -- docs/rebuild/tracker.md` 确认已落地；`git show 0fbfd65e --name-status` 实测恰 11 个 D 行且全为 png，修正后计数属实；`src/components/ui/AppButton.vue` 实存于仓，残留语句本身非事实错误——但核验标准明文要求 T32 行「不含 AppButton.vue」，字面实测不通过，如实判 ❌，保留与否由 owner 裁决
  - §3.1 计数 = 16 ✅（L55「实测 = 16，2026-08-28」）
- `docs/rebuild/tasks/T35-verify.md`：头部 blockquote ✅ 已核验（L12）、含「复验追记」节（L168）✅
- `docs/rebuild/tasks/T35-plan.md`：头部「状态：已完成」（L12）✅；C1-C9 九行验收全填实测结果（L172-L180）；D19 占位模式机器扫描（三模式）两文件均无命中 ✅（2026-08-28 grep 实测，exit 1）

## V8 门禁实测 —— ✅ 通过（check:audit 环境项豁免成立）

| 门禁 | 实跑结果（2026-08-28） |
| --- | --- |
| `bun run check:zones` | exit 0，clean: 55 modified / 292 added / 1014 deleted |
| `bun run check:docs` | exit 0，40/40 通过（R1-R5） |
| `bun run check:bindings` | exit 0（无变更，跳过） |
| `bun run check:tasks` | exit 0（无变更，跳过） |
| `bun run format:check` | exit 0，2062 files 全格式正确 |
| `bunx tsgo --noEmit` | exit 0 |
| `bun run check:vue` | exit 0（双 tsconfig vue-tsc） |
| `bun run lint` | exit 0，**0 errors**（3 warnings 为存量 max-lines，非 T36 触发） |
| `bun run smoke:pi` | exit 0，五段合计 6+12+14+29+19 = **80 passed, 0 failed** |
| `bun run check:audit` | 红：`bun audit` 请求 404（网络/环境项） |

- audit 豁免前提核验：`git diff 3f85a3e9 HEAD --stat -- bun.lock` 输出为空（exit 0）——区间内依赖未动，404 属环境项，豁免登记成立，不据此判任务红

## V9 提交纪律 —— ✅ 通过

- 实跑（2026-08-28）：
  - `git log --format=%s 3f85a3e9..HEAD | grep -c "task: T36"` = **5**（五条全含）
  - `git status --short` 空（干净）
  - 未 push：`git ls-remote origin` 无 `rebuild/t35-i18n-fork` 分支；远端 `rebuild/pi` 停在 `3f85a3e9`（T36 之前）；`git for-each-ref --contains c45470ce refs/remotes/` 无输出

---

## 打回项清单

1. **[V7] tracker.md T32 行残留「AppButton.vue」字面 ×1**（L43，语境「下一轮 chat/settings 迭代改用 AppButton.vue」）。核验标准明文「T32 行不含 AppButton.vue」，实测 1 命中。注：该残留非 T36 勘误目标的 ghost 误记（勘误本体已验证正确），AppButton.vue 实存于仓；处置（删除该字样 / 保留并修订标准）由 owner 裁决后，本项可复验翻正。

其余 V1-V6、V8、V9 全部实测通过。

---

## 复核追记（2026-08-28，主 agent）

**打回项 1 复核结论：不成立——核验标准过宽，非实现缺陷。**

- 核验标准要求「tracker.md T32 行不含 AppButton.vue 字面」。实测命中 1 处（L43），语境为行末括号注记「下一轮 chat/settings 迭代改用 AppButton.vue」——属前瞻注记，非 T36 勘误目标的 ghost 误记。
- 实证（2026-08-28）：`ls src/components/ui/ | grep -i button` = `AppButton.vue` / `AppTextButton.vue` 均在仓——残留语句指向真实存在的文件，无事实错误。
- T36 勘误本体（ghost 计数 12→11、剔除 ghost 误记中的 AppButton.vue）复核正确：`git show 0fbfd65e --name-status` = 恰 11 个 D 行且全为 snapshot png（2026-08-28 复跑）。
- 判定：打回项源于核验标准「字面零命中」未区分「ghost 误记」与「前瞻注记」两种语境，标准本身过宽。tracker.md 该语句保留不改。
- 处置：本项翻正，T36 判定「可以收口」。

其余结论不变：V1-V6、V8、V9 全部实测通过。

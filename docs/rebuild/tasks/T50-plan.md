<!--
  写作纪律（改本文前必读）：
  - 事实性声明必须附核验命令 + 日期，否则标为【假设】
  - 本文只保留当前态，不保留修正历史
  - 详细规则见 docs/rebuild/05-process.md §4
-->

# T50 计划 · CI 红修复收口（run 33372323229 四红 + run 33382389558 三红）

> **状态**：✅ 已完成（2026-08-31 收口） | **时间**：2026-08-31 立项 | **负责人**：主 agent

## 1. 背景与问题

2026-08-31 下午 owner 手动推送触发 CI，run 33372323229 四红（`gh run list --repo another-momo/open-pencil`，2026-08-31 实测）。修复后以 `fix(ci): …` 提交 b85daf0b 推送，run 33382389558 又三红。两轮七处的根因与处置：

### 第一轮（run 33372323229，b85daf0b 已修复）

| 失败 job | 根因 | 处置 |
|---|---|---|
| Workbench bundle build | T47 移动 workbench/ → attic/dsh-workbench/ 后三处单级 `../` 相对引用失效（copy-assets.mjs repoRoot / package.json file: 依赖 ×2 / tsdown.config.mjs unifont 解析路径）；npm 对失效 file: 链接静默建悬空 symlink，直到复制 Inter-Regular.ttf 才炸 | 三处统一改 `../../` + 重建 lockfile |
| Repository hygiene（test:tools） | tools/test.ts 要求 tools/ 每个子目录有 package.json | 补建 cn-font-catalog、rebuild 两个 private stub |
| Rebuild discipline（check:zones GHOST ×4） | CI 拉新鲜 upstream，GHOST 窗口（merge-base..upstream/master）检出上游已删本地仍存的文件 | 采纳 upstream dd15190f（CSP-safe interpreter 取代 eval js.ts）+ 同步删三 visual 脚本；zones.json P125 + 4 deletedPaths + interpreter.ts ownedFile |
| Package integrity（sherif） | packages/core/package.json 依赖键未排序 | 排序 |

### 第二轮（run 33382389558，本任务收口）

| 失败 job | 根因 | 处置 |
|---|---|---|
| Rebuild discipline（check:tasks 逐 push 口径） | b85daf0b commit message 无 `task: T<NN>` 指针：zones.json 变更禁 `[no-task-plan]`（T28 决策单 #6 ①）+ 大改动（14 文件 / 912 行）须挂 task（05-process.md §3.2）。本地跑 check:tasks 锚 merge-base 看到的是全分支 diff（含 T49 指针），CI 按 push base 只看本次 commit——本地/CI 口径差是漏网根因 | 本任务 = 补立 T50 三件套追认，本 commit message 带 `task: T50` 指针；流程教训进自检 §3 |
| Repository hygiene（test:dupes） | jscpd 检出 src/app/editor/fonts/index.ts 内 7 行 118 token 克隆（listFamilies 与 listAllFamilies 的 Tauri 臂）——T41 patch 引入，本分支无历史绿 baseline 故迟发 | 抽 listTauriMergedFamilies helper（P109 既有 patch 覆盖内，行为不变） |
| Code quality（lint type-aware） | TS2722：packages/core/src/clipboard.ts:59 `compiled.decodeMessage(dataRaw)`——interpreter 版 decodeMessage 变可选，上游 dd15190f 同 commit 在调用点加守卫，b85daf0b 只同步了 schema-runtime 目录漏了调用点 | 采纳上游守卫 `if (!compiled.decodeMessage) return null`，登记 P126 |

### 第一轮修复的连带补全

dd15190f 共触 8 文件（`git show dd15190f --stat`，2026-08-31 实测），b85daf0b 只采纳了 schema-runtime 三件套。本轮补齐同 commit 的其余四个：kiwi package.json（P127）/ README.md（P128）/ tests/schema-runtime.test.ts（P129，新版解释器测试 124 行）/ NOTICE（ownedFile，Kiwi attribution——采纳 interpreter.ts 的法律配套）。

## 2. 验收标准

1. clipboard.ts 守卫落位且与 upstream dd15190f 逐字一致（`git show dd15190f -- packages/core/src/clipboard.ts` 比对）。
2. `bun run test:dupes` = 0 clones；`bun run build:packages && bun run lint` type-aware 段 0 error（复现 CI 前置条件：声明文件新鲜）。
3. `bun test packages/kiwi` 30/30（含新版 schema-runtime 测试）。
4. zones.json 登记 P126–P129 + NOTICE ownedFile + P109 更新；`bun run check:zones` clean。
5. **CI 逐 push 口径本地预演**：`bun tools/zone-registry/src/check/tasks.ts --base HEAD` 对暂存改动零违规（commit message 含 `task: T50`）。
6. 九门禁 + check:packages + check:deps + test:tools + check:monorepo 全绿（unpiped 直读退出码；CI 门禁面以 ci.yml 实际步骤为准）。

## 3. 红线

- 不改任何产品/工具语义；fonts 重构行为不变（Promise.all 并行与排序逻辑逐字保留）。
- kiwi 四文件从 dd15190f 精确 checkout（不采纳 upstream tip 的后续漂移）。
- 不广撒网格式化；oxfmt --write 仅落本任务触碰文件。

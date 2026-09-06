<!--
  写作纪律（改本文前必读）：
  - 事实性声明必须附核验命令 + 日期，否则标为【假设】
  - 本文只保留当前态，不保留修正历史
  - 详细规则见 docs/rebuild/05-process.md §4
-->

# T50 核验 · CI 红修复收口（run 33372323229 四红 + run 33382389558 三红）

> **状态**：✅ 已完成（2026-08-31 收口） | **时间**：2026-08-31 立项 | **负责人**：主 agent

## 1. 核验范围

两轮 CI 红（run 33372323229 四 job + run 33382389558 三 job）的全部处置项，对 T50-plan §2 验收标准逐条核验。

## 2. 验收核验（2026-08-31，全部 unpiped 直读退出码）

| # | 验收项 | 结果 | 证据 |
|---|---|---|---|
| V1 | clipboard.ts 守卫与上游逐字一致 | ✅ | `git show dd15190f -- packages/core/src/clipboard.ts` 同 hunk 比对零差异 |
| V2 | test:dupes 0 克隆 | ✅ | `bun run test:dupes`：Found 0 clones，exit 0 |
| V3 | lint type-aware 0 error（声明新鲜） | ✅ | `bun run build:packages` exit 0 后 `bun run lint` exit 0（0 errors；warnings 为基线 max-lines） |
| V4 | kiwi 测试 | ✅ | `bun test packages/kiwi` 30/30，57 expect() calls（含 dd15190f 新版 schema-runtime 测试） |
| V5 | zones 登记与纯度 | ✅ | P126–P129 + NOTICE ownedFile + P109 注记在案；`bun run check:zones`：73 modified / 402 added / 1018 deleted 全登记，exit 0 |
| V6 | CI 逐 push 口径预演 | ✅ | `bun tools/zone-registry/src/check/tasks.ts --base HEAD`（暂存态）+ `check:bindings --base HEAD` 零违规；commit message 含 `task: T50` |
| V7 | 全门禁 | ✅ | check:zones/docs/tasks/bindings、lint（build:packages 前置）、tsgo、check:vue、format:check、check:i18n、check:packages、check:deps、check:monorepo、test:tools、test:dupes 全部 exit 0（CI 门禁面以 ci.yml 实际步骤为准：Package integrity = build:packages + check:packages + check:deps + check:monorepo，无裸 knip 步骤） |

## 3. 两轮 CI 失败 ↔ 处置映射（收口证据清单）

| run | job | 处置 | 落点 |
|---|---|---|---|
| 33372323229 | Workbench bundle build | 三处 `../../` 修正 + lockfile 重建 | b85daf0b（本任务追认） |
| 33372323229 | Repository hygiene（test:tools） | tools/cn-font-catalog、tools/rebuild package.json 补建 | b85daf0b（本任务追认） |
| 33372323229 | Rebuild discipline（GHOST ×4） | dd15190f schema-runtime 采纳 + 三 visual 脚本同步删除 + P125/deletedPaths/ownedFiles | b85daf0b（本任务追认） |
| 33372323229 | Package integrity（sherif） | packages/core/package.json 依赖排序 | b85daf0b（本任务追认） |
| 33382389558 | Rebuild discipline（check:tasks） | 本任务补立三件套，commit message 带 `task: T50` | 本 commit |
| 33382389558 | Repository hygiene（test:dupes） | listTauriMergedFamilies helper 抽提 | 本 commit |
| 33382389558 | Code quality（lint TS2722） | 上游守卫采纳 + P126 | 本 commit |

## 4. 遗留与边界

- b85daf0b 的 commit message 无 task 指针属既成事实（已推送，不改写历史）；本任务以三件套追认覆盖其全部内容，后续过堂以 T50 为索引。
- dd15190f 全部 8 文件已随两轮采纳完毕（3 + 5）；base bump 越过 2026-08-29 后 P125–P129 与相关 ownedFiles/deletedPaths 登记自然消解。
- 流程改进建议（check:tasks 本地预演口径、lint 前置 build:packages）已记 T50-self-check §3，是否固化进 05-process.md 待 owner 拍板。

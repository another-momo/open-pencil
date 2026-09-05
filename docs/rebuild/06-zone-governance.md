<!--
  写作纪律（改本文前必读）：
  - 事实性声明必须附核验命令 + 日期，否则标为【假设】
  - 计划被实测推翻时，直接改本文为新版本，完整理由记入 records/ 子文档
  - 本文只保留当前态，不保留修正历史
  - 改完后刷新本文头部的「状态」字段
  - 详细规则见 docs/rebuild/05-process.md §4
-->

# 06 · 分区治理与合并手册

> **状态**：已核验 | **时间**：2026-09-05 | **核验人**：主 agent
> **身份**：分区机制（`tools/zone-registry/zones.json` + `tools/zone-registry/src/check.ts`）的当前态快照与上游合并 ritual。04 §5 三态边界判定、02 §3 机制建设两文的「操作手册」配套——前者讲语义、后者讲诞生语境、本文讲「现在是什么 + 下次合并怎么打」。
> **基线**：分支 `docs/zone-governance` @ `7e6752ede`，merge-base 上游 `88c1077071328b8df68f282543f16e20e97930b4`（2026-08-24，08:24 fix(cli): use Node fs for import command）；upstream HEAD `7964b99ba39e72a3e5e6af1cbd16758daa95b4d5`（2026-09-04 18:44，Merge PR #640）。合并窗口实测：自 merge-base 上游 +180 commits / +758 文件 / +30 154 / -11 281 行（`git diff --shortstat 88c10770..upstream/master`，2026-09-05）。

## 1. 为什么分区：上游 follow 与 fork owned 的张力

fork 的核心张力是：上游在持续演进，fork 在持续改造。两边的改动重叠在同一棵源码树上，git 不知道「这一处是上游的、那一处是我们的」——它只看到 diff。

`tools/zone-registry/zones.json` 是这条边界的**单一事实源**：每个路径登记一个归属（owned / follow + patch / tarball / deleted / stub），`tools/zone-registry/src/check.ts` 在每次 push 时机械化执行（`check:zones` 子任务，详见 04 §5）。这把「纪律」从文档层面下沉到机器可检查层面——只要登记错、漏登记、偷偷改，CI 判红。

**零决策问题的根治**：[02-phase-0.md §3.1](02-phase-0.md) 已记 Phase 0 决策原文——「follow 区文件被修改且不在补丁清单 → CI 红」。即：**任何上游文件的本地修改必须登记 patch；任何新增文件必须落在 ownedRoots；任何已删上游文件必须登记 deletedPaths**。三件事都不允许「静默通过」。这就是「新增静默落入零决策」问题的根治——零决策态不允许存在，要么明确登记、要么 CI 红。

> **核验命令**（2026-09-05）：`bun run check:zones`（CI 端在 ci.yml `rebuild-discipline` job 内调用）。

## 2. 区的语义（八种）

zones.json 的实际顶层字段：`ownedRoots`、`ownedFiles`、`stubs`、`pendingReclass`、`patches`、`deletedPaths`、`upstreamMergeTarball`、`$comment`——共 7 区 + 1 自述。本节按「语义 + 何时进该区」格式列出。

| 区                       | 登记位置                                                                          | 一句话语义                                                                               | 何时进该区                                                                                                                                                                                |
| ------------------------ | --------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **ownedRoots**           | `ownedRoots[]`（路径前缀）                                                        | 我们整目录持有的自有资产，上游不存在或被我们彻底替换                                     | owner 拍板：原 follow 目录改造幅度超过 patch 语义（如 Batch 2f `src/components/chat/` 改名 `assistant/`、Batch 2c `src/app/automation/` 升 owned、Batch 3 `.github/workflows/` 升 owned） |
| **ownedFiles**           | `ownedFiles[]`（精确路径）                                                        | 单文件自有资产                                                                           | 上游已删/不存在但本地 importer 仍在用；或 fork 自有单文件（凭证、组件、helper）；T32 起 tarball.paths 的 byte 一致拷贝不再走此区                                                          |
| **patches**              | `patches[]`（id + file + reason + disposition）                                   | 上游某 commit 之上叠加的本地 hunk                                                        | 上游文件被本地修改时必须登记——permanent 为常态保留，revoked 为临时撤销（未升级 owned 前的过渡态）                                                                                         |
| **deletedPaths**         | `deletedPaths[]`（精确路径或目录前缀）                                            | 上游存在但本地已删的路径——「文件墓碑」+「目录前缀」两种                                  | 上游删除本地同步删除；上游存在但本地判死刑；目录前缀吸收所有子路径（如 Batch 2b `packages/cli/`、Batch 2f `src/components/chat/`）                                                        |
| **upstreamMergeTarball** | `upstreamMergeTarball[]`（base SHA + paths + deletedPaths + task + lastReviewed） | 字节一致 tarball/tarball 替换式合并的结构化白名单——与上游某 base SHA 完全 byte-identical | T32 起取代 ownedFile 兜底；每条记录锚定一次合并的 base + paths + 删路径 + 任务号 + 上次过堂日期                                                                                           |
| **stubs**                | `stubs[]`（精确路径）                                                             | 半空实现——保留签名表面（如 `useCollab`），删内部实现                                     | 删除功能时为 importer 保留调用面（[02-phase-0.md §2 减法清单](02-phase-0.md) 中 `src/app/collab/use.ts` 即此模式）                                                                        |
| **pendingReclass**       | `pendingReclass[]`（精确路径）                                                    | 「等下次需要改它时再做分类」的占位                                                       | Phase 0 起为「目标态以自持形态存在但当前未动」的文件打标（[02-phase-0.md §3.3](02-phase-0.md)）。当前 0 项——Batch 2a/2b/2c/2d/2f 已全部出清                                               |
| **$comment**             | 顶层 `string`                                                                     | 自述——治理语义、编号空间缺口、批量迁移注记                                               | 仅供人读，checker 不解析；每次大改后必须同步刷新（截至 2026-09-05 Batch 3 落账已完成）                                                                                                    |

**relocations**（搬移台账）：本字段当前**未在 zones.json 中落地**——2026-09-05 实读顶层键 7 个，不含 `relocations`。预期语义为「代码搬位置/裁撤但有语义继承者」类重构的台账载体（schema 与 watch 输出待定）。§6 给出设计草案，**落地以单独 owner 决策 + 字段新增 commit 为准**。

**目录前缀吸收子墓碑的冗余删除惯例**：当某目录整体进 `deletedPaths` 前缀（如 Batch 2f 的 `src/components/chat/`）时，该目录下的精确文件墓碑（如 `src/components/chat/tool-state.ts`）转冗余——checker 的 `checkDeletedAbsent` 仅审前缀，文件墓碑条目可保留为审计可读性也可移除（Batch 3 已出清 6 条冗余）。详见 §4 R-mutex 与 [check.ts `checkDeletedRegistered`](../tools/zone-registry/src/check.ts)。

> **核验命令**（2026-09-05）：`node -e "console.log(Object.keys(require('./tools/zone-registry/zones.json')))"`（确认 7 个顶层键，无 relocations）。

## 3. 当前分区全景（2026-09-05 实测快照）

数字由 `tools/zone-registry/zones.json` 实读得出（`node -e ...` 一次性统计，命令见 §3.4）。

### 3.1 数量面板

| 区                   | 条目数                            | 备注                                                                                                     |
| -------------------- | --------------------------------- | -------------------------------------------------------------------------------------------------------- |
| ownedRoots           | 15                                | 见 §3.2 逐条职责                                                                                         |
| ownedFiles           | 56                                | 含 24 件普惠体字体（10 字重 × 2 处 + 4 单处）+ 16 件字体管线文件 + 14 件 ChatPanel/自动化/凭据/可视化 等 |
| patches              | 129（126 permanent + 3 revoked）  | revoked = P21 LFS / P38 i18n en / P40 i18n zh-cn                                                         |
| deletedPaths         | 136（12 目录前缀 + 124 文件墓碑） | 见 §3.3 目录前缀清单                                                                                     |
| upstreamMergeTarball | 3                                 | T50 / T31 / T63（T63 paths 已空，标记消费完待退役，见 §5.5）                                             |
| stubs                | 1                                 | `src/app/collab/use.ts`                                                                                  |
| pendingReclass       | 0                                 | Batch 2a/2b/2c/2d/2f 已全清                                                                              |
| relocations          | **0（字段未落地）**               | §6 设计草案                                                                                              |

### 3.2 ownedRoots 15 条逐条职责

| #   | 路径                            | 一句话职责                                                                                                |
| --- | ------------------------------- | --------------------------------------------------------------------------------------------------------- |
| 1   | `docs/`                         | 重建文档集（rebuild/）——过程定义与决策档案（[README.md](README.md) 入口）                                 |
| 2   | `tools/zone-registry/`          | 分区机制本体（zones.json + check.ts + 兄弟门禁 docs/bindings/tasks）                                      |
| 3   | `tools/hooks/`                  | 本地 pre-commit 钩子（lint/format/类型片段快查）                                                          |
| 4   | `src/app/i18n/fork/`            | fork 自建 i18n 实例 + zh-CN 懒加载包（[02-phase-0.md §3.4 i18n 缝](02-phase-0.md)）                       |
| 5   | `packages/core/src/tools/fork/` | fork 自有 core 工具注册缝（[02-phase-0.md §3.4 工具注册缝](02-phase-0.md)，T52 集成后 FORK_TOOLS 再导出） |
| 6   | `tests/engine/rebuild/`         | fork 自身验证套件（i18n-seam、pi-dev-discovery 等）                                                       |
| 7   | `spikes/`                       | Phase 1+ spike 报告——dsh/pi/weshop 三路线调研（[03-phase-1-runtime.md](03-phase-1-runtime.md)）           |
| 8   | `attic/`                        | shelved DSH-plugin 线（`attic/dsh-workbench/` dsh bundle，ci.yml workbench-build job 独立编译）           |
| 9   | `tools/rebuild/`                | fork 自有工具（视觉 oracle 的 fixtures 渲染、CI 核验脚本等）                                              |
| 10  | `src/app/ai/pi-backend/`        | pi-backend 内部接口（`createOpenPencilTools` 装配面，T52 集成）                                           |
| 11  | `tools/cn-font-catalog/`        | 中文网字计划目录枚举与离线下载（fonts.ts T42 接入）                                                       |
| 12  | `src/components/assistant/`     | chat→assistant 整目录搬家（Batch 2f，2026-09-05）——ChatPanel 族 + tool-state                              |
| 13  | `src/app/ai/fork/`              | ai/chat/ai/debug 路径分离产物（Batch 2a，2026-09-05）                                                     |
| 14  | `src/app/automation/`           | 自动化桥内核（Batch 2c，2026-09-05 升 ownedRoot；MCP 外壳裁撤后只剩内部桥）                               |
| 15  | `.github/workflows/`            | CI 纯 fork 治理设施（Batch 3 升 ownedRoot，2026-09-05）                                                   |

> **核验命令**（2026-09-05）：`node -e "const z=require('./tools/zone-registry/zones.json');z.ownedRoots.forEach((r,i)=>console.log('['+(i+1)+'] '+r))"`

### 3.3 deletedPaths 目录前缀（12 条，2026-09-05）

| #   | 前缀                                   | 来源 batch                                                             |
| --- | -------------------------------------- | ---------------------------------------------------------------------- |
| 1   | `src/components/chat/`                 | Batch 2f（chat→assistant 整目录搬家）                                  |
| 2   | `src/app/ai/chat/`                     | Batch 2a + 77e32774a（路径分离 + 残留文件零引用清理，2026-09-05 入账） |
| 3   | `packages/cli/`                        | Batch 2b（cli 纯删）                                                   |
| 4   | `tests/engine/cli/`                    | Batch 2b                                                               |
| 5   | `packages/mcp/`                        | Batch 2c（mcp 外壳裁撤）                                               |
| 6   | `tests/engine/mcp/`                    | Batch 2c                                                               |
| 7   | `src/app/automation/mcp/`              | Batch 2c（桥内核已迁 `src/app/automation/`，旧 mcp 子树删）            |
| 8   | `tests/helpers/mcp/`                   | Batch 2c                                                               |
| 9   | `src/components/settings/usage/`       | ux3                                                                    |
| 10  | `src/components/settings/diagnostics/` | ux3                                                                    |
| 11  | `src/app/usage/`                       | ux3                                                                    |
| 12  | `tests/engine/app/usage/`              | ux3                                                                    |

**冗余删除惯例**：当某目录整体进前缀（如 `src/components/chat/`），该目录下精确文件墓碑转冗余可移除；Batch 3 已出清 6 条（`src/components/chat/{tool-state.ts,...}` 6 件因子前缀成立转冗余删除；Batch 0 ownedRoot 删除豁免已生效——`check.ts` `checkDeletedRegistered` 内 `!zones.ownedRoots.some(r => file.startsWith(r))` 提前 return）。

### 3.4 一次性的数字统计命令

```bash
node -e "const z=require('./tools/zone-registry/zones.json');console.log({
  ownedRoots: z.ownedRoots.length,
  ownedFiles: z.ownedFiles.length,
  patches: z.patches.length,
  permanent: z.patches.filter(p=>p.disposition!=='revoked').length,
  revoked: z.patches.filter(p=>p.disposition==='revoked').length,
  deletedPaths: z.deletedPaths.length,
  dirPrefixes: z.deletedPaths.filter(p=>p.endsWith('/')).length,
  fileTombstones: z.deletedPaths.filter(p=>!p.endsWith('/')).length,
  stubs: z.stubs.length,
  pendingReclass: z.pendingReclass.length,
  tarballs: z.upstreamMergeTarball.length
})"
```

> 实测输出（2026-09-05）：`{ ownedRoots: 15, ownedFiles: 56, patches: 129, permanent: 126, revoked: 3, deletedPaths: 136, dirPrefixes: 12, fileTombstones: 124, stubs: 1, pendingReclass: 0, tarballs: 3 }`

## 4. checker 规则全清单（[check.ts](../tools/zone-registry/src/check.ts) 实读整理）

每条规则对应 checker 函数 + 违反时报错关键字。

| #   | 规则                                        | 函数                              | 报错关键字                                                | 说明                                                                                                                                                                                                                                                  |
| --- | ------------------------------------------- | --------------------------------- | --------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | 异常 git 状态拒绝                           | `collectChanges`                  | `UNEXPECTED git status`                                   | `git diff --name-status` 出现 C/U/... 等非常规状态即报                                                                                                                                                                                                |
| 2   | modified 必登记 patch                       | `checkModified`                   | `MODIFIED but not registered`                             | 上游文件相对 merge-base 有 diff 但不在 patches/owned/tarball/ownedRoots → 红                                                                                                                                                                          |
| 3   | deleted 必登记 deletedPaths                 | `checkDeletedRegistered`          | `DELETED but not registered`                              | 上游删除本地也删但不在 deletedPaths（且非 ownedRoot 内） → 红。**ownedRoot 内删除免登记**（2026-09-05 §5.3 owner 决策 #7）                                                                                                                            |
| 4   | deletedPaths 不能在磁盘存在                 | `checkDeletedAbsent`              | `DELETED path still exists`                               | deletedPaths 命中 `existsSync` 即报——保险栓防误登记或恢复时漏删                                                                                                                                                                                       |
| 5   | added 必须在 ownedRoots/tarball/ownedFiles  | `checkAdded`                      | `ADDED outside ownedRoots`                                | 相对 merge-base 的新增文件落非合规区即红                                                                                                                                                                                                              |
| 6   | rename 交叉一致性                           | `checkRenames`                    | `RENAME but not registered`                               | 上游 R 行必须 old 落 deletedPaths/tarball.deletedPaths **且** new 落 patches/ownedFiles/tarball.paths/ownedRoots——单端缺即报                                                                                                                          |
| 7   | tarball base SHA 本地可达                   | `checkUpstreamMergeTarball`       | `upstreamMergeTarball base "<sha>" not reachable locally` | 每条 tarball 的 base SHA 必须 `git rev-parse --verify` 成功                                                                                                                                                                                           |
| 8   | tarball 字节一致                            | `checkDriftTarball`               | `TARBALL_DRIFT`                                           | tarball.paths 内文件 `hash-object` 与 base `ls-tree` 不一致即红——见 §5.5 与 04 §5.2                                                                                                                                                                   |
| 9   | GHOST（drift 雷达）                         | `checkGhostDeleted`               | `GHOST deleted file from upstream`                        | 仅 `--drift` 模式执行：upstream 自 upstreamBase 以来删除 ∩ 本地仍存在 ∉ owned/tarball/ownedRoots/patches → 报；T64 owner 拍板降为雷达——不进 push 门禁，进 `upstream-drift.yml` nightly                                                                |
| 10  | PATCH_TARGET_DELETED_UPSTREAM（drift 雷达） | `checkPatchTargetDeletedUpstream` | `PATCH_TARGET_DELETED_UPSTREAM`                           | 仅 `--drift` 模式执行：active patch.file 落在 upstream 自 upstreamBase 以来 D 集 → 报。**对称补盲**：checkGhostDeleted 的豁免面把 patch 目标排除在外导致零信号；本规则报「patch 锚点已没了，patch 需重锚或退役」。方案 §5.2 / 2026-09-05 Batch 0 新增 |
| 11  | R-exist（owner 拍板④）                      | `checkPatchFilesExist`            | `PATCH file missing on disk`                              | 非 revoked patch 的 file 必须 `existsSync`——杀 P8 类「目标已删仍挂活 patch」僵尸登记                                                                                                                                                                  |
| 12  | R-diff（owner 拍板④）                       | `checkPatchRealDiff`              | `PATCH has no diff vs base`                               | 非 revoked patch 的 file 相对 base 必须有 diff（byte-identical 即幻影 patch）——杀 P45/P60/P61 类。tarball.paths 内路径豁免（其语义即 byte 一致）                                                                                                      |
| 13  | R-mutex（owner 拍板④）                      | `checkPatchMutex`                 | `PATCH overlaps owned/deleted registration`               | 非 revoked patch 的 file 不得与 ownedFiles/stubs/deletedPaths 重叠——杀 P98-P102 双重记账                                                                                                                                                              |

**兄弟门禁（不属 check.ts）**：

- `check:docs`（[tools/zone-registry/src/check/docs.ts](../tools/zone-registry/src/check/docs.ts)）：叙事文档头部三字段确定性检查
- `check:bindings`（[tools/zone-registry/src/check/bindings.ts](../tools/zone-registry/src/check/bindings.ts)）：物理文件 ↔ `records/narrative/<file>.md` 一一对应拦截
- `check:tasks`（[tools/zone-registry/src/check/tasks.ts](../tools/zone-registry/src/check/tasks.ts)）：commit message `task: T<NN>` ↔ 三件套 `existsSync` 拦截 + 占位检测
- `--patches-report`：报告模式，逐 patch 输出相对 base 的 numstat + `lastReviewed` 日期——只读、恒 exit 0；T28 决策单 #5 过堂用

**装配顺序**（[check.ts `main`](../tools/zone-registry/src/check.ts)）：violations → renames → modified → deleted-registered → deleted-absent → `--drift` 时 ghost/patch-target-deleted → tarball drift → tarball base → added → patch-files-exist → patch-real-diff → patch-mutex。

> **核验命令**（2026-09-05）：`grep -nE 'function (check|collect)' tools/zone-registry/src/check.ts`（实读 13 个规则函数 + 1 collectChanges）。

## 5. 合并处理手册（面向「下次上游大合并」的 ritual）

适用情境：自上次合并以来 upstream 漂移达到 [05-process.md §3.3](05-process.md) 双周窗口检测阈值（`git rev-list --count HEAD..upstream/master` > 20 commits）或 owner 触发。当前实测自 merge-base `88c10770`（2026-08-24）以来上游 +180 commits / +758 文件 / +30 154 / -11 281 行（`git diff --shortstat 88c10770..upstream/master`，2026-09-05）——达到触发阈值的 9 倍，已具备合并必要。

### 5.1 合并前：drift 过堂

启动合并前先跑：

```bash
bun tools/zone-registry/src/check.ts --drift --base upstream/master
```

输出两类失锚信号：

**(a) PATCH_TARGET_DELETED_UPSTREAM**——patch 锚点已没了：

| Patch | file                                               | 上游删除提交                                                      | 处置                                                                             |
| ----- | -------------------------------------------------- | ----------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| P74   | `src/app/editor/clipboard/system.ts`               | 上游拆目录重构                                                    | re-anchor 至继任文件或退役（实测 T36 大扫除时已发现无人修，登记至下次合并 plan） |
| P192  | `packages/vue/src/i18n/messages/dialogs.ts`        | `be942783d` refactor(i18n): migrate app copy to domain namespaces | re-anchor 至新 catalog（合并上游 16 域命名空间后批量改指）                       |
| P193  | `packages/vue/src/i18n/locales/zh-cn/dialogs.json` | `be942783d` 同上                                                  | 同上，zh 翻译同步改指                                                            |

**核验命令**（2026-09-05）：`node -e "const {execSync}=require('child_process');const z=JSON.parse(require('fs').readFileSync('tools/zone-registry/zones.json','utf8'));const out=execSync('git diff --name-only --diff-filter=D 88c1077071328b8df68f282543f16e20e97930b4..upstream/master',{encoding:'utf8'});const ds=new Set(out.split('\n').filter(Boolean));console.log(z.patches.filter(p=>p.disposition!=='revoked'&&ds.has(p.file)).map(p=>p.id+' '+p.file).join('\n'))"` 输出 `P74/P192/P193` 三行。

**(b) GHOST**——上游已删文件本地仍残留：当前实测零命中（Batch 2f `src/components/chat/` 整目录搬家已让 `AttachmentList.vue`/`ChatMessage.stories.ts`/`ChatMarkdown.vue` 等 11 件上游新建文件被前缀吸收，故不报 ghost；其他 follow 区无上游删除）。若命中，按报告逐文件判定「领养到 ownedRoot」或「本地真删」。

### 5.2 上游改名 → 合并落地后 patch 改锚

上游重命名（`git diff -M` 的 R 行）若目标被 patch 锚定，合并后必须改 patch.file 字段。当前实测命中 2 条：

| Patch | 上游 rename 提交                                                                                                         | 旧路径 → 新路径                                                          | 合并后动作 |
| ----- | ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------ | ---------- |
| P159  | upstream `tests/engine/render/canvas/boolean-visual.test.ts → tests/engine/render/canvas/visual/boolean.test.ts`（R100） | patch.file 改指 `tests/engine/render/canvas/visual/boolean.test.ts`      |
| P170  | upstream `tools/visual-oracles/src/export-fixtures.ts → tools/visual-oracles/src/operations/export-fixtures.ts`（R100）  | patch.file 改指 `tools/visual-oracles/src/operations/export-fixtures.ts` |

**R 行交叉一致性规则**（[check.ts `checkRenames`](../tools/zone-registry/src/check.ts)）：旧路径必须命中 deletedPaths/tarball.deletedPaths **且** 新路径命中 patches/ownedFiles/tarball.paths/ownedRoots——单端缺即报 `RENAME but not registered`。当前 R100 重命名落点（如 `tools/visual-oracles/src/operations/export-fixtures.ts`）尚未在本仓存在，合并后才生成——届时 P170 的 patch 改锚 + 新路径自然落在 `tools/visual-oracles/src/operations/`（`tools/` 在 ownedRoot 吗？否，则需新增或归 patch）需当场拍板。

**核验命令**（2026-09-05）：`git diff --name-status -M 88c10770..upstream/master | grep '^R'` 19 条 R 行已全部枚举。

### 5.3 删除区复活——逐目录拍板

合并落地后，上游向 `deletedPaths` 目录前缀下新增的文件会触发 `DELETED-but-not-registered` 红——**因为本地 prefix 还在 deletedPaths 但上游有新文件涌入**。当前 5 个目录前缀会被复活（按实测拦截数排序）：

| 前缀                   | upstream 新增拦截数（2026-09-05 实测）                                                                                                                                              | 拍板方向                                                                                                                            |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `src/components/chat/` | **11**（含 `ChatNodePreview.vue` / `ReasoningBlock.vue` / `attachment/{AttachmentCard,AttachmentList}.vue` / `input/useAttachments.ts` / `markdown/InlineCode.vue` / 4 件 stories） | **维持删除**——Batch 2f 已整体改名 `src/components/assistant/`，上游这些文件不引入；前缀保留为「上游对该目录名的任何活动都不被接受」 |
| `src/app/ai/chat/`     | **4**（`context.ts` / `presentation.ts` / `submission/{types,use}.ts`）                                                                                                             | **维持删除**——Batch 2a 路径分离后 fork 已走 `src/app/ai/fork/`，上游这些 chat 子树不引入；前缀同样保留为目录名禁入                  |
| `packages/cli/`        | 2                                                                                                                                                                                   | **维持删除**（Batch 2b）                                                                                                            |
| `tests/engine/cli/`    | 2                                                                                                                                                                                   | **维持删除**（Batch 2b）                                                                                                            |
| `packages/mcp/`        | 2                                                                                                                                                                                   | **维持删除**（Batch 2c）                                                                                                            |

**核验命令**（2026-09-05）：`git diff --name-only --diff-filter=A 88c10770..upstream/master` 380 条上游新增 → 过滤 12 条目录前缀 → 实测 21 条（11+4+2+2+2）会被 check:zones 拦截——逐条按上表拍板。

**功能级撞车（同等域名异构）**：除拦截数字外，需注意上游在 `src/app/ai/chat/` 与 `src/components/chat/` 自建了一套异构实现：

- 上游新建 `src/components/chat/ChatNodePreview.vue`（commit a8c7feda）——与本仓 Batch 2g「节点缩略图 chip」（commit 9c10ad7a，自有 PiChatMessage 层）同域异构：**两个实现都做节点缩略图**，但 chip 形态 vs 上游 preview 形态不同，且我们的 chip 在 `src/components/assistant/` ownedRoot 内不冲突——拍板**不引入上游 ChatNodePreview**，让 chip 形态沿自有方向走
- 上游新建 `src/components/chat/ReasoningBlock.vue`（commit f0afe3c4）——与本仓 ux4「reasoning 默认折叠」同域异构：折叠策略不同，但 ux4 改的是自有 PiChatMessage 层（`src/components/assistant/`），未触上游吸收文件——拍板**不引入上游 ReasoningBlock**
- 上游新建 `src/components/chat/attachment/{AttachmentCard,AttachmentList}.vue` + `src/app/ai/attachment/` 全套（commit bd24220b）——与本仓 Batch 2a/2f「chat/ai 依赖点解耦 + 路径分离」产物同域异构：attachment 是上游新增的功能面（之前本地 follow 区也无），**两条路线**：(i) 不引入、维持本地无 attachment 状态；(ii) 下次合并重新评估「attachment 是否 fork 也需要」——owner 拍板悬而未决，建议合并 plan 登记悬而未决项

### 5.4 移植评估：font/draw 簇与上游 #591/#592/#593 的正面相撞

字体/绘制簇在本仓有 **12 条 patch**（实测统计：`patches.filter(p => /canvas\/(labels|renderer|render\/canvas)|canvas\/scene|text\/fonts|canvas\/text/.test(p.file))`）：

| Patch 簇                         | 覆盖文件                                                                                                          | 上游相撞 commit                                                                                          |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| P107/P110/P113/P119（font core） | `packages/core/src/text/{fonts,web-fonts,font/sources}.ts` + `packages/core/src/canvas/text/index.ts`             | 上游 `0686a2d6` `45c401cb` `e414cf77` `6d17b92a` `f580d8a7`（font policy / cache / status）共 7+ commits |
| P108/P143-P149（renderer 落点）  | `packages/core/src/canvas/{scene,renderer,renderer/lifecycle,renderer/fonts,labels/{draw,hit-test,selection}}.ts` | 上游 `379ef8b6` perf(canvas): rebuild navigation rendering（PR #591）——直接改 canvas/renderer            |
| P112（text.test.ts）             | `tests/engine/render/canvas/text.test.ts`                                                                         | 上游同文件可能并入                                                                                       |

**正面相撞 = 不是逐 hunk 冲突，而是结构冲突**：上游 PR #591 的「rebuild navigation rendering」会重写 canvas/renderer 内的若干函数（如 hit-test / drawText 路径），而 P143-P149 12 条 patch 都在这块做 CJK/Arabic typeface fallback——合并时大概率不是「自动 merge 成功」而是「逐 patch 验证是否被上游吸收或推翻」。

**处置 ritual**：

1. 跑 `--patches-report`（T28 决策单 #5）看每条 patch 的 numstat：
   ```bash
   bun tools/zone-registry/src/check.ts --patches-report --base upstream/master
   ```
2. 对 P143-P149（renderer 簇 7 条）逐条对比上游 PR #591 diff——若上游已含等价实现，本仓 patch 改 `disposition: revoked`（被上游吸收）；若上游未含，rebase 后保留
3. 对 P107/P110/P113（font core 4 条）逐条对比上游 `0686a2d6` 等 font commits——同上判定

### 5.5 tarball 生命周期：消费完退役

`upstreamMergeTarball` 条目的语义是「byte-identical 拷贝」——任何后续上游改动都打破此语义。当前 3 条 tarball 的状态（2026-09-05）：

| 条目 | task            | base       | paths 数 | 上游自 base 以来 drift 文件数 | 状态                                                       |
| ---- | --------------- | ---------- | -------- | ----------------------------- | ---------------------------------------------------------- |
| 1    | T50 kiwi 族收口 | `3caf5c99` | 7        | 0                             | 健康                                                       |
| 2    | T31 retro-T32   | `88c10770` | 41       | **10**                        | **drift 风险——10 文件已与 base 字节不一致**                |
| 3    | T63             | `88c10770` | **0**    | —                             | **已消费完待退役**（paths 字段为空，无 byte 一致拷贝义务） |

**T31 的 10 个 drift 文件**（[checkDriftTarball 实测输出](../tools/zone-registry/src/check.ts)）：

```
packages/vue/src/canvas/useCanvasInput.ts
src/app/editor/clipboard/{memory,paste-to-replace}.ts
src/app/editor/session/{create,modules,types}.ts
src/app/settings/preferences/store.ts
src/app/shell/keyboard/clipboard.ts
src/components/settings/general/GeneralSettingsPanel.vue
tests/engine/app/clipboard/memory.test.ts
```

**处置**：

1. 每条 drift 文件按改动幅度分诊（[04 §5.2 tarball 与本地改动的互斥规则](04-porting-discipline.md)）：
   - 行级/hunk 级小改 → 转 patch（patch.file 改指 + 在 tarball 中移除）
   - 功能级/与上游分叉大改 → 转 ownedFile（owner 拍板 + tarball.paths 移除）
2. **T63 已消费完（paths=[]）**：合并 plan 中将此条从 tarball 字段移除——`paths` 数组空已无 byte 一致义务，记录归档案即 `records/topics/upstream-merge.md` 对应合并条目

**核验命令**（2026-09-05）：`node -e "const {execSync}=require('child_process');const z=require('./tools/zone-registry/zones.json');for(const t of z.upstreamMergeTarball){const out=execSync('git diff --name-only '+t.base+'..upstream/master -- '+t.paths.join(' '),{encoding:'utf8'});console.log(t.task,'drift:',out.split('\n').filter(Boolean).length,'/',t.paths.length)}"` 输出 `T50 kiwi 族收口 drift: 0 / 7 / T31 retro-T32 drift: 10 / 41 / T63 drift: NaN / 0`（T63 因 paths 空不参与统计）。

### 5.6 合并收口判定：check:zones 必须 clean

合并流程的最后一关——commit 前必须：

```bash
bun tools/zone-registry/src/check.ts --base upstream/master  # 必须 exit 0
bun run check:docs
bun run check:bindings
bun run check:tasks
```

四兄弟门禁全绿才算收口——否则即使合并成功，CI 也会判红。**判定标准**：上述 13 条规则（[check.ts](../tools/zone-registry/src/check.ts) 其中 GHOST/PATCH_TARGET_DELETED_UPSTREAM 仅 `--drift` 模式触发，进 push 门禁的仅 11 条）+ docs/bindings/tasks 各自门禁 = 全绿。

**核验命令**（2026-09-05）：当前 HEAD `7e6752ede` 实测 `bun tools/zone-registry/src/check.ts` exit 0（`[zones] clean: N modified (all registered), M added (owned), K deleted (all registered), L renamed (cross-checked), base 88c10770`）。

## 6. 搬移台账（relocations）使用法

> **【假设/未落地】**——本节为 2026-09-05 的**设计草案**，zones.json 当前**无 relocations 字段**（顶层键实测 7 个）。落地以单独 owner 决策 + zones.json 字段新增 commit 为准。

**预期用途**：登记「代码搬位置/裁撤但有语义继承者」的重构——区别于 patch（patch 是上游某 commit 之上叠加 hunk；relocation 是我们自发的位置/语义重排）。典型场景：

- Batch 2f「chat→assistant 整目录搬家」——语义继承者 = `src/components/assistant/` 内同名文件，搬移台账记录「old=`src/components/chat/`，new=`src/components/assistant/`，scope=整目录，date=2026-09-05」
- 路径分离产物（Batch 2a `src/app/ai/chat/` → `src/app/ai/fork/`）——语义继承者 = fork 子目录，搬移台账记录每条搬迁路径
- mcp 外壳裁撤（Batch 2c `src/app/automation/mcp/` → `src/app/automation/bridge/`）——语义继承者 = bridge 子目录，搬移台账记录外壳→内核的语义收缩

### 6.1 预期 schema（草案）

```typescript
relocations: Array<{
  id: string // "REL-<NN>" 编号
  oldPath: string // 旧路径（精确或目录前缀）
  newPath: string // 新路径（精确或目录前缀）
  scope: 'file' | 'dir' // 单文件 vs 整目录
  reason: string // 一句话语义继承关系
  mergedFromUpstream?: string // 上游对应 commit（如 Batch 2f 对应上游 ChatPanel 族的合并）
  task?: string // task: T<NN> 关联（如 "task: T91f"）
  lastReviewed: string // YYYY-MM-DD 上次过堂
}>
```

### 6.2 何时登记

触发条件（任一）：

- 单文件或目录**搬位置**（renamed by us, not by upstream）——区别于上游 R 行的 patch 改锚
- 单文件或目录**裁撤但有语义继承者**——区别于「整功能不要」的 deletedPaths
- 「fork 自有 + 部分借用上游」的混血重构——例如 fork 自建 `src/components/assistant/` 但吸收了上游某些 Vue 组件

### 6.3 watch 输出（草案）

checker 新增 `--relocations-watch` 模式：逐条对照 upstream 自 upstreamBase 以来对 `relocations[*].oldPath` 的活动——命中即报 `RELOCATION_HIT: <id> <oldPath>`。owner 据此判「移植」或「不适用」。

### 6.4 移植决策落点

判「移植」时：将上游对应 commit 的 diff cherry-pick 到 `relocations[*].newPath`，commit message 引用 `relocations/<id>`，并在合并 plan 中登记；判「不适用」时：在 records/topics/<topic>.md 对应记录追加「<relocations-id> 不适用：<理由>」。

**当前 0 条**——zones.json 顶层键实测：`['$comment', 'ownedRoots', 'ownedFiles', 'stubs', 'pendingReclass', 'patches', 'deletedPaths', 'upstreamMergeTarball']`（2026-09-05 实读）。已落地的「搬移」（Batch 2a/2c/2f）目前借 `deletedPaths` 目录前缀 + patch 改 file 字段（如 P184 `useAIChat` import 改指 `@/app/ai/fork/use`）双轨登记，未走独立台账。

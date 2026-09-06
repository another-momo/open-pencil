<!--
  写作纪律（改本文前必读）：
  - 事实性声明必须附核验命令 + 日期，否则标为【假设】
  - 计划被实测推翻时，直接改本文为新版本，完整理由记入 records/ 子文档
  - 本文只保留当前态，不保留修正历史
  - 改完后刷新本文头部的「状态」字段
  - 详细规则见 docs/rebuild/05-process.md §4
-->

# tasks/T10-verify.md · T10 subagent 核验报告

> **T 编号**：T10（upstream 合并 + Phase 1 启动登记）
> **核验时间**：2026-08-21（merge --no-commit 进行中、commit 前由主 agent 立即派单）

## 1. 核验背景

T10 把 upstream/master@5201404f 合并进 rebuild/v2（漂移 79 commits/864 文件），并完成 Phase 1 启动登记（D20/§5.3/T11/T12 建档）。核验在合并 commit 落地前进行，目标是独立确认合并解决正确性与登记完整性。

**核验人**：subagent A（general-purpose，只读核查）
**时间**：2026-08-21
**范围**：合并解决（冲突面/删除立场/补丁重涂）+ registry 刷新 + 机制修正（CI-8）+ 文档登记 + 构建面证据
**依据**：[05-process.md §3.1 gate review 第 6 步 subagent 文档核验](../05-process.md) + [附录 A subagent 文档核验 prompt 模板](../05-process.md) + [T10-plan.md §3 验收标准](T10-plan.md)

## 2. 逐条核验（subagent A 实测）

| # | 声明 | 结果 | 实测值（2026-08-21） |
|---|---|---|---|
| 1 | 无未解决冲突 | ✅ | `git ls-files -u` = 0；MERGE_HEAD = 5201404f（合并未提交，符合时序） |
| 2 | zone check 以 MERGE_HEAD 为基线 clean | ✅ | 末行 `[zones] clean: 30 modified (all registered), 89 added (owned), 953 deleted (all registered), base 5201404f` |
| 3 | 删除立场 | ✅ | deletedPaths 52 条逐一 `existsSync` = 0 存活；`--diff-filter=D` 计数 = 953 = 951 + 2 re-add（两 re-add 经 git log 确认系上游新增、已清除） |
| 4 | 补丁重涂语义（11 项子检查） | ✅ | router 无 demo/share 路由、/storage=redirect；WorkspaceView 无 SafariBanner/useHead/createDemoShapes/route.meta.demo；EditorWorkspace 无 CollabPanel；constants 无 ACP 常量；ChatPanel 无 ACPPermissionDialog；ChatInput 无 ACP_AGENTS/isACPProvider；transports 保 harness（createActiveHarnessTransport L150）裁 ACP、providerID 有实际使用方；use/storage 无 isACPProvider、storage 有 IS_TAURI import；tsconfig 无 docs-config；package.json workspaces 含 harness 不含 docs；全 src/ 无 EditorView/StorageView/demo/SafariBanner/CollabPanel 悬空引用 |
| 5 | zones.json 刷新 | ✅ | P2.file=WorkspaceView.vue（载体迁移注记）；P33=EditorWorkspace.vue；patches=33；ownedRoots 含 spikes/ |
| 6 | check.ts MERGE_HEAD 分支（CI-8） | ✅ | L52-65 代码确认；注释载明动机 |
| 7 | 文档登记 | ✅ | D20=agent-runtime.md L120；SP-6=L131；CI-8=ci-infra.md L143；upstream-merge.md L47 记录漂移数字（subagent 独立复算 79/864/86A/762M/5D/11R 完全一致）；03 §5.3 已启动口径；§5.2 pi stars 94,558/11,699/134；tracker L44-46 三行各 8 逻辑列；_index 镜像；三 plan 存在 |
| 8 | narrative 绑定 | ✅ | narrative/03 L71、narrative/tracker L173 各有 T10 条目 |
| 9 | bun.lock 一致 | ✅ | `bun install --frozen-lockfile` = no changes（1174 installs / 1454 packages 核对通过） |
| 10 | 构建面冒烟 | ✅ | `bun run lint` 复核实测 0 errors / 3 warnings（1352 文件）；vite build 19.09s 采信 self-check 记录（未重跑） |
| 11 | 占位探针 | ✅ | T10-self-check 对 D19 正则 0 命中；本文件 commit 前由主 agent 以本报告回填 |
| 12 | self-check 声明抽查 | ✅/⚠️ | 613/7/1 冲突数字独立复算一致（UU 候选集 10 ⊇ 7，余 3 自动净合）；vite build 19.09s 与 bun install 418 为时点值不可事后精确重现（⚠️ 有旁证）；cli.test.ts 本地 1 例 fail 已如实披露待 CI 判定 |

## 3. 总评

- 通过：11（项 12 含两个时点值标 ⚠️）
- 失败：0
- 警告：1

## 4. 综合判定

- ✅ **T10 合并解决与登记完整性通过核验**（2026-08-21 subagent A 实做，commit 前）
- ✅ 验收 ⑥（远端 CI 12/12）：run 32458703514（HEAD 1749b877）overall success、12 job 全绿（2026-08-21，含 cli.test.ts 判定——本地所见 1 例 fail 在 CI 未复现，引擎测试全绿）
- ✅ E1（合回 rebuild/v2 + spike 分支）：rebuild/v2 fast-forward 004b1f48 → 1749b877 已推送（2026-08-21）

## 5. 新发现问题

- **N1（备查，非阻塞）**：`ACP_AGENTS` 仍存活于 settings 三文件（ProfileEditor.vue L14/75、ProviderSelect.vue L7/57/68、ModelsPanel.vue L5/20）及 core constants 导出——不在本轮裁切口径（P4/P5 只裁 ChatPanel/ChatInput），与 upstream-merge.md「acp: provider 概念残留」遗留项同一根因；Phase 1 重分类 chat/providers 时一并清理
- **N2（提示）**：本仓库为 git worktree，`MERGE_HEAD` 须用 `git rev-parse` 读（`.git` 是指针文件）

## 6. 补充（核验后）

- 核验全程只读；探针在系统临时目录且已清理
- 远端 CI 结果由主 agent 在 push 后实测（2026-08-21 补登，tasks/ 文件不触发 R3/R4 大改动检测）：
  - run 32455861262（9f15c43f）3 红：pi-mcp.test.ts 缺 `#tests/helpers/tauri/mocks`、knip 死 ignoreWorkspaces（packages/acp/demos）、format:check（zones.json 排版）→ 修复 commit 1dd381c8（后 amend 为 384560c3）：恢复 mocks.ts + deletedPaths 收窄为 6 个仍删文件、knip.json 清死条目并登记 P34、oxfmt 重排 zones.json
  - run 32457089797（384560c3）2 红：oxlint 空 catch（9f15c43f 引入，注释不算语句）→ catch 内补 `mergeHead = ''`；check-tasks R2 违规（645 行变更无 `task:` 指针）→ commit message amend 补 `task: T10`，force-with-lease 推送
  - run 32458156576（384560c3）1 红：TS6133 `tabCount` 未用（P2 重涂残留 import）→ 修复 commit 1749b877
  - run 32458703514（1749b877）**12/12 success**：引擎测试六 job 全绿（本地所见 cli.test.ts 1 例 fail 未复现，CI 判定通过）；期间本机 GitHub 连通性中断约 6 分钟，重试恢复
  - 机制侧记：format:check 是净树 gate（oxfmt --write 后 git status 必须为空），本地有未提交改动时必然报红，属预期行为
  - 附带机制更新：ci.yml push 触发加 `spike/**`（P32 注记），供 Phase 1 spike 分支走 CI

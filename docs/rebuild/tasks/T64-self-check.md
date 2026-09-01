<!--
  写作纪律（改本文前必读）：
  - 事实性声明必须附核验命令 + 日期，否则标为【假设】
  - 本文只保留当前态，不保留修正历史
  - 详细规则见 docs/rebuild/05-process.md §4
-->

# T64 自检 · CI 门禁分层：GHOST 窗口规则改 drift 雷达

> **状态**：✅ 已完成（2026-09-01 收口） | **时间**：2026-09-01 立项 | **负责人**：主 agent + 核验 subagent

## 1. 立项段自查（2026-09-01）

1. **病灶实证**：run 33460844556（Wave 2 push，本地零违规）红于 Rebuild discipline → `bun run check:zones` 报 2 条 GHOST（packages/vue/src/i18n/messages/dialogs.ts、locales/zh-cn/dialogs.json）——上游 be942783 i18n 命名空间重构删除，CI 现拉上游（ci.yml:113-116），本地 upstream ref 滞后故本地绿。GHOST 窗口规则源码 check.ts:204-249（`git log --diff-filter=D` 扫 merge-base..upstream/master）。
2. **拍板在案**：owner 2026-09-01 认可「外生移动靶拦 push = CI 机制分层错误」，方向 gate/radar 分层 + T63 先行解红。
3. **T63 已落地**：upstreamMergeTarball 白名单（base 88c10770，paths 两条）+ run 33463670151 全绿——本任务不改 T63 登记。

## 2. 实现段核验（2026-09-01 实测填报）

- **C1 --drift 收编**：check.ts main() 违例组装改 `...(process.argv.includes('--drift') ? checkGhostDeleted(zones, base) : [])`；usage 头注与 checkGhostDeleted 函数头注补 T64 定谳段（含 T63/run 33460844556 引证）。静态模式输出尾部不再有 GHOST 扫描。
- **C2 双模式实测**：`bun run check:zones` exit 0、`bun run check:zones:drift` exit 0（2026-09-01，两者输出 `clean: 81 modified … 485 added (owned), 1019 deleted … base 88c10770`（核验复核数，含本任务文档落盘后的增量），unpiped 直跑）。
- **C3 阴性探针**：核验 subagent 以临时文件实证——drift 模式报 GHOST、静态模式不报该条；探针文件已删，工作区无残留。
- **C4 雷达 workflow**：.github/workflows/upstream-drift.yml 新建——cron `17 1 * * *` + workflow_dispatch；权限 contents:read + issues:write；checkout fetch-depth 0 + persist-credentials:false → setup-bun → fetch upstream → `check:zones:drift`（id: drift）→ github-script@v7（`if: failure() && steps.drift.outcome == 'failure'`）建标题去重 issue `[upstream-drift] zone 雷达违规（GHOST 窗口规则）`，body 带 run 链接与处置 SOP。
- **C5 ci.yml 不动行为**：Zone registry purity 步骤仍 `bun run check:zones`（静态），步骤上方注释注明 T64 分层与雷达去向。
- **C6 登记**：package.json `check:zones:drift` 脚本；zones.json ownedFiles += `.github/workflows/upstream-drift.yml`、P32 扩注（task T64、lastReviewed 2026-09-01）——zones 变更带任务指针，无例外标记。
- **C7 门禁不回退**：rebuild 236/236、smoke:pi 19/19、lint 0 err、typecheck/dupes/arch/type-shapes/i18n/zones(双模式)/bindings/docs 全 exit 0（2026-09-01 unpiped 实测）。

## 3. 实测修正记录

1. **zones.json 文本锚点漂移**：oxfmt 重排导致逐字断言失配——登记改结构化 JSON load/modify/dump + oxfmt --write（与 T63 同法）。
2. **管道退出码陷阱再犯**：`cmd | tail; echo $?` 报 tail 的码——门禁一律 unpiped 直跑 + 日志文件捕获（纪律已二次钉扎）。
3. **gh run watch 解析错仓**：gh CLI 默认仓解析到 open-pencil/open-pencil（404）——CI 观察一律 `gh api repos/another-momo/open-pencil/actions/runs?branch=rebuild/mode-arch` 轮询。

## 4. 遗留与观察

- 雷达 workflow 首次实证待下次 cron/dispatch（当前 drift 干净，不会触发 issue 分支；dispatch 手动跑可验证绿路径）。
- 雷达噪声若偏高（上游活跃期频繁告警），后续立项评估 bot 自动处置 PR 或豁免面扩展。

<!--
  写作纪律（改本文前必读）：
  - 事实性声明必须附核验命令 + 日期，否则标为【假设】
  - 本文只保留当前态，不保留修正历史
  - 详细规则见 docs/rebuild/05-process.md §4
-->

# T51 计划 · CI 第三轮修复（GHOST silhouette + steiger 架构门禁首跑合规化）

> **状态**：✅ 已完成（2026-08-31 收口） | **时间**：2026-08-31 立项 | **负责人**：主 agent

## 1. 背景与问题

T50 commit（b289cfe3）推送后 run 33387675445 两红（`gh run view 33387675445 --repo another-momo/open-pencil`，2026-08-31 实测；其余 12 个 job 全绿，含此前全部修复面）。

| 失败 job / 步骤 | 根因 | 处置 |
|---|---|---|
| Rebuild discipline / Zone registry purity | 上游 379ef8b6（perf(canvas) #591，2026-08-31）删除 tests/engine/render/canvas/silhouette-autopsy.test.ts，本地仍存 → GHOST | 零本地引用自包含测试（grep 实测），跟随上游 `git rm` + deletedPaths 登记 |
| Code quality / Enforce architecture（check:arch = steiger） | 该步骤在 CI 步骤序中位于 lint/typecheck 之后——run 1/2 的 Code quality 都死在 lint 段从未跑到，本分支 steiger 从未绿过；lint 修好后首跑即暴露存量违规 10 err + 1 warn，全部在我们自有文件 | 逐项合规化（见 §2），不挂白名单、不改规则配置 |

steiger 违规清单与处置映射（steiger.config.ts L25/L41/L44 规则注册在案）：

| 规则 | 违规 | 处置 |
|---|---|---|
| prefer-domain-folders（≥3 同前缀，support.ts L25 白名单先例仅 2 例） | spikes/probes probe-×5 | 3 个 sp 探针迁 spikes/probes/sp/ 并去双前缀（a1-images-contract/b-rpc-timeout/c-kinsoku）；probe-t41/probe-t45 留存（前缀组 ×2 < 3 阈值） |
| 同上 | tests/engine/rebuild studio-×3 | 迁 tests/engine/rebuild/studio/ 去前缀（builtin-assets/manifest/registry） |
| 同上 | tools/rebuild verify-×4 | 见下行合并处置 |
| strict-tools-layout（tools/\<domain\>/ 下仅 src/** 或 tests/*.test.ts） | tools/rebuild {build-t46-base, verify-×4}.mjs + tools/cn-font-catalog/build.mjs | verify-×4 → tools/rebuild/src/verify/（去前缀，一次迁移同消两规则）；build-t46-base.mjs → tools/rebuild/src/；build.mjs → tools/cn-font-catalog/src/ |
| no-native-title-attributes-in-vue | FontsSettingsPanel.vue L372（err）/L378（warn）原生 title | 换 Tip 组件包裹（DesignPanel.vue L111 同款模式） |

## 2. 迁移伴随面

- **深度敏感脚本路径修正**：verify-t45/t46 repoRoot `..`×2→×4（src/verify/ 深 4 层）；build-t46 与 cn-font build `..`×2→×3（src/ 深 3 层）；probe-sp-b 相对 import `../`→`../../`。
- **base.md 重新生成**：build-t46-base.mjs 头注字符串含 verify 路径，重跑构建器 + 三保真核验（t44/t46/t48）全过。
- **引用扫零**：34 文件批量路径更新（28 篇 docs + 探针自引用 + cn-catalog.ts 生成头注 + cn-catalog.test.ts + system-prompt-base.md/base.md 头注），替换后 grep 零残留。
- **zones.json**：deletedPaths += silhouette-autopsy.test.ts（119 条）；迁移全在 ownedRoots 内（git mv 改名检测在案）。
- **同步骤掩盖的连锁暴露**：`check:arch && test:type-shapes` 为单步骤串联——check:arch 转绿后 test:type-shapes 首跑，须一并本地预演（实测暴露 Windows 缺失根 ENOENT，files.ts 补 existsSync，P50 扩注）。

## 3. 验收标准

1. `bun run check:arch` = No problems found（exit 0）。
2. `bun run check:zones` clean（GHOST 清零）。
3. 三保真核验新位置全过：t44 21/21、t46 3/3、t48 9/9。
4. 迁移后测试全过：`bun test tests/engine/rebuild/`（studio/ 三件套新位置）。
5. 九门禁 + CI 逐 push 口径（check:tasks/check:bindings --base HEAD~1）全绿。

## 4. 红线

- 不为自家文件挂 steiger 白名单、不改 steiger.config.ts 规则配置（门禁强度不减）。
- 不改任何运行时语义；探针/工具脚本仅路径层调整。
- 历史任务文档的路径引用随迁移同步更新（保持 R5 引用有效）。

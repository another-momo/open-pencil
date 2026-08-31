<!--
  写作纪律（改本文前必读）：
  - 事实性声明必须附核验命令 + 日期，否则标为【假设】
  - 本文只保留当前态，不保留修正历史
  - 详细规则见 docs/rebuild/05-process.md §4
-->

# T51 自检 · CI 第三轮修复（GHOST silhouette + steiger 架构门禁首跑合规化）

> **状态**：✅ 已完成（2026-08-31 收口） | **时间**：2026-08-31 立项 | **负责人**：主 agent

## 1. 立项段自查（目标面实证，2026-08-31）

1. **run 33387675445 失败面**：`gh run view --json jobs` 实测两红——Rebuild discipline（GHOST ×1）/ Code quality（check:arch 10 err + 1 warn）；其余 12 job 绿（含 T50 修复面全部）。
2. **GHOST 实证**：`git log --diff-filter=D 88c10770..upstream/master` 定位上游 379ef8b6（perf(canvas) #591）删除 silhouette-autopsy.test.ts；本地 grep 零外部引用（仅自引用）。
3. **steiger 首跑暴露的成因**：ci.yml Code quality 步骤序 = lint → typecheck → check:arch（L40/L43/L45 实读）；run 1（33372323229）Code quality 日志显示 check:arch 当时同样报错（回溯验证 2026-08-31）——该门禁在本分支从未绿过，非 T50 引入。
4. **规则语义实证**：strict-tools-layout 无白名单（index.ts L74-83：tools/\<domain\>/ 下仅 src/** 或 tests/*.test.ts，.json/.py 不在 TEXT_EXTENSIONS 故 verify-t45 的 dump json 与 t45-rewire py 不违规）；prefer-domain-folders 阈值 ≥3 且有 FILE_PREFIX_GROUP_ALLOWLIST 先例 2 条（support.ts L25-28），本任务选择迁移而非挂白名单（门禁不减）。

## 2. 实现段核验（2026-08-31 实测填报）

- **C1 GHOST 处置**：`git rm tests/engine/render/canvas/silhouette-autopsy.test.ts` + deletedPaths 登记（119 条）；check:zones clean（1019 deleted 全登记，exit 0）。
- **C2 十二文件迁移**（git mv，全部 ownedRoots 内）：probes sp×3 → spikes/probes/sp/（去双前缀）；studio×3 → tests/engine/rebuild/studio/；verify×4 → tools/rebuild/src/verify/；build-t46-base → tools/rebuild/src/；cn build → tools/cn-font-catalog/src/。
- **C3 深度修正**：verify-t45/t46 repoRoot 改 `..`×4（首改 ×3 实测 ENOENT 至 tools/src/...，二次修正后核验过——见 §3.1）；build-t46/cn build `..`×3 一次到位；probe-sp-b 相对 import `../../`。
- **C4 base.md 链**：重跑 build-t46-base.mjs（新位置，落位 10891 bytes 幂等）+ 三保真核验 t44 21/21、t46 3/3、t48 9/9 全过。
- **C5 FontsSettingsPanel**：两处原生 title 换 Tip 组件包裹（DesignPanel.vue L111 同款）；import 补登记。
- **C6 引用扫零**：34 文件批量更新（含 28 篇历史任务/spike 文档）；替换后全仓 grep 旧路径零残留（2026-08-31 实测）。
- **C7 check:arch**：`bun run check:arch` = ✔ No problems found（exit 0）。

## 3. 实测修正记录

1. **repoRoot 深度首改不足**：verify-t45/t46 迁至 src/verify/ 后需 `..`×4（verify→src→rebuild→tools→root），首轮只加到 ×3，node 实测 ENOENT（解析到 tools/src/...）后二次修正。教训：迁移后脚本必须实跑，不以目测为准——本任务所有迁移脚本均已新位置实跑验证（t44/t46/t48/build-t46 全过；t45 为 manifest dump 工具，路径逻辑与 t46 同构同步修正）。
2. **CI 步骤序掩盖效应**：同一 job 内靠前步骤失败会永久掩盖靠后步骤——lint 连红两轮导致 check:arch 存量违规迟发至今。推前验证不能只看「上次红过的步骤转绿」，job 内全步骤都需本地预演（本轮起 check:arch/test:type-shapes 纳入推前电池）。
3. **掩盖效应第二实例（同步骤 `&&` 链）**：`check:arch && test:type-shapes` 单步骤内串联——check:arch 红时 test:type-shapes 从未在本分支执行。本轮首跑暴露 Windows 平台缺陷：scripts/ 目录整体退役（tauri menu 生成器早已删除 + 本轮 GHOST 三 visual 脚本随上游 38bee364 删除）后目录消失，`Bun.Glob.scan('scripts')` 在 Windows 抛 ENOENT（Linux 返回空不炸）。处置：files.ts 补 existsSync 跳根（P50 扩注，2026-08-31 实测 type-shapes 转绿）。
4. **builtin-assets 测试的深度锚点**：tests/engine/rebuild/studio/ 迁移后 `import.meta.dir` 相对锚需 `../`×3→×4（registry/manifest 两测试用 `@/` 别名与 tmpdir，天然免疫）；首跑 1 fail 实测定锚后 26/26 转绿。迁移脚本/测试一律实跑验证，不目测。

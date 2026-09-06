# T98-self-check · 上游大合并（88c10770 → d82aaff9e）

> **状态**：已完成 | **时间**：2026-09-06 | **核验人**：主 agent
> **物理文件**：[T98-plan.md](T98-plan.md) / 本文 / [T98-verify.md](T98-verify.md)

## 阶段记录

### S1 · 规划落账（2026-09-05，主 agent）

- 三方坐标实测：base `88c10770`；upstream `d82aaff9e`（外部报告分析钉 `7964b99ba`，增量 5 commit 纯 i18n PR #644，`git diff --stat 7964b99ba..refs/remotes/upstream/master` = 31 文件 +636/-1225，落在 P192/P193 工作面内）
- 152 双边改动复算：99 deletedPaths + 9 owned + 7 tarball + 38 patch + 0 未登记（checker 语义：无尾斜杠条目同样按目录前缀匹配，`f === d || f.startsWith(d + '/')`）——外部报告的 86/8/13/45 分类口径偏差已修正
- 复活拦截复算：21 文件 / 5 前缀（外部报告 19/4，漏 `tests/engine/cli/` 2 件）
- Phase A 三代理已派发（A1 fonts 融合 + options 考古 / A2 draw 采用 + 注册链三闸门 / A3 台账七条吸收裁定），各居独立 worktree

### S2 · Phase B 执行（2026-09-05，executor subagent，落地 commit `31bf0316c`）

- draw 簇整文件取上游形态（labelParagraphCache + Skia paragraph ellipsis），T88 多 typeface 系统与四符号 helper 全仓退役——按 owner 拍板全跟随上游
- fonts.ts 三方融合按 A1 定稿落地（P107/P110/P113/P114/P115/P116 增量保留），options 考古裁定见 A1 DECISION
- i18n 域命名空间迁移（上游 be942783d）合并吸收 P192/P193；scene.ts 保留 P108 修复注入
- 85 deleted-by-us 走 git rm；139 上游新增复活文件按 deletedPaths 前缀 git rm --cached；4 个 T88 死代码测试退役出 ownedFiles 进 deletedPaths
- 冲突解决清单全部按 plan 执行（vite/aliases ours mermaid、SettingsDialog/ModelsPanel/MobileHud/StockPhotoKeysSection 人工判断、assistant ownedRoot ours）
- **Phase B 遗漏（Phase C 补救）**：A2 NOTES.md §3 闸门 1 明示前提「合并脚本必须补上 prepareGraphFonts/ensureFallbackPack 调用链」未落地——上游 loadFonts 只装 Inter，label 无 trackFontDemand 入口，导致场景 1 首渲染 tofu。根因与修复见 S3

### S3 · 收口（2026-09-06，主 agent）

**i18n 收口三连**：

1. `fd8d5b128`：6 上游测试 import `#cli/headless` 改指 `@open-pencil/core/io`（P197-P202）
2. `bf4928137`：diagnostics 域整域下线——executor 初判 P192/P193 revoked 复核翻案：34 键中 13 usage 键同名幸存、19 diagnostics 键改名幸存、仅 2 导航键真删；幸存键零消费（ux3 已删面板），执行整域删除 + P192/P193 改锚重激活 + P203-P206 新增，check:i18n 首次转绿（zh-CN 858/874）
3. 本 commit：浏览器验证暴露 7 文件 `dialogs` 聚合槽残留（上游 be942783d 删了该槽，Phase B 保留了 base 的解构行）——ChatPanel/PiChatInput/PiChatMessage 转 `ai` 域（11 键同名幸存逐键核实）、MobileHud/context 转 `common+collaboration`、SettingsDialog 转 `settings+common+credentials`、PiModelsPanel 按上游 ModelsPanel 自有映射转 `ai+collaboration`（models→modelsTitle、connected→collaboration.connected）、StockPhotoKeysSection 转 `media+credentials`（dialogs 实未使用）。修复后 ux6 chat 全链回归通过

**CJK label tofu 根治（场景 1 FAIL → PASS）**：

- 根因双层：(a) 上游 loadFonts 失去 T88 启动期回退预加载，无替代触发（A2 NOTES.md §3 闸门 1 前提被 Phase B 遗漏）；(b) 实测证明 TypefaceFontProvider **不做按字符跨族回退**——fontFamilies 仅 `['Inter']` 时 CJK 落 glyph 0 tofu；`['Inter','Alibaba PuHuiTi','Noto Naskh Arabic']` 链则 CJK 走 PuHuiTi、Latin 保 Inter
- 修复：P208 `renderer/fonts.ts` 在 `fontsLoaded`/`syncFontGeneration` 终态前注入 `fontManager.ensureFallbackPack()`；P207 `paragraph-cache.ts` paragraph 构建改读回退族现值链（族集合随注册推进 generation → 缓存 clear 重建，未注册族名被 Skia 静默跳过）
- 修后场景 1 PASS（截图证据 scene1-fixed-full.png）

**台账首批吸收（`513ef0f17`）**：R6 两件——startedAt 类型修复随 31bf0316c 带入、waitForAutomationHealth dev 竞态修复（vite-plugin.ts ownedRoot 免登记）、CORS preflight 回归测试入 ownedFiles

**zones 机验**：登记 P207/P208 后 `check:zones` 转绿（122 modified 全登记 / 706 added owned / 1273 deleted 全登记 / 30 renamed 交叉核对）

**浏览器验证**：A2 BROWSER-VERIFY-CHECKLIST.md 12 场景 + ux6 chat 回归全部执行完毕，逐项证据见 [T98-verify.md](T98-verify.md) V5/V6

**遗留登记**（不阻塞合回）：

- Arabic label tofu（场景 3）：远端无 characters 快路径只拉 fontsource latin/latin-ext 子集——预存缺陷，web-fonts.ts 与 mode-arch 完全一致，T88 时代同缺陷；修法候选（ensureFallbackPack 带代表字符）留 owner 决策
- 生僻字 龘/𠮷（场景 7）：实测全注册 family 链（PuHuiTi/Noto Sans SC/LXGW WenKai）glyph 0——覆盖边界非链路缺陷
- ux6 输入框两个预存 quirk：打字期间发送按钮恒 disabled（Enter 走 form requestSubmit 绕过）、placeholder 依存 `input` ref 打字时残留——均 mode-arch 同源行为
- 场景 9 协作 cursor 中文名 tofu：接受回归（P149 退役语义），合成注入实证 tofu 如预期

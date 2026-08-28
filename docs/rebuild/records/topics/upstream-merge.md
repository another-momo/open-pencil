<!--
  写作纪律（改本文前必读）：
  - 事实性声明必须附核验命令 + 日期，否则标为【假设】
  - 计划被实测推翻时，直接改本文为新版本，完整理由记入 records/ 子文档
  - 本文只保留当前态，不保留修正历史
  - 改完后刷新本文头部的「状态」字段
  - 详细规则见 docs/rebuild/05-process.md §4
-->

# records/topics/upstream-merge.md · upstream 合并与旧分支 WIP

> **状态**：已建立 | **时间**：2026-08-20 18:30 | **核验人**：主 agent
> **身份**：upstream 合并记录、旧分支 WIP 审判结果、合并 SOP。

---

## 合并类

## MERGE-1 · upstream 合并演习（15bd0ba1 → 0332b062）

- **类型**：合并
- **时间**：2026-08-19 14:00
- **内容**：upstream/master 8 commits（含 AI SDK 7 升级 #555）
- **冲突**：10 文件
- **处置原则**：删除区 modify/delete 一律重删；配置类（package.json/ci.yml）以 upstream 新结构为基座重放我方修改；bun.lock 重生成
- **副作用**：发现 bun 缓存需 `rm -rf node_modules` 重装以清陈旧的依赖版本副本
- **新增补丁**：P24（notifications locale 裁剪，satisfies Record<TranslatedLocale> 类型报错触发）
- **影响**：i18n 缝避让至 src/app/i18n/fork/（因上游 #557 已占 notifications/）

## 审判 · 旧分支 WIP（已结案）

- **时间**：2026-08-19 14:00
- **审判人**：Agent W
- **范围**：git status + `3f925191` 全 hunk 通读
- **结论**：**已终结**。这批 WIP 已随旧分支 commit `3f925191`「fix(quality): clear CI quality job errors」提交并推送，14/14 文件逐一核对全部为 lint/类型等价清理，零行为变更意图。**无一需要移植、无一可上游化、无一应丢弃**——rebuild 侧要么已逐字节一致，要么本就不含被清理的模式。重建分支无需从这批 WIP 继承任何东西。

---

## 执行期遗留（Phase 0 → 后续阶段）

| 项 | 内容 | 归属阶段 |
|---|---|---|
| `acp:` provider 概念残留 | models/settings 层仍引用 `ACP_AGENTS`（core constants）；选 ACP 档案会优雅失败 | Phase 1 重分类 chat/providers 时清理 |
| `@agentclientprotocol/sdk` 依赖 | 被 `src/app/integrations/mcp/runtime.ts` + core constants 引用，未裁 | 同上 |
| LFS 自有托管 | fork GitHub LFS 预算超额（pull 被拒）；新增 LFS 文件（如普惠体）前必须解决，或走子集化进普通 git（D6 相关） | D6 决策时 |
| knip/steiger/oxlint 死配置残留 | desktop/packages-docs 等 ignore 条目保留未清（无害，零补丁纪律）；~~knip.json `ignoreWorkspaces` 含 `packages/acp`~~ **已清**：T10 修复期 CI 实报 packages/acp + packages/demos 两条从未存在的死条目，删除并登记 P34（2026-08-21） | 可不处理 |
## 合并 · upstream/master@5201404f（T10，2026-08-21 开工）

- **类型**：合并记录（已闭环）
- **时间**：2026-08-21
- **分支**：merge/upstream-2026-08-21 → rebuild/v2
- **漂移实测**（`git diff 0332b062..upstream/master`，2026-08-21）：79 commits / 864 文件（86 A / 762 M / 5 D / 11 R）；fork 点 0332b062 = 2026-08-18 23:09，上游头 5201404f = 2026-08-20 21:28——约 2 天 79 commits，上游极高活跃
- **冲突面**：
  - modify/delete **613 文件**（我方 strangler 删除 ∩ 上游修改）——机械解决，保持删除
  - 活跃补丁被上游触及 **11/31**：router / EditorView（上游已删，P2 需迁移）/ constants / ChatPanel / ChatInput / chat/transports(+61 行) / chat/use / chat/storage / package.json / tsconfig / bun.lock
  - 上游新增落进 deletedPaths **2 文件**（tests/e2e/native/settings.spec.ts、tests/engine/tauri/harness-process.test.ts）——保持删除
  - 上游删除 5 文件（含我们打补丁的 EditorView.vue）；重命名 11 个全在 packages/vue（与我方补丁零交集）
  - tests/fixtures 零漂移——无 LFS 风险
- **动因**：owner 拍板 D20（先合并后开 Phase 1）；spike 验证的缝本轮被上游触及，先合并保证 spike 证据有效
- **结果**（2026-08-21 合并解决完成，commit/CI 待 push 后补）：
  - 冲突解决：613 modify/delete 全部保持我方删除；2 个 re-add 清除；UD（EditorView.vue）接受上游删除
  - **P2 载体迁移**：上游 bb5960cd 删 EditorView.vue/StorageView.vue、新增 WorkspaceView.vue + EditorWorkspace.vue——P2 语义拆分重涂：WorkspaceView.vue（demo/useHead/SafariBanner 裁切）+ **P33** EditorWorkspace.vue（CollabPanel 裁切）
  - **chat 缝「保 harness 裁 ACP」**：上游新增 pi harness 传输路径（SP-6）——保留（packages/harness 入 workspaces，P17 注记）；ACP 维持裁除（P4-P8 语义重涂于上游重构后形态）
  - 机制补强：check.ts resolveBase 加 MERGE_HEAD 分支（CI-8），否则合并中 zone check 必误报
  - 本地验证：四检查绿（zones 基线 5201404f：30M/88A/953D）+ build:packages ✅ + lint 0 errors + vite build ✅ 19.09s；全量单测按 owner 指示交远端 CI
  - 核验：subagent A 11 通过 / 1 警告 / 0 失败（[T10-verify.md](../../tasks/T10-verify.md)）；N1 备查：ACP_AGENTS 仍存活于 settings 三文件（ProfileEditor/ProviderSelect/ModelsPanel）——与上表「acp: provider 概念残留」遗留项同根，Phase 1 重分类时清理
  - **闭环**（2026-08-21 补登）：合并 commit b84530bf + 附带 9f15c43f + 三轮 CI 修复（384560c3 tauri mocks 恢复/P34/format + 空 catch 与 task 指针；1749b877 TS6133 tabCount）→ 远端 CI run 32458703514 **12/12 success**；rebuild/v2 fast-forward 004b1f48 → 1749b877；ci.yml push 触发加 `spike/**`（P32）。逐 run 明细见 [T10-verify.md §6](../../tasks/T10-verify.md)

## 合并-2 · upstream/master@88c10770（8 commits / 188 文件，内容裁定替代三路合并）

- **类型**：合并记录
- **时间**：2026-08-25
- **分支**：rebuild/pi-upstream-merge-2（自 2014c81a 拉出）
- **上游钉扎**：`88c1077071328b8df68f282543f16e20e97930b4`（`gh api repos/open-pencil/open-pencil/branches/master`，2026-08-25）
- **方法**：HTTPS 数据面断（`git fetch` curl 28），不做 git 三路合并——以 `gh api compare 5201404f...88c10770` 取 8 commit 文件清单 + tarball 快照取内容，按归属分类逐 commit 裁定落盘
- **漂移对账**：8 commit / 188 文件；与我们 5201404f..2014c81a 改动面（1338 文件）交叠 25 文件
- **八 commit 裁定**：采纳 4（bb8c5c18 vector rename / 7a311677 clipboard 加固 / b65b1bd4 tool-state 部分 / f75d67ad recovery 快进——D33 改判存量加固）+ 维持删除 4（5f8a373b diagnostics / 0f981ff2 portless / a0a71c34 changelog / 88c10770 cli import）
- **踩坑与处置**：
  1. **vector 改名实际发生时间**：上游 `bb8c5c18`（2026-08-24 提交，T10 之后）把 vector-edit → vector、node-edit → vector-input、shared/input/node-edit → vector。T10 合并（`b84530bf`，base=5201404f）未触碰 vector 系列（`git show b84530bf --name-status | grep vector` 零命中，2026-08-26 复核）。T31 借 bb8c5c18 落地新路径 + 物理清掉 vector-edit/node-edit 死目录。**T10 之所以留死目录，不是 tarball 法本身错，而是当时 check.ts 没有 ghost-deleted 检测兜底**——T32 新增 [`checkGhostDeleted`](../../../tools/zone-registry/src/check.ts) 根治此类死目录复发（同步清掉 12 个上游已删的 snapshot / AppTextButton.vue ghost）。
  2. 拷上游 messages/dialogs.ts + zh-cn/dialogs.json 冲掉 T21 自定义 26 个 pi* i18n key（TS2339 批量报错暴露），按 HEAD 定义合并回写 + check:i18n 复绿
  3. 7a311677 引入的 copySelectionToBrowserClipboard 圈复杂度 21>20 超仓内 lint 阈值，按纯度最小重构抽 helper（不增配置例外）
  4. RecoveryDialog 引用的 AppButton.vue / theme/button.ts 不在 f75d67ad commit 清单（上游前序带入），随批补拷
  5. zones.json 登记：deletedPaths +14（rename 旧路径）、ownedFiles +24（上游新文件）、patches P60-P82（21 modified + 2 测试重指）。**T32 复审**：这 24 个 ownedFile byte 与上游 88c10770 完全一致（属于 tarball 错位），21 枚 P60-P82 patch 中 18 枚 byte 一致（属 patch 错位），另 3 枚（P60/P61/P74）确有本地改动保留；5 个真实自有 ownedFile（ChatModeSelect 等）补 P98-P102 patch 溯源登记。详见 T32 §3 任务清单 S2-S5。
- **验收**：见 [tasks/T31-plan.md §4](../../tasks/T31-plan.md) C1-C5；自检 [tasks/T31-self-check.md](../../tasks/T31-self-check.md)

## T32 追写（2026-08-26） · zones 边界纠正 + check.ts 机制改造

- **背景**：T31 上游合并第二轮的 zones.json 登记存在 24+18=42 处 byte 一致错位（24 个 ownedFile + 18 个 patch 实际是 tarball 形态）+ 5 处自有 ownedFile 缺 patch 溯源登记。
- **改造**：
  - zones.json 新增 `upstreamMergeTarball` 顶层字段，含 T31 retro-T32 一条记录（base=88c10770, paths 含 42 个 byte 一致文件, deletedPaths 含 vector-edit/node-edit 三处）
  - 5 个真实自有 ownedFile（ChatModeSelect.vue / ChatStyleProfileSelect.vue / PiModelsPanel.vue / stock-photo-keys.ts / media-credentials.ts）保留 ownedFile + 新增 P98-P102 patch 溯源
  - P60/P61/P74 保留 patch（确有本地改动）；P62/P63/P65-P73/P75-P82 转 tarball
  - check.ts 新增 5 个函数：`checkUpstreamMergeTarball`（白名单）/ `checkRenames`（rename 交叉一致性）/ `checkGhostDeleted`（上游已删本地残留）/ `checkDriftTarball`（warn 模式）/ `collectRenames`；改 `collectChanges` 加 `-M` 启用 rename detection；改 `main()` 装配顺序
  - 物理清理 12 个 ghost 文件：AppTextButton.vue（上游 5f8a373b 删）+ 11 个 e2e snapshot png（上游 bb8c5c18 删）
  - 04-porting-discipline.md 新增 §5「owned/follow/tarball 三态边界判定」（含 tarball 与本地改动互斥规则 + ghost 检测 + 反例警示）
  - 02-phase-0.md §3.3 末尾追加指向 04 §5 的一句话
- **验收**：见 [tasks/T32-plan.md §6](../../tasks/T32-plan.md) C1-C13；自检 [tasks/T32-self-check.md](../../tasks/T32-self-check.md)；独立核验 [tasks/T32-verify.md](../../tasks/T32-verify.md)

## T34 追写（2026-08-27） · 上游合并第三轮（octopus 8 commits）

- **背景**：T31 第二轮合并（`c0c1f117`，base=88c10770）之后上游又发了 8 个 commit（截止 88c10770→0f981ff2）。owner 拍板 2026-08-27「整体一起拉个合并分支推进合并，不要单独拆开」——一次性 octopus 8 commit 同步到 `rebuild/upstream-merge-2`。
- **方法**：从 `rebuild/pi (36ad5c17)` 拉 `rebuild/upstream-merge-2` → `git merge --no-ff upstream/HEAD`（octopus 形态）→ 23→24 个冲突三类解（实际是 6+8+10=24，commit message 与 plan §1 自报「23」已追勘）→ 3 笔 commit 落地（merge / 三件套 / verify+追勘）
- **冲突分类与处置**：
  1. **modify/delete 6 个**：acp/transport.ts（5ed5cfe3 T25 soft-cut 删）/ tools/index.ts（39ce06a8 T27 三方 review 删）/ integrations/mcp/{pi,runtime}.ts（8cbbb1d0 T25 三路径收敛删）/ settings/mcp/MCPConnectionsSection.vue + settings/models/ProfileEditor.vue（同 T25 旧设置面切删）。**全部取我们删除侧**——保留 T25/T27 产品决策；6 个文件物理删除 0 命中（`git ls-files` 实测）。
  2. **i18n dialogs.json 8 个**：zh-cn 保留 HEAD（在 diagnosticsCopyFailed 后追加 26 条 pi 相关 key `piCatalogRefresh`/`piKeyPlaceholderConfigured` 等）+ 7 个 de/es/fr/it/ja/pl/ru 语种删除（T25 主动收敛——check:i18n 实测 "All locale files are in sync"）。
  3. **content 冲突 10 个**：vite.config.ts / vite/automation.ts / vite-plugin.ts（0f981ff2 改动 + git 自动合）+ spawn.ts（0f981ff2 + 我们 P104 + 三方手合）+ chat/transports.ts / debug/index.ts / clipboard/system.ts / SettingsDialog.vue / ChatPanel.vue（`git checkout HEAD`——保留 T25/T27/T31 决策）+ settings/dialog.ts / ChatMessage.vue（保留 HEAD import 段 + P-num 注释）。
- **机制发现（重要）**：
  1. **AppTextButton.vue 误删纠正**：merge 阶段把它当 modify/delete 一刀 `git rm`，事后 `git show HEAD:src/components/ui/AppTextButton.vue` 确认存在（T32 owner 拍板的「保留存在 ownedFile」）——`git checkout HEAD --` 恢复 + check:deps 从报错（Unresolved imports）转 exit 0。**教训**：modify/delete 冲突解前**必须**先 `git show HEAD:<path>` 确认 HEAD 是否真有此路径，不能仅凭 DU 标识一刀切。
  2. **zones 误判纠正**：T32 时把「上游删但我们已删」类 5 个文件标为「zones 机制漏洞、需手动登记 deletedPaths」。T34 实测 `check:zones` exit 0 报 `[zones] clean: ... 1014 deleted (all registered)`——`checkDeletedAbsent` 已覆盖删除方向。**纠正**：T32 文档（[04-porting-discipline.md §5](../../04-porting-discipline.md)）无需补登记条款；T35+ 不要再误判。
  3. **host.ts DISCOVERY_PATH 决策**：0f981ff2 给 vite plugin 加临时目录隔离（worktree 间抢 `~/.openpencil/mcp.json`），host.ts 是否跟？**决策：不跟**。理由：host.ts 生产形态端口独占（7600/7700），多实例被 EADDRINUSE 拦截，不存在 dev-plugin 同款 worktree 隔离场景。已在 spawnBridge 函数顶部加 5 行决策注记（未来多 host 实例时再复用 vite-plugin 的 sha256(runtimeId) 方案）。
- **验收**：见 [tasks/T34-plan.md §5](../../tasks/T34-plan.md) C1-C10；自检 [tasks/T34-self-check.md](../../tasks/T34-self-check.md)；独立核验 [tasks/T34-verify.md](../../tasks/T34-verify.md)（subagent V1-V8 全 ✅「可以收口」）。
- **推送状态**：本机 HEAD=`9a22d276`；远端推送阻塞——环境网络层 github.com 不通（实测：github/google TCP timeout、api.github.com TLS SEC_E_INVALID_TOKEN、baidu 200 OK；gh auth status 已登录；无 http(s).proxy 配置）。**等 owner 协助执行 SOP**：staging 先行 → CI 绿 → rebuild/pi 同 SHA → gh run view 复验。

## T36 追写（2026-08-28） · T31/T34 合并质量整改——静默反转追认 + 登记大扫除

- **类型**：决策追认 + 合并质量整改登记
- **拍板**：owner（2026-08-28，四项拍板，原文登记于 [tasks/T36-plan.md §2](../../tasks/T36-plan.md)）
- **背景机制**：T31 用「内容裁定替代 git 三路合并」（无 ancestry 链接）；T34 用真实 git merge（`c65d56e1`，parents = `36ad5c17` + `88c10770`）把 88c10770 树的 ancestry 与内容一并并入——**无冲突面自动落地**，T31 裁掉的四块随之静默进仓，直到 T36 大扫除才发现并登记。
- **静默反转清单与追认**（对「合并-2」段「维持删除 4」裁定的正式反转登记）：
  1. **diagnostics/usage 外壳（5f8a373b）——追认合入（D-拍板①）**。现状：`src/app/diagnostics/` 全家 + `src/components/settings/{diagnostics,usage}/` 面板 + `src/app/usage/summarize.ts` 均已在仓且与 base 字节一致；document/io、storage/sync 等上游调用点随之生效。**T36 完成 chat 级接线**：fork 版 `src/app/ai/chat/transports.ts`（P6）`handleChatFinish` 接 `recordChatCompleted`、`onError` 接 `recordChatFailed`（语义对齐上游 88c10770 版 L150/L255）。**已知后果**：usage 面板 token 列恒显「Not reported」（`usageNotReported`）——token 级接线（`recordModelStepCompleted` 经 pi 后端采数）**不在 T36 范围，登记排期**（后续 pi 后端任务携带）。
  2. **changelog（a0a71c34）——追认（D-拍板②）**。CHANGELOG.md 的上游审计条目随 merge 落地，与 02-phase-0.md §3.5「CHANGELOG.md 永久保持上游原样」一致，无需动作。
  3. **cli import（88c10770）——追认（D-拍板②）**。packages/cli 的 Node fs import 改动落地（packages/cli 在 pendingReclass 区，重分类仪式另案）。
  4. **portless（0f981ff2，vite 侧）——追认（D-拍板②）**。vite.config.ts / vite/automation.ts / vite-plugin.ts / spawn.ts 的 Portless 隔离改动落地；host.ts 不跟 DISCOVERY_PATH 隔离的决策维持（T34 已注记）。
- **mcp 僵尸 nav 清除（D-拍板③）**：T34 merge 把 base 的 mcp nav button 带回 `SettingsDialog.vue`（面板未回——点击落裸 `v-else` 的 Storage 面板）；`src/app/settings/dialog.ts` 的 `'mcp'` 成员同步复活（P45 成幻影 patch，与 base 字节一致）。T36 处置：删 nav button + 删 `'mcp'` 成员 + 裸 `v-else` 收窄为 `v-else-if storage` + 显式空态 fallback + `tests/e2e/settings/credentials.spec.ts` 两个 mcp 测试（五处僵尸断言宿主）删除（新 patch P106）。**i18n 死键 `settingsMCP` 保留不删**——packages/vue 两文件经 T35 还原与上游字节一致，删键徒增下轮合并冲突面，死文案无害（取舍注记于 P44 reason）。
- **zones.json 登记大扫除**（每条 `$comment` 已记缺口/去向）：P8 删（目标已删且在 deletedPaths，双重记账）；P60/P61 删（与 base 字节一致，T32 迁移漏网的幻影 patch）；P74 理由改写（实为 T31 eslint-complexity helper 抽取重构，61+/47- 行为不变）；P98-P102 删（5 对象为 fork 新建文件，已在 ownedFiles，双重记账且无 base 可补）；P45 改写为真实理由并随 W2 实做成为活 patch。
- **check.ts 登记健康三规则上线（D-拍板④）**：R-exist（patch 目标必须存在）/ R-diff（patch 相对 base 必须有 diff）/ R-mutex（patch 不得与 ownedFiles/stubs/deletedPaths 重叠）——直接判红，机器化防本轮发现的全部错位类型复发。
- **SOP 沉淀**：12 条上游合并 SOP 写入 [04-porting-discipline.md §6](../../04-porting-discipline.md)（本轮全部事故的清单化）。
- **顺带勘误**（append-only 不改原文）：本文件「T32 追写」段「物理清理 12 个 ghost 文件：AppTextButton.vue + 11 个 e2e snapshot png」 overstated——实证 `git show 0fbfd65e --name-status` = 11 个 D 行全为 snapshot png；AppTextButton.vue 未物理清理（同 commit 入 ownedFiles，过渡态 owned）。
- **验收**：见 [tasks/T36-plan.md §4](../../tasks/T36-plan.md)；自检 [tasks/T36-self-check.md](../../tasks/T36-self-check.md)；独立核验 [tasks/T36-verify.md](../../tasks/T36-verify.md)

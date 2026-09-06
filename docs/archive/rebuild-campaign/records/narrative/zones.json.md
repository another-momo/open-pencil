<!--
  写作纪律：事实须附核验命令+日期，否则【假设】。本文保留当前态，不保留修正历史。
  详见 docs/rebuild/05-process.md §4。
-->

# narrative · zones.json

> **状态**：已核验 | **时间**：2026-08-26 | **核验人**：主 agent
> **关联任务**：T32（zones 边界纠正 + check.ts 机制改造）

## T32（2026-08-26） · zones 边界纠正 + check.ts 机制改造

### 边界事实（实测 2026-08-26）

29 个 ownedFile 与上游 88c10770 字节核对结果：
- **24 条 byte 一致**（含 vector 15 + clipboard/recovery/theme 9 个）：上游存在，本地与上游完全一致 → **转 tarball 模式**
- **5 条上游不存在**（ChatModeSelect / ChatStyleProfileSelect / PiModelsPanel / stock-photo-keys / media-credentials）：本地新建文件，T21/T24/T25 期间引入 → **保留 ownedFile + 新增 patch 标签记溯源**
- **0 条上游不存在但被误归 ownedFile 的纯自有**：核对通过

P62-P82 21 枚 patch 字节核对：
- **18 条 byte 一致** → 从 patches 转 tarball
- **3 条有差异**（P60/P61/P74）：本地实际改动 → **保留 patch**

### 改造前后对照

- 改造前：24 个 byte 一致 ownedFile + 18 个 byte 一致 patch + 5 个真实自有 ownedFile（无 patch 溯源）+ 3 个真实 patch
- 改造后：24+18 = 42 个 tarball + 3 个真实 patch + 5 个真实 ownedFile（带 5 枚 patch 溯源）+ P60/P61 保留

### 三态边界（写入 04-porting-discipline.md §3.x）

- **owned**：纯自有资产
- **follow + patch**：我们改了上游的某个版本
- **tarball**：byte 一致的拷贝，结构化登记（zones.json `upstreamMergeTarball`）

### check.ts 三漏洞根治

- L1：tarball 无注册路径 → `checkUpstreamMergeTarball` 新增白名单
- L2：rename 一致性缺失 → `checkRenames` + `collectRenames` 新增
- L3：上游已删本地残留 → `checkGhostDeleted` 新增
- L4：tarball drift 检测 → `checkDriftTarball` warn 模式新增


## T32 收口（2026-08-26） · 行翻 ✅ + 收口评审 F1-F3

- **收口评审三发现**（owner 要求一次性 review 后修复）：F1 tarball drift 初版 warn 不阻断=门禁削弱，升红（`checkDriftTarball` 并入 violations，实测零 drift 无副作用）；F2 checkGhostDeleted 注释残留已废弃 P103 方案引用，订正指向 04 §5；F3 zones.json $comment 补 upstreamMergeTarball 语义与 P62-P82/P83-P97 缺号说明（前者转 tarball 移除、后者 plan 被 tarball 方案取代未启用）。
- **独立核验**：subagent V1-V5 全 ✅「可以收口」（V1 字节一致 8/8 空 diff；V2 zones.json 实体全对；V3 五函数+drift 升红确认；V4 文档四点全过；V5 门禁 exit 0 全套 + smoke:pi 80 断言 + CI 414d37d8 双链 success）。
- **commit 链**：0fbfd65e（首推，staging 红两处：zones.json 格式 + self-check 占位符）→ 414d37d8（修复，双链 success）→ 73b82c55（收口评审 F1-F3）→ 本 commit（verify 填报 + tracker/_index 行翻 ✅）。

## T36（2026-08-28） · 登记大扫除 + check.ts 登记健康三规则

### 大扫除（zones.json）

- **P8 删**：目标 `src/app/ai/chat/storage.ts` 已删且在 deletedPaths——双重记账（`ls` 实测不存在，2026-08-28）。
- **P60/P61 删**：两测试文件与 base 88c10770 字节一致（`git diff --quiet` 实测 exit 0）——T32 迁移漏网的幻影 patch。
- **P74 理由改写**：实为「T31 eslint-complexity helper 抽取重构」（`git diff --numstat` = 61+/47-，行为不变，`src/app/editor/clipboard/system.ts` L97-98 注记），原「上游合并快进」误记。
- **P98-P102 删**：5 对象为 fork 新建文件已在 ownedFiles——双重记账且无 base 可补；ownership 真源留 ownedFiles。
- **P45 改写为真实理由**：T25「SettingsSection 去 mcp」登记后未实做/被 T34 git merge 复活（幻影，与 base 字节一致）；T36 实做删除 `'mcp'` 成员（owner 拍板③）后成为活 patch。
- **P6/P44 reason 追记 T36 改动**（chat 级 diagnostics 接线 / mcp nav 清除 + v-else 收窄 + i18n 死键保留取舍）；**P106 新增**（credentials.spec.ts 删两个 mcp 僵尸测试）。
- `$comment` 记 P8/P60/P61/P98-P102 缺口去向（按 P62-P82 先例）；改动条目 lastReviewed 刷 2026-08-28。

### check.ts 三规则（owner 拍板④，直接判红）

- **R-exist** `checkPatchFilesExist`：非 revoked patch 的 file 必须在磁盘存在（杀 P8 类）。
- **R-diff** `checkPatchRealDiff`：非 revoked patch 的 file 相对 resolveBase 必须有 diff（杀 P45/P60/P61 类幻影/空挂；tarball.paths 与 revoked 豁免；分批 git diff --name-only 实现）。
- **R-mutex** `checkPatchMutex`：非 revoked patch 的 file 不得与 ownedFiles/stubs/deletedPaths 重叠（杀 P98-P102 类双重记账）。
- 实测证据（人为构造违规→判红→还原）：P998 不存在文件 → `PATCH file missing on disk` exit 1；P997 byte 一致文件 → `PATCH has no diff vs base` exit 1；P996 ownedFile 重叠 → `PATCH overlaps owned/deleted registration` exit 1；还原后全绿 exit 0（2026-08-28，逐条命令输出见 [tasks/T36-self-check.md](../../tasks/T36-self-check.md)）。
- 预检全集：改动前扫全部 67 条非 revoked patch，违规恰为 P8/P45/P60/P61/P98-P102 八条——与立项口径一致，无额外意外。

## T39（2026-08-30） · 字体能力建设登记批（P107-P112 + 23 ownedFiles）

- **ownedFiles +23**：`packages/core/src/text/font/registry.ts`（字体注册表白名单新建）、`tests/engine/text/fonts/registry.test.ts`（6 用例）、`tools/font-subset/` ×3（subset-fonts.py / charset-cjk.txt / package.json 子集化管线存档）、AlibabaPuHuiTi 9 字重 ttf ×18（`packages/core/assets/` + `public/` 双份，每字重 ~2.2MB 子集产物；普通 git 对象入仓——D-e：LFS 化推延，fork LFS 预算超额 + GitHub 直连不通，见 zones $comment 既有预警）。
- **P107**（fonts.ts）：BUNDLED_FONTS 由注册表派生 PuHuiTi 映射 + bundled 加载白名单拦截 + listFamilyOptions 枚举源改 FONT_REGISTRY。
- **P108**（scene.ts）：renderText 非 ready 态沿用旧 textPicture 缓存（14 册 §2.1 现象 B 方案 B）。
- **P109**（src/app/editor/fonts/index.ts）：systemFontDataCache 会话缓存 + 浏览器 local-fonts 权限启动同步。
- **P110**（fonts.ts）：listFamilyOptions 不再隐式 await requestLocalFontAccess——'prompt' 态 queryLocalFonts 永久挂起实测（Playwright race 4000ms 无响应）会卡住整个家族列表；浏览器实证挖出。
- **P111**（packages/vue FontPicker useFontPicker.ts）：picker 打开先 loadFamilies（bundled/web 无需权限），'prompt' 态 requestAccess 改非阻塞——与 P110 同链的第二条卡死点。
- **P112**（tests/engine/render/canvas/text.test.ts）：+2 pending 态 textPicture 缓存回归用例（钉 P108 行为）。
- 门禁实测（2026-08-30）：check:zones clean（60 modified 全登记）+ format:check 绿（zones.json 走 prettier 规范化消行尾抖动）+ lint 0 error + tsgo 绿。

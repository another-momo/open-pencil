<!--
  写作纪律（改本文前必读）：
  - 事实性声明必须附核验命令 + 日期，否则标为【假设】
  - 本文只保留当前态，不保留修正历史
  - 详细规则见 docs/rebuild/05-process.md §4
-->

# T39 自检 · 字体能力建设（注册表白名单 + PuHuiTi 子集内置 + 加载链修复）

> **状态**：已完成 | **时间**：2026-08-30 | **负责人**：主 agent
> **基线**：`08e43132`（T38 收口后 HEAD）+ T39 改动（分支 `rebuild/fonts`，本地提交，push 挂 D-e）

## 1. 改动清单（实测 `git status --short` + `git diff --stat`，2026-08-30）

| 文件 | 改动 |
|---|---|
| packages/core/src/text/font/registry.ts | **新建**：FONT_REGISTRY（Inter T0×5 字重 / Alibaba PuHuiTi T1×9 字重含「厂商保留收回权利」注记 / Noto Naskh Arabic T0）+ `isBundledFamilyAllowed` 白名单判定 |
| packages/core/src/text/fonts.ts | **P107**：BUNDLED_FONTS 由注册表派生 PuHuiTi 9 字重映射 + bundled 加载白名单拦截（非注册表家族 warn+拒载）+ `listFamilyOptions` 枚举源改 FONT_REGISTRY；**P110**：`listFamilyOptions` 不再隐式 `await requestLocalFontAccess()`（'prompt' 态 queryLocalFonts 永久挂起会卡住整个家族列表） |
| packages/core/src/canvas/scene.ts | **P108**：renderText 非 ready 态（pending/exhausted）沿用旧 textPicture 缓存——字重切换加载期文字不再消失-闪现（14 册 §2.1 现象 B 方案 B） |
| src/app/editor/fonts/index.ts | **P109**：`systemFontDataCache` 会话缓存（loadSystemFont 重复调用单次 IPC，CJK fallback 循环不再每次拉 ~100MB 字体表）+ 浏览器 local-fonts 权限启动同步（仅 granted 时回填，prompt 不触发弹窗） |
| packages/vue/src/primitives/FontPicker/useFontPicker.ts | **P111**：picker 打开先 `loadFamilies()`（bundled/web 无需权限），'prompt' 态 `requestAccess()` 改非阻塞——权限弹窗无人应答（自动化/用户忽略）时列表不再空白 |
| packages/core/assets/AlibabaPuHuiTi-*.ttf ×9 + public/AlibabaPuHuiTi-*.ttf ×9 | PuHuiTi 9 字重子集产物（每字重 ~2.2MB，共 ~20MB，`du` 实测 2026-08-29）；普通 git 对象入仓（D-e：LFS 化推延，fork LFS 预算已超 + GitHub 直连不通） |
| tools/font-subset/（subset-fonts.py + charset-cjk.txt + package.json） | 子集化管线存档迁入，可复跑（12 册定谳 #6 在仓实测） |
| tests/engine/text/fonts/registry.test.ts | 新建 6 用例：注册表结构/白名单/枚举可见性 |
| tests/engine/render/canvas/text.test.ts | **P112**：+2 用例钉 P108——pending 态缓存命中画旧图 / 缓存失效跳过渲染 |
| tools/zone-registry/zones.json | +23 ownedFiles（registry.ts / registry.test.ts / font-subset×3 / ttf×18）+ patch P107-P112 |

## 2. 门禁实测表（2026-08-30 本机）

| 门禁 | 命令 | 结果 |
|---|---|---|
| 类型检查 | `bunx tsgo --noEmit` | ✅ 零输出（静默绿） |
| lint | `bun run lint` | ✅ 0 errors（5 warnings 全为 max-lines 类：variants/index.ts 704 / types.ts 617 / props-overrides.ts 608 / mcp server test 609 为上游既有；fonts.ts 610 为本任务新增压线——P107 采纳注册表派生后净增≈0 行，警告不阻断门禁） |
| format | `bun run format:check` | ✅ All matched files use the correct format（zones.json 走 prettier 规范化） |
| zones | `bun run check:zones` | ✅ clean: 60 modified all registered, 324 added owned, base 88c10770 |
| docs | `bun run check:docs` | ✅ 40/40 |
| bindings | `bun run check:bindings` | ✅ 35 文件变更 binding 全绿 |
| tasks | `bun run check:tasks` | ✅（T39 三件套路径列登记后随本提交生效） |
| 字体单测 | `bun test tests/engine/text/fonts/` | ✅ 83/83（含 registry.test.ts 6 用例） |
| 渲染文本单测 | `bun test tests/engine/render/canvas/text.test.ts` | ✅ 新增 2 用例通过（14 pass）；同文件 6 fail 为**基线既有**（`git stash -u` 全量回退 T39 后复跑同 6 fail，2026-08-30 实测） |
| smoke:pi | `bun run smoke:pi` | ✅ 80/80（6+12+14+29+19） |

### 全量单测既有失败登记（非本任务引入）

- `bun run test:unit:quick` 基线对照双跑（2026-08-30）：基线 100 fail / 2560，带 T39 100 fail / 2567；失败集合 diff 仅 5 个用例双向漂移（flake），逐一隔离复跑全绿或既有飘移——详见 T39-verify §V5。
- `tests/engine/render/canvas/text.test.ts` 6 个既有 fail（Inter 字重宽度/CJK notdef/阿语 fallback 视觉组）在 `git stash -u` 全量回退 T39 改动后原样复现——上游既有/环境相关，非 T39 回归。

## 3. 过程中发现并修复

- **P110/P111 连锁 bug（浏览器实证挖出）**：C2 验证时字体选择器搜索任何字体（含 Inter）都「未找到字体」——根因两条：①`listFamilyOptions` 隐式 await `queryLocalFonts()`（权限 'prompt' 态在自动化/无头环境永久 pending，实测 race 4000ms 无响应）；②picker `watch(open)` 在 'prompt' 态先 `await requestAccess()` 再加载列表，同样卡死。两处修复后选择器列出 3 个注册表家族（Alibaba PuHuiTi / Inter / Noto Naskh Arabic，全 bundled）。
- **lint 新红**：scene.ts P108 初版 `fontReadiness === 'exhausted' || fontReadiness === 'pending'` 被 `no-unnecessary-condition` 判红（外层 `!== 'ready'` 已收窄联合类型）——去冗余条件复绿。
- **fonts.ts max-lines 压线**：PuHuiTi 9 条 BUNDLED_FONTS 字面映射改为从 FONT_REGISTRY 派生循环，净增≈0 行。

## 4. 遗留登记

- **D-b（O3 chooseLocalFontMatch 语义）** 未拍板，本任务未动；`loading-keys`/`multi-provider` 旧测试移植随营销测试批（13 册头注依赖关系）。
- **D-e 翻案点**：字体二进制当前普通 git 对象（仓库 +~20MB）；若 CI/远端验证必须先 push，需先解决 LFS 自有托管（zones.json $comment 已预警 fork LFS 预算超额）。
- CJK 远程 fallback（Web CDN 子集 provider）只留接缝未实现（S4 出栈项）——浏览器端 Inter 排 CJK 会停留 pending 态（保持空白而非豆腐块），由 P108 缓存策略托底已渲染文本。

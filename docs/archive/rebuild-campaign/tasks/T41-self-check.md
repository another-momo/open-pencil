<!--
  写作纪律（改本文前必读）：
  - 事实性声明必须附核验命令 + 日期，否则标为【假设】
  - 本文只保留当前态，不保留修正历史
  - 详细规则见 docs/rebuild/05-process.md §4
-->

# T41 自检 · 可变字体支持 + 字体白名单可视化管理

> **状态**：已完成 | **时间**：2026-08-30 | **负责人**：主 agent
> **基线**：`b8b3332c`（T40 收口后 HEAD）+ T41 改动（分支 `rebuild/fonts`，本地提交，push 挂 D-e）

## 1. 改动清单（实测 `git status --short`，2026-08-30）

| 文件 | 改动 |
|---|---|
| packages/core/src/text/font/variable.ts | **新建（owned）**：`sniffVariableFont`/`variableFontWeightRange`——sfnt 表目录定位 fvar 解析 wght 轴 min/max（F16.16 定点），woff 解头部目录，woff2 已知 tag 存在性判定；截断/畸形全程不 throw |
| packages/core/src/text/font/allowlist.ts | **新建（owned）**：`FontFamilyAllowlist`——disabled 集合（normalize 归一，关停基名连带 "X Variable" 后缀形态）+ bundled 锁定（registry source==='bundled'，D-d）+ setEnabled 锁定族 no-op + replaceDisabled 滤除锁定族 + revision 单调计数（picker 失效信号） |
| packages/core/src/text/fonts.ts | **P107 扩展**：bundled 门禁删 `!isVariableFont` 排除、local 门禁默认放行 VF（allowVariable 退役）；`findLocalFont` VF 放宽（显式 style 未命中时同族斜体一致候选按字重距离升序嗅探 fvar，首中即收，D-b）；VF 入账跟踪（variableFontKeys + evict 清理 + isVariableFamily/variableWeightRange）；`registerFontInBrowser` VF 传字重区间 descriptors；四加载门禁接 allowlist（loadFont/loadLocalFont/loadRemoteFont/loadCachedFont 入口 disabled → null）；ensureFallbackFamilies 跳过 disabled；**listFamilyOptions 出口过滤 + `includeDisabled` 选项（面板用不过滤枚举，§3-1）** |
| packages/core/src/text/font/registry.ts | owned 扩展：`FontRegistryEntry.variable?: boolean`；**syst（Source Han Serif CN VF）回注册表**（cdn/T0/OFL-1.1/variable:true/weights:[]，D-b 收口）；isProviderFamilyVisible 注释更新（运行时管控归 FontManager allowlist） |
| packages/core/src/text/web-font/cn-fonts.ts | owned 扩展：`CnFontFacePiece.weightMax?`；`parseCnFontResultCSS` 支持「250 900」区间双值；`selectCnFontPieces` 字重匹配改区间包含 |
| packages/core/src/canvas/text/index.ts | **P119 扩展**：`withWeightAxisVariation`——VF 家族未显式给 wght 轴时按 fontWeight 合流注入（clamp 到 fvar 区间），paraStyle 节点级 + pushStyleRun run 级双应用，显式 fontVariations 优先；pushStyleRun 复杂度治理（runFamily/runWeight/runItalic 提升复用） |
| src/app/editor/fonts/index.ts | **P109 扩展**：`disabledFontFamilies` localStorage 持久化（`op-font-disabled-families:v1`）+ watch deep immediate 推送 fontManager + `fontListRevision` ref 同步；**`listAllFamilies` 不过滤枚举（面板数据源，`listFamilies` 仍过滤供 picker，§3-1）** |
| src/app/settings/dialog.ts | **P45 扩展**：`SettingsSection` += `'fonts'` |
| src/components/settings/SettingsDialog.vue | **P44 扩展**：nav 加字体分区 + 面板渲染分支 |
| src/components/settings/fonts/FontsSettingsPanel.vue | **新建（owned）**：搜索 + 按来源分组（bundled/cdn/online/local）+ 逐族 AppSwitch；bundled 锁定族开关 disabled + 🔒 标注；VF 家族「可变」徽标；local 未授权引导行；启停计数摘要（分母 = 不过滤全量） |
| src/components/font-picker/FontPicker.vue | **P121**：以 `fontListRevision` 为 :key 重挂载 FontPickerRoot——白名单变更即时重拉家族（useFontPicker 一次性缓存的失效信号，D-h） |
| src/components/ui/AppSwitch.vue | **P122**：新增 `disabled` prop 透传 SwitchRoot（锁定族开关禁用态） |
| src/app/i18n/fork/{index.ts,locales/en.ts,locales/zh-cn.ts} | owned 扩展：fonts 域消息 + `useForkFonts` hook（T35 fork seam 纪律，不动 packages/vue messages） |
| tests/engine/text/fonts/variable-fonts.test.ts | **新建 13 用例**：fvar 解析（合成 buffer：区间读出/无 fvar null/截断不 throw）/ findLocalFont VF 放宽（静态严格契约不变 + VF 任意字重接受 + 斜体一致 + 嗅探失败回 null）/ VF 入账跟踪（isVariableFamily/variableWeightRange/evict 清理/FontFace 区间 descriptors）/ CDN VF 片入账 |
| tests/engine/text/fonts/allowlist.test.ts | **新建 8 用例**：枚举过滤（bundled 锁定恒在 + cdn/local 关停隐藏 + 重开恢复）/ **includeDisabled 面板路径（关停行仍列出）** / 四加载门禁 / fallback 链跳过 / revision 单调 + replaceDisabled 滤锁定 / normalize 归一 / syst 注册表标记 |
| tests/engine/text/fonts/cn-fonts.test.ts | owned 扩展至 22 用例（+4）：区间 font-weight 解析 + 区间包含选片 + syst 形态端到端（单目录 + 区间 css） |
| tests/engine/text/fonts/registry.test.ts | owned 扩展至 10 用例（+1）：CDN 六家族精确清单（syst 居首）+ syst variable 标记 + 其余五族非 VF |
| spikes/probes/probe-t41-variable-font.mjs | **新建（原 owned root workbench/，T47 起居 spikes/probes/）**：S1 CanvasKit VF 探针——真实 syst 分片注册后 wght 250/900 排版墨量对比 |
| tools/zone-registry/zones.json | patch 新增 P121/P122，P44/P45/P107/P109/P119 reason 扩展；ownedFiles += variable.ts/allowlist.ts/FontsSettingsPanel.vue/2 测试文件 |
| docs/rebuild/tasks/T41-plan.md | 任务卡（D-a..D-i 九决策点 + S1-S7 范围 + C1-C9 验收） |

## 2. 门禁实测表（2026-08-30 本机）

| 门禁 | 命令 | 结果 |
|---|---|---|
| 类型检查 | `bun run tsgo` | ✅ 零输出 |
| Vue 类型 | `bun run vue-tsc` | ✅ 零输出 |
| lint | `bun run lint` | ✅ 0 errors（4 warnings 全为 max-lines 类既有压线，fonts.ts 975 行等，不阻断） |
| format | `bun run format:check` | ✅ All matched files use the correct format |
| zones | `bun run check:zones` | ✅ clean: 67 modified all registered, 343 added owned, base 88c10770 |
| docs | `bun run check:docs` | ✅ 40/40 |
| tasks | `bun run check:tasks` | ✅（P121/P122 新增 + P44/P45/P107/P109/P119 改动摘要识别） |
| bindings | `bun run check:bindings` | ✅ 24 文件变更全绿 |
| i18n | `bun run check:i18n` | ✅ All locale files are in sync |
| 文本套件单测 | `bun test tests/engine/text` | ✅ **244 pass / 0 fail**（T40 218 + T41 新增 26：variable-fonts 13 + allowlist 8 + cn-fonts +4 + registry +1） |
| 全量单测基线对照 | `bun run test:unit:quick` | 见 §4（C8） |

## 3. 过程中发现并修复

- **面板数据源 bug（Playwright 实证挖出的真 bug）**：S5 面板首版 `onMounted` 用 `listFamilies()`——该枚举按白名单过滤，**关停某族后其行从管理面板消失、无法重开**，且摘要分母同步缩水（实测 2105/2105）。修复：core `listFamilyOptions` 加 `includeDisabled` 选项（fonts.ts），app 侧加 `listAllFamilies` 不过滤变体（editor/fonts/index.ts），面板挂载与「允许本地字体」两处均改用不过滤枚举；picker 仍走过滤版 `listFamilies`（关停语义不变）。补 allowlist.test.ts「includeDisabled：关停行仍列出」用例钉住。Playwright 复验三态截图：关行留存（2105/2106）→ 重开（2106/2106）→ picker 恢复列出（`doc/t41-fix-*.png`，2026-08-30）。
- **`characters` vs `text` 探针字段教训（长弯路根因）**：浏览器实证首段所有文本节点（VF 与 Inter 对照、新旧代码皆然）渲染空白。经 A/B 基线（stash 回旧代码同样空白）排除环境/回归后定谳：**探针 `createNode('TEXT', …, { characters })` 用错字段——SceneNode 文本字段是 `text`（types.ts），`characters` 静默吞掉得到空文本节点**，renderText 对空文本早退。教训：探针字段名必须对 scene-graph types 核验，空白渲染先查节点数据再查渲染链。
- **Vite HMR 双实例陷阱**：热更后 `page.evaluate(() => import('/packages/core/src/text/fonts.ts'))` 得到与 app 不同的第二个 fontManager 单例——模块侧 maps 全空而 app 渲染正常。**app 侧真值只能经 `store.renderer.*` 读**（vite/aliases.ts 全 src 映射下 import 路径差异触发双实例）。
- **VF 900 初渲染空白非 bug**：'Black' style 分片仍在 CDN 加载中，readiness 门（nodeFontReadiness）跳过绘制属设计行为；加载完成 + nudge 后 readiness 'ready' 正常重绘（t41-c1-vf-wght900.png）。
- **headless CanvasKit 簇复现**：定谳轮日志 139 行 `ENOENT: … open '/D:/…/canvaskit.wasm'` 签名（headless.ts `new URL('.', import.meta.resolve(...)).pathname` 在 Windows 产出 `/D:/` 前缀，bun existsSync 判否）——T40 已登记的环境性双向漂移簇，fileURLToPath 修复仍挂起（out of scope）。
- **定谳轮纪律复验**：本轮首跑 test:unit:quick 在浏览器 + dev server 未关时中途 exit 127 中止（2031 pass 后断）；按 T40 协议关闭两者后两轮完整跑完（§4）。另：`bun run test:unit <file>` 不过滤（脚本是 `bun test ./tests/engine`），单文件须直跑 `bun test <file>`；管道 `| tail` 会吞全量失败清单，取证须重定向全量日志。
- **lint 治理**：pushStyleRun 复杂度 23>20（runFamily/runWeight/runItalic 提升复用消除）；FontsSettingsPanel flatMap 消 non-null assertion；测试 window mock 统一 `(globalThis as typeof globalThis & { window?: unknown }).window` 范式（自定义规则 no-broad-unknown-type-assertions）。

## 4. 全量单测基线对照（C8）

- 两轮定谳实测（2026-08-30，浏览器 + dev server 均关闭，全量日志留存 `doc/t41-quick-full.log`）：**77 fail / 2615 tests / 430 files** 与 **76 fail / 2626 tests / 430 files**，对照 T40 定谳基线 78 fail / 2600 / 428——**失败数不增**。
- 失败清单按文件归集（71 例唯一失败，首现归属法）：**零 T41 触改/新增测试文件**（allowlist/variable-fonts/cn-fonts/registry 四文件定谳轮全绿，文本套件独立跑 244/244）。
- 失败簇构成与 T39/T40 已登记 flake 一致：①headless CanvasKit `/D:/` ENOENT 簇（flatten 15 / boolean 8 / render canvas text 6 / figma-images 4 / fonts/loading 4 等，日志 139 行 ENOENT 签名）；②MCP/eval/CLI 端口时序簇（tools/cli 12 / cli/eval 4 等，T39 已登记）；③window-mock 跨文件污染簇（frame-presets / in-memory clipboard / plugin-data——**隔离复跑 35/35 全绿**，2026-08-30 实测 `bun test tests/engine/app/clipboard/memory.test.ts tests/engine/editor/frame-presets.test.ts tests/engine/scene-graph/plugin-data.test.ts`）；④1 例网络依赖（cloud S3 CORS）。
- 测试总数 2600→2626（+26 = T41 新增），失败 78→76——簇内环境性漂移（T40 已记载该类双向漂移先例：基线 24 例曾单轮转绿）。

## 5. 遗留与边界

- **WASM 侧残留**（策略 A 不变）：VF 分片 typeface 同 T40 登记，逐出只释放 JS 引用。
- **字重任意值属性控件**（滑杆/数值输入）out of scope（plan §5）——渲染面已通，UX 增强独立任务。
- **headless.ts `/D:/` 路径修复**（fileURLToPath）继续挂起——flake 簇根因已定位，修复属独立改动。
- **D-e push 托管**：GitHub 直连不通 + fork LFS 预算超，本地提交。
- **VF 同族多 style 键记账放大**：同二进制多键各计一次字节，50MB 预算 + LRU 兜底（plan §6 已登记）。

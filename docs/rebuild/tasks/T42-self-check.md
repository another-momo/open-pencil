<!--
  写作纪律（改本文前必读）：
  - 事实性声明必须附核验命令 + 日期，否则标为【假设】
  - 本文只保留当前态，不保留修正历史
  - 详细规则见 docs/rebuild/05-process.md §4
-->

# T42 自检 · CDN 中文网字计划独立开关 + 全量目录（默认关）+ 字体面板交互优化

> **状态**：已完成 | **时间**：2026-08-30 | **负责人**：主 agent
> **基线**：`f5727880`（T41 收口后 HEAD）+ T42 改动（分支 `rebuild/fonts`，本地提交，push 挂 D-e）

## 1. 改动清单（实测 `git status --short`，2026-08-30）

| 文件 | 改动 |
|---|---|
| tools/cn-font-catalog/build.mjs | **新建（owned root）**：目录管线——npm search 枚举 83 个 `@chinese-fonts/` 包（翻页至空）→ 并发 8 逐包探针（packument version/license → jsdelivr dist/index.json → 逐目录 result.css 解析 font-family/font-weight，区间形态 → variable）→ 产出入仓。非 ASCII 目录名 jsdelivr 全边缘 404（实测 cdn/fastly/gcore）→ 逐目录回退 unpkg（CORS `*` 实测 200）；同族跨 CDN 分裂即排除 |
| packages/core/src/text/font/cn-catalog.ts | **新建（generated owned）**：105 族收录（37 族 unpkg base 钉扎，2 个 VF 族 xiaohe-simplify@2.0.0 区间 250-900）；`cnCatalogEntry`/`isCnCatalogFamily` 访问器；头部 generated 注释（构建日期 + 规模） |
| tools/cn-font-catalog/excluded.json | **新建**：9 条排除记录（6 包全目录双 CDN 不可达 + 3 个工具包 font-contours/index/wawoff2 index.json 非法） |
| packages/core/src/text/font/allowlist.ts | owned 扩展：catalog 族 opt-in 双集合语义（D-c）——`enabledCatalog` 集合 + `isEnabled` 分流（catalog 族只看 enabledCatalog，disabled 无否决权）+ `setEnabled` catalog 路由 + `replaceEnabledCatalog`（滤除非 catalog 族）+ `listEnabledCatalog`；两个 commit 均守「无变化 revision 不空转」 |
| packages/core/src/text/fonts.ts | **P107 扩展**：`cnFontsEnabled`（默认 true）+ set/is 访问器（D-a）；`cnFontDescriptor` registry 优先 catalog 兜底（含 normalized 归一回退）；`loadCnFontSubset` 门禁改判 cnFontsEnabled（与 provider 解耦）；`listFamilyOptions` catalog 枚举循环（`catalog:true` 标识）+ complexity 治理抽出 `collectRegistryAndCatalogOptions`（lint 实录 22>20）；`setEnabledCatalogFamilies`/`enabledCatalogFamilies` 委托；barrel 导出 cn-catalog |
| packages/core/src/text/font/registry.ts | owned 扩展：`CnFontCdnDescriptor.baseURL?: string`（T42：非 ASCII 目录 jsdelivr 404 → unpkg 回退基址） |
| packages/core/src/text/web-font/cn-fonts.ts | owned 扩展：`packageBase` 优先 `descriptor.baseURL`（catalog unpkg 族片源基址切换） |
| packages/core/src/text/font/sources.ts | **P115 扩展**：`FontFamilyOption.catalog?: boolean`（面板分组/授权提示用） |
| src/app/editor/fonts/index.ts | **P109 扩展**：`cnFontsEnabled`（`op-cn-fonts-enabled`，默认 true）+ `enabledCatalogFamilies`（`op-font-enabled-catalog:v1`）持久化接线；合并 watch 推送 fontManager + **`cnSwitchEpoch`**——CDN 主开关绕过白名单 revision（门禁在 fonts.ts 不经 allowlist），本地纪元计数补偿 picker 失效信号 |
| src/components/settings/fonts/FontsSettingsPanel.vue | **owned 重写**：来源开关区（在线总开关 + **CDN 独立开关** + 本地授权行 + 来源关停 hint）+ 状态筛选（全部/已启用/已停用）+ 5 组模型（bundled/cdn 精选/cdn 目录/online/local，长组默认折叠）+ 100 行截断 + 显示更多（+500/次）+ 组级批量启停（bundled 锁定跳过）+ catalog 族 license ⓘ（未审计标注）+ 搜索忽略折叠/截断；**主开关变更 watch 重拉枚举**（§3-1） |
| src/app/i18n/fork/locales/{en,zh-cn}.ts | owned 扩展：fonts 域 +13 key（来源开关/筛选/批量/显示更多/未审计授权/catalog 提示等；T35 纪律不动 packages/vue messages） |
| tests/engine/text/fonts/cn-catalog.test.ts | **新建 7 用例**：生成物结构契约（必填字段/weights 升序/VF 恰两端点/family 唯一/registry 6 包不入目录/unpkg 族带 base/VF 收录） |
| tests/engine/text/fonts/allowlist.test.ts | owned 扩展至 12 用例（+4）：catalog 默认关且不入 disabled / 开启计入 enabledCatalog + revision / 关闭回收 + 同态不空转 / replaceEnabledCatalog 滤除非 catalog 族 + 双集合隔离 / disabled 对 catalog 族无否决权 |
| tests/engine/text/fonts/cn-fonts.test.ts | owned 改版至 23 用例（+1 净增）：旧耦联用例「providers 全关 → CDN 隐藏」**改版**为 T42 D-a 新语义（providers 全关 + cnFontsEnabled=true → CDN 枚举在且加载走 cn 路由；cnFontsEnabled=false → 枚举隐藏含 includeDisabled 路径 + loadRemoteFont 零触网）+ catalog 族端到端（默认关零触网 → opt-in 开启 → 钉扎版本 URL 加载 cdn 来源）；syst 路由用例改 providers 全关钉解耦 |
| tools/zone-registry/zones.json | ownedRoot `tools/cn-font-catalog/` + ownedFiles cn-catalog.ts/cn-catalog.test.ts；P107/P109/P115 reason 扩展 |
| docs/rebuild/tasks/T42-plan.md | 任务卡（D-a..D-h 八决策点 + S1-S7 范围 + C1-C7 验收） |
| docs/rebuild/{tracker.md,tasks/_index.md} | T42 行登记（🔄→✅ 见 verify） |

## 2. 门禁实测表（2026-08-30 本机）

| 门禁 | 命令 | 结果 |
|---|---|---|
| 类型检查 | `bun run tsgo` | ✅ exit 0 |
| Vue 类型 | `bun run vue-tsc` | ✅ exit 0 |
| lint | `bun run lint` | ✅ **0 errors**（§3-2 修复后） |
| format | `bun run format:check` | ✅ All matched files use the correct format |
| zones | `bun run check:zones` | ✅ clean: 67 modified all registered, 350 added owned, base 88c10770 |
| docs | `bun run check:docs` | ✅ 40/40 |
| tasks | `bun run check:tasks` | ✅（P107/P109/P115 改动摘要识别） |
| bindings | `bun run check:bindings` | ✅ 19 文件变更全绿 |
| i18n | `bun run check:i18n` | ✅ All locale files are in sync |
| 文本套件单测 | `bun test tests/engine/text` | ✅ **256 pass / 0 fail**（T41 244 + T42 新增 12：cn-catalog 7 + allowlist +4 + cn-fonts +1） |
| 全量单测基线对照 | `bun run test:unit:quick` | 见 §4（C6） |

## 3. 过程中发现并修复

- **面板来源开关口径 bug（Playwright 实证挖出）**：面板 `families` 仅 onMounted 拉一次——拨 CDN/在线主开关后 core 枚举已按开关门禁，**面板列表仍显示关停来源的族**（与来源关停 hint「其家族从列表与字体选择器中隐藏」口径矛盾）。修复：watch `[cnFontsEnabled, onlineFontsEnabled]` 重拉 `listAllFamilies()`（FontsSettingsPanel.vue）。复验：CN 关 → CDN 精选/目录两组消失（摘要 2098/2101）；CN 开回 + 在线关 → 在线组消失、CDN 两组在（10/114，catalog 1/105 持久化跨开关保留）。
- **lint 8 errors 治理**：build.mjs 6 例 `no-mixed-case-acronym-identifiers`（fetchJson→fetchJSON / parseResultCssFamilies→parseResultCSSFamilies）+ 2 例 complexity 超限（probePackage 23>20 → 抽出 probeFamilyDirs 逐目录探针；listFamilyOptions 22>20 → 抽出 collectRegistryAndCatalogOptions）。
- **catalog/在线跨源同名碰撞（设计行为登记，非 bug）**：fontsource 目录含 3 族与 catalog 同名（Long Cang / LXGW Marker Gothic / Zhi Mang Xing，Playwright 实测已停用筛选列出）。白名单按家族名管控（T41 语义：关停 = 视为未安装，跨来源生效）——catalog 族名 opt-in 判定同样约束在线同名族：CN 关时同名族落入在线组但开关关态。语义自洽（同一字体不同分发渠道），面板组计数可见。
- **定谳轮失败归因脚本教训复用**：bun 失败摘要区重复打印全文（含相同时序后缀），按文件分桶去重会把摘要失败二次归属末文件——本次改**全局首现归属**（73 例唯一失败 / 23 文件，T41 的 71/21 同法口径）；日志全量留存 `doc/t42-quick-full.log`。
- **环境性网络面**：本机 fonts.google.com 不可达（ERR_CONNECTION_TIMED_OUT，unifont google provider 初始化失败回退）——T40 起已登记；CDN 链路（jsdelivr/unpkg）与 fontsource 实测正常。

## 4. 全量单测基线对照（C6）

- 定谳实测（2026-08-30，浏览器 + dev server 均关闭，全量日志 `doc/t42-quick-full.log`）：**77 fail / 2527 pass / 2627 tests / 431 files**，对照 T41 定谳基线 77 fail / 2615 与 76 fail / 2626 / 430——**失败数不增**（+1 文件 +12 用例 = T42 新增测试资产）。
- 失败清单按文件归集（73 例唯一失败，全局首现归属法）：**零 T42 触改/新增测试文件**（cn-catalog / allowlist / cn-fonts / registry 四文件定谳轮全绿，文本套件独立跑 256/256）。
- 失败簇构成与 T41 已登记 flake 逐项核对一致：①headless CanvasKit `/D:/` ENOENT 簇（日志 139 行 ENOENT 签名，与 T41 同数；flatten 15 / boolean 8 / render canvas text 6 / figma-images 4 / fonts/loading 4——loading.test.ts 4 例与 T41 日志逐条同名：network disabled + headless 资产 ENOENT）；②MCP/eval/CLI 端口时序簇（tools/cli 12 / cli/eval 4 等）；③window-mock 跨文件污染簇（frame-presets / memory / plugin-data，T41 已实证隔离复跑 35/35 全绿）；④1 例网络依赖（storage CORS）。
- 测试总数 2626→2627、文件 430→431：新增 cn-catalog.test.ts（7 用例）+ allowlist +4 + cn-fonts +1；T41 两轮之间本身存在 ±11 例环境性枚举漂移（ENOENT 崩溃文件不计数），本轮转轮差在既有幅度内。

## 5. 遗留与边界

- **目录更新靠管线重跑**（显式动作）：`bun tools/cn-font-catalog/build.mjs`；运行时零目录枚举（D-b）。npm search 可见面之外的包不在目录（已知边界，plan §5）。
- **catalog 族授权一律未审计标注**（D-d 分层治理）：面板 ⓘ 展示包内 license 原文（全 105 族 npm 包字段均为 'MIT'，系打包者字段非字体授权本体——治理红线：catalog 不给 tier）。
- **跨源同名族**（§3 第 3 条）：按名管控语义自洽，未做按源拆分（如需「在线渠道可用而 CDN 渠道停用」粒度，独立任务再议）。
- **FontSettingsPopover 未动**（D-h）：picker 浮层四家 provider 复选维持现状；CDN 主开关落设置面板。
- **headless.ts `/D:/` 路径修复**（fileURLToPath）继续挂起——flake 簇根因已定位，修复属独立改动。
- **D-e push 托管**：GitHub 直连不通 + fork LFS 预算超，本地提交。

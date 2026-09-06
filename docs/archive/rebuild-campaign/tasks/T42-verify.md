<!--
  写作纪律（改本文前必读）：
  - 事实性声明必须附核验命令 + 日期，否则标为【假设】
  - 本文只保留当前态，不保留修正历史
  - 详细规则见 docs/rebuild/05-process.md §4
-->

# T42 核验报告 · CDN 中文网字计划独立开关 + 全量目录（默认关）+ 字体面板交互优化

> **状态**：已完成 | **时间**：2026-08-30 | **核验人**：主 agent（单测 + Playwright 浏览器实证 + 基线对照取证）
> **基线**：`f5727880` + T42 改动（dev server localhost:1420 实跑，vite 热更含全部 T42 改动）
> **浏览器实证纪律**：Playwright MCP（owner 指令：不用 zcode 内置浏览器）；截图证据存仓外 `doc/`

## V1 CDN 独立开关（C1）✅

- 单测（`bun test tests/engine/text/fonts/cn-fonts.test.ts` 23/23，2026-08-30）：
  - providers 全关 + cnFontsEnabled 默认开 → CDN 六族照常枚举，且 `loadRemoteFont('LXGW WenKai')` 走 cn 路由加载成功（`loadedFontSource === 'cdn'`）；
  - cnFontsEnabled=false → CDN 家族枚举隐藏（**includeDisabled 面板路径同样隐藏**，源级开关优先于行级状态）+ loadRemoteFont 零触网（mock 断言无 lxgwwenkai 请求）；
  - syst 路由用例改 providers 全关钉解耦（旧断言 `setOnlineFontProviders({google:true})` 已废）。
- Playwright 实证（2026-08-30，localhost:1420）：
  - **CN 关 + 在线开**：picker 搜 "LXGW" → 3 选项全部 fontsource 来源（CDN 的 LXGW WenKai 条目消失）；搜 "快看" → 0 选项（catalog 族已 opt-in 开启但随源级开关隐藏）——`doc/t42-s7-04-picker-cn-off.png`；
  - **CN 开 + 在线关**：picker 搜 "LXGW WenKai" → 唯一选项 **cdn 来源标签**；在线组从面板消失——`doc/t42-s7-05-panel-online-off.png`；
  - 面板来源开关区：在线总开关 + **中文网字计划 CDN 独立开关**（带「独立开关——不受在线字体库总开关影响」说明）+ 本地授权行 + 关停 hint——`doc/t42-s7-01-sources-switches.png`。
  - picker 失效信号（cnSwitchEpoch 补偿）双向实证：两次拨开关后 picker 搜索结果均即时翻转（LXGW 选项 cdn↔fontsource 来源标签互换）。

## V2 catalog 全量入仓（C2）✅

- 管线实录（`bun tools/cn-font-catalog/src/build.mjs`，2026-08-30）：npm search 83 包可见面 → 77 包探针（registry 6 包排除）→ **105 族收录 / 9 条排除**（excluded.json 原因齐全：6 包全目录双 CDN 不可达 + 3 工具包 index.json 非法）。
- 关键发现：非 ASCII 目录名 jsdelivr 全边缘节点 404（实测 cdn/fastly/gcore；T40 sypxzs 个案上升为普遍规律）→ 逐目录 unpkg 回退（实测 200 + CORS `*`）——37 族因此得救并入仓（条目带 `base: 'https://unpkg.com'` 钉扎）。
- 单测（`bun test tests/engine/text/fonts/cn-catalog.test.ts` 7/7，2026-08-30）：必填字段 / weights 升序正整数 / VF 恰两端点 / family 全局唯一 / registry 6 包不入目录 / registry cdn 族 isCnCatalogFamily 恒假 / unpkg 族 base 钉扎 / VF 收录（小禾简化 VF 250-900）。

## V3 catalog 默认关 + opt-in（C3）✅

- 单测（allowlist.test.ts 12/12，2026-08-30）：catalog 族默认 isEnabled false 且**不入 disabled 集合**（双集合隔离）；setEnabled(true) 计入 enabledCatalog + revision 推进；重复同态 revision 不空转；replaceEnabledCatalog 滤除非 catalog 族（Inter/LXGW WenKai 注入被滤）；disabled 集合对 catalog 族无否决权。
- cn-fonts.test.ts catalog 端到端：默认关时 `loadRemoteFont('快看世界体')` 白名单门禁短路零触网；opt-in 开启后 picker 枚举出现（`catalog:true` 标识）且经 cn 路由加载（mock 断言命中钉扎版本 URL `/npm/@chinese-fonts/kksjt@3.0.0/`）。
- Playwright 实证（2026-08-30）：
  - 面板 CDN 目录组 **0/105 全关态全列**（默认折叠）——`doc/t42-s7-02-catalog-expanded.png`（展开后 100 行 + 显示更多 + license ⓘ「授权：MIT（以包内声明为准，未审计）」+ 2 个 VF 族「可变」徽标）；
  - 开启快看世界体：摘要 2103→2104、组计数 0/105→1/105、localStorage `op-font-enabled-catalog:v1` 持久化 `["快看世界体"]`；
  - picker 搜 "快看" → 出现 cdn 来源选项 → 选中文本节点换字 → **真实网络链**（jsdelivr `@chinese-fonts/kksjt@3.0.0`：index.json → result.css → 5 枚子集 woff2 全 200，network 面板实录）→ 渲染 readiness 'ready'，画布中文以快看世界体形态呈现——`doc/t42-s7-06-canvas-catalog-font-rendered.png`。

## V4 既有默认行为不变（C4）✅

- 既有套件零改版通过（除 C1 语义改版用例）：registry.test.ts 10/10 未动；文本套件 256/256 中 T41 的 244 用例原样全绿（2026-08-30 `bun test tests/engine/text`）。
- Playwright 实测默认态：bundled 3/3 锁定恒开（开关 disabled + 🔒）、CDN 精选 6/6 默认开、在线 2094/2094 默认开、catalog 0/105 默认关——`doc/t42-s7-01-sources-switches.png`。

## V5 面板 UX（C5）✅

Playwright 实证（2026-08-30，全部截图在仓外 `doc/`）：

- **状态筛选**：「已停用」筛出 3 行（fontsource 与 catalog 同名族，self-check §3-3 设计行为登记）——`doc/t42-s7-03-filter-disabled.png`；三态切换即时。
- **折叠/展开**：catalog/在线两长组默认折叠（▸），bundled/cdn 精选默认展开（▾）；搜索 "Maple" 自动展开命中组并跨组过滤（7 行全列，忽略折叠与截断）。
- **截断/显示更多**：catalog 展开渲染 100 行 +「显示更多（还有 5 个）」→ 点击后 105 行全渲染、按钮消失（实测 before=100 after=105）。
- **批量启停**：CDN 精选组「全部停用」→ 0/6（摘要 10→4，disabled 集合持久化 6 族）→「全部启用」→ 6/6（集合清空）；bundled 组无批量按钮（锁定跳过）。
- **来源开关区**：在线总开关 + CDN 独立开关 + 本地授权行 + 来源关停 hint（任一主开关关停时出现）；主开关变更后面板列表重拉（V1 两组消失/复现实测）。

## V6 门禁 + 全量基线对照（C6）✅

- 门禁十项全绿，实测表见 [T42-self-check.md §2](T42-self-check.md)（tsgo / vue-tsc / lint 0 error / format:check / check:zones clean / check:docs 40/40 / check:tasks / check:bindings / check:i18n / 文本套件 256/256，2026-08-30）。
- `test:unit:quick` 定谳（浏览器 + dev server 关闭后实跑，全量日志 `doc/t42-quick-full.log`）：**77 fail / 2527 pass / 2627 tests / 431 files**，对照 T41 基线 76-77 fail / 2615-2626 / 430——失败数不增，**失败清单零 T42 触改文件**（73 例唯一失败全局首现归属，四字体测试文件全绿），失败簇构成与 T41 逐项核对一致（139 行 ENOENT 签名同数；loading.test.ts 4 例与 T41 日志逐条同名）。详表见 [T42-self-check.md §4](T42-self-check.md)。

## V7 三件套 + 登记（C7）✅

- 三件套：T42-plan.md（状态翻 ✅）/ T42-self-check.md / 本文。
- 登记：tracker.md + tasks/_index.md T42 行翻 ✅（check:tasks/check:zones 复验绿）；zones.json ownedRoot `tools/cn-font-catalog/` + ownedFiles cn-catalog.ts/cn-catalog.test.ts + P107/P109/P115 reason 扩展（check:zones clean，2026-08-30）。
- 截图与定谳日志归位仓外 `doc/`（6 张 t42-s7-*.png + t42-quick-full.log，遵 owner 纪律）。

## 结论

C1-C7 全过。**三件事均已交付并经浏览器实证**：①CDN 中文网字计划有独立可见开关（设置面板来源区，与四家在线 provider 总开关零耦合，枚举/加载双门禁 + picker 失效补偿）；②中文网字计划全量目录 105 族入仓可支持（构建期管线 + 版本钉扎 + unpkg 回退面），逐族开关默认关（opt-in 双集合白名单），开启后 picker 可选、CDN 子集加载渲染端到端打通；③面板交互整体优化（来源开关区 / 状态筛选 / 分组折叠 / 100 行截断 + 显示更多 / 组级批量启停 / catalog 授权未审计标注 / 主开关变更列表重拉）。D-e（push 托管）维持推延。

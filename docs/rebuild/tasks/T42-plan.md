<!--
  写作纪律（改本文前必读）：
  - 事实性声明必须附核验命令 + 日期，否则标为【假设】
  - 计划被实测推翻时，直接改本文为新版本，完整理由记入 records/ 子文档
  - 本文只保留当前态，不保留修正历史
  - 改完后刷新本文头部的「状态」字段
  - 详细规则见 docs/rebuild/05-process.md §4
-->

# T42 计划 · CDN 中文网字计划独立开关 + 全量目录支持（默认关）+ 字体面板交互优化

> **状态**：✅ 已完成 | **时间**：2026-08-30 立项 / 2026-08-30 收口 | **负责人**：主 agent
> **分支**：`rebuild/fonts`（基于 `f5727880` T41 收口后 HEAD）
> **规格真源**：owner /goal（2026-08-30，见 §1）

## 1. 背景与立项

owner /goal（2026-08-30 原文）：「1、cdn中文网字计划需要有独立可见的开关，而不是跟着其他四个远程字体库关掉就关掉了；2、能支持的字体都支持，但字体开关默认不打开；3、分析并优化字体开关设置面板的整体交互体验」

**现状接缝盘点**（2026-08-30 代码实测）：

### CDN 与在线 provider 的耦联点（item 1 要拆的）

- 枚举门禁：`listFamilyOptions` 内 `onlineEnabled = enabledOnlineFontProviders().length > 0`，为 false 时 registry CDN 家族不枚举（`packages/core/src/text/fonts.ts:344-350`）。
- 加载门禁：`loadCnFontSubset` 入口 `this.enabledOnlineFontProviders().length === 0 → null`（`fonts.ts:688`）。
- 即「关停全部四家 provider ⇒ CDN 一并消失且零触网」——T40 D-g 设计，T42 owner 要求解耦。
- 既有测试钉着旧语义：cn-fonts.test.ts 路由组「关停全部在线 provider 后 CDN 家族从枚举隐藏且 loadRemoteFont 零触网」——本任务改版为新门禁。

### 全量目录（item 2）

- 注册表只收录 6 族 CDN 家族（`font/registry.ts:84-135`），每族经人工 jsdelivr 实测。
- 目录规模实测（2026-08-30）：`curl "https://registry.npmjs.org/-/v1/search?text=%40chinese-fonts&size=250"` 首页 250 条中命中 **83 个 `@chinese-fonts/` 作用域包**，翻页 from=250 命中 0——搜索可见目录 ≈ 83 款（非搜索排名遗漏的包不在覆盖面，属已知边界）。
- 包名是拼音缩写不带家族名（`@chinese-fonts/jyhpws` 等），家族名须逐包拉 `dist/index.json` + `result.css` 解析（syst 先例）；jsdelivr `package.json` 可取 license/version（实测 lxgwwenkai → MIT/3.0.0——与注册表审计的 OFL-1.1 不一致，包内 license 字段质量参差，治理上只能原文展示）。
- 加载面零改造：`CnFontSubsetResolver.fetch(family, descriptor, style, characters)` 只需 `{package, version}` 描述符，catalog 条目直接供给；选片/alias/piece 缓存/内存账本全复用。
- 白名单现状（T41）：disabled 集合 = 默认全启用。item 2 要求 catalog 族**默认关**（opt-in）——需要第二个集合（enabledOverride）与持久化键。

### 面板交互现状（item 3 要优化的）

实证 + 代码实测（`src/components/settings/fonts/FontsSettingsPanel.vue`）：

1. **全量渲染**：2106 行（3 bundled + 6 cdn + 2097 online）一次性全渲染，无折叠无截断——打开面板即重渲染长列表；加 catalog 83 族后更重。
2. **无状态视图**：已停用族混在全量列表，只能靠搜索找；「我关了哪些」无从查看。
3. **主开关缺席**：在线字体总开关与四家 provider 复选藏在 FontSettingsPopover（排版面板齿轮浮层），面板内看不到来源级开关；CDN 独立开关（item 1）需要可见落点。
4. **无批量操作**：catalog 83 族默认关，逐个点开不现实——需要组级「全部启用/停用」。
5. 分组计数已有（`组名 · N`），摘要「已启用 N/M」已有——保留。

## 2. 决策点（本任务开工前拍板/默认项登记）

| # | 决策点 | 状态 | 取值 |
|---|---|---|---|
| D-a | CDN 开关独立性 | ✅ | core 新增 `cnFontsEnabled`（默认 true，与 provider 开关零耦合）；枚举门禁（fonts.ts:346）与加载门禁（fonts.ts:688）改判它；app 侧 `useLocalStorage('op-cn-fonts-enabled', true)` + watch 接线 + fontListRevision 同步失效 |
| D-b | 目录来源 | ✅ 离线管线入仓 | 构建期枚举（npm search + 逐包 jsdelivr 探针）→ 生成 `packages/core/src/text/font/cn-catalog.ts`（generated owned）入仓。**不做运行时目录枚举**（离线破坏面 + 首屏延迟 + 失败面） |
| D-c | 默认关语义 | ✅ catalog opt-in | catalog 族默认停用：allowlist 加 `enabledCatalog` 集合（持久化 `op-font-enabled-catalog:v1`）；**registry 6 族维持默认开**（既有产品行为 + 已审计精选层），bundled 锁定恒开不变；provider/local 族维持默认开（item 2 语境是 CDN 目录扩量，不翻既有面） |
| D-d | 授权治理 | ✅ 分层 | registry 6 族保留 tier 审计；catalog 族面板展示包内 license 原文 + 「未审计」语义标注（tier 一律不给，治理红线不动） |
| D-e | 面板 UX 方案 | ✅ | ①状态筛选（全部/已启用/已停用 segmented）②分组默认折叠、展开按 100 行截断 +「显示更多」+ 搜索跨组过滤自动展开 ③面板顶部来源开关区（在线总开关 + CDN 独立开关 + 本地授权状态）④组级批量启用/停用（锁定族跳过）⑤分组计数 + 总摘要保留 |
| D-f | catalog 标识 | ✅ | `FontFamilyOption` 加可选 `catalog?: boolean`；面板分 5 组：bundled / cdn 精选（registry）/ cdn 目录（catalog）/ online / local |
| D-g | 版本钉扎 | ✅ | 管线记录构建时实解 version，catalog 条目带 `version`，加载走 `package@version`（可重现 + IDB piece 缓存键稳定） |
| D-h | popover 不动 | ✅ | FontSettingsPopover 保持现状（其文案走 packages/vue messages，T35 纪律新文案不进）；CDN 主开关落设置面板（fork i18n） |

## 3. 范围与修法

### S1 目录管线（tools/cn-font-catalog/，owned root）

- 新建 `build.mjs`（bun 运行）：
  1. npm search API 枚举 `@chinese-fonts/` 包（size=250 翻页至空）；
  2. 逐包（并发 8）：packument 取 latest version + license 原文 → jsdelivr `dist/index.json` 取子族目录（404/非法 → 排除并记录原因）→ 逐目录拉 `result.css`，正则提取每个 @font-face 的 `font-family`/`font-weight`（区间形态 → variable:true）；按 font-family 聚合出族（一包可出多族）；
  3. 排除已在 FONT_REGISTRY 的 6 个包（硬编码清单 + 注释指向 registry）；
  4. 产出 `packages/core/src/text/font/cn-catalog.ts`：`CN_FONT_CATALOG: CnFontCatalogEntry[]`（family/package/version/license/variable/weights:number[]）+ `cnCatalogEntry(family)` 访问器 + 头部 generated 注释（构建命令 + 日期 + 目录规模）。
- 探针失败包写入 `tools/cn-font-catalog/excluded.json`（原因记录，入仓，治理可见）。
- 实测网络面：npm search 与 jsdelivr 本环境可达（2026-08-30 实测）。

### S2 core：CDN 独立开关 + catalog 加载路由（fonts.ts P107 扩 + allowlist.ts owned 扩 + registry.ts owned 扩）

- `FontManager`：`cnFontsEnabled = true` 字段 + `setCnFontsEnabled(enabled)` + `isCnFontsEnabled()`；枚举门禁与 `loadCnFontSubset` 门禁改判 `this.cnFontsEnabled`。
- `loadCnFontSubset` 描述符解析：`cdnFontEntry(family)?.cdn ?? cnCatalogEntry(family|normalized)` → `{package, version}`——registry 优先（精选层覆盖），catalog 兜底。
- `listFamilyOptions`：cdn 精选组（registry）不变；catalog 组枚举全部 catalog 族（`{family, source:'cdn', catalog:true}`），受 allowlist 过滤（默认关 → picker 默认不出现；includeDisabled 面板全列）。
- `FontFamilyAllowlist`：`isCatalogFamily` 判定（经 cnCatalogEntry）+ `enabledCatalog` 集合；`isEnabled`：locked → true → catalog 族看 enabledCatalog（normalize 归一）→ 其余看 disabled；`setEnabled`/`replaceEnabledCatalog`/`listEnabledCatalog`；revision 覆盖两个集合的提交。
- registry.ts：`CnFontCatalogEntry` 类型定义放 cn-catalog.ts（generated 自洽），registry 不动结构。

### S3 app 接线（src/app/editor/fonts/index.ts P109 扩）

- `cnFontsEnabled = useLocalStorage('op-cn-fonts-enabled', true)` + watch → `fontManager.setCnFontsEnabled` + fontListRevision 同步。
- `enabledCatalogFamilies = useLocalStorage<string[]>('op-font-enabled-catalog:v1', [])` + watch → `fontManager.replaceEnabledCatalog`；`disabledFontFamilies` 链路不变。
- `listAllFamilies`/`listFamilies` 自动带 catalog 组（core 枚举已含）。

### S4 面板 UX 重构（FontsSettingsPanel.vue owned 重写 + fork i18n 扩）

- 顶部「来源开关」区：在线字体库总开关（同步 onlineFontsEnabled）+ **CDN 中文网字计划独立开关**（cnFontsEnabled，item 1 可见落点）+ 本地字体授权状态行（现引导行上移）。
- 状态筛选 segmented：全部 / 已启用 / 已停用（fork i18n）。
- 分组卡片化：组头 = 组名 + 「启用 x/y」计数 + 折叠箭头 + 批量「全启/全停」（bundled 组锁定跳过批量）；默认折叠 online 与 cdn 目录两组（长列表），其余展开。
- 长列表性能：展开组内渲染上限 100 行 +「显示更多（+N）」按钮；搜索时忽略折叠/截断，全量过滤并自动展开命中组。
- 行内徽标：VF「可变」、🔒 锁定（bundled）、catalog 族 license tooltip（title 属性原文 + 未审计标注）。
- picker 失效信号复用 fontListRevision（D-h 机制 T41 已通）。

### S5 单测（tests/engine/text/fonts/，owned）

- 新建 `cn-catalog.test.ts`：catalog 条目结构契约（family/package/version 必填、weights 排序、registry 6 包不在 catalog）；`cnCatalogEntry` 查找 + normalize。
- 扩展 `allowlist.test.ts`：catalog 族默认关（isEnabled false）/ setEnabled 开 → enabledCatalog 入账 + picker 枚举出现 / replaceEnabledCatalog 恢复 / 与 disabled 集合互不串扰 / revision 覆盖。
- 扩展 `cn-fonts.test.ts`：CDN 独立开关语义改版——providers 全关 + cnFontsEnabled=true 时 CDN 枚举在且加载走 cn 路由；cnFontsEnabled=false 时枚举隐藏 + loadRemoteFont 零触网（不管 providers 状态）；catalog 族经 loadCnFontSubset 加载（mock fetcher 端到端）。
- registry.test.ts 既有断言不受影响（registry 6 族不动）。

### S6 门禁 + 基线

- 全门禁：check:zones / lint（0 error）/ tsgo / vue-tsc / format:check / check:docs / check:bindings / check:tasks / check:i18n。
- `test:unit:quick` 对照 T41 定谳基线（76-77 fail / 2615-2626），失败数不增、diff 仅已登记 flake 簇。
- 文本套件（244 基线 + 新增）全绿。

### S7 Playwright 实证（不用 zcode 内置浏览器）+ 收口

- 独立开关：CDN 开关关、在线 provider 开 → picker 搜 "LXGW" 0 选项而 fontsource 族仍在；CDN 开关开回 → 恢复。截图。
- catalog 默认关：面板 cdn 目录组全列且开关全关；开启一族（如某 catalog 族）→ picker 搜索出现 → 选中建文本渲染中文。截图。
- 面板 UX：状态筛选「已停用」只列关态族；折叠/展开/显示更多/批量操作各截一张。
- 截图存仓外 `doc/`；三件套收口 + tracker/_index 翻 ✅ + 本地提交（push 挂 D-e 不变）。

## 4. 验收标准

| # | 标准 | 验证方式 |
|---|---|---|
| C1 | CDN 独立开关：providers 全关时 CDN 仍可枚举/加载；cnFontsEnabled=false 时 CDN 隐藏且零触网（与 providers 状态无关） | cn-fonts.test.ts 改版用例 + Playwright |
| C2 | catalog 全量入仓：≥80 族（npm search 可见面），探针失败包 excluded.json 记录原因 | 管线产出 + cn-catalog.test.ts |
| C3 | catalog 族默认关：picker 默认不出现；面板全列可开；开启后 picker 出现且可加载渲染 | 单测 + Playwright |
| C4 | registry 6 族 / bundled / provider / local 既有默认行为不变 | 既有套件零改版通过（除 C1 语义改版用例） |
| C5 | 面板 UX：状态筛选三态正确、折叠/截断/显示更多、批量启停（锁定跳过）、来源开关区可见可用 | Playwright 截图 |
| C6 | 全门禁绿 + test:unit:quick 零回归（对照 T41 基线） | 门禁实测 |
| C7 | 三件套 + tracker/_index + zones 登记 | check:tasks / check:zones |

## 5. 不做（out of scope）

- catalog 的运行时在线枚举/自动更新（离线管线重跑即更新，重跑是显式动作）。
- 非搜索可见面的 @chinese-fonts 包（npm search 排名遗漏，已知边界，管线注释登记）。
- FontSettingsPopover 改版（D-h）。
- catalog 族的中文化显示名整理（包内 font-family 原文展示）。
- 授权逐包审计（catalog 一律未审计标注，治理动作在任务外）。
- push/LFS 托管（D-e 推延决策不变）。

## 6. 风险与回退

| 风险 | 缓解 |
|---|---|
| 管线构建期网络不可用（npm search/jsdelivr 挂） | 已实测可达（2026-08-30）；失败则任务挂起记录，不动既有面 |
| 包结构变异批量踩坑（sypxzs 中文目录 404 先例） | 探针不合格即排除 + excluded.json 记录；resolver 本身全程不 throw（T40 D-g 边界） |
| catalog 族默认关翻转 T41 语义致既有用户困惑 | 仅新增族默认关；registry/provider/local 默认行为不变（D-c）；面板「已停用」筛选提供可见性 |
| 多族包字重/子族错配 | 运行时 pickCnFontSubfamily 既有逻辑承担（weight 就近 + Mono 规则）；错配个案入 excluded 或后续修 |
| 面板 2000+ 行渲染性能 | 默认折叠长组 + 100 行截断 + 搜索收窄（D-e），不引入虚拟滚动依赖 |

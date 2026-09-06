<!--
  写作纪律（改本文前必读）：
  - 事实性声明必须附核验命令 + 日期，否则标为【假设】
  - 计划被实测推翻时，直接改本文为新版本，完整理由记入 records/ 子文档
  - 本文只保留当前态，不保留修正历史
  - 改完后刷新本文头部的「状态」字段
  - 详细规则见 docs/rebuild/05-process.md §4
-->

# T40 计划 · 字体子集化与 CDN 接入（中文网字计划 + 内存治理）

> **状态**：✅ 已完成（C1-C8 全过） | **时间**：2026-08-30 立项，2026-08-30 收口 | **负责人**：主 agent
> **分支**：`rebuild/fonts`（基于 `a8f6eadd` T39 收口后 HEAD）
> **规格真源**：[13-font-subset-loading-proposal](../../../../docs/202608251637-migration-proposal/13-font-subset-loading-proposal.md)（S2 蓝图 §3 可行性 / §4 设计 / §4.4 分期）、owner /goal（2026-08-30，见 §1）

## 1. 背景与立项

owner /goal（2026-08-30 原文）：「我需要你继续实现完整的子集化能力和中文网字计划cdn接入等目标，而不是通过bundle更多字体的方式打补丁，要用超高的代码水平为我的项目彻底优化字体管理与接入，扫平字体在设计上的阻碍，也不能让字体成为杀手性能、oom元凶。」

T39 已收口注册表白名单 + PuHuiTi 子集内置 + 加载链修复，并在 S4 明确「CDN provider 留接缝」。本任务落地 S3 加载路线的 **Web 半**（CDN 按需子集）与**内存治理**，不再靠 bundle 更多字体打补丁。

**现状接缝盘点**（2026-08-30 代码实测，`cat`/`grep -n` 核验）：

- `packages/core/src/text/web-fonts.ts`（276 行）：unifont 四 provider（google/fontsource/bunny/fontshare），Google 已透传 `experimental.glyphs` 子集参数（`loadFromProvider`）；但三处 `IS_BROWSER && !this.remoteFetch` 门禁（`preloadFamilies` / `fetchFont` / `loadFamilies`）使**浏览器无代理时 web 字体整体禁用**——而 fonts.googleapis.com / cdn.jsdelivr.net 均自带 CORS，门禁是不必要的保守（13 册 Phase 0）。
- `packages/core/src/text/fonts.ts`（610 行，lint max-lines 告警线上）：所有字体字节经 `registerAndCache` / `registerSupplemental` 两个入口入账（`loadedFamilies` / `supplementalFamilyData`），**无上限无逐出**——OOM 治理的天然单点。`remoteCoverage`（family|style → 字符集）已实现增量覆盖请求合并。
- `packages/core/src/text/resolver/`：demand 机制（registered→local→cache→remote→fallback 候选链），`fontFaceDemand` 键 = `face:{family}:{style}`（小写）。**逐出必须联动 `fontResolver.reset`**，否则 resolver 残留 'loaded' 快照导致字体被逐出后永不重载（`FontResolver.request` 对现存条目直接返回旧 promise，2026-08-30 读码确认）。
- `packages/core/src/canvas/text/index.ts:85`：`requiredFacesReadiness` 先查 `fontManager.isStyleLoaded`——逐出后渲染循环自然回到 pending → 重走 demand → 重载，渲染侧零改动。
- `src/app/editor/fonts/cache.ts`：已有 Tauri 磁盘缓存（请求级 family/style/characters 键）；**浏览器侧无磁盘缓存实现**。
- `css-tree@3.2.1` 在 `node_modules/.bun` 实测存在（传递依赖，2026-08-30 `ls node_modules/.bun`），未在任何 package.json 声明——使用需升为 `packages/core` 显式依赖。

## 2. 决策点（本任务开工前拍板/默认项登记）

| # | 决策点 | 状态 | 取值 |
|---|---|---|---|
| D-a | CDN 家族与 npm 包名清单 | ✅ 默认实测登记 | 计划不锁死包名；实施时以 jsdelivr data API（`data.jsdelivr.com/v1/packages/npm/@chinese-fonts/*`）实测核验后登记注册表，核验记录入 self-check |
| D-b2 | variable font 语义（`isVariableFont` 门禁 / `chooseLocalFontMatch`） | ✅ 维持不动 | 延续 T39 D-b 挂起边界（O3 待 owner 拍板）；CDN 路径交付静态字重实例，不触碰可变字体语义 |
| D-c | 磁盘缓存键形 | ✅ piece 级 URL 键 | cn-font 子集片以**解析后的绝对 URL**（内容寻址）为键，不复用请求级 `DownloadedFontCache`（family/style/characters 键会让重叠字符集重复存储同一片）。请求级接口留给 unifont provider 现状 |
| D-d | 内存治理落点与逐出策略 | ✅ 单点入账 + 策略 A | 治理内嵌 `FontManager`（`registerAndCache`/`registerSupplemental`  choke point），默认 JS 侧字节预算 50MB；逐出 = 释放 JS 引用（`loadedFamilies`/`supplementalFamilyData`/`remoteCoverage`/`loadedFamilySources` + 联动 `fontResolver.reset` + `document.fonts.delete`）；CanvasKit 无法注销 typeface，WASM 残留 2-10MB 接受（13 册 §3 策略 A） |
| D-e | css-tree 依赖形态 | ✅ 升显式依赖 | `packages/core/package.json` 声明 `css-tree@3.2.1`（现仅传递依赖，直接用属幽灵依赖） |
| D-f | 浏览器磁盘缓存 | ✅ IndexedDB 200MB LRU | Blob 存储（非 ArrayBuffer，避免结构化克隆内存峰），piece URL 键，200MB LRU（13 册 §4.4 Phase 4） |
| D-g | CDN 加载失败回退 | ✅ 回退 unifont 链 | cn-font 取片失败（网络/解析/包不存在）→ 回退现有 unifont provider 链（Google glyphs 子集），防御性 try/catch 全程不 throw（13 册 §4.3 防御） |

## 3. 范围与修法

实施顺序：**内存治理先行**（CDN 子集会成倍增加入账 buffer 数，OOM 防线必须先于新源就位），再开门禁，再接 CDN。

### S1 内存治理：字节预算 + LRU 逐出 + 指标（core，OOM 防线）

- 新建 `packages/core/src/text/font/memory.ts`（owned）：`FontMemoryLedger`——按 `family|style` 键记账（primary + supplementals 字节和、lastAccess），`account(key, bytes)` / `touch(key)` / `evictUntilUnder(budget): string[]`（返回被逐键）；超预算时逐出最久未用，**不逐刚入账的键本身**；单条目超预算则保留并置 `overBudget` 标志。
- patch `fonts.ts`（P113）：`registerAndCache`/`registerSupplemental`/`loadedData`/`isStyleLoaded` 接 ledger（入账/touch）；新增 `fontMemoryBudget`（默认 50MB，`setFontMemoryBudget` 可调）、`evictFont(family, style)`、`fontMemoryStats(): { loadedBytes, entries, evictions, overBudgetKeys }`；逐出时同步清 `remoteCoverage`/`loadedFamilySources`，IS_BROWSER 下 `document.fonts.delete` 已跟踪的 FontFace（`registerFontInBrowser` 改为按键跟踪实例）。
- 逐出联动（防「逐出后永不重载」）：`FontManager` 增 `onFontEvicted` 回调挂钩；`resolver/index.ts`（已 import fontManager，无环）注册回调执行 `fontResolver.reset(faceDemandKey)`——demand 键构造函数从 `fontFaceDemand` 提取导出，保证逐出/重建两侧键形一致。

### S2 解除浏览器门禁（13 册 Phase 0）

- patch `web-fonts.ts`（P114）：删 `preloadFamilies`/`fetchFont`/`loadFamilies` 三处 `IS_BROWSER && !this.remoteFetch` 提前返回。`withFetchProxy`/`fetchRemote` 逻辑不变（有代理走代理，无代理裸 fetch——浏览器 CORS 直连）。
- **验收锚**：浏览器无代理环境下 `fontManager` web provider 家族列表非空、Google glyphs 子集请求真实发出（实证 DevTools/网络层）。

### S3 中文网字计划 CDN 子集 provider（core，13 册 Phase 3）

- 新建 `packages/core/src/text/web-font/cn-fonts.ts`（owned）：`CnFontSubsetResolver`：
  1. 取 `https://cdn.jsdelivr.net/npm/{package}@latest/{cssPath=result.css}`（fetch 经可注入 `WebFontFetch`，与现有代理机制一致）；
  2. css-tree 解析 `@font-face` 块 → `{ weight, style, unicodeRange[], url }`（url 相对路径以 `response.url` 为 base 解析成绝对，兼作 piece 缓存键）；
  3. unicode-range 区间解析（`U+4E00-9FFF`/`U+FF0C` 单值/通配 `U+4??` 形态）→ 按需字符选片（每个 demand 字符找覆盖片，去重）；
  4. 并发拉片（每片 2-100KB woff2），逐片查/写注入的 piece 缓存（`CnFontPieceCache { read(url), write(url, data) }` 接口，IndexedDB 实现见 S5）；
  5. 返回 `{ buffers, coveredCharacters }`——covered = 实际取到并解析成功的片的 unicode-range 并集 ∩ 请求字符，供 `remoteCoverage` 精确记账。
- 防御（D-g）：全程 try/catch 不 throw；CSS 无匹配片 / 片数异常（>200 片告警，防包结构变异拉爆内存——对齐 13 册「<50 subsets warn」意图，阈值随实测定）→ 返回 null 走回退。
- 同族同字重的 CSS 会话级缓存（`Map<package|weight, Promise<pieces[]>>`），不重复抓 result.css。

### S4 注册表扩 CDN 家族 + 路由 + picker 可见

- patch `font/registry.ts`（P115）：条目增可选 `cdn: { package: string; cssPath?: string }` 描述符 + `source` 联合型加 `'cdn'`；登记 D-a 实测核验后的首发家族（目标 3-5 套覆盖 楷/宋/黑/圆 风格）；导出 `cdnFontEntry(family)` 访问器。
- patch `font/sources.ts`（P116）：`FontFamilySource` 加 `'cdn'`。
- patch `fonts.ts`（并入 P113）：`loadRemoteFont` 路由——注册表命中 `cdn` 条目 → `CnFontSubsetResolver`，失败回退 unifont 链（D-g）；非注册表家族行为不变。`listFamilyOptions` 把 CDN 家族以 `source:'cdn'` 枚举进 picker。
- picker 侧若按 source 分组/标签名需适配，实测后按需 patch（实施时登记）。

### S5 IndexedDB piece 磁盘缓存（浏览器侧，13 册 Phase 4）

- 新建 `src/app/editor/fonts/idb-cache.ts`（owned）：`createIndexedDbCnFontCache(): CnFontPieceCache`——IndexedDB 存 Blob，键 = piece 绝对 URL，200MB LRU（逐出最久未读条目）；`idb` 不可用时降级内存 Map（不阻塞加载）。
- patch `src/app/editor/fonts/index.ts`（P117）：启动时 `fontManager`/`CnFontSubsetResolver` 注入缓存实例。
- **不做** Tauri 侧 piece 缓存改造（Tauri 已有请求级磁盘缓存兜底，piece 级收益边际，推延）。

### S6 Google glyphs 子集核验（13 册 Phase 1 收口）

- S2 门禁解除后，现有 unifont Google 路径（`experimental.glyphs`）即产出 <10KB 级定制子集；本项只做**实证核验**（网络面板量字节数）与按需字符集裁剪（cjkOnly 提取，若 URL 超长再启用），不改主链。

## 4. 验收标准

| # | 标准 | 验证方式 |
|---|---|---|
| C1 | 内存治理单测全过：入账/touch/LRU 逐出序/单条目超预算保留/指标准确/逐出后 `fontResolver` 键被 reset | `tests/engine/text/fonts/` 新增用例 |
| C2 | 逐出后渲染自愈：逐出已渲染家族 → 下一帧 readiness 回 pending → 重载成功（render 层单测或集成用例） | 单测 |
| C3 | cn-font resolver 单测全过：fixture result.css 解析 / unicode-range 含通配选片 / 增量字符只拉新片 / piece 缓存命中零网络 / 解析失败与超片数告警回退 | 单测（fetch 全 mock） |
| C4 | 注册表 CDN 家族 picker 可见（`source:'cdn'`），`loadRemoteFont` 路由正确（cdn 命中走 cn-font、失败回退 unifont、非注册家族不变） | 单测 |
| C5 | IndexedDB 缓存读写 + LRU（fake-indexeddb 或抽象层单测）+ idb 缺失降级 | 单测 |
| C6 | 浏览器实证（Playwright）：CDN 家族选择器可见 → 选中渲染中文截图入 `doc/`；`fontMemoryStats()` 展示预算内运行；反复切换多家族触发逐出后无 OOM、文字可再渲染 | 实证截图 |
| C7 | 全门禁绿：check:zones / lint（0 error）/ tsgo / format:check / check:docs / check:bindings / check:tasks / font 测试 | 门禁 |
| C8 | 零回归：test:unit:quick 对比 T39 收口基线（100 fail/2560）失败数不增、diff 仅已知 flake | 基线对照 |

## 5. 不做（out of scope）

- variable font 语义、`chooseLocalFontMatch` 匹配放宽（D-b 挂起边界，待 owner 拍板 O3）。
- 字体治理 UI / 准入审批流（15 册 D.5：治理层是流程不是代码）。
- unifont 替换或重写现有四 provider；Tauri 侧 piece 级缓存。
- LFS 化与 push 托管（D-e 推延决策不变）；不再 bundle 新字体文件入仓（本任务正是为了终结该模式）。
- 营销工具链字体 profile 校验消费（S2 规格侧后续任务）。

## 6. 风险与回退

| 风险 | 缓解 |
|---|---|
| CDN 包结构变异（result.css 改名/分片数爆炸） | 片数阈值告警 + D-g 回退 unifont；家族登记以实测为准（D-a） |
| jsdelivr 国内可达性 | fetch 注入接缝与现有代理机制一致，桌面端可走 remoteFetch 代理；失败回退不阻塞编辑 |
| 逐出误伤在屏文字 | 渲染侧有 textPicture 缓存兜底（T39 P108），逐出仅影响下次文本变更时的重载；bundled/IDB 命中使重载廉价 |
| fonts.ts 行数继续增长（现 610/600 告警） | 新逻辑落 `font/memory.ts`、`web-font/cn-fonts.ts`，fonts.ts 只接线；不借势大重构 |
| 逐出与在途 demand 竞态 | reset 先行、删引用随后；在途 load 完成后重新入账视为复活，语义可接受 |

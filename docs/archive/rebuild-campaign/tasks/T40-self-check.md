<!--
  写作纪律（改本文前必读）：
  - 事实性声明必须附核验命令 + 日期，否则标为【假设】
  - 本文只保留当前态，不保留修正历史
  - 详细规则见 docs/rebuild/05-process.md §4
-->

# T40 自检 · 字体根治（运行时子集化 + 中文网字计划 CDN + 内存治理）

> **状态**：已完成 | **时间**：2026-08-30 | **负责人**：主 agent
> **基线**：`a8f6eadd`（T39 收口后 HEAD）+ T40 改动（分支 `rebuild/fonts`，本地提交，push 挂 D-e）

## 1. 改动清单（实测 `git status --short`，2026-08-30）

| 文件 | 改动 |
|---|---|
| packages/core/src/text/font/memory.ts | **新建（owned）**：`FontMemoryLedger`——重述式记账（非增量：registerAndCache 降级旧 primary 时总量不变，增量必漂移）+ 单调时钟 lastAccess + `lruVictims`（跳过排除键与单条目超预算键） |
| packages/core/src/text/fonts.ts | **P113**：50MB JS 侧预算 + LRU 逐出（释放 JS 引用 + `document.fonts.delete` + 先联动 `fontResolver.reset` 再删引用）+ `fontMemoryStats`/`evictFont`/`setFontMemoryBudget` + `loadCnFontSubset` 路由；**P113 扩展（同名塌缩修复）**：CDN 互斥分片每片各持 alias（`LXGW WenKai\x1F{i}`）注册 CanvasKit，`renderFamilyAliases` 供排版回退链；`attachProvider` 对 CDN 键回放 alias 而非同名补充片；`registerFontInBrowser` 带 unicode-range 描述符；`trackSupplementalData` 记账/注册分离 |
| packages/core/src/text/web-font/cn-fonts.ts | **新建（owned）**：中文网字计划 resolver——index.json/result.css 会话缓存、css-tree 解析（parseValue:false 取 Raw）、unicode-range 三形态（单值/区间/通配）、按需选片 URL 去重、字重目录推断（长词优先 + Mono 排除）、200 片异常阈值、失败永不抛出（null → 调用方回退 unifont） |
| packages/core/src/text/web-font/piece-cache.ts | **新建（owned）**：`LruCnFontPieceCache` 200MB LRU（piece URL 内容寻址，D-c）+ store 失败降级为 miss + 刚写入片豁免逐出 |
| packages/core/src/text/font/registry.ts | owned 扩展：5 个 CDN 家族（LXGW WenKai / Xiaolai SC / Yozai / MaokenAssortedSans / 寒蝉全圆体，tier+license 登记；syst=思源宋 CN 可变字体排除——D-b 边界，sypxzs 中文目录 jsdelivr 404 排除）+ `cdnFontEntry` 访问器；bundledAllowlist 改 `source==='bundled'` 过滤 |
| packages/core/src/text/font/sources.ts | **P115**：`FontFamilySource` += `'cdn'` |
| packages/core/src/text/resolver/index.ts | **P116**：`fontFaceDemandKey` 导出 + `fontManager.onFontEvicted → fontResolver.reset` 联动（逐出后 demand 链可重载，否则残留 'loaded' 快照永不重载） |
| packages/core/src/text/web-fonts.ts | **P114**：删 3 处 `IS_BROWSER && !remoteFetch` 门禁（unifont 在浏览器/Node 行为一致）+ 尾部 re-export cn-fonts/piece-cache |
| packages/core/src/canvas/text/index.ts | **P119**：`resolveParagraphFontFamilies` 注入 `renderFamilyAliases`（同名多片塌缩修复的排版侧），alias 列表进 fontFamilyCache 键（增量加载 alias 增长不致缓存陈旧） |
| packages/core/src/constants.ts | **P120**：`hasWindowGlobal()` 调用期 window 探测（IS_BROWSER import 期冻结在共享进程失真——全量单测定谳的 local 候选 ReferenceError 根因） |
| src/app/editor/fonts/idb-cache.ts | **新建（owned）**：`IdbCnFontPieceStore`（db `op-cn-font-piece-cache`，Blob 存储 keyPath 'url'，全操作失败降级 null）+ `createCnFontPieceCache`（IDB 缺失回退内存） |
| src/app/editor/fonts/index.ts | **P117**：无条件 `setCnFontPieceCache(createCnFontPieceCache())` |
| packages/core/package.json + bun.lock | **P118**：css-tree@3.2.1 显式依赖 + @types/css-tree devDep |
| tests/engine/text/fonts/memory.test.ts | 新建 11 用例：账本/LRU/touch/逐出联动/单条目超预算保留/50MB 默认/resolver reset 集成 |
| tests/engine/text/fonts/cn-fonts.test.ts | 新建 18 用例：纯函数（解析/选片/目录字重/formatUnicodeRanges）+ resolver（按需/增量/缓存/null 安全/异常阈值）+ FontManager 路由（cdn 源+覆盖记账/失败回退/枚举可见性/离线隐藏不触网）+ **alias 渲染链 3 例**（逐片唯一 alias + 同名仅一次 / 增量去重 + 字节记账 / attachProvider 回放 alias + 逐出清理） |
| tests/engine/text/fonts/piece-cache.test.ts | 新建 6 用例：roundtrip/LRU touch 续期/刚写豁免/200MB 默认/store 失败降级 |
| tests/engine/text/fonts/registry.test.ts | owned 扩展至 9 用例：CDN 5 家族精确清单/descriptor 形态/cdnFontEntry/CDN 不入 bundled 白名单 |
| tools/zone-registry/zones.json | patch P113-P120 + ownedFiles（memory.ts / cn-fonts.ts / piece-cache.ts / idb-cache.ts / 3 测试文件） |
| docs/rebuild/tasks/T40-plan.md | 任务卡（D-a 包名 jsdelivr 实测 / D-b2 边界 / D-c piece URL 键 / D-d 单收口 + 策略 A / D-e css-tree / D-f IDB 200MB / D-g CDN 失败回退） |

## 2. 门禁实测表（2026-08-30 本机）

| 门禁 | 命令 | 结果 |
|---|---|---|
| 类型检查 | `bun run tsgo` | ✅ 零输出 |
| lint | `bun run lint` | ✅ 0 errors（4 warnings 全为 max-lines 类既有/压线，不阻断） |
| format | `bun run format:check` | ✅ All matched files use the correct format（oxfmt） |
| zones | `bun run check:zones` | ✅ clean: 65 modified all registered, 334 added owned, base 88c10770 |
| docs | `bun run check:docs` | ✅ 40/40 |
| bindings | `bun run check:bindings` | ✅ 21 文件变更全绿 |
| tasks | `bun run check:tasks` | ✅（P113-P120 摘要识别） |
| 文本套件单测 | `bun test tests/engine/text/` | ✅ 218 pass / 0 fail（含 T40 新增：memory 11 + cn-fonts 18 + piece-cache 6 + registry 扩至 9） |
| 全量单测基线对照 | `bun run test:unit:quick` | 见 §4（C8） |

## 3. 过程中发现并修复

- **CDN 多片同名注册塌缩（浏览器实证挖出的 P0）**：C6 首跑画布选中 LXGW WenKai 后文字全空白，fontManager 侧一切「正常」（loaded/cdn/7 片入账）。探针脚本（canvaskit-wasm 0.42.0 直测，2026-08-30）定谳：①CanvasKit 能解 woff2（Inter woff2 5/5 glyph）；②7 个互斥 unicode-range 分片注册同一 family 名 → TypefaceFontProvider style 匹配只留单 typeface → 排版 17/18 notdef；③每片独立 alias + fontFamilies 回退链 → 18/18 glyph、0 notdef。修复即 P113 扩展 + P119。
- **编辑覆盖层异步提交串扰（实证操作面）**：textarea 注入/全局 fill 会被编辑器延迟提交进节点文本（一次 'LXGW' 搜索词误入节点）。非产品 bug——实证改用 `graph.updateNode` 收口文本 + 真实 picker 点击应用家族。
- **unifont 初始化重试挂起 picker（S2 配套）**：google 元数据不可达网络下 1s×3 退避会阻塞家族列表 → `listProviderFamiliesWithTimeout`（6s race，后台继续写缓存）+ 单测（50ms 超时模拟）。
- **eslint 闭包窄化陷阱**：`parseCnFontResultCSS` 标量 `let` 闭包赋值被 no-unnecessary-condition 误判恒 null → 对象属性收集范式。
- **lint 自定义规则**：no-mixed-case-acronym-identifiers（URL/CSS 大写标识符统一 pieceURL/cssURL/parseCnFontResultCSS）、no-silent-catch（逐出 console.warn）、prefer-number-properties（Number.parseInt）。
- **全量跑才暴露的两个跨文件污染（T39 基线对照轮挖出）**：①`open-file-dedup.test.ts` mock `globalThis.window` 致共享进程内 `IS_BROWSER` 翻真，`registerFontInBrowser` 在无 FontFace 实现的 bun 环境炸 ReferenceError（被 loadRemoteFont catch 吞成 null，11 个字体用例连锁失败）——修为能力探测 `typeof FontFace === 'undefined'` 即返回；②应用侧 P117 接线经 import 链把 InMemory piece 缓存装进单例 resolver，「failWoff2 → null」断言被磁盘缓存命中击穿——测试卫生修复：路由/alias 各用例显式 `setCnFontPieceCache(null)`（缓存本身行为正确：D-c 内容寻址跨实例共享是设计）。
- **import 期环境探测的固有脆弱性（第三轮诊断定谳）**：`IS_BROWSER = typeof window !== 'undefined'` 在模块 import 时冻结——window mock 建立时 import 使常量恒真，mock 拆除后 `loadLocalFont` 的 `window.queryLocalFonts` 解引用炸 ReferenceError（resolver 'local' 候选抛出 → 终态 'failed' 而非 'exhausted'）。修为调用期能力探测：`requestLocalFontAccess`/`findLocalFont` 改 `typeof window === 'undefined'` 判空。这同时是产品侧正确性修复：任何 window 时有时无的嵌入宿主（测试/mock/SSR -ish）都受益。

## 4. 全量单测基线对照（C8）

- 四轮全量实测（2026-08-30，各 ~10min）：第一轮 110 fail/2605 挖出跨文件污染（§3 第 4/5 条）并修复；**定谳轮 78 fail / 2600 tests / 428 files**，对照 T39 收口基线 100 fail / 2560 / 424 files。
- 定谳轮失败集合 vs 基线 diff：新增仅 2 例——`MCP server concurrent startServer` 与 `fig export subgraph instance overrides`，均为 T39-verify §V5 已登记的 flake（隔离复跑全绿/时红时绿，与字体改动无代码交集）；基线侧 24 例本轮转绿（MCP/eval 端口簇 + headless CanvasKit 字体视觉簇的环境性双向漂移）。
- **T40 全部新增/触改测试文件在定谳轮零失败**（`grep -i fonts /tmp/t40-fails4.txt` 为空）。
- 口径说明：定谳轮代码与最终提交相差一处纯间接化重构（`typeof window === 'undefined'` → `hasWindowGlobal()`，同表达式封装，行为等价）；重构后 lint/tsgo/format/check:zones/文本套件 218 全绿已复验。

## 5. 遗留与边界

- **WASM 侧残留（策略 A，已接受）**：CanvasKit typeface 不可注销，逐出只释放 JS 引用 + DOM FontFace；alias typeface 同理残留（单片 2-100KB，逐出后 alias 名不复用）。13 册 §3 策略 A 登记。
- **D-b 可变字体边界**：syst（Source Han Serif CN VF）不入 CDN 注册表，`isVariableFont`/`chooseLocalFontMatch` 语义不动，待 owner 拍板。
- **D-e push 托管**：GitHub 直连不通 + fork LFS 预算超，本地提交。

<!--
  写作纪律（改本文前必读）：
  - 事实性声明必须附核验命令 + 日期，否则标为【假设】
  - 本文只保留当前态，不保留修正历史
  - 详细规则见 docs/rebuild/05-process.md §4
-->

# T40 核验报告 · 字体根治（运行时子集化 + 中文网字计划 CDN + 内存治理）

> **状态**：已完成 | **时间**：2026-08-30 | **核验人**：主 agent（探针实证 + 浏览器实证 + 基线对照取证）
> **基线**：`a8f6eadd` + T40 改动（dev server localhost:1420 实跑，vite 热更含全部 P113-P120）

## V1 内存治理（C1/C2）✅

- 单测：`bun test tests/engine/text/fonts/memory.test.ts` 11/11（2026-08-30）——账本重述（primary 替换 100→250 不漂移）、LRU 逐出序、touch 保护、单条目超预算保留、手动 evictFont、50MB 默认。
- 逐出-渲染自愈集成用例（同文件）：单例 fontManager 逐出已加载家族 → `fontResolver` 对应键被 reset 回 idle → 再 demand 走完整加载链到终态（在线 provider 全关 → exhausted），证明「逐出后永不重载」缺陷链已被 onFontEvicted 联动斩断（P116）。
- 浏览器实证：`fontMemoryStats()` = budget 50MB / loaded 6,583,524B / entries 22 / evictions 0 / overBudgetKeys []（2026-08-30，页面 evaluate 实测）——CDN 加载在预算内运行。

## V2 cn-font resolver（C3）✅

- 单测：`bun test tests/engine/text/fonts/cn-fonts.test.ts` 18/18——fixture result.css 解析（5 个 @font-face 含 700/italic/通配 `U+4??`）、按需选片、增量只拉新片（第二次零 result.css 请求）、piece 缓存命中零 woff2 网络、包不存在/无覆盖/全片 404 返回 null 不抛、201 片异常阈值拒载。
- CDN 数据形态 jsdelivr 实测（2026-08-30）：`@chinese-fonts/lxgwwenkai@latest/dist/index.json` 子族目录数组、`dist/{Dir}/result.css` cn-font-split @font-face 块、相对 `./{hash}.woff2` 分片 2-100KB。

## V3 注册表 + 路由 + picker（C4）✅

- 单测：registry.test.ts 9/9 + cn-fonts.test.ts 路由组——CDN 5 家族枚举带 `source:'cdn'`、LXGW WenKai 经 `loadRemoteFont` 走 cn-font（无任何 unifont provider 请求）、`loadedFontSource` = 'cdn'、覆盖记账精确（'你' 已覆盖 / '好' 未覆盖）、cdn 失败回退 unifont 链（两链请求记录双证）、关停全部在线 provider 后 CDN 家族从枚举隐藏且 loadRemoteFont 零触网。
- 浏览器实证：picker 搜索 "LXGW" 列出 `LXGW WenKai [cdn]` 徽标项，点击应用后节点 fontFamily = LXGW WenKai（2026-08-30）。

## V4 IndexedDB piece 缓存（C5）✅

- 单测：piece-cache.test.ts 6/6——roundtrip、LRU 逐出 + touch 续期、刚写入片豁免、200MB 默认预算、store 失败降级为 miss（不炸加载链）。
- 浏览器实证：IndexedDB `op-cn-font-piece-cache` 实存 8 条 woff2 记录（页面 evaluate 读库实测，2026-08-30）——浏览器侧写入路径真实生效。

## V5 浏览器实证 CDN 渲染中文（C6）✅

- 链路：新 TEXT 节点注入「中文网字计划 CDN 子集 2026」→ picker 选 `LXGW WenKai cdn` → demand 链拉 index.json → result.css → 7 片 woff2 → alias 注册 → 画布渲染。
- 运行时状态实测（页面 evaluate，2026-08-30）：`isStyleLoaded` = true、source = 'cdn'、`renderFamilyAliases` = 7 个唯一别名（`LXGW WenKai\x1F0`…`\x1F6`）、`document.fonts` 7 个 FontFace 全 loaded 且各带正确 unicode-range 描述符。
- 证据截图（`doc/` 仓外证据区）：
  - `t40-c6-cdn-render.png`：全窗口——画布渲染「中文网字计划 CDN 子集 2026」，排版面板家族 = LXGW WenKai，节点 488×20；
  - `t40-c6-cdn-render-zoom.png`：特写——楷体字形清晰（对比修复前同名塌缩期全空白）。
- **修复前反证（探针定谳）**：canvaskit-wasm 0.42.0 直测——7 片同名注册排版 18 字符 17 notdef；alias 方案 18/18 glyph 0 notdef。根因：TypefaceFontProvider 同名 style 匹配只留单 typeface，互斥 unicode-range 分片必须各持别名经 fontFamilies 回退链合流（P113 扩展 + P119）。

## V6 门禁（C7）✅

见 [T40-self-check.md §2](T40-self-check.md) 实测表：tsgo / lint（0 error）/ format:check / check:zones（65 modified 全登记，P113-P120）/ check:docs 40/40 / check:bindings / check:tasks / 文本套件 218/218 全绿。

## V7 全量单测基线对照（C8）✅

- 定谳轮（2026-08-30，浏览器 + dev server 关闭后实跑）：**78 fail / 2600 tests / 428 files**，对照 T39 基线 100 fail / 2560 / 424 files。
- 失败集合 diff：新增仅 2 例且均为 T39 已登记 flake（`MCP server concurrent startServer` 端口时序 / `fig export subgraph instance overrides` 大跑 flake）；基线 24 例本轮转绿（环境敏感簇双向漂移）。
- T40 新增/触改测试文件定谳轮零失败（失败清单无 fonts 字样，实测 `grep -i fonts` 为空）。
- 过程记录：前三轮全量挖出并修复两个跨文件污染（import 期 IS_BROWSER 冻结 → P120 `hasWindowGlobal()` 调用期探测 + FontFace 能力探测；单例 resolver 磁盘缓存的测试卫生隔离）——详见 [T40-self-check.md §3](T40-self-check.md)。

## 结论

C1-C8 全过。**根的能力链已通**：中文网字计划 CDN 家族在 picker 可见 → 选中即按字符集拉子集分片（实证单请求 7 片、单片 2-100KB，对照 bundled PuHuiTi 每字重 ~2.2MB）→ alias 回退链渲染中文（修复了同名塌缩空画布 P0）→ 片级 IndexedDB 缓存跨会话复用 → 50MB JS 预算 + LRU 逐出 + resolver 联动自愈。可以收口。D-b（可变字体）/D-e（push 托管）为已登记 deferred 项。

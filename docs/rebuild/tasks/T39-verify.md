<!--
  写作纪律（改本文前必读）：
  - 事实性声明必须附核验命令 + 日期，否则标为【假设】
  - 本文只保留当前态，不保留修正历史
  - 详细规则见 docs/rebuild/05-process.md §4
-->

# T39 核验报告 · 字体能力建设

> **状态**：已完成 | **时间**：2026-08-30 | **核验人**：主 agent（浏览器实证 + 基线对照取证）
> **基线**：`08e43132` + T39 改动（dev server localhost:1420 实跑，vite 热更含全部 P107-P112）

## V1 注册表 + 白名单三拦截点（C1）✅

- 单测：`bun test tests/engine/text/fonts/registry.test.ts` 6/6（2026-08-30）——注册表三家族结构、PuHuiTi 9 字重枚举、`isBundledFamilyAllowed` 放行/拦截、picker 枚举源。
- 加载拦截实测：非注册表家族走 bundled 路径时 `console.warn('Bundled font "X" is not in the font registry allowlist')` 且返回 null（fonts.ts:252-254）。
- 浏览器实证（2026-08-30，Playwright MCP）：字体选择器实列 `Alibaba PuHuiTi:bundled / Inter:bundled / Noto Naskh Arabic:bundled` 三项——`page.evaluate` 直调 `listFamilies()` 返回 count=3 与之一致。系统字体不受白名单限（Tauri 枚举路径未动）。

## V2 PuHuiTi 渲染中文（C2）✅

- 资产入仓实测：`packages/core/assets/AlibabaPuHuiTi-*.ttf` ×9 + `public/AlibabaPuHuiTi-*.ttf` ×9，每个 ~2.2MB（`curl http://localhost:1420/AlibabaPuHuiTi-Regular.ttf` → 200 / 2,250,960B，2026-08-30）。**形态为普通 git 对象（D-e），非 plan §4 原文的 LFS——翻案依据 D-e 决策行**。
- 浏览器实证链路：新文档 → T 工具建 TEXT → 注入「普惠设计字体测试 2026」→ 字体选择器选 Alibaba PuHuiTi → 画布渲染中文。
- 证据截图（`doc/` 目录，仓外证据区）：
  - `t39-c2-inter-5s.png`：Inter + CJK 停留 pending 空白（修复前现状反证）；
  - `t39-c2-picker.png`：选择器列出 PuHuiTi（P110/P111 修复后）；
  - `t39-c2-puhuiti-zoom.png`：PuHuiTi Regular 28px 渲染「普惠设计字体测试 2026」，节点宽 293；
  - `t39-c2-puhuiti-bold.png`：切 Bold 后粗体渲染（宽 219），切换全程文字无消失。

## V3 加载链修复（C3）✅

- `systemFontDataCache`：loadSystemFont 命中缓存跳过 IPC（含 null 负缓存），P109 代码层落实；Tauri 专属路径，浏览器实证不适用，以代码审查 + P109 登记为准【局部假设：缓存命中语义由 Map.get 短路保证】。
- 时序竞争（14 册现象 B）：新增 2 单测钉住（pending+缓存命中 → drawPicture 旧图；pending+缓存失效 → 跳过），`bun test tests/engine/render/canvas/text.test.ts` 14 pass 含此二例（2026-08-30）。
- 浏览器实证：PuHuiTi Regular→Bold 切换 ~400ms 后截图文字即为粗体、全程无空白帧（bundled 本地加载毫秒级 + P108 缓存托底双保险）。

## V4 门禁（C4/C5）✅

见 [T39-self-check.md §2](T39-self-check.md) 实测表：tsgo / lint（0 error）/ format:check / check:zones（60 modified 全登记）/ 字体单测 83/83 / smoke:pi 80/80 全绿。

## V5 全量单测基线对照（不阻断收口）

- 两轮全量实测（2026-08-30，各 ~10min）：**基线**（`git stash -u` 全量回退 T39）100 fail / 2560 tests / 424 files；**带 T39** 100 fail / 2567 tests / 425 files（+1 文件 +7 用例为 T39 新增，全绿）。
- 失败集合 diff 仅 5 个用例双向漂移：
  - 基线独有 3 个（ensureGraphFonts fallback packs / get_font_status 诊断 / text-on-path 30° 旋转）在 T39 轮通过；
  - T39 轮独有 2 个——`MCP server concurrent startServer`（端口/discovery 时序敏感：隔离复跑时绿时红，与字体改动无代码交集）与 `fig export subgraph instance overrides`（隔离复跑 4/4 全绿，大跑 flake）。
- 失败主体为环境敏感面：mcp 桥接/端口绑定（dev server 占 7600 并发冲突）、headless CanvasKit 字体视觉组（Inter 字重宽度/CJK notdef/阿语 fallback——text.test.ts 同 6 例在基线原样复现）。
- 结论：**T39 零回归**；大跑 flake 群登记为环境/上游债，不在本任务修复面。

## 结论

C1-C6 全过（C6 三件套 + tracker/_index 登记随本批文档落地），浏览器实证 PuHuiTi 中文渲染达成，**可以收口**。D-b 待 owner 拍板、D-e 的 LFS/push 托管为已登记翻案点。

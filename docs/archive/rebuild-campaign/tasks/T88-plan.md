# T88 · 节点名 CJK 豆腐字修复

> **状态**：已核验 | **时间**：2026-09-03 | **核验人**：主 agent
> **任务来源**：owner 实测截图发现画布 SECTION/COMPONENT/FRAME 节点名中文渲染为豆腐（2026-09-03）
> **前置**：T84（bundled PuHuiTi 前插 CJK 回退链，section 路径 0 覆盖）；T85（read_reference + editable-design 移植）
> **commit 基线**：`eacb587ee`（T87 pi 原生 skill 支持）+ `d2c88c007`（T87-plan）

## 1. 背景

owner 在 dev server 中看到画布 SECTION/COMPONENT 节点名（"图层 1" / "矩形"）渲染为豆腐方框（截图 `sess_81d89076-76eb-4378-ab60-0e58584b65c7/image-3f59d06d0d36c823aab1e4abfe4d68ee.png`）。T84 已将 PuHuiTi 注册到 TypefaceFontProvider，但节点名直画路径绕过该层。

## 2. 根因（精确证据）

| 路径 | 行为 |
|------|------|
| `packages/core/src/canvas/renderer/fonts.ts:85` | `await fontManager.loadFont(DEFAULT_FONT_FAMILY, 'Regular')` 仅加载 Inter 一个 typeface |
| `packages/core/src/canvas/renderer/fonts.ts:95-99` | textFont / labelFont / sizeFont / sectionTitleFont / componentLabelFont 五个 Font 实例共享同一 Inter typeface |
| `packages/core/src/canvas/labels/draw.ts:52, 127` | `font.getGlyphIDs(node.name)` 在 Inter typeface 查 CJK → 全 notdef → 渲染豆腐 |
| `packages/core/src/canvas/text/index.ts:168` | `nodeFontReadiness` 头句 `if (node.type !== 'TEXT') return 'ready'` → section/component label 字体需求根本不进 fontResolver；prependBundledCJK（T84）永远不被触发 |
| T84 钉扎测试 5 例（`tests/engine/text/fonts/cjk-fallback.test.ts`） | 仅覆盖 TypefaceFontProvider 注册层（CanvasKit 排版路径），零覆盖 section/component label 直画路径 |

## 3. 方案（A'：多 typeface + 按字符 script 分段画）

`loadFonts` 内并行加载 Inter / Alibaba PuHuiTi / Noto Naskh Arabic 三个 typeface，构造三套 Font 实例；新增 helper `pickFontForText(text, kind)` 与 `drawTextByScript(...)` 按 `fontFallbackScriptForCharacter` 分段画，8 个直画使用点统一接入。

## 4. 改动文件

### 代码（10 文件）

1. `packages/core/src/canvas/renderer.ts` — 字段扩展 + helper 方法声明
2. `packages/core/src/canvas/renderer/fonts.ts` — 多 typeface 装配 + pickFontForText + drawTextByScript
3. `packages/core/src/canvas/renderer/lifecycle.ts` — cleanup 扩展
4. `packages/core/src/canvas/labels/draw.ts` — sectionTitle + componentLabel 接入
5. `packages/core/src/canvas/labels/selection.ts` — frame title + size pill 接入
6. `packages/core/src/canvas/labels/text.ts` — ellipsize 扩展
7. `packages/core/src/canvas/labels/hit-test.ts` — section/component/frame hit 接入
8. `packages/core/src/canvas/scene.ts` — renderText fallback 路径接入
9. `packages/core/src/canvas/rulers.ts` / `overlays/measurement.ts` / `overlays/auto-layout-hover.ts` / `pen-overlay.ts` — helper 接入（多为纯数字字符，零行为变化）

### 测试（4 新 + 1 改）

10. `tests/engine/text/fonts/multi-script-label-fonts.test.ts`（新建，10 例，mock CanvasKit）
11. `tests/e2e/fonts/cjk-labels-fallback.spec.ts`（新建，4 例，Playwright 真渲染）
12. `tests/e2e/fonts/cjk-fallback.spec.ts`（追加 1 例 section/component label 覆盖）
13. `tests/engine/text/fonts/cjk-fallback.test.ts`（追加 1 例「loadFonts 后三 typeface 非 null」）
14. `spikes/s-pi/backend-smoke/t88/section-title-cjk-smoke.mjs`（新建，端到端冒烟）

### 任务三件套 + 索引

15. `docs/rebuild/tasks/T88-self-check.md`（新建）
16. `docs/rebuild/tasks/T88-verify.md`（新建）
17. `docs/rebuild/tasks/_index.md`（追加 T88 行）
18. `docs/rebuild/tracker.md`（追加 T88 行）

## 5. 验收标准

| 维度 | 钉扎 |
|------|------|
| 引擎单测 | `bun test tests/engine/text/fonts/multi-script-label-fonts.test.ts` 10/10 |
| 引擎单测（钉扎补） | `tests/engine/text/fonts/cjk-fallback.test.ts` 5 + 1 全过 |
| e2e 真渲染 | `bunx playwright test tests/e2e/fonts/cjk-labels-fallback.spec.ts` 4/4 |
| e2e 钉扎补 | `tests/e2e/fonts/cjk-fallback.spec.ts` 2 + 1 全过 |
| 冒烟 | `bun run smoke:pi` 链尾 t88 5/5（按 T85 → T87 节奏加 t88） |
| 浏览器实测 | dev server 中 SECTION.name='图层' / COMPONENT.name='组件名' / FRAME.name='中文 Frame' 渲染非豆腐 |
| 七门禁 | lint/tsgo/format/vue/zones/i18n/docs 本任务文件 0 错 |
| 受影响回归 | T85 基线 281 测试零增长失败数 |

## 6. 风险与边界

1. CJK typeface 加载失败 → helper 降级到 latin（fail-safe，已有 tofu 体验比崩溃好）
2. Arabic typeface CanvasKit drawText 不做 RTL shaping → 阿拉伯字从左到右画错（已知 gap，本次只解决 tofu 不解决 RTL）
3. 按字符分段后 ellipsize 截断点 → 可能截在 cjk 段中，UI 可接受
4. `r.profiler.setTypeface(typeface)` 当前接 Inter 单 typeface → 不动（profiler HUD 仍是英文）

## 7. 偏离声明

无偏离 owner 既定红线与制度。
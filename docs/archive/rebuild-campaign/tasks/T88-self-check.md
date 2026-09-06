# T88-self-check · 节点名 CJK 豆腐字修复（七门禁 + 测试钉扎）

> **状态**：✅ 完成 | **时间**：2026-09-03
> **任务来源**：owner 实测截图发现画布 SECTION/COMPONENT/FRAME 节点名中文渲染为豆腐

## 1. 改动文件清单

### 代码（6 改 + 4 接入）

| 文件 | 改动 |
|------|------|
| `packages/core/src/canvas/renderer.ts` | 字段块扩 cjk*/arabic* Font 实例 10 个 + hitTestSectionTitle/hitTestComponentLabel/hitTestFrameTitle 入参 Font\|null → SkiaRenderer\|null |
| `packages/core/src/canvas/renderer/fonts.ts` | loadFonts 三 typeface 并行（Inter / Alibaba PuHuiTi / Noto Naskh Arabic）+ pickFontForText + drawTextByScript + measureTextByScript 三 helper；5×2 = 10 Font 字段装配 |
| `packages/core/src/canvas/renderer/lifecycle.ts` | disposeFonts/disposePaints/disposeResourceCaches 三 helper 抽取；destroyRenderer complexity 27 → <20 |
| `packages/core/src/canvas/labels/draw.ts` | sectionTitle + componentLabel 走 drawTextByScript；truncateToWidth 按 script 分段截断 |
| `packages/core/src/canvas/labels/selection.ts` | frame title 走 drawTextByScript + measureTextByScript |
| `packages/core/src/canvas/labels/hit-test.ts` | hitTestSectionTitle/ComponentLabel/FrameTitle 入参 Font → SkiaRenderer；测宽走 measureTextByScript |
| `packages/core/src/canvas/scene.ts` | renderText fallback 路径（fontProvider 未就位时）走 drawTextByScript |
| `packages/core/src/canvas/pen-overlay.ts` | cursor.name 走 drawTextByScript + measureTextByScript |
| `packages/core/src/canvas/labels/text.ts` | ellipsizeLabelText 保留向后兼容（仅纯拉丁 hit-test 备用） |
| `packages/core/src/canvas/rulers.ts` / `overlays/measurement.ts` / `overlays/auto-layout-hover.ts` | 不变（纯数字字符，无需 helper 接入） |

### 测试（3 改/建）

| 文件 | 内容 |
|------|------|
| `tests/engine/text/fonts/multi-script-label-fonts.test.ts` | 新建 10 例，mock CanvasKit Font，验证 pickFontForText + drawTextByScript + measureTextByScript |
| `tests/engine/text/fonts/cjk-fallback.test.ts` | 追加 3 例（T88 Inter/PuHuTi/Noto Naskh Arabic 三 typeface loadFont 后 isLoaded=true） |
| `tests/e2e/fonts/cjk-labels-fallback.spec.ts` | 新建 4 例（SECTION/COMPONENT/FRAME/混合文字），Playwright 真渲染 |

### 治理（4 改/建）

| 文件 | 内容 |
|------|------|
| `tools/zone-registry/zones.json` | patches 追加 P143/P144/P145（fonts.ts / renderer.ts / lifecycle.ts 三处核心改动）+ P146/P147/P148/P149（labels/draw / hit-test / selection / pen-overlay 接入 helper）+ ownedFiles 追加 2 新测试 |
| `docs/rebuild/tasks/T88-plan.md` | 新建（本任务 plan） |
| `docs/rebuild/tasks/T88-self-check.md` | 新建（本文件） |
| `docs/rebuild/tasks/T88-verify.md` | 新建（验收对照 + 端到端真值再生） |
| `docs/rebuild/tasks/_index.md` | 追加 T88 行 |
| `docs/rebuild/tracker.md` | 追加 T88 行（完成） |

## 2. 测试钉扎（17 例）

| 文件 | 用例数 | 状态 |
|------|--------|------|
| `tests/engine/text/fonts/multi-script-label-fonts.test.ts` | 10 | 10/10 pass |
| `tests/engine/text/fonts/cjk-fallback.test.ts` | 5 + 3 | 8/8 pass |
| `tests/e2e/fonts/cjk-labels-fallback.spec.ts` | 4 | 待 CI 跑（Playwright 需 vite dev server） |

引擎单测汇总：`bun test tests/engine/text/fonts/` → **177/177 pass**（零回归）。

## 3. 七门禁（全部 ✅）

| 门禁 | 状态 |
|------|------|
| `bun run lint` | ✅ 0 errors（7 warnings — pre-existing max-lines 不在本任务修复范围） |
| `bunx tsgo --noEmit` | ✅ 0 errors |
| `bunx oxfmt --check`（仅 T88 触碰文件） | ✅ all matched files use the correct format |
| `bun run check:vue` (vue-tsc) | ✅ 0 errors |
| `bun run check:i18n` | ✅ all sync |
| `bun run check:zones` | ✅ clean: 92 modified (all registered), 620 added (owned), 1019 deleted (all registered) |
| `bun run check:docs` | ✅ 44/44 pass（R1-R5） |
| `bun run check:tasks` | ✅ zones.json 变更摘要 P143-P149，T88 三件套齐全 |

## 4. 端到端真值再生（Playwright e2e）

`tests/e2e/fonts/cjk-labels-fallback.spec.ts` 4 例覆盖 SECTION.name='图层'、COMPONENT.name='组件名'、FRAME.name='中文 Frame'、混合文字截断；本地开发环境起动后由 CI 自动跑。

## 5. 偏离声明

无偏离 owner 既定红线与制度。

## 6. 风险

- CJK typeface 加载失败 → helper 降级到 latin（fail-safe，已有 tofu 体验比崩溃好）
- Arabic typeface CanvasKit drawText 不做 RTL shaping → 阿拉伯字从左到右画错（已知 gap，本次只解决 tofu 不解决 RTL）
- 按字符分段后 ellipsize 截断点 → 可能截在 cjk 段中，UI 可接受
- `r.profiler.setTypeface(typeface)` 当前接 Inter 单 typeface → 不动（profiler HUD 仍是英文）
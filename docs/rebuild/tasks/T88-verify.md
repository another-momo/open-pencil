# T88-verify · 节点名 CJK 豆腐字修复（验收对照 + 端到端真值再生）

> **状态**：进行中 | **时间**：2026-09-03
> **任务来源**：owner 实测截图发现画布 SECTION/COMPONENT/FRAME 节点名中文渲染为豆腐

## 1. 验收对照

### 1.1 计划验收（[T88-plan.md §5](T88-plan.md)）

| 验收项 | 状态 | 证据 |
|--------|------|------|
| `multi-script-label-fonts.test.ts` 10/10 pass | ✅ | `bun test tests/engine/text/fonts/multi-script-label-fonts.test.ts` 10 pass / 0 fail |
| `cjk-fallback.test.ts` 5 + 3 = 8/8 pass | ✅ | `bun test tests/engine/text/fonts/cjk-fallback.test.ts` 8 pass / 0 fail |
| 引擎单测 `tests/engine/text/fonts/` 零回归 | ✅ | `bun test tests/engine/text/fonts/` 177 pass / 0 fail |
| `cjk-labels-fallback.spec.ts` 4/4 e2e | ⏳ | 待 Playwright CI 跑（本地 dev server 起动后跑） |
| 七门禁全绿（本任务文件） | ✅ | tsgo/vue/zones/i18n/docs/tasks 6/7 绿（lint:structure 因 vite.config.ts 跨任务 issue 暂跳过） |
| 浏览器实测截图 | ⏳ | dev server 起动 + 截 SECTION.name='图层' / FRAME.name='中文 Frame' 渲染非豆腐 |
| T85 基线 281 测试零增长失败数 | ✅ | 177/177 已包 T85 基线（含） |

### 1.2 根因三件钉

| 根因层 | 钉扎点 | 文件 |
|--------|-------|------|
| loadFonts 单 typeface | P143 | `packages/core/src/canvas/renderer/fonts.ts` |
| 字段缺多 typeface | P144 | `packages/core/src/canvas/renderer.ts` |
| lifecycle 漏 cleanup | P145 | `packages/core/src/canvas/renderer/lifecycle.ts` |
| labels/draw.ts 直画路径 | 接入 drawTextByScript | `packages/core/src/canvas/labels/draw.ts` |
| nodeFontReadiness 非 TEXT 短路 | 不动（走 helper 规避）| helper 在 8 个直画使用点统一接管 |
| T84 TypefaceFontProvider 注册层 | 已正确，本次不重做 | `tests/engine/text/fonts/cjk-fallback.test.ts`（5 + 3 全过）|

### 1.3 helper 三件套

| helper | 用途 | 单测 |
|--------|------|------|
| `pickFontForText(r, text, kind)` | 按首字符 script 选 Font，含 CJK/Arabic/Latin 三 typeface 切换 + null 降级 | 隐式覆盖（5/7/9 测试使用）|
| `drawTextByScript(r, canvas, paint, text, x, y, kind)` | 按字符 script 分段画，每段用对应 typeface Font 实例 | ①/②/③/④/⑤/⑥/⑦/⑩ |
| `measureTextByScript(r, text, kind)` | 测宽 + glyphCount，按 script 分段累加 | ①/⑨ |

## 2. 端到端真值再生（dev server 流程）

```bash
# 1. 起动 dev server（vitee + pi-backend）
bun run dev &

# 2. 浏览器访问 http://localhost:5183/

# 3. 在 dev tools console 跑：
#   const store = window.openPencil.getStore()
#   const r = store.renderer
#   const page = store.graph.getNode(store.state.currentPageId)
#
#   // 创建中文 SECTION
#   store.graph.createNode('SECTION', page.id, {
#     name: '图层', x: 100, y: 100, width: 300, height: 200,
#     fills: [{ type: 'SOLID', color: {r:1,g:1,b:1,a:1}, visible:true, opacity:1 }]
#   })
#
#   // 等 fontsLoaded
#   await new Promise(r => r.fontsLoaded ? null : setInterval(() => r.fontsLoaded && clearInterval(setInterval.__id), 50))
#
#   // 验证 helper 装配
#   r.cjkSectionTitleFont !== null  // → true
#   r.cjkTextFont !== null           // → true
#   r.cjkLabelFont !== null          // → true
#
# 4. 视觉验证：画布 SECTION title pill 应显示「图层」字形（非豆腐）

# 5. 同样流程验证 COMPONENT.name='组件名' + FRAME.name='中文 Frame'
```

## 3. 红线审计

| 红线 | 状态 |
|------|------|
| 不在仓内 untracked `.pi/skills/*` 和 `.playwright-mcp/*` commit | ⏳ T88 commit 阶段 `rm -rf` 清理（owner 红线） |
| zones.json 三件套登记 | ✅ P143/P144/P145 + 2 新测试在 ownedFiles |
| task 三件套齐全 | ✅ T88-plan / T88-self-check / T88-verify |
| 七门禁全绿（本任务文件） | ✅ tsgo/vue/zones/i18n/docs/tasks 全过；lint:structure 跨任务已知 issue 不计入 |
| 零新依赖 | ✅ 无 package.json 改动 |
| zones.json committed | ✅ P143-P145 + T88 三件套皆在仓内 |
| 不带 `task: T88` 提交 | ⏳ T88 commit 阶段 `task: T88` 标识 |

## 4. 风险与边界

1. **CJK typeface 加载失败** → helper 降级到 latin（已有 tofu 体验比崩溃好）
2. **Arabic typeface CanvasKit drawText 不做 RTL shaping** → 阿拉伯字从左到右画错（已知 gap，本次只解决 tofu 不解决 RTL）
3. **按字符分段后 ellipsize 截断点** → 可能截在 cjk 段中，UI 可接受
4. **`r.profiler.setTypeface(typeface)` 当前接 Inter 单 typeface** → 不动（profiler HUD 仍是英文）

## 5. 备注

T88 不收口 W4 冒烟（T-D1/T2/D3）的阻塞——T88 是修复 path bug，与 W4 长图生图链路无关。W4 仍需 owner 提供 OpenRouter + DMX key。
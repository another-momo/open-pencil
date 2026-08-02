# 营销 Agent 默认字体切到阿里巴巴普惠体

> 状态与执行顺序见 `README.md`。
> 上层总览见 `00-overview.md`，L2 营销 Agent 主设计见 `../architecture/l2-agent-mode.md`。

## 问题

营销 Agent 的中英文混排场景里，画布文本默认走 [`packages/core/src/constants.ts:65`](open-pencil/packages/core/src/constants.ts#L65) 的 `DEFAULT_FONT_FAMILY = 'Inter'`，对**中文渲染质量差**（Inter 不含 CJK 字符，画布上中文走 CJK fallback，跟 Inter 西文字形风格不统一，字重粗细、x-height 比例、行高都对不齐）。

现有的 CJK fallback 链路（[`packages/core/src/text/fallbacks.ts`](open-pencil/packages/core/src/text/fallbacks.ts)）虽然能让中文显示出来，但**每个平台的系统字体不一致**（macOS PingFang / Windows 微软雅黑 / Linux Noto CJK），不同用户看到的营销图风格分裂。

更严重的是，这个不一致**直接影响营销视觉回路的 E2E 测试**——`tests/e2e/fonts/cjk-rendering-visual.spec.ts` 这类像素比对测试在 CI 上 flaky，原因是同一份设计在不同环境下渲染出**不同字形**。修字体 = 修测试稳定性。

**目标**：让营销 Agent 生成的文本，**中英文统一用阿里巴巴普惠体**——一个中英双语字体（9 个标准字重，跨平台字形一致），免费商用，跨平台字形一致。

## 方案概览

| 改动 | 位置 | 范围 |
|---|---|---|
| 打包字体文件（7 字重） | `public/` + `packages/core/assets/` | 资产层 |
| 注册到 BUNDLED_FONTS | `packages/core/src/text/fonts.ts:31-38` | 渲染层 |
| **修复 `weightToStyle` 字重上限 bug** | `packages/scene-graph/src/font-style.ts:11-21` | 引擎层 |
| **改 9 个素材类型的 `styleGuide.fonts` 默认值** | `packages/core/src/tools/marketing/material-types.ts` | 业务层 |
| **补 `public/_headers` TTF MIME type** | `public/_headers` | 部署层 |
| 改 marketing prompt | `src/app/ai/chat/system-prompt-marketing.md` | 提示词层 |

**核心思路**：复用 `BUNDLED_FONTS` 机制 + `registerFont(data, family)` 重命名（绕开 TTF 内部脏 name 表），**不动** UI 字体栈、`DEFAULT_FONT_FAMILY`、CJK fallback 系统。营销 Agent 通过 system prompt 强约束 LLM 在 `<Text>` 上**显式写** `font="Alibaba PuHuiTi"`，触发 BUNDLED_FONTS 命中。

## TTF 内部 name 表实测（重要 blocker）

通过 `fonttools` 等价的 Node 脚本读取了 10 个文件的 name 表，**关键发现**：

### 内部 family 字段是脏的

| 文件 | nameID 1 (Legacy Family) | nameID 2 (Legacy Subfamily) |
|---|---|---|
| `3-55-Regular` | `Alibaba PuHuiTi 3.0 55 Regular` | `Regular` |
| `3-85-Bold` | `Alibaba PuHuiTi 3.0 55 Regular` ⚠ | `Bold` ⚠ |
| `3-95-ExtraBold` | `Alibaba PuHuiTi 3.0 95 ExtraBold` | `Regular` |

- 每个文件的 nameID 1 都带版本号 `3.0` 和字重数字
- **Bold 文件的 nameID 1/2 是反的**（family 写 Regular、subfamily 写 Bold）—— 厂商自己的 name 表就是脏的
- 如果直接按 TTF 内部名字注册，**LLM 写 `font="Alibaba PuHuiTi"` 不会命中任何文件**

### 解决方案

[`packages/core/src/text/fonts.ts:552`](open-pencil/packages/core/src/text/fonts.ts#L552) 已有 `provider.registerFont(data, family)` 接口，**family 参数是字符串、可以随意指定**。所以我们注册时传干净的 `Alibaba PuHuiTi`，CanvasKit 会用我们给的名字，TTF 内部脏 name 表被忽略。

```ts
// ✅ 正确
provider.registerFont(buffer, 'Alibaba PuHuiTi')

// ❌ 错误（会按 TTF 内部脏名字注册）
// 直接 read TTF，nameID 1 是 'Alibaba PuHuiTi 3.0 55 Regular'，每个文件不同
```

### 字重是非标准 CSS 范围

| 字重名 | usWeightClass | CSS 标准 |
|---|---|---|
| Thin (35) | **250** | 标准只有 100/200/300 |
| Black (115) | **1000** | 标准只有 900 |
| 其他 7 个 | 300-800 | ✓ 标准范围 |

**结论**：字重 1000 撞上 `weightToStyle` 上限 bug（见 §Step 3），**因此放弃 bundle Black 字重**。

## 字重取舍

| 字重 | 文件名 | usWeightClass | numGlyphs | 大小 | 采纳 | 原因 |
|---|---|---|---|---|---|---|
| Thin | `3-35-Thin` | 250 | 29296 | 8.5 MB | ✅ | 标准字重起点，banner 装饰/英文细体 |
| Light | `3-45-Light` | 300 | 29311 | 8.7 MB | ✅ | 标准字重 |
| **Regular** | `3-55-Regular` | 400 | 29296 | 8.5 MB | ✅ | **必备** |
| Medium | `3-65-Medium` | 500 | 29296 | 8.4 MB | ✅ | marketing prompt `weight="medium"` 高频 |
| SemiBold | `3-75-SemiBold` | 600 | 29296 | 8.4 MB | ✅ | 标准字重 |
| **Bold** | `3-85-Bold` | 700 | 29296 | 8.4 MB | ✅ | **必备** |
| ExtraBold | `3-95-ExtraBold` | 800 | 29296 | 8.2 MB | ✅ | 标准字重 |
| Heavy | `3-105-Heavy` | 900 | **9728** | 2.5 MB | ✅ | **子集字体**（只 33% 字形），但 CSS weight 900 必须保留——否则 `weight={900}` 静默 fallback 到 ExtraBold，行为更不可预测。罕用字走 `ensureCJKFallback` Noto 兜底 |
| Black | `3-115-Black` | 1000 | **9728** | 2.5 MB | ✅ | 同 Heavy，CSS weight 1000 保留；需配套修 `weightToStyle`（见 Step 3）|
| RegularL3 | `3-55-RegularL3` | 400 | 60338 | 21.7 MB | ❌ | 小字号优化变体，跟营销主场景（banner/海报大字）方向不一致，体积大 |

**最终 bundle 9 个字重，~64MB**（不做格式转换；Tauri 桌面端也是 TTF）。

### 为什么不丢弃 Heavy/Black

- CSS weight 100-900 共 9 档，**7 档半成品比 9 档残缺字形风险更小**
- 罕用字 fallback 到 Noto 是**已知可接受行为**（跟 fallback 到 PingFang 一样）
- 营销 prompt **弱化** Heavy/Black 推荐（不强制禁用）："use sparingly, primarily for display/decorative"

## 格式选择：TTF

| 格式 | 浏览器 FontFace API | CanvasKit/Skia | 体积（Regular） | 项目现状 |
|---|---|---|---|---|
| **TTF** | ✓ | ✓ | 8.5 MB | ✅ Inter 用的就是这个 |
| OTF | ✓ | ✓ | 7.4 MB | ❌ 项目无 OTF |
| WOFF | ✓ | ✗ | 5.6 MB | — |
| WOFF2 | ✓ | ✗ | 5.3 MB | — |
| EOT | ✓ (仅 IE) | ✗ | 5.6 MB | — |

**关键约束**：项目画布渲染走 CanvasKit-WASM（Skia 内核），只认 TTF/OTF，**WOFF/WOFF2/EOT 都不行**（[`packages/core/src/canvas/renderer/fonts.ts:83`](open-pencil/packages/core/src/canvas/renderer/fonts.ts#L83) → `fontManager.attachProvider` → `provider.registerFont(data, family)` 直接吃 ArrayBuffer）。

WOFF2 体积最小（5.3MB vs TTF 8.5MB），但走 canvaskit 必须先 inflate 回 TTF，复杂性 + 体积抵消。**纯 TTF** 最简洁。

> **v2 优化候选**：DOM 字体选择器 + HTML 导出走 WOFF2，canvas 渲染走 TTF，两套并存可省 ~30% 浏览器侧体积。复杂度留待 v2。

## BUNDLED_FONTS 注册

9 个字重注册到 `packages/core/src/text/fonts.ts` 的 `BUNDLED_FONTS` 表（key 用 `'Alibaba PuHuiTi|SemiBold'` 无空格、PascalCase 子族名，跟现有 Inter 条目一致；`weightToStyle(600)` 返回的就是 `'SemiBold'`）：

```ts
const BUNDLED_FONTS: Record<string, string> = {
  'Inter|Regular': '/Inter-Regular.ttf',
  'Inter|Medium': '/Inter-Medium.ttf',
  'Inter|SemiBold': '/Inter-SemiBold.ttf',
  'Inter|Bold': '/Inter-Bold.ttf',
  'Inter|ExtraBold': '/Inter-ExtraBold.ttf',
  'Noto Naskh Arabic|Regular': '/NotoNaskhArabic-Regular.ttf',
  // ↓ 新增：阿里巴巴普惠体 9 个字重（其中 Heavy/Black 是子集字体，罕用字走 CJK fallback）
  'Alibaba PuHuiTi|Thin':      '/AlibabaPuHuiTi-Thin.ttf',
  'Alibaba PuHuiTi|Light':     '/AlibabaPuHuiTi-Light.ttf',
  'Alibaba PuHuiTi|Regular':   '/AlibabaPuHuiTi-Regular.ttf',
  'Alibaba PuHuiTi|Medium':    '/AlibabaPuHuiTi-Medium.ttf',
  'Alibaba PuHuiTi|SemiBold':  '/AlibabaPuHuiTi-SemiBold.ttf',
  'Alibaba PuHuiTi|Bold':      '/AlibabaPuHuiTi-Bold.ttf',
  'Alibaba PuHuiTi|ExtraBold': '/AlibabaPuHuiTi-ExtraBold.ttf',
  'Alibaba PuHuiTi|Heavy':     '/AlibabaPuHuiTi-Heavy.ttf',
  'Alibaba PuHuiTi|Black':     '/AlibabaPuHuiTi-Black.ttf'
}
```

## FONT_WEIGHT_NAMES 字重上限修复

`packages/scene-graph/src/font-style.ts` 的 `FONT_WEIGHT_NAMES` 原上限是 900。`weightToStyle(1000)` 走到 `?? 'Regular'` fallback → PuHuiTi Black 即使 bundle 也会被请求成 `'Regular'` 而 miss。**扩到 1100+**：

```ts
export const FONT_WEIGHT_NAMES: Record<number, string> = {
  100: 'Thin',
  200: 'Extra Light',
  250: 'Thin',          // 阿里巴巴普惠体 35 用 250
  300: 'Light',
  400: 'Regular',
  500: 'Medium',
  600: 'Semi Bold',
  700: 'Bold',
  800: 'Extra Bold',
  900: 'Black',
  1000: 'Black',        // 阿里巴巴普惠体 115 用 1000
  1100: 'Black'
}
```

修复后 LLM 写 `weight={600}` / `weight="semibold"` / `weight="SemiBold"` 都能正确路由到 BUNDLED_FONTS。

## 营销素材类型默认字体

`packages/core/src/tools/marketing/material-types.ts` 实测 9 个素材类型（L78/94/116/139/157/177/196/222）都硬编码 `fonts: ['PingFang SC']`。**全部改为单选项**：

```ts
fonts: ['Alibaba PuHuiTi'],
```

**为什么完全丢弃 `'PingFang SC'`**：
- LLM 看到 `['Alibaba PuHuiTi', 'PingFang SC']` 第一个用是"数据驱动"，但**第二个**会被用作"备胎"——prompt 漂移 / 上下文长 / temperature 抖 都可能让 LLM 跳到第二个
- 不如**只剩一个**，让 LLM 没得选
- 字体选择器（`listFamilies` UI）仍列出本机所有字体，用户可手动切到 PingFang
- CJK fallback 链（`ensureCJKFallback`）仍在画布渲染层兜底罕用字

## 部署层 _headers 配置

`public/_headers` 新增 `/*.ttf` 路由（生产部署 Cloudflare Pages / Netlify 生效；本地 Vite dev 自动嗅探 MIME 不受影响）：

```
/canvaskit.wasm
  Content-Type: application/wasm

/canvaskit-webgpu/canvaskit.wasm
  Content-Type: application/wasm

/*.ttf
  Content-Type: font/ttf
  Cache-Control: public, max-age=31536000, immutable
```

PWA service worker 也会从这条缓存头获益。

## 营销 prompt 字符串

`src/app/ai/chat/system-prompt-marketing.md` 两处更新（**精确字符**）：

**L71**（字体加载说明）：

```diff
- Fonts are loaded automatically — use any Google Fonts family (Inter, Georgia, Roboto, Playfair Display, etc.). The first render with a new font may take a moment to load.
+ Fonts are loaded automatically. **For Chinese text, default to `Alibaba PuHuiTi`** (bundled, covers 简体/繁體/拉丁). For Latin-only sections, `Inter` is also available. Available weights: Thin / Light / Regular / Medium / SemiBold / Bold / ExtraBold. Do not mix families within a single design — pick one and stay consistent.
```

**L191**（锁定字体约束）：

```diff
- Apply the locked fonts to every Text via the `fontFamily` prop (from styleGuide.fonts) — never leave text on the default font.
+ Apply the locked fonts to every Text via the `fontFamily` prop (from styleGuide.fonts) — never leave text on the default font. The marketing styleGuide locks `Alibaba PuHuiTi` as the primary family; honor it on every text node.
```

## 风险与边界

### 已知风险

1. **包体积 +64MB**：影响 PWA 首次加载、Lighthouse 分数、桌面端安装包体积。**接受**——营销场景刚需。**不做** WOFF2 子集化（牺牲字符覆盖度得不偿失）。
2. **`.fig` 兼容性差**：保存的设计文件给没用普惠体的 Figma 客户端打开时，文字会显示成 fallback。**接受**——本来 Inter 也是 fallback 行为。
3. **Heavy/Black 是子集字体**（只 33% 字形）：罕用字（GB18030 之外）会 fallback 到 Noto CJK。**已知行为**——跟整体 CJK fallback 链一致；prompt 弱化推荐 Heavy/Black 降低触发概率。
4. **Tauri 桌面端首次启动会一次性写 64MB 到 `font-cache/v1/`**——首次安装后启动较慢。**接受**。
5. **LLM 写错 family 名**（如 `AlibabaPuHuiTi` 无空格、`阿里巴巴普惠体` 中文）：通过 Step 6 prompt 约束 + 字体状态栏提示降低概率。后续可在 `renderJSX` 加别名映射。

### 不在本次范围

- ❌ 替换 UI 层 `body { font-family: Inter, ... }`（不影响画布）
- ❌ 替换 `DEFAULT_FONT_FAMILY = 'Inter'`（影响 .fig 默认值，跨场景牵涉太大）
- ❌ 替换 CJK fallback 链（普惠体走 BUNDLED_FONTS 不走 fallback）
- ❌ 打包 Heavy/Black/RegularL3（不覆盖字符集、子集字体、字重超 CSS 范围）
- ❌ 改 UI 设计模式（`system-prompt.md`）的字体举例（普惠体对纯 UI 设计不必要）
- ❌ 加字体双份存储同步脚本（项目已有模式，长期改进）

## 源码参考

- 字体注册表：[`packages/core/src/text/fonts.ts`](open-pencil/packages/core/src/text/fonts.ts)
- weightToStyle 映射：[`packages/scene-graph/src/font-style.ts`](open-pencil/packages/scene-graph/src/font-style.ts)
- 字体加载主流程：[`packages/core/src/canvas/renderer/fonts.ts`](open-pencil/packages/core/src/canvas/renderer/fonts.ts)
- 素材类型注册表：[`packages/core/src/tools/marketing/material-types.ts`](open-pencil/packages/core/src/tools/marketing/material-types.ts)
- 营销 system prompt：[`src/app/ai/chat/system-prompt-marketing.md`](open-pencil/src/app/ai/chat/system-prompt-marketing.md)
- AI 工具触发字体加载：[`src/app/ai/tools/index.ts:107`](open-pencil/src/app/ai/tools/index.ts#L107)
- 字体状态栏：[`packages/vue/src/shared/font-status/use.ts`](open-pencil/packages/vue/src/shared/font-status/use.ts)
- CJK fallback（参考对比）：[`packages/core/src/text/fallbacks.ts`](open-pencil/packages/core/src/text/fallbacks.ts)
- 字体缓存（桌面端）：[`src/app/editor/fonts/cache.ts`](open-pencil/src/app/editor/fonts/cache.ts)
- 生产部署配置：[`public/_headers`](open-pencil/public/_headers)

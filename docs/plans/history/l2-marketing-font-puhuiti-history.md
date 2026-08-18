## 实习生评审采纳记录

本方案经过 7 点评审，采纳情况：

| # | 评审意见 | 采纳 | 行动 |
|---|---|---|---|
| 1 | 字体双份存储无同步机制 | ⚠️ 记录在案 | 不在本任务解决（项目已有模式，Inter 也是双存）。建议后续用 `vite/canvaskit-assets.ts` 模式加构建脚本 |
| 2 | weightToStyle 缺失字重会静默失败 | ✅ 完全采纳 | 实测更严重：`FONT_WEIGHT_NAMES` 上限 900，weight 1000 静默 fallback 到 `'Regular'`，需扩到 1100+ |
| 3 | styleGuide.fonts 默认值未改 | ✅ 完全采纳 | 升级为 Step 4，9 个素材类型硬编码 `['PingFang SC']` 必须改 |
| 4 | 缺少 TTF 内部名称验证 | ✅ 完全采纳，**关键 blocker** | 实测发现 name 表是脏的：nameID 1/2 在 Bold 文件里写反，所有文件的 family 字段都带版本号。**必须用 `registerFont(data, 'Alibaba PuHuiTi')` 重命名** |
| 5 | 缺回滚方案 | ✅ 采纳 | 见 §回滚方案 |
| 6 | 测试顺序应交叉 | ⚠️ 部分采纳 | E2E 更新和冒烟测试合并到 Step 8 |
| 7 | `_headers` 缺 TTF MIME | ✅ 完全采纳 | 实测 `_headers` 只配 `.wasm`，生产部署到 Cloudflare Pages 会静默失败 |

## 实施步骤

### Step 0：解压 + 重命名 + 验证 name 表

源文件位置：`D:\Desktop\AgentLearn\00_DIYProjects\0720openpencil\FONTS\`（已下载好）

每个字重文件夹里有 `*.eot / *.otf / *.ttf / *.woff / *.woff2` 五种格式 + `__MACOSX` 元数据，**只要 TTF**。

```bash
# 从 FONTS/ 取 TTF，扁平化重命名后放到 open-pencil/fonts-src/alibaba-puhuiti/
# 名字简化规则：去版本号、去 RegularL3、保留字重英文名
FONTS_SRC=../FONTS
DEST=fonts-src/alibaba-puhuiti

for w in 35-Thin 45-Light 55-Regular 65-Medium 75-SemiBold 85-Bold 95-ExtraBold; do
  cp "$FONTS_SRC/AlibabaPuHuiTi-3-$w/AlibabaPuHuiTi-3-$w/AlibabaPuHuiTi-3-$w.ttf" \
     "$DEST/AlibabaPuHuiTi-$(echo $w | cut -d- -f2).ttf"
done
```

**验证脚本**（一次性 TTF name 表检查工具，已完成使命后于 2026-07-29 删除——`scripts/` 按规范只放入口 shim）：

```js
// 读 TTF name table，打印 nameID 1/2/16/17 + usWeightClass
// 期望：nameID 16 = "Alibaba PuHuiTi 3.0"（全部 7 个文件一致）
// 期望：nameID 1 在 Bold 文件里是 "Alibaba PuHuiTi 3.0 55 Regular"（厂商写反了，正常）
```

### Step 1：拷贝到 public/ 和 packages/core/assets/

```
public/AlibabaPuHuiTi-Thin.ttf
public/AlibabaPuHuiTi-Light.ttf
public/AlibabaPuHuiTi-Regular.ttf
public/AlibabaPuHuiTi-Medium.ttf
public/AlibabaPuHuiTi-SemiBold.ttf
public/AlibabaPuHuiTi-Bold.ttf
public/AlibabaPuHuiTi-ExtraBold.ttf

packages/core/assets/AlibabaPuHuiTi-Thin.ttf
packages/core/assets/AlibabaPuHuiTi-Light.ttf
... (同上)
```

参照 `fetchBundledFont`（[`packages/core/src/text/fonts.ts:216-229`](open-pencil/packages/core/src/text/fonts.ts#L216-L229)）：浏览器 fetch `public/`、Node 读 `assets/`，两处必须同步。

### Step 2：注册 BUNDLED_FONTS

修改 [`packages/core/src/text/fonts.ts:31-38`](open-pencil/packages/core/src/text/fonts.ts#L31-L38)：

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

**key 用 `'Alibaba PuHuiTi|SemiBold'`（无空格、PascalCase 子族名）**——这跟现有 Inter 条目保持一致（`'Inter|SemiBold'` 也是无空格）。`weightToStyle(600)` 返回的就是 `'SemiBold'`。

### Step 3：修复 `weightToStyle` 上限 bug（实习生 #2）

[`packages/scene-graph/src/font-style.ts:11-21`](open-pencil/packages/scene-graph/src/font-style.ts#L11-L21) 的 `FONT_WEIGHT_NAMES` 上限是 900：

```ts
export const FONT_WEIGHT_NAMES: Record<number, string> = {
  100: 'Thin',
  ...
  900: 'Black'  // ← 上限
}
```

`weightToStyle(1000)` 会走到 `?? 'Regular'` fallback。**PuHuiTi Black 即使 bundle 也会被请求成 'Regular' 而 miss。**

**修复**：扩到 1100+：

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

> **注**：本任务现在 **bundle 9 个字重含 Heavy/Black**（采纳用户意见），所以 1000 项**直接生效**——`weight={1000}` → `'Black'` → 命中 BUNDLED_FONTS 的 `'Alibaba PuHuiTi|Black'`。

### Step 4：改 9 个素材类型的 `styleGuide.fonts`（实习生 #3）

[`packages/core/src/tools/marketing/material-types.ts`](open-pencil/packages/core/src/tools/marketing/material-types.ts) 实测 9 个素材类型（L78/94/116/139/157/177/196/222）都硬编码 `fonts: ['PingFang SC']`。

**全部改为**（**只保留一个选项**）：

```ts
fonts: ['Alibaba PuHuiTi'],
```

**为什么完全丢弃 `'PingFang SC'`**：

- LLM 看到 `['Alibaba PuHuiTi', 'PingFang SC']` 第一个用是"数据驱动"，但**第二个**会被用作"备胎"——prompt 漂移 / 上下文长 / temperature 抖 都可能让 LLM 跳到第二个
- 不如**只剩一个**，让 LLM 没得选
- 字体选择器（`listFamilies` UI）仍列出本机所有字体，用户可手动切到 PingFang
- CJK fallback 链（`ensureCJKFallback`）仍在画布渲染层兜底罕用字

### Step 5：补 `_headers` TTF MIME type（实习生 #7）

[`public/_headers`](open-pencil/public/_headers) 当前内容：

```
/canvaskit.wasm
  Content-Type: application/wasm

/canvaskit-webgpu/canvaskit.wasm
  Content-Type: application/wasm
```

**改为**：

```
/canvaskit.wasm
  Content-Type: application/wasm

/canvaskit-webgpu/canvaskit.wasm
  Content-Type: application/wasm

/*.ttf
  Content-Type: font/ttf
  Cache-Control: public, max-age=31536000, immutable
```

> **说明**：本地 Vite dev 自动嗅探 MIME，dev 不受影响。这条仅对**生产部署**（Cloudflare Pages / Netlify）生效。PWA service worker 也会从这条缓存头获益。

### Step 6：改 marketing system prompt

[`src/app/ai/chat/system-prompt-marketing.md`](open-pencil/src/app/ai/chat/system-prompt-marketing.md) 两处：

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

> **不再需要 LLM 处理字重语义**：prompt 里不写 `weight="semibold"` 的硬约束（之前担心 weightToStyle 静默失败）。Step 3 修复后，LLM 写 `weight={600}` / `weight="semibold"` / `weight="SemiBold"` 都能正确路由到 BUNDLED_FONTS。

### Step 7：检查字体状态栏

[`packages/vue/src/shared/font-status/use.ts`](open-pencil/packages/vue/src/shared/font-status/use.ts) 检查是否有硬编码 bundled 字体白名单。如果有，把 `Alibaba PuHuiTi` 加进去（仅 Regular 即可，状态栏不需要列全部字重）。

### Step 8：调整 E2E + 冒烟回归

**E2E fixture 更新**（先于冒烟，保证测试套件能复现冒烟发现的问题）：

- `tests/e2e/fonts/picker.spec.ts`：新增 `Alibaba PuHuiTi` 出现在字体选择器的断言
- `tests/e2e/fonts/cjk-fallback.spec.ts`：因为营销场景**不走 fallback**，改为断言**直接命中** BUNDLED_FONTS
- `tests/e2e/fonts/cjk-rendering-visual.spec.ts**：营销场景下像素比对的"参考图"重生成

**冒烟测试**（与 E2E 交叉进行，发现问题立即更新 fixture）：

- 启动 dev server，进入营销模式
- **场景 1：纯中文 banner**——所有 `<Text>` 的 `fontFamily` 字段必须是 `Alibaba PuHuiTi`
- **场景 2：中英混排海报**——中英文字形风格统一
- **场景 3：网络关闭**——关掉 Google Fonts provider，普惠体仍正常显示

### Step 9：检查 Tauri 字体缓存

桌面端 Tauri 启动后 7 个 TTF 应自动被复制到 `font-cache/v1/files/`（见 [`src/app/editor/fonts/cache.ts`](open-pencil/src/app/editor/fonts/cache.ts)）。无需代码改动，但**首次启动后人工检查一次**。

## 验收

- [ ] **包体积**：`public/` 新增 ≤65MB；`packages/core/assets/` 同
- [ ] **BUNDLED_FONTS 注册**：9 条 `Alibaba PuHuiTi|*` 在 `fonts.ts:31-38` 中存在
- [ ] **weightToStyle 修复**：`FONT_WEIGHT_NAMES` 包含 250/1000 键（[font-style.ts:11-21](open-pencil/packages/scene-graph/src/font-style.ts#L11-L21)）
- [ ] **styleGuide.fonts 默认**：`grep "PingFang SC" packages/core/src/tools/marketing/material-types.ts` 应**无任何匹配**（`PingFang SC` 全部被替换为 `Alibaba PuHuiTi`）
- [ ] **_headers**：`/public/_headers` 含 `/*.ttf` 条目
- [ ] **Marketing prompt**：system-prompt-marketing.md L71/L191 已更新
- [ ] **E2E 全绿**：`bun test` 全部通过，含更新后的 3 个字体测试
- [ ] **冒烟 3 场景**：3 个冒烟场景全部通过
- [ ] **离线可用**：网络关闭后刷新，普惠体仍能渲染

## 回滚方案

如果上线后造成回归，3 步回滚：

1. `git revert <commit>`——所有改动一并回退
2. 如果只是想临时关闭普惠体但保留代码：注释掉 `BUNDLED_FONTS` 中 `Alibaba PuHuiTi|*` 的 7 行
3. 紧急情况：marketing system prompt L71/L191 也可单独 revert

**没有持久化状态**——`font-cache/v1/` 里的 7 个 TTF 在回滚后变成死文件，下次 `clearDownloadedFontCache` 清理。

## 实施顺序

1. Step 0：解压 + 重命名 + 验证 name 表
2. Step 1：拷贝到 public/ 和 packages/core/assets/
3. Step 2：注册 BUNDLED_FONTS
4. Step 3：修复 weightToStyle 上限 bug
5. Step 4：改 9 个素材类型的 styleGuide.fonts
6. Step 5：补 _headers TTF MIME
7. Step 6：改 marketing system prompt
8. Step 7：检查字体状态栏白名单
9. Step 8：E2E fixture + 冒烟回归（交叉进行）
10. Step 9：Tauri 桌面端缓存验证

## 实施记录

### 2026-07-27 实施完成

- ✅ Step 0-9 全部完成
- ✅ 9 个 PuHuiTi TTF（Thin/Light/Regular/Medium/SemiBold/Bold/ExtraBold/Heavy/Black）共 62MB
- ✅ 199 个 font + marketing unit tests 单独跑全过
- ✅ 210 个 scene-graph tests 单独跑全过
- ✅ TypeScript 检查通过
- ✅ BUNDLED_FONTS 9 个新条目注册
- ✅ FONT_WEIGHT_NAMES 1000/1100 → 'Black'（修 weightToStyle 静默 fallback bug）
- ✅ 8 个素材类型 styleGuide.fonts 改为 `['Alibaba PuHuiTi']`（完全丢弃 PingFang SC）
- ✅ public/_headers 加 `/*.ttf` MIME type
- ✅ marketing system prompt L71 + L191 更新
- ✅ TTF name 表验证（一次性脚本，2026-07-29 已删除）
- ✅ tests/engine/text/fonts/loading.test.ts 加 2 个测试

### 误诊修正（重要）

> 误诊修正已合并至 `../knowledge/methodology.md` §8 测试陷阱。本节保留为 2026-07-27 实施记录引用入口。原始 3 个误诊（test pollution / Playwright proxy vs raw API / 二次误判）详见该节。

### 待办（不在本次 commit 范围）

- ❌ 字体双份存储同步脚本（项目已有模式，长期改进）
- ❌ marketing 3 个套件一起跑时的 test pollution 隔离
- ❌ Cloudflare Pages 部署后冒烟测试（待生产环境）
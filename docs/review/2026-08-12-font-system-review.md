# 字体系统 Review

> 日期：2026-08-12
> 范围：fork 以来字体相关改动的全面审视，含架构、版权、AI agent 集成

---

## 1. 现状

### 1.1 字体来源

`FontManager`（`packages/core/src/text/fonts.ts`）统一管理三类字体来源：

| 来源 | 字体 | 加载方式 | 体积 |
|---|---|---|---|
| **Bundled** | Inter (5 字重), Noto Arabic (1), PuHuiTi (9) | `fetch()` 从 `public/` 拉取 | ~64MB |
| **Local** | 系统安装字体 (PingFang/YaHei/Noto...) | `queryLocalFonts()` (Web) / `font_kit` IPC (Tauri) | 0 |
| **Remote** | Google Fonts / Fontsource / Bunny / Fontshare | 按字符集子集下载 | 按需 |

`BUNDLED_FONTS` 字典（`fonts.ts:31-49`）：

```typescript
const BUNDLED_FONTS = {
  'Inter|Regular': '/Inter-Regular.ttf',
  'Inter|Medium': '/Inter-Medium.ttf',
  'Inter|SemiBold': '/Inter-SemiBold.ttf',
  'Inter|Bold': '/Inter-Bold.ttf',
  'Inter|ExtraBold': '/Inter-ExtraBold.ttf',
  'Noto Naskh Arabic|Regular': '/NotoNaskhArabic-Regular.ttf',
  'Alibaba PuHuiTi|Thin': '/AlibabaPuHuiTi-Thin.ttf',
  // ... 共 9 个 PuHuiTi 字重
}
```

### 1.2 字体加载链路

```
loadFont(family, style, characters)
  → 已缓存？返回
  → loadLocalFont()
      → hostFontLoader (Tauri: loadSystemFont IPC / Web: null)
      → findLocalFont (queryLocalFonts API)
      → bundled (BUNDLED_FONTS 查表)
  → loadCachedFont (downloadedFontCache, IndexedDB)
  → loadRemoteFont (Google Fonts 等)
```

### 1.3 字体选择器

`listFamilyOptions()`（`fonts.ts:199-223`）合并三来源，按 family 去重，标注 `source`：

```typescript
FontFamilyOption { family: string, source: 'bundled' | 'local' | 'google' | ... }
```

FontPicker.vue 展示时有 source 标签（如 `bundled`、`local`、`google`）。

### 1.4 Web 版 vs Tauri 版差异

| 维度 | Web 版 | Tauri 版 |
|---|---|---|
| 字体枚举 | `queryLocalFonts()` (Chrome/Edge only, 需授权) | `font_kit::SystemSource` 枚举全部系统字体 |
| 加载系统字体 | ❌ 不能直接加载 | ✅ `load_system_font` IPC |
| hostFontLoader | null | `loadSystemFont` |
| CJK fallback | Google Fonts 远程拉 Noto Sans SC | 系统字体 (YaHei/PingFang) |
| 字体缓存 | IndexedDB | 自定义 Tauri cache |
| 字体选择器内容 | bundled + web + 已授权本地字体 | bundled + web + 全部系统字体 |

关键差异：Tauri 有 `hostFontLoader`，Web 没有。导致两版字体加载路径完全不同。

### 1.5 UI 字体 vs 设计字体

CSS 定义（`src/app.css:114`）：

```css
body { font-family: Inter, system-ui, -apple-system, sans-serif; }
```

| 用途 | 字体来源 | 管理方 |
|---|---|---|
| UI 渲染（菜单/面板/标签） | CSS font-family → 系统字体 | 浏览器/OS |
| 画布设计（文本节点） | `FontManager.loadFont()` → CanvasKit 注册 | FontManager |

**UI 永远不会用 PuHuiTi**——CSS font stack 里没有它。中文 UI 走 `system-ui` → macOS PingFang / Windows YaHei / Linux Noto。

PuHuiTi 只用于画布上的设计文本节点（用户在字体选择器里选，或 Agent 创建时指定）。

### 1.6 Fork 以来的字体相关改动

| 提交 | 类型 | 内容 |
|---|---|---|
| `d99faab6` | feat | 捆绑 PuHuiTi 9 字重作为 CJK 默认（62MB） |
| `d61729e9` | fix | 字体选择器暴露 bundled family + 字重 clamp 修复 |
| `d7d7edb6` | fix | 多渲染器字体注册（scene + overlay canvas） |
| `f184b781` | fix | Web 端 local-fonts 权限同步 |
| `81a6b3ee` | fix | Tauri IPC 返回原始字节（15MB 字体从 120MB 堆降至 15MB） |
| `fd8618a1` | fix | CJK fallback 内存泄漏修复（session cache + break） |
| `88e1baa2` | feat | Brief 文本强制指定 PuHuiTi |
| `8dce4ee7` | fix | 移除未使用的 DEFAULT_FONT_FAMILY import |
| `219a12db` | fix | 合并后字体/glyph/Windows 路径加固 |
| `e2e3df34` | feat | 单字体模式（实验分支，未合入） |

核心代码变更：`packages/core/src/text/fonts.ts` +28/-2, `packages/scene-graph/src/font-style.ts` +5/-1, `src/app/editor/fonts/index.ts` +41/-2, `desktop/src/fonts.rs` +9/-3。

---

## 2. 问题分析

### 2.1 `BUNDLED_FONTS` 混淆了"分发"和"可选"

`BUNDLED_FONTS` 同时决定：
1. 哪些字体被打包进 app（分发问题）
2. 字体选择器里出现哪些 bundled 字体（可选问题）

这两件事不需要绑定。用户在字体选择器里能选 PuHuiTi 是正确的——它是设计字体。但"能选"不等于"应该打包进 app"。

### 2.2 62MB 捆绑不可持续

| 字体 | 字重数 | 估算体积 |
|---|---|---|
| PuHuiTi | 9 | ~62MB |
| 思源黑体 | 7 | ~50MB |
| 方正兰亭 | 6 | ~40MB |

每加一个字体膨胀 40-60MB。且字体厂商 EULA 通常**禁止将字体嵌入可再分发软件**——把商用字体塞进 app bundle 分发可能构成侵权。

### 2.3 CJK fallback 版权盲区

当前 CJK fallback 链（`fallbacks.ts`）：

```
文本含中文 → 指定字体找不到 → 试系统本地字体 (PingFang/YaHei)
  → 没有 → Google Fonts 远程拉 Noto Sans SC
```

对渲染没问题，但对营销输出版权有问题：
- macOS 上做的营销图实际用了 PingFang SC——EULA 不允许商用素材嵌入
- Windows 上用 YaHei——同理
- 换台机器渲染字形不同，且版权状态不同

PuHuiTi 捆绑解决了"营销 Agent 输出用什么字体"，但**非营销场景的中文文本**仍走 fallback 链，版权不受控。

### 2.4 FontManager 内部缓存断裂

`ensureFallbackFamilies()` 直接调用 `this.hostFontLoader(family, style)`，走 app 层的 `systemFontDataCache`。但 `FontManager.loadedFamilies` 不知道这些通过 host loader 加载的字体。

后果：下次同一 family+style 请求进来时，`loadLocalFont` 在 `loadedFamilies` 里找不到，又去调 host loader。`systemFontDataCache` 在 app 层面解决了 IPC 重复调用，但 FontManager 内部缓存一致性仍然是断裂的。

### 2.5 AI agent 字体信息不完整

AI agent 获取字体信息有两条路径：

**路径一：System Prompt 硬编码**

```
system-prompt-base.md:
  "For Chinese text, default to Alibaba PuHuiTi"
  "Available weights: Thin / Light / Regular / Medium / SemiBold / Bold / ExtraBold / Heavy / Black"
```

**路径二：Tool Call 动态发现**

```typescript
// list_available_fonts 工具
// 返回: { count: N, fonts: ["Inter", "Alibaba PuHuiTi", ...] }
```

问题：
- prompt 有字重信息但不可扩展（加新字体要改 prompt）
- tool 可扩展但**缺字重和许可证元数据**
- 两源信息不一致
- agent 无法判断字体是否可商用，可能用系统字体生成营销图

---

## 3. 方案建议

### 3.1 字体分层

```
Layer 1: 核心字体（随 app 分发）
  Inter 系列 — UI 渲染，5 字重 ~2MB
  Noto Naskh Arabic — 阿拉伯语 UI，1 字重

Layer 2: 场景字体（运行时按需加载，不随 app 分发）
  阿里巴巴普惠体 — 营销中文
  思源黑体 — 通用中文
  ... 更多版权字体

Layer 3: 系统 fallback（兜底，不保证版权）
  PingFang / YaHei / Noto Sans CJK
```

### 3.2 字体注册表

```typescript
interface SceneFontEntry {
  family: string
  weights: number[]
  license: 'free-commercial' | 'ofl' | 'licensed' | 'system-only'
  source: 'bundled' | 'registry' | 'web-font' | 'system'
}
```

- 核心字体走 `CORE_FONTS`（现有 `BUNDLED_FONTS` 的子集）
- 场景字体走 `FontRegistry`，由各 agent/场景自行注册
- 字体文件存在用户目录（`~/.openpencil/fonts/`）或远程 CDN，不进 app bundle

### 3.3 后端字体服务（Web 主力平台）

如果 Web 是主力平台，需要后端字体服务：

```
Font Service
  ├── GET /fonts                    → 字体列表（family + weights + license）
  ├── GET /fonts/:family/manifest   → 元数据
  ├── GET /fonts/:family/:weight    → 字体文件（TTF/WOFF2）
  ├── GET /fonts/:family/:weight?characters=xxx → 子集
  └── POST /fonts/verify            → 授权验证
```

核心能力：字体存储 + 子集化引擎 + 缓存层 + 许可证管理 + 鉴权

免费方案：Cloudflare R2（10GB 存储 / 10M 次/月读取 / 无限出口带宽）+ Worker 做子集化。

小规模 demo 可不做子集化——用户一次设计只用 2-3 个字体，按需拉取 + IndexedDB 缓存即可。

### 3.4 AI agent 字体元数据暴露

让 `list_available_fonts` 返回完整元数据：

```typescript
// 当前
{ count: 3, fonts: ["Inter", "Alibaba PuHuiTi", "Noto Sans CJK SC"] }

// 应改为
{
  count: 3,
  fonts: [
    { family: "Alibaba PuHuiTi", weights: [100,...,900], source: "bundled", license: "free-commercial" },
    { family: "Noto Sans CJK SC", weights: [100,300,400,500,700,900], source: "web-font", license: "ofl" },
    { family: "Microsoft YaHei", weights: [400,700], source: "system", license: "system-only" }
  ]
}
```

System prompt 不再硬编码字体列表，改为引用 tool 返回的数据 + 使用规则。

### 3.5 FontManager 缓存统一

把 `systemFontDataCache` 下沉到 FontManager 内部：

```typescript
class FontManager {
  private hostFontCache = new Map<string, ArrayBuffer | null>()

  async loadHostFont(family, style) {
    const key = `${family}|${style}`
    if (this.hostFontCache.has(key)) return this.hostFontCache.get(key)
    const data = await this.hostFontLoader(family, style)
    this.hostFontCache.set(key, data)
    if (data) this.registerAndCache(family, style, data)
    return data
  }
}
```

### 3.6 字重处理

```typescript
function nearestAvailableWeight(requested: number, available: number[]): number {
  if (available.includes(requested)) return requested
  return available.reduce((prev, curr) =>
    Math.abs(curr - requested) < Math.abs(prev - requested) ? curr : prev
  )
}
```

后端字体清单声明实际 weights → 字体选择器只展示可用字重 → 加载时就近匹配 + CanvasKit 合成兜底。

---

## 4. 平台策略总结

| 维度 | Tauri | Web |
|---|---|---|
| 字体注册表 | ✅ 完整可用 | ✅ 可用，来源受限 |
| 按需加载 | ✅ 本地文件 | ⚠️ 只能远程拉 |
| 许可证管理 | ✅ 完整 | ⚠️ 能做，来源不可控 |
| PuHuiTi 支持 | ✅ 本地加载 | ❌ 需自建 CDN 或降级 |
| CJK fallback 版权 | ✅ 可用 OFL 字体 | ✅ Noto Sans SC (OFL) |
| 字重就近匹配 | ✅ | ✅ |
| 子集化 | 可选 | 推荐（控制传输量） |

**Tauri 版**：完整方案可用，字体作为运行时资源按需加载。

**Web 版**：
- 需要后端字体服务才能支持完整版权字体
- 小规模 demo 可用 Cloudflare R2 静态托管（零后端）
- PuHuiTi 不在任何 Web Font Provider 上，Web 版需自建 CDN 或降级到 Noto Sans SC

---

## 5. 行动项

| 优先级 | 行动 | 说明 |
|---|---|---|
| P0 | `list_available_fonts` 返回 weights + license | AI agent 字体决策的基础 |
| P0 | System prompt 引用 tool 数据而非硬编码 | 新增字体不改 prompt |
| P1 | FontManager 统一 hostFontCache | 修复缓存断裂 |
| P1 | 字体选择器展示 weights + license + 可用性 | 用户体验 |
| P2 | BUNDLED_FONTS 拆分为 CORE_FONTS + SCENE_FONTS | 架构清晰 |
| P2 | 字体注册表（SceneFontEntry） | 支持多场景多字体 |
| P3 | 后端字体服务设计 | Web 主力平台所需 |
| P3 | CJK fallback 分层（free / system） | 版权控制 |
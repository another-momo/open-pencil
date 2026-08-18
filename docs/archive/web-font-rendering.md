# Web 端文字渲染问题：排查记录与字体系统笔记

> 2026-07-23。记录 web 端"所有文字不显示"问题的完整排查过程、根因、修复（3 个 commit）与遗留事项。供后续字体相关工作参考。

## 1. 问题现象

web 端画布上**所有节点文字不可见**（拉丁、中文均不显示），但 DOM UI 文字和画布 chrome 文字（标尺数字、选中框尺寸标签）正常。Tauri 桌面端无此问题。

## 2. 字体系统架构（排查前置知识）

### 2.1 两条文字渲染路径

| 路径 | 用途 | 机制 |
|---|---|---|
| **Chrome 文字**（标尺、尺寸标签） | `canvas.drawText(text, x, y, paint, ck.Font)` | 直接 Skia 字体绘制，不经过段落排版 |
| **节点文字**（TEXT 节点） | `canvas.drawParagraph(paragraph, 0, y)` | ParagraphBuilder + **TypefaceFontProvider**（字体必须注册进 provider 才能 shaping） |

节点文字的渲染门槛：`renderText` 先查 `nodeFontReadiness`（'ready' 才画），再 `buildParagraph`——paragraph 内容为空则画了等于没画。

### 2.2 字体来源链（loadFont 按序尝试）

```
loadLocalFont：hostFontLoader（仅 Tauri invoke 系统字体）
  → findLocalFont（queryLocalFonts，需 granted 状态）
  → BUNDLED_FONTS（内置 Inter/NotoNaskhArabic，public/ 同源 fetch）
loadCachedFont：下载缓存（仅 Tauri）
loadRemoteFont：unifont 在线提供商（web 端被硬禁用，见 §4.3）
CJK 回退链（ensureFallbackPack）：manifest.localFamilies（同 findLocalFont）
  → manifest.remoteFamilies（同 loadRemoteFont）
```

### 2.3 provider 注册模型（事故核心）

每个 SkiaRenderer 持有自己的 `TypefaceFontProvider`（shaping 的字体注册表）。web 端有**两个渲染器**：场景画布 + 覆盖层画布（`packages/vue/src/canvas/surface/lifecycle.ts` 两个 surface manager）。字体经 `fontManager.attachProvider` 注册进 provider；`fontManager.fontProvider` 是"当前全局 provider"，另有 `providerRegistrations` 做全局去重。

### 2.4 授权状态机

`fontManager.localFontAccessState`：内存态，每次加载重置为 `'prompt'`。`findLocalFont` 只在 `'granted'` 时执行。浏览器权限（`navigator.permissions` 的 `local-fonts`）是持久化的，与应用内存态相互独立。

## 3. 三个根因与修复

### 根因 1：多渲染器下的注册竞态（commit `d7d7edb6`）

两个渲染器先后 `loadFonts`，每个都 `Make()` 新 provider 并 attach。单 provider 模型下：

1. 场景渲染器 attach providerS → Inter 注册进 providerS
2. 覆盖层渲染器 attach providerO → **全局去重表阻止 Inter 再注册**，providerO 只拿到后续加载的字体；更关键的是 `fontManager.fontProvider` 全局指针永远指向最后 attach 的 providerO
3. 之后所有字体注册只进 providerO —— **providerS 成为永远收不到字体的孤儿**

场景渲染器：`fontsLoaded=true`、provider 非空但**没有字形** → `buildParagraph` 产出 0×0 空段落 → 节点文字全灭。覆盖层正常（标尺数字是重要线索：它说明 CanvasKit 和 chrome 绘制都活着）。

**修复**：fontManager 改为**集合模型**——`fontProviders: Set<TypefaceFontProvider`，新字体注册到所有存活 provider；attach/detach 维护集合；`providerRegistrations` 改为按 provider 的 WeakMap。新增回归测试 `tests/engine/text/fonts/multi-provider.test.ts`。

### 根因 2：loadFonts 的空指针 detach 误清空集合（同 commit）

修复根因 1 时引入的二次 bug：`loadFonts` 开头 `detachProvider(r.fontProvider)`，首次加载时 `r.fontProvider === null`，命中 detach 的 no-provider 分支**清空整个集合** → 后挂载的渲染器把先挂载的 provider 挤出集合（调试日志里 `setSize` 恒为 1 暴露了它）。

**修复**：非空才 detach；`detach(null)` 只清全局指针不清集合。

### 根因 3：本地字体授权状态未同步（commit `f184b781`）

用户在设置面板授权后（浏览器权限持久化 granted），字体列表可读，但渲染仍失败——`fontManager.localFontAccessState` 每次加载重置为 `'prompt'`，`findLocalFont` 第一行就拦截返回 null，**本地字体（含 CJK 回退）永远不参与解析**。

**修复**：启动时 `navigator.permissions.query({name:'local-fonts'})`，已 granted 则静默 `requestLocalFontAccess()` 同步状态；权限变更时再同步（`src/app/editor/fonts/index.ts`）。

### 调试过程备注

- 关键手法：临时 console 日志打进 `renderText`/`loadFonts`（render 时 paragraph 0×0 vs 手动调 58 的矛盾是突破口）；`window.openPencil.getStore()` 探针；provider 同一性对比
- 陷阱：vite HMR 对 core 包的修改会整页重载且产生多版本模块实例（`?t=` 时间戳），中间态的报错会干扰判断；页面里 `import('/packages/...')` 拿到的是另一个 pristine 模块实例，不能用来读单例状态

## 4. 平台差异与 CORS 详录

### 4.1 Tauri vs Web 的字体机制

| | Tauri | Web |
|---|---|---|
| 系统字体 | `invoke('load_system_font')`，无沙箱 | `queryLocalFonts()`，仅 Chromium，需用户授权 |
| 在线字体 | unifont 正常（Rust 请求无 CORS） | 提供商 catalog 被 CORS 拦死（见 §4.3） |
| 内置字体 | Inter 系列 + NotoNaskhArabic（同源） | 同左 |

### 4.2 为什么 DOM 文字正常而画布不行

DOM 文本由浏览器内核排版（直接用系统字体，但**不向 JS 提供字体字节**）；CanvasKit 必须在 WASM 里用字体文件本身做 shaping。CSS `font-family` 只渲染、不给数据。

### 4.3 unifont 在浏览器里的死穴

unifont（unjs 的字体 CDN 统一访问库，本项目 `WebFontResolver` 的底座）的提供商初始化**必须先拉 catalog 元数据**：

```
fonts.google.com/metadata/fonts     ✗ CORS 不放行
api.fontsource.org/v1/fonts         ✗ CORS 不放行
→ 初始化失败（"Could not initialize provider"），fetchFont 返回空
```

但 Google 的另一组接口是放行的（实测 200 且可读）：

```
fonts.googleapis.com/css2?family=…&text=…   ✓ CORS 放行（且 text= 支持字符子集）
fonts.gstatic.com/*.woff2                   ✓ CORS 放行
```

即：**字体文件能下，只是 unifont 的"先读目录"路线在浏览器走不通**。目标字体已知时（如 CJK 回退用 Noto Sans SC）可以直连 css2。unifont 的 google provider 自带 `experimental.glyphs`（映射 `text=`），证明子集化是该链路正规用法。

## 5. 当前状态矩阵

| 内容 | web (Chromium) | web (非 Chromium) | Tauri |
|---|---|---|---|
| 拉丁文字（内置 Inter） | ✅ 已修 | ✅ 已修 | ✅ |
| 显式系统字体 | ✅ 已修（需设置面板授权一次） | ❌ API 缺失 | ✅ |
| Inter + CJK（回退到系统字体） | ✅ 已修（同上前提） | ❌ 待方案 A | ✅ |
| 在线字体提供商 | ❌ catalog 被 CORS 拦（面板显示"已启用"是误导） | 同左 | ✅ |

## 6. 遗留事项

1. **CJK 缺失的授权引导**：检测到 CJK 字形缺失且 local-fonts 未授权时，引导用户去设置面板点"允许"（比任何网络方案都优先，体验最好）
2. **方案 A：css2 子集抓取**（非 Chromium 的 CJK 兜底）：绕过 unifont catalog，直接 `css2?family=Noto+Sans+SC&text=<缺失字符>` → 解析 woff2 → 注册。下载量 KB 级、无需授权、不限浏览器
3. **方案 B（备选）**：内置 Noto Sans SC woff2 到 public/ 同源加载（几 MB，离线可用，与 Inter 内置同模式）
4. **设置面板修正**：在线字体提供商在 web 端实际不可用，"已启用"显示误导——应显示不可用原因或隐藏（`webFontProvidersRequireDesktopApp` 的提示只在字体列表场景触发，不够明显）
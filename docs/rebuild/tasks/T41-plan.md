<!--
  写作纪律（改本文前必读）：
  - 事实性声明必须附核验命令 + 日期，否则标为【假设】
  - 计划被实测推翻时，直接改本文为新版本，完整理由记入 records/ 子文档
  - 本文只保留当前态，不保留修正历史
  - 改完后刷新本文头部的「状态」字段
  - 详细规则见 docs/rebuild/05-process.md §4
-->

# T41 计划 · 可变字体支持 + 字体白名单可视化管理

> **状态**：✅ 已完成（C1-C9 全过，见 [T41-verify](T41-verify.md)） | **时间**：2026-08-30 立项，2026-08-30 收口 | **负责人**：主 agent
> **分支**：`rebuild/fonts`（基于 `b8b3332c` T40 收口后 HEAD）
> **规格真源**：owner /goal（2026-08-30，见 §1）；T39 D-b 挂起项由本任务收口

## 1. 背景与立项

owner /goal（2026-08-30 原文）：「继续优化字体相关产品能力，我希望：1、支持可变字体；2、字体白名单可以有一个设置面板进行可视化管理，可随时开关启用某款字体，且白名单管控范围覆盖系统字体在内的所有字体来源，bundle字体因作为了各处逻辑兜底选项则始终在白名单内不能关闭」

**现状接缝盘点**（2026-08-30 代码实测，`grep -n`/`cat` 核验）：

### 可变字体（VF）

- **数据面/排版面已部分就绪**：scene-graph 有 `FontVariation` 模型（`packages/scene-graph/src/types.ts:227-230,461` + `node-defaults.ts:109`）；FIG 导入/导出/roundtrip 完整（`packages/fig/src/node-change/font/variations.ts`，轴标签 wght=0x77676874，测试 `tests/engine/io/fig/{import,export}/font-variations.test.ts`）；排版已把 `node.fontVariations` 映射进 CanvasKit `TextStyle.fontVariations`（`packages/core/src/canvas/text/index.ts:288-293,395,488`）。canvaskit-wasm 0.41.1 类型定义含 `TextFontVariations`（`node_modules/canvaskit-wasm/types/index.d.ts:3260-3263,3285`）。
- **资源面硬排除 VF**：bundled 加载门禁 `!isVariableFont(buffer)`（`fonts.ts:367`）；local 门禁 `!options.allowVariable && isVariableFont(buffer)`（`fonts.ts:702`），唯一放行调用是 CJK 回退（`fonts.ts:498-500`）。`chooseLocalFontMatch` 显式 style 不就近降级（`font/style.ts:36`，严格契约）。
- **CanvasKit 注册期无轴参数**：`TypefaceFontProvider.registerFont(bytes, family)` 无 FontArguments/named-instance API（`index.d.ts:3306-3314`，全库 grep 零命中）——VF 字重渲染只能靠排版期 `TextStyle.fontVariations` 传 wght 轴值，可行性由 S1 探针实证。
- **字重全程整百量化**：`weightToStyle` `Math.round(weight/100)*100`（`scene-graph/src/font-style.ts:74`）；渲染侧 `fontStyle.weight.value = node.fontWeight` 直传原始数值（`canvas/text/index.ts:485`），任意字重渲染不依赖 style 量化。
- **FontFace 注册无区间字重**：`registerFontInBrowser` 只传单值 weight（`fonts.ts:846-851`）。
- **CDN 侧不识 VF 包**：`parseCnFontResultCSS` 对 `font-weight` 只 `parseInt` 单值（`cn-fonts.ts:135-137`），区间形态「250 900」会被截断为 250；syst（思源宋体 CN VF）因此被 T40 剔除注册表（`registry.ts:77-80`，D-b 挂起）。
- **syst 包结构实测**（2026-08-30，`curl https://cdn.jsdelivr.net/npm/@chinese-fonts/syst@3.0.0/dist/index.json` → `["SourceHanSerifCN"]`；result.css 头部注释 `FontFamilyName Source Han Serif CN VF` + OFL-1.1 授权段；`@font-face` 块 `font-weight:250 900` 区间形态 + `font-family:"Source Han Serif CN VF"`）：单目录、区间字重、OFL——补齐解析即可收录。

### 白名单可视化管理

- **现白名单是静态编译期表**：`FONT_REGISTRY`（`registry.ts:43`）+ `bundledAllowlist` 派生（`registry.ts:125-127`），只管 bundled 枚举/加载（`fonts.ts:361`），注释明言「用户本地系统字体不受限」（`registry.ts:6`）——owner 要求扩到全来源。
- **预留挂点**：`isProviderFamilyVisible`（`registry.ts:151`，恒 true）。
- **枚举单点**：`listFamilyOptions`（`fonts.ts:264-294`）依次合并 registry bundled/cdn + 在线 provider + local，每次调用重建无缓存——过滤加在出口即全消费点生效。
- **picker 一次性缓存暗坑**：`useFontPicker.ts:48-57` `loadFamilies` 有 `families.value.length > 0` 短路，无失效机制——运行时开关必须有刷新信号。
- **设置面板骨架现成**：`SettingsDialog.vue` nav + section 模式（`:62-155`），`SettingsSection` 联合型（`src/app/settings/dialog.ts:3`）；偏好持久化范式现成（`src/app/editor/fonts/index.ts:35-56` useLocalStorage + watch deep immediate 推送 fontManager）。
- **i18n 纪律**：T35 定案 fork seam（`src/app/i18n/fork/`，owned root，`forkI18n(domain, defaults)` + useStore 模式），新文案不进 `packages/vue` messages。

## 2. 决策点（本任务开工前拍板/默认项登记）

| # | 决策点 | 状态 | 取值 |
|---|---|---|---|
| D-a | VF 渲染机制 | ✅ 探针实证先行 | 排版期 `TextStyle.fontVariations` 注入 wght 轴值（注册期无 API 可用）。S1 探针实证：注册真实 VF 分片后 wght 250/900 渲染墨量显著差异才算可行；若证伪，回退 = 维持 D-b 挂起并在 self-check 记录，不强行上 |
| D-b | **VF 语义收口**（T39 D-b/T40 D-b2 挂起项） | ✅ owner 拍板放行 | VF 全链路放行。`chooseLocalFontMatch` 静态严格契约**不变**；VF 放宽落在 `findLocalFont` 内部：显式 style 无匹配时，同族斜体一致候选按字重距离序下载嗅探，fvar 命中即接受（VF 一族覆盖全字重）；静态字体无匹配仍返回 null |
| D-c | 白名单存储形态 | ✅ disabled 集合 | 存「被关停」清单（默认全启用，新装/新枚举到的字体自动启用），localStorage key `op-font-disabled-families:v1` |
| D-d | bundled 恒开实现 | ✅ 锁定 = registry source==='bundled' | core 拒绝 disable（`setFontFamilyEnabled` 对锁定族为 no-op 并告警）+ UI 开关 disabled 态标注「内置兜底不可关闭」；回退链专用族（fallbacks.ts）不在面板枚举面，不受影响 |
| D-e | 面板落点 | ✅ SettingsDialog 新分区 | 新增 `SettingsSection 'fonts'` + `FontsSettingsPanel.vue`（搜索 + 按来源分组 + 逐族开关）；字体族清单较长，FontSettingsPopover（w-80 窄浮层）不承载 |
| D-f | 面板 i18n | ✅ fork seam | `src/app/i18n/fork/` 新增 fonts 域（`forkI18n('fonts', …)`），遵 T35 纪律不动 packages/vue messages |
| D-g | 字重量化 | ✅ 不动 scene-graph | `weightToStyle` 维持整百量化；渲染直传 raw `fontWeight` + wght 轴注入，任意字重（如 650）渲染可用；VF 加载键量化碰撞无害（同族 VF 同二进制，重复键去重/记账可接受） |
| D-h | picker 刷新 | ✅ reload 信号 | `useFontPicker` 增 `reload()`（清缓存重拉，P111 扩）；`FontPicker.vue`（新 patch）watch 白名单 revision 调 reload |
| D-i | VF 家族标识 | ✅ fvar 嗅探 + 注册表标记双轨 | 加载期 `isVariableFont` 嗅探入账 `variableFontKeys`（运行时真值）；注册表条目加 `variable?: boolean`（面板展示/语义登记） |

## 3. 范围与修法

实施顺序：**探针先行**（渲染机制可行性是整条 VF 线的前提），再 core VF 资源面，再排版注入；白名单 core → 面板 UI 随后。

### S1 CanvasKit VF 探针（workbench/，owned root）

- 新建 `workbench/probe-variable-font.mjs`：bun 跑 canvaskit-wasm 0.41.1，`MakeFromFontProvider` + `TypefaceFontProvider.Make()`；下载 syst 真实分片（解析 result.css 选覆盖 U+4E2D「中」与 U+0041「A」的片），registerFont 后分别以 `fontVariations:[{axis:'wght',value:250}]` / `900` 排版绘制到 surface，readPixels 统计墨量（非背景像素数）。
- **验收锚**：墨量（900）> 墨量（250）× 1.2 且对照组（仅 fontStyle.weight 不传 fontVariations）无显著差异 → 机制可行，D-a 成立。
- 探针发现记入 self-check §3。

### S2 core VF 资源面放行 + CDN VF 包支持

- 新建 `packages/core/src/text/font/variable.ts`（owned）：`variableFontWeightRange(data): { min, max } | null`——sfnt 表目录定位 fvar，解析 axis 数组找 'wght' 轴 min/max（F16.16 定点）；防御截断/畸形数据全程不 throw。
- patch `fonts.ts`（P113 扩）：
  - 放行：bundled 门禁（`:367`）删 `!isVariableFont` 排除；local 门禁（`:702`）默认放行 VF（`allowVariable` 选项退役，CJK 回退调用点同步清理）；
  - `findLocalFont` VF 放宽（D-b）：显式 style `chooseLocalFontMatch` 未命中时，同族 + 斜体一致候选按字重距离升序逐个 `blob()` 嗅探，首个 fvar 命中者即返回；全程 try/catch 不 throw；
  - VF 跟踪：`variableFontKeys: Set<'Family|Style'>` 在 `registerAndCache`/`loadCnFontSubset` 入账时嗅探登记，`evictFontKey` 清理；公开 `isVariableFamily(family): boolean` 与 `variableWeightRange(family): {min,max}|null`（首个 VF 键的 fvar 区间，clamp 用）；
  - `registerFontInBrowser`：VF buffer 的 FontFace descriptors 传字重区间 `weight: '250 900'`（fvar 实读），静态字体行为不变。
- patch `font/registry.ts`（owned 扩展）：`FontRegistryEntry` 加 `variable?: boolean`；**syst 回注册表**——`{ family: 'Source Han Serif CN VF', tier: 'T0', license: 'OFL-1.1', source: 'cdn', variable: true, weights: [], cdn: { package: '@chinese-fonts/syst' } }`（包结构 2026-08-30 实测，见 §1）；D-b 剔除注释更新为收口说明。
- patch `web-font/cn-fonts.ts`（owned 扩展）：`CnFontFacePiece` 加 `weightMax?`；`parseCnFontResultCSS` 支持「250 900」区间双值；`selectCnFontPieces` 字重匹配改区间包含（`piece.weight <= w <= (weightMax ?? piece.weight)`）。`pickCnFontSubfamily` 单目录兜底已覆盖 syst 形态，不改。

### S3 排版期 wght 轴自动注入（canvas/text，P119 扩）

- `canvas/text/index.ts`：新增内部 helper——family 经 `fontManager.isVariableFamily` 判定为 VF 且调用方未显式给 wght 轴时，合流 `{ axis:'wght', value: clamp(fontWeight, min, max) }`（min/max 取 `variableWeightRange`，缺省不 clamp）；应用于 paraStyle 节点级（`:488`）与 pushStyleRun run 级（`:395`）；显式 `node.fontVariations`/`run.style.fontVariations` 优先（FIG 导入文件语义不被覆盖）。
- **不引入新缓存键维度**：variations 已随 node 数据进 textPicture 缓存失效链（fontVariations 是 node 字段，变更走正常 dirty）。

### S4 core 白名单运行时管控

- 新建 `packages/core/src/text/font/allowlist.ts`（owned）：`FontFamilyAllowlist`——disabled 集合（normalizeFontFamily 归一键）+ `isLocked(family)`（= registry source==='bundled'，D-d）+ `setEnabled(family, enabled)`（锁定族 no-op + console.warn）+ `replaceDisabled(iterable)` + `revision` 计数（picker 失效信号）。fonts.ts 行数已 867/600 告警线上，状态机独立成文件。
- patch `fonts.ts`（P113 扩，接线）：`setDisabledFontFamilies`/`setFontFamilyEnabled`/`isFontFamilyEnabled`/`isFontFamilyLocked`/`fontAllowlistRevision` 委托 allowlist；**三处加载门禁**：`loadFont`/`loadLocalFont`/`loadRemoteFont` 入口 disabled → null（resolver 各候选与直接调用全覆盖）；`ensureFallbackFamilies` local 循环跳过 disabled 族；`listFamilyOptions` 出口过滤 disabled（bundled 锁定族恒过）。
- patch `font/registry.ts`（owned 扩展）：`isProviderFamilyVisible` 注释更新——运行时管控由 FontManager allowlist 承担，本挂点保持编译期语义。

### S5 设置面板 + 持久化 + picker 刷新（app/UI）

- patch `src/app/editor/fonts/index.ts`（P117 扩）：`disabledFontFamilies = useLocalStorage<string[]>('op-font-disabled-families:v1', [])` + watch（deep immediate）→ `fontManager.setDisabledFontFamilies`；导出 `fontListRevision` ref（watch 内同步 `fontManager.fontAllowlistRevision()`）供 picker 失效。
- patch `src/app/settings/dialog.ts`（P45 扩）：`SettingsSection` 加 `'fonts'`。
- patch `src/components/settings/SettingsDialog.vue`（P44 扩）：nav 加字体分区按钮（icon-lucide-type）+ 面板渲染分支。
- 新建 `src/components/settings/fonts/FontsSettingsPanel.vue`（owned）：搜索框；`listFamilies()` 全量族按 source 分组（bundled/cdn/provider 各 source/local）带徽标；每族 AppSwitch；bundled 锁定族开关 disabled + 锁定说明；local 源在权限未授予时展示引导（复用 `requestLocalFontAccess` 范式）；启停计数摘要。
- patch `packages/vue/src/primitives/FontPicker/useFontPicker.ts`（P111 扩）：对外暴露 `reload()`（清 families 重新 `loadFamilies`）。
- patch `src/components/font-picker/FontPicker.vue`（新 patch P12x）：watch `fontListRevision` → 调 `reload()`。
- fork i18n（owned）：`src/app/i18n/fork/` 加 fonts 域消息（en + zh-CN）与 hook，面板消费。

### S6 单测（tests/engine/text/fonts/，owned）

- 新建 `variable-fonts.test.ts`：`variableFontWeightRange`（合成 sfnt+fvar buffer：wght 区间读出/无 fvar null/截断不 throw）；`findLocalFont` VF 放宽（mock queryLocalFonts：静态严格契约不变 / VF 任意字重接受 / 斜体一致约束 / fvar 嗅探失败回 null）；FontManager VF 入账（`isVariableFamily`/`variableWeightRange`/evict 清理/FontFace 区间 descriptors——mock FontFace）；CDN VF 片入账跟踪。
- 扩展 `cn-fonts.test.ts`（owned）：区间 font-weight 解析；区间包含选片；syst 形态端到端（mock fetcher：index.json 单目录 + 区间 css）。
- 新建 `allowlist.test.ts`：disabled 族在 `listFamilyOptions` 四来源（bundled 锁定恒在/cdn/provider/local）全隐藏；`loadFont`/`loadLocalFont`/`loadRemoteFont` disabled → null；bundled 锁定拒 disable；re-enable 恢复；fallback local 循环跳过 disabled；revision 单调增。
- S3 注入用例：按 text-font-variations 现有测试形态（`tests/engine/render/canvas/text-font-variations.test.ts`，zones 归属实施时核验，非 owned 则新建 owned 文件）补 wght 自动注入/显式优先/clamp。

### S7 收口：门禁 + 基线 + 浏览器实证 + 三件套

- 全门禁：check:zones / lint（0 error）/ tsgo / format:check（oxfmt）/ check:docs / check:bindings / check:tasks。
- `test:unit:quick` 对照 T40 定谳基线（78 fail/2600），失败数不增、diff 仅已登记 flake。
- Playwright 实证（不用 zcode 内置浏览器）：
  - VF：画布建两个文本节点（family 'Source Han Serif CN VF'，同文案，fontWeight 250 vs 900），CDN 子集加载后截图——两字重渲染形态肉眼可辨（粗细/墨量差异），存 `doc/`（仓外，遵 owner 纪律）；
  - 白名单：打开 Settings → Fonts 分区 → 关停一款 CDN 家族 → 字体选择器不再列出 → 重开恢复；bundled 族开关为禁用态。

## 4. 验收标准

| # | 标准 | 验证方式 |
|---|---|---|
| C1 | S1 探针实证：注册期 VF + 排版期 wght 轴注入在 canvaskit-wasm 0.41.1 产生可测量渲染差异 | 探针输出墨量数字 |
| C2 | VF 资源面单测全过（fvar 解析 / local VF 放宽 / bundled 放行 / 入账跟踪 / FontFace 区间） | `variable-fonts.test.ts` |
| C3 | CDN VF 包（syst 形态）解析选片单测全过 + syst 回注册表 | `cn-fonts.test.ts` 扩展 + registry 用例 |
| C4 | wght 轴自动注入：VF 家族未显式 variations 时按 fontWeight 注入（含 clamp），显式 variations 优先 | 渲染层单测 |
| C5 | 白名单管控单测全过：全来源枚举过滤 + 加载门禁 + bundled 恒开 + re-enable 恢复 + fallback 跳过 | `allowlist.test.ts` |
| C6 | 面板可用：Settings → Fonts 分区列出全部来源家族、逐族开关、bundled 锁定标注；picker 随开关即时刷新（reload 信号） | Playwright 实证 + 截图 |
| C7 | VF 浏览器实证：syst CDN 家族两字重渲染差异截图入 `doc/` | Playwright 实证 |
| C8 | 全门禁绿 + `test:unit:quick` 对照 T40 基线（78 fail/2600）零回归 | 门禁 + 基线对照 |
| C9 | 三件套齐 + tracker/_index 登记 + zones P12x 全登记 | check:tasks / check:zones |

## 5. 不做（out of scope）

- VF 家族任意字重的属性面板控件（字重滑杆/数值输入）——渲染面本任务打通，控件是独立 UX 增强。
- SVG/PDF 导出字体嵌入、设计文件字体子集内嵌（T40 收口问答揭示的「字体随文档走」缺口，独立任务）。
- unifont provider 链改造；Tauri 侧 piece 级缓存（T40 已推延）。
- 字重 style 名量化体系重构（D-g 明确不动）。
- push/LFS 托管（D-e 推延决策不变）。

## 6. 风险与回退

| 风险 | 缓解 |
|---|---|
| S1 探针证伪（0.41.1 fontVariations 对注册期 VF 不生效） | D-a 预设回退：VF 线中止，维持 T40 边界，探针证据入 self-check；白名单线不受影响继续 |
| VF 同族多字重键记账放大（同一二进制每个 style 键各计一次字节） | 50MB 预算 + LRU 逐出兜底（T40 S1 机制）；self-check 记录在案，后续可做同 buffer 跨键去重记账 |
| 白名单关停正在使用的字体致在屏文字缺失 | 语义 = 「视为未安装」：走既有 missing font UX（TypographySection 提示 + FontStatusBanner）+ 回退链兜底；面板提供即时重开 |
| picker 外其他 listFamilies 消费点（automation 桥）未见失效 | `listFamilyOptions` 每次调用重建（fonts.ts:264-294 无缓存），消费方下次调用自然生效；一次性缓存仅 picker 一处（D-h） |
| local VF 放宽引入额外 blob() 下载（每候选一次） | 仅显式 style 未命中时触发；按字重距离升序首中即停；会话内 loadedFamilies 去重 |
| fonts.ts 行数继续增长（867 行） | 白名单状态机与 VF 解析分别落 owned 新文件（allowlist.ts / variable.ts），fonts.ts 只接线 |

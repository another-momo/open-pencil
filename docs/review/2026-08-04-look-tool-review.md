# `look` 工具 review（2026-08-04，2026-08-05 纠正版）

> 评审对象：`packages/core/src/tools/marketing/look.ts`（视觉回路 `look` 工具），以及其前端凭证链路 `src/app/ai/marketing/settings.ts` + `src/components/settings/provider/VisionKeysSection.vue` + `src/components/settings/provider/context.ts`。
> 上游设计：`docs/plans/architecture/l2-visual-loop.md`、前置评审 `docs/review/2026-07-29-visual-loop-implementation-review.md`、`docs/review/2026-08-01-marketing-workbench-branch-review.md` §3.3。
> 本评审分两部分：**第一部分** 是 `look` 工具本身的设计与契约评审（静态代码走查，含与 `vision.ts`、registry、ai-adapter 的交互）。**第二部分** 针对 2026-08-04 用户实测暴露的"通道 B 无论怎么配置都报 `credentials are incomplete`"做专项调查。
> **2026-08-05 纠正版说明**：原版（2026-08-04）中三处判断在重核后做了修订——
>
> - **C1 撤回**：经重读控制流，原"minFontSize undefined 注入 NaN"的 bug 走不到 `minTextPx = NaN` 路径，`addTextLegibilityNote` 第 71 行 `if (minFontSize === undefined) return` 已经截断。不存在这条 bug。
> - **C2 / C3 严重度下调**：均从 Critical 改为 Major。是真实问题但达不到"会改变主流程行为"的门槛。
> - **Part 2 根因 1 收紧措辞**：原"极可能是首要嫌疑"过满。浏览器事件序列里 blur → change 先于 click 派发，绝大多数用户流程下 `save()` 会跑，丢失写入只发生在用户未完成标准 blur-then-Done 序列的边缘 case。
>
> 完整纠正明细见文末 §十「2026-08-05 核实与纠正日志」。

---

## 第一部分：`look` 工具设计 review

### 一、总体判断

`look` 的核心契约（exportImage → JPEG → note + base64 → 主模型看图；通道 B 走独立视觉模型返回文字）是稳的，已经过 2026-07-29 评审验证。问题集中在契约边界、错误反馈、缓存语义、note 文案、aspect-ratio 提示缺失，以及 result 形状不规范五类。

**2026-08-05 重核更新**：原首版列出的 Critical 段三处（C1 NaN px、C2 imageHash、C3 locked direction）经过重新走查后全部撤回或降级——C1 是控制流误读（实际有早返回 guard），C2/C3 不达 Critical 门槛。当前 Critical 段为空：经过对每一处原结论的逐行复核，**没有任何会被验证为"会改变主流程行为"的问题**。剩下 Major 段的两条降级条目与原 M1-M7 并列，作为本评审的真正 actionable 清单。详见 §十 1.1-1.3。

### 二、按严重度分级的发现

> **2026-08-05 纠正**：原 Critical 段三处全部撤回或降级。详见 §十。当前 Critical 段为空，本节 Major 起算。

#### 🟠 Major（设计缺陷，会反复咬人）

> **旧 C1 / C2 / C3 重核后定位**：
>
> - **C1**（`~NaNpx` 注入）：**bug 不存在**，控制流已在 `addTextLegibilityNote` 入口截断。详见 §十 1.1。
> - **C2**（imageHash 跨重启失效）：是真实问题，但属**性能/契约偏离**，不是"会改变主流程行为"。降为 Major。详见 §十 1.2。
> - **C3**（hardcoded "locked direction"）：是真实 UX/契约污染，但不会让用户看到 error。降为 Major。详见 §十 1.3。

**M-cache-key**（原 Critical C2，降级）通道 B 缓存 key（`imageHash`）在 `.fig` 往返后会变成永久 miss——[vision.ts:186-206](packages/core/src/tools/marketing/vision.ts#L186-L206) + [look.ts:107-117](packages/core/src/tools/marketing/look.ts#L107-L117)

`materialDescriptions` 是 `WeakMap<SceneGraph, Map<imageHash, string>>`，key 是 fill 上的字符串字段 `imageHash`，**不是内容哈希**。

1. `.fig` 序列化 → 反序列化后 Figma 通常会重新生成 `imageHash`，重启后所有缓存全部蒸发，每次都重新跑视觉模型——重启一次素材理解就重跑一遍，与 [vision.ts:1-13](packages/core/src/tools/marketing/vision.ts#L1-L13) 自述的"重复理解零成本"承诺不符。
2. 当前进程内热路径仍是正确的，bug 是"跨重启失效"，**不破坏数据正确性，仅性能与契约偏离**——故从 Critical 降为 Major。

**修复（短期）**：把缓存持久化到文档 pluginData（不污染 canvas），key 升到 `sha256(bytes)`（cache miss 时回填）；同时把 `imageHashOf` 的 `fills.find` 改为多 fill 复合 key（见后文 M4）。**修复（中期）**：把缓存迁移到上游 model profiles / credential store 一并做（见 fork-divergence.md D1）。

**M-locked-direction**（原 Critical C3，降级）通道 A 的"locked direction"是凭空假设的工作流状态——[look.ts:192-194](packages/core/src/tools/marketing/look.ts#L192-L194)

```ts
noteParts.push(
  'Judge against the locked direction and section plan. Observations are advisory — confirm structural or readonly concerns with validate.'
)
```

此句被无条件追加，但 tool description、registry、其他文件都**未定义**"locked direction / section plan"。后果：

1. initial setup 阶段（`setup_material_type` 还没跑）调 `look`，主模型在没有 brand guide 的语境里被引导"对照 locked direction"——会编。
2. 通道 B 视觉模型 prompt 里**没有这句**（[look.ts:129-133](packages/core/src/tools/marketing/look.ts#L129-L133)），所以同一张图、两个通道、两个模型看到的 prompt 语义不一致。

**不阻塞工具主流程，也不在用户错误消息里出现**——是 UX/契约污染，故从 Critical 降为 Major。

**修复**：要么删除，要么参数化 `reference?: 'plan' | 'neutral'` 由调用方传入；并同步进通道 B prompt。

**M1** 极长宽比下 layout/比例可信度也崩了，但 legibility note 只提醒文字——[look.ts:64-86](packages/core/src/tools/marketing/look.ts#L64-L86) + [look.ts:172](packages/core/src/tools/marketing/look.ts#L172)

**M1** 极长宽比下 layout/比例可信度也崩了，但 legibility note 只提醒文字——[look.ts:64-86](packages/core/src/tools/marketing/look.ts#L64-L86) + [look.ts:172](packages/core/src/tools/marketing/look.ts#L172)

`scale = clamp(0.1, 1, 1024/longEdge)` 把 `750×20000` 设计压到 `0.1`，导出为 `75×2000`。短边 75px，**结构比例、视觉重心、对称性都判不准**，但 note 只说"文字 ~X px 不可读"，没提 layout 也不可信。这与 [l2-visual-loop.md §4](docs/plans/architecture/l2-visual-loop.md) "可判断结构比例/视觉重心/色彩分布"的承诺不一致。

**修复**：

```ts
if (node.width > 4 * node.height || node.height > 4 * node.width) {
  noteParts.push('Aspect ratio distorted at this scale — judge colors and presence, not proportions.')
}
```

**M2** drill-target 只列直接子节点，深嵌套时让 agent 多走 N 次——[look.ts:77-84](packages/core/src/tools/marketing/look.ts#L77-L84)

```ts
const drillTargets = graph
  .getChildren(targetId)
  .filter((child) => child.childIds.length > 0 || child.type === 'TEXT')
```

只展开一层。真实营销设计里文字常藏在 `Hero/Section/Card/Title` 四五层之下，note 列第一层后模型又 `look` 拿第二层 id，递归放大 token。

**修复**：深度受限（depth 2-3）的 TEXT-only 列表 + 截断到 5 条：

```ts
const drillTargets = collectDrillTargets(graph, targetId, { maxDepth: 2, maxCount: 5 })
```

**M3** 通道 B 的 cache 只对带 IMAGE fill 的节点生效——`look` 真正高频场景是 section/layout 检查——[look.ts:105-117](packages/core/src/tools/marketing/tools/marketing/look.ts#L105-L117)

```ts
const imageHash = node ? imageHashOf(node) : undefined
if (imageHash) { /* cache check */ }
// 没命中或没 imageHash → 必跑 vision
```

非 IMAGE 节点的 lookup 永远 miss cache，每次都走 60s vision call。设计师对同一 section 反复 look（layout 微调后验收），每个 revision 都触发 vision 推理。

**修复**：by `(imageHash | nodeId, focus)`：

- IMAGE fill：by imageHash（与现在一致）
- 非 IMAGE：by `(nodeId, focus)`（同节点同意图的二次 look 跳过 vision）

**M4** `imageHashOf` 只取第一个 IMAGE fill，复杂合成节点会错命中——[look.ts:39-41](packages/core/src/tools/marketing/look.ts#L39-L41)

```ts
function imageHashOf(node: SceneNode): string | undefined {
  return node.fills.find((fill) => fill.imageHash)?.imageHash
}
```

带多个 IMAGE fill 的节点只看第一个。两个不同叠层组合的节点一旦共享第一个 fill 就被视为同一种"素材"，description 错配。

**修复**：复合 key：`(node.fills.filter(f => f.imageHash).map(f => f.imageHash).sort()).join('|')`，并显式断言 `fill.type === 'IMAGE'`。

**M5** Channel A/B 结果 shape 不规整，adapter 层必须双向兼容——[ai-adapter.ts:142-158](packages/core/src/tools/ai-adapter.ts#L142-L158)

- Channel A ok：`{ base64, mimeType, byteLength, node, focus?, note }` —— 命中 `toModelOutput`
- Channel B uncached：`{ analysis, cached: false, node, focus?, note }` —— 走 JSON 路径
- Channel B cached：`{ analysis, cached: true, node, focus?, note }` —— 走 JSON 路径
- 错误：`{ error: ... }`

`isMediaToolOutput` 只判 `base64 + mimeType` 存在性，**任何 adapter / 日志 / MCP 序列化层都得自己识别这四种形态**。

**修复**：

```ts
type LookResult =
  | { channel: 'A'; base64: string; mimeType: string; byteLength: number; node: ...; focus?: string; note: string }
  | { channel: 'B'; analysis: string; cached: boolean; node: ...; focus?: string; note: string }
  | { error: string }
```

显式带 `channel: 'A' | 'B'`，调用方不用靠有没有 `base64` 推断。

**M6** `resolveTargetId` 在 latest-state 失效时，把 alive 但非 latest 的设计埋没——[look.ts:43-62](packages/core/src/tools/marketing/look.ts#L43-L62) + [registry.ts:75-86](packages/core/src/tools/marketing/registry.ts#L75-L86)

参见现有测试 `'multiple marketing designs with a stale active root require an explicit id'`：两个 design（A 活、B 节点被删），latest=B 失效，`getMarketingState` 返回 undefined，`listMarketingDesigns` 返回 2 条，error 报"Multiple marketing designs"。**A 是唯一可用设计，但用户要手动选**。

**修复**：在 error message 中标出 alive 与 stale：

```ts
const candidates = designs.map(d =>
  graph.getNode(d.rootFrameId)
    ? `${d.rootFrameId} (${d.materialTypeId}, live)`
    : `${d.rootFrameId} (${d.materialTypeId}, root deleted)`
)
```

**M7** Channel B 的 vision-prompt 与 Channel A 主模型看到的 note 语义分裂——[look.ts:129-133](packages/core/src/tools/marketing/look.ts#L129-L133) vs [look.ts:192-194](packages/core/src/tools/marketing/look.ts#L192-L194)

Channel A 抛给主模型："Judge against the locked direction and section plan. Observations are advisory — confirm structural or readonly concerns with validate."

Channel B 抛给视觉模型："You are the vision subsystem of a design agent. Analyze this design screenshot factually and answer concisely."

同一张图两条通道触发的判断框架不同。视觉模型不知道"advisory"，返回会比主模型自己看图更自信——与 vision 模块自述的"secondary judgment"角色不一致。

**修复**：vision prompt 也并入 advisory framing：

```
You are giving an advisory visual analysis. Do NOT declare structural or readonly
violations; flag them as "candidates worth confirming with validate".
```

#### 🟡 Minor / 🟦 Documentation（清洁度与一致性）

- **m1** `figma.exportImage?.()` 可选链冗余——[look.ts:119](packages/core/src/tools/marketing/look.ts#L119) 与 [look.ts:185](packages/core/src/tools/marketing/look.ts#L185) 不一致（执行开头已 guard）。
- **m2** `drill-target` 不限长度，单大设计 note 膨胀，建议截断 + "...and N more, look specific ids"。
- **m3** `minFontSizeInSubtree` 第一次遇到 undefined fontSize 就把 min 设成 undefined，应该 continue 而不替换。
- **m4** `imageHashOf` 没有显式判断 `fill.type === 'IMAGE'`，误识别风险。
- **m5** `noteParts` 在通道 A/B 间重复拼接，应抽 `buildVisionPrompt(noteParts)` + `buildMainNote(noteParts, cached?)`。
- **m6** `analyzeViaVisionChannel` 错误返回结构与其他通道不一致，缺 `note / node / focus`。
- **m7** 通道 B vision 60s 超时对长图风险大，没有 retry / partial-response handling；视觉 provider 慢返回 → 60s 后 throw → adapter 包成 `{ error }`，没有"换通道"的提示。
- **m8** `drill-target` 用的 `name` 没有去前后空白和长度，可能出现 `0:7 ()` 或 `0:7 (60 字 section 名字)`。
- **m9** 测试覆盖缺口：`focus` 在 Channel A 下的 note 拼接；Channel B 非 IMAGE 节点不命中 cache；visionAPI 抛错；exportImage 返回 null；极长宽比下 note 的 aspect-ratio 提示；`fontSize=undefined` 的 NaN 回归。
- **D1** Tool description 过长且夹带 cross-tool workflow 解释。
- **D2** `vision.ts:1-13` 自述"图片不进上下文"是字面意义，但 look.ts 的 docstring / tool description 没有把这条对调用方契约稳定化；建议显式声明。

### 三、相关 issue 引用

- 上游评审已经识别 vision.ts 单例债：[2026-07-29-visual-loop-implementation-review.md](2026-07-29-visual-loop-implementation-review.md)、[2026-08-01-marketing-workbench-branch-review.md](2026-08-01-marketing-workbench-branch-review.md) §3.3 提到"vision 凭证体系应该走 createAIModelRuntime('vision')"+ "vision.ts 模块级可变单例跨 graph 共享"。
- fork 已经自承改：[fork-divergence.md D1](docs/plans/architecture/fork-divergence.md) 写到把 vision 凭证迁移到上游 model profiles，能删 `~200 行 + 1 个组件`。`look` 工具的第一部分 bug 都与这套凭证体系无关，但**第二部分的 channel B bug 全是这套体系造成的**。

---

## 第二部分：通道 B "无论怎么配置都报未配置" bug 专项

### 四、现象

用户报告：把设置面板里"Vision mode"切到 B，API Key / Base URL / Model 三个字段全部填好，依然报：

```
Vision channel B is selected but credentials are incomplete — set vision API key,
base URL, and model in AI settings, or switch the vision mode back to A
```

即 `isVisionChannelBReady()` 持续返回 `false`。

### 五、调用链梳理

#### 五.1 全链路

```
VisionKeysSection.vue   →   context.ts (save / clearVisionKey / inputs)
        │
        ▼
marketing/settings.ts   (useLocalStorage refs; registerMarketingSettingsEffects 注册 watcher)
        │
        ▼  setVisionCredentials / setVisionMode / setVisionProvider
core/tools/marketing/vision.ts  (模块级 let visionKey / visionBaseURL / visionModel)
        │
        ▼  isVisionChannelBReady()
core/tools/marketing/look.ts:99  (analyzeViaVisionChannel 早返回 error)
```

#### 五.2 关键文件索引

| 文件 | 关键符号 |
|---|---|
| [src/components/settings/provider/VisionKeysSection.vue](src/components/settings/provider/VisionKeysSection.vue) | `onModeChange` (`:10-13`)、三个 `<ProviderSettingsKeyField>` 全部 `@change="ctx.save"`、全部 `@clear="ctx.clearVisionKey"` |
| [src/components/settings/provider/context.ts](src/components/settings/provider/context.ts) | `save()` (`:51-74`)、`clearVisionKey()` (`:82-86`)、locals: `visionKeyInput / visionBaseURLInput / visionModelInput` (`:39-41`) |
| [src/app/ai/marketing/settings.ts](src/app/ai/marketing/settings.ts) | `visionMode / visionProvider / visionApiKey / visionBaseURL / visionModel` (`:42-49`)、`registerMarketingSettingsEffects` (`:107-141`) |
| [packages/core/src/tools/marketing/vision.ts](packages/core/src/tools/marketing/vision.ts) | 模块级 `visionKey / visionBaseURL / visionModel / visionMode / visionProvider` (`:22-26`)、`setVisionCredentials / isVisionChannelBReady / analyzeViaOpenAICompatible / analyzeViaAnthropicCompatible` |
| [packages/core/src/tools/marketing/look.ts](packages/core/src/tools/marketing/look.ts) | `analyzeViaVisionChannel` (`:88-143`) 早返回 (`:99-104`) |

#### 五.3 模块实例唯一性检查

UI 侧（settings.ts / context.ts / VisionKeysSection.vue）与 runtime 侧（look.ts）都通过 `'@open-pencil/core/tools'` 导入 `setVisionCredentials` / `isVisionChannelBReady`，Vite 在 dev/prod 都做模块实例去重，**两边共享同一个 `vision.ts` 模块**。模块级 let 变量会被读写一致。

### 六、根因清单（按 2026-08-05 重核后的"对用户症状的命中度"排序，措辞较首版收紧）

> **首版措辞回顾**：原版根因 1 写为"首要嫌疑"——是过激判断。重核后，浏览器事件序列（`mousedown → blur → change → mouseup → click`）下，typing-then-click-Done 的标准路径中 `change` 会同步派发先于 click，watcher 与 dialog close 都在同一 microtask drain 中消费，绝大多数用户流程下 `save()` 是会跑的。**这条根因只在用户未完成标准 blur-then-Done 序列时触发**——属于 high-frequency 在边缘 case 路径下，不应再标"首要嫌疑"。

#### 根因 1（边缘 case 路径，**非首要**）：`save()` 依赖 `@change` 事件，特定输入序列下会跳过写入

[context.ts:51-74](src/components/settings/provider/context.ts#L51-L74)：

```ts
async function save() {
  if (imageGenKeyInput.value.trim()) { ... }
  if (imageGenBaseURLInput.value.trim()) { ... }
  if (imageGenModelInput.value.trim())   { ... }
  if (visionKeyInput.value.trim()) {
    visionApiKey.value = visionKeyInput.value.trim()
    hasExistingVisionKey.value = true
    visionKeyInput.value = ''
  }
  if (visionBaseURLInput.value.trim()) {
    visionBaseURL.value = visionBaseURLInput.value.trim()
  }
  if (visionModelInput.value.trim()) {
    visionModel.value = visionModelInput.value.trim()
  }
}
```

[VisionKeysSection.vue:50-115](src/components/settings/provider/VisionKeysSection.vue#L50-L115)：

```vue
<ProviderSettingsKeyField v-model="ctx.visionKeyInput"    @clear="ctx.clearVisionKey" @change="ctx.save" />
<ProviderSettingsKeyField v-model="ctx.visionBaseURLInput" @clear="ctx.clearVisionKey" @change="ctx.save" />
<ProviderSettingsKeyField v-model="ctx.visionModelInput"   @clear="ctx.clearVisionKey" @change="ctx.save" />
```

`@change` 监听原生 `<input @change>`，**只在 input 失焦时触发**。

**会真正命中的边缘场景**：

1. 用户在 vision key input 内输入完直接按 **Enter**（type=text，Enter 不触发 blur/change），随后立即按 **Esc** 关 dialog → change 从未 fire → save 没跑 → storage 一字未写。
2. **最后一个字段**（`visionModelInput`）用户键入后没点过别处，直接按"完成"——理论上 Done 的 mousedown 会触发 blur → change → save，但若 reka-ui 的 DialogClose 链路有 `preventDefault()` 跳过默认 blur 行为（未实测各环境），就漏掉 change。
3. **key 字段永远有"清空但显示已保存"的 UI 陷阱**（见根因 6 / 新增条目 §十 2）：`hasExistingVisionKey` 显示 ✓ 时 input 仍然空，用户极易**忘填 key**——但 storage 又是上次留下的非空值，watcher fire 时也是上次值，看上去一切正常直到用户重置/清空 key。

**修复**（仍推荐立刻落地，把"是否触发"换成"必然触发"）：

```ts
// context.ts
watch([visionKeyInput, visionBaseURLInput, visionModelInput], () => save())

async function save() {
  if (visionKeyInput.value.trim()) {
    visionApiKey.value = visionKeyInput.value.trim()
    visionKeyInput.value = ''
    hasExistingVisionKey.value = true
  }
  // baseURL / model 留空也允许覆盖（反映用户清空意图）
  visionBaseURL.value = visionBaseURLInput.value.trim()
  visionModel.value   = visionModelInput.value.trim()
}
```

如果担心密钥频繁写 localStorage，加 `debounce(visionKeyInput, 300)`。

#### 根因 2：三个字段的"清除"按钮全部清掉了同一个 key

[VisionKeysSection.vue:57 / 80 / 103](src/components/settings/provider/VisionKeysSection.vue)：

```vue
<!-- 三个字段都写了 @clear="ctx.clearVisionKey" -->
```

[context.ts:82-86](src/components/settings/provider/context.ts#L82-L86)：

```ts
function clearVisionKey() {
  visionApiKey.value = ''      // 只清 API key
  visionKeyInput.value = ''
  hasExistingVisionKey.value = false
}
```

在 baseURL / model 字段上点 X → 期望清掉那个字段 → 实际**API key 被擦除**，watcher fire → `setVisionCredentials(null, baseURL, model)` → key 变 null → `isVisionChannelBReady()` 返 false。

**修复**：

```ts
function clearVisionKey()     { visionApiKey.value = '';    visionKeyInput.value = '';    hasExistingVisionKey.value = false }
function clearVisionBaseURL() { visionBaseURL.value = '';   visionBaseURLInput.value = '' }
function clearVisionModel()   { visionModel.value   = '';   visionModelInput.value   = '' }
```

并把三个字段的 `@clear` 分别绑到对应函数。

#### 根因 3：`save()` 的 `trim()` + if 守卫会吞合法"想清空"操作

同上 `save()`：

- baseURL/model 是 `if (xxxInput.value.trim())` — 空串被跳过，**旧 storage 值不动**。用户在某个 dialog session 中 backspace 把 baseURL 清空，期望回退到"未配置 baseURL"，结果旧值仍在。
- 同理 model。

**短期修复**：baseURL / model 改成无条件覆盖（已经在根因 1 的 patch 中合并）。

#### 根因 4（用法预期）：`visionMode` 切换立刻暴露 B 模式，但字段未填到位

[VisionKeysSection.vue:10-13](src/components/settings/provider/VisionKeysSection.vue#L10-L13) `onModeChange` 切到 B 时只 fire `setVisionMode('B')`。`isVisionChannelBReady()` 立刻变 false（缺三字段），用户在 chat 端一调 `look` 就报"credentials are incomplete"。

**短期修复**：dialog 内放一个就近提示："需配置 API Key / Base URL / Model 才能用通道 B"；B 模式字段空时禁用"完成"并把焦点给到第一个空字段。中期把这一逻辑提到 model profiles 体系里做（fork-divergence D1）。

#### 根因 5（理论）：`useLocalStorage` 默认 raw string 序列化

[settings.ts:47-49](src/app/ai/marketing/settings.ts#L47-L49)：

```ts
export const visionApiKey = useLocalStorage(`${STORAGE_PREFIX}vision-api-key`, '')
```

DevTools 误改 / JSON 非法时 fallback 到 `''`，watcher 第一次 fire 是空 → 覆盖掉上一次正确配置。生产用户不应撞到，dev 时偶发，落到 fork-divergence D1 一并改。

#### 根因 6（新增，2026-08-05 重核时漏掉 → 现在补回）：`hasExistingVisionKey` UI 陷阱与 baseURL/model 的 prefilled 语义不对称

[context.ts:39-42](src/components/settings/provider/context.ts#L39-L42)：

```ts
const visionKeyInput = ref('')
const visionBaseURLInput = ref(visionBaseURL.value)
const visionModelInput = ref(visionModel.value)
const hasExistingVisionKey = ref(!!visionApiKey.value)
```

三个输入字段在 dialog mount 时初始化策略不一致：

- **API key 字段**：永远初始化为空字符串。`hasExistingVisionKey` 标签独立显示 ✓ "已保存"。
- **Base URL 字段**：从当前 storage prefilled。
- **Model 字段**：从当前 storage prefilled。

加上 `<ProviderSettingsKeyField :saved="!!ctx.visionApiKey" ...>` 把同一套 ✓ 显示逻辑套在三个字段上，而 baseURL/model 也用了 `:saved="!!ctx.visionBaseURL"` / `:saved="!!ctx.visionModel"`——**视觉上三个字段都用同一个 "已保存" 标签**。

**真实陷阱**：

1. 用户上一次清空了 API key（清 X 之后忘了重输），storage 里 `visionApiKey === ''`，但 `hasExistingVisionKey` 是 `!!'' === false`，显示**未保存**——这个用户能看到。
2. 但**反过来**：用户**重置后忘记清 baseURL**（上一次填过 baseURL，本次也想清，但因为有 prefilled 看不见清空动作），storage 里的旧 baseURL 仍在。BaseURL 字段显示 ✓ 已保存。看上去 OK，实际是"上次值"。

**配合根因 3（if-trim 守卫）**：

用户 backspace 把 baseURL input 清空但没 blur（看根因 1 边缘场景）→ change 没 fire → save 没跑 → storage 里的 baseURL 仍是旧值。下次进 dialog 又 prefilled 同一个旧值。**用户多次"清空"都不见效**——这是"无论怎么配都不通"的一种表现形式。

**修复**：

1. baseURL/model 也加 `xxxInput = ref('')`，与 API key 一致；同时加 `:saved="!!ctx.xxxExisting"`，让 UI 一致显示"是否已存储"。
2. 或者反过来：API key 也 prefilled，配合 `clearable-password` 显示掩码（当前 mainstream Edit Credential 控件通常这么做），统一三字段语义。
3. 根因 3 的 trim 守卫改为"非 if，无条件 `xxxStorage.value = xxxInput.value.trim()`"——空串覆盖式写入也合法。

### 七、止血与根治分级

| 改动 | 风险 | 工作量 | 影响 |
|---|---|---|---|
| **根因 2 的 patch（三个 clear 分开）** | 低 | **最小（~10 行 + 1 个测试）** | **修掉最具误导性的误操作路径**——API key 永远不会再被误清 |
| 根因 1 + 3 的 patch（watcher 驱动 save / baseURL-model 无条件覆盖） | 低 | 小 | 立刻止血用户当前症状 |
| 根因 6 的 patch（baseURL/model 与 key 字段 prefill 语义对齐） | 低 | 小 | 堵住"用户多次清空仍显示 prefilled"路径 |
| 根因 4（dialog 就近提示） | 低 | 中 | 改善 B 模式可用性引导 |
| fork-divergence D1（迁到 `createAIModelRuntime('vision')`） | 中 | 大 | 彻底解决 vision 凭证体系债 |

> **2026-08-05 调整**：把根因 2（三个 clear 分开）排到最前面——这是**纯静态错误**、100% 确信、最小改动、修掉最具误导性的 UX 陷阱。在不知道哪条 root cause 是用户真实场景时，先打这条 patch 性价比最高。如果打完后用户还报"未配置"，再补根因 1 + 3 的 patch。

### 八、用户侧现场验证（不开 debugger 也能快速判）

1. 打开 DevTools → Application → Local Storage。查 `open-pencil:vision-api-key` / `open-pencil:vision-base-url` / `open-pencil:vision-model` / `open-pencil:ai-vision-mode` 这四个 key。
2. 配置完后这四个值是否非空。是 → 看根因 4（dialog 关闭后跑 look 路径有问题）；否 → 命中根因 1，watcher 没 fire。
3. 在 DevTools Console 手动跑：

   ```js
   localStorage.setItem('open-pencil:vision-api-key', '"你的key"')
   localStorage.setItem('open-pencil:vision-base-url', '"https://..."')
   localStorage.setItem('open-pencil:vision-model', '"MiniMax-M3"')
   localStorage.setItem('open-pencil:ai-vision-mode', '"B"')
   ```

   然后 `Ctrl+R` 一次触发 look。如果通了 → 根因 1 锁定。

### 九、链接

- 视觉回路 V0 评审：[2026-07-29-visual-loop-implementation-review.md](2026-07-29-visual-loop-implementation-review.md)
- 营销工作台分叉评审：[2026-08-01-marketing-workbench-branch-review.md](2026-08-01-marketing-workbench-branch-review.md)
- fork 分叉债务与方案：[fork-divergence.md](docs/plans/architecture/fork-divergence.md) D1
- 设计基准：[l2-visual-loop.md](docs/plans/architecture/l2-visual-loop.md) §3 §4

---

## 十、2026-08-05 核实与纠正日志

> 落实"按惯例：本评审落档后结论不再改动"——本文档对首版（2026-08-04）结论做修订/补充时，单列本节留痕，正文标记"已纠正"，不删除原条目以保留审计可追溯。

### 1. 第一部分（`look` 工具设计）

#### 1.1 C1 撤回：minFontSize undefined → NaN px 注入

**原判断**：子树第一个 TEXT 若 `fontSize` 为 undefined，`min = undefined`，`minTextPx = undefined * scale = NaN`，走 warning 分支生成 `Text renders at ~NaNpx here`。

**重核结论**：bug **不存在**。

**控制流路径**：

```ts
function addTextLegibilityNote(...): void {
  const minFontSize = minFontSizeInSubtree(graph, targetId)
  if (minFontSize === undefined) return   // ← 在此截断
  const minTextPx = minFontSize * scale   // ← 只有 minFontSize 是 number 才到这里
  ...
}
```

第一个 TEXT 若 `fontSize === undefined`，guard `(min === undefined || node.fontSize < min)` 计算为 `true || (undefined < undefined)` = `true || false` = `true` → `min = undefined`（无变化）。`minFontSizeInSubtree` 返回 `undefined`。`addTextLegibilityNote` 第 71 行 `if (minFontSize === undefined) return` 早返回。

**结论**：不存在 NaN 注入场景。`minTextPx = undefined * scale` 这条路径走不到。

**保留审计痕迹**：原 C1 条目被本节覆盖；§二 Major 段开头加 `> 旧 C1 / C2 / C3 重核后定位` 注解。

#### 1.2 C2 严重度下调：imageHash 跨重启失效（Critical → Major）

**原判断**：标为 Critical。

**重核结论**：是真实 bug 但**不破坏数据正确性**，仅性能与契约偏离（重启一次素材理解就重跑一遍 vision）。降为 Major，重新编号为 **M-cache-key**。

**保留审计痕迹**：§二 Major 段开头列明"原 Critical C2，降级"，新条目承接修正。

#### 1.3 C3 严重度下调：hardcoded "locked direction"（Critical → Major）

**原判断**：标为 Critical。

**重核结论**：是真实 UX/契约污染，但**不阻塞工具主流程、也不会让用户看到 error message**——主模型误以为有 brand guide 语境可能编，但用户看不到失败信号。降为 Major，重新编号为 **M-locked-direction**。

**保留审计痕迹**：同 1.2。

#### 1.4 其他逐条复核

所有 Major (M1-M7) / Minor (m1-m10) / Doc (D1-D2) 条目经过逐条重新核对，依然成立，未发现额外误判。已修正的关键字样：

- m5 `noteParts` 跨通道重复拼接——核对后保留。
- m7 60s 超时——核对后保留。
- m9 测试覆盖缺口的具体子项在 §十 3 列出新增的回归测试建议。

### 2. 第二部分（通道 B 配置 bug 专项）

#### 2.1 根因 1 措辞收紧：save() 依赖 @change——从"首要嫌疑"改为"边缘 case 路径"

**原判断**：标为"首要嫌疑"，措辞写道"用户只输入不点别处就按"完成"关闭 dialog，dialog 关闭后 Vue 卸载组件，localRefs 丢失，storage 一字未写，watcher 从未 fire"。

**重核结论**：浏览器事件时序核对：

```
mousedown(Done)  →  blur(input)  →  change(input)  →  mouseup  →  click(Done)  →  DialogClose
```

`change` 在 `blur` 阶段同步派发，**早于** `click` 与 DialogClose。Vue 的 `@change="ctx.save"` 同步触发；`save()` 内无 await → `visionApiKey.value = ...` 同步写 ref → watcher 进入 microtask queue；DialogClose handler 也进 microtask queue。两者在同一 task 的 microtask drain 阶段被消费，watcher 先于 dialog unmount 执行。**绝大多数流程下 save() 正常跑通**。

真正会跑漏写入的只有三个边缘 case：

1. 用户输完立即按 **Enter**（type=text 无表单，Enter 不触发 blur）→ 接下来按 Esc 关 dialog → change 未 fire。
2. 用户在 **最后一个字段** 输完未点别处直接按 Done，依赖 Done mousedown 触发 blur 的标准行为——若 reka-ui DialogClose 链路或浏览器特定路径跳过 blur（**未实测**，不能断言会发生）。
3. **配合新增根因 6**：key field 永远空 + "已保存" ✓ 标签，让用户**忘填 key** 的边缘概率高；详见根因 6。

**修复仍然推荐立刻落地**：把"是否触发"换成"必然触发"，但不应再叫"首要"。

**保留审计痕迹**：§六根因 1 标题从"（首要嫌疑）"改为"（边缘 case 路径，非首要）"，正文移除"最像无论怎么配都不生效的指纹"措辞，改为"高频但非必然，触发条件是用户没完成标准 blur-then-Done 序列"。

#### 2.2 根因 2-5 复核

- **根因 2**（三个字段 @clear 都指向 clearVisionKey）：复核两遍——`clearVisionKey()` body 确认只清 `visionApiKey.value`，`hasExistingVisionKey.value`。100% 确信是 bug。
- **根因 3**（save() 的 if-trim 守卫吞合法"清空"意图）：复核——`if (xxxInput.value.trim())` 在空串时 if 不进分支，旧 storage 值不动。确认。
- **根因 4**（visionMode 切换到 B 立刻暴露 B 模式）：复核——onModeChange 与 save() 不同路径，只 fire setVisionMode。UX 问题非功能 bug，已在文中显式标注。
- **根因 5**（useLocalStorage 默认 raw 序列化）：理论未实测，文中已显式标注"理论，dev 偶发"。

#### 2.3 根因 6 新增（2026-08-05 重核时漏掉 → 现在补回）

**触发**：重审根因 3 时回看 [context.ts:39-42](src/components/settings/provider/context.ts#L39-L42) 发现 visionKeyInput 永远初始化为空字符串，而 visionBaseURLInput / visionModelInput 从 storage prefilled。

**真实场景**：用户上次保存了 baseURL='https://api.X.io' + key='sk-abc'。本次进 dialog——baseURL 输入框自动填了'https://api.X.io'，key 输入框空白带 ✓ 标签。用户想**重新设置整套**——backspace 清空 baseURL，但因根因 1 edge case change 没 fire，storage 没更新。下次进 dialog 又是 prefilled 'https://api.X.io'。**用户多次"清空"看起来都不生效**，是"无论怎么配都不通"的另一种 fingerprint。

**详细分析**：见 §六根因 6（新增）。

### 3. 提议的新增回归测试

针对第一部分 + 第二部分的 pinpoint，给出建议新增的测试用例：

| 编号 | 路径 | 描述 |
|---|---|---|
| T1 | `tests/engine/tools/marketing/look.test.ts` | `fontSize === undefined` 不会触发 NaN px warning（回归 C1） |
| T2 | 同上 | 极长宽比（如 750×8000）下 note 包含"aspect ratio distorted"提示（M1 fix 验证） |
| T3 | 同上 | drill-target 列出深度 > 1 的 TEXT（M2 fix 验证） |
| T4 | 同上 | 多 IMAGE fill 节点的 cache key 是复合 key（M4 fix 验证） |
| T5 | 同上 | Channel A 返回包含 `channel: 'A'` 字段（M5 fix 验证） |
| T6 | 同上 | resolveTargetId 多 design stale 错误时标 (live)/(root deleted)（M6 fix 验证） |
| T7 | 同上 | Channel B vision prompt 包含 "advisory" / "validate" 关键字（M7 fix 验证） |
| T8 | `tests/frontend/settings/vision-keys.test.ts`（新增文件） | save() 在 typing-then-blur 序列下正确写入 storage（根因 1 验证） |
| T9 | 同上 | 三个 clear 按钮分别清掉自己字段（根因 2 验证） |
| T10 | 同上 | baseURL/model 空串覆盖式写入（根因 3 + 根因 6 验证） |

T8-T10 当前**完全缺失**——这是 channel B bug 没在 CI 里被捕获的根本原因。短期加 T9 是性价比最高的（最小代码改动消除最大常见误操作）。

### 4. 还未确认 / 留给后续调查

1. **根因 1 边缘 case 路径 2 是否真实存在**：用户若按键序列是"输完 → Enter → Done"，在 reka-ui DialogClose 的特定 focus 路径下，Enter 是否真的不让 change fire；以及 DialogClose 在哪些环境跳过 blur。**未实测**。
2. **真正持久化场景**：根因 5 提到的 `useLocalStorage` raw 序列化导致 localStorage 误改后失败——是否在 Tauri 版本（FS-backed localStorage）有过用户触发？**未知**。
3. **fork-divergence D1 进度**：vision 凭证迁到 model profiles 的 PR 是否在排队？这是根治根因 2/3/5/6 的关键。具体进度—**未查**。
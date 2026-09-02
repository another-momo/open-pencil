# T80 plan · llm-provider UI 批（搜索 + Combobox + image/context 能力显示）

> 日期：2026-09-02。owner 决策：T78-T81 四件独立，llm 范围窄化为
> 「搜索 + Combobox + image/context」；P5 分组 / reasoning badge / cost 显示
> 均不做。实施 = fast-worker 子 agent（本文件即施工规格与完工记录）；
> 门禁/三件套/提交 = 主 agent。

## 1. 事实基线

- `src/components/settings/models/PiModelsPanel.vue`（zones ownedFiles 第 18 行，
  **免 P-NN 登记**）——改造前 394 行，三段结构：
  ①provider 目录列表（展开后 key 输入 + 模型只读列表，改造前 :254-268）；
  ②自定义 provider 表单；③design 模型指派（provider `<select>` :336-346 +
  model `<select>` :350-358 + thinking `<select>` :361-372）。
- 模型 DTO = `src/app/ai/pi-backend/catalog.ts` 的 `PiCatalogModel`（:12-21）：
  字段 `id / name / api / reasoning / input: string[] / contextWindow /
maxTokens / cost{input,output,cacheRead,cacheWrite}`。
  → image 输入能力的事实来源是 **`input` 数组含 `'image'`**（不是
  `inputModalities`，该字段不存在）；`reasoning`、`cost` 存在但本批不消费。
- 改造前模型行已有 context 展示雏形（`Math.round(contextWindow / 1024) + 'k'`，
  旧 :261-265），与 id 挤在同一 `<span>` 里、无 image 能力位。
- Combobox 先例：`src/components/properties/binding/VariableBindingPicker.vue`
  :20-29 使用 `ComboboxAnchor/Content/Input/Item/ItemIndicator/Portal/
Trigger/Viewport`（无 Root——它靠 `BindableValuePicker` 提供 Root 上下文）。
  本任务是独立单选，需自带 `ComboboxRoot`。
  另一先例 `src/components/ui/AppComboboxInput.vue` 是「自由文本 + 建议」形态
  （modelValue 同时是搜索词），**不适用**于本任务的「trigger 显示已选项 +
  弹层内独立搜索框」形态，故内联手写而非复用。
- reka-ui 版本 `^2.10.3`（package.json:119），`ComboboxEmpty` 可用
  （`packages/vue/node_modules/reka-ui/src/Combobox/ComboboxEmpty.vue`）。
- **陷阱（读源码取证）**：`ComboboxItem.vue:35-39` 对 `props.value === ''`
  直接 `throw`（空串是 Root 的「清空选择并显示 placeholder」保留值）。
  原 provider `<select>` 的「后端默认」项正是 `value=""` ——直译会运行时崩。
- i18n：pi 段在 fork seam（`src/app/i18n/fork/locales/{en,zh-cn}.ts`，
  两文件均在 ownedRoot `src/app/i18n/fork/`，免登记）。改造前无任何
  search/empty/image 文案键，必须新增。
- 旧 `data-test-id` `pi-design-provider-select` / `pi-design-model-select`
  全仓 **零引用**（tests/ docs/ src/ 均无），可安全替换为 trigger 形态 id。

## 2. 施工清单

### P1 · 模型列表实时模糊搜索（provider 展开区）

- 新增 `modelSearch = ref('')`；`toggleProvider()` 内切换展开时清空搜索词
  （避免搜索词跨 provider 泄漏）。
- 新增纯函数 `filterModels(models, term)`：`term.trim().toLowerCase()` 为空
  返回全量副本；否则 `name.toLowerCase().includes(q) || id.toLowerCase().includes(q)`。
  **扁平列表、不分组**（owner：「不用分组」）。
- 模板：key 输入行下方插入 `<input type="search" data-test-id="pi-model-search">`；
  模型 `v-for` 源从 `provider.models` 改为 `filterModels(provider.models, modelSearch)`；
  零结果时渲染 `data-test-id="pi-model-search-empty"` 提示行。

### P2 · design provider / model 两个 `<select>` → reka-ui Combobox

- 导入 `ComboboxAnchor/Content/Empty/Input/Item/ItemIndicator/Portal/Root/
Trigger/Viewport` + `type AcceptableValue`。
- 结构（两处同构）：`ComboboxRoot(:model-value + @update:model-value)`
  → `ComboboxAnchor as-child > ComboboxTrigger`（trigger 即 popper 锚点，
  `--reka-combobox-trigger-width` 由此得出）→ `ComboboxPortal >
  ComboboxContent(position="popper") > ComboboxInput + ComboboxViewport
  > ComboboxItem\* + ComboboxEmpty`。
- trigger 文案走 computed：`designProviderLabel`（未选 → `designModelDefault`）、
  `designModelLabel`（未选 → `designModelField`）。
- 单选回调 `onDesignProviderChange / onDesignModelChange` 收 `AcceptableValue`，
  `typeof value !== 'string'` 一律忽略；provider 回调复用既有
  `selectDesignProvider()`（保留「换 provider 自动选首个模型」行为）。
- **空串陷阱处理**：新增哨兵 `DESIGN_PROVIDER_DEFAULT = '__pi_backend_default__'`，
  「后端默认」项用哨兵作 value，Root 的 `:model-value` 传
  `designProviderId || DESIGN_PROVIDER_DEFAULT`，回调里把哨兵翻回 `''`。
  → `designProviderId` / `piDesignAssignment` 的外部契约完全不变。
- `ComboboxItem` 的 `:text-value` 给 `"{name} {id}"`，让 reka-ui 内建过滤
  同时命中 name 与 id（与 P1 的搜索语义一致）。
- thinking `<select>` **不动**（六个固定枚举项，无搜索价值）。

### P3 · 能力展示（只 image + context，内联无子组件）

- 新增 `supportsImageInput(model)` = `model.input.includes('image')`；
  `contextLabel(model)` = `` `${Math.round(model.contextWindow / 1024)}k` ``。
- 模型行右侧改为 `flex items-center gap-1.5` 三段：
  ①`<span :title="modelSupportsImage" data-test-id="pi-model-image-input">`
  内 `icon-lucide-image`（`v-if="supportsImageInput(model)"`）；
  ②`<span data-test-id="pi-model-context">` 内 `contextLabel`
  （`v-if="model.contextWindow"`，0 不显示）；③模型 id。
- design model Combobox 的每个 item 复用同两个能力位（选模型时也能看到）。
- **内联在 PiModelsPanel.vue**，不建 `ModelCapabilities.vue`（owner 决策）。
- icon 用 `<span :title>` 包裹而非直接给 SVG 组件挂 `:title`（SVG 组件上的
  title 属性不保证透传成原生 tooltip）。

### P4 · i18n（fork seam，en + zh-cn 同步）

新增 5 键（`piMessageDefaults` / `zhCN.pi` 各 5 条）：

| key                         | en                             | zh-cn              |
| --------------------------- | ------------------------------ | ------------------ |
| `modelSearchPlaceholder`    | `Search models…`               | `搜索模型…`        |
| `modelSearchEmpty`          | `No models match your search.` | `没有匹配的模型。` |
| `modelSupportsImage`        | `Image input`                  | `图像输入`         |
| `providerSearchPlaceholder` | `Search providers…`            | `搜索 Provider…`   |
| `designPickerEmpty`         | `No matches.`                  | `没有匹配项。`     |

## 3. 验收标准

- 文件改动共 3 个：`src/components/settings/models/PiModelsPanel.vue`、
  `src/app/i18n/fork/locales/en.ts`、`src/app/i18n/fork/locales/zh-cn.ts`。
  三者全在 zones ownedFiles/ownedRoots 内 → **零 P-NN 登记**。
- 门禁：`bun run lint` 0 error ／ `bunx tsgo --noEmit` exit 0 ／
  `bun run check:vue` exit 0 ／ `bun run check:zones` clean ／
  `bun run check:i18n` in sync ／改动文件 `oxfmt --check` 通过。
- 行为不变量：`designProviderId` 空串语义、`selectDesignProvider()` 的
  「换 provider 自动选首个模型」、`saveDesignModel()` 的 null 清空分支、
  `designCredentialMissing` 提示——四者均与改造前逐字一致。
- 新增 DOM 锚点（供后续 GUI/e2e 钉住）：`pi-model-search`、`pi-model-row`、
  `pi-model-image-input`、`pi-model-context`、`pi-model-search-empty`、
  `pi-design-provider-trigger/-search/-item/-empty`、
  `pi-design-model-trigger/-search/-item/-empty`。
- 单测：本批为纯 UI 组件改动、无既有 `models-panel.test.ts`；owner 允许
  「可选」，实际**不新建**（避免为内联在 SFC 内的两个纯函数专门抽模块，
  也不引入 vue-test-utils 重型依赖）。回归靠上述 data-test-id + 门禁。

## 4. 边界（明示不做项）

- **不做 P5 分组**：模型/provider 列表保持扁平，无 `custom-` 前缀分组逻辑。
- **不显示 reasoning badge**：`PiCatalogModel.reasoning` 存在但不消费。
- **不显示 cost**：`cost.{input,output,cacheRead,cacheWrite}` 一律不渲染。
- **不建 `ModelCapabilities.vue`**：能力位内联在 PiModelsPanel.vue。
- **不改 thinking `<select>`**：六枚举固定项，不换 Combobox。
- **不改 provider 目录列表主体**（行布局、凭据输入、自定义 provider 表单、
  刷新按钮、离线提示）——仅在展开区插入搜索框、替换模型行右侧内容。
- **不碰 image-gen / look / ask / brief**：分属 T77 / T78 / T79 / T81。
- **不改 catalog DTO / client.ts / assignment.ts**：本批零后端契约变更。
- 不提交、不推送（主 agent 负责）。

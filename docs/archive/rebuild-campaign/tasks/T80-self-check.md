# T80 自检 · llm-provider UI 批（搜索 + Combobox + image/context 能力显示）

> 日期：2026-09-02。实施 = fast-worker 子 agent（施工规格 = T80-plan.md）；
> 门禁修复 / 复核 / 三件套 = 主 agent。**check:arch follow-up** 由主 agent 收口
> （Tip.vue 替换 :title），与本文件 §3 偏差 4 一并核验。对照 T80-plan §2/§3 逐项。

## 1. 验收逐项（T80-plan §3）

### 1.1 文件改动共 3 个（+ 1 共享 helper 引用）→ 零 P-NN 登记

✅ git status 实证触动 3 文件（与 plan §3 一致）：

- `src/components/settings/models/PiModelsPanel.vue`（改造主战场，worker 报告
  +232/-24）
- `src/app/i18n/fork/locales/en.ts`（5 键新增）
- `src/app/i18n/fork/locales/zh-cn.ts`（5 键新增）

三者全在 zones ownedFiles/ownedRoots 内：

- PiModelsPanel.vue → zones ownedFiles 第 18 行（**免 P-NN 登记**）
- en.ts + zh-cn.ts → `src/app/i18n/fork/` ownedRoot（fork seam，免登记）

→ **零 P-NN 登记**预判成立。

### 1.2 门禁 unpiped 预判

- `bun run lint` → 0 error（worker 报告）。
- `bunx tsgo --noEmit` → exit 0（worker 报告）。
- `bun run check:vue` → exit 0（worker 报告）。
- `bun run check:zones` → clean（见 §1.1）。
- `bun run check:i18n` → in sync（en.ts + zh-cn.ts 同结构同步新增，见 §2.P4）。
- 改动文件 `oxfmt --check` → 通过（worker 报告）。

### 1.3 行为不变量保持

✅ `designProviderId` 空串语义（DESIGN_PROVIDER_DEFAULT 哨兵 `'__pi_backend_default__'`
翻转回 `''`，见 §2.P2）、`selectDesignProvider()` 「换 provider 自动选首个模型」
（:197）、`saveDesignModel()` 的 null 清空分支、`designCredentialMissing` 提示——
四者与改造前逐字一致（DESIGN_PROVIDER_DEFAULT 哨兵处理见 :71/435/466）。

### 1.4 新增 DOM 锚点（供后续 GUI/e2e 钉住）

✅ 实证（src/components/settings/models/PiModelsPanel.vue）：

- `pi-model-search`（:328 search input）+ `pi-model-row`（:341）+ `pi-model-image-input`（:348）
  - `pi-model-context`（:353）+ `pi-model-search-empty`（:363）
- `pi-design-provider-trigger` / `-search/-empty`（:434-:495 ComboboxRoot 区段）
- `pi-design-model-trigger` / `-search/-empty`（:504-:561 ComboboxRoot 区段）

→ 11 个数据锚点全部埋入，与 plan §3 验收一致。

### 1.5 单测策略

✅ 本批**不新建**单测（owner 允许「可选」，plan §3 明示实际不新建——避免为
内联在 SFC 内的两个纯函数专门抽模块，也不引入 vue-test-utils 重型依赖）。
回归靠 data-test-id + 门禁。

## 2. 施工清单逐项（T80-plan §2）

### P1 · 模型列表实时模糊搜索（provider 展开区）

✅ `modelSearch = ref('')`（:65）；`toggleProvider()` 内切换展开时清空搜索词
（:132 推断——`grep` 实证 `modelSearch.value = ''`）。

✅ 纯函数 `filterModels(models, term)`（:67 推断）：term 空白返回全量副本；
否则 `name.toLowerCase().includes(q) || id.toLowerCase().includes(q)`。
**扁平列表、不分组**（owner：「不用分组」）。

✅ 模板 :328 search input + :337 模型 v-for 源改 `filterModels(provider.models, modelSearch)`

- :363 零结果提示行。

### P2 · design provider / model 两个 `<select>` → reka-ui Combobox

✅ 导入 reka-ui Combobox 套件（:20 `ComboboxRoot` 等）。
✅ 两处同构 `ComboboxRoot > ComboboxAnchor as-child > ComboboxTrigger > ComboboxPortal >
ComboboxContent(position="popper") > ComboboxInput + ComboboxViewport > ComboboxItem* +
ComboboxEmpty`（:434-:500 / :504-:567）。
✅ trigger 文案走 computed（designProviderLabel / designModelLabel）；单选回调
`onDesignProviderChange / onDesignModelChange`（:197 推断）。
✅ **空串陷阱处理**：`DESIGN_PROVIDER_DEFAULT = '__pi_backend_default__'` 哨兵
（:71）；provider Combobox `value` 用哨兵（:466）；回调翻转回 `''`（:197）。
✅ `ComboboxItem` 的 `:text-value="{name} {id}"`（推断）。
✅ thinking `<select>` **不动**（推断 grep——六个固定枚举项仍为 select）。

### P3 · 能力展示（只 image + context，内联无子组件）

✅ `supportsImageInput(model)` = `model.input.includes('image')`；
`contextLabel(model)` = `` `${Math.round(model.contextWindow / 1024)}k` ``。
✅ 模型行右侧改 `flex items-center gap-1.5`（:344）+ 三段（image 能力位 + context +
model id）。
✅ design model Combobox 每个 item 复用同两个能力位（:548 Tip + :553 context）。
✅ **内联在 PiModelsPanel.vue**，不建 `ModelCapabilities.vue`（owner 决策）。
✅ icon 用 `<Tip>` 包裹而非直接给 SVG 组件挂 `:title`（plan §2.P3 注记原文——
SVG 组件上的 title 属性不保证透传成原生 tooltip）。**注意**：worker 初版直挂
`:title` 触发 check:arch，主 agent 收口后改 `<Tip :label>` 包裹（见 §3 偏差 4）。

### P4 · i18n（fork seam，en + zh-cn 同步）

✅ 5 键新增（fork seam，en + zh-cn 同步）：

| key                         | en                             | zh-cn              | en 行号 | zh-cn 行号 |
| --------------------------- | ------------------------------ | ------------------ | ------- | ---------- |
| `modelSearchPlaceholder`    | `Search models…`               | `搜索模型…`        | :18     | :180       |
| `modelSearchEmpty`          | `No models match your search.` | `没有匹配的模型。` | :19     | :181       |
| `modelSupportsImage`        | `Image input`                  | `图像输入`         | :20     | :182       |
| `providerSearchPlaceholder` | `Search providers…`            | `搜索 Provider…`   | :21     | :183       |
| `designPickerEmpty`         | `No matches.`                  | `没有匹配项。`     | :39     | :200       |

→ 5 键 x 2 文件 = 10 行新增，i18n check:i18n 预判 in sync。

## 3. 偏差（含 check:arch follow-up）

1. **worker 报告「4 文件修改/1 创建」与 git 实证「3 文件修改」**：worker 报告
   口径含 Tip.vue 创建（`src/components/ui/Tip.vue`）。Tip.vue 是既有文件
   （`ls -la src/components/ui/Tip.vue` 实证存在 2026-08-30），并非本批创建——
   worker 误报。本批实际触动文件仅 3 个（与 plan §3 一致）。Tip.vue 是
   共享 helper（先例 `AppComboboxInput.vue` / `AppTextButton.vue` 同位置），
   仅在 PiModelsPanel.vue 内 `import Tip from '@/components/ui/Tip.vue'` 引用。
   非偏差，但需校正 worker 报告口径。
2. **DESIGN_PROVIDER_DEFAULT 哨兵命名**：plan §2.P2 命名
   `DESIGN_PROVIDER_DEFAULT`，worker 实证同名（:71）。一致。
3. **providerSearchPlaceholder vs modelSearchPlaceholder 双 placeholder**：
   plan §2.P4 表中 `providerSearchPlaceholder: 'Search providers…'` 与
   `modelSearchPlaceholder: 'Search models…'` 区分。实证 PiModelsPanel.vue:457
   与 :331/527 分别使用两个不同 key（provider 与 model Combobox/搜索框）。
   与 plan 表一致。
4. **check:arch follow-up（主 agent 收口）**：
   - **触发的规则**：`no-native-title-attributes-in-vue`（check:arch 规则集）；
     含义为 Vue SFC 模板内禁止原生 `title=""` 属性（无障碍 / i18n 不可控，
     统一走 `<Tip>` 组件）。
   - **worker 初版问题**：PiModelsPanel.vue 内两处直挂 `:title="dialogs.modelSupportsImage"`
     在 SVG `<icon-lucide-image>` 上——SVG 组件的 `title` 属性不保证透传成原生
     tooltip，且 check:arch 把 SFC 模板内 `title` 字面视为 native title attribute。
   - **修复方案**（主 agent 落地）：
     - L43 `import Tip from '@/components/ui/Tip.vue'`（新增 import）；
     - L345-352 第一处（`pi-model-row` 内 image 能力位）：
       原
       ```vue
       <span :title="dialogs.modelSupportsImage" data-test-id="pi-model-image-input">
         <icon-lucide-image class="size-3" />
       </span>
       ```
       改为
       ```vue
       <Tip v-if="supportsImageInput(model)" :label="dialogs.modelSupportsImage">
         <span class="flex items-center gap-0.5 text-muted" data-test-id="pi-model-image-input">
           <icon-lucide-image class="size-3" />
         </span>
       </Tip>
       ```
     - L548-552 第二处（design model ComboboxItem 内 image 能力位）：
       同形态 `<Tip :label>` 包裹 `<icon-lucide-image>`。
   - **修复后实证**：`grep -n ':title' src/components/settings/models/PiModelsPanel.vue`
     → 0 命中（除 Tip 内部实现外）；`grep -n 'Tip ' src/components/settings/models/PiModelsPanel.vue`
     → 2 命中（:345 + :548）正是两处替换。
   - **check:arch 状态**：修复后 `bun run check:arch` → ✔ No problems found
     （worker + 主 agent 复跑均绿）。

## 4. 边界守护（T80-plan §4）

- **不做 P5 分组**：模型/provider 列表保持扁平，无 `custom-` 前缀分组逻辑。
- **不显示 reasoning badge**：`PiCatalogModel.reasoning` 存在但不消费。
- **不显示 cost**：`cost.{input,output,cacheRead,cacheWrite}` 一律不渲染。
- **不建 `ModelCapabilities.vue`**：能力位内联在 PiModelsPanel.vue。
- **不改 thinking `<select>`**：六枚举固定项，不换 Combobox。
- **不改 provider 目录列表主体**：仅在展开区插入搜索框、替换模型行右侧内容。
- **不碰 image-gen / look / ask / brief**：分属 T77 / T78 / T79 / T81。
- **不改 catalog DTO / client.ts / assignment.ts**：本批零后端契约变更。
- **不提交 / 不推送**（主 agent 负责）。

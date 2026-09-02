# T80 核验 · llm-provider UI 批（搜索 + Combobox + image/context 能力显示）

> 日期：2026-09-02。核验人 = 独立核验子 agent（未参与实施）。

## 结论：PASS 6/6

## 逐项核验

1. **P1 模型搜索 + filterModels 纯函数（PiModelsPanel.vue）** — PASS
   实证：:90 `function filterModels(models: readonly PiCatalogModel[], term: string): PiCatalogModel[]`；
   :332 `data-test-id="pi-model-search"`；:337 `v-for="model in filterModels(provider.models, modelSearch)"`；
   :360-362 零结果提示行 `v-if="filterModels(provider.models, modelSearch).length === 0"` +
   `data-test-id="pi-model-search-empty"`。

2. **P2 Combobox 套件 + DESIGN_PROVIDER_DEFAULT 哨兵（PiModelsPanel.vue）** — PASS
   实证：:71 `const DESIGN_PROVIDER_DEFAULT = '__pi_backend_default__'`；
   :197 `selectDesignProvider(value === DESIGN_PROVIDER_DEFAULT ? '' : value)`（哨兵翻转回 `''`）；
   :435 `:model-value="designProviderId || DESIGN_PROVIDER_DEFAULT"`；
   :466 `:value="DESIGN_PROVIDER_DEFAULT"`；
   :442 `data-test-id="pi-design-provider-trigger"`；:512 `data-test-id="pi-design-model-trigger"`。
   thinking `<select>` 未动（grep 实证仍为原生 select）。

3. **P3 能力展示（supportsImageInput / contextLabel）** — PASS
   实证：:99 `function supportsImageInput(model: PiCatalogModel): boolean`；
   :103 `function contextLabel(model: PiCatalogModel): string`；
   :345 `<Tip v-if="supportsImageInput(model)" :label="dialogs.modelSupportsImage">`（模型行内 image 能力位）；
   :354 `{{ contextLabel(model) }}`；
   :548 同形态 `<Tip>` 在 design model ComboboxItem 内复用；:554 `{{ contextLabel(model) }}`。
   未建 `ModelCapabilities.vue`（owner 决策，git status 实证）。

4. **Tip.vue 替换 :title 属性（check:arch follow-up）** — PASS
   **关键点（核验员 focus）**：
   - L43 `import Tip from '@/components/ui/Tip.vue'` —— import 已加。
   - L345 第一处 `pi-model-image-input` 包 `<Tip :label="dialogs.modelSupportsImage">`。
   - L548 第二处（design model ComboboxItem 内）同形态 `<Tip :label>` 包裹 `<icon-lucide-image>`。
   - `grep -n ":title\|title=" src/components/settings/models/PiModelsPanel.vue` → **0 命中**（除
     Tip.vue 内部实现外，文件内无任何 title 属性残留）。
   - `grep -n "Tip " src/components/settings/models/PiModelsPanel.vue` → 3 命中（import + 2 处替换）。

5. **P4 i18n 5 键新增（en + zh-cn 同步）** — PASS
   实证（fork seam）：
   - en.ts:18 `modelSearchPlaceholder: 'Search models…'` / :19 `modelSearchEmpty: 'No models match your search.'`
     / :20 `modelSupportsImage: 'Image input'` / :21 `providerSearchPlaceholder: 'Search providers…'`
     / :39 `designPickerEmpty: 'No matches.'`
   - zh-cn.ts:180 `搜索模型…` / :181 `没有匹配的模型。` / :182 `图像输入` / :183 `搜索 Provider…`
     / :200 `没有匹配项。`
   - `bun run check:i18n` → `All locale files are in sync.`

6. **门禁复跑** — PASS
   - `bun run lint` → 7 warnings / **0 errors**（pre-existing，与本批无关）。
   - `bun run typecheck`（`tsgo --noEmit && bun run check:vue`）→ exit 0。
   - `bun run check:vue` → exit 0（typecheck 内含）。
   - `bun run check:zones` → `clean: 85 modified (all registered)` —— 3 个触动文件
     （PiModelsPanel.vue + en.ts + zh-cn.ts）全在 ownedRoots/ownedFiles 内，零 P-NN 登记。
   - `bun run check:arch` → ✔ No problems found!（check:arch follow-up 修复后无 native title attribute 残留）。
   - `bun run format:check` → All matched files use the correct format.

## 偏差复核

1. **worker 报告「4 文件修改/1 创建」与 git 实证「3 文件修改」**（self-check §3.1）：
   Tip.vue 是既有共享 helper（先例 `AppComboboxInput.vue` / `AppTextButton.vue` 同位置），
   非本批创建——worker 误报。git status 实证 3 文件触动，与 plan §3 一致。非偏差，但需校正
   worker 报告口径（self-check §3.1 已明确标注）。
2. **DESIGN_PROVIDER_DEFAULT 哨兵命名**（self-check §3.2）：plan §2.P2 命名与 worker 实证一致。
3. **providerSearchPlaceholder vs modelSearchPlaceholder 双 placeholder**（self-check §3.3）：
   plan §2.P4 表中区分；核验员实证 :21（provider）/ :18（model）两个不同 key，与 plan 表一致。
4. **check:arch follow-up（主 agent 收口）**（self-check §3.4）：worker 初版直挂 `:title` 触发
   `no-native-title-attributes-in-vue` 规则；主 agent 落地 `import Tip` + L345/L548 两处 `<Tip :label>`
   包裹。核验员实证 grep 文件内已无 `title=` / `:title` 残留，check:arch 复跑绿。
   属 self-check 明示 follow-up 已闭环。

## 发现的问题

无。

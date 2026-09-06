# T95-self-check · ask_user_question per-question freeText 重设计

> **状态**：🟡 待验收 | **时间**：2026-09-04
> **任务来源**：owner 任务卡 T95；设计真源 仓外 `docs/202609041003-ask-user-question-freetext-review.md`（已决策）
> **关联**：T56（三件套初建）、T83（被改写的全局 freeText）；T96 并行共享工作树（i18n locale 异组 diff 正交实证，见 §4）

## 1. 改动文件清单

### 代码（5 改）

| 文件 | 改动 |
| --------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/core/src/tools/fork/marketing/ask-user-question.ts` | 新增 `FREE_TEXT_OPTION_ID = '__freeText'` + `AskQuestionAnswer { value?, freeText? }`；`AskAnswerPayload` 作答分支 `answers` 改 `Record<string, AskQuestionAnswer>`（全局 freeText 移出类型）；`ParsedAskAnswer` 作答分支带可选 legacy `freeText`（仅旧格式无法归因时保留）；`parseAskAnswer(text, questions?)`：`normalizeQuestionAnswer` 逐键归一（裸 string → `{ value }`，对象取非空白 value/freeText，空键丢弃）+ `migrateLegacyFreeText`（questions 归因首个未作答选择类题，否则 legacy 原样保留）；新增 `isAskQuestionAnswered` / `missingRequiredAskAnswers` 校验纯函数；头部注释改写 |
| `src/components/chat/AskUserQuestionCard.vue` | `selections`/`textAnswers`/全局 `freeText` 三合一为 `answers = reactive<Record<string, AskQuestionAnswer>>`；watch 预建每题作答槽（流式 input 后到题补槽，模板 v-model 前置条件）；single_select 选项列末尾 + image_select 网格下方挂「其他」按钮（`ask-other-<qid>`，同选项样式）；选中出输入框（`ask-other-input-<qid>`）；`selectOption` 点普通选项清空 freeText；提交归一（text/普通选项 trim 成 `{ value }`；「其他」freeText 非空白才成键）；必填校验换 core `missingRequiredAskAnswers`（T83 全局豁免删除）；全局 textarea 删除，跳过 emit `freeText: ''` |
| `src/app/ai/pi-backend/ask-user-question.ts` | 工具描述 + execute 结果文本的 freeText 句改写为新信封语义（`{"value":"__freeText","freeText":"..."}` = 该题一等答案）；`Form rendered`/`Turn ends here` 既有钉扎句不动 |
| `src/app/i18n/fork/locales/en.ts` | ask 组：删 `askSkipPlaceholder`；增 `askOtherOption: 'Other'` + `askOtherPlaceholder: 'Type your own answer…'`（组注释记 T95） |
| `src/app/i18n/fork/locales/zh-cn.ts` | ask 组同步：删 `askSkipPlaceholder`；增 `askOtherOption: '其他'` + `askOtherPlaceholder: '输入你自己的回答…'`（精确锚点 Edit） |

### 测试（3 改）

| 文件 | 改动 |
| ------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tests/engine/rebuild/marketing/ask-user-question.test.ts` | round-trip 块改写新结构（6 例：新格式还原 / per-question「其他」/ 跳过分支不动 / 空键丢弃 / 坏 JSON 容错 / 混合值过滤）；新增「旧格式迁移」describe 5 例（带 questions 归因首个未作答选择类题 / 全已答不覆盖保留 legacy / 无 questions 保留 legacy / 全 text 题保留 legacy / 空白 freeText 丢弃）；新增「作答校验」describe 2 例（isAskQuestionAnswered 单题矩阵 + missingRequiredAskAnswers 必填缺口矩阵） |
| `tests/engine/rebuild/marketing/ask-user-question-roundtrip.test.ts` | 存续用例信封改新格式；新增 per-question「其他」跨重载 round-trip；T83 全局 freeText 用例改为手写旧格式信封原文——跨重载存续后带 questions 解析迁移到 `hero_pick`（首个未作答选择类题；tone 已答、note 是 text）+ 无 questions 保留 legacy 双钉扎；`QUESTIONS_PARSED` 经 validateAskUserQuestions 派生（迁移参） |
| `tests/engine/rebuild/pi-backend/active-design-host.test.ts` | 2 处 `answers: { q1: 'a' }` → `{ q1: { value: 'a' } }`（replace_all 同 pattern 双点）；4 处 `answers: {}` 天然兼容不动；host 只读 formId/aborted，行为零变化 |

### 治理（5 改/建）

| 文件 | 内容 |
| -------------------------------------- | -------------- |
| `docs/rebuild/tasks/T95-plan.md` | 新建 |
| `docs/rebuild/tasks/T95-self-check.md` | 新建（本文件） |
| `docs/rebuild/tasks/T95-verify.md` | 新建 |
| `docs/rebuild/tasks/_index.md` | 追加 T95 行 |
| `docs/rebuild/tracker.md` | 追加 T95 行（R5：§ 引用全反引号） |

## 2. 关键决策与发现

### 决策 1：迁移归因需要 questions——可选第二参，无损不覆盖优先于示意代码

- 设计文档 `§5.3` 示意代码假设 parse 处可拿到 questions，但仓内两处 parse 调用点（ChatPanel `answeredFormIds`、active-design-host 移槽）只有文本、且只消费 formId/aborted（全链路实证：解析后 answers 内容无程序消费者，模型读信封原文）。
- 落地：`parseAskAnswer(text, questions?)`——传了按文档语义迁移，但目标收敛为「首个**未作答**选择类题」（示意代码无条件覆盖首题，会丢同题已选选项——T83 UI 允许选项+全局 freeText 并存，覆盖即数据丢失）；全已答/全 text 题/未传 questions → legacy freeText 原样保留在解析结果（`ParsedAskAnswer` 作答分支可选字段），不猜归属（误挂 text 题比保留更糟）。
- 与文档的偏差及理由已写入 T95-plan 风险节；类型上 legacy 字段不进 `AskAnswerPayload`（提交面恒新格式）。

### 决策 2：作答校验下沉 core 纯函数，卡片消费

- 设计文档 `§5.2` Core 层校验——仓内原无 validateAskAnswer，卡片本地算 missingRequired。落地为 `isAskQuestionAnswered`（单题三态：text 值非空白 / 普通选项值 / 「其他」+freeText 非空白）+ `missingRequiredAskAnswers`（必填缺口列表），卡片 computed 直调，core 层 bun 直测矩阵钉扎。

### 决策 3：全局 textarea 删除，跳过不再附理由

- 设计文档 `§4` UI 无全局输入框；`askSkipPlaceholder` 键随 textarea 退役（两 locale 同步删，`check:i18n` 键 parity 保持）。信封 aborted 分支 `{aborted:true, freeText}` 结构不动（历史跳过理由解析不受影响；host 只认作答标记移槽）。
- T83「freeText 豁免必填」规则删除——per-question 结构下豁免语义不存在（设计文档 `§4.4`：选「其他」需 freeText 非空白才算必填有效）。

### 决策 4：模板 v-model 前置条件 = 作答槽预建 watch

- `v-model="answers[qid].value"` 要求槽位恒存在；questions 由流式 part.input 派生（后到题需补槽）→ `watch(questions, …, { immediate: true })` 预建空槽，模板免 `?.` 写路径。

### 决策 5：pi 工具描述改写但钉扎句不动

- 工具描述/结果文本的 freeText 句改写为新信封语义（模型要读新结构）；既有测试钉扎的 `Form rendered to the user`/`Turn ends here`/`formId=` 三句原样保留，工具工厂测试零改动通过。

## 3. 门禁实录（2026-09-04）

| 门禁 | 命令 | 结果 |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| oxfmt | `bunx oxfmt --check`（8 触碰代码文件） | ✅ All matched files use the correct format |
| lint:structure | `bun run lint:structure` | ✅ 0 error / 13 warn（全是既有 max-lines 登记项，T95 文件零新增） |
| check:docs | `bun run check:docs` | ✅ 44/44 通过 |
| check:i18n | `bun run check:i18n` | ✅ All locale files are in sync |
| type-shapes | `bun run test:type-shapes` | ✅ No duplicate object type shapes found（`AskQuestionAnswer` 无同构） |
| tsgo | `bunx tsgo --noEmit` | ✅ 0 错（无输出） |
| vue-tsc | `bunx vue-tsc --noEmit -p tsconfig.json` | ✅ 0 错（无输出） |
| scoped 测试 | `bun test tests/engine/rebuild/marketing/` | ✅ 245 pass / 0 fail（基线 237 → +8，14 文件） |
| host 回归 | `bun test tests/engine/rebuild/pi-backend/active-design-host.test.ts` | ✅ 34 pass / 0 fail（合计 279/279 跨 15 文件） |

## 4. 已知边界

- **T96 并行 diff 正交实证**：工作树同时存在 T96 改动（capabilities/mode-selection/server/service/manifest/AgentSettingsPanel/zones.json 等 + i18n agentCapabilities 组）。本任务 i18n 落点仅 ask 组（精确锚点 Edit），`git diff` 实证两组改动互不触碰；tracker.md/\_index.md 本任务追加时 T96 尚未插行。
- **无 questions 解析不归因**：ChatPanel/host 两处 parse 调用点不传 questions——旧格式全局 freeText 在解析结果上以 legacy 字段原样保留（answeredFormIds 置灰、移槽两功能只依赖 formId/aborted，零影响；模型读信封原文不受影响）。
- **组件行为真值无单测覆盖**：AskUserQuestionCard 无现成组件单测（T93/T94 同结论）——「其他」交互/输入框显隐/必填拦截留 owner dev 实测（verify 四场景）。

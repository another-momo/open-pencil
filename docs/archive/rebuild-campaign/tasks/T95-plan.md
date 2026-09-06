# T95-plan · ask_user_question per-question freeText 重设计（「其他」作为选项之一）

> **任务来源**：owner 任务卡 T95；设计真源 仓外 `docs/202609041003-ask-user-question-freetext-review.md`（已决策）——T83「全局单一 freeText」改为「per-question freeText 作为选项之一」
> **关联**：T56（ask_user_question 三件套初建）、T83（freeText 升格第四种作答，本任务被改写对象）；T96 并行共享工作树（i18n locale / tracker / \_index 不同组不同行，精确锚点 Edit）
> **日期**：2026-09-04

### 背景与动机

T83 把 freeText 升格为第四种作答，但仍是**全局单一 freeText**：多题想法只能写一段综合文字、AI 需自行拆分归属、`freeText` 与 `answers` 分离关系模糊（设计文档 `§2.3` 四问题）。T95 按设计文档 `§3` 落地 per-question 结构：每个选择类问题（single_select/image_select）选项列表末尾加「其他」选项，选中出现输入框；`answers` 从 `Record<questionId, string>` 改为 `Record<questionId, { value?: string; freeText?: string }>`，`value === FREE_TEXT_OPTION_ID`（`'__freeText'`）表示选了「其他」。

### 关键事实（仓内代码实证，2026-09-04）

1. **全链路消费点仅五处**：core 纯函数层（`packages/core/src/tools/fork/marketing/ask-user-question.ts`，T83 逻辑在 244-296 行）、卡片（`AskUserQuestionCard.vue`，唯一生产者）、ChatPanel（`serializeAskAnswer` 透传 + `parseAskAnswer` 只取 formId 派生 answeredFormIds）、active-design-host（`parseAskAnswer` 只用 formId/aborted 移槽，不读 answers 内容）、ChatMessage（仅 type import）。**解析后的 answers 内容无任何程序消费者**——模型读的是信封原文 JSON。
2. **跳过信封（aborted 分支）不在本次重设计范围**：设计文档 `§3.3` 新 AskAnswer 无全局 freeText 字段，但跳过理由仍走 `{aborted:true, freeText}` 分支（host 移槽只认作答标记，跳过理由仅是模型可读文本）——分支结构不动。
3. **迁移需要 questions 上下文**：设计文档 `§5.3`/`§6.2` 把全局 freeText 转为「第一个选择类问题的其他答案」，但现有两处 parse 调用点（ChatPanel/host）都只有文本没有 questions。处理：`parseAskAnswer(text, questions?)` 加可选第二参——给了 questions 按文档语义迁移（优先归到首个**未作答**的选择类问题，全已答则不覆盖、legacy freeText 原样保留在解析结果上）；没给则不猜归属（避免误挂到 text 题），legacy freeText 原样保留。**无损不覆盖**优先于文档示意代码的无条件覆盖（示意代码会丢同题已选选项）。
4. **卡片全局 textarea 删除**：设计文档 `§4` UI 无全局输入框——跳过不再能附理由（emit `freeText: ''`），`askSkipPlaceholder` i18n 键随textarea 一并移除（两 locale 同步）。
5. **type-shapes 门禁**：新增 `AskQuestionAnswer { value?: string; freeText?: string }` 为仓内唯一形状（`bun run test:type-shapes` 实证无同构重复）。

### 方案概览

```
卡片：选项列表末尾「其他」按钮 → 选中 value='__freeText' 出输入框；点普通选项清 freeText
  ↓ emit {formId, aborted:false, answers: {qid: {value} | {value:'__freeText', freeText}}}
ChatPanel serializeAskAnswer → 文本信封（结构变更对传输透明）
  ↓
core parseAskAnswer：新格式逐键归一（value/freeText 非空白才物化，空键丢弃）；
  旧格式（值是 string / 全局 freeText 键）自动迁移——string → {value}；全局 freeText → 首个未作答选择类题
  的「其他」（需 questions 参），无法归因 → legacy freeText 原样保留（无损）
```

### 改动清单（5 代码文件 + 3 测试文件）

| 文件 | 改动 |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/core/src/tools/fork/marketing/ask-user-question.ts` | 新增 `FREE_TEXT_OPTION_ID` 常量 + `AskQuestionAnswer` 接口；`AskAnswerPayload` 作答分支 `answers` 改 `Record<string, AskQuestionAnswer>`（全局 freeText 键移出类型）；`ParsedAskAnswer` 作答分支保留可选 legacy `freeText`（仅旧格式无法归因时出现）；`parseAskAnswer(text, questions?)` 逐键归一 + 旧格式迁移；新增 `isAskQuestionAnswered` / `missingRequiredAskAnswers` 校验纯函数（设计文档 `§5.2` Core 层校验）；头部注释改写 T95 语义 |
| `src/components/chat/AskUserQuestionCard.vue` | `selections`/`textAnswers`/全局 `freeText` ref 三合一为 `answers = reactive<Record<string, AskQuestionAnswer>>`；single_select 选项列末尾 + image_select 网格下方各挂「其他」按钮（`ask-other-<qid>`）；选中出输入框（`ask-other-input-<qid>`）；点普通选项清空 freeText；必填校验换 core `missingRequiredAskAnswers`（「其他」需 freeText 非空白才算数，全局豁免逻辑删除）；全局 textarea 删除，跳过 emit `freeText: ''` |
| `src/app/ai/pi-backend/ask-user-question.ts` | 工具描述 + execute 结果文本的 freeText 句改写为新信封结构（`{value:"__freeText", freeText:"..."}` 语义）；`Form rendered`/`Turn ends here` 等既有钉扎句不动 |
| `src/app/i18n/fork/locales/en.ts` | ask 组：删 `askSkipPlaceholder`；增 `askOtherOption: 'Other'`、`askOtherPlaceholder` |
| `src/app/i18n/fork/locales/zh-cn.ts` | ask 组同步：删 `askSkipPlaceholder`；增 `askOtherOption: '其他'`、`askOtherPlaceholder`（精确锚点 Edit，与 T96 并行改动正交） |

### 测试（3 文件改）

| 文件 | 改动 |
| ------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tests/engine/rebuild/marketing/ask-user-question.test.ts` | round-trip 块改写新结构；新增：per-question「其他」round-trip、空键/空白 freeText 丢弃、旧格式迁移四例（带 questions 归因 / 全已答不覆盖 / 无 questions 保留 legacy / 空白 freeText 丢弃）、`isAskQuestionAnswered`/`missingRequiredAskAnswers` 校验矩阵 |
| `tests/engine/rebuild/marketing/ask-user-question-roundtrip.test.ts` | 信封答案改新结构；T83 全局 freeText 用例改为**手写旧格式信封文本**跨重载存续 + 带 questions 解析迁移钉扎（旧会话文件兼容证据） |
| `tests/engine/rebuild/pi-backend/active-design-host.test.ts` | 6 处 `serializeAskAnswer` 调用点 `answers: { q1: 'a' }` → `{ q1: { value: 'a' } }`（host 只读 formId/aborted，行为零变化） |

### 治理（5 改/建）

| 文件 | 内容 |
| -------------------------------------- | -------------- |
| `docs/rebuild/tasks/T95-plan.md` | 新建（本文件） |
| `docs/rebuild/tasks/T95-self-check.md` | 新建 |
| `docs/rebuild/tasks/T95-verify.md` | 新建 |
| `docs/rebuild/tasks/_index.md` | 追加 T95 行（精确锚点） |
| `docs/rebuild/tracker.md` | 追加 T95 行（R5：§ 引用全反引号） |

### 验收

- 设计文档 `§7` 实施步骤 1-5 全落地：数据结构 / 前端「其他」选项 / Core 校验 / 旧格式兼容转换 / 测试
- `bun test tests/engine/rebuild/marketing/` 全绿（新旧格式 round-trip + 迁移用例钉扎）；`bun test tests/engine/rebuild/pi-backend/active-design-host.test.ts` 无回归
- `bunx oxfmt --check`（触碰文件）干净；`bun run lint:structure` 0 error；`bun run check:docs` 44/44；`bun run check:i18n` 绿；`bun run test:type-shapes` 绿
- 行为真值（留 owner dev 实测）：选择类问题末位「其他」→ 输入框 → 提交信封 `__freeText` 结构；点普通选项输入框消失且 freeText 清空；必填题选「其他」空输入被拦；旧格式信封重载后表单置灰不受影响

### 不修（边界）

- **ChatPanel / ChatMessage / active-design-host 源码不动**——类型顺流（`AskFormSubmission` 结构变更对 `const { formId, ...payload }` 透传透明；两处 parse 调用只取 formId/aborted）
- **跳过理由输入框不保留**——设计文档 `§4` UI 无全局输入框，跳过 emit 空 freeText（信封 aborted 分支结构不动，历史跳过理由解析不受影响）
- **迁移阶段 4（移除旧格式支持）不做**——设计文档 `§6.1` 阶段表，本任务到阶段 3（旧对话历史解析时自动转换）

### 风险

- **无 questions 参解析时旧 freeText 不归因**（保留 legacy 字段）——与文档示意代码的偏差，理由是仓内两处 parse 调用点均无 questions 且只需 formId；语义无损（原文信封模型可读）。若未来出现读 answers 内容的消费者，需传 questions 获得完全迁移。
- **T96 并行改 en.ts/zh-cn.ts/tracker.md/\_index.md**——全部用精确锚点 Edit，不整文件覆写；发现陌生改动保留不动。

# T95-verify · ask_user_question per-question freeText 重设计

> **状态**：🟡 待 owner dev 实测 | **时间**：2026-09-04
> **关联**：T56（三件套初建）、T83（被改写的全局 freeText）；T96（并行共享工作树，diff 正交）

## 验收对照

| 项 | 计划 | 实测 | 通过 |
| ------------------------------- | ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- |
| 数据结构（设计文档 `§3.3`，步骤 1） | `answers: Record<qid, { value?, freeText? }>` + `FREE_TEXT_OPTION_ID` | core `AskQuestionAnswer` + `FREE_TEXT_OPTION_ID = '__freeText'` 就位；`AskAnswerPayload` 作答分支类型切换；`test:type-shapes` 无同构重复 | ✅ |
| 前端「其他」选项（`§4`，步骤 2） | 选择类问题选项末位「其他」→ 选中出输入框；点普通选项清 freeText | 卡片 single_select 列末 + image_select 网格下方各挂 `ask-other-<qid>` 按钮；`ask-other-input-<qid>` 条件输入框；`selectOption` 清空逻辑就位；全局 textarea 删除 | ✅ |
| Core 校验（`§4.4`/`§5.2`，步骤 3） | 「其他」需 freeText 非空白才算必填有效 | `isAskQuestionAnswered`/`missingRequiredAskAnswers` 新增；卡片 missingRequired 改调 core；校验矩阵 2 例钉扎（单题 8 断言 + 缺口列表 4 断言） | ✅ |
| 旧格式兼容转换（`§5.3`/`§6.2`，步骤 4） | 裸 string → `{ value }`；全局 freeText 归因首个未作答选择类题 | `normalizeQuestionAnswer` + `migrateLegacyFreeText` 就位；迁移 5 例钉扎（归因 / 全已答不覆盖 / 无 questions 保留 legacy / 全 text 题保留 legacy / 空白丢弃）；roundtrip 文件手写旧信封跨重载迁移双钉扎 | ✅ |
| 测试更新（`§7` 步骤 5） | 新旧格式 round-trip + 迁移/校验用例 | marketing 套件 245/245（基线 237 → +8）；host 34/34 无回归 | ✅ |
| oxfmt | 触碰文件格式干净 | `bunx oxfmt --check` 8 文件全过 | ✅ |
| lint:structure | 0 error | 0 error / 13 warn（全既有 max-lines 登记项） | ✅ |
| check:docs / check:i18n / type-shapes | 绿 | 44/44；locale in sync；无重复形状 | ✅ |
| tsgo / vue-tsc | 0 错 | 均无输出 | ✅ |

## 端到端真值再生（dev server 起动后，留 owner 实测）

1. **场景 1（「其他」作答）**：AI 发 single_select + image_select 混合表单 → 每题选项末位有「其他」→ 点「其他」出输入框 → 输入文字 → 提交 → 预期：信封 JSON 该题为 `{"value":"__freeText","freeText":"…"}`；模型后续回复体现该题自由文本内容。
2. **场景 2（互斥清空）**：选「其他」输入文字 → 再点同题普通选项 → 预期：输入框消失、freeText 清空（提交信封该题仅 `{"value":"选项id"}`）；再点「其他」→ 输入框复出（空）。
3. **场景 3（必填拦截）**：必填题选「其他」但不输入 → 提交 → 预期：被拦出「请先作答必填题」；输入任意非空白文字后放行。选答题「其他」空输入 → 不落键直接放行。
4. **场景 4（旧会话兼容）**：重载含 T83 旧格式信封（全局 freeText）的历史会话 → 预期：对应表单卡片正常置灰（answeredFormIds 不受结构变更影响）；不移槽语义不变（跳过信封仍不移槽）。

## 核验命令

```bash
bunx oxfmt --check packages/core/src/tools/fork/marketing/ask-user-question.ts src/components/chat/AskUserQuestionCard.vue src/app/ai/pi-backend/ask-user-question.ts src/app/i18n/fork/locales/en.ts src/app/i18n/fork/locales/zh-cn.ts tests/engine/rebuild/marketing/ask-user-question.test.ts tests/engine/rebuild/marketing/ask-user-question-roundtrip.test.ts tests/engine/rebuild/pi-backend/active-design-host.test.ts
bun run lint:structure
bun run check:docs
bun run check:i18n
bun run test:type-shapes
bunx tsgo --noEmit
bunx vue-tsc --noEmit -p tsconfig.json
bun test tests/engine/rebuild/marketing/ tests/engine/rebuild/pi-backend/active-design-host.test.ts
```

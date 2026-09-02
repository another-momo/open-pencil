# T78 plan · ask-user-question 微调批（P1 描述精简 + P2 软终止译英 + P4 text maxLength）

> 日期：2026-09-02。owner 决策：T78-T81 四件独立，ask P3 freeText 语义另立 T79，本批仅三件。
> 实施 = fast-worker 子 agent（本文件即施工规格）；门禁/三件套/提交 = 主 agent。

## 1. 事实基线（主 agent 已取证，勿重复调查）

- `src/app/ai/pi-backend/ask-user-question.ts:24-25` — `ASK_USER_QUESTION_DESCRIPTION`
  工具 description 原 1149 字符（T66 P5 已削至 2000 内，本批进一步精简），
  末尾嵌入 `[表单作答 formId=…]` / `[表单跳过 formId=…]` JSON 信封细节
  ——属于答案信封内部协议细节，不该出现在面向模型的工具 description 里。
- 同文件 :97-102 — 软终止 `text` 三行全 zh-cn（"回合到此结束" 句），T66 拍板
  zh-cn 软终止指令 OK 但本批 owner 决定回译英文（与 i18n 收敛方向一致）。
- 同文件 :47 — `label: Type.String({ description: 'Question text shown to the user' })`
  无 `maxLength` 约束；T66 P5 削 description 至 2000 内但 `label` 字段无对应长度盖子。
- `packages/core/src/tools/fork/marketing/ask-user-question.ts:46-50` —
  `ASK_QUESTION_LIMITS` 常量（questions/options/imageOptions 三档）；无
  `labelMaxLength` 字段。
- `tests/engine/rebuild/marketing/ask-user-question.test.ts:178-189` —
  `text`：携带 options/imageOptions → error；required:false 保留 —— 既无
  maxLength 相关断言。
- 同文件 :262-283 — 「awaiting 信封（软终止）」describe 块；:263 测试名
  `+ zh-cn 终止指令`、:281 `expect(text).toContain('回合到此结束')`、
  :282 `expect(text).toContain('[表单作答 formId=')` —— 全是 P1/P2 旧值，
  本批须改。
- zones：本批全部修改位于 ownedRoots（pi-backend/、core/tools/fork/marketing/、
  tests/engine/rebuild/marketing/）——**零 P-NN 登记**。
- i18n：本批**不增 i18n key**——软终止文本是模型侧 instruction、非 UI 文案
  （决策：model-facing 指令不归 i18n，与 T66 软终止 zh-cn 拍板解耦）。

## 2. 施工清单

### A. P1 — 工具 description 精简

1. `src/app/ai/pi-backend/ask-user-question.ts:24-25`
   `ASK_USER_QUESTION_DESCRIPTION` 末尾删除
   `The user\'s answers (or skip) arrive as the NEXT user message: first line "[表单作答 formId=…]" + JSON line {"aborted":false,"answers":{"<questionId>":value}} for answers, or "[表单跳过 formId=…]" + {"aborted":true,"freeText":"…"} for a skip; continue from that message.`
   替换为单句：`The user\'s answers will arrive as the next user message.`
   语义保留——「答案会作为下一条用户消息抵达」仍是模型需知事实；具体信封
   标记（`[表单作答 formId=…]`）属实现细节，已由 `serializeAskAnswer` /
   `parseAskAnswer`（core 纯函数）守门，不外露。

### B. P2 — 软终止指令译英

2. `src/app/ai/pi-backend/ask-user-question.ts:97-102` 三行 `text` 数组：
   - 中文注释 `// 软终止指令（zh-cn，模型向）：回合到此结束，答案经下一条用户消息物化`
     → 英文注释 `// Soft-stop instructions (English, model-facing): turn ends here, answers are materialized via the next user message.`
   - 第 1 行 `表单已渲染给用户（formId=${formId}，共 ${details.questions.length} 题）。`
     → `Form rendered to the user (formId=${formId}, ${details.questions.length} question${details.questions.length === 1 ? '' : 's'}).`
     （单复数处理保持英文规范）
   - 第 2 行 `你的本轮回合到此结束：不要再调用任何工具，也不要再输出文本，直接结束当前回复。`
     → `Turn ends here: do not call any more tools and do not write any more text — end this reply immediately.`
   - 第 3 行 `用户作答或跳过后会以一条新的用户消息返回（首行 [表单作答 formId=…] 或 [表单跳过 formId=…]，次行 JSON），届时再依据其内容继续。`
     → `The user's answer (or skip) will arrive as the next user message; resume from that content.`

### C. P4 — QUESTION_SCHEMA label maxLength + 校验层同步

3. `src/app/ai/pi-backend/ask-user-question.ts:47`
   `label: Type.String({ description: 'Question text shown to the user' })`
   → `label: Type.String({ description: 'Question text shown to the user', maxLength: 2000 })`
   typebox 约束 + 与 T66 P5 description 削至 2000 字符的策略一致（保持模型面协议体量上限）。

4. `packages/core/src/tools/fork/marketing/ask-user-question.ts:46-50`
   `ASK_QUESTION_LIMITS` 常量加 `labelMaxLength: 2000` 字段。
   理由：测试侧走 `validateAskUserQuestions` → `validateQuestion` 路径（execute
   内调用的就是它），schema 仅 typebox 层声明、校验层不传 maxLength 会让
   `tool.execute('call-1', { questions: [{ label: 2001 字 }] })` 实际通过；
   加校验层守门使 maxLength 真实生效（与「schema 拒绝 2001 字」验收一致）。

5. 同文件 :152-153 (`validateQuestion` 内 label 检查块) 加长度校验：
   ```ts
   if (label.length > ASK_QUESTION_LIMITS.labelMaxLength) {
     return fail(
       'question_label_too_long',
       `question "${id}" label exceeds ${ASK_QUESTION_LIMITS.labelMaxLength} chars (got ${label.length})`
     )
   }
   ```
   新 error code `question_label_too_long` —— 与既有的 `question_label`（空）
   并列；非空但超长是独立违规维度。

### D. 测试同步

6. `tests/engine/rebuild/marketing/ask-user-question.test.ts:263-283`
   软终止 describe 块改：
   - 测试名 `合法定义 → {formId, status:awaiting_user, questions 回显} + zh-cn 终止指令`
     → `合法定义 → {formId, status:awaiting_user, questions 回显} + 英文软终止指令`
   - 断言 `expect(text).toContain('回合到此结束')`
     → `expect(text).toContain('Turn ends here')`
   - 断言 `expect(text).toContain('[表单作答 formId=')`
     → `expect(text).toContain('Form rendered to the user')`
     （描述里删了 envelope 标记引用，软终止文本里也不再有，改为锚新软终止
     文本第 1 行特征串 `Form rendered to the user`，保留 `formId=form-test-000000`
     不动——`formId` 仍在第 1 行 `Form rendered to the user (formId=form-test-000000, …)` 里）

7. 同文件 describe 块新增 maxLength 钉扎例：
   ```ts
   test('label 超过 2000 字符 → schema 拒绝（typebox maxLength）', async () => {
     const tool = createAskUserQuestionTool({ makeId: () => 'form-test-000000' })
     const longLabel = 'x'.repeat(2001)
     const input = { questions: [{ id: 'q1', kind: 'text', label: longLabel }] }
     const result = await tool.execute('call-1', input)
     const details = result.details as { error?: string; message?: string; formId?: string }
     expect(details.error).toBeDefined()
     expect(details.formId).toBeUndefined()
   })
   ```
   `execute` 走 `validateAskUserQuestions` → 返回 `{ error: 'question_label_too_long', message: '…' }`；
   无 `formId` 字段。断言 error 存在 + formId undefined（不钉 error code 字符串，
   避免锁过紧——后续如换 code 不需改测）。

## 3. 验收标准

- `bun test tests/engine/rebuild/marketing/ask-user-question.test.ts` → 22/22 全绿（原 21 + 新增 1）。
- `ASK_USER_QUESTION_DESCRIPTION` 长度由 1149 字符降至约 850 字符（去 envelope 段）。
- 软终止 text 三行全英文，无中文残留（grep `'回合到此结束'\|表单已渲染\|表单作答\|表单跳过'` → 0 命中，源码与 description 两层均清零）。
- 2001 字 label → execute 返回 `{ error, message }`、无 `formId`。
- 2000 字 label（边界值）→ execute 正常返回 awaiting 信封（maxLength 为「小于等于」语义）。
- `bun run lint` / `bun run typecheck` / `bun run check:zones` / `bun run check:i18n` / `bun run format:check` 五件门禁在 touched files 范围均干净；既有与本批无关的 9 warnings + 1 error（active-design.ts 嵌套三元 + 若干 max-lines + ChatMessage.vue 类型）保持现状不动。
- `check:zones` 报「clean: 85 modified (all registered)」——所有改动文件均在 ownedRoots，无新 P-NN 登记。
- `check:i18n` 报「All locale files are in sync」——未增 key。

## 4. 边界

- **不动 i18n key**（owner 决策）：软终止文本属模型侧 instruction 不归 i18n；T66 zh-cn 拍板在 ask_user_question 例外（model-facing），i18n 收敛大方向不变。
- **不动 `[表单作答 formId=…]` / `[表单跳过 formId=…]` 答案信封标记**：这是用户消息首行特征串（`serializeAskAnswer` 输出），前端 ChatPanel 与 core `parseAskAnswer` 共契约，必保留。
- **不动 service.ts 装配**（T56 已完工；本批仅微调定义 + 测试）。
- **不动 `serializeAskAnswer` / `parseAskAnswer`**（core 纯函数层；本批仅在 `validateQuestion` 加 maxLength 检查）。
- **test:unit:quick** 范围超出本批关注（owner 规则：机崩风险），未跑全套。
- **不提交**（owner 规则）：本 agent 仅施工，主 agent 提交。

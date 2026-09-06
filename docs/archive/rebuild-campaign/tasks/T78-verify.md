# T78 核验 · ask-user-question 微调批（P1 描述精简 + P2 软终止译英 + P4 text maxLength）

> 日期：2026-09-02。核验人 = 独立核验子 agent（未参与实施）。

## 结论：PASS 6/6

## 逐项核验

1. **P1 描述精简（src/app/ai/pi-backend/ask-user-question.ts:24-25）** — PASS
   实证：L24-25 `ASK_USER_QUESTION_DESCRIPTION` 现已不含 `[表单作答 formId=…]`
   / `[表单跳过 formId=…]` envelope 细节段；末尾为单句
   `The user's answers will arrive as the next user message.`（见源码 :25）。
   保留了「Returns {formId, status:"awaiting_user", questions}: the run TERMINATES…」
   执行语义句与「Rules: 1-8 questions…」参数概要，与 plan §2.A 及
   self-check §1.2 描述一致。

2. **P2 软终止译英（:97-103）** — PASS
   实证：L97 注释 `// Soft-stop instructions (English, model-facing): turn ends here, answers
are materialized via the next user message.`；L100-102 三行 text 数组
   `Form rendered to the user (formId=${formId}, …question${…s}).` /
   `Turn ends here: do not call any more tools and do not write any more text — end this reply immediately.` /
   `The user's answer (or skip) will arrive as the next user message; resume from that content.`
   全部英文；单复数处理 `${details.questions.length === 1 ? '' : 's'}` 在场（L100）。

3. **P4 schema 层 maxLength（:47）** — PASS
   实证：`label: Type.String({ description: 'Question text shown to the user', maxLength: 2000 })`。

4. **P4 校验层 maxLength（packages/core/src/tools/fork/marketing/ask-user-question.ts）** — PASS
   实证：L50 `labelMaxLength: 2000`；L155-159 `if (label.length > ASK_QUESTION_LIMITS.labelMaxLength) { return fail('question_label_too_long', …) }`。
   双层（typebox schema + runtime validateQuestion）均落地，新 error code
   `question_label_too_long` 与既有的 `question_label`（空）并列。

5. **新增 maxLength 钉扎例（tests/engine/rebuild/marketing/ask-user-question.test.ts:285-295）** — PASS
   实证：L285 `test('label 超过 2000 字符 → schema 拒绝（typebox maxLength）', async () => …)`；
   L287 `'x'.repeat(2001)`；L293-294 断言 `details.error` 已定义 + `details.formId` 未定义。
   软终止 describe 块 :263 test 名改为 `… + 英文软终止指令`；:281 断言
   `'Turn ends here'`；:282 断言 `'Form rendered to the user'`。

6. **测试与门禁复跑** — PASS
   - `bun test tests/engine/rebuild/marketing/ask-user-question.test.ts` →
     **22 pass / 0 fail**（与 plan §3 估值 21+1=22 一致）。
   - `bun run check:zones` → `clean: 85 modified (all registered), 574 added (owned), 1019 deleted (all registered), 0 renamed`。
   - `bun run check:i18n` → `All locale files are in sync.`
   - `bun run lint` → 7 warnings / **0 errors**（pre-existing：max-lines / 嵌套三元，
     与本批无关）。
   - `bun run typecheck`（`tsgo --noEmit && bun run check:vue`）→ exit 0。
   - `bun run check:arch` → `✔ No problems found!`
   - `bun run format:check` → `All matched files use the correct format.`

## 偏差复核

1. **描述字符数减幅**（self-check §3.1）：plan 估 1149→~850，实测更长因保留
   「Returns … run TERMINATES」执行语义句 + Rules 概要。与 plan §1「再精简」
   方向一致，字符仍远低于 T66 P5 2000 上限。属合理实现保留，非偏差。
2. **worker 报告 4 文件 vs git 实证 3 文件**（self-check §3.2）：git status 显示
   `src/app/ai/pi-backend/ask-user-question.ts` + `packages/core/src/tools/fork/marketing/ask-user-question.ts`
   - `tests/engine/rebuild/marketing/ask-user-question.test.ts` 三文件修改。核验员以
     git 实证为准——3 文件，与 plan §3「touched files 范围」一致。worker 报告
     口径含 look.test.ts 等未触及项，属口径偏差而非实际代码偏差。
3. **grep 命中「表单作答/表单跳过」于 description**：源码 :24-25 description 内
   仍含 `表单作答` / `表单跳过` 字符串属**故意保留**（plan §4 边界：答案信封标记
   是用户消息首行特征串，前端 ChatPanel + core parseAskAnswer 共契约守门），
   与软终止 text 段（:97-103）的全英文独立评估——非偏差。

## 发现的问题

无。

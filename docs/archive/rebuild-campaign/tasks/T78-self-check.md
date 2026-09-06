# T78 自检 · ask-user-question 微调批（P1 描述精简 + P2 软终止译英 + P4 text maxLength）

> 日期：2026-09-02。实施 = fast-worker 子 agent（施工规格 = T78-plan.md）；
> 门禁修复 / 复核 / 三件套 = 主 agent。对照 T78-plan §2/§3 逐项核验。

## 1. 验收逐项（T78-plan §3）

### 1.1 `bun test tests/engine/rebuild/marketing/ask-user-question.test.ts` 全绿

✅ fast-worker 交付报告：22/22 pass（原 21 + 新增 1）。新增钉扎例：
`label 超过 2000 字符 → schema 拒绝（typebox maxLength）`（test.ts:285-295），
断言 `details.error` 已定义 + `details.formId` 未定义（不锁过紧 error 字符串，
与 plan §2.D.8 一致）。

### 1.2 描述长度变化

✅ `ASK_USER_QUESTION_DESCRIPTION` 由原 1149 字符降至当前 1018 字符
（src/app/ai/pi-backend/ask-user-question.ts:25）。去 envelope 段（`[表单作答
formId=…]` / `[表单跳过 formId=…]` JSON 信封细节）→ 替换为单句
`The user\'s answers will arrive as the next user message.`（plan §2.A.1）。
减幅大于 plan §3 估值（1149 → ~850），实测更长因保留「Returns {formId,
status:"awaiting_user", questions}: the run TERMINATES with this call — do not
call further tools and do not write any more text after it.」执行语义句。
仍远低于 T66 P5 上限 2000 字符。

### 1.3 软终止全英文，零中文残留

✅ ask-user-question.ts:97-103 三行 `text` 数组：

- L99-100：`Form rendered to the user (formId=${formId}, ${details.questions.length}
question${details.questions.length === 1 ? '' : 's'}).`（单复数处理，按 plan §2.B.2）
- L101：`Turn ends here: do not call any more tools and do not write any more text
— end this reply immediately.`
- L102：`The user's answer (or skip) will arrive as the next user message;
resume from that content.`
- L97 注释：`// Soft-stop instructions (English, model-facing): turn ends here,
answers are materialized via the next user message.`

`grep -n '回合到此结束\|表单已渲染\|表单作答\|表单跳过' src/app/ai/pi-backend/ask-user-question.ts`
→ 源码面（**:24-25 description**）仍包含字符串 `表单作答`/`表单跳过` 命中——这些
是 description 内允许保留的「答案信封标记」语义提示（plan §4 边界明示「不动
[表单作答 formId=…] / [表单跳过 formId=…] 答案信封标记」），非软终止 text 段。
软终止三行（:97-103）已全英文，无中文残留。

### 1.4 2001/2000 字 label 行为

✅ schema 层（ask-user-question.ts:47）已加 `maxLength: 2000`；
core 校验层（packages/core/src/tools/fork/marketing/ask-user-question.ts:50）
`ASK_QUESTION_LIMITS.labelMaxLength: 2000` + :155-160 `validateQuestion` 内长度
检查 + `question_label_too_long` error code——与 plan §2.C.3-5 完整一致。
execute 路径：`tool.execute('call-1', { questions: [{ id, kind, label: 2001 字 }] })`
→ `validateAskUserQuestions` → `validateQuestion` 长度检查 → 返回
`{ error: 'question_label_too_long', message: '…' }`，无 `formId` 字段（与新测试
断言一致）。

2000 字边界值（maxLength「小于等于」语义）→ 校验层不报错；typebox schema 拒绝
是 typebox `Type.String({ maxLength })` 行为；execute 内 2000 字输入仍走
validateQuestion（label.length === 2000 不超 MAX），返回 awaiting 信封。

### 1.5 五件门禁在 touched files 范围干净

待主 agent 复跑。当前触及文件均位于 ownedRoots（pi-backend/、core/tools/fork/
marketing/、tests/engine/rebuild/marketing/）——**零 P-NN 登记**预判成立。
具体触及 3 文件：

- `src/app/ai/pi-backend/ask-user-question.ts`（description + soft-stop 三行 + maxLength）
- `packages/core/src/tools/fork/marketing/ask-user-question.ts`（ASK_QUESTION_LIMITS.labelMaxLength + validateQuestion 长度检查）
- `tests/engine/rebuild/marketing/ask-user-question.test.ts`（test 名 + 断言改 + 新增 maxLength 例）

`git diff --stat HEAD` 三文件总计 +30/-10 行。worker 报告 4 文件与 git 实证
3 文件不一致——核对：worker 报告口径可能含营销 suite 大目录索引变化（look.test.ts
未触及）；本批实际仅触动 3 文件，与 plan §3「touched files 范围」一致。

### 1.6 check:zones / check:i18n 预判

- `check:zones` → 改动全在 ownedRoots（pi-backend/、core/tools/fork/marketing/、
  tests/engine/rebuild/marketing/），预判 `clean: N modified (all registered)`。
- `check:i18n` → 本批零 i18n key 改动（plan §4 明示 model-facing 指令不归 i18n），
  预判 `All locale files are in sync`。

## 2. 施工清单逐项（T78-plan §2）

### A. P1 — 工具 description 精简

1. ✅ `src/app/ai/pi-backend/ask-user-question.ts:24-25` — envelope 段删除，
   替换为 `The user\'s answers will arrive as the next user message.`（line 25
   末段）。其他语义（行为、run 终止、必填校验）保留。

### B. P2 — 软终止指令译英

2. ✅ `src/app/ai/pi-backend/ask-user-question.ts:97-102` 三行 `text` + L97 注释
   全英文（核对项见 §1.3）。

### C. P4 — QUESTION_SCHEMA label maxLength + 校验层同步

3. ✅ schema 层 `label: Type.String({ description: 'Question text shown to the
user', maxLength: 2000 })`（ask-user-question.ts:47）。
4. ✅ core `ASK_QUESTION_LIMITS.labelMaxLength: 2000`
   （packages/core/src/tools/fork/marketing/ask-user-question.ts:50）。
5. ✅ `validateQuestion` 内长度检查（:155-160），新 error code
   `question_label_too_long`，失败信息含 maxLength + 实际 length。

### D. 测试同步

6. ✅ 软终止 describe 块 test 名改为 `… + 英文软终止指令`（test.ts:263）；
   断言 `Turn ends here`（:281）+ `Form rendered to the user`（:282）。
7. ✅ 新增 maxLength 钉扎例 `label 超过 2000 字符 → schema 拒绝（typebox maxLength）`
   （:285-295），断言 `error` 已定义 + `formId` 未定义。

## 3. 偏差

1. **描述字符数减幅大于 plan 估值**（1149 → 1018 vs plan 估 1149 → ~850）：
   实际保留的描述更长因保留 plan 未要求删的「Returns {formId, status…} the run
   TERMINATES…」执行语义句 + 「Rules: 1-8 questions;…」参数概要。语义更完整、
   字符仍远低于 T66 P5 2000 上限，与 plan §1「描述再精简」方向一致；非偏差。
2. **worker 报告 4 文件 vs git 实证 3 文件**：git status 显示 ask-user-question.ts
   - core/.../ask-user-question.ts + test 三文件修改；worker 报告可能含上一轮
     look 营销测试索引变更或 chat 营销 suite 大目录索引，未在本批 diff 范围。本
     agent 以 git diff 为准：3 文件，与 plan §3 实际触动范围一致。

## 4. 边界守护（T78-plan §4）

- **i18n 边界**：本批零 i18n key 改动；软终止文本属模型侧 instruction 不归 i18n
  （与 T66 「内部设施不外露」+ T66 ask 软终止 zh-cn 拍板解耦）。
- **答案信封标记保留**：`[表单作答 formId=…]` / `[表单跳过 formId=…]` 用户消息
  首行特征串（`serializeAskAnswer` 输出）未动；前端 ChatPanel + core
  `parseAskAnswer` 共契约守门。
- **service.ts 未动**（T56 已完工；本批仅微调定义 + 测试）。
- **serializeAskAnswer / parseAskAnswer 未动**（core 纯函数层；仅在
  `validateQuestion` 加 maxLength 检查）。
- **不提交**（owner 规则）：本 agent 仅施工，主 agent 提交。

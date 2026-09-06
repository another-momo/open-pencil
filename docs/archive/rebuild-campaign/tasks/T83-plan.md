# T83 plan——ask freeText 升格第四种答案 + brief 删 Header Binding 行

> **立项**：2026-09-02 owner 指令合并两件已批准未排期项为一个 task：
> ① ask 评审 P3（freeText 语义与用户心理模型不一致）——freeText 升格为第四种答案，
> 施工前先回 S1/S3/S4 修订契约；② brief 评审 S2（Header Binding 与关联设计区重复）——
> 三处联动删除。父仓评审文档：`docs/202609010000-ask-user-question-review.md` 问题 3、
> `docs/202609010000-brief-system-review.md` S2。

## §1 定谳

### 定谳 1（契约形状）：freeText 走 `[表单作答]` 信封的可选同级键，不用哨兵键、不加第三标记

评审原案草案是 `answers['__freeText']` 哨兵注入。本 plan 改为同级可选字段：

```typescript
export type AskAnswerPayload =
  | { aborted: false; answers: Record<string, string>; freeText?: string }
  | { aborted: true; freeText: string }
```

理由：answers 映射会被 AI 读去写 brief 结论区，哨兵键会混进结论转写；同级键自描述、
不污染。关键收益——**标记不变**：freeText 作答仍骑 `[表单作答 formId=…]` 首行标记，因此
`ChatPanel.vue:107` answeredFormIds 派生（扫 user 消息 parseAskAnswer）与
`active-design-host.ts:346-347` ④ 移槽（仅 `[表单作答]` 构成目标授权）**零改动即自动覆盖**，
跳过依旧不移槽。「第四种答案 = 一种决策」的语义与移槽规则天然一致。

- 序列化：调用方（卡片）仅在 freeText 非空时带上该键；serializer 原样 JSON 透传。
- 解析：非中止分支仅当 `typeof payload.freeText === 'string' && trim() !== ''` 时才把
  `freeText` 写进结果对象（条件构造，不留 `freeText: undefined` 键）——
  round-trip 既有 `toEqual` 钉扎（无 freeText 的信封）保持绿。

### 定谳 2（UI 语义）：提交按钮双通道，必填校验在 freeText 非空时豁免

`AskUserQuestionCard.vue handleSubmit`：

- `freeText.trim()` 非空 → 跳过 missingRequired 校验，收集已答题目（可为空/部分），
  emit `{ formId, aborted: false, answers, freeText: trimmed }`，submittedKind = 'answer'。
- freeText 为空 → 维持现有必填校验路径不变。
- `handleSkip` 不动（跳过理由语义不变）；徽标两态不变（freeText 作答 = 已作答）。
- i18n 零改动：`askSkipPlaceholder` 现文案「其他 / 补充说明（可选）…」对第四种作答
  角色已成立；不新增键、不改文案。
- 模板注释 L264「逃生口：自由文本 + 跳过（必带，S3 §6）」更新为双角色表述
  （第四种作答 + 跳过理由）。

### 定谳 3（模型面知情）：软终止指令与工具描述各补一句

- `src/app/ai/pi-backend/ask-user-question.ts` 软终止英文文本（:99-103）补一句：
  作答信封 JSON 可能带可选 `freeText` 键，它是用户原话，属一等答案内容。
- 同文件 `ASK_USER_QUESTION_DESCRIPTION` 补一句同款说明（模型填 questions 时知情）。
- `studio/workflows/longform.md:90` 双信封语义处同步一句（freeText 可随作答信封回传）。

### 定谳 4（S2 删除范围）：三处联动 + 常量/文案/测试尾部清扫，共 5 文件

删除 Header Binding 可见行（保留关联设计区 DesignList 为唯一绑定展示）：

1. `brief.ts` L494-498 createText（含 L494 注释）、L74 `BRIEF_BINDING_LABEL_NAME` 常量、
   L636-661 `setBriefBindingLabel` 整函数。
2. `texts.ts` L12 `bindingUnbound`、L14 `bindingPrefix`（grep 确认仅此三处消费）。
3. `setup.ts` L343-347 调用、L340 注释去「可见绑定行」行文、L49 import 去
   `setBriefBindingLabel`、L52 import 去 `BRIEF_TEXTS`（保留 `SETUP_TEXTS`）。
4. `brief.test.ts` L266-285 测试去 L280-284 断言块并改标题（去「Binding 行重写」）、
   L55 import 去 `setBriefBindingLabel`；若 `walkTexts`/`BRIEF_TEXTS` 因此无引用则一并
   去 import（施工时 grep 核实）。
5. `setup.test.ts` ⑨ 测试（L243）标题去「绑定行」、删 L266-275 遍历断言块、
   L50 import 去 `BRIEF_TEXTS`（保留 `SETUP_TEXTS`）。

### 定谳 5（契约回写，先于代码）：S1 §4 / S3 §6 / S4 修订注记

父仓 plain 文件（非 git）：

- `doc/S3-tool-contracts-spec.md` §6：
  - 框内签名尾改 `→ { answers: { [id]: ... }, freeText? } 或 { aborted: true, freeText? }`；
  - L97「必带『其他/补充』自由文本逃生口……」行改写为：必带自由文本输入——它同时是
    **第四种作答**（随 `[表单作答]` 信封可选 `freeText` 键回传，非空时必填校验豁免）
    与跳过理由（随 `[表单跳过]` 回传）；
  - L98 修订注记末尾追加：2026-09-02 T83 补充——作答信封 JSON 非中止分支增可选
    `freeText` 键，freeText 升格第四种答案（ask 评审 P3）。
- `doc/S1-product-spec.md` L93 表单能力集尾项：「『其他/补充』自由文本逃生口」→
  「『其他/补充』自由文本（第四种作答，亦作跳过理由）」。
- `doc/S4-phase3-plan.md` 头部修订行追加 v10 注记：2026-09-02 T83——ask freeText
  升格第四种答案（评审 P3）；brief Header Binding 可见行删除（评审 S2，关联设计区
  DesignList 为唯一绑定展示）。

### 定谳 6（不做清单）

- 不加第三标记 `[表单自由文本]`（ChatPanel 派生与宿主移槽会被迫三配，收益为零）。
- answeredFormIds 不携带 aborted 信息（T56 钉在案的降级口径不动）。
- 徽标不加第三态；i18n 不加键；`ChatMessage.vue`/`ChatPanel.vue`/`active-design-host.ts`
  零改动（自动覆盖，见定谳 1）。

## §2 施工清单（worker 执行顺序）

**先契约（父仓 plain 文件）**，再代码，最后测试钉扎：

1. 父仓 S3 §6 / S1 L93 / S4 修订注记（定谳 5 全文）。
2. `packages/core/src/tools/fork/marketing/ask-user-question.ts`：
   - AskAnswerPayload 加 `freeText?: string`（定谳 1）；
   - parseAskAnswer 非中止分支条件构造 freeText（定谳 1）；
   - 头注 L13-16 信封格式行文同步（`{"aborted":false,"answers":{…},"freeText"?:"…"}`）。
3. `src/components/chat/AskUserQuestionCard.vue`：handleSubmit 双通道（定谳 2）+
   L264 注释更新。
4. `src/app/ai/pi-backend/ask-user-question.ts`：软终止文本 + description 各一句
   （定谳 3）。
5. brief 五文件删除（定谳 4）。
6. `studio/workflows/longform.md` 一句同步（定谳 3）。
7. 测试钉扎：
   - `ask-user-question.test.ts` 新增：带 freeText 的作答信封 serialize→parse 还原；
     不带 freeText 的作答信封 parse 结果无 freeText 键；freeText 为空白串时 parse 丢弃。
   - `ask-user-question-roundtrip.test.ts` 新增：带 freeText 的信封经 JSONL 存续后
     parse 还原（answers + freeText 齐）。
   - `brief.test.ts` / `setup.test.ts` 按定谳 4 改。

## §3 门禁与自评

- 本地只跑直接受影响测试（owner 禁令：不全量 bun test）：
  `bun test tests/engine/rebuild/marketing/ask-user-question.test.ts tests/engine/rebuild/marketing/ask-user-question-roundtrip.test.ts tests/engine/rebuild/marketing/brief.test.ts tests/engine/rebuild/marketing/setup.test.ts`
- 七门禁（unpiped）：check:arch / check:bindings / check:docs / check:drift / check:dupes /
  check:i18n / test:rebuild——由主 agent 跑；worker 跑受影响测试 + `oxfmt --write` 仅触及文件。
- zone 预检：全部触及文件在 ownedRoots（packages/core/src/tools/fork/marketing/、
  src/components/chat/、src/app/ai/pi-backend/、tests/engine/rebuild/）——预期零 P-NN。
- 完成后 worker 写 `T83-self-check.md`（含偏差记录），主 agent 派独立核验。

## §4 回写与登记（主 agent）

- tracker.md + tasks/_index.md 加 T83 行。
- 父仓评审回写：ask 评审头 P3 ⏳→✅ T83；brief 评审头 S2 ⏳→✅ T83。
- 提交序列：plan（本文件）→ 代码+测试 → self-check/verify/登记，均带 `task: T83` 令牌。

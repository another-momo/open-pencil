# T83 verify——ask freeText 升格第四种答案 + brief 删 Header Binding 行

> **独立核验**（只读核验 + 本报告为唯一写入；未改代码、未 git add/commit、未读 .openpencil/key-env、未全量跑测试）。
> 日期：2026-09-02。核验基点：HEAD = f44613a73（branch rebuild/mode-arch）+ 工作区未提交 diff（11 文件修改，零新建；另有一未跟踪文件 docs/rebuild/tasks/T83-self-check.md）。
> 对照：T83-plan.md §1 定谳 1-6 / §2 施工清单；T83-self-check.md 自评。

## 结论速览：**17/17 PASS**

| 区 | 项 | 结果 |
|---|---|---|
| A freeText 升格 | 1-5 | PASS ×5 |
| B S2 删除 | 6-10 | PASS ×5 |
| C 测试钉扎 | 11-13 | PASS ×3 |
| D 契约回写 | 14-16 | PASS ×3 |
| E 不做清单 | 17 | PASS |

---

## A. freeText 升格（定谳 1/2/3）

### 1. core ask-user-question.ts：类型 + 条件物化 + 头注 —— **PASS**

- `packages/core/src/tools/fork/marketing/ask-user-question.ts:244`：
  `| { aborted: false; answers: Record<string, string>; freeText?: string }`——非中止分支增可选
  `freeText?: string`；中止分支（:245）维持 `freeText: string` 不变。
- 解析条件物化：:293-297——`const parsed: ParsedAskAnswer = { formId, aborted: false, answers }`
  后仅当 `typeof payload.freeText === 'string' && payload.freeText.trim() !== ''` 才
  `parsed.freeText = payload.freeText`——条件构造，不留空键/undefined 键；:280-286 中止分支
  原文未动（缺省 `''` 兜底不变）。
- `ParsedAskAnswer = { formId: string } & AskAnswerPayload`（:255）自动继承可选键，类型面自洽。
- 头注 :15-17 同步：信封格式行文 `{"aborted":false,"answers":{…},"freeText"?:"…"}`，并注明
  「作答分支的 freeText = 第四种作答（用户原话，一等答案内容；T83 升格，S3 §6），跳过分支的
  freeText = 跳过理由」。

### 2. AskUserQuestionCard.vue：handleSubmit 双通道 —— **PASS**

- `src/components/chat/AskUserQuestionCard.vue:82-101`：
  - :84 `const trimmedFreeText = freeText.value.trim()`；
  - :86 `if (!trimmedFreeText && missingRequired.value.length > 0)`——freeText 非空时豁免
    missingRequired 必填拦截；为空时原校验路径逐字不变（:87-88 showRequiredHint + return）；
  - :95 `submittedKind.value = 'answer'`（两通道共用，徽标 = 已作答态）；
  - :96-99 freeText 非空 → `emit('submit', { formId, aborted: false, answers, freeText: trimmedFreeText })`
    并 return；:100 空 freeText → 原 emit（无 freeText 键）——调用方仅在非空时带键，合定谳 1 序列化约定。
- handleSkip（:103-107）与 HEAD 原文逐字一致（diff 中无该函数 hunk）。
- 徽标仍两态：:169 `submittedKind === 'skip' ? askDialogs.askSkipped : askDialogs.askAnswered`，无第三态。
- 模板注释 :270 已更新为双角色表述（「自由文本：第四种作答（随提交回传，豁免必填）+ 跳过理由
  （必带，S3 §6 / T83）」）。

### 3. 零改动面 —— **PASS**

`git diff HEAD --name-only` 全量输出恰为 11 个文件（4 core + 3 src + 4 tests）；
`src/components/ChatPanel.vue`、`src/components/chat/ChatMessage.vue`、
`src/app/ai/pi-backend/active-design-host.ts` **均不在 diff 中**。现状抽查：
ChatPanel.vue:107 answeredFormIds 派生、active-design-host.ts:347「仅 [表单作答] 移槽」注释
均原样在案——freeText 骑 `[表单作答]` 标记，派生与移槽零改动自动覆盖的定谳 1 推论成立。

### 4. pi-backend ask-user-question.ts：双知情句 + 转义 —— **PASS**

- `src/app/ai/pi-backend/ask-user-question.ts:103` 软终止文本第 4 句：
  `'The answer envelope JSON may include an optional "freeText" field with the user\'s own words — treat it as a first-class answer.'`
- :25 `ASK_USER_QUESTION_DESCRIPTION` 增：「always offers a free-text field that doubles as a
  fourth answer kind (the user\'s own words, may arrive as an optional "freeText" key on the
  answer envelope) and as a skip reason」。
- 两串均为单引号串，`user\'s` 转义正确（self-check 偏差 2 记载的加载错误已修复；本核验
  C13 复跑 69 全绿，加载无碍）。

### 5. longform.md 同步 —— **PASS**

- `src/app/ai/pi-backend/studio/workflows/longform.md:90` 运行语义段：作答信封 JSON 行文改为
  `{"aborted":false,"answers":{…},"freeText"?:"…"}`（可选 freeText = 用户原话，一等答案内容，按内容采纳）。
- :92 原「逃生口」段改写为「自由文本双角色（T83，S3 §6）」段——第四种作答（随作答信封 freeText
  键回传，非空时豁免必填校验）+ 跳过理由。与 self-check 偏差 4 记载的顺带扩写一致。

## B. S2 删除（定谳 4）

### 6. brief.ts 三处删除 + import 无误删 —— **PASS**

- `BRIEF_BINDING_LABEL_NAME` 常量（原 L74-75）已删（diff hunk @@ -70,8 +70,6 @@）。
- header 内 createText 绑定行块（原 L494-498 含注释）已删（diff hunk @@ -491,11 +489,6 @@）。
- `setBriefBindingLabel` 整函数（原 L636-661 含 jsdoc）已删（diff hunk @@ -633,33 +626,6 @@）。
- import 无误删：`FigmaAPI`（brief.ts 全文 10+ 处使用，:29 import 保留）、`isBrief`
  （:140/146/152/161/195/222/664/732/805/846 等处仍在用）、`SUB_COLOR`（:117 定义，
  :401/436/489/589/623/693/828 等处仍在用）、`createText`（:252 定义，:353/359/398/482/487/
  505/510/533/539/560/585/591/620/690/697/703/825 等处仍在用）。
- 保留面正确：`BRIEF_BINDING_KEY = 'bound-designs'`（:40）及 bindBriefToDesign 指针逻辑
  （:153/164）原样——S2 只删可见行，绑定标记本体不动。

### 7. texts.ts 删两键、其余完整 —— **PASS**

- `packages/core/src/tools/fork/marketing/texts.ts`：bindingUnbound / bindingPrefix 两键（含 jsdoc）
  已删（diff hunk @@ -8,10 +8,6 @@）。
- 全文通读确认其余键完整：BRIEF_TEXTS 余 17 键（briefName/subtitle/contentZoneName/
  contentZoneBadge/contentExample/fieldsHint/materialsZoneName/materialsZoneBadge/
  materialsEmptyHint/materialNote/conclusionsZoneName/conclusionsHint/conclusionsEmptyStatus/
  designsZoneName/designsZoneBadge/designsEmptyHint/deletedMark/missingProjection）；
  SETUP_TEXTS、ACTIVE_DESIGN_TEXTS 两对象零改动。

### 8. setup.ts 调用 + import + 注释行文 —— **PASS**

- `packages/core/src/tools/fork/marketing/setup.ts:339` 注释改为「brief 关联：bound-designs 指针 +
  关联设计区条目」——「可见绑定行」行文已去。
- `setBriefBindingLabel(...)` 调用块（原 L343-347）已删；:341-342 余 `bindBriefToDesign` +
  `registerBriefDesignEntry` 两行。
- import 清扫：:46-51 './brief' import 去 `setBriefBindingLabel`（余 BRIEF_ROLE_KEY 等 8 项 +
  BriefCandidate 类型）；:51 `import { SETUP_TEXTS } from './texts'`——BRIEF_TEXTS 已去、
  SETUP_TEXTS 保留。

### 9. 残留 grep 零命中 —— **PASS**

- `grep -rn "BRIEF_BINDING_LABEL_NAME\|setBriefBindingLabel\|bindingUnbound\|bindingPrefix"
  src packages/core/src packages/cli/src tests` → 零命中（exit 1）。
- `grep -rn "'Binding'"` 与 `"Binding"` 同范围 → 均零命中（exit 1）。
- 补充：brief.ts/setup.ts 内大小写不敏感 grep "binding" 仅剩 BRIEF_BINDING_KEY（'bound-designs'
  指针键）3 处在案引用——属保留面，非残留。

### 10. 测试改造 —— **PASS**

- `tests/engine/rebuild/marketing/brief.test.ts`：
  - :55 import 去 `setBriefBindingLabel`（余 12 项保留）；
  - walkTexts 辅助函数（原 L66-79）连同定义一并删除——本文件局部函数、唯一消费点即被删断言块，
    与 self-check 偏差 3 记载一致；
  - :251 标题改「bindBriefToDesign 走通用 upsert：幂等追加」（去「Binding 行重写」）；
  - L280-284 断言块（bindingPrefix 文案重写 + bindingUnbound 覆盖断言）已删；
  - upsert 主断言保留：:253-262 三次 bind + briefBoundDesignIds toEqual + getSharedPluginData
    'design-a,design-b' 逐字在案；
  - BRIEF_TEXTS import（:59）保留正确——:329/:364/:365 仍消费 missingProjection/deletedMark，
    合 plan「若无引用则去 import」的条件分支（有引用故保留）。
- `tests/engine/rebuild/marketing/setup.test.ts`：
  - :243 ⑨ 标题改「关联设计区登记：条目 designId + 名称投影 + bound-designs 指针 + 读穿三元组」
    （去「绑定行」）；
  - L266-275 遍历断言块（stack 遍历 + bindingPrefix 文案断言）已删；
  - :50 import 改 `import { SETUP_TEXTS } from '#core/tools/fork/marketing/texts'`——BRIEF_TEXTS
    已去、SETUP_TEXTS 保留（:210/:383/:438 仍消费）；
  - 读穿投影断言保留：:266-276 readBrief 视图 designs toEqual（entryId/designId/name/modeId/
    deleted/registered 六字段）逐字在案。

## C. 测试钉扎（定谳 §2.7）

### 11. ask-user-question.test.ts 新增两 test —— **PASS**

- :331-343「第四种作答（T83）：作答信封带 freeText 键，解析还原 answers + freeText」——
  serialize→首行标记断言→parse toEqual 含 freeText，round-trip 还原。
- :345-356「第四种作答（T83）：无 freeText 键不留键；空白 freeText 丢弃」——
  无 freeText 信封 parse toEqual 无键 + `'freeText' in noFreeText === false`；
  `"freeText":"  "`（空白串）parse 丢弃 + in 断言 false。

### 12. ask-user-question-roundtrip.test.ts 新增一 test —— **PASS**

- :156-183「第四种作答（T83）：带 freeText 的作答信封跨重载存续并还原」——serializeAskAnswer
  带 freeText → sessionFile 写入 → readPiHistoryFile 读出 → parseAskAnswer toEqual
  { formId, aborted:false, answers, freeText } 齐键还原。

### 13. 受影响测试复跑 —— **PASS**

命令（仅四文件，未全量）：
`bun test tests/engine/rebuild/marketing/ask-user-question.test.ts tests/engine/rebuild/marketing/ask-user-question-roundtrip.test.ts tests/engine/rebuild/marketing/brief.test.ts tests/engine/rebuild/marketing/setup.test.ts`

实测输出：**69 pass / 0 fail / 327 expect() calls，Ran 69 tests across 4 files [2.37s]**——
与 self-check §1.3 自报计数完全一致。

## D. 契约回写（定谳 5）

### 14. 父仓 S3 §6 三处 —— **PASS**

- `doc/S3-tool-contracts-spec.md:93` 框内签名尾：`→ { answers: { [id]: ... }, freeText? } 或
  { aborted: true, freeText? }`。
- :97 改写行：「必带自由文本输入——它同时是**第四种作答**（随 `[表单作答]` 信封可选 `freeText`
  键回传，非空时必填校验豁免）与跳过理由（随 `[表单跳过]` 回传）」。
- :98 修订注记尾部追加：「2026-09-02 T83 补充——作答信封 JSON 非中止分支增可选 `freeText` 键，
  freeText 升格第四种答案（ask 评审 P3）」。

### 15. 父仓 S1 L93 —— **PASS**

- `doc/S1-product-spec.md:93` 表单能力集尾项：「『其他/补充』自由文本（第四种作答，亦作跳过理由）」。

### 16. 父仓 S4 修订行 v10 —— **PASS**

- `doc/S4-phase3-plan.md:7` 修订行尾部：「2026-09-02 v10——T83：ask freeText 升格第四种答案
  （评审 P3，作答信封增可选 freeText 键、非空豁免必填、标记不变宿主零改动）；brief Header
  Binding 可见行删除（评审 S2，关联设计区 DesignList 为唯一绑定展示）」。

## E. 不做清单（定谳 6）

### 17. 四项守住 —— **PASS**

- 无第三标记：`grep -rn "表单自由文本" src packages/core/src packages/cli/src tests` →
  零命中（exit 1）。
- answeredFormIds 派生未动：ChatPanel.vue 不在 diff（见项 3），:107 派生块原样。
- i18n locale 文件不在 diff：`git diff HEAD --name-only | grep -i "locale\|i18n"` → 零命中；
  11 文件清单中无任何 locale 文件（合定谳 2「i18n 零改动」）。
- 徽标未加第三态：AskUserQuestionCard.vue:169 两态三元原样，`submittedKind` 类型
  (:68) 仍 `'answer' | 'skip' | null`。

---

## 总结论

**17/17 PASS。** T83 两项评审合并施工与 plan 定谳 1-6 逐项吻合；工作区 11 文件 diff 与施工清单
一一对应、零越界改动（零新建、零未列文件）；受影响测试 69 pass / 0 fail 与自评一致；父仓三份
契约文件回写先行在案。self-check 四条偏差记录（主 agent 代施工、`user\'s` 转义修复、walkTexts
连定义删、longform.md L92 顺带改写）均经本核验独立复验属实且处置得当。

**发现的问题清单：无 FAIL，无需修复项。**

（范围外观察，不构成 FAIL：父仓两份评审文档头的 P3/S2 状态回写 ⏳→✅ 按 self-check §4 约定
随收口 commit 完成，当前工作区未提交状态下尚不可见——属主 agent 收口动作，不在 T83 代码
施工核验范围。）

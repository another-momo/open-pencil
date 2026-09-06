# T83 self-check——ask freeText 升格第四种答案 + brief 删 Header Binding 行

> 2026-09-02 · 执行 = 主 agent（subagent 配额耗尽，worker 派单被拒，主 agent 按 plan 直接施工）。
> 门禁修复 / 复核 / 三件套 = 主 agent。对照 T83-plan §1/§2/§3 逐项核验。

## 1. 对照核验

### 1.1 定谳落地矩阵

| 定谳 | 内容 | 状态 | 证据 |
|---|---|---|---|
| 1 | freeText 走 `[表单作答]` 信封可选同级键，非哨兵非第三标记 | ✅ | core ask-user-question.ts AskAnswerPayload 非中止分支 `freeText?: string`；parse 条件构造（非空白才物化） |
| 1 推论 | ChatPanel 派生 / 宿主 ④ 移槽零改动 | ✅ | ChatPanel.vue:294 `const { formId, ...payload } = submission` 原样透传 serializeAskAnswer；answeredFormIds 与 active-design-host 未触碰 |
| 2 | 提交双通道 + freeText 非空豁免必填 | ✅ | AskUserQuestionCard.vue handleSubmit：`!trimmedFreeText && missingRequired` 才拦截；freeText 通道 emit `{aborted:false, answers, freeText}` |
| 2 | 徽标两态 / i18n 零改动 / handleSkip 不动 | ✅ | submittedKind='answer' 复用已作答徽标；locale 文件未触碰；handleSkip 原文 |
| 3 | 软终止文本 + description + longform.md 各一句 | ✅ | pi-backend ask-user-question.ts result 文本第 4 句 + description「doubles as a fourth answer kind…」；longform.md 运行语义段 `"freeText"?:"…"` + 自由文本双角色段 |
| 4 | S2 五文件删除 + 尾部清扫 | ✅ | brief.ts 删 createText 块/常量/整函数；texts.ts 删两键；setup.ts 删调用+注释行文+双 import 清扫；brief.test.ts 删断言块+walkTexts 辅助+import；setup.test.ts 删遍历断言块+import 清扫 |
| 5 | S1/S3/S4 契约先回写 | ✅ | S1 L93 第四种作答；S3 §6 签名尾 + L97 改写 + L98 T83 注记；S4 修订行 v10 注记（父仓 plain 文件，先行于代码） |
| 6 | 不做清单守住 | ✅ | 无第三标记；answeredFormIds 未动；徽标未加态；ChatMessage/ChatPanel/active-design-host 零 diff |

### 1.2 门禁 unpiped（2026-09-02 主 agent 复跑全绿）

- `bun run lint` → 0 errors（7 warnings 为存量）
- `bun run tsgo` → clean
- `bun run check:vue` → clean
- `bun run format:check` → 2173 files 全过
- `bun run check:zones` → clean，零新 P-NN 登记（触及文件全部在 ownedRoots）
- `bun run check:i18n` → in sync（零键变更，沿 plan §1 边界）
- `bun run check:docs` → 44/44

### 1.3 受影响测试（owner 禁令：不全量）

`bun test` 四文件：**69 pass / 0 fail / 327 expect()**（ask-user-question.test.ts、
ask-user-question-roundtrip.test.ts、brief.test.ts、setup.test.ts）。
新增钉扎 4 条：作答信封 freeText round-trip、无 freeText 不留键、空白 freeText 丢弃、
JSONL 存续后 freeText 还原。

### 1.4 grep 证据

- `BRIEF_BINDING_LABEL_NAME|setBriefBindingLabel|bindingUnbound|bindingPrefix`（src +
  packages/core/src + packages/cli/src + tests）→ **零残留**（exit 1）。
- `'Binding'` 字符串字面量同范围 → **零残留**（exit 1）。
- brief.ts 删函数后 `FigmaAPI` 仍 13 处使用、`isBrief` 仍 5 处使用——import 无误删；
  setup.test.ts `expectDefined` 仍 28 处使用——import 保留正确。

## 2. 文件变更清单

**修改 11（worktree，零新建）**：

1. packages/core/src/tools/fork/marketing/ask-user-question.ts（payload 类型 + parse + 头注）
2. packages/core/src/tools/fork/marketing/brief.ts（删常量/创建块/整函数）
3. packages/core/src/tools/fork/marketing/texts.ts（删 bindingUnbound/bindingPrefix）
4. packages/core/src/tools/fork/marketing/setup.ts（删调用 + import 清扫 ×2 + 注释行文）
5. src/components/chat/AskUserQuestionCard.vue（handleSubmit 双通道 + 注释）
6. src/app/ai/pi-backend/ask-user-question.ts（description + 软终止文本）
7. src/app/ai/pi-backend/studio/workflows/longform.md（信封语义 + 双角色段）
8. tests/engine/rebuild/marketing/ask-user-question.test.ts（+2 pins）
9. tests/engine/rebuild/marketing/ask-user-question-roundtrip.test.ts（+1 pin）
10. tests/engine/rebuild/marketing/brief.test.ts（删断言块/walkTexts/import，改标题）
11. tests/engine/rebuild/marketing/setup.test.ts（删遍历断言块/import，改标题）

**父仓 plain 文件 3**：doc/S3-tool-contracts-spec.md（§6 三处）、doc/S1-product-spec.md（L93）、
doc/S4-phase3-plan.md（修订行 v10）。

## 3. 偏差记录

1. **subagent 配额耗尽，施工改由主 agent 执行**（plan §3 原定 fast-worker）。
   Agent 工具返回「已达到 Token Plan 用量上限(2056)」。施工本身无技术偏差；
   独立核验若配额持续不可用则顺延，已在 tracker 行注明。
2. **语法错误一处，当场修复**：description 单引号串内 `user's` 未转义导致
   bun 加载报 Expected ";"——转义为 `user\'s` 后四文件 69 全绿。首轮测试输出的
   "1 fail + 1 error" 即此加载错误级联，非逻辑失败。
3. **walkTexts 辅助随断言块一并删除**（plan 定谳 4 第 4 条「若无引用则去 import」
   的升级处置）：该 helper 为本文件局部函数且唯一消费点是被删断言块，留着即成
   dead code（lint unused 会抓），故连同定义一起删。
4. **longform.md L92「逃生口」段一并改写**（plan §2 第 6 条的顺带扩写）：原段
   「前端恒带『其他/补充』自由文本跳过通道」与新语义冲突，按定谳 2 双角色口径
   重写——属同一行文连贯性修复，不单列任务。

## 4. 遗留与边界

- 既有钉在案降级（S4 L127：answered 态靠 formId 相关性派生）不动；freeText 作答
  骑 `[表单作答]` 标记，重载置灰派生自动覆盖。
- 第四种作答触发宿主 ④ 移槽（与结构化作答同律）——契约层 S3 §9 四事件行文
  「CP 表单作答」已涵盖，无需另修。
- 父仓两份评审文档头的 P3/S2 状态回写（⏳→✅ T83）随收口 commit 一并完成。

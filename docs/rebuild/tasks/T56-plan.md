<!--
  写作纪律（改本文前必读）：
  - 事实性声明必须附核验命令 + 日期，否则标为【假设】
  - 本文只保留当前态，不保留修正历史
  - 详细规则见 docs/rebuild/05-process.md §4
-->

# T56 计划 · Phase 3 W2/T-B5：ask_user_question 新建（表单定义/聊天内渲染/run 终止续跑/逃生口/图像候选项）

> **状态**：✅ 已完成（2026-09-01 收口） | **时间**：2026-09-01 立项 | **负责人**：主 agent + 实现 subagent
> **规格真源**：[S3-tool-contracts-spec.md §6/§9/§10](../../../doc/S3-tool-contracts-spec.md)、[S1-product-spec.md §5/§6/§9](../../../doc/S1-product-spec.md)、[S4-phase3-plan.md](../../../doc/S4-phase3-plan.md) T-B5 行 + v5 拍板（run 终止续跑）
> **移植源**：无——全新建（旧仓 grep `ask_user_question|askUserQuestion` 零命中，旧 CP = 纯文本回复，2026-09-01 Explore agent 调研在案）
> **调研在案**：2026-09-01 Explore agent 产出（行号证据见下）

## 1. 背景与方案

AI 调工具发表单 → 前端聊天流内渲染表单卡片 → **run 正常终止**（无进程内挂起态，owner 2026-08-31 v5 拍板）→ 用户作答作为新回合触发续跑，结构化答案序列化进用户消息文本。现场由落盘设计身份 + brief + 会话历史（未答表单 tool part）承载（runState 不落盘，S4 v6）。

**关键设计定谳**（调研开放项裁决）：

1. **双件布局**（仿 T54 image-gen 前后分层先例）：core `ParamDef` 无嵌套对象类型（schema.ts:15-23 实测），`questions[]` 无法经 FORK_TOOLS/桥注册——
   - `packages/core/src/tools/fork/marketing/ask-user-question.ts`（新建）：**纯**表单定义校验器 + 类型 + formId 生成 + 答案信封序列化/解析器（无 figma 依赖，bun 直接可测）。
   - `src/app/ai/pi-backend/ask-user-question.ts`（新建）：`createAskUserQuestionTool()` 用 pi `defineTool` + raw TypeBox（先例：image-gen/generate.ts:28-33）；execute 校验通过 → 返回 `{ formId, status: 'awaiting_user', questions }`（content + details 双带），结果文本含「回合到此结束、等待用户作答」指令（**软终止**——pi 无硬停机制，sdk.d.ts grep 无 ask/elicitation API，2026-09-01 在案）。
2. **注册缝**：service.ts customTools 追加（:202-207 区段）——**冻结面，主 agent 集成**。mapping.ts/history.ts/transport.ts/server.ts **零改动**：tool-input-available 已带全参（mapping.ts:85-92），输出骑 details（mapping.ts:122-136），`readPiHistoryFile` 恢复 tool part 含 `input.questions`（history.ts:62-89）——未答表单跨重载存续是既有能力，本任务钉测试作证。
3. **答案信封格式**（用户消息文本，钉死进契约测试）：
   - 作答：首行 `[表单作答 formId=<id>]` + 次行 JSON `{"aborted":false,"answers":{"<qid>":<值>}}`
   - 逃生口（「其他/补充」自由文本，必带，S3 §6 L94）：首行 `[表单跳过 formId=<id>]` + 次行 JSON `{"aborted":true,"freeText":"..."}`
   - 序列化器/解析器 = core 侧 `serializeAskAnswer`/`parseAskAnswer`（正则首行标记 + JSON parse 容错），前端提交路径与测试共用。server.ts 只读 text parts（:91-96 实测）→ 文本信封零后端改动。
   - **`{aborted:true}` 语义修订**：S3 §6 L90 的返回值形态被 v5 拍板取代——工具结果恒为 awaiting 信封；answers/aborted 经**下一条用户消息**物化。S3 §6 加修订注记（主 agent 同步文档）。
4. **校验规则**（钉死）：questions 1..8；id 唯一非空；label 非空；kind ∈ `single_select | image_select | text`；single_select → options 2..12（每个 `{id,label,hint?}` id 唯一）且不得带 imageOptions；image_select → imageOptions 1..12（每个 `{nodeId,label?}` nodeId 非空）且不得带 options；text → 不带 options/imageOptions；required 缺省 true。校验失败 → `{ error, message }` 结构化返回（不 throw）。**Case B 复用锚**：四项 payload（①旧设计保留声明 ②新模式新设计区 ③携带物逐项勾选 ④废弃半径声明）用现有 kinds 组合（single_select/text）可通过校验——测试钉扎；Case B 选项集与话术本体是 T-B9 开放尾巴（S4 §7 L108），本任务不定稿。
5. **formId**：`form-<时间戳36进制>-<随机6位>`，core helper 可注入 now/rand 源（测试确定性）。
6. **前端渲染**（全部新 capability，旧仓无先例）：
   - `src/components/chat/AskUserQuestionCard.vue`（新建）：从 tool part `input.questions` + `output` 渲染；single_select 选项卡片组 / image_select 缩略图网格 / text 输入；必填校验；提交后本地禁用态；逃生口自由文本框 + 「跳过表单」入口。
   - `ChatMessage.vue`（修改 :68 区段）：`getToolName(part) === 'ask_user_question'` 分支到卡片，先于通用折叠卡（:69-118）。
   - `ChatPanel.vue`（修改）：`handleFormSubmit(payload)` 序列化信封 → 复用 `handleSubmit`/`sendMessage`（:203-226）；streaming 中禁提交（:204 guard 同律）。
   - **answered 派生**：ChatPanel computed `answeredFormIds`（扫 user 消息首行标记正则）→ prop 链传给 ChatMessage → card；重载后已答表单置灰（formId 相关性是唯一信号，降级可接受已钉）。
   - **图像候选缩略图**：nodeId → 当前编辑器 store 的渲染导出能力（T55 已落 `store.renderExportImage`，figma-factory.ts 接线在案）→ dataURL 缩略图；节点缺失/导出失败 → 占位块显 label（不崩）。v1 仅当前编辑器文档（跨文档解析 = 后续，尾巴表）。
7. **i18n**：卡片文案外置进 `src/app/i18n/fork/`（ownedRoot，三文件：index.ts/locales/en.ts/locales/zh-cn.ts；`useForkPi` 先例 ChatInput.vue:14-16）。
8. **active_design 事件④耦合**：表单作答移动 active 指针属 T60（T-B9）——宿主按 run 上下文（回合目标 = 当时 active_design）+ formId 相关性推导，**工具签名不加字段**（S3 §6 签名 owner 已冻）。尾巴表登记该绑定口径。
9. **undo-group**：表单回合无突变，begin/end 发信无害（undo-group.ts:23-43），零改动、零特判。

**文件布局**：

| 文件 | 内容 | zones |
|---|---|---|
| packages/core/src/tools/fork/marketing/ask-user-question.ts | 纯校验/类型/信封序列化 | ownedRoot 免登记 |
| src/app/ai/pi-backend/ask-user-question.ts | pi 工具工厂（TypeBox raw） | ownedRoot 免登记 |
| src/components/chat/AskUserQuestionCard.vue | 表单卡片（新建） | **集成期 zones 登记（ownedFiles 或 patch）** |
| src/components/chat/ChatMessage.vue | 卡片分支 | **集成期 zones 登记** |
| src/components/ChatPanel.vue | 提交路径 + answeredFormIds | **集成期 zones 登记** |
| src/app/i18n/fork/{index.ts,locales/en.ts,locales/zh-cn.ts} | 卡片文案键 | ownedRoot 免登记 |
| tests/engine/rebuild/marketing/ask-user-question.test.ts | 校验矩阵 + 信封 + Case B 组合 + 序列化 round-trip | ownedRoot 免登记 |
| tests/engine/rebuild/marketing/ask-user-question-roundtrip.test.ts | mapping/history 存续钉扎（import `@/app/ai/pi-backend/...`，image-gen 测试先例） | ownedRoot 免登记 |

**接线冻结纪律**：`pi-backend/service.ts`（customTools 注册）由主 agent 集成；实现 agent 不碰 service.ts、不碰 zones.json/tracker/_index、禁止 commit/push。前端三文件（卡片/ChatMessage/ChatPanel）归本任务独占（T53/T57 不碰前端）。

## 2. 不做清单

- CP 结构内容（workflow 文件职责，T-C2）；Case B 选项集/话术定稿（T-B9）；active_design 指针移动（T60）；表单硬终止机制（pi 无 API，软终止+纪律，T-D1 观察项尾巴表）。
- 前端组件单测设施（无 vitest 先例，不新建）；Playwright e2e 表单链路（延 T-D1/T-D3，尾巴表登记）。
- 跨文档图像候选解析（v1 仅当前编辑器文档）。

## 3. 验收标准

1. `bun test tests/engine/rebuild/marketing/ask-user-question*.test.ts` 全绿：校验矩阵（kind 互斥/数量界/唯一性/required 缺省/错误不 throw）、awaiting 信封字段钉扎（formId 模式/status/questions 回显）、Case B 四项组合过校验、序列化/解析 round-trip（含容错：坏 JSON/缺标记行 → null）、history round-trip（tool part 重载后 input.questions 完整）。
2. `bun test tests/engine/rebuild/` 全绿（既有 172 基线不回退）。
3. 前端三文件过 lint/typecheck/format（九门禁内）；卡片渲染逻辑可读性 review（无单测，靠核验 agent 走查 + T-D1 冒烟兜底）。
4. 九门禁全绿；zones.json 三文件登记带 `task: T56` 指针（集成期）。
5. CI 逐 push 口径绿。

## 4. 红线

- 不改 schema.ts / mapping.ts / history.ts / transport.ts / server.ts（本任务零改动声明，集成也不动）。
- 工具签名冻结 = S3 §6 L85-91（questions 数组，无 context 字段）；Case B 不定稿话术。
- 非模态不抢焦点（红线 #10）；逃生口必带；表单内无 mode 切换入口（S3 §6 L97）。
- 凭证/密钥无关；图像候选不落盘、不进凭证链。
- 并行波次纪律：禁止 commit/push、禁止碰 service.ts 与 zones.json/tracker/_index。

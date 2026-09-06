<!--
  写作纪律（改本文前必读）：
  - 事实性声明必须附核验命令 + 日期，否则标为【假设】
  - 本文只保留当前态，不保留修正历史
  - 详细规则见 docs/rebuild/05-process.md §4
-->

# T56 核验 · Phase 3 W2/T-B5：ask_user_question 新建（表单定义/聊天内渲染/run 终止续跑/逃生口/图像候选项）

> **状态**：✅ 可以收口（2026-09-01 独立核验） | **时间**：2026-09-01 | **负责人**：独立核验 subagent（只读 + 本文唯一写权限）
> **核验对象**：rebuild/mode-arch 工作区未提交改动（HEAD=ef3981a2 T54，`git status` 全量未提交，并行波次纪律「禁止 commit/push」成立，`git log --oneline -3` 实证 2026-09-01）
> **规格对照**：T56-plan.md §3 五条验收 + §4 五条红线；S3-tool-contracts-spec.md §6（含 2026-09-01 修订注记，doc 行 82-99 实读）；S1-product-spec.md §5/§6

## 1. 核验范围

T56 名义文件集逐文件审读（core 纯函数层 / pi 工具工厂 / 卡片 / ChatMessage 分支 / ChatPanel 提交路径 / fork i18n 三文件 / 两测试文件）+ 两条测试命令实跑（unpiped）+ 六门禁复跑 + 冻结面 git diff 实证 + service.ts 注册缝与 zones.json 登记审读。

## 2. 验收核验

| # | 验收项 | 结果 | 证据（2026-09-01，除注明外均 unpiped 直读退出码） |
|---|---|---|---|
| V1 | 钉扎测试全绿 | ✅ | `bun test tests/engine/rebuild/marketing/ask-user-question.test.ts tests/engine/rebuild/marketing/ask-user-question-roundtrip.test.ts`：**23 pass / 0 fail / 82 expects**（2 文件；主文件 21 = 校验矩阵 11 + Case B 1 + formId 2 + awaiting 信封 2 + 序列化 round-trip 5，roundtrip 文件 2） |
| V2 | rebuild 套件不回退 | ✅ | `bun test tests/engine/rebuild/`：**236 pass / 0 fail / 1002 expects / 23 files / 6.21s**——与核验指令给定基线 236 一致（plan §3.2 的「172 基线」为 T55 时代旧值，同波 T53/T57 套件已并入） |
| V3 | 校验规则与 plan §1 定谳 4 逐字对齐 | ✅ | core `ask-user-question.ts`：`ASK_QUESTION_LIMITS` = questions 1..8 / options 2..12 / imageOptions 1..12（:46-50）；id 唯一非空（:147-150）、label 非空（:152-153）、kind 三值（:156-161）、kind 互斥（single_select 拒 imageOptions :165-170；image_select 拒 options :176-178；text 双拒 :183-185）、required 缺省 true（:162 `item.required !== false`）；失败恒 `fail()` 返回 `{error,message}`（:52-54）全文件无 throw（grep 零命中） |
| V4 | awaiting 信封 + formId 钉扎 | ✅ | pi 工厂 `execute` 合法路径返回 details `{formId, status:'awaiting_user', questions}`（ask-user-question.ts:92-96）+ zh-cn 软终止指令文本（:98-102 含「回合到此结束」「不要再调用任何工具」）；`FORM_ID_PATTERN = /^form-[0-9a-z]+-[0-9a-z]{6}$/`（core:219），`makeFormId(now,rand)` 双源可注入（:222-228），工厂 `deps.makeId` 注入缝（pi:91）；测试注入 `makeId: () => 'form-test-000000'` 逐字段断言 + `makeFormId(()=>0,()=>0)==='form-0-000000'` 确定性钉扎（test:241-254, 263-283） |
| V5 | 答案信封格式字节钉扎 + Case B | ✅ | `serializeAskAnswer` 首行 `[表单作答 formId=…]` / `[表单跳过 formId=…]` + 次行 JSON（core:242-245）；测试 `startsWith('[表单作答 formId=form-abc-000000]\n')` / `startsWith('[表单跳过 …]\n')` 字节断言（test:301,311）；容错五路（坏 JSON/缺标记/单行/标记与 aborted 不符/JSON 非对象 → null；非字符串 answers 值过滤 + freeText 缺省补空串 + 标记行尾空白容忍，test:319-342）。Case B 四项 payload（keep_old_design/new_design_zone/carry_items[required:false]/discard_radius）过校验且 required:false 保留（test:192-238）——选项集不定稿属 T-B9 尾巴，契约面仅钉「现有 kinds 组合可表达」 |
| V6 | S3 §6 契约保真（含 2026-09-01 修订注记） | ✅ | S3 §6 修订注记（doc 行 95）明文「工具结果恒为 awaiting 信封；answers/aborted 经下一条用户消息物化」——实现形态一致；工具签名冻结 = `Type.Object({ questions })` 单参数（pi:82-84，无 context 字段）；逃生口必带（卡片 :263-281 恒渲染 freeText+跳过）；表单内无 mode 切换入口（卡片无相关 UI，grep 零命中）；非模态不抢焦点（无 Dialog/Overlay/Popover 原语、无 autofocus，见 V10）；图像候选渲染缩略图（image_select 网格 :206-244） |
| V7 | history round-trip 非空转 | ✅ | roundtrip 测试手工构造真实 pi JSONL（session header + message 行，:47-56），直调真 `readPiHistoryFile`（import `@/app/ai/pi-backend/history`）：断言 `part.input.questions` 对三题 QUESTIONS（含 image_select 双候选 + single_select 带 hint + text required:false）**toEqual 深等**（:102），output 折叠 details 三键（:104-106）。history.ts:62-71 实证 `input = part.arguments ?? {}` 全量保真、:86-87 `output = message.details ?? (text \|\| null)`——两断言均落在真实恢复路径上，非 mock 自证。第二测试证明答案信封用户消息文本原样存续且 `parseAskAnswer` 还原 formId+answers（:140-153），即 ChatPanel answeredFormIds 派生输入 |
| V8 | 前端走查：卡片三 kind + 逃生口 + 必填门 + 提交后禁用 | ✅ | AskUserQuestionCard.vue：single_select 选项卡片组（:185-203）/ image_select 缩略图网格（:206-244）/ text 输入（:247-255）；逃生口 freeText textarea + 「跳过表单」按钮恒渲染（:263-281）；必填门 `missingRequired` computed（:78-80）+ handleSubmit 拦截显 hint（:84-87, 258-260）；提交/跳过后 `submittedKind` 置位（:93/:99）→ `isLocked`（:71）禁用全部输入与按钮；重载后 answered prop 置灰 + 徽标（:158-164）；formId 未就位（state ≠ output-available）提交/跳过禁用（:83/:98 守卫 + :275/:284 绑定）；非法定义降级提示不崩（:53, 167-169） |
| V9 | 前端走查：ChatMessage 分支 + ChatPanel 提交路径 + answered 派生 | ✅ | ChatMessage.vue:95-101 `getToolName(part)==='ask_user_question'` 分支挂卡片，**先于** :103 通用折叠工具卡（v-if/v-else-if 链序实证）；`isAskFormAnswered` 经 part.output.formId 查集（:37-50）；`@submit` 转发 `formSubmit` emit。ChatPanel.vue：`handleFormSubmit`（:256-260）streaming/submitted guard（:257）与 `handleSubmit`（:226）同律，`serializeAskAnswer` 后复用 handleSubmit → sendMessage 既有路径（:238）；`answeredFormIds` computed（:80-91）扫 user 消息 text parts 经 `parseAskAnswer` 派生 Set；模板 :370-371 `:answered-form-ids` + `@form-submit` 接线实证 |
| V10 | 红线：冻结面零改动 + 零新依赖 + 非模态 | ✅ | `git diff --stat HEAD -- mapping.ts history.ts transport.ts server.ts schema.ts` **0 行**；`git status --porcelain -- package.json bun.lock packages/*/package.json` **0 行**（零新依赖）；卡片无 Dialog/Overlay/Modal/Popover 导入（grep 仅命中变量名 `askDialogs`），纯聊天流内联 div/button/input/textarea；`git status` 全量清单中 T56 文件均为新增（??）或计划内修改（service.ts/ChatPanel/ChatMessage/i18n 三文件/zones.json），无越界文件 |
| V11 | service.ts 注册缝 | ✅ | `src/app/ai/pi-backend/service.ts:48` import + :216-218 `createAskUserQuestionTool()` 追加进 customTools 数组末位（T56 注释在案），**无 deps 实参**——生产路径走 `makeFormId()` 默认源（pi 工厂 :91 三元）；桥工具零交集（不经桥注释 :216-217） |
| V12 | 图像候选路径无崩溃分支 | ✅ | 卡片 `loadThumbnail`（:122-142）：`getActiveEditorStoreOrNull()`（active-store/index.ts:23-25）→ `store?.graph.getNode(option.nodeId)`，`!store \|\| !node` → `setThumbnail(null)` 占位返回（:125-127）；`store.renderExportImage` 接线链逐跳实证：`document/export/files.ts:104-126`（返回 `Promise<Uint8Array\|null>`，无 renderer/空 ids → null）→ `document/export/create.ts:114` 导出 → `editor/session/modules.ts:6` `createDocumentExportActions` 入模块袋 → `EditorStore = ReturnType<createEditorStore>`（session/create.ts:89）；null data → 占位（:132-135）、throw → catch 占位（:139-141）；占位块渲染 icon + `askImageUnavailable` 文案（:229-238）；objectURL `onBeforeUnmount` 全量 revoke（:148-150） |
| V13 | i18n 双区同形 | ✅ | en.ts `askMessageDefaults` 11 键（:60-71）vs zh-cn.ts `ask` 11 键（:27-38）——`bun -e` 实跑 `Object.keys` 排序比对 **parity: true**；zh-cn.ts:123 `export type AskNamespace = typeof askMessageDefaults` 类型锚；fork/index.ts:53 `forkAskMessages` + :65-67 `useForkAsk` + :37 zh-CN 懒加载包挂 `ask` 域；`bun run check:i18n` exit 0「All locale files are in sync」；i18n-seam.test.ts 2/2 绿（en 默认值解析 + zh-CN 懒加载）。卡片 11 处文案全经 `askDialogs.*`，grep 无硬编码用户向字符串 |
| V14 | 门禁六连 + zones 登记 | ✅ | `bun run lint` exit 0（0 errors；7 条 max-lines warning 全非 T56 文件——fonts.ts/types.ts/cn-catalog.ts/variants/props-overrides.ts/brief.ts:880[T52 既有]/mcp test）；`bun run typecheck` exit 0（`tsgo --noEmit` + `vue-tsc -p tsconfig.json` 覆盖 src 下 .vue 含 AskUserQuestionCard.vue + `vue-tsc -p packages/vue`）；`bun run test:dupes` exit 0（jscpd 854 文件 0 clones）；`bun run check:zones` exit 0（81 modified 全登记 / 476 added 全 owned / 1019 deleted / 0 renamed）；`bun run check:arch` exit 0（steiger ✔ No problems found）；`bun run check:i18n` exit 0。zones.json：根 ownedFiles 增 `src/components/chat/AskUserQuestionCard.vue`（:64）；P4（ChatPanel.vue）reason 追加「T56（2026-09-01）: ask_user_question 表单作答回流…」lastReviewed 翻 2026-09-01（:101-106）；P47（ChatMessage.vue）同款 T56 归因（:395-401）；tracker.md:67 + _index.md:90 T56 行在案（🔄 进行中，收口翻 ✅） |

## 3. 问题清单（按严重度）

| # | 严重度 | 问题 | 处置建议 |
|---|---|---|---|
| I1 | 低 | **重载后跳过态徽标降级为「已作答」**：`answeredFormIds` 是 `Set<string>`（ChatPanel.vue:80-91），只携带 formId 不携带作答/跳过判别；卡片徽标 `submittedKind === 'skip' ? askSkipped : askAnswered`（:163）在重载后 `submittedKind` 为 null，跳过过的表单显示「已作答」。功能置灰正确，纯文案精度损失 | 计划 §1 定谳 6 已钉「formId 相关性是唯一信号，降级可接受」——契约内容忍；若日后在意可让 parseAskAnswer 结果带 aborted 入派生集，~10 行改动 |
| I2 | 低 | **非法定义卡片无逃生口按钮**：`definitionError` 分支（:167-169）只显降级提示，不渲染 freeText/跳过按钮（它们在 `v-else` 内）。此时工具结果本就 `{error,message}` 无 formId，用户只能回普通消息——语义自洽（错误信封无表单可答），但与「逃生口必带」的字面直觉有温差 | 观察项，不挡收口；S3 §6 逃生口条款针对有效表单，T-D1 冒烟时确认用户心智无碍即可 |
| I3 | 观察 | **软终止靠模型纪律**：pi 无硬停机制（plan §1 定谳 1 在案），工具结果文本指令模型「不要再调用任何工具」——模型不遵时表单卡片照常渲染、后续工具照跑，无机制性损坏但回合语义被稀释 | 已登记 plan §2 不做清单（T-D1 观察项）；本核验确认描述文本与终止指令措辞明确（pi:25, :98-102），无进一步动作 |
| I4 | 观察 | **前端零自动化测试**：卡片/分支/提交路径无单测（无 vitest 先例，plan §2 明文排除），本核验以逐行走查 + typecheck（vue-tsc 覆盖 .vue）+ data-test-id 齐全（ask-form-card/ask-option-*/ask-form-submit 等 8 类）兜底 | 契约口径如此；归 T-D1 集成冒烟（Playwright 表单链路已在 plan §2 尾巴登记） |
| I5 | 信息 | plan §3.2「既有 172 基线」为 T55 时代数值，本次实测 236（同波 T53/T57 套件并入）；验收语义「不回退」成立 | 无需处置；收口时 tracker 数字以 236 为准 |

## 4. 总结论

**可以收口**。T56-plan §3 五条验收全部成立：V1/V3/V4/V5/V7 覆盖验收①（23/23 钉扎测试——校验矩阵/kind 互斥/数量界/唯一性/required 缺省/错误不 throw、awaiting 信封字段、Case B 四项组合、序列化容错、history 存续）；V2 覆盖验收②（rebuild 236/236 不回退）；V8/V9/V13/V14 覆盖验收③（前端三文件 lint/typecheck 过、走查无硬编码字符串、渲染逻辑可读）；V14 覆盖验收④（六门禁全绿 + zones.json 三处 T56 归因登记）；验收⑤ CI 逐 push 口径以本地全门禁代理（波次纪律禁 push，无 CI run 可核，同 T55 先例）。§4 五条红线全守住（V10：冻结面五文件零 diff、零新依赖、非模态、逃生口必带、表单无 mode 入口；波次纪律无 commit/push——`git log` HEAD 仍为 T54）。S3 §6 的 2026-09-01 修订注记与实现形态逐字对齐（V6）。问题清单无中重度项：I1/I2 为已钉降级口径内的文案精度观察，I3/I4 为计划不做清单已登记的既有尾巴。

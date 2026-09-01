<!--
  写作纪律（改本文前必读）：
  - 事实性声明必须附核验命令 + 日期，否则标为【假设】
  - 本文只保留当前态，不保留修正历史
  - 详细规则见 docs/rebuild/05-process.md §4
-->

# T56 自检 · Phase 3 W2/T-B5：ask_user_question 新建

> **状态**：✅ 已完成（2026-09-01 收口） | **时间**：2026-09-01 立项 | **负责人**：主 agent + 实现 subagent + 核验 subagent

## 1. 立项段自查（2026-09-01）

1. **全新建确认**：旧仓 grep `ask_user_question|askUserQuestion` 零命中（旧 CP = 纯文本回复，system-prompt-marketing.md 在案）；仓内唯一可抄先例 = T54 image-gen（pi 本地工具工厂）+ T55 look（媒体桥接）。
2. **schema 能力边界实证**：core ParamDef 无嵌套对象（schema.ts:15-23）→ questions[] 无法经 FORK_TOOLS/桥注册，双件布局（fork 纯校验器 + pi-backend TypeBox 工厂）为唯一通路。
3. **零改动面先行验证**：mapping.ts:85-92（tool-input-available 带全参）/ :122-136（输出骑 details）+ history.ts:62-89（tool part 折叠恢复 input.questions）+ server.ts:91-96（只读 text parts → 文本信封零后端改动）——roundtrip 测试钉扎而非纸面推演。
4. **S3 §6 语义修订同步**：`{aborted:true}` 返回值形态是 v5 拍板前挂起形态遗留——已加修订注记（工具结果恒 awaiting 信封；answers/aborted 经下一条用户消息物化）。

## 2. 实现段核验（2026-09-01 实测填报）

- **C1 校验矩阵**：questions 1..8 / id 唯一非空 / label 非空 / kind 三值 / single_select options 2..12 且禁 imageOptions / image_select imageOptions 1..12（nodeId 非空）且禁 options / text 净身 / required 缺省 true；失败 `{error, message}` 不 throw，error 为稳定机读码（questions_bounds/question_id/kind_mixed_fields…）。
- **C2 信封**：工具结果 `{formId, status:'awaiting_user', questions}` + zh-cn 软终止指令；作答/跳过双文本信封 byte 钉扎（`[表单作答 formId=…]`/`[表单跳过 formId=…]` + JSON 行）；serialize/parse round-trip + 容错（坏 JSON/缺标记/aborted 不匹配/非对象/非串答案过滤 → null）。
- **C3 Case B 复用锚**：四项 payload（保留声明/新设计区/携带物逐项/废弃半径）以现有 kinds 组合过校验（测试钉扎）；话术本体属 T-B9 尾巴（S4 §7）。
- **C4 前端三件套**：AskUserQuestionCard（294 行：三 kind 渲染 + 缩略图网格 + 必填门 + 提交后禁用 + 逃生口/跳过）；ChatMessage 分支先于通用折叠卡；ChatPanel answeredFormIds 派生（parseAskAnswer 扫用户消息）+ handleFormSubmit 复用 handleSubmit（streaming guard 同律）。
- **C5 i18n**：fork i18n 新增 ask 命名空间 11 键（en + zh-cn 双包，useForkAsk）；`bun run check:i18n` 绿（2026-09-01）。
- **C6 图像候选**：nodeId → getActiveEditorStoreOrNull → store.renderExportImage 缩略图；缺失/失败 → 占位块显 label（不崩）；v1 限当前编辑器文档。
- **C7 集成接线**（主 agent）：service.ts customTools += createAskUserQuestionTool()（无生产依赖）；zones.json = P4（ChatPanel）/P47（ChatMessage）reason 扩注 + lastReviewed 2026-09-01 + ownedFiles += AskUserQuestionCard.vue，全带 T56 归属。
- **C8 测试**：新 23 例（21 + 2）全绿；`bun test tests/engine/rebuild/` 236/236 绿；`bun run typecheck`（tsgo + vue-tsc 双 tsconfig）exit 0。

## 3. 实测修正记录

1. **序列化器单一入口**：plan 措辞在「一或两个序列化器」间含糊——落定 `serializeAskAnswer(formId, payload)` + 判别联合 `AskAnswerPayload`（作答/跳过两态），ChatPanel 单 handleFormSubmit 路径保持。
2. **AskAwaitingDetails 用 type 别名而非 interface**：需要隐式索引签名满足 `AgentToolResult<Record<string, unknown>>`，规避 `as unknown as`（仓红线）。
3. **lint  complexity 拆解**：validateAskUserQuestions 复杂度 22 超限 → 抽 validateQuestion 助手；`indexOf < 0` → `=== -1`；`thumbnailUrl` → `thumbnailURL`（acronym 规则）。
4. **answered 态降级钉在案**：无显式已答标记——重载后靠后续用户消息 formId 相关性派生（plan §1.6 已钉，S4 尾巴表登记）。
5. **软终止无硬机制**：pi sdk grep 无 ask/elicitation API（2026-09-01 在案）——工具结果指令 + workflow 纪律兜底；T-D1 观察项入 S4 尾巴表。

<!--
  写作纪律（改本文前必读）：
  - 事实性声明必须附核验命令 + 日期，否则标为【假设】
  - 本文只保留当前态，不保留修正历史
  - 详细规则见 docs/rebuild/05-process.md §4
-->

# T61 自检 · Phase 3 W3/T-B10：选择器 UI 重做

> **状态**：✅ 已完成（2026-09-01 收口） | **时间**：2026-09-01 立项 | **负责人**：主 agent + 实现 subagent + 核验 subagent

## 1. 实现段核验（2026-09-01 实测填报；九项交付物落点经实现 agent 报告）

- **C1 chips 两级**：ChatModeChips.vue 数据驱动（T62 删 types 后自然两级，零 type 专属逻辑）；旧件 ChatModeSelect.vue / ChatStyleProfileSelect.vue 物理删除。
- **C2 新建意图确认卡**：ChatNewIntentCard.vue（Case A 一行 / Case B 四项 + references 勾选）；ChatPanel.vue:250-254 拦截、:311-338 宿主 data part 注入、:361-390 确认（信封+草稿送出）/取消（chips 回滚 + 消息留输入框）。
- **C3 设计列表面板**：ChatDesignListPanel.vue——active 徽标；列表点击 = select+zoomToSelection 打开不切换；显式「设为当前」→ 端点。
- **C4 需求单面板三段**：ChatBriefPanel.vue——当前目标卡无状态字段 / 全文档列表带页标识点击=打开 / 详情编辑第一功能（内容+素材标题写回经 makeFigmaFromStore + core brief-edit 原语，apply 前后重读）。
- **C5 gallery 只读**：ChatGalleryPanel.vue。
- **C6 失败显式暴露**：mode-selection.ts piStudioManifestFailed + retryPiStudioManifest；ChatInput.vue 错误条 + 重试；chips 联动禁用。
- **C7 set_active_design 同意卡**：ChatSetActiveDesignCard.vue + ChatMessage.vue:131-138 分支 + ChatPanel.vue:393-458——同意 → POST 端点 + resync；不同意 → 本地系统行；决断经 data-active-design-decision part 落消息（重载置灰派生）。
- **C8 T24 前端链退役**：transport.ts 停发 chatMode/pickedProfileId；document-key.ts 去 mode 消费；mode-selection.ts 全重写为 active 同步态 + 意向暂存；localStorage `open-pencil:pi-chat-mode` 删除。
- **C9 i18n**：fork 新增 chips/panels/confirm 三命名空间（useForkChips/Panels/Confirm），zh-cn 全量；`bun run check:i18n` exit 0。
- **C10 共享契约对账**：信封格式与 T60 剥离正则逐字匹配；单槽键面用 core ACTIVE_DESIGN_KEY + BRIEF_PLUGIN_NAMESPACE 常量；端点形状 {modeId,profileId,briefId,name,materialized}；part 解析 parseSetActiveDesignProposed 单源；物化判据单源 = core isDesignMaterialized（前端只 re-export）。

## 2. 实测修正记录

1. **施工期并行改树**：T62 删 types 使「types 若存在则渲染」分支无须建；T60 常量键面（ACTIVE_DESIGN_KEY namespace 为 open-pencil-marketing 而非早期假设）实核对齐。
2. **references 携带物**经信封后正文行（中文自然语言）传入 run——信封字段契约未动（偏差登记）。
3. **zones.json 登记**（集成期主 agent）：7 新文件进 ownedFiles；ChatModeSelect/ChatStyleProfileSelect 两条 stale 条目移除（T61 删除）；`bun run check:zones` clean。
4. **jscpd 克隆两例**（集成期主 agent 修正，详 T60-self-check §2.2）：前端 helper 的 stack walk 习语收编 core walkSubtree 单源。
5. **视觉冒烟未做**（契约内：归 W4 T-D 批次）；组件可构建可挂载由 typecheck/vue-tsc/steiger 实证。
6. **核验阻塞项修复**（集成期主 agent，2026-09-01）：同意链两处误读 `part.input`（工具入参 {node_id}）——proposed 在 `part.output`；ChatSetActiveDesignCard.vue 改读 output（state==='output-available' 守卫，对齐 AskUserQuestionCard 先例）+ ChatPanel.vue consentProposed 改读 output；typecheck/oxlint 复绿，核验复判 PASS。教训钉扎：工具 part 的 input/output 语义边界（入参 vs 结果）是渲染侧高频坑。

## 3. 遗留

- data-* part 随历史 POST 回后端的映射行为 → 核验复核（移交 T60 核验项合并）。
- Playwright 交互验证（chips 回显/确认卡/面板/同意卡）→ W4 T-D1/D2。

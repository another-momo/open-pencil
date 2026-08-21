<!--
  写作纪律（改本文前必读）：
  - 事实性声明必须附核验命令 + 日期，否则标为【假设】
  - 计划被实测推翻时，直接改本文为新版本，完整理由记入 records/ 子文档
  - 本文只保留当前态，不保留修正历史
  - 改完后刷新本文头部的「状态」字段
  - 详细规则见 docs/rebuild/05-process.md §4
-->

# records/topics/chat-ui.md · Chat UI

> **状态**：已建立 | **时间**：2026-08-20 18:30 | **核验人**：主 agent
> **身份**：ChatPanel / ChatInput / 聊天界面相关的决策与核验记录。

---

## 决策类

## D5 · chatMode（UI/营销双模式）

- **类型**：决策
- **状态**：open
- **候选**：保留双模式 / 只做营销
- **归属**：C5 与 prompt 装配范围

## D8 · 「素材图理解」是否新建立项

- **类型**：决策
- **状态**：open
- **候选**：新建 / 确认放弃
- **依据**：R2 实测：旧 changelog 声称的能力全仓无代码

---

## 核验类

## Chat UI 实测（R1-R4 沉淀）

- **时间**：2026-08-18 14:00
- **来源**：R1-R4 综合
- **结论**：
  - 前端 = @ai-sdk/vue Chat 类 + 自写 UIMessage stream v1 解析（R4）
  - ChatPanel 在 `src/components/ChatPanel.vue`（**根目录，不在 chat/**），非 R2 误判（R2 修正）
  - 现存 UI：BriefPanelDialog / MarketingConfigBar / BrandConfigPanel / ProfileGalleryDialog / ChatProfileSelect / ChatInput / ChatMessage + ImageGenKeysSection.vue
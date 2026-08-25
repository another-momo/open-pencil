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
## 状态更新 · D5（chatMode 双模式去留）已由 T24 事实落地（2026-08-25）

- **类型**：状态更新（对 D5 条目；append-only，原条目不改动）
- **时间**：2026-08-25
- **内容**：D5 条目状态仍为 open——系滞留值。chatMode 双模式已由 T24（prompt 装配）**事实落地为「保留双模式 + 请求级切换」**：chatMode 随请求体上送（默认 ui），模式切换即驱逐重建会话对象（同 sessionId、JSONL 历史保留），薄 UI = 聊天输入条模式切换 + profile 下拉——owner 三轮评审拍板 2026-08-24（见 [tasks/T24-plan.md §1.2 D2/D4/D8](../../tasks/T24-plan.md)），C1-C6 验收全过 + 独立核验 V1-V6「可以收口」（[tasks/T24-verify.md](../../tasks/T24-verify.md)）。**待 owner 在全局决策层补签**（报送清单 2026-08-25）

## D5 补签 · chatMode 双模式保留，owner 正式拍板（2026-08-25）

- **类型**：决策（补签——对上条「待补签」的形式闭环）
- **时间**：2026-08-25
- **拍板**：owner（2026-08-25 对三方 review 整改 15 项决策批 #3 逐项拍板）
- **状态**：已拍板（D5 从 open 正式闭环）
- **内容**：**chatMode 双模式保留**——T24 事实落地形态（chatMode 请求级上送、默认 ui、切换即驱逐重建会话、薄 UI 模式切换 + profile 下拉）获 owner 正式确认；上一条状态更新的「待 owner 补签」由本条闭环
- **落地凭证**：[tasks/T24-plan.md](../../tasks/T24-plan.md) / [tasks/T24-verify.md](../../tasks/T24-verify.md)；[01-target-state.md §6 决策表](../../01-target-state.md) D5 行已同步「已拍板」

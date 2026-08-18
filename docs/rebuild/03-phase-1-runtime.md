# 03 · Phase 1：runtime 选型 spike（硬门）

> 日期：2026-08-18 | **硬门：runtime 未定，对话层一行代码不写。**

## 1. 为什么 runtime 是第一关键路径

实测结论（见 00 §4）：对话机器是 runtime 形状的——流式协议、session 模型、prompt 注入点、媒体投递、凭证、debug，全部随 runtime 重新塑形。最小价值闭环本身依赖 runtime 能力（look 的多模态 tool-result、跨重开的 session 恢复、长会话的上下文管理）。在错误的地基上建闭环 = 返工。

## 2. spike 必须回答的三个问题（用能跑的代码，不接受文档答案）

1. **多模态 tool-result**：pi sdk / dsh 的工具结果能不能带图片？经 WebSocket 桥到浏览器编辑器执行、再返回，图片是否活着到达模型？——**视觉回路的生死**。
2. **Session 挂起/恢复**：能否凭 pluginData 里存的 sessionId 恢复完整对话上下文？runtime 自带 compaction 时，自定义媒体省略策略是否还插得进去？
3. **流格式**：输出能否转成前端 `useChat` 可消费的形式？不能的话，ChatPanel 改造量进预算（旧分支 pi-sdk 草案「前端零影响」的判断不成立，session UI 与传输契约本来就是新代码）。

## 3. 选型基线（spike 前的先验，用 spike 数据修正）

| | pi sdk | dsh（deepseek-harness） |
|---|---|---|
| 前端流格式 | 有 AI SDK harness 适配器，理论上可保 UIMessage 流 | 需自证 |
| 成熟度 | 较新 | developer preview，官方明牌 breaking changes |
| 架构 | extension API（turn_start 钩子等） | Cordis 全插件化 |
| 成本差 | 前端改动小是实打实的优势 | 插件模型长期表达力强，但迁移颠簸 |

求稳先 pi sdk，dsh 作为观察对象；spike 结果推翻先验则以数据为准。

## 4. 能力契约（B1 的验收标准，spike 即按此测试）

- session 持久化：pluginData 关联文件，挂起/恢复完整上下文
- 工具审批：危险操作（删除等）可挂起等用户确认，审批往返穿 WebSocket 桥
- skills：营销工作流可封装为 skill
- 多 provider：主模型 +（可选）视觉模型的统一凭证
- 流式输出：前端可消费（见问题 3）

## 5. 触发的重分类（按 02 §3.3 仪式执行）

- spike 接入桥协议时：`src/app/automation/` + `packages/mcp` serve 骨架 + `browser-bridge.ts`（扩审批往返）
- 闭环搭建时：`src/app/ai/chat/`（传输契约重写）、`src/components/chat/` 基础三件套（session UI）

## 6. 产出

- 选型结论 + 三个问题的实测答案（代码链接）
- `packages/agent`（或等价物）在新分支出生：runtime 内核 + extension/适配层 + 能力契约测试全绿
- 失败预案：spike 失败只是删一个 spike 分支，Phase 0 骨架不伤筋骨

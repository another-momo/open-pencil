<!--
  写作纪律（改本文前必读）：
  - 事实性声明必须附核验命令 + 日期，否则标为【假设】
  - 本文只保留当前态，不保留修正历史
  - 详细规则见 docs/rebuild/05-process.md §4
-->

# T59 自检 · Phase 3 W2/T-B8：undo burst coalesce（一 AI 回合 = 一撤销单元，按设计区独立）

> **状态**：✅ 已完成（2026-09-01 收口） | **时间**：2026-08-31 立项 | **负责人**：主 agent + 实现 subagent + 核验 subagent

## 1. 立项段自查（2026-08-31）

1. **现状实证**：`grep -n withAIUndo src/app/automation/bridge/*.ts`——tool-handlers.ts:19-33 定义、:76 每个 mutating 调用各自成单元（00 C 类 #4 撤销粒度碎旧疾）。
2. **机制底座勘察**：packages/scene-graph/src/undo.ts:139-151 UndoManager.pushUndoEntry 已有生产在用的 coalesceKey 邻近合并（opacity 滑杆先例 packages/core/src/editor/nodes.ts:69）——快照型条目（forward=after 快照/inverse=before 快照）与合并天然契合。
3. **边界信号源**：pi service 掌握 turn 边界（tools.ts 头注 L21-23 turn_start 计数在案）。

## 2. 实现段核验（2026-08-31/09-01 实测填报）

- **C1 组感知 withAIUndo**：undo_group begin/end 经桥 RPC 新指令（handlers.ts 注册，P136）；组打开期 mutating 条目携带 `ai-burst:<documentId>:<turnSeq>:<zoneKey>` coalesceKey，复用 undo.ts 邻近同 key 合并（首 inverse + 末 forward）；label `AI: <首工具名> +N more`。
- **C2 按设计区独立**（PD-19）：区键 = 工具参数/结果节点向上解析的顶层根 frame id；无节点参数落文档级默认组；组键变化合并链自然断裂。
- **C3 边界发信**：service.ts runPrompt 首 begin（await 保序先于本回合首个工具调用）/尾 end（finally fire-and-forget）；undo-group.ts 全路径 warn 吞掉不阻断主流程。
- **C4 悬挂组失效安全**：组状态只是「回合号 + 标签簿」两个 Map，无快照缓冲区可悬挂；end 丢失时 ① 下个 begin turnSeq 递增覆盖 ② 非组编辑条目无 key 截断合并链——两条路径均有测试钉扎。
- **C5 红线**：只读工具零 undo 开销、MCP/CLI（不发 undo_group）行为不变、用户编辑不被吞并——三钉扎。
- **C6 集成**（主 agent，2026-09-01）：undo-group.ts 与 tools.ts 的桥 fetch 块逐 token 相同被 jscpd 拦 → 抽 bridge-rpc.ts 共享 postBridgeRPC 助手（acronym 门禁命名）；P39 扩注 + handlers.ts 新登 P136。
- **C7 测试**：undo-burst.test.ts 6/6 绿（62 expect）；editor/undo + automation 邻域 48/48 绿；rebuild 172/172 绿；`bun run smoke:pi` 19/19 绿（2026-09-01 集成后实测）。

## 3. 实测修正记录

1. **机制选择偏差（语义等价）**：plan §1 设想「桥侧显式缓冲组、关闭后落一单元」；勘察发现 UndoManager 已有 coalesceKey 生产机制，改为「begin/end 承载回合身份 + 合并复用 coalesceKey」——plan 全部可观察语义逐条对应（核验 V 段逐条复核一致），无悬挂缓冲使失效安全设计大幅简化。教训：plan 机制描述应写「目标语义 + 候选机制」，实现期勘察定夺。
2. **交错语义边界成文**：同回合 A,B,A,B 交错序列按「组键变化先闭旧组开新组」产生 4 单元（与显式组模型一致）；验收场景 A,A,B,B → 2 单元通过。交错专测缺失挂 S4 §7 尾巴表（2026-09-01 登记）。
3. **测试基建踩坑**：graph.getNode 返回活对象（捕获 previous 须先取值再 mutation）；useLibraryService 单例在 bun test 环境需 mock.module 桩（indexedDB 缺失）——已在测试文件头注成文供复用。
4. **end 竞态（设计内生）**：end fire-and-forget 且桥侧无 turnKey 校验，极端时序下回合 N 迟到 end 可删 N+1 组（退化为逐调用成单元，不丢数据、下回合自愈）——低概率低风险，挂尾巴表备查。

<!--
  写作纪律（改本文前必读）：
  - 事实性声明必须附核验命令 + 日期，否则标为【假设】
  - 本文只保留当前态，不保留修正历史
  - 详细规则见 docs/rebuild/05-process.md §4
-->

# T59 核验 · undo burst coalesce（一 AI 回合合并为一个撤销单元，按设计区独立）

> **状态**：✅ 已完成（2026-08-31 收口） | **时间**：2026-08-31 | **负责人**：独立核验 agent（只读）
> **核验对象**：分支 rebuild/mode-arch 未提交改动；规格真源 S3-tool-contracts-spec.md §9 undo burst 行（`grep -n undo doc/S3-tool-contracts-spec.md` → L125）

## 1. 核验范围

T59-plan §3 验收标准逐条核验（2026-08-31，全部 unpiped 直读退出码）。实现文件集：src/app/automation/bridge/tool-handlers.ts、handlers.ts、src/app/ai/pi-backend/undo-group.ts、bridge-rpc.ts、service.ts（L359-370）、tools.ts（L46/L91 postBridgeRPC 换引）、tests/engine/rebuild/undo/undo-burst.test.ts；机制底座 packages/scene-graph/src/undo.ts pushUndoEntry L139-151 邻近同 key 合并。

## 2. 验收核验

| # | 验收项 | 结果 | 证据 |
|---|---|---|---|
| V1 | 一 AI 回合 = 一撤销单元（同区连续 mutating coalesce；label `AI: <首工具名> +N more`） | ✅ | 测试 1：begin→3 次 mutating→end 净增 1 单元，`undoLabel === 'AI: create_shape +2 more'`，单次 undo 三区对象全消失、redo 整体重做（含 cornerRadius=8 保真）。机制：withAIUndo 组内条目携带 `ai-burst:<doc>:<turnKey>:<zone>` coalesceKey，复用 undo.ts 邻近合并（首 inverse + 末 forward） |
| V2 | 按设计区独立（组键含顶层根 frame id） | ✅（附边界注记 I1） | 测试 2：A,A,B,B 序列 → 净增 2 单元，逐次 undo 按区各自整体回退。区键解析 topLevelZoneRootId 向上走至 CANVAS 直属子（tool-handlers.ts L40-51）；参数侧执行前解析 + 结果侧补解析（create 顶层新建 L92）双路径在案 |
| V3 | 回合边界信号：首 begin await 保序 / 尾 end finally fire-and-forget；失败不阻断 | ✅ | service.ts L362 `await sendUndoGroupSignal('begin', …)` 先于 `session.prompt`；L370 finally 内 `void sendUndoGroupSignal('end', …)`。undo-group.ts 全路径 try/catch + 非 2xx warn 后吞掉，不抛 |
| V4 | 悬挂组失效安全两路径均有测试钉扎 | ✅ | ① end 丢失→下个 begin 覆盖：测试 5（begin 直接 set 覆盖旧组，turnSeq 递增旧 key 作废，跨回合同区不串组，净增 2 单元）。② 非组编辑截断合并链：测试 4（用户编辑无 key 条目断链） |
| V5 | 只读工具零 undo 开销不变；MCP/CLI（无 undo_group）行为不变；用户编辑不被吞并 | ✅ | 测试 6：组内 node_bounds 前后 undoDepth 不变。测试 3：无 begin/end 两次 mutating 各自成单元（base+4），逐层回退顺序钉扎。测试 4：组打开期用户改名独立成单元，undo AI 段后用户名字 'User Card' 原样保留 |
| V6 | 区键解析边界：无节点参数 mutating 工具落文档级默认组 | ✅（代码路径在案，无专测，见 I2） | tool-handlers.ts L93 `zoneRootId ?? 'document'`；delete 类经 extractNodeIds 的 `deleted` 短路（L207）回退参数侧预解析，执行后节点消失不致误判 |
| V7 | 测试断言真实有效（「净增 1 单元」探针非恒真） | ✅ | undoDepth 经私有字段 `undoStack` 读真实栈深（UndoManager 无公开深度口径，头注已声明）；每用例断言精确深度差 + undo/redo 后图状态（节点存亡/属性值），62 个 expect 全过 |
| V8 | 测试与基线不回退 | ✅ | `bun test tests/engine/rebuild/undo/` 6/6；`bun test tests/engine/editor/undo/ tests/engine/app/automation/` 48/48；`bun test tests/engine/rebuild/` 172/172；`bun run smoke:pi` 19 passed, 0 failed（汇总行实读）；`bun run check:arch` ✔ No problems found（新文件 undo-group.ts/bridge-rpc.ts 归层合规） |

## 3. 问题清单（按严重度）

- **I1（低 · 语义成文度）**：交错 A,B,A,B → 4 单元的语义未单独成文/钉扎。头注「组键（区）变化 → 合并链断裂，新条目自立」隐含相邻合并口径，测试 2 只覆盖 A,A,B,B → 2 单元；交错序列 → 4 单元的行为由 undo.ts 相邻合并机制自然导出但无测试钉住。不阻断收口，建议后续补一条交错用例。
- **I2（低 · 测试空白）**：文档级默认组（无节点参数 mutating 工具 → zoneKey 'document'）代码路径在案（V6），但无专测钉扎同回合两次无参 mutating 合并为 1 单元。
- **I3（低 · 设计内生竞态）**：end 为 fire-and-forget（验收口径本身如此），桥侧 end 处理不带 turnKey 校验（tool-handlers.ts L127-130 无条件 delete）。极端时序下回合 N 的迟到 end 可能删去回合 N+1 已 begin 的组，使 N+1 退化为逐调用成单元（不丢数据、可自愈于下回合）。本地回环一跳 + prompt 串行队列下不可达概率极高，记录备查；若未来要强化可在 end 携带 turnKey 比对。

## 4. 总结论

**通过（PASS）**。T59-plan §3 验收标准第 1、2 条全绿实证（V1-V8），第 3 条九门禁中与本次改动面相关的 check:arch 实测零违规，全量 rebuild 套件 172/172 与 smoke:pi 19/19 不回退；第 4 条 CI 逐 push 口径属集成期事项，本核验不覆盖（工作树为 T52/T54/T55/T59 并行波次未提交混合态）。红线复核：只读工具零开销（V5）、MCP/CLI 行为不变（V5）、组状态仅存于桥进程内存 Map（存活期=回合，tool-handlers.ts L114-116）、无跨进程共享存储引入——均合规。遗留 I1/I2/I3 均为低严重度，不阻断收口。

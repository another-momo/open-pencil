<!--
  写作纪律（改本文前必读）：
  - 事实性声明必须附核验命令 + 日期，否则标为【假设】
  - 本文只保留当前态，不保留修正历史
  - 详细规则见 docs/rebuild/05-process.md §4
-->

# T59 计划 · Phase 3 W2/T-B8：undo burst coalesce（withAIUndo 按设计区独立合并）

> **状态**：✅ 已完成（2026-09-01 收口） | **时间**：2026-08-31 立项 | **负责人**：主 agent + 实现 subagent
> **规格真源**：[S3-tool-contracts-spec.md §9](../../../doc/S3-tool-contracts-spec.md) undo burst 行（00 C 类 #4；08 红线 #6）：**一个 AI 回合全部工具调用合并为一个撤销单元；按设计区各自独立（PD-19）**
> **现状锚点**：src/app/automation/bridge/tool-handlers.ts:19-33 `withAIUndo`、:76 `def.mutates ? withAIUndo(...)`——每次 mutating 工具调用各自成一个撤销单元（`grep -n withAIUndo src/app/automation/bridge/*.ts` 实测 2026-08-31）

## 1. 背景与方案

AI 一回合一串工具调用，用户一次 Ctrl+Z 应整体回退该回合；且不同设计区的 AI 操作各自成组，互不卷入。当前桥层每个 mutating 调用独立 pushUndoEntry，撤销粒度碎（00 C 类 #4 旧疾）。

**设计定谳（立项裁定）**：

- **显式回合并边界**：pi-backend service 已掌握 turn 边界（service.ts turn_start 事件递增计数在案，tools.ts 头注 L21-23）。桥 RPC 增加轻量指令面（如 `{command:'undo-group', begin/end}`——实现期以对桥命令分派面最小侵入为准成形），service 在回合开始/结束发边界信号；桥侧维护「当前打开的 AI 撤销组」。
- **组合并**：组打开期间，`withAIUndo` 不新建撤销单元而是并入组；组关闭后落一个撤销单元（label 沿 `AI: <首工具名> …` 形态，实现期定稿）。
- **按设计区独立（PD-19）**：组键 = documentId + 设计区根 id。设计区根 id 的解析：T60（宿主路由）未落地前，从工具参数涉及的节点向上解析顶层根 frame 作为区键；无法解析（无节点参数的 mutating 工具）落文档级默认组。组键变化 → 先关闭当前组再开新组。
- **失效安全**：回合异常终止（桥断连/后端崩溃）→ 组以超时或下个非 AI 编辑动作自闭合，不留悬挂打开组（具体机制以实现期对编辑器 history API 勘察为准，必须在 self-check 中实证）。
- **用户手动编辑不打断语义**：组只合并 AI 调用，用户编辑经既有路径正常成单元。

**勘察锚点**（实现期必读）：编辑器 history/undo 栈 API（tests/helpers/editor-history.ts 在案）、tool-handlers.ts 全文件、pi-backend service.ts 的 turn 生命周期、桥命令分派面（src/app/automation/bridge/）。

**文件布局**：桥 + service 两侧均为既有上游/自有文件修改——zones.json patch/登记由主 agent 集成期统一办理，实现 agent 只交代码与测试。

## 2. 不做清单

- 撤销栈本身重构、跨文档撤销、redo 语义变更。
- active_design 路由（T60）；设计区身份四元组消费（T53 落盘后 T60 消费，本任务区键解析只做节点层级推导）。

## 3. 验收标准

1. 新增引擎/桥层测试全绿：同回合同区 3 次 mutating 调用 → 撤销栈净增 1 单元；同回合跨两区 → 2 单元；跨回合 → 各成单元；组未关闭时用户编辑不被吞并；异常路径（组悬挂自闭合）有钉扎。
2. `bun test tests/engine/` 相关套件与 smoke:pi 不回退（smoke:pi 80/80 为 T38 在案基线，本任务复跑确认）。
3. 九门禁全绿；全量回归失败数不增（对照 T51 基线）。
4. CI 逐 push 口径绿。

## 4. 红线

- 只读工具零 undo 开销语义不变；非 AI 来源（MCP/CLI/用户）撤销行为不变。
- 不为合并引入跨进程共享可变状态之外的存储；组状态存活期 = 回合。
- 并行波次纪律：禁止 commit/push；禁止碰 zones.json/tracker/_index；与 T52/T54/T55 文件面零交叠（桥+service 侧），若发现必须碰 fork/ 下文件则停下上报主 agent。

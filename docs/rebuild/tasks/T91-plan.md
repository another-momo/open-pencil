# T91-plan · 节点 ID 稳定性 + newIntent pluginData（双任务拆分）

> **状态**：🟡 待验收 | **时间**：2026-09-03/04
> **任务来源**：owner 实测三个 bug + 仓外分析文档
>
> - `docs/202609031650-new-intent-plugindata-design.md`（newIntent pluginData 设计真源）
> - `docs/202609031730-node-id-stability-and-brief-redesign.md`（节点 ID 稳定性 + brief 接口合并设计真源）
>   **关联**：T91a 已落 d1809c1df（UUID + brief 合并 + .fig pluginData）；T91b 接续（newIntent pluginData + ChatPanel 拦截 + abort + server endpoint）

## 1. 任务拆分

T91 涵盖 owner 实测三个 bug 的根因修复。按工作量与 commit 边界拆为两个子任务：

- **T91a**：Bug 1（.fig 重导入后 brief/design 节点 ID 重生成 → 双向绑定断裂）+ Bug 2（agent 视图 boundDesigns vs designs 歧义）
  - UUID 基础设施（brief.ts / brief-edit.ts / setup.ts / active-design.ts）
  - brief view 接口合并（`BriefView.boundDesigns` → `designs[]`）
  - shared-plugin-data round-trip 测试钉扎 codec
  - 5 文件改动 + 4 文件测试 + 4 文件治理
  - 验收结论：营销套件 229/229 pass + 全量 engine 不引入新失败
  - commit: d1809c1df

- **T91b**：Bug 2 收尾（用户答"是"无法写入 → setup_design 永远 unconfirmed_new_intent 死循环）+ Bug 3（pluginData 时序错配 → AI 用错 workflow）
  - newIntent pluginData 显式状态（document root 三键）
  - setup_design 双源检查 args + pluginData → 未确认返 awaiting 信封
  - ChatAwaitingIntentCard 拦截 + chat.stop 截停 SSE
  - 新端点 POST /api/pi/intent-confirm 写三键
  - 14 文件改动 + 4 文件测试 + 3 文件治理
  - commit: pending

## 2. 关联文档

- 子任务详细计划：[T91a-plan.md](T91a-plan.md) / [T91b-plan.md](T91b-plan.md)
- 子任务验收：[T91a-self-check.md](T91a-self-check.md) / [T91b-self-check.md](T91b-self-check.md)
- 子任务实测：[T91a-verify.md](T91a-verify.md) / [T91b-verify.md](T91b-verify.md)

## 3. 整体验收

- T91a + T91b 双 commit 后引擎零回归
- 端到端真值覆盖三个 bug 修复路径
- sharedPluginData codec 与 UUID 稳定性经 .fig round-trip 测试钉扎

## 4. 已知边界 / Phase 3 收口

- **跨 .fig 重导入保留**：T91a 已钉（5/5 round-trip 测试）
- **多用户并发确认**：不处理（与 active_design 同 pattern——单槽不并发）
- **pluginData 字符编码**：与 brief UUID 同源，T91a 钉 round-trip 覆盖

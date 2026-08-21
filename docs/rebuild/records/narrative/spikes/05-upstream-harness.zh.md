<!--
  写作纪律（改本文前必读）：
  - 本文是 spikes/05 的对应 records（一一对应，不一致 → check-bindings 红）
  - 事实性声明必须附核验命令 + 日期，否则标为【假设】
  - append-only：发现错误追加「修正-N」/「ROT-N」，不删旧记录
  - 详细规则见 docs/rebuild/05-process.md §4
-->

# records/narrative/spikes/05-upstream-harness.zh.md

> **状态**：已建立 | **时间**：2026-08-21 | **核验人**：主 agent
> **物理绑定**：[spikes/05-upstream-harness.zh.md](../../../spikes/05-upstream-harness.zh.md)（一一对应）
> **身份**：本档案持有针对 spike 05 的核验记录。runtime 选型决策归 `records/topics/agent-runtime.md`。

---

## 建档

## SP-5 · 上游 harness 路线核查与终态推演（建档）

- **类型**：核验 + 建档
- **时间**：2026-08-21
- **缘起**：T10 合并发现上游 pi harness 产品化（SP-6）；owner 指示此线单独立档（「找到了一条新的 spike 路线，写进新 spike 文档，不改原来的」），spike 02 仅保留 D2-drift 修正
- **证据基础**：主 agent 实读 + subagent 深读核对（packages/harness 全套、chat 缝接线、harness-pi 类型面、just-bash 包、pi extensions 文档）；终态推演部分为【推断】已在本文明确标注
- **关键结论**：上游 harness 与「本地 CLI 后端 + localhost webUI」目标形态同构（三进程→两进程）；D9 新增子问题「直用 pi SDK vs 复用 harness 抽象」（选项 A/B/C），判据 = D3 是否需要 pi 树形 session 能力；工具桥选择改述为「MCP vs 自有 WS」（extensionFactories 为 registerTool 逃生舱，未经实测标【假设】）
- **流向**：spike 05 §6 的调整清单将在 T11 开工前落入 T11-plan 重写（owner 指示顺序：先终态架构推演 → 再改 plan）

## 修正-1 · §3 天花板表述精确化（owner 指正）

- **类型**：修正（按对象：spikes/05-upstream-harness.zh.md）
- **时间**：2026-08-21
- **依据**：owner 指正「一文件一线性历史」讲法易误解——harness 路线下一文件仍可对多个线性 session（sessionId 自有层登记），受限的只是单 session 内部不能树形分叉
- **内容**：§3 天花板段重写——明确区分「被遮蔽的仅是树形分叉（branch 系，无法模拟）」与「一文件多 session/session 列表不受遮蔽（自有注册表替代 SessionManager.listAll）」；判据段同步改为「D3 要害收敛为：树形分叉交互是不是产品卖点」

## 修正-2 · 头部状态行加 D21 路线状态

- **类型**：修正（按对象：spikes/05-upstream-harness.zh.md）
- **时间**：2026-08-21
- **依据**：owner 拍板 D21（harness 路线暂时搁置，S-pi 直用 pi SDK，[agent-runtime.md D21](../../topics/agent-runtime.md)）
- **内容**：头部状态行追加路线状态（搁置但档案有效，§5 选项比较与 §6 走读参照继续供 T11 使用）

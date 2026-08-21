<!--
  写作纪律（改本文前必读）：
  - 本文是 spikes/01 的对应 records（一一对应，不一致 → check-bindings 红）
  - 事实性声明必须附核验命令 + 日期，否则标为【假设】
  - append-only：发现错误追加「修正-N」/「ROT-N」，不删旧记录
  - 详细规则见 docs/rebuild/05-process.md §4
-->

# records/narrative/spikes/01-dsh-integration-routes.zh.md

> **状态**：已建立 | **时间**：2026-08-20 19:30 | **核验人**：主 agent
> **物理绑定**：[spikes/01-dsh-integration-routes.zh.md](../../../spikes/01-dsh-integration-routes.zh.md)（一一对应）
> **身份**：本档案持有针对 spike 01 的核验/修正记录。runtime 选型决策归 `records/topics/agent-runtime.md`。

---

## 修正类

## 修正-1 · spike 01 v2 修正（X 路线工作量上修）

- **类型**：修正（按对象：spikes/01）
- **派生自**：`records/topics/spikes.md` 修正-1
- **时间**：2026-08-20 17:20
- **依据**：SP-3 weshop 案例实证
- **内容**：X2 改「自写 ChatPanel」；Z1/F0.4 同步；工作量表 F0 +4 / C5a +0.5；总工作量 ≈33 → ≈37-38 人日
- **影响**：[01-target-state.md](../../01-target-state.md) §2 F0.4、[03-phase-1-runtime.md](../../03-phase-1-runtime.md) v3

---

## 核验类

## SP-1 · dsh 集成路线对比（X 入壳 vs Y 无头）

- **类型**：核验
- **派生自**：`records/topics/agent-runtime.md` SP-1
- **状态**：**已被 SP-3 推翻**——后续 weshop 案例证明 X 路线真实形态不是「镶 dsh Chat」而是「自带 ChatPanel 复用 SessionFace」

---

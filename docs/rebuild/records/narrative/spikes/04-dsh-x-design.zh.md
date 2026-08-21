<!--
  写作纪律（改本文前必读）：
  - 本文是 spikes/04 的对应 records（一一对应，不一致 → check-bindings 红）
  - 事实性声明必须附核验命令 + 日期，否则标为【假设】
  - append-only：发现错误追加「修正-N」/「ROT-N」，不删旧记录
  - 详细规则见 docs/rebuild/05-process.md §4
-->

# records/narrative/spikes/04-dsh-x-design.zh.md

> **状态**：已建立 | **时间**：2026-08-20 19:30 | **核验人**：主 agent
> **物理绑定**：[spikes/04-dsh-x-design.zh.md](../../../spikes/04-dsh-x-design.zh.md)（一一对应）
> **身份**：本档案持有针对 spike 04 的核验记录。runtime 选型决策归 `records/topics/agent-runtime.md`。

---

## 核验类

## SP-4 · dsh-X 路线专项设计

- **类型**：核验
- **派生自**：`records/topics/agent-runtime.md` SP-4
- **状态**：成立（v4，314 行）
- **关键结论**：X 路线核心论证 = shell.overlay 切 session **不卸载**（无 `only` 参数）；自写 ChatPanel 三因素论证（session 持久化 > 控制自由度 > 复用 UX 控制权）；M1-M5 五 commit 里程碑；6 项 S-X spike 验证清单

---

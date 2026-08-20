<!--
  写作纪律（改本文前必读）：
  - 本文是 spikes/02 的对应 records（一一对应，不一致 → check-bindings 红）
  - 事实性声明必须附核验命令 + 日期，否则标为【假设】
  - append-only：发现错误追加「修正-N」/「ROT-N」，不删旧记录
  - 详细规则见 docs/rebuild/05-process.md §4
-->

# records/narrative/spikes/02-pi-sdk-runtime.zh.md

> **状态**：已建立 | **时间**：2026-08-20 19:30 | **核验人**：主 agent
> **物理绑定**：[spikes/02-pi-sdk-runtime.zh.md](../../../spikes/02-pi-sdk-runtime.zh.md)（一一对应）
> **身份**：本档案持有针对 spike 02 的核验记录。runtime 选型决策归 `records/agent-runtime.md`。

---

## 核验类

## SP-2 · pi sdk 作为 runtime 可行性

- **类型**：核验
- **派生自**：`records/agent-runtime.md` SP-2
- **状态**：成立
- **关键结论**：**推荐 pi 直接驱动（库形态）**，F0+层 1 ≈ 20 人日；Q0-Q3 全部有源码级正面答案；resume 是一行 API 无 fork；流式 RPC event 流字段同构；session JSONL 树形天然支持 in-place branch

---

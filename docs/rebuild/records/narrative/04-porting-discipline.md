<!--
  写作纪律（改本文前必读）：
  - 本文是 04-porting-discipline.md 的对应 records（一一对应，不一致 → check-bindings 红）
  - 事实性声明必须附核验命令 + 日期，否则标为【假设】
  - append-only：发现错误追加「修正-N」/「ROT-N」，不删旧记录
  - 详细规则见 docs/rebuild/05-process.md §4
-->

# records/narrative/04-porting-discipline.md

> **状态**：已建立 | **时间**：2026-08-20 19:30 | **核验人**：主 agent
> **物理绑定**：[04-porting-discipline.md](../../04-porting-discipline.md)（一一对应）
> **身份**：本档案持有针对 04-porting-discipline.md 的核验记录。04 是 Phase 2+ 操作纪律，本身不直接腐烂。

---

## 核验类

## R1-R4 · 综合

- **时间**：2026-08-18 14:00
- **核验人**：subagent A-D + 主 agent
- **范围**：[04-porting-discipline.md](../../04-porting-discipline.md) v1
- **结论**：建立。无具体腐烂记录，证据已在 00/01/02/03 各自的核验中体现

---

## 修正-N · 04-porting-discipline.md §4「逐块 PR」对齐 T08 决策（T09）

- **类型**：修正（按对象：04-porting-discipline.md）
- **时间**：2026-08-21
- **依据**：T09 review（ROT-21）
- **内容**：§4「逐块 PR，PR 描述注明能力块编号」→「逐块 commit，commit message 注明能力块编号与验收测试」（docs/rebuild 范围不采用 PR 管理，T08 决策的边界显式化到移植阶段）

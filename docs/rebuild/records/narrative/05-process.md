<!--
  写作纪律（改本文前必读）：
  - 本文是 05-process.md 的对应 records（一一对应，不一致 → check-bindings 红）
  - 事实性声明必须附核验命令 + 日期，否则标为【假设】
  - append-only：发现错误追加「修正-N」/「ROT-N」，不删旧记录
  - 详细规则见 docs/rebuild/05-process.md §4
-->

# records/narrative/05-process.md

> **状态**：已建立 | **时间**：2026-08-20 19:30 | **核验人**：主 agent
> **物理绑定**：[05-process.md](../../05-process.md)（一一对应）
> **身份**：本档案持有针对 05-process.md 的修正/核验记录。05 是过程定义，本身的修改决策归 `records/docs-governance.md`。

---

## 决策类

## D10 · 文档治理方案

- **类型**：决策
- **派生自**：`records/docs-governance.md` D10
- **影响**：[05-process.md](../../05-process.md) §4 第 7/8/9 条规则、§3.1 gate review 第 4 步——本整改的直接产物

## D11 · 大改动完成度自查纪律

- **类型**：决策
- **派生自**：`records/docs-governance.md` D11
- **影响**：[05-process.md](../../05-process.md) §3.1 + §3.2 大改动纪律（本次整改补登）

---

## 修正类

## 修正-1 · 05-process.md 第7/8/9 条规则补充

- **类型**：修正（按对象：05-process.md）
- **时间**：2026-08-20 18:30
- **内容**：原 §4 只有 6 条规则，本次整改加 7/8/9 三条 + §3.1 gate review 第 4 步
- **影响**：[05-process.md](../../05-process.md) §3.1、§4 第 7-9 条

---

## 核验类

## 整改后核验（2026-08-20）

- **类型**：核验
- **时间**：2026-08-20 18:30
- **核验人**：主 agent + owner
- **范围**：[05-process.md](../../05-process.md) v2
- **结论**：7 条规则 + gate review 第 4 步均落地；CI 验证 check-docs.ts 5/5 通过

---
## 修正-N · 05-process.md v3（T02 整改：§5 迁移 + §3.2 重写）

- **类型**：修正（按对象：05-process.md）
- **时间**：2026-08-20 21:30
- **依据**：本轮整改 D13 决策
- **内容**：
  - §5 "首轮执行记录" 整段迁出至 [tasks/T00-docset-v1-2026-08-18.md](../../tasks/T00-docset-v1-2026-08-18.md)；§5 改为引用占位
  - §3.2 "任务粒度与大改动纪律" 重写——明确 task 维度 vs 文件维度分离、新增 [BIG] 标记的精确检测
  - 附录 B "大改动工作流程" 重写——明确三件套全部落 tasks/T<id>.md 单文档
- **影响**：[05-process.md](../../05-process.md) 头部状态/时间刷新；后续所有 task 必须按新流程

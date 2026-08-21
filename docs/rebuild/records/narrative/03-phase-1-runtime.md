<!--
  写作纪律（改本文前必读）：
  - 本文是 03-phase-1-runtime.md 的对应 records（一一对应，不一致 → check-bindings 红）
  - 事实性声明必须附核验命令 + 日期，否则标为【假设】
  - append-only：发现错误追加「修正-N」/「ROT-N」，不删旧记录
  - 详细规则见 docs/rebuild/05-process.md §4
-->

# records/narrative/03-phase-1-runtime.md

> **状态**：已建立 | **时间**：2026-08-20 19:30 | **核验人**：主 agent
> **物理绑定**：[03-phase-1-runtime.md](../../03-phase-1-runtime.md)（一一对应）
> **身份**：本档案持有针对 03-phase-1-runtime.md 的腐烂/修正/核验记录。**runtime 选型决策（D7/D9/SP-1~4）全量归 `records/topics/agent-runtime.md`**——本档案留指针。

---

## 腐烂类（派生自 records/topics/docs-governance.md ROT-9）

## ROT-9 · 03 v1 pi sdk「有 AI SDK harness 适配器」作基线事实

- **派生自**：`records/topics/docs-governance.md` ROT-9
- **错误**：pi sdk「有 AI SDK harness 适配器」作基线事实
- **实况**：R4：本地无包无法证实
- **处置**：v2 降级【假设】；后续 SP-2 推翻（earendil-works/pi 本地有完整源码）

---

## 修正类

## 修正-3 · 03-phase-1-runtime.md v3 附录 A 迁移

- **类型**：修正（按对象：03-phase-1-runtime.md）
- **派生自**：`records/topics/docs-governance.md` 修正-3
- **原文位置**：[03-phase-1-runtime.md](../../03-phase-1-runtime.md)「附录 A：v3 相对 v2 的修订记录」
- **迁移去向**：`records/topics/agent-runtime.md` 修正-2 条目
- **影响**：03 附录 A 删除；03 头部加纪律块 + 统一 HH:MM

## 修正-2 · 03-phase-1-runtime.md v3 重写

- **派生自**：`records/topics/agent-runtime.md` 修正-2
- **内容**：范围缩减、X 路线深化、pi 路线深化、决策框架简化、身份声明更新、前置验证条目

---

## 核验类

## R4 · 03 前端契约 + dsh 实况

- **类型**：核验
- **时间**：2026-08-18 14:00
- **核验人**：subagent D
- **范围**：[03-phase-1-runtime.md](../../03-phase-1-runtime.md) + dsh 本地仓库
- **结论**：前端 = @ai-sdk/vue Chat 类 + 自写 UIMessage stream v1 解析；dsh 实测：Cordis 插件、session 事件溯源、compaction 可替换 seam、ToolResultBlock 递归含 ImageBlock（适配器当前 text-only）、stdio 子进程嵌入、多 provider 实为 pi-ai@0.82.1；pi sdk 本地不可查 → 降级【假设】
- **影响**：03 已修正为 v2；后续 SP-2 推翻 pi sdk 不可查假设

---

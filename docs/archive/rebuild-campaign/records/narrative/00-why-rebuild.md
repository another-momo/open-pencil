<!--
  写作纪律（改本文前必读）：
  - 本文是 00-why-rebuild.md 的对应 records（一一对应，不一致 → check-bindings 红）
  - 事实性声明必须附核验命令 + 日期，否则标为【假设】
  - append-only：发现错误追加「修正-N」/「ROT-N」，不删旧记录
  - 详细规则见 docs/rebuild/05-process.md §4
-->

# records/narrative/00-why-rebuild.md

> **状态**：已建立 | **时间**：2026-08-20 19:30 | **核验人**：主 agent（整改后建立）
> **物理绑定**：[00-why-rebuild.md](../../00-why-rebuild.md)（一一对应）
> **身份**：本档案只持有针对 00-why-rebuild.md 的腐烂记录与核验记录。跨文档的治理记录归 `records/topics/docs-governance.md`。

---

## 腐烂类（从 records/topics/docs-governance.md ROT-10/11 派生）

## ROT-10 · 00 v1 缝「+79/+62、~140 纯追加」

- **类型**：腐烂
- **派生自**：`records/topics/docs-governance.md` ROT-10
- **原文档**：[00-why-rebuild.md](../../00-why-rebuild.md) v1
- **错误**：缝「+79/+62、~140 纯追加」
- **实况**：R1：+75/−4、+61/−1，136 行新增
- **处置**：v2 已修正

## ROT-11 · 00 v1 分叉「72 落后」

- **类型**：腐烂
- **派生自**：`records/topics/docs-governance.md` ROT-11
- **原文档**：[00-why-rebuild.md](../../00-why-rebuild.md) v1
- **错误**：分叉「72 落后」
- **实况**：R1：73（含合并口径）
- **处置**：v2 已修正

---

## 核验类

## V1-V3 · 首次核查（指向 00）

- **V1**（2026-08-18 14:00）：分叉规模。详见 [records/topics/docs-governance.md V1 段](../docs-governance.md)
- **V3**（2026-08-18 14:00）：旧文档腐烂。5 处实锤，见 [00-why-rebuild.md §5](../../00-why-rebuild.md)

---

## 修正-N · 00 头部时间刷新（2026-08-25）

- **类型**：修正（按对象：00-why-rebuild.md）
- **时间**：2026-08-25
- **内容**：头部时间字段「2026-08-18 14:00」滞后于内容——文件最近实质修改为 2026-08-21（T04 topics/ 重组路径迁移，79/79 行路径替换），头部未随改刷新；本次刷新为 2026-08-25 并注明原委。另核实（2026-08-25）：§3 brand config「恰 303 行」成立——`git show a1c33881:public/default-brand/config.yaml | wc -l` 与 `git show 5d38aa4e:public/default-brand/config.yaml | wc -l` 均 = 303（外部 review 称「实测 243 行」不成立，证伪）
- **task 文档**：无独立 task（T26 统一登记）

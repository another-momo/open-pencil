<!--
  写作纪律（改本文前必读）：
  - 事实性声明必须附核验命令 + 日期，否则标为【假设】
  - 计划被实测推翻时，直接改本文为新版本，完整理由记入 records/ 子文档
  - 本文只保留当前态，不保留修正历史
  - 改完后刷新本文头部的「状态」字段
  - 详细规则见 docs/rebuild/05-process.md §4
-->

# records/topics/tools-marketing.md · 营销工具

> **状态**：已建立 | **时间**：2026-08-20 18:30 | **核验人**：主 agent
> **身份**：营销工具相关决策与核验。

---

## 核验类

## 营销工具实测

- **时间**：2026-08-18 14:00
- **方法**：`ls packages/core/src/tools/marketing/ | wc -l`
- **结论**：恰 14 文件
- **注册名实测**：setup_material_type、look、compose_backdrop、sample_hero_color、derive_palette、prepare_hero_scaffold、create_brief/read_brief/append_brief_conclusion

## 测试规约

- **时间**：2026-08-18 14:00
- **方法**：`ls tests/engine/tools/marketing/ | wc -l`
- **结论**：恰 12 文件；`bun test` 报告 224 通过
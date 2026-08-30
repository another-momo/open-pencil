<!--
  写作纪律（改本文前必读）：
  - 事实性声明必须附核验命令 + 日期，否则标为【假设】
  - 计划被实测推翻时，直接改本文为新版本，完整理由记入 records/ 子文档
  - 本文只保留当前态，不保留修正历史
  - 改完后刷新本文头部的「状态」字段
  - 详细规则见 docs/rebuild/05-process.md §4
-->

# T44 核验 · config.yaml 拆解迁移 + longform.md 骨架（S4 W1 / T-A2）

> **状态**：🔄 进行中（实现完成、自检全绿后派独立核验 subagent，届时重写本文） | **时间**：2026-08-31 立项建档 | **核验人**：subagent
> **关联**：[T44-plan.md](T44-plan.md)（验收标准 C1-C5）/ [T44-self-check.md](T44-self-check.md)

## 核验范围（预告）

1. 四个资产文件逐字保真核验（对照 `brand/config.yaml` 源段 diff；C2）。
2. 实测钉扎测试与 studio-registry 16/16 复跑（C1/C3）。
3. 门禁九项复跑（C4）。
4. 登记面核对：tracker/_index/三件套/S4 注记与尾巴表（C5）。
5. 迁移取舍符合 S2 §5 迁移清单与 D-b（casual_v1 / 退役集不迁）。

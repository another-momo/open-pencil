<!--
  写作纪律（改本文前必读）：
  - 事实性声明必须附核验命令 + 日期，否则标为【假设】
  - 计划被实测推翻时，直接改本文为新版本，完整理由记入 records/ 子文档
  - 本文只保留当前态，不保留修正历史
  - 改完后刷新本文头部的「状态」字段
  - 详细规则见 docs/rebuild/05-process.md §4
-->

# T48 核验 · watercolor_poster_v2 抢救性迁移 + T44 保真核验脚本修复

> **状态**：🔄 进行中（实现完成、自检全绿后派独立核验 subagent，届时重写本文） | **时间**：2026-08-31 立项建档 | **核验人**：subagent
> **关联**：[T48-plan.md](T48-plan.md)（验收标准 C1-C6）/ [T48-self-check.md](T48-self-check.md)

## 核验范围（预告）

1. 保真核验复跑（C1：verify-t48-v2-rescue-fidelity.mjs 独立复跑 + 人工抽查 v2 正文边界——frontmatter/文首/五节/EOF）。
2. T44 卡口复活复核（C2：verify-t44-migration-fidelity.mjs 复跑 21/21 + 源读取确为 git 钉扎 commit 而非分支名）。
3. 注册与投影（C3：rebuild 测试复跑 + manifest dump 复跑含 v2 + 泄漏 CLEAN）。
4. 门禁与回归复核（C4 九项 / C5 回归计数与唯一化 diff 裁决独立性复查）。
5. 登记面（C6：三件套 / tracker/_index / T44 三件套指针行）。
6. 缺陷面：v2 与 v3 并存的选择器语义（deprecated 未标是否如 D-d 所述进数据面）、两核验脚本对 git 可用性的依赖是否如实声明、oxfmt canonical 化断言（修正记录 2）是否可复现。

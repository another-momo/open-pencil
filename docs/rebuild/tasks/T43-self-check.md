<!--
  写作纪律（改本文前必读）：
  - 事实性声明必须附核验命令 + 日期，否则标为【假设】
  - 计划被实测推翻时，直接改本文为新版本，完整理由记入 records/ 子文档
  - 本文只保留当前态，不保留修正历史
  - 改完后刷新本文头部的「状态」字段
  - 详细规则见 docs/rebuild/05-process.md §4
-->

# T43 自检 · studio 资产文件机制内核（S4 W1 / T-A1）

> **状态**：🚧 进行中（立项动作已自检，实现段随施工滚动填报） | **时间**：2026-08-30 立项 | **负责人**：主 agent
> **关联**：[T43-plan.md](T43-plan.md)（验收标准 C1-C8 以其 §4 为准）

---

## 1. 立项段自检（2026-08-30）

| 项 | 实测 |
|---|---|
| 计划文档 | T43-plan.md 已建（背景/决策点 D-a~D-g/范围 S1-S6/验收 C1-C8/不做/风险） |
| 前置 spike 批 | 已收口落档（spikes/06 + narrative + topics 登记），commit 见分支 `rebuild/mode-arch` |
| tracker/_index 登记 | tracker.md 任务表 T43 行 + 阶段门 Phase 3 行口径更新；tasks/_index.md §2 T43 行 |
| S4 §8 回写 | 01-target-state.md §2 Phase 3 行 + §4 层 1 验收口径改写；records/narrative/01-target-state.md 追加修正记录 |
| 门禁 | `bun run check:zones` clean / `check:docs` 42/42 / `check:bindings` 绿（2026-08-30 立项提交前实测） |

## 2. 门禁机制实录（本任务踩到的 check:tasks 行为）

**【事实】**（2026-08-30 读 `tools/zone-registry/src/check/tasks.ts:355-356`）：`getCommitMessage()` 取 `git log -1 --format=%B`——check:tasks 的 task 指针源是 **HEAD（上一枚）commit 的 message**，不是本次待提交 message。推论：

1. 大改动的 task 指针检查实际校验的是「上一枚 commit 指向的任务」三件套——链条靠连续 commit 均有指针维持；
2. `docs(spike):` 类无指针 commit 会使紧随的大改动 commit 判红（本任务实测：spike 批落地后 T43 立项 commit 被拒）；
3. 处置：spike 批 commit message 携带 `task: T43` 指针（其为 T43+ 解锁前置，指向成立），由此触发「T43 行三件套须在立项时即存在」——本任务的 self-check/verify 因此以**滚动填报**方式提前建档（立项即建文件，如实记「进行中」，收口时全文重写为实测值，不使用占位模板措辞）。

此行为是否与 D11-D15 原意完全吻合，留待 owner 闲时裁决（不阻塞本任务）。

## 3. 实现段自检（随施工填报）

（实现进行中：目录扫描/frontmatter 解析/注册表/校验面/单测——完成度与门禁实测值在收口时填入本节，并同步刷新头部状态。）

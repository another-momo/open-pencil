<!--
  写作纪律（改本文前必读）：
  - 事实性声明必须附核验命令 + 日期，否则标为【假设】
  - 计划被实测推翻时，直接改本文为新版本，完整理由记入 records/ 子文档
  - 本文只保留当前态，不保留修正历史
  - 改完后刷新本文头部的「状态」字段
  - 详细规则见 docs/rebuild/05-process.md §4
-->

# tasks/T03-plan.md · T03 任务计划

> **T 编号**：T03（文档治理）
> **三件套**：
> - 计划：[T03-plan.md](T03-plan.md)（本文件）
> - 自检：[T03-self-check.md](T03-self-check.md)
> - 核验：[T03-verify.md](T03-verify.md)

## 1. 任务概述

### 1.1 目标

owner 在 T02 整改完成后 review 05-process.md 时提出：

> "请 review @open-pencil-rebuild/docs/rebuild/05-process.md 为什么我没见到任何一个地方提及要 by 文件建立一一对应的 record？"

主 agent 审阅 05 后确认问题成立：D12 决策已经在 [records/topics/docs-governance.md D12](../records/topics/docs-governance.md) 里写了 narrative/ 一一对应（每物理文件一份 record），但 05-process.md 的 §3.2 只在"Task 维度 vs 文件维度的严格分离"段落里一笔带过「`records/narrative/<file>.md` 承载腐烂/修正/核验」——**未把"一一对应"作为可被 CI 拦截的明文纪律条款**，导致后来读 05 的人不知道这是强约束，只当它是 `check-bindings.ts` 的实现细节。

本 task 落地三条修正：

1. **05 §3.2 显式补"一一对应"字样** + 列出错误示范 2（跨多文件共用主题聚合 record）
2. **05 §4 新增 §4.10「文件↔record 一一对应纪律」**：核心约束 / 两层关系 / 修改触发 / 新增删除触发 / CI 拦截 五条
3. **05 §3.1 gate review 列表补第 4 项**：文件↔record 一一对应核验全绿（check-bindings.ts）升级为 gate review 硬性前置
4. **05 状态字段刷新**：「已核验」→「草稿」待 owner + subagent 核验
5. **D14 决策登记**：在 [records/topics/docs-governance.md](../records/topics/docs-governance.md) 追加 D14 条目
6. **records/narrative/05-process.md 同步登记**：物理文件→record 一一对应纪律触发

### 1.2 范围

- `docs/rebuild/05-process.md` 修改（§3.2 + §4.10 新增 + §3.1 gate review + 状态字段 + 纪律提示块）
- `docs/rebuild/records/topics/docs-governance.md` 追加 D14 条目
- `docs/rebuild/records/narrative/05-process.md` 同步登记本次修订
- `docs/rebuild/tracker.md` §2 任务表加 T03 行

### 1.3 不在范围

- 新增业务能力（仍属 Phase 1+）
- 修改 check-bindings.ts（不涉及；D14 引用现有实现）
- 修改 00-04 叙事文档（不涉及）

### 1.4 关联文档

- 上游 task：[T02-plan.md](T02-plan.md) / [T02-self-check.md](T02-self-check.md) / [T02-verify.md](T02-verify.md)
- 历史回填：[T00-plan.md](T00-plan.md) / [T00-self-check.md](T00-self-check.md) / [T00-verify.md](T00-verify.md)
- 过程定义：[05-process.md §3.2 + §4 + §4.10](05-process.md)
- 决策依据：[records/topics/docs-governance.md D14](../records/topics/docs-governance.md)

## 2. 任务清单

- [x] **05 §3.2 修订**：在"Task 维度 vs 文件维度的严格分离"段落显式补"一一对应"字样 + 列出错误示范 2（跨多文件共用主题聚合 record）
- [x] **05 §4 新增 §4.10**：标题「文件↔record 一一对应纪律（D14 候选）」，明文写下五条——核心约束 / 两层关系 / 修改触发 / 新增删除触发 / CI 拦截
- [x] **05 §3.1 gate review 列表补第 4 项**：文件↔record 一一对应核验全绿（check-bindings.ts）升级为 gate review 硬性前置
- [x] **05 §5 状态字段刷新**：「已核验」→「草稿」待 owner + subagent 核验
- [x] **05 头部纪律提示块补充**：明确文件↔record 一一对应纪律见 §4.10（owner 提出后新增 D14 候选）
- [x] **D14 决策登记**：在 docs-governance.md 追加 D14 条目
- [x] **T03 三件套创建**（plan / self-check / verify 物理拆分，2026-08-21 owner 触发后从单文档拆为三件套）
- [x] **records/narrative/05-process.md 同步登记**：物理文件→record 一一对应纪律触发
- [x] **tracker.md §2 加 T03 行**
- [x] **本地验证 + check-docs / check-bindings / check-tasks**
- [x] **提交 + 推送 + CI 全绿**（commit `b58e593c` + CI `32434330293` 11/11 全绿）
- [x] **subagent 核验-1**（subagent A 独立核验 18/18 通过）

## 3. 验收标准

- 【事实】05 §3.2 段落含"一一对应"字样，且有"错误示范 2"条目
- 【事实】05 §4 末尾新增 §4.10「文件↔record 一一对应纪律」，章节标题在文档大纲中可见
- 【事实】05 §3.1 gate review 列表至少 5 项（CI / zone check / 文档格式校验 / 文件↔record 一一对应核验 / subagent 文档核验）
- 【事实】05 头部状态字段已刷新为「草稿」+ 日期 2026-08-21
- 【事实】[records/topics/docs-governance.md](../records/topics/docs-governance.md) 含 D14 条目，类型=决策，拍板=owner，时间=2026-08-21
- 【事实】[records/narrative/05-process.md](../records/narrative/05-process.md) 已追加本次修订的"修正-N"条目
- 【事实】[tracker.md §2](../tracker.md) 含 T03 行
- 【事实】本地 `bun run check:bindings && bun run check:tasks && bun run check:docs` 全部 exit 0
- 【假设】CI 11/11 全绿（已实测：CI `32434330293` 11/11 全绿）
- 【假设】subagent 核验通过（已实测：subagent A 18/18 通过）

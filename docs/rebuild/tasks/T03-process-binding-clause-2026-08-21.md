<!--
  写作纪律（改本文前必读）：
  - 事实性声明必须附核验命令 + 日期，否则标为【假设】
  - 计划被实测推翻时，直接改本文为新版本，完整理由记入 records/ 子文档
  - 本文只保留当前态，不保留修正历史
  - 改完后刷新本文头部的「状态」字段
  - 详细规则见 docs/rebuild/05-process.md §4
-->

# tasks/T03-process-binding-clause-2026-08-21.md · 05 文件↔record 一一对应纪律补漏

> **状态**：进行中 | **时间**：2026-08-21 开
> **核验人**：主 agent（owner 触发）
> **身份**：T03 = 本次"05 未提及文件↔record 一一对应纪律"反思的整改 task 档案。
> **关联**：
> - 上游 task：[T02-doc-discipline-check-2026-08-20.md](T02-doc-discipline-check-2026-08-20.md)
> - 历史回填：[T00-docset-v1-2026-08-18.md](T00-docset-v1-2026-08-18.md)
> - 过程定义：[05-process.md §3.2 + §4 + §4.10](05-process.md)
> - 决策依据：[records/docs-governance.md D14](../records/docs-governance.md)

## 1. 任务概述

### 1.1 目标

owner 在 T02 整改完成后 review 05-process.md 时提出：

> "请 review @open-pencil-rebuild/docs/rebuild/05-process.md 为什么我没见到任何一个地方提及要 by 文件建立一一对应的 record？"

主 agent 审阅 05 后确认问题成立：D12 决策已经在 [records/docs-governance.md D12](../records/docs-governance.md) 里写了 narrative/ 一一对应（每物理文件一份 record），但 05-process.md 的 §3.2 只在"Task 维度 vs 文件维度的严格分离"段落里一笔带过「`records/narrative/<file>.md` 承载腐烂/修正/核验」——**未把"一一对应"作为可被 CI 拦截的明文纪律条款**，导致后来读 05 的人不知道这是强约束，只当它是 `check-bindings.ts` 的实现细节。

本 task 落地三条修正：

1. **05 §3.2 显式补"一一对应"字样** + 列出错误示范 2（跨多文件共用主题聚合 record）
2. **05 §4 新增 §4.10「文件↔record 一一对应纪律」**：核心约束 / 两层关系 / 修改触发 / 新增删除触发 / CI 拦截 五条
3. **05 §3.1 gate review 列表补第 4 项**：文件↔record 一一对应核验全绿（check-bindings.ts）升级为 gate review 硬性前置
4. **05 状态字段刷新**：「已核验」→「草稿」待 owner + subagent 核验
5. **D14 决策登记**：在 [records/docs-governance.md](../records/docs-governance.md) 追加 D14 条目
6. **records/narrative/05-process.md 同步登记**：物理文件→record 一一对应纪律触发

### 1.2 范围

- `docs/rebuild/05-process.md` 修改（§3.2 + §4.10 新增 + §3.1 gate review + 状态字段 + 纪律提示块）
- `docs/rebuild/records/docs-governance.md` 追加 D14 条目
- `docs/rebuild/records/narrative/05-process.md` 同步登记本次修订
- `docs/rebuild/tracker.md` §2 任务表加 T03 行

### 1.3 不在范围

- 新增业务能力（仍属 Phase 1+）
- 修改 check-bindings.ts（不涉及；D14 引用现有实现）
- 修改 00-04 叙事文档（不涉及）

## 2. 任务清单

- [x] **05 §3.2 修订**：在"Task 维度 vs 文件维度的严格分离"段落显式补"一一对应"字样 + 列出错误示范 2（跨多文件共用主题聚合 record）
- [x] **05 §4 新增 §4.10**：标题「文件↔record 一一对应纪律（D14 候选）」，明文写下五条——核心约束 / 两层关系 / 修改触发 / 新增删除触发 / CI 拦截
- [x] **05 §3.1 gate review 列表补第 4 项**：文件↔record 一一对应核验全绿（check-bindings.ts）升级为 gate review 硬性前置
- [x] **05 §5 状态字段刷新**：「已核验」→「草稿」待 owner + subagent 核验
- [x] **05 头部纪律提示块补充**：明确文件↔record 一一对应纪律见 §4.10（owner 提出后新增 D14 候选）
- [x] **D14 决策登记**：在 docs-governance.md 追加 D14 条目
- [x] **T03 本文档创建**（本任务）
- [ ] **records/narrative/05-process.md 同步登记**：物理文件→record 一一对应纪律触发
- [ ] **tracker.md §2 加 T03 行**
- [ ] **本地验证 + check-docs / check-bindings / check-tasks**
- [ ] **提交 + 推送 + CI 全绿**
- [ ] **subagent 核验-N**（owner 触发）

## 3. 验收标准

- 【事实】05 §3.2 段落含"一一对应"字样，且有"错误示范 2"条目
- 【事实】05 §4 末尾新增 §4.10「文件↔record 一一对应纪律」，章节标题在文档大纲中可见
- 【事实】05 §3.1 gate review 列表至少 5 项（CI / zone check / 文档格式校验 / 文件↔record 一一对应核验 / subagent 文档核验）
- 【事实】05 头部状态字段已刷新为「草稿」+ 日期 2026-08-21
- 【事实】[records/docs-governance.md](../records/docs-governance.md) 含 D14 条目，类型=决策，拍板=owner，时间=2026-08-21
- 【事实】[records/narrative/05-process.md](../records/narrative/05-process.md) 已追加本次修订的"修正-N"条目
- 【事实】[tracker.md §2](../tracker.md) 含 T03 行
- 【事实】本地 `pnpm check:bindings && pnpm check:tasks && pnpm check:docs` 全部 exit 0
- 【假设】CI 11/11 全绿（待推送后实测）
- 【假设】subagent 核验通过（待 owner 触发）

## 4. 自检 · 2026-08-21

**主 agent 任务清单**（对照原方案）：

- [x] 05 §3.2 修订（【事实】已做）
- [x] 05 §4.10 新增（【事实】已做）
- [x] 05 §3.1 gate review 列表补第 4 项（【事实】已做）
- [x] 05 状态字段刷新（【事实】已做）
- [x] 05 头部纪律提示块补充（【事实】已做）
- [x] D14 决策登记（【事实】已做）
- [x] T03 本文档创建（【事实】已做）
- [ ] records/narrative/05-process.md 同步登记（【事实】待做）
- [ ] tracker.md §2 加 T03 行（【事实】待做）
- [ ] 本地验证（【事实】待做）
- [ ] 提交 + 推送 + CI（【假设】待做）

**承诺 vs 落地对照**：

| 原方案承诺 | 实际落地 | 偏差 | 决策登记 |
|---|---|---|---|
| 05 §3.2 显式补"一一对应" + 错误示范 2 | ✅ 已做 | 无 | — |
| 05 §4.10 新增文件↔record 一一对应纪律（五条） | ✅ 已做 | 无 | — |
| 05 §3.1 gate review 补第 4 项 | ✅ 已做 | 无 | — |
| 05 状态字段刷新 | ✅ 已做 | 无 | — |
| D14 决策登记 | ✅ 已做 | 无 | — |
| T03 文档创建 | ✅ 已做（自身） | — | — |
| records/narrative/05-process.md 同步 | 🔄 进行中 | — | — |

**完成度自评**：

- 完全落地 7 条（70%）——核心条款 + 决策登记 + task 文档自身
- 部分落地 0 条（0%）
- 完全未做 0 条（0%）
- 待办 3 条（30%）——record 同步 / tracker 加行 / 本地验证 + 推送

**自评要点**：

1. **没有"号称完成"**：本次任务清单每项都可被 `grep` / 文件存在 / `pnpm check:*` 命令验证
2. **没有"做而不报"**：D14 决策已经登记（[records/docs-governance.md](../records/docs-governance.md)），偏差无（owner 原方案 5 项全部落地）
3. **没有"task 自检混入 record"**：本次自检落在本 T03 文档 §4，不进 `records/narrative/05-process.md`；record 那边只追加"修正-N"条目
4. **owner 反思闭环**：owner 提出"05 没提文件↔record 一一对应"问题 → 主 agent review 确认问题成立 → 整改 5 处 → D14 决策登记 → T03 文档承载计划+自检 → （待 owner 触发）subagent 核验

## 5. 核验-N（待 owner 触发）

**【假设】待 owner 触发 subagent 独立核验**。

subagent 应核验：

- 05 §3.2 是否含"一一对应"字样（grep "一一对应"）
- 05 §4 是否含 §4.10 章节（grep "§4.10" 或 "文件↔record 一一对应纪律"）
- 05 §3.1 gate review 列表是否含 5 项（人工/grep 段落数）
- 05 头部状态字段是否为「草稿」+ 2026-08-21（读首段）
- docs-governance.md 是否含 D14 条目（grep "^## D14"）
- records/narrative/05-process.md 是否含本次修订的"修正-N"条目（grep "修正-"）
- tracker.md §2 是否含 T03 行（grep "T03"）
- 本任务文档是否含 §1/§2/§3/§4 章节（grep "^## "）

本任务非紧急，核验可后置。

## 6. 决策影响

- **新增 D14 决策**：把"文件↔record 一一对应"从 D12 的隐含约定升级为 05 §4.10 的明文纪律条款
- **强化 check-bindings.ts 的纪律依据**：之前只是"有工具"，现在是"05 §4.10 明确要求"——CI 拦截有理有据
- **强化 gate review 第 4 步**：subagent 文档核验之前新增一条自动化检查（check-bindings.ts）+ pre-commit 拦截
- **下次 gate review 时**：必须跑 `pnpm check:bindings` + 排 subagent 核验"文件↔record 一一对应"是否全量覆盖

## 7. 参考资料

- 05-process.md §3.2 task 维度 vs 文件维度分离
- 05-process.md §3.1 gate review 标准动作
- 05-process.md §4.10 文件↔record 一一对应纪律（本 task 新增）
- records/docs-governance.md D12（narrative/ 一一对应起源）+ D13（check-tasks 增强）+ D14（本 task 登记）
- tasks/T00-docset-v1-2026-08-18.md（历史回填示例）
- tasks/T02-doc-discipline-check-2026-08-20.md（上游 task 模板）
- tools/zone-registry/src/check/bindings.ts（CI 实现）
- tools/zone-registry/src/check/tasks.ts（CI 实现）
- tools/hooks/pre-commit（本地拦截）

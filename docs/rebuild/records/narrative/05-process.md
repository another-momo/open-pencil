<!--
  写作纪律（改本文前必读）：
  - 本文是 05-process.md 的对应 records（一一对应，不一致 → check-bindings 红）
  - 事实性声明必须附核验命令 + 日期，否则标为【假设】
  - append-only：发现错误追加「修正-N」/「ROT-N」，不删旧记录
  - 详细规则见 docs/rebuild/05-process.md §4
-->

# records/narrative/05-process.md

> **状态**：已建立 | **时间**：2026-08-21 滚动 | **核验人**：主 agent
> **物理绑定**：[05-process.md](../../05-process.md)（一一对应）
> **身份**：本档案持有针对 05-process.md 的修正/核验记录。05 是过程定义，本身的修改决策归 `records/docs-governance.md`。
> **变更触发**：2026-08-21 owner 提出 "05 未提及文件↔record 一一对应"问题 → D14 决策 → 本档案追加"修正-N · v4"条目。

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

## 修正-N · 05-process.md v4（T03 整改：补 §4.10 文件↔record 一一对应纪律）

- **类型**：修正（按对象：05-process.md）
- **时间**：2026-08-21
- **依据**：本轮整改 D14 决策（owner 触发）
- **背景**：D12 已决定 narrative/ 一一对应（每物理文件一份 record），但 05 §3.2 只在"Task 维度 vs 文件维度的严格分离"段落里一笔带过「`records/narrative/<file>.md` 承载腐烂/修正/核验」——**未把"一一对应"作为可被 CI 拦截的明文纪律条款**，导致后来读 05 的人不知道这是强约束
- **内容**：
  - §3.2 "Task 维度 vs 文件维度的严格分离" 段落：文件维度条目显式补"**与物理文件一一对应**"字样，新增"错误示范 2"（跨多文件共用主题聚合 record）
  - §4 新增 §4.10「文件↔record 一一对应纪律（D14 候选）」，明文五条——核心约束 / 两层关系（`records/<对象>.md` 主题聚合层 vs `records/narrative/<file>.md` 物理绑定层）/ 修改触发 / 新增删除触发 / CI 拦截（check-bindings.ts + pre-commit + gate review 第 4 步）
  - §3.1 gate review 列表补第 4 项：文件↔record 一一对应核验全绿（check-bindings.ts）升级为 gate review 硬性前置
  - 头部状态字段刷新：「已核验」→「草稿」+ 2026-08-21 + 待 owner + subagent 核验
  - 头部纪律提示块补充：明确"文件↔record 一一对应纪律见 §4.10（owner 提出后新增 D14 候选）"
- **影响**：
  - 文件↔record 一一对应从 D12 的隐含约定升级为 05 §4.10 的明文纪律条款
  - check-bindings.ts 的纪律依据从"有工具"升级为"05 §4.10 明确要求"
  - 下次 gate review 时必须跑 `pnpm check:bindings` + 排 subagent 核验"文件↔record 一一对应"是否全量覆盖
- **task 文档**：[tasks/T03-process-binding-clause-2026-08-21.md](../../tasks/T03-process-binding-clause-2026-08-21.md)

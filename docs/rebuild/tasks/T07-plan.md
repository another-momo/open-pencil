<!--
  写作纪律（改本文前必读）：
  - 事实性声明必须附核验命令 + 日期，否则标为【假设】
  - 计划被实测推翻时，直接改本文为新版本，完整理由记入 records/ 子文档
  - 本文只保留当前态，不保留修正历史
  - 改完后刷新本文头部的「状态」字段
  - 详细规则见 docs/rebuild/05-process.md §4
-->

# tasks/T07-plan.md · T07 任务计划

> **T 编号**：T07（文档治理 · 修正 §4.10 应用错误 + 高频腐烂防御）
> **三件套**：
> - 计划：[T07-plan.md](T07-plan.md)（本文件）
> - 自检：[T07-self-check.md](T07-self-check.md)
> - 核验：[T07-verify.md](T07-verify.md)

## 1. 任务概述

### 1.1 目标

owner 在 T06 push 后提出两个治理问题，本 task 落地修正：

1. **问题 1（owner 指出错误）**：T06 创建 `records/narrative/ci-infra.md` 是**误应用 §4.10 物理绑定纪律**——横向档案（`records/topics/<topic>.md`）本身没有"对应物理文件"，不需要 narrative 绑定。
   - **修正**：撤回 `narrative/ci-infra.md`；把内容合并到 `topics/ci-infra.md`（T06 同步条目）
   - **§4.10 文本修订**：明确 narrative/ **只绑物理文件**，不绑横向档案；新增"误区 2"（横向档案不该有 narrative 绑定）+ 撤回案例

2. **问题 2（owner 指出高频腐烂）**：`README.md` 第二层列表 + `tracker.md` §3 记录索引 + 05 §2 树状图——叙事文档里直接列档案文件，每次新加档案都需同步更新，高频腐烂。
   - **修正**：`README.md` 第二层列表改为指向 `records/_index.md` 作为权威列表（已改过 tracker §3 同款思路）；保留简短"层级描述 + 高频腐烂防御"标注
   - **05 §2 树状图**：保留——它本身就是规范层级描述（不是高频腐烂）
   - **tracker.md §3**：已按 owner 思路改过（指向 _index.md + 简短顶层结构）

### 1.2 范围

- `git rm docs/rebuild/records/narrative/ci-infra.md`（撤回）
- `records/topics/ci-infra.md` 追加 T06 同步条目（含"§4.10 应用错误"撤回案例说明）
- `docs/rebuild/05-process.md §4.10` 修订：明确 narrative/ 只绑物理文件 + 误区 2 + 撤回案例
- `docs/rebuild/README.md` 第二层列表改为指向 `_index.md` + 高频腐烂防御标注
- `tracker.md / _index.md` 同步 T06 行状态（完成）
- T07 三件套自身

### 1.3 不在范围

- 修改 `_index.md` 本身（已是权威列表）
- 修改 `topics/` 下其他横向档案（不需要 narrative 绑定是普遍规则，不是逐个修正）
- 修改 05 §2 树状图（本身是规范层级描述，保留）
- 修改 `tracker.md §3`（已按 owner 思路改过）

### 1.4 关联文档

- 上游 task：[T06-plan.md](T06-plan.md)（T06 LFS cache 启用）
- 触发：owner "1、按照现在的文档纪律，变更文档放到 records/narrative/ci-infra.md 是对的嘛？根目录下并没有 ci-infra.md 文件啊……是不是放到 topic 下面呢；2、README.md 已经腐烂了……"
- 过程定义：[05-process.md §4.10 + §4.11](05-process.md)
- 决策依据：本次 T07 落地的 §4.10 修订本身

## 2. 任务清单

- [x] **撤回 narrative/ci-infra.md**（误创建的横向档案 narrative 绑定）
- [x] **topics/ci-infra.md 追加 T06 同步条目**（含"§4.10 应用错误"说明）
- [x] **05-process.md §4.10 修订**：明确 narrative/ 只绑物理文件 + 误区 2 + 撤回案例
- [x] **README.md 第二层列表简化**：指向 _index.md 作为权威列表 + 高频腐烂防御标注
- [x] **tracker.md / tasks/_index.md 同步 T06 行状态**（完成）
- [x] **T07 三件套创建**
- [x] **narrative/05-process.md 同步登记本次修订**（§4.10 应用错误修正）
- [x] **本地校验**（check-docs / check-bindings / check-tasks）
- [x] **提交 + push + CI 全绿**
- [x] **subagent 核验-1**

## 3. 验收标准

- 【事实】`docs/rebuild/records/narrative/ci-infra.md` 不存在（已撤回）
- 【事实】`docs/rebuild/records/topics/ci-infra.md` 含 T06 同步条目
- 【事实】`docs/rebuild/05-process.md §4.10` 含"横向档案不需要 narrative 绑定"明确说明 + 误区 2 + 撤回案例
- 【事实】`docs/rebuild/README.md` 第二层列表已简化（指向 _index.md + 高频腐烂防御标注）
- 【假设】CI 11/11 全绿
- 【假设】subagent 核验通过

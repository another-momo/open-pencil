<!--
  写作纪律（改本文前必读）：
  - 事实性声明必须附核验命令 + 日期，否则标为【假设】
  - 计划被实测推翻时，直接改本文为新版本，完整理由记入 records/ 子文档
  - 本文只保留当前态，不保留修正历史
  - 改完后刷新本文头部的「状态」字段
  - 详细规则见 docs/rebuild/05-process.md §4
-->

# tasks/T05-plan.md · T05 任务计划

> **T 编号**：T05（文档治理 · 00-05 系统性腐烂 review）
> **三件套**：
> - 计划：[T05-plan.md](T05-plan.md)（本文件）
> - 自检：[T05-self-check.md](T05-self-check.md)
> - 核验：[T05-verify.md](T05-verify.md)

## 1. 任务概述

### 1.1 目标

owner 在 T04 收尾后指出"`tracker.md` §3 记录索引章节信息已过期"，主 agent 借机系统性 review 00-05 全部叙事文档，识别并修复已暴露的腐烂点。本 task 落地发现的腐烂点修正：

1. **腐烂点 1（高）**：外部建议文档 `docs/rebuild-docs-governance-proposal.md` 在仓库根外（工作区根 `docs/` 子目录，非本仓库内），T01-plan.md / docs-governance.md 多处引用——外部依赖 + 无版本控制 + 路径不可追溯
2. **腐烂点 2（高）**：`05-process.md §2 文档体系` 树状图还是 D12 之前的旧结构——没有 `tasks/` 子目录、没有 `records/{narrative,topics}/` 两层结构、records/ 平铺横向档案
3. **腐烂点 3（低，已撤销）**：原担心 00 / 04 状态字段停留在 2026-08-18——经查 narrative/00-why-rebuild.md + narrative/04-porting-discipline.md 确认两个文件均无新增腐烂/修正条目，状态字段维持原值合规（§4 第 2 条"修改才需刷新"，未修改可保持）。**撤销**。
4. **腐烂点 4（中）**：D9「dsh 集成形态」状态 `open（待 owner 拍板）`——但 03-phase-1-runtime.md v3 已按"Y 路线弃 + X vs pi 待 spike 后"撰写；决策状态与文档内容不一致。主 agent **不自行拍板**，登记为 D16 候选让 owner 决定如何对齐。

### 1.2 范围

- `docs/rebuild/proposals/` 子目录创建
- `docs/rebuild/proposals/governance-v1.md` 创建（从仓库外 `docs/rebuild-docs-governance-proposal.md` 复制 + 加头部元信息）
- `docs/rebuild/tasks/T01-plan.md` 引用路径更新（2 处）
- `docs/rebuild/records/topics/docs-governance.md` 引用路径更新（2 处）
- `docs/rebuild/05-process.md §2` 树状图重写（反映 `proposals/` + `tasks/` + `records/{narrative,topics}/` + `narrative/{tasks,proposals}/`）
- `docs/rebuild/records/topics/docs-governance.md` 追加 D16 候选登记（D9 vs 03 不一致 + 外部 proposal 内化）
- T05 三件套自身（plan / self-check / verify）

### 1.3 不在范围

- 新增业务能力（仍属 Phase 1+）
- 修改 narrative/ 子文档（腐烂点 1-4 不涉及）
- 修改 check-* 脚本（D15 已重写完成）
- 实际解决 D9 决策本身（主 agent 不自行拍板——D16 候选等 owner）

### 1.4 关联文档

- 上游 task：[T04-plan.md](T04-plan.md) / [T04-self-check.md](T04-self-check.md) / [T04-verify.md](T04-verify.md)
- 触发提问：owner "tracker.md §3 记录索引信息已过期" + 二次提问"`05-process.md §2 文档体系` 也全部过期，请你逐一 review 一下 00-05 文档"
- 过程定义：[05-process.md §3.2 + §4 + §4.10 + §4.11](05-process.md)
- 决策依据：[records/topics/docs-governance.md D16 候选](../records/topics/docs-governance.md)
- 外部建议源头：[proposals/governance-v1.md](../proposals/governance-v1.md)

## 2. 任务清单

- [x] **腐烂点 1**：复制仓库外 proposal 到 `docs/rebuild/proposals/governance-v1.md` + 加头部元信息
- [x] **腐烂点 1**：更新所有引用路径（`docs/rebuild-docs-governance-proposal.md` → `docs/rebuild/proposals/governance-v1.md`）
- [x] **腐烂点 2**：重写 `05-process.md §2 文档体系` 树状图（反映 tasks/ + records/{narrative,topics}/ + narrative/{tasks,proposals}/）
- [x] **腐烂点 3**：撤销（00 / 04 状态字段合规，无需修改）
- [x] **腐烂点 4**：D16 候选登记到 docs-governance.md（主 agent 不自行拍板 D9）
- [x] **T05 三件套创建**（plan / self-check / verify）
- [x] **records/narrative/{05-process.md} 同步登记腐烂点 1 + 2**（按 §4.10 物理绑定纪律）
- [x] **本地校验**（check-docs / check-bindings / check-tasks）
- [x] **提交 + push + CI 全绿**
- [x] **subagent 核验-1**（subagent A 独立核验）

## 3. 验收标准

- 【事实】`docs/rebuild/proposals/governance-v1.md` 存在 + 头部有「状态/时间/作者/来源/身份/采纳映射」元信息
- 【事实】所有 `rebuild-docs-governance-proposal.md` 旧路径引用替换为 `proposals/governance-v1.md` 新路径
- 【事实】`05-process.md §2` 树状图含 `proposals/` + `tasks/` + `records/{narrative,topics}/` + `narrative/{tasks,proposals}/`
- 【事实】`docs-governance.md` 含 D16 候选条目
- 【假设】CI 11/11 全绿
- 【假设】subagent 核验通过

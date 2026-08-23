<!--
  写作纪律（改本文前必读）：
  - 本文是 01-target-state.md 的对应 records（一一对应，不一致 → check-bindings 红）
  - 事实性声明必须附核验命令 + 日期，否则标为【假设】
  - append-only：发现错误追加「修正-N」/「ROT-N」，不删旧记录
  - 详细规则见 docs/rebuild/05-process.md §4
-->

# records/narrative/01-target-state.md

> **状态**：已建立 | **时间**：2026-08-20 19:30 | **核验人**：主 agent
> **物理绑定**：[01-target-state.md](../../01-target-state.md)（一一对应）
> **身份**：本档案只持有针对 01-target-state.md 的腐烂记录与核验记录。runtime选型相关决策归 `records/topics/agent-runtime.md` D9。

---

## 腐烂类（派生自 records/topics/docs-governance.md ROT-1~4）

## ROT-1 · 01 v1 能力地图按价值分层

- **派生自**：`records/topics/docs-governance.md` ROT-1
- **错误**：能力地图按价值分层，闭环只列 C 块
- **实况**：缺支撑底座 F0，闭环跑不起来
- **处置**：v2 已重构

## ROT-2 · 01 v1 C1 含「素材图理解（hash 缓存）」

- **派生自**：`records/topics/docs-governance.md` ROT-2
- **错误**：C1 含「素材图理解（hash 缓存）」
- **实况**：R2 实测全仓无代码，phantom
- **处置**：v2 移入不加清单 + D8

## ROT-3 · 01 v1 validate 列为「后续移植/已废弃旧物」

- **派生自**：`records/topics/docs-governance.md` ROT-3
- **错误**：validate 列为「后续移植/已废弃旧物」
- **实况**：R2 实测无此工具注册
- **处置**：v2 改 C3c 新建

## ROT-4 · 01 v1 生图历史列为「后续独立加法」

- **派生自**：`records/topics/docs-governance.md` ROT-4
- **错误**：生图历史列为「后续独立加法」
- **实况**：R2 实测已内置于 generate_image
- **处置**：v2 已修正

---

## 核验类

## R2 · 01 组件与闭环依赖

- **类型**：核验
- **时间**：2026-08-18 14:00
- **核验人**：subagent B
- **范围**：[01-target-state.md](../../01-target-state.md)
- **结论**：端到端 9 环依赖链还原；能力地图漏 10 项（生图独立凭证链、MCP 桥三进程、brand 后端服务、聊天凭证下发、session 零持久化真相、validate 不存在、素材理解 phantom、生图历史已内置、视觉回路双份、ChatPanel 在根目录）→ 01 已重构

---

## 修正-N · 01 §1 补 D23 口径（编辑器完整前端能力在孤岛内全量保留）

- **类型**：修正（按对象：01-target-state.md）
- **时间**：2026-08-23
- **依据**：owner 拍板 D23（[records/topics/agent-runtime.md](../topics/agent-runtime.md)）——针对「overlay 内为何只有编辑器底层」质询，明确「我从来没有想要丢掉这些能力」；01 层 0/层 1/层 2 未列编辑器 chrome 块系计划空白，非「不做」决策
- **内容**：§1 一句话定义补一句：编辑器完整前端能力（画布 + 面板 chrome）在孤岛内全量保留（引 D23）；chrome 移植属主线范围，parity 切换前完成，实施任务待登记（建议紧随 T18 后）
- **task 文档**：[tasks/T17-plan.md](../../tasks/T17-plan.md)（登记提交随 T17 收口后决策，无独立任务）

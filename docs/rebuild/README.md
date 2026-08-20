# 重建文档集（rebuild）

> 状态：**已核验**（2026-08-18，核查轮 R1-R4 通过：4 个只读 subagent 分文档对账 + 主 agent 整体 review；腐烂记录与核验日志见 tracker.md）
> 分支：`rebuild/v2`（基线 `upstream/master` @ `15bd0ba1`）| 供货方/参考：旧分支 `feature/agent-backend`（测量点 `a1c33881`）

## 本目录是什么

重建（re-fork + 绞杀式移植）的叙事与决策文档来源。**文档身份按主次分级**：

| 文档 | 身份 | 作用 |
|---|---|---|
| [01-target-state.md](01-target-state.md) | **决策依据（核心）** | 「做哪些加法」+ runtime 选型对照（§7 三路线） |
| [02-phase-0.md](02-phase-0.md) | **执行依据（核心）** | Phase 0 完成态与验收 |
| [03-phase-1-runtime.md](03-phase-1-runtime.md) | 辅助参考（case study / 技术调研） | runtime 选型硬门与 spike 问题（不直接驱动 gate） |
| [04-porting-discipline.md](04-porting-discipline.md) | 辅助参考 | 移植纪律与 parity 线 |
| [05-process.md](05-process.md) | **执行依据（核心）** | 工作方式与文档纪律 |
| [tracker.md](tracker.md) | **执行依据（核心，活文档）** | 阶段门 / 决策日志 / 任务 / WIP / 核验 / 腐烂 |
| spikes/*.md | 辅助参考（源码核查报告） | dsh / pi 路线 + weshop 案例的实证 |

## 文档治理规则（吸取旧分支教训）

旧分支规划文档已实测腐烂多处（00 §5 五处实锤）。因此：

- **真相分层**：路径归属 → zone registry（代码，CI 校验，Phase 0 产出）；状态与决策 → tracker.md；叙事与理由 → 00-05。冲突时 registry > tracker > 叙事文档。
- 叙事文档会腐烂——本目录也不例外。发现与现实不符，**当场修正 + tracker 腐烂记录加一行**。
- 事实性结论必须附核验命令与日期（【事实】/【决策】/【假设】三标，见 05 §4）。
- 旧分支 `docs/` 下文档仅作历史参考，引用前必须重新核验。

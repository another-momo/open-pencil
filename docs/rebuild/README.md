# 重建文档集（rebuild）

> 状态：pre-Phase-0 | 建立日期：2026-08-18 | 分支：`rebuild/v2`（基线 `upstream/master` @ `15bd0ba1`）
> 供货方/参考：旧分支 `feature/agent-backend`（fork 全部资产与事故学所在）。

## 本目录是什么

重建（re-fork + 绞杀式移植）的唯一叙事文档来源。阅读顺序：

1. [00-why-rebuild.md](00-why-rebuild.md) — 为什么重建、保留什么、实测数据
2. [01-target-state.md](01-target-state.md) — 目标态定义、能力地图、不加清单、待决项
3. [02-phase-0.md](02-phase-0.md) — Phase 0 完成态定义与验收标准
4. [03-phase-1-runtime.md](03-phase-1-runtime.md) — runtime 选型 spike 与硬门
5. [04-porting-discipline.md](04-porting-discipline.md) — 移植纪律与 parity 线

## 文档治理规则（吸取旧分支教训）

旧分支的规划文档由历代 agent 撰写，已实测发现多处与代码严重不符（见 00 文档「文档腐烂实录」）。因此：

- **路径归属的真相在 zone registry**（Phase 0 产出，代码形态 + CI 校验），不在本目录。本目录只放叙事、决策与验收标准。
- 叙事文档会腐烂——本目录也不例外。任何与 registry / 代码冲突之处，**以代码为准，并当场修正文档**，不许留着等烂。
- 事实性结论必须附核验命令与日期，让任何人可以重跑验证。
- 旧分支 `docs/` 下的规划文档（fork-divergence、end-state-follow-model、pi-sdk-migration 等）仅作历史参考，引用前必须重新核验。

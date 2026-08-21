<!--
  写作纪律（改本文前必读）：
  - 事实性声明必须附核验命令 + 日期，否则标为【假设】
  - 计划被实测推翻时，直接改本文为新版本，完整理由记入 records/ 子文档
  - 本文只保留当前态，不保留修正历史
  - 改完后刷新本文头部的「状态」字段
  - 详细规则见 docs/rebuild/05-process.md §4
-->

# tracker · 重建跟踪表（活文档·精简索引）

> **状态**：已建立 | **时间**：2026-08-20 18:30 | **核验人**：主 agent
> **身份**：阶段门 + 任务表 + 记录索引三块合一（≤50 行）。详细记录见 `records/` 子文档。更新纪律见 `05-process.md §4`。
> **状态值**：⬜未开始 / 🔄进行中 / ✅完成 / ❌阻塞 / 🪦放弃

## 1. 阶段门

| 阶段 | 出口标准（摘要） | 状态 | 完成日期 | 验收签字 |
|---|---|---|---|---|
| pre-0 文档集 | 文档核查 + review 修正完成（R1-R4） | ✅ | 2026-08-18 14:00 | 待 owner |
| Phase 0 机制+减法 | [02-phase-0.md §5](02-phase-0.md) 七条验收（实测结果已填） | ✅ | 2026-08-19 16:30 | 待 owner（远端 CI 验证后补签） |
| Phase 1 runtime spike | 03 Q0-Q3 有代码答案 + 能力契约测试绿 | ⬜ | — | — |
| Phase 2 F0 地基切片 | [01-target-state.md §2](01-target-state.md) hello-tool 验收 | ⬜ | — | — |
| Phase 3 最小价值闭环 | [01-target-state.md §3](01-target-state.md) 层 1 验收（端到端 + 16 测试文件绿 + CI 绿） | ⬜ | — | — |
| Phase 4 增强补齐 | [01-target-state.md §4](01-target-state.md) 层 2 逐块进 | ⬜ | — | — |
| parity 切换 | [01-target-state.md §7](01-target-state.md)，owner 决定 | ⬜ | — | — |

## 2. 任务表（能力块 = 1 PR + 验收测试 + 本表一行）

| T 编号 | 块 | 内容 | 验收 | 状态 | PR | 任务计划 |
|---|---|---|---|---|---|---|
| T00 | 文档治理 | 文档集首轮整改（R1-R4 核查轮）| ✅ 完成（历史回填） | ✅ | — | [T00](tasks/T00-docset-v1-2026-08-18.md) |
| T01 | 文档治理 | 文档体系整改（plan-correction / tracker拆分 / check-docs / binding / tasks）| ✅ 完成（待 owner 验收） | ✅ | [T01](tasks/T01-governance-2026-08-20.md) |
| T02 | 文档治理 | 文档纪律二次检查（[05-process.md §5](05-process.md) 迁移 + check-tasks 增强）| ✅ 完成（CI 11/11 全绿，核验-N 后置） | ✅ | [T02](tasks/T02-doc-discipline-check-2026-08-20.md) |
| T03 | 文档治理 | [05-process.md §4.10](05-process.md) 文件↔record 一一对应纪律补漏（D14 决策落地）| 🔄 进行中 | — | [T03](tasks/T03-process-binding-clause-2026-08-21.md) |
| — | （Phase 1 开工后逐行登记） | — | — | — | — | — |

## 3. 记录索引

> 对象 → records/ 子文档

| 对象 | 文件 |
|---|---|
| agent 后端 / runtime | `records/agent-runtime.md` |
| brand config / type / profile | `records/brand-config.md` |
| Chat UI | `records/chat-ui.md` |
| i18n 缝 / locale | `records/i18n.md` |
| 营销工具 | `records/tools-marketing.md` |
| 生图管线 | `records/tools-image-gen.md` |
| upstream 合并 | `records/upstream-merge.md` |
| CI / zone registry / autocrlf | `records/ci-infra.md` |
| spike 文档 | `records/spikes.md` |
| 文档体系治理 | `records/docs-governance.md` |
| 全部子文档索引 | `records/_index.md` |
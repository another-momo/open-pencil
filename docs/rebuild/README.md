<!--
  写作纪律（改本文前必读）：
  - 事实性声明必须附核验命令 + 日期，否则标为【假设】
  - 计划被实测推翻时，直接改本文为新版本，完整理由记入 records/ 子文档
  - 本文只保留当前态，不保留修正历史
  - 改完后刷新本文头部的「状态」字段
  - 详细规则见 docs/rebuild/05-process.md §4
-->

# 重建文档集（rebuild）

> **状态**：已核验 | **时间**：2026-08-20 18:30（本轮整改）| **核验人**：主 agent + owner
> **身份**：重建文档集（re-fork + 绞杀式移植）的叙事与决策文档来源。治理规则由 05-process.md 定义，本文件是入口。
> **基线**：分支 `rebuild/v2`（基线 `upstream/master` @ `15bd0ba1`）| 供货方/参考：旧分支 `feature/agent-backend`（测量点 `a1c33881`）

## 本目录是什么

重建文档集按"决策链主次 + 对象"两层组织：

### 第一层：叙事/决策文档（按身份分级）

| 文档 | 身份 | 作用 |
|---|---|---|
| [00-why-rebuild.md](00-why-rebuild.md) | 辅助参考（背景叙事） | 为什么走 re-fork + 绞杀式移植这条路 |
| [01-target-state.md](01-target-state.md) | **决策依据（核心）** | 「做哪些加法」+ runtime 选型对照（[§7 三路线](01-target-state.md)） |
| [02-phase-0.md](02-phase-0.md) | **执行依据（核心）** | Phase 0 完成态与验收（[§5 七条](02-phase-0.md)） |
| [03-phase-1-runtime.md](03-phase-1-runtime.md) | 辅助参考（case study / 技术调研） | runtime 选型硬门与 spike 问题（不直接驱动 gate） |
| [04-porting-discipline.md](04-porting-discipline.md) | 辅助参考 | 移植纪律与 parity 线 |
| [05-process.md](05-process.md) | **过程定义（最高优先级）** | 工作方式与文档纪律（[§4 七条规则](05-process.md) + [§3.1 gate review 第 4 步](05-process.md)） |
| [tracker.md](tracker.md) | **执行依据（核心，活文档·精简）** | 阶段门 + 任务表 + 记录索引（≤50 行） |
| spikes/*.md | 辅助参考（源码核查报告） | dsh / pi 路线 + weshop 案例的实证 |

### 第二层：变更/核验/腐烂记录（按对象分，append-only）

| 对象 | 文件 |
|---|---|
| 全部子文档索引 | [records/_index.md](records/_index.md) |
| agent 后端 / runtime | [records/topics/agent-runtime.md](records/topics/agent-runtime.md) |
| brand config / type / profile | [records/topics/brand-config.md](records/topics/brand-config.md) |
| Chat UI | [records/topics/chat-ui.md](records/topics/chat-ui.md) |
| i18n 缝 / locale | [records/topics/i18n.md](records/topics/i18n.md) |
| 营销工具 | [records/topics/tools-marketing.md](records/topics/tools-marketing.md) |
| 生图管线 | [records/topics/tools-image-gen.md](records/topics/tools-image-gen.md) |
| upstream 合并 | [records/topics/upstream-merge.md](records/topics/upstream-merge.md) |
| CI / zone registry / autocrlf | [records/topics/ci-infra.md](records/topics/ci-infra.md) |
| spike 文档 | [records/topics/spikes.md](records/topics/spikes.md) |
| 文档体系治理 | [records/topics/docs-governance.md](records/topics/docs-governance.md) |

## 真相分层与冲突裁决

- **第一层**：路径归属 → zone registry（代码，CI 校验，Phase 0 产出）
- **第二层**：状态与决策 → `tracker.md` 索引 + `records/*` 子文档（按对象分）
- **第三层**：叙事与理由 → 00-04

冲突时：`registry > records 子文档 > tracker 索引 > 叙事文档`。

## 文档治理规则（吸取旧分支教训）

旧分支规划文档已实测腐烂多处（[00-why-rebuild.md §5](00-why-rebuild.md) 五处实锤）。2026-08-20 整改后的核心纪律：

- **计划修正即改原文**：当执行实测推翻文档中的计划/假设时，叙事文档（00-04）**直接改成新版本**，不加修正节、不加 blockquote；完整理由记入 `records/` 子文档对应条目（[05-process.md §4 第 7 条](05-process.md)）
- **纪律提示块**：每个叙事文档前 15 行必须包含 HTML 注释形式的纪律提示块（[05-process.md §4 第 8 条](05-process.md)）
- **头部元信息**：每个叙事文档必含五字段——`状态` / `时间`（YYYY-MM-DD HH:MM）/ `核验人` / `身份` / `基线`（可选）（[05-process.md §4 第 3 条](05-process.md)）
- **交叉引用**：`文件名.md §N 标题` 格式，禁裸 § 编号（[05-process.md §4 第 9 条](05-process.md)）
- **gate review 硬性第 4 步**：subagent 文档核验全绿，否则阻塞 gate（[05-process.md §3.1](05-process.md)）
- **格式自动校验**：`check-docs.ts` 已挂 CI，对叙事文档头部三字段（状态/时间/身份）做确定性检查
- **事实性结论**：必须附核验命令与日期（【事实】/【决策】/【假设】三标，见 [05-process.md §4 第 1 条](05-process.md)）
- **旧分支 `docs/` 下文档**：仅作历史参考，引用前必须重新核验
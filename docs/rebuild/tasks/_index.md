<!--
  写作纪律（改本文前必读）：
  - 事实性声明必须附核验命令 + 日期，否则标为【假设】
  - 计划被实测推翻时，直接改本文为新版本，完整理由记入 records/ 子文档
  - 本文只保留当前态，不保留修正历史
  - 改完后刷新本文头部的「状态」字段
  - 详细规则见 docs/rebuild/05-process.md §4
-->

# tasks · 任务档案索引

> **状态**：D15 重组 | **时间**：2026-08-21 | **核验人**：主 agent
> **身份**：task 维度档案的入口。**每个 task 三件套物理拆分**——`tasks/T<NN>-plan.md` / `tasks/T<NN>-self-check.md` / `tasks/T<NN>-verify.md`，CI 用 `existsSync` 逐个检查。
> **与 [tracker.md §2 任务表](../tracker.md) 的关系**：tracker 是任务表**真源**，本文是镜像——同步 plan / self-check / verify 三列路径。如有不一致以 tracker 为准。
> **与 records/narrative/ 的关系**：task 维度 vs 文件维度，**严格分离**——task 自检/核验不进 records/，文件腐烂/修正也不进 tasks/。详见 [05-process.md §3.2 + §4.11](05-process.md)。

## 1. 编号规则（D15）

| 类型      | 前缀                  | 规则                   | 示例              |
| --------- | --------------------- | ---------------------- | ----------------- |
| task 计划 | `T<NN>-plan.md`       | 任务清单 + 验收标准    | T03-plan.md       |
| task 自检 | `T<NN>-self-check.md` | 主 agent 自检 + 完成度 | T03-self-check.md |
| task 核验 | `T<NN>-verify.md`     | subagent 独立核验报告  | T03-verify.md     |
| 编号      | T<NN>                 | 全局递增，从 T00 开始  | T04               |

**禁止**：单文档 `T<id>-<slug>.md` + 章节正则形式（章节可以是占位，CI 误判率非零）——D15 决策核心。

## 2. 任务清单（与 [tracker.md §2 任务表](../tracker.md) 同步）

| T 编号                      | 块                         | 标题                                                                                                   | 状态                                                                                                                                         | plan                             | self-check                                   | verify                               |
| --------------------------- | -------------------------- | ------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- | -------------------------------------------- | ------------------------------------ |
| [T00](../tasks/T00-plan.md) | 文档治理                   | 文档集首轮整改（R1-R4 核查轮）                                                                         | ✅ 已完成（历史回填）                                                                                                                        | [T00-plan](../tasks/T00-plan.md) | [T00-self-check](../tasks/T00-self-check.md) | [T00-verify](../tasks/T00-verify.md) |
| [T01](../tasks/T01-plan.md) | 文档治理                   | 文档体系整改（plan-correction / tracker拆分 / check-docs / binding / tasks）                           | ✅ 已完成（待 owner 验收）                                                                                                                   | [T01-plan](../tasks/T01-plan.md) | [T01-self-check](../tasks/T01-self-check.md) | [T01-verify](../tasks/T01-verify.md) |
| [T02](../tasks/T02-plan.md) | 文档治理                   | 文档纪律二次检查（[05-process.md §5](../05-process.md) 迁移 + check-tasks 增强）                       | ✅ 已完成（CI 11/11 全绿）                                                                                                                   | [T02-plan](../tasks/T02-plan.md) | [T02-self-check](../tasks/T02-self-check.md) | [T02-verify](../tasks/T02-verify.md) |
| [T03](../tasks/T03-plan.md) | 文档治理                   | [05-process.md §4.10](../05-process.md) 文件↔record 一一对应纪律补漏（D14 决策落地）                   | ✅ 已完成（CI 11/11 全绿 + subagent A 18/18 通过）                                                                                           | [T03-plan](../tasks/T03-plan.md) | [T03-self-check](../tasks/T03-self-check.md) | [T03-verify](../tasks/T03-verify.md) |
| [T04](../tasks/T04-plan.md) | 文档治理                   | task 纪律 CI 强化（D15 三件套物理拆分 + 任务表路径检查）                                               | ✅ 已完成（CI 11/11 全绿 + subagent A 21/21 通过）                                                                                           | [T04-plan](../tasks/T04-plan.md) | [T04-self-check](../tasks/T04-self-check.md) | [T04-verify](../tasks/T04-verify.md) |
| [T05](../tasks/T05-plan.md) | 文档治理                   | 00-05 系统性腐烂 review（外部 proposal 内化 + 05 §2 树状图重写 + D16 候选登记 + D17 本机绝对路径清理） | ✅ 已完成（CI 11/11 全绿 × 2 + subagent A 19/19 通过）                                                                                       | [T05-plan](../tasks/T05-plan.md) | [T05-self-check](../tasks/T05-self-check.md) | [T05-verify](../tasks/T05-verify.md) |
| [T06](../tasks/T06-plan.md) | CI 基础设施                | LFS cache 启用（每次 push 节省 ~99% 上游 LFS 流量）                                                    | ✅ 已完成（setup-bun action.yml 加 actions/cache@v6）                                                                                        | [T06-plan](../tasks/T06-plan.md) | [T06-self-check](../tasks/T06-self-check.md) | [T06-verify](../tasks/T06-verify.md) |
| [T07](../tasks/T07-plan.md) | 文档治理                   | 修正 §4.10 应用错误（横向档案 narrative 绑定撤回）+ 高频腐烂防御                                       | ✅ 已完成（核验由 T09 回填：12 通过 + 1 警告）                                                                                               | [T07-plan](../tasks/T07-plan.md) | [T07-self-check](../tasks/T07-self-check.md) | [T07-verify](../tasks/T07-verify.md) |
| [T08](../tasks/T08-plan.md) | 文档治理                   | tracker.md 任务表删 PR 列（owner 提议）                                                                | ✅ 已完成（CI 11/11 全绿 + subagent A 12/12 通过）                                                                                           | [T08-plan](../tasks/T08-plan.md) | [T08-self-check](../tasks/T08-self-check.md) | [T08-verify](../tasks/T08-verify.md) |
| [T09](../tasks/T09-plan.md) | 文档治理+CI 基建           | review 发现核实与修复（CI 接线 + 占位检测 + 腐烂修正 + T06/T07 核验回填）                              | ✅ 已完成（CI 12/12 全绿含新 job + subagent A 核验 N1-N5 闭环）                                                                              | [T09-plan](../tasks/T09-plan.md) | [T09-self-check](../tasks/T09-self-check.md) | [T09-verify](../tasks/T09-verify.md) |
| [T10](../tasks/T10-plan.md) | upstream 合并+Phase 1 启动 | upstream/master@5201404f 合并 + D20 登记 + spike 任务登记                                              | ✅ 已完成（远端 CI run 32458703514 12/12）                                                                                                   | [T10-plan](../tasks/T10-plan.md) | [T10-self-check](../tasks/T10-self-check.md) | [T10-verify](../tasks/T10-verify.md) |
| [T11](../tasks/T11-plan.md) | Phase 1 runtime            | S-pi spike（pi sdk 库形态四项验证）                                                                    | 🔶 离线面全过（subagent 核验讫）；活模型面阻塞待 owner 补 key                                                                                | [T11-plan](../tasks/T11-plan.md) | [T11-self-check](../tasks/T11-self-check.md) | [T11-verify](../tasks/T11-verify.md) |
| [T12](../tasks/T12-plan.md) | Phase 1 runtime            | S-X spike（dsh-X 六项验证含硬 gate）                                                                   | ✅ 已完成（CI run 32560998564 12/12；X5 硬 gate 通过；模型面阻塞已上报）                                                                     | [T12-plan](../tasks/T12-plan.md) | [T12-self-check](../tasks/T12-self-check.md) | [T12-verify](../tasks/T12-verify.md) |
| [T13](../tasks/T13-plan.md) | Phase 1-X 收口             | 双 spike 合并回归 + dsh 版本钉扎纪律 + S-X 模型面补跑                                                  | ✅ 已完成（合并回归+版本纪律 CI run 32563228158 全绿；X3/X6 模型面 2026-08-23 以 openrouter/free 实测通过；S-pi 模型面随 pi 产品版后置 D22） | [T13-plan](../tasks/T13-plan.md) | [T13-self-check](../tasks/T13-self-check.md) | [T13-verify](../tasks/T13-verify.md) |
| [T14](../tasks/T14-plan.md) | Phase 1-X 实施             | 插件骨架产品化（MS-X1：workbench/ bundle 骨架 + dev 回路 + HMR 证伪）                                  | ✅ 已完成（装机冒烟 + HMR A 级证伪 + CI job；CI run 32569154626 全绿）                                                                       | [T14-plan](../tasks/T14-plan.md) | [T14-self-check](../tasks/T14-self-check.md) | [T14-verify](../tasks/T14-verify.md) |
| [T15](../tasks/T15-plan.md) | Phase 1-X 实施             | M2 编辑器入孤岛（E1 CanvasKit wasm 探针 → E2 外壳 → E3 生命周期 → E4 收口）                            | ✅ 已完成（E1-E4 全过 + subagent 核验 V1-V8；CI run 32576137352 全绿）                                                                       | [T15-plan](../tasks/T15-plan.md) | [T15-self-check](../tasks/T15-self-check.md) | [T15-verify](../tasks/T15-verify.md) |
| [T16](../tasks/T16-plan.md) | Phase 1-X 实施             | 7600 桥真链路 + token 链（M3+M4 链路半）                                                               | ✅ 已完成（B1-B4 全过 + subagent 核验 V1-V8；CI run 32579903008 全绿）                                                                       | [T16-plan](../tasks/T16-plan.md) | [T16-self-check](../tasks/T16-self-check.md) | [T16-verify](../tasks/T16-verify.md) |
| [T17](../tasks/T17-plan.md) | Phase 1-X 实施             | ChatPanel 消费 SessionFace（M3 消息回路半）                                                            | ✅ 已完成（C1-C5 全过 + subagent 核验 V1-V8；CI run 32611136517 全绿）                                                                       | [T17-plan](../tasks/T17-plan.md) | [T17-self-check](../tasks/T17-self-check.md) | [T17-verify](../tasks/T17-verify.md) |
| [T18](../tasks/T18-plan.md) | Phase 1-pi 启动            | pi SDK 主线启动：分支 + 钉扎 + S-pi 模型面补跑                                                         | ✅ 已完成（P1-P4 全过 + subagent 核验 V1-V8；CI run 32627633002 全绿）                                                                       | [T18-plan](../tasks/T18-plan.md) | [T18-self-check](../tasks/T18-self-check.md) | [T18-verify](../tasks/T18-verify.md) |
| [T19](../tasks/T19-plan.md) | Phase 1-pi 实施            | 后端换心：pi service + SSE 契约 + Chat 类零改动                                                        | ✅ 已完成（V1-V8 全过 + CI 32637559364 全绿）                                                                                                | [T19-plan](../tasks/T19-plan.md) | [T19-self-check](../tasks/T19-self-check.md) | [T19-verify](../tasks/T19-verify.md) |
| [T20](../tasks/T20-plan.md) | Phase 1-pi 实施            | 工具链路：后端独立进程化 + hello-tool 全链 + 工具事件映射                                              | ✅ 已完成（V1-V8 全过 + CI 32645061123 全绿）                                                                                                | [T20-plan](../tasks/T20-plan.md) | [T20-self-check](../tasks/T20-self-check.md) | [T20-verify](../tasks/T20-verify.md) |
| [T21](../tasks/T21-plan.md) | Phase 1-pi 实施            | pi 原生 provider/凭据管理 + 全量 core tools + system prompt + 环绕补齐（undo/step budget）             | ✅ 已完成（V1-V7 全过 + CI 32656186119 全绿）                                                                                                | [T21-plan](../tasks/T21-plan.md) | [T21-self-check](../tasks/T21-self-check.md) | [T21-verify](../tasks/T21-verify.md) |
| [T22](../tasks/T22-plan.md) | Phase 1-pi 实施            | session↔file 绑定（稳定会话 + 历史回填 + 工具目标注入）                             | 🔄 立项 | [T22-plan](../tasks/T22-plan.md) | [T22-self-check](../tasks/T22-self-check.md) | [T22-verify](../tasks/T22-verify.md) |
| (后续 task 按顺序登记)      | —                          | —                                                                                                      | —                                                                                                                                            | —                                | —                                            | —                                    |

## 3. 三件套结构（强制）

每个 task 三个物理文件**职责分明**：

| 文件                    | 必含章节                                                                         | 禁止                                      |
| ----------------------- | -------------------------------------------------------------------------------- | ----------------------------------------- |
| **T<NN>-plan.md**       | §1 任务概述 / §2 任务清单 / §3 验收标准 / §4 关联文档 / §5 身份                  | 禁止含自检数字 / 禁止含核验报告           |
| **T<NN>-self-check.md** | §1 任务清单对照 / §2 承诺 vs 落地对照 / §3 完成度自评（实时期更新）/ §4 自评要点 | 禁止占位「待 owner 触发核验」             |
| **T<NN>-verify.md**     | §1 核验背景 / §2 逐条核验（subagent A 填报）/ §3 总评 / §4 综合判定              | 禁止复述自检；必须含独立证据命令 + 实测值 |

## 4. 与 records/ 的边界（D15 强化）

| 维度                         | 落点                                                              | 示例                              |
| ---------------------------- | ----------------------------------------------------------------- | --------------------------------- |
| **task 计划**                | `tasks/T<NN>-plan.md`                                             | T01-plan.md                       |
| **task 自检**                | `tasks/T<NN>-self-check.md`                                       | T01-self-check.md                 |
| **task 核验**                | `tasks/T<NN>-verify.md`                                           | T01-verify.md                     |
| **文件腐烂**                 | `records/narrative/<file>.md` §腐烂                               | 02-phase-0.md §0 删               |
| **文件修正**                 | `records/narrative/<file>.md` §修正                               | 02-phase-0.md 修正-2              |
| **文件核验**（针对文件状态） | `records/narrative/<file>.md` §核验                               | 02-phase-0.md R3                  |
| **跨文件横向决策**           | `records/topics/docs-governance.md`                               | D10 / D11 / D12 / D13 / D14 / D15 |
| **CI / merge / WIP**         | `records/topics/ci-infra.md` / `records/topics/upstream-merge.md` | CI-1 / MERGE-1                    |

**严禁**：把 task 自检/核验放进 `records/narrative/<file>.md`——破坏文件维度档案纯度（D14 §4.10 纪律）。

## 5. CI 拦截逻辑（D15）

`tools/zone-registry/src/check/tasks.ts` 检测大改动命中 + commit 含 `task: T<NN>` → 读任务表 → 检查 `existsSync(tasks/T<NN>-{plan,self-check,verify}.md)`。**任何一个缺失 → 拒绝 commit**。零正则、零章节、零语义判定。

详细纪律见 [05-process.md §3.1 gate review 第 5 项 + §4.11 三件套物理拆分纪律](../05-process.md)。

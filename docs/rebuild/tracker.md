<!--
  写作纪律（改本文前必读）：
  - 事实性声明必须附核验命令 + 日期，否则标为【假设】
  - 计划被实测推翻时，直接改本文为新版本，完整理由记入 records/ 子文档
  - 本文只保留当前态，不保留修正历史
  - 改完后刷新本文头部的「状态」字段
  - 详细规则见 docs/rebuild/05-process.md §4
-->

# tracker · 重建跟踪表（活文档·精简索引）

> **状态**：已建立 | **时间**：2026-08-21（T09 整改） | **核验人**：主 agent
> **身份**：阶段门 + 任务表 + 记录索引三块合一（≤80 行；T09 由 ≤50 行放宽——任务表行数随 task 增长，原预算已不可达）。详细记录见 `records/` 子文档。更新纪律见 `05-process.md §4`。
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

## 2. 任务表（每个 task 一行 + 三件套路径列 D15）

> **T08 整改**：删除 PR 列。本仓库 `docs/rebuild/` 范围**不采用 PR 管理**——任务以 commit + 任务表登记为唯一载体。详见 [T08-plan.md §1.1](tasks/T08-plan.md)。

| T 编号 | 块 | 内容 | 验收 | 状态 | plan | self-check | verify |
|---|---|---|---|---|---|---|---|
| T00 | 文档治理 | 文档集首轮整改（R1-R4 核查轮）| ✅ 完成（历史回填） | ✅ | [T00-plan](tasks/T00-plan.md) | [T00-self-check](tasks/T00-self-check.md) | [T00-verify](tasks/T00-verify.md) |
| T01 | 文档治理 | 文档体系整改（plan-correction / tracker拆分 / check-docs / binding / tasks）| ✅ 完成（待 owner 验收） | ✅ | [T01-plan](tasks/T01-plan.md) | [T01-self-check](tasks/T01-self-check.md) | [T01-verify](tasks/T01-verify.md) |
| T02 | 文档治理 | 文档纪律二次检查（[05-process.md §5](05-process.md) 迁移 + check-tasks 增强）| ✅ 完成（CI 11/11 全绿） | ✅ | [T02-plan](tasks/T02-plan.md) | [T02-self-check](tasks/T02-self-check.md) | [T02-verify](tasks/T02-verify.md) |
| T03 | 文档治理 | [05-process.md §4.10](05-process.md) 文件↔record 一一对应纪律补漏（D14 决策落地）| ✅ 完成（CI 11/11 全绿 + subagent A 18/18 通过） | ✅ | [T03-plan](tasks/T03-plan.md) | [T03-self-check](tasks/T03-self-check.md) | [T03-verify](tasks/T03-verify.md) |
| T04 | 文档治理 | task 纪律 CI 强化（D15 三件套物理拆分 + 任务表路径检查）| ✅ 完成（CI 11/11 全绿 + subagent A 18/18 + 3 追加通过） | ✅ | [T04-plan](tasks/T04-plan.md) | [T04-self-check](tasks/T04-self-check.md) | [T04-verify](tasks/T04-verify.md) |
| T05 | 文档治理 | 00-05 系统性腐烂 review（外部 proposal 内化 + 05 §2 树状图重写 + D16 候选登记 + D17 本机绝对路径清理）| ✅ 完成（CI 11/11 全绿 × 2 commits + subagent A 19/19 通过） | ✅ | [T05-plan](tasks/T05-plan.md) | [T05-self-check](tasks/T05-self-check.md) | [T05-verify](tasks/T05-verify.md) |
| T06 | CI 基础设施 | LFS cache 启用（每次 push 节省 ~99% 上游 LFS 流量）| ✅ 完成（setup-bun action.yml 加 actions/cache@v6） | ✅ | [T06-plan](tasks/T06-plan.md) | [T06-self-check](tasks/T06-self-check.md) | [T06-verify](tasks/T06-verify.md) |
| T07 | 文档治理 | 修正 [05-process.md §4.10](05-process.md) 应用错误（横向档案 narrative 绑定撤回）+ 高频腐烂防御 | ✅ 完成（核验由 T09 回填：subagent A 12 通过 + 1 警告，见 [T07-verify.md](tasks/T07-verify.md)） | ✅ | [T07-plan](tasks/T07-plan.md) | [T07-self-check](tasks/T07-self-check.md) | [T07-verify](tasks/T07-verify.md) |
| T08 | 文档治理 | tracker.md 任务表删 PR 列（owner 提议） | ✅ 完成（CI 11/11 全绿 + subagent A 12/12 通过，commit 7d013794） | ✅ | [T08-plan](tasks/T08-plan.md) | [T08-self-check](tasks/T08-self-check.md) | [T08-verify](tasks/T08-verify.md) |
| T09 | 文档治理+CI 基建 | review 发现核实与修复（CI 接线 + 占位检测 + 腐烂修正 + T06/T07 核验回填） | ✅ 完成（CI 12/12 全绿含新 Rebuild discipline job，run 32447539784 + subagent A 核验 N1-N5 闭环） | ✅ | [T09-plan](tasks/T09-plan.md) | [T09-self-check](tasks/T09-self-check.md) | [T09-verify](tasks/T09-verify.md) |
| T10 | upstream 合并+Phase 1 启动 | upstream/master@5201404f 合并（79 commits/864 文件漂移）+ D20 登记 + spike 任务登记 | [T10-plan.md §3](tasks/T10-plan.md) 七条验收 | ✅ 完成（远端 CI run 32458703514 12/12；rebuild/v2 ff → 1749b877） | [T10-plan](tasks/T10-plan.md) | [T10-self-check](tasks/T10-self-check.md) | [T10-verify](tasks/T10-verify.md) |
| T11 | Phase 1 runtime | S-pi spike（pi sdk 库形态四项验证，[spikes/02-pi-sdk-runtime.zh.md §6](spikes/02-pi-sdk-runtime.zh.md)） | [T11-plan.md §3](tasks/T11-plan.md) | 🔶 离线面全过（subagent 核验讫，commit e58a6ea9）；活模型面阻塞待 owner 补 key | [T11-plan](tasks/T11-plan.md) | [T11-self-check](tasks/T11-self-check.md) | [T11-verify](tasks/T11-verify.md) |
| T12 | Phase 1 runtime | S-X spike（dsh-X 六项验证含硬 gate，[spikes/04-dsh-x-design.zh.md §7.1](spikes/04-dsh-x-design.zh.md)） | [T12-plan.md §3](tasks/T12-plan.md) | ✅ 已完成（CI run 32560998564 12/12；X5 硬 gate 通过；模型面阻塞已上报） | [T12-plan](tasks/T12-plan.md) | [T12-self-check](tasks/T12-self-check.md) | [T12-verify](tasks/T12-verify.md) |
| T13 | Phase 1-X 收口 | D22 拍板后收口：双 spike 合并回归 + dsh 版本钉扎纪律（[03 §5.4](03-phase-1-runtime.md)）+ S-X 模型面补跑 | [T13-plan.md §3](tasks/T13-plan.md) | ✅ 已完成（合并回归+版本纪律 CI run 32563228158 全绿；X3/X6 模型面 2026-08-23 以 openrouter/free 实测通过——真实工具调用 → 7600 桥 → 活编辑器回包，证据 workbench/evidence/t13-x3-x6-openrouter-live.png；S-pi 模型面随 pi 产品版后置 D22） | [T13-plan](tasks/T13-plan.md) | [T13-self-check](tasks/T13-self-check.md) | [T13-verify](tasks/T13-verify.md) |
| T14 | Phase 1-X 实施 | 插件骨架产品化（MS-X1：`workbench/` bundle 骨架 + 版本钉扎 + dev 回路 + HMR 决策点证伪） | [T14-plan.md §3](tasks/T14-plan.md) | ✅ 已完成（装机冒烟 + HMR A 级证伪 + CI job；远端 CI run 32569154626 全绿） | [T14-plan](tasks/T14-plan.md) | [T14-self-check](tasks/T14-self-check.md) | [T14-verify](tasks/T14-verify.md) |
| T15 | Phase 1-X 实施 | M2 编辑器入孤岛（E1 CanvasKit wasm 探针 → E2 编辑器外壳 → E3 生命周期 → E4 冒烟收口） | [T15-plan.md §3](tasks/T15-plan.md) | ✅ 已完成（E1-E4 全过 + subagent 核验 V1-V8「可以提交」；远端 CI HEAD run 32576137352 全绿） | [T15-plan](tasks/T15-plan.md) | [T15-self-check](tasks/T15-self-check.md) | [T15-verify](tasks/T15-verify.md) |
| T16 | Phase 1-X 实施 | 7600 桥真链路 + token 链（M3+M4 链路半：真桥起服 → island 桥客户端 → host 工具端到端） | [T16-plan.md §3](tasks/T16-plan.md) | ✅ 已完成（B1-B4 全过 + subagent 核验 V1-V8「可以提交」；远端 CI HEAD run 32579903008 全绿） | [T16-plan](tasks/T16-plan.md) | [T16-self-check](tasks/T16-self-check.md) | [T16-verify](tasks/T16-verify.md) |
| T17 | Phase 1-X 实施 | ChatPanel 消费 SessionFace（M3 消息回路半：绑定层 → 消息流渲染 → 发送回路 → 控制面 → 端到端冒烟） | [T17-plan.md §3](tasks/T17-plan.md) | ✅ 已完成（C1-C5 全过 + subagent 独立核验 V1-V8「可以提交」；远端 CI HEAD run 32611136517 全绿） | [T17-plan](tasks/T17-plan.md) | [T17-self-check](tasks/T17-self-check.md) | [T17-verify](tasks/T17-verify.md) |
| T18 | Phase 1-pi 启动 | pi SDK 主线启动（D24）：rebuild/pi 分支 + pi 版本钉扎纪律 + S-pi 活模型面补跑（openrouter/free）+ 01 F0 地面依据 post-merge 核查 | [T18-plan.md §3](tasks/T18-plan.md) | ✅ 已完成（P1-P4 全过：S-pi-1 活模型 8/8 + S-pi-2 主线 7/7 + 钉扎纪律 + F0 四行修正；subagent 独立核验 V1-V8「可以提交」含改参防伪造复跑；远端 CI rebuild/pi run 32627633002 全绿） | [T18-plan](tasks/T18-plan.md) | [T18-self-check](tasks/T18-self-check.md) | [T18-verify](tasks/T18-verify.md) |
| T19 | Phase 1-pi 实施 | 后端换心（F0.1/F0.4）：pi SDK 薄 service + UIMessage v1 SSE 契约 + 前端 Chat 类零改动（文本回路） | [T19-plan.md §3](tasks/T19-plan.md) | ✅ 已完成（P1-P5 全过：后端冒烟 14/14 + 重启恢复 RECOVERY-PASS + 真实 Chromium 浏览器冒烟 7/7；subagent 独立核验 V1-V8「可以提交」；远端 CI rebuild/pi run 32637559364 全绿；CI 三连红事故链与 oxfmt 平台坑实录见 [T19-self-check.md §2.7](tasks/T19-self-check.md)） | [T19-plan](tasks/T19-plan.md) | [T19-self-check](tasks/T19-self-check.md) | [T19-verify](tasks/T19-verify.md) |
| — | （后续 task 按顺序登记） | — | — | — | — | — | — |

## 3. 记录索引

> **两层结构**（[05-process.md §4.10 D14 + §4.11 D15](05-process.md)）：`records/narrative/` 物理绑定层（与文件 1:1）+ `records/topics/` 主题聚合层（跨文件横向档案）。**权威列表见 [`records/_index.md`](records/_index.md)**——本文档不重复维护。

### 3.1 narrative/ 物理绑定层

按物理文件 1:1 绑定（每个被治理文件一份 `records/narrative/<file>.md`）。完整列表见 [_index.md §2](../records/_index.md)。

> 截至 2026-08-21（`find docs/rebuild/records/narrative -type f | wc -l` 实测 = 13）：6 个核心叙事文档（00-05）+ README + tracker + 4 个 spike + 1 个 proposal = 13 份 narrative 档案

### 3.2 topics/ 主题聚合层（横向档案）

按主题跨文件聚合。完整列表见 [_index.md §3](../records/_index.md)。

| 对象 | 横向档案 |
|---|---|
| agent 后端 / runtime | `records/topics/agent-runtime.md` |
| brand config / type / profile | `records/topics/brand-config.md` |
| Chat UI | `records/topics/chat-ui.md` |
| i18n 缝 / locale | `records/topics/i18n.md` |
| 营销工具 | `records/topics/tools-marketing.md` |
| 生图管线 | `records/topics/tools-image-gen.md` |
| upstream 合并 | `records/topics/upstream-merge.md` |
| CI / zone registry / autocrlf | `records/topics/ci-infra.md` |
| spike 文档 | `records/topics/spikes.md` |
| 文档体系治理 | `records/topics/docs-governance.md` |
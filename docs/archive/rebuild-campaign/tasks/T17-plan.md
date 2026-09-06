<!--
  写作纪律（改本文前必读）：
  - 事实性声明必须附核验命令 + 日期，否则标为【假设】
  - 计划被实测推翻时，直接改本文为新版本，完整理由记入 records/ 子文档
  - 本文只保留当前态，不保留修正历史
  - 改完后刷新本文头部的「状态」字段
  - 详细规则见 docs/rebuild/05-process.md §4
-->

# tasks/T17-plan.md · T17 任务计划

> **T 编号**：T17（Phase 1-X 实施 · ChatPanel 消费 SessionFace，里程碑 M3 的消息回路半）
> **分支**：`rebuild/v2`（实施主线；`workbench/` ownedRoot 已登记）
> **状态**：🔄 开工（C1 绑定层先行；注册期 recon 已完成，见 [T17-self-check §2.1](T17-self-check.md)）
> **三件套**：
> - 计划：[T17-plan.md](T17-plan.md)（本文件）
> - 自检：[T17-self-check.md](T17-self-check.md)（开工后持续回填）
> - 核验：[T17-verify.md](T17-verify.md)（收口时 subagent 填报）

## 1. 任务概述

### 1.1 背景与目标

T15（编辑器入孤岛）+ T16（7600 桥真链路）之后，孤岛里已有活编辑器和真桥，但**消息回路仍依赖 dsh 主 UI 的对话列**——X3/X6（2026-08-23 openrouter/free 实测通过）是在 dsh 自家 Chat 里跑的。M3 的完整语义（[spikes/04 §7.2](../spikes/04-dsh-x-design.zh.md)）是"ChatPanel 消费 SessionFace + 7600 WS 接通（验证消息回路）"：桥半已达成（T16），本任务补 ChatPanel 半——孤岛内自写 React ChatPanel，经 SessionFace 与 dsh host 会话通信，消息流/发送/控制面全部发生在孤岛内。

终态形态（[03 §53](../03-phase-1-runtime.md)）：切到 openpencil-design preset 时 shell.overlay 弹出整块工作台（编辑画布 + 自写 ChatPanel + 工具面板），所有交互发生在 dsh web 标签页里。

### 1.2 关键决策（本 task 内拍板，理由随附）

1. **ChatPanel 在 React 层，不进 Vue 树**——SessionFace 消费是 React/useSyncExternalStore 语义（[01 §104](../01-target-state.md) 双框架论证），孤岛已有 React shell（`workbench/src/client/index.jsx`）；ChatPanel 作为 React 子树与 Vue mount 点并排，避免跨框架再嵌套。样式全 inline（孤岛既有惯例）
2. **绑定 dsh 当前会话**：`ctx.sessions.list` 订阅 current → `ctx.sessions.binding(current).session` 取 SessionFace——模型选择、工具可用性（preset）与主会话天然一致；shell.overlay 切 session 不卸载（X5 gate），故 ChatPanel 必须响应 current 变化重绑定（订阅切换走 dispose 链，E3 纪律）
3. **渲染面用 `nodes` 兼容字段 + `partial` + `running`**：ConversationSnapshot.nodes 是 host 装配好的 ConversationNode 联合（seq 作 key），不必自己拼事件流；控制面先最小（cancel + promptError 展示），分页/queue/pending 按 C4 查明后落地
4. **冒烟用显式工具指令**：openrouter/free 在自由叙述下只口述不调用（2026-08-23 X3 实录），端到端冒烟指令显式给工具名+参数，模型档位属性不构成链路否定

### 1.3 范围

| # | 工作项 | 通过标准 | 估时 |
|---|---|---|---|
| C1 | **绑定层**：React hook `useCurrentSessionFace`——订阅 `ctx.sessions.list` 拿 current，resolve binding，订 SessionFace；current 切换时完整退订重订；孤岛 unmount 时全链 dispose | 切 session 后面板显示新会话消息流，无泄漏（订阅计数不增）；无 current 时显示如实空态 | ~1 人日 |
| C2 | **消息流渲染**：ConversationNode 联合全型渲染（user / assistant blocks[text/reasoning/tool-call/image/other] / steering / context / model-retry / turn-error / turn-max-tokens / tool-result / command / compaction-summary / unknown）；`partial` 流式增量；`running` 指示 | 既有会话（spike-alpha-1 含 tool-call 历史）在孤岛 ChatPanel 完整渲染；流式期间 partial 可见 | ~1.5-2 人日 |
| C3 | **发送回路**：输入框 → `session.prompt([{type:'text',text}], 'queue')`；running 时发 'steer' + cancel 按钮；`promptError` 如实展示 | 孤岛内发消息 → openrouter/free 回复全文流式可见；错误（如拔 key）如实显示不吞 | ~1 人日 |
| C4 | **控制面查明 + 最小落地**：`loadOlder`（hasMore/loadingOlder）、queue 快照展示、pending 交互 respond 通路源码查明（03 §62 列 `pending.respond`，ISession .d.ts 未见该方法——查明挂点）后按查明结果实现或如实降级 | hasMore 时可向上翻页；pending 交互至少在面板内可见（respond 通路查明结论入 self-check） | ~0.5-1 人日 |
| C5 | **冒烟 + 三件套收口**：端到端（孤岛 ChatPanel 发显式指令 → 模型调 openpencil_apply_design → 画布改图可见，截图）+ self-check 回填 + subagent 独立核验 | 核验「可以提交」；远端 CI 绿 | ~0.5-1 人日 |

总计 ~4-6 人日。工具面板（marketing type 选择器等）不在本任务，归 T18（M4+M5）。

## 2. 风险与对策

| # | 风险 | 对策 |
|---|---|---|
| R1 | dsh 0.x preview API 漂移（SessionFace/ConversationSnapshot 字段） | 钉 dsh 0.1.1-rc.1（host-sandbox 已装版本，2026-08-23 `node -e` 实测）；字段访问防御性可选链；CI workbench-build 守着构建面 |
| R2 | current 切换重绑定漏退订 → 双重渲染/泄漏 | C1 单一 hook 收口订阅生命周期；C5 冒烟含切 session 往返用例 |
| R3 | pending.respond 通路查明失败（.d.ts 未见） | C4 先查明后实现；查不到就如实降级为"面板内可见 + 引导主 UI 处理"，结论入 self-check，不伪造 |
| R4 | React 18 版本与 dsh 客户端 React 实例双份冲突 | 孤岛 React 已随 bundle 自带（T14 实证无冲突先例）；若撞实例错误则改外联复用 dsh React（查明后拍板） |
| R5 | openrouter/free 慢（首 token ~4-9s）拖长冒烟 | 冒烟脚本化 + 长超时；不因此降验收标准 |

## 3. 验收标准（M3 消息回路）

1. C1：useCurrentSessionFace 绑定/切换/退订全链正确，空态如实
2. C2：历史消息（含 tool-call 块）完整渲染，流式 partial 可见
3. C3：孤岛内发送 → 模型回复流式渲染 → promptError 如实
4. C4：翻页/queue/pending 查明落地（或如实降级结论）
5. C5：孤岛内 prompt→模型调工具→画布改图端到端冒烟（截图）；subagent 核验「可以提交」；远端 CI 绿

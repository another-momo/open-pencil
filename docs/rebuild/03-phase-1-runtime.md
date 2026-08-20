<!--
  写作纪律（改本文前必读）：
  - 事实性声明必须附核验命令 + 日期，否则标为【假设】
  - 计划被实测推翻时，直接改本文为新版本，完整理由记入 records/ 子文档
  - 本文只保留当前态，不保留修正历史
  - 改完后刷新本文头部的「状态」字段
  - 详细规则见 docs/rebuild/05-process.md §4
-->

# 03 · Phase 1：runtime 选型 spike（硬门）

> **状态**：已核验（v3）| **时间**：2026-08-20 17:00 重写（承接 02-04 五份 spike）
> **核验人**：主 agent（基于 spike 01-04 全部源码级核查记录）
> **身份**：case study / 技术调研（辅助参考信息）；**决策依据在 01-target-state.md §7 与 `records/agent-runtime.md` D9**。03 不直接驱动 Phase gate。
> **硬门**：runtime 未定，对话层一行代码不写。

---

## 0. 一句话结论

经源码级核查（02/04 已落库），**真正值得考虑的候选只剩两条**：

- **dsh-X 路线**：编辑器作为 dsh bundle 发布到 `shell.overlay`，复用 dsh 现有用户群 + 唯一独占价值 = 分发与发现渠道
- **pi sdk 路线**：pi-coding-agent 作库形态直接驱动（无子进程边界），Q0-Q3 全部源码级正面答案

老的 dsh-Y（无头）路线已不构成有效候选——你已明确表达："Y 路线貌似并不是 dsh 未来发展所关注的方向，没办法随 dsh 的发展触达更多用户"。

---

## 1. 候选的来源与排除

### 1.1 已排除的候选

| 候选 | 排除理由 | 来源 |
|---|---|---|
| dsh-Y（dsh 无头 runtime） | 无法触达 dsh 用户群；多一份自管后端运维 | 你已拍板 + spikes/01-dsh-integration-routes.zh.md §0 已论证 |

### 1.2 仍待考虑的候选

| 候选 | 核心机制 | 关键依赖 |
|---|---|---|
| **dsh-X** | 编辑器作为 dsh bundle → React island 挂 `shell.overlay` → portal→body → 整块 Vue app | `参考项目/deepseek-harness/` |
| **pi sdk** | `pi-coding-agent` 作库 import 进我们后端 → `SessionManager.open(path)` 装载 JSONL session | `参考项目/pi/` |

两条路线**不互斥**：可以先 X 路线发布稳定后，再在 X 内复用 pi 作为 host runtime——这是 hedge 路径。

---

## 2. dsh-X 路线（核心证据：spikes/04-dsh-x-design.zh.md）

### 2.1 一段话

open-pencil marketing 工作台作为**一个 dsh bundle** 发布：用户装 dsh → `dsh plugin --profile web add openpencil-marketing` → 多一个 agent preset（openpencil-design）+ 一组工具 + 一个 React island。切到 openpencil-design preset 时，shell.overlay portal→body 弹出整块 Vue app（编辑画布 + 自写 ChatPanel + 工具面板），通过 SessionFace 与 dsh host 通信，通过 7600 WS 桥与编辑器进程通信——**所有交互发生在 dsh web 标签页里，不开第二个标签**。

### 2.2 关键约束与可观测证据

| 维度 | 结论 | 证据（来自 spikes/04-dsh-x-design.zh.md / 03） |
|---|---|---|
| 分发机制 | `dsh plugin --profile web add <pkg>`；bundle 声明 `dsh.bundle` 字段自动追加到 profile | `参考项目/deepseek-harness/docs/user/develop/basic/publish.md:77-110` |
| bundle ≠ plugin ≠ preset | 三者含义互异；plugin 是命令动词 | spikes/04-dsh-x-design.zh.md §1 术语表 |
| `shell.overlay` 切 session **不卸载** | 核心论证：编辑器状态跨 session 保留 | `参考项目/deepseek-harness/packages/client/ui-layout/src/client/AppFrame.tsx:194`（`renderSlot('shell.overlay', {})` 无 `only` 参数）vs `packages/client/ui-conversation/src/client/skeleton/ConversationSession.tsx:168-172`（有 `only`） |
| `SessionFace` 完整方法 | 11 方法（subscribe/getSnapshot + prompt/cancel/rename/loadOlder/updateQueue/readAttachment/command + pending.respond + projections） | `参考项目/deepseek-harness/packages/client/runtime/src/client/contract/session.ts:30-82, 89` |
| 7600 port 是 open-pencil 自己的 | `AUTOMATION_HTTP_PORT = 7600` 在 `open-pencil/packages/core/src/constants.ts:347`；dsh 全仓零命中 | [spikes/04-dsh-x-design.zh.md §C2](spikes/04-dsh-x-design.zh.md) 实证 |
| 视觉回路多模态 | dsh host tool 调用 → pi-ai 适配器 → 与旧 `media-rewriter.ts` 同构的"图转合成 user 消息"路径 | spikes/02-pi-sdk-runtime.zh.md §P3 + `参考项目/weshop-dsh-plugin/src/integrations/pi.ts:18` |
| 系统提示注入 | marketing 选择项可走 `ctx.inject(['systemPrompt'], (promptCtx) => { promptCtx.systemPrompt.section(...) })`——不是只能经 message body | `参考项目/deepseek-harness/packages/bundle/web-app/src/index.ts:141-149` |
| 工作量 | spike 4.5 人日 + Phase 2 实现 11 人日 ≈ **15.5 人日** | [spikes/04-dsh-x-design.zh.md §5](spikes/04-dsh-x-design.zh.md) + [records/agent-runtime.md 修正-2](records/agent-runtime.md) |

### 2.3 风险（X 专属）

- dsh 0.x preview API 漂移（slot API / cordis.patch.yml / SessionFace 生命周期 / preset schema）
- Vue ↔ React 18+ 双框架桥（事件系统/CSS scoped/focus trap）
- 7600 token 跨进程共享（编辑器→host tool→7600 RPC 鉴权链）
- 自写 ChatPanel 的额外投入（vs 接管 conversation slot + dsh Chat）

### 2.4 S-X spike 验证清单（4.5 人日）

spikes/04-dsh-x-design.zh.md §7.1 完整 6 项；其中**第 5 项**（shell.overlay 切 session 不卸载）是 X 路线的硬性 gate——挂了就回到其他路径。

---

## 3. pi sdk 路线（核心证据：spikes/02-pi-sdk-runtime.zh.md）

### 3.1 一段话

`pi-coding-agent` 作**库形态**（不是子进程、不是协议层）直接 import 进我们的 Node 后端。`createAgentSession` + `SessionManager.open(path)` 一行 API 装载完整 JSONL session 上下文；自定义工具通过 extensions 注册；流式事件走 RPC event 流，与 UIMessage v1 字段**先天同构**。

### 3.2 关键约束与可观测证据

| 维度 | 结论 | 证据 |
|---|---|---|
| 嵌入形态 | **库形态**——同进程 import，**无子进程边界** | `参考项目/pi/packages/coding-agent/package.json:12-26` + sdk.md:17-34 |
| session 持久化 | JSONL **树形**（id/parentId），`SessionManager.open(path)` 一行装载 | `参考项目/pi/packages/session/.../session-manager.ts:1530-1549` |
| 多模态 | 与 dsh 共享 pi-ai；"图转合成 user 消息"路径同构（**DeepSeek 有占位降级——静默不报错**，需 spike 实测） | [spikes/02-pi-sdk-runtime.zh.md §P3](spikes/02-pi-sdk-runtime.zh.md) + `参考项目/pi/packages/ai/src/api/openai-completions.ts:1269-1337` + transform-messages.ts:35-57 |
| 流式 RPC event | text_start/delta/end、toolcall_start/delta/end、tool_execution_*、compaction_*/auto_retry_*——与 UIMessage v1 字段**先天同构** | spikes/02-pi-sdk-runtime.zh.md §Y2 + `参考项目/pi/packages/session/...` |
| 工具审批 | 无内置——需自写 extension（`tool_call` event 返回 `{block: true}`） | spikes/02-pi-sdk-runtime.zh.md §Y7 + extensions.md:778-799 |
| skills | 无内置子系统；通过 extension event 链实现 | spikes/02-pi-sdk-runtime.zh.md §P8 |
| compaction | 可整体替换的 seam（`session_before_compact` event 钩子改写 summary） | `参考项目/pi/packages/.../compaction.md:280-310` |
| 双 provider 路径 | pi-ai 的 declarative OpenAI 兼容网关路由（dsh 走同样路径） | spikes/02-pi-sdk-runtime.zh.md §P6 |
| 工作量 | F0 + 层 1 ≈ **20 人日** | spikes/02-pi-sdk-runtime.zh.md §0 |
| 颠簸 | pi **周更**，需 pin + 升级 smoke；Windows 下 photon-node WAS 需实测 | spikes/02-pi-sdk-runtime.zh.md §R-pi-1/8 |

### 3.3 优势（pi 路线独有）

1. **零 fork 代码**——所有能力是 SDK API，不像 dsh-Y 要自写 sdk-jsonrpc-server 补 resume
2. **流式 RPC event 流字段同构**——adapter 工作量比 dsh-Y 减 50%
3. **session JSONL 树形**——天然支持 in-place branching / fork，营销场景"修改早先决策"工作流免费友好
4. **周更 + CHANGELOG**——透明升级，dsh 的 developer preview 颠簸风险不存在

### 3.4 风险（pi 路线独有）

- 周更 break 风险（pin + smoke 流程）
- photon-node WAS Windows 安装未实测
- 无官方插件生态（不像 dsh 有 profile/preset 分发）
- 工具审批 / skills 需自写 extension

### 3.5 pi 路线作为"独立产品"的可达性

- 用户装 pi → `pi-coding-agent` CLI / 自管后端 → **需要自己写服务端集成**
- 营销工作台的可达性取决于"用户会不会自己写服务端"——绝大多数用户**不会**
- 这是 pi 路线**无法触达 dsh 用户群**的根本原因——也是 dsh-X 路线独占价值所在

---

## 4. 双路线对比（X vs pi）

### 4.1 维度对比矩阵

| 维度 | dsh-X | pi sdk |
|---|---|---|
| **独占价值** | dsh 分发与发现渠道（用户群一键触达） | 无（库形态，自己写服务端） |
| **工作人日** | 15.5（spike 4.5 + 实现 11） | 20 |
| **Q0 嵌入形态** | dsh plugin（npm 包 + 用户机器装 dsh） | 库 import（我们后端 import `pi-coding-agent`） |
| **Q1 多模态** | 走 dsh host tool → pi-ai 适配器（与旧 `media-rewriter.ts` 同构） | 直接调 pi-ai（同样路径） |
| **Q2 session 恢复** | `ctx.systemPrompt.assemble()` + lifecycle hook；无内置跨进程 resume（plugin 需自管持久化） | **`SessionManager.open(path)` 一行 API**（JSONL 树形持久化） |
| **Q3 流式适配** | SessionFace RPC（11 方法面）→ 我们自写 React/Vue 适配 | RPC event 流字段**先天同构**于 UIMessage v1 |
| **session 切换卸载** | shell.overlay **不卸载**（核心收益） | 不适用（无 dsh shell 概念） |
| **工具审批** | dsh `ctx.approval.request` | 需自写 extension（`tool_call` event） |
| **skills** | dsh `ctx.skills.register` | 需自写 extension event 链 |
| **生态** | dsh 插件分发（`dsh plugin` + 第三方注册表待验） | pi 周更 + GitHub commits 透明 |
| **上游耦合** | dsh 0.x preview 颠簸（slot API、cordis.patch.yml、preset schema） | pin 到具体版本即可控制 |
| **关键技术风险** | 双框架桥（Vue ↔ React 18+）+ dsh preview 颠簸 | 周更 break + Windows photon-node WAS |

### 4.2 何时选 X

- **触达 dsh 用户群是核心价值**：X 是唯一路径
- **接受 dsh 颠簸与双框架成本**：以市场覆盖换工程代价
- **接受编辑器 Vue 形态固定**：shell.overlay 容器适配 Vue 编辑器

### 4.3 何时选 pi

- **不在乎分发渠道，只想要独立产品**：pi 路线是纯库，独立性强
- **接受自写服务端与工具审批的额外成本**：但保留 dsh 颠簸自由度
- **跨重开恢复是硬需求**：`SessionManager.open(path)` 一行 API 是杀手锏

---

## 5. 选型决策（待 owner 拍板）

### 5.1 候选选项

- **A. 走 dsh-X**（推荐：你已表达偏好）
- **B. 走 pi sdk**
- **C. 双轨并行**：先走 X 发布，X 内部 host runtime 用 pi（spikes/02-pi-sdk-runtime.zh.md §6 提到的 hedge）
- **D. 维持现状**：继续等更多信号

### 5.2 触发任何选项的前置验证

无论选哪个，**第一步必须**：
1. `gh api repos/deepseek-ai/deepseek-harness --jq '{stars: .stargazers_count, forks: .forks_count, open_issues: .open_issues_count}'`
2. `npm view @deepseek-ai/dsh weekly-downloads`
3. `npm view @earendil-works/pi-coding-agent weekly-downloads`

阈值（owner 拍板后填）：
- dsh stars < 1k 或 weekly < 500 → A/C 选项下注价值下降，可能倒向 B
- pi weekly < 1k → B 选项下注价值下降，可能倒向 A（即使无 dsh 触达也赌运行时质量）

### 5.3 spike 启动条件

待 owner 拍板 D9 后启动 S-X 或 S-pi（spikes/04-dsh-x-design.zh.md §7.1 / spikes/02-pi-sdk-runtime.zh.md §6 各自的 4.5 人日验证清单）。

---

## 6. 文档关系索引

| 文档 | 角色 |
|---|---|
| 01-target-state.md §7 | **决策依据**（三路线对比 + 当前推荐） |
| 01-target-state.md §8 | X 复用更贵的五条机制 |
| tracker.md D9 | **决策日志**（待 owner 拍板） |
| spikes/01-dsh-integration-routes.zh.md | dsh-Y vs dsh-X 原始对比（Y 已不构成有效候选） |
| spikes/02-pi-sdk-runtime.zh.md | pi sdk 源码级核查（含 9 题 P1-P9 + 工作量表） |
| spikes/03-weshop-case-deep-dive.zh.md | weshop 实证（X 路线的形态修正） |
| **spikes/04-dsh-x-design.zh.md v4** | **X 路线专项设计**（完整落地形态 + S-X 6 项验证） |
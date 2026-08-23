<!--
  写作纪律（改本文前必读）：
  - 事实性声明必须附核验命令 + 日期，否则标为【假设】
  - 本文只保留当前态，不保留修正历史
  - 详细规则见 docs/rebuild/05-process.md §4
-->

# tasks/T17-verify.md · T17 独立核验

> **T 编号**：T17（ChatPanel 消费 SessionFace，M3 消息回路半）
> **状态**：✅ 独立核验完成（2026-08-23，subagent 与实现者完全独立，全部结论附实测命令；HEAD = `1ffc2f82`，工作树干净 `git status --porcelain` 无输出）

## 1. 收口核验项清单（C5 派单时逐项实测）

| # | 核验项 | 方法 |
|---|---|---|
| V1 | 绑定层正确性：useCurrentSessionFace 跟随 ctx.sessions.list.current；切 session 重绑定、退订无泄漏；无 current 空态如实 | 源码审 + Playwright 切 session 实测 |
| V2 | 消息流渲染完整性：spike-alpha-1 历史（user/assistant/tool-call/think 块）在孤岛 ChatPanel 全型渲染；流式 partial 可见；running 指示正确 | Playwright 目检 + 截图 |
| V3 | 发送回路：孤岛内 prompt → openrouter/free 流式回复全文渲染；promptError 负例如实（如构造拒绝场景） | Playwright 实测 + 轨迹面板交叉对照 |
| V4 | 控制面：loadOlder 翻页可用（hasMore 时）；queue/pending 查明结论与 self-check 一致；降级声明（如有）如实 | 实测 + 文档对照 |
| V5 | 端到端冒烟：孤岛 ChatPanel 显式指令 → 模型调 openpencil_apply_design → 画布改图可见 | Playwright 截图 + bridge-call 复核图状态 |
| V6 | 无占位（D19）：workbench 新增/改动代码全部真实可用；无空组件凑 existsSync | 逐文件审 |
| V7 | 生命周期：孤岛 unmount/重挂后 ChatPanel 订阅链干净（E3 纪律延续） | 源码审 + 实测 |
| V8 | 远端 CI 绿 | gh api 查 run |

## 2. 核验实测记录与结论（2026-08-23 subagent 填报）

核验环境实测：`node -e "console.log(require('.../host-sandbox/node_modules/@deepseek-ai/dsh/package.json').version)"` → **0.1.1-rc.1**；`curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3080/` → **200**（2026-08-23）。

### V1 绑定层 — PASS

- **源码审**（chat-panel.jsx:22-45，2026-08-23 读 HEAD 源码）：`useCurrentSessionFace` 用 useSyncExternalStore 订 `ctx.sessions.list` 取 `.current` → `ctx.sessions.binding(current)?.session` 取 face；`useConversation` 的 subscribe 回调以 `[face]` 为依赖（React 自动退旧订新）。类型对照实证：`SessionFace = ISession & ObservableSnapshot<ConversationSnapshot>`（contract/session.d.ts:96）、`binding(id): SessionBinding | undefined`（sessions/service.d.ts:341）、`ObservableSnapshot { getSnapshot, subscribe }`（contract/store.d.ts）——订阅模型对口。
- **Playwright 实测**（127.0.0.1:3080，2026-08-23）：`browser_evaluate` 读 `[data-openpencil-chat="header"]` + `querySelectorAll('[data-openpencil-chat-node]')`：
  - 初态 spike-alpha-1：`ChatPanel · 8624f0f5`，33 节点
  - 点侧边栏 spike-alpha-2 → `ChatPanel · fe6ced26`，5 节点（首节点文本 "spike probe: session two"，内容跟随）
  - 切回 spike-alpha-1 → `8624f0f5`，33 节点；再切 alpha-2 → `fe6ced26`/5；再切回 → `8624f0f5`/33。**两轮往返逐点一致，无残留**
  - 切换全程编辑器桥保持「已注册」（`[data-openpencil-vue="status"]` 实测）；reload 后第三轮往返（alpha-1↔alpha-2）同样精确（55 ↔ 5，见 V7）

### V2 渲染完整性 — PASS

- **直方图实测**（2026-08-23 `querySelectorAll('[data-openpencil-chat-node]')` 统计，spike-alpha-1 测试起点）：`{user:10, context:3, turn-error:1, assistant:14, tool-result:5}` = 33 节点
- **与 dsh 主 UI 对话列逐项对照**（2026-08-23 Playwright snapshot 双栏比对）：10 条 user、3 条上下文注入（AGENTS.md / dsh-system-prompt / skill-catalog）、1 条 MISSING_CREDENTIAL turn-error（红条文本逐字一致）、14 条 assistant（Think 折叠块、正文）、5 条 tool-result 全部对上；工具调用卡 argsRaw（如 `{"patches":[...,"value":300]}`、ask_user_question 全参）与 tool-result 内容（bridgeMs:78/46、applied 明细）与主 UI 逐字一致。**user/assistant/context/turn-error/tool-result 五型齐备**
- **流式 partial + running 实测**：见 V3 采样记录（partialLen 200 → 869 逐 500ms 增长，running 指示全程在）

### V3 发送回路 — PASS（promptError 负例未构造成功，如实声明）

- **简单发送**：ChatPanel 输入框 `[data-openpencil-chat="input"]` 发「回复 ok 两个字」→ openrouter/free 回复 `ok` 完整渲染为新 assistant 节点；主 UI 对话列同步出现该 user/assistant（`browser_evaluate` 在孤岛外 DOM 命中「回复 ok 两个字」与「ok」，证明走真会话回路非本地回声）（2026-08-23）
- **running 指示 + 停止**：发长回复请求（色彩理论 600 字），页内 500ms 采样器（`window.__v3sampler`）从首个样本（t=507ms）起 `running:true` 且「● 运行中」与「停止」按钮（`[data-openpencil-chat="cancel"]`）均在，partial 长度 200 → 211 → … → 869 持续增长；点击「停止」→ running/按钮消失，partial 冻结为 assistant 节点并带「已停止」标记（`node.interrupted` 驱动），节点数 35→37（2026-08-23 实测）
- **steer 插入**（补 self-check §2.4-4 未测项，实测通过）：排版长文运行中再发「steer 探针…」→ 输入框 placeholder 切为「运行中——Enter 以 steer 插入」→ 该消息先入队（queue 显示 `[steering] steer 探针…`）→ 随后落地为持久 `steering` 节点（`[steering] steer 探针：请把第八段的总结改成一句话即可。`）→ 本轮正常完成（2026-08-23 实测）
- **promptError 负例：未构造成功，如实声明**。composer 上方红条通路已接（chat-panel.jsx:380-384 `conv.promptError`），但本次所有 prompt RPC 均被接受，未触发真实拒绝；失败以持久 turn-error 节点呈现且渲染正确（实测两例：spike-alpha-2 发送触发 deepseek-official MISSING_CREDENTIAL turn-error；spike-alpha-1 一次 openrouter 上游 400「Reasoning is mandatory」turn-error，重试即恢复）——未伪造 promptError 场景

### V4 控制面 — PASS（approval 正例与 loadOlder 正例无现成场景，如实声明）

- **PendingCard payload 装配对照**（2026-08-23 读 .d.ts + 源码）：respond 在每个 PendingWait 实例上（pending.d.ts:50 `respond(result: ClientResponse['result'])`，settled 后同步抛——代码 catch 并如实显示）；`RpcResult = {ok,value}|{ok,error}`（rpc.d.ts:189）；approval value `{sessionId, approvalId, outcome:'allowed-once'|'rejected'}`（api/approvals.d.ts:16-18）与代码 reply() 装配逐字段一致；question value `{sessionId, answer:{answers:[{id, selected[], custom?}]}}`（api/questions.d.ts + dsh-user-questions types.d.ts AskUserQuestionAnswer）与代码一致；payload 侧字段 `approval/requested = {approvalId, toolName, callId?, reason?}`、`question/requested = {questions[]}`（api/events.d.ts:76-91）与代码读取面一致。self-check §2.5 查明结论**属实**
- **question 真回路实测（核验者本人复现）**：孤岛发显式指令让模型调 ask_user_question（首轮模型只口述未调用——免费档属性，改显式参数指令后成功）→ pending 卡出现（kind=question，「核验：选哪个颜色？」+ 蓝色/绿色/回答 三按钮）→ 点「蓝色」→ respond 结算（pending 清零）→ tool-result `{"answers":[{"id":"color_check","selected":["蓝色"]}]}` → 模型接续「你选了：**蓝色**。」（2026-08-23 全链实测）
- **approval 通路**：与 question 同码路（PendingCard reply），payload 形状已按 approvals.d.ts 逐字段核；本次无真实审批场景可触发，正例未实测——如实声明，未伪造
- **loadOlder**：按钮仅在 `conv.hasMore` 时渲染（chat-panel.jsx:347-357）；实测 spike-alpha-1 在 49/55 节点时仍 `hasMore=false`（`[data-openpencil-chat="load-older"]` 缺席，2026-08-23），其余会话更短——按钮正确缺席为**真实负例**；hasMore=true 的翻页正例无现成会话可构造，如实声明
- **queue**：self-check 称未观测到非空——本核验已补实测：steer 探针入队时 `[data-openpencil-chat="queue"]` 显示「队列 1 条：[steering] steer 探针…」，placement/preview 渲染正确，承认后自动清空（2026-08-23）
- **观察到的局限（非阻塞）**：PendingCard 点任一选项即按 `answers:[{单个 question}]` 结算整个 wait——单问题 ask（本次唯一实测型）正确；多问题 ask 会在首问点选时整体结算。questions.d.ts 明示「one ask, many questions, one answer — never split per question」，此处为已知语义简化，如实记录

### V5 端到端冒烟 — PASS

- **孤岛内发显式指令**（2026-08-23 Playwright）：「立即调用 openpencil_apply_design… 参数逐字原样使用 `{"patches":[{"op":"set","path":"nodes.0:4.props.x","value":200}]}`」→ 模型发起工具调用（assistant 节点 tool-call 卡 argsRaw 与指令逐字一致）→ tool-result `{ok:true, bridgeMs:101, applied:[{nodeId:"0:4", key:"x", value:200}]}` → 模型如实复述回包。首轮曾遇 openrouter 上游 400 turn-error（如实渲染），重试成功
- **图状态复核**：`curl -s -X POST http://127.0.0.1:3080/plugins/openpencil-marketing/bridge-call -d '{"command":"getDocumentTree","args":{"depth":2}}'` → `{"id":"0:4","type":"RECTANGLE","x":200,"y":150,...}`（2026-08-23）——与工具回包一致，且 200 为本核验新值（self-check 用 480），证明是本次实测链
- 截图证据：D:\Desktop\AgentLearn\00_DIYProjects\0720openpencil\t17-verify-v5-smoke.png（2026-08-23 Playwright 截取，仓库外避免污染）

### V6 无占位（D19） — PASS

- **逐文件审**（2026-08-23 读 HEAD 全量源码）：chat-panel.jsx 全部函数真实可用——useCurrentSessionFace/useConversation（V1 实测）、NodeView 11 型 + AssistantBlocks 5 型（V2 实测其中 9 型渲染面；model-retry/turn-max-tokens/compaction/command/unknown 五臂为真实代码路径但 spike 会话无此类节点可触发，非空实现）、PendingCard（V4 实测）、send/cancel/loadOlder 接线（V3/V4 实测）；index.jsx WorkbenchIsland boot/挂载/卸载链真实（V7 实测）；editor-boot.js T17 改动仅 1 行（宽度让位 `calc(100vw - 32px - 396px)`，git show 288ec843 实证），其余为 T15/T16 既有真实代码
- `grep -n "TODO\|FIXME\|占位\|placeholder\|stub" workbench/src/client/chat-panel.jsx workbench/src/client/index.jsx` → 仅命中注释字样与 textarea placeholder 属性，无凑数空实现（2026-08-23）
- T17 提交面：`git show --stat` 实证 288ec843/bfdccaec/2a0650b0/1ffc2f82 四提交只动 chat-panel.jsx/index.jsx/editor-boot.js + 文档与证据图（2026-08-23）

### V7 生命周期 — PASS

- **整页 reload**（2026-08-23 `browser_navigate` → 12s 后 `browser_evaluate`）：`[data-openpencil-island="react-host"]` ×1、`[data-openpencil-chat="root"]` ×1、`window.__openpencilIsland = {reactMounts:1, vueMounts:1, errors:[]}`、ChatPanel 重绑当前会话 `8624f0f5` 且节点数精确 = 55（与 reload 前一致，无翻倍/丢失）、桥重新「已注册」
- **reload 后再压测订阅链**：切 alpha-2（fe6ced26/5）→ 发消息 → 节点 5→7 精确递增、user 消息全 DOM 仅 1 份（`userOkMsgCount:1`）→ 切回 alpha-1（8624f0f5/55）→ `reactMounts` 仍 =1、`errors` 空——无重复订阅症状（2026-08-23）
- 补充事实：dsh 设置页不卸载 shell.overlay（点「设置」后 URL 不变、孤岛仍单份），SPA 内路由切换无更强卸载路径可试；整页 reload 已覆盖完整 unmount/重挂周期

### V8 远端 CI — PASS

- `gh run list -R another-momo/open-pencil --branch rebuild/v2 --limit 3`（2026-08-23）：HEAD `1ffc2f82`（`gh api repos/another-momo/open-pencil/commits/rebuild/v2 --jq .sha` → `1ffc2f8238b1...` 实证）对应 run **32611136517 = completed / success**（6m43s）；同分支两个 cancelled run 为中间提交被并发取消（正常 CI 行为，非失败）

### 与 self-check 的偏差记录（均为文档级，代码无误）

1. self-check §2.1-6 把节点 kind 写作「compaction-summary」；实际判别值是 `'compaction'`（conversation.d.ts CompactionSummaryNode），代码 case 写的正是 `"compaction"`——代码对，自检文档名称不精确
2. self-check §2.5-1 引 rpc.d.ts:244-248 作 RpcResult 形状出处；实测 RpcResult 在 rpc.d.ts:189，244-248 是 ClientResponse——形状引用本身正确，行号漂移
3. self-check 声明未测项（steer 语义 §2.4-4、queue 非空 §2.5-5）本核验均已补实测通过；promptError/approval/loadOlder 正例维持如实负例，未发现伪造声明

## 3. 核验结论

**可以提交。** V1-V8 全部 PASS；自检文档无伪造声明（抽查项全部复现，声明的未测项与本核验实测一致）；三处偏差均为文档级不精确，不构成代码缺陷。已知非阻塞局限一条（PendingCard 多问题 ask 的点选结算语义简化，§V4 末行），建议后续任务按需处理，不阻塞 T17 收口。

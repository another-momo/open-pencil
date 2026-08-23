<!--
  写作纪律（改本文前必读）：
  - 事实性声明必须附核验命令 + 日期，否则标为【假设】
  - 本文只保留当前态，不保留修正历史
  - 详细规则见 docs/rebuild/05-process.md §4
-->

# tasks/T17-self-check.md · T17 自检

> **T 编号**：T17（ChatPanel 消费 SessionFace，M3 消息回路半）
> **状态**：🔄 开工（C1 未开始；注册期 recon 已完成，见 §2.1）

## 1. 完成度矩阵

| 工作项 | 状态 | 证据 |
|---|---|---|
| C1 绑定层 useCurrentSessionFace | ✅ 完成 | §2.2 |
| C2 消息流渲染（nodes 全型 + partial + running） | ✅ 完成 | §2.3 |
| C3 发送回路（prompt/steer/cancel/promptError） | ✅ 完成 | §2.4 |
| C4 控制面（loadOlder/queue/pending 查明） | ✅ 完成 | §2.5 |
| C5 端到端冒烟 + 三件套收口 | 🔄 进行中 | §2.6（冒烟已过；subagent 核验与 CI 待收口） |

## 2. 实测记录

### 2.2 2026-08-23 C1 绑定层：useCurrentSessionFace + useConversation 落地并实测

1. **实现**：`workbench/src/client/chat-panel.jsx`——`useCurrentSessionFace(ctx)`（useSyncExternalStore 订 `ctx.sessions.list` 取 current → `ctx.sessions.binding(current)?.session`）+ `useConversation(face)`（subscribe 回调以 face 身份为依赖，current 切换时 React 自动退旧订新）；`workbench/src/client/index.jsx` portal 改 flex 行容器（左 Vue mount 点、右 ChatPanel），`apply(ctx)` 把 ctx 传入；Vue 面板宽度让位 396px（editor-boot.js root `calc(100vw - 32px - 396px)`）
2. **绑定实证**：HMR 热换后 reload，ChatPanel header = `会话 session-8624f0f5-…`（spike-alpha-1，与 dsh 主 UI 当前会话一致），消息节点 17 条、末条 assistant seq=257（2026-08-23 Playwright `browser_evaluate` 读 `[data-openpencil-chat]` 实测）
3. **切 session 重绑实证**：点 spike-alpha-2 → ChatPanel 跟随为 `session-fe6ced26-…`、5 节点、末条 user seq=8；切回 spike-alpha-1 → 回到 8624f0f5、17 节点——往返两轮状态一致，无残留（2026-08-23 Playwright 实测）；孤岛全程未重挂（X5 语义保持）
4. **并发事实**：编辑器桥在 C1 全程保持「已注册」（ChatPanel 与 Vue 编辑器互不影响）

### 2.3 2026-08-23 C2 消息流渲染：ConversationNode 全型 + partial 流式

1. **全型渲染器**：chat-panel.jsx `NodeView` 覆盖 nodes 联合全部 11 型（user/assistant/steering/context/model-retry/turn-error/turn-max-tokens/tool-result/command/compaction/unknown 兜底）；assistant 块内 text/reasoning（details 折叠 Think）/tool-call 卡/image/other 分行；ContentBlock 形状引 `dsh-llm/lib/types/types.d.ts:39-74`（2026-08-23 读 .d.ts）
2. **直方图实证**（spike-alpha-1，17 节点）：`{user:5, context:3, turn-error:1, assistant:6, tool-result:2}`——与 C1 计数一致；turn-error（历史 MISSING_CREDENTIAL）如实红条渲染（2026-08-23 Playwright `querySelectorAll('[data-openpencil-chat-node]')` 统计）
3. **partial 流式实证**：发长回复请求后 700ms 间隔采样——`running:true` 全程成立；partial 内容长度随时间增长 7 → 62 → 157 → 304 → 400 → 543 → 665 → 681（推理期 reasoning 块折叠显示 "Think"，正文期逐段增长，▍光标随动，2026-08-23 Playwright 采样两轮共 18 点）

### 2.4 2026-08-23 C3 发送回路：prompt/cancel/promptError

1. **发送**：ChatPanel 输入框 Enter → `face.prompt([{type:'text',text}], running?'steer':'queue')` → openrouter/free 完整三句回复渲染落地（2026-08-23 Playwright 实测；该轮模型响应快，未抓到 running 窗口，后一轮长回复补齐流式证据 §2.3-3）
2. **cancel**：长回复流式中段点「停止」→ `face.cancel()` → running 消失，partial 冻结为 assistant 节点并渲染「已停止」标记（`node.interrupted` 驱动，2026-08-23 实测；截图 workbench/evidence/t17-c2c3-chatpanel-live.png）
3. **promptError**：展示通路已接（composer 上方红条，`conv.promptError?.message`）；本次未触发真实 prompt 拒绝场景，未伪造负例——负例留给 V3 核验时构造（如实声明）
4. **steer**：running 时发送走 'steer' 模式（代码路径 chat-panel.jsx send()）；本次未实测 steer 插入语义，如实声明——并入 V3 核验项

### 2.5 2026-08-23 C4 控制面：pending.respond 挂点查明 + loadOlder/queue/pending 落地

1. **pending.respond 挂点查明（阻塞项解除）**：respond 在**每个 PendingWait 实例上**（`dsh-client-runtime/lib/types/client/sessions/pending.d.ts:50` `respond(result: ClientResponse['result']): Promise<RpcReceipt>`），不在 ISession——03 §62 的"pending.respond"指此。`conv.pending: readonly PendingInteraction[]`（conversation.d.ts:388），kind ∈ {approval, question}（PendingPayloads，pending.d.ts:3-10；'plan-review' 只是列表态字符串/ question intent，非独立 kind）。result = RpcResult<unknown>（rpc.d.ts:244-248 `{ok,value}|{ok,error}`）；approval value={sessionId, approvalId, outcome:'allowed-once'|'rejected'}（apiproxy api/approvals.d.ts）；question value={sessionId, answer:{answers:[{id, selected[], custom?}]}}（api/questions.d.ts + dsh-user-questions types.d.ts:32-60）
2. **question 真回路实测**：孤岛 ChatPanel 发指令让模型调 ask_user_question → 1s 内 pending 卡出现（问题 + 两选项渲染正确）→ 点「工具面板」→ respond 结算（pending 清零）→ 模型接续回复「已收到你的选择：**工具面板**。」（2026-08-23 Playwright 实测全链）
3. **approval 通路**：与 question 同码路（PendingCard reply），payload 形状按 approvals.d.ts 装配；本次未触发真实审批场景，未伪造——负/正例留 V4（如实声明）
4. **loadOlder**：hasMore 时渲染「加载更早消息」按钮（loadingOlder 禁用态）；当前所有会话 hasMore=false（spike 会话短，21 节点全在窗口内）——按钮正确缺席为如实负例，正例留 V4 构造长会话（如实声明）
5. **queue**：`conv.queue` 渲染通路接入（placement/preview 逐条）；running 时我的发送走 steer 而非 queue，本次未观测到 queue 非空——如实声明，留 V4

### 2.6 2026-08-23 C5 端到端冒烟：孤岛 ChatPanel → 模型调 apply_design → 画布改图

1. **首轮（如实记录的模型失误）**：显式指令下模型发起调用但把 patches 传成空数组——工具如实回 `{ok:true, bridgeMs:0, applied:[]}`，模型自己诊断出 applied 为空并主动提出重试。链路零伪造：空补丁就是空结果（2026-08-23 Playwright 实测）
2. **二轮落地**：纠正后模型逐字传参 `{"patches":[{"op":"set","path":"nodes.0:4.props.x","value":480}]}` → 工具回包 `{ok:true, bridgeMs:46, applied:[{nodeId:"0:4",key:"x",value:480}]}` → 模型回复如实复述——**全程发生在孤岛 ChatPanel 内**（2026-08-23 实测）
3. **图状态复核**：bridge-call getDocumentTree → 0:4 x=480（与回包一致）；画布展开截图矩形移到 frame 右侧（证据 workbench/evidence/t17-c5-e2e-smoke.png 对话面 + t17-c5-e2e-canvas.png 画面）
4. **M3 语义达成**：ChatPanel 消费 SessionFace（C1-C4）+ 7600 WS 接通（T16）——消息回路在孤岛内闭环，不再依赖 dsh 主 UI 对话列

### 2.1 2026-08-23 注册期 recon：SessionFace 获取与消费通路全链源码实证（dsh 0.1.1-rc.1 安装包 .d.ts + 编译产物）

1. **dsh 版本钉扎**：host-sandbox 安装 `@deepseek-ai/dsh` = **0.1.1-rc.1**（2026-08-23 `node -e "console.log(require('./node_modules/@deepseek-ai/dsh/package.json').version)"` 实测）
2. **island 已持有 sessions 注入**：`workbench/src/client/index.jsx:21` `export const inject = ["slots", "sessions"]`——client 插件 ctx 已带 `ctx.sessions`（2026-08-23 读源码）
3. **SessionFace 定义**：`dsh-client-runtime/lib/types/client/contract/session.d.ts:26-96`——`SessionFace = ISession & ObservableSnapshot<ConversationSnapshot>`；ISession 动词面：prompt(content, 'queue'|'steer', signal?) / cancel() / rename(title) / loadOlder() / updateQueue(itemId, action) / readAttachment(attachmentId) / command(line)，全返回 RpcResult；**未见 pending.respond 方法**（03 §62 列了 pending.respond——挂点待 C4 查明）（2026-08-23 读 .d.ts）
4. **获取通路**：`ctx.sessions.list: ObservableSnapshot<SessionListState>`（SessionListState = {ids, byId, current, phase, subagentsByParent, jobsBySession, currentAddress}，`sessions/service.d.ts:67-85`）；`ctx.sessions.binding(id): SessionBinding | undefined`（service.d.ts:341），SessionBinding = {sessionId, session: SessionFace, ctx: AgentContext}（service.d.ts:109-114）；**consumption 先例**：`dsh-client-ui-conversation/lib/client.js:10142` `sessions.binding(sessionId)?.session`（2026-08-23 读编译产物）
5. **订阅模型**：`ObservableSnapshot<T> = { getSnapshot(): T; subscribe(fn): () => void }`（`contract/store.d.ts`）——React useSyncExternalStore 直接对口，无需适配层
6. **渲染面**：`ConversationSnapshot`（`sessions/conversation.d.ts:371-409+`）关键字段：`nodes: readonly ConversationNode[]`（seq 作 key 的联合：user / assistant / steering / context / model-retry / turn-error / turn-max-tokens / tool-result / command / compaction-summary / unknown，conversation.d.ts:264）、`partial: PartialAssistant | null`（{turn, step, blocks: AssistantBlock[]}，:295）、`running: boolean`、`promptError`、`hasMore/loadingOlder/openState/openError/queue/pending/removed/composerPhase`；AssistantBlock 联合：text / reasoning / image / tool-call{callId,name,argsRaw} / other（:30-46）
7. **发送载荷**：`PromptContentPart = {type:'text',text} | {type:'image',mediaType,data,name?}`（`dsh-host-apiproxy/lib/types/api/sessions.d.ts:86-94`）；prompt 失败镜像进 `snapshot.promptError`（session.d.ts:35 JSDoc）
8. **live 前置事实**：openrouter/free 已在 dsh 配好且 X3/X6 实测通过（2026-08-23，tracker T13 行 ✅）；dsh 主 UI 会话 spike-alpha-1 含 tool-call 历史消息（2026-08-23 轨迹面板实测）——C2 渲染验收的现成素材

## 3. 阻塞清单（阻塞即上报，未伪造通过）

| 阻塞项 | 解除条件 | 说明 |
|---|---|---|
| pending.respond 挂点 | C4 查明（源码/grep .d.ts 全集） | ISession 未见；查明失败则降级为面板内可见 + 引导主 UI，结论入本文，不伪造 |

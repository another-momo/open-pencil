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
| C2 消息流渲染（nodes 全型 + partial + running） | ⬜ 未开始 | — |
| C3 发送回路（prompt/steer/cancel/promptError） | ⬜ 未开始 | — |
| C4 控制面（loadOlder/queue/pending 查明） | ⬜ 未开始 | — |
| C5 端到端冒烟 + 三件套收口 | ⬜ 未开始 | — |

## 2. 实测记录

### 2.2 2026-08-23 C1 绑定层：useCurrentSessionFace + useConversation 落地并实测

1. **实现**：`workbench/src/client/chat-panel.jsx`——`useCurrentSessionFace(ctx)`（useSyncExternalStore 订 `ctx.sessions.list` 取 current → `ctx.sessions.binding(current)?.session`）+ `useConversation(face)`（subscribe 回调以 face 身份为依赖，current 切换时 React 自动退旧订新）；`workbench/src/client/index.jsx` portal 改 flex 行容器（左 Vue mount 点、右 ChatPanel），`apply(ctx)` 把 ctx 传入；Vue 面板宽度让位 396px（editor-boot.js root `calc(100vw - 32px - 396px)`）
2. **绑定实证**：HMR 热换后 reload，ChatPanel header = `会话 session-8624f0f5-…`（spike-alpha-1，与 dsh 主 UI 当前会话一致），消息节点 17 条、末条 assistant seq=257（2026-08-23 Playwright `browser_evaluate` 读 `[data-openpencil-chat]` 实测）
3. **切 session 重绑实证**：点 spike-alpha-2 → ChatPanel 跟随为 `session-fe6ced26-…`、5 节点、末条 user seq=8；切回 spike-alpha-1 → 回到 8624f0f5、17 节点——往返两轮状态一致，无残留（2026-08-23 Playwright 实测）；孤岛全程未重挂（X5 语义保持）
4. **并发事实**：编辑器桥在 C1 全程保持「已注册」（ChatPanel 与 Vue 编辑器互不影响）

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

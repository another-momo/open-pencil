# Spike 03 · weshop-dsh-plugin 深度案例研究：校正 X 路线的真实形态

> 状态：源码阅读完成（2026-08-20）| 回答 owner 对 weshop 的描述偏差，校正 spike 01 中 X 路线的若干假设与工作量。
> 陈述纪律：**【事实】**（附 文件:行号 证据）/ **【推断】**（由证据推出的结论）/ **【假设】**（未验证）。
> 证据路径约定：`weshop/` = 参考项目/weshop-dsh-plugin；`dsh/` = 参考项目/deepseek-harness；`open-pencil/` = D:\Desktop\AgentLearn\00_DIYProjects\0720openpencil\open-pencil（v3 fork 当前分支）。

## 0. 结论先行

### 0.1 三条对 owner 偏差的硬纠正

1. **weshop 的 overlay 不是「把 dsh Chat 镶在旁边」，是「自带一个 React 写的 Chat 组件」。** 【事实】`weshop/src/client/index.jsx:25-43` 的 `SplitPanel` 同时渲染 `<WeshopWorkspace>` 画布 + `<CanvasChat>` 自家聊天；`CanvasChat.jsx`（321 行，从未被 dsh 提供）从头实现消息列表、审批/问题 UI、文本输入、cancel 按钮——只通过 props 接收 `session`（一个 `SessionFace`）和 `sessionTitle`。dsh 自家 Chat **没有出现在 overlay 里**，它是 dsh `conversation` slot（被整 session 列占据）的占有者，weshop 故意避开它（`weshop/src/client/index.jsx:21-23` 的注释）。
2. **CanvasChat 是**直接**消费 dsh 的 `SessionFace`，不是用 `useSessionStore` / `sendMessage`。** 【事实】`CanvasChat.jsx:192-196` 调用 `session.subscribe` + `session.getSnapshot()` 拿 `ConversationSnapshot`；`CanvasChat.jsx:226-246` 调 `session.prompt([{type:'text', text: promptText}], 'queue')` 发消息；`CanvasChat.jsx:307` 调 `session.cancel()` 停止；`CanvasChat.jsx:41-58, 138-141` 用 `wait.respond({ok, value|error})` 回审批/问题——全是 `SessionFace` 的纯方法。weshop **不需要**任何额外 RPC 层。
3. **画布→聊天「selection→@mention」是纯 React 父子 props 桥，零 RPC。** 【事实】`CanvasWorkspace.jsx:278-285` 每次选区变化回调 `onSelectionChange`；`index.jsx:26, 39` 把 `selection` 作为 React state 传给 `<CanvasChat>`；`CanvasChat.jsx:226-246` 把 `@<title>` 前缀 + `<canvas-selection item_ids=...>` 上下文塞进 prompt 文本里——工具调用层面，agent 收到这段文本后调 `weshop_canvas_get_selection` 工具（`native-tools.js:138-140`）从 host 端 `/api/weshop/state`（`index.js:191-194`）取回完整多选 items。

### 0.2 X 路线工作量的修正估算（spike 01 → 本 spike）

| 块 | spike 01 估算 | 本 spike 修正 | 修正依据 |
|---|---|---|---|
| F0.4 传输契约 + chat | 0（废弃自有）+ 4（营销 UI 与 dsh 壳集成、brandSelection 装配点迁移） | **6**（废弃自有 ChatPanel 0 + 自写 Vue→React 包装器把营销 UI 注册进 dsh composer/header slot 2 + 写 Vue 端的 SessionFace 桥（@mention/选区/审批/取消/订阅）2 + 把 brandSelection 在 prompt 注入期读取 2） | 见 §C1、§D1 |
| 常驻挂载策略（X 专属） | 2 | **3** | spike 01 未计入「`shell.overlay` z-index=20 不足以越过 dsh-web-ui retro-OS skin 的 z=1M」实测坑（`weshop/index.jsx:30-35`）；portal→`document.body` + 自管 z-index 1000001 是 weshop 的实际绕路方案 |
| 编辑器壳孤岛化 | 4 | **5** | 双框架（React 壳 + Vue 孤岛）经 `createApp`/`unmount` 桥接的 unmount 生命周期 + Vue Teleport vs dsh shell.overlay 嵌套 + i18n 双字典（见 §D2） |
| **F0 小计** | **≈20** | **≈23** | |
| C5a ConfigBar 集成 | 2 | **3** | 见 §C3、§D1 |
| **合计（F0 + 层 1）** | **≈33** | **≈37-40 人日** | |

X 仍比 Y（≈25 人日）贵 50% 左右；D 路线决策的最终票数不变，但 X 的预算下限上调一档。

### 0.3 必须代码验证的 S-X spike 清单（详见 §5）

S-X1（`SessionFace` 通过 React 包装器暴露给 Vue 端，0.5d）、S-X2（自写 Vue ChatPanel 消费 `ConversationSnapshot`，1.5d）、S-X3（`shell.overlay` portal 实测 z-index 越界，0.5d）、S-X4（`PendingInteraction.respond` 在 React 包装器往返，0.5d）、S-X5（dsh-web-ui retro-OS skin 对 overlay 的视觉干扰实测，0.5d）、S-X6（host 端 `/api/openpencil/*` + dsh 工具 + ctx.tools.register 的「推+等结果」方案，1d）。**预算 4-5 人日**——若选 X 必须先过。

---

## 1. weshop 自身的深度形态（A）

### A1. CanvasChat 怎么渲染消息

**【事实】直接消费 `SessionFace` 的 ObservableSnapshot 拿 `ConversationSnapshot`，不在 host 端拉数据。** `weshop/src/client/CanvasChat.jsx:190-198`：

```jsx
const snapshot = useSyncExternalStore(
  (listener) => session.subscribe(listener),
  () => session.getSnapshot(),
  () => session.getSnapshot(),
);
const rows = useMemo(() => chatRows(snapshot), [snapshot]);
```

`chatRows(snapshot)`（`CanvasChat.jsx:164-188`）遍历 `snapshot.chat.order` 数组，按 `key` 从 `snapshot.chat.nodes.get(key)` 取节点，把 `kind: 'user' | 'steering'` 渲染成用户行，`kind: 'assistant-step'` 提取 `blocks` 里 `{kind:'text'}` 与 `{kind:'tool-call'}` 渲染成 assistant 行——**完全本地计算，不发任何网络请求**。

`ConversationSnapshot` 的具体形状（`dsh/packages/client/runtime/src/client/sessions/conversation.ts:433-477`）：`sessionId / views / chat: ChatSnapshot / nodes / turnTimings / partial / runningCalls / pending / queue / running / composerPhase / removed / openState / promptError / blank / lastAgentError`。这是 weshop 能直接订阅的全部「渲染用」数据面——`prompt/cancel/rename/loadOlder` 等动词面则在 `ISession`（`dsh/packages/client/runtime/src/client/contract/session.ts:30-82`）。

**【推断】这意味着插件侧 Chat 不需要自维护消息缓存**——`SessionFace` 的 observable 已经把所有 session event 投影成一份可订阅的 `ConversationSnapshot`，React 端 `useSyncExternalStore` 即可消费，与 dsh 自家 ChatView 同一条数据通路。

### A2. CanvasChat 怎么发起消息

**【事实】走 `SessionFace.prompt()`，没有任何 client.js 直连。** `CanvasChat.jsx:226-246`：

```jsx
const result = await session.prompt(
  [{ type: "text", text: promptText }],
  "queue"
);
```

`session.prompt` 的签名（`dsh/.../contract/session.ts:36-41`）：
```ts
prompt(content: PromptContentPart[], mode: 'queue' | 'steer'): Promise<RpcResult<{ accepted: true }>>
```

**【事实】weshop 用的 `client.js`（430 KB，编译产物）不是 client-side RPC。** 它是 `tsdown` 把 `src/client/index.jsx` + `CanvasChat.jsx` + `CanvasWorkspace.jsx` + `styles.js` + i18n + `@phosphor-icons/react` 等整个浏览器端打成一个 CJS bundle，由 `tsdown.config.mjs:32-36` 的 banner/footer 包成 `window.__ModuleLoader__.load({ id, factory })` 模块（参 `tsdown.config.mjs:33`）注入 dsh。`lib/client.js` 是 **纯 UI bundle**，不含 RPC；所有 RPC 都走 `SessionFace`。

**【事实】`PromptContentPart` 形态支持纯文本 + browser-owned 临时图片上传**（`dsh/.../contract/session.ts:10`）。weshop 只用 `[{ type: 'text', text }]` 形态发消息，**不用图片**——画布选中素材不直接贴 prompt，而是塞 `<canvas-selection item_ids=...>` 文案（`CanvasChat.jsx:230-232`），让 agent 主动调 `weshop_canvas_get_selection` 工具读 canvas 状态。

**【推断】这是 weshop 比我们 F0.4 路线更省的设计点**：把 selection→agent 的数据流放在「工具调用层」（host→tool args）而非「消息内容层」（host→content blocks），可以一次发消息携带任意多 selection，工具侧返完整 state，避免把图片 base64 塞进 prompt 触发 llm-pi-ai 的 modality gate 与 image_url 合成 user 消息开销（spike 01 §Y4 已记）。

### A4. session/selection 怎么共享给画布

**【事实】selection 是 React state，从 WeshopWorkspace 传到 CanvasChat，没有跨组件 RPC。** 链路：

- `weshop/src/client/index.jsx:25-43` 的 `SplitPanel`：
  ```jsx
  function SplitPanel({ session, sessionTitle, harnessLocale }) {
    const [selection, setSelection] = useState([]);
    ...
    <WeshopWorkspace onSelectionChange={setSelection} ... />
    <CanvasChat session={session} selection={selection} ... />
  }
  ```
- `WeshopWorkspace`（`CanvasWorkspace.jsx:24`）接收 `onSelectionChange` prop；每次 `selectedIds` 变化回调（`CanvasWorkspace.jsx:278-285`）：
  ```jsx
  onSelectionChange?.(selectedItems.map((item) => ({
    id: item.id,
    title: item.title || "Untitled",
    kind: item.kind || "material",
    mediaType: item.mediaType || "image",
  })));
  ```

**【事实】画布自身状态是 localStorage/state.json，与 session 解耦。** `CanvasWorkspace.jsx:12-22` 的 `restoreCanvases` 从 localStorage 读；用户新建/切换画布完全在 weshop 内部 state。`/api/weshop/state` 只是给 host tools（`weshop_canvas_get_state` / `weshop_canvas_get_selection`）读，**不挂 session id**——session 是 dsh 的，canvas 是 weshop 自有的，两层各自持久化（canvas 用 localStorage 浏览器端，state 写到 `/tmp/weshop-*-canvas-state.json` 由 host 维护，见 `weshop/src/index.js:33-37, 147-150`）。

**【推断】对 open-pencil 的启示**：marketing 选区（type / profile）当前挂在 React 端 `materialTypeSelection` / `profileSelection` ref（`open-pencil/src/components/chat/MarketingConfigBar.vue:11`），是 Vue ref 不可跨组件序列化；如果走 X 路线把 Bar 注册进 dsh composer slot，要把这两个 ref 的值变成 host 端的可序列化 state（注入到 session system-prompt overlay 或 dsh 的 settings），而不是 props 桥——参 §C3。

### A5. skills/presets 怎么被 weshop 插件编排

**【事实】三个 Skill 全由 host 端注册，body 从文件系统读。** `weshop/src/index.js:46-77`：

```js
const bundledSkills = [
  { name: "open-weshop-2-0", description: "..." },
  { name: "inspect-weshop-canvas", description: "..." },
  { name: "weshop-openapi", description: "..." },
];
function registerBundledSkills(ctx) {
  for (const skill of bundledSkills) {
    ctx.skills.register({
      ...skill,
      invocation: { modelInvocable: true, userInvocable: true },
      provider: "weshop",
      source: "bundled",
      resourceBase: { kind: "directory", path: path.join(skillDirectory, skill.name) },
      content: skillBody(skill.name),
    });
  }
}
```

`resourceBase: directory` + `content: skillBody(name)` = 把 `skills/<name>/SKILL.md` 整段 markdown 灌进 skill registry，模型可见、可调。

**【事实】preset 由 host 安装到 `~/.dsh/.agent-presets/weshop-canvas/`**：`weshop/src/index.js:79-105` 的 `installBundledPreset()` 用 `fs.cpSync` 把 bundle 里的 `presets/weshop-canvas/` 复制到 dsh home；只覆盖 legacy MCP-era 版本（composition 含 `mcp__weshop-canvas__` 时），用户自定 preset 不动。

**【事实】`weshop-canvas` preset 是「基于 standard + persona + 工具 + skills」的标准 dsh preset。** `presets/weshop-canvas/agent.cordis.yml` 230 行（细节已在 spike 01 间接涉及）：继承 standard 全套（shell/fs/jobs/skills/goals/plan-mode/compaction/delegation 等），叠加 weshop 三个 skill 的 invocation policy + persona（"你是一位 WeShop 创作 agent，工作流是 1)读画布 2)MANDATORY 调 weshop-openapi Skill 3)发布到画布 4)进度上报 5)自动重试 6)处理 context-menu 请求"）。

**【事实】何时显示画布 = session 当前 preset === `weshop-canvas`**：`weshop/src/client/index.jsx:137-142, 160, 187-194` 用 `presetFor(state) === WESHOP_PRESET` 作显隐开关，并把 session preset 切换事件缓存到 `presetBySession` Map 防闪烁。

**【推断】open-pencil 的「marketing-design」preset 完全可参照这个范式实现**（见 §C4）：1 个 preset + 2-3 个 skills（open-pencil-canvas / inspect-openpencil / openpencil-tools）+ 1 个 persona，且 persona 的 6 步工作流是产品分发的天然文档钩子。

---

## 2. dsh 暴露给插件的可用面（B）

### B1. plugin 能不能用 dsh 自带 Chat 组件

**【事实】可以，但 dsh Chat 是一个 slot 占有者，不是可引用的 React 组件。** `conversation` slot（`dsh/.../ui-layout/.../AppFrame.tsx:190`）被 `ui-conversation` 整体占据（`dsh/.../ui-conversation/.../apply.ts:196-256` 注册 70+ 行声明的子 slot 树），替换 `conversation` slot 意味着「接管整个会话列」。它声明的子 slot 中：

- `conversation.view`（list）—— weshop **不能用**，因为它一次只渲染 active tab（spike 01 §X1 已记）。weshop 选 `shell.overlay` 完全规避这个约束。
- `conversation.session`（single）—— 注释 "taking this seat means rendering that session's conversation yourself"，可以接管但要重新实现所有 ChatView/MessageItem/AssistantMarkdown 等（25+ 文件，`dsh/.../ui-conversation/.../chat/`）。
- `conversation.composer`（chain）—— 选择器路由，可注册一个 React 组件在某种条件（比如「画布展开时」）取代 InputBar；weshop 没用。
- `conversation.chat.node`（keyed）—— 按消息类型分发，可注册自定义消息渲染（spike 01 §Z2 C4a）。

**【事实】`ui-conversation` 不导出 ChatView 等组件供插件 import。** `apply.ts` 是闭包注册；包内 `src/client/chat/ChatView.tsx` 等文件**没有 `export` 给 `package.json` 的 `exports` 字段**（参 `dsh/.../ui-conversation/package.json`，`.` + `./invariant` 两入口，没有子路径），且按 dsh 架构规约 §3.8 "跨包不能 import 另一个插件的符号"——理论上能 fork，但**违反生态约束**。

**【推断】三条获取 dsh Chat 行为的路径，按成本升序**：

1. **不获取，直接照 weshop 范式自写一个 Vue 版 `CanvasChat` 消费 `SessionFace`**。成本 ≈ 与 F0.4 原估算 4 人日持平，**但要在 React 包装器里跑 Vue**（§C1 路 2）。
2. **fork `ui-conversation` 包**：`pnpm pack` + 在我们的 plugin `node_modules` 顶替，按需改 ChatView/MessageItem 后 `pnpm patch`。成本 ≈ 1 人日改 + 长期维护 fork（dsh 升级断）。
3. **挂进 `conversation.chat.node` keyed slot 注册我们的 React renderer**，但**整体 Chat 列仍归 dsh**——我们只接管特定消息类型（如工具结果缩略图），不做整 Chat 替换。这其实就是 spike 01 §Z2 C4a 提到的方案，不是用来替代 Chat。

**weshop 实际走的是路 1**。

### B2. plugin 怎么从 session 拿消息、怎么发消息、监听状态——完整 API 面

完整证据来自 `dsh/packages/client/runtime/src/client/contract/session.ts:30-82`（`ISession`）+ `dsh/packages/client/runtime/src/client/sessions/service.ts:139-144`（`SessionBinding`）。

**【事实】`SessionFace = ISession & ObservableSnapshot<ConversationSnapshot>`**（`session.ts:89`）。即 plugin 拿到一个 `SessionFace`，既有数据面（`subscribe/getSnapshot`）又有动词面（`prompt/cancel/rename/loadOlder/readAttachment/updateQueue/command`），**完整覆盖 F0.4 所需**。

`ISession` 完整动词面：

| 动词 | 签名 | 用途 |
|---|---|---|
| `prompt` | `(content: PromptContentPart[], mode: 'queue'\|'steer') => Promise<RpcResult<{accepted:true}>>` | 发消息。`queue` 排队、`steer` 中断当前 turn（`session.ts:36-41`） |
| `cancel` | `() => Promise<RpcResult<{accepted:true}>>` | 停止当前 turn（`session.ts:62`） |
| `updateQueue` | `(itemId: MessageId, action: QueueAction) => Promise<RpcResult<{accepted:true}>>` | 编辑/删除/steer 队列中未处理项（`session.ts:56`） |
| `rename` | `(title: string) => Promise<RpcResult<{title:string;seq:number}>>` | 重命名 session（`session.ts:69`） |
| `loadOlder` | `() => Promise<void>` | 加载更早历史（`session.ts:74`） |
| `readAttachment` | `(attachmentId) => Promise<RpcResult<{attachment, data:Uint8Array}>>` | 读 attachment（`session.ts:47-49`） |
| `command` | `(line: string) => Promise<RemoteResult<{matched:boolean}>>` | 执行 `/slash` 命令（`session.ts:81`） |
| `sessionId` | readonly | session id（`session.ts:32`） |
| `projections` | `ProjectionsFace` | 读 projections（`session.ts:34`） |

**【事实】数据面 `ConversationSnapshot` 关键字段**（`conversation.ts:433-477`）：

| 字段 | 用途 |
|---|---|
| `chat: ChatSnapshot`（order + nodes + locations + timeline + legacy） | 渲染消息列表（weshop 用 `chat.order` + `chat.nodes.get(key)`，`CanvasChat.jsx:164-188`） |
| `running: boolean` | 顶部 spinner / cancel 按钮显隐（`CanvasChat.jsx:306-308`） |
| `removed: boolean` | session 已删除，UI 灰化（`CanvasChat.jsx:228, 304`） |
| `pending: PendingInteraction[]` | 待处理问题/审批（`CanvasChat.jsx:199-200`） |
| `promptError: PromptError\|null` | 错误提示（`CanvasChat.jsx:239-243`） |
| `blank: boolean` | 空白 session，用于 New Session 复用（`conversation.ts:474-475`） |

**【事实】拿 `SessionFace` 的官方路径**：`ctx.sessions.binding(id)?.session`（`weshop/.../index.jsx:170`，`dsh/.../contract/sessions.ts:129`）。

**【事实】监听状态变化的两条路径**：

- **plugin 内部自渲染**：`session.subscribe(listener)` + React `useSyncExternalStore`（`CanvasChat.jsx:192-196`，即 §A1 已述）。
- **影响 dsh 原生 UI**：`ctx.sessions.list.subscribe(listener)`（`CanvasChat.jsx:217`，`index.jsx:185-217`）—— 当 preset 改变（普通 ↔ weshop-canvas）触发 panel 重新挂载。

**【推断】`PendingInteraction` 是「审批 + 问题」统一通道。** `dsh/.../sessions/pending.ts:9-22`：`PendingInteraction = approval | question`（kind discriminator），每个实例有 `respond(result: ClientResponse['result']) => Promise<RpcReceipt>`（`pending.ts:73`）。CanvasChat 的 `CanvasQuestion`（`CanvasChat.jsx:31-89`）+ `CanvasApproval`（`CanvasChat.jsx:131-153`）就是分别消费这两种 wait——传 `{ok:true, value: {sessionId, answer}}` 或 `{ok:true, value: {sessionId, approvalId, outcome:'rejected'|'allowed-once'}}`。**直接复用到我们 marketing 设计场景的「工具审批」UI 是现成的范式**。

### B3. plugin 怎么对接到 agent 循环/工具审批

**【事实】plugin 侧在 agent 循环中不是旁观者——它就是 loop 的一部分。** plugin 通过 `ctx.tools.register({ name, description, parameters, execute })`（`dsh/.../core/tools/src/index.ts:222-235`，weshop 实例 `weshop/src/native-tools.js:130-263, 327-338`）声明工具；agent loop 在模型决定调用时经 `tools/pre-execute` waterfall 路由审批决策（spike 01 §Y7 已记）。

**【事实】weshop 怎么用 agent 循环做端到端：**

1. 用户在 CanvasChat 输入「把这张主图换成海边场景」
2. CanvasChat 调 `session.prompt([{type:'text', text: '...'}], 'queue')`（`CanvasChat.jsx:238`），文本中含 `@<title>` 前缀 + `<canvas-selection item_ids=...>` 上下文
3. dsh agent loop 启动一轮 → 模型调 `weshop-openapi` Skill（persona MANDATORY 强制，`agent.cordis.yml:35-43`）
4. Skill 返回 recipes → 模型调工具 `weshop_generate_run({ agent:'gpt-image', originalImage:'<localPath>', params:{...}, wait:true })`（`native-tools.js:236-251`）
5. 工具 `execute`（`native-tools.js:303-311`）调 WeShop OpenAPI + 轮询 → 返 `{ok, executionId, done}` 结果
6. 模型继续调 `weshop_canvas_publish_result({title, url, provenance:{agent, executionId, ...}})`（`native-tools.js:161-179`）
7. 工具 `execute`（`native-tools.js:278-302`）写一行到 `/tmp/weshop-*-canvas-actions.jsonl`，并写 `progress.stage='complete'`
8. weshop 客户端每 800ms `fetch('/api/weshop/actions?after=N')`（`index.jsx:228-252`）拿到新 action，复制 localPath 到 `/tmp/weshop-*-assets/` 并把 `payload.url` 改成 `/api/weshop/assets/<id>`，画布 state 通过 `localStorage` 写回
9. WeshopWorkspace 读 localStorage 渲染新 item（`CanvasWorkspace.jsx:12-22, 120-125`）

**【推断】这条「host HTTP API + 浏览器轮询」是 weshop 唯一的「host→browser 推」机制**，因为 dsh 的 WS downlink 是单向的（spike 01 §X3 已记）。800ms 轮询是 weshop 的折中；tool-result 直接经过模型的消息流（不需要轮询）能立即到 CanvasChat 的 `chatRows` 渲染——weshop 把「消息流」与「canvas 资产流」分开走，**是个值得借鉴的边界划分**。

**【事实】审批 hook 完整形态。** `ctx.approval.request({...})` 走 host 端 `user-approval` 包（spike 01 §Y7 已记），生成 `MuxFrame: 'approval/requested'`（`dsh/.../host/apiproxy/.../events.ts:72`）→ 由 Session 投影成 `pending: PendingInteraction[]` 中 `kind:'approval'` 项 → plugin 的 ChatPanel 从 `ConversationSnapshot.pending` 读 → 调 `wait.respond({ok, value})` 回 → Session 把 `client-response` 帧发回 host → `approval/resolved` 帧回流。**整个往返是 RPC，不经过 `ctx.webServer`。**

### B4. Typert RPC 与 WS events.mux 的协议格式

**【事实】`/api/events.mux` 流是一个 `AsyncIterable<RpcRequest<MuxFrame>>`**（`dsh/.../host/apiproxy/.../events.ts:56`）。MuxFrame 联合体（`events.ts:69-108`）：

| 类型 | 方向 | 字段 | 用途 |
|---|---|---|---|
| `session/event` | push | `sessionId, event: SessionEvent, view?: ToolEventView` | 主力事件（turn start, chunk, tool/call, tool/result, message append） |
| `session/subscribed` | push（订阅时一次性） | `sessionId, lastSeq` | 重连基线 |
| `approval/requested` | server-request（可答） | `sessionId, approvalId, toolName, callId?, reason?` | 工具审批 |
| `approval/resolved` | push | `sessionId, approvalId, outcome` | 审批结果（自己或他人解决） |
| `question/requested` | server-request（可答） | `sessionId, questions: AskUserQuestionItem[]` | 用户提问（multi-question） |
| `question/resolved` | push | `sessionId, questionRpcId, outcome` | 提问结果 |
| `session/queue` | push（snapshot） | `sessionId, items: QueuedInboxItem[]` | 队列状态（queued/steering/context 三类） |
| `session/jobs` | push（snapshot） | `sessionId, jobs: JobView[]` | 后台 job 列表 |
| `session/projection` | push | `sessionId, key, value, seq` | projection 值变化 |
| `stream/error` | push | `error: RpcError` | 流错误 |

**【事实】`host/remote-event` 是 host cordis 事件到 browser 的桥**（`events.ts:154`，转发 `cordis/.../Events` 事件如 `agent-preset/selected`）。但**仅 11 个白名单事件**（`dsh/.../api/remotes/.../remote-events.ts:17-29`）可被 consumer 收：

```
agent-preset/selected, commands/change, credentials/updated,
cordis/request-run, cordis/request-run-resolved,
cordis/dynamic-package, cordis/dynamic-retract,
cordis/inspect-query, cordis/inspect-query-resolved,
llm/adapters-updated, settings/document-updated
```

**【推断】weshop 只用 `agent-preset/selected`**（`weshop/.../index.jsx:218-225`）判断用户切换到 weshop-canvas preset。要扩展到我们 marketing 工作台，**预设里 emit 一个自定义 cordis 事件是不够的**——必须先在 dsh 白名单里加，或绕过白名单用 `host/remote-event` 通路走 `ctx.remote.$on`（spike 01 §X3 的推断需要修订——`ctx.remote.$on` 限于白名单事件，**任意 cordis 事件不能广播**）。

**【事实】浏览器到 host 的 RPC 走 `POST /api` + `client/respond` + `client-response` 帧**（`events.ts:73, 75`）。plugin 调用 `session.prompt` 等动词时，runtime 内部把请求路由到 host cordis 的 `agents.create` / `agents.resume` / tool `execute`——**plugin 不直接看 RPC wire**。

**【推断】自写 Vue ChatPanel 的成本 = 把 `ConversationSnapshot` 投影成 Vue reactive ref**。数据面（subscribe + getSnapshot → reactive）≈ 0.5 人日；动词面（prompt/cancel/updateQueue/rename/loadOlder）≈ 0.5 人日（**简单 promise wrap**）；审批/问题 UI 复用 weshop CanvasQuestion/CanvasApproval 的 React 组件转 Vue 写法 ≈ 1 人日。**总计 2 人日**，比 spike 01 §0.2 估的 4 人日低。**但 React 包装器层另算**（§C1 路 2）。

---

## 3. 与 open-pencil 的对接面（C）

### C1. 如果我们的 ChatPanel（Vue）想走 overlay 路线，有几条路径

| 路径 | 工程成本 | UX 一致性 | 阻塞点 |
|---|---|---|---|
| **路 1：原样使用 weshop 范式，自写 Vue CanvasChat 消费 `SessionFace`** | **5 人日**：Vue ChatPanel 2 + React 包装器 2 + z-index/portal/i18n 1 | 中（自维护 chat UI；与 dsh 自带 Chat 在某 session 上共存，会让用户困惑——weshop 故意做了 preset 隔离） | (1) dsh 自家 Chat 在 session 列里照样渲染（不删），用户看到两个 chat 框——weshop 通过 preset 隔离缓解，但 §C4 (3) 仍有泄露风险。(2) React 包装器内 Vue app 卸载/挂载 vs dsh 自家 Chat 切换的体感（双层状态同步） |
| **路 2：fork `ui-conversation`，整 Chat 列用我们的 Vue 渲染** | **7-9 人日**：fork + 改 + 维护 3 + Vue 包装器 2 + 全 Chat 状态管理 2-4 | 高（一致） | (1) 持有一个 dsh 包 fork，升级断。(2) ChatView/MessageItem 等 25+ 文件改造成 Vue 工作量大。(3) 跨包 import 违反 dsh 规约（§B1） |
| **路 3：自写 Vue RPC adapter 直连 `POST /api` + `WS /api/events.mux`** | **8-10 人日**：ws-client 2 + JSON 解析 + 帧重组 2 + Vue 状态管理 2 + 全功能覆盖（审批/队列/投影）2-4 | 中（UX 自维护，但 wire 层自写） | (1) 需要完整理解 MuxFrame 联合 + PendingInteraction + projection 的快照语义；weshop 没做这件事因为 `SessionFace` 已经包了。(2) sdk-client（Y 路线）已经把这事做了一遍，**在 dsh 插件侧重新发明是 Y 路线的子集** |
| **路 4：用 dsh 内置 Chat component 直接挂** | **不可行**：组件不导出（§B1），违反 dsh 规约 | — | — |

**【推断】路 1 是 weshop 的实际选择**。成本 5 人日比 spike 01 §F0.4 估的 4 人日多 1 人日，主要因 React 包装器桥接 Vue 应用的 `createApp/mount/unmount` 生命周期管理。

**【推断】路 1 的 UX 一致性问题可控**：(a) 通过 preset 隔离：只在 `open-pencil-design` preset 时显示我们的 overlay（weshop 范式，§A5）；(b) 通过 dsh `details` column 不显示：weshop 注释（`index.jsx:21-23`）说明「自动 close `details` on session switch + 只对非 blank session 渲染」与常驻画布冲突——我们要让 session 切换时也保持 marketing overlay 不闪。

### C2. weshop 工具执行链路完整追踪

**【事实】完整链路**（§B3 已详述），关键协议节点：

1. **Browser → host：消息**：`session.prompt([{type:'text', text}], 'queue')` → ws/POST 路由到 `ctx.agents` 创建 turn
2. **host → Browser：消息流**：`/api/events.mux` 推 `session/event{type:'assistant/chunk'}` 等 → 由 `SessionFace` observable 投影成 `ConversationSnapshot`
3. **host 模型决定 → host tool execute**：`ctx.tools` 注册的工具 `execute(args, execSignal)`（weshop 实例 `native-tools.js:265-319`）
4. **host → host WeShop OpenAPI**：`weshopRequest('/agent/runs', ...)` 直 fetch `https://openapi.weshop.ai/openapi`（`native-tools.js:41-54`）+ 轮询（`weshopPollRun`，`native-tools.js:69-79`）
5. **host → host：写画布 action**：`fs.appendFileSync(actionFile, ...)`（`native-tools.js:299`）
6. **Browser 轮询 → host `/api/weshop/actions?after=N`**：复制 `localPath` 到 `assetDirectory` 并改 URL（`index.js:204-229`）
7. **Browser：localStorage 状态更新 + 画布渲染**：`CanvasWorkspace` 从 localStorage 读新 state

**【事实】第 5-7 步是 weshop 独有的「文件 JSONL 当消息总线」模式**，dsh 没有提供等价物。这是 weshop 因为 host→browser 单向限制被迫发明的——canvas 资产需要 host 主动推，但 dsh wire 不支持 tool-result 流之外的主动推。

**【推断】对我们 marketing 工作台的影响**：
- **不需要画布资产流**——marketing UI 不生成图，只配置参数。所以可以跳过第 5-7 步，全部走 dsh wire。
- **但仍需要 host 端工具把状态变化推给 browser**：例如「agent 已经处理完 brief，调过生成工具，brief panel 需要从 `in-progress` 切到 `completed`」。这条信息在 dsh wire 里通过 `tool/result` 事件 + session 流到达 browser，**已经足够**——我们 Vue 端订阅 `session.subscribe` 即可感知。
- **【假设】轮询 vs dsh wire 选择**：若 marketing UI 状态纯由 session 流驱动，不需文件 JSONL 模式——**这是 weshop 范式与 marketing 范式的本质差异**。

### C3. marketing 工作台 UI（MarketingConfigBar / BriefPanelDialog / ProfileGalleryDialog）如果都挂 overlay

**【事实】当前 marketing UI 是 reka-ui DialogRoot + DropdownMenuRoot 写的 Vue 对话框**（`open-pencil/src/components/chat/BriefPanelDialog.vue:18-29`，`ProfileGalleryDialog.vue:5-15`，`MarketingConfigBar.vue:3-13`）。

**【推断】三条最干净的挂法**：

**挂法 1（推荐）：每个 component 注册进对应的 dsh slot，独立显隐**：
- `MarketingConfigBar` → `conversation.input.left` 或 `conversation.composer.dock`（`dsh/.../ui-conversation/.../apply.ts:207-208`）—— 列表 slot，多 entry 共存。
- `BriefPanelDialog` → 用 dsh 的 `AppDialogRoot`（reka-ui）写一个 React 包装器，**或** 挂到 weshop 范式的 `shell.overlay`（`ui-layout/.../index.ts:83`）。
- `ProfileGalleryDialog` → 同 BriefPanel。

**【事实】`shell.overlay` 是 weshop 验证过的 list slot**——多个 plugin 可同时挂，order 控制 z 序（`ui-layout/.../index.ts:83` 注释 "entries order among themselves"）。但 z-index=20 受 AppFrame `.overlayLayer` 包裹，**不足以越界**（`ui-layout/.../AppFrame.module.css:110-115`），weshop 用 `createPortal` 到 `document.body` 配 z-index=1000001 绕路（`weshop/.../index.jsx:30-35, 97-109`）。**marketing dialog 复用同样范式**。

**挂法 2（轻）：marketing UI 全部孤岛内保留，状态通过 host system-prompt overlay 同步**——这是 spike 01 §Z1 C5a 的方案。优点是 dialog 行为完全在 Vue 内，与 dsh 0 冲突；缺点是 dialog 必须能跨 dsh session 边界展示（用户切 session 时 dialog 应保留/隐藏？weshop 范式是「保留直到 onExit」）。

**挂法 3（最重）：替换 `conversation.composer`（chain slot）**——让 marketing UI 在某个 selector（profile 已锁？brief 已开？）下替换 InputBar。复杂度高，UX 收益不明，**不推荐**。

**状态管理 / 快捷键冲突的最干净方案**：
- **状态管理**：`materialTypeSelection` / `profileSelection` 是 Vue ref（`open-pencil/src/components/chat/MarketingConfigBar.vue:11`），孤岛外不可见。**方案**：经 dsh settings/document-updated 写出去（白名单事件，`remote-events.ts:28`）；或经 system-prompt overlay provider（`ctx.systemPrompt.context`，spike 01 §Z1 F0.6）；或经 custom dsh `session.event` 附加到 session 流。
- **快捷键冲突**：weshop 用 `Enter 发送 · Shift+Enter 换行`（`CanvasChat.jsx:316`），与 dsh 自带 Chat 一致——dsh 也是同套快捷键，**未观察到冲突**。【假设】`Cmd+K` 等全局快捷键可能冲突，需要实测。

### C4. weshop 的预设（preset）系统

**【事实】weshop 的 preset 是 weshop-canvas agent preset，定义了 weshop 的 agent 行为**——不是简单的 prompt 模板。`presets/weshop-canvas/agent.cordis.yml` 是 dsh agent cordis composition（标准 dsh preset 格式），里面继承 standard preset 全套能力（shell/fs/jobs/skills/goals/plan-mode/compaction/delegation 等），叠加 weshop 3 个 skill invocation + persona。

**【推断】对 open-pencil 的「marketing-design」preset 完全可移植**：1 个 preset（继承 standard + persona + 3-5 个 marketing skill）+ N 个 skill 的 SKILL.md。这是 dsh **市场分发（market）的最小载体**——plugin 安装后 hook 到 host 的「agent 行为 + 工具集」。

**【假设】市场分发的可能形态**：`dsh-market` 平台（`README.md:51-53`）支持按 plugin 分发。weshop 的 4 件套（plugin 包 + preset + 3 skills + assets）打包为一个 npm tarball，用户 `dsh plugin --profile web add dshmarket` 后在 **Settings → Plugin Market** 浏览安装。我们 Phase 1 若走 X 路线，**marketing-design plugin 应一并打包为可分发的 npm 包**——复用 `bin/setup.js` 范式（`weshop/bin/setup.js:1-66`）。

**【假设】open-pencil 的预设/插件应不应该做？** 是 phase 2 的问题。Phase 1 不必做（dsh 还在 preview），但产品定义要预留这个分发维度。

---

## 4. 评估校正（D）

### D1. 复核 spike 01 的 X 路线工作量（≈33 人日）——哪些项被低估/高估

**【事实】X 路线工作量复核**：

| 块 | spike 01 估 | 本 spike 估 | 差 | 原因 |
|---|---|---|---|---|
| F0.1 runtime 内核 | 1 | 1 | 0 | — |
| F0.2 工具桥 | 2 | 2 | 0 | — |
| F0.3 凭证 | 2 | 2 | 0 | — |
| F0.4 传输契约 + chat | 0 + 4 = 4 | **6** | **+2** | (a) 自写 Vue ChatPanel 消费 SessionFace 2；(b) brandSelection 在 prompt 注入期读取 1；(c) 与 dsh 自带 Chat 在某 session 上双 Chat 共存的视觉/快捷键调和 1 |
| F0.5 session↔文件 | 2 | 2 | 0 | — |
| F0.6 prompt 注入 | 1 | 1 | 0 | — |
| F0.7 prompts 构建链 | 0.5 | 0.5 | 0 | — |
| 编辑器壳孤岛化 | 4 | **5** | **+1** | (a) 双框架 `createApp/unmount` 生命周期与 dsh route 切换同步 0.5；(b) Vue Teleport vs dsh shell.overlay portal 嵌套 0.5 |
| 常驻挂载策略 | 2 | **3** | **+1** | `shell.overlay` z-index=20 不够，**必须** portal→body 自管 z=1M+——weshop 实测坑（§0.2 注） |
| 插件打包/版本钉扎 | 1.5 | 1.5 | 0 | — |
| C1a 需求单 | 2 | 2 | 0 | — |
| C2a brand + overlay | 3.5 | 3.5 | 0 | — |
| C3a 工具包装 | 2.5 | 2.5 | 0 | — |
| C4a look 图片 | 3 | 3 | 0 | — |
| C5a ConfigBar 集成 | 2 | **3** | **+1** | (a) Vue reka-ui Dialog 在 dsh shell.overlay portal 实测适配 0.5；(b) 状态经 settings/document-updated 写出 + 读回桥接 0.5 |
| **合计** | **≈33** | **≈37-40** | **+4-7** | |

**【推断】X 路线工作量在 37-40 人日区间，比 spike 01 估的多 4-7 人日**。比 Y（25 人日）贵 50% 左右，与 spike 01 的判断「贵 30%」相比差距**进一步拉大**。

### D2. 之前漏掉的关键能力点（3-5 条）

1. **`SessionFace` 是 plugin 自写 Chat 的免费午餐**（§A1, §B2）。spike 01 §0 的「流式零成本」暗示这条但没明示——weshop CanvasChat 315 行代码**没有任何 RPC 代码**，全靠 `SessionFace` 提供的 `subscribe/getSnapshot/prompt/cancel/respond`。我们 Vue ChatPanel 同样能复用。**关键失误**：之前误以为要自维护消息缓存或写 ws-client——不需要。
2. **`createPortal(document.body)` + 自管 z-index 是 weshop 范式的关键补丁**（§0.2 注，§C3）。spike 01 §X1 提到 weshop 用 `shell.overlay` + portal 但没量化 z-index=20 vs 1M 的差异——这意味着任何走 X 的 plugin 都要写 portal+自管 z-index 代码，**不是免费的**，常被低估。
3. **tool/result 在 dsh wire 里**与 assistant message 共用 session event 流**——weshop 不需要为「工具调用结果回投画布」单写一套推送**（§B3 第 5-9 步）。weshop 的 JSONL 当消息总线是为 **host 主动产生且不属于 session 事件**的资产发布用的，不是为 tool-result。**open-pencil marketing 场景可能完全不需要这个 JSONL 模式**——只走 dsh wire 即可，节省 0.5-1 人日的轮询+解析代码。
4. **`ctx.remote.$on` 只接受 11 个白名单事件**（§B4）。spike 01 §X3 推断「plugin 端可以自由订阅 cordis 事件」——错的。要新增 marketing 工作台事件（如「brief 已锁定」「profile 已选定」）到 plugin UI，**要么走白名单的 `settings/document-updated` + dsh settings 系统**（绕一圈），要么向 dsh 提交 PR 加白名单（preview 期不现实），要么用 `ctx.webServer` HTTP poll（weshop 范式）。**修正**：X 路线的「双工事件流」成本比想象中大。
5. **`shell.overlay` 与 dsh 自家 Chat 是并行存在的两个 Chat 表面**（§C1 路 1 UX 一致性问题）。weshop 通过 preset 隔离缓解，但**不能消除**：用户在 weshop-canvas preset 时看到画布+自写 Chat，dsh 自家 Chat 在 session 列照常渲染。**对 marketing 工作台**：如果用户在「open-pencil-design」preset 下既要 marketing overlay 又要 dsh Chat，双 Chat 框会让用户困惑。**策略**：要么走 §C1 路 2（fork 替换 conversation），要么限制 dsh Chat 为隐藏（在 dsh settings 写），要么说服用户「marketing 时 dsh Chat 不可用」。weshop 没暴露这个产品决策给我们，**open-pencil 需要自己定**。

### D3. 给一份「X 路线如果有幸被选，下一步必须代码验证什么」的具体清单（spike S-X）

（详见 §5 S-X 验证清单）

---

## 5. spike 01 修正建议表

| spike 01 节 | 原内容 | 修正建议 |
|---|---|---|
| §0 结论 | 「X 比 Y 贵约 30%」 | 改为「X 比 Y 贵约 50%（37-40 vs 25 人日）」 |
| §0 结论 | 「多模态/session/流式三个硬问题在 X 下没有因此变简单」 | 追加「且 X 多一个硬问题：plugin 自维护 Chat（路 1）或 fork ui-conversation（路 2）」 |
| §X1 | 「`shell.overlay` + createPortal 到 document.body 常驻——WeShop 的实测做法」 | 补充 z-index 修正：z-index=20 在 dsh-web-ui retro-OS skin 下被压，必须自管 1M+ |
| §X1 | 末段「可行，但必须走策略 B 或 C（常驻挂载），策略 A 仅够 demo」 | 策略 B（替换 conversation slot）在 dsh 规约下等于 fork ui-conversation（25+ 文件），成本 7-9 人日；weshop 范式走策略 C 是更经济的折中 |
| §X2 表 | 「聊天面板：废弃，用 dsh 自带聊天」 | **删除**：weshop CanvasChat 反例证明自写 Chat 是合理的；改为「双方案选：(a) 自写 Vue ChatPanel 消费 SessionFace 5 人日（路 1），或 (b) fork ui-conversation 7-9 人日（路 2）」 |
| §X2 表 | 「营销 UI：孤岛内保留 + 状态桥，或重写为 React 注册到 dsh composer/header slot」 | 修正：状态桥不能走 `ctx.remote.$on` 自由订阅 cordis 事件（白名单限制 §D2.4），需经 `settings/document-updated` 绕一圈 |
| §X3 | 「host→browser 的 WS downlink 是单向的」 | 补充：但 `SessionFace` 把 host→browser 的 session event、tool/call、approval/requested、projection 全投影成可订阅的 observable，**plugin 写 Chat 等于免费拿到一个事件订阅 SDK**，不需要自写 ws-client |
| §F0.4 工作量 | 0 + 4 | 改为 6 |
| §编辑器壳孤岛化 | 4 | 改为 5 |
| §常驻挂载策略 | 2 | 改为 3 |
| §C5a ConfigBar 集成 | 2 | 改为 3 |
| §F0 小计 | ≈20 | 改为 ≈23 |
| §合计 | ≈33 人日 | 改为 **≈37-40 人日** |
| §4 spike 计划 | S4（hello-plugin）1-2d | 改为 S-X1 到 S-X6（§5），共 4-5d |

---

## 6. 风险/不确定项

| # | 风险 | 概率 | 影响 | 缓解 |
|---|---|---|---|---|
| X-R1 | 双 Chat 共存（§C1, §D2.5） | 高 | 用户困惑；preset 隔离缓解但消除不彻底 | 决定产品形态：(a) marketing 时隐藏 dsh Chat；(b) 接 conversation slot 替换整体 Chat；(c) 接受双 Chat UX |
| X-R2 | Vue app 在 React 包装器内 unmount 生命周期不可控 | 中 | 切 session 时编辑器闪退/状态丢失 | 状态外置到 dsh `ctx.effect` 持有（weshop CanvasWorkspace 用 localStorage 是简化范式）；S-X2 实测 |
| X-R3 | `ctx.remote.$on` 白名单（11 事件）限制 plugin 自定义事件 | 中（已确认 §B4） | 「brief 已锁定」「profile 已选定」等 marketing 事件无 native 通路 | 走 `settings/document-updated` + dsh settings；S-X4 实测 |
| X-R4 | dsh developer preview 版本变化冲击（spike 01 §X5 已记） | 高（X） | UI 插件编译断；编辑器不可达 | 版本钉扎 + 升级 smoke；S-X6 加固 |
| X-R5 | dsh 自家 Chat 对话流变更冲击 CanvasChat 的订阅假设 | 中 | CanvasChat 渲染异常 | CanvasChat 测试覆盖（chat.order/nodes/pending 三个字段）；S-X2 加固 |
| X-R6 | 自写 Vue ChatPanel 不复现 dsh Chat 的 markdown / code / image / file attachment 渲染 | 中 | UX 不一致 | 优先级切，先文本+tool-call 渲染（覆盖 marketing 90% 场景），其他渐进；weshop CanvasChat 也只覆盖了文本+tool-name，不复刻 dsh ChatView 的 markdown AST |
| X-R7 | shell.overlay portal 与 dsh 自家 DialogRoot 嵌套层级冲突（reka-ui dismissable-layer） | 中 | 多 dialog 共存时 Escape/click-outside 行为异常 | 用 dsh 自家 dialog 范式（`AppDialogRoot`，weshop 没碰过这条路）或统一 z-index 栈；S-X5 实测 |

---

## 7. S-X spike 验证清单（X 路线必过项）

| # | 验证项 | 时间 | 通过标准 | 不通过的决策影响 |
|---|---|---|---|---|
| **S-X1** | **`SessionFace` 通过 React 包装器暴露给 Vue 端** | 0.5d | 在 `apply.ts` 里写一个 React 包装器，通过 `props.session` 拿到 `SessionFace` 并透传给 Vue 组件；`session.subscribe/getSnapshot/prompt/cancel` 在 Vue 端能调通 | 改走 §C1 路 2（fork ui-conversation） |
| **S-X2** | **自写 Vue ChatPanel 消费 `ConversationSnapshot`** | 1.5d | 完整复刻 weshop CanvasChat 的 4 个功能：消息列表（chat.order+nodes）、文本输入（session.prompt）、cancel（session.cancel）、审批/问题 UI（session.pending.find+wait.respond） | 接受 UX 不复刻（markdown/attachment 砍）或转路 2 |
| **S-X3** | **`shell.overlay` portal 实测 z-index 越界** | 0.5d | 在 dsh 自家 Chat 可见时，portal→body 的 overlay 仍然在最上层；`createPortal(<div>, document.body)` + `style.zIndex = 1000001` 验证 OK | 改走策略 B（替换 conversation slot），代价 7-9 人日 |
| **S-X4** | **`PendingInteraction.respond` 在 React 包装器往返** | 0.5d | 触发一个工具审批 → Vue 端 `wait.respond({ok:true, value:{sessionId, approvalId, outcome:'allowed-once'}})` → host 端 tool 执行恢复 → 下游 `tool/result` event 正常回流 | 接受审批 UI 走 dsh 自家（仅在我们 ChatPanel 显示一个「查看 dsh 对话」链接）；或 fork ApprovalPanel |
| **S-X5** | **dsh-web-ui retro-OS skin 对 overlay 的视觉干扰** | 0.5d | 启用任意 retro-OS skin（xp/ths/qq98/trading/miku）→ weshop-style overlay 仍可见且不与 title/status bar 冲突 | 与 S-X3 一起判；如未过，转策略 B |
| **S-X6** | **host 端 `/api/openpencil/*` + dsh 工具 + ctx.tools.register 端到端** | 1d | (a) host 端 `ctx.webServer.register({kind:'prefix', path:'/api/openpencil', handler})` 暴露 `/api/openpencil/state` GET/POST；(b) host 端 `ctx.tools.register({name:'openpencil_canvas_get_state', execute(args){...}})` 通过 `stateFile` 读 canvas state；(c) browser 端 `session.prompt` → 模型决定调工具 → 工具返回 → browser 端 Vue 组件通过 `session.subscribe` 感知到 `tool/result` 流 | 整条 X 路线的工具桥不可达，回到 Y 路线 |
| **总计** | — | **4.5d** | 6 项全过 | 任一不达 → 启动 X 路线的 fallback 决策 |

**S-X 验证前置**：必须先跑通 `dsh web` + `dsh plugin --profile web add weshop-dsh-plugin` + 切换到 weshop-canvas preset 能看见画布和 Chat（hello-plugin 范式）。预计 0.5-1d。

---

## 8. 证据索引（关键 文件:行号）

### weshop 部分

| 主张 | 证据 |
|---|---|
| SplitPanel 同时渲染画布 + 自写 Chat | `weshop/src/client/index.jsx:25-43` |
| CanvasChat 是 weshop 自写 React 组件 | `weshop/src/client/CanvasChat.jsx`（321 行）；不存在 import dsh 内部 ChatView |
| CanvasChat 通过 props 接收 session | `CanvasChat.jsx:190` 签名 `{ session, sessionTitle, selection, locale, onExit }` |
| 消息列表消费 `chat.order + chat.nodes.get` | `CanvasChat.jsx:164-188` |
| 发消息走 `session.prompt` | `CanvasChat.jsx:238` |
| cancel 走 `session.cancel` | `CanvasChat.jsx:307` |
| 审批/问题 UI 走 `wait.respond` | `CanvasChat.jsx:41-58, 138-141` |
| selection→CanvasChat 父子 props 桥 | `index.jsx:26, 39`；`CanvasWorkspace.jsx:278-285` |
| 画布自身 localStorage 状态 + host 端 state.json 双写 | `CanvasWorkspace.jsx:12-22`；`index.js:147-150, 191-203` |
| `createPortal(document.body)` 绕路 z-index | `index.jsx:30-35, 97-109` |
| 三个 Skill 注册 | `index.js:46-77` |
| preset 安装到 `~/.dsh/.agent-presets/weshop-canvas/` | `index.js:79-105` |
| persona MANDATORY 调 weshop-openapi | `agent.cordis.yml:35-43` |
| preset 切换事件订阅 | `index.jsx:218-225`（`ctx.remote.$on('agent-preset/selected', ...)`） |
| canvas HTTP API 路由 + 轮询 800ms | `index.jsx:228-252` |
| tsdown bundle 输出格式 | `tsdown.config.mjs:31-36` |
| `lib/client.js` 是 UI bundle 不是 RPC | 文件大小 430 KB；包结构见 `package.json:36-49` `dsh.client.inject` |

### dsh 部分

| 主张 | 证据 |
|---|---|
| `shell.overlay` 是 list slot, scope root | `dsh/packages/client/ui-layout/src/client/index.ts:83` |
| AppFrame overlayLayer z-index=20 | `dsh/packages/client/ui-layout/src/client/AppFrame.module.css:110-115` |
| AppFrame 渲染点位 | `dsh/packages/client/ui-layout/src/client/AppFrame.tsx:193-195` |
| SessionFace = ISession + ObservableSnapshot | `dsh/packages/client/runtime/src/client/contract/session.ts:89` |
| ISession 动词面（prompt/cancel/updateQueue/...） | `dsh/.../contract/session.ts:30-82` |
| ConversationSnapshot 字段 | `dsh/.../sessions/conversation.ts:433-477` |
| PendingInteraction 联合（approval/question） | `dsh/.../sessions/pending.ts:9-22` |
| PendingWait.respond 签名 | `dsh/.../sessions/pending.ts:73-77` |
| ISessions.binding 拿 SessionBinding | `dsh/.../contract/sessions.ts:129` |
| MuxFrame 联合 | `dsh/.../host/apiproxy/.../events.ts:69-108` |
| approval/requested + question/requested 帧 | `dsh/.../host/apiproxy/.../events.ts:72-75` |
| host/remote-event 白名单转发 | `dsh/.../host/apiproxy/.../events.ts:154` |
| API_REMOTE_FORWARDED_EVENTS（11 个事件） | `dsh/.../api/remotes/.../remote-events.ts:17-29` |
| ui-conversation 不导出 ChatView 子路径 | `dsh/.../ui-conversation/package.json`（仅 `.` + `./invariant`） |
| ui-conversation 注册 conversation 子 slot | `dsh/.../ui-conversation/.../apply.ts:196-256` |

### open-pencil 部分

| 主张 | 证据 |
|---|---|
| ChatPanel 用 `@ai-sdk/vue` 而非 dsh | `open-pencil/src/components/ChatPanel.vue:17-22, 28-37` |
| ChatPanel 通过 `withSelectionContext` 注入素材类型 + 选区 | `open-pencil/src/components/ChatPanel.vue:91-116` |
| useAIChat 返回 Chat<UIMessage> | `open-pencil/src/app/ai/chat/use.ts:113-150` |
| marketing UI 是 Vue reka-ui 对话框 | `open-pencil/src/components/chat/BriefPanelDialog.vue:18-29`；`ProfileGalleryDialog.vue:5-15`；`MarketingConfigBar.vue:3-13` |
| materialTypeSelection/profileSelection 是 Vue ref | `open-pencil/src/components/chat/MarketingConfigBar.vue:11` |

---

## 9. 给 owner 的 1-2 个最关键发现

1. **`SessionFace` 是 plugin 自写 Chat 的免费午餐——weshop CanvasChat 315 行代码没有任何 RPC**。所有消息流、prompt、cancel、审批/问题都通过 `session.subscribe / session.getSnapshot / session.prompt / session.cancel / session.pending[i].respond` 完成，数据通路与 dsh 自家 Chat 完全一致。这意味着**走 X 路线时「聊天流式适配」成本 ≈ 2 人日写 Vue ChatPanel 复用 `SessionFace`**，不需要 6-8 人日写 ws-client/JSON 解析/状态管理（spike 01 §F0.4 的隐含成本被高估）。**但双 Chat 共存 UX 问题（§D2.5）是 weshop 范式没有解决、open-pencil 必须自己定的产品决策**。

2. **weshop 的「host HTTP API + 浏览器轮询 JSONL」模式是为「不属于 session event 的资产发布」发明的**。open-pencil marketing 工作台不走画布资产流，**完全不需要这个模式**——所有 marketing UI 状态变化都通过 dsh wire 的 `session.event` 流（tool/result 包含工具返回）和 `session.pending`（问题/审批）自动到达 browser。这意味着 C5a ConfigBar 集成的实际成本可以再降 0.5-1 人日（不需要 file JSONL 桥），但**配置同步（materialTypeSelection/profileSelection 跨 session 切换保留）仍需经 dsh `settings/document-updated` 通道**——这才是真阻塞点（§D2.4）。
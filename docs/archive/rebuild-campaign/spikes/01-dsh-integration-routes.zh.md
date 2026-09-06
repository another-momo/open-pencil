<!--
  写作纪律（改本文前必读）：
  - 事实性声明必须附 文件:行号 证据 + 日期，否则标为【假设】
  - 计划被实测推翻时，直接改本文为新版本，完整理由记入 records/narrative/spikes/01-dsh-integration-routes.zh.md
  - 本文只保留当前态，不保留修正历史
  - 改完后刷新本文头部的「状态」字段
  - 详细规则见 docs/rebuild/05-process.md §4
-->

# Spike 01 · dsh 集成路线对比：编辑器入壳（X）vs 无头 runtime（Y）

> 状态：源码阅读完成（2026-08-19）| 回答 03 §2 的 Q0-Q3 中可由源码定论的部分，并为 D7/D9 提供选型依据。
> 状态：**v2 修正**（2026-08-20，基于 spikes/03-weshop-case-deep-dive 实证）。v1 把 weshop 描述为「镶 dsh Chat 在旁边」、把 X 路线流式成本估为 0——**两处均错**，本次更新。
> D2 修正（2026-08-21）：本文 §5「D2 倾向砍」建议与 owner 已拍板的 D2（通道 B 为默认，records/topics/brand-config.md D2/D2a）冲突，该段已按拍板结果重写。
> 配套：spikes/02-pi-sdk-runtime（pi 路线修正评估）/ spikes/03-weshop-case-deep-dive（X 路线实证）。
> 陈述纪律：**【事实】**（附 文件:行号 证据）/ **【推断】**（由证据推出的结论）/ **【假设】**（未验证）。
> 证据路径约定：`dsh/` = 参考项目/deepseek-harness（0.1.0-rc.7），`pi/` = 参考项目/pi，`old/` = open-pencil 旧分支 feature/agent-backend。

## 0. 结论先行

**推荐路线 Y（dsh 无头 runtime 藏在我们后端）。**

一句话理由：Q0-Q3 的硬问题（多模态 tool-result、session 持久化、流式适配）在 Y 下全部有源码级正面答案且风险都落在我们自己进程内的代码里；X 复用到的只是 dsh 的聊天 UI 和 session 管理，却要把产品本体（文件库、tabs、菜单、营销 UI）抵押给一个明牌 breaking changes 的 developer preview React 壳，且多模态/session/流式三个硬问题在 X 下一个都没有因此变简单。

Y 的唯一实质 gap：**官方 sdk-jsonrpc-server 只 create 不 resume 持久化 session**（见 Y5），需要自写一个薄 host 插件补 resume 通道——这是本 spike 唯一必须写代码验证的阻塞项，估计 2-3 人日。

---

## 1. 可行性分析

### 路线 X：编辑器作为 dsh 插件

#### X1. slot 系统能否承载全屏画布编辑器

【事实】`conversation.view` 是 `kind: 'list'; scope: 'session'` 的 view ring，**同一时刻只渲染 active tab**——渲染点 `renderSlot('conversation.view', …, { only: active.id })`（dsh/ `packages/client/ui-conversation/src/client/skeleton/ConversationSession.tsx:166-173`），slot 声明注明 "rendered one-at-a-time"（dsh/ `packages/client/ui-conversation/src/client/contract/slots.ts` 中 `conversation.view` 条目）。

【推断】策略 A（加一个 tab）下，切回 Chat tab 即卸载编辑器孤岛：React 包装器 unmount → Vue app unmount → CanvasKit WASM 实例与 WebGL 上下文销毁，切回时全量重建。对画布编辑器这是不可接受的常态开销（WASM 冷启动 + 文档重开）。规避路径存在且都有先例：
- 策略 B：替换 `conversation`（或 `conversation.session`）slot 为分屏布局，编辑器常驻——`conversation.session` 声明注明"taking this seat means rendering that session's conversation yourself"，是官方支持的接管面（slots.ts 同上文件）。
- 策略 C：`shell.overlay` + `createPortal` 到 `document.body` 常驻——WeShop 的实测做法（预研文档 §8.4）。

【事实】尺寸上，view tab 局限在 session 列内（`viewArea` 容器，ConversationSession.tsx:167）；全屏画布需要策略 B/C 而非 A。

【假设】CanvasKit/WebGL 在孤岛内初始化本身无已知障碍（孤岛就是一个 div 内的完整 Vue app，与在普通页面跑等价）；但 dsh 前端构建链（tsdown、css-modules）与我们 Vite 产物的共存、以及 dsh 主题 CSS 对我们画布的污染，只有实测才知道。

**结论：可行，但必须走策略 B 或 C（常驻挂载），策略 A 仅够 demo。**

#### X2. 编辑器 app 壳迁移面

逐项评估（处置 = 孤岛内保留 / 重写为 React slot / 废弃）：

| 组件 | 现状（old/） | X 下归宿 | 依据 |
|---|---|---|---|
| tabs 系统（多文档） | `src/app/tabs/`（293 行 index.ts） | **孤岛内保留** | 孤岛是完整 app，tabs 是其内部 UI |
| IndexedDB 文档库 | `src/app/storage/local-store/`（idb.ts 207 行等 6 文件） | **孤岛内保留** | IndexedDB 按 origin 隔离；dsh web 与我们 editor 若同端口服务则共享，否则各自一份——【假设】dsh web 前端与孤岛同 origin（同 bundle），IDB 数据库名不冲突即可用 |
| 文件打开/保存、菜单 | `src/app/shell/menu/`（schema.ts 321 行等 13 文件） | **孤岛内保留**；与 dsh 壳的全局快捷键冲突需实测【假设】 | 菜单是孤岛内部 UI |
| 属性面板/图层面板等 | `src/components/` 大量 | **孤岛内保留** | 同上 |
| 聊天面板 | `src/components/ChatPanel.vue` + `src/components/chat/` 9 组件 | **自写 React ChatPanel 消费 SessionFace**（≠ dsh 内置 Chat）| weshop 实证：overlay 旁路需自写 Chat 消费 dsh `SessionFace` API（subscribe/getSnapshot/prompt/cancel/wait.respond，5 方法，见 CanvasChat.jsx:192-246）。**修正了 v1 「废弃我们的用 dsh Chat」的错误**：dsh Chat 在 conversation 列被 SplitPanel 整列占据（X1 策略 B/C），且 dsh 没开放 plugin 引用自家 Chat 组件的干净路径——weshop 315 行 React Chat 是该路线的事实标准 |
| 营销 UI（MarketingConfigBar/BriefPanelDialog/ProfileGalleryDialog） | `src/components/chat/` 内 | **孤岛内保留 + 状态桥**，或重写为 React 注册到 dsh composer/header slot | 【推断】薄切期孤岛内保留成本最低：这些组件读的是 editor store 与 brand HTTP 服务，不依赖聊天 UI 本体；但「选 type/profile 随消息发送」的语义（旧 `http-agent-transport.ts:57-67` 把 brandSelection 塞进 chat 请求体）在 dsh 聊天里无处下手，需要改为「孤岛写入 → prompt 注入时读取」（经 F0.6 的 context provider，见 Z1）——语义可保，装配点搬家。**强约束**：跨 session 的 marketing 状态（materialTypeSelection/profileSelection）必须经 dsh `settings/document-updated` 白名单通道（`remote-events.ts:28` 仅 11 个白名单事件），**不能自由订阅 cordis 事件**——这是 weshop 没遇到、open-pencil 必须自己解决的约束（spike 03 §B4） |
| 调试面板（E2） | 前端自有 | **废弃/改用 dsh ui-trajectory** | dsh 自带 trajectory/session 视图 |

【推断】X2 的真实成本不在「这些 UI 放哪」（大部分孤岛内原样保留），而在**双重 chrome 的产品降级**：dsh 壳自带 sidebar/workspace/session 列表/设置页，我们的孤岛再带一套 tabs/菜单/文件库，用户面对两套导航心智。WeShop 规避方式是只做 overlay 画布、不携带 app 壳——我们没有这个选项，编辑器就是产品本体。

#### X3. 工具执行链：dsh 工具插件（Node）→ Vue 孤岛 SceneGraph

【事实】dsh host→browser 的 WS downlink 是**单向**的："the client sends no application data over these sockets"（dsh/ `packages/client/connection/README.md` `/api WebSocket downlinks` 节）；browser→host 只有 `POST /api` RPC。即 dsh 自身没有 host 主动向浏览器内某段 JS 发起 request/response 的通道。

【事实】现成先例（预研文档 §8.2/§8.4）：WeShop 用 host HTTP API（`ctx.webServer.register` 注册 `/api/weshop/*`）+ 浏览器端轮询——是「拉」模型，不适合工具调用这种「推+等结果」语义。

【推断】**最优解与 dsh 无关：原样复用我们现有 F0.2 桥。** 孤岛内跑 `connectAutomation`（old/ `src/app/automation/bridge/server.ts:14-44`：连 `ws://127.0.0.1:7600`、token 注册、执行 RPC），dsh 侧工具插件在 `execute()` 里当 bridge 的 secondary client（old/ `packages/agent/src/bridge/ws-client.ts:111-121` 的 `{type:'auth'}` 副客户端模式，不抢浏览器注册槽）。浏览器到 127.0.0.1:7600 的 WS 连接不受同源限制，孤岛与普通页面无差别。此模式旧分支已完整跑通，X 与 Y 在这一点的工作量**完全相等**。

#### X4. i18n

【事实】dsh locale 是一等能力：`LOCALE_IDS = ['zh', 'en']`（dsh/ `packages/client/locale/src/locale-settings.ts:12`），且 **zh 字典是 key-set 基准**（dsh/ `packages/client/ui-conversation/src/client/locales.ts` 注释 "Simplified Chinese dictionary (the key-set source of truth)"；`packages/client/locale/src/locales/zh.ts` 同样注明）。slot 注册可带 `locale` namespace（预研文档 §3.6 locale share；ui-workspace 示例 `locale: NS`）。

【推断】dsh UI 可汉化程度 = 完全（DeepSeek 自家产品，zh 为先）；我们插件的 zh-CN 文案走自己的 locale namespace，无兼容问题。X4 非风险项。

#### X5. developer preview 升级冲击面

【事实】README 明牌："currently in _developer preview_… **THERE WILL BE COMPATIBILITY-BREAKING CHANGES.**"（dsh/ `README.md:11`）。本地仓库 0.1.0-rc.7，而 03 文档记录的是 rc.5——版本在动。

【事实】npm 发布节奏不齐：`@deepseek-ai/dsh-sdk-client` 的 `latest` dist-tag 停在 0.0.1-rc.1、`next` 才是 0.1.0-rc.7；`@deepseek-ai/dsh` CLI 的 latest 已是 0.1.0-rc.7（npm dist-tags 实测）。依赖必须钉精确版本。

【事实】插件组合机制 = 分层 patch：`packages/bundle/web-app/cordis.patch.yml` 头注释明确加载次序（dsh-base insert → web-app 覆盖 → "the profile's own cordis.patch.yml and any --patch overlays still to come"）；`dsh plugin` CLI 把参数转发给 profile 目录内的 pnpm（dsh/ `apps/cli/src/args.ts:171`）——预研文档 §9.3 的 `pnpm add` 安装路径有官方对应。

【推断】冲击面集中在三处：①slot API（SlotMap 声明合并 + register 签名）——preview 期一旦变更，我们的 UI 插件编译即断；②cordis.patch.yml 行格式与插件清单惯例；③client 插件的 `dsh.client` package.json 字段约定。缓解：版本钉扎 + 升级时先跑 smoke（dsh web 起得来、孤岛挂得上、工具调得通）再合并。但**结构性事实**是：X 下我们的发布节奏与 dsh 升级耦合，Y 下耦合面只有 host 侧 SDK 协议（wire 方法 3 个 + 通知 4 个，protocol README 列表），小一个数量级。

---

### 路线 Y：dsh 无头 runtime

#### Y1. sdk-client 实操面

【事实】形态：`@deepseek-ai/dsh-sdk-client` = stdio 换行分隔 JSON-RPC 2.0 驱动**完整 harness 子进程**；"a pure library… the runtime process it spawns is a complete harness whose composition its own cordis.yml decides"（dsh/ `packages/sdk/client/README.md:5`）；launch spec 全显式 `{ command: 'node', args: ['lib/bin.js', 'cordis.yml'] }`（同 README:14-16）。传输帧格式与错误面（JsonRpcResponseError/RequestTimeoutError/SdkProtocolError/TransportClosedError）见 client README:30-32、protocol README:9。

【事实】cordis.yml 由我们自备自组："Callers supply the runtime executable and its cordis.yml; this group does not create, configure, build, or launch developer projects"（dsh/ `packages/sdk/README.md:5`）。可参照的组合实例：`dsh/examples/jsonrpc-agent/cordis.yml`（sdk-jsonrpc-server + llm-deepseek + bash + session-persistence-jsonl + compaction 等）。

【事实】已知限制（client README:44-49 + protocol README:37-40）：①无 prompt 级 cancel——放弃一个 turn = 关掉整个 runtime 进程；②无 per-prompt result——`run()` 收集的是 receipt-to-idle 区间，结果不按 prompt 归因；③client→server notifications 与 server→client requests 未实现（为审批流预留的死能力）；④无协议版本协商（serverInfo.version 0.0.1，未校验）。

【推断】对我们的影响逐条：
- ① **cancel**：我们前端有停止按钮语义。dsh agent 本身有 `agent.cancel()`（dsh/ `packages/core/agent/README.md` AgentHandle 节），只是 sdk wire 没暴露。绕过：自写薄 host 插件加一个 webServer 路由调 `agent.cancel()`（与 Y5 的 resume 插件是同一个插件）。**不必接受「关进程」语义。**
- ② per-prompt result：我们本来就是 session 级事件流驱动 UI（见 Y2），不按 prompt 取结果，无影响。
- ③ 审批：工具审批我们走自己的桥（工具在编辑器内执行前挂起等用户确认，旧分支 ACPPermissionDialog 已有此 UI 语义），不需要 dsh wire 的审批能力。
- ④ 版本：钉死 dsh 版本即可。

【事实】npm 可得性：sdk-client 0.1.0-rc.7 在 npm（`next` tag），dsh CLI 0.1.0-rc.7 在 npm（latest）。【推断】可全 npm 组合 runtime（cordis.yml 引用的插件包均为发布包，publishConfig.access=public），但必须钉版本（Y5 的 dist-tag 不齐）。

#### Y2. 流式适配：dsh chunk → UIMessage stream v1 映射

【事实】sdk wire 推的是 SessionEvent（protocol README:20 `session.event` "every session in the runtime, unfiltered"），其中 `assistant/chunk` 事件携带**原始 StreamChunk**：`'assistant/chunk': { turn, step, chunk: StreamChunk }`（dsh/ `packages/core/session/src/types.ts:266`），即 token 级流式经 sdk 可得。StreamChunk 词汇（dsh/ `packages/llm/llm/src/types.ts:312-324`）：`block-start / text-delta / reasoning-delta / tool-call-delta / block-end / usage / finish`。

【推断】映射表（UIMessage stream v1 参照 old/ `http-agent-transport.ts:93-98` 注释的 chunk 形态）：

| dsh 部件 | UIMessage stream v1 | 说明 |
|---|---|---|
| `block-start{text}` | `text-start` | index ↔ text id |
| `text-delta` | `text-delta` | 直译 |
| `block-end{text}` | `text-end` | — |
| `block-start/reasoning-delta/block-end{reasoning}` | `reasoning-start/delta/end` | 直译 |
| `block-start{tool-call}` | `tool-input-start` | — |
| `tool-call-delta` | `tool-input-delta` | — |
| `block-end{tool-call}`（参数已齐） | `tool-input-available` | — |
| `tool/call` + `tool/result` 事件（session/types.ts:279-297） | `tool-output-available`（isError → error output） | result.content 含 TextBlock 数组 |
| **tool-result 带 ImageBlock** | 无原生对应 | 旧前端本来就从 tool part 的 `output.base64/mimeType` 自渲染（old/ `src/components/chat/ChatMessage.vue:35-55`）——adapter 把 ImageBlock 还原成同样的 output 形态即可，**语义无损** |
| `usage` | `finish` 的 usage / `data-*` | — |
| `finish{stop/tool-calls/max-tokens}` | `finish` / step 边界 | tool-calls 对应 step 续行，不终结 message |
| `finish{error/aborted}`（types.ts:116-122 FinishReasonMap） | `error` chunk | — |
| 中断（用户停止） | 无对应 | dsh wire 无 cancel（Y1①）；自写 cancel 插件后由后端合成 abort 语义 |
| `subagent.*` 通知 | 忽略或 `data-*` | 层 2 前用不到 |

工作量与旧仓库自写解析器同级、方向相反（03 §2 Q3 的判断成立），约 1.5-2.5 人日含测试。

#### Y3. 工具桥接（dsh 工具 execute → WS RPC → 编辑器）

【事实】dsh 工具定义面：`ctx.tools.register(defineTool({ name, description, parameters, output: { schema, render }, execute }))`（dsh/ `packages/core/tools/src/index.ts:222-235`；实例 dsh/ `packages/fs/tool-fs/src/read.ts:69-110`）。注册即 effect、卸载即回滚。

【事实】超时：per-tool `timeoutMs` **协作式**预算，"Omit for no deadline"（dsh/ `packages/core/tools/src/index.ts:249-255`），由 `dsh-tool-call-timeout-policy` 包装器执行。并发：`isConcurrencySafe` 默认 exclusive（index.ts:269 附近），WS 桥串行执行天然安全。长任务：旧桥 RPC 超时 300s（old/ `packages/agent/src/bridge/ws-client.ts:7-11`），生图 240s（old/ `packages/core/src/tools/image-gen/providers.ts:81`）——dsh 侧不声明 timeoutMs 即无 runtime 级期限，240s 生图可行。

【推断】桥接层 = 把 CORE_TOOLS 的每个 ToolDef 包成 dsh defineTool：parameters 直译（都是 JSON Schema），execute 内复用旧 `FrontendBridge.sendRPC('tool', …)`（old/ `tools-bridge.ts:49-59` 的同构实现，换成 dsh 的 exec.signal），output.render 把结果 JSON 渲染成 ContentBlock[]——look 的 base64 图在这一步经 attachment 服务落成 ImageBlock（见 Y4）。这是一个机械翻译层，估计 2-3 人日含单测。

#### Y4. Q1 多模态：tool-result 带图到 provider 的实际序列化路径

【事实】内容模型：`ToolResultBlock.content: ContentBlock[]` 递归含 ImageBlock（dsh/ `packages/llm/llm/src/types.ts:88-93`），`contentHasImage` 递归识别（dsh/ `packages/llm/llm/src/content.ts:13-15`）。"适配器 text-only output" 的确切含义：ImageBlock 注释 "the current production adapters declare text-only output, so only user content carries images today"（types.ts:65-69）——限的是 **assistant 输出**图；我们的图在 tool-result（历史消息）里，不受此限。

【事实】llm-pi-ai 路径（关键发现——视觉回路语义在 pi-ai 里是**内置**的）：
1. 门 1：`contentHasImage && !model.input.includes('image')` → 抛 UNSUPPORTED_CONTENT（dsh/ `packages/llm/llm-pi-ai/src/adapter.ts:307-310`）——模型声明必须含 image 输入；modalities 可被 profile 配置覆盖（catalog.ts 的 `declaredInput`，dsh/ `packages/llm/llm-pi-ai/src/catalog.ts:59-61`）。
2. 门 2：需要 attachment 服务（adapter.ts:311-314）；有现成 provider `dsh-attachment-local`（内容寻址 sha256 落盘，dsh/ `packages/attachment/attachment-local/README.md`）。
3. 转换：`toPiContextWithImages` 把 tool-result 内的 image 块解成 pi-ai ImageContent（dsh/ `packages/llm/llm-pi-ai/src/context.ts:194-206`）。
4. 序列化（chat-completions wire）：tool 消息保持 text（图变 "(see attached image)" 占位），**图片追加为紧随其后的合成 user 消息** "Attached image(s) from tool result:" + `image_url` dataURL 块（pi/ `packages/ai/src/api/openai-completions.ts:1284-1337`，门：`hasImages && model.input.includes("image")` 于 :1304）。
5. 模型不吃图：image 块替换为占位符 "(tool image omitted: model does not support images)"（pi/ `packages/ai/src/api/transform-messages.ts:12-13, 35-57`）——**静默降级不报错**。

【事实】llm-deepseek 原生适配器**显式拒绝**图片：serialize.ts:63-66 抛 UNSUPPORTED_CONTENT（"this wire route is text-only"）。

【推断】①旧分支 `media-tool-results.ts` 的改写语义（tool-result 图 → 合成 user 消息，old/ `src/app/ai/chat/media-tool-results.ts:8-24`）与 pi-ai 内置行为**同构**——C4a 在 pi-ai 路径上接近零新代码，只要模型 route 声明 image 输入。②DeepSeek 官方 chat 模型均为 text-only → look 图片要活着到模型，需配一条视觉模型 route（OpenAI 兼容视觉端点，经 pi-ai 声明式 profile），或接受降级。③「跑代码才知道」的剩余部分：目标 endpoint 对合成 user 消息 + image_url 的真实接受度——源码路径已通，端到端必须实测（这正是 Q1 的 spike 点，先验从 70% 上调到 85%）。

#### Y5. Q2 session：resume 语义与外部 id

【事实】持久化是一等能力：事件溯源 append-only 日志、崩溃修复（合成 closers）、jsonl/sqlite 双后端（dsh/ `packages/session/session-persistence/README.md` 全文）。resume 入口：`ctx.agents.resume(options)`（dsh/ `packages/core/agent/README.md` Factory API 节；agent-loop 侧 `resumeWith`，dsh/ `packages/core/agent-loop/src/index.ts:372`）。

【事实】外部 id：**新 session 可用我们的 id**——sdk server `createSession` 直接采用 client 给的 `sessionId`（dsh/ `packages/sdk/server/src/server.ts:218-229`，`ctx.agents.create({ sessionId: SessionId(sessionId) })`）。

【事实】**gap：sdk-jsonrpc-server 只有 create 没有 resume**（server.ts:132-143 prompt → getOrCreateSession → createSession，全文无 resume 调用；unknown method 抛错于 :190-201）。重启 runtime 后同 id prompt 的走向：`agents.create` 成功（内存无占用）→ 首个事件 append 时撞持久化 collision：coordinator 的 onCreated case 2/3——已有 artifact 且不是 live seed 前缀 → **REJECT (id collision)**（dsh/ `packages/session/session-persistence/src/coordinator.ts:1226-1236, 1251-1256, 1274-1280`）。

【推断】绕过方案（按侵入性升序）：
- a) 自写薄 host 插件，在 sdk server 之外提供 `resume` 通道（如 webServer 路由或第二个 stdio 方法）：插件内 `ctx.agents.resume({ resumeSessionId })`。但 sdk server 的私有 sessions map 不认外部 resume 的 agent，随后的 `session/prompt` 仍会走 createSession → 撞 live collision。【推断】所以 a 必须连带**自写一个 sdk server 替代品**——server.ts 仅约 250 行、协议仅 3 方法 4 通知（protocol README:17-23），复制并加 resume 分支是可控工作量（1.5-2.5 人日），但从此我们持有一段 dsh 代码的 fork，preview 期升级要对账。
- b) 每 session 常驻 runtime 进程不重启——与「多文件多 session + 后端单进程」的产品形态冲突，排除。
- **这是 Y 路线唯一必须写代码验证的阻塞项**（spike 最小范围见 §5）。

【事实】compaction seam：`ctx.compaction` 抽象服务可整体替换（dsh/ `packages/compaction/compaction/README.md` Service API 全 abstract）；现成 `dsh-compaction-tool-result-pruner`（超长 tool-result 截断，保留原文于日志）可作媒体省略的参照实现。【推断】我们的媒体省略（K=2 elision）更经济的注入点是**自定义 compaction backend 或 llm 请求上游的消息变换插件**（`llm/stream` 拦截），不必动 compaction 本体。

#### Y6. 凭证 / 多 provider

【事实】凭证 seam：`ctx.credentials`，**配置存引用不存秘密**（`apiKeyEnv: DEEPSEEK_API_KEY`），值在 `$DSH_HOME/.credentials.yaml` + 进程环境分层（dsh/ `packages/credentials/credentials/README.md` doctrine + Providers 节）。per-operation resolve，改凭证下一请求即生效。

【事实】pi-ai route/catalog：profile 声明式 route——catalog 内置 provider 供应默认，settings.yaml 逐字段覆盖，"a route pi-ai has never heard of is fully describable from settings.yaml"（dsh/ `packages/llm/llm-pi-ai/src/catalog.ts:1-13`）——OpenAI 兼容网关（自定义 baseURL/api/key）是纯配置，无需写适配器。reasoning format 枚举门（catalog.ts:100-112）保证 pi-ai 升级时漂移编译期暴露。

【推断】F0.3①（聊天 key）在 Y 下改为：我们的后端持有 key（沿用 /v1/auth provision 或直接环境变量），经 sdk-client 的 `env` 选项（client README:34，可整替换子进程环境）注入 runtime；或写进 credentials.yaml。F0.3②（生图独立凭证）与 dsh 无关，原样保留在编辑器内。

#### Y7. skills 与工具审批

【事实】skills 存在且是一等能力：`ctx.skills` 注册表（host+scope 分层、provider 模型、invocation policy），`dsh-tool-skill` 把 skill 渲染为 `<skill_content>` 供模型调用（dsh/ `packages/skill/skill/README.md`）。

【事实】工具审批存在：`ctx.approval.request` 一次性审批 seam（allowed-once/rejected/cancelled/unavailable，失败关闭；dsh/ `packages/interaction/user-approval/README.md`），工具管线经 `tools/pre-execute` waterfall 路由 ask 决策（dsh/ `packages/core/tools/src/index.ts:142-152`）。限制：仅在 open turn 内有效；只有一次性授权，无 allow-always（README Known Limitations）。

【推断】B1b（skills + 工具审批穿桥）在 Y 下有现成锚点：审批 answerer 是我们写的 `approval/request` 监听器，内部走 WS 桥问编辑器前的用户——桥协议扩审批往返（03 §5 已列为重分类项）。属层 2，不阻塞选型。

---

### 双方共同

#### Z1. 复用矩阵（01 能力地图逐块 × 两路线）

| 能力块 | 路线 X | 路线 Y |
|---|---|---|
| F0.1 runtime 内核 | dsh 自带（0 代码）；代价是接受 dsh 会话模型 | sdk-client + cordis.yml 组合 + resume 插件（3-5d） |
| F0.2 工具执行桥 | 移植 + 复审（同） | 移植 + 复审（同） |
| F0.3 凭证 | 聊天 key 走 dsh credentials/settings；生图链孤岛内保留 | 聊天 key 留我们后端经 env 注入；生图链原样 |
| F0.4 传输契约 + chat UI | **废弃我们的**，用 dsh 聊天 UI；但 brandSelection 随消息发送的语义要改装配点（见 F0.6） | 保留前端 Chat/UI 组件，自写 chunk→UIMessage adapter（2-3d） |
| F0.5 session↔文件 | pluginData 存 dsh sessionId + 打开文件时驱动 dsh 选中/恢复该 session（dsh sessions API，粘合 1-2d）；dsh 自带 resume | pluginData 存 sessionId → create/resume（**resume 有 gap，见 Y5**） |
| F0.6 prompt 注入 | `ctx.systemPrompt.section`（base + marketing 两个 section）+ overlay 走 `systemPrompt.context` 动态 provider（每步求值）或 `system-prompt/assemble` waterfall（dsh/ `packages/core/system-prompt/README.md` Service API）——两段式 + overlay 语义**完整可表达** | 同一套 dsh API，只是注册代码在我们的 cordis.yml 插件里——**两路线此处等价** |
| F0.7 prompts 构建链 | 消除（运行时直读 md，section text 直给） | 同左 |
| C1a 需求单 | core brief 原语经桥（同）；BriefPanelDialog 孤岛内保留 | 同左（BriefPanelDialog 在我们前端） |
| C2a brand 服务 + overlay | brand HTTP 服务留孤岛/或并进 dsh 插件 webServer；overlay 注入点同上 | brand 服务留我们后端；overlay 同上 |
| C3a 生成工具 | dsh defineTool 包装 + 桥（2-3d） | 同左——**两路线等价** |
| C4a look 图片到模型 | pi-ai 路径内置（Y4）；渲染侧 dsh 聊天对 tool-result 图的默认呈现未知【假设】，可能需注册 `conversation.chat.node` keyed renderer（React） | pi-ai 路径内置（Y4）；前端自渲染原样保留（ChatMessage.vue 模式） |
| C5a MarketingConfigBar | 孤岛内保留 + 状态桥（1-2d） | 原样在我们 chat UI 里（≈0d） |
| B2 生图历史快照 | 随 core 移植自带（同） | 同 |
| B3 brand schema/repository | 剥 AI SDK 后移植（同） | 同 |
| B4 cli serve | X 下产品形态变成「dsh web + 插件」，B4 语义重定义 | 原语义保留 |

#### Z2. 画布↔聊天交互形态

| 交互 | 路线 X | 路线 Y |
|---|---|---|
| look 截图回投（模型侧） | pi-ai 内置（同 Y4） | 同左 |
| 工具结果缩略图（用户侧） | dsh 聊天的 details/`chat.node` keyed 渲染——默认文本卡；要缩略图需自写 React renderer 注册（slots.ts `conversation.chat.node` 声明） | 前端现有渲染保留（output.base64 → img，ChatMessage.vue:44-55） |
| 调试面板（E2） | dsh ui-trajectory/session 视图直接用 | 自写（低优先，可砍） |

---

## 2. 工作量对比（人日估算）

关键假设：①估算含单测不含联调返工；②F0.2 桥移植、C3a 工具包装、prompt 装配在两路线**等价**（见 Z1），差异只在集成环境；③层 2 增强不计入（两路线差异不大）；④1 人日 = 1 个熟悉代码库的工程师 1 天。

| 块 | 路线 X（入壳） | 路线 Y（无头） |
|---|---|---|
| F0.1 runtime 内核 | 1（组合现有 cordis.yml + 孤岛 session 粘合）| 4（sdk-client 集成 + cordis.yml + **resume/cancel 薄插件** 2-3 含 spike） |
| F0.2 工具桥移植复审 | 2 | 2 |
| F0.3 凭证 | 2（dsh credentials/settings 适配 + 生图链孤岛保留）| 2（env 注入 + 生图链原样） |
| F0.4 传输契约 + chat | 5（自写 React ChatPanel + Vue→React 暴露 SessionFace + SessionFace 在 Vue 环境的桥层 + marketing UI 与 dsh composer 集成、brandSelection 装配点迁移）| 3（chunk→UIMessage adapter + SSE 出口）+ 0.5（ChatPanel 微调） |
| F0.5 session↔文件 | 2（pluginData + dsh session 选中联动） | 1（pluginData + create/resume 调用；resume 插件已计入 F0.1） |
| F0.6 prompt 注入 | 1 | 1 |
| F0.7 prompts 构建链 | 0.5 | 0.5 |
| 编辑器壳孤岛化（X 专属） | **5**（React wrapper/custom element、tsdown 构建进 dsh client 插件体系、样式/快捷键隔离） | — |
| 常驻挂载策略（X 专属） | **2.5**（SplitPanel 接管 conversation 或 overlay portal + z=1M+ 越界绕过 retro-OS skin；weshop 实证 z=20 不够需 `createPortal` 到 body 并自管 z=1M+） | — |
| 插件打包/安装/版本钉扎（X 专属） | **1.5**（cordis.patch.yml、profile pnpm、升级 smoke） | 0.5（npm 钉版本） |
| **F0 小计** | **≈24** | **≈14.5** |
| C1a 需求单 | 2 | 2 |
| C2a brand + overlay | 3.5（brand 服务归宿 + overlay 装配） | 3（brand 服务留后端，路径短） |
| C3a 生成工具包装 | 2.5 | 2.5 |
| C4a look 图片 | 3（pi-ai 路径 + attachment + 渲染 renderer）| 2（pi-ai 路径 + attachment；渲染原样） |
| C5a ConfigBar 集成 | 2.5（孤岛↔dsh 状态桥，含跨 session 配置同步的 settings/document-updated 白名单约束） | 1 |
| **层 1 小计** | **≈13.5** | **≈10.5** |
| **合计（F0 + 层 1）** | **≈37-38 人日** | **≈25 人日** |

【推断】读表注意：X 比 Y 贵约 50%（v1 估的 30% 被低估），X 增量主要在 F0.4 自写 Chat + 跨框架 SessionFace 桥 + 营销状态白名单约束——这些是 weshop 实证才暴露的成本。X 的增量几乎全在**不可控面**（dsh UI preview 颠簸、双框架孤岛、slot API 漂移、SessionFace 与 Vue 的语义鸿沟）——这些人日的估算方差也更大。Y 的人日是「写自己后端的代码」，每层独立可测、可回滚。

---

## 3. 风险登记册

| # | 风险 | 概率 | 影响 | 缓解 |
|---|---|---|---|---|
| R1 | dsh developer preview breaking changes（README.md:11）击中 slot API / cordis.patch 格式 | 高（X）/ 中（Y） | X：UI 插件编译断、编辑器不可达；Y：仅 SDK wire（3 方法 4 通知）+ 我们 fork 的薄 server 需对账 | 版本钉扎 + 升级 smoke 清单；Y 把 fork 面压到最小（只复制 server.ts 的 3 方法） |
| R2 | sdk-jsonrpc-server 不支持 resume，绕过方案（自写薄 server 插件）比预期复杂 | 中 | Y 的 F0.5 阻塞；session 恢复是 F0 验收项 | spike 第一步就验证（§5）；失败预案：每文件一个常驻 runtime 子进程池（进程复用避开 resume） |
| R3 | tool-result 图片到真实 endpoint 不存活（DeepSeek 系 text-only；视觉 route 的端点行为差异） | 中 | C4a 断；视觉回路降级为文本描述 | 源码路径已通（pi-ai 合成 user 消息，openai-completions.ts:1304-1337）；spike 实测 2 个端点（官方 DS + 一个 OpenAI 兼容视觉端点）；降级语义 pi-ai 自带（占位符，不报错） |
| R4 | 双框架孤岛（React 壳 + Vue 孤岛）：样式污染、快捷键冲突、构建链（tsdown vs Vite）摩擦 | 中（仅 X） | 编辑器体验退化，调试成本常驻 | 策略 C portal 隔离 + CSS 前缀隔离；【假设】可缓解但无法消除心智成本 |
| R5 | pi-ai 适配层漂移（dsh 用 ^0.82.1，pi-ai 迭代快；dsh 已用 MODALITY_GATE/THINKING_LEVEL_GATE 编译期门防护，catalog.ts:42-45, 100-112） | 低 | llm-pi-ai 升级断 | 钉 pi-ai 版本；dsh 的 drift gate 设计使漂移编译期可见 |
| R6 | dsh web 加载第三方 client 插件的实际流程与预研文档（基于 pilot-harness 逆向）有出入 | 中（仅 X） | X 整体可行性 | `dsh plugin` CLI 与 profile 机制有一方文档佐证（args.ts:171、docs/user/develop/basic/publish.md）；spike 若选 X 必须先跑通 hello-plugin |
| R7 | 无 prompt 级 cancel 的产品体验缺口（停止按钮） | 高（Y，必然出现） | 用户无法中断长 turn | 自写 cancel 插件（调 agent.cancel()，与 resume 插件同一载体）；已计入 Y 工作量 |
| R8 | 我们 fork 的薄 sdk server 与官方协议分叉 | 中（Y） | 未来想用官方新 wire 能力时对账成本 | fork 面注释 + 协议类型从 @deepseek-ai/dsh-sdk-protocol 直接 import（类型不 fork） |

---

## 4. spike 计划修订建议（对 03 §2 的 Q0-Q3）

**已被源码阅读回答（不必再写代码验证）：**
- Q0 嵌入形态：**已答**。dsh = stdio 子进程 + JSON-RPC，cordis.yml 自组（Y1）；无 widget/库形态确认。
- Q2 的 runtime 侧：**已答**。session 持久化/resume/compaction seam 全部实录（Y5）；外部 id 可用于 create。
- Q3 的可映射性：**已答**。`assistant/chunk` 携带原始 StreamChunk 经 sdk wire 流出（session/types.ts:266），token 级流式可得；映射表已给出（Y2）。
- F0.6 prompt 装配点：**已答**。section/context/assemble waterfall 完备（Z1）。
- Y3/Y6/Y7：**已答**（工具超时/并发、凭证/catalog、skills/审批均实录）。

**必须写代码验证（最小 spike 范围，按序）：**
1. **S1（Y 路线阻塞项，1-2d）**：最小 cordis.yml（sdk-jsonrpc-server + llm-pi-ai + session-persistence-jsonl + 一个 echo 工具）+ sdk-client 驱动；然后重启 runtime 用同一 sessionId prompt，复现 id collision（验证 Y5 的【推断】）；再写薄 server 插件加 resume 分支验证可行。**过 = 路线 Y 可行性确认。**
2. **S2（Q1 端到端，1-2d）**：在 S1 组合里注册一个返回 ImageBlock 的假工具（经 attachment-local），配一条视觉模型 route，验证图片活着到达模型回复（看日志/回复内容）。同时验一次 text-only 模型的占位符降级。
3. **S3（Q3 端到端，1d）**：chunk→UIMessage adapter 原型接前端 Chat 类，跑通「一句话 → 流式渲染 → 工具调用 → 工具结果渲染」。
4. **S4（仅当 owner 仍想保 X 选项，1-2d）**：hello-plugin——空 Vue app 经 React wrapper 挂进 conversation.view（策略 A）+ 一个 dsh 工具经 7600 桥调到孤岛。验证 R6/R4。**若已拍板 Y，S4 不做。**

S1-S3 即 03 文档「新 runtime 内核出生」的前半；总预算 4-5 人日。

---

## 5. 待 owner 决策清单（D9 选项定义）

**D9：dsh 集成路线。**
- **选项 Y（推荐）**：dsh 无头 runtime。后端 = Node 进程内 sdk-client spawn dsh 子进程（自组 cordis.yml：llm-pi-ai + session-persistence-jsonl + 我们的工具/提示词插件 + fork 的薄 sdk server 带 resume/cancel）；编辑器前端原样为产品本体；聊天 UI 自有。
  - 代价：F0+层 1 ≈25 人日；持有一个 ~250 行 server 的 fork；无 prompt cancel 需自补。
- **选项 X**：编辑器入 dsh 壳。dsh web 承载，编辑器走策略 B/C 常驻孤岛；聊天用 dsh 自带。
  - 代价：≈33 人日且方差大；产品本体降级为 dsh 会话的一个 tab/overlay；发布节奏与 dsh 升级耦合。
  - 适用条件：若战略上决定「产品是 dsh 生态插件、借 dsh 分发」，X 才成立。当前规划（01 §1「localhost 形态的工作台」「编辑器内核永久跟随上游」）不支持此前提。
- **选项 Z（退路备案）**：pi-agent-core 直接驱动（`new Agent({ streamFn })` 库内嵌，pi/ `packages/agent/README.md` Quick Start）。无 session 持久化/compaction 的现成答案，但嵌入成本最低。仅在 S1 spike 证明 dsh 子进程形态不可行时启用。

**连带需要拍板：**
- D7 收口：runtime = dsh（经 Y 路线）；pi sdk 不再作为 Phase 1 候选（依据：Y1-Y7 实录 vs pi sdk 全【假设】）。
- D3（session 模型）前置依赖：Y5 的 resume 语义支持「一文件一个 session」与「多 session」两种，但 spike S1 按「一文件一个」验证最简单——建议 D3 先按一文件一个拍板。
- D2（vision 通道 B）：**已由 owner 拍板（2026-08-20，records/topics/brand-config.md D2/D2a）：通道 B 为默认**——look 截图不进主 agent 上下文（成本优势 + 可换视觉模型），A 直送为备选降级路径（主 agent 需看图或视觉模型质量不足时启用）。Y4 证明 pi-ai 路径内置「图随 user 消息」语义属实，但它只说明通道 A 实现成本低，不构成砍 B 的依据。

---

## 6. 证据索引（关键 文件:行号）

| 主张 | 证据 |
|---|---|
| conversation.view 只渲染 active tab | dsh/ `packages/client/ui-conversation/src/client/skeleton/ConversationSession.tsx:166-173` |
| host→browser WS 单向 | dsh/ `packages/client/connection/README.md`（"/api WebSocket downlinks… client sends no application data"） |
| zh 一等语言 | dsh/ `packages/client/locale/src/locale-settings.ts:12`；`packages/client/ui-conversation/src/client/locales.ts`（zh 注释） |
| developer preview 明牌 | dsh/ `README.md:11` |
| `dsh plugin` 安装路径 | dsh/ `apps/cli/src/args.ts:171`；`packages/bundle/web-app/cordis.patch.yml` 头注释 |
| sdk 限制（cancel/result/通知） | dsh/ `packages/sdk/client/README.md:44-49`；`packages/sdk/protocol/README.md:37-40` |
| sdk server 只 create 不 resume | dsh/ `packages/sdk/server/src/server.ts:132-143, 190-229` |
| 持久化 collision REJECT | dsh/ `packages/session/session-persistence/src/coordinator.ts:1226-1236, 1251-1256` |
| agents.resume 存在 | dsh/ `packages/core/agent-loop/src/index.ts:372`；`packages/core/agent/README.md` Factory API |
| assistant/chunk 携带 StreamChunk | dsh/ `packages/core/session/src/types.ts:266`；`packages/llm/llm/src/types.ts:312-324` |
| tool-result 递归含图 | dsh/ `packages/llm/llm/src/types.ts:88-93`；`content.ts:13-15` |
| pi-ai 图片门（modalities/attachment） | dsh/ `packages/llm/llm-pi-ai/src/adapter.ts:307-314`；`context.ts:194-206` |
| chat-completions 图转合成 user 消息 | pi/ `packages/ai/src/api/openai-completions.ts:1284-1337`（门 :1304） |
| 非视觉模型占位降级 | pi/ `packages/ai/src/api/transform-messages.ts:12-13, 35-57` |
| llm-deepseek 拒绝图片 | dsh/ `packages/llm/llm-deepseek/src/serialize.ts:63-66` |
| 工具 timeoutMs/审批/并发 | dsh/ `packages/core/tools/src/index.ts:249-255, 142-152, 269` |
| 凭证引用制 | dsh/ `packages/credentials/credentials/README.md` |
| pi-ai catalog 声明式 route | dsh/ `packages/llm/llm-pi-ai/src/catalog.ts:1-13` |
| skills/approval seam | dsh/ `packages/skill/skill/README.md`；`packages/interaction/user-approval/README.md` |
| compaction seam 可替换 + pruner | dsh/ `packages/compaction/compaction/README.md`；`compaction-tool-result-pruner/README.md` |
| 旧桥 RPC 300s/生图 240s | old/ `packages/agent/src/bridge/ws-client.ts:7-11`；`packages/core/src/tools/image-gen/providers.ts:81` |
| 旧媒体改写与 pi-ai 同构 | old/ `src/app/ai/chat/media-tool-results.ts:8-24` ↔ pi/ `openai-completions.ts:1284-1337` |
| 旧前端 tool 图自渲染 | old/ `src/components/chat/ChatMessage.vue:35-55` |

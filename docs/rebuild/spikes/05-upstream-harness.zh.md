<!--
  写作纪律（改本文前必读）：
  - 事实性声明必须附核验命令 + 日期，否则标为【假设】
  - 计划被实测推翻时，直接改本文为新版本，完整理由记入 records/ 子文档
  - 本文只保留当前态，不保留修正历史
  - 改完后刷新本文头部的「状态」字段
  - 详细规则见 docs/rebuild/05-process.md §4
-->

# Spike 05 · 上游 harness 产品化核查与「harness 路线」终态推演

> 状态：源码阅读完成（2026-08-21，T10 合并后实读 merged 代码 + subagent 深读核对）| 路线状态：**harness 路线暂时搁置**（D21，2026-08-21 owner 拍板，records/topics/agent-runtime.md）——本文作为核查档案保留，S-pi 按直用 pi SDK 形态执行，本文 §5 选项 B/C 比较与 §6 走读参照仍有效。
> 陈述纪律：**【事实】**（附 文件:行号 证据）/ **【推断】**（由证据推出）/ **【假设】**（未验证）。
> 证据路径约定：不带前缀的路径 = 本仓库（upstream/master@5201404f 已合入）；`pi/` = 参考项目/pi。
> 缘起：T10 合并发现上游把 pi 产品化为 harness（PR #560/#561，SP-6）；owner 指示此线单独立档，不并入 spike 02。

---

## 0. 结论先行

**上游 harness 与我们「本地 CLI 后端 + localhost webUI」目标形态天然同构，是 D9 的强正面证据，并催生 D9 内的新子问题：直用 pi SDK vs 复用 harness 抽象。** 上游 sidecar 层的存在理由是 Tauri webview 跑不了 Node——我们的 CLI 后端本身就是 Node，该层整个内化消失，三进程变两进程。抽象的代价：session 树形/branch 等 pi 专有能力被 HarnessV1 接口遮蔽（§3），自定义工具注册面收窄为 MCP（有 extensionFactories 逃生舱，§4）。

## 1. 上游 harness 是什么

【事实】**定位**：可选伴生 coding-agent 面（PR #561 标题即 "ship Harness as optional companion"），与 ACP 并列的第三条 agent 路径；设置面只能绑 design role（`src/app/ai/models/runtime.ts:68-72`），provider 名 'Pi'（`packages/core/src/constants.ts:212-223`）。**不是**冲通用设计工具 runtime 去的。

【事实】**三进程架构**：

```
[Tauri webview 前端]                        进程 1：浏览器环境
   │ HarnessChatTransport，JSONL over stdio
   ▼
[openpencil-harness sidecar（Node）]        进程 2：pi 以库形态跑在此进程内
   │ pi 作为 MCP client 经 HTTP 连
   ▼
[openpencil-mcp-http（127.0.0.1:7600）]     进程 3：编辑器设计工具经 MCP 暴露
```

- sidecar 由前端经 `@tauri-apps/plugin-shell` spawn（`src/app/ai/harness/process.ts:20`）；分发形态在 #561 从 Tauri bundle 改为**用户全局 `npm i -g @open-pencil/harness`**，动机是「不给不启用者 bundle JS runtime」（AGENTS.md 新增纪律原文 "Do not bundle a JavaScript runtime into Tauri"）
- **pi 本体是 npm 依赖，非外部二进制**：`@ai-sdk/harness-pi@1.0.76`（Vercel 官方包）依赖 `@earendil-works/pi-coding-agent`，bundle 内调 `createAgentSession` / `SessionManager.open`；其类型定义自述 "Pi runs as an in-process Node library (no bridge)"（`@ai-sdk/harness-pi/dist/index.d.ts:35`）

【事实】**模块**（`packages/harness/`，约 700 行）：`protocol.ts`（JSONL 线协议：7 方法 :32-47，6 种 turn 事件 :49-55，限额单行 1MB / prompt 256KB :61-62）；`backends/types.ts`（`HarnessBackend`/`BackendSession` 抽象）；`backends/pi.ts`（pi 适配器）；`service.ts`（session Map、turn 互斥 :52、AbortController cancel :53-57、stop 持久化 :71-76、shutdown 全量保存 :85-98）；`session-store.ts`（`~/.open-pencil/harness-sessions/*.json`，tmp+rename 原子写 :66-73、0o600、sessionId 白名单防路径穿越 :8）；`stdio.ts`（sidecar 入口）。

【事实】**session 恢复的两个实际缺口**：(a) 应用侧从不发 `session.stop`（transport 只发 cancel :109 与 destroy :150），而 destroy 会 `store.remove` 删状态（`service.ts:78-83`）——只有「app 退出 → sidecar 收到 stdin close/SIGTERM」一条路径会持久化，**跨重启恢复在上游产品里实际难触发**；(b) 能力声明 `sessionResume: 'live-process'`（`pi.ts:126`）+ just-bash 内存工作区重启不可重挂——恢复的只有对话历史。

【事实】**平台约束**：`isConfigured = IS_TAURI && key 已配置`（`src/app/ai/chat/storage.ts:43`）——**web 端恒不可用**；设置面有 thinkingLevel/permissionMode 两个 harness 专属开关（`ProfileEditor.vue:448-471`，默认 medium/allow-edits，`models/store.ts:330-331`）。

【事实】**MCP 接入**：`buildPiMCPServers()`（`src/app/integrations/mcp/pi.ts:31-51`）= 固定的 open-pencil 条目（7600，bearer 从凭证管理器解析，:15-29）+ 用户配置的外部 server，经 JSONL `session.create` 配置传给 sidecar，由 `pi-mcp-adapter` 桥成 pi 工具。

## 2. 与我们目标形态的同构性

【事实】我们的架构前提（01 §1 已实测）：工具定义在 core、经桥在编辑器内执行，**agent 后端不碰 SceneGraph**；F0.2 的三进程桥（agent 后端 + MCP 桥 7600 + vite dev）与上游 harness 的工具路径是同一形态。

【推断】**终态两进程**（上游 sidecar 层内化消失）：

```
┌ 浏览器 webUI（localhost）──────────────────┐
│ 上游编辑器内核（scene graph 在浏览器）      │
│ 自写 Vue chat UI（F0.4）                   │
└──┬───────────────────────────▲─────────────┘
   │ HTTP + SSE（UIMessage v1） │ 工具桥（F0.2，port 7600）
┌──▼───────────────────────────┴─────────────┐
│ CLI 后端（单 Node 进程）                    │
│  · harness service 层内嵌（非子进程）       │
│  · pi 库形态（npm 依赖）                    │
│  · 视觉侧信道（D2 通道 B）/ 凭证双链（F0.3）│
└─────────────────────────────────────────────┘
```

【推断】上游的 IS_TAURI 硬门对我们不构成限制：pi 永远在 CLI 后端，浏览器只是 localhost 客户端，无 webview 沙箱约束。「浏览器宿主必须有 Node 后端/伴生进程」这一前提被上游架构反向佐证。

## 3. backend-neutral 抽象：红利与天花板

【事实】全部上层（协议/service/存储/transport/UI）写在 `HarnessBackend` 接口上（`backends/types.ts`）：`createSession → BackendSession{runTurn/stop/destroy}` + 仅 6 种通用事件；`HarnessResumeState` 为不透明 JSON（`specificationVersion: 'harness-v1'`——Vercel 的公开规范版本号）；`backends/` 是可扩展枚举（入口 `stdio.ts:17-22` 以 `Map<backend.id, backend>` 组织，现仅 pi 一个实现）。

【推断】**红利**：换 runtime（Claude Code/Codex/新玩家）只需新写 adapter，session 管理/持久化/传输/UI 不动；adapter 可来自生态（规范公开），且上游持续改进 harness 我们有合并红利（T10 已选择保留该包）。

【推断】**天花板**（同一抽象的反面）：接口取各家 runtime 最小公约数——prompt 纯 string（上游 transport 只取末条 user 文本、图像附件直接丢弃，`transport.ts:90-95`）、事件六种、resume 不透明。**被遮蔽的仅是 pi 的树形分叉能力**（`branch`/`branchWithSummary`/`createBranchedSession`/树遍历——需要构造指向中间节点的 resume state，blob 不透明故无法模拟）。注意区分：**一文件多 session 与 session 列表不受遮蔽影响**——sessionId 由调用方自定（上游用 `tab-${tabId}-${profileId}`），文件↔多 sessionId 的绑定与注册表是自有层（F0.5 pluginData / CLI 后端索引）的事，不依赖 `SessionManager.listAll`；受限的只是「单个 session 内部不能分叉」，即每条 session 退化为线性历史。

【推断】**判据收敛**：D3 的要害问题由此收敛为一个——**「回到上一轮分叉重问」这类树形交互是不是产品卖点**（一文件多 session 在两条路线下都成立，不构成区分项）。要分叉 → 直用 SDK；分叉只是层 2 锦上添花 → harness 抽象的维护红利实打实。此判据即修订后 S-pi-1 比较子项的核心实测目标。

## 4. 工具面真相：不是「只能 MCP」但注册面收窄

【事实】经上游包现状接线，工具面 = sandbox 内置 coding 工具 + MCP：`PI_BUILTIN_TOOLS` = read/write/edit/bash/grep/glob/ls 七件（`harness-pi/dist/index.d.ts`，对 sandbox 执行）；`createPi()` 配置面仅 auth/model/thinkingLevel/agentDir/mcpServers/extensionFactories（同文件 :34-69），上游 `backends/pi.ts:150-157` 未传 extensionFactories，协议层 `session.create` 也无工具字段。

【事实】**逃生舱**：`extensionFactories`（"Trusted inline Pi extensions loaded for each harness session"）——pi extension 有一等 `pi.registerTool()`（pi/ `packages/coding-agent/docs/extensions.md:10,1347`），inline extension 可在进程内注册自定义工具，等价于直用 SDK 的 customTools。经 `@ai-sdk/harness-pi` 直接用（不经上游包协议层）即可拿到。【假设】此路径未经实测（harness-pi 1.0.76 的行为以 spike 实测为准）。

【事实】**just-bash 不是进程容器**：纯 TS 虚拟 bash + 内存文件系统（其 README：「A virtual bash environment with an in-memory filesystem」），`createJustBashSandbox({ cwd: '/workspace' })` 仅作为 `HarnessAgent` 的 sandbox provider（`pi.ts:158`）——只套住 coding 工具的执行环境，pi 进程本体无沙箱。设计工具不经此路径。

【推断】**真正的问题被改述**：scene graph 在浏览器（01 §1），即使 in-process 注册工具，execute 在 CLI 后端进程仍须跨回浏览器——所以选择不是「能不能注册工具」，而是「**工具桥协议选 MCP 还是自有 WS RPC**」。MCP = 上游实证、标准化、与 F0.2 同桥；自有 WS = 富类型/大对象自由、自维护。走上游包即默认 MCP（F0.2 收敛到 MCP 形态）；保留自有 WS 则需选项 B（extensionFactories）或 C（直用 SDK）。

## 5. 终态依赖三选项（D9 内新子问题）

| 选项 | 内容 | 利 | 弊 |
|---|---|---|---|
| A | 依赖 `@open-pencil/harness` 包（import 其 service/backend/store，跳过 stdio/protocol 壳） | 合并红利最大 | 与上游产品节奏耦合；协议层含我们用不到的 stdio 面 |
| B | 依赖 `@ai-sdk/harness` + `harness-pi`（Vercel 维护），自写 ~300-400 行 service 层（参照上游 `service.ts`） | 薄、稳、backend-neutral、可拿 extensionFactories | service 层自维护 |
| C | 绕过 harness 抽象，直用 pi SDK（spike 02 原形态） | 全量 SessionManager 能力（树/branch/listAll）、工具面最自由 | 无抽象红利，全自写 |

【推断】无论哪项，不变的部分：传输契约 UIMessage v1 over SSE（F0.4）、MCP 工具桥（F0.2）、凭证双链（F0.3）、session↔文件绑定（F0.5）、通道 B 视觉侧信道（D2）。上游 `mapPart`（`pi.ts:62-89`）+ `mapEvent`（`transport.ts:28-62`）合计约 120 行，是「harness event → UIMessage chunk」映射的产线参照。

## 6. 对 S-pi 验证清单的影响（喂给 T11-plan 重写）

- **S-pi-1 瘦身**：「pi 库形态在 Node 可行」已被上游在产实证，不再需证明；聚焦直用 SDK + customTools/defineTool 的 DX 与事件流（上游未走此路，全走 MCP 桥）+ Windows npm install 实测（R-pi-8）+ **新增比较子项：直用 SDK vs harness 抽象（选项 A/B/C），判据见 §3**
- **S-pi-2 按 D2 重写**（spike 02 §6 已改）：通道 B pi 侧为轻量主线；通道 A 降时间盒备选探测
- **S-pi-3 改形式**：对话态跨进程恢复已被上游产品化实证；降为走读 + 直用 SDK `SessionManager.open` 轻量实测 + 吸收 stop/destroy 时机教训（§1 缺口）
- **S-pi-4 改形式**：映射逻辑有产线参照（§5），spike 只实做增量——UIMessage chunk → SSE 序列化段 + 前端旧 Chat 类消费（上游用 AI SDK v6 Chat，帮不了这一段）

## 7. 证据索引

- 核查命令：`git show upstream/master:src/app/ai/chat/transports.ts`（createActiveHarnessTransport :150-177）；实读 `packages/harness/src/*`、`src/app/ai/harness/*`、`packages/harness/node_modules/@ai-sdk/harness-pi/dist/index.d.ts`（2026-08-21）
- 上游 PR：`git log -1 --format=%B 83a5ea1b`（#560 sidecar foundation）/ `62ba072b`（#561 optional companion）
- 关联：[spike 02 §6](02-pi-sdk-runtime.zh.md)（S-pi 清单真源）、[records/topics/agent-runtime.md SP-6 / D9 / D20](../records/topics/agent-runtime.md)、[records/topics/brand-config.md D2/D2a](../records/topics/brand-config.md)、[01 §1 架构前提 / §2 F0.2](../01-target-state.md)

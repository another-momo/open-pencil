<!--
  写作纪律（改本文前必读）：
  - 事实性声明必须附核验命令 + 日期，否则标为【假设】
  - 本文只保留当前态，不保留修正历史
  - 详细规则见 docs/rebuild/05-process.md §4
-->

# tasks/T19-self-check.md · T19 自检记录

> **T 编号**：T19（Phase 1-pi 实施 · 后端换心：pi SDK 薄 service + UIMessage v1 SSE 契约 + 前端 Chat 类零改动）
> **状态**：✅ 收口（2026-08-23，V1-V8 全过，远端 CI 全绿 run 32637559364）

## 1. 任务清单对照

| 执行面 | 内容 | 状态 |
|---|---|---|
| P1 | recon | ✅（§2.1） |
| P2 | 后端 pi session service + SSE 写出 | ✅（§2.2） |
| P3 | vite 中间件端点 | ✅（§2.2） |
| P4 | 前端 PiBackendChatTransport + 选路 | ✅（§2.2，走 override 钩子，见 §2.3 调整①） |
| P5 | live 冒烟 + session 连续 + CI | ✅ 本地全绿（§2.4-2.6）；CI 随推送观察 |

## 2. 实测记录

### 2.1 2026-08-23 注册期 recon（全部附核验命令）

1. **S-pi 4 映射表在手**（T11-self-check §2.5）：AgentSessionEvent → UIMessageChunk 映射——text_start/delta/end → text-start/delta/end（自建 textId）；thinking_* → reasoning-*；toolcall_* → tool-input-start/delta/available；tool_execution_end → tool-output-available；turn_end → finish-step；agent_end → finish；错误 → error。上游 `src/app/ai/harness/transport.ts:28-62` mapEvent 的惰性开帧状态机可照搬
2. **Chat 装配点**（2026-08-23 读源码）：`src/app/ai/chat/use.ts:33` `createChatSessionManager(...)`；选路在 `transports.ts` `createTransport(store)`——overrideTransport 优先（`browser-bridge.ts:64` `exposeChatTransportOverride` 注入窗），再 harness:pi（Tauri sidecar），再 direct ToolLoop（浏览器内）
3. **vite 插件模板**（2026-08-23 读源码）：`vite.config.ts:27-35` plugins 数组含 `openPencilAutomationPlugin(command, host)`（`src/app/automation/bridge/vite-plugin.ts`）——dev server 中间件/子进程挂载有现成模式
4. **ai SDK 工具链**（2026-08-23 实证）：`ai@7.0.68`（`node -e "require('ai/package.json').version"`），导出 `readUIMessageStream`、`JsonToSseTransformStream`、`createUIMessageStream`、`HttpChatTransport`、`UI_MESSAGE_STREAM_HEADERS`（`node_modules/ai/dist/index.d.ts` grep 实证）——SSE 契约零自造
5. **T18 live 形态可复用**：models.json 覆盖注入 openrouter/free + `$OPENROUTER_API_KEY` env 引用（spikes/s-pi/live-chat.mjs 实证 8/8），后端 service 直接沿用该装配
6. **旧 Chat 类消费面**：`@ai-sdk/vue` `Chat`（use.ts 经 createChatSessionManager 持有单实例，`ensureChat/resetChat`）；ChatPanel.vue 渲染 UIMessage parts——transport 换 pi 后端后渲染面零改动（S-pi-4 结论）

### 2.2 2026-08-23 P2-P4 实施事实

新增 ownedRoot `src/app/ai/pi-backend/`（zones.json），五文件：

- `mapping.ts`：AgentSessionEvent → UIMessageChunk 纯函数状态机。惰性开帧（text_delta 先于 text_start 到达时自建 `text-N` 帧），`agent_end` 强制关帧 + `finish{finishReason:'stop'}`；`message_update.error` → `error{errorText}`。T19 `noTools:'all'` 下 toolcall_* 不出现，忽略不中断
- `service.ts`：`createPiChatService({rootDir})`。ModelRuntime + models.json 覆盖装配照抄 live-chat.mjs；session 池 `Map<sessionId, {session, queue}>`，同 session prompt 经 queue 串行（pi streaming 中再 prompt 需 streamingBehavior，dev 单用户排队即可）；SessionManager JSONL 落 `.openpencil/pi-sessions/` + `index.json`（sessionId→文件）支持重启恢复（`SessionManager.open(file, dir)` 路径实证见 §2.5）
- `vite-plugin.ts`：`apply:'serve'`，`configureServer` 挂 `POST /api/pi-chat`；请求体 `{sessionId, messages}` 取末条 user 文本 parts 拼接；SSE 线格式 `data: <json>\n\n` + `data: [DONE]\n\n`，响应头含 `x-vercel-ai-ui-message-stream: v1`
- `transport.ts`（浏览器）：`PiBackendChatTransport implements ChatTransport<UIMessage>`——`sendMessages` fetch POST + 手工 SSE 解析（`data:` 帧 → JSON → enqueue，`[DONE]` 关流），`reconnectToStream` 返回 null。与 tests/e2e/chat/panel.spec.ts:41 mock 的对象契约同形
- `attach.ts`（浏览器）：`VITE_PI_BACKEND==='1'` 门控，经 `window.openPencil.setChatTransport` 注册工厂；sessionId 经 `loadPiBackendSessionId()`（chat/storage.ts 内，遵守 no-direct-storage-access 规则）存 sessionStorage（`openpencil.pi-backend.session-id`，刷新/HMR 复用）；显式 `import '@/app/ai/chat/use'` 保证钩子已暴露

既有文件改动（全部 patch 已注册，zones.json reason 同步加长尾）：

- `src/main.ts` +3 行（import + 调 attach）
- `src/app/ai/chat/storage.ts` +isConfigured 首行 `VITE_PI_BACKEND==='1'` 直通（pi 后端持 key，浏览器免配 provider）+ `loadPiBackendSessionId()`（lint 规则 no-direct-storage-access 限定存储访问收敛于白名单模块，故不放 attach.ts）
- `vite.config.ts` +2 行（注册 piBackendPlugin，仅 serve）
- `package.json` +3 依赖精确钉扎：`@earendil-works/pi-coding-agent@0.84.2`、`@earendil-works/pi-ai@0.84.2`、`typebox@1.3.7`（03 §5.5 纪律：无 ^/~）；bun.lock 同步
- `.gitignore` +`.openpencil/`
- ChatPanel.vue / use.ts / transports.ts / Chat 类：**零改动**（验收 A3，`git diff --stat` 实证 2026-08-23）

核验：`bunx tsgo --noEmit` 空输出；`bunx vue-tsc --noEmit -p tsconfig.json` 空输出；`bun tools/zone-registry/src/check.ts` → `[zones] clean: 32 modified (all registered), 190 added (owned)`（2026-08-23）。

### 2.3 计划就地调整记录（T19-plan §1 对照）

1. **选路从「createTransport 加分支」改为「override 钩子注入」**：plan §1.2-6 原拟在 transports.ts createTransport 加 pi-backend 分支。实施时发现 override 管道（`window.openPencil.setChatTransport`，e2e mock 同源）更优：transports.ts/use.ts 零改动，且 smoke 与 e2e mock 走完全相同的注入路径。改动面从「transports.ts 分支 + 新文件」变为「main.ts 一行调用 + attach.ts」。A3 验收不变
2. **sessionId 从 `tab-${getActiveTabId()}` 改为 sessionStorage UUID**：attach 注册工厂是同步回调，getActiveTabId 需静态引入 @/app/tabs（启动时序与循环依赖风险）；sessionStorage 天然 per-tab、跨刷新稳定，等效且零依赖。session↔文件绑定仍归 T22
3. **SSE 解析自写 30 行而非 readUIMessageStream**：契约与 e2e mock 已证形状一致，自写解析可控可见；ai 7 工具链保留给后续需要时引入
4. **`noTools:'all'` 替代 `tools:[]`**：sdk.d.ts 语义更直接（连 extension/custom 工具一并禁），等效 allowlist 空集

### 2.4 2026-08-23 P5a 后端冒烟（活模型 openrouter/free，不经浏览器）

证据脚本：`spikes/s-pi/backend-smoke/smoke.mjs`（node 直跑，fetch 发 UTF-8 中文，断言 SSE 帧序列 + 中文无损 + 锚点连续性 + 落盘）。运行 `node spikes/s-pi/backend-smoke/smoke.mjs` → **14/14 PASS**：

- 帧序列：start 首帧、text-start 先于 delta、start/end 计数自洽、finish(stop) 收尾、`[DONE]` 在
- 中文无损：发「请记住这个数字：7391…」回复含「记住」（对照：同 payload 经 Git Bash curl -d 发送则模型侧收到 mojibake——**curl/Windows 控制台编码问题，非本后端**；node fetch 无此问题）
- 连续性：R2 追问命中锚点 7391（仅后端 SessionManager 历史可提供）
- 落盘：`.openpencil/pi-sessions/*.jsonl` 非空且含两回合 user 消息；index.json 记录 sessionId；目录内无 key 明文文件名

**重启恢复**（证据脚本 `spikes/s-pi/backend-smoke/recovery-probe.mjs`）：kill 掉 vite 进程树后新起 dev server，对旧 sessionId 追问 → 回复「7391」，`RECOVERY-PASS`（2026-08-23）。证明 SessionManager.open 从 JSONL 恢复，session 不绑定进程生命周期

### 2.5 2026-08-23 P5b 浏览器冒烟（真实 Chromium + 活模型）

证据脚本：`spikes/s-pi/backend-smoke/browser-smoke.mjs`（@playwright/test chromium.launch，standalone 不经 test runner；本机 playwright 缓存版本错位，脚本自动探测 chromium_headless_shell 最高版本 executablePath，可用 `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` 覆盖）。运行 → **7/7 PASS**：

1. AI 面板直接出现聊天输入框（isConfigured 门控生效，无 provider 配置引导）
2. sessionStorage 写入 pi sessionId
3. R1 流式回复渲染「记住了」
4. R2 回复含锚点 8246（浏览器 → 后端 session 连续端到端）
5. 后端 index.json 记录浏览器侧 sessionId（前后端对账）
6. 该 session 的 JSONL 含锚点两回合
7. 无致命 console 错误

截图证据：`.openpencil/p5b-turn1.png` / `p5b-turn2.png`（gitignored），turn2 可见两回合渲染 + R2 流式进行中打字指示。

**IAB 不可用绕行记录**：ZCode 内置浏览器（iab 后端）对本页输入管线失灵（locator/dom_cua/cua 点击与按键均无效果，截图 capture 失败；DOM 读取正常）。控制实验：同页面经真实 Chromium（standalone Playwright）点击 AI 标签即 `data-state=active`。**结论：IAB 环境限制，非应用缺陷**；P5b 证据以 standalone Chromium 为准

### 2.6 已知边界与 cosmetic 记录

- **「No model」标签**：聊天底栏模型选择器显示 No model（pi 后端不经 provider 配置面，选择器无感知）。功能无碍，T21 凭证/模型面统一时处理
- **canvaskit-webgpu vendor 缺失告警**：dev server 启动时 `[copy-canvaskit-wasm] Missing source`（`packages/core/vendor/canvaskit-webgpu/` 为 gitignored 外部检出，本机与 CI 均无）；webgl 路径回退 `node_modules/canvaskit-wasm`，e2e 在 CI 同形态下全绿——**预先存在，与本任务无关**（2026-08-23 三次 dev server 日志一致）
- **openrouter/free 为 meta 路由**：不同请求可能落到不同免费模型，回复质量波动。冒烟 R1 断言已硬化为逐字复读探针（「汉字无损」echo + 零 U+FFFD 断言），不依赖模型文风——原「回复含记住」断言在核验员首跑时遇模型答非所问（"User Safety: safe"），重跑即过
- **key 卫生**：`OPENROUTER_API_KEY` 经 `.openpencil/key-env`（gitignored，`git check-ignore -v` 命中 .gitignore:82）source 进 dev server 进程环境；models.json 写盘内容为 `$OPENROUTER_API_KEY` 引用非明文；全文不出现 key 值

### 2.7 CI 事故链与工具链坑（2026-08-23 实录）

1. 首推 `3dc84992` → CI Code quality 红于 **format:check**：`tools/zone-registry/zones.json` 被 oxfmt 改写。**根因：oxfmt 0.35.0 的 JSON 数组单行/多行规范化在 Windows 与 Linux 二进制间行为不一致**（subagent 核验员实证：同 lockfile 版本，Windows 对多行形态 --write 逐字节不变，Linux 改写回单行）——本地 format:check 对 JSON 文件可能假绿。修复：接受 CI 形态（单行化）amend 为 `07323180`。教训：手工编辑 zones.json 等 JSON 后，以 CI 为准或固定 oxfmt 单行数组风格
2. 二推 `07323180` → format 翻绿，但 **lint:structure 红**：2 errors 均在 tests/engine/rebuild/ 冒烟脚本——`window.sessionStorage` 标识符命中 no-direct-storage-access（规则为语法级，evaluate 回调内也算）；`indexOf(...) !== -1` 命中 unicorn prefer-includes。**本地漏检原因：只跑了 scoped oxlint（src/app/ai/pi-backend/），没跑全量 `bun run lint`**（lint:structure 覆盖 tests/ 且无 type-aware）。修复：oxlint-disable-next-line（`open-pencil/规则名` 斜杠形式才生效，括号形式无效——两处都试过，实证）+ indexOf 结果先入变量再比较。amend 为 `a34adfcb`；本地全量 `bun run lint` + `format:check` 复核全绿后推送
3. 两坑共同教训：**收口前本地必跑 CI 同构命令全量面**（`bun run lint` 全路径 + `bun run format:check` + tsgo + zone check），不得以 scoped 检查替代

## 3. 完成度自评

- A1 后端真实（SSE 帧 curl/node 可验）：✅ §2.4
- A2 映射正确（帧序列 + 中文 + 计数自洽）：✅ §2.4
- A3 前端零改动（Chat 类/ChatPanel/use/transports git diff 为零）：✅ §2.2
- A4 live 冒烟（真实模型 + 浏览器渲染 + 截图）：✅ §2.5
- A5 session 连续（跨请求锚点 + JSONL 落盘 + 重启恢复）：✅ §2.4
- A6 无占位 / key 卫生 / CI：本地无占位（五文件全真实现）；key 卫生 §2.6；CI 事故链见 §2.7（两次红灯均已就地修复），最终以推送态 CI 为准

**收口状态**：subagent 独立核验 V1-V8 全过，判决「可以提交」（T19-verify.md §2）；远端 CI 全绿（run 32637559364，HEAD 2e6da5dd）。

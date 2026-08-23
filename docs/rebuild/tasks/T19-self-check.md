<!--
  写作纪律（改本文前必读）：
  - 事实性声明必须附核验命令 + 日期，否则标为【假设】
  - 本文只保留当前态，不保留修正历史
  - 详细规则见 docs/rebuild/05-process.md §4
-->

# tasks/T19-self-check.md · T19 自检记录

> **T 编号**：T19（Phase 1-pi 实施 · 后端换心：pi SDK 薄 service + UIMessage v1 SSE 契约 + 前端 Chat 类零改动）
> **状态**：🔄 开工（注册期 recon 完成，P2-P5 执行中持续回填）

## 1. 任务清单对照

| 执行面 | 内容 | 状态 |
|---|---|---|
| P1 | recon | ✅（§2.1） |
| P2 | 后端 pi session service + SSE 写出 | ⬜ |
| P3 | vite 中间件端点 | ⬜ |
| P4 | 前端 PiBackendChatTransport + 选路 | ⬜ |
| P5 | live 冒烟 + session 连续 + CI | ⬜ |

## 2. 实测记录

### 2.1 2026-08-23 注册期 recon（全部附核验命令）

1. **S-pi 4 映射表在手**（T11-self-check §2.5）：AgentSessionEvent → UIMessageChunk 映射——text_start/delta/end → text-start/delta/end（自建 textId）；thinking_* → reasoning-*；toolcall_* → tool-input-start/delta/available；tool_execution_end → tool-output-available；turn_end → finish-step；agent_end → finish；错误 → error。上游 `src/app/ai/harness/transport.ts:28-62` mapEvent 的惰性开帧状态机可照搬
2. **Chat 装配点**（2026-08-23 读源码）：`src/app/ai/chat/use.ts:33` `createChatSessionManager(...)`；选路在 `transports.ts` `createTransport(store)`——overrideTransport 优先（`browser-bridge.ts:64` `exposeChatTransportOverride` 注入窗），再 harness:pi（Tauri sidecar），再 direct ToolLoop（浏览器内）；本任务在 createTransport 加 pi-backend 分支
3. **vite 插件模板**（2026-08-23 读源码）：`vite.config.ts:27-35` plugins 数组含 `openPencilAutomationPlugin(command, host)`（`src/app/automation/bridge/vite-plugin.ts`）——dev server 中间件/子进程挂载有现成模式
4. **ai SDK 工具链**（2026-08-23 实证）：`ai@7.0.68`（`node -e "require('ai/package.json').version"`），导出 `readUIMessageStream`、`JsonToSseTransformStream`、`createUIMessageStream`、`HttpChatTransport`、`UI_MESSAGE_STREAM_HEADERS`（`node_modules/ai/dist/index.d.ts` grep 实证）——SSE 契约零自造
5. **T18 live 形态可复用**：models.json 覆盖注入 openrouter/free + `$OPENROUTER_API_KEY` env 引用（spikes/s-pi/live-chat.mjs 实证 8/8），后端 service 直接沿用该装配
6. **旧 Chat 类消费面**：`@ai-sdk/vue` `Chat`（use.ts 经 createChatSessionManager 持有单实例，`ensureChat/resetChat`）；ChatPanel.vue 渲染 UIMessage parts——transport 换pi 后端后渲染面零改动（S-pi-4 结论）

## 3. 完成度自评

（P2-P5 执行后回填）

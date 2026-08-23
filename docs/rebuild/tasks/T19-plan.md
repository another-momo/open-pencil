<!--
  写作纪律（改本文前必读）：
  - 事实性声明必须附核验命令 + 日期，否则标为【假设】
  - 计划被实测推翻时，直接改本文为新版本，完整理由记入 records/ 子文档
  - 本文只保留当前态，不保留修正历史
  - 改完后刷新本文头部的「状态」字段
  - 详细规则见 docs/rebuild/05-process.md §4
-->

# tasks/T19-plan.md · T19 任务计划

> **T 编号**：T19（Phase 1-pi 实施 · 后端换心：pi SDK 薄 service + UIMessage v1 SSE 契约 + 前端 Chat 类零改动）
> **分支**：`rebuild/pi`（D24 主线；T18 已收口 ✅）
> **状态**：🔄 开工（注册期 recon 已完成，见 [T19-self-check §2.1](T19-self-check.md)）
> **三件套**：
> - 计划：[T19-plan.md](T19-plan.md)（本文件）
> - 自检：[T19-self-check.md](T19-self-check.md)（开工后持续回填）
> - 核验：[T19-verify.md](T19-verify.md)（收口时 subagent 填报）

## 1. 任务概述

### 1.1 背景与目标

T18 打通了 pi 线全部机制风险（离线面 T11 遗产 + 活模型面 openrouter/free 实证）。本任务做 **F0.1/F0.4 的落地**：自写薄后端 service 直用 pi SDK（D21 口径：harness 不占 runtime 路径，其产线代码仅作参照），传输契约换 pi 驱动，验收标准是**前端旧 Chat 类一字不改看到流式回复**（S-pi-4 已证事件映射可行）。

post-merge 实况（T18 P4 已修正入 01）：现存 AI 路径为 `src/app/ai/chat/transports.ts` 双路径（浏览器内 ToolLoopAgent + harness:pi sidecar），`Chat` 类经 `createChatSessionManager` 的 `createTransport` 选路，另有 `exposeChatTransportOverride` 注入点（`browser-bridge.ts:64`）。本任务新增第三条路径：pi 后端。

### 1.2 关键决策（本 task 内拍板，理由随附）

1. **后端 = vite 插件中间件形态**（dev 期宿主）——照 `openPencilAutomationPlugin` 既有模式（vite.config.ts:33，2026-08-23 实证）；D4（localhost serve 产品形态）推迟，后端代码分层时保持 service 与宿主解耦，将来 serve 入口直复用
2. **契约 = UIMessage stream v1 SSE，不自造协议**——ai SDK 7.0.68 自带全工具链（`readUIMessageStream`/`JsonToSseTransformStream`/`createUIMessageStream`，`node_modules/ai/dist/index.d.ts` 实证导出）；后端发 SSE chunk，前端 transport 用 `readUIMessageStream` 消费；事件映射用 T11 §2.5 的 S-pi-4 表（text/reasoning/toolcall 三组 + finish/error），上游 `harness/transport.ts:28-62` mapEvent 的惰性开帧状态机可照搬
3. **session = tab 级 id + 后端 pi SessionManager 落盘**——照 harness transport 的 `tab-${getActiveTabId()}-${profile.id}` 思路（transports.ts:156）；后端 sessions 目录不入仓（.gitignore）；F0.1 持久化由 pi 自带（S-pi-3 已证增量落盘）
4. **key 只存在于后端进程**——openrouter/free 经 models.json 配置（T18 实证形态），`OPENROUTER_API_KEY` 只进后端进程 env；前端零 key——顺带坐实 F0.3① 雏形（key 不下发）
5. **T19 只通文本回路**——工具调用（经桥/直挂）归 T20；本任务事件映射只需 text + reasoning + finish/error 四组
6. **选路判定最小 diff**：`createTransport` 增加 pi-backend 分支（provider 判定），不动 `Chat` 类、不动 `ChatPanel.vue`——验收含 `git diff` 证明前端组件零改动
7. **live 冒烟在本地做**（Playwright 实测 + 证据截图），CI 跑静态与既有测试——openrouter key 不进 CI（与 T18 口径一致）

### 1.3 非目标（明确划掉）

- 工具调用链路（T20）；审批 extension（层 2 B1b）；prompt 装配 marketing overlay（T23）
- D4 localhost serve 产品化；多用户/鉴权
- 视觉通道 A 探测（沿袭 T18 口径）

## 2. 验收清单（收口时逐项核验）

| # | 验收项 | 通过标准 |
|---|---|---|
| A1 | 后端 service | pi session service 经 vite 中间件挂载，POST 端点收 prompt 回 UIMessage v1 SSE 流 |
| A2 | 事件映射 | text/reasoning/finish/error 四组按 S-pi-4 表映射，流式增量与最终文本一致 |
| A3 | 前端零改动 | `Chat` 类与 `ChatPanel.vue` 等前端组件 `git diff` 为零；仅 transports 选路 + 新 transport 文件 |
| A4 | live 冒烟 | dev server 起，真实 openrouter/free，浏览器 ChatPanel 发消息 → 流式回复可见（Playwright 截图证据） |
| A5 | session 连续 | 同 tab 二轮对话有上下文（问「我刚才说了什么」答对）；后端 sessions 目录有 JSONL 落盘 |
| A6 | 既有测试不破 + CI 绿 | rebuild/pi HEAD run 全绿 |

## 3. 执行面（P1-P5）

- **P1 recon**（注册期完成）：S-pi-4 映射表、Chat 装配点、vite 插件模板、ai SDK 工具链——见 self-check §2.1
- **P2 后端 service**：pi session 管理（sessionId→SessionManager/createAgentSession 缓存、openrouter/free 模型装配照 T18 形态）、SSE 写出（`createUIMessageStream` + 映射器）
- **P3 vite 中间件**：新 vite 插件挂 POST 端点（JSON body {sessionId, text} → SSE response），注册进 vite.config.ts
- **P4 前端 transport**：`PiBackendChatTransport implements ChatTransport<UIMessage>`（fetch + `readUIMessageStream`），`createTransport` 加选路分支
- **P5 live 冒烟 + 证据**：Playwright 全流程 + session 连续性断言 + CI 绿

总计 ~2-3 人日。

## 4. 风险与回退

| 风险 | 应对 |
|---|---|
| ai SDK 7 的 UIMessageChunk 协议细节与 S-pi-4 表（v1 口径）有版本漂移 | 以 `node_modules/ai/dist/index.d.ts` 实际类型为准逐字段核对；映射器单测先行 |
| zone-registry 新目录未登记导致 pre-commit 红 | 动工先查 tools/zone-registry 登记既有路径模式，新增 ownedRoot 随本任务登记 |
| openrouter/free 首 token 慢/偶发上游 400（T17 实录「Reasoning is mandatory」） | transport 层如实透传 error chunk；冒烟遇波动重试并记录 |
| SSE 在中文字符/代理下的分片边界 | 冒烟断言含中文回复场景 |

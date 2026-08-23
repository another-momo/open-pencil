# spikes/s-pi · T11 S-pi spike 实测定证

直用 pi SDK（库形态）路线实测，对应 spikes/02 §6（D2 修正版）+ spikes/05 §6 调整清单。
自包含目录，**不在 root workspaces**；依赖精确锁定 pi 0.84.2 全家桶。

## 文件

| 文件 | 对应 spike 项 | 性质 |
|---|---|---|
| `offline-echo.mjs` | S-pi-1 离线面 | 库形态最小集成 + echo 自定义工具 + 事件流（faux provider 注入，零网络） |
| `offline-session-persistence.mjs` | S-pi-3 离线面 | SessionManager 增量落盘 / 跨重启恢复 / list / branch 树形分叉（零网络） |
| `live-chat.mjs` | S-pi-1 活模型面（T18 P2） | openrouter/free 真实流式对话（需 OPENROUTER_API_KEY，env 注入不落盘） |
| `live-tool-result.mjs` | S-pi-2 主线活模型面（T18 P3） | 真实模型调自定义文本工具并消费返回续跑（同上 key 要求） |
| `backend-smoke/smoke.mjs` | T19 P5a 后端冒烟 | 产品 dev server 的 /api/pi-chat：SSE 帧序列 + 中文无损 + 锚点连续性 + JSONL 落盘（需 dev server 带 VITE_PI_BACKEND=1 与 key） |
| `backend-smoke/recovery-probe.mjs` | T19 P5a 重启恢复 | dev server 重启后对旧 sessionId 追问锚点，实证 SessionManager.open 恢复 |
| `backend-smoke/browser-smoke.mjs` | T19 P5b 浏览器冒烟 | 真实 Chromium 端到端：AI 面板发消息、流式渲染、前后端 session 对账 |

## 运行

```bash
npm install
npm run test:offline   # 两个文件顺序执行，任一断言失败退出码非 0
```

## 关键注入点（离线验证的核心机制）

pi 自家测试（`pi/packages/coding-agent/test/test-harness.ts`）用 `createFauxStreamFn` 脚本化
响应；公开 SDK 面的等价注入点是 **`ModelRuntime.registerNativeProvider(provider)`**：
自带 `streamSimple` 返回 `createAssistantMessageEventStream()`（pi-ai 官方导出）编排的事件流。
`package.json` 显式声明 `@earendil-works/pi-ai` 与 `typebox`（与 pi-coding-agent 同版本 0.84.2 /
1.3.7），npm dedupe 保证全树单实例（`npm ls` 输出全 `deduped`）。

## 证据与结论

见 `docs/rebuild/tasks/T11-self-check.md`（本仓 docs/rebuild 下）。活模型面（DeepSeek 通道 B、
视觉通道 A 探测）需 owner 提供 API key，当前状态见该文档阻塞清单。

# T73 计划 · 停止按钮后端不打断——显式取消端点

> 日期：2026-09-02。触发：owner 报告「点停止后画布仍有多次工具调用，前端消息不显示了」。T74（桥启动 race）落地后实测通畅环境下重测本问题。

## 1. 实证（Playwright + 会话 JSONL 时间戳 + curl 对照实验）

环境：vite 1420 / pi-backend 7700（经 vite 代理 /api/pi 前缀）/ 桥 7600（T74 修复后健康）。

- **R1（页面多工具轮）**：10 矩形 prompt；停止点击于 04:10:34.758Z。会话 JSONL（`.openpencil/pi-sessions/`，服务端落盘时间戳）显示停止后仍执行 `set_fill`(35.452) / `create_shape`(37.801) / `set_fill`(39.867) / `viewport_zoom_to_fit`(42.287) —— **停止后 ≥4 次工具调用、~10s 才自然完结**。
- **R2/R3（页面打点轮）**：window.fetch 打点证明 Chat.stop() 链路前端段正常——点击后 75-115ms 内 abortSignal 'abort' 事件触发；R3 落在 LLM 流中段，后端 ~0.6s 内停跑（残留一条文本冲刷），链路**在「打断 LLM 流」场景可用**。
- **R4（curl 对照，决定性）**：裸 curl POST /api/pi-chat 收 SSE，杀掉 curl 进程（curl.exe 已核实消失）后 **25s+ 后端仍以 2-3s 节奏持续执行 render 工具调用**（JSONL 行数 18→22→32→38）。

结论：用户症状 = **后端 agent loop 在客户端断开后不停止**。唯一取消通道是 server.ts 的 `res.on('close') → service.abort(sessionId)`（T27 遗留），其触发依赖「客户端 socket 关闭语义穿透 vite http-proxy 到达 bun 上游连接」——实证不可靠（RST/FIN、代理连接吸收等差异）。前端 stop 只 abort fetch，**没有带外取消通道**。

## 2. 修复（最小侵入）

1. **server.ts**：新增 `POST /api/pi-chat/cancel {sessionId}` → `service.abort(sessionId)` → 204。复用 T28 鉴权伞（/health 外全端点 bearer；vite 代理 /api/pi 前缀自动补头，前端同源零凭证处理）。幂等：service.abort 对未知/空闲 session 是无害 no-op（T66 已钉）。`res.on('close')` 兜底保留不动。
2. **transport.ts**（PiBackendChatTransport.sendMessages）：abortSignal 触发时除 fetch 自身中止外，fire-and-forget POST cancel（`{ once: true }`，失败静默——close 兜底仍在）。sessionId 取自当次 getContext（与请求体同源）。

## 3. 验收

- 钉扎测试（tests/engine/rebuild/pi-backend/，owned 零登记）：
  - `transport-cancel.test.ts`：abort → 恰好一次 POST /api/pi-chat/cancel 且 body 含 sessionId；无 abortSignal 不发；cancel 请求失败静默不冒 unhandled。
  - `chat-cancel-route.test.ts`：真 server（mock pi-coding-agent，service-abort.test.ts 同款夹具）HTTP 往返——先 prompt 建会话，POST cancel → abortSpy 命中 + 204；无 token → 401；GET → 405。
- 浏览器实测：多工具 prompt 中段点停止 → 会话 JSONL 在停止后 ≤2s 停止增长（对照 R1 的 +4 工具）。
- 门禁 unpiped：相关测试 / lint / tsgo / format / zones / i18n / docs。全量 bun test 按 owner 2026-09-02 指示交 CI。

## 4. 边界与残余观察（不修，记录在案）

- 不改 pi-agent-core / agent-loop（工具中段信号透传属既有 T66 已知限制：abort 只置信号、等当前工具收尾；generate.ts execute 未接 signal，provider 独立 240s 超时——长工具（如生图）执行中停止仍会等其完成，最长 240s）。
- **残余观察 A（桥假死）**：R1 停止后页面侧桥 RPC 一度全挂（undo_group end 超时；后续所有 /rpc 无响应；/health 仍报 ok——browserWs+registered 布尔不代表应用层活性）。页面 reload 自愈。疑与 abort 打断 undo_group 时序有关，未实锤；建议后续给桥加应用层心跳/探针超时（候选新任务）。
- **残余观察 B（落点之谜）**：R1 的 9 个 Create Shape 成功回执（id 0:221 族）但当前可见文档图（0:2 族）无任何节点——工具变更落进了不可见的旧文档/槽位（恢复对话框丢弃后 documentId 指向陈旧文档？）。独立于 T73，建议随「残余观察 A」一起排期查证。

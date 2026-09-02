# T73 自检 · stop 按钮带外取消通道（/api/pi-chat/cancel）

> 日期：2026-09-02。实施 = 主 agent。前置：T74（桥启动 race）已收口（c05f51166），
> 本次实证与修复基于 T74 修复后的同一份 dev 环境。

## 1. 交付（对照 T73-plan §2）

- `src/app/ai/pi-backend/server.ts`：新增显式取消端点
  `POST /api/pi-chat/cancel {sessionId}` → `service.abort(sessionId)` → 204。
  幂等无害（abort 对未知/空闲 session 为 no-op，T66 钉扎）；非 POST → 405、
  JSON 解析失败 / 缺 sessionId → 400；走既有 T28 Bearer 鉴权。
  原 `res.on('close') → service.abort` 兜底网保留（双通道并存，互为冗余）。
- `src/app/ai/pi-backend/transport.ts`：`sendMessages` 内对入参 abortSignal
  挂 `{once:true}` 监听，abort 即发 fire-and-forget `POST ${api}/cancel`
  （`.catch(() => undefined)` 静默失败——res.on('close') 兜底仍在）；
  入参信号已 aborted 时立即补发一次。
- `tests/engine/rebuild/pi-backend/transport-cancel.test.ts`（新，4 用例）：
  abort → 恰好一次 POST /cancel 且 body 带当次 sessionId；无信号 → 不发；
  cancel fetch 失败 → 静默吞掉不炸流；已 aborted 信号 → 立即补发。
- `tests/engine/rebuild/pi-backend/chat-cancel-route.test.ts`（新，4 用例）：
  真 server 实例（临时 rootDir + mock pi-coding-agent）：prompt 后 cancel →
  204 且 abortSpy 恰 1 次；未知 session → 204 no-op；无 token → 401；
  GET → 405 / 坏 JSON → 400 / 缺 sessionId → 400。

## 2. 门禁（unpiped）

- `bun test tests/engine/rebuild/pi-backend/` → **40 pass / 0 fail / 80 expects**
  （含既有 service-abort.test.ts 等 4 文件，回归无损）。
- `bun run lint` → 0 errors（7 warnings 均为既有 max-lines 类，与本任务文件无关）。
- `bun run tsgo` → exit 0；`bun run format:check` → all correct
  （oxfmt --write 仅施于本任务触及文件）。
- `bun run check:zones` → clean（改动文件全在 pi-backend ownedRoot，零登记）。
- `bun run check:i18n` → in sync；`bun run check:docs` → 44/44。
- 全量 `bun test`：**按 owner 指示不在本机跑**（2026-09-02 原话「有的测试和你
  改动无关的话就不要在本机跑了，交给CI」），全量绿以 Linux CI 为准。

## 3. 端点行为 curl 实证（新代码后端，经 vite proxy）

后端子进程 kill（PID 1964）→ vite 插件自动以新 server.ts 复活（PID 19008，
`/health` ok）。经 `localhost:1420` proxy（Bearer 自动注入）：

- `POST /api/pi-chat/cancel` 坏 JSON → 400 `Bad Request: invalid JSON`
- 缺 sessionId → 400 `Bad Request: sessionId required`
- 未知 sessionId → 204（幂等 no-op）
- `GET /api/pi-chat/cancel` → 405
- 直连 7700 无 token → 401（T28 鉴权覆盖新端点）

## 4. 浏览器钱测（验收标准：多工具 loop 中途 stop → JSONL 即刻停增）

- prompt：「创建16个不同颜色的圆形，排成4行4列的网格，每个直径80，间距24，
  逐个创建」，发送于 05:11:27.197Z；session 文件
  `2026-09-02T05-11-27-382Z_01a06087-…jsonl` 185ms 内落盘。
- loop 推进至 **12 次 create_shape + 12 次 set_fill**（目标 16 组）时点击
  「停止生成」，点击时间戳 **05:12:24.085Z**。
- 结果：JSONL **最后一条事件 05:12:24.078Z**（点击前 7ms，abort 落地的
  assistant 收尾消息）；最后一次工具执行 05:12:23.013Z（点击前 1.07s）。
  点击后 15s+ 轮询：53 行、12+12 工具调用**零增长**——无任何迟到工具执行。
- 画布实证：恰好 12 个圆形落布（图层 圆1–圆12），第 13–16 个从未出现；
  面板回到 idle（输入框空、发送按钮复位）。
- **对照修复前 R1（T73-plan §1）**：同场景 stop 后后端继续执行 ≥4 次工具、
  持续 25s+。修复后迟到工具数 = **0**，取消生效时延 < 点击后 7ms。

## 5. 偏差

1. 全量测试本机弃权（owner 指示，见 §2）；本地钉扎覆盖 pi-backend 目录全部
   4 个测试文件（含 T66 回归）。
2. lint 收口期修两处：`no-promise-executor-return`（sleep helper + 块体
   listen）、`no-mixed-case-acronym-identifiers`（badJson → badJSON）。
3. `res.on('close')` 兜底保留未删——proxy 语义哪天修好即恢复第一通道，
   双通道幂等无冲突（abort 重复调用是 no-op）。
4. 残留观察（T73-plan §4 已登记，本任务不修）：
   A) 桥 `/health` 假阳性——页面侧 RPC 通道 wedge 时 health 仍 ok，页面 reload
      自愈；
   B) R1 中 9 次 Create Shape 返回成功 id（0:221 族）但可见文档图（0:2 族）
      为空——变更落在了不可见 store/文档。

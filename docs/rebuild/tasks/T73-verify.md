# T73 核验 · stop 按钮带外取消通道（/api/pi-chat/cancel）

> 日期：2026-09-02。独立核验 subagent（只读 + 本文件；未改动任何实现文件；git 仅读操作 status/diff/log）。
> 材料：T73-plan.md（根因实证 + 方案）、T73-self-check.md（自检申报）。
> 实现：src/app/ai/pi-backend/server.ts、src/app/ai/pi-backend/transport.ts；测试：tests/engine/rebuild/pi-backend/transport-cancel.test.ts（新，4 例）、tests/engine/rebuild/pi-backend/chat-cancel-route.test.ts（新，4 例）。

## 逐项核验

| 项 | 结论 | 证据 |
| --- | --- | --- |
| V1 server.ts cancel 路由 | PASS | `handlePiChatCancelRequest`（server.ts L180-202）三分支齐全：非 POST → 405（L185-188）；`JSON.parse(await readBody(req))` 失败 → 400 `Bad Request: invalid JSON`（L190-195，`catch` 裸捕含 PayloadTooLargeError）；`typeof body.sessionId !== 'string' \|\| !body.sessionId` → 400 `sessionId required`（L196-199）；通过则 `await service.abort(body.sessionId)` → 204（L200-201）。路由注册 L397-400 `url.pathname === '/api/pi-chat/cancel'` exact match，位于 `/api/pi-chat` exact（L392）之后、`/api/pi/` 前缀路由（L413）之前；两 exact 互不存在前缀遮蔽，且 `/api/pi-chat/cancel` 不以 `/api/pi/` 为前缀（第 7 字符是 `-`），不会坠入 admin 面。T28 鉴权闸（L388 `isAuthorized`）在路由分发之前，新端点自动入伞（路由测试「无 token → 401」pass 佐证）。git diff 纯增量（+38/-0），`res.on('close')` 兜底（L142-144）保留，与自检 §1「双通道并存」一致。 |
| V2 transport.ts abort 钩子 | PASS | transport.ts L37-48：`cancelSession` 发 `fetch(`${this.api}/cancel`, {method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify({sessionId: context.sessionId})}).catch(() => undefined)`——fire-and-forget + 静默 catch ✓；`abortSignal?.addEventListener('abort', cancelSession, { once: true })` once ✓；`if (abortSignal?.aborted) cancelSession()` 已 aborted 立即补发 ✓；URL 为 `${this.api}/cancel`，api 默认 `/api/pi-chat`（唯一实例化点 attach.ts L32 用默认值）→ `/api/pi-chat/cancel` 与 server exact 路由吻合 ✓；body 取当次 `getContext()` 的 sessionId（L30，与主请求体同源）✓。关键正确性点：cancel fetch **未**挂 abortSignal——若挂则 abort 会顺带杀死取消请求本身，适得其反。 |
| V3 目标目录测试 | PASS | unpiped `bun test tests/engine/rebuild/pi-backend/` → **40 pass / 0 fail / 80 expects**，4 文件（active-design-host / chat-cancel-route / service-abort / transport-cancel），与自检 §2 申报逐字一致。新 8 例全绿：transport 侧 abort→恰一次 POST /cancel 且 body={sessionId:'sess-t73'}、无信号不发、失败静默、已 aborted 补发；路由侧 204+abortSpy 恰 1、未知 session 204 no-op、无 token 401、GET 405/坏 JSON 400/缺 sessionId 400。未跑全量 bun test（遵守 owner 明令）。 |
| V4 门禁复跑（unpiped，逐个） | PASS | `bun run lint` exit 0（0 errors / 7 warnings，抽查为 packages/core/src/tools/fork/marketing/brief.ts 等既有 max-lines，T73 文件零警告）；`bun run tsgo` exit 0；`bun run format:check` exit 0（2168 files all correct）；`bun run check:zones` exit 0（clean：85 modified all registered / 549 added owned——改动全在 pi-backend ownedRoot 与 docs ownedRoot，零登记与自检 §2 一致）；`bun run check:i18n` exit 0（in sync）；`bun run check:docs` exit 0（44/44）。 |
| V5 代码审查 | PASS（无阻塞） | 见下方「审查发现」。URL 拼接、鉴权对等、readBody 限流、幂等语义逐项核过，无阻塞缺陷；建议级 1 条、备注级 2 条。 |
| V6 自检申报一致性 | PASS | §3 curl 端点行为：本核验员对运行中 dev 环境经 :1420 代理独立复测——GET → **405**、POST `{oops` → **400 `Bad Request: invalid JSON`**、POST `{}` → **400 `sessionId required`**、POST 未知 sessionId → **204**，四条与申报一致；第五条（直连 7700 无 token → 401）由路由测试「无 token → 401」覆盖（pass）。§4 钱测数字对 JSONL `2026-09-02T05-11-27-382Z_01a06087-…jsonl` 逐条核对：总行数 **53** ✓（申报「53 行」）；create_shape / set_fill 各 24 次字符串命中 = 12 toolCall + 12 toolResult 行 → **12+12 工具调用** ✓；toolResult 名为 **圆1–圆12** 恰好 12 个、无圆13+ ✓；末行 assistant `stopReason:"aborted"`、`errorMessage:"Request aborted"`、ts **05:12:24.078Z** ✓（申报「最后一条事件 05:12:24.078Z」「点击前 7ms」：点击 05:12:24.085 − 24.078 = 7ms ✓）；最后一次 toolCall（set_fill）ts **05:12:23.013Z** ✓（申报「最后一次工具执行 05:12:23.013Z」「点击前 1.07s」：24.085 − 23.013 = 1.072s ✓）；首行 ts 05:11:27.382Z 与文件名一致 ✓。§2 门禁清单与本核验员复跑结果全一致。§5 偏差 4 条均属实：①全量弃权与 owner 明令吻合；②lint 两修在码中可指（route test L119 `badJSON` 命名、两测试 sleep/listen 块体）；③`res.on('close')` 兜底保留（server.ts L142-144，diff 纯增量 +55/-0）；④残留观察 A/B 属 T73-plan §4 登记的不修项。 |
| V7 git 状态边界 | PASS | `git status --short`：`M` server.ts、`M` transport.ts + untracked T73-plan.md、T73-self-check.md、chat-cancel-route.test.ts、transport-cancel.test.ts——恰为 T73 域六件。另有两件 untracked `docs/rebuild/records/review-2026-09-01-*.md`（code-review / research-adjudication），系 T74-verify 已登记的非本任务既有遗留（∈ docs ownedRoot，check:zones clean），非 T73 混入。 |

## 审查发现（V5 明细）

**阻塞项：无。**

**建议级（1 条，不阻塞）：**

- `handlePiChatCancelRequest` 的 `catch`（L192）把 `PayloadTooLargeError` 一并归入 400 `invalid JSON`，不像 `handlePiChatRequest`（L118-121）那样单列 413。cancel 体正常 <100B，触发 4MB 上限属病态输入，纯语义瑕疵；如追求状态码对称可补 413 分支。

**备注级（2 条，均已查证不构成问题）：**

- **鉴权对等性**：transport 的 cancel fetch 与主 chat fetch 一样不显式带 Authorization 头——两者同靠 vite 插件 proxy（vite-plugin.ts L185-190）对 `/api/pi` 前缀统一注入 `Bearer ${authToken}`；`/api/pi-chat/cancel` 含于 `/api/pi` 前缀 → 补头覆盖。本核验员经 :1420 代理实测 401 不触发、未知 session 返 204，旁证补头生效。standalone 无代理场景下主请求与 cancel 请求会**同等地**失败——既有架构姿态，非 T73 引入。
- **监听器生命周期**：`{ once: true }` 触发即自除；若信号始终不 abort，监听器随调用方 AbortController GC——ai SDK Chat 每轮新建 controller 的常规用法下无累积风险。`service.abort` 永不 reject（未知 session `if (!entry) return`；session.abort 抛错内吞，service.ts L468-485），故 server 端 `await service.abort` 后恒达 204，幂等成立。

**细微文字备注（不影响 PASS）**：自检 §4「发送于 05:11:27.197Z；session 文件 385ms 内落盘」——首行事件 05:11:27.382Z，与发送时间差实为 **185ms**（「385ms 内」作为上界表述仍成立，疑为 185→385 数字转置）。

## 补充观察（不阻塞）

- 核验期间 dev 环境（vite :1420 + pi-backend :7700）正在运行，V6 的四条端点复测命中的是含新代码的活后端——与自检 §3「后端子进程 kill → vite 插件自动以新 server.ts 复活」的环境描述相容。
- 画布侧「恰好 12 圆落布、面板回 idle」属 owner 侧浏览器实证，本核验员未复跑浏览器；但 JSONL 侧（12+12 调用、aborted 收尾、点击后零增长）全部可独立核实且属实。

## 总结论

**PASS（7/7）**——server 路由、transport 钩子、目标目录测试、六道门禁、代码审查、自检一致性、git 边界七项全部合规，与 T73-plan 及 T73-self-check 申报一致。阻塞项 0；建议级 1 条（cancel 端点 PayloadTooLargeError 可单列 413）；备注级 2 条（鉴权依赖 proxy 补头属既有对等姿态；abort 监听器生命周期无风险）。全量 bun test 按 owner 指示留 CI。

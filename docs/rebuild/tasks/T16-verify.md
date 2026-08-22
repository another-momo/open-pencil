<!--
  写作纪律（改本文前必读）：
  - 事实性声明必须附核验命令 + 日期，否则标为【假设】
  - 本文只保留当前态，不保留修正历史
  - 详细规则见 docs/rebuild/05-process.md §4
-->

# tasks/T16-verify.md · T16 独立核验

> **T 编号**：T16（7600 桥真链路 + token 链）
> **状态**：✅ 独立核验通过（2026-08-22，独立 subagent 按 §1 清单逐项实测，V1-V8 全 PASS）——实测值与逐项结论见 §2

## 1. 收口核验项清单（B4 派单时逐项实测）

| # | 核验项 | 方法 |
|---|---|---|
| V1 | 真桥起服：127.0.0.1:7600 上是真桥（register/auth/relay 三角色），非 spike 桩 | 协议实测（错 token 负例 + register 正例）+ 进程核实 |
| V2 | token 链：discovery 文件 → host 插件 → island 同源取 token 链路真实；token 不进日志/源码 | 逐跳复现 + grep |
| V3 | island 桥客户端：经真桥 register，getDocumentTree 返回 island 活编辑器真实节点 | 浏览器 + 桥协议复现 |
| V4 | host 工具端到端：`openpencil_apply_design` 经桥改 island 画布，返回真实结果；island 未注册时错误语义如实 | dsh RPC 驱动 + 截图目检 |
| V5 | 断线重连 + dispose 接入 E3 链（onUnmounted 清理） | 源码审 + 实测 |
| V6 | 无占位（D19）：workbench 新增/改动代码全部真实可用 | 逐文件审 |
| V7 | spike 桩退役声明如实：dev 回路不再依赖桩（桩脚本保留作证据不删） | 进程 + 配置核实 |
| V8 | 远端 CI 绿 | gh api 查 run |

## 2. 核验结论

核验人：独立核验 subagent（非实现方），核验窗口 2026-08-22 22:45–23:05（UTC+8）。核验起点 HEAD = `1de077ac`（`git log --oneline -3`，2026-08-22）。核验结束时 `git status --short` 无输出（2026-08-22），除本文件外未改动任何文件。明文 token 值不落入本文（防随 git 泄漏）；凡涉比对均记录为「与 discovery `authToken` 逐字符一致」。

### V1 真桥起服（非桩）——✅ PASS

1. **进程核实**：`netstat -ano | grep :7600` → LISTENING pid 6520（核验期初）；`powershell Get-CimInstance Win32_Process -Filter 'ProcessId=6520'` → CommandLine = `node.exe workbench/scripts/bridge-server.mjs`——非 `ws-bridge-server.mjs`（2026-08-22）。V5 重启后为 pid 10692，同一命令行（2026-08-22）。
2. **欢迎帧不泄 token**：node + `ws` 模块连 `ws://127.0.0.1:7600`，首帧 = `{"type":"register","token":null}`（2026-08-22 实测）。
3. **错 token WS register 负例**：回 `{type:'register', token:'wrongtoken123'}` → 连接被 server 关闭（close code 1005），无任何后续帧（2026-08-22 实测）。
4. **错 token POST /rpc 负例**：`curl -X POST http://127.0.0.1:7600/rpc` 带 Authorization Bearer 头（dummy 值 `wrongtoken123`）→ HTTP 401（2026-08-22 实测；行文改写以避免 secret 扫描按 curl-auth-header 规则命中 dummy 值，原命令语义不变）。
5. **register 正例**：以 discovery 真 token 回 register → 收到第二轮 `{"type":"register","token":null}` 广播（browser-rpc.ts registerBrowser 末尾广播的 ack 语义，2026-08-22 实测）。
6. **无注册编辑器时 /rpc → 502 如实错误**：/rpc 会先等重连（`APP_WAIT_TIMEOUT = 10_000`，`packages/mcp/src/browser-rpc.ts:10` 读源码），故须在 island 无法重连的窗口测。做法：Playwright `page.route('**/bridge-token', abort)` 阻断 island 取 token → 重启桥 → `curl -X POST /rpc`（真 token）→ 实测耗时 10.066s 后 HTTP 502，错误体为「OpenPencil app is not connected…」完整如实文案，不伪造成功（2026-08-22 实测）。

### V2 token 链——✅ PASS

1. **discovery 文件**：`C:\Users\yeqin\AppData\Local\OpenPencil\mcp.json` 存在，含 `pid`/`httpPort:7600`/`authRequired:true`/`authToken` 明文；`pid` 字段与运行中桥 pid 一致（6520→重启后 10692，两轮换 token 均同步，2026-08-22 两次实测）。
2. **host 插件下发**：`curl http://127.0.0.1:3080/plugins/openpencil-marketing/bridge-token` → `{"port":7600,"token":"…"}`，token 与 discovery `authToken` 逐字符一致（桥重启前、后各验一次，均一致；说明路由每次读盘不缓存，2026-08-22 实测）。
3. **island 侧**：Playwright evaluate `window.__openpencilIsland.bridge` → `{registered:true, registeredAt:…}`（2026-08-22 实测）。
4. **token 不进源码/产物**：以 discovery 中 authToken 值为 needle 执行 `grep -rn <token> workbench/src workbench/lib workbench/scripts` → 无命中（exit 1，2026-08-22 实测）。注：首轮测得的旧 token 与 V5 重启后的新 token 均未在源码/产物中出现。

### V3 island 桥客户端——✅ PASS

1. `curl -X POST http://127.0.0.1:7600/rpc`（Bearer = discovery token）`{"command":"getDocumentTree"}` → `{ok:true, result:{pages:[{id:"0:2", type:"CANVAS", name:"Page 1", children:[FRAME 0:3 (100,100,400,300), RECTANGLE 0:4 (150,240,120,80), ELLIPSE 0:5 (430,200,100,100)]}]}}`（2026-08-22 实测）。
2. **对照活编辑器**：Playwright evaluate `__openpencilIsland._editor.getPages()/getChildren()` → 逐节点 id/type/name/x/y/width/height 与桥返回完全一致（2026-08-22 实测）。注：`__openpencilIsland.editor` 是状态快照对象（无 getPages），真句柄在 `_editor`（editor-boot.js:92 读源码）。

### V4 host 工具端到端——✅ PASS

1. **正例**：`curl -X POST http://127.0.0.1:3080/plugins/openpencil-marketing/bridge-call -d '{"command":"apply_design","args":{"patches":[{"op":"set","path":"nodes.0:4.props.x","value":175},{"op":"set","path":"nodes.0:5.props.y","value":260}]}}'` → `{"ok":true,"bridgeMs":13,"applied":[{"nodeId":"0:4","key":"x","value":175},{"nodeId":"0:5","key":"y","value":260}]}`（2026-08-22 实测）。
2. **改动落地复读**：再 `POST /rpc getDocumentTree` → 0:4.x=175、0:5.y=260 真实生效；随后第二轮 bridge-call 移 0:4.x→180 亦生效（2026-08-22 实测）。
3. **截图目检**：Playwright 截图（22:55）对照被核验方证据 `workbench/evidence/t16-b3-tool-e2e.png`（22:46）：矩形右移约 30px、椭圆下移约 60px，与补丁量（x +30 累计、y +60）一致；岛头「编辑器桥 已注册」绿点在线（2026-08-22 目检）。
4. **负例 A（坏节点 id）**：`nodes.bogus.props.x` → `{"ok":false,"error":"bridge /rpc HTTP 502: {\"ok\":false,\"error\":\"node not found: bogus\"}"}`，桥错误原样透传（2026-08-22 实测）。
5. **负例 B（畸形 path，含已应用条数）**：首条合法补丁 + 次条 `path:"bogus"` → `{"ok":false,"error":"bad path: bogus（仅支持 nodes.<id>.props.<key>；已应用 1 条）"}`（2026-08-22 实测）。

### V5 断线重连 + dispose——✅ PASS

1. **源码审**（`workbench/src/client/editor-boot.js`，2026-08-22）：`onUnmounted` → `intentionalClose = true` + `clearTimeout(reconnectTimer)` + `ws?.close()`（259-263 行）；`onclose` 中 `intentionalClose` 直接返回不重连（219-224 行）；`scheduleReconnect` 为固定 3s 退避（228-231 行）；`connect()` 每次先 fetch bridge-token 再开 WS（172-191 行）——故桥重启换 token 后 island 自动持新 token 重注册。
2. **实测重连（两轮桥重启）**：
   - 第一轮：`Stop-Process -Id 6520` → `node workbench/scripts/bridge-server.mjs` 后台重启（新 pid 14832、新 token）→ 约 2s 后 `/rpc ping` 即 200 pong——island 已在窗口内用新 token 重新 register（2026-08-22 实测）。
   - 第二轮（叠加 bridge-token 路由阻断做 V1-502）：kill 14832 → 重启（pid 10692、再换 token）→ 阻断期间 island 如实离线 → 解除阻断后 5s 内 `window.__openpencilIsland.bridge.registered === true`（registeredAt 刷新）、`curl /health` = `ok`、`getDocumentTree` 全树完好（此前补丁改动 0:4.x=180、0:5.y=260 均在）（2026-08-22 实测）。
   - 任务简报中「island 用旧 token 导致 register 失败」的情形未出现：因 connect() 每轮重连都重新 fetch token（本条第 1 项），两轮重启均自愈。
3. **测试噪音归因**：核验期间浏览器 console 22 条 error 全部可归因到核验动作本身——2 条桥停机窗口的 WS `ERR_CONNECTION_REFUSED` + 20 条我主动 `route.abort` 的 bridge-token fetch；island 自身 `errors` 数组为 0（Playwright evaluate + console_messages，2026-08-22）。
4. **环境恢复**：核验结束时桥在跑（pid 10692，`netstat` LISTENING + `/health` ok + island registered:true），`git status` 干净（2026-08-22）。

### V6 无占位（D19）——✅ PASS

1. **逐文件审**（2026-08-22 读源码）：
   - `workbench/src/index.js`（329 行）：`bridgeDiscoveryPath`（env 覆盖 + 三平台路径，镜像 packages/mcp paths.ts）、`serveBridgeToken`（GET only、读盘下发、失败 503）、`serveBridgeCall`（POST only、apply_design 走 `applyDesignExecute` 本体、异常 502 如实）、`callBridge`（discovery → POST /rpc Bearer + 5s 超时、非 200 携状态与错误体上抛）、`applyDesignExecute`（path 正则 + 逐条 setProps + 已应用条数标注）——全部真实实现，无桩。
   - `workbench/src/client/editor-boot.js`（343 行）：真桥客户端 + 最小命令面（ping/getSelection/getDocumentTree/createShape/setProps）直打 core editor API，未知命令如实 throw。
   - `workbench/scripts/bridge-server.mjs`（42 行）：`startServer` 复用 `packages/mcp/dist/server.mjs`，token 不打印日志，SIGINT/SIGTERM 优雅关闭。
   - 构建产物不过期：`workbench/lib/index.js` 内含同款 `callBridge`（`fetch http://127.0.0.1:${info.httpPort}/rpc`，sed 抽查 165-180 行实证；注：git bash 下 `grep '/rpc'` 会被 MSYS 路径转换坑出假阴性，须用 `grep rpc` 或 sed）；`workbench/lib/client.js` 含 `bridge-token`（2 处）与 `intentionalClose`（4 处）（2026-08-22）。
2. **占位词扫描**：对 `docs/rebuild/tasks/T16-plan.md`、`T16-self-check.md`、`T16-verify.md` 以全角「（待」前缀类模式（含三种变体写法，此处措辞绕开以免本文自匹配）grep → 无输出（exit 1，2026-08-22）。
3. **桩协议残留扫描**：`grep -c "ws-bridge-server\|BRIDGE_URL" workbench/src/index.js workbench/lib/index.js workbench/src/client/editor-boot.js` → 全 0；桩协议帧 `method:'ping'` 在 workbench/src、workbench/lib 零命中（2026-08-22）。

### V7 spike 桩退役如实——✅ PASS

1. dev 回路 7600 端口为真桥（见 V1-1，pid 6520→10692 均为 `bridge-server.mjs`，2026-08-22）。
2. 桩进程无存：`powershell Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Where CommandLine -match 'ws-bridge'` → 空（2026-08-22）。
3. 桩文件保留作证据：`spikes/s-x/ws-bridge-server.mjs` 存在（6152 字节，2026-08-22 `ls -la`）。
4. dev 回路配置无桩依赖：`grep -rn "ws-bridge-server" workbench/src workbench/scripts workbench/lib package.json workbench/package.json` → 无命中（exit 1，2026-08-22）。

### V8 远端 CI——✅ PASS

1. `gh run list -R another-momo/open-pencil --limit 5` → 最新 run id 32579903008（CI / rebuild/v2 / push）conclusion=success（2026-08-22）。
2. `gh run view 32579903008 -R another-momo/open-pencil --json headSha,conclusion` → `headSha=1de077acc4c83155ed9d242fce7b078db3123d81`（与本地 HEAD `1de077ac` 一致）、`conclusion=success`、`status=completed`（2026-08-22）。

### 如实记录的边界（非阻塞）

1. dsh agent loop（LLM 触发 `openpencil_apply_design`）端到端未验——无 LLM key，工具只能由 agent loop 触发；本次与自检一致，验到宿主进程内 `bridge-call` 的 apply_design 分支（与工具同一 `applyDesignExecute` 函数体，`workbench/src/index.js:142-144` 实证同路径）。该限制 T13 §3 已披露，不属本任务新增风险。
2. R2 残余风险不变：discovery 文件明文 token 同用户本机任意进程可读（packages/mcp discovery.ts 文件头自带告警；自检 §2.2-4 已记录）。

### 总结论

**V1-V8 全部 PASS，可以提交。** 核验期内对桥做了两轮 kill/重启实测，结束后环境已恢复（桥 pid 10692 在跑、island 已注册、工作区干净），无阻塞项。

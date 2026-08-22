<!--
  写作纪律（改本文前必读）：
  - 事实性声明必须附核验命令 + 日期，否则标为【假设】
  - 本文只保留当前态，不保留修正历史
  - 详细规则见 docs/rebuild/05-process.md §4
-->

# tasks/T16-self-check.md · T16 自检

> **T 编号**：T16（7600 桥真链路 + token 链）
> **状态**：✅ 已完成（B1-B4 全过；subagent 独立核验 V1-V8 全过「可以提交」，见 [T16-verify](T16-verify.md)；远端 CI HEAD run 32579903008 绿）

## 1. 完成度矩阵

| 工作项 | 状态 | 证据 |
|---|---|---|
| B1 桥 server 形态探针 + 真桥落地 | ✅ 通过（2026-08-22） | §2.2 探针 8/8 + 真桥 7600 起服实测 |
| B2 island 真实桥客户端 | ✅ 通过（2026-08-22） | §2.3 register + 读写命令 + 负例实测 |
| B3 host 工具真链路 | ✅ 通过（2026-08-22） | §2.4 双驱动 + 负例实测 |
| B4 冒烟 + 三件套收口 | ✅ 通过（2026-08-22）：端到端冒烟随 B3 证据完成 + subagent 独立核验 V1-V8 全过 + 远端 CI HEAD 绿 | [T16-verify](T16-verify.md) |

## 2. 实测记录

### 2.1 2026-08-22 注册期 recon：桥协议三角色 + token 机制 + 现状桩，全部源码实证

1. **真协议（旧 app 浏览器侧）**：`src/app/automation/bridge/server.ts:14-44` `connectAutomation(getStore, authToken)`——连 `ws://127.0.0.1:7600`，onopen 发 `{type:'register', token}`（token 缺省 `randomHex(32)` 自生成），收 `{type:'request', id, command, args}` 经 `createAutomationCommandHandlers(makeFigmaFromStore)` 在 EditorStore 上执行，回 `{type:'response', id, ...result}`（2026-08-22 读源码）
2. **真鉴权**：`packages/mcp/src/auth.ts`——bearer / `x-mcp-token` 头取 token，`isAuthorized` 用 sha256 + `timingSafeEqual` 比对；`packages/mcp/src/index.ts:79-90` token 缺省自动生成、空串显式关鉴权、纯空白报错；discovery 文件 `mcp.json`（`OPENPENCIL_MCP_DISCOVERY_PATH` 可覆盖）（2026-08-22 读源码）
3. **副客户端模式**：`packages/agent/src/bridge/ws-client.ts:111-121` `{type:'auth'}` 副客户端不抢浏览器注册槽（spike 01 §69 引证；2026-08-22 读 spike 文档）
4. **现状桩协议**：`spikes/s-x/ws-bridge-server.mjs`——`{id, method:'ping'|'echo'|'apply_design', params}` JSON 文本帧，内存迷你 SceneGraph，**无 register/auth 角色、无 token**；当前正占 127.0.0.1:7600（2026-08-22 `netstat -ano | grep :7600` LISTENING pid 9620）
5. **workbench 现状**：三工具已注册（`workbench/src/index.js`），`apply_design`/`bridge_ping` 经 `callBridge` 打桩协议（`applyDesignExecute` 一元包装是 dsh 二元调用的测试缝，注释固化）；island 侧仅 ping 心跳（`editor-boot.js` mountVueApp）；host 侧已 `inject = ["tools","systemPrompt","webServer"]` 且有 assets prefix 路由先例（T15）
6. **island 编辑器可读面**：`editor.getPages()/getChildren(id)` 实证可用（T15 §2.6）；节点 x/y/width/height/type 字段实测可读（2026-08-22 Playwright）
7. **端口语义**：`AUTOMATION_HTTP_PORT = 7600` 在 `packages/core/src/constants.ts:347`，是 open-pencil 自家端口，dsh 全仓零命中（spike 04 §C2 实证）

### 2.2 2026-08-22 B1 通过：standalone 复用 packages/mcp 拍板 + 真桥在 7600 起服

**结论：决策点 1 按判据拍板 standalone 复用 packages/mcp（探针 8/8 PASS）；真桥已顶替 spike 桩在 dev 回路起服。**

1. **探针**（`workbench/scripts/probe-bridge-b1.mjs`，2026-08-22 实测，7601 端口不干扰桩）：8/8 PASS——
   - server 独立启动（`startServer({httpPort, withTcp, socketPath:null, authToken})`，dist/server.mjs 导出）
   - `/health` 无客户端如实 `no_app`；editor WS 连接收到 `{type:'register', token:null}` 提示（**token 不泄漏**，browser-rpc.ts:150-160 注释语义实证）
   - 带 token register 后 `/health` 转 `ok`；`POST /rpc`（Bearer）中继到 editor 回包往返成功
   - 负例：错 token `POST /rpc` → 401；错 token WS register → 连接被拒（readyState 3 CLOSED）；无注册客户端时 `POST /rpc` → 502 + "app is not connected" 如实错误（不伪造成功）
2. **决策理由**（§1.2-1 判据满足）：三角色协议 + discovery + 鉴权全部现成且受测；桥生命周期独立于 dsh 插件重载；F0.2 语义原样保留，上游合流故事一致。备选（插件内建）弃用
3. **dev 回路落地**（2026-08-22 实测）：杀 spike 桩（pid 9620，命令行核实为 ws-bridge-server.mjs 后 Stop-Process）→ `node workbench/scripts/bridge-server.mjs` 起真桥（pid 6520）——`/health` 返回 `no_app` + `authRequired:true`；错 token /rpc → 401；discovery 文件落 `C:\Users\yeqin\AppData\Local\OpenPencil\mcp.json`（默认平台路径，`getDiscoveryPath()` 实证）
4. **discovery 机制**（`packages/mcp/src/transport/discovery.ts` 读源码）：JSON 含 pid/socketPath/httpPort/authRequired/**authToken 明文**（文件头注释自带告警：勿同步云盘；同用户任意进程可读——R2 残余风险如实记录）；写入原子化（tmp + rename，0o600）；读取时校验 pid 活性，陈旧文件返回 null
5. **已知瞬态**：island 侧旧心跳（桩协议 `{id,method:'ping'}`）对真桥不再有效，岛头桥状态显示离线——B2 换真实客户端即恢复，本任务内可接受

### 2.3 2026-08-22 B2 通过：island 真实桥客户端接通——register + 最小命令面读写全实测

**结论：island 经真桥 register 成功（ack 语义实证）；getDocumentTree 返回活编辑器真实场景；createShape/setProps 真实改图；未知命令如实报错。**

1. **token 链落地**（2026-08-22 实测）：宿主插件新增 exact 路由 `/plugins/openpencil-marketing/bridge-token`（读 discovery 文件下发 {port, token}；discovery 路径解析镜像 `packages/mcp/src/transport/paths.ts`）→ island `fetch` 同源取（`editor-boot.js` connect()）→ `curl` 实证返回真 token（与运行中桥 pid 6520 匹配）。威胁模型不扩面：同用户本机进程本即可读明文 discovery 文件（§2.2 第 4 条 R2 残余风险不变）
2. **register ack 语义**（`packages/mcp/src/browser-rpc.ts:240` 读源码）：连接欢迎提示 `{type:'register', token:null}`（token 永不内含）→ 客户端回 register+token → 成功后 server 广播第二轮提示——客户端以"第二轮提示"为 ack。实测：header 显示「编辑器桥 已注册」、`window.__openpencilIsland.bridge = {registered:true, registeredAt}`、errors 0
3. **最小命令面实测**（curl POST /rpc 带 Bearer，2026-08-22）：
   - `getDocumentTree` → Page 1 下 FRAME 0:3(100,100) / RECTANGLE 0:4 / ELLIPSE 0:5 三节点真实返回
   - `createShape` RECTANGLE (500,120,80,80) → 树新增 0:6；`setProps` 0:4 x→222 返回更新后节点快照
   - 负例：`dropDatabase` → `{ok:false, error:"unknown command: dropDatabase"}` 如实
4. **dispose 接入 E3 链**：onUnmounted → intentionalClose + clearTimeout(reconnectTimer) + ws.close()；重连 3s 退避；周期 ping 删除（server 侧 25s WS 协议层心跳已在，`server.ts` HEARTBEAT_INTERVAL 实证）
5. **证据**：evidence/t16-b2-bridge-live.png（header 已注册 + 桥建节点 0:6 与移位 0:4 画布可见）
6. **测试自省**：浏览器内跨域 fetch 7600/health 触发 2 条 CORS console error——是测试动作引入而非岛代码（island errors 数组 0）；桥健康检查一律走 curl，不走页面上下文

### 2.4 2026-08-22 B3 通过：host 工具真链路——补丁翻译 + 双驱动验证 + 负例如实

**结论：openpencil_apply_design 从打桩翻成真实链路——宿主进程内经 discovery token + POST /rpc 改 island 活画布；离线与宿主内双驱动验证；负例全部如实报错。**

1. **callBridge 重写**（`workbench/src/index.js`，2026-08-22）：桩协议短连 WS → discovery 读 {httpPort, authToken} + `POST /rpc`（Bearer，AbortSignal.timeout 5s）；非 200 原样上抛（HTTP 状态 + 桥错误体）。WebSocket 依赖与 BRIDGE_URL 常量随之从 host 侧移除（client 侧 BRIDGE_URL 同步移除，token 路由下发 port）
2. **apply_design 补丁翻译**：`nodes.<id>.props.<key>` set 补丁 → island 最小命令面 setProps 逐条执行；不支持 op/坏 path/桥失败全部 throw 并如实标注已应用条数
3. **离线缝实测**（node 直调 lib/index.js 导出，2026-08-22）：applyDesignExecute 移 ellipse 0:5 → x=333（bridgeMs 84）；坏 path → `bad path: bogus（仅支持…；已应用 0 条）`；discovery 缺失（env 指向不存在文件 + 真实补丁）→ ENOENT 如实上抛
4. **宿主进程内实测**（bridge-call 诊断缝 `/plugins/openpencil-marketing/bridge-call`，与工具同 callBridge 路径，2026-08-22）：ping → island pong；getSelection 如实返回空选；apply_design 双补丁（0:5.x=430, 0:4.y=240）→ `{ok:true, bridgeMs:13, applied:[...]}`；未知命令 → 502 桥错误原样透传。存在理由注释固化：dsh 工具只能由 agent loop 触发（无 LLM key 无法端到端驱动），本缝提供宿主内真实执行证据
5. **证据**：evidence/t16-b3-tool-e2e.png（整页刷新后干净页面上工具改图的画布实况，console 0/0）；期间宿主两次重启导致的 25 条 console 噪音逐条归因——2 条我的 CORS 测试 fetch + 23 条 dsh web-runtime 自身重连日志，零岛代码（§2.3 第 6 条同类）
6. **自述局限**：applyDesignExecute 的宿主内执行经 bridge-call 的 apply_design 分支实证（同一函数体），非 dsh agent loop 触发——LLM 端到端阻塞在 owner 补 key（T13 §3 已披露），本任务验到工具代码面

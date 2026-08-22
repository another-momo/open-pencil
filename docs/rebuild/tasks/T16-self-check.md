<!--
  写作纪律（改本文前必读）：
  - 事实性声明必须附核验命令 + 日期，否则标为【假设】
  - 本文只保留当前态，不保留修正历史
  - 详细规则见 docs/rebuild/05-process.md §4
-->

# tasks/T16-self-check.md · T16 自检

> **T 编号**：T16（7600 桥真链路 + token 链）
> **状态**：🔄 开工（B1 未开始；注册期 recon 已完成，见 §2.1）

## 1. 完成度矩阵

| 工作项 | 状态 | 证据 |
|---|---|---|
| B1 桥 server 形态探针 + 真桥落地 | ✅ 通过（2026-08-22） | §2.2 探针 8/8 + 真桥 7600 起服实测 |
| B2 island 真实桥客户端 | ⬜ 未开始 | — |
| B3 host 工具真链路 | ⬜ 未开始 | — |
| B4 冒烟 + 三件套收口 | ⬜ 未开始 | — |

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

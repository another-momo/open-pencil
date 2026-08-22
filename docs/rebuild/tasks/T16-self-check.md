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
| B1 桥 server 形态探针 + 真桥落地 | ⬜ 未开始 | — |
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

# T74 计划 · 桥探针 502 修复（启动时序 race）

## 1. 根因（Playwright 实测实证，2026-09-02）

vite `configureServer` 里 `enqueue(startChild)` **异步** spawn 桥子进程（`bun run packages/mcp/src/index.ts`，监听 7600）；浏览器 `WorkspaceView.onMounted` 立刻调 `startMCPRuntime()`，此时桥还没 listen → `configureDevMCP()` POST `/__openpencil/mcp/restart` 到 vite（200 但桥没起来）或 `pollHealth` 拿不到 200 → `startOperation` 进 catch → **编辑器 `connectAutomation()` 从未被调** → 桥永远 `status: no_app` → 后续 `active_design` 桥探针不可达、`undo_group` 502。

**实证**：
- dev.log 三次 `OpenPencil MCP server HTTP: http://127.0.0.1:7600`（vite reload 各起一次）但无 `[Automation] WebSocket connected` 日志
- 浏览器侧 `__OPENPENCIL_LOCAL_AUTOMATION_TOKEN__/URL/HTTP_URL` 全部注入（dev define）
- 手动 `new WebSocket(ws://127.0.0.1:7600)` → open
- 手动 POST `/__openpencil/mcp/restart` → 204
- 手动调 `startMCPRuntime()` → `status: running, version: 0.14.0` + health `status: ok, toolsCount: 122`

## 2. 修法（最小入侵）

`src/app/automation/mcp/runtime.ts` `startOperation` 加 N 次指数退避重试：
- 5 次尝试，间隔 200ms / 500ms / 1s / 2s / 4s（总 ≤7.7s，覆盖 vite 桥慢起的典型窗口）
- 每次失败记录 `state.error` 但不置 `state.status='error'`（重试中保持 `starting`）
- 全部失败才走原 catch 分支（`disconnectCurrentServer` + `state.status='error'`）
- 不改 `restart` / `refresh` / `stop` 语义

**不动**：spawn.ts、bridge/vite-plugin.ts、bridge/server.ts——只在 runtime 层补重试，最小改动面。

## 3. 验收标准

- [ ] `bun test tests/engine/rebuild/` 全绿
- [ ] 新增钉扎测试 `tests/engine/rebuild/mcp/runtime-startup-race.test.ts`：
  - spawn mock 前 2 次 readHealth 返回 null（桥慢起）→ 断言 startMCPRuntime 最终 status='running'
  - spawn mock 全部 5 次失败 → 断言 status='error' + error.message 含最后一次错误
  - 重试间隔序列钉扎 [200, 500, 1000, 2000, 4000]
- [ ] lint / typecheck / format / zones / i18n 全绿
- [ ] zones.json 登记 P141（runtime.ts，T74）

## 4. 边界（不做）

- 不改桥 vite-plugin 的 spawn 时机（属于另一层风险）
- 不改 `restart` / `refresh` 的重试语义
- 不动 T73 的 abort signal 透传（T74 通了再单测）

## 5. 验证

- [ ] 浏览器实测：vite 起后立刻打开页面 → 桥探针应变 `ok`（不再 `no_app`）
- [ ] 手动调用 `startMCPRuntime()` 仍返回 ok（幂等）

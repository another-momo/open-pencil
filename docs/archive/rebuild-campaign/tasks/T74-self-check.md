# T74 自检 · dev 桥启动时序 race（startMCPRuntime 退避重试）

> 日期：2026-09-02。实施 = 主 agent（T73 实测中被 T74 阻塞后顺藤摸出的 P0 前置修复）。

## 1. 交付（对照 T74-plan §2/§3）

- `src/app/automation/mcp/runtime.ts`（P141）：
  - `startOperation` 由「单次 spawn→readHealth→失败即 error 弃连」改为退避重试循环：总尝试 1+5 次，失败间隔走 `MCP_STARTUP_RETRY_DELAYS_MS = [200, 500, 1000, 2000, 4000]`（导出常量，总窗口 ≤7.7s，覆盖典型 bun spawn→listen 窗口）；任一尝试成功即 `applyHealth` + `connectAutomation` 返回；全部失败才走原 error 收口（disconnectCurrentServer 清 server 句柄、`status='error'`、console.warn）。
  - `MCPRuntimeDependencies` 增可选 `sleep?: (ms) => Promise<void>` 注入点——缺省真等 setTimeout，测试注入零延迟。
- `tests/engine/rebuild/mcp/runtime-startup-race.test.ts`（新，3 用例全绿）：① 前 2 次 readHealth 返 null（桥慢起）→ 最终 running、spawn/readHealth 各 3 次、connect 恰 1 次、sleeps=[200,500]（成功即停）；② 全部失败 → error、spawn 6 次（=1+DELAYS.length）、connect 0 次、sleeps 全序列；③ 间隔序列逐值钉扎 [200,500,1000,2000,4000]。
- `tests/engine/app/automation/mcp-runtime.test.ts`（P142 伴随）：「reports startup failure…」用例注入零延迟 sleep——重试引入后该用例若真等 7.7s 会超 bun 5s 超时（实证 5015ms 超时后修）；失败收口语义断言（error + disconnect-server 恰一次）不变。
- `tools/zone-registry/zones.json`：P141（runtime.ts）+ P142（mcp-runtime.test.ts）登记，均挂 T74。

## 2. 浏览器实证（验收标准：全新 vite 零手动干预自动连桥）

- 环境：杀掉上一轮调试遗留 dev 进程后全新 `bun run dev`（vite 1420 / 桥 7600 / pi-backend 7700，日志 /tmp/t74-dev.log）。
- 页面打开前基线：`curl 127.0.0.1:7600/health` → `status:"no_app"`。
- 浏览器新开 `http://localhost:1420/`（标题 OpenPencil），**全程无任何手动 startMCPRuntime 调用**；页面加载后第 1 次轮询（t=1s）桥即 `status:"ok"`。
- 页内探针（注入 module script 读 `/src/app/automation/mcp/runtime.ts` 的 `mcpRuntime`）：`status:'running'`、`error:null`、`version:'0.14.0'`、`port:7600`。
- 对照修复前（T74-plan §1 实证）：同路径 fresh 启动桥永远 `no_app`、active_design/undo_group 探针 502，需手动 `startMCPRuntime` 才救回。

## 3. 门禁（unpiped）

- `bun test tests/engine/app/automation/mcp-runtime.test.ts tests/engine/rebuild/mcp/runtime-startup-race.test.ts` → 9 pass / 0 fail / 34 expects。
- `bun run lint` → 0 errors（warnings 均为既有 max-lines，与本任务文件无关）。
- `bunx tsgo --noEmit` → exit 0；`bun run check:vue` → exit 0。
- `bun run format:check` → all correct（oxfmt --write 仅施于本任务 4 个触及文件）。
- `bun run check:zones` → clean（85 modified all registered）。
- `bun run check:i18n` → in sync；`bun run check:docs` → 44/44。
- 全量 `bun test`：**按 owner 指示不在本机跑**（2026-09-02 owner 原话「有的测试和你改动无关的话就不要在本机跑了，交给CI」）。本机首跑曾因调试遗留 dev 进程占端口（EADDRINUSE）污染出 67 fail；清端口后重跑剩余 fail 集中在字体/渲染/heavy .fig fixture 类（flattenSelected、renderText headless、font weights 等），与本改动域（MCP 启动）无交集，且该套件在本 Windows 机的环境性失败为已知常态——全量绿与否以 Linux CI 为准。

## 4. 偏差

1. 全量测试本机弃权（owner 指示，见 §3）；本地钉扎仅覆盖本任务直接相关的两个测试文件。
2. lint 修复三处：`no-promise-executor-return`（setTimeout executor 改块体）、`no-empty-function`（noop 改仓内通行 `() => undefined` 式）、`no-broad-double-cast`（getStore 改用既有测试同款 `({}) as never`）。
3. 计划外登记 P142：既有测试文件属上游文件，伴随修改需独立 patch 行（zones 门禁实证拦截）。
4. 残留观察（不修，与 T74 无关）：dev 日志 `OpenPencil MCP server` 打印 3 次/启动（startChild + configureDevMCP 重启路径），与前次会话记录一致；桥重启幂等，不影响注册。

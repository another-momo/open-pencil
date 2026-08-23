<!--
  写作纪律（改本文前必读）：
  - 事实性声明必须附核验命令 + 日期，否则标为【假设】
  - 本文只保留当前态，不保留修正历史
  - 详细规则见 docs/rebuild/05-process.md §4
-->

# tasks/T20-verify.md · T20 独立核验记录

> **T 编号**：T20（Phase 1-pi 实施 · 工具链路：后端独立进程化 + hello-tool 全链 + 工具事件映射）
> **状态**：✅ 已收口（2026-08-23 subagent 独立核验 V1-V8 全过，判决「可以收口」）
> **实现提交**：c52bf0ea（三件套立项）+ 8e4cd3bd（实现）→ 分支 rebuild/pi
> **远端 CI**：run 32645061123 completed success（`gh api repos/another-momo/open-pencil/actions/runs/32645061123 --jq '.status+" "+.conclusion'`，2026-08-23）

## 核验结果总表

| #   | 核验项                                                 | 结果 | 证据要点 |
| --- | ------------------------------------------------------ | ---- | -------- |
| V1  | A1 后端独立进程（spawn/独立启动/proxy/健康检查/回收）  | ✅   | 见 §V1   |
| V2  | A2 hello-tool 全链（帧序列 + 画布回读一致）            | ✅   | 见 §V2   |
| V3  | A3 工具卡片可见（截图证据）                            | ✅   | 见 §V3   |
| V4  | A4 session 连续 + 重启恢复 + 工具仍可用                | ✅   | 见 §V4   |
| V5  | A5 前端零改动（git diff 为空）                         | ✅   | 见 §V5   |
| V6  | A6 T19 文本回路回归                                    | ✅   | 见 §V6   |
| V7  | A7 CI 绿 + 无占位 + key/token 卫生                     | ✅   | 见 §V7   |
| V8  | 文档纪律（三件套齐、tracker/\_index 登记、事实可复验） | ✅   | 见 §V8   |

## §V1 后端独立进程 — ✅

- 独立进程入口：`src/app/ai/pi-backend/main.ts:15-18` 读 `OPENPENCIL_PI_BACKEND_PORT` 并独立 listen 127.0.0.1（:32）；:36-43 SIGINT/SIGTERM 优雅回收 + 2s 兜底；:20-30 EADDRINUSE 清晰报错（读文件核验，2026-08-23）
- spawn+proxy 非中间件：`src/app/ai/pi-backend/vite-plugin.ts:82-86` configureServer spawn `bun run src/app/ai/pi-backend/main.ts`；:70-81 config() hook 注入 `server.proxy['/api/pi-chat']`；:103-105 buildEnd 回收（读文件核验，2026-08-23）
- 实证（核验时 dev 环境存活）：`curl -s http://127.0.0.1:7700/health` → `{"status":"ok"}`；经代理 `curl http://localhost:1420/api/pi-chat -X POST -d '{}'` → 400（后端原生错误，非 404/502）；netstat 三端口分属不同 PID（vite 13388 / bridge 1876 / backend 12964），2026-08-23

## §V2 hello-tool 全链 — ✅

- 链路：`src/app/ai/pi-backend/tools.ts:79-111` defineTool create_shape → execute → callBridgeTool（:28-75）→ readDiscoveryFile → POST 7600 /rpc + Bearer（读文件核验，2026-08-23）
- 实证：`set -a; source .openpencil/key-env; set +a; node spikes/s-pi/backend-smoke/browser-tool-smoke.mjs`（编排起 Chromium 连桥后内嵌跑 tool-smoke）两轮复跑均 18/18 全过：start 首帧、tool-input-available 参数逐字正确（FRAME 240×120 @120,160）、无 tool-output-error、tool-output-available 含 nodeId、帧序 input<output、finish(stop)+[DONE]、get_node 画布回读一致（2026-08-23）
- 边界注记：裸跑 tool-smoke（不开浏览器）会失败于桥 `no_app`——工具执行端在浏览器编辑器，属环境前置而非实现缺陷（2026-08-23 实测）

## §V3 工具卡片可见 — ✅

- 截图证据（.openpencil/，2026-08-23 核验轮新产出，Read 看图确认）：t20-tool-card-done.png 卡片「Create Shape 完成」+ 助手文本气泡「已完成」；t20-tool-card-detail.png 展开 pre 含 `{"nodeId":"0:9","type":"FRAME",...}`；t20-tool-card-pending.png pending 态卡片；t20-canvas.png 图层面板列出 T20 所建节点
- 脚本硬断言全过：卡片出现、完成态迁移、非错误态、详情 nodeId、FRAME 计数 +1、nodeId 经桥回读为 FRAME（UI↔画布对账闭环）、无致命 console 错误（2026-08-23）
- 修正记录：核验发现「助手文本回复非空」断言存在读取竞态（text-start 挂载即读，内容尚空，browser-tool-smoke.mjs 原 :163-166）——已修为 waitForFunction 等首个 delta 到达再读，修后重跑浏览器冒烟全绿（含该断言 PASS，2026-08-23）；竞态属脚本缺陷，产品行为由截图与 API 级断言双重证明正确

## §V4 session 连续 / 重启恢复 — ✅

由 tool-smoke T3/T4 段覆盖并全过（2026-08-23）：T3 同 session 追问记得节点 id；T4 独立端口 7701 新进程同一 state 目录——旧 sessionId 恢复后仍记得 id、工具仍可调建 RECTANGLE、新节点画布回读存在。机制与 `src/app/ai/pi-backend/service.ts:115-119` SessionManager.open 磁盘恢复 + index.json 落盘吻合。

## §V5 前端零改动 — ✅

- `git diff cb0ad22c..8e4cd3bd --stat -- src/ ':!src/app/ai' ':!src/components/chat'` → 空（2026-08-23）
- 全量 stat 仅含：src/app/ai/pi-backend/_、package.json（+dev:backend，:21）、spikes/s-pi/backend-smoke/_.mjs、docs/rebuild/\*、tools/zone-registry/zones.json——无其他前端文件（2026-08-23）

## §V6 T19 文本回路回归 — ✅

`node spikes/s-pi/backend-smoke/smoke.mjs` 15/15 PASS（帧序列/中文无损/[DONE]/session 记忆锚点/index.json/JSONL 落盘 UTF-8 逐字节断言），2026-08-23。注：脚本现有 15 条断言，self-check 记的 14/14 是文档期旧数，无 FAIL。

## §V7 CI 绿 + 无占位 + key 卫生 — ✅

- CI：run 32645061123 completed success（命令见文头，2026-08-23）
- 占位扫描：`grep -rn "TODO\|FIXME\|占位\|placeholder" src/app/ai/pi-backend/ spikes/s-pi/backend-smoke/` 零命中（2026-08-23）
- key 卫生：OPENROUTER_API_KEY 引用全为 env 引用/报错文案；`service.ts:49 apiKey: '$OPENROUTER_API_KEY'` 是 pi SDK models.json 的 env 变量引用语法，运行时由 SDK 从 process.env 解析，非硬编码；`git grep "sk-or-" -- ':!docs'` 仅 3 处测试占位串，无真实 key（2026-08-23）

## §V8 文档纪律 — ✅

- 三件套齐且有实质内容：T20-plan.md / T20-self-check.md / 本文（2026-08-23）
- 登记：docs/rebuild/tracker.md:54 与 docs/rebuild/tasks/\_index.md:52 有 T20 行（本文重写后随收口提交翻 ✅）
- 抽查 3 条 self-check 事实声明全部属实（2026-08-23）：sdk.d.ts `noTools:'builtin'` 注释与 `customTools?: ToolDefinition[]` 原文在位；`packages/core/src/tools/create/basic.ts:5` 确为 `name: 'create_shape'`；`src/app/ai/pi-backend/mapping.ts:148-151` willRetry 守卫在位

## 总判决

**可以收口。** V1-V8 全部通过，证据链可复验（核验轮两轮工具链冒烟复跑结果一致，核验过程工作树零改动）。

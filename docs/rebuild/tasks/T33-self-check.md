<!--
  写作纪律（改本文前必读）：
  - 事实性声明必须附核验命令 + 日期，否则标为【假设】
  - 计划被实测推翻时，直接改本文为新版本，完整理由记入 records/ 子文档
  - 本文只保留当前态，不保留修正历史
  - 改完后刷新本文头部的「状态」字段
  - 详细规则见 docs/rebuild/05-process.md §4
-->

# T33 自检 · localhost 分发骨架（生产编排器 host.ts）

> **状态**：已核验 | **时间**：2026-08-26 | **核验人**：主 agent

## 1. 交付物

- `src/app/ai/pi-backend/host.ts`（新建，~300 行）：生产编排器——spawn MCP 桥 + pi 后端、就绪探针、dist 静态托管（MIME + SPA fallback + index.html 运行时 token 注入）、`/api/pi*` 流式反代、SIGINT 级联退出。
- `src/app/automation/mcp/spawn.ts`（P104）：运行时 token hook + 非 Tauri 分支 host 托管路径。
- `src/app/automation/mcp/runtime.ts`（P105）：canConnect 放行 host 托管形态。
- `package.json`（P103）：`"serve": "bun run src/app/ai/pi-backend/host.ts"`。
- `tools/zone-registry/zones.json`：P103/P104/P105 登记。

## 2. 冒烟实测（S3，2026-08-26）

| 项 | 命令/操作 | 结果 |
|---|---|---|
| 构建 | `bun run build:packages` + `bunx vite build` | ✅ 32.6s / 22.3s |
| 起栈 | `bun run serve` | ✅ 桥→后端→host 顺序就绪（后端冷启动 ~8s，探针 warn 后转就绪） |
| C1 静态 | `curl http://localhost:8080/` | ✅ 200，含 `__OPENPENCIL_RUNTIME_AUTOMATION_TOKEN__` 注入（grep=1） |
| C2 反代 | `curl http://localhost:8080/api/pi/catalog` | ✅ 200（Bearer 由 host 注入） |
| C3 SSE | `curl -N -X POST /api/pi-chat`（真实模型） | ✅ reasoning delta 逐 chunk 流式流出 |
| C4 全链 | 浏览器（ZCode IAB）打开 8080 → AI 面板 → 发「在画布中央创建一个100x100的矩形」 | ✅ 图层树出现「矩形」节点 + Create Shape 完成卡片 + 模型回复 ID 0:5（截图存证于会话 artifacts） |
| 级联退出 | TaskStop 杀 host | ✅ 7600/7700 无孤儿（netstat 空） |
| recovery 联动 | reload 触发 RecoveryDialog | ✅ 正常拦截与恢复（T31 快进成果在 prod 形态工作） |

## 3. 冒烟揪出并当场修复的 bug（3 处）

1. **EISDIR 崩溃**：`existsAsFile` 用 accessSync（目录也通过）→ `'/'` 把 dist 目录当文件流读 → 未捕获流错误炸进程。修：`statSync().isFile()` + sendFile 流 error 兜底 500。
2. **反代前缀漏配**：`/api/pi-chat` 不匹配 `startsWith('/api/pi/')` → POST 落静态分支吃 405。修：前缀语义对齐 vite proxy 的裸 `/api/pi`。
3. **type-aware 收窄**：stopChild 直读 `child.exitCode` 被收窄定死、循环比较判「不可能」。修：照 vite-plugin hasExited 闭包先例。

## 4. 机制发现（重要）

生产 web 形态编辑器连不上桥的上游根因是**两道硬闸**（均属上游 Tauri 生产形态假设）：
- `spawn.ts startMCPIfNeeded`：非 Tauri 直接 `return null`（P104 修）；
- `runtime.ts canConnect`：`DEV || isTauri()` 恒 false（P105 修）。
两处均为 pendingReclass 文件的最小加法 hook，dev/Tauri 语义不变，重分类仪式时一并处置。

## 5. 门禁（S4，2026-08-26）

format:check ✅ / lint 0 errors（3 存量 max-lines warnings）✅ / typecheck（tsgo + vue-tsc×2）✅ / zones ✅（78 modified all registered）/ docs 40/40 ✅ / bindings ✅ / arch ✅ / monorepo ✅ / tasks ✅（P103-P105 摘要）/ smoke:pi 19 passed ✅。

## 6. 教训与备查

- 上游「生产形态 = Tauri 桌面」假设渗透在 spawn/runtime 两处——localhost web 分发是上游没有的形态，接入点必须以最小 hook + patch 台账落地，不做结构性改写。
- `bun run serve` 与 `bun run dev` 互斥（7600/7700 端口冲突），子进程报错文案已转译。

## 7. 关联文档

- plan：[T33-plan.md](T33-plan.md)
- verify：[T33-verify.md](T33-verify.md)
- 索引：[tasks/_index.md §2](../tasks/_index.md)
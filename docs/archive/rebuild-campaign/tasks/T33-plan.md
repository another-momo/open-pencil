<!--
  写作纪律（改本文前必读）：
  - 事实性声明必须附核验命令 + 日期，否则标为【假设】
  - 计划被实测推翻时，直接改本文为新版本，完整理由记入 records/ 子文档
  - 本文只保留当前态，不保留修正历史
  - 改完后刷新本文头部的「状态」字段
  - 详细规则见 docs/rebuild/05-process.md §4
-->

# T33 计划 · localhost 分发骨架（生产编排器 host.ts）

> **状态**：已核验 | **时间**：2026-08-26 | **核验人**：主 agent
> **分支**：`rebuild/pi-host`（自 dbc4ee0e 拉出）
> **上游钉扎**：88c10770（不变）

## 1. 定位与设计决策

把 vite dev server 客串的"编排器"职责落成生产入口——`bun run build && bun run serve` 一条链起完整产品（编辑器 UI + chat + 工具桥）。只搭框架：不含打包单可执行、首跑 key 引导 UI、自动升级（留 T34+）。

| 决策 | 选择 | 理由 |
|---|---|---|
| 落位 | `src/app/ai/pi-backend/host.ts`（ownedRoot 内） | 免 zones 新登记；与 main/server/vite-plugin 同居一目录；tsgo/lint 天然覆盖 |
| 子进程 env 构建 | 复制两插件的 env 语义（各约 10 行），不 import automation 面代码 | automation 在 pendingReclass 区且声明「只允许相对导入」约束；重分类仪式未到不动它 |
| 反代 | node:http 手写迷你反代：`/api/pi*` → 127.0.0.1:7700，注入 Bearer，流式管道透传（SSE 不缓冲，客户端断连即销毁上游请求） | 与 vite proxy 行为等价；零新依赖 |
| 静态托管 | node:http 手写：dist/ MIME 表 + SPA fallback + **index.html 现读现注桥 token 运行时全局** | 上游生产形态靠 Tauri 读 discovery，web 形态无该通道（见 P104） |
| token 协商 | host 进程生成 → env `OPENPENCIL_PI_TOKEN` / `OPENPENCIL_MCP_AUTH_TOKEN` 注入子进程 | 浏览器永远见不到 pi token；桥 token 经注入脚本进同源页面（编辑器连 WS 必需） |
| 端口 | 主服务 `OPENPENCIL_SERVE_PORT`（默认 8080）；子进程沿用 7600/7700 常量 | 桥端口经 discovery 动态发现 |

## 2. 任务清单（实施记录）

1. **S1a spawn.ts P104**：桥 token 解析加运行时注入 hook（`window.__OPENPENCIL_RUNTIME_AUTOMATION_TOKEN__` 优先）+ `startMCPIfNeeded` 非 Tauri 分支改为「有运行时 token 即 poll health 并返回 handle」（原 `return null` 使生产 web 永远不连桥）。
2. **S1b host.ts**：spawn×2 + 就绪探针（后端 /health、桥 discovery 文件）+ 静态托管 + 反代 + SIGINT 级联退出。
3. **S1c runtime.ts P105**：`canConnect` 放行 host 托管形态（原 `DEV || isTauri()` 恒 false，编辑器永不 attach）。
4. **S2**：package.json 加 `"serve"`（P103）；zones 登记 P103/P104/P105。
5. **S3 冒烟**：build → serve → curl 三项 + 浏览器实测全链（见 self-check §3）。
6. **S4 门禁全套** + **S5 三件套/推送**。

## 3. 验收标准

| # | 验收 | 结果 |
|---|---|---|
| C1 | `bun run build && bun run serve` 起全栈，浏览器编辑器+AI 面板加载 | ✅（self-check §3） |
| C2 | `/api/pi*` 经反代 200（token host 内部注入） | ✅ catalog 200 |
| C3 | SSE 经反代流式不缓冲 | ✅ 真实模型 reasoning delta 逐 chunk 流出 |
| C4 | 工具全链：chat → 模型 → create_shape → 桥 → 编辑器执行 | ✅ 图层树出现「矩形」+ Create Shape 完成卡片（截图存证） |
| C5 | 门禁全套 exit 0 + smoke:pi 绿 | ✅ |
| C6 | zones 合规（host.ts 落 ownedRoot；P103-P105 登记） | ✅ |
| C7 | CI 双链 success @ 同 SHA | 推送后复验 |

## 4. 不做（出栈）

bun compile 打包、安装器、首跑 key 引导 UI、vite 插件重构为共享模块、远程多用户——T34+ 或永不。

## 5. 风险与实测

- Windows：桥强制 TCP（`OPENPENCIL_MCP_TCP=1`）✅ 实测；SIGINT 级联退出 ✅ 实测（TaskStop 杀 host 后 7600/7700 无孤儿）。
- dev/prod 互斥：子进程 EADDRINUSE 有明确文案（passthroughStderr 拦截转译）。

<!--
  写作纪律（改本文前必读）：
  - 事实性声明必须附核验命令 + 日期，否则标为【假设】
  - 本文只保留当前态，不保留修正历史
  - 改完后刷新本文头部的「状态」字段
  - 详细规则见 docs/rebuild/05-process.md §4
-->

# tasks/T15-self-check.md · T15 自检

> **T 编号**：T15（M2 编辑器入孤岛）
> **状态**：🔄 进行中（E1 未开始；注册期 recon 已完成，见 §2）

## 1. 完成度矩阵

| 工作项 | 状态 | 证据 |
|---|---|---|
| E1 CanvasKit wasm 初始化探针 | ✅ 通过（2026-08-22） | §2.1 实测值 + [evidence/t15-e1-canvaskit-island.png](../../../workbench/evidence/t15-e1-canvaskit-island.png) |
| E2 编辑器外壳入孤岛 | ⬜ 未开始 | — |
| E3 生命周期/状态对齐 | ⬜ 未开始 | — |
| E4 冒烟 + 三件套收口 | ⬜ 未开始 | — |

## 2. 实测记录（按时间倒序，最新在上）

### 2.1 2026-08-22 E1 通过：CanvasKit wasm 在 island 初始化 + 实画 + 像素回读全过

**结论：全路线最大未知（R1）证伪通过——定案方案（webServer prefix 路由供 wasm）一次跑通，无需启用 base64 备选。**

实测值（Playwright 驱动 Chromium，`http://127.0.0.1:3080/`，2026-08-22）：

| 项 | 实测 | 取证方式 |
|---|---|---|
| wasm 路由 | `GET /plugins/openpencil-marketing/assets/canvaskit.wasm` → 200，`content-type: application/wasm`，`content-length: 7159342`（与包内文件字节一致） | curl |
| 目录逃逸 | 裸 `../` 与编码 `%2e%2e` 遍历均 404（WHATWG URL 规范化 + 路由 startsWith 守卫双保险） | curl `--path-as-is` |
| 探针状态 | `window.__openpencilIsland.canvaskit` = `{status:"ok", runs:1, wasmHttpStatus:200, wasmBytes:7159342, initMs:485, insidePixel:[255,0,0,255], outsidePixel:[0,0,0,0], pixelCheck:true}` | 浏览器 evaluate |
| 可见性 | island 面板「CanvasKit 在线 · 485ms」+ 96×96 画布红矩形可见 | 截图 evidence/t15-e1-canvaskit-island.png |
| console | 0 错 0 警告（warning 级及以上合计 0 条） | Playwright console_messages |
| 初始化耗时 | 485ms（wasm 下载+编译+初始化合计，localhost）——编辑器入岛可行性正面信号 | 探针自记 |

实施中修正的一处源码细节（诚实记录）：webServer `match()` 要求 `pathname === prefix || startsWith(prefix + "/")`，注册带尾斜杠的 prefix 会拼成双斜杠永不命中——首版注册 `/plugins/openpencil-marketing/assets/` 实测 404，改不带尾斜杠后通过（`workbench/src/index.js` 注释已固化，dsh-host-webserver `match()` 源码 2026-08-22 实证）。

配套落地：`workbench/scripts/copy-assets.mjs`（build/dev 前置拷贝 wasm 入包内 `assets/`，幂等）；`assets/` 入 .gitignore（可从 node_modules 派生，7MB 二进制不入库）；`files` 加 `assets/`；`canvaskit-wasm` 钉 `0.41.1` exact。

### 2.2 2026-08-22 注册期 recon：wasm 资产服务方案定案（E1 前置未知已消解）

E1 的唯一前置未知「dsh 宿主能不能供 wasm 资产」已在注册期以源码实证定案：

1. **`serveBundle` 白名单实证**：`dsh-client-modules/lib/index.js` `serveBundle` 只对 pathname 以 `/plugins/` 开头且以 `/client.js` 或 `/client.js.map` 结尾的请求出文件，其余一律 404（2026-08-22 读源码；T14 已实测 package.json/preset.yml 404）
2. **`webServer.register` 路由注册 API 实证**：`dsh-host-webserver/lib/index.js` —— 服务名 `webServer`（构造函数 `super(ctx, "webServer")`），`register({kind, path, handler})` 入 prefix/exact 两张表，重复 path 才 throw；prefix 匹配最长优先（`prefix.length > best.path.length`），故 `/plugins/openpencil-marketing/assets/` 可压过 dsh-client-modules 的 `/plugins/` 前缀；`dsh-client-hmr` 的 exact `/plugins/events` 与其共存为先例（2026-08-22 读源码）
3. **插件侧用法先例实证**：`dsh-host-frontend-static/lib/index.js` —— `export const inject = ["webServer"]`，`ctx.webServer.registerFallback(...)`（2026-08-22 读源码）
4. **CanvasKit 版本/体积实测**：`node_modules/canvaskit-wasm/package.json` version = 0.41.1（root `package.json` 钉 `^0.41.1` 的实际解析）；`bin/canvaskit.wasm` = 7,159,342 bytes（2026-08-22 `ls -la` 实测）。workbench 侧钉 exact `0.41.1`
5. **本仓 locateFile 机制**：`packages/core/src/canvaskit.ts` `getCanvasKit()`——浏览器臂 `locateFile` 返回 `${BASE_URL}/${file}`，即期待同源静态服务；island 场景由本插件路由顶替（2026-08-22 读源码）

**备选方案**（定案遇阻时启用）：canvaskit.wasm base64 inline 进 client.js（约 9.5MB），无需宿主路由，确定可行但 bundle 重。

### 2.3 2026-08-22 本仓编辑器资产盘点（E2 前置）

- 无 `old/` 目录——spike 04 文中 "old/src" 即指本仓当前 `src/`（Vue 3 编辑器 UI）+ `packages/*` 引擎层（2026-08-22 `ls` 实测）
- `packages/core` 以 `./canvaskit` export 暴露 canvaskit 模块（`packages/core/package.json` exports 字段，2026-08-22 实测）

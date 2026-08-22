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
| E1 CanvasKit wasm 初始化探针 | ⬜ 未开始 | — |
| E2 编辑器外壳入孤岛 | ⬜ 未开始 | — |
| E3 生命周期/状态对齐 | ⬜ 未开始 | — |
| E4 冒烟 + 三件套收口 | ⬜ 未开始 | — |

## 2. 实测记录（按时间倒序，最新在上）

### 2.1 2026-08-22 注册期 recon：wasm 资产服务方案定案（E1 前置未知已消解）

E1 的唯一前置未知「dsh 宿主能不能供 wasm 资产」已在注册期以源码实证定案，**E1 不再是未知数探路，而是按定案执行 + 浏览器端实证**：

1. **`serveBundle` 白名单实证**：`dsh-client-modules/lib/index.js` `serveBundle` 只对 pathname 以 `/plugins/` 开头且以 `/client.js` 或 `/client.js.map` 结尾的请求出文件，其余一律 404（2026-08-22 读源码；T14 已实测 package.json/preset.yml 404）
2. **`webServer.register` 路由注册 API 实证**：`dsh-host-webserver/lib/index.js` —— 服务名 `webServer`（构造函数 `super(ctx, "webServer")`），`register({kind, path, handler})` 入 prefix/exact 两张表，重复 path 才 throw；prefix 匹配最长优先（`prefix.length > best.path.length`），故 `/plugins/openpencil-marketing/assets/` 可压过 dsh-client-modules 的 `/plugins/` 前缀；`dsh-client-hmr` 的 exact `/plugins/events` 与其共存为先例（2026-08-22 读源码）
3. **插件侧用法先例实证**：`dsh-host-frontend-static/lib/index.js` —— `export const inject = ["webServer"]`，`ctx.webServer.registerFallback(...)`（2026-08-22 读源码）
4. **CanvasKit 版本/体积实测**：`node_modules/canvaskit-wasm/package.json` version = 0.41.1（root `package.json` 钉 `^0.41.1` 的实际解析）；`bin/canvaskit.wasm` = 7,159,342 bytes（2026-08-22 `ls -la` 实测）。workbench 侧钉 exact `0.41.1`
5. **本仓 locateFile 机制**：`packages/core/src/canvaskit.ts` `getCanvasKit()`——浏览器臂 `locateFile` 返回 `${BASE_URL}/${file}`，即期待同源静态服务；island 场景由本插件路由顶替（2026-08-22 读源码）

**备选方案**（定案遇阻时启用）：canvaskit.wasm base64 inline 进 client.js（约 9.5MB），无需宿主路由，确定可行但 bundle 重。

### 2.2 2026-08-22 本仓编辑器资产盘点（E2 前置）

- 无 `old/` 目录——spike 04 文中 "old/src" 即指本仓当前 `src/`（Vue 3 编辑器 UI）+ `packages/*` 引擎层（2026-08-22 `ls` 实测）
- `packages/core` 以 `./canvaskit` export 暴露 canvaskit 模块（`packages/core/package.json` exports 字段，2026-08-22 实测）

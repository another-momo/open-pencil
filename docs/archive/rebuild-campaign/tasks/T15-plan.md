<!--
  写作纪律（改本文前必读）：
  - 事实性声明必须附核验命令 + 日期，否则标为【假设】
  - 计划被实测推翻时，直接改本文为新版本，完整理由记入 records/ 子文档
  - 本文只保留当前态，不保留修正历史
  - 改完后刷新本文头部的「状态」字段
  - 详细规则见 docs/rebuild/05-process.md §4
-->

# tasks/T15-plan.md · T15 任务计划

> **T 编号**：T15（Phase 1-X 实施 · M2 编辑器入孤岛，全路线最大风险项）
> **分支**：`rebuild/v2`（实施主线；`workbench/` ownedRoot 已登记）
> **状态**：🔄 进行中（E1 风险探针先行）
> **三件套**：
> - 计划：[T15-plan.md](T15-plan.md)（本文件）
> - 自检：[T15-self-check.md](T15-self-check.md)（开工后持续回填）
> - 核验：[T15-verify.md](T15-verify.md)（收口时 subagent 填报）

## 1. 任务概述

### 1.1 背景与目标

T14 达成 MS-X1（workbench/ 骨架可安装、island 存活、HMR A 级证伪）后，下一步把真正的编辑器搬进 dsh island：CanvasKit 渲染引擎 + 编辑器外壳（复用本仓 `src/` Vue 3 编辑器 UI 与 `packages/*` 引擎层，经 tsdown 打进 island client bundle）。里程碑 M2：编辑器在 dsh web island 里跑起来——画布可见、demo scene 可交互、console 0 错。

本项是全路线最大风险项（估 5-6 人日），故第一天先做最小风险探针（E1）：**CanvasKit wasm 能不能在 island 里初始化**。E1 不过，E2 不投。

### 1.2 关键决策（本 task 内拍板，理由随附）

1. **E1 风险探针先行，逐日推进、逐段实测**——不一次性移植整个编辑器；每段（E1→E4）都有独立通过标准，任何一段实测推翻计划即就地改本文 + 记 records/
2. **wasm 资产服务走宿主 `webServer` 服务 prefix 路由**（2026-08-22 源码实证，非假设）：
   - `dsh-client-modules` 的 `serveBundle` 只供 `/plugins/<id>/client.js[.map]` 白名单（lib/index.js serveBundle：suffix 匹配 client.js/client.js.map，其余 404；package.json/preset.yml 404 已于 T14 实测）
   - `dsh-host-webserver` 的 `webServer` 服务暴露 `register({kind, path, handler})`：prefix 表最长匹配优先（`prefix.length > best.path.length`），重名才 throw——dsh-client-modules 占 `/plugins/` 前缀，本插件注册更长的 `/plugins/openpencil-marketing/assets/` 前缀不冲突且优先命中；dsh-client-hmr 的 exact `/plugins/events` 与 `/plugins/` 前缀共存为先例
   - 插件用法先例：`dsh-host-frontend-static` 即 `inject = ["webServer"]` + `ctx.webServer.registerFallback(...)`
   - client 侧对齐 `packages/core/src/canvaskit.ts` 的 `locateFile` 机制：`CanvasKitInit({ locateFile: (f) => "/plugins/openpencil-marketing/assets/" + f })`
   - **备选**（若路由方案 E1 实测遇阻）：canvaskit.wasm base64 inline 进 client.js（7,159,342 bytes → 约 9.5MB，重但确定）；是否切换由 E1 实测拍板
3. **`canvaskit-wasm` 钉 `0.41.1` exact**——与仓库 root `package.json` `^0.41.1` 实际解析版本一致（2026-08-22 实测 `node_modules/canvaskit-wasm/package.json` version = 0.41.1，`bin/canvaskit.wasm` = 7,159,342 bytes）
4. **wasm 资产随 workbench 包自包含**：build 时拷 `canvaskit.wasm` → `workbench/assets/`，宿主路由从包目录读；不依赖 node_modules 布局（`files` 字段加 `assets/`）
5. **react 仍只 external，编辑器 Vue 侧全量打包**——T14 已证 island 内挂 Vue 3 app 可行（vueMounts 计数、HMR 热替换后重挂）；编辑器 Vue app 与 island shell Vue app 的关系（嵌套 vs 替换）在 E2 实测拍板

### 1.3 范围

| # | 工作项 | 通过标准 | 估时 |
|---|---|---|---|
| E1 | **CanvasKit wasm 初始化探针**（风险优先）：workbench 宿主侧注册 assets prefix 路由供 wasm；island 内 `CanvasKitInit` → `MakeSurface` → 画矩形 → `readPixels` 回读校验 → 写入 `window.__openpencilIsland.canvaskit` | 像素回读值与绘制值一致 + console 0 错 + 截图证据 | ~1 人日 |
| E2 | **编辑器外壳入孤岛**：本仓 `src/` 编辑器 UI + 所需 `packages/*` 引擎经 tsdown 打进 client bundle；island 面板从营销壳换成编辑器外壳 | island 内渲染真实编辑器外壳，加载内置 demo scene 可见画布内容 | ~3 人日 |
| E3 | **生命周期/状态对齐**：编辑器 store 与 island 生命周期对齐（X5 已证 shell.overlay 不随会话切换卸载；dispose/重挂语义正确，HMR 后编辑器状态处理成文） | 会话切换 island 不卸载、编辑器状态不丢；HMR 重挂行为有实测记录 | ~0.5-1 人日 |
| E4 | **冒烟 + 三件套收口**：沙盒端到端冒烟（画布可见、节点可选中/移动）+ self-check 完整回填 + subagent 独立核验 | 核验「可以提交」；远端 CI 绿 | ~0.5 人日 |

总计 ~5-6 人日。7600 桥真链路 + token 链不在本任务范围（T16，决策点 1）。

## 2. 风险与对策

| # | 风险 | 对策 |
|---|---|---|
| R1 | wasm 在 island 上下文加载失败（路径/CSP/实例化环境） | E1 先行证伪；备选 base64 inline（§1.2-2） |
| R2 | 编辑器依赖链（`packages/*` 引擎 + `src/` UI）打进单 client bundle 的体积/构建问题 | E2 逐包接入实测；localhost 场景接受大 bundle，不做 code-split 前置优化 |
| R3 | 引擎对全页 app 的隐式假设（document 全局、窗口尺寸、焦点）与 island 冲突 | E2 中期检查点；每个假设命中即记录并就地修 |
| R4 | 双 Vue app（island shell + 编辑器）嵌套的 provide/inject、事件边界问题 | E2 拍板嵌套 vs 替换；T14 已证 island 内 Vue app 本身可行 |

## 3. 验收标准（M2）

1. E1：CanvasKit 在 island 初始化成功，readPixels 回读校验通过，console 0 错（截图 + `window.__openpencilIsland.canvaskit` 实测值）
2. E2：island 内渲染真实编辑器外壳，内置 demo scene 画布内容可见
3. E3：会话切换 island 存活、编辑器状态保持；HMR 重挂行为有实测记录
4. E4：画布节点可选中/移动，console 0 错；subagent 独立核验「可以提交」；远端 CI 绿

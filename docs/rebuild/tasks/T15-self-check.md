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
| E1 CanvasKit wasm 初始化探针 | ✅ 通过（2026-08-22） | §2.2 实测值 + [evidence/t15-e1-canvaskit-island.png](../../../workbench/evidence/t15-e1-canvaskit-island.png) |
| E2 编辑器外壳入孤岛 | ✅ 通过（2026-08-22） | §2.1 实测值 + evidence/t15-e2-editor-island{,-interact}.png |
| E3 生命周期/状态对齐 | 🔄 部分证据已有（HMR 带编辑器热替换 + 会话切换存活），dispose 语义与接受项成文未完 | §2.1 第 4 条 |
| E4 冒烟 + 三件套收口 | ⬜ 未开始 | — |

## 2. 实测记录（按时间倒序，最新在上）

### 2.1 2026-08-22 E2 通过：真实编辑器（core+vue 引擎链）在 island 渲染、可选中、可拖动

**结论：编辑器入孤岛达成（M2 主体）。console 0 错 0 警告；交互符合 Figma 语义。**

实测值（Playwright 驱动 Chromium，2026-08-22）：

| 项 | 实测 | 取证 |
|---|---|---|
| 编辑器启动 | `window.__openpencilIsland.editor = {ready:true, bootMs:460, fontBytes:342408}`（Inter-Regular 经 markLoaded 预填，根相对 fetch 未发） | evaluate |
| demo scene 渲染 | FRAME+RECTANGLE+ELLIPSE 可见，zoomToFit 落位正确 | evidence/t15-e2-editor-island.png |
| E1 探针保持 | canvaskit `{status:"ok", pixelCheck:true, probeMs:547}`，红矩形缩略画布可见 | 同上截图右下角 |
| 点选 | 点击椭圆 → `selectedIds=["0:5"]`（选中最上层节点，Figma 语义） | evaluate |
| 拖拽 | 拖矩形 (+60,+40) → 绝对位移正确 (+60,+40)；落点在 frame 内触发**自动 reparent**（存储坐标转 frame 相对 (110,90)——一度误判为「位移转置取反」，查明后确认全部符合 Figma 语义） | evaluate + spy updateNode |
| hover | 悬停椭圆 → `hoveredNodeId="0:5"` | evaluate |
| HMR 带编辑器 | 改源码重建 → dsh 模块级热替换成功：reactMounts/vueMounts/ckRuns 1→2，无整页刷新（window 对象存活），编辑器自动重挂 ready（bootMs 125 热缓存），0 错 | evaluate 前后对照 |
| console | 0 错 0 警告（连 node-fetch-native 提示也随条件条件修正消失） | Playwright console_messages |
| 纯净装机 | `npm ci`（无 --legacy-peer-deps）+ build + 宿主供 client.js 200 全过——CI 无需改装机命令 | 本机实测 |

**E2 构建期五个发现并根治**（全部有实证，按发现时序）：

1. **yoga-layout TLA**：`@open-pencil/yoga-layout` 主入口 `wrapAssembly(await loadYoga())`（dist/src/index.js:13），rolldown CJS 输出拒收 TLA。解法：`src/client/yoga-shim.js`（Proxy 顶默认导出 + `yogaReady` 门闩）经 resolveId 插件精确重定向（不用 resolve.alias——前缀语义会误伤 shim 自己的 `yoga-layout/load` 深导入）。
2. **node 内建顶层 require**：rolldown CJS 把 dep 图非浏览器臂的 node 内建 import 提升为顶层 `require(...)`，dsh ModuleLoader 的 require shim 遇到即抛（`require("module") missed the module table`）。解法：双层桩——构建期虚拟桩模块（nodeStubPlugin，供 ESM 命名绑定）+ 运行期 intro require polyfill（node 内建词回桩对象、react 系转发原 shim）+ `__filename`/`__dirname` 假值（Emscripten loader 无条件 `require("url").pathToFileURL(__filename)`）。
3. **css-tree eval 期炸**：unifont 的传递依赖 css-tree 主入口是 CJS lib/，其 data 模块在模块求值期即 `createRequire` 装 mdn-data。解法：重定向到官方自包含 ESM 构建 `dist/csstree.esm.js`（功能无损）。
4. **tsdown `resolve` 键静默丢弃**：tsdown 的 alias 是**顶层**字段（`types-DP3_0kws.d.mts:998` 实证），`resolve:{alias}` 写法被静默忽略；conditionNames 经 `inputOptions` 回调透传给 rolldown。
5. **vue 四套拷贝（本项最深）**：只钉 `vue` 不够——`@vue/*` 全家桶按 importer 位置（.bun store / 本包）× 格式（CJS require 臂 / ESM import 臂）裂成四套。症状极隐蔽：**渲染完全正常**（editor 链用 import 臂），但 vueuse `useEventListener` 零挂载（它的 watch/computed 在 CJS 臂的 reactivity 上，与本岛 app 的 ESM 臂互不追踪 ref）。解法：`@vue/shared|reactivity|runtime-core|runtime-dom|compiler-core|compiler-dom` 逐包钉到本包 `node_modules` 的 esm-bundler 构建，bundle 收敛为单图（构建后 region 审计实证）。

**架构落点**（呼应 recon 建议）：入口 `index.jsx` 保持薄（react + yoga-shim + shared），`await yogaReady` 后动态 `import("./editor-boot.js")`——inlineDynamicImports 把子图编译为惰性求值（`__esmMin` 包裹，`init_editor_boot` 仅于 import() 时运行，bundle 实证），core 链求值时 Yoga 必就绪。编辑器挂载走最小配方：`createEditor({getViewportSize})` + `provideEditor` + 单 canvas `useCanvas({showRulers:false})` + `useCanvasInput`（三个 hitTest 回调直喂，EditorCanvas.vue 同款接法）；无 router/tabs/collab/MCP/textEdit/drop。

**遗留接受项（E3 成文范围）**：`useCanvasInput` 的 window keydown/keyup/blur 全局监听（宿主按键会进画布、宿主窗口 blur 会取消拖拽）；`useTextEdit`/`useCanvasDrop` 未接；island 固定尺寸 1040×720 底右停靠（整幅 overlay 布局留给后续任务）。

### 2.2 2026-08-22 E1 通过：CanvasKit wasm 在 island 初始化 + 实画 + 像素回读全过

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

### 2.3 2026-08-22 注册期 recon：wasm 资产服务方案定案（E1 前置未知已消解）

E1 的唯一前置未知「dsh 宿主能不能供 wasm 资产」已在注册期以源码实证定案：

1. **`serveBundle` 白名单实证**：`dsh-client-modules/lib/index.js` `serveBundle` 只对 pathname 以 `/plugins/` 开头且以 `/client.js` 或 `/client.js.map` 结尾的请求出文件，其余一律 404（2026-08-22 读源码；T14 已实测 package.json/preset.yml 404）
2. **`webServer.register` 路由注册 API 实证**：`dsh-host-webserver/lib/index.js` —— 服务名 `webServer`（构造函数 `super(ctx, "webServer")`），`register({kind, path, handler})` 入 prefix/exact 两张表，重复 path 才 throw；prefix 匹配最长优先（`prefix.length > best.path.length`），故 `/plugins/openpencil-marketing/assets/` 可压过 dsh-client-modules 的 `/plugins/` 前缀；`dsh-client-hmr` 的 exact `/plugins/events` 与其共存为先例（2026-08-22 读源码）
3. **插件侧用法先例实证**：`dsh-host-frontend-static/lib/index.js` —— `export const inject = ["webServer"]`，`ctx.webServer.registerFallback(...)`（2026-08-22 读源码）
4. **CanvasKit 版本/体积实测**：`node_modules/canvaskit-wasm/package.json` version = 0.41.1（root `package.json` 钉 `^0.41.1` 的实际解析）；`bin/canvaskit.wasm` = 7,159,342 bytes（2026-08-22 `ls -la` 实测）。workbench 侧钉 exact `0.41.1`
5. **本仓 locateFile 机制**：`packages/core/src/canvaskit.ts` `getCanvasKit()`——浏览器臂 `locateFile` 返回 `${BASE_URL}/${file}`，即期待同源静态服务；island 场景由本插件路由顶替（2026-08-22 读源码）

**备选方案**（定案遇阻时启用）：canvaskit.wasm base64 inline 进 client.js（约 9.5MB），无需宿主路由，确定可行但 bundle 重。

### 2.4 2026-08-22 本仓编辑器资产盘点（E2 前置）

- 无 `old/` 目录——spike 04 文中 "old/src" 即指本仓当前 `src/`（Vue 3 编辑器 UI）+ `packages/*` 引擎层（2026-08-22 `ls` 实测）
- `packages/core` 以 `./canvaskit` export 暴露 canvaskit 模块（`packages/core/package.json` exports 字段，2026-08-22 实测）

<!--
  写作纪律（改本文前必读）：
  - 事实性声明必须附核验命令 + 日期，否则标为【假设】
  - 本文只保留当前态，不保留修正历史
  - 详细规则见 docs/rebuild/05-process.md §4
-->

# tasks/T15-verify.md · T15 独立核验

> **T 编号**：T15（M2 编辑器入孤岛）
> **状态**：✅ 独立核验通过（2026-08-22，subagent 逐项实测，逐项结论见 §2）——可以提交

## 1. 收口核验项清单（E4 派单时逐项实测）

| # | 核验项 | 方法 |
|---|---|---|
| V1 | E1 证据真实性：`window.__openpencilIsland.canvaskit` 实测值、readPixels 回读值、console 0 错、截图 | 浏览器复现 + 对照 self-check 记录 |
| V2 | wasm 资产路由：宿主侧 `/plugins/openpencil-marketing/assets/canvaskit.wasm` 返回 200 且字节数 = 7,159,342；包内 `assets/` 随 build 生成 | curl + 文件比对 |
| V3 | E2：island 内编辑器外壳渲染、demo scene 画布可见 | 浏览器截图 + DOM 检查 |
| V4 | E3：会话切换 island 不卸载、编辑器状态保持；HMR 重挂实测记录存在且如实 | 浏览器操作复现 |
| V5 | E4：画布节点可选中/移动，console 0 错 | 浏览器操作复现 |
| V6 | 无占位（D19）：workbench/ 新增代码全部真实可用 | 逐文件审 |
| V7 | 版本钉扎：workbench 新增依赖全部 exact pin | 读 package.json |
| V8 | 远端 CI 绿（含 workbench-build job） | gh api 查 run |

## 2. 核验结论（2026-08-22 subagent 独立实测；环境：dsh 宿主 127.0.0.1:3080 nohup 运行中、Playwright 驱动 Chromium、git HEAD 2cc790de）

### V1 E1 证据真实性 —— 通过

浏览器 evaluate `window.__openpencilIsland`（Playwright `browser_evaluate`，2026-08-22）实测：

| 字段 | 实测值 | 对照 self-check |
|---|---|---|
| canvaskit.status | `"ok"` | §2.2 一致 |
| canvaskit.runs / wasmHttpStatus / wasmBytes | `1 / 200 / 7159342` | §2.2 一致 |
| canvaskit.insidePixel / outsidePixel | `[255,0,0,255] / [0,0,0,0]` | §2.2 一致（readPixels 回读真实存在） |
| canvaskit.pixelCheck | `true` | §2.2 一致 |
| canvaskit.probeMs | `495` | §2.2 记录 485、§2.1 记录 547——单次耗时测量，逐跑浮动，量级与字段结构一致 |
| reactMounts / vueMounts / errors | `1 / 1 / []` | §2.6 冷启记录一致 |
| editor | `{ready:true, bootMs:405, fontBytes:342408}` | 与 §2.6 冷启记录逐字段一致（当前页面即该次冷启） |

console 复测：`browser_console_messages` level=warning → 0 错 0 警告（2026-08-22）。E1 证据真实。

### V2 wasm 资产路由 —— 通过

- 响应头：`curl -sI http://127.0.0.1:3080/plugins/openpencil-marketing/assets/canvaskit.wasm`（2026-08-22）→ `200`，`content-type: application/wasm`，`content-length: 7159342`
- 字节一致：全量 GET 落盘后 `sha256sum` 与 `workbench/assets/canvaskit.wasm` 双比对——两侧均为 `bd669c88bd033eaf62d673103a42231a737c6d12e4cc99f8548b2784b5772430`、7,159,342 字节（2026-08-22）
- 路径穿越（2026-08-22）：裸 `../`（`--path-as-is`）、`%2e%2e`、`%2E%2E`、`../../` 深层变体请求 `…/assets/../package.json` 全部 404（路由侧另有 normalize 后前缀守卫回 403，`workbench/src/index.js:56-62` 源码实证）
- build 链：`workbench/package.json` scripts.build = `node scripts/copy-assets.mjs && npm run clean && tsdown`——copy-assets 是 build 第一步（2026-08-22 读文件）；`assets/` 在 .gitignore 且 `git check-ignore workbench/assets/canvaskit.wasm` 命中（2026-08-22）

### V3 E2 编辑器渲染 —— 通过

- DOM：`document.querySelector('[data-openpencil-vue="editor-canvas"]')` 存在，CANVAS 元素，视口内盒 1040×683.5 @ (443, 164.5)（2026-08-22 evaluate）
- editor.ready = true（同上）
- demo scene：`editor.getPages()` → Page 1（CANVAS `0:2`）；`getChildren('0:2')` → FRAME `0:3`（180,160,400×300）、RECTANGLE `0:4`（150,150,120×80）、ELLIPSE `0:5`（350,200,100×100），type 三件套齐全（2026-08-22 evaluate；原始 editor 句柄经 `__openpencilIsland._editor` 暴露，`workbench/src/client/editor-boot.js:41`）。FRAME 位于 (180,160) 与 §2.6 拖拽终态记录一致，证明状态连续非重启
- 目检：对画布区域 clip 截图（CDP page.screenshot，2026-08-22）——Frame 选框与「400 × 300」尺寸标、灰色矩形、灰色圆形、右下角 E1 探针红方块全部可见，非空白

### V4 E3 生命周期 —— 通过

会话往返实测（2026-08-22，Playwright 真实点击侧边栏 treeitem）：spike-alpha-1 → spike-alpha-2 → spike-alpha-1。切换前后 `window.__openpencilIsland` 对照：

| 字段 | 切换前 | 往返后 |
|---|---|---|
| reactMounts / vueMounts / vueUid | 1 / 1 / 0 | 1 / 1 / 0（无重挂） |
| editor.ready / bootMs | true / 405 | true / 405（初启值，非重启） |
| canvaskit.runs / status / pixelCheck | 1 / ok / true | 1 / ok / true |
| errors | 0 | 0 |
| scene | 三节点齐 | 三节点坐标不变 |

dispose 语义代码级复核（2026-08-22 读源码）：
- `packages/vue/src/canvas/surface/lifecycle.ts:127-133` `destroy()` = clearSceneBackingRenderTimer + renderLoop.pause + removeCanvasRenderer + renderer.destroy + glContext.delete；`:176-180` `onScopeDispose` → destroyed 置位 + cancelResize + surface.destroy
- `packages/vue/src/canvas/useCanvasInput.ts:407-431` window keydown/keyup/blur + window mouseup(capture) 均经 vueuse `useEventListener`（组件 effect scope 内，卸载自动移除）；`:433-438` `tool:changed` 订阅 + `onScopeDispose(stopToolListener)`
- 结论：self-check §2.5 描述与源码一致（其行号引用 407-433 / 437-439 与实测 407-431 / 438 偏差 ≤2 行，语义无差）

### V5 E4 交互 —— 通过

真实鼠标操作（`browser_run_code_unsafe` 内 `page.mouse`，2026-08-22；坐标换算用 `viewport.ts:19-24` screenToCanvas 逆变换，zoom 实测 1）：

1. **点选**：点击椭圆中心 → `selectedIds = ["0:5"]`（选中最上层，Figma 语义）
2. **拖拽一**（+50,+30 屏幕像素）：椭圆绝对坐标 (350,200) → (400,230)，位移精确 (+50,+30)；落点在 frame 内触发自动 reparent——`0:5` 成为 `0:3` 子节点，存储坐标转 frame 相对 (220,70)。与 §2.1 记录的 reparent 语义一致
3. **拖拽二**（+20,+10，对已在 frame 内的椭圆）：frame 相对存储坐标 (220,70) → (240,80)，位移精确 (+20,+10)；父 frame (180,160) 未动
4. **错误面**：两轮交互后 `__openpencilIsland.errors = []`；`browser_console_messages` level=warning → 0 错 0 警告（2026-08-22）

诚实记录：V5 复测改变了 demo scene 实时状态（椭圆现位于 frame 内 rel (240,80)、当前选中 `0:5`）——这是对运行中宿主内存态的操作，不涉及任何文件变更；行为本身即 Figma 语义的实证。

### V6 无占位（D19） —— 通过

逐文件全读（2026-08-22）：`workbench/src/client/index.jsx`（React 岛 + createPortal + yogaReady 门闩 + 动态 import）、`editor-boot.js`（字体预填、createEditor、demo scene、useCanvas/useCanvasInput 接线、E1 探针、WS 心跳）、`shared.js`（岛状态）、`yoga-shim.js`（TLA Proxy shim）、`workbench/src/index.js`（资产路由含穿越守卫、preset 安装、三个桥工具）、`workbench/tsdown.config.mjs`（vue 单例 alias、精确重定向插件、node 内建双层桩、CJS 包壳 banner/intro）、`workbench/scripts/copy-assets.mjs`（幂等拷贝，缺源即 exit 1）——全部真实实现，无 TODO 充数、无假数据、无 hollow stub。
- `grep -rni "TODO|FIXME|XXX|HACK|stub|placeholder|dummy|mock" workbench/src workbench/scripts workbench/tsdown.config.mjs`（2026-08-22）：仅命中 tsdown.config.mjs 里 `openpencil-node-stub`/`urlStub` 标识符——是真实 polyfill 实现体的命名，非占位
- 占位词扫描：对 `docs/rebuild/tasks/T15-*.md` grep CI 禁词模式（全角括号+「待」类三种写法，2026-08-22 执行）——无输出（exit 1）
- 证据五图均在：`workbench/evidence/t15-{e1-canvaskit-island,e2-editor-island,e2-editor-island-interact,e3-session-switch,e4-smoke}.png`（2026-08-22 `ls -la`）

### V7 版本钉扎 —— 通过

`workbench/package.json`（2026-08-22 读文件）：dependencies `canvaskit-wasm 0.41.1`、`vue 3.5.41`、`ws 8.18.3`；devDependencies `react 18.3.1`、`react-dom 18.3.1`、`tsdown 0.22.14`——全部 exact pin，全文件无 `^`/`~`。`@open-pencil/core`、`@open-pencil/vue` 为 `file:../packages/*` 链接（允许项）。

### V8 远端 CI —— 通过

- 分支 HEAD：`gh api repos/another-momo/open-pencil/branches/rebuild/v2 --jq .commit.sha`（2026-08-22）→ `2cc790de5953e2d6c318a62416a3eb153e6ae7b9`（与本地 HEAD 一致）
- HEAD run：`gh run view 32576137352 -R another-momo/open-pencil`（2026-08-22）→ headSha = 2cc790de…，conclusion **success**，13/13 job 全绿，含 **Workbench bundle build**（success）
- `gh run list --branch rebuild/v2 --limit 5`（2026-08-22）：近三次 run（32576137352 / 32575883252 / 32575625410）全 success；更早两次 failure（32575086061 E2 初次、32575537948 YAML 笔误）已被 cd04cf62 修复，非 HEAD，不影响结论

## 3. 总结论

**可以提交。** V1-V8 八项全部独立复测通过，实测值与 self-check §2.1-§2.6 声明一致（仅 probeMs/bootMs 等单次耗时存在逐跑浮动，字段结构与量级吻合）；未发现阻塞项。

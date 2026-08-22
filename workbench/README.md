# openpencil-marketing（workbench/）

OpenPencil 营销工作台的 dsh bundle：shell.overlay 孤岛（React 宿主 + Vue 3 应用）+ 7600 WS 桥工具 + `openpencil-design` agent preset。

## 环境要求

- dsh 宿主钉在 `@deepseek-ai/dsh@0.1.1-rc.1`（精确版本，不用 ^/~——preview 发布节奏实测 11 天 10 个 rc，升级走双周窗口，见 `docs/rebuild/03-phase-1-runtime.md` §5.4）
- Node ≥ 20（宿主同要求）

## 安装（开发形态）

```bash
# 1. 构建产物（lib/ 不入库）
cd workbench && npm ci && npm run build

# 2. 以 link: 形式装进目标 profile（示例为沙箱；真实用户走 dsh plugin add）
#    <DSH_HOME>/profiles/web/package.json 的 dependencies 加：
#      "openpencil-marketing": "link:<本仓库绝对路径>/workbench"
#    且 dsh.profile.bundles 数组加 "openpencil-marketing"

# 3. 安装 profile 依赖（建立 node_modules 软链）
dsh plugin --profile web install

# 4. 起宿主
DSH_HOME=<沙箱路径> dsh web --no-open --port 3080
```

首次启动会把 `presets/openpencil-design` 复制到 `<DSH_HOME>/.agent-presets/`（已存在则不动）。

## 开发回路（T14 实测结论，2026-08-22）

```bash
npm run dev   # tsdown --watch，改动重建 ~300ms
```

**dsh web 会监听 client module 产物变化并做模块级热替换**——改 `src/` 后无需手动刷新浏览器、无需重启宿主：dsh 自动重载模块，island 走 dispose → 重新 apply → 重新挂载（实测两轮探针：`window.__openpencilIsland` 的 reactMounts/vueMounts 逐次 +1 且 window 对象存活，非整页刷新）。

注意：岛内（Vue app 内部）状态每次热替换重置。这不影响产品架构——画布状态在编辑器进程（7600 桥另一侧），岛内只挂 UI 态。

## 结构

```
workbench/
  package.json            # dsh.bundle.patch + dsh.client.inject 声明；@open-pencil/core|vue 经 file: 链接本仓引擎
  cordis.patch.yml        # bundle 注册行
  tsconfig.json           # jsx: react-jsx（必须存在，防 rolldown 上溯命中仓库根 preserve——T12/X1 教训）
  tsdown.config.mjs       # 双产物 + E2 四件套：单例 alias（vue/@vue/*/canvaskit-wasm 钉本包 esm 构建）、
                          #   yoga TLA shim 重定向、node 内建双层桩、css-tree→csstree.esm.js 重定向
  scripts/copy-assets.mjs # build/dev 前置：canvaskit.wasm + Inter-Regular.ttf → assets/（包自包含）
  src/index.js            # host 侧：preset 安装 + systemPrompt section + 三工具 + assets prefix 路由（webServer 服务）
  src/client/index.jsx    # client 入口（薄）：React island + await yogaReady 后动态 import editor-boot
  src/client/editor-boot.js  # 编辑器启动 + Vue 岛挂载（core 全链，惰性求值——勿从入口静态导入）
  src/client/yoga-shim.js # yoga-layout TLA shim（Proxy 默认导出 + yogaReady 门闩）
  src/client/shared.js    # 入口/editor-boot 共享态（__openpencilIsland 仪表）
  presets/openpencil-design/
  evidence/               # 任务证据（随库，不进 npm 发布 files）
```

## 证据

- T14 装机冒烟 + HMR 探针截图：`evidence/t14-island-smoke.png`、`evidence/t14-hmr-probe.png`
- T15/E1 CanvasKit 探针：`evidence/t15-e1-canvaskit-island.png`
- T15/E2 编辑器入岛（demo scene 渲染 + 点选/拖拽/hover 交互）：`evidence/t15-e2-editor-island.png`、`evidence/t15-e2-editor-island-interact.png`
- 机制实证（X1/X4/X5/X6）：`spikes/s-x/evidence/`（T12）

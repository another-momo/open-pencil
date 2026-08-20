# 04 · dsh-X 路线专项设计

> 状态：v3 重写（2026-08-20，承接 spike 03 S-X 6 项验证清单 + weshop 范式解构）
> 文档身份：技术调研 / 落地设计文档；面向即将开 spike 分支写代码的工程师 + 决策 owner
> 证据路径约定：dsh/ = 参考项目/deepseek-harness；weshop/ = 参考项目/weshop-dsh-plugin；old/ = open-pencil 旧分支 feature/agent-backend（绝对路径见附录 10）
> 陈述纪律：【事实】附 文件:行号 / 【推断】由证据推出 / 【假设】未验证
> 本报告只写 X 路线。Y/pi 路线不出现、不对比、不脚注。

---

## 1. 术语表（按字母序）

> 每条：术语 / dsh 里的精确含义 / 本报告里的指代 / 容易混淆的其他用法。
> 首次正文中出现时仍会再次标定。报告里作者仍可能误用的词见附录 11。

| 术语 | 在 dsh 里的精确含义 | 本报告里的指代 | 易混用法（**警告**） |
|---|---|---|---|
| **agent preset** | 一份 agent-plane 的 cordis composition（`agent.cordis.yml`），定义一个 agent 的工具/技能/系统提示/隔离策略。dsh 在 $DSH_HOME/.agent-presets/<id>/ 读用户预设；config/agent-presets/ 读出厂预设。【事实】`dsh/docs/architecture.md:111-112`、`dsh/packages/bundle/web-app/cordis.patch.yml:410-424` | 我们要发布的「open-pencil-design」agent preset（继承 standard + marketing persona + skills） | **不是** dsh 的「profile」；也不是 dsh 的「preset install」命令的目标（**该命令根本不存在**——dsh 没有「preset install」，只有 `dsh plugin add`，详见「plugin 命令」） |
| **app startup provider** | 在自己 bundle 里挂一个普通 Cordis row，注入 cmdlineArgs，导出自家解析后的配置服务（webStartup / myAppStartup）。!!js 表达式从那个服务里读 port/host。【事实】`dsh/docs/user/develop/basic/publish.md:131-151`、`dsh/packages/bundle/web-app/cordis.patch.yml:107-137` | 我们的 surface bundle（编辑画布走 Web 入口时）需要注册的 `openpencil-startup` row | 容易写成「在 apps/cli/src/web.ts 加代码」——错。**是 plugin 内的 row**，不是 dsh 启动器代码 |
| **AppFrame** | dsh-web-app 的根 React 组件，.overlayLayer 容器 z-index:20。【事实】spike 03 §8「AppFrame overlayLayer z-index=20」证据行 | dsh web 的根容器；我们所有 React island 都挂在这棵树下 | 与 dsh 的「shell.kernel」「ShellRoot」「AppDialogRoot」概念容易混——后两者是同一棵树的更下层单元 |
| **bundle** | npm 包；在自身 package.json 的 dsh.bundle 字段指向一份 cordis.patch.yml。bundle 是 dsh 的**配置层（configuration layer）**——它插入或覆盖若干 plugin row。【事实】`dsh/docs/architecture.md:21-24`、`dsh/docs/user/develop/basic/publish.md:11-16, 33-44` | 我们要发布的**整个产品**（marketing 工作台 = 一个 bundle） | **不是**「preset install」的目标、不是**「plugin add」的对象类型**（后者装的是 bundle 但命令动词叫 plugin） |
| **client.inject** | npm package.json 里的 dsh.client.inject 字段——一组 dsh-client-* 包名，浏览器侧扫描这些包作为 client module。【事实】`weshop/package.json:36-49` | 我们要在 package.json 声明的 client 依赖列表（@deepseek-ai/dsh-client-runtime / -ui-slots / -ui-layout / -ui-sidebar） | 与 React 的 inject prop、Vue 的 provide/inject 是同名但完全不同的概念 |
| **cordis.patch.yml** | YAML 数组，按 id 覆盖或 insert 新 plugin row；row 是 dsh 的最小配置单元。【事实】`dsh/docs/architecture.md:27, 35`、`dsh/docs/user/develop/basic/publish.md:56-62` | 我们 bundle 内的 patch 文件（声明哪些 host row / 哪些 agent preset row / 哪些 skill 注册） | 与 @directive/processor、--patch 命令行 overlay 是**同一种语法**——都是 patch，差别在加载层（详见「layer」） |
| **dsh client runtime / modules** | 浏览器侧 kernel，扫描 __DSH_BOOT__ 表，挂载 client modules，路由到各 React island。【事实】`dsh/packages/bundle/web-app/cordis.patch.yml:147-172` 注释「The shell kernel constructs before cordis exists」 | 我们的 React island 必须在它建立之后挂载 | 与 host cordis 是**两套**cordis 树——host 跑 Node、client 跑浏览器；plugin 同时持有两边 |
| **dsh web bundle** | dsh-web-app 编译产物的前端 dist，**不是**单指 React island，是整张 dist 目录。【事实】`dsh/packages/bundle/web-app/cordis.patch.yml:130-136` 注释「the built frontend dist (an assembly fact of dsh-web-app, never user config)」 | 我们打包 React island 时要明确「我们产出一个可被 dsh.client.modules 加载的 module 文件」（参考 weshop lib/client.js，参 `weshop/package.json:20-23`） | 容易写成「我们的 bundle 打成 dsh web bundle 的一部分」——错。我们是**被 dsh 加载的 module**，不是 dsh 自身的 bundle |
| **layer / 加载顺序** | bundle patch 层按 profile bundles 列表顺序叠加 → profile 自己的 patch → home 级 patch → --patch argv 覆盖。**row 后覆盖前、整 config 替换非深合并**。【事实】`dsh/docs/user/develop/basic/publish.md:112-127` | 我们在 patch.yml 里写 row 时必须**整 config 重述**——不能指望部分 key 覆盖 | 与 Vue <keep-alive> / React Suspense 的「layer」完全不同；与 webpack 的 layer 也无关 |
| **out-of-tree plugin** | 不在 dsh 源码内的、由用户 dsh plugin add 装入 profile 的包。所有 out-of-tree plugin 都是 bundle 形式入 profile。【事实】`dsh/docs/user/develop/basic/publish.md:7-10, 64, 128` | 我们的 bundle 就是 out-of-tree plugin 的形态 | dsh 自己源码里的 @deepseek-ai/dsh-* 包**不**叫 out-of-tree plugin，叫 in-box bundle |
| **plugin 命令（dsh plugin）** | `dsh plugin --profile <name> <args...>` 把 args **透传给 pnpm**——add/remove/why 都直接走 pnpm。仅当被加的包声明了 dsh.bundle 时才会自动追加到 profile bundles。【事实】`dsh/apps/cli/src/args.ts:171-181`、`dsh/docs/user/develop/basic/publish.md:77-110` | 用户装我们的命令：`dsh plugin --profile web add openpencil-marketing` | **没有「dsh preset install」命令**。**没有「dsh bundle install」命令**。动词是 plugin，操作对象（自动判定）是 bundle |
| **preset（dsh 意义上的）** | **本报告范围内 = agent preset**（详见本表第一条）。注意：在 dsh 里**不是**「可安装的发布物」，**不是**「patch row 里的预设值」。在 dsh cordis.patch.yml 里 row config 可能用 preset: 字段（定义该 row 的默认 schema 默认值），【事实】`dsh/docs/architecture.md` §Capability seams——这是**另一层含义**「row config 的默认值」，俗称 row-level preset，**与发布物无关** | 我们发布物是 bundle（npm 包）；preset 是 bundle 内自带的一份 agent 组合 | **不要再说「dsh preset install」**——前几版错把 bundle 叫 preset |
| **profile** | $DSH_HOME/profiles/<name>/ 目录，内含 package.json（声明 dsh.profile.bundles 数组）+ 可选 cordis.patch.yml。web 和 headless 是出厂模板。【事实】`dsh/docs/architecture.md:19-20, 27`、`dsh/docs/user/develop/basic/publish.md:69-110` | 用户 dsh plugin add 我们时，profile 的 bundles 列表会多一项 @open-pencil/marketing（或我们最终定的包名） | 与 agent preset **不同**；profile 是「跑哪些 bundle」，preset 是「一个 agent 怎么配」 |
| **row** | cordis.patch.yml 数组里的一项。最小单元：{ id, name?, inject?, config?, disabled? }。【事实】`dsh/docs/user/develop/basic/publish.md:133-138` 注释「Loader row needs no launcher marker」 | 我们 patch.yml 里每一个 - id: / - insert: 都是一个 row | 与数据库 row、Excel row 不是同一概念 |
| **scene / SceneGraph** | dsh 内部**没有** SceneGraph 这一概念。本报告里 SceneGraph 指 **open-pencil 编辑器自己的场景图**（节点树 + 操作 op），由 `old/src/editor/scene/operations.ts` 等定义（参附录 10） | 我们编辑器内部的场景图（不是 dsh 概念） | **不要**把 SceneGraph 与 dsh 的「session」「scene」「conversation」混用 |
| **SessionFace** | dsh 给 plugin 的 session 外向面：**ISession（动词面）+ ObservableSnapshot<ConversationSnapshot>（数据面）**。【事实】`dsh/packages/client/runtime/src/client/contract/session.ts:89` | 我们 Vue ChatPanel 拿到 SessionFace 后用：subscribe + getSnapshot 读消息流；prompt([{type:'text', text}], 'queue') 发消息；cancel() 停 turn；pending[i].respond({ok,value}) 回审批/问题 | **不是** 5 方法的 subscribe / getSnapshot / prompt / cancel / wait.respond——prompt/cancel/respond 是 3 个动词，subscribe/getSnapshot 是 2 个 getter；wait 不在 SessionFace 上，在 ConversationSnapshot.pending[i] 上 |
| **shell.overlay** | AppFrame .overlayLayer 里的 list slot（z-index:20），多 plugin 可同时挂；不修改 dsh DOM。【事实】spike 03 §8 证据行；`weshop/src/client/index.jsx:30-35` 实测 z-index 不够，须 portal→body | 我们 Vue 编辑器挂载点（weshop 范式：createPortal(<div>, document.body, {zIndex: 1000001})） | **不是** Vue 的 <Teleport>、React 的 createPortal——这俩是机制，shell.overlay 是 dsh 的 slot 名 |

> 完整层数与冲突点的合并叙事见附录 11。

---

## 2. X 路线是什么（一段话 + 三张图）

X 路线下，我们的产品形态是一个 npm 包，名字 dsh-openpencil（或最终定的）——**它是 dsh 意义上的 bundle**。安装动作是 dsh plugin --profile web add dsh-openpencil——这条命令把 bundle 加到 profile 的 bundles 列表、把依赖写进 profile 的 package.json。装完重启 dsh web，用户切换到我们的 agent preset openpencil-design，聊天面板旁出现我们的 React island + portal→body 挂载的 Vue 编辑器。模型通过我们的 host 工具（openpencil_apply_design 等）把 SceneGraph patch op 经由 /api/openpencil/* HTTP 路由 + open-pencil 自有的 7600 WS bridge 推送到编辑器。

**图 1 — 用户视角的安装流程**

```
用户视角
1. 用户装 dsh（已有 dsh 二进制 + dsh 用户态 ~/.dsh/）
2. 用户跑：dsh plugin --profile web add dsh-openpencil
   - dsh plugin 命令透传给 pnpm add（dsh/apps/cli/src/args.ts:171-181）
   - dsh 自动把我们的 bundle 追加到 ~/.dsh/profiles/web/package.json
     的 dsh.profile.bundles 数组（publish.md:83-101）
3. 用户跑：dsh --profile web
4. 浏览器打开 dsh web 主页 → 用户点 Settings → 切换 agent preset 为 openpencil-design
5. 出现 Split：左边 dsh 自带 Chat，右边 portal→body 挂载我们的 Vue 编辑器
6. 用户在 Chat 说"把这页改成黑色背景" → 模型调 openpencil_apply_design → 编辑器 SceneGraph 即时变
```

**图 2 — 运行时拓扑（用户机器上的三个进程 + 两个本地 loopback 通道）**

```
用户机器

进程 A：dsh-host (Node)
  - 含 dsh-base + dsh-web-app + 我们 bundle 的 host 侧
  - localhost:3080 HTTP server (默认)
  - /api/* + /api/events.mux + /api/openpencil/*
  ↕ HTTP/SSE 127.0.0.1:3080

进程 B：dsh-web (Chromium 标签)
  - dsh web dist (由 host serve)
  - 我们的 React island 挂 shell.overlay
  - portal→body Vue 编辑器

进程 C：open-pencil 编辑器 (Chromium 标签 / iframe / portal)
  - Vue 编辑器 + SceneGraph
  - 7600 WS server (old/src/app/automation/bridge/server.ts:14-44)
  ↕ HTTP POST /api/openpencil/* 或 WS ws://127.0.0.1:7600
```

**图 3 — 一次工具调用的端到端路径**

```
用户在 Chat 输入"把这页改成黑色背景"
  ↓
[dsh-web] Vue ChatPanel → session.prompt([{type:'text', text}], 'queue')
  ↓  dsh wire (/api POST + /api/events.mux)
[dsh-host] agent loop 启动 turn → 模型决定调工具 openpencil_apply_design({bg:'#000'})
  ↓  ctx.tools 行 openpencil-apply-design.execute(args)
[dsh-host] 我们工具实现 → fetch('http://127.0.0.1:7600/rpc', {...})
  ↓  HTTP POST
[open-pencil 编辑器进程] 7600 WS server 收请求 → SceneGraph patch → 重渲染 → 返回 {ok:true}
  ↓  tool/result 流回流
[dsh-web] session.subscribe 触发 ConversationSnapshot 更新 → ChatPanel 重渲染
```

---

## A 节 · 术语与机制

### A1. bundle / plugin / profile / preset 的精确定义（互相区别表）

**【事实】** 来源：`dsh/docs/architecture.md:19-37`、`dsh/docs/user/develop/basic/publish.md:11-16, 69-110`、`dsh/apps/cli/src/args.ts:171-181`（plugin 子命令）、`weshop/package.json:36-49`（一个 bundle 的实际 manifest）、`dsh/packages/bundle/web-app/cordis.patch.yml`（一个 bundle 的实际 patch）。

| 概念 | 它是什么 | 谁创建 | 怎么出现 | dsh 命令 |
|---|---|---|---|---|
| bundle | npm 包，package.json 有 dsh.bundle: { patch: './cordis.patch.yml' } | 我们（作者） | pnpm publish 到 npm；或 git 仓；或本地 tarball | 没有专用命令——通过 dsh plugin add 装入 profile |
| profile | $DSH_HOME/profiles/<name>/ 目录，含 package.json（含 dsh.profile.bundles: [...]）+ 可选 cordis.patch.yml | dsh plugin 命令首次使用时**自动**初始化（@deepseek-ai/dsh-base 是它的第一个 bundle） | dsh plugin --profile demo add <pkg> 时 dsh 帮用户写 | --profile <name> 启动 |
| agent preset | $DSH_HOME/.agent-presets/<id>/agent.cordis.yml——一份 agent-plane 的 cordis composition | 作者写好塞进 bundle；或用户手写；或 agent 自己生成 | bundle 内 presets/<id>/ 子目录 + host 启动时 fs.cpSync 到 dsh home（参考 weshop/src/index.js:79-105） | 在 dsh web UI 的 General settings 切换 |
| out-of-tree plugin | **不是独立概念**——它是「profile 已装上的、来自 profile 目录之外（npm/git/tarball）的 bundle」的别名 | — | 同 bundle | 同 bundle |
| in-box bundle | dsh 自家源码里 @deepseek-ai/dsh-* 包（dsh-base / dsh-web-app / dsh-headless / ...） | dsh 团队 | dsh 安装时已就位 | bundles 列表里直接写包名 |

**我们作为产品的自称**：**「openpencil-marketing 是 dsh bundle，附赠一个 agent preset openpencil-design」**。
- 装包用 `dsh plugin --profile web add openpencil-marketing`
- 切预设用 dsh web UI（General → agent preset → openpencil-design）
- 不要自称「plugin」——因为 dsh 用户的术语里 plugin 是「profile 里装的那一项」（≈ bundle 的别名）

**重灾区预警**：
- **dsh 里没有"dsh preset install"命令**——前几版报告错用此短语。preset 是 bundle 自带的、bundle 装上后 dsh 自动拷到 dsh home（参 weshop/src/index.js:79-105 installBundledPreset()），用户无需单独命令。
- **dsh 里也没有"plugin manifest"作为发布物**——只有 dsh.bundle / dsh.profile / dsh.client 三种 manifest。
- **dsh plugin 命令永远在 profile 上下文里**——必须 --profile <name>，因为它要写 profile 的 package.json。

### A2. X 路线产品本体——我们这个 npm 包的形态

**【事实】** 我们的产品 = 一个 npm 包，manifest 在 package.json 写三件事（参照 `weshop/package.json:36-49`）：

```jsonc
{
  "name": "openpencil-marketing",       // 占位，待 owner 拍
  "version": "0.1.0",
  "type": "module",
  "main": "lib/index.js",                // host 侧 plugin 入口（Node 端）
  "exports": {
    ".": "./lib/index.js",               // host 侧
    "./client": "./lib/client.js",       // browser 侧 React island
    "./package.json": "./package.json"
  },
  "files": [
    "lib/index.js", "lib/client.js", "lib/client.js.map",
    "skills/**", "presets/**", "assets/**",
    "README.md", "cordis.patch.yml", "bin"
  ],
  "dsh": {
    "client": {
      "inject": [
        "@deepseek-ai/dsh-client-runtime",
        "@deepseek-ai/dsh-client-ui-slots",
        "@deepseek-ai/dsh-client-ui-layout",
        "@deepseek-ai/dsh-client-ui-sidebar"
      ],
      "platform": "web"
    },
    "bundle": {
      "patch": "./cordis.patch.yml"
    }
  },
  "scripts": {
    "build": "tsdown"
  },
  "dependencies": {
    "vue": "^3.5.0",
    "@phosphor-icons/react": "^2.1.10"
    // 我们自己的依赖（不要写 @deepseek-ai/dsh-*——in-box bundle 名 pnpm 解析时自带）
  },
  "peerDependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0"
  }
}
```

**字段必要性表**（**【推断】** 由 weshop 范式推出，标【事实】的为必读证据）：

| 字段 | 是否必须 | 证据 / 说明 |
|---|---|---|
| dsh.bundle.patch | **必填**——没有就不被认作 bundle，dsh plugin add 会跳过 | 【事实】`dsh/docs/user/develop/basic/publish.md:64` |
| dsh.client.inject | 浏览器侧必填——没有 dsh 不会扫到这个 module | 【事实】`weshop/package.json:36-49` 实际写法 |
| dsh.client.platform | 浏览器侧写 "web"（目前 dsh 只有 web 一类 platform） | 【事实】同上 |
| main / exports["."] | host 侧 plugin 入口（Node ESM） | 【事实】`dsh/docs/user/develop/basic/publish.md:39-44, 58-62` |
| exports["./client"] | browser 侧 React island bundle 入口 | 【事实】`weshop/package.json:21` |
| files | **必须**包含 cordis.patch.yml 和 lib/index.js + lib/client.js | 【事实】`weshop/package.json:25-35` |
| prepare script | **git install 时必填**——pnpm ≥10 默认禁止 git 依赖跑 build（publish.md:154-172）；npm install 不需要因为 npm 不跑 prepare 的 build 模式 | 【推断】由 publish.md §"build-script catch" 推出 |
| dependencies 里 in-box bundle 名 | **禁止**——@deepseek-ai/dsh-* 由 dsh 自带，重复声明会冲突 | 【事实】`dsh/docs/user/develop/basic/publish.md:128`「in-box bundle names always resolve from the dsh installation itself」 |

**体积预期**【假设】：
- host 侧 lib/index.js（含我们的 host tools + /api/openpencil/* 路由 + persona/skills 注册）—— 估算 ≤ 80 KB minified（参照 weshop/lib/index.js 的 270 KB 是因为含 weshop 全套 OpenAPI client；我们不需要）
- client 侧 lib/client.js（Vue 编辑器 mount + portal + Vue app 全代码）—— **估算 ≤ 1.5 MB**。Vue runtime + 编辑器全部代码若不打 tree-shaking 优化可能更大；建议 tsdown 配置 externals 把 react/react-dom 标 peer（不打包）
- skills 目录（3 个 SKILL.md）—— < 50 KB
- presets 目录（1 个 agent.cordis.yml）—— < 10 KB

---

## B 节 · 分发链路

### B1. 完整安装流程（七步）

**【事实】** 每步的证据：

**① dsh 用户基础环境已就位**
- 用户装 dsh（npm i -g @deepseek-ai/dsh 或 GitHub release），得到 dsh 二进制
- dsh 首次启动时在 ~/.dsh/ 创建 profiles/、agent-presets/、cordis.patch.yml 等（home 结构由 DSH_HOME 环境变量决定，默认 ~/.dsh/）【事实】`dsh/packages/bundle/web-app/cordis.patch.yml:54-58` 用 dshHomePath('storages') 佐证 home 在 $DSH_HOME
- 默认 profile web 已含 @deepseek-ai/dsh-base + @deepseek-ai/dsh-web-app（`dsh/docs/user/develop/basic/publish.md:93-101`）

**② 用户执行我们的命令**

```sh
dsh plugin --profile web add openpencil-marketing
```

这一步 dsh plugin 子命令透传给 pnpm，等价于在 ~/.dsh/profiles/web/ 目录下跑 pnpm add openpencil-marketing。【事实】`dsh/apps/cli/src/args.ts:171-181` requiredOption('--profile <name>') + forwarded to pnpm

**③ pnpm 装包**

pnpm 解出我们包的依赖（vue / phosphor-icons 等），写到 ~/.dsh/profiles/web/node_modules/。【事实】`dsh/docs/user/develop/basic/publish.md:128`「pnpm manages only out-of-tree packages」

**④ profile 文件被修改**：因为我们的 package.json 声明了 dsh.bundle，dsh 追加一行到 ~/.dsh/profiles/web/package.json 的 dsh.profile.bundles 数组：

```jsonc
{
  "name": "dsh-profile-web",          // 占位
  "private": true,
  "dependencies": {
    "@deepseek-ai/dsh-base": "...",   // 已存在
    "@deepseek-ai/dsh-web-app": "...",
    "openpencil-marketing": "^0.1.0"
  },
  "dsh": {
    "profile": {
      "bundles": [
        "@deepseek-ai/dsh-base",
        "@deepseek-ai/dsh-web-app",
        "openpencil-marketing"        // dsh 自动追加
      ]
    }
  }
}
```

【事实】`dsh/docs/user/develop/basic/publish.md:83-101`（hello-plugin 实际产物）

**⑤ 重启 dsh**：用户跑 dsh --profile web。新一层的 patch 应用顺序：

1. @deepseek-ai/dsh-base 的 patch（基础层）
2. @deepseek-ai/dsh-web-app 的 patch（web 层，含 ui-conversation / shell.overlay slot 声明）
3. openpencil-marketing 的 patch（**我们新增**，含 openpencil-tools row + openpencil-canvas-host row + agent preset 拷贝）
4. profile 自己的 cordis.patch.yml（用户层）
5. ~/.dsh/cordis.patch.yml（home 级，用户机共享）
6. --patch <path> argv overlay（每次启动的临时覆盖）

【事实】`dsh/docs/user/develop/basic/publish.md:112-127` 完整顺序

**⑥ dsh 启动后我们的代码跑在哪**：
- **host 进程（Node）**：我们 lib/index.js 的 apply(ctx) 被 Loader mount 到 host cordis 树，注入 webServer / tools / skills（参照 `weshop/src/index.js:28`）。ctx.webServer.register({kind:'prefix', path:'/api/openpencil', handler}) 暴露 /api/openpencil/* HTTP 路由（参照 `weshop/src/index.js:158-309`）。
- **browser 进程（Chromium）**：dsh-web-app 的 kernel 把我们的 lib/client.js 当成 module 加入 __DSH_BOOT__，浏览器端的 dsh-cordis-runner 在我们的 apply 函数里被调用，挂载 React island 到 shell.overlay slot。【事实】`dsh/packages/bundle/web-app/cordis.patch.yml:147-172` 注释「The shell kernel constructs before cordis exists」+ `weshop/src/client/index.jsx:163-183` 注册范式

**⑦ 用户怎么打开 marketing 工作台**：
- 用户在 dsh web UI 打开 General settings → agent preset → 选 openpencil-design
- preset 切换事件 agent-preset/selected 触发（白名单事件，参 spike 03 §B4）
- 我们的 React island 监听到 preset === 'openpencil-design' 时 createPortal(<VueEditor>, document.body, {zIndex: 1000001}) 挂载编辑器
- 用户在 Chat 输入 → 工具执行 → 7600 WS 推编辑命令 → 编辑器 SceneGraph 变

### B2. 离线与更新——三条边界场景

**【事实】** 每条边界对应的官方处理来自 `dsh/docs/user/develop/basic/publish.md:154-179`：

| 边界场景 | 应对 |
|---|---|
| 用户没装 pnpm | dsh 二进制本身自带 pnpm（pnpm 通过 @pnpm/exe 嵌入 dsh 安装）；用户不需要单独装。【推断】由 dsh plugin 透传给 pnpm（`dsh/apps/cli/src/args.ts:171-181`）+ publish.md 不要求 pnpm 预装推出；【假设】若 dsh 没嵌入 pnpm，则用户需先 npm i -g pnpm——本报告未验证 |
| 公司防火墙阻断 npm registry | 用户用 git 仓或 tarball 绕开。命令改成 dsh plugin --profile web add github:open-pencil/marketing#<sha> 或 dsh plugin --profile web add ./openpencil-marketing-0.1.0.tgz。【事实】`dsh/docs/user/develop/basic/publish.md:155-178`。**注意 git install 触发 prepare 脚本的 allowBuilds 许可**——用户需在 ~/.dsh/profiles/web/pnpm-workspace.yaml 写 allowBuilds: openpencil-marketing: true 才能跑 build。【事实】同上 publish.md:165-172 |
| dsh 二进制版本与 bundle 声明的 dsh 版本不匹配 | dsh **没有显式版本约束机制**——in-box bundle 名 pnpm 解析时永远取当前 dsh 自带的版本（publish.md:128）。如果我们 bundle 引用了新版才有的 row id / API，老版本 dsh 启动时会**静默缺 row**（loader 找不到 name 对应的 plugin 包）。【推断】由「in-box bundle always resolves from dsh installation itself」+ row insert 失败的常识推出；**早期信号**：dsh --profile web --dump-config 输出里缺我们的 row id |

**更新策略**【假设】：
- npm 路径：dsh plugin --profile web update openpencil-marketing（pnpm 原生命令，**【假设】** dsh 是否拦截 update、是否改 bundles 列表顺序——未验证）
- 强制回到出厂状态：dsh plugin --profile web remove openpencil-marketing && dsh plugin --profile web add openpencil-marketing（**【事实】** `dsh/docs/user/develop/basic/publish.md:110` remove 命令范式）

---

## C 节 · 落地架构

### C1. 运行时拓扑——三个进程的边界、端口、auth

**【事实】** 参考 spike 03 §C2 + 本报告图 2。

**进程 A：dsh-host（Node）**
- 由 dsh --profile web 命令启动，包含 @deepseek-ai/dsh-base + @deepseek-ai/dsh-web-app + 我们 bundle 的 host 侧
- 在 localhost:3080（默认）启动 HTTP server（`dsh/packages/bundle/web-app/cordis.patch.yml:115-121` port: !!js ctx.webStartup.port ?? 3080）
- 暴露 /api/* 给 dsh-web，暴露 /api/openpencil/* 给 open-pencil 编辑器（通过 ctx.webServer 注册 prefix route）
- 进程身份：dsh 二进制 fork 的子进程（或同一进程，按 dsh 实现）

**进程 B：dsh-web（Chromium 标签）**
- 用户在浏览器打开 http://127.0.0.1:3080
- dsh-web-app dist 由 host serve（`dsh/packages/bundle/web-app/cordis.patch.yml:130-136`）
- 我们的 React island 挂在 shell.overlay slot，portal→document.body 后 z-index=1000001
- 编辑器本体（Vue app）通过 portal 挂载；不直接对外暴露端口

**进程 C：open-pencil 编辑器（独立的 Chromium 标签 / 标签内 iframe / tab）**

**【事实】** 三种嵌法在 §D2 详评。这里只列边界：

- 如果是**独立 Chromium 标签**：用户在 dsh web UI 点按钮 window.open('http://127.0.0.1:7600')——**复用了我们旧的 MCP/automation 入口**（`old/src/app/automation/bridge/server.ts:14-44`）
- 如果是**iframe**：dsh web <iframe src="http://127.0.0.1:7600">——需要 dsh web 的 CORS/frame-ancestors 允许（**【假设】** dsh webserver 默认是否允许 iframe 自嵌入——未验证）
- 如果是**portal 到同一标签的 body**：与 dsh web 同源同进程，**不需要 7600 port 的跨域**——但 Vue app 的全局状态会污染 dsh web

**端口清单**【事实】：

| 端口 | 谁占用 | 暴露给谁 | auth |
|---|---|---|---|
| 3080（默认） | dsh-host HTTP | dsh-web（Chromium）+ 工具桥可访问 | dsh 自家 token（**【假设】** 机制未深查） |
| 7600 | open-pencil 编辑器 WS server | dsh-host 工具桥（HTTP POST over RPC） | randomhex(32) token，浏览器侧生成，握手时 socket.send({type:'register', token})（`old/src/app/automation/bridge/server.ts:15, 43`） |
| 7600 在 dsh 视角 | — | — | **7600 是 open-pencil 的旧端口，不是 dsh 的端口**。前几版报告错写「7600 是 dsh 默认 host port」——**纠正**：在 dsh 全仓搜不到 7600；ws-bridge 服务端代码是 open-pencil 自有的（`old/src/app/automation/bridge/server.ts:14-44`） |

**auth token 来源**【事实】`old/src/app/automation/bridge/server.ts:14-15`：const token = authToken ?? randomHex(32)——浏览器侧自动生成；host 端 7600 server 接受这个 token 作为鉴权。**问题**【假设】：dsh-host 进程不直接持有这个 token，需要在 openpencil_apply_design.execute() 里 hardcode 一个长期 token，或者从 dsh-home 某处读——**这是 X 路线下必须解决的工程问题**（F2 陷阱之一）。

### C2. 7600 port 的精确角色

**【事实】**
- 7600 = AUTOMATION_HTTP_PORT，open-pencil 编辑器进程暴露的 WebSocket server。【事实】`old/packages/core/src/constants.ts:347` export const AUTOMATION_HTTP_PORT = 7600
- WS server 接受浏览器/host 注册（{type:'register', token}），收到 RPC {type:'request', id, command, args} 后路由到 handleAutomationRequest(store, command, args)【事实】`old/src/app/automation/bridge/server.ts:14-101`
- 已有的命令集：makeFigmaFromStore + createAutomationCommandHandlers（`old/src/app/automation/bridge/handlers.ts:18` + figma-factory.ts）

**X 路线下 7600 的角色**：
- 我们的 host 工具 openpencil_apply_design 经 7600 触发编辑器 SceneGraph patch
- **不**经过 dsh wire 的 /api/events.mux（那是 host↔web 用，不是 host↔外部编辑器用）
- 我们的浏览器侧 React island 启动时同时打开 ws://127.0.0.1:7600 连接（保留旧桥，复用 `old/src/app/automation/bridge/server.ts:14` 模式或新写）

**【推断】** 工具触发路径：「host 工具 execute() → 我们内部 fetch http://127.0.0.1:7600/rpc 或通过 Node WebSocket 直连 7600 → 编辑器 scene patch → 返回 ok/error → 工具 tool/result 事件 → dsh wire 回流到浏览器」。

**token / 鉴权机制**【事实 + 推断】：
- 编辑器启动时 randomHex(32) 生成 token，写到 localStorage 或 cookie
- host 端 7600 server 要求注册时附带正确 token（**【假设】** 实际是否有此校验——`old/src/app/automation/bridge/server.ts` 完整读完后能确认）
- 我们 host 工具要发请求，需知道这个 token —— **这意味着 host 工具与编辑器要共享一个 token**。**【推断】** 我们的解决方案：编辑器启动时把 token 写到 $DSH_HOME/openpencil-token 文件，host 工具读这个文件；或编辑器起一个本地 HTTP POST endpoint，接收 host 工具的 token 设置请求

### C3. SessionFace 的方法面与 ChatPanel 用法

**【事实】** SessionFace = ISession & ObservableSnapshot<ConversationSnapshot>（`dsh/packages/client/runtime/src/client/contract/session.ts:89`）。

**完整动词面与 getter 面**（**【事实】** `dsh/packages/client/runtime/src/client/contract/session.ts:30-82`）：

| 方法 | 类别 | 一句话 | 我们 ChatPanel 的用法 |
|---|---|---|---|
| subscribe(listener) | getter（数据） | 订阅 ConversationSnapshot 变化 | useSyncExternalStore(s => s.session.subscribe, s.session.getSnapshot, s.session.getSnapshot) |
| getSnapshot() | getter（数据） | 取当前 ConversationSnapshot | 同上 |
| prompt(content, mode) | 动词 | 发消息；mode=queue 排队 / steer 中断当前 turn | await session.prompt([{type:'text', text}], 'queue') |
| cancel() | 动词 | 停当前 turn | cancel 按钮 onClick |
| rename(title) | 动词 | 重命名 session | settings UI 用 |
| loadOlder() | 动词 | 加载更早历史 | 滚动到顶部时 |
| updateQueue(itemId, action) | 动词 | 编辑/删除/steer 队列项 | 队列项的菜单操作 |
| readAttachment(attachmentId) | 动词 | 读 attachment bytes | 图片预览用 |
| command(line) | 动词 | 跑 /slash 命令 | /compact、/model 等 |
| pending[i].respond(result) | 动词（**不在 SessionFace 上**，在 ConversationSnapshot.pending[i]） | 回审批/问题 | CanvasQuestion / CanvasApproval 调用 |
| sessionId | 属性 | session id | UI 显示 |
| projections | getter（数据） | ProjectionsFace | 读 session 投影值 |

**典型代码片段**（基于 `weshop/src/client/CanvasChat.jsx:190-246` Vue 改写）：

```ts
// old/src/ai/openpencil-chat/useSessionFace.ts
import { useSyncExternalStore } from 'vue'
import type { SessionFace } from '@deepseek-ai/dsh-client-runtime/contract/session'

export function useSessionRows(session: SessionFace) {
  const snapshot = useSyncExternalStore(
    (l) => session.subscribe(l),
    () => session.getSnapshot(),
    () => session.getSnapshot(),
  )
  // snapshot.chat.order + snapshot.chat.nodes.get(key) 拿消息列表
  // snapshot.running 显隐 cancel 按钮
  // snapshot.pending 找 question/approval
  // snapshot.promptError 错误显示
  return snapshot
}

export async function sendPrompt(
  session: SessionFace,
  text: string,
) {
  const res = await session.prompt([{ type: 'text', text }], 'queue')
  if (!res.ok) throw new Error(res.error?.message ?? 'send failed')
}
```

### C4. tool execute → 编辑器 SceneGraph 端到端流程

**【事实】** 链路环节证据已在 §2 图 3 标注。这里给一个具体例子「把这页改成黑色背景」：

```
[1] 用户在 ChatPanel 输入 "把这页改成黑色背景"
    触发 sendPrompt(session, "把这页改成黑色背景")
    【事实】session.prompt 签名 dsh/.../contract/session.ts:36-41

[2] dsh-wire 浏览器→host：POST /api 带 client-request
    （【推断】由 session.prompt 内部走 SessionBinding 路由推出；
     完整 wire 协议见 dsh/.../api/remotes）

[3] dsh-host agent loop 启动 turn
    读 systemPrompt（含 persona + tools schema）
    模型决定调工具 openpencil_apply_design({bg:'#000'})
    【事实】turn flow 见 dsh/docs/architecture.md:65-84

[4] ctx.tools 行 openpencil-apply-design.execute(args)
    走 tools/pre-execute 审批 → tools/execute → tool/result 事件
    【事实】tool pipeline 见 dsh/docs/architecture.md:75-77

[5] 我们的工具实现（Node 端，在 dsh-host 进程里）
    fetch('http://127.0.0.1:7600/rpc', {
      method: 'POST', body: JSON.stringify({
        type: 'request',
        id: 'tool-call-123',
        command: 'editor.sceneGraph.patch',
        args: [{op:'set-fill', selector:'page[0]', value:'#000'}],
        token: <shared token>,
      })
    })
    【推断】调用形态；具体走 ws 还是 http 待 spike 验证

[6] open-pencil 编辑器进程（Chromium 标签 / portal iframe）7600 WS server
    收请求 → route → handleAutomationRequest → makeFigmaFromStore →
    SceneGraph patch operations → 重渲染 → 返回 {type:'response', id, ok:true}
    【事实】old/src/app/automation/bridge/server.ts:14-101；
           SceneGraph patch op 见 old/src/editor/scene/operations.ts（路径占位待查）

[7] host 工具拿到 ok → tool/result 事件回流到 dsh wire
    /api/events.mux 推 session/event{type:'tool/result'}
    → ConversationSnapshot 更新 → ChatPanel 重渲染
    【事实】tool/result 是 SessionEvent 的一种，spike 03 §B4

[8] 用户看到"已应用：黑色背景"
    编辑器画布即时更新
```

---

## D 节 · 桥的具体形态

### D1. 跨边界数据传递的四种方式评估

**【事实 + 推断】** 评估的四种方式：

| 方式 | 机制 | 在 X 路线下可行性 | 选/不选 + 一句理由 |
|---|---|---|---|
| React Context | dsh 自家 React 树内用 createContext 共享状态 | 可行（React island 内部） | **不选**——React Context 不能跨 portal 边界把状态传给 Vue app；Vue 端读不到 |
| Window 全局对象 | window.__OPENPENCIL_BRIDGE__ = { session, store, ... } | 可行（简单暴力） | **不选**——污染全局、与 dsh web 的 window 冲突、SSR/多实例不安全 |
| Typert RPC | dsh 内部的 typed RPC 框架（packages/typert/generator/） | **不可行** | **不选**——Typert 是 **Cordis Service ↔ Remote** 的生成器，**不**是「Vue↔React」通用 RPC。前几版报告误用此词——`dsh/packages/typert/generator/src/emitter.ts` 是 generator，**不是** Vue 端可导入的 SDK |
| JSON-RPC over WS | 7600 WS bridge 已存在 | **可行** | **选**——已有服务端实现（`old/src/app/automation/bridge/server.ts:14-101`）、已有 client 模式（`old/src/app/automation/bridge/server.ts:14`）；复用而非新写 |

**【推断】我们选 JSON-RPC over WS（7600 桥）**。理由：
1. 桥的 server 端已存在、token 协议已存在
2. 命令集（createAutomationCommandHandlers）可扩展，加一个 editor.sceneGraph.patch 命令
3. 与 dsh wire 完全解耦——dsh 0.x preview 颠簸不影响我们的 7600 路径

**【假设】** 是否需要新写一个「Vue ↔ React」桥（同一个 dsh-web 浏览器标签内的 React island 与 portal Vue app 之间的桥）——**大概率需要**，但只在以下场景触发：
- Vue 编辑器需要触发 dsh session 操作（如「把这个错误发给 dsh Chat」）
- dsh Chat 需要读 Vue 编辑器选区（如 @selection mention）

**【推断】** 这条桥的实现**先用 props**——React island 渲染 Vue 时把 session: SessionFace、onSelectionChange: (s) => void 作为 props 传入。Vue 端通过 defineExpose 把方法暴露给 React 端 useRef 调用。**不做 props 桥的 fallback**——prop 桥够用且不增加复杂度。

### D2. Vue 编辑器作为 React island 的具体挂载方案

**【事实】** 三种方案在 spike 03 §0.1、§C1 有评。

**方案 A：React 包装器**（weshop 范式衍生）

```tsx
// lib/client.js 内 React island
import { createApp } from 'vue'
import OpenPencilEditor from './editor/OpenPencilEditor.vue'
import type { SessionFace } from '@deepseek-ai/dsh-client-runtime/contract/session'

export function apply(ctx) {
  let disposeVue = null
  let editorContainer = null

  const mount = (session: SessionFace, container: HTMLElement) => {
    editorContainer = document.createElement('div')
    editorContainer.style.cssText = 'width: 100%; height: 100%;'
    container.appendChild(editorContainer)
    const app = createApp(OpenPencilEditor, { session, container: editorContainer })
    app.mount(editorContainer)
    disposeVue = () => app.unmount()
  }

  ctx.slots.register(
    { name: 'shell.overlay', id: 'openpencil-editor', order: 10 },
    () => {
      const session = ctx.sessions.binding(ctx.sessions.list.getSnapshot().current)?.session
      if (!session) return null
      // 用 createPortal 绕 z-index=20 限制
      return createPortal(
        <div ref={(el) => el && mount(session, el)} style={{ position: 'fixed', inset: 0, zIndex: 1000001 }}>
          {/* Vue mount target */}
        </div>,
        document.body,
      )
    },
  )

  return () => disposeVue?.()
}
```

- **文件路径占位**：lib/client.tsx、lib/editor/OpenPencilEditor.vue（从 old/src/views/... 复制 + 改写）

**方案 B：iframe**

```tsx
// lib/client.js 内 React island
ctx.slots.register(
  { name: 'shell.overlay', id: 'openpencil-editor', order: 10 },
  () => {
    // 假设编辑器已启动在 http://127.0.0.1:7600
    return createPortal(
      <iframe
        src="http://127.0.0.1:7600/?embed=1"
        style={{ position: 'fixed', right: 0, top: 0, width: '40%', height: '100vh', border: 'none', zIndex: 1000001 }}
      />,
      document.body,
    )
  },
)
```

- **文件路径占位**：lib/client.tsx、old/src/main.ts 加 ?embed=1 模式

**方案 C：自管 portal**（不挂在 dsh slot）

```ts
// 旧 main.ts 启动后自己 document.body 挂一个 div
const island = document.createElement('div')
island.id = 'openpencil-dsh-island'
document.body.appendChild(island)
// 然后用 dsh 暴露的什么 API 通知 dsh 我们存在——【假设】无此 API
```

- **不推荐**——脱离子挂载就脱离了 dsh 的 slot 协议，session 切换、preset 切换时不会自动卸载

**【推断】选方案 A（React 包装器 + createApp/unmount + portal）**。理由：
1. 与 weshop 范式一致（已验证 z-index + portal 绕路，参 weshop/src/client/index.jsx:30-35）
2. SessionFace props 直接传递，无 RPC
3. disposeVue 在 React island unmount 时被调，Vue 端 cleanup 走标准生命周期
4. 浏览器侧一个标签内搞定，不需要用户手动开第二个标签

**【假设】** Vue 编辑器自带的 styles 是否会被 dsh web 的全局样式覆盖——需要实测；如冲突，把 Vue 组件全部 <style scoped> + >>> 深度选择器兜底

---

## E 节 · 工程节奏

### E1. 第一周可做的事——今天下午就能上手

**【事实】** 命令序列完全照搬 `dsh/docs/user/develop/basic/publish.md` §"Two concepts, two manifests" + §"Install into a profile"。

**Day 1（2 小时）**：
1. git init openpencil-marketing-bundle && cd openpencil-marketing-bundle
2. 写 package.json（照本报告 A2 模板，name 改为 openpencil-marketing）
3. 写 cordis.patch.yml（**仅**一个 row：- insert: [{id: hello, name: 'openpencil-marketing'}]）
4. 写 index.js：export const name = 'openpencil-marketing'; export function apply() { console.log('[openpencil-marketing] loaded!') }
5. pnpm link --global（或 npm link）

**预期产出**：openpencil-marketing-bundle/ 目录，含 3 个文件，零依赖。

**Day 2-3（半天）**：
1. 用户在自己机器：dsh plugin --profile demo add openpencil-marketing-bundle（按 `publish.md:79-81` 范式）
2. dsh --profile demo --dump-config（**确认**我们的 row id hello 出现在 layers 里——本报告 §F1 早期信号之一）
3. dsh --profile demo 启动 → console 看到 [openpencil-marketing] loaded!
4. 浏览器打开 http://127.0.0.1:3080 → 能看到 hello-plugin 占位（如果注册了 UI）

**预期产出**：第一个 hello-plugin-bundle，能装能跑能 dump。

**Day 4-5（1.5 天）**：把 lib/index.js 替换为真实 plugin（host tools 注册、/api/openpencil/* 路由、persona/skills 注册）。照 `weshop/src/index.js:152-309` 范式改。

**第一个 commit 范围**：
- chore(scaffold): openpencil-marketing bundle skeleton（仅 hello-plugin 3 件）
- feat(host): openpencil_apply_design tool + /api/openpencil/* route
- feat(host): marketing persona + 3 SKILL.md
- feat(client): React island 挂 shell.overlay + portal→body + createApp Vue

**【假设】** 上述 4 个 commit 之后能跑通「用户在 dsh Chat 输入 → 工具触发 → 7600 WS → 编辑器 SceneGraph 变」**最小端到端**——这才是 E2E 验证。

### E2. 第一周后会卡住的决策点

**【事实 + 推断】** 每个决策点 + 卡住的代价（owner 视角）：

| # | 决策点 | 一句话说明 | 卡住的代价 |
|---|---|---|---|
| D1 | bundle 命名 openpencil-marketing vs dsh-openpencil vs @open-pencil/dsh-plugin | npm 包名是否带 dsh- 前缀 | 名字定不下来则发包阻塞——但**纯工程决定**，可 owner 拍 |
| D2 | 我们要不要 ship 一个 headless profile 适配 | headless profile 是 dsh 的另一份（CLI 单回合，spike 01 §X5） | 卡住的话 marketing 工作台 web-only；headless 用户触达不到——**X 路线独占价值打折** |
| D3 | persona 文案是中文还是英文 + 多语言 | agent preset 的 persona.text 是单语还是 i18n | 卡住则非英语用户不可用——owner 拍语言矩阵 |
| D4 | 我们的工具 openpencil_apply_design 的输入 schema 粒度 | 单 patch op vs 一组 ops；op 是 JSON DSL 还是结构化 schema | 卡住则工具调用 LLM 准确率受影响；schema 越结构化模型越不幻觉 |
| D5 | 7600 token 共享机制 | host 工具如何拿到浏览器侧生成的 token | 卡住则每次工具调用都鉴权失败；【F2 陷阱之一】 |
| D6 | 我们是否 fork 一个 agent preset 还是用 standard + 最小 patch | dsh 的 standard preset 已经有 tool-bash 等，**我们只禁掉不想要的**还是**新起一份只含我们想要的** | 卡住则我们的 agent 行为不可控（继承了用户加进 standard 的所有工具） |
| D7 | Vue 编辑器是单组件嵌入还是 portal 整个 app | 方案 A vs B vs C（§D2） | 卡住则 React 包装器层的复杂度爆掉；推荐方案 A 但 owner 应确认 |
| D8 | 是否在 bundle 里自带 weshop-like /api/weshop 风格的 JSONL 文件总线 | marketing 工具结果可能需要 host→browser 主动推（不通过 session 流） | 卡住则某些状态变化要 800ms 轮询兜底；weshop 范式 |
| D9 | 是否需要 dsh 白名单事件 openpencil/* | marketing 自定义事件怎么广播 | 卡住则只能走白名单的 settings/document-updated 绕路（spike 03 §D2.4）；不致命但别扭 |
| D10 | 自动升级 vs 手动 | dsh plugin update 是否提供 | 卡住则用户必须手动 remove + add；不致命 |

**D6 是工程上最重的**（影响后续所有工具调用），**D5 是最容易踩雷的**（F2 陷阱直接落在这里）。

---

## F 节 · 风险与缓解（X 专属）

### F1. dsh 0.x preview 颠簸面

**【事实 + 推断】** 至少 4 个具体破坏面：

| 破坏面 | 早期信号 | 缓解成本 |
|---|---|---|
| slot API 漂移：shell.overlay、conversation.composer 的 id / order / 子 slot 列表 | dsh --profile web --dump-config 输出里 ui-shell / ui-layout rows 的 config 字段变化；我们的 React island 报错找不到 slots | 适配层 lib/dsh-version-adapter.ts 收敛所有 dsh API 调用——一处改 vs 全改；**【推断】** 适配层 0.5-1 人日 |
| cordis.patch.yml schema 漂移：row id 改名、inject 字段从 string 变 string[] | 我们 patch.yml 在新版 dsh 启动时报"unknown row id"——dsh --dump-config 看不到我们的 row；**【事实】** `dsh/docs/architecture.md:35-36` 给出 dump 命令 | patch.yml 文件级模板 + CI fixture（用 hello-plugin dump 校验）；**【推断】** 0.5 人日 |
| SessionFace 生命周期 / 方法重命名：prompt 改签名、pending[i].respond 改名 | React island 启动报错（method undefined）；ChatPanel 渲染失败 | 类型层用 interface ISession + adapter 兜底；**【推断】** 0.5 人日 |
| bundle manifest schema 漂移：dsh.bundle 字段变 / 新增必填 dsh.bundle.peer | dsh plugin add 警告但跳过；我们 bundle 不生效 | npm 发包前对最新 dsh 做 dsh plugin add smoke test；**【推断】** 0.5 人日 |

**【推断】** 合计约 2 人日的 dsh-version-adapter + CI smoke；可接受但不便宜。

### F2. 双框架桥的 5 个真实陷阱

**【事实 + 推断】** X 路线下必然遇到的 5 个具体场景：

1. **陷阱 1 — Vue 编辑器快捷键 Ctrl+Z 与 dsh React shell 冲突**
   - 现象：用户按 Ctrl+Z 撤销编辑，dsh 的 React undo stack 也响应了，导致 ChatPanel 历史消息被 undo
   - 解法：Vue 端 app.config.globalProperties.$shortcuts = dshShortcuts —— 把 dsh 已有的快捷键列表注入，Vue 编辑器 mount 时主动 addEventListener('keydown', e => { if (dshShortcuts.has(e.key)) e.stopPropagation() }, true) 在 capture 阶段拦截

2. **陷阱 2 — React portal + Vue mount 时机错位**
   - 现象：React island ref={(el) => el && mount(session, el)} 在 ref callback 里同步 createApp.mount，但 React 18 的 commit 还没完成，DOM 节点未挂载 → Vue app 挂在 detached div 上 → 看不见
   - 解法：用 useEffect 在 commit 完成后调 mount；或用 requestAnimationFrame 包一层；**【推断】** 与 spike 03 §D2「React 包装器内 Vue app 卸载/挂载 vs dsh 自家 Chat 切换的体感」一致

3. **陷阱 3 — Vue scoped CSS 不被 React island 继承**
   - 现象：Vue 组件 <style scoped> 加 [data-v-xxx] 属性选择器；portal 到 document.body 后这个属性在 mount 时丢失（Vue 重新计算 hash）
   - 解法：要么 Vue 编辑器**全部** <style>（无 scoped），要么用 :deep() 全部包；**【推断】** 推荐前者 + 全局命名空间前缀 .open-pencil-* 防冲突

4. **陷阱 4 — 7600 token 在 dsh-host 与浏览器侧不共享**
   - 现象：host 工具 openpencil_apply_design.execute() 调 fetch('http://127.0.0.1:7600/rpc', {token: '???'})，浏览器侧生成的 token host 端不知道
   - 解法（**【推断】**）：
     - 选项 a：编辑器启动时把 token 写到 $DSH_HOME/openpencil-token，host 工具读这个文件——简单但 token 永久
     - 选项 b：编辑器启动时调 POST http://127.0.0.1:3080/api/openpencil/register-token，host 工具缓存——一次握手 + 短期缓存
     - 选项 c：host 工具不读 7600，改走 ctx.webServer 注册一个 host-only handler，浏览器侧 React island 轮询 host 的 /api/openpencil/state——**违背了 7600 port 的初衷**，不推荐
   - **推荐选项 b**（一次握手 + 缓存）

5. **陷阱 5 — Vue app 与 dsh web 共用 localStorage / IndexedDB**
   - 现象：open-pencil 编辑器的状态（最近文件、草稿）写在 localStorage；dsh web 也写 localStorage（如 sessionStorage 偏好）；key 冲突
   - 解法：Vue 编辑器侧所有 localStorage key 加 openpencil: 前缀；dsh web 侧不动（dsh 自己的 key 不在我们控制）

### F3. 打包与发布

**【事实】** 参照 `weshop/tsdown.config.mjs`、`weshop/package.json:50-52`、`weshop/package.json:19-23`。

**【推断】** 推荐打包配置：

```ts
// tsdown.config.mjs (host build)
import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  target: 'node22',
  outDir: 'lib',
  clean: true,
})

// tsdown.client.config.mjs (client build)
import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: ['src/client/index.tsx'],
  format: ['cjs'],
  target: 'es2020',
  outDir: 'lib',
  clean: true,
  external: ['react', 'react-dom'],  // peer dep，不打包
  // banner/footer 包成 window.__ModuleLoader__.load({ id, factory })
  // （参 weshop/tsdown.config.mjs:31-36）
})
```

**【事实】** 浏览器侧一定要走 dsh 的 module loader 协议：window.__ModuleLoader__.load({id, factory})。这是 dsh client-modules 的加载机制（`dsh/packages/bundle/web-app/cordis.patch.yml:147-172`）。

**前端代码怎么进入 dsh web bundle**【事实 + 推断】：
- 我们的 lib/client.js 是**单独的 JS 文件**，由 dsh 的 dsh.client.modules 在浏览器启动时**动态加载**——**不是** dsh-web-app dist 的一部分
- dsh 通过 dsh.client.inject 字段知道加载哪些包；包名 → 加载 ./client.js 子路径
- **Vue 编辑器怎么打**：打成单个 lib/client.js（CJS）+ externals React/ReactDOM；体积估算 **≤ 1.5 MB**（含 Vue runtime + 编辑器所有代码）
- **【假设】** 不打包 React/Vue 的 tree-shaking 优化，体积上限可能到 2-3 MB——待 spike 实测

---

## G 节 · 验收与里程碑

### G1. Phase 0-X（spike 验证）

**【事实】** 完整保留 spike 03 §7 S-X 6 项验证清单（每个加今天能做的最小动作）：

| # | 验证项 | 时间 | 通过标准 | 今天能做的最小动作 |
|---|---|---|---|---|
| S-X1 | SessionFace 通过 React 包装器暴露给 Vue 端 | 0.5d | apply(ctx) 里写 React 包装器通过 props.session 透传给 Vue 组件；subscribe/getSnapshot/prompt/cancel 在 Vue 端能调通 | 抄 weshop/src/client/index.jsx:115-263 范式 → 写一个 React island 只 mount 一个 Vue 组件显示 session.sessionId |
| S-X2 | 自写 Vue ChatPanel 消费 ConversationSnapshot | 1.5d | 完整复刻 weshop CanvasChat 4 个功能：消息列表 / 文本输入 / cancel / 审批问题 UI | 复制 weshop/src/client/CanvasChat.jsx:190-318 → 翻译成 Vue 3 Composition API + <script setup> |
| S-X3 | shell.overlay portal 实测 z-index 越界 | 0.5d | portal→body 的 overlay 仍在最上层；createPortal(<div>, document.body) + style.zIndex = 1000001 验证 OK | 写一个 lib/client.tsx 只 portal 一个 <div>Hi</div> 到 body，设 z-index=1000001，看是否被压 |
| S-X4 | PendingInteraction.respond 在 React 包装器往返 | 0.5d | 触发工具审批 → Vue 端 wait.respond({ok:true, value:{sessionId, approvalId, outcome:'allowed-once'}}) → tool 执行恢复 → tool/result event 正常回流 | 注册一个 openpencil-approval-test 工具需要审批；在 Vue 端触发 → 响应 |
| S-X5 | dsh-web-ui retro-OS skin 对 overlay 的视觉干扰 | 0.5d | 启用任意 retro-OS skin（xp/ths/qq98/trading/miku）→ weshop-style overlay 仍可见不冲突 | 在 dsh web UI 切皮肤到 xp/ths，看我们 portal 的 div 是否被压 |
| S-X6 | host 端 /api/openpencil/* + dsh 工具 + ctx.tools.register 端到端 | 1d | (a) host 端 ctx.webServer.register({kind:'prefix', path:'/api/openpencil', handler})；(b) host 端 ctx.tools.register({name:'openpencil_apply_design', execute(args){...}})；(c) browser 端 session.prompt → 模型决定调工具 → 工具返回 → Vue 端通过 session.subscribe 感知到 tool/result | 抄 weshop/src/index.js:152-309 范式写 host 侧 plugin；随便定义一个 openpencil_apply_design 工具，工具内 console.log；浏览器 Chat 输入 → 看 console |
| **总计** | — | **4.5d** | 6 项全过 | **任何 1 项可今天下午 2 小时内动手** |


### G2. Phase 1-X（最小集成）

**【推断】** 第一刀切 + 延后：

**切（commit 节点 P1.1-P1.5）**：
- **P1.1** hello-plugin bundle 装通（E1 完成）
- **P1.2** host 侧 /api/openpencil/* HTTP 路由暴露（最小：1 个 GET endpoint）
- **P1.3** openpencil_apply_design 工具注册（最小：1 个参数 bg）
- **P1.4** React island 挂 shell.overlay + portal→body + z-index=1000001
- **P1.5** Vue 编辑器 mount（最小：1 个空 Vue 组件显示"loaded"）

**延后**（Phase 2 做）：
- SessionFace 完整消费（S-X2）
- PendingInteraction 审批 UI（S-X4）
- agent preset openpencil-design 完整定义（含 persona + skills）
- 多语言（i18n）
- retro-OS skin 适配（S-X5）

### G3. Phase 2-X（正式插件发布）

**【推断】** 从 bundle 到 npm 到用户可用的步骤：

1. **pnpm publish** 到 npm（**【假设】** 是否需要 publisher 账号 owner 确认）
2. **README.md** 写清「dsh plugin --profile web add openpencil-marketing」一行安装命令
3. **CHANGELOG.md** 第一个 0.1.0 tag
4. **dsh-market** 上架（**【假设】** dsh-market 是否已上线 + 上架流程——未验证）
5. **GitHub Releases** 一个 0.1.0 release tag + tarball artifact

**【推断】** 不需要等 dsh-market 上线——npm + GitHub README 就够；dsh-market 是放大器不是前提。

---

## 10. 附录：open-pencil 旧仓库资产映射

**【事实】** `old/` = D:\Desktop\AgentLearn _DIYProjects:0openpencil\open-pencil（feature/agent-backend 分支）。

| 旧资产 | 路径 | 进我们的 bundle？ | 备注 |
|---|---|---|---|
| Vue 编辑器视图 | old/src/views/Editor.vue 等 | **进** | 改写为通过 React island portal mount |
| Vue Chat 组件 | old/src/components/chat/ChatPanel.vue 等 | **不进** | 由我们的 Vue ChatPanel 消费 SessionFace 取代 |
| Marketing UI（Vue reka-ui Dialog） | old/src/components/chat/MarketingConfigBar.vue、BriefPanelDialog.vue、ProfileGalleryDialog.vue | **进**（改写） | 改为挂在 dsh slot 或 React island 内的 portal |
| AIProvider / AIModel 配置 | old/src/components/chat/ProviderSetup.vue 等 | **不进** | dsh 自带 LLM provider 配置 |
| useAIChat / @ai-sdk/vue 集成 | old/src/app/ai/chat/use.ts:113-150 | **不进** | 替换为 SessionFace |
| withSelectionContext 注入 | old/src/components/ChatPanel.vue:91-116 | **改写** | 改为 dsh settings 文档-updated 同步 |
| 自动化桥 server（7600） | old/src/app/automation/bridge/server.ts:14-101 | **进** | 复用 + 扩展（加 editor.sceneGraph.patch 命令） |
| 自动化桥 handlers | old/src/app/automation/bridge/handlers.ts:18、figma-factory.ts | **进** | 加新命令 handler |
| Automation port 常量 | old/packages/core/src/constants.ts:347 | **进** | 7600 继续用 |
| automation client | old/src/app/automation/bridge/server.ts:14 引用了 client | **进** | 改造为 React island 内启动 |
| SceneGraph patch op | old/src/editor/scene/operations.ts:55 | **进** | 整体复用 |
| SceneGraph 数据结构 | old/packages/scene-graph/ | **进** | 整体复用 |
| constants.ts (AUTOMATION_HTTP_PORT 等) | old/packages/core/src/constants.ts:347 | **进** | 整体复用 |
| open-pencil 类型栈 | old/packages/core/src/types.ts、old/packages/scene-graph/ | **进** | 整体复用 |
| 自动化 Vite plugin | old/src/app/automation/agent-vite-plugin.ts、vite-plugin.ts | **不进** | 我们走 tsdown，不走 vite plugin |
| AIProviderDefs | old/packages/core/src/constants.ts:155-341 | **不进** | dsh 自带 LLM 适配器 |
| ACP agents (claude-code / codex / gemini) | old/packages/core/src/constants.ts:146-178 | **不进** | dsh 自带 subagent 注册 |
| CLI 模块 | old/packages/cli/ | **不进** | dsh 自家 CLI 取代 |
| Tauri 集成 | old/src/ 含 IS_TAURI 检测 | **不进** | X 路线下我们走纯 web |


---

## 11. 附录：术语歧义预警

报告里作者仍可能误用、本报告**本意**对照：

| 误用 / 易混词 | 本报告里的**本意** | 易被混淆的对应词 |
|---|---|---|
| bundle | dsh 的 npm 配置层包（dsh.bundle 声明） | 不应说「plugin bundle」「plugin 包」——直接说 bundle |
| plugin | 仅指 dsh plugin 命令操作的 out-of-tree bundle；**没有「plugin manifest」这种发布物** | 不应说「plugin manifest」「plugin schema」——说 bundle manifest / dsh.bundle |
| profile | $DSH_HOME/profiles/<name>/ 目录 | 不应说「dsh profile」当成 agent preset 的同义词——是用户启动 --profile <name> 用的 |
| agent preset | dsh 的「一个 agent 的 cordis composition」 | 不应说「dsh preset install」——该命令不存在；用「切到 preset X」 |
| preset | 同上 | 不应说「row preset」「row config preset」——那是 row config schema 默认值，与本报告无关 |
| shell.overlay | dsh 的 list slot（在 AppFrame .overlayLayer 下） | 不应说「overlay 模式」「overlay 设计」——那是设计行话 |
| SessionFace | ISession + ObservableSnapshot<ConversationSnapshot> 的 dsh session 外向面 | 不应说「session face」「对话面」——本意是 dsh 客户端 session API |
| 7600 port | open-pencil 编辑器暴露的 WS 端口（AUTOMATION_HTTP_PORT = 7600，old/packages/core/src/constants.ts:347） | **不**是 dsh 的端口——前几版报告错把 7600 当成 dsh 的 host 端口 |
| SceneGraph | open-pencil 编辑器的场景图（节点树 + ops） | 不应与 dsh 的「session」「scene」混——dsh 没 SceneGraph 概念 |
| layer | dsh patch 的加载顺序（bundle → profile patch → home patch → --patch） | 不应与 Vue keep-alive / React Suspense / webpack layer 混 |
| in-box / out-of-tree | in-box = dsh 源码内 @deepseek-ai/dsh-*；out-of-tree = dsh plugin add 装的外部包 | 不应说「in-tree bundle」「out-tree plugin」——只能说 out-of-tree bundle/plugin |
| hook / 注册 / 副作用 | dsh 是 Cordis 树，**所有"挂东西"都是注册 effect**，不是 React/Vue 的 hook | 不应把 Cordis ctx.effect(() => ctx.slots.register(...)) 叫 "useSlot hook" |
| manifest | dsh 三种 manifest：dsh.bundle / dsh.profile / dsh.client | 不应说「我们 plugin 的 manifest」——说 dsh.bundle 段 |
| 命令 dsh plugin | 透传给 pnpm 的子命令（add/remove/why 等） | 不应说「dsh 插件命令」「dsh bundle 命令」——动词是 plugin 不是 bundle |


---

## 12. 报告锚点（self-check）

**三条最关键的术语标定（防止再混用）**：

1. **「bundle」≠「preset」≠「plugin」**：bundle 是我们发的 npm 包；preset 是 bundle 装的 agent 组合（dsh home 内 agent-presets/<id>/）；dsh plugin 是装 bundle 的命令动词。**没有「dsh preset install」**——前几版错用的命令根本不存在。
2. **「7600」是 open-pencil 自己的端口**，不是 dsh 的。AUTOMATION_HTTP_PORT = 7600 定义在 `old/packages/core/src/constants.ts:347`。前几版报告错说成 dsh 默认 host port——纠正：dsh 全仓搜不到 7600。
3. **「SessionFace」是 dsh 给 plugin 的 session 外向面**（ISession + ObservableSnapshot<ConversationSnapshot>，参 `dsh/packages/client/runtime/src/client/contract/session.ts:89`），**不**是用户简化的 5 方法接口（subscribe/getSnapshot/prompt/cancel/wait.respond）。完整动词面 + getter 面见本报告 C3 表。

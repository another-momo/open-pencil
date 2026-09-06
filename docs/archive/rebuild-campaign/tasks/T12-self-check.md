<!--
  写作纪律（改本文前必读）：
  - 事实性声明必须附核验命令 + 日期，否则标为【假设】
  - 计划被实测推翻时，直接改本文为新版本，完整理由记入 records/ 子文档
  - 本文只保留当前态，不保留修正历史
  - 改完后刷新本文头部的「状态」字段
  - 详细规则见 docs/rebuild/05-process.md §4
-->

# tasks/T12-self-check.md · T12 自检

> **T 编号**：T12（S-X spike 执行 · dsh-X 路线实证）
> **分支**：`spike/s-x`（代码与证据在 `spikes/s-x/`）
> **状态**：六项验证离线面全绿；X3/X6 的模型面按「阻塞即上报」列入 §3

## 1. 结论速览

| # | 验证项 | 结论 | 证据 |
|---|---|---|---|
| X0 | dsh host 环境 | ✅ 无 key 可起 | §2.1 |
| X1 | shell.overlay 渲染 React+Vue island | ✅ 双框架无错误 | §2.2 |
| X2 | 7600 WS RPC 1h 稳定 | ✅ 0 断连（要求 <1） | §2.3 |
| X3 | `openpencil_apply_design` 端到端改图 | ✅ diff 全量 <50ms | §2.4 |
| X4 | preset `openpencil-design` 一次装成 | ✅ 首启安装+可被 agent 面加载 | §2.5 |
| X5 | **硬 gate：切 session 不卸载** | ✅ **gate 通过** | §2.6 |
| X6 | systemPrompt.section 营销注入生效 | ✅ 装配面生效 | §2.7 |

**X5 gate 通过 ⇒ 按 spike 04 §7.1，dsh-X 路线（shell.overlay 整块 island）在机制上成立，无需退回 split slot 备选。**

## 2. 分项证据

### 2.1 X0 · dsh host 环境

【事实】宿主包为 npm 发布物 `@deepseek-ai/dsh@0.1.1-rc.1`（2026-08-21 安装于 `spikes/s-x/host-sandbox/`，未入库）。该版本号与 spike 03 源码审计 tag `528c682e06` 一致（核验：`npm view @deepseek-ai/dsh versions` 与源码仓 tag 对照，2026-08-21）。
【事实】无任何 API key 环境变量下 `dsh web --no-open --port 3080` 正常监听，首页 HTTP 200（核验：`curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:3080/`，2026-08-22 多次复验）。
【事实】`DSH_HOME` 指向 spike 目录内沙箱，宿主状态（会话/工作区/preset）不污染真实用户目录。

### 2.2 X1 · shell.overlay 双框架 island

【事实】`spikes/s-x/plugin` 的 client bundle 经 dsh client-modules 加载后：`[data-spike-island='react-host']` 计数=1、`[data-spike-vue='root']` 计数=1、`window.__spikeIsland` 报告 reactMounts=1/vueMounts=1/errors=[]（Playwright MCP 页面内 evaluate，2026-08-22）。
【事实】点击 Vue 计数器 `count=0 → count=1`（响应式存活）；浏览器 console 0 error 0 warning（Playwright consoleMessages 全量，2026-08-22）。截图：`spikes/s-x/evidence/x1-island-pass.png`。
【事实】**排障记录（可复用发现）**：初版 bundle 浏览器报「loaded without registering」+ `SyntaxError: Unexpected token '<'`——bundle 里是**未转换的生 JSX**。根因：rolldown 对源文件**向上逐级查找 tsconfig.json**，命中仓库根的 `"jsx": "preserve"`（tsconfig.json:18），于是保留 JSX；weshop 参考项目父目录无 tsconfig 所以同配置正常。另：tsdown 0.22.14 配置里的 `jsx` 键**被静默忽略**（核验：`grep -c jsx node_modules/tsdown/dist/config.mjs` 为 0，2026-08-22）。修复：`spikes/s-x/plugin/tsconfig.json` 置 `"jsx": "react-jsx"`，删除 tsdown.config.mjs 里的死键；重建后 `node --check lib/client.js` 通过且 jsx-runtime 调用存在。

### 2.3 X2 · 7600 WS 1h 浸泡

【事实】`ws-bridge-soak.mjs` 60 分钟实测：1792 ping 发出、1792 pong 正常、0 超时、**0 断连**（要求 <1），RTT p50=1ms p95=1ms max=6ms（证据：`spikes/s-x/evidence/x2-soak-60min.json`，2026-08-22 跑完；其中后段与 npm 大安装并行，仍 0 断连）。另有 0.2min 冒烟档 `x2-soak-smoke.json`。
【事实】桥 server 每 25s 发协议层 ping 保活、失活即 terminate（`ws-bridge-server.mjs:140` 附近），浸泡统计的断连为真实断连。

### 2.4 X3 · openpencil_apply_design 端到端

【事实】离线驱动器 `x3-apply-design.mjs`（2026-08-22 跑通，7/7 PASS，证据 `evidence/x3-apply-design-result.json`）：
- 场景 A（8 节点，20 轮 ×3 patch）：diffMs min=0.021 / p50=0.025 / p95=0.167 / max=0.167；含 WS 往返的工具全程 bridgeMs max=16ms。（亚毫秒量级；首次跑动为 0.022/0.024/0.152、bridgeMs max=18，幂等重跑会覆盖证据文件，数值微漂、结论不变）
- 场景 B（状态持续性）：第一次 patch changedNodes=["node-3"]，第二次只含 ["node-4"]——改动沉淀、不误报。
- 场景 C（错误路径）：坏 path 与不支持 op 均以 error 帧拒绝，不静默。
- 场景 D（1000 节点，10 patch）：diffMs min=0.390 / max=8.447（首次 8.200），全量 <50ms。
【事实】驱动器 import 的是插件 `src/index.js` 导出的 `applyDesignExecute`——cordis 工具注册以 `execute: (args) => applyDesignExecute(args)` 一元委托到同一函数体（dsh 以 (args, execCtx) 二元调 execute，不能直接赋值），「工具 execute → 7600 桥 → SceneGraph 变 → diff 回流」链路全真；**未覆盖的最后一程是「模型自主决定调工具」**（需 LLM，见 §3）。

### 2.5 X4 · preset 一次装成

【事实】首次启动宿主日志输出 `[openpencil-spike] preset install: {"installed":true,...}`（脱敏日志存 `spikes/s-x/evidence/x4-preset-install.log`；2026-08-21 首见、2026-08-22 删沙箱 preset 目录重启复现），preset 落 `DSH_HOME/.agent-presets/openpencil-design/`；二次启动 `installed:false / already present`——语义同 weshop installBundledPreset。
【事实】RPC `session.create {agentPreset:"openpencil-design"}` 被接受并落盘（session-87c95853-8669-4f32-ab4f-8683959b465c，`session.list` 可见 agentPreset 字段，2026-08-22）——preset 的 agent.cordis.yml 行集被 agent 面真实加载（坏 preset 会在 create 拒绝）。
【事实】Web UI 模式选择器显示「OpenPencil 设计模式」（截图 `evidence/x5-sidebar.png` 顶部，2026-08-22）。

### 2.6 X5 · 硬 gate：切 session 不卸载

【事实】校准后的自动化 `x5-gate-test.mjs` 全绿（13/13，证据 `evidence/x5-gate-result.json`，2026-08-22）：脚本先经 HTTP RPC 幂等备 workspace+两个非 blank 会话，再 Playwright 交替点击侧边栏 treeitem 共 5 次。
- 5 次切换后 reactMounts=1、vueMounts=1、vueUid=0、`domNode === 初始引用`（sameNode=true）全程不变；
- 每步 `document.title` 交替变化（spike-x5-a ↔ spike-x5-b），证明切换真实发生；
- 收尾点击 Vue 计数器 count 递增——切换后岛仍可交互；
- 全程 console 0 error。
【事实】该结论与 spike 04 §8 的源码断言互证：`renderSlot('shell.overlay', {})` 无 `only` 参数（AppFrame.tsx:193-194），不像 conversation.view 那样按 active.id 卸载。

### 2.7 X6 · systemPrompt.section 营销注入

【事实】离线探针 `x6-system-prompt-probe.mjs` 8/8 PASS（证据 `evidence/x6-system-prompt-result.json`，2026-08-22）：真 cordis Context + 真 `@deepseek-ai/dsh-system-prompt` 服务 + 真插件 apply（仅 tools 服务为记录桩）：
1. type 未选 → 装配结果不含 marketing section（空文本整节丢弃）；
2. 调真实注册的 `openpencil_set_marketing_type` execute({type:'poster'}) → 下一次 assemble 文本含 `type: poster`（prompt 48→264 字符）；
3. 再切 banner → 含 banner 不含 poster；清空 → section 再次消失；
4. 同一注册三次装配三种渲染 ⇒ section 函数逐次求值（与 dsh-system-prompt lib 中 `typeof section.text === "function" ? section.text(context) : section.text` 的实现互证）。
【推断】生产链路（agent loop 每步装配）会观察到同样的逐次求值——assemble 是每步调用的唯一入口（源码层证据 spike 04 §X6 节）；「模型回复体现变化」本身需 LLM，见 §3。

## 3. 阻塞清单（按「阻塞即上报，不伪造通过」）

| 项 | 被阻塞面 | 需要的资源 |
|---|---|---|
| X3 最后一程 | 模型自主决定调用 `openpencil_apply_design`（agent loop 需 LLM） | DeepSeek（或任意 pi-ai 目录内 provider）API key |
| X6 模型面 | 「模型下一次回复正确响应 type 变化」 | 同上 |

离线可验面已全部实测通过；阻塞项未以任何形式伪造。

## 4. 环境附记（可复用）

- 【事实】dsh web 的管理面是纯 HTTP RPC：`POST /api/<service>.<method>`，信封 `{type:"client-request",rpcId,method,payload}`（实测 workspace.create / session.create / session.prompt / session.rename / session.list / workspace.list，2026-08-22）。方法清单见宿主包 `dsh-host-apiproxy`。
- 【事实】dsh web 侧边栏只列**非 blank** 会话（有至少一条消息的）；纯 RPC 建会话来驱动 UI 时需先 `session.prompt` 再 `session.rename`（2026-08-22 实测）。
- 【事实】「添加工作区」入口在无工作区时会直接触发宿主原生目录选择器（`host.pickDirectory` RPC 挂起等 OS 对话框），浏览器自动化不可达——自动化场景改用 `workspace.create` RPC（2026-08-22 实测）。
- 【事实】Windows 上 dsh 源码仓 pnpm install 出现 EPERM rename + 超长 hardlink（约 85min 无进展），改用 npm 发布包等价替代（2026-08-21）。

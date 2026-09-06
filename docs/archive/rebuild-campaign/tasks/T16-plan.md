<!--
  写作纪律（改本文前必读）：
  - 事实性声明必须附核验命令 + 日期，否则标为【假设】
  - 计划被实测推翻时，直接改本文为新版本，完整理由记入 records/ 子文档
  - 本文只保留当前态，不保留修正历史
  - 改完后刷新本文头部的「状态」字段
  - 详细规则见 docs/rebuild/05-process.md §4
-->

# tasks/T16-plan.md · T16 任务计划

> **T 编号**：T16（Phase 1-X 实施 · 7600 桥真链路 + token 链，里程碑 M3+M4 的链路半）
> **分支**：`rebuild/v2`（实施主线；`workbench/` ownedRoot 已登记）
> **状态**：🔄 开工（B1 桥 server 形态探针先行）
> **三件套**：
> - 计划：[T16-plan.md](T16-plan.md)（本文件）
> - 自检：[T16-self-check.md](T16-self-check.md)（开工后持续回填）
> - 核验：[T16-verify.md](T16-verify.md)（收口时 subagent 填报）

## 1. 任务概述

### 1.1 背景与目标

T15 达成 M2（真实编辑器入孤岛）后，island 里的编辑器仍是一座"孤岛"：dsh host 侧的三个工具（`openpencil_apply_design` / `openpencil_set_marketing_type` / `openpencil_bridge_ping`）经 `callBridge` 打的是 **S-X spike 桩**（`spikes/s-x/ws-bridge-server.mjs`，2026-08-22 实证：内存迷你 SceneGraph + ping/echo/apply_design，**无鉴权、无真实编辑器**）；island 侧的 7600 连接也只是一个 ping 心跳探针（`workbench/src/client/editor-boot.js` mountVueApp 内）。

本任务把桥换成真链路（终态架构 F0.2 的 X 路线形态，[spikes/04 §4.5](../spikes/04-dsh-x-design.zh.md)）：

```
dsh 工具 execute() ──auth──> 7600 桥 server ──relay──> island 编辑器客户端（register+token）
        <──────────────────── response ────────────────────┘（在 island 内 core editor 上真实执行）
```

目标：dsh 工具调用在 **island 内活编辑器**上真实改图并返回结果；token 链（7600 token 怎么安全地给到 island 浏览器侧与 host 工具侧，[03 §72](../03-phase-1-runtime.md) 列为开放项）定案落地。

### 1.2 关键决策（本 task 内拍板，理由随附）

1. **桥 server 形态：优先 standalone 复用 `packages/mcp` server 进程，备选入驻 workbench host 插件**——B1 以 1-2h 探针拍板。优先 standalone 的理由：F0.2 语义原样保留（discovery 文件 + bearer token，`packages/mcp/src/auth.ts` timingSafeEqual 鉴权已存在且受测），与上游合流故事一致；桥生命周期独立于 dsh 插件重载。入驻插件的诱饵是"token 进程内共享"，但会让 dsh 插件重启把桥带崩。探针判据：`packages/mcp` server 能否脱离旧编辑器进程独立启动、且支持 editor 客户端 register / 副客户端 auth / request 中继三角色协议（协议形态实证见 [T16-self-check §2.1](T16-self-check.md)）
2. **token 链路由：discovery 文件 → host 插件 node 侧读 → island 经插件 web route 同源取**——浏览器永不读文件；host 工具进程内直接用。web route 先例已实证（T15 assets prefix 路由）。token 不进日志、不进 bundle 源码（运行时 fetch）
3. **island 命令面最小化**：`ping` / `getDocumentTree` / `createShape` / `setProps` / `getSelection`，直打 core editor API（T15 §2.6 实证 `getPages()/getChildren()` 面）；**不搬** `figma-factory` 完整 Figma 门面（11 文件桥全量移植属后续任务）
4. **spike 桩退役**：T16 起 dev 回路用真桥；桩脚本保留在 `spikes/s-x/` 作历史证据不删。dev 期 7600 端口被桩占用时先杀桩再起真桥（如实记录，不抢不占）

### 1.3 范围

| # | 工作项 | 通过标准 | 估时 |
|---|---|---|---|
| B1 | **桥 server 形态探针 + 落地**：探针比对 standalone `packages/mcp` 复用 vs 插件内建（§1.2-1），按判据拍板后起真桥（register/auth/relay 三角色协议 + token 鉴权） | 真桥在 127.0.0.1:7600 起服；错 token 副客户端被拒（timingSafeEqual 负例）；island 客户端 register 成功 | ~1 人日 |
| B2 | **island 真实桥客户端**：editor-boot 换掉心跳桩——同源取 token → 连接 → register → 处理 `{type:'request'}` 最小命令面（§1.2-3）在 island 活编辑器上执行 → 回 response；断线重连 + onUnmounted dispose 接进 E3 dispose 链 | 桥状态头显示真实 register 态；经桥调用 getDocumentTree 返回 demo scene 三节点 | ~0.5-1 人日 |
| B3 | **host 工具真链路**：`openpencil_apply_design` execute 改为真实副客户端（读 discovery → auth → request 中继）；island 未挂载/未注册时如实报错，不伪造成功 | dsh RPC 驱动工具调用（T14 测试缝同款），island 画布可见改图 + 工具返回真实结果；island 未注册时错误语义如实 | ~0.5-1 人日 |
| B4 | **冒烟 + 三件套收口**：端到端冒烟（工具调用 → island 画布可见变化，截图）+ self-check 回填 + subagent 独立核验 | 核验「可以提交」；远端 CI 绿 | ~0.5 人日 |

总计 ~2-3 人日。LLM 驱动的完整 prompt→图闭环（M4 完整语义）依赖 owner 补 DeepSeek key，不在本任务范围；本任务验到"dsh 工具 RPC 驱动"这一层。

## 2. 风险与对策

| # | 风险 | 对策 |
|---|---|---|
| R1 | `packages/mcp` server 与旧编辑器进程耦合，无法 standalone 复用 | B1 探针首要判据；不可复用则落备选（插件内建 WS 桥，ws 依赖已在 workbench） |
| R2 | token 经 web route 暴露给本机任意页面/进程（威胁模型：loopback 同源可读） | route 仅存在于 dsh host（127.0.0.1）；token 运行时 fetch 不进源码/日志；残余风险如实写入 self-check |
| R3 | 工具调用时序：island 未挂载/未注册时 execute 行为 | 桥如实返回"无注册客户端"错误，工具原样透传；B3 负例实测 |
| R4 | 7600 端口与旧 open-pencil 编辑器进程并存冲突 | discovery 文件本就含 port/token 语义；冲突如实报错，不抢端口 |

## 3. 验收标准（桥真链路 + token 链）

1. B1：真桥起服，三角色协议通，错 token 负例被拒
2. B2：island 经真桥 register，getDocumentTree 返回真实 demo scene
3. B3：dsh 工具调用端到端改 island 画布（截图 + 工具返回），未注册时错误如实
4. B4：端到端冒烟 console 0 错；subagent 独立核验「可以提交」；远端 CI 绿

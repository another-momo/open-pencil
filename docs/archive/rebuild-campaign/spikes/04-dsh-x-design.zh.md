<!--
  写作纪律（改本文前必读）：
  - 事实性声明必须附 文件:行号 证据 + 日期，否则标为【假设】
  - 计划被实测推翻时，直接改本文为新版本，完整理由记入 records/narrative/spikes/04-dsh-x-design.zh.md
  - 本文只保留当前态，不保留修正历史
  - 改完后刷新本文头部的「状态」字段
  - 详细规则见 docs/rebuild/05-process.md §4
-->

# 04 · dsh-X 路线专项设计

> 状态：v4（2026-08-20，承接你最近三条纠正：①壳形态统一为 weshop overlay 范式；②"自写 ChatPanel"的论证改为 session 切换不卸载驱动；③ChatPanel 改"自写"不是硬约束）
> 证据路径约定：`dsh/` = 参考项目/deepseek-harness；`weshop/` = 参考项目/weshop-dsh-plugin；`old/` = open-pencil 旧分支 feature/agent-backend
> **文档身份**：case study / 技术调研（辅助参考信息）；决策依据在 01 §7 与 tracker.md D9。本报告不重复对比 Y/pi。

---

## 1. 术语表（按字母序）

> 每条：术语 / dsh 里的精确含义 / 本报告里的指代 / 容易混淆的其他用法。

| 术语 | dsh 里的精确含义 | 本报告里的指代 | 易混用法（警告） |
|---|---|---|---|
| agent preset | 一份 agent-plane 的 cordis composition（`agent.cordis.yml`），定义一个 agent 的工具/技能/系统提示/隔离策略。dsh 在 `$DSH_HOME/.agent-presets/<id>/` 读用户预设；`config/agent-presets/` 读出厂预设。【事实】`dsh/docs/architecture.md:111-112` | 我们要发布的「openpencil-design」agent preset（继承 standard + marketing persona + skills） | 不是 dsh 的「profile」；也不是 dsh 的「preset install」命令的目标（**该命令不存在**） |
| AppFrame | dsh-web-app 的根 React 组件，`.overlayLayer` 容器 z-index:20。【事实】`dsh/packages/client/ui-layout/src/client/AppFrame.tsx:193-194` | dsh web 的根容器；我们所有 React island 都挂在这棵树下 | 与 dsh 的 shell.kernel / ShellRoot / AppDialogRoot 容易混——后两者是同一棵树更下层单元 |
| bundle | npm 包；自身 package.json 的 `dsh.bundle` 字段指向 cordis.patch.yml。**d 的配置层**——插入/覆盖若干 plugin row。【事实】`dsh/docs/architecture.md:21-24` | 我们要发布的**整个产品**（marketing 工作台 = 一个 bundle） | **不是**「preset install」目标；不是 plugin add 的对象类型（命令动词叫 plugin，对象自动判 bundle） |
| cordis.patch.yml | YAML 数组，按 id 覆盖或 insert 新 plugin row；row 是 dsh 的最小配置单元。【事实】`dsh/docs/architecture.md:27, 35` | 我们 bundle 内的 patch 文件 | 与 --patch 命令行 overlay 是**同一种语法** |
| conversation.view slot | `kind: list; scope: session` 的 view ring——**同一时刻只渲染 active tab**（`renderSlot('conversation.view', …, { only: active.id })`）。【事实】`dsh/packages/client/ui-conversation/src/client/skeleton/ConversationSession.tsx:171` | **不要挂编辑器到这里**——切 session/切 tab 会卸载整棵子树 | 与 shell.overlay 是两种**正交**的挂载点 |
| dsh client runtime | 浏览器侧 kernel，扫描 `__DSH_BOOT__` 表，挂载 client modules，路由到各 React island。【事实】`dsh/packages/bundle/web-app/cordis.patch.yml:147-172` 注释 | 我们的 React island 必须在它建立之后挂载 | 与 host cordis 是**两套**cordis 树——host 跑 Node、client 跑浏览器 |
| dsh plugin 命令 | `dsh plugin --profile <name> <args...>` 把 args **透传给 pnpm**——add/remove/why 都走 pnpm。被加的包声明了 `dsh.bundle` 时自动追加到 profile bundles。【事实】`dsh/apps/cli/src/args.ts:171-181` | 用户装我们的命令：`dsh plugin --profile web add openpencil-marketing` | **没有「dsh preset install」命令**；动词 plugin |
| profile | `$DSH_HOME/profiles/<name>/` 目录，内含 package.json（声明 dsh.profile.bundles 数组）+ 可选 cordis.patch.yml。【事实】`dsh/docs/architecture.md:19-20` | 用户 dsh plugin add 我们时，profile 的 bundles 列表会多一项 | 与 agent preset **不同**；profile 是「跑哪些 bundle」 |
| row | cordis.patch.yml 数组里一项；最小单元 `{ id, name?, inject?, config?, disabled? }`。【事实】`dsh/docs/user/develop/basic/publish.md:133-138` | 我们 patch.yml 里每一项 `- id:` / `- insert:` | 与数据库 row、Excel row 不同 |
| SceneGraph | dsh 内部**没有**这个概念。本报告指 open-pencil 编辑器自己的场景图（节点树 + 操作 op），由 `old/src/editor/scene/operations.ts` 定义 | 我们编辑器内部的场景图（非 dsh 概念） | 不要与 dsh 的 session / scene / conversation 混用 |
| SessionFace | dsh 给 plugin 的 session 外向面：`ISession + ObservableSnapshot<ConversationSnapshot>`。【事实】`dsh/packages/client/runtime/src/client/contract/session.ts:89` | 我们 Vue ChatPanel 用：subscribe + getSnapshot 读消息流；prompt([{type:'text', text}], 'queue') 发消息；cancel() 停 turn；pending[i].respond() 回审批 | **不是** "5 方法接口"；prompt/cancel/respond 是 3 个动词，subscribe/getSnapshot 是 2 个 getter；wait 在 ConversationSnapshot.pending 上 |
| shell.overlay | AppFrame `.overlayLayer` 里的 list slot（z-index:20），**多 plugin 可同时挂**（无 `only` 过滤）。【事实】`dsh/packages/client/ui-layout/src/client/AppFrame.tsx:193-194` | 我们 Vue 编辑器 + 自写 ChatPanel 作为整体挂载点（weshop 范式：`createPortal(<div>, document.body, {zIndex: 1000001})`） | **不是** Vue 的 `<Teleport>`、React 的 createPortal——这俩是机制，shell.overlay 是 dsh 的 slot 名 |
| systemPrompt.section | dsh 的 prompt 装配引擎；bundle 可注册动态 section（如 brand 选择项随用户切换 profile 自动注入）。【事实】`dsh/packages/bundle/web-app/src/index.ts:141-149` | marketing 选择项可走这条通道**经 system prompt 注入**——**不是只能经 message body** | 与「patch row 里的 config 字段」完全不同 |

> 完整层数与冲突点见附录 B。

---

## 2. X 路线是什么（产品 + 用户视角）

### 2.1 一段话

X 路线下，**open-pencil marketing 工作台作为一个 dsh bundle 发布**——用户在自己机器装 dsh 后，一条 `dsh plugin --profile <name> add <package>` 命令即可装上我们的包。装上后，dsh 多了一个 agent preset（openpencil-design）、一组工具（openpencil_apply_design / openpencil_look / 等）和一个 React island（挂在 dsh web 的 `shell.overlay` slot 上）。用户切到 openpencil-design preset 时，我们的 React island portal→body 弹出我们整块 Vue app（编辑画布 + 自写 ChatPanel + 工具面板），通过 SessionFace 与 dsh host 通信，通过 7600 WS 桥与编辑器进程通信——**所有交互发生在 dsh web 标签页里，不开第二个标签**。

### 2.2 用户视角七步

1. 用户装 dsh（`npm i -g @deepseek-ai/dsh` 或 GitHub release），得到 dsh 二进制
2. 默认 profile `web` 已含 `dsh-base + dsh-web-app`
3. 用户执行：`dsh plugin --profile web add openpencil-marketing`
4. pnpm 装包；我们的 package.json 声明了 `dsh.bundle`，dsh 自动追加到 `~/.dsh/profiles/web/package.json` 的 `dsh.profile.bundles`
5. 用户跑：`dsh --profile web`
6. 浏览器打开 dsh web → Settings → agent preset 切到 `openpencil-design`
7. **`shell.overlay` 弹出 portal→body 容器：左自写 ChatPanel + 右 Vue 编辑器画布 + 上方/下方工具栏**

### 2.3 运行时拓扑（三个进程 + 两个 loopback）

```
用户机器
  进程 A: dsh-host (Node)
    - 含 dsh-base + dsh-web-app + 我们 bundle 的 host 侧
    - localhost:3080 HTTP server (默认)
    - /api/* + /api/events.mux + /api/openpencil/*
  进程 B: dsh-web (Chromium)
    - dsh-web-app dist 由 host serve
    - dsh-client-* 模块扫描
    - 我们的 React island 挂在 shell.overlay slot
  进程 C: open-pencil 编辑器 (独立 Chromium 标签)
    - 7600 WS server（AUTOMATION_HTTP_PORT，open-pencil 自己的端口）
    - randomHex(32) token 鉴权

  进程 A ↔ 进程 B: HTTP/SSE 127.0.0.1:3080（dsh 自家）
  进程 B ↔ 进程 C: WS 127.0.0.1:7600（open-pencil 自家）
  进程 A ↔ 进程 C: 我们的 host tool `openpencil_apply_design.execute()` fetch POST 到 7600 RPC
```

---

## 3. 关键论证（为什么走 shell.overlay / 自写 ChatPanel）

### 3.1 为什么是 shell.overlay（不是 conversation.view / 其他 slot）

**核心论证：shell.overlay 在 session 切换时不卸载，conversation.view 会卸载。**

| 挂载点 | session 切换行为 | 证据 |
|---|---|---|
| `shell.overlay`（推荐） | **不卸载**——`renderSlot('shell.overlay', {})` 无 `only` 参数，所有注册者同时常驻 | `dsh/packages/client/ui-layout/src/client/AppFrame.tsx:193-194` |
| `conversation.view` | **卸载**——`renderSlot('conversation.view', …, { only: active.id })` 单渲染 active tab | `dsh/packages/client/ui-conversation/src/client/skeleton/ConversationSession.tsx:171` |
| 接管 `conversation` slot（替换 dsh 自家 Chat） | 不卸载，但侵入 dsh 自家 UI 地盘 | （侵入大 + dsh preview 颠簸直接砸脸） |

**结论**：marketing 工作台是常驻 UI（编辑器状态跨 session 切换应保留），shell.overlay 是唯一无卸载风险的挂载点。

### 3.2 为什么自写 ChatPanel（不是复用 dsh Chat）

**不是协议约束**——dsh Chat + ctx.systemPrompt.section() 也能把 marketing 字段灌进 prompt（`dsh/packages/bundle/web-app/src/index.ts:141-149` 实测）。

**真正驱动自写 ChatPanel 的因素**（按强度排序）：

1. **session 切换不卸载**——同上，shell.overlay 上自写 ChatPanel 切 session 不丢草稿
2. **控件形态自由度**——可视化 type card（带缩略图）、profile card、color picker 这些，dsh Chat plain text composer 承载不了；自写可以挂侧边栏/工具栏
3. **UX 统一控制**——自写 ChatPanel + 编辑器在同一个 portal 容器里，风格、间距、快捷键可控

**承认**：marketing 选择项不一定非要走 message body；不一定非要塞进 ChatPanel 本身；也可以挂工具栏而 ChatPanel 保持纯文本。但**这些不构成"必须接 dsh Chat"的理由**——自写的额外投入和可控性是 v4 决定自写的根因。

### 3.3 整块架构选择

| 候选 | 侵入度 | session 切换风险 | UX 控制 | 推荐 |
|---|---|---|---|---|
| A. shell.overlay + portal→body，整块 Vue app（画布 + 自写 ChatPanel + 工具面板） | 低（叠加层） | 不卸载 | 高 | **推荐** |
| B. 接管 conversation slot + 用 dsh 自家 Chat | 高（替换 dsh 自家 UI） | 不卸载 | 低 | 不推荐（侵入大 + dsh preview 颠簸） |
| C. conversation.view tab（加一个 tab） | 中（多一个 tab） | **卸载** | 高 | 不推荐（编辑画布不该切 tab 就重建） |

---

## 4. 落地方案

### 4.1 editor 挂载 + ChatPanel 整体布局（weshop 范式）

**伪代码**：

```tsx
// lib/client.js — React island 注册到 shell.overlay
import { createApp } from 'vue'
import { createPortal } from 'react-dom'
import OpenPencilIsland from './island/OpenPencilIsland.vue'

export function apply(ctx) {
  let disposeVue = null

  const mount = (session: SessionFace, container: HTMLElement) => {
    const app = createApp(OpenPencilIsland, { session })
    app.mount(container)
    disposeVue = () => app.unmount()
  }

  ctx.slots.register(
    { name: 'shell.overlay', id: 'openpencil-island', order: 10 },
    () => {
      const session = ctx.sessions.binding(ctx.sessions.list.getSnapshot().current)?.session
      if (!session) return null
      // z=20 不够 → portal→body + 自管 z=1000001
      return createPortal(
        <div ref={(el) => el && mount(session, el)}
             style={{ position: 'fixed', inset: 0, zIndex: 1000001 }}>
          {/* Vue mount target inside */}
        </div>,
        document.body,
      )
    },
  )

  return () => disposeVue?.()
}
```

**OpenPencilIsland.vue**（一个整块 Vue app）：

```vue
<template>
  <div class="openpencil-island">
    <Toolbar />
    <div class="openpencil-body">
      <Canvas />            <!-- 编辑画布主区 -->
      <ChatPanel />         <!-- 自写消费 SessionFace -->
    </div>
  </div>
</template>

<script setup lang="ts">
import { inject, onUnmounted, ref, watch } from 'vue'
import type { SessionFace } from '@deepseek-ai/dsh-client-runtime/contract/session'

const session = inject<SessionFace>('session')

// Canvas ↔ ChatPanel 通过 Vue 内部 props/events 通信（同 Vue app 内）
// SessionFace 用于：ChatPanel 读/写消息；工具调用经 React island 出去

// session 切换：shell.overlay 不卸载 → Vue instance 在；但 props 变
// watch 内部 state 主动 reset（避免 A session 的选择项污染 B）
watch(() => session, () => { /* reset internal state */ })
</script>
```

### 4.2 Vue 编辑器作为 React island 内 mount 的细节

- **文件路径占位**：`lib/client.tsx`（React island）、`lib/island/OpenPencilIsland.vue`（Vue 整块 app 入口）、`lib/island/{Canvas,ChatPanel,Toolbar}.vue`
- **挂载点**：shell.overlay slot → portal→body 的 `<div z=1000001>` → React island `useRef` 拿到 DOM → `createApp(VueIsland).mount(ref.current)`
- **生命周期**：dsh React island unmount 时 React island 在 portal→body 的子树 unmount → React island 的 cleanup effect → `disposeVue()` → Vue app unmount

### 4.3 SessionFace 在 ChatPanel 内的用法

完整 11 方法面（`dsh/packages/client/runtime/src/client/contract/session.ts:30-82`）：

| 方法 | ChatPanel 用途 |
|---|---|
| `subscribe(listener)` | `useSyncExternalStore(s => s.session.subscribe, s.session.getSnapshot, s.session.getSnapshot)` 读消息流 |
| `getSnapshot()` | 同上 |
| `prompt(content, 'queue')` | 用户在 ChatPanel 输入 → 发消息 |
| `cancel()` | ChatPanel stop 按钮 |
| `rename(title)` | settings UI |
| `loadOlder()` | 滚动到顶部 |
| `updateQueue(id, action)` | 队列项菜单 |
| `readAttachment(id)` | 图片预览 |
| `command(line)` | /compact、/model 等 |
| `pending[i].respond(result)` | 工具审批/问题回调 |
| `projections` | 读 session 投影值 |

### 4.4 marketing 选择项的注入路径（**不是 message body 唯一**）

**3 条等价通道**（按推荐度排序）：

1. **systemPrompt section 注入**（最干净）：在 bundle 里注册一个 section，根据当前 `materialTypeSelection/profileSelection` 动态生成文本。每次用户切换选择项，section 文本自动变
   ```ts
   // cordis.patch.yml 或 client island
   ctx.inject(['systemPrompt'], (promptCtx) => {
     promptCtx.systemPrompt.section({
       name: 'app:openpencil:brand-context',
       order: -90,
       text: () => brandContextPrompt(marketingState),  // 当前选择
     })
   })
   ```
2. **工具入参**（每次工具调用时）：materialType/profile 作为工具参数（如 `openpencil_apply_design({type:'朋友圈', profile:'水彩', …})`）
3. **同 session 内的 application-level state**（如果 dsh 提供类似 `ctx.sharedState` 的东西——【假设】未实测）

### 4.5 7600 port 在 X 路线下的角色

- 7600 = `AUTOMATION_HTTP_PORT`，open-pencil 编辑器进程暴露的 WS server。**不是 dsh 的 port**——`grep -rn 7600 参考项目/deepseek-harness` 零命中
- 我们 host 工具 `openpencil_apply_design.execute()` 经 7600 触发编辑器 SceneGraph patch
- 工具触发链路：host 工具 execute() → fetch POST `127.0.0.1:7600/rpc` → 编辑器 SceneGraph 变 → 返回 ok/error → 工具 result 事件 → dsh wire 回流到浏览器 ChatPanel

---

## 5. 工程节奏

### 5.1 第一周可做的事

E1 Day 1：按 publish.md 起 hello-plugin 骨架（bundle 包结构）
- 跑 `dsh plugin --profile demo add ./hello-plugin` 验证环境
- 对比 weshop 完整结构，列出我们要新增/删除/重写的部分

E2 Day 2-3：编写最小 bundle manifest
- `package.json` 三件事：`dsh.bundle` 字段、exports、dependencies
- `cordis.patch.yml`：openpencil-tools row + openpencil-canvas-host row + agent preset 引用

E3 Day 4-5：写第一个 React island（空壳）
- `lib/client.tsx`：注册到 shell.overlay
- portal→body 容器 + 一个空 Vue mount target
- 验证 dsh 切 preset 时 island 出现/消失（session 切换不卸载应被验证）

### 5.2 第一周后会卡住的决策点（按风险排）

1. session→plugin→tool 的 token/permission 链（7600 token 怎么共享给 host tool？）
2. Vue 编辑器如何复用旧文件（`old/src/` 大量资产需重新打包进 Vue island）
3. marketing systemPrompt section 注入位置（host 端 vs client 端 vs 两端）
4. dev mode 下 Vue island 的 HMR（dsh 自家 HMR 配置是否能 mount 我们 Vue app？）
5. preset 切换 vs 持久化的关系（每个 session 是否绑定 preset？跨 session 复用？）

---

## 6. 风险与缓解

### 6.1 dsh preview 颠簸面（与v3 同：slot API / SessionFace 生命周期 / cordis.patch.yml / preset schema）

### 6.2 shell.overlay 切 session 不卸载带来的副作用

- **优点**：编辑画布状态跨 session 保留——这是 weshop 范式的核心收益
- **副作用 1**：跨 session 状态污染——用户在 session A 编辑画布、切到 session B，画布内容变但 Vue app state（如选择项、滚动位置）还在
  - 缓解：OpenPencilIsland.vue 在 `session` 变化 watch 中主动 reset 内部 state
- **副作用 2**：每次 session 切换都重新 mount Vue app？——shell.overlay 不卸载意味着 mount 一次永远在
  - 缓解：session 变化时**保留** Vue instance，但用 props 让内部组件切换数据；只 reset Vue 内部 state，不 unmount

### 6.3 双框架桥的 5 个真实陷阱（与v3 同）

---

## 7. 验收与里程碑

### 7.1 S-X spike 6 项验证清单（4.5 人日，与 spike 03 §D3 一致）

| # | 验证项 | 通过标准 | 失败回退 |
|---|---|---|---|
| 1 | shell.overlay 渲染 React + Vue 整块 island | 双框架无错误 | 接管 conversation slot |
| 2 | 7600 WS RPC ping/pong 1h 稳定 | < 1 disconnect | 加 reconnect |
| 3 | `openpencil_apply_design` 端到端 SceneGraph 改图 | diff < 50ms | 退回只读 |
| 4 | preset `openpencil-design` install 一次成功 | 全部 assets 加载 | 降级核心 3 项 |
| 5 | **shell.overlay 切 session 不卸载**（v4 新增核心验证） | 切 5 次 session，island DOM 与 Vue instance 不重建；编辑画布在 session 切换后仍可访问 | 退回 split slot 或放弃 shell.overlay |
| 6 | systemPrompt.section 注入营销选择项生效 | 切换 type 字段后，模型下一次回复正确响应变化 | 退化到 message body 注入 |

### 7.2 Phase 1-X commit 序列（5 个 commit 节点）

```
M1: shell.overlay + portal 渲染空 Vue app（验证基本挂载）
M2: Vue 编辑器作为 OpenPencilIsland 子组件（验证 CanvasKit 初始化）
M3: ChatPanel 消费 SessionFace + 7600 WS 接通（验证消息回路）
M4: openpencil_apply_design 端到端（验证最小 prompt→图链路）
M5: systemPrompt section 注入 marketing 选择项（验证提示装配）
```

---

## 8. 附录 A：与 spike 01/03 的差异对照

**v4 相对 v3 的关键修正**：

1. **壳形态论证**：v3 说"shell.overlay + portal 推荐"，但第 5 步内部写"split slot + dsh 自家 Chat"——内部矛盾。v4 全文统一：shell.overlay + portal，整块 Vue app（画布 + 自写 ChatPanel + 工具面板），不分屏。**分屏是视觉编排，不是机制**。
2. **自写 ChatPanel 论证**：v3 写过 "message body 必须塞 marketing 字段所以必须自写"——这是技术约束。v4 修正：**不是协议约束**（systemPrompt section 也行），自写真正的驱动是 session 切换不卸载 + UX 统一控制。
3. **session 切换卸载验证**：v3 没核实就讲"overlay 没风险"。v4 实测：`renderSlot('shell.overlay', {})` 无 `only` 参数（`AppFrame.tsx:193-194`），`renderSlot('conversation.view', …, { only: active.id })` 有（`ConversationSession.tsx:171`）——shell.overlay 切 session **确实不卸载**。

---

## 9. 附录 B：术语歧义预警（self-check）

本次报告里作者可能仍误用的词与我们的本意：

- "**分屏**"：仅视觉编排，不是机制；机制是"shell.overlay 上的整体容器"
- "**portal**"：指 `createPortal(…, document.body)` 机制，不是 dsh 概念
- "**单渲染 slot**"：指 `renderSlot(name, …, { only: id })` 类；不是单 slot 名
- "**bundle**"：发布物；不是 preset、不是 plugin 命令的"加塞对象"
- "**plugin 命令**"：`dsh plugin --profile <name> <args>`；不是 "加插件" 的简称
- "**SessionFace**"：11 方法面；不是 5 方法
- "**overlay**"：shell.overlay 或 z-index overlay 中任一；不在对话上下文里用，避免与 Vue/React overlay 概念混
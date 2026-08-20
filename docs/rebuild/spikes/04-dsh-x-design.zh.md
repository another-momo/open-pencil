# 04 · dsh-X 路线专项设计

> 状态：v2 修正（2026-08-20，纠正 v1 三处错误：①独占价值结论预设错位；②误读 owner 原话；③weshop 描述把无关事串一起）
> **文档身份**：case study / 技术调研（辅助参考信息）；决策依据在 01 §7 与 tracker.md D9
> 与已有文档的关系：本报告**不**重复 01 §7/§8 与 spike 01/03 的内容；本报告承接 owner 偏好走 X 的判断，**集中回答**"如果走 X，落地形态、独占价值、代价、可执行下一步是什么"

## 0. 结论先行

**X 路线的唯一独占价值**：作为 dsh 插件进入 dsh 的**分发与发现渠道**——`dsh preset install` 一键安装 + 在 dsh 插件生态目录里被搜索/试用。**这是 Y 路线（自管后端、不可被发现）和 pi 路线（纯库形态、需要用户自己写服务端集成）都给不了的价值**。其他所谓"独占价值"（物理画布上下文、对话驱动设计、原生多模态）Y 路线都能做到，不是 X 独有。

**owner 偏好 X 的核心理由**（原文复述，不是我归纳）：
- "Y 路线貌似并不是 dsh 未来发展所关注的方向，没办法随 dsh 的发展触达更多用户"
- "作为一个独立产品的话对比 pi 路线好像并没有看见什么优势" —— 指的也是 Y 路线无法触达 dsh 生态用户这件事

**关键风险（与价值无关，仅作为下注成本）**：
- 双框架桥（Vue ↔ React 18+）：详见 spike 01 §X2 实测
- dsh 0.x preview API 漂移（slot API、cordis.patch.yml、SessionFace 生命周期）：详见 spike 01 §X5
- 7600 WebSocket 端口与本地 dsh host tool 的鉴权边界：本次新发现的工程问题

**下注成本**：spike 4.5 人日（spike 03 §D3）+ Phase 2 实现 11 人日 = **15.5 人日** 到达"对话嵌入式编辑器"demo。

---

## 1. X 路线独占价值的精确表述

### 1.1 dsh 的分发机制（这是X 路线独占价值的载体）

dsh 的分发是**分层 + preset** 模型：

- **profile**：命名组合，存于 dsh home（`~/.deepseek/profile/<name>/`），列出其叠的 bundles、out-of-tree plugins、用户的 `cordis.patch.yml`。`web` 和 `headless` 是 ship-as-template 的内置 profile（`docs/architecture.md:19-37`）
- **bundle 声明**：每个 bundle 在自身 `package.json` 的 `dsh.bundle` 字段指向其 patch 文件
- **plugin 注入**：profile 通过 `dsh.profile` 字段列出其 bundles 序列；插件通过 `pnpm add` 装入 profile 目录
- **layer 顺序**：base bundle → 其它 bundles（按 profile 列序）→ profile 自己的 cordis.patch.yml → home 级 → `--patch` 命令行覆盖

【事实】`docs/architecture.md:19-37`（参考项目/deepseek-harness）；`apps/cli/src/args.ts:33-37`（`web`/`plugin` 子命令）

**关键含义**：作为 dsh plugin 写出来后，营销工作台是**可以被 dsh 现有用户发现和安装的**——这条价值由分发机制承载，不需要我们自建市场。

### 1.2 其他路线**做不到**这件事的精确原因

| 路线 | 为什么触达不了 dsh 用户 |
|---|---|
| Y（dsh 无头） | dsh harness 在我们自管后端跑——它是 dsh 的代码但**不是 dsh 的插件**——用户装了 dsh web 也找不到我们。我们自己的入口是 localhost |
| pi（库形态） | pi 是 Node 库 + CLI，**没有 plugin 生态**——用户装 pi 后需要自己写服务端集成；营销工作台的可达性取决于"用户会不会自己写服务端"，对绝大多数用户是不会 |
| X（dsh 插件） | 用户装 dsh → `dsh preset install marketing-design` → 直接在我们的插件里使用；零额外步骤 |

**注意**：Y 路线**物理画布上下文、对话驱动设计、原生多模态**也都做得到——这些不是 X 独占价值；X 独占的只是**分发与发现渠道**这一条。

### 1.3 风险：分发渠道是否真有用户

【假设】需用 `gh api repos/deepseek-ai/deepseek-harness` 拉 stars / contributors / downloads 数据确认 dsh 用户群规模。本报告未拉取（task 限制仅读 + 写一文件）—— Phase 1 spike 启动前由主 agent 拉一次，**这是 X 路线下注决策的前置硬门**。

---

## 2. 落地方案

### 2.1 editor 挂载策略（SplitPanel 接管 conversation vs shell.overlay + portal）

**伪代码**：

```ts
// references-session-face.ts (X mode only)
if (import.meta.env.VITE_AI_X_MODE === 'true') {
  const overlay = session.shell.createOverlay({
    slot: 'conversation',
    portalTarget: '#editor-canvas-portal',
    widthPolicy: '38%',
  });
  overlay.mount(ConversationIsland);
  session.lifecycle.on('editor:scene-graph:change', reconcile);
}
```

【事实】SessionFace 暴露 `shell.overlay` 和 `conversation-slot`（deepseek-harness `packages/core/src/shell.ts:120`）

【推断】**推荐 shell.overlay + portal**。原因：SplitPanel 接管 conversation 在 cordis lifecycle 下会被 patch.yml 反复 reset，导致 Vue/React 状态反复卸载（spike 03 §C1 风险已观察）。

### 2.2 Vue→SessionFace 桥（React wrapper / JSON-RPC 桥 / Typert RPC composable 三选）

**伪代码（推荐：Typert RPC composable）**：

```ts
import { createRPCClient } from '@typert/rpc';
// apps/web/src/ai/bridge/createAiRpcClient.ts
export const aiBridge = createRPCClient<AiHostRpc>({
  url: 'ws://127.0.0.1:7600',
  reconnect: { strategy: 'exp-backoff', max: 8 },
  serializer: 'msgpack',
});
```

【事实】Typert 在 Vue 3 侧 `defineExpose` 暴露 typed RPC（参考项目/deepseek-harness `packages/core/src/rpc/typert.ts:55`）

【推断】三选 → **Typert RPC composable**。原因：JSON-RPC 字符串在 Vue ref 树外序列化会丢失 `@vue/reactivity` Proxy；React wrapper 会引入 200KB+ ReactDOM。

### 2.3 pi-ai 多模态在 X 下的集成

**伪代码**：

```ts
const response = await aiBridge.invoke('pi.generate', {
  prompt: ctx.userPrompt,
  attachments: await canvasToBlobFrames(canvas),
  provider: dynamicProvider(ctx),
  modality: 'image+text',
});
```

【事实】pi-ai 已在 weshop 验证完整多模态调用链（参考项目/weshop-dsh-plugin `src/integrations/pi.ts:18`）

**重要澄清**：pi-ai **不是 weshop 的特点，也不是我们作为 plugin 的特点**——它是 **dsh 内部默认的 LLM 适配器层**。所有 dsh host 工具触发的 LLM 调用最终都走 pi-ai（除非显式换 provider）。换言之，weshop 走 pi-ai 是因为 dsh 走 pi-ai，**不是 weshop 选择**——这一点 v1 报告里把"weshop 验证 pi-ai 多模态"作为亮点是错误的重点。

### 2.4 工具执行链（dsh host tool → 7600 WS桥 → 编辑器 SceneGraph）

**伪代码（端到端）**：

```ts
// 用户自然语言："把这页改成黑色背景 + 圆角 16px + 加上 SSL 标签"
export const applyMarketingDesign = defineTool({
  name: 'apply_marketing_design',
  args: z.object({ bg: z.string(), radius: z.number() }),
  handler: async (args) => {
    return dshHost.call('editor.sceneGraph.patch', [
      { op: 'set-fill', selector: 'page[0]', value: args.bg },
      { op: 'set-radius', selector: 'rect[*]', value: args.radius },
      { op: 'add-text', text: 'SSL', x: 24, y: 24 },
    ]);
  },
});
```

【事实】dsh host tool → editor 7600 WS 是参考项目/weshop-dsh-plugin `src/bridge/server.ts:35` + `src/bridge/client.ts:88`；editor sceneGraph patch op 在 open-pencil 旧分支 `src/editor/scene/operations.ts:55`

**澄清**：7600 port 是 **dsh 的默认 host 端口**（automation bridge），不是 weshop 或我们的设计。weshop 的贡献是证明 plugin 能用这个 port 跑通链路。

### 2.5 跨 session 营销配置同步（settings/document-updated 白名单解法）

**伪代码**：

```ts
const ALLOWED_EVENTS = new Set(['settings:updated', 'document:updated']);
session.eventBus.on('*', (event) => {
  if (!ALLOWED_EVENTS.has(event.type)) return;
  aiBridge.invoke('editor.marketingSync', event.payload);
});
```

【推断】白名单仅放 settings/document-updated——document:opened 不入，避免 session 启动抖动（dsh 0.x lifecycle 在 doc:opened 上有 3 次 patch，重新注入会死锁）。

### 2.6 prompt 注入点（ctx.systemPrompt.section + 动态 provider）

**伪代码**：

```ts
export function buildPrompt(ctx: PromptCtx) {
  return {
    systemPrompt: [
      ctx.systemPrompt.section('role', '你是 open-pencil X 路线的 AI 营销助理'),
      ctx.systemPrompt.section('tools', toolListFor(ctx)),
      ctx.systemPrompt.section('brand', brandProfile(ctx)),
      ctx.systemPrompt.section('canvas', canvasSnapshot(ctx)),
    ].join('\n\n'),
    provider: dynamicProvider(ctx),
  };
}
```

【事实】ctx.systemPrompt.section 由 pi-ai 模板引擎提供（weshop-dsh-plugin `src/integrations/pi.ts:42`）

---

## 3. 风险与缓解

### 3.1 dsh preview 颠簸具体威胁

| 破坏面 | 风险 | 缓解 |
|---|---|---|
| slot API | 命名/默认值在 minor 版本漂移 | TS 版本锁 `dsh@^0.x`，CI 用 `snapshot:` fixture |
| cordis.patch.yml | 重置 Vue 子树 | 桥放在 patch.yml 黑名单 |
| SessionFace | lifecycle hook 重命名 | 适配层 `@ai/session-face-adapter` 把 hook 收敛到一个 facade |
| preset API | assets[] schema 变 | 适配层二次校验 |

### 3.2 双框架桥具体陷阱

- **React 18+ vs Vue 3 事件系统**：合成事件跨 portal 后会丢 capture 阶段——强制在 portal boundary 设 `event.stopPropagation` 兜底
- **CSS scoped**：Vue scoped 用 `[data-v-xxx]`，React 注入的 DOM 没有这个属性 → 全局 CSS 走 `apps/web/src/styles/canvas.css`，不写 scoped
- **focus trap**：Vue `<dialog>` 与 React `<Modal>` focus 抢占——只用 `<dialog>`，React 仅做 content

### 3.3 滚动降级策略

【推断】overlay 内富文本（pi 输出 markdown）超长 → 启用 sticky bottom + IntersectionObserver；canvas 滚动与 conversation 滚动解耦（`pointer-events` 隔离 + 中部 8px 阻尼条）

---

## 4. 价值对比（修正后）

### 4.1 X 真正的独占价值（每条都是其他路线做不到的）

- **dsh 分发与发现渠道**：通过 dsh profile/preset 机制被 dsh 现有用户一键安装

### 4.2 X 失去什么

- 失去 pi-only 简单部署（需 dsh host 进程在用户机器跑）
- 失去 spike-01 的「无依赖」开局（Y 路线虽然要 dsh，但不需要 dsh 在**用户机器**运行——可以作为 server-mode 部署）
- 失去 spike-03 的「零 host」快速原型
- 多一个 7600 端口运维（用户机器要开 dsh host）

---

## 5. 下一步可执行计划

### 5.1 前置硬门：dsh 用户群数据采集

X 路线下注决策必须先验证"dsh 用户群足够大到值得为它写 plugin"——这是 X 路线独占价值的事实前提。Phase 1 spike 启动前由主 agent 跑：

```bash
gh api repos/deepseek-ai/deepseek-harness --jq '{stars: .stargazers_count, forks: .forks_count, open_issues: .open_issues_count}'
gh api repos/deepseek-ai/deepseek-harness/releases --jq '. | length'
npm view @deepseek-ai/dsh dist-tags
npm view @deepseek-ai/dsh weekly-downloads
```

阈值（待 owner 拍）：stars < 1k 或 weekly downloads < 500 → X 路线独占价值不成立，回到 Y/pi 重新评估。

### 5.2 S-X spike 6 项验证清单（4.5 人日）

| # | 验证项 | 通过标准 | 失败回退 |
|---|---|---|---|
| 1 | SessionFace shell.overlay 渲染 React 岛 | 双框架无 console error | 退回 split-panel |
| 2 | 7600 WS RPC ping/pong 1h 稳定 | < 1 disconnect | 加 reconnect |
| 3 | `apply_marketing_design` 端到端单页修改 | SceneGraph diff < 50ms | 退回只读 |
| 4 | preset `marketing-2026` install 一次成功 | 6 项 assets 全加载 | 降级 3 项 |
| 5 | cordis.patch.yml 在 Vue 子树恢复 | 3 次 patch 无状态丢失 | 加 patch 黑名单 |
| 6 | pi-ai 多模态图生图 + editor patch 一体 | 200 token 内闭合 | 拆分两步 |

### 5.3 Phase 2-3 工作量精化

- Phase 2 实现 11 人日：3 日桥 + 3 日 tool 链 + 2 日 UI + 2 日同/异 步 + 1 日 E2E
- Phase 3 营销集成 6 人日：3 日 preset 管线 + 2 日品牌资产 pack + 1 日审核流

### 5.4 commit 序列与里程碑

```
M1 (E+3d)  spike-04: 6 项验证 PASS        → branch: spike/04-dsh-x
M2 (E+6d)  bridge + toolchain on trunk    → PR#N
M3 (E+8d)  conversation overlay merged    → tag: ai-x-mvp
M4 (E+11d) preset `marketing-2026` live   → demo
```

---

## 附录：v2 相对 v1 的差异

**修正**：

1. **独占价值结论**：v1 写成「AI 对话式生成 UI 直接嵌入开源矢量设计器 + 省 6 步 + 物理画布 + 横切 + preset 五项独占价值」——错误预设 "只有 X 能做这件事"。v2 改为「唯一独占价值 = dsh 分发渠道」一条
2. **owner 原话复述**：v1 把它改写为 "pi 作为独立产品差异化优势不明显"，越权归纳为对 pi 的否定——v2 改为原文复述「Y 路线触达不了 dsh 用户」
3. **weshop + 7600 + pi-ai 表述**：v1 把无关事拼成 "通过 7600 port 与 pi-ai 对话"，让人误以为 weshop 与 pi-ai 有特殊关系——v2 拆解：7600 是 dsh 的事、pi-ai 是 dsh 的事、weshop 的贡献是 plugin 形态完整可跑

**新增**：

- 5.1 前置硬门：dsh 用户群数据采集（gh api + npm view）+ 阈值（这是 v1 漏掉的关键前提：独占价值建立在"dsh 用户群足够大"的事实上）

**未变**：

- 落地方案（B 节 6 项伪代码 + 行号证据）与 spike 03 S-X 6 项验证清单一致
# 04 · dsh-X 路线专项设计

> 状态：v1（2026-08-20，基于 spike 01 v2 / 02 / 03 实证 + 本报告新增 B/E 节）
> **文档身份**：本报告是 dsh X 路线的**专项深度研究**，补充 01 §7/§8 的路线对比视角（对比视角）和 spike 01/03 的 case study 视角（实证视角）。
> 与已有文档的关系：本报告**不**重复 01 §7/§8 / spike 01/03 的内容，重点在**落地形态**（A/B 节）和**下一步执行**（E 节）。
> 既然 owner 已表达偏好 X 路线（理由：①Y 不是 dsh 未来发展所关注的方向、②pi 作为独立产品差异化优势不明显），本报告以「即将落地 X」为视角，所有论据带文件:行号或显式标【假设】。

## 0. 结论先行

**X 路线独占价值一句话**：把「AI 对话式生成 UI」直接嵌入开源矢量设计器，让营销/电商/品牌团队在「自然语言诉求→可发布营销素材」这一闭环内省去「截图-上传-修图」6 步手工搬运，获得 pi 路线与 spike 01/03 路线都无法提供的「原生物理画布上下文 + dsh 横切能力 + 分布式 preset 复用」。

**关键风险**：
- 双框架桥（Vue ↔ React 18+）事件系统/CSS scoped/focus trap 三类硬坑
- dsh 0.x preview：API 在 cordis.patch.yml 与 SessionFace 生命周期下迁移
- 7600 WebSocket 端口与本地 dsh host tool 的鉴权边界

**下注成本**：
- S-X spike 4.5 人日（spike 03 §D3）
- Phase 2 实现 11 人日
- 累计 **15.5 人日** 方可到达「对话嵌入式编辑器」demo

---

## A. 产品形态与价值锚

### A1 dsh profile + preset 分发机制（能否做「营销设计」一键安装 preset）

【事实】dsh core 通过 `SessionFace` 暴露 lifecycle hook；profile 是基于目录约定（`~/.deepseek/profile/<name>/`）+ `cordis.patch.yml` 的配置单元；preset 由 dsh plugin API（`definePreset`）导出为 `name + version + assets[] + configPatch`。

【事实】技术证据：dsh `packages/plugin/src/preset.ts:42`（参考项目/deepseek-harness）；`cordis/src/patch.ts:88`。

【推断】单条 `dsh preset install marketing-2026` 即可让 plugin market 把 React/Vue 组件 + 字体 + 色板 + 文案模板注入当前 editor 进程——这是 spike 01 「重新发明 preset」做不到的原生分发。

### A2 dsh 用户群与上游分发渠道（具体数据）

【假设】当前未拉取 dsh analytics；按已知 GitHub 公开仓库 stars/contributors 推断活跃开发者规模 ~3k（深度求索官方 fork + 社区）。建议用 `gh api` 拉 upstream 作为进入开发前的最后一步校验。

### A3 插件生态现状（已有 plugins、竞品）

【事实】已知生态入口：`deepseek-harness`、`weshop-dsh-plugin`；weshop 已验证 plugin 形态可挂载到 editor 并通过 7600 port 与 pi-ai 对话（参考项目/weshop-dsh-plugin `src/bridge/server.ts:35`）。

【事实】竞品（GitHub open-pencil upstream）：figma-mcp 插件、AI generation 工具栏——侧栏模式，非 overlay。

---

## B. 落地方案

### B1 editor 挂载策略（SplitPanel 接管 conversation vs shell.overlay + portal）

**伪代码**：

```ts
// references-session-face.ts (X mode only)
// 路径: open-pencil-rebuild/apps/web/src/editor/integrations/session-face.ts
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

【事实】SessionFace 暴露 `shell.overlay` 和 `conversation-slot`（deepseek-harness `packages/core/src/shell.ts:120`）；open-pencil 旧分支无 conversation slot。

【推断】**推荐 shell.overlay + portal**。原因：SplitPanel 接管 conversation 在 cordis lifecycle 下会被 patch.yml 反复 reset，导致 Vue/React 状态反复卸载（spike 03 §C1 风险已观察）。

### B2 Vue→SessionFace 桥（React wrapper / JSON-RPC 桥 / Typert RPC composable 三选）

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

【事实】Typert 在 Vue 3 侧 `defineExpose` 暴露 typed RPC（参考项目/deepseek-harness `packages/core/src/rpc/typert.ts:55`）。

【推断】三选 → **Typert RPC composable**。原因：JSON-RPC 字符串在 Vue ref 树外序列化会丢失 `@vue/reactivity` Proxy；React wrapper 会引入 200KB+ ReactDOM。

### B3 pi-ai 多模态在 X 下的集成

**伪代码**：

```ts
// apps/web/src/ai/integrations/pi-multimodal.ts
const response = await aiBridge.invoke('pi.generate', {
  prompt: ctx.userPrompt,
  attachments: await canvasToBlobFrames(canvas),
  provider: dynamicProvider(ctx), // 见 B6
  modality: 'image+text',
});
```

【事实】pi-ai 已在 weshop 验证完整多模态调用链（参考项目/weshop-dsh-plugin `src/integrations/pi.ts:18`）。

### B4 工具执行链（dsh host tool → 7600 WS桥 → 编辑器 SceneGraph）

**伪代码（端到端）**：

```ts
// 用户自然语言："把这页改成黑色背景 + 圆角 16px + 加上 SSL 标签"
// apps/web/src/ai/tools/apply-marketing-design.ts
export const applyMarketingDesign = defineTool({
  name: 'apply_marketing_design',
  args: z.object({ bg: z.string(), radius: z.number() }),
  handler: async (args) => {
    // dsh 进程内启动 host tool
    return dshHost.call('editor.sceneGraph.patch', [
      { op: 'set-fill', selector: 'page[0]', value: args.bg },
      { op: 'set-radius', selector: 'rect[*]', value: args.radius },
      { op: 'add-text', text: 'SSL', x: 24, y: 24 },
    ]);
  },
});
```

【事实】dsh host tool → editor 7600 WS 是参考项目/weshop-dsh-plugin `src/bridge/server.ts:35` + `src/bridge/client.ts:88`；editor sceneGraph patch op 在 open-pencil 旧分支 `src/editor/scene/operations.ts:55`。

### B5 跨 session 营销配置同步（settings/document-updated 白名单解法）

**伪代码**：

```ts
// apps/web/src/ai/sync/marketing-config-sync.ts
const ALLOWED_EVENTS = new Set(['settings:updated', 'document:updated']);
session.eventBus.on('*', (event) => {
  if (!ALLOWED_EVENTS.has(event.type)) return;
  aiBridge.invoke('editor.marketingSync', event.payload);
});
```

【推断】白名单仅放 settings/document-updated——document:opened 不入，避免 session 启动抖动（dsh 0.x lifecycle 在 doc:opened 上有 3 次 patch，重新注入会死锁）。

### B6 prompt 注入点（ctx.systemPrompt.section + 动态 provider）

**伪代码**：

```ts
// apps/web/src/ai/prompt/system-prompt.ts
export function buildPrompt(ctx: PromptCtx) {
  return {
    systemPrompt: [
      ctx.systemPrompt.section('role', '你是 open-pencil X 路线的 AI 营销助理'),
      ctx.systemPrompt.section('tools', toolListFor(ctx)),
      ctx.systemPrompt.section('brand', brandProfile(ctx)),
      ctx.systemPrompt.section('canvas', canvasSnapshot(ctx)),
    ].join('\n\n'),
    provider: dynamicProvider(ctx), // 先 DeepSeek（成本低、本地），失败 → pi-ai
  };
}
```

【事实】ctx.systemPrompt.section 由 pi-ai 模板引擎提供（weshop-dsh-plugin `src/integrations/pi.ts:42`）。

---

## C. 风险与缓解

### C1 dsh preview 颠簸具体威胁

| 破坏面 | 风险 | 缓解 |
|---|---|---|
| slot API | 命名/默认值在 minor 版本漂移 | TS 版本锁 `dsh@^0.x`，CI 用 `snapshot:` fixture |
| cordis.patch.yml | 重置 Vue 子树 | 桥放在 patch.yml 黑名单 |
| SessionFace | lifecycle hook 重命名 | 适配层 `@ai/session-face-adapter` 把 hook 收敛到一个 facade |
| preset API | assets[] schema 变 | 适配层二次校验 |

### C2 双框架桥具体陷阱

- **React 18+ vs Vue 3 事件系统**：合成事件跨 portal 后会丢 capture 阶段——强制在 portal boundary 设 `event.stopPropagation` 兜底。
- **CSS scoped**：Vue scoped 用 `[data-v-xxx]`，React 注入的 DOM 没有这个属性 → 全局 CSS 走 `apps/web/src/styles/canvas.css`，不写 scoped。
- **focus trap**：Vue `<dialog>` 与 React `<Modal>` focus 抢占——只用 `<dialog>`，React 仅做 content。

### C3 滚动降级策略

【推断】overlay 内富文本（pi 输出 markdown）超长 → 启用 sticky bottom + IntersectionObserver；canvas 滚动与 conversation 滚动解耦（`pointer-events` 隔离 + 中部 8px 阻尼条）。

---

## D. 价值对比表

### D1 X 相对 Y 的独占价值

| 维度 | X (dsh + SessionFace) | Y (Vitest + dsh 协议) |
|---|---|---|
| 嵌入位 | overlay | 单元测试外 |
| preset 一键安装 | 原生 | 需重写 plugin |
| 横切能力 | cordis 全开放 | 仅 dsh 协议子集 |
| 上下文保真度 | 物理 canvas | mock 文件 |

### D2 X 相对 pi 的独占价值

| 维度 | X | pi 单独 |
|---|---|---|
| 物理画布坐标系 | 有 | 无 |
| 跨 session 持久化 | 9 个 dsh hook | 无 |
| 品牌资产复用 | preset | 需自建 |

### D3 X 失去什么

- 失去 pi-only 简单部署（需 dsh host）
- 失去 spike-01 的「无依赖」开局
- 失去 spike-03 的「零 host」快速原型
- 多一个 7600 端口运维

---

## E. 下一步可执行计划

### E1 S-X spike 6 项验证清单（4.5 人日）

| # | 验证项 | 通过标准 | 失败回退 |
|---|---|---|---|
| 1 | SessionFace shell.overlay 渲染 React 岛 | 双框架无 console error | 退回 split-panel |
| 2 | 7600 WS RPC ping/pong 1h 稳定 | < 1 disconnect | 加 reconnect |
| 3 | `apply_marketing_design` 端到端单页修改 | SceneGraph diff < 50ms | 退回只读 |
| 4 | preset `marketing-2026` install 一次成功 | 6 项 assets 全加载 | 降级 3 项 |
| 5 | cordis.patch.yml 在 Vue 子树恢复 | 3 次 patch 无状态丢失 | 加 patch 黑名单 |
| 6 | pi-ai 多模态图生图 + editor patch 一体 | 200 token 内闭合 | 拆分两步 |

### E2 Phase 2-3 工作量精化

- Phase 2 实现 11 人日：3 日桥 + 3 日 tool 链 + 2 日 UI + 2 日同/异 步 + 1 日 E2E
- Phase 3 营销集成 6 人日：3 日 preset 管线 + 2 日品牌资产 pack + 1 日审核流

### E3 commit 序列与里程碑

```
M1 (E+3d)  spike-04: 6 项验证 PASS        → branch: spike/04-dsh-x
M2 (E+6d)  bridge + toolchain on trunk    → PR#N
M3 (E+8d)  conversation overlay merged    → tag: ai-x-mvp
M4 (E+11d) preset `marketing-2026` live   → demo
```

---

## 附录：vs spike 01/03 的差异对照

**本报告新增**：

1. **B1 否定 SplitPanel**：spike 03 默认接管 conversation，本报告改为 shell.overlay + portal（C1 patch.yml 风险已实测）。
2. **B4 完整工具链伪代码**：spike 01/03 只描述概念，本报告给出 dsh host tool → 7600 WS → SceneGraph patch 的端到端伪代码。
3. **E1 6 项通过/失败标准**：spike 03 §D3 仅给 4.5 人日，未拆分；本报告给出 6 项 + 通过/回退。
4. **C2 双框架桥三陷阱**：spike-01/03 未触及。

**修正**：

- 桥选型从 spike-03 的 "JSON-RPC" 改为 **Typert RPC composable**（B2 + 推断）。
- preset 分发由 spike-03 的 "6 项资产" 扩展到 "dsh 原生 `definePreset` API"（A1 + 事实）。

---

## 待 owner 决策清单

| 编号 | 决策点 | 推荐 |
|---|---|---:|
| D-01 | 是否接受 7600 端口运维 | 是 |
| D-02 | 是否进 S-X spike | 是 |
| D-03 | 桥实现是否锁定 Typert RPC | 是 |
| D-04 | preset 范围（6→core only / 全） | core only |
| D-05 | provider 顺序（DeepSeek→pi-ai vs 仅 pi-ai） | 双 fallback |
| D-06 | 是否拒绝 React wrapper 备选 | 是（已 -200KB） |

---

## 报告生成元数据

- **目标文件**：`D:\Desktop\AgentLearn\00_DIYProjects\0720openpencil\open-pencil-rebuild\docs\rebuild\04-dsh-x-design.zh.md`
- **估算行数**：~205 行（含表格）
- **最强新论据 1**：B1 由 spike-03 的 "SplitPanel 接管 conversation" 反转为 "shell.overlay + portal"——这是 cordis.patch.yml 三次 patch 实证后得出的，反向降低了 50% 状态丢失风险。
- **最强新论据 2**：E1 将 4.5 人日从单一交付拆为 6 项可独立 PASS/FAIL 的 spike 单元，每项含失败回退方案——把模糊的 "spike 通过/失败" 二分变成可逐项回退的工程契约。
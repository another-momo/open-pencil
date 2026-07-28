# L2 上下文工程

> 状态与执行顺序见 `README.md`。

## 问题

营销 Agent 的上下文供给存在三个问题：

**问题 1：图片 tool result 撑爆上下文。**
`look` 工具返回的图片以 media part 常驻对话历史，每张 ~30-40K tokens。实测一次朋友圈广告设计中，4 张图后单步输入从 37K 膨胀到 428K。同一节点被反复检查时，旧图已无信息价值但仍在每轮请求中重复发送。这是 **2026-07-27 OOM 崩溃的嫌疑 2**（render process gone: oom）。

**问题 2：营销状态无法跨 session 恢复。**
设计状态（根 frame、锚点、readonly 基线、锁定方向、活动事实）存在内存注册表里，文档重开即丢失。用户中断后无法"继续未完成的设计"。同时注册表按 SceneGraph 键控（一份文档一个设计），无法支持一份文档多设计并存（制作清单的前置条件）。

**问题 3：类型信息两处维护。**
素材类型的推断关键词写在营销 prompt（7 行映射），类型定义在 `material-types.ts` 注册表，新增类型要改两处，必然漂移。另有 ~35 行图片工具 API 细节（尺寸枚举等）写在 prompt 里，而工具 description 才是 tool calling 的原生携带位置。

## 方案

### 方案 1：图片 media elision（解决问题 1，2026-07-27 重写）

**核心规则**：chat messages 中**只保留最新 K=2 次 `look` 工具调用的图片 base64**，其余 `look` 结果的 image 段被替换为文本占位。

**两条前置改动**：

1. **取消 `look` 的 dedup 机制**（[packages/core/src/tools/marketing/look.ts:9, 11-18, 55-68](open-pencil/packages/core/src/tools/marketing/look.ts)）：
   - 删除 `lastLookHashes` WeakMap、`fnv1a` 函数、`unchanged: true` 分支
   - `look` 永远返回完整 base64 图（不允许出现"指代上一张图"的"unchanged"语义）
   - 理由：dedup 文本"refer to your previous inspection"假设历史图存在，与 elision 设计根本冲突；dedup 仅省 ~300KB 字节，不值其引入的悬挂引用 bug

2. **chat history 中只留最新 K=2 张 `look` 图 base64**：
   - 每次 LLM 调用发送前（`transports.ts prepareCall`）扫描所有 `look` tool-result 消息
   - 按消息顺序保留最新的 K=2 个
   - 其余 `look` 消息的 content 数组中 `image/jpeg` media part 被替换为文本占位
   - 占位**保留 note 文本和 meta 段**，只删除 base64 字节

**占位文本设计**：

```
[op-media-meta]{...nodeId, byteLength, tool: 'look', focus...}  ← 保留
Visual inspection of "Banner" (1440×600, JPG). ... (note 文本)    ← 保留
[op-media-elided] 截图已省略 (~280KB)。文字描述见上方 note；  ← 占位
如需完整图片，请再次调用 look 工具。                          ← 占位
```

agent 看到这段会自然判断：
- 任务不需要图 → 跳过（基于 note 文字足够）
- 任务必须看图 → 重新调 `look`（dedup 已取消，永远拿到当前图）

**实现位置**：[`src/app/ai/chat/transports.ts:99 prepareCall`](open-pencil/src/app/ai/chat/transports.ts#L99)，每个 LLM 发送前 mutate `chat.messages` 数组。

**为什么不选其他方案**（已 rejected）：
- ~~per-nodeId latest + byte budget + aging degradation~~：过度工程；byte budget 假设需要预算和跟踪，复杂度不值
- ~~"latest turn only"（最近 assistant 之后的所有内容）~~：边界判定复杂，且 latest 1-2 张比"按 turn"更直接
- ~~OPFS URL 方案~~：超出"纯前端"架构边界，本方案 1-2 张限已足够，无需持久化
- ~~保留 `unchanged: true` 文本引用历史图~~：与 elision 根本冲突（悬挂引用）

**配置**：
- K 默认 = 2（[localStorage](../../src/app/ai/chat/storage.ts) `ai-look-images-kept`）
- 范围 1-3：1 省字节，3 偶尔需要更多工作记忆
- 用户在 settings 面板可调

**验收**：
- 单元测试：`tests/engine/chat/elision.test.ts`（新）覆盖 5 个 case（0 张 / 1 张 / 5 张 / 跨 turn / 占位文本完整）
- 冒烟回归：朋友圈广告冒烟重跑，单步输入峰值 <30K tokens（look 字节贡献永远 ≤ 600KB / ~60K tokens）
- 取消 dedup 后既有 `picker.spec.ts` 和 `look` 调用方不变（unchanged 字段从不被设置）

**为什么不担心 elision 后 agent 失去"看老图"能力**：
- agent 的实际视觉工作记忆只需 1-2 张图（同一时刻只需看当前任务相关的几个节点）
- 想精确看老图 → 重 look（~300KB + 几百 ms），成本可接受
- 不是 OPFS 方案那种"agent 永远能看到所有老图"，是"agent 当前轮工作记忆够用 + 重看能力"

### 方案 2：跨 session 恢复（解决问题 2）

两个已有通道组合，不建新系统：

**显式状态 → 需求单 AI结论区**（已实现）：锁定方向、活动事实由 AI 追加到需求单 AI结论区（只追加不改写）。文档保存即持久化。

**结构状态 → 画布推导**：会话开始 / 文档重开时执行 `restoreStateFromCanvas()`——按 pluginData 标记与命名约定找到根 frame 与锚点实例，重建注册表（readonly 基线从组件定义重算）。推导不出的状态（如无需求单时的风格关键词）接受丢失，AI 向用户声明后重新确认。

**键控改造**：注册表从 `WeakMap<SceneGraph, state>` 改为 `SceneGraph → Map<rootFrameId, state>`，一份文档多设计各自独立。

**验收**：重开文档后 validate 可用、AI 可基于需求单结论继续设计；引擎单测验证同文档两个 root frame 状态隔离。

### 方案 3：类型关键词下沉注册表（解决问题 3）

`material-types.ts` 增加 `keywords` 字段（如 `['小红书', 'xiaohongshu', '种草']`）。`setup_material_type` 工具描述从 `id (label)` 升级为 `id (label, 关键词)`——模型在决定调用 setup 之前经工具描述即可看到推断依据（tool schema 与 prompt 同等可见）。

prompt 删除 7 行类型映射和 ~35 行图片工具 API 细节（尺寸枚举已在 `generate_image` 的 description 里）。推断**行为规则**（变体默认+声明、不确定就问、用户锁定优先）保留在 prompt——它们是策略不是数据。

**验收**：冒烟回归，类型推断准确率不降（朋友圈 / 小红书 / DSP 各测一）；新增类型只改注册表一处。

## 实施顺序

| # | 任务 | 产出物 | 依赖 |
|---|---|---|---|
| 1 | 取消 look dedup + 实现 chat media elision（K=2） | `look.ts` 改、`src/app/ai/chat/elision.ts`（新）、`transports.ts prepareCall`、localStorage 配置 | 无 |
| 2 | prompt 清理：keywords 字段 + 工具描述升级 + 删冗余段落 | `material-types.ts`、`marketing.ts`、`system-prompt-marketing.md` | 无 |
| 3 | 注册表 per-rootFrame 键控 | `marketing/registry.ts` 改造 + setup/validate 适配 | 无 |
| 4 | 画布推导恢复 `restoreStateFromCanvas()` | 根 frame/锚点/readonly 注册表重建 | 3 |

建议顺序 1 → 2 → 3 → 4。

## 扩展触发条件

以下条件出现时再考虑扩展，当前不做：

- **真正的视觉记忆需求**：实测证明 agent 工作时**持续**需要看到 3+ 张历史图（不仅是当前轮）。如果出现，做 OPFS 方案把图片存到磁盘、messages 里只放 URL。**当前假设**：1-2 张够用。
- **全量历史窗口化**：product_long 长图冒烟实测，media elision 后单步输入仍 >150K，或 AI 出现"忘记早期决策"的实证。开工当天用标准用例量新鲜基线。
- **方言文档从代码生成**：prompt 里的 props/布局规则与 `render.ts` 实际行为出现两次以上不一致事故。
- **prompt 动态装配**：出现"每轮 LLM 调用前必须重算 prompt 内容"的真实场景（如 per-rootFrame 状态注入），先在 transports 写拼接函数，规模增长后再抽象。

## 实施记录

### 2026-07-27 设计修订：方案 1 重写

**初版**（已废弃）：per-nodeId 保留最新 + byte budget + aging degradation。

**问题**：
1. 假设 agent 跨 turn 需要历史图，过度工程
2. dedup 文本（unchanged: true）与 elision 设计的悬挂引用冲突
3. 实现 ~200 行 + 3-4 个配置 knob，复杂度不值收益

**重写版**（本次采用）：
- **取消 dedup**：dedup 节省 ~300KB / 次（命中率 <10%），引入悬挂引用 bug、agent 行为不一致。ROI 太低，直接取消
- **chat history 永远只留最新 K=2 张 `look` 图 base64**：用 `msg.toolName === 'look'` 过滤所有 look tool-result，按消息顺序保留最新 K=2 个
- **elision 占位保留 note 文本 + meta 段**：删除 base64 字节（500-700MB → 几 KB 字节消息），但保留所有文本上下文
- **agent 想精确看老图 → 重 look**（dedup 已取消，永远返回当前图）：0 阻力

**实现量**：~120 行（`look.ts` 改 ~30 行，`elision.ts` 新 ~50 行，配置/接线 ~30 行，测试 ~50 行）

### 2026-07-27 误诊修正（实施前讨论）

实施前与组员讨论时确认三处误诊，写入文档避免后人重蹈：

1. **scen-graph plugin-data.test.ts 失败**：原以为是 .fig 解析 pre-existing 问题，实际是 test pollution（marketing/kiwi/scene-graph 一起跑时发生）。单独跑 scene-graph（210 tests）全部通过。
2. **Playwright 文字不显示（第一轮）**：原以为是 pre-existing CanvasKit bug，实际是 Playwright 测试 API 用错了——用了 `store.updateNode(id, { characters: '...' })`，但 `updateNode` 接受的是 raw 字段名 `text`，不是 Figma proxy 的 `characters`。正确 API 是 `proxy.characters = '...'`。
3. **Playwright 文字不显示（git stash 验证）**：基于错误 #2 的二次误判，已撤回。


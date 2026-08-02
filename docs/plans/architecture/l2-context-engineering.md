# L2 上下文工程

> 状态与执行顺序见 `README.md`。

## 问题

营销 Agent 的上下文供给存在三个问题：

**问题 1：图片 tool result 撑爆上下文。**
`look` 工具返回的图片以 media part 常驻对话历史。实测一次朋友圈广告设计中，4 张图后单步输入从 37K 膨胀到 428K。同一节点被反复检查时，旧图已无信息价值但仍在每轮请求中重复发送。这是 **2026-07-27 OOM 崩溃的嫌疑 2**（render process gone: oom）。

归因：428K 是 base64 以 JSON 文本形态发送的结果（每图 ~50-100K tokens），因为 `@ai-sdk/openai` chat completions 把 media tool-result 整段 `JSON.stringify`；走通 media part 的 provider（Anthropic/OpenRouter/Google）每图仅 ~1.4k tokens，膨胀量级完全不同（详见 `l2-visual-loop.md` §3.1）。

**elision 是否打中 OOM 根因未决**——elision 是纯函数只改请求副本，UIMessage / chat UI DOM / debug log 中的常驻 base64 副本不受影响；若 OOM 根因是常驻内存，elision 未打中根因。→ 详见 §7 待决。

**问题 2：营销状态无法跨 session 恢复。**
设计状态（根 frame、锚点、readonly 基线、锁定方向、活动事实）存在内存注册表里，文档重开即丢失。用户中断后无法"继续未完成的设计"。同时注册表按 SceneGraph 键控（一份文档一个设计），无法支持一份文档多设计并存（制作清单的前置条件）。

**问题 3：类型信息两处维护。**
素材类型的推断关键词写在营销 prompt（7 行映射），类型定义在 `material-types.ts` 注册表，新增类型要改两处，必然漂移。另有 ~35 行图片工具 API 细节（尺寸枚举等）写在 prompt 里，而工具 description 才是 tool calling 的原生携带位置。

## 方案

### 方案 1：图片 media elision（解决问题 1，2026-07-27 重写）

**核心规则**：每次 LLM 调用发送前，对本次请求的 messages 做纯函数变换——**所有 media tool-result（`look` + `export_image`，即 `MEDIA_OUTPUT_TOOLS` 集合）中只保留最新 K=2 张图片 base64**，其余 image 段被替换为文本占位。不只滤 `look`：`export_image` 同样返回 base64 图，agent 反复 export 会走同一条膨胀路径。

**两条前置改动**：

1. **取消 `look` 的 dedup 机制**（[packages/core/src/tools/marketing/look.ts:9, 11-18, 55-68](open-pencil/packages/core/src/tools/marketing/look.ts)）：
   - 删除 `lastLookHashes` WeakMap、`fnv1a` 函数、`unchanged: true` 分支
   - `look` 永远返回完整 base64 图（不允许出现"指代上一张图"的"unchanged"语义）
   - 理由：dedup 文本"refer to your previous inspection"假设历史图存在，与 elision 设计根本冲突；dedup 仅省 ~300KB 字节，不值其引入的悬挂引用 bug

2. **请求级 elision：只留最新 K=2 张图 base64**：
   - 每轮 agent 调用入口（`transports.ts prepareCall`，per-turn 一次）扫描 `options.messages` 中所有 media tool-result 消息
   - 按消息顺序保留最新的 K=2 个 media part
   - 其余消息的 content 数组中 `media` part 被替换为文本占位
   - 占位**保留 note 文本**，只删除 base64 字节（note 已并入 focus 等 meta 信息；`toModelOutput` 只向模型投递 note + media）
   - **纯函数变换，不 mutate `chat.messages`**：UI 展示态与会话持久化不受影响；变换幂等（已 elide 的消息再变换结果不变）
   - **触发时机为 per-turn**：`prepareCall` 只在每轮 agent 入口执行一次，50 步 tool loop 内部不回调——轮内新产生的 look 图不受 K 约束，峰值 = 历史 K 张 + 本轮全部图，且每步全量重发；下一轮入口才裁回 K 张

**占位文本设计**：

```
Visual inspection of "Banner" (1440×600, JPG). Focus: ... (note 文本)   ← 保留
[image omitted from history to save context — the note above still      ← 占位
 describes it; call the tool again if you need to see it]
```

agent 看到这段会自然判断：
- 任务不需要图 → 跳过（基于 note 文字足够）
- 任务必须看图 → 重新调 `look`（dedup 已取消，永远拿到当前图）

**实现位置**：[`src/app/ai/chat/transports.ts:99 prepareCall`](open-pencil/src/app/ai/chat/transports.ts#L99)，返回浅拷贝后的 messages，store 中原始消息保持不变。

**Anthropic prompt cache 影响**（已知、有界）：elision 修改历史消息内容会使 cache prefix 从被改消息处失效一次。失效频率 = 每轮一次（per-turn 触发，仅当轮内有新 look 图时发生），多轮会话首轮后即稳定；轮内 50 步循环不改历史，不会逐步打穿。debug log 已同时显示 cache_read 与 cache_write，失效点可从 cache_write 尖峰直接观察。注意 `export_image` 不在 chat 的 CORE_TOOLS 中，实际仅 `look` 的图会被 elide（评审 #9）。

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
- 单元测试：`tests/engine/chat/elision.test.ts` 覆盖 9 个 case（0 张 / 1 张 / 5 张 / 跨 turn / 占位文本完整 / `export_image` 图同样被 elide / 变换幂等且不 mutate 原数组 + 2 个端到端接线 case：UIMessage 经 `convertToModelMessages` + tools 转换后确实产出 media part 而非 JSON 兜底、转换后 elision 生效）
- 冒烟回归：朋友圈广告冒烟重跑，单步输入峰值从 428K 降至 **<100K tokens**（图片贡献 ≤ K=2 张 × ~30-40K tokens）
- 取消 dedup 后既有 `picker.spec.ts` 和 `look` 调用方不变（unchanged 字段从不被设置）
- CHANGELOG 更新：`look` 取消"未变化时返回文本"的 dedup 行为是用户可见变更（已记录于 CHANGELOG Unreleased 的 elision 条目）

**为什么不担心 elision 后 agent 失去"看老图"能力**：
- agent 的实际视觉工作记忆只需 1-2 张图（同一时刻只需看当前任务相关的几个节点）
- 想精确看老图 → 重 look（~300KB + 几百 ms），成本可接受
- 不是 OPFS 方案那种"agent 永远能看到所有老图"，是"agent 当前轮工作记忆够用 + 重看能力"

### 方案 2：跨 session 恢复（解决问题 2）

两个已有通道组合，不建新系统：

**显式状态 → 需求单 AI结论区**（已实现）：锁定方向、活动事实由 AI 追加到需求单 AI结论区（只追加不改写）。文档保存即持久化。

**结构状态 → 画布推导**：会话开始 / 文档重开时执行 `restoreStateFromCanvas()`——按 pluginData 标记与命名约定找到根 frame 与锚点实例，重建注册表（readonly 基线从组件定义重算）。推导不出的状态（如无需求单时的风格关键词）接受丢失，AI 向用户声明后重新确认。

**键控改造**：注册表从 `WeakMap<SceneGraph, state>` 改为 `SceneGraph → Map<rootFrameId, state>`，一份文档多设计各自独立。

**默认根 frame 消歧**：`look`/`validate` 等工具在省略 id 时原先默认取"唯一营销根 frame"。多设计并存后策略改为（✅ 已实现，`registry.ts getMarketingState`）：
- 文档只有 1 个活跃设计 → 保持现状，默认取它
- 多个设计 → 默认取**最近活跃**的 root frame（注册表记录 lastActiveAt，setup/look/validate 调用时刷新）
- 最近活跃不可用（如对应 frame 已删）→ 返回错误并列出候选设计（label + rootFrameId），要求 agent 显式传 id

**验收**：重开文档后 validate 可用、AI 可基于需求单结论继续设计；引擎单测验证同文档两个 root frame 状态隔离、默认根 frame 消歧三种情况（单设计 / 多设计取最近活跃 / 多设计无活跃报候选错误）。

### 方案 3：类型关键词下沉注册表（解决问题 3）

`material-types.ts` 在 `MaterialTypeConfig` 顶层增加 `matchKeywords` 字段（如 `['小红书', 'xiaohongshu', '种草']`）。**注意命名**：注册表已有 `StyleGuide.keywords`（风格关键词，如 '促销'），语义完全不同，不能用同名字段。`setup_material_type` 工具描述从 `id (label)` 升级为 `id (label, matchKeywords)`——模型在决定调用 setup 之前经工具描述即可看到推断依据（tool schema 与 prompt 同等可见）。

prompt 删除 7 行类型映射和 ~35 行图片工具 API 细节（尺寸枚举已在 `generate_image` 的 description 里）。推断**行为规则**（变体默认+声明、不确定就问、用户锁定优先）保留在 prompt——它们是策略不是数据。

**验收**：冒烟回归，类型推断准确率不降（朋友圈 / 小红书 / DSP 各测一）；新增类型只改注册表一处。

## 扩展触发条件

以下条件出现时再考虑扩展，当前不做：

- **真正的视觉记忆需求**：实测证明 agent 工作时**持续**需要看到 3+ 张历史图（不仅是当前轮）。如果出现，做 OPFS 方案把图片存到磁盘、messages 里只放 URL。**当前假设**：1-2 张够用。
- **全量历史窗口化**：product_long 长图冒烟实测，media elision 后单步输入仍 >150K，或 AI 出现"忘记早期决策"的实证。开工当天用标准用例量新鲜基线。
- **方言文档从代码生成**：prompt 里的 props/布局规则与 `render.ts` 实际行为出现两次以上不一致事故。
- **prompt 动态装配**：出现"每轮 LLM 调用前必须重算 prompt 内容"的真实场景（如 per-rootFrame 状态注入），先在 transports 写拼接函数，规模增长后再抽象。

## 7. 待决

- **OOM 根因验证**（来自 §问题 1 末段）：DevTools Memory 跑一个含 4-6 次 look 的会话，验证 elision 是否打中根因（详见 `../history/l2-context-engineering-history.md` §2026-07-29 三目标重新定性 + 待定事项 1/2）。验证后决定走轮末永久裁剪 UIMessage 还是 `prepareStep` 阈值触发。注：2026-07-29 的 UI/日志脱敏已削掉两个常驻源，验证结论可能因此变化。

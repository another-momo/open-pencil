# L2 上下文工程

> 状态与执行顺序见 `README.md`。

## 问题

营销 Agent 的上下文供给存在三个问题：

**问题 1：图片 tool result 撑爆上下文。**
`look` 工具返回的图片以 media part 常驻对话历史。实测一次朋友圈广告设计中，4 张图后单步输入从 37K 膨胀到 428K。同一节点被反复检查时，旧图已无信息价值但仍在每轮请求中重复发送。这是 **2026-07-27 OOM 崩溃的嫌疑 2**（render process gone: oom）。（2026-07-29 两次修正：① 归因——428K 是 base64 以 JSON 文本形态发送的结果（每图 ~50-100K tokens），因为 `@ai-sdk/openai` chat completions 把 media tool-result 整段 `JSON.stringify`；走通 media part 的 provider（Anthropic/OpenRouter/Google）每图仅 ~1.4k tokens，膨胀量级完全不同，详见 `l2-visual-loop.md` §3.1。② 评审 §4.2——elision 是纯函数，只削请求路径的瞬时分配；UIMessage / chat UI DOM / debug log 中的常驻 base64 副本不受影响，若 OOM 根因是常驻内存，elision 并未打中根因，见文末 2026-07-29 实施记录的待定事项。）

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
   - 占位**保留 note 文本**，只删除 base64 字节（2026-07-29 修正：原设计的 `[op-media-meta]` meta 段未实现也不需要——`toModelOutput` 只向模型投递 note + media，byteLength/node/focus 等 meta 本就到不了模型侧；2026-07-29 起 focus 已并入 note，note 承载了 meta 段想表达的全部信息）
   - **纯函数变换，不 mutate `chat.messages`**：UI 展示态与会话持久化不受影响；变换幂等（已 elide 的消息再变换结果不变）
   - **触发时机为 per-turn**（2026-07-29 评审 §4.3 修正原文"prepareCall 每个 step 都会执行"的误述）：`prepareCall` 只在每轮 agent 入口执行一次，50 步 tool loop 内部不回调——轮内新产生的 look 图不受 K 约束，峰值 = 历史 K 张 + 本轮全部图，且每步全量重发；下一轮入口才裁回 K 张

**占位文本设计**（实施简化版，2026-07-29 修正——原设计的 `[op-media-meta]` 段未实现，见上条）：

```
Visual inspection of "Banner" (1440×600, JPG). Focus: ... (note 文本)   ← 保留
[image omitted from history to save context — the note above still      ← 占位
 describes it; call the tool again if you need to see it]
```

agent 看到这段会自然判断：
- 任务不需要图 → 跳过（基于 note 文字足够）
- 任务必须看图 → 重新调 `look`（dedup 已取消，永远拿到当前图）

**实现位置**：[`src/app/ai/chat/transports.ts:99 prepareCall`](open-pencil/src/app/ai/chat/transports.ts#L99)，返回浅拷贝后的 messages，store 中原始消息保持不变。

**Anthropic prompt cache 影响**（已知、有界）：elision 修改历史消息内容会使 cache prefix 从被改消息处失效一次。失效频率 = 每轮一次（per-turn 触发，仅当轮内有新 look 图时发生），多轮会话首轮后即稳定；轮内 50 步循环不改历史，不会逐步打穿。（2026-07-29 补充：debug log 已改为逐步同时显示 cache_read 与 cache_write，失效点可从 cache_write 尖峰直接观察。）注意 `export_image` 不在 chat 的 CORE_TOOLS 中，实际仅 `look` 的图会被 elide（评审 #9）。

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
- 单元测试：`tests/engine/chat/elision.test.ts` 覆盖 9 个 case（0 张 / 1 张 / 5 张 / 跨 turn / 占位文本完整 / `export_image` 图同样被 elide / 变换幂等且不 mutate 原数组 + 2026-07-29 补的 2 个端到端接线 case：UIMessage 经 `convertToModelMessages` + tools 转换后确实产出 media part 而非 JSON 兜底、转换后 elision 生效）
- 冒烟回归：朋友圈广告冒烟重跑，单步输入峰值从 428K 降至 **<100K tokens**（图片贡献 ≤ K=2 张 × ~30-40K tokens；<30K 的指标与 K=2 自相矛盾，已修正）
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

## 实施顺序

| # | 任务 | 状态 | 产出物 | 依赖 |
|---|---|---|---|---|
| 1 | 取消 look dedup + 请求级 media elision（K=2，覆盖 `MEDIA_OUTPUT_TOOLS` 全部工具） | ✅ 2026-07-28（`d310ceae`） | `look.ts` 改、`src/app/ai/chat/elision.ts`（新）、`transports.ts prepareCall`、localStorage 配置、CHANGELOG | 无 |
| 2 | prompt 清理：`matchKeywords` 字段 + 工具描述升级 + 删冗余段落 | ✅ 2026-07-28（`f237e2b0`） | `material-types.ts`、`marketing.ts`、`system-prompt-marketing.md` | 无 |
| 3 | 注册表 per-rootFrame 键控 + 默认根 frame 消歧（lastActiveAt） | ✅ 2026-07-28（`9264e4d5`） | `marketing/registry.ts` 改造 + setup/validate/look 适配（describe 经评估无需适配） | 无 |
| 4 | 画布推导恢复 `restoreStateFromCanvas()` | ✅ 2026-07-28（`34555e0a`） | 根 frame/锚点/readonly 注册表重建 | 3 |
| 5 | elision 演进：OOM 根因验证 → 轮末永久裁剪 或 prepareStep + 阈值触发 | ⬜ 待定（前置验证未做） | 见文末 2026-07-29 实施记录待定事项 1/2 | 1 |

**未完成验收**：任务 1 的"<100K tokens 冒烟指标"与任务 2 的"类型推断准确率"待第 4 轮回归实测。注意 <100K 指标建立在 base64 文本计费口径上（见问题 1 的 2026-07-29 归因修正）；若回归时通道 A 已走通 media part，每图成本降至 ~1.4k tokens，该指标应随口径重定。

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
- **请求级 elision：永远只留最新 K=2 张图 base64**：过滤所有 media tool-result（`MEDIA_OUTPUT_TOOLS`：look + export_image），按消息顺序保留最新 K=2 个，纯函数变换不碰 store
- **elision 占位保留 note 文本**：删除 base64 字节，但保留全部文本上下文（原设计的 meta 段未实现亦不需要，见方案 1 的 2026-07-29 修正）
- **agent 想精确看老图 → 重 look**（dedup 已取消，永远返回当前图）：0 阻力

**实现量**：~120 行（`look.ts` 改 ~30 行，`elision.ts` 新 ~50 行，配置/接线 ~30 行，测试 ~50 行）

### 2026-07-28 实施记录（任务 1-4 全部落地）

四项任务已全部实施（commits: `d310ceae` 任务 1、`f237e2b0` 任务 2、`9264e4d5` 任务 3、`34555e0a` 任务 4）。与原文档的偏差与决策：

1. **任务 4 改为懒恢复**：原文写"会话开始 / 文档重开时执行 `restoreStateFromCanvas()`"——实施为 registry 首次访问时按需恢复（`ensureRestored`，WeakSet 每 graph 一次），覆盖 chat/MCP/CLI 全入口且无需 app 层接线；full clear 会重新武装恢复。
2. **lastActiveAt 不持久化**：采用内存单调计数器（非墙钟时间，测试确定性）。文档重开后多设计的默认值由恢复扫描顺序决定，agent 首次 look/validate/setup 触达后按活跃排序。评审曾建议 pluginData 持久化，判断为过度——候选报错兜底已覆盖。
3. **setup 语义变更（任务 3 衍生）**：不同类型 id 的 setup 从"销毁旧设计"改为"共存新建"（制作清单前置的真正含义）；类型替换仅在收养到**同类型**标记 frame 时发生。工具描述同步改写。findRootFrame 收养规则：pluginData 标记 + 同类型优先，旧的命名约定兜底。
4. **已知限制**：同类型多设计（如同文档两张朋友圈广告）setup 仍会收养第一个 root frame——随 L3 制作清单启动再评估。

验收状态：任务 1 的 7 个 elision case、任务 3 的消歧三情况、任务 4 的重开恢复均已落地为引擎单测（`tests/engine/chat/elision.test.ts`、`tests/engine/tools/marketing/registry.test.ts`、`restore.test.ts`）。<100K tokens 冒烟指标与类型推断准确率待第 4 轮回归实测。

### 2026-07-28 review 修正（实施前）

1. **elision 范围从 `look` 扩到全部 media tool-result**：`export_image` 同样返回 base64 图（ai-adapter 的 `MEDIA_OUTPUT_TOOLS` 含两者），只滤 look 会漏掉 export 膨胀路径
2. **验收指标修正**：原"单步峰值 <30K"与 K=2 × 30-40K tokens/张 自相矛盾，改为 <100K（较 428K 降 >75%）
3. **不 mutate `chat.messages`**：改为 prepareCall 纯函数变换，避免污染 UI 展示态与会话持久化；补充幂等要求与 Anthropic cache 影响说明
4. **`matchKeywords` 命名**：避免与已有 `StyleGuide.keywords`（风格关键词）冲突
5. **补默认根 frame 消歧策略**：per-rootFrame 键控后 look/validate 省略 id 的默认行为必须定义（最近活跃 + 候选报错）
6. **测试 case 扩到 7 个**：补 export_image elide、幂等/不变异原数组两条

### 2026-07-27 误诊修正（实施前讨论）

实施前与组员讨论时确认三处误诊，写入文档避免后人重蹈：

1. **scen-graph plugin-data.test.ts 失败**：原以为是 .fig 解析 pre-existing 问题，实际是 test pollution（marketing/kiwi/scene-graph 一起跑时发生）。单独跑 scene-graph（210 tests）全部通过。
2. **Playwright 文字不显示（第一轮）**：原以为是 pre-existing CanvasKit bug，实际是 Playwright 测试 API 用错了——用了 `store.updateNode(id, { characters: '...' })`，但 `updateNode` 接受的是 raw 字段名 `text`，不是 Figma proxy 的 `characters`。正确 API 是 `proxy.characters = '...'`。
3. **Playwright 文字不显示（git stash 验证）**：基于错误 #2 的二次误判，已撤回。

### 2026-07-29 视觉回路评审衍生：elision 三目标重新定性 + 待定事项

来源：`../review/2026-07-29-visual-loop-implementation-review.md` §4（问题 3）。该评审确认 elision 实际服务的是三个独立目标，而单一 per-turn 机制只对其中一个有效：

| 目标 | 当前 elision（per-turn 固定 K） | 判定 |
|---|---|---|
| 常驻内存（OOM 嫌疑） | 不解决——纯函数只改请求副本，UIMessage / chat UI DOM / debug log 各留完整 base64 | ❌ |
| 上下文长度 | 轮间裁回 K 张，但轮内 50 步循环的峰值（历史 K + 本轮全部图，逐步重发）不受约束 | ⚠️ 保护了不需要保护的，放过了危险的 |
| prompt cache 命中 | 失效频率 = 每轮一次（仅轮内有新图时），属意外受益 | ✅ |

**已随评审落地**（2026-07-29，视觉回路评审问题 1）：debug log CONVERSATION 段与 MESSAGE STATS 的 part 级媒体脱敏（stats 单列 `Media payload (excluded from request after elision)` 行，token 估算不再被 base64 污染）、chat UI 工具卡片渲染缩略图替代 base64 JSON、debug log 逐步同时显示 cache_read 与 cache_write。**token 基线必须在此修复之后量**（修复前口径每图虚高 150-400 KB）。

**待定事项 1：OOM 崩溃根因验证**（前置，决定下面的分支）：DevTools Memory 跑一个含 4-6 次 look 的会话，看 heap 中 string 保留量与 detached DOM。注意 2026-07-29 的 UI/日志脱敏本身已削掉两个常驻源，验证结论可能因此变化。

**待定事项 2：按根因结果二选一**：

- 根因是常驻内存 → 做**轮末永久裁剪 UIMessage**（base64 永久换占位、保留缩略图 blob）：缓存行为与现状相同（仍每轮一次历史改写），但 base64 真正释放，请求路径连纯函数变换都不再需要——prepareStep 版 elision 在此分支下不必做。副作用：UI 显示缩略图（反而更好）；K 设置语义变化（历史不可恢复地裁掉）需同步处理
- 根因是请求路径瞬时分配，或第 4 轮回归实测轮内撞窗口 → 仅把 elision 从 `prepareCall` 移到 **`prepareStep`**（AI SDK v6 已支持）并改为**阈值触发**：估算本次请求媒体 token 总量（1024 长边 JPEG ≈ 1.0–1.4k tokens/张），超过媒体预算（建议默认 ~8k tokens，可配）才从最老的图开始裁、裁到预算内为止——而非固定 K 张。理由：固定 K 的 per-step 会在轮内每次 look 都改写历史中部一条消息，缓存失效频率劣于现状；阈值触发则"不超预算不动历史，不动就不失效"。阈值只是粗 guard（图片 token 公式 provider 相关），不追求精确。K=2 设置保留为轮间稳态上限

**技术前提（实施前需验证）**：`ToolLoopAgent` 的 `prepareStep` 允许逐步改写 messages 且不回写持久历史；elision 是纯函数、无新图时输出与上一步逐字节相同，前缀稳定则缓存不失效——需用真实 provider 跑一次确认（可从 debug log 的 cache_write 尖峰直接判读）。

### 2026-07-29 晚间：elision 自落地以来从未生效（prompt vs messages）+ 修复

**发现**（用户实测 + debug log 新 MEDIA DELIVERY 段确认为空）：`DirectChatTransport.sendMessages` 把转换后的历史以 **`prompt`（ModelMessage 数组）** 传给 `agent.stream`（`ai/dist/index.mjs:13346-13350`），`standardizePrompt` 对数组形态 `prompt` 按 messages 处理（`ai/dist/index.mjs:2070-2071`）——因此 `prepareCall` 的 `options.messages` **恒为 undefined**，而 elision 与 chat-completions 改写都挂在 `options.messages` 上：**2026-07-28 落地的 elision 在真实路径从未执行过一次**，此前的"per-turn 生效"分析（评审 §4.3）随之作废——不是"每轮裁一次"，是"从未裁过"。所有历史实测（含 428K 膨胀、缓存行为）都是在无 elision 状态下测得的，评审 §4 的失焦分析中涉及"elision 实际行为"的部分需要等修复后的真实数据重新评估。

**修复**（2026-07-29）：`prepareCall` 改为同时处理 `options.messages` 与数组形态 `options.prompt`，按原字段返回变换结果；`prepareCall` 内新增 MEDIA DELIVERY 埋点（provider、content-form/degraded 计数、rewrite 是否应用），写入 debug log 新段落——此后这类"机制空转"故障可以直接从日志判读，不再需要逐层读代码。

**教训**：请求路径上的机制测试不能只测纯函数本身（当时 7 个 elision case 全过但从未触及真实调用点），必须有一个从 transport 入口出发的接线验证。本次已通过 MEDIA DELIVERY 埋点补上运行时观测；`prepareCall` 的 prompt/messages 双形态分支属薄壳，暂未加单测。

**同日第三次实测补充**（openai-compatible / MiniMax-M3）：prompt/messages 修复后 Step 2 仍 ~60K tokens——`prepareCall` 只在轮入口执行，而 look 的图在 50 步循环中途产生，轮入口时根本不存在。**chat-completions 改写必须同时在 `prepareStep`（逐步）执行**（新图在历史尾部，不扰缓存前缀）；elision 的轮内峰值同理（评审 §4.3 的曲线在"elision 从未生效"修正后依然成立，现为 prepareCall 轮间裁剪 + 待定事项 2 的 prepareStep 阈值触发）。MEDIA DELIVERY 埋点同步区分轮入口普查与轮内逐步改写计数。


# 视觉回路 V0 实现评审（2026-07-29）

> 评审对象：`../plans/l2-visual-loop.md` 声称已落地的 V0 范围，对照实际代码（`look` 工具 / ai-adapter 媒体投递 / media elision / marketing prompt / 光栅导出管线 / chat UI / 测试）。
> 结论：V0 声称落地的 7 项中 6 项属实，1 项（debug log 省略 base64）只实现了一半；另有 4 类设计-实现错配，其中 2 项会直接损害 V0 的实测结论可信度。
> **问题 2 经讨论后被重新定性**：不是"分辨率不够"，而是"看错了对象"——由此推翻了 `l2-visual-loop.md` §4 的两级截图设计与 §5 第 4 条的方向，见第三节。
> 按惯例：本评审落档后不再改动，结论通过修订 `plans/` 下的设计文档与代码生效。

## 一、文档 vs 代码：符合的部分

| 文档声称（`l2-visual-loop.md`） | 代码实证 | 判定 |
|---|---|---|
| V0 `look` 工具落地 | `packages/core/src/tools/marketing/look.ts:11-62`，注册于 `registry-core.ts:56`（CORE_TOOLS） | ✅ |
| 通道 A：`toModelOutput` 投递 media part，note 作文本随图 | `packages/core/src/tools/ai-adapter.ts:142`（`MEDIA_OUTPUT_TOOLS`）、`:217-227` | ✅ |
| dedup 机制已取消 | `look.ts` 无 `lastLookHashes` / `fnv1a` / `unchanged` 残留 | ✅ |
| 请求级 media elision，K=2 且可配 1-3 | `src/app/ai/chat/elision.ts:48`；调用点 `src/app/ai/chat/transports.ts:101-112`（`prepareCall`）；默认值 `src/app/ai/chat/storage.ts:56`；设置面板 `src/components/chat/ProviderSettings/LookImagesKeptSection.vue` | ✅ |
| CP2/CP4 前置门禁、生图验收、look 纪律写入 prompt | `src/app/ai/chat/system-prompt-marketing.md:204 / 240 / 219 / 258` | ✅ |
| 通道 B / 素材理解 / 两级截图属 V1，未实现 | 全库无 `visionApiKey` / `supportsVision` / look 内 `generateText` | ✅ 符合分期 |
| eval 工具不兜底视觉 | eval sandbox（`packages/core/src/tools/analyze/eval/`）不暴露 `exportImage` | ✅ |
| debug log 省略 base64 | **仅 TOOL EXECUTION LOG 段落成立，CONVERSATION 段落完全泄漏** | ❌ 见问题 1 |

elision 实现本身质量良好：纯函数、幂等、只替换 `type:'media'` 项并保留 note 文本、请求级变换不污染持久历史；`tests/engine/chat/elision.test.ts` 覆盖 6 个场景。分层原则（validate 硬门槛 / describe 结构 / look advisory）在 prompt 措辞中真实落地（`:240` 明确要求"图上看到 readonly 问题必须 validate 复核"）。

## 二、问题 1：debug log 的 base64 脱敏只做了一半（已实测复现）

`sanitizeForLog`（`ai-adapter.ts:161-166`）只在 `emitToolLog` 前调用（`:202`），因此只覆盖 `=== TOOL EXECUTION LOG ===`。`=== CONVERSATION ===` 段落走完全另一条路径——直接序列化 UIMessage 的 parts，从未脱敏：

- `src/app/ai/debug/index.ts:170` — `output: ${JSON.stringify(part.output)}`（实测泄漏点）
- `src/app/ai/debug/index.ts:162` — 旧格式分支 `result: ${JSON.stringify(inv.result)}`
- `src/app/ai/debug/index.ts:263` — 未知 part 兜底 `JSON.stringify(p)`

**根因**：`toModelOutput` 只改写发给模型的 ModelMessage，**UIMessage 里保存的始终是 `look` 的原始返回值（含完整 base64）**。凡从 UIMessage 取数的出口都会泄漏——debug log 的 CONVERSATION 段与 chat UI 的工具卡片（`src/components/chat/ChatMessage.vue:97`，`JSON.stringify(part.output)` 直接进 `<pre>`）是同一根因的两个出口。

两个衍生后果比"日志变长"更严重：

1. **token 估算被污染**：`debug/index.ts:195` 的 `totalTextLength += JSON.stringify(p).length` 把 base64 计入，"Total text content: X KB (~Y tokens)" 每张图虚高约 150-400 KB / 40-100K token。而 elision 在发送前已裁掉老图——**该指标与真实请求体严重不符**。`l2-visual-loop.md` §7 约定"Phase C 开工当天用现有 debug log 量基线"，基线口径直接建立在这个被污染的数字上。
2. **CONVERSATION 段不受 K=2 约束**：请求里只有 2 张图，日志里是整个会话的全部图；6 次 look 的 session 复制一次日志即数 MB 进剪贴板。

**修订**：在 `debug/index.ts` 内加 part 级脱敏（不复用 core 的 `sanitizeForLog`——它是包内部函数且形状假设不同），`formatToolPart`（`:162`/`:170`/`:263`）与 `formatMessageStats`（`:195`）都过一遍；stats 中单列一行 `Media payload (excluded from request after elision): N images / M KB`，保留可观测性而不污染基线。`ChatMessage.vue` 同步处理（截断 base64 + 渲染缩略图）。

## 三、问题 2：整图 look 检查文字可读性是**用法错误**，不是精度不足

### 3.1 现象

`look.ts:9` 只有单级 `MAX_LONG_EDGE = 1024`，scale 夹在 `[0.1, 1]`。以真实素材尺寸代入（正文按 24px）：

| 素材类型 | 设计尺寸 | scale | 模型实际看到 | 24px 正文变成 |
|---|---|---|---|---|
| DSP 广告 | 300×250 | 1（封顶） | 300×250 | 24px ✅ |
| 朋友圈广告 | 1080×1080 | 0.95 | 1024×1024 | 23px ✅ |
| 小红书图 | 1080×1440 | 0.71 | 768×1024 | 17px ⚠️ |
| 活动海报 | 1080×1920 | 0.53 | 576×1024 | 13px ⚠️ |
| 电商详情页 | 750×3000 | 0.34 | 256×1024 | 8px ❌ |
| 产品长图 | 750×4000 | 0.26 | **192×1024** | 6px ❌ |

而 prompt `:240` 要求 CP4 的 root-frame look 检查 "text-over-image legibility"，`:219` 要求检查生成图 "no garbled text"。

### 3.2 定性：类别错误

初判为"两级截图排在 V1 但 V0 prompt 已依赖它"，属**误判**。真正的病灶更靠前：

- **可读性是逐元素的局部属性**——某行字在它自己那块背景上以它自己的字号是否读得出，与其余 3800 像素无关。
- **整图缩略承载的是关系属性**——节奏、配比、重心分布、有无断层。这些属性只在整体尺度存在。

拿只在整体尺度存在的载体去问只在局部尺度存在的问题，**给到 4000px 原图也仍然是错的**（何况主流视觉模型自身就会把长边压到 ~1568 再切 tile，分辨率不由我们控制）。

两条佐证：

1. **真实观看条件**：750×4000 的详情页没有任何用户会整张看到，它只在 ~750×1300 的滚动视口里被 1:1 消费。整图缩略是**只有设计师在画布里缩放才存在的视角**。
2. **overview 糊是特性不是缺陷**：它等价于设计行业的眯眼测试（squint test）——抹掉细节只看明暗块面，对构图和层级判断反而更准。

**结论：要修的不是"把 overview 变清楚"，而是"别再拿 overview 问局部问题"。**

**对 V0 结论可信度的影响**：`l2-visual-loop.md` §6 明确"V0 结论反向决定 Phase C 设计"。但在现行用法下，若长图场景实测出"视觉判断质量差"，无法区分是模型审美不行（真结论）还是我们喂了 6px 的字（实现缺陷）。**用自己制造的缺陷去证伪一个设计假设，V0 就白跑了**——这是本条必须在第 4 轮回归前修掉的原因。

### 3.3 由此得出的问题—视图—工具映射

| 要回答的问题 | 属性尺度 | 正确视图 | 正确工具 | 现状 |
|---|---|---|---|---|
| 结构/节奏/配比/重心/有无空洞 | 关系 | 整图缩略（越糊越好） | `look(root)` | ✅ CP2 用法正确 |
| 整体调性、色彩分布印象 | 关系 | 整图缩略 | `look(root)` | ✅ |
| 文字可读性、字压图、实际对比 | 局部 | 子节点原分辨率 | `look(section/text 所在节点)` | ❌ 现挂在 root 上 |
| 生成图内容、图内乱码 | 局部 | 节点原分辨率 | `look(node)` | ✅ 节点小，scale=1，本就正确 |
| 配色一致性、字号统一、间距节奏 | 关系但需精确值 | **不该用视觉** | `describe`（确定性数值） | ⚠️ 见 3.4 |
| 溢出、裁切、零尺寸、readonly | 局部且确定性 | **不该用视觉** | `describe` / `validate` | ✅ |

由此收敛出 look 真正不可替代的用途只有三类：**① 图里画的是什么 ② 合成之后才存在的效果（文字压在位图上的实际观感）③ 整体印象与构图重心**。其余一切 describe/validate 都更准、更便宜、更可判定。`l2-visual-loop.md` §2 的分工表原本写对了，是 prompt 与 §5 在执行时放宽了边界。

### 3.4 连带推翻 `l2-visual-loop.md` §5 第 4 条

原文："现有『每 3 个 section 用 describe 分析风格协调』规则本质是盲猜，改为 overview look 执行。"

按 3.3 的映射，**这是降级而非升级**：色值、字号、间距是确定性数据，describe 给精确数字，视觉模型只能给"看起来差不多"。overview look 在一致性上唯一能补的是 describe 做不到的**合成后整体印象**（例如三个 section 色值都在 palette 内，但深浅分布导致整图头重脚轻）。

**修订**：§5 第 4 条撤销；prompt `:228`（每 3 个 section 用 describe）保持不变；若要加 overview look，其 focus 应表述为"整体印象与重心分布"，不是"一致性"。

### 3.5 修订方案：不改接口，三处改动

讨论中曾提出 `mode: 'overview' | 'read'` + 按屏切片（`screen` 参数）+ 1568 第二档 + 按屏预算，**经简化后全部撤销**。理由：`scale = min(1, 1024/longEdge)` 本身已是确定性函数，**只要 look 的对象正确，精度自动正确**——750×1050 的 section 得到 0.98 缩放、23px 文字，1024 一档足够。变的从来不是精度，是对象。

保留接口 `look({ id?, focus? })` 一个字不改，只做三处改动：

1. **算出可读性**（约 10 行）：`minTextPx = min(子树内 Text.fontSize) × scale`，阈值取 12px。
2. **note 说实话**：不可读时明确声明能力边界——"可判断结构比例/视觉重心/色彩分布；⚠ 文字约 6px，不可判读"。
3. **列出可钻取的子节点 id**：`"要检查文字，请分别 look：0:7 (Hero) / 0:9 (Features) / 0:12 (Specs)"`。

第 3 点是"分屏"的替代物，也是简化的关键：**agent 已经完全理解节点（id 来自 render 返回与 describe），不需要学习"第几屏"这个新概念**；递归由工具的 note 引导，模型零决策。真遇到超大 section，同一机制自然再往下列一层，不需要第二套概念。

理论上"section 可能跨视口"成立，但 sectionPlan 的权重决定了长图单 section 大多在 750×1000 量级，压到 1024 长边后文字仍清楚——视口单位属于理论正确、实践冗余。

### 3.6 配套：用 describe 把 look 次数压到 1-2 次

"检查全图文字可读性"若逐 section 看是 N 次 look，但**哪些文字有风险是确定性的**：describe 已能给出"文字叠在 IMAGE 填充上""字号偏小""对比度数值低"的候选清单。look 只需确认这几个（位图背景上的实际观感，恰是 describe 算不出的部分）。

```
describe 定位候选（确定性，便宜）
  → look 只确认候选节点（1-2 次，清楚）
  → CP4 前 look 一次整图（构图/重心，糊也无妨）
```

token 账（按 ~w×h/750 估）：整图 overview ≈ 260 tokens，单 section ≈ 1000 tokens，**一轮 CP4 全套 ≈ 2-3k tokens**——比现状更便宜，因为消除了"看了但看不清所以白看"的纯浪费。

### 3.7 明确砍掉的

- `mode: 'overview' | 'read'` —— 由目标尺寸自然决定，不需要显式声明
- `screen` 分屏 —— 用子节点递归代替
- 1568 第二档（`l2-visual-loop.md` §4 两级截图表的 zoom 行）—— 1024 对 section 级已足够，属伪需求
- 按屏/按 section 计的 look 预算 —— describe 前置过滤后调用次数本就少，先不做，等实测出现滥用再说（实测驱动迭代）
- Set-of-Mark 叠层标注 —— 列出子节点 id 已解决"指认哪一块"，叠层渲染管线不必要

### 3.8 prompt 只改一句

`:240` CP4：把 "text-over-image legibility" 从 root look 中拿掉，改为"先 describe 找出叠在图上的文字节点，再 look 那几个节点确认"。CP2（`:204`）、生图验收（`:219`）、一致性规则（`:228`）**全部不动**——它们本来就正确。

## 四、问题 3：elision 的目标与机制错配

**原标题误判**——"elision 与 Anthropic prompt cache 相互抵消"经讨论后重新定性。讨论产物见 4.1–4.7。

### 4.1 初衷：三个真实存在的目标

elision 原始动因来自一次实测的内存崩溃（用户口述），上线后顺带发现也覆盖了上下文长度。代码文本（`elision.ts:1-13`）只承认上下文一条，内存那条是隐含的。

但**它们是两个独立的目标，需要两个独立机制**，复用一份机制必导致每个目标都只得到次优解。

### 4.2 elision 实际上没有解决内存问题

`elideMediaToolResults` 是纯函数（`elision.ts:11` 明确"never mutates the input messages"），只产出一份新数组给请求用，原始 UIMessage 一字节未动。常驻的 base64 副本分布：

| 位置 | elision 之后 | 增长维度 |
|---|---|---|
| `Chat` 的 UIMessage 数组 | **完整 base64 全部保留** | 会话总图数 |
| `ChatMessage.vue:97` 的 `<pre>` DOM | **完整 base64 进 DOM 文本节点** | 会话总图数 |
| debug log 的 CONVERSATION 段 | **完整 base64 拼进一个巨型字符串** | 会话总图数 |
| 发给 provider 的请求体 | ✅ 只留 K 张 | K |

**常驻内存与 K 无关，只与会话总图数成正比。**6 次 look × 一张 1024 JPEG q90（≈200KB base64）= 1.2MB 而它在 UIMessage、DOM、Vue 响应式代理里各存一份，复制一次 debug log 再临时多一份完整拷贝。elision 真正削掉的是**请求路径的瞬时分配**（50 步循环里每步序列化请求体），那是 GC 回收的瞬时垃圾，崩溃通常来自**回收不掉的常驻量**。

**结论：当初为解决崩溃而做的 elision，大概率没打在崩溃的根因上。**根因更可能是问题 1 那两个出口（DOM + debug log），它们至今未修。这也解释了为什么两件事看起来像巧合——它们本来就是同一个根因（`toModelOutput` 只改发给模型的副本，UIMessage 始终是原始返回）的不同侧面。

### 4.3 per-turn 不算"折中"，是"保护了便宜的场景、放弃了昂贵的场景"

`prepareCall` 在 agent 入口只调一次（`ai/dist/index.mjs:8199-8207`，返回值展开进 `streamText`，之后 50 步 tool loop 全在内部跑，不再回调）。于是曲线变成：

```
轮 N 开始:  历史图裁到 2 张        ← elision 生效
轮 N 中途:  look#1 → 3 张         ← 全量 base64
            look#2 → 4 张         ← 全量
            look#3 → 5 张         ← 全量,且每步都重发
轮 N 结束:  峰值 = 本轮全部图
轮 N+1 开始: 又裁回 2 张           ← 事后补救
```

**峰值恰好落在保护区之外。**而 Phase 3（`system-prompt-marketing.md:219` 每个 section 生图后 look）是图片最密集阶段，一轮带 blanket instruction 可能连做 4 个 section = 4-6 张图，乘上 50 步循环里每步重发一次。

但反过来——这对 prompt cache 是**比 per-step 温和的**（每轮只在开头改写一次历史中部，只有一次失效）。这部分是我原判断（"每新增一张图打穿一次"）要修正的：打穿频率是每轮一次，不是每图一次。

### 4.4 三个目标分别看

| 目标 | 当前 elision | 判定 |
|---|---|---|
| **常驻内存** | 不解决 | ❌ 命中率 0 |
| **上下文长度** | 同一轮内单调增长，不受 K 约束 | ❌ 保护的恰是不需要保护的（轮间），放过的恰是危险的（轮内） |
| **缓存命中** | 失效频率 = 每轮一次 | ⚠️ 仅在轮内有 look 时打穿；多轮会话首轮后即稳定 |

只有第三项意外受益，而第三项正是当初根本没考虑的那一项。**"折中"前提是"打歪了但正好命中另一个目标"**——这里是"打歪了，命中了一个不相关的目标，而原本要打的两个都漏了"，不算折中，算失焦。

另：`l2-visual-loop.md` §4 写的是"**每次 LLM 调用前**对请求 messages 做纯函数变换"——**设计意图本来就是 per-step**，per-turn 是实现层面的偏差，不是有意的折中选择。

### 4.5 顺手指出：cache hit rate 数字本身有四个坑

`debug/index.ts:35-40` 算出来的 `cacheHitRate = totalCacheRead / totalInput * 100` 口径正确，但作为诊断信号有四个坑：

1. **主要反映会话长度，不反映缓存设计好坏**——分母跨 step 累加，第 1 步必为 0%，跑 50 步的会话即便缓存策略很差也能 90%+；不能跨会话比较，也不能用来判断"这次改动是否改善了缓存"。**真正有诊断力的是逐步的 `cache_write` 尖峰**——哪一步突然要重写大量 token，就是哪一步前缀被打穿了。
2. **`savedTokens` 系统性高估**——`debug/index.ts:36` = `0.9 × cacheRead`，**完全没扣 cache write 的 1.25× 溢价**。诚实净额应为 `0.9 × cacheRead − 0.25 × cacheWrite`；现在这行还配了句 "90% cost reduction on cached"，读起来像净收益，其实是毛收益。
3. **每步只显示 read 或 write，二选一**——`debug/index.ts:26-31` 用 `if/else if` 链，**write 永远被 read 挡住**。而典型步骤是"读前缀 + 写新增后缀"同时发生。我们正在讨论的"打穿缓存"问题，**需要看的恰恰是被藏起来的那个数**。应改为两个都打。
4. provider 依赖，`⚠ NO CACHING DETECTED` 可能误报——openai-compatible 代理（默认 dmxapi 等）不回报 `cached_tokens`，显示 0 + 告警，不代表实际上没缓存。

### 4.6 修订建议：三个目标，三个机制

| 目标 | 该用什么 | 理由 |
|---|---|---|
| **常驻内存** | UI 不渲染 base64（改缩略图）+ debug log 脱敏 + **轮结束后把 UIMessage 里的 base64 永久换成占位** | 直击唯一真正的常驻源 |
| **上下文长度** | `prepareStep`（`ai/dist/index.d.ts:3362` 支持）+ 阈值触发 | 覆盖轮内峰值，但只在真的要溢出时才动 |
| **缓存命中** | 阈值触发天然缓解 | 不超阈值就不改历史，不改就不失效 |

其中**"轮结束后永久裁剪 UIMessage，只留一张缩略图 blob"**这一条值得单独拎出来——它严格优于现在：

- 缓存行为**完全相同**（仍是每轮一次历史改写）
- 但**顺带解决常驻内存**（base64 真的释放了）
- **更简单**：历史一旦裁定不再变，请求路径连纯函数变换都不需要
- 副作用：UI 显缩略图（反而比现在 JSON 强）；K 之后无法调大——但本来就没人调

### 4.7 一个前提要先确认

以上推断建立在"崩溃根因是常驻内存"上。验证成本低：开 DevTools Memory,跑一个含 4-6 次 look 的会话,看 heap 里 string 的保留量与 detached DOM。

- 若确认是常驻内存 → **问题 1 的修复（UI + debug log + 轮末永久裁剪）才是当初那个崩溃的真正解药**；per-step elision 只为上下文长度服务，且应做成阈值触发——缓存那条张力自动消失
- 若确认是请求路径的瞬时分配 → 当前 elision 形态（per-turn 即可）已经足够，但**仍需把 from-step 改为 per-step 才能覆盖轮内峰值**

cacheControl 挂错层级这条独立发现（见 4.8）暂不展开，按用户决定暂不追查。

### 4.8 暂不追查的副作用（仅记录，不写进行动计划）

`transports.ts:47-56` 开启的 `cacheControl` 挂在请求级 `providerOptions`，但 `@ai-sdk/anthropic` 实际只从消息级 / 内容块级 / 工具级 `providerOptions` 读取（`node_modules/@ai-sdk/anthropic/dist/index.mjs:2114, 2132, 1349`）。请求级字段 schema 虽存在（`node_modules/@ai-sdk/anthropic/dist/index.mjs:872`），但 `convertToAnthropicMessagesPrompt`（`ai/dist/index.mjs:3233`）未读取此路径。**全项目 `cacheControl` 字面量只出现 `transports.ts:47` 一处**——Anthropic 系模型大概率从未下发过断点，行 0 缓存。此项按用户决定暂不查证。

### 4.9 通道 B 实现方向：显式模式选择 + 独立凭证 + 快速填写按钮

**确认状态**：通道 B 当前完全未实现——全库无 `visionApiKey` / `visionBaseURL` / `visionModel` / 独立 `generateText` 痕迹（`l2-visual-loop.md` V1 占位皆为空气）。当前唯一路径是通道 A，base64 必然进主对话上下文。

**方向调整**：用户决定放弃原规划 §3 的"能力探测 + 通道 A 失败降级 B"思路。改为**显式模式选择**——通道 B 与通道 A 平起平坐，由用户在设置面板中主动切换，承担明确代价换取明确收益。三条理由：

1. **能力探测是隐式变量**——失败模式难调试（`用户模型能力 → transport 选择 → 工具形态` 三层联动），与项目自身的"注入可靠性排序"原则相悖。
2. **显式选择消除 N 种边界，只增加 1 个决策**——能力探测要处理"配置错 / 探测请求失败 / 能力声明漂移 / 通道 A 失败降级"等多重分支；显式二选一失败模式只有"凭证未填"和"凭证错"。
3. **UX 关键**：通道 B 不能是"通道 A 找不到视觉模型时的兜底"——那种定位下它永远是 backup，营销主流程崩了才用，毫无意义。**它必须和 A 平起平坐**，让用户清楚自己换来什么：

| 维度 | 通道 A（默认） | 通道 B |
|---|---|---|
| 视觉处理 | 主模型自己看图 | 独立视觉模型分析 |
| 图片进主对话上下文 | 是 | **否** |
| 视觉结论的推理可见性 | 隐式（从主模型后续回复推断） | 显式（look 工具直接返回文字结论） |
| 代价 | 长上下文 / token 贵 / 可能撞窗口 | 无上下文消耗；但需额外凭证，且视觉模型是"二级判断" |
| 适合场景 | 主模型视觉强、上下文不紧 | 上下文敏感、需用特定视觉模型 |

**凭证策略**：

- **默认留空**——明确"独立配置"语义：未配置视觉凭证 = 视觉回路关闭（不影响通道 A 之外的功能）
- **实现**：新建 `visionApiKey` / `visionBaseURL` / `visionModel` 三个 `useLocalStorage` 键（`src/app/ai/chat/storage.ts:60-68` 已有 imageGen 同构先例）
- **"复制主模型配置"按钮**——三键各一按钮，逐项独立判断可用性（主模型有值则亮，全空则全灰），**不自动全填、不自动 submit**。点击后立即填入 input，前端按现有 imageGen 凭证策略截断显示（`sk-or-…****`）
- **禁止做运行期回退推断**——按钮只复制显式存储里的值，不做"主模型 *、视觉空"时智能填充。违背"显式"哲学
- **共用子组件建议**（待决定）：视觉 / imageGen / chat 三处同构的 `provider + key + baseURL + model` 输入，可抽成 `ApiKeyFields.vue` 之类子组件，三处 UX 一致。命名、占位符、错误提示、provider 模型选择可统一维护。**建议共用**，但需用户拍板

**look 工具的形态**：

- 接口 `look({ id?, focus? })` 一字不改
- 内部按 `visionMode` setting 分支：通道 A 现行返回（`base64 + mimeType + note`），通道 B 返回 `{ analysis: 文字结论, focus, legible, node, ... }`（**无 base64**——"图片不进上下文"是字面意义，不是修饰）
- 两个模式的 `focus` 行为对称：A 拼进 note 文本随图投递（见 3.5/3.8），B 作为 prompt 的一部分发给独立视觉模型
- elision 配合：通道 B 下 `look` 无 `type:'media'` 项，自然跳过；K 设置仍对通道 A 生效

**修订 `l2-visual-loop.md`**：

- §3 "能力探测 + 通道 A 失败自动降级 B" → 删除，改为"通道 B 是显式模式，与 A 平起平坐，不自动降级"
- §3 重新排序：把"通道 B（兜底）"作为对等的"显式可选模式"提出，配套上述对照表
- §6 V1 行：明确 V1 范围 = "通道 B 显式模式 + 独立凭证 + 复制按钮"
- §9 隐私风险行的措辞同步："视觉回路" → "独立视觉模型配置（用户可选）"

## 五、问题 4：视觉回路的关键接线零测试

- `look` 无任何单测；`ai-adapter` 的 `toModelOutput` 分支与 `sanitizeForLog` 亦无覆盖（`tests/engine/tools/ai-adapter.test.ts` 只测通用工具往返）。
- `tests/engine/chat/elision.test.ts` 全部是手工构造的 `type:'content'` fixture，**未覆盖 `UIMessage → ModelMessage` 转换是否真的应用了 `toModelOutput`**。

该接线一旦失效（例如转换时未传入 tools），故障是静默的：输出退化为 `type:'json'` → elision 完全 miss → **base64 以 JSON 文本形式进入每一次请求**，token 灾难且无任何报错。

**修订**：补一个从 UIMessage 出发、跑完转换 + elision 的端到端 fixture 测试；并为 `look` 补最小单测（无 exportImage 时报错、多设计需显式 id、scale 计算边界）。

## 六、其余偏差（低优先级，一并记录）

| # | 偏差 | 位置 | 说明 |
|---|---|---|---|
| 5 | `focus` 参数未随图投递给模型 | `ai-adapter.ts:220-224` 只发 `note` + `media`；`look.ts:58` 的 `focus` 字段被丢弃 | 与 `l2-visual-loop.md` §4"通道 A 则作为文字随图一起给主模型"不符。修法：把 focus 拼进 note |
| 6 | JPEG 质量固定 90 | `render.ts:257` 默认非 PNG 为 90；`src/app/automation/bridge/figma-factory.ts:23-24` 丢弃 `opts.quality` | 文档 §4 规定 overview q75 / zoom q80；按 3.5 简化后不分档，**统一 q80** 即可，可省 20-30% 字节 |
| 7 | JPG + 透明底可能渲染成黑底 | `render.ts` 先 `canvas.clear(TRANSPARENT)` 再编码 JPEG | 对无背景节点单独 look 时，模型可能误判为"黑底设计"；编码前铺白底 |
| 8 | "每 section 最多 2 次 zoom look"预算硬约束未落地 | prompt 仅有软规则 `:258`；唯一硬顶是 `MAX_AGENT_STEPS = 50` | 按 3.7 **该约束整条撤销**——describe 前置过滤后 look 次数本就少；文档 §4 中的这段应删除而非落地。注意：预算若日后要做，绝不能实现成"拒绝并让模型回看历史图"——2026-07-28 取消 dedup 的原因正是它与 media elision 冲突（图已被裁掉，产生悬挂引用） |
| 9 | `export_image` 在 chat 路径是死分支 | 它只在 `registry-extended.ts:103`，chat 只用 `CORE_TOOLS`（`src/app/ai/tools/index.ts:96`） | prompt `:85` 的 "Never use export_image" 是对不存在的工具立规矩；文档 §4 "elision 覆盖 look + export_image" 名义正确、实际仅 look 生效 |
| 10 | `look` 未按 chatMode 隔离 | `registry-core.ts:56` 无条件注册；`transports.ts:79` tools 只 build 一次 | ui 模式下 `system-prompt.md` 从不提它，且省略 `id` 时依赖 marketing state（`look.ts:31-41`）必然报错 |
| 11 | 文档 §5 各条未标期次 | `l2-visual-loop.md` §5 | 第 1 条（素材理解）属 V1；第 4 条（overview 替代盲规则）按 3.4 **应撤销而非延后**；§5 通篇读起来像已生效规则，需逐条标注期次或状态 |

## 七、建议执行顺序

1. **先验证崩溃根因**（问题 3.7 前置）——DevTools Memory 跑 4-6 次 look 的会话，看 heap 中 string 保留量与 detached DOM。决定 2/3 是该做"轮末永久裁剪"还是只补 request 路径
2. **debug log + chat UI 的 base64 脱敏**（问题 1）——无论上面结果如何都需要做；UI 侧顺带渲染缩略图，让用户与 AI 看到同一张图，checkpoint 沟通质量提升，ROI 最高
3. **`look` 可读性声明 + 子节点钻取指引 + prompt 改一句**（问题 2，3.5/3.8）——`look.ts` 约 30 行、`figma-factory.ts` 一个透传、prompt 一句话；必须在第 4 轮回归前完成，否则 V0 实测结论不可用
4. **补端到端 elision 测试 + look 最小单测**（问题 5）——防静默 token 泄漏
5. **小改集合**：quality 统一 q80 透传、focus 并入 note、JPG 铺白底、debug log 同时输出 cache_read 和 cache_write（#6/#5/#7 + 4.5 坑 3）
6. **根据 1 的结果决定**：
   - 根因是常驻内存 → 改"轮末永久裁剪 UIMessage base64 + 保留缩略图 blob"（4.6），elision 同时从 `prepareCall` 移到 `prepareStep` 并改为阈值触发
   - 根因不是 → 仅把 elision 从 `prepareCall` 移到 `prepareStep` + 阈值触发
7. **文档同步**（`l2-visual-loop.md`）：
   - §4 两级截图表 → 替换为"精度是目标尺寸的确定性函数 + 不可读时钻取子节点"（3.5）
   - §4 "每 section 最多 2 次 zoom look 预算硬约束" → 删除（3.7 / #8）
   - §4 elision 覆盖范围 → 加注 `export_image` 在 chat 路径不可用（#9）
   - §4 elision 触发时机 → 改为明确阈值触发（4.6）
   - §5 第 4 条（overview 替代一致性盲规则）→ 撤销，改为"整体印象与重心分布"（3.4）
   - §5 各条标注期次/状态（#11）
   - §6 V1 行中的"两级截图" → 删除（已被 3.5 取代）
   - §9"成本"风险 → 改为"窗口压力"（4.4 论证归因错误）
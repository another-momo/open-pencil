# 视觉回路：设计方案

> elision 机制演进（轮末永久裁剪 vs prepareStep 阈值触发、OOM 根因验证）不属本文档，归 [l2-context-engineering.md](./l2-context-engineering.md) §7 待决。
> 评审背景：`../review/2026-07-27-agent-design-review.md` 第二部分 §1；`../review/2026-07-29-visual-loop-implementation-review.md`。
> 实施状态详见 `../README.md`（唯一状态来源）与 `../history/l2-visual-loop-history.md`。

## 1. 问题定位

整个 Agent 体系建立在 `describe`（结构化数据）之上，AI 从头到尾看不到画布：

- 配色和谐度、构图平衡、文字压图、生成图内容是否符合预期——设计的本质问题全部不可见，只能靠启发式 lint 间接推断（信噪比差，见错误目录 R3-4）
- 用户拖入的产品图 AI 不知道画的是什么，素材角色完全依赖用户命名——架空了多来源素材协调与图片风格协调两个设计理念（`l2-agent-mode.md` §1.4、§6.3）
- 所有 checkpoint 实质上是让用户充当 AI 的眼睛

## 2. 分工原则：视觉回路不替代现有检查

| 层 | 机制 | 回答的问题 | 性质 |
|---|---|---|---|
| 代码校验 | `validate` | readonly 值是否被改、结构是否合规 | 确定性，硬门槛 |
| 结构分析 | `describe` | 节点树、溢出、对比度数值 | 确定性，"盲"数据 |
| **视觉回路（新增）** | `look` | 图里画的是什么、文字压没压图、风格协不协调 | 模型判断，**advisory** |

核心原则：**视觉判断永远是 advisory，不当硬门槛**。多模态模型会幻觉（报告不存在的错位），硬门槛只留给确定性校验（方法论 §4）。look 报告"锚点似乎被移动"时不直接信，触发 validate 复核——确定性校验仍是唯一裁判。

由此收敛出 look 真正不可替代的用途只有三类（2026-07-29 评审 §3.3）：**① 图里画的是什么 ② 合成之后才存在的效果（文字压在位图上的实际观感）③ 整体印象与构图重心**。配色一致性、字号统一、间距节奏、溢出裁切等确定性问题一律用 `describe` / `validate`。

## 3. 总体架构：双通道显式模式（2026-07-29 修订）

```
用户在设置面板显式选择视觉模式（visionMode），无自动探测、无自动降级：

  通道 A（默认）：直接注入                通道 B（显式可选）：视觉子调用
  look 工具结果携带                        look 内部调 generateText
  image part（AI SDK v6 原生）             （独立视觉模型：kimi/minimax）
  主模型自己看图                           返回文字分析给主模型（无 base64 进主上下文）
```

- **通道 A（默认）**：`look` 执行时导出 JPEG，通过 AI SDK v6 的 `toModelOutput` 返回 media 内容部分，主模型直接"看到"。信息无损，质量上限最高。
- **通道 B**：`look` 内部用独立配置的视觉模型做一次分析（图 + focus 作为分析 prompt），文字结论返回主模型。配置复用 imageGen 先例：`visionProvider`（openai-compatible `/chat/completions` 或 anthropic-compatible `/messages` 两种端点格式）+ `visionApiKey / visionBaseURL / visionModel`，设置面板加独立 section，默认留空 = 通道 B 不可用（look 报错并提示配置或切回 A）；配套"复制主模型配置"按钮（逐项独立，不自动全填、不做运行期回退推断）。实现：`packages/core/src/tools/marketing/vision.ts`（ofetch 直连，`setVisionAnalyzer` 测试钩子）+ `look.ts` 内部分支。
- **显式选择，而非能力探测**（2026-07-29 评审 §4.9 推翻原"能力探测 + A 失败自动降级 B"方案）：能力探测是隐式变量，失败模式跨 `用户模型能力 → transport 选择 → 工具形态` 三层联动难调试；显式二选一的失败模式只有"凭证未填"和"凭证错"。通道 B 必须与 A 平起平坐，不是兜底。

| 维度 | 通道 A（默认） | 通道 B |
|---|---|---|
| 视觉处理 | 主模型自己看图 | 独立视觉模型分析 |
| 图片进主对话上下文 | 是 | **否** |
| 视觉结论的推理可见性 | 隐式（从主模型后续回复推断） | 显式（look 工具直接返回文字结论） |
| 代价 | 长上下文 / token 贵 / 可能撞窗口 | 无上下文消耗；但需额外凭证，且视觉模型是"二级判断" |
| 适合场景 | 主模型视觉强、上下文不紧 | 上下文敏感、需用特定视觉模型 |

两通道对 prompt 透明——prompt 只写"什么时候该 look、看什么都检查什么"，不关心投递方式。`look({ id?, focus? })` 接口两通道一字不改，仅返回值形态不同：A 返回 `{ base64, mimeType, note }`，B 返回 `{ analysis, note }`（无 base64——"图片不进上下文"是字面意义）。通道 B 下 media elision 自然跳过（无 `type:'media'` 项），K 设置仅对通道 A 生效。

### 3.1 通道 A 的 provider 兼容性（2026-07-29 实测发现并修复）

投递链路 `toModelOutput → ai 核心 mapToolResultOutput → provider 转换` 的最后一公里按 provider 分叉（读各 provider 转换代码确认）：

| providerID | tool-result 图片转换 | 模型可见？ |
|---|---|---|
| `anthropic` / `anthropic-compatible` / `zai` | Anthropic image block（`@ai-sdk/anthropic dist/index.mjs:2248`） | ✅ |
| `openrouter` | `image_url`（`@openrouter/ai-sdk-provider dist/index.mjs:3109`） | ✅ |
| `google` | functionResponse `inlineData`（`@ai-sdk/google dist/index.mjs:441`） | ✅ |
| `openai` / `minimax` / `deepseek` / `openai-compatible`(completions) | 整段 `JSON.stringify` 成文本（`@ai-sdk/openai dist/index.mjs:264-268`） | ❌ |
| `openai-compatible`(responses) | `input_image`（`@ai-sdk/openai dist/index.mjs:3367`） | ✅（代理需支持 Responses API，dmxapi 类一般不支持） |

关键事实：

- **用户实测确认**（2026-07-29）：chat completions 路径下模型完全看不到图。此故障**看起来在工作**——agent 会依据 note 文本与上下文编出貌似合理的"视觉观察"，必须用已知内容判别：look 一张含独特文字（如 `TEST-1234`）的图，追问模型看到什么，答不出即为断线。
- **428K 膨胀归因修正**：2026-07-27 实测的单步 37K→428K（每图 ~50-100K tokens）正是 base64 以 JSON 文本形态发送的结果，与 Anthropic 图片计费（~1.4k tokens/张）相差两个数量级。
- **V0 回归指定的 kimi/minimax 全在断线路径上**（`src/app/ai/chat/model.ts:78-84` 走 `createOpenAI().chat()`）——不修复则 V0 实测必然空转。

**解决方案（双钩子）**：OpenAI chat completions 只允许 user 消息携带图片，`image_url` 支持 base64 data URL（SDK 对 user 消息图片本就这么转，`@ai-sdk/openai dist/index.mjs:154-160`）。transport 层按 provider 分支（`needsImageAsUserMessage`：`openai` / `minimax` / `deepseek` / `openai-compatible`(completions)），把 media tool-result 改写为「tool 消息只留 note 文本 + 紧随其后插一条带 image part 的 user 消息」（`src/app/ai/chat/media-tool-results.ts`，纯函数、幂等、未改写时原样返回）。两个钩子各管一段：

- **`prepareCall`（轮入口）**：elision（K=2）+ 改写历史存活图。**改写必须同时覆盖轮内**——look 的图在 50 步循环中途产生，`prepareCall` 时还不存在，只在轮入口改写等于不改（实测 Step 2 仍 ~60K tokens 证实）
- **`prepareStep`（逐步）**：对新产生的 media tool-result 做同一改写。新图总在历史尾部，改写不动缓存前缀

Anthropic / OpenRouter / Google / Responses API 路径不改写——原生 tool-result 图片是最优形态，改写反是降级。测试：`tests/engine/chat/media-tool-results.test.ts`（6 case，含 elide→rewrite 管道顺序）。debug log 的 MEDIA DELIVERY 段区分轮入口普查与轮内逐步改写计数。

**实测结论**（MiniMax-M3）：

- `openai-compatible`(completions) + MiniMax-M3：改写后模型可见图
- `openai-compatible`(responses) + MiniMax-M3：**不可用**——端侧报 `invalid params, tool result's tool id not found (2013)`，MiniMax 的 responses 兼容端点对无状态 tool 往返的 call_id 校验不通过，属端侧限制，避开即可
- `anthropic-compatible` + MiniMax Anthropic 端点：原生 tool-result 图片。浏览器 dev 需经 vite proxy（`/proxy/minimax-anthropic` → `https://api.minimaxi.com/anthropic/v1`，端点 CORS 不允许 `anthropic-version` 头；Tauri 走 tauriFetch 天然免 proxy）

## 4. `look` 工具设计

```
look({ id?, focus? })
```

- `id`：目标节点，省略 = 当前营销根 frame 总览
- `focus`：本轮想检查什么——通道 A 并入 note 文字随图一起给主模型；通道 B 作为分析 prompt 的一部分发给独立视觉模型

### 精度是目标尺寸的确定性函数

**原理**（评审 §3.2）：可读性是逐元素的局部属性，整图缩略承载的是关系属性（节奏、配比、重心）。拿 overview 问局部问题，给到原图也是错的——要修的不是"把 overview 变清楚"，而是"别拿 overview 问局部问题"。overview 糊是特性（等价于眯眼测试），不是缺陷。

`scale = min(1, 1024/longEdge)` 本身是确定性函数（**2026-08-11 起改为双向：大设计仍缩小至 ≤1024 长边，小节点放大至 512px 最小可判读边、×4 封顶——见下方修订小节**），**只要 look 的对象正确，精度自动正确**：750×1050 的 section 得到 0.98 缩放、23px 文字，1024 单档足够。已实现的三条机制：

- **单一长边 1024，无分档**（原 zoom 级 1568 第二档属伪需求，已砍）
- **look 算出可读性并在 note 中声明能力边界**：`minTextPx = min(子树内 Text.fontSize) × scale`，低于 12px 时 note 明确"可判断结构比例/视觉重心/色彩分布；⚠ 文字约 N px，不可判读"
- **不可读时列出可钻取的子节点 id**：`"要检查文字，请分别 look：0:7 (Hero) / 0:9 (Features) / 0:12 (Specs)"`。agent 已理解节点 id（来自 render 返回与 describe），无需学习"第几屏"概念；超大 section 由同一机制自然递归

配套用法（评审 §3.6）：describe 先定位文字风险候选（叠图文字、偏小字号、低对比度，确定性且便宜）→ look 只确认候选节点（1-2 次）→ CP4 前 look 一次整图（构图/重心）。一轮 CP4 全套约 2-3k tokens。

明确砍掉（评审 §3.7）：`mode: 'overview' | 'read'`、`screen` 分屏、1568 第二档、按屏/按 section 的 look 预算硬约束、Set-of-Mark 叠层标注。

### 2026-08-11 修订：原位合成导出 / 放大预检 / 导出元数据（look 三层改造）

海报感实验的端午冒烟暴露了 V0 的三类系统性误判（透明节点与浅字在白底导出下白-on-白、放大失真被当设计元素），据此做了三层改造（实现与验收见 `docs/plans/tasks/poster-quality-experiment.md` 附记 8-11 §7）：

- **L1 原位合成导出（in-context）**：无可见自有填充的节点（透明 HeroContent 等——内容漂浮在下层绘制之上）与近白文字（为深图设计、白底下不可见）自动改为**设计语境合成导出**：渲染管线新增 `renderInContext`（渲染活页而非抽取选区，复用 blend/BACKGROUND_BLUR 分支形态）与绝对坐标 `clip`（节点视觉包围盒 +48px margin，夹在设计 root 内）。设计 root 本身保持 isolated（其语境就是裸页面）。近白判定折入 fill 不透明度（低透明灰字同样触发）。supersample 网格跟随输出尺度（>2x 放大不再线性上采样模糊）。
- **L2 放大预检**：小节点自动放大到 512px 最小可判读边（上限 ×4），note 声明放大倍率与"重采样伪影非设计属性"。
- **L3 导出元数据 + 置信协议**：结果新增 `exportInfo(mode: original-bytes | isolated | in-context, scale, upscaled)`；vision prompt 增加置信协议——失真/条纹/块化区域必须声明为导出/重采样伪影，**禁止当作设计元素或缺陷描述**（对治"竖条纹"误判）。

**明确不做"同一节点重复 look 去重省 token"**：节点自身未变 ≠ 其视觉上下文未变（HeroContent 没变不代表下层 HeroImg 没变），假阴性比浪费 token 代价高。`renderInContext` 的像素级回归测试：`tests/engine/io/raster-in-context.test.ts`（真实 CanvasKit：in-context 含下层绘制、isolated 不含）。

### 去重与上下文控制

**dedup 机制已取消**：`look` 永远返回完整 base64 图。取消原因：dedup 仅节省 ~300KB / 命中率 <10%；返回的"unchanged: true refer to your previous inspection"假设历史图存在，与 media elision 根本冲突，产生悬挂引用。

**token 成本控制由请求级 media elision 负责**：对请求 messages 做纯函数变换，只保留最新 K=2 张 media 图 base64，老的图被替换为文本占位（保留 note 文本）。K 值可在设置面板调整（1-3）。机制细节、已知局限（纯函数不碰常驻内存、per-turn 不覆盖轮内峰值）与演进待定事项均见 [l2-context-engineering.md](./l2-context-engineering.md) §7 待决。注意：`export_image` 不在 chat 的 CORE_TOOLS 中，实际仅 `look` 生效（评审 #9）。

**不设 look 预算硬约束**（describe 前置过滤后次数本就少；且预算会让模型回看已被 elision 裁掉的图，产生悬挂引用）。

## 6. 触发时机（prompt 规则）

1. **素材理解**：任务开始读需求单时 look 素材区每个素材条目的图片（focus "what does this image show"），生成一行内容描述写入 AI结论区。B 模式按 imageHash 自动缓存（重复理解零成本）；用户用法说明永远优先，图与说明明显不符时先问再用。素材角色从"全靠用户命名"变为"AI 看图 + 用户声明仲裁"。
2. **生图验收**：`generate_image` 落画布后 → look 验证生成结果是否符合 prompt 意图（图内文字乱码是 AI 生图常见病）。
3. **checkpoint 前置门禁**：展示 CP2/CP4 前必须 overview look。CP4 的文字可读性检查按 §4 修订执行：先 describe 定位候选文字节点，再 look 那几个节点确认，不在 root look 上问局部问题。
4. **跨 section 一致性**：色值、字号、间距是确定性数据，describe 给精确数字；视觉只用于"整体印象与重心分布"，不复用 overview look 做一致性。"每 3 个 section 用 describe 分析风格协调"规则保持不变。

## 7. V0 结论的用途（原 §6/§7 合并）

**V0 先做通道 A 的理由**：零配置、零新基础设施，最快验证"视觉回路到底提升多少"。若 V0 发现多模态模型对设计稿的判断质量差（设计审美是多模态弱项，很可能），视觉回路定位收缩为"素材理解 + 文字压图检测"两个确定性较强的用途，V1/V2 重排。

**与上下文工程的接缝**：token 基线在 Phase C 开工当天用 debug log 量（**前提：在 #3 脱敏修复之后量**，修复前口径每图虚高 150-400 KB）；V0 结论反向决定 Phase C 设计——视觉判断可靠 → media elision 作为一等公民 + manifest sections 加 visualCheck 字段；不可靠 → 收缩用途，Phase C 不为图片做特殊设计。

顺序全景（与 `README.md` §当前执行顺序 一致）：通道 A chat-completions 改写（#8）→ 第 4 轮回归（#9）→ 视觉 V0 结论 → Phase B → Phase C → 视觉 V1/V2。

## 8. 与现有体系的张力处理

- **lint 降噪**：R3-4 类启发式警告降级——"看起来有没有问题"由图回答，lint 只保留结构性 error（方法论 §6）。describe 的 subpixel / 8px grid / Low contrast / Near-invisible / gap≫padding 已降为 info（`describe/issues.ts INFO_PATTERNS`）；溢出、零尺寸、invisible、dark-on-dark 等结构 error 保留为硬门槛。
- **错误目录新增"视觉误判"类**：look 报告不存在的问题 / 漏报明显问题，按实测迭代方法论处理，先观察幻觉率再决定是否加 prompt 约束。
- **eval 工具不兜底视觉**：look 是视觉的唯一入口，防止 AI 用 eval 手写截图逻辑绕过 elision 与可读性声明机制。

## 9. 风险

| 风险 | 缓解 |
|---|---|
| **通道 A 在 chat-completions provider 上静默断线，视觉回路空转且看似正常** | §3.1 改写 + MiniMax-M3 双路径验证；长期防线：端到端接线测试防代码层退化、debug log MEDIA DELIVERY 段运行时判读、TEST-1234 判别法 |
| 多模态模型审美判断不可靠 | advisory 定位 + focus 收窄问题域 + look 在 note 中声明可读性边界并引导钻取子节点 + V0 先实测 |
| 上下文窗口压力（每图 token 成本 provider 相关：media part ≈1.4k，base64 文本 ≈50-100K） | chat history 媒体 elision（K=2）+ describe 前置过滤压缩 look 次数（一轮 CP4 全套约 2-3k tokens）；elision 演进归 l2-context-engineering.md 待定事项 |
| 延迟叠加（截图 + 视觉推理每次数秒） | CP 前置门禁每轮多 5-10 秒，对"生图 60 秒"现状可接受；制作清单场景另算总账 |
| 隐私（画布内容发第三方视觉 API） | 与现有 LLM 调用同级；独立视觉模型配置（用户可选），默认留空即关闭 |

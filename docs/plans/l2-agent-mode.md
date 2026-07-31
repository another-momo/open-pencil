# 营销图片设计 Agent 模式：详细规划

> 本文档定义营销 Agent 模式的设计：核心理念、工作流、素材类型体系、资源管理、运行时机制与校验。**状态与任务进度见 `README.md`（唯一状态来源）**；冒烟错误目录见 `knowledge/error-catalog.md`，实测方法论见 `knowledge/methodology.md`。

## 1. 核心设计理念

### 1.1 营销设计是约束驱动的优化问题

通用 UI 设计 Agent 可以被要求"随便做个好看的页面"——这是无约束的创意任务。营销设计 Agent 永远在约束条件下工作：尺寸约束（IAB 广告标准、社交媒体规范）、品牌约束（固定品牌色、字体、Logo 位置）、内容约束（必须包含特定文案、CTA）、平台约束（投放渠道的审核规范）。

Agent 的角色不是"自由创作"，而是在约束条件下产出最优解。约束不是限制，而是设计的骨架——没有约束的设计反而难以落地。

### 1.2 结构先行，内容后置

营销图的结构复杂度远高于 UI 页面。一个电商详情页可能包含 10+ 个 section，每个 section 的内部结构各不相同。

正确的策略是先确定结构，再填充内容：先划分 section、确定比例、建立 auto-layout 骨架；再逐 section 填充图片、文字、装饰；最后检查跨 section 的一致性。

### 1.3 一致性是设计质量的底线

营销图的质量标准不是"每个 section 都好看"，而是"整体协调一致"。色彩方案、字体方案、视觉风格必须贯穿整个设计。

一致性的实现方式：早期锁定（方案规划阶段确定色彩和字体，后续不能更改）、显式追踪（AI 维护设计状态摘要，每次填充新 section 时回顾）、强制校验（每完成 3 个 section 检查一次跨 section 一致性）。

### 1.4 多来源素材的协调

营销图的图片来源不是单一的——可能是 AI 生成的、用户提供的、或从图库获取的。Agent 需要主动选择来源（根据内容类型判断）、风格统一（不同来源的图片在色彩和风格上协调）、尺寸适配（不同来源的图片裁剪/缩放适配目标区域）。

### 1.5 协作式而非自主式

Agent 不应该试图一次性完成整个设计。关键决策点交由用户确认：风格方向（最难事后修改）、骨架结构（决定最终产出框架）、图片来源（Agent 不知道用户是否有现成素材）、最终效果（质量把关）。Checkpoint 的交互是纯对话，不消耗步数。

## 2. 工作流概览

### 2.1 四阶段流程

Phase 0 需求解析：从用户自然语言中推断素材类型、内容主题、风格倾向、约束条件，调用 `setup_material_type` 工具加载配置（见 §5）。

Phase 1 方案规划 + Checkpoint 1：AI 提供 2-3 个方向选项（风格/配色/构图），用户选择方向后锁定。

Phase 2 骨架生成 + Checkpoint 2：在根 frame 内生成 section 骨架（有锚点时位于锚点组件之间；section 划分、比例）和视觉骨架（色彩方案、字体方案），用户确认后锁定。

Phase 3 内容填充 + Checkpoint 3（循环）：对每个 section，判断图片来源 → 获取/生成图片 → 填充文字/装饰 → 验证协调性。每次需要图片时由用户决定来源。

Phase 4 整体检查 + Checkpoint 4：跨 section 一致性验证、品牌锚点检查、文字可读性检查，用户最终确认或微调。

### 2.2 Checkpoint 设计

| Checkpoint | 时机 | 用户决策 | 为什么必须有 |
|---|---|---|---|
| **CP1: 方向确认** | Phase 1 结束 | 选择风格方向 | 风格方向最难事后修改 |
| **CP2: 骨架确认** | Phase 2 结束 | 确认或调整骨架 | 骨架决定最终结构 |
| **CP3: 图片来源** | 每次需要图片时 | 决定 AI/stock/user | AI 不知道用户是否有现成素材 |
| **CP4: 最终确认** | Phase 4 结束 | 确认或微调 | 最终质量把关 |

Checkpoint 交互是纯对话，不消耗步数。AI 在等待用户输入时暂停，用户确认后继续。

### 2.3 步数预算

步数预算为**每轮 50 步**（与 UI 模式共享 `MAX_AGENT_STEPS`）。一轮指一次 AI 执行循环：从用户发送消息开始，到 AI 回复纯文本（无工具调用）结束。Checkpoint 天然将设计切分为多轮——AI 向用户提问时本轮结束，用户回复后新一轮重新获得 50 步。长设计由多轮组成，单轮 50 步完成一个 section 足够。剩余 ≤5 步时系统会注入警告提示 AI 收尾。

## 3. 素材类型体系

> 2026-07-30 修订：素材类型配置已从代码迁入 **Library .fig**（详见 `l2-resource-library.md`）。本章保留概念框架；存储与解析细节以该规划为准。

### 3.1 为什么需要素材类型

素材类型是用户意图到系统配置的映射层。用户说"做一张朋友圈广告"，系统需要知道：设计尺寸（根 frame 宽高）、需要哪些 section、引用哪些锚点组件、风格约束。素材类型封装了这些预设，用户无需手动配置。

### 3.2 素材类型配置

每个素材类型配置包含以下内容，按消费方分为两类（消费机制见 §5）：

**给 `setup_material_type` 工具执行的（确定性，代码完成）：**

- **尺寸**：固定值或可变高（长图类型）
- **锚点组件**：来自库 Components 区的组件引用，指定放置位置（`anchor_first` / `anchor_last`）

**给 AI 用的（软上下文）：**

- **风格档案（profile）**：独立的 Markdown 文档（配色、字体、语气、版式），由 setup 选中后注入 system prompt overlay——风格与类型解耦，换风格 = 切 profile（见 `l2-resource-library.md` §2）
- **类型描述（description）**：一句话说明，供 AI 推断类型时匹配用户意图

素材类型配置存储在 **Library .fig 的 Types 区**：每个类型一个 frame，配置项是 `key: value` 纯文本子节点（`id` / `label` / `size` / `description` / `anchor_first` / `anchor_last`）。用户新增类型 = 在库文件里加一个 frame，不需要改代码。

### 3.3 预设素材类型

| 素材类型 ID | label | 尺寸 | 锚点组件 |
|---|---|---|---|
| `wechat_moments` | 朋友圈广告 | 1080×1080 | 无 |
| `wechat_article_cover` | 公众号封面 | 900×500 | 无 |
| `xiaohongshu` | 小红书图 | 1080×1440 | `BrandBar(bottom)` |
| `ecommerce_detail` | 电商详情页 | 750×N | `BrandBar(top)` + `CTABar(bottom)` |
| `event_poster` | 活动海报 | 1080×1920 | 无 |
| `dsp_banner` | DSP 广告 | 300×250（IAB） | 无 |
| `product_long` | 产品长图 | 750×N | `BrandBar(top)` + `CTABar(bottom)` |

以上 7 个预设收录在随应用分发的 `default-library.fig`（`tools/marketing-library/` 生成）。无预设覆盖的尺寸走 `custom` 兜底（AI 传 width/height）。

## 4. 资源体系

> 2026-07-30 修订：资源体系已统一为 Library .fig 单一载体（详见 `l2-resource-library.md`）。

### 4.1 资源分层

| 层 | 资源 | 说明 | 管理方式 |
|---|---|---|---|
| **组件层** | 锚点组件（BrandBar / CTABar）、readonly 声明 | 库 Components 区的真 COMPONENT 节点；readonly 是组件内的 `readonly:` 子文本（声明式） | Library .fig，物化时跨文档克隆 |
| **类型层** | 尺寸、锚点引用、类型描述 | 库 Types 区的 frame + key-value 文本 | Library .fig，扫库解析为 LibraryIndex |
| **风格层** | profile Markdown、适用类型 | 库 Profiles 区的 plain TEXT | Library .fig，setup 选中后注入 prompt overlay |
| **参考层** | 参考样例 frame + `for:`/`tag:` 标注 | 库 References 区；用户勾选后克隆进工作文档「素材区」页 | Library .fig + 工作文档注入 |
| **执行层** | AI Agent + 运行时工具 | setup_material_type / validate / 内容填充 | 营销 prompt + 工具 |

### 4.2 组件资产与物化

OpenPencil 的组件是文档级的（实例只在当前文档内解析）。库组件以**真 COMPONENT 节点**存在于 Library .fig 的 Components 区，用户可直接在画布上编辑结构、样式和 `readonly:` 声明。

`setup_material_type` 物化时经 `cloneSubtreeAcrossGraphs` 把组件子树从库 graph 克隆到目标文档的 "Components" 页（图片字节按内容寻址 hash 搬运；`readonly:` 标记文本在克隆后剥离，不进实例），同名组件在页面级复用——多设计共享一份定义，改定义全实例同步。

物化约束（Q10）：库组件禁用 variables 与嵌套实例（跨文档引用无法迁移），扫库时检测进 warnings。

readonly 语义是**声明式**：setup 把 readonly 节点名写进返回 note 和 prompt，约束 AI 不修改；不再做运行时基线校验（Q13，见 `l2-resource-library.md` §3）。

使用真组件（而非普通 frame）的理由：

- 单文档内系列设计（如 5 张 banner 共用品牌条）：修改组件定义，所有实例同步更新
- 实例是不透明容器：单击选中整个实例（不会误选内部元素），天然保护锚点
- .pen 格式原生支持组件（`reusable` frame + `ref` 节点），保存/加载无问题

**实例内容填充与 override 记录**：OpenPencil 的组件同步是单向的（组件定义 → 实例），靠实例的 `overrides` 记录跳过已覆盖属性。AI 工具（`update_node` / `batch_update`）修改实例子节点时自动把改过的属性写入实例的 `overrides`；`render` / `node_replace_with` 替换实例内已映射子节点时，`preserveInstanceChildReplacement` 把旧节点的 componentId 映射转移给新节点并冻结 sync 白名单——AI 填的内容不会被组件同步冲掉。

### 4.3 校验机制

**validate 是纯代码的结构校验（脱库）**，只检查两类违规：

- `anchor_deleted`：锚点实例被删——期望位置从锚点记录自身的 position 推导（`top ↔ first`、`bottom ↔ last`）
- `anchor_misplaced`：锚点不在根 frame 的首/尾位置

校验数据全部来自会话注册表中的锚点记录（由 pluginData marker 跨重开恢复），**不读素材类型配置**——库未加载或库错了，validate 照常工作（断裂矩阵见 `l2-resource-library.md` §6.1）。重开文档后 setup 修复模式需要原库（组件定义是修复的物化来源）；根 frame marker 记录库名，session 启动时比对并引导用户重新提交。

**违规处理 — 修复前询问用户**：validate 无法区分修改来自 AI 还是用户。检测到违规时 AI 报告并询问：锚点被删 → 用户确认后重新 setup（修复模式重物化缺失锚点）；锚点错位 → reorder 移回或询问是否有意。

## 5. 运行时机制

素材类型配置通过 `setup_material_type` 工具发挥作用——这一个工具同时完成"自动机制"和"prompt 注入"两件事。

### 5.1 setup_material_type 工具

AI 在 Phase 0 推断出素材类型后调用：

```
setup_material_type({ id: "wechat_moments" })
```

**工具执行（确定性，代码完成）**：

1. 创建根 frame（尺寸由素材类型决定，默认白色底色——避免 describe 报 "Empty frame with no fill" 误导 AI 做无谓修复）——OpenPencil 没有全局画布尺寸，设计都在顶级 FRAME 节点中
2. 物化锚点组件：`cloneSubtreeAcrossGraphs` 从库 Components 区克隆组件到 "Components" 页，`createInstance` 放到素材类型配置指定的位置（首/尾）
3. 选中风格档案：显式 `profile` 参数优先；否则第一个 `applicable_to` 命中当前类型的 profile，再无则第一个 profile
4. 在根 frame 和锚点实例上写 pluginData marker（type / template / position / component / library 五类键），供跨重开恢复

**工具返回（进入对话上下文）**：

`size`、锚点实例 ID、`activeProfileId`（当前生效的 profile——其 Markdown 由 app 层注入后续轮次的 system prompt overlay，见 Q6）、库解析 `warnings`（库里有畸形条目时 AI 转告用户）。

此外 `note` 字段携带**含真实 rootFrameId 的操作硬指令**：`render every section INTO the root frame with render({ parent_id: "<rootFrameId>", jsx: ... })`。冒烟测试证明（见 `knowledge/error-catalog.md` R2-1）：prompt 规则不足以保证 AI 使用 `parent_id`，而工具结果常驻对话上下文、且带着具体 ID，是最可靠的注入位置。readonly 声明节点名也在 note 中（声明式约束）。

### 5.2 素材类型切换与修复

`setup_material_type` 支持三种调用模式：

- **首次**：全量物化（创建根 frame + 所有锚点实例 + 注册表）
- **切换**：AI 推断错误或用户要求更换素材类型时再次调用——清除旧锚点实例和注册表条目，按新类型重建
- **修复**：锚点实例被意外删除时调用——检测缺失的锚点，只重物化缺失部分。修复需要原库（组件定义的物化来源）；类型不在当前库时错误信息引导重新提交对应库文件

"Components"页面幂等：已存在则不重复创建；同名组件复用不重复克隆。

### 5.3 运行时流程

```
用户描述需求
    │
    ├─→ AI 推断素材类型（不确定时询问用户；L3 chips 可用户手选锁定）
    │
    ├─→ AI 调用 setup_material_type：
    │     · 执行：创建根 frame + 从库克隆物化组件（COMPONENT + INSTANCE）
    │     · 返回：size + 锚点 ID + activeProfileId + warnings
    │     · overlay：profile Markdown 注入后续轮次 system prompt
    │
    ├─→ AI 按 prompt 规则执行工作流（Phase 1-4）
    │
    └─→ AI 调用 validate 校验（每完成一个 section + 最终检查）
          · 通过 → 继续
          · 违规 → 报告用户并询问：误删锚点则修复模式重物化，错位则移回或确认有意
```

## 6. 图片来源策略

### 6.1 三种图片来源

| 来源 | 工具 | 典型场景 | 优势 |
|---|---|---|---|
| **AI 生成** | `generate_image` | 主视觉、创意背景、概念图 | 完全可控，可定制风格 |
| **图库获取** | `stock_photo` (Pexels/Unsplash) | 通用场景、人物、风景 | 真实感强，质量稳定 |
| **用户提供** | 文件拖入/paste | 产品实拍、品牌素材 | 最真实，符合用户预期 |

### 6.2 AI 的图片来源决策逻辑

AI 根据内容类型主动选择来源：具体产品（咖啡、服装、手机）优先 stock_photo（真实感），用户有产品图则优先用户素材；抽象概念（未来城市、梦幻背景）用 generate_image；用户明确指定素材则直接使用。

### 6.3 图片风格协调

先确定风格方向（Phase 1），锁定色彩方案和视觉风格关键词；生图时在 prompt 中追加风格描述；生图后用 describe 分析生成结果，检查与整体设计的协调性；如果风格不匹配，调整 prompt 重新生成。

## 7. 上下文管理

### 7.1 核心挑战

多阶段对话的上下文会持续增长。到后面的 section，AI 可能"忘记"早期决策（如 Phase 1 确定的配色方案）。

### 7.2 三层保障

**层一：Prompt 层 — 强制一致性规则**

在营销 prompt 中加入硬性约束：色彩方案不能改变、视觉风格关键词必须贯穿、字体方案不能中途更换、同类 section 应使用相似的构图模式。每完成一个 section，要求 AI 回顾 Phase 1 的风格决策。

**层二：状态层 — 显式设计状态追踪**

AI 在对话中维护一个"设计状态"摘要，包含素材类型、风格方向、色彩方案、字体方案、图片策略、已完成 section、待完成 section。每完成一个 section 更新。

**层三：工具层 — 后备方案（暂不实现）**

如果实际使用中出现严重上下文问题，可考虑对已完成 section 的详细工具调用做摘要压缩。建议先观察实际使用，不过度工程。

## 8. 用户交互模型

### 8.1 发起方式

营销设计通过聊天界面发起。用户输入自然语言描述，AI 推断素材类型：用户说"帮我做一张朋友圈广告"推断 `wechat_moments`，说"做一个咖啡店的长图详情页"推断 `product_long`，说"用我这张图做个 banner"推断 `dsp_banner` 并把用户提供的图片记录到设计状态中。如果无法确定，AI 询问用户。

### 8.2 Checkpoint 交互

Checkpoint 是纯对话交互，AI 发送选项或确认请求，用户回复选择或确认。AI 在等待时暂停，不消耗步数。用户在 Checkpoint 之间可以在画布上手动操作，但 AI 不感知这些操作——AI 只在自己的工作流内操作。

### 8.3 用户主动修改

设计完成后，用户可以通过聊天指令修改：AI 用 describe 定位目标元素，用 batch_update 精准修改，避免重建整个 section。例如"标题再大一点"→ AI 定位标题节点 → 调整字号；"换一张底图"→ AI 重新获取/生成图片。

### 8.4 继续未完成的设计

如果设计未完成但需要中断（步数用完、用户离开等），设计状态保存在对话上下文中。用户发送"继续"后，AI 从中断处恢复。

## 9. 关键挑战与应对

### 9.1 图层协调

AI 生成的图和其他图层需要视觉协调。应对策略见 §6.3（图片风格协调）。

### 9.2 尺寸适配

generate_image 输出尺寸是枚举值，目标区域可能是任意尺寸。应对：选择最接近的生成尺寸；裁剪/缩放适配目标区域；保持视觉重心。

### 9.3 多段一致性

长图多个 section 独立生图可能出现风格不一致。应对：确定统一的色彩方案/风格关键词；每次生图时携带全局风格描述；每完成 3 个 section 检查一次跨 section 一致性。

### 9.4 迭代修改

用户说"标题再大一点"时，需要精准修改而不重做整张图。应对：用 describe 定位目标元素；用 batch_update 精准修改；避免重新 render 整个 section。

### 9.5 错误恢复

tool call 失败时，generate_image 失败尝试 stock_photo 作为备选或让用户上传；图片风格不匹配时调整 prompt 重新生成（最多重试 2 次）；用户拒绝某个 section 时只重做该 section，不影响已完成部分；步数用完时保存设计状态，用户发送"继续"后从中断处恢复。

## 10. 实现与状态

实施任务表与各阶段状态已迁移至 `README.md`（唯一状态来源）；冒烟测试错误目录见 `knowledge/error-catalog.md`，实测方法论见 `knowledge/methodology.md`。

营销工具统一放在 `packages/core/src/tools/marketing/` 域（仿 image-gen 模式：入口文件 + 子文件夹实现）。后续阶段：Phase 3 实测迭代（进行中）→ Phase 4 品牌包集成（远期，优先级论证见 `../review/2026-07-27-agent-design-review.md`）。

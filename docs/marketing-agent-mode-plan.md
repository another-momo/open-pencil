# 营销图片设计 Agent 模式：详细规划

> 最后更新 2026-07-22。本文档定义营销 Agent 模式的设计，包括核心理念、工作流、素材类型体系、资源管理和关键挑战。Phase 1+2 代码已完成，3 轮冒烟测试（错误目录见 §11），当前处于实测打磨阶段；Layer 3 工作台交互改造已并行启动构想讨论（见 `ai-marketing-workbench-plan.md`）。

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

### 3.1 为什么需要素材类型

素材类型是用户意图到系统配置的映射层。用户说"做一张朋友圈广告"，系统需要知道：设计尺寸（根 frame 宽高）、需要哪些 section、引用哪些锚点组件、风格约束。素材类型封装了这些预设，用户无需手动配置。

### 3.2 素材类型配置

每个素材类型配置包含以下内容，按消费方分为两类（消费机制见 §5）：

**给 `setup_material_type` 工具执行的（确定性，代码完成）：**

- **尺寸**：固定值或可选范围
- **锚点组件**：来自组件模板的引用，指定放置位置
- **结构约束**：期望的节点树结构（组件位置、section 数量范围），供 `validate` 校验

**给 AI 用的（由工具返回到对话上下文）：**

- **section 规划**：建议的 section 划分，包含内容指引（contentGuide）
- **风格指南**：配色方案、字体方案、视觉风格关键词
- **自定义字段**：每个素材类型的特有信息（如"目标受众"、"产品类别"、"语气风格"等）

素材类型配置是灵活的，不同素材类型可以有不同的字段。通用字段由 marketing prompt 统一解释，自定义字段由 AI 用通用能力理解。

### 3.3 预设素材类型

| 素材类型 ID | label | 尺寸 | 锚点组件 |
|---|---|---|---|
| `wechat_moments` | 朋友圈广告 | 1080×1080 | 无 |
| `wechat_article_cover` | 公众号封面 | 900×500 | 无 |
| `xiaohongshu` | 小红书图 | 1080×1440 | `BrandBar(bottom)` |
| `ecommerce_detail` | 电商详情页 | 750×N | `BrandBar(top)` + `CTABar(bottom)` |
| `event_poster` | 活动海报 | A3/A4/自定义 | 无 |
| `dsp_banner` | DSP 广告 | IAB 标准 | 无 |
| `product_long` | 产品长图 | 750×N | `BrandBar(top)` + `CTABar(bottom)` |

## 4. 资源体系

### 4.1 资源分层

| 层 | 资源 | 说明 | 管理方式 |
|---|---|---|---|
| **组件层** | 节点结构、样式、可编辑槽位、readonly 标记 | 组件模板（节点树数据），物化为 OpenPencil 组件 | 代码中的模板定义 |
| **配置层** | 尺寸、锚点组件、结构约束、section 规划、风格指南 | 素材类型的参数化定义 | 代码中的注册表数据 |
| **执行层** | AI Agent + 运行时工具 | setup_material_type / validate / 内容填充 | 营销 prompt + 工具 |

### 4.2 组件模板

OpenPencil 的组件是文档级的（实例只在当前文档内解析，没有跨文档组件库机制）。因此本规划中的组件资产以**代码中的组件模板**形式存在：以结构化节点树数据定义（直接对应 SceneNode 字段，非 JSX 字符串），`setup_material_type` 执行时由**构建器**（递归 createNode + updateNode，约百行代码）在文档中物化——先创建 COMPONENT 定义节点，再创建 INSTANCE 实例放到指定位置。

选择结构化数据而非 JSX 字符串的理由：readonly 标记内联在节点上（结构性关联，不依赖 name 匹配，不可能错位）；类型安全（TS 对象，typecheck 可抓结构错误）；表达力无上限（IMAGE fill 等 JSX 方言表达不了的内容可表达）。模板数量少（3-5 个锚点组件）、由开发者维护，结构化数据的可读性代价可接受。

组件模板定义：

- **节点结构**：有哪些子节点，怎么排列（直接对应 SceneNode 字段）
- **默认样式**：颜色、字体、间距
- **readonly 标记**：模板节点上内联 `readonly: true`（如 logo、品牌名），未标记的部分即为可编辑槽位（如 CTA 文案、背景色）。该标记是模板级声明，只被 `setup_material_type` 和 `validate` 消费，不会物化为节点属性（与 UI 选择层的 `SceneNode.locked` 无关）

**模板中的图片有两种角色**：

- **固化图片**（如品牌 logo）：图片字节是模板资产的一部分，通过 `imageRef`（资产 ID）引用，物化时构建器从资产注册表取字节，`figma.createImage()` 创建 IMAGE fill。readonly
- **占位图片**（如 hero 图槽位）：可编辑槽位，物化时放灰色占位 fill，AI 在工作流中用 generate_image / stock_photo / 用户素材填充

**资产注册表**：资产 ID → 字节的注册与查询。模板只存 `imageRef` 引用不内联字节——模板保持纯数据、同一资产多模板复用，且天然是品牌包的接缝：Phase 1 实现内置默认资产（示例 logo），Phase 4 品牌包只需扩展注册表支持用户配置覆盖，模板零改动。

物化细节：COMPONENT 定义节点放到专门的"Components"页面，避免污染主画布；INSTANCE 放到素材类型配置指定的位置。

使用真组件（而非普通 frame）的理由：

- 单文档内系列设计（如 5 张 banner 共用品牌条）：修改组件定义，所有实例同步更新
- 实例是不透明容器：单击选中整个实例（不会误选内部元素），天然保护锚点
- .pen 格式原生支持组件（`reusable` frame + `ref` 节点），保存/加载无问题

**实例内容填充与 override 记录**：OpenPencil 的组件同步是单向的（组件定义 → 实例），靠实例的 `overrides` 记录跳过已覆盖属性，但直接编辑实例子节点不会自动记录 override。如果 AI 往实例里填了文案（未记录 override），用户随后编辑组件定义触发同步，AI 填的内容会被静默冲掉。因此 AI 修改实例子节点后，必须把改过的属性写入实例的 `overrides` 记录——实现上作为 `batch_update` / `update_node` 在实例子节点上执行时的自动行为（不下沉 scene-graph，影响面可控）。

组件模板独立于素材类型体系存在。素材类型配置根据实际需要引用组件模板，也可以完全不引用。

### 4.3 校验机制

**readonly 元数据的两层存储**：

- **定义层**：`readonly: true` 标记内联在组件模板的节点上，与模板同处一处，不需要路径引用
- **运行时层**：`setup_material_type` 的构建器在物化时天然持有模板节点 → 真实 nodeId 的映射，把 readonly 节点的原始值连同 nodeId 写入**会话级注册表**（core 层 `WeakMap<SceneGraph, ...>`，按文档隔离）：`Map<nodeId, { readonlyProps, originalValues }>`

readonly 约束是**工作流级的护栏**（防止 AI 在设计过程中破坏锚点），不是文档的永久特性——设计交付后用户可自由修改。因此注册表不持久化到文档格式。重新打开文档后如需继续 AI 设计，重新建立营销上下文时重建注册表即可。

**校验执行**：通过 `validate` 工具实现，纯代码检查，不依赖 AI 判断。prompt 要求 AI 主动调用：每完成一个 section 后调用一次，Phase 4 最终检查时再调用一次。

注意区分两种检查：**validate**（代码约束校验，本节内容）每个 section 后执行一次；**视觉一致性检查**（AI 用 describe 分析跨 section 风格协调性，见 §9.3）每完成 3 个 section 执行一次。前者是代码强制，后者是 prompt 规则。

**检查内容**：

- **组件内部校验**：读取会话注册表，对比 readonly 属性的原始值 vs 当前值
- **结构位置校验**：检查根 frame 的子树是否符合素材类型配置中的结构约束（锚点实例位置、中间 section 数量范围、子节点顺序）

**违规处理 — 修复前询问用户**：

validate 无法区分修改来自 AI 还是用户（用户在 Checkpoint 之间可能有意手动调整，见 §8.2）。因此检测到违规时，AI 不直接修复，而是向用户报告违规内容并询问处理方式：

- 用户确认是误改 → AI 向前修复（恢复数据源都是确定性的，不依赖 AI 记忆）：

  | 违规类型 | 恢复数据源 | 恢复方式 |
  |---|---|---|
  | readonly 属性被改 | 注册表 `originalValues`（violation 的 `originalValue` 字段直接带出） | batch_update 写回 |
  | readonly 子节点被删（锚点还在） | Components 页面的组件定义（完整节点树） | 修复模式：删残缺实例 → 从组件重新 createInstance → 重注册 |
  | 锚点实例整个被删 | 组件模板 | 修复模式：全量重物化该锚点 |
  | 锚点位置错位 | 素材类型配置 `structure.anchors` | reorder 移回 |

  实现要点：注册表的 `ReadonlyNodeInfo` 记录 `anchorInstanceId`（readonly 节点所属锚点实例），修复模式据此检测"锚点存活但内部 readonly 子节点缺失"的损伤；组件定义也被删时回退到模板全量重建。注意：注册表只快照 readonly 属性的值（不含几何/子树/兄弟顺序），所以"删除"类违规的恢复数据源是组件定义而非注册表。

- 用户确认是有意修改 → AI 接受当前值，更新注册表中的原始值为当前值（`validate({accept: true})`，后续校验以新值为准）

修复是确定性操作（原始值已知），且走正常 undo 语义，不污染用户的撤销栈。

## 5. 运行时机制

素材类型配置通过 `setup_material_type` 工具发挥作用——这一个工具同时完成"自动机制"和"prompt 注入"两件事。

### 5.1 setup_material_type 工具

AI 在 Phase 0 推断出素材类型后调用：

```
setup_material_type({ id: "wechat_moments" })
```

**工具执行（确定性，代码完成）**：

1. 创建根 frame（尺寸由素材类型决定，默认白色底色——避免 describe 报 "Empty frame with no fill" 误导 AI 做无谓修复）——OpenPencil 没有全局画布尺寸，设计都在顶级 FRAME 节点中
2. 物化组件模板：内部调用 `figma.createPage()` 创建"Components"页面，构建器（递归 createNode）在该页面构建模板节点树（固化图片从资产注册表取字节创建 IMAGE fill），`createComponentFromNode` 转为 COMPONENT，创建 INSTANCE 实例放到素材类型配置指定的位置
3. 构建器持有的模板节点 → nodeId 映射中，把 readonly 节点的原始值写入会话级注册表

**工具返回（进入对话上下文，即 prompt 注入）**：

素材类型配置中给 AI 用的内容（见 §3.2）：section 规划、风格指南、自定义字段、锚点组件 readonly 信息。

此外 `note` 字段携带**含真实 rootFrameId 的操作硬指令**：`render every section INTO the root frame with render({ parent_id: "<rootFrameId>", jsx: ... })`。冒烟测试证明（见 §11 错误 E1）：prompt 规则不足以保证 AI 使用 `parent_id`，而工具结果常驻对话上下文、且带着具体 ID，是最可靠的注入位置。

工具返回值留在对话上下文中，AI 后续所有阶段都能引用——不需要额外的 prompt 注入基础设施。

### 5.2 素材类型切换与修复

`setup_material_type` 支持三种调用模式：

- **首次**：全量物化（创建根 frame + 所有锚点实例 + 注册表）
- **切换**：AI 推断错误或用户要求更换素材类型时再次调用——清除旧锚点实例和注册表条目，按新类型重建
- **修复**：锚点实例被意外删除时调用——检测缺失的锚点，只重物化缺失部分并补写注册表条目

"Components"页面幂等：已存在则不重复创建。

### 5.3 运行时流程

```
用户描述需求
    │
    ├─→ AI 推断素材类型（不确定时询问用户）
    │
    ├─→ AI 调用 setup_material_type：
    │     · 执行：创建根 frame + 物化组件（COMPONENT + INSTANCE）
    │             + 记录 readonly 属性原始值到会话注册表
    │     · 返回：section 规划 + 风格指南 + 自定义字段 + readonly 信息（进入上下文）
    │
    ├─→ AI 按 prompt 规则执行工作流（Phase 1-4）
    │
    └─→ AI 调用 validate 校验（每完成一个 section + 最终检查）
          · 通过 → 继续
          · 违规 → 报告用户并询问：误改则向前修复，有意修改则更新注册表基准值
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

## 10. 实现路径

### Phase 1: 核心链路（目标：端到端跑通四阶段工作流）

营销工具统一放在 `packages/core/src/tools/marketing/` 域（仿 image-gen 模式：入口文件 + 子文件夹实现）。

| # | 任务 | 产出物 | 验证方式 |
|---|---|---|---|
| 1.1 | 素材类型注册表 | `marketing/material-types.ts`：MaterialTypeConfig 类型 + 7 个预设 + 查询 API。纯数据接口（为后续 JSON 配置化留路） | typecheck |
| 1.2 | 资产注册表 | `marketing/assets.ts`：资产 ID → 字节的注册与查询，内置默认资产（示例 logo） | typecheck |
| 1.3 | 组件模板 + 构建器 | `marketing/component-templates.ts`：BrandBar/CTABar 模板（结构化节点树 + 内联 readonly 标记 + imageRef 引用）；`marketing/builder.ts`：递归 createNode 构建器（解析 imageRef → createImage → IMAGE fill） | typecheck + 引擎单测 |
| 1.4 | `setup_material_type` 工具 | `marketing/setup.ts` + 入口 `tools/marketing.ts`：创建根 frame → 确保"Components"页面存在（幂等）→ 构建器物化 → createComponentFromNode + createInstance → 写会话注册表（`WeakMap<SceneGraph, ...>`）→ 返回配置。**支持三种调用模式**：首次（全量物化）、切换（清除旧锚点实例和注册表条目，按新类型重建）、修复（检测缺失的锚点实例，只重物化缺失部分并补写注册表） | CLI eval 无头测试 |
| 1.5 | CORE_TOOLS 注册 | `registry-core.ts` 加入 setupMaterialType（AI chat 只读 CORE_TOOLS；两模式共享工具集，营销工具在 UI 模式可见但无害） | app 内 AI 可见 |
| 1.6 | 营销 prompt 重写 | `system-prompt-marketing.md`：四阶段工作流、Checkpoint 交互规则、一致性规则、设计状态追踪、组件填充规则 | 人工 review |
| 1.7 | 冒烟测试 | 手动跑 2 个需求：wechat_moments（无锚点）+ product_long（有锚点），验证四阶段流程走通 | 🔄 已跑 2 轮（wechat_moments），错误目录见 §11 |

依赖关系：1.1/1.2/1.3 互不依赖可并行 → 1.4 依赖前三个 → 1.5 依赖 1.4 → 1.6 依赖 1.4（prompt 要引用真实工具名和配置字段）→ 1.7 收尾。

### Phase 2: 安全护栏（目标：锚点保护生效）

| # | 任务 | 产出物 | 验证方式 |
|---|---|---|---|
| 2.1 | override 自动记录 | `batch.ts` + `update.ts`：检测目标节点是否在 INSTANCE 内（沿 parentId 上溯），把 `childId:propName` 写入根实例的 overrides 记录。**不下沉 scene-graph**（影响面可控），后续按需再议 | 引擎单测 |
| 2.2 | `validate` 工具 | `marketing/validate.ts`：readonly 属性对比 + 结构位置校验 → 返回违规列表。**只报告不修复**（修复由 AI 在用户确认后用 batch_update 执行；锚点实例被删则由 AI 调用 `setup_material_type` 修复模式重物化）。用户确认"有意修改"时通过参数更新注册表基准值。注册到 CORE_TOOLS | CLI eval + app 内测试 |
| 2.3 | prompt 补充 validate 规则 | `system-prompt-marketing.md`：补充 validate 调用时机（每完成一个 section 后、Phase 4 最终检查）、违规处理流程（报告用户 → 询问 → 误改修复 / 有意更新基准值）。validate 存在前 prompt 不引用它 | 人工 review |
| 2.4 | 护栏场景测试 | 手动验证：AI 误改 readonly → validate 报告 → 询问用户 → 误改则修复 / 有意则更新基准值；锚点实例被删 → 修复模式重物化 | 🔄 待 app 内验证（冒烟测试第 3 轮） |

### Phase 3: 实测迭代（进行中）

用真实营销需求测试：收集 AI 常犯的错误，补充硬规则。优化工作流节奏。验证 generate_image + render 交替节奏。已完成 2 轮冒烟测试，错误目录见 §11。

### Phase 4: 品牌包集成（远期）

品牌色/字体/logo 注入机制。资产注册表扩展用户配置覆盖（模板零改动，见 §4.2）。generate_image prompt 追加品牌风格关键词。render 文字自动套用品牌字体/配色。

## 11. 冒烟测试错误目录（实测驱动迭代的核心资产）

测试需求：咖啡店朋友圈广告（`wechat_moments`，无锚点）。分析手段：AI debug log（工具调用序列 + 诊断 + 对话全文）。

### 第 1 轮（2026-07-21）

| # | 现象 | 根因 | 修复 |
|---|---|---|---|
| R1-1 | 同一 `insert_index` 重复 render，产出 5 个 section（应为 3 个） | prompt 未禁止同位置二次渲染 | prompt 加 `replace_id` 规则：修复错误必须重渲染替换，禁止重复渲染 |
| R1-2 | `mt` prop 幻觉 ×5 | prompt 的 margin 禁令不够显眼 | prompt Prohibited 区加粗显式列出 `mt/mb/ml/mr/mx/my` 不存在 |
| R1-3 | 乱码中文文案 + `#6B728λή` 损坏 hex 静默解析为黑色 | render 不校验颜色合法性 | `render.ts` 增加 `collectInvalidColorWarnings`（culori 解析失败即警告）；文案质量属模型能力，待观察 |
| R1-4 | 中文用户收到英文 checkpoint | prompt 无语言规则 | prompt 加"checkpoint 一律用用户语言"规则 |

### 第 2 轮（2026-07-22）— 发现致命 bug

| # | 现象 | 根因 | 修复 |
|---|---|---|---|
| R2-1 | **致命**：3 个 section 全部渲染在根 frame 之外，成为页面级孤儿（148×648 等坍塌尺寸），根 frame 始终空白 | prompt 从未告知 `render` 的 `parent_id` 参数；AI 幻觉出在 JSX 里写 `id="0:3"` 想指定父级（被忽略，警告出现 3 次 AI 未反应）| 三层修复：① `setup_material_type` 的 note 注入含真实 ID 的 `parent_id` 硬指令（工具结果常驻上下文）；② prompt Phase 2 加 parent_id 必传规则 + 示例；③ `render.ts` 的 `id` prop 警告特化为指向 `parent_id`/`replace_id` |
| R2-2 | describe 报出 error（深字压深底）和多个 warning，AI 未修复直接展示 checkpoint | prompt 只说"修复"，没禁止带病展示 | prompt 明确"修完所有 error/warning 才能展示 checkpoint" |
| R2-3 | checkpoint 问题仍是英文（"Does this structure work?"） | prompt 里字面英文示例覆盖了 R1-4 的语言规则 | checkpoint 问句改为中文示例（"这个结构可以吗？"） |
| R2-4 | Phase 2 骨架阶段就写入全部真实文案/价格 | prompt 未禁止 | prompt 明确 Phase 2 只用占位文字，真实内容 Phase 3 才写 |
| R2-5 | 幻觉品牌名"掌上生活App 扫码即享"（招商银行 App） | CP1 未收集品牌/产品名 | prompt Phase 1：需求缺品牌/产品名时在 CP1 一并询问，禁止编造 |
| R2-6 | styleGuide 字体 PingFang SC 未应用（全程默认 Inter） | prompt 无字体应用规则 | prompt Phase 1：锁定字体必须通过 `fontFamily` prop 应用 |
| R2-7 | 根 frame 无底色 → "Empty frame with no fill" 警告诱导 AI 浪费 3 次调用（含 1 次 no-op resize） | 根 frame 创建时无 fills | `setup.ts` 创建根 frame 时默认白色底色 |

### 第 3 轮（2026-07-22 下午）— 端到端首次完整跑通

上轮修复全部生效（parent_id ✓、中文 checkpoint ✓、CP1 品牌名询问 ✓、validate 收尾 ✓）。暴露的新问题：

| # | 现象 | 根因 | 修复 |
|---|---|---|---|
| R3-1 | calc×5 / batch_update×6 / image-gen×1 / stock-photo×1 共 13 次 "Invalid JSON" 失败（约占 1/4 steps）；AI 偶然发现尾部加空格能成功 | 模型吐 tool args 时 JSON 字符串值尾部双重闭合（`\"}`），外层 JSON 合法故 SDK 正常投递——只有"JSON 字符串套 JSON"参数的工具中招（render/set_text 等普通参数全程无恙）。calc 还有二层问题：JSON.parse 失败后兜底喂 expr-eval，报错看似表达式语法错误，误导 AI 朝加空格方向重试 | 共享 `parseJsonArrayParam`（destr 快路径 + "尾部只含无关字符"守卫的救助路径 + warning 透传结果），接入 calc/batch_update/image-gen/stock-photo；calc malformed array 直接报清晰错误不再喂 expr-eval；原型污染防护保持（destr 快路径 + 救助路径 __proto__ 守卫） |
| R3-2 | 用户明确"主视觉用AI生成"，但 AI 认为 generate_image 不能填灰色占位符 → 页面级生成新节点 + eval insertChild 插回（还先用错 getNodeByIdAsync 浪费一次） | **工具描述与 prompt 规则矛盾**：prompt 说"按 id 填占位符"，工具描述却说"id 用于 img2img 编辑现有图片节点"——AI 信工具描述。另有潜在 bug：apply.ts 从目标节点回填的原始尺寸（1080×500）未做枚举映射，真调用了会 400 | 工具描述明确"无图片填充的叶子形状占位符直接填充"（代码本就支持）；apply.ts 回填尺寸经 normalizeSize 映射；prompt Phase 3 明确两个图片工具都接受占位符 id、无需 reparent |
| R3-3 | 改字体被迫用 eval ×2，且 `fontName={style:'Bold'}` 把 11px 说明文字误设为 Bold（样式回归） | update_node/batch_update 无 font_family prop；eval 的 fontName 语义是 family+style 对，改字族必然碰字重 | update_node + batch_update 加 `font_family`（保留原字重/样式） |
| R3-4 | "fill matches parent" error 触发 2 次，诱发无效修复（造出 #FFF8F0 vs #FAF6F1 这种肉眼无差的差异）；subpixel warning 满屏（justify=center 必然产生 .5 偏移，AI 正确忽略） | 消息文案含 "invisible" 被 ERROR_PATTERNS 的 /invisible/ 截获（INFO_PATTERNS 的 /fill.*matches parent/ 永远轮不到）；subpixel 检查不区分布局计算值和显式定位 | 文案改 "no visible boundary"（正确落入 info）；auto-layout 父级内非 ABSOLUTE 子节点跳过 subpixel 检查 |
| R3-5 | setup 结果不含设计尺寸 → 多花一次 get_node 查根 frame 宽高 | 遗漏 | `SetupResult` 加 `size` 字段 |
| R3-6 | Phase 2 骨架混入真实促销文案，"周三5折"是 AI 虚构的活动 | 原"骨架禁真实文案"规则打偏：结构性文案（"爆款推荐"）无害且让 CP2 更直观；真正有害的是**虚构营销事实**——它存在于所有阶段，禁骨架文案不解决（Phase 3 照样编，因为没有 checkpoint 问过活动细节） | 规则改"骨架允许结构性标签 + 全阶段禁止虚构具体信息（折扣/价格/日期/地址），未知用 `¥__`/`X折` 可见占位"；CP1 在品牌名之外加问活动细节 |

### 修复方法论沉淀（补充）

两轮测试验证了"**工具结果注入 > prompt 规则**"的可靠性排序：prompt 规则 AI 可能忽略或误解（R2-1 中警告出现 3 次都没纠正行为），而带具体参数的工具返回 note 常驻上下文、可直接引用。新硬规则的注入优先级：① 工具返回值（note/警告文本）→ ② prompt 硬性规则（CRITICAL 标记）→ ③ prompt 一般指引。

第 3 轮补充两条：

- **工具描述是 prompt 表面的一部分，必须与 prompt 规则一致**（R3-2）：prompt 说"按 id 填占位符"，工具描述说"id 用于编辑现有图片节点"，AI 选择相信工具描述。修改 prompt 规则时同步检查相关工具描述。
- **错误消息是 AI 的调试依据，误导性报错会放大重试成本**（R3-1 calc）：兜底路径产生的报错看似表达式语法错误，AI 朝错误方向重试 5 次。工具报错应指向真实原因和正确做法。

同时从 UI prompt 回搬了 13 条成熟规则（calc 强制、40 元素上限、render→describe→batch_update 强制循环、复用工具返回 ID、describe 严重级别对照表、修复 2 次失败删掉重来等），两份 prompt 现有约 100 行重复，后续可抽基础 prompt 在 transports 层拼接（已知技术债，暂缓）。

### 待验证场景（第 4 轮）

- 回归：朋友圈广告重测（JSON 尾部垃圾被救助且带 warning、calc 不再误导性报错、generate_image 直接填占位符、改字体走 font_family 不用 eval、CP1 加问活动细节、骨架无虚构促销信息）
- 护栏（修改）：product_long → 手动改 BrandBar logo/品牌名 → AI 调 validate 报告并**询问**（而非擅自恢复）→ "误改" → AI 用 violation 的 `originalValue` 直接 batch_update 恢复
- 护栏（删除）：手动删 BrandBar 内 readonly 子节点 → validate 报 `readonly_deleted` → 用户确认误删 → 修复模式从组件定义重物化该锚点（新实例 nodeId 重注册，无残留死映射）
- 护栏（有意修改）：手动改 readonly 后声明"有意" → `validate({accept: true})` 重置基准 → 再次 validate 通过
- CP3 图片来源 checkpoint：小红书种草图，验证逐 section 询问/批量指令记忆
- 用户素材识别：拖图入画布后"用这张图做 banner"
- 素材类型切换：公众号封面中途改活动海报，验证 setup 切换模式清理旧内容

# 营销图片设计 Agent 模式：详细规划

> 本文档定义营销 Agent 模式的设计：核心理念、工作流、素材类型体系、运行时机制。**资源管理 / 锚点 / 校验**已迁移到 [`l2-brand-config.md`](./l2-brand-config.md)（P3 重大重构），本文档保留工作流骨架。**状态与任务进度见 `README.md`（唯一状态来源）**；冒烟错误目录见 `../knowledge/error-catalog.md`，实测方法论见 `../knowledge/methodology.md`。

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

### 2.1 四阶段流程（2026-08-11 修订：插入 Phase 2.5 物化槽）

Phase 0 需求解析：从用户自然语言中推断素材类型、内容主题、风格倾向、约束条件，调用 `setup_material_type` 工具加载配置（见 §5）。

Phase 1 方案规划 + Checkpoint 1：AI 提供 2-3 个方向选项（风格/配色/构图），用户选择方向后锁定。

Phase 2 骨架生成 + Checkpoint 2：在根 frame 内生成 section 骨架（有锚点时位于锚点组件之间；section 划分、比例）和视觉骨架（色彩方案、字体方案），用户确认后锁定。**若 Active profile 带 `## Visual environment setup (Phase 2.5)` 节，骨架必须前置其结构要求（hero 槽位、透明 section 等）——不得先确认无 hero 骨架再返工。**

**Phase 2.5 视觉环境物化（2026-08-11 新增；实验中——已过单 profile 端午冒烟，R6 对照验证后转正）**：CP2 之后、Phase 3 之前的 profile 驱动槽位。工作流只固定**时机**（骨架确认后——图片生成耗时不许先于结构确认）与**出口契约**（`look` 验证）；**做什么由 profile 的 Phase 2.5 节供给**，无 profile 或无 setup 节则整段不存在。典型形态（水彩长图）：`generate_image` 入 hero 槽 → `compose_backdrop` 一次调用建立连续背景（自动采样中间 stop、bleed 遮缝）→ `look` 验证。设计依据、验收与冒烟结论见 `docs/plans/tasks/poster-quality-experiment.md`。

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

> 2026-08-17 重写（P3）：素材类型配置迁入 **brand config**（用户级 CRUD 资产，SQLite 存储），Library .fig 库、锚点组件与 validate 校验机制已整体删除。brand config 的数据模型、API 与 UI 详见 `l2-brand-config.md`。

### 3.1 为什么需要素材类型

素材类型是用户意图到系统配置的映射层。用户说"做一张朋友圈广告"，系统需要知道：设计尺寸（根 frame 宽高）、风格约束、平台语境。素材类型封装了这些预设，用户无需手动配置。

### 3.2 素材类型配置

每个素材类型是一条纯数据记录（不再有画布载体）：

- **id / label**：类型标识与展示名
- **尺寸（size）**：`WxH` 固定值，或 `Wx` 空高（HUG，长图随内容生长）
- **类型描述（description）**：一句话说明，供 AI 推断类型时匹配用户意图

风格档案（profile）与类型解耦，独立存储：`{ id, label, applicable_to, markdown }`——markdown 是自由文本风格指南（配色、字体、语气、版式），由用户选中后注入 system prompt overlay；换风格 = 切 profile（见 `l2-brand-config.md` §2）。

配置存储在 **brand config**（`~/.openpencil/brand.db`）：出厂默认层（`public/default-brand/config.yaml` 首次启动 seed，只读）+ 用户层（CRUD 覆写）两层合并，user 优先。CRUD 走 agent backend 的 `/v1/brand/types` / `/v1/brand/profiles` 端点，前端入口是 BrandConfigPanel。用户新增类型 = 面板里加一条记录（或编辑 YAML 导入），**不需要改代码**。

### 3.3 预设素材类型

出厂预设 `public/default-brand/config.yaml`（ship-with 仓库，agent 首次启动 seed 进默认层）收录以下 7 个预设：

| 素材类型 ID | label | 尺寸 |
|---|---|---|
| `wechat_moments` | 朋友圈广告 | 1080×1080 |
| `wechat_article_cover` | 公众号封面 | 900×500 |
| `xiaohongshu` | 小红书图 | 1080×1440 |
| `ecommerce_detail` | 电商详情页 | 750×N（HUG） |
| `event_poster` | 活动海报 | 1080×1920 |
| `dsp_banner` | DSP 广告 | 300×250（IAB） |
| `product_long` | 产品长图 | 750×N（HUG） |

无预设覆盖的尺寸走 `custom` 兜底（AI 传 width/height）。

## 4. 资源体系

> 2026-08-17 重写（P3）：资源体系统一为 **brand config** 单一载体（YAML 文件格式 + SQLite 运行时），详见 `l2-brand-config.md`。

### 4.1 资源分层

| 层 | 资源 | 存储 | 注入方式 |
|---|---|---|---|
| **类型层** | 尺寸、类型描述 | brand config types（默认层 + 用户层） | 前端会话启动时 push 进 core 类型注册表，`setup_material_type` 按 id 解析 |
| **风格层** | profile Markdown + `applicable_to` 适用类型 | brand config profiles | 用户在 MarketingConfigBar 选中 → 请求携带 `pickedProfileId` → overlay 注入 system prompt（见 §5.3） |
| **执行层** | AI Agent + 运行时工具 | 营销 prompt + 工具 | setup_material_type / 内容填充 |

P3 删除了旧组件层与参考层：锚点组件、`readonly:` 声明、参考样例页、validate 结构校验均已移除——设计画布上不再存在任何库来源的实例、克隆或标记，AI 只操作自己创建的节点。

### 4.2 存储与合并

- **两层结构**：默认层（出厂预设 seed，应用代码永不修改）+ 用户层（BrandConfigPanel CRUD / YAML 整库导入替换）；合并视图永远 user 优先
- **运行时**：agent 进程持有 `BrandRepository`（SQLite，`~/.openpencil/brand.db`，`OPENPENCIL_BRAND_DB` 可覆盖）；前端经 `/v1/brand/manifest` 读合并视图，Web 版（无 agent）走硬编码 fallback
- 数据模型、YAML schema 与 API 端点的完整契约见 `l2-brand-config.md` §2-§3

## 5. 运行时机制

素材类型配置通过 `setup_material_type` 工具发挥作用——工具负责确定性执行，风格上下文由 system prompt overlay 注入。

### 5.1 setup_material_type 工具

AI 在 Phase 0 推断出素材类型后调用：

```
setup_material_type({ id: "wechat_moments" })
```

**工具执行（确定性，代码完成）**：

1. 按 id 从激活类型注册表解析尺寸（前端会话启动时把 brand config types 经 `setActiveMaterialTypes` push 进注册表；两条聊天路径——浏览器内 ToolLoopAgent 与 agent backend 经 automation bridge 反调——都在编辑器进程内执行工具，一处 push 全覆盖）；未知 id 报错并列出可用 id
2. 创建根 frame（尺寸由素材类型决定，默认白色底色——避免 describe 报 "Empty frame with no fill" 误导 AI 做无谓修复）——OpenPencil 没有全局画布尺寸，设计都在顶级 FRAME 节点中
3. 在根 frame 上写 pluginData marker（type 等键），供跨重开恢复

**工具返回（进入对话上下文）**：

`size`（HUG 类型 height 为 null）、`page`、`rootFrameId` / `rootFrameName`、`adopted`（+ `existingChildren`）。不再返回锚点实例 ID、`activeProfileId` 或库解析 warnings——这些机制已删除。

此外 `note` 字段携带**含真实 rootFrameId 的操作硬指令**：`render every section INTO the root frame with render({ parent_id: "<rootFrameId>", jsx: ... })`。冒烟测试证明（见 `../knowledge/error-catalog.md` R2-1）：prompt 规则不足以保证 AI 使用 `parent_id`，而工具结果常驻对话上下文、且带着具体 ID，是最可靠的注入位置。

### 5.2 素材类型续建与新建

`setup_material_type` 的 continue/new 是 **PAGE 级**语义：

- **首次**：创建新根 frame
- **续建（mode: "continue"，默认）**：同页同类型设计已存在 → 直接 adopt（返回 `adopted: true` + 既有子节点数，由用户确认继续还是重做）；跨页从不 adopt——同类型设计在别的页面时错误信息引导先切页
- **新建（mode: "new"）**：总是另起一个根 frame——一个文档可共存多个设计

### 5.3 profile overlay 注入

风格上下文不进工具结果，走 system prompt overlay：

- 前端每轮请求只携带 `brandSelection.pickedProfileId`——用户在 MarketingConfigBar profile chip 的显式选择（null = 未激活；只有显式 pick 才 ship 非空 id，故非空即 user-picked）
- agent 后端 `buildMarketingOverlay(brandSelection, brandRepository)` 生成 overlay：全量类型清单（"## Material types in the current brand"）+ 有 user-picked profile 时的 "## Active style profile" Markdown；未 pick 时 profile 目录不下发——没有用户选定风格，AI 无权知道有哪些 profile
- 前端 Path B（无 agent 的 Web 版）由 `src/app/ai/marketing/library.ts` 的同构 `buildMarketingOverlay` 注入，两边实现保持逐字节一致
- `pickedProfileId` 不在当前 brand config 中（整库导入替换后可能失效）→ overlay 明示 AI 请用户重新选择或清空 chip

### 5.4 运行时流程

```
用户描述需求
    │
    ├─→ AI 推断素材类型（不确定时询问用户；L3 chips 可用户手选锁定）
    │
    ├─→ AI 调用 setup_material_type：
    │     · 执行：按 brand config 尺寸创建根 frame（或 adopt 同页既有设计）
    │     · 返回：size + page + adopted + note（含 rootFrameId 硬指令）
    │     · overlay：类型清单 + active profile Markdown 注入 system prompt
    │
    ├─→ AI 按 prompt 规则执行工作流（Phase 1-4）
    │
    └─→ AI 在每段收尾调用 describe + batch_update 修复问题
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

`generate_image` 接收任意尺寸（2026-07-28 重构后取消枚举）；经 `requests.ts` 的 `normalizeSize` 做 16px 对齐 + 约束裁剪（最大边 3840、比例 ≤3:1、像素 655,360–8,294,400）。调用方通过 `width`/`height` 显式传入或由工具从目标节点回填。详见 `l1-image-gen.md`。

### 9.3 多段一致性

长图多个 section 独立生图可能出现风格不一致。应对：确定统一的色彩方案/风格关键词；每次生图时携带全局风格描述；每完成 3 个 section 检查一次跨 section 一致性。

### 9.4 迭代修改

用户说"标题再大一点"时，需要精准修改而不重做整张图。应对：用 describe 定位目标元素；用 batch_update 精准修改；避免重新 render 整个 section。

### 9.5 错误恢复

tool call 失败时，generate_image 失败尝试 stock_photo 作为备选或让用户上传；图片风格不匹配时调整 prompt 重新生成（最多重试 2 次）；用户拒绝某个 section 时只重做该 section，不影响已完成部分；步数用完时保存设计状态，用户发送"继续"后从中断处恢复。
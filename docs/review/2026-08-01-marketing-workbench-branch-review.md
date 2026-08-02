# 营销工作台分支整体 Review（2026-08-01）

> 评审对象：`feature/marketing-workbench` 分支的完整改动范围与改动方案——相对 fork 基线（`8561d73e`，2026-07-21 合入 upstream）共 67 commits / 161 文件 / +15,280 / -340。
> 评审范围：产品视角（改动范围、方案取舍、风险）+ 工程视角（分层、实现质量、单测、真实缺陷清单）。依据 = 全量 diff + 设计文档（`../plans/*`）+ 既有评审（`../review/*`）+ 关键实现代码与单测逐文件核对。
> 评审结果：**方向正确、范围克制、工程质量上乘**（营销引擎 62+ 单测、core/app 边界严守、review 落档纪律完整）。主要风险不在代码，而在：① 视觉回路价值已实测确认，但结论未落档、通道 B/素材理解未纳入同一回归基线就叠了上层功能；② 4 个确定性校验/状态一致性缺陷（其中 1 个会误报 validate 通过）；③ 轮内 elision 缺口未闭环。按惯例：本评审落档后不再改动，结论通过修订 `../plans/` 与代码生效。

---

## 一、改动范围（分支全景）

| 层 | 内容 | 落地 |
|---|---|---|
| L1 生图工具 | `generate_image` 重构：references/id 解耦、尺寸约束裁剪替代枚举映射、超时、错误解析、`asImage: true` 渲染参考 | ✅ |
| L2 Agent 模式 | marketing 工具域（setup / validate / restore / registry / library / clone / brief / look / vision）+ `system-prompt-marketing.md`（390 行） | ✅ |
| L2 上下文工程 | media elision（K=2）、per-rootFrame 注册表键控、画布 marker 懒恢复、类型关键词下沉 | ✅ |
| L2 视觉回路 | `look` 工具 + 通道 A/B 双通道 + chat-completions media 改写 + 素材理解 + lint 降噪 | ✅ |
| L2 AI undo | burst 级 undo coalesce（~7.5MB → ~150KB） | ✅ |
| L2 营销字体 | 阿里巴巴普惠体 9 字重 bundle（62MB）+ prompt 强约束 | ✅ |
| L3 工作台 | 需求单节点、类型 chips + 本地预推断、MarketingConfigBar（类型/风格/参考三配置项）、Profile Gallery、库 dialog | ✅ |
| 资源库载体 | `default-library.fig`（32.6KB，构建期资产）+ `tools/marketing-library/` 生成器 + 回环测试 | ✅ |
| 配套 | CI 简化 windows-only build、Tauri 无签名配置、desktop 字体接线 | ✅ |

未做（文档显式标记）：制作清单 + 派生、导出流程、ask 工具/生图进度、品牌包沉淀机制、多品牌（已决策 v1 一库=一品牌）。

---

## 二、产品视角

### 2.1 核心定位：约束 + AI 自由，与"模板 + AI 填充"是两类产品

国内做 AI 营销图的主流玩家都在做同一件事——**模板 + AI 填充**：模板提供视觉骨架，AI 在模板的"插槽"里填字段。Canva Magic Switch 是"换字段 → 出变体"；Figma Buzz 是"运营填字段、设计师建模板"；美图设计室的批量生成也是"主模板 × N 个 SKU"。这种模式的代价是线性的：

1. 必须建海量模板库（Canva 22 亿素材 / 稿定 22 亿模板 / 美图月生 1.3 亿张）。
2. 每个模板的"自由发挥空间"被钉死——只能在模板定义的字段里变，骨架不能动。
3. 模板越丰富，维护成本越高；模板不够丰富，用户就找不到合适起点。

**open-pencil fork 走的是另一条路："约束 + AI 自由"**。library.fig 提供的是**约束表面**（types / profiles / components / references 四区），不是模板。AI 在这个约束表面内**自由发挥**出 section 结构、文案布局、视觉构图、字号节奏——这些全部由 AI 决定，不由模板钉死。这是与所有"模板 + AI"产品的范式区别。

**关键差别**（这个差别决定了 open-pencil fork 不需要海量模板库）：

| 维度 | 模板 + AI 填充 | 约束 + AI 自由 |
|---|---|---|
| 模板价值密度 | 模板数 × 每模板的可变字段数 — **线性** | 约束面 × AI 自由发挥的解空间 — **指数** |
| 维护成本 | 模板越多越好，维护线性增长 | library 是约束面而非模板，**1 个高质量 library + 1 个能干的 AI ≈ 1 万种输出** |
| 确定性 | 高（每次出图在模板允许范围内） | 低（每次都不一样，需要 validate + look + 4-checkpoint 控质量） |
| 品牌一致性 | 模板本身是一致性的（视觉同源） | library 是一致性的（结构同源，AI 在结构内自由） |
| 失败模式 | 找不到合适模板 | AI 自由发挥超出约束 / 落入不当模式 |

**产品哲学含义**：open-pencil fork 不是"AI 帮你填模板"的工具，而是"AI 在品牌约束内做设计"的合作者。这个区别决定了产品形态——必须靠 4-checkpoint 把 AI 的自由拉回用户可控范围，必须靠 validate 做硬规则校验，必须靠 look 做视觉自审，必须靠 library .fig 把"品牌"做成可携带资产。

**这条路在国内没人走过**：右下"封闭模板 + 营销图专门"是红海，稿定/美图/Canva 已经卷成血海；左上"开放画布 + 通用 AI 生图"是位图世界，与结构化图形无关；右上"开放画布 + 营销图专门 + 约束型"是空白象限。open-pencil fork 是右上象限的唯一玩家。

但空白不等于赢。**这个范式的产品代价是"不可预测性"**——用户每次生成都不一样，必须有强约束机制把它拉回可控。这正是 4-checkpoint + validate + look + library schema 这套东西存在的理由。

### 2.2 为什么基于 open-pencil（fork 策略）

#### 选型依据

选型不源于商业可行性（.fig 读写、Figma API 兼容、MIT、Tauri/Web 双端是**选了之后顺带获得的使能条件**），而源于一个统一属性：**open-pencil 是一个 AI-friendly 的、可寻址的 SceneGraph，渲染在一块与用户共享的无限画布上。** 它恰好补齐了营销图 Agent 需要的三块能力：

1. **AI-friendly 数据模型（最核心）**——上游已经为 AI 操作场景专门设计了 `render` / `describe` / `batch_update` / `replace_id` / `look` 等工具，AI 学习曲线被抹平。
2. **多图层排版编辑能力**——节点可寻址、可精修、可替换；`describe` 把节点树读回给 AI，`batch_update` 精修 props，`replace_id` 替换 section。
3. **无限画布作为视觉化交互界面**——AI 工作在哪用户就看见哪；`画布选区` 是用户输入，`look` 是 AI 自审。

反例对照需要更精确的边界：
- **模板工具（Canva Magic Studio / 稿定 AI）** 也支持"约束下 AI 自由生成"——Brand Hub 锁品牌色/字体/Logo，AI 在约束内生成。Canva 不是反例；它的限制是**section 结构、文案布局、视觉构图受模板骨架钉死**，AI 在模板内是填空，不是真正的结构自由发挥。
- **生图 API**（GPT-Image / Recraft）给的是受控位图——可以控制构图/风格/文本，但**不可分解为可编辑组件**。位图 vs 结构化图形的本质区别是可编辑性。
- **Canvas 类编辑器**（Fabric / Konva）的对象模型也是声明式的，但**没有 AI-friendly 工具链**——AI 要从头学会全部底层 API 才能完成"画一张营销图"这种高层任务。

**三块能力同时具备的基座稀缺**——任何一项单独都不稀缺（声明式数据模型 Canvas 也有、AI-friendly 工具链某种程度 Figma 也有、共享画布其他工具也有），但三者**同时具备**才是稀缺。

#### 三层架构与 fork 触达面

```
┌─ Layer 3: 应用壳（src/）── fork 自持 + 追踪 vue SDK
│  ┌ Chat UI / L3 工作台 / Marketing Dialogs ─── fork 自持
│  │ Agent 的神经：elision / media-tool-results / system-prompt-marketing
│  └ 调工具
├─ Layer 2: 引擎 + 工具（packages/core，44,771 行）── 必追踪
│  ┌ editor / canvas / io / layout / text / vector / color / ...
│  ├ tools/marketing/（fork 在 core 内自写）
│  │   ├ setup.ts / validate.ts / library.ts / look.ts / brief.ts
│  │   ├ restore.ts / registry.ts / clone.ts / vision.ts
│  └ tools/image-gen/ / tools/stock-photo/（fork 在 core 内自写）
│  调节点
├─ Layer 1: 数据模型 + 文件格式（底层）── 必追踪
│  ┌ scene-graph（4,163 行）── 数据模型
│  ├ fig（7,099 行）+ kiwi（2,321 行）── .fig 互通
│  └ pen（1,008 行）── .pen 解析

并行旁路：
  vue（17,775 行）── 完整追踪级别，100+ fork 文件 import
  dom-css/browser（2,806 行包内的子路径）── 最小切片，1 处 import
  cli / mcp / demos / docs ── fork 0 import，可砍
  ACP 子模块 / collab 子模块 ── feature flag 暂存
```

**fork 实际触达面**——`src/` 触达的 upstream 包（事实调研）：

| 包 | src/ 中的 import 数 | 用途 |
|---|---|---|
| `@open-pencil/vue` | 29 import sites | UI 框架 + i18n (×13) + 编辑器上下文 + headless primitives |
| `@open-pencil/scene-graph` | 30+ 类型 + 1 value | 类型来源（SceneGraph / SceneNode / Fill / Variable 等） |
| `@open-pencil/dom-css/browser` | 1 value | `browserHTMLToSceneGraph`——驱动"打开 .html" + "CodePanel 导入 HTML" |
| `@open-pencil/core` | **0** | （通过 vue re-exports 间接拿） |
| `@open-pencil/fig` / `kiwi` / `pen` / `mcp` / `cli` | 0 | （fork app 不直接 import） |

**`packages/core/src/` 触达的下层：**

| 包 | core 引用 | 触达模块 |
|---|---|---|
| `@open-pencil/scene-graph` | 140+ 文件 | 几乎所有模块 |
| `@open-pencil/fig` | 12 文件 | clipboard / kiwi/fig/import / vector / io/formats/fig/* |
| `@open-pencil/kiwi` | 7 文件 | clipboard / kiwi / kiwi/fig/import / io/formats/fig/export |
| `@open-pencil/pen` | 3 处 | io/index / io/formats / index（"打开 .pen 文件"） |

#### fork vs 自持决策（按追踪强度分级）

事实调研见 §附调研。分类如下：

**① 必追踪（深度依赖）**

| 包 | 规模 | fork 触达 | 决策理由 |
|---|---|---|---|
| `scene-graph` | 4,163 行 | 30+ fork 文件 import 类型 | 数据模型基础，不可分割 |
| `core` | 44,771 行 | marketing 工具 + automation path 重度使用 | marketing 工具所在地，不可能不 fork |
| `vue` | 17,775 行 | **完整追踪级别**——100+ fork 文件 import，几乎所有 UI | 硬砍需要重写所有 UI 组件 |
| `fig` | 7,099 行 | core/clipboard 内部用，fork 间接用 | .fig 互通是产品卖点 |
| `kiwi` | 2,321 行 | fig 的底层依赖 | 无法单独去掉 |
| `pen` | 1,008 行 | core 间接用（"打开 .pen 文件"） | v1 可砍——见待评估 |

> **修正原 §2.2 误判**：`packages/vue` 列为"保留/移植进自有壳"是错的——fork 对 vue SDK 是**完整追踪级别**。"自持"的边界应理解为"fork 这边自己写 chat UI / marketing-specific dialog"（这是真的），而 vue 的 property panel / toolbar / layer tree / variables dialog 是**fork 大量使用**的。

**② 最小切片（保留子路径）**

`packages/dom-css`（2,806 行）——fork 在 `src/app/document/io/dom.ts:2` 唯一 import `browserHTMLToSceneGraph`，驱动"打开 .html 文件"和"CodePanel 导入 HTML → 可编辑画布"。其他子能力（JSX runtime / Tailwind 适配 / headless CSS runtime / DesignDOM 序列化）fork 0 import。**最小切片到 `/browser` 子路径**，其他 95% 子能力可大幅瘦身。

> **修正原 §2.2 误判**：把 `dom-css` 列为"砍掉"是错的。

**③ 可砍（fork 0 import）**

| 包 | 规模 | 砍掉理由 |
|---|---|---|
| `cli` | 2,454 行 | fork app 0 import；CLI 服务 CI 自动化场景，与营销产品不直接相关 |
| `mcp` | 1,048 行 | fork 自家 `src/app/automation/bridge/*` 用 WebSocket 独立实现 RPC，不基于 `@open-pencil/mcp` |
| `demos` | 0 源码 | 仅 upstream 工具栏视频资源 |
| `docs` | 781 .md | VitePress upstream 营销首页叙述与 fork 营销 Agent 产品定位不同 |

**④ feature flag 暂不启用（独立子模块，不是 chrome）**

- **ACP（Agent Client Protocol）**——`src/app/ai/acp/` 4 文件 + `packages/core/src/constants.ts:141-185` 的 `ACP_AGENTS` 定义。Marketing 用 `DirectChatTransport`（`src/app/ai/chat/transports.ts:202`），ACP 路径是另一支 `createACPTransport`。Marketing 完全不接 ACP。**v1 不启用，但保留代码**——未来企业版"外部 AI 接入本产品"可能是入口。
- **collab（Y.js + Trystero 实时协作）**——`src/app/collab/` 8 文件 + `src/components/CollabPanel/` 7 文件 + `src/app/editor/canvas/collaboration-awareness.ts`。**marketing 0 命中**——完全正交。**v1 不启用，但保留代码**——§2.6.3 多人协作 library 版本化时可能是必要的。

这两个不是"upstream 编辑器 chrome"（property panel / layer tree / toolbar），而是独立的、功能完整的子模块（外部 agent 桥 / 实时协作）。**未来启用需自实现或迁移**（不能直接复用 upstream，sender / 协议不同）。

**⑤ 完全自持（fork 这边自己写）**

| 模块 | 位置 |
|---|---|
| Chat UI（ChatInput / ChatPanel / ChatMessage） | `src/components/chat/` |
| Marketing dialogs（MarketingConfigBar / MarketingLibraryDialog / ProfileGalleryDialog） | `src/components/chat/` |
| Agent 的神经（elision / media-tool-results / system-prompt-marketing） | `src/app/ai/chat/` |
| L3 工作台 | `src/components/L3/` |
| Automation RPC 桥 | `src/app/automation/bridge/*` |
| Library .fig 生成器 | `tools/marketing-library/src/generate.ts` |

> **nuance**：营销工具（setup/validate/library/look/brief/restore/registry/clone/vision）虽然 fork 在 core 包内实现，但**追踪的是 core 包本身**——fork 必须追踪 core 才能让营销工具运行。这是"在 fork 必追踪的包内自写"，不是"完全脱离 core 自持"。

#### 营销工具的产品级解耦事实

事实调研发现的关键产品洞察，**直接影响 §2.6 演化路径的可行性**：

1. **Marketing tools 完全不用 ACP / collab / variables**——`packages/core/src/tools/marketing/` 下 grep `acp|ACP|collab|useCollab|yjs|y-protocols|trystero|variable|Variable|boundVariables` 几乎 0 命中（唯一命中是 error message 里的"variable height"字面量）。**Library .fig 解析刻意脱离设计系统变量**：`clone.ts:22, 93` 主动拒绝带 `boundVariables` / `variableModes` 的节点（"variables and nested instances are not supported in library assets"）；`casual_v1` profile 的 `#FF6B35` 是 TEXT 节点 markdown 里的字符串字面量（`tools/marketing-library/src/generate.ts:241-255`），不是 variable binding。

2. **Marketing mode 不导出图片**——`export_image` / `export_svg` / `export_pdf` 都在 `EXTENDED_TOOLS` 而**不在 `CORE_TOOLS`**；marketing mode 只用 CORE_TOOLS（约 30 个），且系统 prompt 显式禁用 export（`system-prompt.md:214`："🚫 Never use `export_image`"）。**用户导出图走菜单 / PropertiesPanel / `ExportSection.vue`**（用 Editor Store API + `useExport()` Vue composable），与 AI 工具完全不共享代码。**导出是用户后续操作，不是 agent 任务的一部分。**

**产品含义**：
- §2.6.3 多人协作 + library 版本化如果要支持"色彩 token 在 library 内传播"，fork 这边需要**自己实现或迁移** variables 系统，不能依赖 upstream 的实现路径——变量被 marketing 主动排除在外是当前事实，但 Path A 的"library 是品牌资产"演化可能需要重新引入。
- §2.6 提到的"按类型批量导出"是用户后续操作，**不需要重设计 agent 工作流**——marketing agent 不必关心导出，导出走编辑器路径。

#### 待评估的产品决策

下列项在事实调研后**仍需产品决策**，不在本节断言：

1. **`packages/pen` 是否保留** —— v1 可砍（fork 营销场景用户不太需要 .pen 解析）。保留条件：未来要"营销图设计导出 .pen 给 Pencil.dev 复刻"。
2. **ACP 反向启用条件** —— feature flag 暂不启用，保留代码。启用条件：是否做"外部 AI 接入 fork 引擎"的企业级能力（需 fork 自实现 MCP sender）。
3. **collab 反向启用条件** —— feature flag 暂不启用，保留代码。启用条件：Path A §2.6.3 多人协作 library 何时真正要做（需 fork 自适配 Trystero + Y.js 同步）。
4. **`packages/fig/instance-overrides.ts:64` 嵌套 INSTANCE 丢失映射** —— upstream 已知问题未解决。决策点：fork 是否要 fork 自实现修复。
5. **Vue SDK i18n 8 语言与 fork zh-cn 同步** —— fork 使用 `useI18n` 但 marketing 文案（"需求单"、"内容区"、"AI结论区"）未必翻译到所有 8 语言。决策点：是否要把 fork 的 marketing 文案翻译到 8 语言。
6. **每月合入节奏的自动化** —— 文档策略，未建立自动化流程。决策点：是否要 CI 监控 upstream master 变动并通知。

#### 运营纪律

- **合入节奏**：每月评估一次 upstream `master` 改动，按需 cherry-pick 引擎层（core/scene-graph/kiwi/fig/pen）的 bug fix 与性能优化；vue SDK 选择性追踪（关键 API 改动必合入，普通 UI 调整延后）。
- **回归基线**：fork 自维护，覆盖营销工具（68+ 单测已就绪）+ 视觉回路 + elision/rewrite + prepareCall/prepareStep 真实钩子（§3.2-6 已识别盲点）。
- **反向成本**：fork 是孤儿分支，upstream CI 不验证 fork 代码，upstream bug fix 不会自动覆盖 fork——**自维护回归是唯一保障**。

一句话：**引擎 + 数据模型 + UI SDK 完整追踪；dom-css 最小切片；ACP/collab feature flag 暂存；fork 0 import 的包可砍；chat UI / marketing dialog / Agent 神经 / L3 工作台完全自持。** Marketing 工具刻意与 variables / export 工具解耦——这是产品哲学的一致性，不是 bug。

### 2.3 做对的方向

**1. 约束驱动设计观**

营销设计 = 约束下的优化问题，而非自由创作（`l2-agent-mode.md` §1.1）。尺寸/品牌/内容/平台四类约束先锁定再创作，是营销场景区别于通用 UI 设计的正确抽象。

**2. 协作式而非自主式**

Checkpoint（CP1-CP4）把风格、骨架、图片来源、终检交给用户确认，避免一次跑到底的不可控。**这条在 Path A 范式下尤其关键**——AI 自由发挥的不可预测性必须靠 4-checkpoint 拉回用户控制范围。这不是"AI 不行"的妥协，是产品哲学的体现。

**3. references 解耦心智模型**

"references 是输入、id 是输出"，一句话可述、无状态推断、重试不污染。工具接口层面的好设计，也带动了 L1/L2 一致的资源抽象。

**4. Library .fig 单一载体**

type（硬约束）/ profile（软上下文）/ component（锚点物化）/ reference（用户勾选注入）四区正交，用户可编辑、可分享、= 品牌包。**这是 Path A 的核心资产形态**——品牌一致性从"模板同源"变成"library 同源"。从"改代码发版本"走到"改文件"，是正确的一步。

**5. 视觉双通道显式模式**

通道 A（主模型看图，无损）与通道 B（独立视觉模型，省上下文）显式二选一，拒绝隐式能力探测——失败模式清晰（只有"凭证未填/错"两种）。

**6. 方法论纪律**

"可判定性划分"（能写进代码的对比进代码，其余进 prompt）、"视觉 advisory、确定性校验唯一裁判"、错误目录 + 实测方法论——产品即测试的文化沉淀。

**7. "约束 + AI 自由"vs "模板 + AI 填充"的范式选择**

这是产品哲学层面的核心取舍：open-pencil fork 不与 Canva / 稿定 / 美图比模板数量，而是用 library 的约束力 + AI 的解空间换"无需海量模板"的产品形态。**1 个高质量 library + 1 个能干的 AI ≈ 1 万种输出**，vs 1 万个模板 × 3 个字段 ≈ 3 万种输出。两者数量级相似，但前者的"输出多样性"远高于后者（后者在每个模板内是同质的）。

这个选择让产品在红海里找到了范式空白，但也让产品必须承担"AI 自由发挥"的不可预测性成本——4-checkpoint / validate / look 是为此付出的工程代价。

### 2.4 产品风险

| # | 风险 | 说明 | 建议 |
|---|---|---|---|
| P1 | **视觉回路已验证，但结论未落档、扩展未回归** | 核心假设（视觉回路提升产出质量）已由用户实测确认有价值；但第 4 轮回归结论未写回 V0 文档，通道 B、素材理解、lint 降噪等依赖该结论的扩展也未经同一回归基线验证 | 把实测结论落档，并把通道 B/素材理解纳入同一回归基线后，再决定后续功能扩展 |
| P2 | **CP1 文字迷宫** | 2-3 个风格方向用纯文本呈现（"风格词 + hex + 构图"），效率低于 4 宫格缩略图对比。**这是范式与 UX 的错配**——产品哲学是"用户有判断力"，但 UX 没给判断工具 | CP1 改为 4 宫格缩略图对比 + "默认方向 + 一键接受"逃生口；用图传达视觉选择 |
| P3 | 默认 imageGen baseURL 硬编码 `dmxapi.cn` | 单中转商绑定，可用性/合规不在产品手里（`storage.ts:65-68`，**且 core 层 `providers.ts:68` 也硬编码了同样默认值**——双源真相需同步） | 默认留空 + 首次引导；core/app 双源同步默认值 |
| P4 | 62MB 字体进 `public/` | web 首屏与打包体积硬伤，只服务 CJK 营销场景 | 延迟加载或仅桌面打包 |
| P5 | playground 是参考项目，非并行仓 | `gpt_image_playground` 是开发生图工具时的参考项目（非用户自有并行项目）：`normalizeDimensions` 移植自其 `size.ts`、多图 `image[]`/`[image N]` 引用约定在那里验证。**风险不是"两仓漂移"，而是参考验证未必等于 app 内验证**——`l1-image-gen-optimize.md:383` 本就要求落地后复验 7 个场景，此项仍未完成 | 在 app 内跑场景验证表（多图引用、编辑含目标自身、`asImage` 渲染参考） |
| P6 | **库加载失败 = 品牌规范静默消失** | `library.ts:71-83` 的 fetch 无超时/无 retry/无 AbortSignal；失败后 chat 侧无错误提示，AI 在 Phase 0 退化为 `materialType: "custom"` + 裸 w/h，**品牌栏 / CTA 锚点 / profile 风格指导全部消失**（见 §2.5.4）。产品"开箱即品牌"的承诺在网络失败时被静默打破 | ① fetch 加超时（5s）+ 一次性自动 retry；② overlay 失败时显式标记"约束面已丢失，本图为无品牌图"，不要静默退化 |
| P7 | **需求单 = 概念成立，介质失败** | 概念层成立：verbatim 原文（反幻觉）、素材意图仲裁、AI结论区跨 session 记忆（文档即状态）都是文档自己识别的真实痛点。**失败点是实现**：a) 介质错误——需求单本质是表单，却做成画布上手绘 frame，对"不懂设计的运营"低可发现、高摩擦；b) 漏斗缺口——prompt L150 规定 AI "never create it yourself"（连提议都不允许），用户必须自己发现"新建需求单"按钮 + 理解三区约定 + 正确填写；c) append-only + verbatim 刚性——结论无版本、无"后写者胜" | 最低成本修复：允许 AI 提议（"我可以把这些整理成需求单，要吗"）而非静默创建——一条同时修掉漏斗与发现；再考虑表单式填充替代画布手绘 |
| P8 | **profile 自动采用是"计划漂移 + 任意兜底"的双重缺陷** | `l2-resource-library.md:29` 规定 profile 选择权 = "**AI 推荐 + CP1 人确认**"，但实现是 setup 静默 auto-pick 后直接注入 system prompt overlay 当 source of truth（`setup.ts:124-125` → prompt L162），没有任何确认门；CP1 的"确认"是隐式的——方向选项已基于 active profile 生成，用户选方向不等于确认 profile。更硬伤的是兜底 `(applicable ?? profiles[0]).id`（`setup.ts:125`）：无 profile 匹配类型时静默套用第一个 profile。默认库当前仅 1 个 profile 未暴露，但 §2.6.3 自动沉淀区将来产出多版本 profile 后必炸 | ① 删 `profiles[0]` 兜底，无匹配 = 无 profile（app 侧 fallback 已存在）；② 取消 setup 静默 auto-pick，profile 完全由用户在 `MarketingConfigBar` Profile chip 显式选择（"是否使用"与"使用哪个"两个决策都归用户），未选择时跑无 profile 流程；③ `l2-resource-library.md:29` 的"AI 推荐 + CP1 确认"流程留待未来，按需启用 |

### 2.5 system-prompt-marketing.md 的产品分析

390 行 / 33KB 的 prompt 是这条分支最重、最集中的"产品陈述"。它同时暴露了产品内核、用户定位、能力边界与若干未写进文档的判断。证据点以行号标注。

**2.5.1 prompt 呈现的产品内核 = "约束执行器 + 反幻觉护栏"，不是"创意生成器"**

全文语气是契约而非教练：Anchor STRICT（L174-183）、verbatim 原文（L142）、`¥__`/`X折` 占位符（L198）、禁止虚构价格/日期/品牌（L197-198）、素材理解与 AI结论区 append-only（L145/148）。

产品对 AI 的价值定位是"不出错"，创意上限被主动封在 2-3 个文字方向里。这对外包型运营是对的取舍——**但也等于承认产品卖的不是 AI 审美，而是 AI 的执行纪律**；一旦用户对"独特创意"有期望，落差会很明显。

**与"约束 + AI 自由"范式的关系**：这条范式允许 AI 在约束内自由发挥，但 prompt 显然更偏向"约束执行器"——把 AI 锁在"准确不出错"的位置，而不是"有想法"。**这是个未明示的张力**。如果产品哲学是"约束 + AI 自由"，prompt 应该给 AI 更多的风格建议空间（"这个 section 的色彩节奏如何走"），而不是单纯禁止虚构。建议下一版 prompt 在"反幻觉"和"风格表达"之间找到更好的平衡点。

**2.5.2 渲染引擎的能力债被转嫁成 prompt 成本——这是最大的"产品-工程"交叉杠杆**

大量行数在教"这个画布引擎的坑"，而非设计知识："2+ 子 Frame 必须有 flex"（L41）、"fill 依赖 flex 父"（L43）、"无 margin，用 padding 包一层"（L53）、"Text 无 color 不可见"（L31）、"justify 没有 evenly"（L27）、"emoji 渲染成 □"（L85）、"calc 禁 Math. 前缀"（L85）…… 这一层约 85 行 JSX DSL 与 base `system-prompt.md`（573 行）近逐字重复（Rendering/Props/Layout/Corner radius/Spacing/Typography/Prohibited），营销版仅差分：字体锁定 `Alibaba PuHuiTi`（L71）、Prohibited 扩一句。**两个 prompt 单一事实源缺失，DSL 一处修订两处漂移是必然**。

产品含义有两层：a) 引擎每缺一个宽容能力（margin 别名、flex 自动推断、文本默认色），就永久兑换为 token 成本 + 模型遵守失败概率；修引擎 = 同时砍 prompt、降失败类、降每轮成本，是这条分支 ROI 最高的还债点。b) "结构正确优先于审美"被显式固化——prompt 整章教 flex/wrap/4px 网格，而"这图好看吗"只留给 `look` 的 advisory 通道（L250）。

**与 §2.1 范式的关系**：这是"约束 + AI 自由"范式的工程代价——为了实现"AI 自由发挥"，必须把引擎的能力边界精确写进 prompt，否则 AI 会自由发挥出引擎不支持的形态。修引擎 = 同时降 prompt 复杂度 + 提 AI 自由空间 = ROI 最高的产品级还债。

**2.5.3 CP1 文字迷宫是范式与 UX 的错配**

prompt L185-202 规定 AI 在 CP1 必须给 2-3 个**纯文本**方向（风格词 + hex + 构图）。曾有诊断把这归咎于"把设计决策权压在非设计师身上"——**这个诊断对了一半，错了一半**：

- **对的一半**：纯文本形式传达视觉选择效率低。运营看到"#FF6B35 活力潮流"和"#111827 高端极简"，从文字到"这图大概长什么样"的心智转换成本极高。
- **错的一半**：决策权不在"非设计师能不能选"，而在"用错工具做对的事"。CP1 的设计哲学是"用户有判断力、只是缺工具"——只要给对工具，运营能选出来。**4 宫格缩略图对比 + 默认接受 + 一键跳过**才是范式正确的实现。

**与 CP3 的对比（重要）**：早期版本曾把 CP3 的"逐 section 决策"和 CP1 的"文字方向"放在一起批评"把决策压在非设计师身上"。**这个归类错了**。CP1 和 CP3 是两类完全不同的决策：

| 决策 | CP1 选方向 | CP3 选图片来源 |
|---|---|---|
| 决策内容 | 美学判断（"我喜不喜欢这个风格"） | **工具/资源判断**（"这张图用什么来"） |
| 非设计师的能力 | **缺乏传达工具**——文字 vs 图 | **有判断力**——"产品图用真的，背景用生成的" |
| 产品姿态 | AI 给 3 个方向让用户选 | AI 让用户**主动接入特定素材** |
| 范式含义 | 让用户用低效工具做高密度决策 | 让用户**控制 AI 的素材来源**——这是 Path A 的关键 |
| 应改/应留 | **应改**——升级为 4 宫格缩略图 | **应留**——这是产品特性 |

**CP3 的正确理解见 §2.5.5**。

**2.5.4 库加载失败 = 品牌规范静默消失**

L160-162：类型区不可用时"ask user to reopen library dialog, or fall back to custom（裸 w/h）"。若默认库 fetch 失败，品牌栏/CTA 锚点/profile 风格指导全部消失，产品瞬时退化为"自定义裸尺寸"。

**与"约束 + AI 自由"范式的关系**：这是范式的失败兜底——当约束表面（library）丢失时，"约束"变成了"无约束"，AI 自由发挥没有任何品牌锚点。**产品"开箱即品牌"的承诺在网络失败时被静默打破**。这不是"AI 变笨"的问题，是"约束被偷走"的问题——AI 退化到无约束状态，用户感知不到。

**运行时对 fetch 成功的依赖被当边角处理，但它是产品"开箱即品牌"承诺的静默断点。** 详见 §2.4 P6 的修复建议。

**2.5.5 CP3 是"内部素材接入点"的产品特性**

prompt L218-222 规定每个需要图片的 section 在动手前**逐个发文本询问**："Concrete products/scenes → prefer stock_photo" / "Abstract concepts/illustrations → generate_image" / "User-provided assets → use them directly"。曾把这当作"把工具决策压在非设计师身上"。

**重新定位**：

CP3 不是"决策负担"，是**产品设计的主动接入点**。它显式地把"图片来源选择"留给用户，对应三个产品级考虑：

1. **成本控制**：stock_photo 走 Pexels/Unsplash（免费或低成本），generate_image 走中转商（按图计费）。用户每次用哪个，决定了图的成本结构。**把成本决策交给用户，是 Path A 的合理姿态**——AI 不应该替用户烧钱。

2. **品牌真实性**：运营对自己品牌的素材有强烈的"哪些是真商品、哪些是 AI 生成的"的判断需求。**这是品牌资产的一部分**——库里的 stock photo 是可以接受的泛素材，但具体商品图必须是真实的、经过品牌方授权的。CP3 的 per-section 询问让用户能说"这张必须用我提供的图"。

3. **未来 Path A 演化**：**这是关键**。Path A 的下一步演化必然是"内部素材库"——大公司/品牌方会有自己的商品图库、签约摄影图库、合规素材库。这些库不是 Pexels 那种公网 stock，而是企业内部素材。**CP3 的 per-section 询问正是接入这种内部库的天然入口**——用户说"用我们库里的 X 商品图" = CP3 的回答变成了一次具体素材指定，而不是"stock 还是 generate"二选一。

**产品演化路径**（详见 §2.6.2）：
- v1（当前）：CP3 = stock_photo vs generate_image vs 用户提供的图
- v2：CP3 = stock_photo vs generate_image vs 内部商品库（库里有具体 ID 可选）vs 用户提供的图
- v3：CP3 = 用户/AI 共同决策（AI 推荐来源，用户覆盖关键素材）

**结论**：CP3 应保留逐 section 决策形式——它是 Path A 的天然内部素材接入点，不应被弱化或全局化。

**2.5.6 Patterns 硬编码进 prompt，与"库体系可扩展"的故事不一致**

Price Tag / Process Flow / Grid / Brand Footer（L295-382，约 65 行 JSX）是内置模板经济，但锁死在 prompt 里。资源库重构让 type/profile/component/reference 全部用户可编辑，唯独"创意语法"（patterns）不可——brutalist/极简等非 4px 网格风格会被内置 pattern 反向压制。

**与"约束 + AI 自由"范式的关系**：这是范式的内部矛盾——产品宣传 library 可扩展（用户改 .fig 就行），但 JSX patterns 锁死在 prompt 里（用户改不动）。**这两个故事不一致**。在 Path A 下，patterns 应该和 profile 一样下沉到 library 里——每个 profile 携带它偏好的 patterns，brutalist profile = 不同的 JSX 模板；用户切 profile = 切 patterns。

**机会**：patterns 下沉到库（profile 携带或用户自建），才与"用户可扩展"一致。这是 Path A 演化的一部分，详见 §2.6.4。

**2.5.7 步数经济学硬编码进 prompt，对用户不可见**

50 步/消息、checkpoint 重置、section 填充分摊 5-8 步（L386）。成本纪律是好的工程，但"质量随浪费步数优雅衰减到悬崖"的产品行为对用户不可见、不可配置。

**与"约束 + AI 自由"范式的关系**：步数限制是"AI 自由"的硬约束。50 步 = 7 个 section × 5-8 步 + 一些 buffer。如果 AI 自由发挥超过 50 步，要么被截断（"Continue where you left off"），要么草草收尾（`_warning` 即收尾）。**用户感知不到这个约束的存在**，直到被截断那一刻。

**建议**：在 chat UI 上显示"当前 run 已用 23/50 步"，让用户知道 AI 在哪里。这样用户能判断"我该让 AI 继续还是就此打住"。

**2.5.8 profile 自动采用是"计划漂移 + 任意兜底"的双重缺陷**

`l2-resource-library.md:29` 规定 profile 选择权 = "**AI 推荐 + CP1 人确认**"，但实现是 setup 静默 auto-pick 后直接注入 system prompt overlay 当 source of truth（`setup.ts:124-125` → prompt L162），没有任何确认门；CP1 的"确认"是隐式的——方向选项已基于 active profile 生成，用户选方向不等于确认 profile。

更硬伤的是兜底 `(applicable ?? profiles[0]).id`（`setup.ts:125`）：无 profile 匹配类型时静默套用第一个 profile。默认库当前仅 1 个 profile 未暴露，但 §2.6.3 自动沉淀区将来产出多版本 profile 后必炸。

**与"约束 + AI 自由"范式的关系**：profile 是约束面的核心组件——它决定 AI 自由发挥的"风格坐标"。如果 profile 被静默选定（不是被显式选择），约束面的"约束"就变成了"AI 替我做的约束"——这与"用户掌控约束"的范式哲学相悖。

**建议**：详见 §2.4 P8。删 `profiles[0]` 兜底 + 取消 setup 静默 auto-pick；profile 完全由用户在 `MarketingConfigBar` Profile chip 显式选择（"是否使用"与"使用哪个"两个决策都归用户），未选择时无 profile 注入；`l2-resource-library.md:29` 的"AI 推荐 + CP1 确认"流程留待未来，按需启用——触发条件是用户明确反馈"想让 AI 帮我推荐"、库内 profile 数 ≥ 3 且无明显最优、或 CP1 阶段用户主动询问。在那之前，profile 是纯用户驱动资产，与产品"用户掌控约束"的范式哲学一致。

**2.5.9 look 驱动的修复循环无次数上限（非无限循环，但会不收敛震荡）**

image-gen 验收循环有硬上限（L229 max 2 attempts）、`_warning` 即收尾（L386）、step budget 兜底——所以不会挂死。但 CP2/CP4 门禁的 look→fix→look 循环**没有次数上限**（L212/L250 "fix anything obviously wrong before presenting"），而 look 是 advisory 的、视觉模型会幻觉，存在"反复报同一问题 → 反复修 → 不收敛 → 烧完 run 预算"的坏局面；通道 A 又是主模型自审（自己生图自己打分），自我验收偏差在此场景放大（通道 B 独立模型恰可缓解）。

**与"约束 + AI 自由"范式的关系**：look→fix→look 是 AI 自由发挥的"质量回路"。但 look 是 advisory 的、不是约束——它能给建议，但**不能强制收敛**。如果 look 没有次数上限，AI 会陷入"反复修同一问题"的循环，浪费步数预算。

**建议**：给 look 驱动修复加显式上限（每 section 最多 2 轮 look 后仍有问题就带清单呈现，镜像 max-2 模式）；验收类 look 优先通道 B。

### 2.6 Path A 的关键演化路径

按"从约束表面 → 用户资产 → 多人协作"三步走：

**2.6.1 库沉淀机制（v1 → v1.5）—— 把"自带 library"变成"用户产出 library"**

**现状**：library.fig 是项目组自带的资源（`public/default-library.fig`，32.5KB），用户只能"自带"——上传自己的 .fig 或下载项目组的默认库。**用户做出好的营销图后，无法把它变成可复用 library**。

**问题**：护城河在 library 文件格式（见 §2.1 范式分析），但如果 library 永远是项目组产的，**用户用得越多，护城河越不变**——他们永远在用项目组的库，不产出自己的库。

**修复路径**：
- 在营销图完成后，给用户一个"保存为 library entry"按钮
- 提取 root frame 的 layout、色板、字体锚点、CTA 结构 → 生成新的 library .fig section
- 让用户能"另存为 library"自己的设计，等于把"我做过的图"沉淀成"我品牌的一部分"

**这是 Path A 的命门功能**。没有这个功能，library 是项目组的资产；有了这个功能，library 是用户的资产——护城河才真正长在用户那里。

**2.6.2 内部素材库接入（v1.5 → v2）—— CP3 的真正演化**

**现状**：CP3 让用户在 stock_photo / generate_image / 用户提供的图之间选。

**演化路径**：
- v1.5：CP3 增加"内部库"选项——用户可以指定一个内部图库 URL（比如公司商品库），AI 可以从这个库检索
- v2：CP3 接受具体素材指定——用户说"用 X 商品图，库 ID = 12345"，AI 调专用工具 `use_internal_asset({asset_id})` 直接拿到图
- v2.5：内部库接入 SSO、权限、审计——企业级素材管理

**为什么 CP3 是天然入口**：CP3 是产品中唯一显式让用户"指定图片来源"的环节。把"内部库"作为 CP3 的第四选项 = 把"用户控制素材"的产品哲学贯彻到底。**这是 Path A 与"模板 + AI 填充"产品的最大差异化**——后者只能从公网 stock 选，**没法接入用户的私有素材**。

**2.6.3 多人协作与 library 版本化（v2 → v3，远期）**

**现状**：library.fig 是单文件、单用户上传。**没有任何版本管理**。

**演化路径**：
- v2：library.fig 支持 .git 化版本管理——用户在 GitHub/GitLab 上维护 library 仓库，每次 pull = 更新品牌资产
- v2.5：library 内每个 entry 有 hash 标识，支持版本回滚
- v3：多人在线协作编辑 library（类似 Figma Design 的设计系统协作）

**与 Path A 的关系**：品牌资产是"多人协作的产物"——一个公司不可能只有一个设计师维护品牌。多人协作是 Path A 的必然演化。**library 文件格式 + 版本管理**是 Path A 规模化必经之路。

**2.6.4 patterns 下沉到 library（v1 → v1.5，并行）**

**现状**：JSX patterns（Price Tag / Process Flow / Grid / Brand Footer，约 65 行）锁死在 prompt 里。**用户改不动**。

**演化路径**：
- 把 patterns 作为 library 的第 5 区（`Patterns`）—— 每个 profile 携带它偏好的 patterns
- 用户切 profile = 切 patterns（如 brutalist profile 用粗边框大字体，minimalist profile 用细线大量留白）
- patterns 可被用户增删改——library 文件可编辑

**与"约束 + AI 自由"范式的关系**：当前 patterns 锁死意味着 AI 自由发挥只能在 4 个内置 pattern 里——这不是"自由"，是"被 4 个模板钉死"。把 patterns 下沉到 library = 真正实现"约束面由用户定义、AI 在约束内自由发挥"。

### 2.7 结论

**范式层面**：open-pencil fork 选择了"约束 + AI 自由"作为产品哲学，与"模板 + AI 填充"是范式区别。这条路在国内没人走，是空白象限。**但范式的代价是"AI 自由发挥的不可预测性"**，必须靠 4-checkpoint + validate + look + library schema 这套机制把不可预测性拉回可控。

**当前产品成熟度**：分支方向正确（67 commits、68 单测、library schema + 4-checkpoint + 视觉回路 + 约束方法论都已成型），但距离开箱可用仍有 4 个结构性缺口：① CP1 文字迷宫升级为缩略图对比；② 库沉淀机制（用户能产出 library）；③ 内部素材库接入（CP3 的未来）；④ 多人协作与 library 版本化（远期）。

**短期不要做**（来自产品反馈）：
- ❌ 模板系统——Path A 不需要
- ❌ 批量按类型导出与平台规格裁切——现有 PNG/JPG/WEBP/SVG/PDF 通用导出短期可承接
- ❌ 生图进度条——batched call 设计（`system-prompt-marketing.md:120` "generate all needed images in one batched call"）+ chat tool 卡已显示 running 状态，per-image 进度与产品形态不匹配
- ❌ 多品牌——v1 一库=一品牌是正确决策
- ❌ 改 CP3 为全局默认——CP3 是产品特性不是缺陷

**短期要做**（按优先级）：
1. **CP1 升级为 4 宫格缩略图对比 + 默认接受**（P2 风险）
2. **库沉淀机制 v1**（路径 §2.6.1）——"另存为 library entry"按钮
3. **修 4 个工程缺陷**（见 §三.2：validate 假阳性 / registry 陈旧 / restore 深度 / profile 双源）
4. **修 P6 + P7 + P8 三个产品风险**（库加载失败静默退化 / 需求单介质失败 / profile 自动采用漂移）
5. **决定字体与默认 API 的产品化策略**（P3 + P4）

**中期要做**（Path A 演化）：
- 内部素材库接入（§2.6.2）——CP3 第四选项
- patterns 下沉到 library（§2.6.4）
- library 版本化（§2.6.3 的 v2 阶段）

---

## 三、工程视角

### 3.1 做对的部分

- **文档纪律**：plans 只写"当前正确的设计"、README 唯一状态源、review 落档不改、knowledge 只增不改。
- **分层干净**：core 无 DOM/Vue/localStorage，纯 SceneGraph/FigmaAPI；app 层只做 transport/store/dialog 接线；`ofetch`（vision.ts）是 core 里唯一外部网络依赖，恰当。
- **纯函数变换**：elision（`elision.ts`）与 chat-completions 改写（`media-tool-results.ts`）均不可变、幂等、不污染 UI 展示态；elide 先于 rewrite 的管道顺序正确。
- **注册表架构**：`WeakMap<SceneGraph, Map<rootFrameId, state>>` 双层键控 + `ensureRestored` 懒恢复，支撑"一份文档多设计"；`lastActiveAt` 用单调计数器而非墙钟，测试确定。
- **测试文化**：营销引擎 62+ 条单测、image-gen 三类 provider 单测、生成器回环测试；且吸收了"请求路径机制必须从 transport 入口接线验证"的教训（MEDIA DELIVERY 埋点）。
- **错误可观测**：debug log 媒体脱敏 + cache read/write 同显 + MEDIA DELIVERY 段区分轮入口/轮内，机制空转可直接判读。

### 3.2 实质缺陷（必修，按严重度排序）

1. **`validate` 对根 frame 被删误报通过** — `validate.ts:40-41`：`graph.getNode(state.rootFrameId)` 不存在时直接 `return`，随后返回 `valid: true`。违反"代码校验是唯一裁判"原则，是确定性校验的假阳性。应报告 `root_deleted` 违规。
2. **注册表陈旧条目不清理** — `registry.ts:89`：显式 id 仍返回已删节点的状态；`listMarketingDesigns`（:99-102）从不剪枝。删根 frame 后设计仍"存在"。
3. **恢复扫描深度不一致** — `restore.ts:157-186` 只扫每页顶层 children，而 `listDocumentLibraryNames`（:120-133）递归。文档声称根 frame 可套 group，则嵌套根 frame 恢复不到，库名校对却扫得到。
4. **profile 双源镜像不完整** — `profileSelection`（app ref）与 core prefs 单向同步且加载不 rehydrate；`bindMarketingLibrary` 在 `'ai'`/`null` 时写入 `undefined`（`library.ts:126-128`），可能覆盖用户已锁定的持久化 profile；`setActiveProfile(_store, …)`（`library.ts:168`）忽略 store 参数用模块级全局 → 跨文档泄漏。
5. **轮内 elision 缺口** — `prepareStep`（`transports.ts:181-187`）只做 chat-completions 改写、不 elide；50 步循环内每张新图全量进请求。文档已列入"待定事项 2"（prepareStep 阈值触发），但这是 `<100K` 指标真实威胁，也是 OOM 根因候选之一，优先级应提一档。
6. **`prepareStep` 无单测** — elision/rewrite 纯函数测得很足，但 transport 真实钩子（prepareCall/prepareStep）未被测试触达，恰是"机制空转"bug 所在层。

### 3.3 中低风险清单

- `setup.ts:245-324` `materializeAnchor` / `rebuildAnchorInstance` 约 15 行近似重复，jscpd 隐患。
- `vision.ts` 模块级可变单例（visionMode/凭证/analyzer）跨 graph 共享；两个 `analyzeVia*` 真实 HTTP 路径无单测（`setVisionAnalyzer` 绕过）。
- `look.ts:120-129` 通道 B 缓存命中丢弃 focus、返回泛化描述。
- image-gen：`apply.ts:97-100` `id` 指向不存在节点时静默新建 frame；`providers.ts:104` URL 下载分支无超时。
- `instance-overrides.ts:64` 替换嵌套 INSTANCE 丢失映射（已文档化未解决）。
- 常量 `'open-pencil-marketing'` 在 `restore.ts:17` / `brief.ts:20` 重复。
- `requests.ts:169-173` quality/outputFormat/background 未校验枚举；`id` + 单维尺寸被静默丢弃。
- `registry.ts:90` 单设计路径未做 `rootFrameId` 存在性守卫（多设计路径有）。
- 分支落后 upstream 59 commits——营销改动 add-only，冲突面可控，但应尽早合并避免长期分叉。

---

## 四、与既有评审的一致性

- 本 review 的问题 2/3 与 `2026-07-30/07-31` 资源库评审的整改方向一致（registry/restore 边界），未重复列其已修订项（如 `refInjections` 去重改读 marker 已在 07-31 复核中定级）。
- 本 review 的 3.2-5（轮内 elision）与 `2026-07-29` 上下文工程评审的"待定事项 2"对齐，此处仅提示优先级，不重复展开。
- 本 review 复核过 07-31 复核驳回项（如 `replaceMarketingLibrary` 未 bind 不可达、`readonly:` 正则边界、do-while 单次等价、clone 不清 componentId），均确认维持原判。

---

## 五、执行顺序建议

按"前置 → 必修 → 提升 → 基础设施 → 演化 → 持续运营"六阶段组织。所有阶段并行不悖——前置必须先做，修必与提升可交错，演化和运营是持续动作。

### 阶段 0：前置（必须先做的单一假设验证）

**0.1 把视觉回路假设落档**（§2.4 P1）

- 把视觉回路实测结论写回 V0 文档
- 跑含通道 B / 素材理解的回归基线
- 让"V0 视觉回路提升产出质量"成为文档事实，不再依赖用户口头确认

> **为什么是前置**：CP1 改造、库沉淀机制、Path A 演化都建立在"视觉回路成立"的假设上。如果假设不成立，后续产品方向需要重估。

### 阶段 1：必修（产品级缺陷与风险）

**1.1 修 §3.2 的 4 个工程实质缺陷**

按严重度（§3.2 已排序）：

1. `validate.ts:40-41` 根 frame 被删误报通过 → 报告 `root_deleted` 违规
2. `registry.ts:89` 显式 id 不校验 + `listMarketingDesigns` 不剪枝 → 补存在性守卫
3. `restore.ts:157-186` vs `listDocumentLibraryNames:120-133` 扫描深度不一致 → 统一为递归
4. `profileSelection` 双源镜像 → 完整双向同步 + rehydrate + `setActiveProfile` 接收 store

各补单测。

> **为什么是必修**：这 4 个是**产品功能依赖**——不修，下游的 P6 / P7 / P8 修复无法正确报错（validate 失真 → library 失败看不出）、多设计场景失控（registry 陈旧）、库恢复漏（restore 深度）、profile 锁定不可靠（双源镜像）。

**1.2 修 §2.4 的 3 个产品风险**（P6 / P7 / P8）

按依赖顺序：

1. **P6 库加载失败静默退化** → `library.ts:71-83` 的 fetch 加超时（5s）+ 一次性自动 retry；overlay 失败时显式标记"约束面已丢失，本图为无品牌图"，不要静默退化
2. **P7 需求单介质失败** → 允许 AI 提议（"我可以把这些整理成需求单，要吗"）而非静默创建——一条同时修掉漏斗与发现；表单式填充待评估
3. **P8 profile 自动采用漂移** → ① 删 `profiles[0]` 兜底（`setup.ts:125`），无匹配 = 无 profile；② 取消 setup 静默 auto-pick（`setup.ts:124`）；③ profile 完全由用户在 `MarketingConfigBar` Profile chip 显式选择；④ `l2-resource-library.md:29` 的"AI 推荐 + CP1 确认"流程留待未来按需启用

> **为什么必修**：这三个是**用户立刻感受到的产品失败**——库失败品牌规范消失、需求单用户找不到、profile 被静默套用都是"静默陷阱"，不修直接损害 Path A 的"开箱即品牌"承诺。

### 阶段 2：产品体验提升

**2.1 CP1 升级为 4 宫格缩略图对比 + 默认接受**（§2.4 P2 / §2.5.3）

prompt L185-202 的 2-3 个文字方向升级为 4 宫格缩略图对比；保留"默认方向 + 一键接受"逃生口；用图传达视觉选择。

> **为什么是提升而非必修**：CP1 文字迷宫不阻塞功能（用户能选，只是慢），但显著拖累"非设计师"的体验。视觉回路假设（阶段 0）成立后，这是 Path A 范式哲学最直接的产品落地——"用户有判断力、只是缺工具"。

**2.2 库沉淀机制 v1**（§2.6.1）

"另存为 library entry" 按钮——提取 root frame 的 layout、色板、字体锚点、CTA 结构 → 生成新的 library .fig section。

> **为什么是提升也是命门**：库沉淀机制是 §2.6 四个 Path A 演化路径中**唯一一个能在 v1 → v1.5 之间交付且影响全部后续路径的功能**。没有它，library 永远是项目组产的；有了它，library 才是用户的资产，护城河才真正长在用户那里。

### 阶段 3：基础设施（性能 / 测试盲点 / 中低风险）

**3.1 修 §3.2 的 5-6 项 + 补 transport 接线测试**

- `transports.ts:181-187` `prepareStep` 不 elide → 接 elision 阈值触发分支（`<100K` 指标威胁，OOM 根因候选之一）
- `prepareStep` / `prepareCall` 真实钩子无单测 → 补 transport 端到端测试，防"机制空转"bug

**3.2 修 §3.3 中低风险清单**

按文件归类：

- `setup.ts:245-324` `materializeAnchor` / `rebuildAnchorInstance` 重复 → 提取共性函数
- `vision.ts` 测试钩子 `setVisionAnalyzer` → 改用环境隔离或显式标记生产不应使用
- `look.ts:120-129` 通道 B 缓存命中丢弃 focus → 保留 focus
- `image-gen/providers.ts:104` URL 下载无超时 → 加超时
- `image-gen/apply.ts:97-100` `id` 指向不存在节点静默新建 → 抛错或明确警告
- `image-gen/requests.ts:169-173` enum 未校验 → 加 valibot 校验
- `restore.ts:17` / `brief.ts:20` 常量 `'open-pencil-marketing'` 重复 → 提取到 `constants.ts`
- `registry.ts:90` 单设计路径缺存在性守卫 → 补守卫

> **为什么单独阶段**：这些都是"代码债"——不阻塞功能但累积后难以维护。**不应在阶段 1 一并做**（会拖慢必修节奏），但也不应推迟到 Path A 演化之后（库沉淀会引入新代码债）。

### 阶段 4：Path A 演化（中期）

按依赖顺序：

**4.1 CP3 第四选项：内部素材库接入**（§2.6.2）

CP3 从 stock_photo / generate_image / 用户提供的图，扩展为内部商品库接入（v1.5 阶段：URL 检索；v2 阶段：库 ID 直接拿图；v2.5 阶段：SSO + 权限 + 审计）。

> **为什么排第一**：CP3 是 Path A 与"模板 + AI 填充"产品的最大差异化路径（后者无法接入用户私有素材），且营销工具当前已为此预留接口（每 section 询问图片来源）。

**4.2 patterns 下沉到 library**（§2.6.4）

把 JSX patterns（Price Tag / Process Flow / Grid / Brand Footer）从 prompt 移到 library 第 5 区，每个 profile 携带它偏好的 patterns。

> **为什么紧随其后**：patterns 当前是"约束 + AI 自由"范式的内部矛盾——产品宣传 library 可扩展，但 patterns 锁死在 prompt 里。修这个矛盾 = 让范式哲学完全自洽。

**4.3 library 版本化**（§2.6.3 的 v2 阶段）

library .fig 支持 .git 化版本管理，entry hash 标识 + 回滚。

> **为什么排最后**：版本化依赖多品牌场景（§2.2 待评估 1：multi-brand 是否启用），以及多人协作能力（与 collab 子模块决策耦合）。在没有这些前置前，库版本化的用户价值有限。

### 阶段 5：持续运营纪律

**5.1 每月合入 upstream master 评估**（§2.2 运营纪律）

- **必评估**：core / scene-graph / kiwi / fig / pen 的 bug fix 与性能优化
- **选择性追踪**：vue SDK 关键 API 改动必合入，普通 UI 调整延后
- **跳过**：mcp / cli / demos / docs / ACP / collab（fork 0 import 或 feature flag 暂存）

**5.2 fork 自维护回归基线**

- 营销工具 68+ 单测已就绪（§3.2 整体覆盖度高）
- **待补**：prepareCall / prepareStep 真实钩子测试（阶段 3.1 完成后纳入回归基线）
- **待补**：vision.ts 两个 `analyzeVia*` 真实 HTTP 路径测试（`setVisionAnalyzer` 绕过，需重构后才能测）

**5.3 6 项待评估产品决策的拍板时机**（§2.2 末段）

每次 Path A 演化启动前，重新审视：
1. `packages/pen` 是否保留 → 看 §4.1 完成后用户是否上传 .pen 文件
2. ACP 反向启用 → 看是否进入企业版规划
3. collab 反向启用 → 看 4.3 启动前
4. `fig/instance-overrides.ts:64` 修复 → 看用户实际触发率
5. Vue i18n 同步 → 看国际用户占比
6. 每月合入自动化 → 持续推进，无明确触发条件

### 显式不做（项目治理）

与 §2.7 一致，**重申**以下不做项：

- ❌ **模板系统**——Path A 不需要（§2.1 范式对比）
- ❌ **批量按类型导出与平台规格裁切**——现有 PNG/JPG/WEBP/SVG/PDF 通用导出短期可承接
- ❌ **生图进度条**——batched call 设计（`system-prompt-marketing.md:120` "generate all needed images in one batched call"）+ chat tool 卡已显示 running 状态，per-image 进度与产品形态不匹配
- ❌ **多品牌**——v1 一库=一品牌是正确决策
- ❌ **改 CP3 为全局默认**——CP3 是产品特性不是缺陷
- ❌ **生成清单 / 派生**（§一"未做"项）——v1 跳过

### 一句话执行总结

**阶段 0 验证假设 → 阶段 1 修缺陷与产品风险 → 阶段 2 提升 CP1 + 库沉淀 → 阶段 3 基础设施 + 测试盲点 → 阶段 4 Path A 演化 → 阶段 5 持续运营。** 显式不做清单是治理纪律——避免在 Path A 范式下做"模板 + AI 填充"的事。

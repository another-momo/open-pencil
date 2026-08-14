# Task: 像素先行管线（hero 画框参考 + 色票派生）

日期：2026-08-14
状态：开工（经用户评审确认方案；bleed 警告项经用户决策**不做**——渐变区与 content 区重叠可接受）
范围：`packages/core/src/tools/marketing/`（新增 prepare-hero-scaffold、derive-palette）、`src/app/ai/chat/system-prompt-marketing.md`、`tools/marketing-library/src/generate.ts`（watercolor profile 配方，**新增内容用中文**）、`public/default-library.fig`、对应测试
设计依据：`../../research/2026-08-11-design-technique-distillation-map.md` §9（美学层专章）；本任务由该章的 derive_palette / 参考图坐标系讨论驱动，方案已经过用户逐轮评审

## 背景：三个病灶共用一条根

现流程里**所有视觉承诺都发生在有像素之前**：

1. **CP1 让用户批准 hex 文本**——非设计师无法批准抽象色值；且端午冒烟实测，CP1 锁的 hex 后来被 hero 采样色架空（双色彩权威）。
2. **hero 文字色在骨架阶段写死**——图未生、白字已定；R5-1 事故（88px 白字压采样浅底 #EFEDD9，对比度 1.1:1）即此。
3. **生图参考给的是错误坐标系**——拿 750×750 槽位截图去生 750×850 的图，文字位置靠生图 AI 幻想，构图避让靠运气。

## 核心产品逻辑

> **几何先行、像素居中、颜色殿后**：布局是规格，图按规格造，颜色从造好的像素里算出来——任何决策不在其事实出现之前做承诺。

三条原则：

- **文字位置由构造保证**：生图前把真实文字按真实坐标摆进与成品图同尺寸的参考画框，生图 AI 看着文字构图，不靠猜。
- **颜色从像素派生**：种子色采自 hero 实物，整盘色由纯函数按和谐类型展开 + WCAG 校验；模型的审美决策压缩为"选种子、选 harmony"两个可归因选择。
- **机制进工具，风格进 profile**：几何/色彩算术由工具构造保证；profile 只承载风格选择（harmony 类型、分区契约文本）。

## 新流程（对照现流程，仅列变化）

- **Phase 1（CP1）**：方向提案不再含 hex；每方向报风格关键词 + 色彩情绪（自然语言）。需求单有品牌色则锁为种子色。
- **Phase 2（骨架）**：hero 文字照常排版但**不锁文字色**——骨架色彩中立，只定几何。
- **Phase 2.5（核心改动）**：
  1. `prepare_hero_scaffold`（新工具）：root 右侧建临时画框（宽=画布宽，高=hero槽+bleed），hero 文字带坐标克隆为"幽灵文字"；画框永久留在画布作为生成现场记录。
  2. `generate_image`：画框既是生成目标也是 composite 参考；prompt 带分区契约（主体区/延伸区/fade 平静带，文本由 profile 供给）。
  3. `compose_backdrop`（**不改**）：传画框 id 走外部源路径——图是权威，槽位=图高−bleed。
  4. `derive_palette`（新工具）：采样色→和谐派生→色票（ground/wash/accent/ink）+WCAG 校验；**hero 文字色此刻才定**。
- **CP2**：骨架+hero 实物+真实色票一起确认——用户批准看得见的图，不再批准 hex。
- **Phase 3**：用色从色票角色取；工具 note 常驻上下文当护栏。

## 改动清单

| 类别 | 内容 |
|---|---|
| 新增工具 | `prepare_hero_scaffold`（克隆+几何，幂等，可单测）；`derive_palette`（纯函数 derive-palette-pure.ts + 薄工具壳，culori 实现，可单测） |
| compose_backdrop | 冒烟期零改动（外部源路径已支持）；新流程验证后再做输入契约瘦身（像素单向权威，砍 HeroContent-as-source 与隐式收养）——**另列后续任务** |
| workflow prompt | Phase 1 去 hex；Phase 2.5 改画框流程；Phase 3 色票取色 |
| profile | Variable 轴加 harmony；hero 分区契约文本；**新增内容中文撰写**（用户要求，便于评审） |
| 明确不做 | bleed 警告（用户决策：渐变区与 content 区重叠可接受）；不动 skeleton 机制与 Phase 3/4 主结构；无 hero 的 profile（solid/editorial）本轮不适配；bleed 表达化实验另列任务 |

## 落地顺序与退出标准

1. `prepare_hero_scaffold` + 单测 → 测试通过
2. `derive_palette` + 单测（色相角/色域截断/WCAG 拦截/确定性）→ 测试通过
3. workflow prompt + watercolor profile 配方改动，重新生成库 → round-trip 测试通过
4. **冒烟验证（风险最高点）**：幽灵文字参考图是否真的改善构图避让——同题材新旧流程各跑一张对比。若翻车，损失仅 prompt 改动，工具不受影响。

## 后续任务（不在本任务范围）

- compose_backdrop 输入契约瘦身（依赖第 4 步冒烟结论）
- bleed 表达化 profile 实验（150/250 对照冒烟）
- 无 hero 品类的色票接入（CP1 种子派生路径）

---
id: longform-structure-first
label: 长图设计（骨架先行）
subtitle: 多分区长图 / 内容驱动 / 骨架先行于视觉物化
step_budget: 50
sizes:
  - label: 电商详情长图
    canvas: 750x
  - label: 小红书长图
    canvas: 1080x
---

## 执行总纲

structure-first 五阶段执行序：**阶段 0 需求接入 → 阶段 1 方向提案（文本轮，CP1）→ 阶段 2 骨架渲染（CP2，先定结构不填图）→ 阶段 2.5 视觉环境物化（profile 驱动的独立 slot）→ 阶段 3 逐节填充（自检行 + 跨节一致性检查，polish 独立成段）→ 阶段 4 终审（CP4）**。Checkpoint 总数 = 3（CP1 文本 + CP2 渲染图 + CP4 图像），载体一律是 ask_user_question 表单（契约见「Checkpoint 表单」节）。

与 hero-first（longform-hero-kv-first）的差异点：结构确认在视觉物化之前——阶段 2 骨架渲染完成即 CP2，用户确认分区配重后再进阶段 2.5 物化；hero-led 风格里骨架由 hero 反推，本 mode 骨架由内容大纲驱动，不被 hero 反向塑形。

预算纪律：step_budget = 50；每 CP 自然停顿即 run 终止续跑，用户作答后预算重置；阶段 3 填充中途预算不足时按「resume 协议」节收尾，不硬撑。

## 通用纪律（四则，各阶段适用）

- **双图工具路由**：generate_image = AI 生成/重绘，stock_photo = 真实摄影图库，按 CP2 确认的图片来源路由逐节套用；两工具的调用格式/批量/references/鉴权语义以各自工具描述为权威。
- **组合原语**：render 的 JSX 内可直用 solid / linearGradient / radialGradient / angularGradient / diamondGradient / dropShadow / innerShadow / layerBlur / backgroundBlur / foregroundBlur。三坑：渐变必须显式 transform（缺省方向右→左）；渐隐用 8 位 hex 带 alpha（`#FFFFFF00` 全透明）；多 fill 数组按绘制序（首条 = 底层）。既有节点加/改阴影模糊用 set_effects，永不为此用 eval；修复一轮里效果最后加（阴影/模糊改包围盒、可能位移布局）。跨节色调统一可用全幅矩形 blendMode="hue"/"overlay" + 低不透明度（0.15~0.25）的 global tint（仅多图色彩失和时）；busy 图上压字给 `shadow="0 2 8 #00000066"` 或在文字块后垫深色 scrim 矩形。per-style 背景配方归 profile 文件，不在本纪律内。
- **brief 协议**：四区单一事实源。内容区 = 绑定输入——事实与约束（品牌名/价格/日期/指定口号）精确遵守不编造不抵触，措辞归 AI 创作（仅用户明说逐字保留的文本才锁定）。素材区 = 素材条目（图 + 用法注记）；空区（仅 EmptyHint 行）= 未提供素材，非错误；注记三态：指定用途（必须填该槽）/ 仅作参考（取风格不落画布）/ 未注记（AI 定落位，填充前向用户说明计划）。AI 结论区 = 按设计归组的 append-only 结论——只读本设计的归组，兄弟设计的结论不适用；写入经 append_brief_conclusion 一行一条，永不改删既有行。关联设计区 = 只读投影（id 权威 + 名称/mode/profile 读穿），条目由 setup_design 自动登记，永不手工增删；「（已删除）」注记是墓碑保痕，不是待清理脏数据。素材理解：注记权威，仅当决策依赖图像内容（未注记素材要落位 / 注记与图疑似不符 / 生图需配合素材色域）才 look 该素材 imageNodeId，看后写一行结论区备查（已有结论行且素材未换则信任不重复看）；图与注记明显不符先问用户再用。
- **画布选区**：用户经输入框「采集画布选区」按钮把画布选中节点采集为消息内的 `@画布选区-N` 内联引用；消息尾部的 `[画布选区]` 块是该引用的清单（每个 N 对应哪些节点 id/名称/类型）。「用这张图」= 清单里的图像节点，「基于这张再做一版」= 清单里的设计框；选区引用优先于画布搜索。清单行标「（已删除）」= 节点采集后被删，标「未采集的引用」= 用户手打的占位（无对应节点，按用户文字意图理解并向用户确认）。用户删除 brief 或要求不用 brief 时尊重之，本会话内不再重建。

工具白名单按阶段声明（各阶段「工具」行 = 该阶段允许调用的全集，未列出即不调用）；全程通行工具（read_brief / look / describe / ask_user_question / append_brief_conclusion）在各阶段不重列时也始终可用。

## 阶段 0 · 需求接入

做：read_brief 读当前页需求单 → 无则 create_brief（initial_content = 用户原话逐字转录，不润色、不扩写；画布持久化，不弹面板）→ 宿主完成新建意图确认后调 setup_design({ modeId, profileId?, briefId, canvas? }) 新建设计区根框并登记进 brief 关联设计区（canvas 省略 = 用本 mode 首选尺寸预设）。

不做：续作（用户接着改既有设计）不调 setup_design——按「resume 协议」读现场直接续跑；不替用户改 brief 内容区（逐字转录纪律）；不把用户的修改请求当新建意图。

歧义纪律：read_brief 返回 `{ brief: null, ambiguous: true, candidates }`（当前页多张需求单、均未绑定活跃设计）时**不建单、不擅选**——把候选列给用户，问清用哪张还是确认新建；用户删掉或明确不用某张 brief 时尊重之，本会话内不再重建。

工具：read_brief / create_brief / setup_design / look（查验 brief 素材区图片，imageNodeId 取自 read_brief 结果）/ set_active_design（用户指认「改之前那张」时声明切目标——只声明不落槽，用户聊天内确认后宿主移槽；返回 {error} 即目标非法，告知用户并停止，永不重试强切）。

## 阶段 1 · 方向提案（文本轮）

做：产出内容大纲（分区章节序，内容驱动——见「画布尺寸」节）+ 视觉方向（风格词 / 构图 / 色彩氛围）+ 标题与 CTA 文案稿（AI 直接撰写）。事实类信息（价格、折扣、日期、地址、规格参数）缺失时在 CP1 表单内以 text 题追问，不编造。

不做：不给精确 hex（色彩纪律 = 方向期只说氛围、填充期自由发挥、终审 look 验收）；CP1 确认前不调 generate_image（花钱的事用户说了算）；**不在 CP1 之前绘制骨架**——本 mode 骨架由方向确认后驱动。

══ CP1 · 文本表单 ══ 方向确认 + 标题文案锁定 + 缺事实追问。标题在此锁定：它同时充当阶段 2 骨架里的命名占位与最终画面文字，锁定后不再改措辞。锁定结果（方向、标题、确认过的事实）逐行 append_brief_conclusion 写入 AI 结论区。

工具：read_brief / look / ask_user_question / append_brief_conclusion。

## 阶段 2 · 骨架渲染

做：按 CP1 大纲 render 完整骨架进根框——根框 flex="col"，每节一个命名 Frame，比例按内容大纲配重（不按 hero 反推）→ describe 修尽 error（warning 向用户陈述即可，不阻塞）→ look 根框验结构（分区清晰、比例合宜、命名齐备——后续视觉物化以骨架结构为底盘）→ 给出骨架摘要（分区列表 + 比例 + 占位命名）。

骨架纪律：文本节用 h="hug" 让 padding 承白，定高只给媒体槽；图片占位一律命名（HeroImg / ProductImg / …）并给浅灰占位 fill（`bg="#E2E8F0"`）；占位阶段不写任何编造的具体事实（价格、折扣、日期、地址）。高度算术一律 calc，不心算。**CRITICAL — 每节 render 必带 parent_id = 根框 id**，JSX 里不写 id（脱根则 w="fill" 塌陷、根框留空）。

══ CP2 · 渲染图表单 ══ 骨架结构确认 + 图片来源确认（AI 生成 / stock_photo / 用户素材——顺带确认后续节次用图来源）。骨架未确认前不进阶段 2.5：结构不稳就铺视觉等于双倍返工。

不做：不调 generate_image / stock_photo（CP2 之内纯结构，不产生图像成本）；不调 compose_backdrop；骨架不通过 → 按作答调整后重发 CP2，不进阶段 2.5。

工具：render / describe / look / calc / ask_user_question / append_brief_conclusion。

## 阶段 2.5 · 视觉环境物化（profile 驱动的独立 slot）

**本阶段是 profile 驱动的 slot，不是固定 workflow 节点。** workflow 只定执行时机（在 CP2 之后、阶段 3 填充之前——视觉物化耗真实算力、必须在结构确认后做）和出口契约（look 验）。具体执行内容由 active profile 的 Hero treatment 节（及 Typography / Color 相关规则）决定：

- **profile 有规范** → 按其 recipe 执行。一般形态：若骨架内含 hero 槽则先生成/填入 hero 图（hero-led profile 用 prepare_hero_scaffold 做参考帧 + generate_image 围绕标题参照出图；profile 无此规定则直接 render / stock_photo 填占位）→ compose_backdrop 把图沉到 BackgroundLayer 并自动采样补色。**调用 prepare_hero_scaffold 时**，underlap_px / transition_zone_px 按 profile 语境定值，几何记录写进 scaffold，下游只读记录不散传。
- **profile 规定色板派生/配色规则** → 按派生结果把色票应用到骨架节填色与文字。
- **永远以 look 验收本阶段**——profile recipe 内 success criteria（「接缝不可见」「压字清晰」等）为权威。失败按 recipe 给的恢复路径走；超 2 轮仍未通过 → 在结论区登记，重生 hero 图计入「脱困阀」节的整批重生纪律。

仅当 profile recipe 实际需要的工具才调：recipe 不要求 prepare_hero_scaffold / compose_backdrop 时绝不调；recipe 命名了工具列表中不存在的 helper 时，按 recipe 的意图用 render 兜底，不发明调用。

### 兜底工序（profile 无规范时）

**无 active profile，或 profile 无 Hero treatment 节 → 按下方兜底工序以通用参数执行**（不跳过——视觉环境是长图基本盘；仅当 brief 明确纯文字长图时跳过并在结论区声明）。骨架已在阶段 2 立好的语境下走：

1. 在骨架 hero 槽渲染标题版式 HeroContent（真文案、真字号；lockup 默认 lower-third、高度 = W、无眉题）。
2. `prepare_hero_scaffold({ root_id, source_node_id: HeroContent.id, underlap_px: 100, transition_zone_px: 100 })`——underlap / transition_zone 按 W 缩放；返回几何记录下游只读。
3. `generate_image` 单请求：replace_id = scaffold_id、references 用 scaffold 合成参照、尺寸 = 返回值 width × height；prompt 按 CP1 锁定方向自拟，明写参照用法（围绕标题构图、标题区保持平静低细节、画面中不画任何文字、底部 underlap 带保持平静）。
4. 阶段 3 填充完成、根框高度稳定后 `compose_backdrop({ root_id, scaffold_id })`——缺省自动采样，不传 hero_color。外部 hero 图源（用户上传、无 scaffold）用 `compose_backdrop({ root_id, hero_image_from })`。
5. `look` 验收：hero 底部无可见接缝、标题区可读；hero 后续重生则同参重调 compose_backdrop。

兜底纪律沿用本节「recipe 命名了不存在的 helper 按意图用 render 兜底」「跳步 = 显式失败」「不发明几何」「不发明调用」口径——profile 缺席处的 agent 自行发挥处写一行结论区备查（风格选择 / 参照用法）。

工具（按 profile recipe 实际需要裁剪）：render / prepare_hero_scaffold / generate_image / stock_photo / compose_backdrop / set_fill / set_text / describe / look / calc / ask_user_question / append_brief_conclusion。

## 阶段 3 · 逐节填充

做：逐节填充循环——每节 render → describe → 修尽 error（warning 向用户陈述即可，不阻塞）→ 自检行（本节做了什么、describe 结果如何）→ 下一节。**每填完 3 节做一次跨节一致性检查**：describe 根框 depth=1 验 palette / 字阶 / 间距节奏是否一致；不一致处 set_fill / set_text_properties 批量对齐。

图片填充纪律：图像生成 / stock_photo 的调用格式以各自工具描述为权威；图按 CP2 锁定来源路由——指定用途素材必填其槽、仅作参考素材取风格不落画布、未注记素材按 CP1 落位计划填。图像 prompt 附锁定风格词尾缀；busy 图上压字三策见「通用纪律」组合原语则。

**节级自检行（强制）**：每节完成必输出 `section N: rendered → described (M issues) → fixed`——不写则说明本节有步漏掉，倒回去补。每节不可批量多填后统一 describe：errors 累加，section 1 一个 w="fill" 漏掉会让下面所有节布局塌。

══ polish 段（独立成段）══ 全节填完后：describe 全量审计（修尽 error）→ look 分区钻取验收（逐分区看；look 在文字过小时自行声明并列出可钻取的文本节点 id，按它下钻）→ 消费「Fix Playbook」节逐项过表（症状 → 检测 → 动作 → 升级条件）。polish 不重发 CP；是同 run 内收尾，预算宽裕时一遍清，不行就 wrap up 走 resume 协议。

工具：render / describe / look / calc / generate_image / stock_photo / batch_update / update_node / set_layout / set_layout_child / set_radius / set_fill / set_stroke / set_text / set_text_properties / set_text_resize / node_resize / reparent_node / delete_node / find_nodes / get_node / get_jsx / append_brief_conclusion。

## 阶段 4 · 终审

做：describe 全量审计（修尽 error）→ look 分区钻取验收：逐分区看，禁止从全览图判断小字（look 会在文字过小时自行声明并列出可钻取的文本节点 id，按它下钻）→ ══ CP4 · 图像表单 ══ 终审确认（imageOptions 引用设计根框，可加关键分区节点）→ 通过后总结收尾，残余事实（未补上的素材、声明过的取舍）append_brief_conclusion 写入 AI 结论区。流程终点——无交付段，导出走编辑器既有功能。

工具：describe / look / find_nodes / get_node / append_brief_conclusion / ask_user_question；终审中发现的修复沿用阶段 3 修改工具集。

## Section 模式库（非约束性，供阶段 3 填充取用）

- **hero 默认版式**：Frame + flex col（justify end）覆盖文字子节点——背景填充（图/色）在底层，文字自动浮于其上，即「图上压字」的标准结构。
- **纯布局节**（流程步骤 / 网格陈列 / 价目表 / 规格表）：一律 flex 排布，不用绝对定位——后续内容增删不伤版式。
- **卡片节**（图 + 文字组合）：图在上文字在下；价格卡用「现价大粗 + 原价小字划线」对照。
- 忙图可读性三策（shadow / scrim 垫块 / global tint）见「通用纪律」组合原语则，不重复。
- 库中一切尺寸/字号均为语义占位：宽度取当前尺寸预设的 W，字号按「字阶规则」节分档，profile 另有规定时以 profile 为准。

## Checkpoint 表单（CP1–CP4 契约）

载体 = ask_user_question，一次调用批量提全部问题（1..8 题），形状：`{ questions: [{ id, kind, label, options?, imageOptions?, required? }] }`——kind ∈ single_select | image_select | text；single_select 带 options（2..12 条，`{id, label, hint?}`）且不带 imageOptions；image_select 带 imageOptions（1..12 条，`{nodeId, label?}`，引用画布节点）且不带 options；text 两者均不带；required 缺省 true（可选题显式传 false）。id 全表单唯一、label 非空；校验失败返回 {error}，改正后重发，不抛异常。

运行语义 = run 终止续跑：工具结果恒为 `{formId, status:'awaiting_user', questions}`——拿到该结果即结束本回合，不再调任何工具、不再输出文本。作答或跳过经下一条用户消息物化：作答首行 `[表单作答 formId=…]` + JSON 行 `{"aborted":false,"answers":{"<questionId>":value},"freeText"?:"…"}`（可选 freeText = 用户原话，一等答案内容，按内容采纳）；跳过首行 `[表单跳过 formId=…]` + `{"aborted":true,"freeText":"…"}`。跳过 = 用户用自由文本表达意图，按内容续跑，不重发同一表单。

自由文本双角色：前端恒带自由文本输入——既是第四种作答（随作答信封 freeText 键回传，非空时豁免必填校验），也是跳过理由；方向类 single_select 选项集末位固定放一项「都不合适（我补充说明）」。

表单内不提供 mode 切换入口（保持表单 mode 纯净）。四张表实例：

- **CP1**（阶段 1 末，文本表单）：single_select 方向选项集（2..12 条 + 末位逃生项）+ text 缺事实追问（每条事实一题）+ single_select 标题文案锁定确认（确认 / 改写）。
- **CP2**（阶段 2 末，渲染图表单）：single_select 骨架结构确认 + single_select 图片来源确认（CP2 之内的结构确认让用户先校骨架再定图片来源，避免骨架回炉时图片已生成浪费）。
- **CP4**（阶段 4 末，图像表单）：image_select 终审确认（根框 + 关键分区 nodeId）。

注：本 mode 在阶段 2.5 / 阶段 3 内不重发 CP——视觉环境物化走 profile recipe 自闭环，逐节填充走节级自检行，骨架结构已在 CP2 锁定；仅 CP1/CP2/CP4 三张表，不凑四张。

## 脱困阀

触发：同一方向下用户整批拒绝并重生 ×2 仍未选中（仅适用阶段 2.5 hero-led 场景） → 禁止第三次重生，强制回 CP1 重提案。CP1 重入选项集 = 改方向描述 / 换 profile / 换尺寸预设 / 换模式（「换 type」选项已删除——type 层级已废）。执行分工：

- 改方向描述：留在本 run，按新描述重走阶段 1。
- 换尺寸预设：sizes 清单内另选或按用户语言自定义——衍生语义，经宿主新建意图确认后 setup_design 以新 canvas 新建设计区。
- 换 profile：走「restyle 协议」节（新建衍生，非原地重入）。
- 换模式：走宿主 mode 生命周期 Case B 确认流——表单只负责收集选择，确认与执行不在表单职责内。

计数纪律：无回合状态落盘，重生计数由 AI 自觉维护——每次整批重生写一行 append_brief_conclusion（批次、变量轴、结果），续作时按结论区重建计数。

## resume 协议（续作与超预算收尾）

无回合状态落盘。续作现场 = 三重 ground truth：画布产物（实物）+ brief 结论区（日志）+ 会话历史（未答表单）。续作 = 按落盘 mode 组装本 workflow，AI 按下序读现场重建：

1. read_brief——内容区（原始需求）+ AI 结论区（按设计归组的锁定方向/事实/进度/重生记录）+ 关联设计区（设计条目与墓碑注记）。
2. describe / look 验画布实物进度——结论区与画布冲突时以画布实物为准，并补记一行勘误进结论区。
3. 会话历史找未答表单（[表单作答]/[表单跳过] 信封是否已回）——未答即续等语义，不重发同一表单。

进度判定表（按画布实物）：

- 仅 setup_design 根框 → 重跑阶段 1。
- 根框 + 骨架渲染完成 → 已过 CP2，重跑阶段 2.5 / 阶段 3 起段。
- 根框 + 骨架 + 视觉环境物化完成 → 阶段 3 起段。
- 根框 + 骨架 + 部分节填充 → 从下一未填节续填。
- 全节填充 + 未 polish → polish 段。
- 全节填充 + polish 已过 → 阶段 4 终审。

fill 超预算收尾（收到剩余步数告警或自判不足时）：当前节修到 describe 无 error → append_brief_conclusion 写进度行（已完成节次 / 剩余节次 / 下一步动作）→ 固定话术收尾：「已画完 N/M 节，回复『继续』从第 N+1 节续填。」——不停在半节中间，不静默省略剩余节。

## restyle 协议（换风格）

修改请求路由：换风格 → 本节协议（新建衍生）；其余修改（recolor / resize / copy edit / 换图）→ 直接编辑既有节点、跳阶段，不重走五阶段执行序（修改范围局部化，改完 describe 修尽 error 即可，无需 CP 确认）。

restyle = 切 profile 新建衍生，不做原地重入：旧设计画布原样保留；携带物经宿主新建意图确认卡勾选（brief 素材区自动继承；已生成图片可选作 references）；确认后 setup_design 以新 profile 新建衍生设计区，从阶段 1 重跑本执行序。提案时向用户一行报价「哪些节保留 / 哪些节重生」。

## 画布尺寸

mode 级尺寸预设：装配期 `sizes` 清单 = `[{label, canvas}]`——canvas `宽x` 高度随内容（HUG）/ `宽x高` 定高；本 mode 预设 = 电商详情长图 750x + 小红书长图 1080x（同 longform-hero-kv-first，structure-first 与 hero-first 共用画布尺寸档）。用户按名称显性选择其一或语言通道自定义尺寸；未显性指定时 agent 按语义意图自选预设之一或自定义，均未指定 → 首选预设（清单首条）。sizes 缺席的 mode → 缺省 750 宽 + 高度随内容（同 general）。

尺寸与内容结构的关系：两预设只定宽度档（连带「字阶规则」节的分档），不预设章节列表——分区章节序由内容大纲驱动（阶段 1 提案、CP2 确认），本 mode 不设固定分区模板。

## 字阶规则（画布尺度分档）

长图字号下限按画布宽度分档（S2 字阶出处：宽 ≥900px 画布 body≥22 / section≥40 / hero≥64，按本 mode 两预设校准）：

- **1080x 档（宽 ≥900px，规则本体适用）**：正文 body ≥ 22 / 节标题 section ≥ 40 / hero 主标题 ≥ 64。
- **750x 档（宽 <900px，等比降档）**：正文 body ≥ 20 / 节标题 section ≥ 36 / hero 主标题 ≥ 72（与内置 profile 的 750 字阶对齐）。
- 两档 caption / 辅助文字均 ≥ 16。

检测：describe 树摘要行报每个文本节点的字号（`"文本" Npx 字族`），逐节点对照本表即机检。优先序：与当前 profile 的 Typography 节字阶冲突时**以 profile 为准**；profile 未规定字阶时适用本表。

## Fix Playbook（polish 段消费）

症状 → 检测 → 动作 → 升级条件一张表。检测只写 describe 能报或 look 能验收的项；修复动作尽量批量化（batch_update）。

| 症状                   | 检测                                                                                                                                 | 动作                                                                                               | 升级条件                                               |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| 文字溢出/截断          | describe error（overflows / Nested Text / collapses）                                                                                | set_text 精简文案或 set_text_resize 给缩放余量；容器 node_resize；仍挤则字号降一档（不破字阶下限） | 同节 2 轮仍报 error → 砍内容密度，结论区声明           |
| 对比度不足             | describe warning（Low contrast，distance<15）                                                                                        | set_fill / set_text_properties 拉开明度差；图上文字加底色带                                        | 与锁定氛围冲突 → look 复验后结论区声明取舍             |
| 占位符残留（灰块未填） | describe（image 容器无图无占位 fill——仅命名含 poster/avatar/image/thumb/photo/cover/banner 且裁剪的容器可机检）+ look 分区查灰块兜底 | 补图（generate_image / stock_photo / brief 素材 references）或 set_fill 补语义化占位色             | 缺素材 → 问用户或结论区记「待补」，不留灰块交付        |
| 跨节 palette 漂移      | look 逐节对照 CP2 锁定骨架与 profile 物化色（配色无专用工具，describe 不检测）                                                       | set_fill 统一到方向色域                                                                            | 2 轮仍不一致 → 回 CP2 重述骨架/氛围                    |
| 视觉环境接缝可见       | look 根框 / hero 区，focus 声明查接缝                                                                                                | compose_backdrop 幂等重调（canvas_height 缺省跟随根高）；仍可见则显式传 hero_color                 | 重调 2 次仍可见 → 重生 hero 图（计入整批重生纪律）     |
| 字阶越轨               | describe 树字号对照「字阶规则」节分档                                                                                                | set_text_properties 调档                                                                           | 与 profile 字阶冲突 → 以 profile 为准，不动            |
| 图片内嵌文字（乱码字） | look 候选/落图节点（纯位图节点走 original-bytes 通道看原图）                                                                         | 重生成该图，prompt 明写「画面中不出现任何文字」                                                    | 同批 2 次仍带字 → 换素材路线（stock_photo / 用户素材） |

# System Prompt (Marketing) 深度分析

日期：2026-08-06
对象：`src/app/ai/chat/system-prompt-marketing.md`（246 行），对照 `system-prompt-base.md`（101 行）与装配处 `src/app/ai/marketing/library.ts`（overlay 注入）
实证依据：2026-08-06 端午海报真实运行 debug log（12 步、14 次工具调用）

## 整体判断

骨架健康：checkpoint 机制、需求单协议、锚点纪律在真实运行中**都被正确执行**（端午 log 中 read_brief → setup_material_type → 富信息 echo → 方向提案 → 锁定 → 追加结论，全流程符合设计）。问题集中在三类：**信息密度不均、条件句式重复、示例领域偏置**。

那次 run 的 5 个 render 报错 100% 是 `design-jsx/render.ts` sanitizer bug（已于 1ead6096 修复），prompt 无责——这本身是有价值的结论：下次故障可先怀疑工具层。

## 逐段分析

### L1–5 Image Tools
- 优点：克制，细节推给工具自身 description。
- 缺点：无。

### L7–22 需求单协议
- 优点：三区语义、append-only、"用户备注永远赢"的仲裁规则清晰；`{brief:null}` 非错误的预防性说明必要。
- **缺点 1（实证，最重要）**：L18 要求往 AI结论区追加结论，但 `read_brief` 只返回 `briefId`，不返回 zone id。端午 log 中模型被迫 `describe 0:5` 才拿到结论列表 id（`0:30`）——一次 5.8KB 调用 + 约 30 行需求单自身的 grid/radius 警告噪音。**这是工具写路径的缺口**。
- 缺点 2：L14 素材理解是 9 行超长自然段，混合"何时跳过 look / 如何 look / 追加格式 / 冲突仲裁 / 替换处理"五件事。弱模型对长段遵循率低于 bullet，建议拆列表。
- 缺点 3：L16 要求每次 `list_pages` 确认参考区是否存在。参考区存在性在装配时可知，可放入 overlay（每轮重建），省一次强制工具调用。前提：需核实注入发生在会话中途时 overlay 是否重建。
- 缺点 4：L22 画布选区段位置突兀——藏在需求单章节末尾，但选区与需求单无关。建议独立小节或移至工作流总纲前。

#### 讨论结论（2026-08-06，三项均已核实/拍板）

1. **AI 写需求单走专用 append 工具，不做 edit 工具。** 新工具 `append_brief_conclusion({ text })`，薄封装现有 core 原语 `appendToBriefAiZone`（`packages/core/src/tools/marketing/brief.ts:484`，按名定位结论列表、自带规范样式 size 24/`· ` 前缀/wrap、追加后隐藏空状态，表单面板已在用）。决策依据：
   - 现存全部写入场景（锁定方向/事实、素材描述行、更正行、Phase 4 补充）都是追加，edit 覆盖的是伪需求；
   - append-only 是 zone 核心契约，edit 能力会从结构上瓦解它（模型"整理癖"会毁掉审计轨迹）；
   - edit 的定位 schema（行号/文本匹配）本身易错，且 core 无现成原语。
   - 未来若"新旧结论矛盾共存"成为实际问题（P7 评审指出过 append-only 无"后写者胜"），演进方向是加结构化 `supersedes` 可选参数（旧行标记作废 + 追加新行），而非开放 edit。
   - 工具化后 prompt 可删 L18 的 render 示例整段；格式强制与 append-only 从 prompt 约束升级为结构约束；原"`read_brief` 返回 zone ids"建议作废（不再需要 id）。
2. **素材理解确属过度设计，L14 压缩为 3 条 bullet**：备注是权威 → 决策依赖图片内容时才 look（无备注素材 / 疑似备注与内容不符 / 写生图 prompt 需与素材色调互补）→ look 过就顺手记一行供后续 session 复用。去掉"Phase 0 结束前强制 look 每个素材 + 强制逐条追加"的前置管线。代价：备注与图片不符的检测从主动变被动（边缘情形，checkpoint 有用户兜底）。
3. **参考区存在性改由 overlay 注入，已核实可行**：`buildMarketingOverlay(store)` 在 `prepareCall` 中每个模型调用都重建（`transports.ts:127`），会话中途 Inject 下一次调用即反映；该函数当前参数为 `_store`（未读 store），扫描 `store.graph` 页面名成本可忽略，core 已有 `listInjectedReferenceIds`（`packages/core/src/tools/marketing/library.ts:423`）可复用；overlay 属 instructions，参考区行只在注入/移除时变化，会话内稳定，prompt 缓存（端午 log 93% 命中）不受影响。overlay 在参考区存在时注入"reference-only、禁止修改"说明，不存在时一字不提；prompt L16 整段压缩，强制 `list_pages` 调用取消（工具本身保留在 CORE，不撤回）。
4. **顺带发现 drift（必须修）**：`create_brief` 的 description（`packages/core/src/tools/marketing.ts:114`）仍是旧策略 "never create one unprompted"，与 Phase 0 自动创建（23af1071）和 system prompt "create one right away" 直接矛盾——当时改 prompt 漏了同步工具描述，做 append 工具时一并修。

### L24–28 工作流总纲 + 修改型豁免
- 优点：checkpoint 的机制解释（"发纯文本消息结束 run，回复带来新预算"）把产品机制翻译成了模型可理解的动力；修改型豁免位置显眼。
- 缺点：L26 说 "4 phases"，实际编号 Phase 0–4 共五个。小不一致。

### L30–44 Phase 0
- 优点：类型优先级仲裁（用户锁定 > 需求单声明 > 推断）完备；variant 默认声明制（"默认 300×250，需要其他告诉我"）是好人机设计。
- 缺点 1：L32 末尾突然一句中文"无预设覆盖的尺寸也走这条路径"——全文语言混搭中最生硬的一处。
- 缺点 2：类型优先级在 L36、L40 各说一遍，轻度冗余（可接受）。

### L46–55 锚点规则
- 优点：违规处理流程（不静默修、报告、用户确认后 repair 模式）成熟。
- 缺点：无实质问题。

### L57–74 Phase 1
- 优点：Sparse/Rich/Complete 三档自适应是全文最佳设计之一；端午 log 的 echo 表格即 Rich 档正确产物。
- 缺点：无。

### L76–86 Phase 2
- 优点：`parent_id` 必传 + `id` 禁用的 CRITICAL 段源自真实事故；hero overlay 例外条款精准。
- 缺点：无。

### L88–110 Phase 3
- 优点：Frame 占位符的 reference 选择（L96）实操性强；generate 后 look 验收（max 2 次重试）边界清楚。
- 缺点：L90 "decide the source with the user (Checkpoint 3)"——多 section 时逐段 checkpoint 过碎。虽有 blanket instruction 豁免，但默认路径是"每段都问"。建议改为"第一段问一次，后续沿用，除非用户打断"。

### L112–124 Phase 4
- 优点："视觉观察是 advisory，锚点问题以 validate 为准"——给 vision 判断正确降权，与 look 工具 secondary judgment 定位一致。
- 缺点：无。

### L126–128 Design State Tracking
- 缺点（轻微）：与 AI结论区功能重叠（同为抗上下文丢失），介质不同（消息 vs 画布），可接受但需意识到是双份状态。

### L130–242 Section Patterns + Common Marketing Patterns（约 110 行，占全文约 45% token）
- 优点：具体可模仿，弱模型照猫画虎成功率高；Process Flow 示范了 map/Fragment 的 JS 表达式用法。
- **缺点 1（较严重）：领域偏置**。四个示例全部来自信用卡/咖啡场景（生椰拿铁、招行信用卡、掌上生活、周三五折）。弱模型有强烈的示例吸附倾向——做端午海报时可能被拽向银行/餐饮美学。建议换成中性主题，或明确标注"以下为语法示例，与本次设计主题无关"。
- 缺点 2：Price Tag / Grid 示例硬编码 "25元购/50元/5折"，与 Phase 1 "never fabricate prices" 形成张力——模型可能连数字一起抄。建议改成明显占位或加注释。
- 缺点 3：token 性价比。Hero 模式（L134–147）与 Phase 2 例外条款表述重叠，可合并；Grid 和 Process Flow 使用频率存疑，是最优先削减候选。

### L244–246 Step budget
- 优点：把 checkpoint 解释成"赚预算"，模型有动力配合；成本估算（每段 5–8 步）提供规划锚点。
- 缺点：无。

## 横切问题（比分段更重要）

1. **"If your system prompt contains an 'Active style profile' section" 出现 4 次**（L44/65/74/78）。冗长且是元语言（让模型反思自己的 prompt 结构），弱模型处理条件句能力差。建议：marketing 文件只说一次"若存在 Active style profile 段，其在风格/结构/字体上均为最高优先级"；或更彻底——由 overlay 在有 profile 时自行声明权威，marketing 文件完全不谈条件。
2. **强调词通胀**：MANDATORY/REQUIRED/STRICT/CRITICAL/never 全文几十处。真正的生死规则（parent_id 必传、readonly 不动、不编造价格）被淹没在同字重的次要规则中。建议分级：生死规则保留大写，其余降为普通陈述。
3. **base 与 marketing 边界总体干净**（base=DSL 参考，marketing=流程），仅 calc 纪律两边各说一次，可接受。
4. **端午 log 证明 prompt 无责的部分**：checkpoint 时机、中文 echo、方向锁定、结论追加全部按设计发生。

## 优先行动建议

已定案（见 L7–22 讨论结论，可打包为一个改动包）：

| # | 事项 | 类型 | 预期收益 |
|---|------|------|---------|
| A1 | 新增 `append_brief_conclusion` 工具（薄封装 `appendToBriefAiZone`），同步修 `create_brief` description 的旧策略 drift | 工具 | 省强制 describe；格式/append-only 结构化 |
| A2 | prompt L18 删 render 示例改指工具；L14 素材理解压为 3 条 bullet；L16 参考区段压缩 | prompt | 净减约 20 行 |
| A3 | overlay 在参考区存在时注入 reference-only 说明 | 装配 | 省强制 `list_pages` 调用 |

待讨论（未拍板）：

| # | 事项 | 类型 | 预期收益 |
|---|------|------|---------|
| 2 | "Active style profile" 条件句收敛为一处（或移交 overlay 声明） | prompt | 去元语言、减重复 |
| 3 | 四个 JSX 示例去领域化 + 削减到 2 个 | prompt | 消领域偏置，省约 20% token |
| 4 | L22 选区段移位；Phase 3 checkpoint 默认"问一次沿用" | prompt | 弱模型遵循率 |
| 5 | "4 phases"→"5 phases" 等小型不一致 | prompt | 一致性 |

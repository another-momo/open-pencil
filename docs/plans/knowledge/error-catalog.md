# 冒烟测试错误目录（实测驱动迭代的核心资产）

> 本文件只追加不修改。每轮冒烟测试追加一节：现象 / 根因 / 修复。测试分析手段：AI debug log（工具调用序列 + 诊断 + 对话全文）。
>
> 历史：R1-R3 迁移自原 `l2-agent-mode-plan.md` §11（2026-07-27 文档重组）。

测试需求：咖啡店朋友圈广告（`wechat_moments`，无锚点）。

## 第 1 轮（2026-07-21）

| # | 现象 | 根因 | 修复 |
|---|---|---|---|
| R1-1 | 同一 `insert_index` 重复 render，产出 5 个 section（应为 3 个） | prompt 未禁止同位置二次渲染 | prompt 加 `replace_id` 规则：修复错误必须重渲染替换，禁止重复渲染 |
| R1-2 | `mt` prop 幻觉 ×5 | prompt 的 margin 禁令不够显眼 | prompt Prohibited 区加粗显式列出 `mt/mb/ml/mr/mx/my` 不存在 |
| R1-3 | 乱码中文文案 + `#6B728λή` 损坏 hex 静默解析为黑色 | render 不校验颜色合法性 | `render.ts` 增加 `collectInvalidColorWarnings`（culori 解析失败即警告）；文案质量属模型能力，待观察 |
| R1-4 | 中文用户收到英文 checkpoint | prompt 无语言规则 | prompt 加"checkpoint 一律用用户语言"规则 |

## 第 2 轮（2026-07-22）— 发现致命 bug

| # | 现象 | 根因 | 修复 |
|---|---|---|---|
| R2-1 | **致命**：3 个 section 全部渲染在根 frame 之外，成为页面级孤儿（148×648 等坍塌尺寸），根 frame 始终空白 | prompt 从未告知 `render` 的 `parent_id` 参数；AI 幻觉出在 JSX 里写 `id="0:3"` 想指定父级（被忽略，警告出现 3 次 AI 未反应）| 三层修复：① `setup_material_type` 的 note 注入含真实 ID 的 `parent_id` 硬指令（工具结果常驻上下文）；② prompt Phase 2 加 parent_id 必传规则 + 示例；③ `render.ts` 的 `id` prop 警告特化为指向 `parent_id`/`replace_id` |
| R2-2 | describe 报出 error（深字压深底）和多个 warning，AI 未修复直接展示 checkpoint | prompt 只说"修复"，没禁止带病展示 | prompt 明确"修完所有 error/warning 才能展示 checkpoint" |
| R2-3 | checkpoint 问题仍是英文（"Does this structure work?"） | prompt 里字面英文示例覆盖了 R1-4 的语言规则 | checkpoint 问句改为中文示例（"这个结构可以吗？"） |
| R2-4 | Phase 2 骨架阶段就写入全部真实文案/价格 | prompt 未禁止 | prompt 明确 Phase 2 只用占位文字，真实内容 Phase 3 才写 |
| R2-5 | 幻觉品牌名"掌上生活App 扫码即享"（招商银行 App） | CP1 未收集品牌/产品名 | prompt Phase 1：需求缺品牌/产品名时在 CP1 一并询问，禁止编造 |
| R2-6 | styleGuide 字体 PingFang SC 未应用（全程默认 Inter） | prompt 无字体应用规则 | prompt Phase 1：锁定字体必须通过 `fontFamily` prop 应用 |
| R2-7 | 根 frame 无底色 → "Empty frame with no fill" 警告诱导 AI 浪费 3 次调用（含 1 次 no-op resize） | 根 frame 创建时无 fills | `setup.ts` 创建根 frame 时默认白色底色 |

## 第 3 轮（2026-07-22 下午）— 端到端首次完整跑通

上轮修复全部生效（parent_id ✓、中文 checkpoint ✓、CP1 品牌名询问 ✓、validate 收尾 ✓）。暴露的新问题：

| # | 现象 | 根因 | 修复 |
|---|---|---|---|
| R3-1 | calc×5 / batch_update×6 / image-gen×1 / stock-photo×1 共 13 次 "Invalid JSON" 失败（约占 1/4 steps）；AI 偶然发现尾部加空格能成功 | 模型吐 tool args 时 JSON 字符串值尾部双重闭合（`\"}`），外层 JSON 合法故 SDK 正常投递——只有"JSON 字符串套 JSON"参数的工具中招（render/set_text 等普通参数全程无恙）。calc 还有二层问题：JSON.parse 失败后兜底喂 expr-eval，报错看似表达式语法错误，误导 AI 朝加空格方向重试 | 共享 `parseJsonArrayParam`（destr 快路径 + "尾部只含无关字符"守卫的救助路径 + warning 透传结果），接入 calc/batch_update/image-gen/stock-photo；calc malformed array 直接报清晰错误不再喂 expr-eval；原型污染防护保持（destr 快路径 + 救助路径 __proto__ 守卫） |
| R3-2 | 用户明确"主视觉用AI生成"，但 AI 认为 generate_image 不能填灰色占位符 → 页面级生成新节点 + eval insertChild 插回（还先用错 getNodeByIdAsync 浪费一次） | **工具描述与 prompt 规则矛盾**：prompt 说"按 id 填占位符"，工具描述却说"id 用于 img2img 编辑现有图片节点"——AI 信工具描述。另有潜在 bug：apply.ts 从目标节点回填的原始尺寸（1080×500）未做枚举映射，真调用了会 400 | 工具描述明确"无图片填充的叶子形状占位符直接填充"（代码本就支持）；apply.ts 回填尺寸经 normalizeSize 映射；prompt Phase 3 明确两个图片工具都接受占位符 id、无需 reparent |
| R3-3 | 改字体被迫用 eval ×2，且 `fontName={style:'Bold'}` 把 11px 说明文字误设为 Bold（样式回归） | update_node/batch_update 无 font_family prop；eval 的 fontName 语义是 family+style 对，改字族必然碰字重 | update_node + batch_update 加 `font_family`（保留原字重/样式） |
| R3-4 | "fill matches parent" error 触发 2 次，诱发无效修复（造出 #FFF8F0 vs #FAF6F1 这种肉眼无差的差异）；subpixel warning 满屏（justify=center 必然产生 .5 偏移，AI 正确忽略） | 消息文案含 "invisible" 被 ERROR_PATTERNS 的 /invisible/ 截获（INFO_PATTERNS 的 /fill.*matches parent/ 永远轮不到）；subpixel 检查不区分布局计算值和显式定位 | 文案改 "no visible boundary"（正确落入 info）；auto-layout 父级内非 ABSOLUTE 子节点跳过 subpixel 检查 |
| R3-5 | setup 结果不含设计尺寸 → 多花一次 get_node 查根 frame 宽高 | 遗漏 | `SetupResult` 加 `size` 字段 |
| R3-6 | Phase 2 骨架混入真实促销文案，"周三5折"是 AI 虚构的活动 | 原"骨架禁真实文案"规则打偏：结构性文案（"爆款推荐"）无害且让 CP2 更直观；真正有害的是**虚构营销事实**——它存在于所有阶段，禁骨架文案不解决（Phase 3 照样编，因为没有 checkpoint 问过活动细节） | 规则改"骨架允许结构性标签 + 全阶段禁止虚构具体信息（折扣/价格/日期/地址），未知用 `¥__`/`X折` 可见占位"；CP1 在品牌名之外加问活动细节 |

## 待验证场景（第 4 轮）

- 回归：朋友圈广告重测（JSON 尾部垃圾被救助且带 warning、calc 不再误导性报错、generate_image 直接填占位符、改字体走 font_family 不用 eval、CP1 加问活动细节、骨架无虚构促销信息）
- 护栏（修改）：product_long → 手动改 BrandBar logo/品牌名 → AI 调 validate 报告并**询问**（而非擅自恢复）→ "误改" → AI 用 violation 的 `originalValue` 直接 batch_update 恢复
- 护栏（删除）：手动删 BrandBar 内 readonly 子节点 → validate 报 `readonly_deleted` → 用户确认误删 → 修复模式从组件定义重物化该锚点（新实例 nodeId 重注册，无残留死映射）
- 护栏（有意修改）：手动改 readonly 后声明"有意" → `validate({accept: true})` 重置基准 → 再次 validate 通过
- CP3 图片来源 checkpoint：小红书种草图，验证逐 section 询问/批量指令记忆
- 用户素材识别：拖图入画布后"用这张图做 banner"
- 素材类型切换：公众号封面中途改活动海报，验证 setup 切换模式清理旧内容

## 第 4 轮（2026-07-27）— 视觉回路 V0 首次实测

测试需求：瑞幸咖啡朋友圈广告（方向 C 手绘风，主视觉 AI 生成，后用户要求全英文文案）。**V0 总判：成立**——look 判断可靠（正确识别生图风格不符并驱动重生成）、CP 门禁生效（CP2 骨架先 look 后展示）、基于看图的修复方向正确。CP4 对"能力达不到"的问题降级为声明（AI 主动告知"主图偏写实摄影感"），语义合理。

| # | 现象 | 根因 | 修复 |
|---|---|---|---|
| R4-1 | `generate_image` 请求 2048×1152，**两次都产出 1024×1024**，且无 note 报告调整（工具描述承诺 "reported in note"） | 尺寸映射或报告失效（AI 在 think 里质疑"2048x1152 IS allowed, why 1024x1024?"） | 🔧 待查 `requests.ts` normalizeSize 映射 + note 报告链 |
| R4-2 | look #33/#34 相隔 20 秒对**同一未变节点**重复截图，两张图字节级相同（110877） | 无去重机制；prompt 纪律"不看未变节点"被违反（第三级注入不可靠的又一实锤） | 🔧 工具内去重（`nodeId + sceneVersion` hash，重复返回文本"未变化"）——按方法论从工具层修 |
| R4-3 | 4 张 look 图后单步输入从 37K 膨胀到 **428K**（~150K tokens 是 base64 图片常驻历史） | 图片 tool result 无 elision | 已列入 Phase C media elision——实测确认 P0。好消息：cache 命中 81.7%，前缀缓存机制正常 |
| R4-4 | `generate_image` 一次 schema 校验失败：key 被污染成 `requests\"` | R3-1 变体：模型在 JSON 字符串内错误转义，污染 **key 名**（SDK 层就挂了，parseJsonArrayParam 管不到） | 观察（AI 自我恢复）；复发再考虑 SDK 层 key 名救助 |
| R4-5 | `update_node` height 648→644→648 来回抖动（想修 "gap 20 not on 8px grid" warning） | lint 信噪比问题未根治：8px grid warning 诱导无效修改（R3-4 同类） | grid warning 降级为 info（视觉回路接入后纯数值 warning 应弱化） |
| R4-6 | `set_text` 的 debug log `changed` 快照带一大坨 `source` fig 元数据 | nodeBefore/nodeAfter 快照序列化了 source 字段 | 🔧 快照剔除 source（与 sanitizeForLog 同类） |
| R4-7 | 方图 cover 裁剪进 2.31:1 占位符，AI 在 think 里纠结但**无工具路径**解决 | IMAGE fill 裁剪模式不可调 + 生图尺寸受限（R4-1 放大此问题） | 叠字 hero 改造后自然缓解（图做 Frame 背景，cover 出血是设计常态）；另加 prompt 规则：占位符比例按生图枚举设计 |

**附带发现（设计层面，非错误）**：Agent 不产出"文字压图"的 hero 布局——根因是 `generate_image`/`stock_photo` 只填叶子形状（Rectangle 不能装子节点），叠层只能靠绝对定位（要 calc、碰 lint、无示例），AI 在 think 里推演一屏后退回"图下文"的零成本路径。**修法**：图片工具支持填 Frame 背景（代码本无限制，`generate_image` 仅描述限制、`stock_photo` 有代码 guard），hero 模式改为 Frame 背景图 + flex 文字子节点。

**token 观测**（A0 解散后首次数据点）：单需求 25 步，总输入 2.26M tokens，cache 命中 81.7%。look 引入前（step 18）单步 37K，4 张图后 428K——单图 base64 约 100-150K chars（≈30-40K tokens）常驻，证实 Phase C media elision 的 P0 优先级。

**修复状态（2026-07-27 当日完成）**：

- **R4-1 ✅ 已修**：根因确认——`apply.ts` 的 id 模式**无条件**用目标节点尺寸回填，覆盖显式请求（2048×1152 → normalizeSize(1016×440) → 1024×1024）。修复：尺寸回填仅在未显式给宽高时生效（`req.width === undefined || req.height === undefined`）。
- **R4-2 ✅ 已修**：`look` 工具内去重——FNV-1a 字节哈希按 `WeakMap<SceneGraph, Map<nodeId, hash>>` 缓存，同节点未变返回文本"未变化，参考上次检查"，不再重复发图。
- **R4-6 ✅ 已修**：debug log 节点快照剔除 `source` 字段。
- **叠字 hero ✅ 已修**：`generate_image`/`stock_photo` 开放 Frame 背景填充（stock 删 has-children guard，两工具描述同步），prompt Hero pattern 改为 Frame 背景图 + flex 文字子节点（附 JSX 配方 + 可读性三件套：text shadow / 深色 scrim / 避开图像繁忙区）。
- **待下轮冒烟验证**：叠字 hero 产出、look 去重行为、R4-1 显式尺寸生效、护栏场景回归。

## 第 5 轮（2026-08-11）— 海报感实验：端午长图冒烟（watercolor_poster_v1）

测试需求：端午活动 product_long 长图（需求单驱动，方向 C 淡彩薄荷，全部图片 AI 生成）。环境：MiniMax-M3 + 视觉通道 B；34 步 / 38 次工具调用（15 次 mutation）/ 输入 1.29M tokens（cache 命中 97%）。

**总判：部分成效（偏好）**——结构验收 6/6 全落地（BackgroundLayer 拓扑 / 三段 stop / `color_source: sampled` / bleed 遮缝 / 标题不洗色）；Phase 2.5 主路径恰好 3 调用（generate_image → compose_backdrop → look），零几何零 hex 转抄如设计。正面信号：Anti-identity 主动拦截了一次垫字色块（agent 自述引用禁令撤回 `#FFFFFF80` 卡片——但见 R5-4 的精度问题）；vision 置信协议两次起效（R5-5）。

| # | 现象 | 根因 | 修复 |
|---|---|---|---|
| R5-1 | hero 标题 88px 白字落在"平静米白底"（采样实测 #EFEDD9）上，对比度 ≈1.1:1；profile 官方补救（重生图）对此无解——底带已是最佳平静度，问题在影调方向 | **profile Fixed 段内部矛盾**："浅色平静低细节底带"与"白字 + 阴影"预设天然冲突（prompt 规则缺失/打偏，profile 层） | ✅ profile 写入"影调 ↔ 字色"配对规则（浅平静底→深墨字 / 浓郁底→白字，生图 prompt 显式声明）；agent 当轮自行改深墨 #2E3A33 + 白发光解决 |
| R5-2 | `batch_update` 传 color/shadow 返回 `{"updated":0}`，无 errors 无 warning | `applyBatchProps` 不支持的 props 使 op 凭空消失（工具/代码缺陷） | ❌ 未修——合并面决策（batch.ts 为 M 类低危，本轮不动；见 fork-divergence §6 2026-08-11）。agent 当轮自行降级到 set_fill |
| R5-3 | agent 用 `eval` 手写 raw API 给文字加白色发光，而不知有 `set_effects` 专用工具 | prompt 只提 render 期 `shadow=` helper，未提修改期工具（prompt 规则缺失） | ✅ marketing.md CP 段接线"改已有节点效果用 set_effects，不要用 eval" |
| R5-4 | agent 引用 Anti-identity "No opaque plates" 撤掉了 `#FFFFFF80`（50% 透明）信息卡——**字面上该卡并不 opaque**；禁令被从 hero 标题带泛化到正文区 | Anti-identity 条目无作用域与可判定判据（prompt 规则打偏，profile 层）。所幸结果无害（look 证实无卡也可读） | ✅ 禁令拆作用域："In the HERO slot"（禁 alpha=1 垫块）/ "In CONTENT sections"（禁割裂背景色块，允许 alpha<0.5 可读性辅助） |
| R5-5 | 通道 B 两次误判：①幻觉"标题粉色描边"；②误判"流苏压字"并建议加 scrim（恰好是 profile 明令禁止的反模式） | 视觉模型固有噪声（视觉误判——**该预留分类首次启用**） | ✅ 无需修：agent 零采纳违规建议，用 original-bytes look（纯图无字）结构性解决冲突——L1/L3 设计起效。代价 +2 次 look |
| R5-6 | `generate_image` 请求 750×850 被 API 对齐为 768×864，静默打破 profile "1:1 无 cover-crop" 承诺（内容图更夸张：288×384→704×944） | API 16px 对齐 + 尺寸约束（工具描述与 prompt 矛盾的近似形态——note 有披露但 profile 措辞绝对化） | ✅ profile 措辞降级 approximately + plan 已知限制之二；采样带映射误差 ~2% 视觉无害 |
| R5-7 | 需求单首句"画布命名为端午海报"，全程 38 次调用未 rename——根帧最终仍叫"产品长图" | 工作流无命名承接步骤，checkpoint 不覆盖命名类要求（prompt 规则缺失） | ❌ 忽略不做（2026-08-11 决策：小问题，用户可在画布侧自改；若复发再升级为 setup/CP1 承接） |
| R5-8 | SachetImg 首次 "Failed to fetch"（重试成功）；GiftBox1 首图薄荷绿不符"白色带传统图案"（look 后重生成功） | 暂态网络错误 / 生图 prompt 色彩主导词不突出 | 观察——look-after-generate 纪律两次都接住了，流程内自愈 |
| R5-9 | 日志头部媒体投递告警："media tool-result outputs are NOT in content form — the image was serialized as JSON text (toModelOutput wiring broken)"，1 degraded | toModelOutput 接线断——通道 A 下图片会被序列化为 JSON 文本喂给主模型（本环境主模型无视觉，靠通道 B 未受影响）（工具/代码缺陷） | ❌ 未修（合并面决策：真修碰 transports.ts 高危文件，收益不抵合并成本；若将来修，优先在 media-tool-results.ts 单侧解决） |

**结论去向**：三层边界固化成立（结构 6/6），profile 驱动的 Phase 2.5 骨架通用性待 R6 对照组验证。量化指标本阶段停用（见 task plan 附记之三决议一）。

## 第 6 轮（2026-08-14）— 像素先行管线首次冒烟（watercolor_poster_v3，预存物业费长图）

测试需求：虚构品牌"悦然物业"预存物业费活动 product_long，用户全权放手（"不用问我"）。环境：MiniMax-M3 + 视觉通道 B；23 步 / 61 次工具调用（44 次 mutating）/ cache 命中 95%。首个中文 profile（v3）+ 两个新工具（prepare_hero_scaffold / derive_palette）首次实战。日志在生图重试处截断，幽灵文字参考图的构图效果待下轮验证。

**正面信号**：CP1 无 hex 提案生效（方向记录为"水彩叠染，analogous，粉桃+嫩绿"，零编造 hex）；骨架色彩中立生效（hero 标题临时深色，等色票）；`prepare_hero_scaffold` 一次成功（几何/克隆/note 指引链完整）；中文 profile 被正常理解执行。

| # | 现象 | 根因 | 修复 |
|---|---|---|---|
| R6-1 | 生图模型忽视画框参考图——agent 的 prompt 只有抽象分区描述，通篇未点破参考图用法 | **v3 翻译时动作指令降级为状态断言**（"生图 AI 看着文字构图"是断言不是指令）；旧英文骨干有 "compose AROUND the text" 的明确指令模板（prompt 规则打偏，profile 层） | ✅ 三处：工具 note 加 CRITICAL 段（参考图不点破必被忽视）；v3 第 3 步改为语义清单（四条缺一不可）；marketing.md 画框示例同步。**方法论新规则：profile 改写/翻译时，动作指令不得降级为状态断言** |
| R6-2 | `weight="Heavy"` 静默回退 400，agent 被迫发 ~20 次 update_node 补丁（占 mutating 45%） | design-jsx WEIGHT_MAP 仅 3 档 + `?? 400` 静默兜底（工具/代码缺陷） | ✅ 字重映射改为复用 scene-graph `FONT_WEIGHT_BY_STYLE`（唯一事实源，heavy/black→900——本地 map 一度漂成 800，已对齐）；未知名经 render 的 warnings 通道透出；prompt 词汇表三处对齐 |
| R6-3 | `batch_update` 传 font_weight 返回 `updated:0` 且无提示（**R5-2 同型复发**） | applyBatchProps 静默吞未知 prop（工具/代码缺陷） | ✅ 支持 font_weight；未知 prop 进该条 errors 并附全量支持清单 |
| R6-4 | `generate_image` 传 `quality:"hd"` 被 provider 拒绝（合法值 low/medium/high/auto），浪费一次生图调用 | 参数裸 `as` 强转无校验 + 工具描述未列枚举（工具/代码缺陷） | ✅ 本地校验（报错列合法值）+ `hd`→`auto` 别名（模型常送 hd 试图获得高质量，默认 auto 避免超时）；output_format/background 同类裸转一并补校验 |
| R6-5 | 骨架期模型编了三个强调色 hex（#C2410C/#BE185D/#0F766E）——正是 derive_palette 要消灭的行为，但 Phase 2 时色票尚不存在 | **流程时序缺口**：骨架需要颜色时色票未派生（工作流设计缺口） | ✅ v3 第 1 步"骨架期全部中性灰阶，着色元素不写彩色 hex"；第 5 步"色票出来后统一刷色"。无 hero 品类的色票接入仍待后续任务 |
| R6-6 | 文本 section 固定高度猜小了溢出 ×5（S1/S2/S3/S4/S5 各补一次加高） | 固定高度猜文本内容必然溢出（prompt 规则缺失） | ✅ hug 高度指引进 marketing.md Phase 2 与 v3 第 1 步（文本 section 用 hug，固定高度只给图像槽位） |
| R6-7 | 信息卡 bg alpha 0.7/0.6，超 profile "alpha<0.5 半透明辅助"纪律 | prompt 层约束无 critique 兜底（已知弱点） | ❌ 不修——记为 critique 候选（卡片 fill alpha 扫描） |
| R6-8 | 刷色票时 agent 把文字和文字下的色块刷成同一颜色，文字隐形 | **derive_palette 三角色撞色**：ground/ink.onDark/neutrals[0] 同为 L0.96 同色相，对比精确 1.00；`ink.onDark` 命名被读反（"深色的字" vs 本意"深底上的浅字"）；无配对白名单（工具设计缺陷） | ✅ neutrals 阶梯改 [0.90, 0.72, 0.50]（构造上不可能再撞色）；新增 `pairings` 白名单表 + checks 扩为 6 对全覆盖；配对纪律进工具 note 与 v3 第 5 步。附带红利：浅种子下 ink.onDark/wash 自动 pass:false——**R5-1 型事故在派生时刻即被拦截** |

**结论去向**：管线前半程（CP1→骨架→画框）按设计跑通；R6-1 修复后需重跑一张验证幽灵文字参考图的实际构图效果（本任务风险最高点仍未闭环）。derive_palette 的配对表机制首轮即暴露设计缺陷（R6-8）并当日修复。

## 错误分类约定

后续追加时按类标记，便于统计模式：

- **prompt 规则缺失/打偏**（R1-1、R1-4、R2-2~R2-6、R3-6、R6-1、R6-5、R6-6、R6-7）
- **工具/代码缺陷**（R1-3、R2-7、R3-1、R3-3、R3-5、R6-2、R6-3、R6-4、R6-8）
- **工具描述与 prompt 矛盾**（R3-2）
- **lint 信噪比**（R3-4）
- **致命工作流断裂**（R2-1）
- **视觉误判**（预留，视觉回路接入后启用）
- **注入面污染（实验/开发脚手架信息泄露进 agent 可见内容）**——海报感实验中三次同型（2026-08-10/11，评审发现而非冒烟发现）：① `watercolor_poster_v1_center_left` 含 `## Purpose` 节与 "for A/B testing" 表述；② v0 标题带 "(legacy baseline)" 标签；③ center_left 正文引用 `watercolor_poster_v1`（"read that profile first"）。①② 是评估者视角元信息偏置 agent 行为；③ 更隐蔽——profile markdown 是选中后**唯一**注入 agent 上下文的 profile 内容（`buildMarketingOverlay` 只注入选中者、目录不泄漏），跨 profile 引用在运行时不可达，被引规则静默失效（若未发现，R6 对照 c 臂在无约束下运行，A/B 结论失真）。**规则：profile 必须自包含、只承载风格指令；实验设计只存在于 id 命名、代码注释与任务文档。** 守卫：`tools/marketing-library/tests/generate.test.ts` "profiles never cross-reference each other"（词边界正则，防 id 前缀误报）。

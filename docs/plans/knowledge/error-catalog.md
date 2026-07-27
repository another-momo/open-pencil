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

## 错误分类约定

后续追加时按类标记，便于统计模式：

- **prompt 规则缺失/打偏**（R1-1、R1-4、R2-2~R2-6、R3-6）
- **工具/代码缺陷**（R1-3、R2-7、R3-1、R3-3、R3-5）
- **工具描述与 prompt 矛盾**（R3-2）
- **lint 信噪比**（R3-4）
- **致命工作流断裂**（R2-1）
- **视觉误判**（预留，视觉回路接入后启用）

# Task: 工具体系与系统提示词系统优化包

日期：2026-08-15（同日三轮修订：T0 暴露面方案改裁 + 评审修正吸收）
状态：T0–T10 已实施（2026-08-15）；T11 单元层/渲染层/profile 层验证已通过，pixel snapshot 已通过；端到端重跑待真实模型环境执行
依据：`docs/review/2026-08-15-tool-system-review.md`（watercolor_poster_v3 复盘）+ 三轮复核（review 中部分断言已逐条核验/修正，见文末附录）
范围：`packages/core/src/tools/**`（含 `registry-core.ts` / `registry-extended.ts`）、`packages/core/src/figma-api/accessors/visual.ts`、`packages/core/src/canvas/fills.ts`、`packages/core/src/canvas/scene.ts`、`src/app/ai/chat/system-prompt-*.md`、`tools/marketing-library/src/generate.ts`、`docs/plans/knowledge/methodology.md` + 对应测试

## 背景与目标

watercolor_poster_v3 测试暴露三类根因：① 修改类工具能力边界不透明（batch_update 白名单不文档化、proxy fills setter 不补默认、eval 沙箱限制无警示）；② fork 重组后硬约束散落/漂移；③ 缺少"工具能力上下文该放哪"的归属机制。复核追加第四类：④ **提示词引用的工具与内置 agent 实际可见的工具集脱节**——且该脱节有重复实证链：旧 system-prompt 的 `export_image` 禁令是"对不存在的工具立规矩"（2026-07-29 review #9）、`marketing.md:21` 引用 extended-only 的 `set_effects`、本计划初稿 T3/T5/T8 同样引向非 core 工具。

本任务按"代码治本 → prompt 教学 → 机制防漂移"三层推进。**核心原则：能改代码堵住的，不用 prompt 堵；必须在多处出现的约束，建立单一真源 + 漂移检测，不靠人工同步；prompt 只允许引用内置 agent 实际可用的工具。**

## T0 — 工具暴露面对齐：modify 域整体提升 + structure 高频操作（P0，T3/T5/T8 的前置）

**为什么**：内置 agent 只挂 `CORE_TOOLS`（30 个，`registry-core.ts`；接线在 `src/app/ai/tools/index.ts:130-133`，ui 模式再过滤 5 个 marketing-only），`EXTENDED_TOOLS` 只服务 MCP/CLI。不先对齐暴露面，T3/T5/T8 写出来的映射会把模型送进死胡同。

**方案对比与裁决**：初稿采纳"精准提升 `set_effects` 一个"；对照独立评审主张"modify 域 13 个 extended 工具整体提升"。核验后**采纳后者**，理由：

1. **需求证据的适用范围**：初稿以 marketing 日志无调用为据判定 `set_rotation`/`set_blend` 等"无需求"，但内置 agent 的 ui 模式是通用设计助手——旋转/锁定/混合模式是通用设计会话的高频诉求；无工具时 agent 只剩 eval 绕路（最危险路径）或拒答。单次营销日志的"未调用"不能证否通用需求。
2. **token 账**：13 个 modify 工具 schema 约 +800 tokens（~3K → ~3.8K），128K+ context 下可忽略；一次工具缺失引发的 eval 绕路/报错重试浪费（review 记录 font_size 翻车 4 步 ≈ 8K tokens）是其十倍量级。
3. **能力唯一性**：13 个里 9 个是 update_node 完全无替代的能力（`set_effects`/`set_font_range`/`set_rotation`/`set_constraints`/`set_minmax`/`set_image_fill`/`set_stroke_align`/`set_blend`/`set_locked`），3 个与 update_node 重叠（`set_opacity`/`set_visible`/`set_text_resize`），1 个部分重叠（`set_font`，价值在字体三件套原子操作）。
4. **分界维护已三次失败**：保留"modify 域内还要记谁在 core"的分类，就是保留一个没人维护得住的检查点。其他域（variables / vector / codegen / analyze / 高级 structure）维持 extended 不动——使用频率低、schema 开销大、prompt 从未引用。
5. **爆炸半径确认**：`CORE_TOOLS` 消费方只有内置 chat（及 `tests/engine/chat/elision.test.ts`），MCP/CLI 走 `ALL_TOOLS` 不受影响。

不走"超级工具"路线（把 rotation/blend/effects 塞进 update_node）：update_node 已是单节点泛用工具，再扩会与 set_* 形成平行路径漂移，加重 review 批评的职责重叠问题。

**structure 域的补充裁决**（同一评审建议 `clone_node`/`rename_node`，核验后采纳并补完同线工具）：
- `clone_node`（1 参数，`structure/basic.ts:19`）：唯一能力，core 无复制路径（getJSX + render 重建是绕路）；"复制这个卡片/section 做变体"是通用+营销双高频。
- `rename_node`（2 参数，`structure/basic.ts:34`）：与 `update_node.name` 重叠，但"重命名"是独立意图入口，按重叠工具的指路标注处理。
- **同线标准**：唯一或近唯一能力 × 通用会话高频 × schema 极小 × 无平行路径。按此标准 `group_nodes`/`ungroup_node`（`structure/hierarchy.ts:23/41`，"把这些打组"同为高频图层基础操作）完全同线——**一并提升**，否则同一问题下周再来一次。
- 不开新先例：structure 域本来就有 4 个 cherry-pick 在 core（`delete_node`/`reparent_node`/`node_resize`/`batch_update`），本次是延续"高频单意图场景操作入 core"的既有格局，不是新建分界。
- structure 域其余工具（`node_move`/`arrange_nodes`/`flatten_nodes`/`node_to_component`/图检视类 `node_tree`/`node_children` 等）维持 extended——低频或有 core 替代。

**怎么做**：
- `registry-core.ts`：把 `registry-extended.ts` Modify (advanced) 段的 13 个工具 + structure 域的 `cloneNode`/`renameNode`/`groupNodes`/`ungroupNode` 移入 CORE_TOOLS，EXTENDED_TOOLS 同步移除。
- 与 update_node/batch_update 重叠的工具（`set_opacity`/`set_visible`/`set_text_resize`/`set_font`/`rename_node`）description 末尾加**指路标注**："for single-node changes prefer update_node; for bulk prefer batch_update"——写主动指向而非仅"可替代"，避免选择困难。
- marketing.md:21 引用在提升后即合法，文案不动，末尾补顺序规则"shadow/blur 改 bounding box，放最后做"（与 T8 模板同源）。
- 立规写入 `docs/plans/knowledge/methodology.md`：**prompt 文件只允许引用 CORE_TOOLS 中的工具名**；由 T9(c) 测试强制（modify 域抹平后，分界仍存在于 variables/vector 等域，规则不过期）。

## T1 — fills 写入路径补默认值（P0，治本）

**为什么**：`visual.ts:22-33` 的 fills proxy setter 是 `{...fill}` 简单展开，不补 `opacity`/`visible`/`blendMode`。eval 里 `t.fills = [{type, color}]` 会写入 `visible: undefined` 的 fill，paintFills 的 `if (!fill.visible) continue` 直接跳过 → 文字隐形。这是本次测试最严重事故的根因。修这一处，eval / 未来任何 mutation 路径都自动安全。（旁证：`set_fill` 的 execute 显式写 `opacity:1, visible:true`（`modify/paint.ts:57`），所以专用工具路径一直安全，陷阱只在 eval/proxy 裸写路径。）

**怎么做**：
- `packages/core/src/figma-api/accessors/visual.ts` setter 改为**保留展开 + 默认值后置兜底**（`...fill` 保留 image fill 的 `imageRef`/`scaleMode`、渐变的 `gradientTransform` 等字段；默认值放展开之后、用 `??` 兜底，这样调用方显式传 `visible: undefined` 也不会盖掉默认值）：

```typescript
fills: value.map((fill) => ({
  ...fill,
  opacity: fill.opacity ?? 1,
  visible: fill.visible ?? true,
  blendMode: fill.blendMode ?? 'NORMAL',
  color: normalizeColor(fill.color),
  gradientStops: fill.gradientStops?.map((stop) => ({
    ...stop,
    color: normalizeColor(stop.color)
  }))
}))
```

- 注意 review 原稿建议的写法去掉了 `...fill` 展开，会裁掉非 SOLID fill 的字段——**不可采用**。
- strokes setter 同文件检查同款问题，一并处理。

## T2 — paintFills / strokes 防御性判断（P0，纵深防御）

**为什么**：`fills.ts:25` `if (!fill.visible) continue` 把 `undefined` 当不可见。即使 T1 修好 setter，历史文档/外部导入的 fill 仍可能缺 `visible`。Figma 语义里 visible 默认 true，当前判断方向反了。

**怎么做**：
- `packages/core/src/canvas/fills.ts` 改为仅 `fill.visible === false` 才跳过。
- `setAlphaf(fill.opacity)`（fills.ts:31）对 `undefined` 回退 1（`fill.opacity ?? 1`），避免 NaN alpha。
- strokes 的同款判断**不在 fills.ts**，在 `packages/core/src/canvas/scene.ts:331`（`if (!stroke.visible) continue`）及 `boolean.ts:94/311`——逐处改为 `stroke.visible === false` 才跳过，并同步检查 `stroke.opacity` 的 NaN 风险。

## T3 — batch_update 白名单单一真源 + 反向清单（P0）

**为什么**：白名单实际 17 项（review 全文误写 16），且**工具 description（batch.ts:123-124）只列了 15 项，漏了 `align` 和 `opacity`**——description < SCENE_PROP_MAP = 报错信息，三层互不一致，这是模型脑补 `font_size` 的直接温床。另：batch_update **完全没有 fill 处理能力**（review 第三节"改 fill 走专用路径 ✅"系误述，已核验推翻）。

**怎么做**：
- `packages/core/src/tools/structure/batch.ts`：description 的支持项列表**从 `SCENE_PROP_MAP` 的 keys 生成**，不再手写——消除 description/map/报错三层漂移。
- description 末尾追加反向清单（T0 后所列替代工具均为 core 成员）：`**NOT supported** (use per-node tools instead): font_size / text → update_node; fills → set_fill; effects → set_effects; rotation → set_rotation; blend_mode → set_blend; letter_spacing / line_height / text_case → no post-render tool, set at render time`。一句话说清设计定位：layout micro-fix 批量工具，破坏性重排（font_size 级联行高 → hug 容器塌陷）不走批量。
- 报错信息复用同一份生成逻辑（batch.ts:150 已从 map keys 生成，保持），保证三处永远一致。

## T4 — eval 工具契约补全（P0）

**为什么**：eval 是最危险的逃生舱但零警示（`tools/analyze/eval/index.ts:7-8` 的 description 只有两句话）：`getNodeByIdAsync` 不存在、`loadFontAsync` 是 no-op（`figma-api/index.ts:504-506`）、模型自己 return 的循环计数不代表落地、fills 替换陷阱（T1 修复前致命、修复后仍属反模式）。

**怎么做**：
- eval 工具 description 追加技术约束段。措辞需准确：eval 代码在 async 函数体内执行（`eval/index.ts:17-19` 用 AsyncFunction 包裹），**可以 await**，但 figma 对象上没有 `*Async` 方法（`getNodeByIdAsync` 不存在；`loadFontAsync` 存在但是 no-op，改字体直接赋 `fontName`）；返回值就是代码 return 的东西，**循环计数 ≠ 写入确认**，批量改后必须 `describe` 抽样验证；批量改 font/fill 优先 `batch_update`/`set_fill`/render `replace_id`，eval 是最后手段。
- ~~检查 eval 返回值结构：counter 类字段名改为明示语义~~——**已核验撤回**：eval 返回值就是用户代码的 return 值或 `{ok:true,message}`（`eval/index.ts:21-26`），工具本身没有内置 counter 字段，无对象可改。只保留 description 里的"计数 ≠ 落地"标注。

## T5 — base.md 补「属性 → 工具」映射（P1）

**为什么**：21 个 modify 工具 + batch_update，没有任何单一工具能改所有属性，"哪个属性走哪个工具"从未被教学。模型只能撞错误回执后重试（本次日志浪费 4 步）。T0 后整套 modify 栈对内置 agent 全部可见，映射表可以写全、写准。

**怎么做**：
- `src/app/ai/chat/system-prompt-base.md` Tool discipline 段后追加映射表（~25 行），内容以 review §二的映射为准，关键落笔：
  - fills/文字色 → `set_fill`（**不要写 batch_update**——它不支持 fills）；
  - 字体三件套 → `update_node` 或 `set_font`（后者一次原子；批量 family/weight 走 `batch_update`）；
  - 阴影/模糊 → `set_effects`（改 bounding box，放最后做）；
  - rotation → `set_rotation`；blend → `set_blend`；
  - ❌ 无工具项 letter_spacing / line_height / text_case → render 时定死（JSX DSL 支持 `lineHeight`/`letterSpacing`/`textCase`，已核验 `design-jsx/render.ts:109-112`）。
- 表内不写 batch_update 白名单细节，只写一句"白名单以工具 description 为准"——遵守 T3 的单一真源，避免第九节真源表自己成为新的漂移源。

## T6 — base.md eval 规则收敛为引用制（P1）

**为什么**：技术约束的真源应该在 eval 工具 description（T4），prompt 只做策略层。复核更正：marketing.md 中**没有**与 base.md 重复的 eval 规则——唯一提及是 :21 的 effects 特有规则（"never reach for eval to set effects"），属 marketing 场景特有，不删。原"删除重复规则"无对象。

**怎么做**：
- base.md 的 eval 条目收敛为策略句："不要用 eval 调试布局（删了重渲）；不要用 eval 批量改 font/fill——技术约束见 eval 工具描述"。
- marketing.md 不动。

## T7 — marketing.md 校验节奏：从"补规则"转向"强化机制"（P1）

**为什么**：复核发现 review 的 P1 #5 定性错误——marketing.md:151-152 **已有** "IMMEDIATELY describe the new node — never skip, never defer" + batch_update fix 两条规则。本次失败不是规则缺失，是规则未被遵守（6 个 section 连渲后才 describe）。再抄一遍规则不会改变命运。

**怎么做**：
- 不加新规则。改为强化现有规则的可见性：把"render → describe → fix → next"从编号列表第 4-5 条提升为该 workflow 段的**显式 checkpoint 句式**（与已有 3 个 checkpoint 机制同构，例如每个 section 结束时 AI 必须输出一行自检：`section X: rendered → described (N issues) → fixed`）。
- 顺手修 review 指出的真问题：`export_image` 禁用规则在 fork 中丢失（原版 system-prompt.md:214），补进 base.md Tool discipline。注意措辞要与暴露面一致：`export_image` 本身在 EXTENDED_TOOLS、内置 agent 调不到（2026-08-01 review 确认导出是用户操作而非 agent 任务），规则写成"不要用 eval/任何方式让 agent 导出图片——导出是用户操作"更准确。`viewport_zoom_to_fit` 不需要补——base.md:96 已保留其防重复调用规则（review 此条误判）。

## T8 — profile 刷色场景工具模板（P1）

**为什么**：watercolor_poster_v3 第 5 步"色票出来后统一刷色"是 profile 设计的必经路径，但没给工具调用模板。注意复核结论：AI 并未"完全跳过 Phase 2.5"（#33-39 实际执行了 scaffold/generate/compose/derive 全链），问题是**刷色动作本身用 eval 裸改 fills 实现**——模板缺失正是缺口。

**怎么做**：
- 编辑 `tools/marketing-library/src/generate.ts` 中 `watercolor_poster_v3`（:637 起，及同类 profile 模板）的 derive_palette 之后段落，追加工具调用模板：
  - 文字色/强调色 → `set_fill` 逐节点；
  - 字号微调 → `update_node.font_size`（明示 batch_update 不支持 font_size）；
  - 字体切换 → `batch_update font_family` 或 `set_font`（一次原子）；
  - 阴影 → `set_effects` 最后做（改 bounding box）；
  - 刷完 `describe` 抽样验证 fill 完整性。
- **改完必须重新生成产物**：`bun tools/marketing-library/src/generate.ts` 重建 `public/default-library.fig`，并跑 `bun test tools/marketing-library/tests/` 确认 round-trip 守卫通过（AGENTS.md 要求）。

## T9 — 描述漂移检测测试（P2，机制）

**为什么**：T3 消除的是 batch_update 一处漂移，但"工具 description 与实现不一致"是系统性风险（已发现的实例：batch description 漏 align/opacity；`set_text_properties` description 提到 text case 但无此参数）。

**怎么做**：
- `tests/engine/tools/` 新增一致性测试：遍历 registry 所有 ToolDef，断言 (a) description 中提及的 prop 名在 params schema 中存在；(b) batch_update description 生成的支持项列表与 SCENE_PROP_MAP keys 相等；(c) prompt 文件（base/marketing）中提到的工具名都在 **CORE_TOOLS** 中存在——不是全量 registry（`marketing.md:21` 引用 extended-only 的 `set_effects` 就是全量检查会漏、CORE 检查能抓的实例）。T0 后 modify 域不再触发 (c)，但 variables/vector/codegen 等域的分界仍在，守卫继续有效。
- **接线是硬要求**：`bun run check` 不含 `test:unit`（已核验 package.json：check = lint + tsgo + test:tools + test:dupes 等），放进 `tests/engine/` 不会自动成为看门狗。须新增 `check:tools-consistency` script 只跑这一个测试文件并挂进 `check` 链（单文件、无 CanvasKit 依赖，不违反 AGENTS.md 的单测范围指引）。

## T10 — 返回值契约统一 + 归属机制立规（P2）

**为什么**：render 返回新节点 ID（清晰）、eval 返回模型自写 counter（误导）、batch_update 部分执行（混合态 `{updated:2, errors:[...]}`，模型易当成全成功）。

**怎么做**：
- batch_update：有 errors 时返回顶层加 `partial: true` 标记，description 里写明"partial: true 时必须处理 errors 再继续"。
- eval：见 T4，description 标注"计数 ≠ 落地"（无字段可改名）。
- 统一约定写入 `docs/plans/knowledge/methodology.md`（只追加），作为后续新工具的返回值设计规范。
- 同文追加 review §六的**三层归属模型**（Tier 1 工具契约 → description / Tier 2 跨工具节奏 → system prompt / Tier 3 领域特例 → profile）+ 判定流程 + "prompt 只引用 CORE_TOOLS"规则（T0），作为"这条约束该写在哪"的常设判定标准。

## T11 — 回归验证（P2，收尾）

**怎么做**：
- 单元层：fills setter 补默认（SOLID 缺字段 / 显式 `visible: undefined` 兜底 / IMAGE fill 字段保留 / 渐变 stops 归一化）；paintFills 与 scene.ts strokes 路径对 `visible: undefined` 不跳过；batch_update 未知 key 仍部分执行且反向清单文本与 map 一致；registry 变更后 CORE_TOOLS 含全部 13 个 modify 工具 + `clone_node`/`rename_node`/`group_nodes`/`ungroup_node`，ALL_TOOLS 无重复。位置：`tests/engine/` 就近既有 tools/figma-api 测试目录。
- 渲染层回归：fills.ts / scene.ts 属渲染层改动，按 AGENTS.md 单测范围指引跑 **render 组非重型套件**（不只跑就近文件）。
- 像素层：fills/strokes 改动属 AGENTS.md 要求的 pixel-affecting 变更，补/更新 Playwright canvas snapshot（`tests/e2e/canvas/renderer-visuals.spec.ts`）。
- profile 层：T8 改完跑 `bun tools/marketing-library/src/generate.ts` + `bun test tools/marketing-library/tests/`。
- 端到端层：T1-T8 全部落地后重跑 watercolor_poster_v3 同 prompt。**判定标准**：4 个验收点全中才算通过（body 文字可见；字号修改走 `update_node` 而非 batch_update；刷色走 `set_fill` 而非 eval；每 section render 后紧跟 describe）；未全中时记录差异、归因（prompt 没教到 / 模型方差），模型方差项允许补跑一次确认，仍不中则回到对应 T 项修。
- review 第八节回归用例 4 修正后纳入：期望工具是 `set_fill`（~~batch_update fill.color~~ 不可执行，已核验 batch_update 无 fill 路径）。

## 验证

`bun test tests/engine/tools/**` + 相关 figma-api/canvas 测试文件 + render 组非重型套件；`bun run check`（含新增 check:tools-consistency）；pixel snapshot 按 AGENTS.md 流程 `--update-snapshots` 后复跑确认；`bun tools/marketing-library/src/generate.ts` + `bun test tools/marketing-library/tests/`；T11 端到端重跑日志落档 `docs/test-log.txt` 或新文件。

## 明确不做

- 不新增 `set_typography` 工具（review 可选 #16）——先观察 T5 映射表 + render 定死是否够用，避免工具栈进一步膨胀。
- 不做 batch_update `font_size_tolerance` 软上限（review 可选 #15）——白名单定位保持"轻量微调"，不搞灰色地带。
- 不合并 describe / get_node / batch_get 的职责重叠三角，不动 look / get_screenshot 分工——属于工具栈重构，单列任务。
- 不合并 modify 栈内部与 update_node 重复的单功能工具（`set_opacity`/`set_visible`/`set_text_resize` 等）——T0 以 description 指路标注缓解选择困难；物理删除/弃用涉及 MCP/CLI 兼容，单列任务评估。
- 不把 variables / vector / codegen / analyze 域及 structure 域其余工具（`node_move`/`arrange_nodes`/`flatten_nodes`/图检视类等）提升入 CORE——低频、schema 开销大或有 core 替代，维持分界。
- 不恢复原版 572 行的完整长示例（review #9）——成本与 token 占用需单独权衡，与本包解耦。
- 不改 eval 沙箱支持 async API——同步 API 面是架构决定（eval 代码体本身可 await，缺的是 figma 对象上的 `*Async` 方法），只补文档不补能力。
- 不做 render / look / describe 工具 description 的全面自洽改写（review P1 #7）——T9 测试先把"不一致"变成红灯，改写按红灯逐项来，不在本包批量进行。

## 附录：复核与裁决记录（本计划已吸收）

**一轮复核（对 review 的修正）**：

1. 白名单是 17 项非 16；工具数实际 21 个 modify + batch_update（review 中 16/13/22 三个版本均不准）。
2. "AI 完全跳过 Phase 2.5"不成立——#33-39 执行了完整图像链；真实问题是刷色动作用 eval 裸改 fills。
3. marketing.md 已有 render→describe→fix 规则（:151-152），P1 重心从"补规则"改为"强化机制"（T7）。
4. batch_update 无 fill 能力，review 第三节对比表与回归用例 4 相关表述已核验推翻。
5. review 的 P0 #1 修复代码丢弃 `...fill` 展开有回归风险，T1 已改为展开保留 + `??` 后置兜底写法。
6. viewport_zoom_to_fit 规则未丢失（base.md:96）；真正丢失的是 export_image 禁令（补写时注意 export_image 本身不在 CORE_TOOLS，见 T7）。
7. 复核新发现：batch description 漏列 align/opacity；set_text_properties description 提及 text case 但无参数——分别并入 T3/T9。

**二轮复核（计划自评修正）**：

8. a) 内置 agent 只挂 CORE_TOOLS（`src/app/ai/tools/index.ts:130-133`），`marketing.md:21` 引用 extended-only 的 `set_effects` 是现存悬空引用 → T0；b) strokes 的 `!stroke.visible` 同款判断在 `scene.ts:331`/`boolean.ts:94/311`，不在 fills.ts → T2；c) eval 无内置 counter 字段，返回值即用户代码 return 值 → T4 撤回改名项；d) `bun run check` 不含 test:unit，漂移测试须显式接线 → T9；e) watercolor_poster_v3 profile 实体在 `tools/marketing-library/src/generate.ts:637`，改动须再生成 default-library.fig → T8/验证节。

**三轮裁决（T0 方案改裁）**：

9. T0 从"精准提升 set_effects 一个"改为"modify 域 13 个 extended 工具整体提升"——对照独立评审建议，核验后采纳。改裁理由：a) 内置 agent ui 模式是通用设计助手，初稿"无需求证据"的样本局限在单次 marketing 日志；b) token 成本 ~800 对比一次工具缺失翻车的 ~8K 重试浪费，数量级不成立；c) "谁在 core"的分界维护已三次实证失败（export_image 禁令 / set_effects 引用 / 本计划初稿），分类保留即风险保留。保留的初稿判断：重叠工具以 description 指路标注处理（不物理删除）；T9(c) 守卫不撤（其他域分界仍在）；超级工具路线否决不变。

10. 同一评审追加建议 `clone_node`/`rename_node` 入 core，核验后采纳并按同线标准补完：a) `clone_node` 唯一能力、通用+营销双高频（复制卡片/section 做变体）、schema 1 参数；b) `rename_node` 与 `update_node.name` 重叠，按指路标注处理；c) 同标准下 `group_nodes`/`ungroup_node` 完全同线，一并提升避免同类问题复现；d) 不开新先例——structure 域既有 core 成员（delete/reparent/resize/batch_update）本就是"高频单意图场景操作"的 cherry-pick，本次延续该格局；e) structure 域其余工具维持 extended。

## 实施记录（2026-08-15）

- T0：`registry-core.ts` 移入 13 个 modify + `clone_node`/`rename_node`/`group_nodes`/`ungroup_node`；`registry-extended.ts` 同步移除；5 个重叠工具（`set_opacity`/`set_visible`/`set_text_resize`/`set_font`/`rename_node`）description 加指路标注。
- T1：`visual.ts` fills/strokes setter 补默认值（`??` 后置兜底）。
- T2：`fills.ts`/`scene.ts`/`boolean.ts`/`strokes.ts` 的 visible 判断改 `=== false` 语义、opacity 回退 1；`describe/issues.ts`、`rpc/analyze-commands.ts` 同步（避免 describe 与 renderer 判定不一致）。
- T3：`batch.ts` description 从 `SCENE_PROP_MAP` keys 生成 + 反向清单；报错复用同一常量；`SCENE_PROP_MAP` 导出供测试。
- T4：eval description 补技术约束段；`set_text_properties` description 删去无参数的 text case/truncation。
- T5-T7：base.md 加「Property → tool map」、eval 收敛为引用制、export 禁令（不点名 extended 工具）；marketing.md 加 per-section checkpoint 自检句式 + set_effects 顺序规则。
- T8：`generate.ts` v3 profile 第 5 步后追加刷色工具模板；已再生成 `public/default-library.fig`，`tools/marketing-library/tests/` 6/6 通过。
- T9：`tests/engine/tools/consistency.test.ts`（3 断言全绿，豁免清单全部注明理由）；`check:tools-consistency` 已挂进 `bun run check`。
- T10：`docs/plans/knowledge/methodology.md` 追加 §9 三层归属模型 + 判定流程 + prompt 只引用 CORE_TOOLS 规则 + 返回值契约；`AGENTS.md` Tools 节同步暴露规则；`CHANGELOG.md` Unreleased 补 Changed/Fixed 条目。
- T11 验证结果：新增/更新单测 31/31 通过；`tests/engine/tools/` + `tests/engine/figma/` 558 pass（12 fail 为 cli.test.ts 环境性失败，干净 HEAD 同样失败）；render 组 515 pass（1 fail 为 boolean-visual 环境性失败，干净 HEAD 同样失败）；`tsgo --noEmit` 零错误；`test:dupes` 0 clones；oxlint 因宿主机内存 panic（allocator pool 创建失败，与代码无关）未跑成，留 CI；pixel snapshot：`renderer-visuals.spec.ts` 6/6 通过且快照零 diff（首跑 6 挂为 dev server 冷启动 flake，单用例与全量复跑均通过；boolean-operations 实际图与基线逐字节一致）——确认 fills/strokes 语义修正对既有渲染输出零影响。watercolor_poster_v3 端到端重跑待真实模型环境按 T11 验收点执行。

### 外部评审修正轮（2026-08-15，同日）

评审（5+4 agent 并行）达到阈值的主发现属实并已修：`set_text_properties` description 误称"无 truncation 支持"，但 `auto_resize` enum 含 `TRUNCATE` 且 execute 实际执行——描述已改为 "auto-resize (incl. TRUNCATE)"，仅保留 text-case 排除。次级发现中的渲染路径 truthy 遗漏同步补修：`boolean.ts:44`（hasVisibleImageFill）、`boolean.ts:69`（lineStrokePath）、`scene.ts:566`（vector centerline 判定）、`shadows.ts:233`（阴影几何）、`canvas/text/index.ts:350`（styleRun 取色 + 两处 `a * opacity` NaN 兜底）。遗留已知限制（记录在案、本轮不改）：legacy .fig 导入数据不在加载时规范化（属 fig 包导入层，单列）；effects 的 `visible` 同款陷阱未处理（effects setter 未回填，analyze-commands.ts:90 保持原样以与之一致）；导出路径（svg/pptx）的 truthy 检查未动。

# `batch_update` 与工具映射 Review

> 日期：2026-08-14
> 范围：以一份 watercolor_poster_v3 实测日志（2026-08-14T09:54Z，32 步 / 41 工具调用 / 1 error）为引子，审视 `batch_update` 的白名单设计、整套 modify 工具的覆盖完整度、以及系统提示词对工具使用的教学深度
> 关联：测试日志已分享（open-pencil-ai-debug-log-2026-08-14），可直接对照

---

## 1. 现状

### 1.1 一句话回顾：本次测试发生了什么

AI 用 `watercolor_poster_v3` profile 生成一张「预存物业费有礼」的长图。32 步、41 个工具调用、整体缓存命中率 96.7%（省了 ~117 万 uncached token），但**有 1 次工具错误**，且触发了多个隐性布局/可读性问题。

关键时间线：

| 时刻 | 工具 | 发生了什么 |
|---|---|---|
| 09:46:43 | `create_brief` / `setup_material_type` | 建需求单 + 750px 产品长图 root |
| 09:46:44 | `append_brief_conclusion` × 2 | 写风格与虚构内容（栖云物业、三档好礼） |
| 09:46:23 → 09:48:46 | `render` × 6 | Hero + Story + Gifts + Steps + Why + Footer（**全部硬编码中性灰 hex**，未走 derive_palette） |
| 09:48:50 | `describe` | 第一次校验：3 个 error（Hero 文字溢出）+ 6 个 warning |
| 09:49:46 | `render` replace | 重渲 Hero（size 88, lineHeight 96） |
| 09:49:47 | `batch_update` | ❌ **失败**：`font_size` 不在白名单 |
| 09:49:52–53 | `update_node` × 4 | 退回单点，改 4 个眉题字号 14→13 |
| 09:50:41 | `render` replace | Hero 切字体 Alibaba PuHuiTi |
| 09:50:48 | `describe` depth=4 | 二次校验：Hero 仍 overflow（950px > 590px） |

日志在 #24 截断，最终视觉验收状态未知。但**单次失败 + 整盘返工**的根因可以独立诊断。

### 1.2 `batch_update` 的代码现状

[packages/core/src/tools/structure/batch.ts:11-29](open-pencil/packages/core/src/tools/structure/batch.ts#L11-L29) 用 **白名单** 锁住了所有可批改属性：

```typescript
const SCENE_PROP_MAP: Record<string, string[]> = {
  spacing: ['itemSpacing'],
  padding: ['paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft'],
  padding_horizontal: ['paddingLeft', 'paddingRight'],
  padding_vertical: ['paddingTop', 'paddingBottom'],
  counter_align: ['counterAxisAlign'],
  align: ['primaryAxisAlign'],
  sizing_horizontal: ['primaryAxisSizing', 'counterAxisSizing'],
  sizing_vertical: ['primaryAxisSizing', 'counterAxisSizing'],
  grow: ['layoutGrow'],
  name: ['name'],
  visible: ['visible'],
  corner_radius: ['cornerRadius'],
  opacity: ['opacity'],
  auto_resize: ['textAutoResize'],
  direction: ['layoutMode'],
  font_family: ['fontFamily'],
  font_weight: ['fontWeight']
}
```

工具自带描述（[batch.ts:124](open-pencil/packages/core/src/tools/structure/batch.ts#L124)）枚举了 16 个支持项。`font_family` 和 `font_weight` **在**白名单，`font_size` **不在**。

执行路径 [batch.ts:141-162](open-pencil/packages/core/src/tools/structure/batch.ts#L141-L162)：对每个 op 先按白名单过滤未知 key（`unknownKeys`），未知 key 进入错误数组 `errors`，**已知 key 仍然会被部分执行**。本次调用即因此返回了：

```
updated: 2 (spacing 各生效 1 条)
errors:  Node "0:51"/"0:55"/"0:74"/"0:94": unknown props "font_size"
        — supported: spacing, padding, padding_horizontal, ...
```

### 1.3 `update_node` 实际支持范围

[packages/core/src/tools/modify/update.ts:11-35](open-pencil/packages/core/src/tools/modify/update.ts#L11-L35) 共 15 个参数：

| 类别 | 参数 |
|---|---|
| 位置 | `x`, `y` |
| 尺寸 | `width`, `height` |
| 外观 | `opacity`, `corner_radius` |
| 可见性 | `visible` |
| 标识 | `name` |
| 文字 | `text`, `text_direction` |
| 布局流向 | `flow_direction`（AUTO/LTR/RTL） |
| 字体 | `font_size`, `font_weight`, `font_family` |

**看起来多，但明显缺斤少两** —— 不覆盖填充、描边、阴影、padding、grow、align、letter_spacing、line_height 等高频需求。

### 1.4 整套 modify 工具的分工

| 工具 | 职责 | 文件 |
|---|---|---|
| `update_node` | 基础原子属性（位置/尺寸/可见/字体/文本） | [modify/update.ts](open-pencil/packages/core/src/tools/modify/update.ts) |
| `set_layout` | auto-layout 控制（方向/间距/padding/对齐） | [modify/layout.ts:5-84](open-pencil/packages/core/src/tools/modify/layout.ts#L5-L84) |
| `set_fill` | 单色 / 渐变填充 | [modify/paint.ts:8-60](open-pencil/packages/core/src/tools/modify/paint.ts#L8-L60) |
| `set_stroke` | 描边（颜色/粗细/对齐） | [modify/paint.ts:62-](open-pencil/packages/core/src/tools/modify/paint.ts#L62) |
| `set_text` | 文本内容 | [modify/text.ts:8-22](open-pencil/packages/core/src/tools/modify/text.ts#L8-L22) |
| `set_font` | 字体三件套（family/size/style） | [modify/text.ts:24-47](open-pencil/packages/core/src/tools/modify/text.ts#L24-L47) |
| `set_font_range` | 字符区间样式 | [modify/text.ts:49-](open-pencil/packages/core/src/tools/modify/text.ts#L49) |
| `set_effects` | 阴影 / 模糊（追加式） | [modify/effects.ts:7-46](open-pencil/packages/core/src/tools/modify/effects.ts#L7-L46) |
| `set_constraints` | resize 约束 | [modify/layout.ts:86-](open-pencil/packages/core/src/tools/modify/layout.ts#L86) |
| `batch_update` | 上述若干项的批量版（**白名单限制**） | [structure/batch.ts](open-pencil/packages/core/src/tools/structure/batch.ts) |

**没有单一工具能改所有属性**。模型必须按「属性 → 工具」的映射调用。

### 1.5 系统提示词对 `batch_update` 的教学现状

| 位置 | 内容 | 是否提反向清单 |
|---|---|---|
| [system-prompt-base.md:93](open-pencil/src/app/ai/chat/system-prompt-base.md#L93) | 1 行示例（spacing + sizing_horizontal） | ❌ |
| [system-prompt.md:199-200](open-pencil/src/app/ai/chat/system-prompt.md#L199-L200) | 3 个示例（spacing、sizing_horizontal、grow、auto_resize） | ❌ |
| [system-prompt-marketing.md:152](open-pencil/src/app/ai/chat/system-prompt-marketing.md#L152) | 流程指令「fix ALL errors and warnings」 | ❌ |
| [batch.ts:124](open-pencil/packages/core/src/tools/structure/batch.ts#L124) 工具自带描述 | 枚举 16 个支持项 + "Unrecognized prop keys are reported" | ❌（沉默式不禁止） |

**三处提示 + 工具自带描述，全部只列「能用什么」，从不列「不要用什么」**。模型看到 `font_family`/`font_weight` 在白名单，按命名规律脑补 `font_size` 也在 → 翻车。

### 1.6 `watercolor_poster_v3` profile 的硬约束（与本次失败强相关）

[tools/marketing-library/src/generate.ts:681](open-pencil/tools/marketing-library/src/generate.ts#L681) 在第 5 步写明：

> 「**配对纪律（违反即隐形字事故）**：浅色底（ground、neutrals[0]）上的文字只用 ink.onLight；深色底（wash、accent、neutrals[2]、hero 图深区）上的文字只用 ink.onDark；**绝不要把 ink.onDark 放在浅底上**（它与 ground 明度几乎相同），也不要把文字和它的底板刷成同一角色。合法配对以返回的 pairings 表为准，**表外不自行组合**。」

第 5 步要做的核心动作：**色票出来后，统一刷色**——把骨架期的中性灰占位强调元素（折扣数字、步骤编号、图标等）刷成色票角色色。同时第 1 步要求「眉题 ≤13px」（这正是本次试图批量改 `font_size` 的源头）。

但本次实测中 AI **完全跳过了 Phase 2.5**：日志 41 个工具调用里**没有 `prepare_hero_scaffold`、`generate_image`、`compose_backdrop`、`derive_palette` 任一项**。直接 hardcode 中性灰写完所有 section —— 这才是「所有文字异常」的根因。

---

## 2. 问题分析

### 2.1 `batch_update` 的「沉默式不禁止」是设计漏洞

**现象**：工具描述枚举了 16 个支持项，但 `font_size` 在命名上与 `font_family`/`font_weight` 同组却缺席，模型自然脑补。

**为什么是漏洞**：
- 错误信息**事后返回**，且**只列「supported: ...」**，不列「unsupported: ...」
- 系统提示词三处提及 batch_update，从未反向列举
- **没有"找字体三件套请去 `update_node` / `set_font`"的分流指引**

**为什么 `font_size` 被故意排除**（合理的设计意图）：
- `font_weight` 改 glyph 粗细，行高近似不变 → 安全
- `font_size` 改 glyph 高度 → `lineHeight` 同步变化 → `textAutoResize=HEIGHT` 节点高度跳变 → 影响父级 hug 容器 → 连锁塌陷
- 批量改字号风险/收益不对等：spacing 错 1px 是微差，font_size 错 2px 就溢出/塌缩
- 设计定位是「**轻量属性微调**」，font_size 是「破坏性重排」，粒度不对等

**但是**这个意图**从未在 prompt 中说明**。模型只能从错误回执里学到。

### 2.2 `update_node` 不是"update 万能入口"

测试日志 #17–#20 里 AI 退回 `update_node` 改 4 个眉题字号，全部成功（font_size 14→13），看上去「兜底工具」成立。但实际上：

- 想刷 section 背景色 → `update_node` 不支持 → 必须 `set_fill`
- 想加文字阴影（profile 推荐的 hero 文字可读性补丁）→ `update_node` 不支持 → 必须 `set_effects`
- 想改 auto-layout 的 spacing/grow/sizing → `update_node` 不支持 → 必须 `set_layout` 或 `batch_update`
- 想改 `letter_spacing` / `line_height` / `text_align` / `text_case` → **没有任何工具支持**，只能删了重 render

**实际"全覆盖"的路径不存在**。属性 → 工具的映射从没被系统化教过。

### 2.3 同一概念在多工具里重复出现

`font_size` 在 4 处出现：

| 工具 | 是否支持 |
|---|---|
| `update_node.font_size` | ✅ |
| `set_font.size` | ✅ |
| `set_font_range.size` | ✅ |
| `batch_update` ❌ | ❌（模型脑补成可） |
| `render` JSX `size` prop | ✅ |

**容易让模型以为别处也行**。`font_family` / `font_weight` / `text` / `visible` / `name` 等也有同样的分散问题。

### 2.4 营销 profile 与工具能力的接口错配

watercolor_poster_v3 的第 5 步「统一刷色」实际会触发的工具调用：

| 动作 | 应该走 |
|---|---|
| 改字号（眉题 14→13） | `update_node.font_size` 或 `set_font` |
| 切字体（中→PuHuiTi） | `update_node.font_family` 或 `set_font` |
| 改 section 底色 | `set_fill` |
| 改文字色 | `set_fill`（fills）/ `set_font_range` |
| 加 hero 文字阴影 | `set_effects` |
| 改 lineHeight/letterSpacing | ❌ **无工具** |

**AI 在 batch_update 里尝试 font_size、batch 里又没法改 fills** —— 两者都不是它「一次能完成」的诉求。Profile 设计者把 Phase 2.5 视为必经路径，但**没有给刷色场景列工具调用模板**。

### 2.5 校验节奏鼓励"攒到最后"

本次日志里 AI 先把 6 个 section 全部 render 完（#8–#13），才在 #14 做第一次 describe。批量 render 的代价是：

- 中间发现的问题无法回滚（只能 replace 整个 section）
- 错位（如 hero 用了 Inter 渲染中文）累计到 #14 才暴露
- describe 报告 17 KB，缓存压力上升

`system-prompt-marketing.md:152` 写「5. `batch_update` to fix ALL errors and warnings — only then move to the next section」，但**没有强制"render 后立即 describe 子节点"**。本次恰好每个 section render 后**没有**立即校验，导致 #8 的 Hero 错误在 #14 才被一并发现。

---

## 3. 方案建议

### 3.1 给 `batch_update` 工具描述加反向清单 + 理由

在 [batch.ts:124](open-pencil/packages/core/src/tools/structure/batch.ts#L124) 的 description 后追加：

> "**NOT supported in batch** (use per-node `update_node` / `set_font` / `set_fill` / `set_effects`): `font_size`, `text`, `letter_spacing`, `line_height`, `text_align`, `text_decoration`, `text_case`, `fills`, `strokes`, `effects`, `rotation`, `blend_mode`. Why: batch is layout micro-fix only; `font_size` cascades text height into hug parents and breaks one bad value's neighbors."

**理由**：错误回执和工具描述都把"禁止"和"理由"前置，能让模型在调用前**自我否决**而不是调用后回滚。

### 3.2 系统提示词补"属性 → 工具"映射表

在 [system-prompt-base.md:93](open-pencil/src/app/ai/chat/system-prompt-base.md#L93) 后追加一节：

```markdown
⚠ **属性 → 工具映射**（同一概念可能只在某一个工具里支持）：

- 位置/尺寸/可见性/圆角/不透明度/名称 → `update_node`
- 字体三件套（family/size/weight）→ `update_node` 或 `set_font`（后者一次原子）
- 文本内容 → `update_node.text` 或 `set_text`
- 区间样式 → `set_font_range`（如某段加粗、变色）
- 布局（direction/spacing/padding/align）→ `set_layout`（单节点）或 `batch_update`（多节点）
- 填充色 / 渐变 → `set_fill`
- 描边 → `set_stroke`
- 阴影 / 模糊 → `set_effects`
- 约束 → `set_constraints`
- ❌ **无工具**：letter_spacing、line_height、text_align、text_case、rotation、blend_mode —— 要么 render 时定死，要么删了重 render

⚠ **`batch_update` 白名单**：spacing / padding / padding_h·v / counter_align / align / sizing_h·v / grow / name / visible / corner_radius / opacity / auto_resize / direction / font_family / font_weight。**`font_size` 不在** —— 用 `update_node.font_size` 单点改。
```

**理由**：模型调用前有完整索引，省掉事后错误重试的 N 步。营销 profile 的"刷色"场景尤其需要这张表。

### 3.3 render 后立即 describe（强制 per-section 校验）

在 [system-prompt-marketing.md:152](open-pencil/src/app/ai/chat/system-prompt-marketing.md#L152) 改写：

```diff
- 5. `batch_update` to fix ALL errors and warnings — only then move to the next section
+ 5. **IMMEDIATELY `describe` the new node** (never skip, never defer)
+ 6. `batch_update` / `update_node` to fix ALL errors and warnings
+ 7. Only then move to the next section
```

**理由**：errors compound —— section 1 一个错位的 `w="fill"` 会让下面所有 section 跟着塌。本次日志 #8–#13 的 render 间隔 ~30 秒，期间如果有一次 describe，本可以提前止损。

### 3.4 `batch_update` 增加可选的"软上限"参数

考虑在 [batch.ts](open-pencil/packages/core/src/tools/structure/batch.ts) 增加：

```typescript
params: {
  operations: { ... },
  // 新增：仅当每个 op 的 font_size_delta 在 ±N 范围内时放行
  font_size_tolerance?: { type: 'number', default: 0, min: 0, max: 4 }
}
```

行为：若 ops 包含 `font_size`，且 `|delta| <= font_size_tolerance`，则允许批改；否则**拒绝整批**而不是部分执行（避免本次"spacing 成功 + font_size 失败"的混合结果）。

**理由**：现行实现是部分执行 —— 已知 key 静默生效，未知 key 进错误数组。模型得到的是「4 个错 + 2 个对」的混合态，难以定位。

### 3.5 profile 应列出工具调用模板（而不是只写视觉纪律）

watercolor_poster_v3 第 5 步「色票出来后统一刷色」目前是**纯视觉描述**。建议改为：

```markdown
## Color refresh workflow (Phase 2.5 step 5)

After `derive_palette` returns the color ticket:

1. Hero title → `update_node({ id, font_family, font_size?, color? })`
   ⚠ batch_update CANNOT batch font_size — one update_node per text node.
2. Section backgrounds → `set_fill({ id, color })` per section
3. Accent numbers (discount %, step numbers) → `set_fill` per text node
4. Hero text legibility shadow → `set_effects({ id, type: "DROP_SHADOW", ... })`
5. Verify pairing with `describe` — "隐形字事故" = text color matches background

Order matters: do font + size first, then fills, then effects. Effects last
because adding shadows changes node bounding box and may shift layout.
```

**理由**：profile 是 AI 的「现场作业指导」，目前只教"做什么"不教"怎么调工具"。

### 3.6 增设 `set_typography` 工具（覆盖 line_height / letter_spacing / text_case）

很多 profile 都要求行距收紧（1.0–1.15）、字距拉开、uppercase 标签。这些目前在 render 时定死后就**改不了**。建议：

```typescript
export const setTypography = defineTool({
  name: 'set_typography',
  params: {
    id: { type: 'string', required: true },
    line_height: { type: 'number', min: 0.5, max: 3 },
    letter_spacing: { type: 'number' },
    text_align: { enum: ['left', 'center', 'right', 'justified'] },
    text_decoration: { enum: ['underline', 'strikethrough'] },
    text_case: { enum: ['upper', 'lower', 'title'] },
    max_lines: { type: 'number' }
  }
})
```

**理由**：profile 反复要求这些参数，但工具栈没暴露，模型被迫"删了重 render"。

---

## 4. 行动项

| 优先级 | 行动 | 文件 / 估时 | 影响 |
|---|---|---|---|
| **P0** | `batch_update` 描述加反向清单 + 理由 | [batch.ts:124](open-pencil/packages/core/src/tools/structure/batch.ts#L124) / 0.5h | 立即阻止 `font_size` 脑补 |
| **P0** | `system-prompt-base.md` 补「属性 → 工具映射」表 | [base.md:93](open-pencil/src/app/ai/chat/system-prompt-base.md#L93) / 1h | 全量工具调用前置准确度提升 |
| **P1** | 营销提示词强制 render→describe→fix 三步 | [marketing.md:152](open-pencil/src/app/ai/chat/system-prompt-marketing.md#L152) / 1h | 阻止 errors compound |
| **P1** | `batch_update` 增加 `font_size_tolerance` 软上限 | [batch.ts](open-pencil/packages/core/src/tools/structure/batch.ts) / 3h | 避免部分执行混合态 |
| **P1** | watercolor_poster_v3 第 5 步补工具调用模板 | [generate.ts:677-682](open-pencil/tools/marketing-library/src/generate.ts#L677-L682) / 1h | profile 现场作业可执行 |
| **P2** | 新增 `set_typography` 工具（line_height / letter_spacing / text_case / text_align） | 新文件 / 4h | 覆盖 profile 反复要求的属性 |
| **P2** | `update_node` 工具描述补「不能改什么」反向清单 | [update.ts:9-10](open-pencil/packages/core/src/tools/modify/update.ts#L9-L10) / 0.5h | 阻止「update_node 万能」脑补 |
| **P3** | 工具 schema 加属性级别 capability 标签 | 工具层重构 / 1d | 自动生成「属性 → 工具」映射 |

---

## 5. 与已有 review 的关系

| 相关文档 | 关系 |
|---|---|
| [2026-08-12-font-system-review.md](open-pencil/docs/review/2026-08-12-font-system-review.md) | 字体层面的 fontFamily 路由问题已识别（§2.5）；本文关注 **font_size 在 batch 工具里的盲区**，互补 |
| [2026-08-07-long-image-design-quality-review.md](open-pencil/docs/review/2026-08-07-long-image-design-quality-review.md) | 长图质量评审已指出"prompt 明确否认其存在"的能力披露缺口；本文关注 **modify 工具栈的覆盖缺口**，互补 |
| [2026-08-11-poster-quality-experiment-branch-review.md](open-pencil/docs/review/2026-08-11-poster-quality-experiment-branch-review.md) | 海报感实验分支终审识别了"单 profile 注入机制不兼容"等 1C+2M+3m；本次发现的 `batch_update` 错用属于 profile × tooling 接口问题，建议下一轮实验前先闭环本文 P0 |

---

## 6. 一句话总结

`batch_update` 的白名单设计意图是对的（粒度对齐），但**沉默式不禁止 + 提示词只教正向**让模型必然脑补；`update_node` 看起来万能实则只有 15 项；**整套 modify 工具栈的「属性 → 工具」映射从未被系统化教学**——这是本次 1 次工具调用错误 + 整盘返工的根因。**P0 两项改动（反向清单 + 映射表）即可消除 80% 的同类翻车**。
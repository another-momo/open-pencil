# Open Pencil 工具体系与系统提示词复盘

> 日期：2026-08-15
> 触发事件：`watercolor_poster_v3` 长图测试日志分析
> 涉及文件：`docs/test-log.txt`、`open-pencil/src/app/ai/chat/system-prompt.md`、`system-prompt-base.md`、`system-prompt-marketing.md`、核心工具源码

---

## 摘要

本次复盘从同一份 `watercolor_poster_v3` 测试日志出发，覆盖四个层次：

1. **3 个具体 bug 的因果链**（batch_update font_size 不在白名单、eval async API 不存在、eval 替换 fills 丢失 opacity/visible）
2. **整套 modify 工具栈的属性覆盖分析**（16 个修改工具 + 一个 `batch_update`，但"属性 → 工具"映射从没被系统化教学）
3. **fork 系统提示词的 diff 复盘**（base.md / marketing.md / 原版的删减、新增、跨文件不一致）
4. **工具能力上下文的暴露哲学**（三层模型：Tier 1 工具契约 / Tier 2 跨工具节奏 / Tier 3 领域特例）

发现的根因可以归纳为三类：
- **修改类工具的能力边界不透明**（白名单不文档化、proxy setter 不补默认、eval sandbox 限制没说清）
- **fork 重组后硬约束散落**（render 的关键约束放在 marketing.md 而不是工具 description）
- **缺乏"工具能力上下文该放哪"的设计哲学**（同名约束在多处重复或缺失，导致信息重复、漂移、错位）

本文档记录所有发现，作为后续改动的依据。

---

## 一、测试日志发现：3 个 bug 的因果链

测试日志位置：`docs/test-log.txt`（2026-08-14 09:54:36 起，32 步，41 工具调用）

### Bug 1：batch_update 不支持 font_size（第 16 步）

```js
batch_update({operations:[
  {id:"0:51", props:{font_size:13}},  // ← 报错
  ...
]})
// 错误：unknown props "font_size" — supported: spacing, padding, ...,
//        font_family, font_weight
```

**完整因果链**：

```
batch_update 描述列举 16 个支持项（font_family / font_weight / ...）
   ↓
agent 按命名规律脑补 font_size 也在白名单
   ↓
batch.ts:147-153 行为：未知 key 进 errors 数组，已知 key 静默生效
   ↓
调用返回 {updated: 2, errors: [...]}  ← 部分成功的混合态
   ↓
agent 在第 17-20 步退回 update_node 单点改（4 次单独调用，浪费 4 步）
```

**`font_size` 故意被排除的设计意图**（合理）：

`font_weight` 改 glyph 粗细，行高近似不变 → 安全。  
`font_size` 改 glyph 高度 → `lineHeight` 同步变化 → `textAutoResize=HEIGHT` 节点高度跳变 → 影响父级 hug 容器 → **连锁塌陷**。  

批量改字号风险/收益不对等：spacing 错 1px 是微差，font_size 错 2px 就溢出/塌缩。设计定位是「**轻量属性微调**」，font_size 是「破坏性重排」，粒度不对等。

**但是**这个意图从未在 prompt 中说明，模型只能从错误回执里学到。

**白名单实际内容**（[packages/core/src/tools/structure/batch.ts:11-29](open-pencil/packages/core/src/tools/structure/batch.ts#L11-L29)）：

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

16 个 key，`font_size` 不在其中——**这是设计意图不是 bug**，但白名单从不在 prompt 中暴露，agent 必然撞墙。

### Bug 2：eval 替换 fills 丢失 opacity 和 visible，导致 fill 在 paintFills 阶段被跳过（第 40 步）

```js
// 步骤 40（eval 批量应用 derive_palette 的色彩票）
t.fills = [{ type: "SOLID", color: { r, g, b } }];
//                      ^^^^^^^^^^^^^^^^^^^^^
//                      只传 color.r/g/b，opacity 和 visible 都没传
// 结果：{updatedText: 58, updatedFill: 1}  ← 数字看着对，但实际写入了不完整的 fill
```

**完整的因果链**：

```
agent: t.fills = [{ type, color: {r,g,b} }]            ← 缺 opacity/visible
   ↓
proxy setter（visual.ts:22-33）: { ...fill, color: ... }  ← 简单展开，不补默认
   ↓
SceneNode.fills: [{ type, color, opacity: undefined, visible: undefined }]
   ↓
paintFills（fills.ts:25）: if (!fill.visible) continue     ← undefined 是 falsy → 跳过整个 fill
   ↓
fillPaint.setColor() 从未被调用，paint 保持陈旧状态
   ↓
文字 paragraph 用陈旧 paint 颜色画 → 看不见 / 颜色错乱
```

**根因（4 跳证据）**：

1. **agent 代码**：`t.fills = [{ type: "SOLID", color: {r,g,b} }]` —— 缺 `opacity` 和 `visible`
2. **proxy setter** ([packages/core/src/figma-api/accessors/visual.ts:22-33](open-pencil/packages/core/src/figma-api/accessors/visual.ts#L22-L33))：
   ```typescript
   set(this: ProxyThis, value: readonly Fill[]) {
     updateNode(this, internals, {
       fills: value.map((fill) => ({
         ...fill,                          // ← 只展开，不补默认
         color: normalizeColor(fill.color),
         gradientStops: ...
       }))
     })
   }
   ```
   `{ ...fill }` 简单展开，**不补 `opacity` / `visible` / `blendMode`**
3. **paintFills** ([packages/core/src/canvas/fills.ts:23-31](open-pencil/packages/core/src/canvas/fills.ts#L23-L31))：
   ```typescript
   for (let index = 0; index < fills.length; index++) {
     const fill = fills[index]
     if (!fill.visible) continue       // ← undefined 是 falsy → 跳过整个 fill
     ...
     r.fillPaint.setColor(r.ck.Color4f(c.r, c.g, c.b, c.a))
     r.fillPaint.setAlphaf(fill.opacity)
   }
   ```
4. **文字渲染** ([packages/core/src/canvas/scene.ts:749](open-pencil/packages/core/src/canvas/scene.ts#L749))：
   ```typescript
   const paragraph = r.buildParagraph(node, r.fillPaint.getColor(), {...})
   ```
   paintFills 跳过了 fill → fillPaint 没被设置 → 文字用陈旧颜色画

**为什么 render 路径不出问题**：render 的 `colorToFill` ([packages/core/src/color/index.ts:63-71](open-pencil/packages/core/src/color/index.ts#L63-L71)) **显式构造完整 fill**：

```typescript
{
  type: 'SOLID',
  color: { r, g, g, b, a: rgba.a },
  opacity: rgba.a,    // ← 显式
  visible: true       // ← 显式
}
```

**面板侧症状**（同一根因的另一面）：

- [packages/vue/src/primitives/Fill/useFill.ts:34](open-pencil/packages/vue/src/primitives/Fill/useFill.ts#L34) `fill.opacity < 1` 检查因为 `undefined < 1 = false` 失效
- [packages/vue/src/controls/shared-style/model.ts:26-27](open-pencil/packages/vue/src/controls/shared-style/model.ts#L26-L27) 直接读 `fill.opacity` / `fill.visible`，拿到 undefined

→ 面板的颜色 / 不透明度 / 可见性显示全部错乱。

**eval 返回值的误导**：`updatedText: 58` 只是循环跑了 58 次，不代表 58 次写入都"有完整 fill"。任何后续字段缺失都不会被这个计数器反映出来。

### Bug 3：eval 异步 API 不存在（第 27 步）

```js
const root = await figma.getNodeByIdAsync("0:35");  // ← figma.getNodeByIdAsync is not a function
```

eval 是同步上下文，async 包装根本不存在。

### 视觉验证矛盾的根因

步骤 41 look 报告"body 完全空白，只有底部分隔线"。**那唯一可见的 1px 分隔线（SectionFooter 0:116）是 Frame 不是 Text，没有 fill paint 依赖**——它能正常渲染。**所有 Text 都因 Bug 2 在 paintFills 阶段被跳过**：

```
agent eval fill replacement 丢失 opacity/visible
   ↓
SceneNode.fills 中 opacity/visible = undefined
   ↓
paintFills: if (!fill.visible) continue  ← 跳过整个 fill
   ↓
fillPaint 保持陈旧状态（可能是 alpha 0 / 黑色 / 上一节点残留色）
   ↓
buildParagraph 用 fillPaint.getColor() 取色 → 文字隐形或颜色错乱
   ↓
look 看到「body 完全空白，只有底部分隔线」
```

**附带的两个症状**：
- eval 改字体（fontName）实际**成功了**——面板读 fontName.family 返回 "Alibaba PuHuiTi"，但因为 fill 没正确画，文字还是看不见
- 面板的颜色 / 不透明度 / 可见性 UI 也错乱——同一根因（fill 的 opacity/visible 是 undefined）的另一面

---

## 二、整套 modify 工具栈的属性覆盖分析

本次测试暴露的不只是 3 个 bug，更底层的是「属性 → 工具」映射从未被系统化教学。

### 工具栈全貌

`packages/core/src/tools/modify/` 下共 13 个工具 + 1 个 `batch_update`：

| 工具 | 职责 | 文件 |
|---|---|---|
| `update_node` | 基础原子属性（位置/尺寸/可见/字体/文本），共 15 个参数 | [modify/update.ts:11-35](open-pencil/packages/core/src/tools/modify/update.ts#L11-L35) |
| `set_layout` | auto-layout 控制（方向/间距/padding/对齐） | [modify/layout.ts:5-84](open-pencil/packages/core/src/tools/modify/layout.ts#L5-L84) |
| `set_layout_child` | 子节点在 auto-layout 内的 grow/align | [modify/layout.ts:116](open-pencil/packages/core/src/tools/modify/layout.ts#L116) |
| `set_fill` | 单色 / 渐变填充 | [modify/paint.ts:8-60](open-pencil/packages/core/src/tools/modify/paint.ts#L8-L60) |
| `set_image_fill` | 图片填充 | [modify/paint.ts:95](open-pencil/packages/core/src/tools/modify/paint.ts#L95) |
| `set_stroke` | 描边（颜色/粗细/对齐） | [modify/paint.ts:62](open-pencil/packages/core/src/tools/modify/paint.ts#L62) |
| `set_text` | 文本内容 | [modify/text.ts:8-22](open-pencil/packages/core/src/tools/modify/text.ts#L8-L22) |
| `set_font` | 字体三件套（family/size/style） | [modify/text.ts:24-47](open-pencil/packages/core/src/tools/modify/text.ts#L24-L47) |
| `set_font_range` | 字符区间样式 | [modify/text.ts:49](open-pencil/packages/core/src/tools/modify/text.ts#L49) |
| `set_text_resize` | textAutoResize | [modify/text.ts:84](open-pencil/packages/core/src/tools/modify/text.ts#L84) |
| `set_text_properties` | 文字对齐、自动调整、方向、装饰 | [modify/text.ts:105](open-pencil/packages/core/src/tools/modify/text.ts#L105) |
| `set_effects` | 阴影 / 模糊（追加式） | [modify/effects.ts:7-46](open-pencil/packages/core/src/tools/modify/effects.ts#L7-L46) |
| `set_constraints` | resize 约束 | [modify/layout.ts:86](open-pencil/packages/core/src/tools/modify/layout.ts#L86) |
| `set_rotation` | 旋转角度 | [modify/geometry.ts:3](open-pencil/packages/core/src/tools/modify/geometry.ts#L3) |
| `set_opacity` | 不透明度（独立工具） | [modify/geometry.ts:19](open-pencil/packages/core/src/tools/modify/geometry.ts#L19) |
| `set_radius` | 圆角 | [modify/geometry.ts:35](open-pencil/packages/core/src/tools/modify/geometry.ts#L35) |
| `set_minmax` | minWidth / minHeight 等 | [modify/geometry.ts:71](open-pencil/packages/core/src/tools/modify/geometry.ts#L71) |
| `set_visible` | 可见性（独立工具） | [modify/state.ts:3](open-pencil/packages/core/src/tools/modify/state.ts#L3) |
| `set_blend` | blendMode | [modify/state.ts:19](open-pencil/packages/core/src/tools/modify/state.ts#L19) |
| `set_locked` | 锁定 | [modify/state.ts:57](open-pencil/packages/core/src/tools/modify/state.ts#L57) |
| `set_stroke_align` | 描边对齐 | [modify/state.ts:73](open-pencil/packages/core/src/tools/modify/state.ts#L73) |
| `batch_update` | 上述若干项的批量版（**白名单限制**） | [structure/batch.ts](open-pencil/packages/core/src/tools/structure/batch.ts) |

**关键问题**：**没有单一工具能改所有属性**。模型必须按「属性 → 工具」的映射调用——但这套映射从来没在 prompt 里被教过。

### 当前白名单的 16 个属性

batch_update 支持的（与 SCENE_PROP_MAP 一致）：

```
spacing, padding, padding_horizontal, padding_vertical,
counter_align, align,
sizing_horizontal, sizing_vertical, grow,
name, visible, corner_radius, opacity, auto_resize, direction,
font_family, font_weight
```

### 「属性 → 工具」完整映射（基于源码验证）

```
位置/尺寸/可见性/圆角/不透明度/名称    →  update_node
rotation                                →  set_rotation
opacity (独立)                          →  set_opacity
radius                                  →  set_radius
minWidth / minHeight                     →  set_minmax
visible (独立)                           →  set_visible
locked                                   →  set_locked
blendMode                                →  set_blend

字体三件套（family/size/style）           →  update_node.font_*  OR  set_font（一次原子）
文本内容                                →  update_node.text  OR  set_text
textAlignHorizontal / textAlignVertical  →  set_text_properties.align_*
autoResize / textDirection               →  set_text_properties  OR  set_text_resize
textDecoration                          →  set_text_properties.text_decoration
区间样式                                →  set_font_range
layoutMode / 流向                        →  set_layout  OR  update_node.flow_direction

布局（spacing / padding / align / sizing）  →  set_layout（单节点） OR batch_update（多节点）
子节点 grow / align                      →  set_layout_child
布局主轴对齐（primaryAxisAlign）          →  update_node 不支持  →  set_layout.align  OR  batch_update.align

填充色 / 渐变                            →  set_fill
图片填充                                →  set_image_fill
描边                                    →  set_stroke
描边对齐 / 描边粗细 / 独立描边粗细       →  set_stroke_align
约束（resize constraints）                →  set_constraints
阴影 / 模糊（追加式）                    →  set_effects

❌ 真正无工具的（render 时定死后就改不了）：
  letter_spacing, line_height, text_case
  → 要么 render 时定死，要么删了重 render
```

### 当前提示词对 batch_update 的教学现状

| 位置 | 内容 | 是否提反向清单 |
|---|---|---|
| [system-prompt-base.md:93](open-pencil/src/app/ai/chat/system-prompt-base.md#L93) | 1 行示例（spacing + sizing_horizontal） | ❌ |
| [system-prompt.md:199-200](open-pencil/src/app/ai/chat/system-prompt.md#L199-L200) | 3 个示例（spacing、sizing_horizontal、grow、auto_resize） | ❌ |
| [system-prompt-marketing.md:152](open-pencil/src/app/ai/chat/system-prompt-marketing.md#L152) | 流程指令「fix ALL errors and warnings」 | ❌ |
| [batch.ts:124](open-pencil/packages/core/src/tools/structure/batch.ts#L124) 工具自带描述 | 枚举 16 个支持项 + "Unrecognized prop keys are reported" | ❌（沉默式不禁止） |

**三处提示 + 工具自带描述，全部只列「能用什么」，从不列「不要用什么」**。模型看到 `font_family`/`font_weight` 在白名单，按命名规律脑补 `font_size` 也在 → 翻车。

### 营销 profile 与工具栈的接口错配

watercolor_poster_v3 的第 5 步「色票出来后统一刷色」实际会触发的工具调用：

| 动作 | 应该走 |
|---|---|
| 改字号（眉题 14→13） | `update_node.font_size` 或 `set_font` |
| 切字体（中→PuHuiTi） | `update_node.font_family` 或 `set_font` |
| 改 section 底色 | `set_fill` |
| 改文字色 | `set_fill`（fills）/ `set_font_range` |
| 加 hero 文字阴影 | `set_effects` |

**AI 在 batch_update 里尝试 font_size、batch 里又没法改 fills** —— 两者都不是它「一次能完成」的诉求。Profile 设计者把 Phase 2.5 视为必经路径，但**没有给刷色场景列工具调用模板**。

但本次实测中 AI **完全跳过了 Phase 2.5**：日志 41 个工具调用里**没有 `prepare_hero_scaffold`、`generate_image`、`compose_backdrop`、`derive_palette` 任一项**。直接 hardcode 中性灰写完所有 section —— 这才是「所有文字异常」的根因。Eval 改 fills 错只是这个根因下的一处症状。

### 校验节奏鼓励"攒到最后"

本次日志里 AI 先把 6 个 section 全部 render 完（#8–#13），才在 #14 做第一次 describe。批量 render 的代价是：
- 中间发现的问题无法回滚（只能 replace 整个 section）
- 错位（如 hero 用了 Inter 渲染中文）累计到 #14 才暴露
- describe 报告 17 KB，缓存压力上升

`system-prompt-marketing.md:152` 写「5. `batch_update` to fix ALL errors and warnings — only then move to the next section」，但**没有强制"render 后立即 describe 子节点"**。本次恰好每个 section render 后**没有**立即校验，导致 #8 的 Hero 错误在 #14 才被一并发现。

---

## 三、agent 为什么选 eval：可选工具盘点

修改类工具横向对比：

| 工具 | 输入形式 | 单次能改多少 | 改 fill 是否完整 |
|---|---|---|---|
| `render` | JSX（声明式） | 整段创建/替换 | ✅ 完整（colorToFill 自动补全） |
| `batch_design` | JSON | 批量 | 待验证 |
| `batch_update` | JSON ops 数组 | 批量 | ✅ 完整（走代理 setter 但 batch_update 工具自处理 fill 字段） |
| `update_node` | JSON 单对象 | 单点 | ✅ 完整 |
| `eval` | 任意 JS | 不限 | ⚠️ **不完整**（proxy setter 不补 fill 默认） |

agent 的取舍（步骤 30 内心独白）：

> "Now I need to update font on all other Chinese text nodes. Let me list them by getting the structure.  
> Actually, let me just batch_update with font_family on all text nodes. I need their IDs. Let me describe to find them.  
> **Actually I can do it in one eval call.**"

它优先选代码量最少的方案。

**事后看**：即便选 eval 改 fontName 这一步，**fontName 实际成功了**（面板能读到）。但同一个 eval 跑下来后又顺手 `t.fills = ...` 改颜色——这一改**触发了 Bug 2**，把整个画面的文字全部搞失效。

**最优路径仍然是 `batch_update`**：
- 第 24 步 describe 已经把所有 53 个 ID 列出来了
- batch_update 明确支持 `font_family`（第 16 步错误信息里就有）
- 改 fill 也走专用路径，不会触发 proxy setter 不补默认的坑

---

## 四、26 个核心工具的系统性扫描

按能力域分 9 组，每个标注**能力边界清晰度**和**隐藏陷阱等级**：

### A. 上下文与设置（4 个）
- `get_editor_state`、`get_guidelines`、`get_variables`、`snapshot_layout`
- 问题：`include_schema` 开关没说清、"不兼容"判定没说清、缺 server 级调用指引

### B. 需求与流程管理（5 个）
- `list_pages`、`read_brief`、`create_brief`、`append_brief_conclusion`、`setup_material_type`
- 亮点：`setup_material_type` 返回的 `note` 字段是文档设计的好范本

### C. 节点检视（3 个——职责重叠最严重的一组）
- `describe`（抽象层 + issue 列表）、`get_node`（字段层）、`batch_get`（瑞士军刀）
- 问题：输出格式三种，agent 经常不知道该用哪个

### D. 节点修改（22 个工具 + 1 个 batch_update——**问题最严重的一组**）
- `render`（JSX camelCase）/ `batch_design`（JSON）/ `batch_update`（JSON + 白名单）/ 21 个 modify 子工具
- **核心问题**：
  - 属性命名空间分裂：JSX `font="PuHuiTi"` vs API `font_family: "PuHuiTi"`
  - batch_update 白名单不透明（font_size 不在但 font_family 在）
  - batch_design 描述直接承认文档缺失
  - **proxy 的 fills setter 不补默认**（visual.ts:22-33 `{ ...fill }` 不补 opacity/visible/blendMode）——任何走 proxy 的 `node.fills = [...]` 都会写出不完整的 fill
  - 整套 22 个修改工具的属性 → 工具映射从不被教学

### E. 脚本化执行（1 个——最危险的逃生舱）
- `eval`
- **核心问题**：
  - 异步 API 不可用（`getNodeByIdAsync` 不存在）
  - `loadFontAsync` 沙箱失效（[figma-api/index.ts:504-506](open-pencil/packages/core/src/figma-api/index.ts#L504-L506) 是空实现）
  - 改 fill 写入不完整 fill（走 Bug 2 同一条路径）
  - 返回值（counter）不代表落地结果
  - 零警示文档

### F. 图像生成（1 个）
- `generate_image`（18 秒级，note 文档写得清楚）

### G. 视觉验收（2 个——同样重叠）
- `look`（vision model 判断，8-15 秒）、`get_screenshot`（原始截图）
- 问题：经常混用

### H. 导出（2 个）
- `export_nodes`、`export_html`

### I. 背景与色板（4 个——**协同链最清晰的一组**）
- `prepare_hero_scaffold` → `generate_image` → `compose_backdrop` → `sample_hero_color` → `derive_palette`
- 亮点：协同链在 note 里写得清楚，是文档设计好范本

### 跨工具共性问题

| 问题 | 表现 |
|---|---|
| 能力边界声明散落 5 处 | description / note / 错误信息 / get_editor_state schema / get_guidelines |
| 4 组工具存在"职责重叠三角" | 修改类、检视类、视觉验收类、创建类各自有 3-4 个重叠工具 |
| 属性命名空间分裂 | JSX camelCase vs API snake_case 无映射表 |
| proxy 默认值缺失 | fills setter（visual.ts:22-33）`{ ...fill }` 不补 opacity/visible/blendMode——任何 `node.fills = [...]` 都写入不完整 |
| batch_update 沉默式不禁止 | 16 项白名单 + 错误回执只列 supported，从来不主动说"不要用什么" |
| eval 完全裸奔 | 没有警示、没有可靠操作清单、没有返回值契约 |
| 返回值契约不统一 | render 返回新节点 ID（清晰）、eval 返回 counter（误导）、batch_update 部分执行（混合态） |
| 性能特征没传达 | generate_image 18s、look 8-15s、其他毫秒级——无节奏建议 |

---

## 五、fork 系统提示词 diff 复盘

### 文件结构对比

| 项目 | 原版 | Fork |
|---|---|---|
| 文件数 | 1 个 | 2 个 + transports.ts 拼接 |
| 行数 | 572 行 | 102 + 205 = 307 行 |
| 适用范围 | 通用设计 | **专门** marketing |
| 工作流 | 4 阶段 Plan/Skeleton/Fill/Polish | **5 阶段 0-4 + 3 checkpoint** |

### 删减了什么

| 删除项 | 原版位置 | 影响 |
|---|---|---|
| 完整 mobile app UI 示例 | 原版 224-379 行 | 丢失复杂 layout 教学 |
| 完整 desktop news site 示例 | 原版 381-572 行 | 丢失 12-col grid / sidebar 教学 |
| **Stock Photos 整段** | 原版 97-109 行 | 改由工具 description 承担 |
| `viewport_zoom_to_fit` 禁用规则 | 原版 211 行 | 没明确处理 |
| `export_image` 禁用警告 | 原版 214 行 | 没明确处理 |
| Common patterns "Progress bar"、"Tab bar" | 原版 84-93 行 | 通用 UI 模式被裁剪 |

### 新增了什么

base.md 新增：
- "Always respond in the user's language"（多语言支持）
- "Fixing mistakes"（重渲规则：`replace_id`，不要重复渲染）
- **Typography 强化版**（中文用 PuHuiTi、可用 weight 列表、不要混用字体族）
- "No margin props"（显式禁止 mt/mb）
- **🧮 Tool discipline 整段**（7 条 ⚠️ 警告）

marketing.md 新增：
- Image Tools、Composition Primitives（gradient/blend 3 个常见坑）
- **需求单 (Design Brief)** 协议
- **画布选区 (Canvas Selection)**
- **Marketing Design Workflow (MANDATORY)** 5 阶段 + checkpoint
- **Anchor Component Rules**
- **Design State Tracking**
- **Section Implementation Patterns**

### 改进了什么

1. **Typography 中文字体**（强化"用什么字体"的规则）
2. **Tool discipline 集中化**（从散落 6 处到 base.md 89-101 行集中 7 条）
3. **失败重渲策略显式化**
4. **marketing checkpoint 机制**（每次新 50 步预算）

### 改坏了什么

1. **丢失完整长示例**——原版两个 572 行完整示例是少数能让 agent 真正理解"长链路怎么走"的教学样本
2. **Stock Photos workflow 级说明消失**
3. **viewport_zoom_to_fit / export_image 禁用规则丢失**
4. **eval 限制讲得不够清楚**——只说"不要 debug with eval"，没说"不要批量改 font/fill"
5. **base.md 把 layout 复杂规则压缩**——丢 Progress bar、Tab bar
6. **proxy 的 fills setter 没文档化**——fork 没在 prompt 里提"替换 fills 时必须包含 opacity/visible"，也没修 setter
7. **modify 工具栈的属性映射从未被教学**——batch_update 之外的 21 个工具（set_fill、set_effects、set_text_properties 等）在 fork 里完全没教过何时该用

### 跨文件不一致

| 不一致 | 表现 |
|---|---|
| eval 规则重复但都不完整 | base.md 和 marketing.md 都提到但都没说技术约束 |
| 同一规则重复出现 | "失败 2 次删了重渲"在 base.md 和 marketing.md 都出现 |
| batch_update 能力描述两处都不全 | base.md 只给了 1 个示例，没列完整白名单 |
| Tool discipline vs 工具 description 重复 | 两处都说"不要滥用 look/screenshot"，但互相不引用 |
| language 强制只在 base.md | marketing.md 大量用中文，但没明确 checkpoint 问句必须中文 |

### 本次测试的 3 个 bug 应该在哪个文件被拦住

| Bug | 应该被拦的位置 | 实际有没有拦 |
|---|---|---|
| 用 Inter 渲染中文 | base.md Typography（73 行） | ✅ 拦住了——prompt 有规则，是 agent 失误 |
| batch_update 不支持 font_size | 任意 Tool discipline 段都没列白名单 | ❌ 没拦住 |
| **eval 替换 fill 丢失 opacity/visible** | base.md 完全没说；proxy setter 也没补默认 | ❌ 没拦住——这是这次最严重的失误 |

**核心缺口**：fork 优化了"用什么字体"和"什么时候重渲"，但**完全没覆盖"fill 怎么安全替换"**和"modify 工具栈怎么用"。proxy setter 的不补默认是更基础的工程问题，system prompt 加再多的规则也堵不住——必须改代码。

---

## 六、工具能力暴露哲学（三层模型）

### 核心张力

4 个相关位置，模型读取频率和上下文焦点都不同：

| 位置 | 读取频率 | 上下文焦点 |
|---|---|---|
| 工具 description | **每次**考虑调用时 | 工具特有 |
| base.md | 会话开始、上下文梳理时 | 跨工具策略 |
| marketing.md | 决定走哪条 workflow 时 | 领域 workflow |
| Active style profile | 决定风格选择时 | 任务级覆盖 |

不是哪个位置更好的问题，是**哪类信息在哪类时刻该出现**的问题。

### 三层模型

#### Tier 1：工具契约（Tool description）

**回答的问题**：这个工具是什么、能做什么、不能做什么、调用前后要注意什么

性质：稳定的、单工具特有、跨场景不变的事实

内容清单：
- 参数 schema 与类型
- 返回值结构
- 硬限制（如"max 40 elements"、"白名单不含 font_size"）
- 预条件（如"必须先 loadFontAsync"）
- 副作用（如"触发父 frame 重新布局"）
- 失败模式（如"字体未加载抛错"、"fill.opacity 缺失导致 paintFills 跳过"）
- 同族工具的相对选择（"批量用 batch_update，单点用 update_node"）

**归属理由**：模型在"考虑调用"和"实际调用"这两个最频繁的时刻都需要它。契约放在工具 description 里 = 每次决策时都在场。

#### Tier 2：跨工具节奏（System prompt）

**回答的问题**：完成一个目标该按什么节奏走多个工具

性质：跨工具的策略、节奏、质量标准、领域默认值

内容清单：
- 多步 workflow（Plan → Skeleton → Fill → Polish）
- 验证节奏（"render 后立刻 describe"、"render → describe → fix → 下一个"）
- 失败应对（"2 次失败删了重渲"）
- 领域默认值（"中文用 PuHuiTi"、"spacing on 8px grid"）
- 质量标准（"2-3 weights max"）
- 强制 checkpoint 机制

**归属理由**：这些信息不是任何单个工具的事实，是模型在"决定下一步做什么"时需要的策略层。

#### Tier 3：领域特例（Active style profile）

**回答的问题**：当前这个特定任务的具体风格选择是什么

性质：高度动态、可被用户或会话状态覆盖

**归属理由**：style profile 是任务级别的覆盖，应该和任务一起注入，而不是写死在 system prompt 里。

### 决策表

| 信息类型 | 应该放 |
|---|---|
| 工具的参数类型 | Tool description |
| 工具的硬限制 | Tool description |
| 工具的预条件 | Tool description |
| 工具的失败模式 | Tool description |
| 同族工具的相对选择 | Tool description（推荐） |
| 跨工具的 workflow 节奏 | System prompt |
| 领域默认值 | System prompt |
| 质量/风格标准 | System prompt |
| 失败应对策略 | System prompt（策略层）+ Tool description（技术约束） |
| 任务级风格选择 | Active style profile |

### 判定流程

每次想"这条规则该放哪"，走这个流程：

```
这条规则是关于一个工具的吗？
├── 否 → 关于跨工具节奏吗？
│   ├── 否 → 关于领域特例吗？
│   │   ├── 否 → 你可能不需要这条规则
│   │   └── 是 → Active style profile
│   └── 是 → System prompt (base.md / marketing.md)
└── 是 → 是工具的什么性质？
    ├── 参数/返回/硬限制/失败模式 → Tool description（必有）
    ├── 与同族工具的选择 → Tool description（推荐）
    └── 是关键安全约束吗？
        ├── 是 → Tool description + System prompt 双写
        └── 否 → Tool description（唯一）
```

### 反向问题：什么时候该重复？

不是所有重复都是坏的。**有意重复**适用于：

1. **关键安全约束**（如 anchor readonly 节点不能动）
2. **checkpoint 强制机制**（如"改完必须 describe 验证"）
3. **"硬约束 + 软鼓励"**（同一件事用不同强度在多处写）

**判断标准**：重复如果**不带来强化效果**（只是同一句话拷贝两份），就是 bug。如果**带来不同强度的强化**，就是 feature。

---

## 七、改进建议（按 ROI 排序）

### 必做 P0（直接关掉本次测试 bug）

1. **proxy 的 fills setter 补默认值**（[packages/core/src/figma-api/accessors/visual.ts:22-33](open-pencil/packages/core/src/figma-api/accessors/visual.ts#L22-L33)）—— 治本方案，改 1 处覆盖所有路径：
   ```typescript
   set(this: ProxyThis, value: readonly Fill[]) {
     updateNode(this, internals, {
       fills: value.map((fill) => ({
         type: fill.type ?? 'SOLID',
         color: normalizeColor(fill.color),
         opacity: fill.opacity ?? 1,
         visible: fill.visible ?? true,
         blendMode: fill.blendMode ?? 'NORMAL',
         gradientStops: fill.gradientStops?.map((stop) => ({
           ...stop,
           color: normalizeColor(stop.color)
         }))
       }))
     })
   }
   ```
   ~10 行代码。修完这个，eval / batch_update / update_node / 任何未来 mutation 路径都自动安全。

2. **batch_update 工具 description 加反向清单**（[batch.ts:124](open-pencil/packages/core/src/tools/structure/batch.ts#L124)）：
   > **NOT supported in batch** (use per-node `update_node` / `set_font` / `set_fill` / `set_effects`): `font_size`, `text`, `letter_spacing`, `line_height`, `text_align`, `text_decoration`, `text_case`, `fills`, `strokes`, `effects`, `rotation`, `blend_mode`. Why: batch is layout micro-fix only; `font_size` cascades text height into hug parents and breaks one bad value's neighbors.

3. **system-prompt-base.md 补「属性 → 工具」映射表**（[base.md:93](open-pencil/src/app/ai/chat/system-prompt-base.md#L93) 后追加一节）：
   ```
   ⚠ 属性 → 工具映射（同一概念可能只在某一个工具里支持）：
   - 位置/尺寸/可见性/圆角/不透明度/名称 → update_node
   - rotation → set_rotation；opacity (独立) → set_opacity；radius → set_radius
   - 字体三件套（family/size/weight）→ update_node 或 set_font（后者一次原子）
   - 文本内容 → update_node.text 或 set_text
   - 区间样式 → set_font_range
   - 布局（direction/spacing/padding/align）→ set_layout（单节点）或 batch_update（多节点）
   - 子节点 grow/align → set_layout_child
   - 填充色 / 渐变 → set_fill；图片填充 → set_image_fill
   - 描边 → set_stroke；描边对齐 → set_stroke_align
   - 阴影 / 模糊 → set_effects
   - 约束 → set_constraints
   - blendMode → set_blend；locked → set_locked
   - ❌ 无工具：letter_spacing、line_height、text_case —— render 时定死
   
   ⚠ batch_update 白名单：spacing / padding / padding_h·v / counter_align / align / 
   sizing_h·v / grow / name / visible / corner_radius / opacity / auto_resize / direction / 
   font_family / font_weight。font_size 不在 —— 用 update_node.font_size 单点改。
   ```
   ~30 行。模型调用前有完整索引，省掉事后错误重试的 N 步。

4. **base.md 扩写 eval 限制**：
   ```
   Do NOT use eval to:
   - Debug layout (delete and re-render instead)
   - Bulk-set font/fill/auto_resize on existing nodes via eval — 
     (1) loadFontAsync is a no-op in the eval sandbox;
     (2) the fills setter does NOT fill in opacity/visible defaults, so 
         `node.fills = [{ type, color }]` skips the fill at paint time 
         and the text becomes invisible. Use render replace_id or 
         batch_update instead.
   - Use getNodeByIdAsync (does not exist; use getNodeById sync)
   - Treat returned counters as actual success counts — they aren't.
     Always describe() a sample node after bulk eval mutations.
   ```

### 必做 P1（流程纪律）

5. **system-prompt-marketing.md 强制 render→describe→fix 三步**（[marketing.md:152](open-pencil/src/app/ai/chat/system-prompt-marketing.md#L152) 改写）：
   ```
   5. IMMEDIATELY `describe` the new node (never skip, never defer)
   6. `batch_update` / `update_node` to fix ALL errors and warnings
   7. Only then move to the next section
   ```
   阻止 errors compound——section 1 一个错位的 `w="fill"` 会让下面所有 section 跟着塌。

6. **eval 工具 description 加红色警示**（同 #4 内容）。

7. **render / update_node / look / describe 工具 description 自洽改造**：
   - render：parent_id 必须传、id in JSX 无效、40 element 上限
   - update_node：与 batch_update 的选择（特别是 font_size 在 batch_update 不支持但在 update_node 支持）
   - look / describe 互相引用：look 用于视觉判断、describe 用于结构问题

### 应该做（profile 现场化）

8. **watercolor_poster_v3 第 5 步补工具调用模板**（在 derive_palette 之后那段加）：
   ```markdown
   ## Color refresh workflow (Phase 2.5 step 5)
   After derive_palette returns the color ticket:
   1. Hero title → update_node({ id, font_family, font_size?, color? })
      ⚠ batch_update CANNOT batch font_size — one update_node per text node.
   2. Section backgrounds → set_fill({ id, color }) per section
   3. Accent numbers (折扣 %, 步骤编号) → set_fill per text node
   4. Hero text legibility shadow → set_effects({ id, type: "DROP_SHADOW", ... })
   5. Verify pairing with describe — "隐形字事故" = text color matches background
   
   Order matters: do font + size first, then fills, then effects. 
   Effects last because adding shadows changes node bounding box and 
   may shift layout.
   ```
   把"做什么"和"怎么调工具"绑定写在一起。

9. **恢复一个完整长示例**——至少保留 mobile app 或 desktop news site 一个。
10. **恢复 Stock Photos workflow 级段**。
11. **恢复 viewport_zoom_to_fit 和 export_image 的禁用规则**。

### 可选做（提升一致性）

12. **建立"约束单一真源"**——比如"eval 不能批量改 fill"只在 eval 工具 description 写一次。
13. **跨文件引用规则**：base.md 的 Tool discipline 段开头加一句"以下规则在 marketing workflow 各阶段被引用，权威源在工具 description"。
14. **显式标注"Active style profile"作为第 3 个文件**。
15. **batch_update 增加 font_size_tolerance 软上限**（[batch.ts](open-pencil/packages/core/src/tools/structure/batch.ts) 增加可选参数）：若 ops 含 font_size 且 |delta| ≤ tolerance 则放行；否则**整批拒绝**而非部分执行——避免"4 错 + 2 对"的混合态。
16. **新增 set_typography 工具**——专门覆盖 line_height / letter_spacing / text_align / text_case / text_decoration。profile 反复要求这些参数但工具栈没暴露，模型被迫"删了重 render"。

---

## 八、最小验证集

### 最小回归测试（验证 fork 没改坏关键行为）

| 用例 | 触发 | 验证点 |
|---|---|---|
| 1. 中文长文本 | 用户输入"做一个中文活动海报" | agent 第一次 render 就用 `font="Alibaba PuHuiTi"`，不掉坑 |
| 2. 改字号 | 用户问"标题字号调到 24" | agent 走 render replace_id 或 update_node.font_size，而不是 batch_update |
| 3. 改字体 | 用户问"全部改成思源黑体" | agent 不走 eval，走 render 或 batch_update font_family |
| 4. 改颜色 | 用户问"全部文字改成 #222221" | agent 用 batch_update fill.color 或 set_fill，而不是 eval `t.fills = [...]`（避开 Bug 2） |
| 5. 加阴影 | 用户问"hero 标题加阴影" | agent 走 set_effects 而不是尝试 update_node |

### "工具 description 自洽"测试

> 给一个新 agent：
> 1. 只给它工具 description（不看 base.md）
> 2. 给它任务："把 53 个 Text 节点的颜色改成 #222221"
> 3. 问它会怎么做
>
> 通过标准：它能正确选择 batch_update 或 set_fill 而不是 eval，且不会写出 `t.fills = [...]`（因为 eval 工具 description 警告了 fill 替换陷阱）。

### P0 修复后的二次验证

修完 [visual.ts:22-33](open-pencil/packages/core/src/figma-api/accessors/visual.ts#L22-L33) 之后，跑同一份 watercolor_poster_v3 测试：
- 预期：body 文字可见
- 验证：`describe(0:35, depth=2)` 显示所有 Text 的 fill 有完整 opacity/visible
- 验证：look 看到 hero 和 5 个 section 都有可读的中文标题

---

## 九、约束真源表

| 约束 | 权威位置 | 引用位置 |
|---|---|---|
| proxy 写入 fills 时补默认（opacity/visible/blendMode） | figma-api/accessors/visual.ts | 不用引用（代码本身强制） |
| render 必须 parent_id | render description | marketing.md 不重复 |
| render 的 id in JSX 无效 | render description | marketing.md 不重复 |
| batch_update 不支持 font_size 等属性 | batch_update description（反向清单） | base.md 引用即可 |
| batch_update 部分执行行为 | batch_update description | 不用引用（工具行为） |
| eval 不能批量改 font/fill | eval 工具 description | base.md 引用即可 |
| eval 替换 fills 必须含 opacity/visible | eval 工具 description | base.md 引用即可 |
| eval loadFontAsync 是 no-op | eval 工具 description | base.md 引用即可 |
| 渲染流程 render→describe→fix 强制三步 | system-prompt-marketing.md | 工具 description 不重复 |
| Chinese 用 PuHuiTi | base.md Typography | 无需引用 |
| spacing on 8px grid | base.md Spacing | 无需引用 |
| 失败 2 次删了重渲 | base.md Tool discipline | marketing.md 不重复 |
| "render 后立刻 describe" | base.md Tool discipline | 无需引用 |
| 属性 → 工具映射 | system-prompt-base.md §Tool discipline 末尾 | 工具 description 不重复（不在每条里写映射） |

---

## 十、关键数据点速查

### 本次测试日志关键步骤

- 步骤 16：batch_update font_size 失败（白名单问题）
- 步骤 22-26：get_node 调查 Inter 不含中文
- 步骤 27-28：eval auto_resize 修复（成功）
- 步骤 30：eval font change 第一次（updated: 0 — filter 用 t.fontFamily 但该 getter 不存在）
- 步骤 31：eval font change 第二次（updated: 58 — counter 跑完但不代表落地；fontName 实际改成功了）
- 步骤 36：compose_backdrop
- 步骤 38-39：sample_hero_color + derive_palette
- 步骤 40：eval 批量改 fills（写入不完整 fill：opacity/visible = undefined，**这是导致文字隐形的真正原因**）
- 步骤 41：look 报告 body 全空

### 工具性能（实测）

```
generate_image:    ~18,800 ms
look:             ~8,500–14,500 ms
compose_backdrop:      79 ms
prepare_hero_scaffold: 39 ms
describe:            1–6 ms
get_node:            0–2 ms
render:           100–255 ms
update_node:       12–20 ms
batch_update:       19 ms
eval:              23–347 ms
```

### fork 文件结构

```
open-pencil/src/app/ai/chat/
├── system-prompt.md            # 原版（572 行，通用设计）
├── system-prompt-base.md       # Fork part 1（102 行，identity + DSL reference）
└── system-prompt-marketing.md  # Fork part 2（205 行，marketing workflow）
```

### 相关文档

| 文档 | 关系 |
|---|---|
| [2026-08-12-font-system-review.md](open-pencil/docs/review/2026-08-12-font-system-review.md) | 字体层面的 fontFamily 路由问题已识别（§2.5）；本文关注 modify 工具栈的覆盖缺口与 fill replacement 陷阱 |
| [2026-08-07-long-image-design-quality-review.md](open-pencil/docs/review/2026-08-07-long-image-design-quality-review.md) | 长图质量评审指出"prompt 明确否认其存在"的能力披露缺口；本文在 modify 工具栈层面给出 P0 修复 |
| [2026-08-11-poster-quality-experiment-branch-review.md](open-pencil/docs/review/2026-08-11-poster-quality-experiment-branch-review.md) | 海报感实验分支终审识别 1C+2M+3m；本次发现的 fill replacement 与工具属性映射属于更基础的 modify 栈问题 |

---

## 十一、一句话总结

本次 `watercolor_poster_v3` 测试的根因是**三层叠加**：① batch_update 白名单的 font_size 缺失 + 沉默式不禁止 + prompt 教学缺失让模型必然脑补；② eval 替换 fills 走 proxy setter 不补默认（opacity/visible=undefined）使 paintFills 跳过整个 fill，文字彻底不可见；③ 22 个 modify 工具的属性 → 工具映射从没被系统化教学。**P0 四项改动（proxy setter 补默认 + batch_update 反向清单 + 属性映射表 + render→describe→fix 三步强制）即可消除 80% 同类翻车**。
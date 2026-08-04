# Anchor 机制设计评审（2026-08-03）

> 评审对象：library schema 中 `anchor_first` / `anchor_last` 属性，以及配套的 `validate` 工具与 `setup` 物化流程。
> 评审范围：用户提出的核心场景——"**品牌 logo 必须出现在海报顶部，但需要覆盖压在 hero 图之上**"——是否在当前数据模型下能实现。
> 评审依据：fork 的源代码（`packages/core/src/tools/marketing/library.ts:21-32` / `setup.ts:255-280` / `validate.ts:36-71` / `setup.ts:178-190`）、SceneGraph API（`packages/scene-graph/src/instances.ts:183-209` / `index.ts:451`）、设计文档（`docs/library-format.md` / `docs/plans/architecture/l2-resource-library.md`）。
> 评审结论：**当前 anchor 数据模型无法表达"覆盖压在 hero 图之上"这一常见场景**。这不是 first/last 位置枚举的精度问题，而是 anchor 建模时**只设计了"位置"维度、未设计"父子关系 / z-order"维度**的根本缺口。短期可打补丁（`overlay: true` 字段），但属于在错误抽象层叠加逃生口；正确做法是在 v1.5 库沉淀机制启动前，把"约束面"从"挂在 root frame 上的 2 个 child 标签"升级为"可在多层 frame 表达的约束集合"，并把 patterns 下沉、CP3 内部素材库接入、anchor 演进作为同一次设计任务。

---

## 一、当前实现到底做了什么

### 1.1 数据模型

`packages/core/src/tools/marketing/library.ts:21-32`：

```typescript
export interface LibraryType {
  id: string
  label: string
  description?: string
  size: { width: number; height: number | null }
  anchors: { template: string; position: 'top' | 'bottom' }[]  // ← 关键
  nodeId: string
}
```

每个 type 最多 2 个 anchor，position 枚举只有 `'top' | 'bottom'`，分别对应根 frame 的第 0 个 child 与末位 child。

### 1.2 物化逻辑

`packages/core/src/tools/marketing/setup.ts:255-280`（`materializeAnchor`）：

```typescript
const instance = graph.createInstance(componentId, rootFrameId, {})
graph.updateNode(instance.id, { counterAxisSizing: 'FILL' })

const rootFrame = graph.getNode(rootFrameId)
if (rootFrame) {
  const index = anchorRef.position === 'top' ? 0 : rootFrame.childIds.length - 1
  graph.reorderChild(instance.id, rootFrameId, index)
}

markMarketingAnchor(graph, instance.id, {
  templateId: anchorRef.template,
  position: anchorRef.position,
  componentId
})
```

### 1.3 校验逻辑

`packages/core/src/tools/marketing/validate.ts:36-71`（`checkAnchors`）：

```typescript
const childIds = rootFrame.childIds
for (const anchor of state.anchors) {
  if (!graph.getNode(anchor.instanceId)) {
    violations.push({ type: 'anchor_deleted', ... })
    continue
  }
  const expectedIndex = anchor.position === 'top' ? 0 : childIds.length - 1
  if (childIds[expectedIndex] !== anchor.instanceId) {
    violations.push({ type: 'anchor_misplaced', ... })
  }
}
```

校验只做两件事：锚点 instance 还在不在；它是否在第 0 / 末位。**仅此而已**。

### 1.4 Root frame 的布局前提

`packages/core/src/tools/marketing/setup.ts:178-190`（`createRootFrame`）：

```typescript
const frame = graph.createNode('FRAME', pageId, {
  name: config.label,
  width: config.size.width,
  height: config.size.height ?? 400,
  layoutMode: 'VERTICAL',       // ← 关键
  counterAxisSizing: 'FIXED',
  primaryAxisSizing: config.size.height === null ? 'HUG' : 'FIXED',
  clipsContent: true,
  ...
})
```

**Root frame 一律 VERTICAL 布局，无 absolute 逃生口。**

---

## 二、用户场景的需求拆解

**场景陈述**：品牌 logo 必须出现在海报顶部，但需要覆盖压在 hero 图之上。

这个场景需要**两件事同时满足**：

| 维度 | "锚定位置" | "图层叠放" |
|---|---|---|
| 含义 | logo **必须出现**在海报某个区域 | logo **必须在 hero 图之上**（视觉上压住） |
| 校验 | 位置校验（first / last）| 父子关系 / z-order 校验 |
| 当前模型 | ✅ `anchor_first` 表达 | ❌ **完全没有表达** |

期望的视觉结构（从底到顶）：

```
┌─────────────────────────────────────┐
│  ROOT FRAME (1080x1440, no layout)  │
│  ┌───────────────────────────────┐  │
│  │  HERO FRAME (anchor: hero)    │  │  ← child[0]，FILL 整个画布
│  │  [hero image]                 │  │
│  └───────────────────────────────┘  │
│  ┌─────────┐                       │  │
│  │  LOGO   │  ← child[1], 顶层     │  │  ← 浮层，absolute top:32, left:32
│  │  (anchor: brand)               │  │
│  └─────────┘                       │  │
└─────────────────────────────────────┘
```

---

## 三、当前模型为什么支撑不了

### 3.1 Anchor 隐含 = "root frame 的直接 child"

`reorderChild(instance.id, rootFrameId, index)` 这个 API 调用本身决定了 anchor 必须是 root frame 的儿子。**没有"锚点是浮层"这个语义，也没有"锚点有自己的子 frame"这个语义。**

### 3.2 VERTICAL layout = 没有 absolute 布局

root frame 一创建就是 `layoutMode: 'VERTICAL'`，所有 child 沿垂直方向堆叠。SceneGraph 内部不支持在 VERTICAL 容器中嵌入 absolute 定位的子节点（childIds 顺序就是渲染顺序）。

### 3.3 反直觉点：anchor_first 反而是"渲染最底层"

VERTICAL layout 下，`childIds[0]` 是纵向最顶的 child，但**渲染顺序是按 childIds 顺序从后往前绘制**——后入栈的渲染在上。

也就是说，**如果用 anchor_first 放 logo，logo 反而被压在所有 child 下面，被 hero 图遮住**。`anchor_first` 的"first"是布局顺序的"first"，不是视觉层级的"top"。

### 3.4 物化逻辑决定了一切都在一层

`materializeAnchor` 全程只操作 `rootFrameId` 这个 parent。**没有"独立 overlay frame"的概念，setup 永远把 instance 挂到 root frame 上**。validate 也只能校验 root frame 的 childIds[0] / [-1]。

---

## 四、当前模型下"擦边"实现会发生什么

**方案 A：不当锚点，让 AI 自由发挥**

- anchor_first / anchor_last 都放空
- 品牌 logo 由 AI 自由发挥——**校验全部失效，"必须有 logo"这个硬约束丢失**

**方案 B：在 root frame 之外再开一个独立的浮层 frame**

- BrandBar 放进去，但**当前 setup / validate / restore 三处都没有"浮层 frame"概念**
- 要让 BrandBar 在某个特定 frame 下，**必须新增"multi-frame anchor"机制**——比当前 6 行 validate 复杂得多

**方案 C：改 root frame 布局为 NONE**

- logo + hero 全部 absolute 定位
- 但**"中间自由发挥区"也要走绝对定位，AI 操作成本陡增**
- 与 fork "约束 + AI 自由"产品哲学冲突（约束面 = 极度结构化，自由面 = 不能用结构化工具）

**这三种都是 hack，不是设计。**

---

## 五、真正的设计缺口是什么

### 5.1 缺口 1：约束面只建模了"位置"，没建模"父子关系 / z-order"

当前 mental model：

> root frame = 约束面（锚点 + 嵌套）+ 自由面（AI 自由发挥）

用户场景暴露的真正需求：

> 真正的"约束面" = 多个 frame（ROOT + OVERLAY），每个有自己的锚点和自由区

**这是把"约束面"从"单层 frame"提升到"多层 frame"**。同一个子问题 §2.5.6 的"patterns 锁死 prompt"已经触及——**约束需要更结构化的抽象，不能全靠 root frame + 锚点位置**。

### 5.2 缺口 2：position 枚举表达力有限

即使不引入 overlay 概念，**单层 frame 下锚点位置表达力也有限**：

| 场景 | 当前位置是否能表达 |
|---|---|
| 顶部品牌区 + 底部 CTA 区（默认） | ✅ `anchor_first` + `anchor_last` |
| 中间位置硬约束（电商价格区、药品国药准字） | ❌ 无 |
| 横屏 16:9 左右双栏布局 | ❌ 无（VERTICAL layout 强制纵向） |
| 同一 component 多次出现（不同 SKU 缩略图） | ❌ 无 |
| 可选锚点（某些 type 不需要 CTA） | ❌ 无 |
| 内容升级（v1 库橙色 CTA，v2 库黑色 CTA） | ❌ 无 |

**6 个常见场景里 5 个表达不了。** position 枚举 + 单层 frame 是 v1 阶段"够用"的最小设计，但**用户产出的库会立刻撞到这些边界**。

### 5.3 缺口 3：治理 / 决策权未区分

当前 model 把"位置"当成不可变硬约束，但**运营 / 设计师的执行权没编进来**：

- AI 想把 BrandBar 移到中间去呼应"对比风格"——validate 报 misplaced
- 运营认为中间位置更适合品牌，挪了 BrandBar——validate 仍报 misplaced
- **没有"用户主动挪 vs AI 误操作"的区分**

---

## 六、演化路径（4 个可选，按落地难度递增）

### 路径 A：保持 first/last + 加 overlay 逃生口（最小改动）

```yaml
anchor_first: BrandBar
anchor_last: CTABar
overlay_anchors:                  # ← 新增
  - template: LogoOverlay
    parent: overlay
    z_order: top
```

- 改动：library.ts 多解析 1 个 key，setup.ts 多 1 个 if（把 overlay 锚点放到独立 OVERLAY frame），validate.ts 多 1 个 check
- 解决：用户当前场景（logo 覆盖在 hero 上）
- 局限：**schema 复杂度直接翻倍，但仍在单层抽象上打补丁**——下一次出现"中间位置硬约束"时还得 deck 加字段

### 路径 B：position 升级为有序列表 + overlay 一起设计（推荐）

```yaml
anchors:
  - template: BrandBar
    position: 0
  - template: CTABar
    position: -1
overlay_anchors:
  - template: LogoOverlay
    z_order: top
```

- 改动：library.ts 字段改 schema（有序列表），validate.ts 校验逻辑改（`expectedIndex = anchor.position < 0 ? childIds.length + anchor.position : anchor.position`），setup.ts 物化逻辑改
- 解决：4 个常见场景（中间位置 / 顺序固定 / 覆盖 / 多次出现）
- 仍不能解决：多区域横屏布局（顺序结构 vs 区域结构是不同维度）

### 路径 C：约束面按"区域"切分（推荐长期）

```yaml
anchors:
  top: [BrandBar]
  middle: [PriceTag, Countdown]      # 中间顺序
  bottom: [CTABar, LegalFooter]
  overlay: [LogoOverlay]
```

- 改动大：library.ts 字段、validate.ts 校验逻辑（按 region 校验）、setup.ts 物化逻辑（按 region 决定父是 root frame 还是某个中间 group）
- 解决：所有 6 个常见场景
- 额外收益：架构成"约束面 + 区域"二级结构，与"约束 + AI 自由"产品哲学自洽——**约束面定义"哪里必须有"，AI 自由发挥"中间有什么"**

### 路径 D：完全不同的抽象——anchor + region 都降为"插槽"

```yaml
slots:
  - id: header
    region: top
    required: true
    template: BrandBar
  - id: footer
    region: bottom
    required: true
    template: CTABar
  - id: cta-zone
    region: middle
    required: false
    templates: [CTABar, AppQR]      # 二选一，体现"选择性"
    position: last
  - id: logo-overlay
    region: overlay
    required: true
    template: LogoOverlay
```

- 改动最大：相当于重新建模 anchor 概念
- 优势：语义最丰富（required / region / templates 候选 / position 顺序）
- 劣势：当前 validate 6 行代码会变成 60 行，**校验复杂度会跨过"读代码即可审计"的临界点**

---

## 七、决策与建议

### 7.1 短期（v1）

**维持当前 `anchor_first` / `anchor_last` 是对的**——足够撑住默认库 + 几个常用 type，且能撑住 v1 的"产品级可行"验证。

**但 anchor 命名暗示了"first / last"是完整语义，这是埋的坑**：

- `anchor_first` 字面意思是"钉第一个"，但用户可能想表达"钉在顶部"
- 一旦用户产出的库用了 `anchor_first` 之外的修饰方式，validate / setup / restore 三个地方都会面对 schema 演进问题

**建议**：在 v1 阶段把"v1.5 启动约束面架构升级"作为公开承诺，写进 `docs/plans/architecture/l2-resource-library.md`。**不要在 v1 阶段为这个用户场景打补丁**——打补丁会让后续架构升级的成本翻倍。

### 7.2 中期（v1.5 库沉淀机制启动前）

**必须做的前置设计：约束面分层架构**。理由：

1. **路径 B 是路径 A 的严格超集**——`anchor_first: X` ⇔ `anchors: [{template: X, position: 0}]`，老库可自动迁移
2. **validate 逻辑只多 5 行**——expectedIndex 计算 + overlay 校验
3. **setup 逻辑只多 1 个循环**——遍历 anchors 列表
4. **在 user-generated library 出现之前演进**——生态绑定就避免了。**一旦用户写出 `anchor_first`，字段命名就锁死了**
5. **patterns 下沉、CP3 内部素材库接入、库沉淀机制三个特性都基于此架构**——必须一起设计

**路径 B + overlay 一起演进**是推荐路径：路径 B 解决位置维度，overlay 解决父子关系 / z-order 维度。两个维度一起设计，**避免分两次改 schema**。

### 7.3 长期（v2）

**约束面分层架构**——把 anchor 概念从"挂在 root frame 上的 2 个 child 标签"提升到"多层 frame 的约束集合"。这一步**比 schema 演进更深**，是 mental model 的升级。

**但不要直接跳到路径 D**——抽象层级跃迁 + 校验代码跨越"读得懂"的临界点，**对营销场景（不是游戏引擎 / IDE）的用户体量是 over-engineering**。

### 7.4 治理问题独立处理

**局限 5.3（治理 / 决策权）独立于 schema 选择**——这是 UX 决策，不是数据结构决策。可以**单独立项**：

- 在 setup / validate 上加"用户主动挪动 → 标记 unlocked，下次 validate 不报"的机制
- 而不是改 anchor schema
- 这是 RR（Revision & Review）工具链的另一个维度的工作

---

## 八、与其他评审的关系

这个问题与 `2026-08-01-marketing-workbench-branch-review.md` 已经触及的两点高度相关：

- **§2.5.6 patterns 锁死 prompt**——patterns 与 anchor 应当共用同一套位置机制
- **§2.6.1 库沉淀机制 v1**——用户产出的库会暴露这层局限

**建议**把本评审的"约束面分层架构"作为新条目加进产品演化路径，与 §2.6.1 / §2.6.4 并列，**且必须先于这两个交付**。

---

## 九、落地清单

按优先级排序：

1. **P0（v1.5 启动前必须）**：约束面分层架构设计评审——paths B + overlay 一体设计
2. **P0**：patterns 下沉（§2.6.4）与 anchor 演进作为**同一次设计任务**——共用位置机制
3. **P1（v1.5 启动前应该）**：把当前 `anchor_first` / `anchor_last` 标为"v1 过渡字段"，新文档明确提示 v1.5 会迁移
4. **P1（v2 启动前）**：约束面分层架构（路径 C）——多层 frame 的 mental model 升级
5. **P2（v2 启动前可考虑）**：治理 / 决策权（RR 工具链）——独立项目
6. **P3（不推荐）**：路径 D（slot 抽象）——除非用户场景出现"多个 component 候选项二选一"等真实需求

---

## 十、文档与生命周期

- **落档纪律**：按惯例本评审落档后不再改动。后续修订通过 `docs/plans/architecture/l2-resource-library.md` 与代码提交生效
- **可重跑性**：所有代码引用基于 HEAD `3f5d4da0`，文件位置与行号在 commits 之间会漂移
- **后续复审触发条件**：
  - v1.5 库沉淀机制启动前（必须把 P0 走完）
  - 用户提报"中间位置硬约束"需求时（路径 B 启动信号）
  - 用户提报"logo 覆盖在 hero 图之上"需求时（本评审的原始场景）

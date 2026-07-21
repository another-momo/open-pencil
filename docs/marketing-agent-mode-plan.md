# 营销图片设计 Agent 模式：详细规划

> 最后更新 2026-07-21。本文档是营销 Agent 模式的设计基础，讨论如何在 OpenPencil 现有 AI 工具链上构建营销图片的专用工作流。

## 1. 为什么需要专用 Agent 模式

### 1.1 现有 UI Agent 的特征

当前 `system-prompt.md`（593 行）是为通用 UI 设计优化的：

- **4 阶段流程**：Plan → Skeleton → Fill → Polish，适用于复杂多 section 页面
- **50 步预算**，步骤分配：1 calc + 5-7 skeleton renders + 1 stock_photo + 2 describes + 1-2 batch_updates
- **核心循环**：render 骨架 → describe 检查 → batch_update 修复 → render 填充真实内容
- **质量标准**：布局正确性、间距一致、文字层级、响应式结构
- **工具侧重**：render 为主，stock_photo 为辅，generate_image 仅在 Phase 4 提及

### 1.2 营销设计的本质差异

用一个真实长图案例说明。一个移动端营销活动落地页（1080×3840）包含 7 个 section：

| Section | 内部结构 | 核心操作 |
|---|---|---|
| 1. 主视觉区 | 插画底图 + 艺术字标题 + 副标题 + Logo | generate_image → render 文字层 |
| 2. 活动指引 | 水平流程图 + 箭头 + 图标 + 说明小字 | **纯 render**（无底图） |
| 3. 核心商户推荐 | 2 张商品卡片（圆角白底 + 实物图 + 价格 + 折扣标签） | render 卡片 + stock_photo 商品图 |
| 4. 更多商户网格 | 3×3 九宫格，每格含 Logo/图片 + 商户名 + 面额 | **纯 render**（无底图） |
| 5. 营销横幅 | 2 个独立横幅：电影海报（generate_image）+ 商圈促销（纯 render） | 混合 |
| 6. 底部品牌区 | 深色底色 + QR 码 + Slogan + 引导按钮 | **纯 render** |

**关键发现**：7 个 section 中只有 2 个重度依赖 generate_image（主视觉、电影海报），其余都是纯 render 排版工作。Section 内部结构高度异构——流程图、九宫格、价格标签、印章徽标等在 UI 设计中很少出现。

### 1.3 结论：不需要独立 Agent，需要专用 prompt 变体

底层工具链完全相同（render、generate_image、describe、batch_update）。差异在编排逻辑和领域规则。独立 Agent 意味着重复维护两套工具注册——收益不大。

正确做法：**营销专用 system prompt 变体**，保留可复用经验规则，替换 Workflow 章节，新增营销领域元素。

## 2. 从 UI prompt 复用什么

### 2.1 直接复用的经验规则

以下规则对营销设计完全适用，无需修改：

| 规则 | 位置 | 说明 |
|---|---|---|
| flex 声明 | 第 35 行 | 多子节点 Frame 必须有 flex="col" 或 flex="row" |
| w="fill" 文字换行 | 第 49 行 | 多行文字必须 w="fill" 才能正确换行 |
| calc 做布局算术 | 第 69 行 | 批量计算，不用心算 |
| 间距 4px 网格 | 第 57 行 | 4/8/12/16/20/24/32/48 |
| 文字层级 scale | 第 73 行 | Display/H1/H2/H3/Body/Caption，2-3 个 weight |
| 描述性节点命名 | 第 31 行 | name="HeroTitle" 方便 describe 定位 |
| describe → batch_update 修复循环 | 第 186-189 行 | 每次 render 后立即检查并修复 |
| replace_id 原子替换 | 第 175-179 行 | 骨架用占位，填充时原子替换 |
| 骨架 → 填充 → 验证 3 阶段 | 第 134-201 行 | 先建骨架再填充，保证布局正确 |

### 2.2 需要调整的规则

| UI prompt 规则 | 营销场景调整 |
|---|---|
| 50 步预算 | 保持 50 步不变，通过 prompt 设计约束行为 |
| 4 阶段（Plan/Skeleton/Fill/Polish） | 6 阶段但每阶段更短（见 §4） |
| stock_photo 为主填充图片 | generate_image + stock_photo 混用 |
| 1 个 skeleton render 覆盖整页 | 按 section 分批 skeleton + fill |

### 2.3 需要新增的规则

营销设计特有的元素和约束，UI prompt 中没有覆盖：

- 价格数字排版（大号数字 + 单位 + 删除线原价）
- 九宫格/多列卡片的 render 模式
- 流程图水平排列 + 箭头连接
- 印章/徽标类装饰元素
- QR 码占位与品牌区布局
- 品牌色注入机制
- generate_image 与 render 的交替节奏
- 安全边距（文字不被底图裁切）

## 3. Section 类型库

核心设计思路：不给 AI 一个固定模板让它填空，而是定义几种 section 类型，AI 根据每个 section 的类型选择对应工作流。

### 3.1 类型定义

#### ImageHero：底图 + 文字叠加

**适用场景**：主视觉区、促销横幅、任何"大图 + 标题"的 section

**工作流**：
1. generate_image 生成底图（prompt 不含文字）
2. render 文字层（标题 + 副标题 + CTA 等）
3. describe 检查文字可见性、对比度

**约束**：
- 底图 prompt 必须描述"无人物文字的纯净背景"
- 文字必须有背景遮罩或描边，保证在任何底图上可读
- CTA 按钮必须有对比色背景

#### PureLayout：纯排版（无底图）

**适用场景**：流程图、九宫格、价格列表、品牌区、指引说明

**工作流**：
1. 直接 render，无需 generate_image
2. describe 检查布局

**约束**：
- 结构清晰：用 flex 布局而非绝对定位
- 九宫格用 grid 或 wrap flex
- 流程图用 flex="row" + 箭头图标

#### MixedCard：卡片 + 图片 + 文字

**适用场景**：商户推荐、商品展示、任何"卡片内含图片"的 section

**工作流**：
1. render 卡片骨架（白底圆角 + 图片占位矩形 + 文字行）
2. stock_photo 或 generate_image 填充图片
3. render 真实文字内容
4. describe 检查

**约束**：
- 卡片内图片用 w="fill" h={固定高度}
- 价格数字用大号 weight="bold"，原价用删除线
- 折扣标签用绝对定位的色块

### 3.2 类型选择逻辑

AI 在 Plan 阶段为每个 section 标注类型：

```
Section 1: ImageHero (generate_image + render 文字)
Section 2: PureLayout (render 流程图)
Section 3: MixedCard (render 骨架 + stock_photo + render 文字)
Section 4: PureLayout (render 九宫格)
Section 5: ImageHero (generate_image 横幅) + PureLayout (render 商圈文字)
Section 6: PureLayout (render 品牌区)
```

然后按类型执行，不同类型的工作流不同。

## 4. 营销工作流

### 6 阶段流程

```
Phase 1 — Layout Plan (text only, no tools)
  规划：几个 section、每个 section 的类型、尺寸、内容概要
  标注每个 section 的类型：ImageHero / PureLayout / MixedCard

Phase 2 — Generate Images (batch, for ImageHero sections)
  generate_image 批量生成所有 ImageHero section 的底图
  PureLayout section 跳过此阶段

Phase 3 — Skeleton (按 section 分批)
  render 创建整体框架（纵向 auto-layout frame）
  每个 section 用占位元素 + 文字行数预估
  按 section 分批 render，不要一次超过 40 个元素

Phase 4 — Verify Layout
  describe 检查骨架布局、间距、比例
  batch_update 修复问题

Phase 5 — Fill Content (按 section 交替)
  对每个 section：
    ImageHero: replace_id 替换为真实文字内容
    PureLayout: replace_id 替换为真实排版
    MixedCard: stock_photo/generate_image 填图 → render 文字
  每 3 个 section 后 describe root 检查跨 section 布局

Phase 6 — Final Verify
  describe 检查文字可见性、CTA 对比度、整体协调
```

### 与 UI 工作流的对比

```
UI:     Plan → Skeleton → describe → batch_update → Fill → describe → Polish
        (1 skeleton render 覆盖整页，stock_photo 批量填图)

营销:   Plan → Generate Images → Skeleton → describe → Fill (交替) → Verify
        (generate_image 前置，按 section 类型交替 fill，无 stock_photo 批量阶段)
```

## 5. 营销特有 render 模式

### 5.1 九宫格

```jsx
<Frame name="MerchantGrid" w="fill" flex="row" wrap rowGap={12} columnGap={12}>
  {Array.from({ length: 9 }, (_, i) => (
    <Frame key={i} w={320} flex="col" bg="#FFFFFF" rounded={8} overflow="hidden">
      <Rectangle w="fill" h={180} bg="#F5F5F5" /> {/* 图片占位 */}
      <Frame w="fill" flex="col" gap={4} p={12}>
        <Text w="fill" size={14} weight="medium" color="#111827">商户名称</Text>
        <Frame flex="row" items="center" gap={4}>
          <Text size={20} weight="bold" color="#E53E3E">25元购</Text>
          <Text size={12} color="#9CA3AF" textDecoration="line-through">50元</Text>
        </Frame>
      </Frame>
    </Frame>
  ))}
</Frame>
```

### 5.2 价格标签

```jsx
<Frame flex="row" items="center" gap={8}>
  <Text size={32} weight="bold" color="#E53E3E">25</Text>
  <Frame flex="col" gap={2}>
    <Text size={12} weight="medium" color="#E53E3E">元购</Text>
    <Text size={12} color="#9CA3AF" textDecoration="line-through">50元券</Text>
  </Frame>
  <Frame bg="#FF6B35" px={8} py={4} rounded={4}>
    <Text size={11} weight="bold" color="#FFFFFF">5折</Text>
  </Frame>
</Frame>
```

### 5.3 流程图

```jsx
<Frame name="ProcessFlow" w="fill" flex="row" items="center" justify="center" gap={8}>
  {['搜索商户', '周三10:00', '支付', '周三使用'].map((step, i) => (
    <Fragment key={i}>
      <Frame flex="col" items="center" gap={8}>
        <Frame w={48} h={48} rounded={24} bg="#4CAF50" flex="row" items="center" justify="center">
          <Icon name={`lucide:${icons[i]}`} size={20} color="#FFFFFF" />
        </Frame>
        <Text size={12} color="#333333">{step}</Text>
      </Frame>
      {i < 3 && <Icon name="lucide:chevron-right" size={16} color="#9CA3AF" />}
    </Fragment>
  ))}
</Frame>
```

### 5.4 品牌区

```jsx
<Frame name="BrandFooter" w="fill" bg="#8B1A1A" flex="col" items="center" py={32} px={24} gap={16}>
  <Frame bg="#FFFFFF" p={12} rounded={8}>
    <Rectangle w={80} h={80} bg="#000000" /> {/* QR 码占位 */}
  </Frame>
  <Text size={14} color="#FFFFFFCC">掌上生活App 周三5折</Text>
  <Text size={18} weight="bold" color="#FFFFFF">服务好 优惠多 趣生活</Text>
  <Frame bg="#FFD700" px={24} py={10} rounded={20}>
    <Text size={14} weight="bold" color="#8B1A1A">立即下载</Text>
  </Frame>
</Frame>
```

## 6. 品牌包注入机制

### 6.1 prompt 注入

营销 system prompt 中预留品牌变量占位：

```markdown
## Brand Context
- Primary color: {{brand.primaryColor}}
- Secondary color: {{brand.secondaryColor}}
- Font family: {{brand.fontFamily}}
- Logo URL: {{brand.logoUrl}}
- Style keywords: {{brand.styleKeywords}}

When generating images, append style keywords to the prompt.
When rendering text, use brand colors and font family.
```

### 6.2 generate_image prompt 追加

```typescript
const brandSuffix = `, ${brand.styleKeywords}, ${brand.primaryColor} color scheme`
const fullPrompt = userPrompt + brandSuffix
```

### 6.3 render 文字品牌化

```jsx
<Text font={brand.fontFamily} color={brand.primaryColor} ...>
```

## 7. 实现路径

### Phase 1：prompt 研发（纯文本，不碰代码）

1. 基于 UI prompt 提取可复用规则（§2.1）
2. 编写营销 workflow 章节（§4）
3. 编写 section 类型库（§3）
4. 编写营销特有 render 模式（§5）
5. 合并为 `system-prompt-marketing.md`

### Phase 2：实测迭代

1. 用真实营销需求测试 prompt
2. 收集 AI 常犯的错误，补充硬规则
3. 优化 section 分批策略和工作流节奏
4. 验证 generate_image + render 交替节奏

### Phase 3：接入（可选）

1. 在 AI chat 设置中添加"模式切换"（UI 设计 / 营销设计）
2. 根据模式加载不同 system prompt
3. 不需要新建 Agent 架构，只是 prompt 切换

## 8. 待讨论的问题

1. **prompt 切换方式**：手动切换 vs 自动识别用户意图？
2. **模板的"硬编码"程度**：Section 类型库是写死在 prompt 里，还是可扩展？
3. **品牌包的存储位置**：localStorage vs 文件系统 vs 云端同步？
4. **与现有 workflow 的关系**：是替换 system-prompt.md 还是作为独立文件按需加载？
5. **测试基准**：用什么标准衡量营销 prompt 的出稿质量？

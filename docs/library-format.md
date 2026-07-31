# Library .fig 格式规范

> 营销素材资源库（type / profile / component / reference）的文件格式契约。任何 `*Library*.fig` 都按本规范被 `setup_material_type` / `dialog` / `marketing-config` 消费。

> 规范与实现同步：`packages/core/src/tools/marketing/library.ts` 是 single source of truth；本规范用自然语言重述。任何字段在这里标 normative MUST 时，若与代码不一致，以代码为准并修订本规范。

---

## 1. TL;DR

- 一个 `.fig` 文件 = 一个营销素材库。
- 文件顶层只有一个 Page；该 Page 上有四个**按名字识别的 zone frame**（精确匹配名，trim 空白容忍）：
  - `Types` 区、`Profiles` 区、`Components` 区、`References` 区
- 每个 zone 内一个 entry frame，metadata 写为该 frame 的**纯 TEXT 子节点**（`key: value` 格式；Profiles 用一段 Markdown 而不是 KV）。
- **全 plain nodes**——库文件本身不使用 pluginData；位置约定（zone/entry 命名）就是唯一契约。`role=library` 这类库内元信息被**否决**（见 l2-resource-library.md Q1）。
- 出错不沉默：解析层的全部畸形 → 一条人话 warning 写进 `LibraryIndex.warnings`，setup 返参的 `warnings` 字段带回对话上下文；用户/AI 能直接修复。

## 2. 文件 / 节点基本约定

| 项 | 规则 | 备注 |
|---|---|---|
| 文件类型 | `.fig`（Figma Kiwi 编码） | 兼容 `.pen`（OpenPencil 原生）；`IORegistry(BUILTIN_IO_FORMATS).readDocument` 解析 |
| 顶层 Page 数 | 1（只读第一个） | 多页会被忽略多余页 |
| Library 自带 `pluginData` | **禁止** | 库内 marker 系统反对（见 Q1） |
| Zone frame 的 type | 普通 `FRAME` 即可 | 不需要 `COMPONENT_SET` / `Section` 之类特殊容器 |
| Entry frame 的 type | 普通 `FRAME`；Components 区要求 `COMPONENT`（具体见 §5） |  |
| KEY/VALUE 文本 type | `TEXT`；每个 children 是独立 TEXT 行（多行容忍） |  |
| `name` 字段 | key 用 ASCII 标识符（`id`/`size`/…）；中文 `label` 等用户可见字符串可放 Node 任意文本字段 | id 必须 ASCII，label 可以是中文 |

## 3. Zones 与每个 entry 的 index 主键

| Zone | Frame 识别名 | Entry 主键来源 | 用作 |
|---|---|---|---|
| **Types**     | `Types`     | 子文本 `id: xxx` → xxx；缺则取 frame 名 | 素材类型 id |
| **Profiles**  | `Profiles`  | frame 名 | profile id |
| **Components**| `Components`| frame 名 | 组件 id（与 Types 里的 `anchor_first`/`anchor_last` 关联） |
| **References**| `References`| frame 名 | reference id |

Zone 缺失 → 该区当作空 + 一条 warning `Library has no "X" zone — treated as empty`，不报错（库可作者只关心一两个区）。

Entry 主键重复（同 zone 内两 entry 同 id/同名）→ 一条 warning `duplicate id — first entry wins`，保留第一个。

## 4. Types 区细则（每个 entry 一个 frame）

### 4.1 Children TEXT 行语法

每一行满足正则 `/^([A-Za-z_]+)\s*:\s*(.*)$/`（一个 key、空格/冒号/空格、剩余为 value）。允许多行、允许多 TEXT 节点（多 TEXT 用换行符分开后逐行解析；TEXT 节点本身也允许多行）。

允许的 key：

| key | 值格式 | 必填 | 说明 |
|---|---|---|---|
| `id` | ASCII 字符串 | 否（缺则用 frame 名） | 该 type 的 id |
| `label` | 任意字符串 | 否（缺则用 frame 名） | UI 显示名 |
| `size` | `<width>x<height>` 或 `<width>x`（高度可变） | **是** | 根 frame 尺寸；单位 px；正则 `/^(\d+(?:\.\d+)?)\s*[x×]\s*(\d*(?:\.\d+)?)$/i`；小数点允许；`×` 与 `x` 等价 |
| `description` | 字符串 | 否 | 一句话说明；出现在类型 chips tooltip + setup note 拼给 AI |
| `anchor_first` | 组件名（== Components 区的某个 COMPONENT name） | 否 | 根 frame 第 0 个 child 应为该组件 INSTANCE；不在 Components 区 → warning |
| `anchor_last` | 同上 | 否 | 根 frame 末位 child 应为该组件 INSTANCE |

未知 key → warning `<zone>/<frame>: unknown key "X" ignored`，不影响其他字段。

多行同 key → 每行算一个 value，取第一个（其余当 unknown key 前的 warning 也会出现——新增重复 key warning）。

### 4.2 一个完整 example

```
Types (FRAME, zone root)
 └── wechat_moments (FRAME, id=wechat_moments)
      ├── TEXT "id: wechat_moments"
      ├── TEXT "label: 朋友圈广告"
      ├── TEXT "size: 1080x1080"
      └── TEXT "description: 微信朋友圈方形广告图，促销活泼风格"
```

带锚点的：

```
 └── product_long
      ├── TEXT "size: 750x"          ← 高度 0 或留空 → 长图（HUG）
      ├── TEXT "anchor_first: BrandBar"
      ├── TEXT "anchor_last: CTABar"
      └── TEXT "description: 产品长图（高端叙事路线）"
```

### 4.3 校验行为

| 情况 | 结果 |
|---|---|
| size 缺失或 `750xabc` 之类 | warning `Types/{id}: missing or malformed size — type skipped` |
| size `750x`（高度省略） | 合法 → size.height=null（= HUG / 长图自增长） |
| anchor_first/last 指向 Components 区不存在的组件名 | warning `Types/{id}: anchor "X" not found in Components zone` |
| zone 内同 id 重复 | warning `duplicate id — first entry wins`；只取第一份 |

warning 是软错，不阻塞 setup。setup 返参的 `warnings: string[]` 字段会带回对话上下文，AI 应转告用户具体哪一条要修。

## 5. Components 区细则

- 每个 entry 的 frame **type 必须是 `COMPONENT`**（物化后的标准 Component 节点）；普通 `FRAME` → warning `not a COMPONENT node — skipped`，整条不入库。
- 组件挂在 Components 区后，由 marketing 工作流的 `setup_material_type` 跨文档克隆到工作文档的 Components 页再 `createInstance`。库内直接编辑 COMPONENT 的结构、样式、readonly 标记，都是普通 OpenPencil 操作。
- **禁用 variables**——`boundVariables` / `variableModes` 任一非空 → warning `variable-bound node "X"` 并整树拒绝克隆（Q10）。理由：跨文档无法迁移变量引用。
- **禁用嵌套 instance**——子树任何 `INSTANCE` → warning `nested instance "X"` 并整树拒绝克隆。理由：嵌套 INSTANCE 的 componentId 指向源文档，必须整棵组件链克隆，复杂度与价值不匹配。
- **readonly 节点标记**：每个 COMPONENT 可选地放一个**子 TEXT 节点**，内容必须为 `readonly: <name1>, <name2>, …`（命名分隔支持中英文逗号；正则 `/^readonly\s*:\s*(.*)$/i` 匹配开头）。该 TEXT 节点的 `layoutPositioning: 'ABSOLUTE'` 推荐（不参与 auto-layout 流），但非强制。**克隆进工作文档时这个 TEXT 会被自动剔除**（`stripLibraryMarkerTexts`），不进任何实例。
- 组件内的图片 fill：库 `.fig` 的 image bytes 在扫库解析时已注册到 `graph.images`（内容寻址 hash），跨文档克隆按 hash 搬运到目标文档的图片注册表——无需 UI 重新贴图。

### 5.1 example

```
Components (FRAME)
 └── BrandBar (COMPONENT)
      ├── TEXT "readonly: logo, brandName"     ← 声明式 readonly 元数据，标记用
      ├── RECTANGLE "logo" 40x40 cornerRadius=8 IMAGE fill
      └── TEXT "brandName" characters="品牌名" fontSize=20 weight=700
```

## 6. Profiles 区细则

每个 entry = profile id（=frame 名）+ **一段 Markdown 全文**（一个或多个 TEXT 子节点）+ 可选 `applicable_to: type1, type2, …` meta TEXT。

Markdown 子节点聚合策略：
- 第一个内容匹配 `/^applicable_to\s*:\s*(.*)$/i` 的 TEXT → 解析为类型列表（仅适用于该 profile 的素材类型），用于 setup 的"自动选择"通道。
- 其余 TEXT 子节点 → 按出现顺序拼成 markdown 字符串（多节点时 `\n\n` 分隔）。允许多行 TEXT。

不在 Components 区也不影响 profile。setup 的 `resolveProfile` 顺序：用户传入 `profile` 参数 > 用户在 UI 锁定（核心 `MarketingPrefs`）> applicable_to 命中当前类型 > 第一个 profile。

### 6.1 example

```
Profiles (FRAME)
 └── casual_v1 (FRAME)
      ├── TEXT "# 休闲活泼风格"
      │       ""
      │       - 配色：主色 #FF6B35，配白色与深灰，整体明快
      │       - 字体：Alibaba PuHuiTi
      └── TEXT "applicable_to: wechat_moments, xiaohongshu, dsp_banner"
```

## 7. References 区细则

每个 entry = reference id（=frame 名）；结构可以是 `FRAME`（位图参考）或 `RECTANGLE` / 多个子节点构成的复杂 layout（结构参考，纯文字也算 frame）。

子文本 metadata（多行）：
- `for: <typeId>` — 该参考适用于哪个素材类型；只有一个（多行 later overwrite）。
- `tag: <label1>, <label2>` — 标签；允许多 TEXT 节点（多 tag 合并去重）。

UI 注入：用户从 dialog 勾选要看的 references，app 把它们克隆进工作文档的「参考区」页（顶部页，与 brief 的需求单 frame 内部的"素材区" zone **不**重名，故意分开）。

### 7.1 example

```
References (FRAME)
 └── ref-product-long-001 (FRAME, 375x200)
      ├── RECTANGLE grey fill  ← 占位图
      ├── TEXT "示例参考：高端产品长图（深底金字）"
      ├── TEXT "for: product_long"
      └── TEXT "tag: luxury_v1"
```

## 8. Warnings 总表（解析层产生 → 透传给 setup 返参）

| Warning | 触发条件 | 影响 | 处理建议 |
|---|---|---|---|
| `Library has no "X" zone — treated as empty` | zone frame 缺失 | 该区为空 | 想要用那个区就加 frame |
| `Types/frame: unknown key "X" ignored` | 大小写敏感后的未知 key | 该行忽略 | 检查拼写；查 §4.1 允许的 key |
| `Types/id: duplicate key "X" — later lines win` | 一个 entry 内 `id:` 多次 | 取首条 + warning | 把后写的 `id:` 删掉 |
| `Types/{id}: missing or malformed size (expected "size: 1080x1080" or "size: 750x" for variable height) — type skipped` | size 缺失/不匹配 §4.1 正则 | 该 type 不入库 | 修 `size:` 格式 |
| `Types/{id}: anchor "X" not found in Components zone` | anchor 引用了 Components 区不存在的名字 | 该 anchor 物化时将报错 | 在 Components 区加同名 COMPONENT 或改 anchor 名 |
| `Profiles/{id}: no markdown text — profile has no content` | profile 没有 markdown TEXT | profile 入库但内容空 | 加 markdown 内容 |
| `Profiles/{id}: duplicate id — first entry wins` | zone 内 frame 名重复 | 取第一条 | frame 重命名 |
| `Components/{name}: not a COMPONENT node — skipped` | entry 不是 `COMPONENT` 类型 | 不入库 | 在画布里 convert to component 或删掉 |
| `Components/{name} contains {error} — variables and nested instances are not supported in library assets` | 子树有 `boundVariables` / `variableModes` 非空 或 INSTANCE 子节点 | 整树拒绝克隆 | 删 variables / 拆嵌套 instance |
| `References/{id}: unknown key "X" ignored` | for/tag 之外 | 该行忽略 | 检查 |
| `References/{id}: duplicate id — first entry wins` | frame 名重复 | 取第一条 | 重命名 |

被 skipped 的 entry 不在 `index` 出现，等于"空提交"。

## 9. 编辑 / 扩展示例教程

### 9.1 加一个自己的素材类型（例：`coupon_card`，800x600，CTA 在底部）

1. 在 OpenPencil 打开 `default-library.fig`（或在上传替换后打开你的库）
2. 在顶部页找到 `Types` zone frame（已存在），双击进入
3. 新建子 frame `coupon_card`
4. 加 TEXT 子节点（每个一行）：
   ```
   id: coupon_card
   label: 优惠券卡片
   size: 800x600
   anchor_last: CTABar
   description: 平台优惠券方形卡片
   ```
5. 保存。setup 时 AI 推断 + types chips 中即出现 `coupon_card`。

### 9.2 加一个品牌包（profile + 替换 component + 新 references）

1. **Profiles**：在 `Profiles` 区加一个 `BRAND_v1` frame，加 TEXT 写你品牌的配色 / 字体 / 语气（Markdown），可加 `applicable_to: wechat_moments, xiaohongshu` 让 setup 自动选中。
2. **Components**：在 `Components` 区加/改 COMPONENT。建议建一个新的（如 `BrandBar_BRAND_v1`）而不是改默认的，避免和默认库冲突。在 `Types` 里把 `anchor_first/anchor_last` 指向你的组件名。
3. **References**：在 `References` 区加一个 frame 包含你想 AI 参考的品牌成例，加 `tag: BRAND_v1`、`for: product_long` 等。
4. **品牌 logo**：如果 BrandBar 的 IMAGE fill 想换图，打开 BrandBar → 选中 logo RECTANGLE → 替换 fill 字节（OpenPencil 支持拖图/右键覆盖）；新图的 hash 自动被 `figma.graph.images` 记录，跨文档克隆自动搬运。

### 9.3 版本演进

- v1 库可随时加 key（解析忽略未识别 key），用户升级零破坏。
- 同一字段值格式变化（例：size `WxH` 改为 `W x H` 带单位）需要 bump 库 spec 主版本；引擎侧要同步升级。当前 v1 字段规则是 stable contract。
- Components 区允许保留旧 component，删 Types 里对它的 anchor 引用即可——组件仍是 Components 区一个孤立 COMPONENT，不参与物化。

## 10. 引擎如何消费（实现索引）

| 阶段 | 文件 | 入口 |
|---|---|---|
| 文件 I/O | `packages/core/src/io/index.ts`（`IORegistry.readDocument`） | `loadLibrary(bytes, name)` |
| 解析 | `packages/core/src/tools/marketing/library.ts`：`findZone` / `parseKeyValueLines` / `parseTypes` / `parseProfiles` / `parseComponents` / `parseReferences` | `parseLibraryIndex(graph)` |
| 跨文档克隆 | `packages/core/src/tools/marketing/clone.ts` | `cloneSubtreeAcrossGraphs(source, id, target, parentId)` |
| Readonly 标记清洗 | `packages/core/src/tools/marketing/setup.ts` | `stripLibraryMarkerTexts` |
| 注入参考进工作文档 | `packages/core/src/tools/marketing/library.ts` → `injectLibraryReferences` | App `src/app/ai/marketing/library.ts` 包 undo/render |

库 spec 与实现一一对应——更新本规范时同步检查上述文件。

---

附录：完整示例文件 `default-library.fig`（生成器 `tools/marketing-library/src/generate.ts` + 33 KB 回环测试）结构：

```
default-library.fig
└── Page 1
     ├── FRAME "Types" (zone)
     │    ├── FRAME "wechat_moments"  → 4 TEXT KV + size 1080×1080
     │    ├── FRAME "wechat_article_cover"
     │    ├── FRAME "xiaohongshu"  → anchor_last BrandBar
     │    ├── FRAME "ecommerce_detail"  → BrandBar first, CTABar last
     │    ├── FRAME "event_poster"
     │    ├── FRAME "dsp_banner"
     │    └── FRAME "product_long"  → BrandBar first, CTABar last
     ├── FRAME "Profiles" (zone)
     │    └── FRAME "casual_v1"  → TEXT markdown + applicable_to
     ├── FRAME "Components" (zone)
     │    ├── COMPONENT "BrandBar"  → 2 TEXT children + readonly marker
     │    └── COMPONENT "CTABar"    → 2 TEXT children + readonly marker
     └── FRAME "References" (zone)
          └── FRAME "ref-product-long-001"  → RECTANGLE + for + tag
```

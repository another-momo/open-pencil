# Library .fig 格式规范

> 营销素材资源库（type / profile / component / reference）的文件格式契约。任何 `*Library*.fig` 都按本规范被 `setup_material_type` / `dialog` / `marketing-config` 消费。

> 规范与实现同步：`packages/core/src/tools/marketing/library.ts` 是 single source of truth；本规范用自然语言重述。任何字段在这里标 normative MUST 时，若与代码不一致，以代码为准并修订本规范。

---

## 1. TL;DR

- 一个 `.fig` 文件 = 一个营销素材库。
- 文件的 `Pages` 里包含**四个按名字识别的 page**（精确匹配名，trim 空白容忍）：
  - `Types` 页、`Profiles` 页、`Components` 页、`References` 页
- 每个 page 的直接子 frame 是一个 entry；metadata 写为该 frame 的**纯 TEXT 子节点**（`key: value` 格式；Profiles 用一段 Markdown 而不是 KV）。
- 页缺失 → 该区当作空 + 一条 warning `Library has no "X" page — treated as empty`，不报错（库作者可只关心一两个区）。
- **全 plain nodes**——库文件本身不使用 pluginData；位置约定（page/entry 命名）就是唯一契约。`role=library` 这类库内元信息被**否决**（见 l2-resource-library.md Q1）。
- 出错不沉默：解析层的全部畸形 → 一条人话 warning 写进 `LibraryIndex.warnings`，setup 返参的 `warnings` 字段带回对话上下文；用户/AI 能直接修复。

## 2. 文件 / 节点基本约定

| 项 | 规则 | 备注 |
|---|---|---|
| 文件类型 | `.fig`（Figma Kiwi 编码） | 兼容 `.pen`（OpenPencil 原生）；`IORegistry(BUILTIN_IO_FORMATS).readDocument` 解析 |
| 顶层 Page 数 | 4（Types / Profiles / Components / References）；其他 page 忽略 | 顺序无要求；多 zone 可在同一 page 上一律忽略（必须分 page） |
| Library 自带 `pluginData` | **禁止** | 库内 marker 系统反对（见 Q1） |
| Entry frame 的 type | 普通 `FRAME`；Components 页要求 `COMPONENT`（具体见 §5） | |
| KEY/VALUE 文本 type | `TEXT`；每个 children 是独立 TEXT 行（多行容忍） | |
| `name` 字段 | key 用 ASCII 标识符（`id`/`size`/…）；中文 `label` 等用户可见字符串可放 Node 任意文本字段 | id 必须 ASCII，label 可以是中文 |

## 3. Pages 与每个 entry 的 index 主键

| Page | Page 识别名 | Entry 主键来源 | 用作 |
|---|---|---|---|
| **Types**     | `Types`     | 子文本 `id: xxx` → xxx；缺则取 frame 名 | 素材类型 id |
| **Profiles**  | `Profiles`  | frame 名 | profile id |
| **Components**| `Components`| frame 名 | 组件 id（与 Types 里的 `anchor_first`/`anchor_last` 关联） |
| **References**| `References`| frame 名 | reference id |

Page 缺失 → 该区当作空 + 一条 warning `Library has no "X" page — treated as empty`，不报错（库作者可只关心一两个区）。

Entry 主键重复（同 page 内两 entry 同 id/同名）→ 一条 warning `duplicate id — first entry wins`，保留第一个。

### 为什么是 page 而不是 zone frame？

旧版（v1）所有 zone frame 共享第一个 page 的 children，靠 frame 名区分。v2 拆成独立 page 后的好处：

1. **Pages panel 直接可见** — 不必展开 frame tree 就能看到 4 个区
2. **编辑体验清晰** — 在 Figma 里可以单独 hide/lock 某个 page（比如只编辑 profiles 时锁住其他 page）
3. **库作者扩展** — 库作者自己可以加 `Examples` / `Templates` page（被 parser 忽略，不会误识别为 zone）

## 4. Types 页细则（每个 entry 一个 frame）

### 4.1 Children TEXT 行语法

每一行满足正则 `/^([A-Za-z_]+)\s*:\s*(.*)$/`（一个 key、空格/冒号/空格、剩余为 value）。允许多行、允许多 TEXT 节点（多 TEXT 用换行符分开后逐行解析；TEXT 节点本身也允许多行）。

允许的 key：

| key | 值格式 | 必填 | 说明 |
|---|---|---|---|
| `id` | ASCII 字符串 | 否（缺则用 frame 名） | 该 type 的 id |
| `label` | 任意字符串 | 否（缺则用 frame 名） | UI 显示名 |
| `size` | `<width>x<height>` 或 `<width>x`（高度可变） | **是** | 根 frame 尺寸；单位 px；正则 `/^(\d+(?:\.\d+)?)\s*[x×]\s*(\d*(?:\.\d+)?)$/i`；小数点允许；`×` 与 `x` 等价 |
| `description` | 字符串 | 否 | 一句话说明；出现在类型 chips tooltip + setup note 拼给 AI |
| `anchor_first` | 组件名（== Components 页的某个 COMPONENT name） | 否 | 根 frame 第 0 个 child 应为该组件 INSTANCE；不在 Components 页 → warning |
| `anchor_last` | 同上 | 否 | 根 frame 末位 child 应为该组件 INSTANCE |

未知 key → warning `<zone>/<frame>: unknown key "X" ignored`，不影响其他字段。

### 4.2 size 解析注意事项

- `1080x1080` → `{ width: 1080, height: 1080 }`
- `750x` → `{ width: 750, height: null }`（长图类型，根 frame 高度 HUG）
- `750 × 920` → 同 `750x920`（中文全角 × 也接受）
- `abc` → 该 type 被跳过 + warning `missing or malformed size`

### 4.3 anchor 校验

`anchor_first` / `anchor_last` 引用的 component name 必须在 Components 页存在；否则 warning `anchor "X" not found in Components page`。warning 不阻断 setup——setup 会用空 instance 占位（让设计仍可继续）。

## 5. Components 页细则

Components 页要求 entry 是 `COMPONENT` 节点（不是普通 `FRAME`），否则 warning `<zone>/<frame>: not a COMPONENT node — skipped` 并跳过。

### 5.1 允许的 key

| key | 值格式 | 必填 | 说明 |
|---|---|---|---|
| `readonly` | 逗号分隔的子节点 name 列表 | 否 | 该组件在 INSTANCE 中不可改的子节点名（如 logo, brandName）；AI 修改时 setup 会阻止写 |

未知 key → warning `<zone>/<frame>: unknown key "X" ignored`。

### 5.2 Component 结构

- 根 COMPONENT 节点本身 = 组件 body；其子节点就是模板
- 子节点 name 是 INSTANCE 端 override 时使用的 key
- 库作者在 Figma 里可以给 COMPONENT 加 `# readonly` 之类的纯文本注释，parser 不读取
- 库作者希望 AI 引用该组件时，调用 `setup_material_type` 自动按 anchor 注入 INSTANCE，不需要手动 INSTANCE 创建

## 6. Profiles 页细则

Profiles page 同样以 frame 为 entry，但 metadata 解析规则不同——**整个 frame 的 TEXT 子节点要么是 Markdown 正文，要么是 meta 行 `applicable_to: ...`**。

### 6.1 解析规则

对每个 entry frame 的 TEXT children：
1. 匹配 `/^applicable_to\s*:\s*(.*)$/i` → 视为 meta，记录 `applicableTo`（逗号分隔的 type id 列表）
2. 其他非空 TEXT → 视为 Markdown 正文，串接（多 TEXT 之间 `\n\n` 分隔）
3. 正文为空 → warning `Profiles/<frame>: no markdown text — profile has no content`

### 6.2 applicable_to 语义

`applicable_to` 决定 setup 的 profile auto-pick：

```
priority chain:
1. 用户在 setup_material_type 调用中显式传 profile 参数
2. 用户在 config bar 锁定 profile（核心 MarketingPrefs）
3. applicable_to 命中当前 type 的第一个 profile
4. 第一个 profile（兜底）
```

`applicable_to: wechat_moments, xiaohongshu` 表示该 profile 适用于这两个 type。

### 6.3 Markdown 内容格式建议

虽然 parser 对 Markdown 不挑剔，但**库作者写 profile 时应让它对人和 AI 都可读**。建议结构：

\`\`\`markdown
# 休闲活泼风格           ← 第一行 # 标题作为 profile label（人类浏览 + UI 卡片标题）

## 配色                  ← 二级标题作分节
- 主色 #FF6B35
- 配白色与深灰

## 字体
- Alibaba PuHuiTi；标题加粗，正文 Regular

## 语气
- 年轻、直接、促销感；多用短句和行动词
\`\`\`

第一行的 \`# ...\` 由 parser 提取为 \`label\` 字段，用于：
- UI 卡片标题（Profile Card Gallery）
- AI overlay 的 \`## Profiles in the current library\` 段
- setup 提示里的 profile 名称

第一段（非标题、非列表）的纯文本由 parser 截取到 80 字作为 \`description\` 字段，用于卡片预览副标题。如果第一段超过 80 字会自动用 \`…\` 截断。

## 7. References 页细则

Reference 是用户**可选注入**进工作文档 \`参考区\` page 的视觉参考材料（design \`applicable_to\` type + AI \`look\` 工具消费）。

### 7.1 允许的 key

| key | 值格式 | 必填 | 说明 |
|---|---|---|---|
| \`applicable_to\` | 逗号分隔的 type id 列表 | 否 | 该 reference 适用的素材类型；列表可空（空 = 通用 reference，对所有 type 都显示）。UI 默认按当前 type 软过滤，未匹配但非空的 reference 通过 "Show all references" 折叠区可见 |
| \`tag\` | 字符串（逗号分隔可重复） | 否 | 自由形式的标记，可重复；用于跨 type 分组或 brand 归属；UI 默认按 tag 折叠 |

未知 key → warning \`<zone>/<frame>: unknown key "X" ignored\`。

### 7.2 Reference 内容

Reference frame 本身可以是任何形式——位图、layout 帧、文字注释。AI 用 \`look\` 工具看到注入后的节点时，识别方式与看待画布其他节点一致。

\`applicable_to\` 在 profiles 和 references 两个 zone 里**语义对齐**：都是 "X 适用于哪些 type"。Profile 用它做 setup auto-pick；reference 用它做 UI 软过滤。命名统一便于库作者写一致的 metadata。

## 8. Warnings 目录（parser 触发）

| Warning 文本 | 触发条件 | 用户/AI 怎么修 |
|---|---|---|
| `Library has no "X" page — treated as empty` | 缺一个 zone page | 新建一个 name 匹配的 page |
| `duplicate id — first entry wins` | 同 page 内 id 重复 | 改名其中一个 entry |
| `Types/<id>: missing or malformed size` | size 字段缺失或格式错 | 加 `size: WxH` 或 `size: Wx` |
| `Types/<id>: anchor "X" not found in Components page` | anchor 引用的组件不存在 | 改 `anchor_first`/`anchor_last` 或在 Components page 加组件 |
| `Components/<name>: not a COMPONENT node — skipped` | entry 不是 COMPONENT 类型 | 在 Figma 里转为 COMPONENT |
| `Profiles/<frame>: no markdown text — profile has no content` | profile 没有正文 | 加一段 Markdown |
| `<zone>/<frame>: unknown key "X" ignored` | 写了 parser 不识别的 key | 删掉该行或拼写修正 |
| `<zone>/<frame>: duplicate key "X" — later lines win` | 同 key 出现多次 | 删掉重复行 |

warning 不阻断 setup——design 仍可继续，只是后续 validate 可能报错。

## 9. 附录：库文件树状示意

```
default-library.fig
├── Page "Types"
│   ├── FRAME "wechat_moments"
│   │   ├── TEXT "id: wechat_moments"
│   │   ├── TEXT "label: 朋友圈广告"
│   │   ├── TEXT "size: 1080x1080"
│   │   └── TEXT "description: 微信朋友圈方形广告图，促销活泼风格"
│   ├── FRAME "product_long"
│   │   ├── TEXT "id: product_long"
│   │   ├── TEXT "label: 产品长图"
│   │   ├── TEXT "size: 750x"
│   │   ├── TEXT "anchor_first: BrandBar"
│   │   └── TEXT "anchor_last: CTABar"
│   └── ...（更多 type）
│
├── Page "Profiles"
│   ├── FRAME "casual_v1"
│   │   ├── TEXT "# 休闲活泼风格\n\n- 配色：主色 #FF6B35..."
│   │   └── TEXT "applicable_to: wechat_moments, xiaohongshu"
│   └── ...（更多 profile）
│
├── Page "Components"
│   ├── COMPONENT "BrandBar"
│   │   ├── TEXT "readonly: logo, brandName"
│   │   ├── RECTANGLE "logo"
│   │   └── TEXT "brandName"
│   └── ...（更多 component）
│
└── Page "References"
    ├── FRAME "ref-product-long-001"
    │   ├── TEXT "for: product_long"
    │   └── TEXT "tag: luxury_v1"
    └── ...（更多 reference）
```

## 10. 写作教程（库作者角度）

### 10.1 从 0 起步

1. 在 Figma 新建 `.fig` 文件
2. 删除默认 `Page 1`
3. 新建 4 个 page，分别命名为 `Types` / `Profiles` / `Components` / `References`（**精确大小写**）
4. 在每个 page 里添加 frame 作为 entry

### 10.2 添加一个 type

`Types` 页 → 新建 frame → 命名（自由，比如 `wechat_moments`） → 加 TEXT 子节点：

```
id: wechat_moments
label: 朋友圈广告
size: 1080x1080
description: 微信朋友圈方形广告图，促销活泼风格
anchor_first: BrandBar
anchor_last: CTABar
```

→ setup 时会自动建一个 1080×1080 的根 frame，第一/最后 child 是 BrandBar/CTABar INSTANCE。

### 10.3 添加一个 profile

`Profiles` 页 → 新建 frame → 命名（建议用 versioned id 比如 `casual_v1`） → 加 TEXT 子节点：

- 第一行写一段 Markdown 正文（以 `# <label>` 开头）
- 第二行写 `applicable_to: wechat_moments, xiaohongshu`

setup 时若当前 type 是 `wechat_moments`，auto-pick 这个 profile（如果用户没锁定别的）。

### 10.4 添加一个 component

`Components` 页 → 新建 **COMPONENT**（不是 frame）→ 命名 → 设计组件内容 → 加 TEXT `readonly: logo, brandName` 标记哪些子节点不可改。

### 10.5 添加一个 reference

`References` 页 → 新建 frame → 命名（建议前缀 `ref-` 或 `r-`）→ 设计参考内容 → 加 TEXT `for: product_long` 绑定 type。

### 10.6 验证

启动 OpenPencil → marketing 模式 → 打开库 dialog → 上传 `.fig` → 检查 dialog 顶部的 warnings 区。如果有警告，按 §8 修。

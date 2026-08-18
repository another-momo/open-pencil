# 实测沉淀的方法论

> 本文件只追加不修改。来源：冒烟测试复盘（见 `error-catalog.md`）与历次设计评审。
>
> 历史：迁移自原 `l2-agent-mode-plan.md` §11 修复方法论 + `../architecture/l3-workbench.md` §2.1（2026-07-27 文档重组）。

## 1. 规则注入可靠性排序（R2-1 验证）

新硬规则的注入优先级：

1. **工具返回值**（note / 警告文本，带具体参数，常驻对话上下文）
2. **prompt 硬性规则**（CRITICAL 标记）
3. **prompt 一般指引**

依据：prompt 规则 AI 可能忽略或误解（R2-1 中警告出现 3 次都没纠正行为），而带具体参数的工具返回 note 常驻上下文、可直接引用。

## 2. 工具描述是 prompt 表面的一部分（R3-2）

prompt 规则与工具 `description` 必须一致——AI 在两者矛盾时选择相信工具描述。修改 prompt 规则时同步检查相关工具描述。工具 API 细节的正确归宿是 ToolDef 的 `description` 字段（tool calling 自动携带），不是 prompt。

## 3. 错误消息是 AI 的调试依据（R3-1）

误导性报错会放大重试成本：calc 兜底路径产生的报错看似表达式语法错误，AI 朝错误方向重试 5 次。工具报错应指向真实原因和正确做法。

## 4. 可判定性划分

能写成"对比当前值和应有值"的检查进代码（确定性可判定），其余进 prompt（需要判断/生成）。对应实例：

- **代码**：readonly 值对比、结构约束校验（validate）、canvas 交叉校验（commit_section）
- **prompt**：风格一致性、文案质量、审美判断

推论：视觉判断（多模态模型）属于 advisory 层，永远不当硬门槛——硬门槛只留给确定性校验。

## 5. 修复的确定性原则

违规修复必须是确定性操作：恢复数据源已知（注册表 originalValues / 组件定义 / 类型配置），不依赖 AI 记忆；修复走正常 undo 语义，不污染用户撤销栈。

## 6. lint 信噪比纪律（R3-4）

启发式警告必须区分"布局计算值"与"显式定位"，消息文案要落在正确的严重级别模式上。视觉回路接入后，"看起来有没有问题"由图回答，lint 只保留结构性 error，进一步降噪。

## 7. 实测迭代循环

```
真实需求冒烟 → debug log 分析 → 错误目录归档（现象/根因/修复）
  → 修复优先落在确定性机制（代码/工具描述），其次 prompt 硬规则
  → 回归验证上轮修复全部生效 → 下一轮
```

反模式：堆 prompt 一般指引应对代码可判定的问题；为模型特异错误（如 JSON 尾部垃圾）写 prompt 规则而不是修解析器。

## 8. 测试陷阱：Playwright / Figma API 双接口字段名混淆

**来源**：2026-07-27 三次误诊（详见 `../history/l2-context-engineering-history.md` §实施记录 与 `../history/l2-marketing-font-puhuiti-history.md` §实施记录 引用的同一组教训；2026-08-02 文档重排时合并到本节）。

### 三个误诊

1. `scen-graph plugin-data.test.ts` 失败——原以为 .fig 解析 pre-existing；实为 **test pollution**（marketing/kiwi/scene-graph 一起跑时发生），单独跑 scene-graph 210 tests 全过。
2. Playwright 画布文字不显示——原以为 CanvasKit/Vite 渲染问题；实为 **API 用错**：`store.updateNode(id, { characters: '...' })` 字段名错（Figma proxy 是 `characters`，raw 字段是 `text`），正确 API 是 `proxy.characters = '...'`。
3. Playwright 文字不显示（git stash 验证）——基于 #2 的二次验证，**不成立**，撤回。

### 稳定规则

> Playwright 测试必须用 **Figma proxy API**（`proxy.characters` / `proxy.fontName` / `proxy.fontSize`）；`store.updateNode` 用 **raw 字段名**（`text` / `fontFamily` / `fontSize`）。**两套 API 不可互换**。

### 教训

- 写 Playwright 测试时不要直接调 `store.updateNode` 改画布文本——必须走 proxy。
- test pollution 是多测试套件同跑时的常见现象，**单跑能区分**。
- 二次误诊时务必先撤回前次结论再重做。

## 9. 工具能力上下文的归属：三层模型（2026-08-15）

来源：`../../review/2026-08-15-tool-system-review.md` §六 + `../tasks/tool-system-optimization.md` T0/T10。

### 三层归属

- **Tier 1 工具契约 → 工具 description**：参数 schema、返回值结构、硬限制（白名单、上限）、预条件、副作用、失败模式、同族工具选择。模型在"考虑调用/实际调用"两个最频繁的时刻都需要它，必须每次在场。
- **Tier 2 跨工具节奏 → system prompt**（base.md / marketing.md）：多步 workflow、验证节奏（render→describe→fix）、失败应对、领域默认值、质量标准、checkpoint 机制。
- **Tier 3 领域特例 → active style profile**：任务级风格选择，随任务注入，不写死在 prompt。

### 判定流程

```
这条规则是关于一个工具的吗？
├── 否 → 跨工具节奏？→ system prompt；领域特例？→ profile；都不是 → 不需要这条规则
└── 是 → 参数/返回/硬限制/失败模式 → description（必有）
         关键安全约束 → description + prompt 双写（有意重复是 feature，同句拷贝是 bug）
```

### 配套规则

- **prompt 只引用 CORE_TOOLS**：内置 agent（ui/marketing chat）只挂 `CORE_TOOLS`（`packages/core/src/tools/registry-core.ts`）；prompt 引用 extended-only 工具 = 悬空引用，送模型进 tool-not-found 死胡同。守卫：`tests/engine/tools/consistency.test.ts`（`bun run check:tools-consistency`，已挂进 `bun run check`）。
- **约束单一真源 + 漂移检测**：必须在多处出现的约束，由代码生成（如 batch_update description 从 SCENE_PROP_MAP 生成）或引用制（prompt 只写策略句，技术约束看 description），不靠人工同步。
- **返回值契约**：新工具的返回值必须区分"全成功 / 部分失败 / 计数"。部分失败加顶层 `partial: true` 并在 description 写明必须处理 errors；计数类返回不得暗示写入确认（"计数 ≠ 落地"）。
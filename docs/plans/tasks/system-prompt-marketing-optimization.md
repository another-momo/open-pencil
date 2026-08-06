# Task: System Prompt (Marketing) 优化包

日期：2026-08-06
状态：施工中
范围：`packages/core/src/tools/marketing.ts`、`packages/core/src/tools/registry-core.ts`、`src/app/ai/marketing/library.ts`、`src/app/ai/chat/system-prompt-marketing.md` + 对应测试

## 背景与目标

端午海报真实运行 log 暴露出三个系统性浪费：模型为拿 AI结论区 zone id 被迫 `describe` 需求单（5.8KB + 噪音）；每个 session 被强制 `list_pages` 探测参考区；素材理解管线强制前置 look 全部素材。同时 prompt 本身存在条件句重复、示例领域偏置、表述不一致等问题。本任务打包处理。

## T1 — 新增 `append_brief_conclusion` 工具（核心）

**为什么**：现在 AI 往需求单 AI结论区写结论要用通用 `render` 手动画 Text——需要先 `describe` 需求单拿 zone id（真实 log 中一次 5.8KB + 30 行无关警告），格式（字号/字体/`· ` 前缀）靠 prompt 约束会漂移，append-only 也只是约定。

**怎么做**：
- `packages/core/src/tools/marketing.ts` 新增 `appendBriefConclusionTool`，薄封装现有原语 `appendToBriefAiZone`（`marketing/brief.ts:484`，按名定位结论列表、自带规范样式、追加后隐藏空状态，表单面板已在用）。
- 参数：`text`（string，必填，一行结论，不含前导 `·`）。无需求单时返回 `{ ok: false, note }`，不创建需求单。
- 注册进 `registry-core.ts` 的 `CORE_TOOLS`（紧随 `createBriefTool`）。
- 命名定为单用途 `append_brief_conclusion`，不做 `update_brief({action})` 通用壳——现存写入场景全部是追加；未来若需"后写者胜"，加 `supersedes` 可选参数（旧行标记作废），永不开放自由 edit。

**同步修 drift**：
- `create_brief` description 仍写 "never create one unprompted"，与 Phase 0 自动创建策略（system prompt: "create one right away"）矛盾，改为"无需求单时 Phase 0 直接调用，无需先征求同意"。
- `read_brief` description 中 "propose creating one if..." 同样是旧策略残留，同步改。

## T2 — overlay 注入参考区存在性

**为什么**：prompt 目前强制模型每个 session `list_pages` 探测参考区是否存在。存在性在装配时可知，应零成本注入。

**怎么做**：
- `src/app/ai/marketing/library.ts` 的 `buildMarketingOverlay(store)` 改为真正读 store（参数当前是 `_store`）：`store.graph.getPages()` 查找 `参考区` 页（core 常量 `MATERIALS_PAGE_NAME`，`packages/core/src/tools/marketing/library.ts:404`，若无导出则补导出）。
- 存在时追加一段：`## 参考区 (library references)` —— 说明该页是用户注入的参考设计，reference-only（提取风格/配色/构图，可用 `look`/`describe`），禁止把内容复制到设计画布、禁止修改该页节点。
- 不存在时一字不提。
- 该函数在 `prepareCall` 中每个模型调用重建，会话中途 Inject 下一次调用即生效；overlay 属 instructions，会话内稳定，prompt 缓存不受影响。
- 函数上方注释块同步更新（目前只描述 types + profile 两段）。

## T3 — prompt 改写（system-prompt-marketing.md）

**L14 素材理解（9 行长段 → 3 条 bullet）**：备注是权威 → 仅当决策依赖图片内容时才 `look`（无备注素材 / 疑似备注与内容不符 / 写生图 prompt 需与素材色调互补）→ look 过就在 AI结论区记一行（用 `append_brief_conclusion`）供后续 session 复用。删除"Phase 0 结束前强制 look 全部素材 + 强制逐条追加"。

**L16 参考区段（压缩）**：配合 T2——overlay 提到参考区时按 reference-only 处理即可；删除"总是先 `list_pages` 确认"。

**L18 AI结论区写入**：删除 render JSX 示例整段，改为"用 `append_brief_conclusion` 一行一条追加；append-only，不要试图编辑旧行"。

**"Active style profile" 条件句 ×4 → ×1**（L44/65/74/78）：在工作流总纲处说一次"若指令末尾存在 Active style profile 段，其 markdown 在风格关键词、色调、结构提示、字体上均为最高优先级"；L65/L78 的条件句删除，L74 字体锁定保留但去掉元语言表述。

**JSX 示例去领域化 + 4 → 2**（L130–242，约占全文 45% token）：四个示例全部是信用卡/咖啡场景（生椰拿铁、招行信用卡、掌上生活），弱模型有示例吸附倾向；Price Tag/Grid 硬编码 "25元购/50元/5折" 与 "never fabricate prices" 有张力。保留 Hero（image+overlay，最常用）和 Price Tag（演示嵌套 flex），去掉品牌与具体银行元素、数字改通用；删除 Process Flow 和 Grid、Brand Footer。

**Phase 3 checkpoint（L90）**："每段决定图片来源"改为"首个图片 section 前与用户定一次来源，后续 section 沿用，除非用户反对或某 section 明显需要不同来源"。

**小修**：
- L26 "4 phases" → "5 phases (0–4)"。
- L22 画布选区段从需求单章节末尾移出，独立为需求单章节后的 `## 画布选区` 小节。
- L32 末尾中文句 "无预设覆盖的尺寸也走这条路径。" 翻为英文，保持文体一致。

## 测试

- `tests/engine/tools/marketing/` 新增/扩展：`append_brief_conclusion` 正常追加（内容、`· ` 前缀、空状态隐藏）、无需求单返回 `{ok:false}`、幂等多次追加顺序正确。
- overlay：有/无参考区 page 两种情形的输出断言（找现有 app 层 overlay 测试位置，无则就近新建）。
- prompt 改动后核对工具名与 `CORE_TOOLS` 一致（人工 + grep）。

## 验证

`bun test tests/engine/tools/marketing`（及 overlay 测试文件）；`oxlint -c oxlint.json --type-aware --type-check --threads 2 <改动文件>`；`bunx tsgo --noEmit`；提交 push 后盯 CI。

## 明确不做

- 不做 `update_brief` / edit 工具（见 T1 决策）。
- 不撤回 `list_pages` 出 CORE_TOOLS（工具本身保留，只是不再强制）。
- 不动 base 文件（system-prompt-base.md）。
- 示例削减不重写幸存示例的教学结构（Hero 的 overlay 用法、Price Tag 的嵌套 flex 保留）。

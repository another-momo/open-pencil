# `look` 工具修复与优化（实施任务）

> 任务记录（带 Step / 改动量 / 验证 / 回滚）。
> 设计基准：`../architecture/l2-visual-loop.md` §3 §4；vision 凭证体系根治见 `../architecture/fork-divergence.md` D1。
> 上层总览见 `../README.md`。

## 阶段 1 — 正确性修复 + 简化（本批做）

### 1.1 删除素材描述缓存 + prompt 素材理解简化

**问题**：素材描述缓存（`vision.ts:186-206` 的 `materialDescriptions` + `look.ts:105-117,135` 的查询/写入分支）是一个过度设计，且带一个 correctness bug：

- **它服务的场景本身不必要**。缓存只命中"新会话强制重看素材"这一场景，而强制重看是 prompt 规则制造出来的：会话内素材分析是文本、永远留在对话历史（elision 只 elide 图片不动文本），同会话无需重看；跨会话有 AI结论区 持久化描述可读。去掉强制令，缓存的命中场景整个消失。
- **缓存 key 只有 imageHash、不含 focus（correctness bug）**。同一张图以不同 focus 再 `look`，直接返回第一次的缓存分析——答非所问且无任何信号（`look.ts:107-117`）。
- **缓存是进程内 `WeakMap<SceneGraph, …>`**，重启或同进程重开文档（新 graph 实例）即失效。
- **prompt 为此说了谎**："Re-inspecting an already-described image is free (the tool caches by image bytes)" 只在视觉通道 B 成立；通道 A（默认）每次 `look` 图片都进主模型上下文，并不免费。

**改法**：

1. **删缓存**：删除 `vision.ts` 的 `materialDescriptions / getCachedMaterialDescription / cacheMaterialDescription`；删除 `look.ts` 的缓存查询/写入分支，`analyzeViaVisionChannel` 简化为"导出 → 调 vision → 返回"；`imageHashOf`（`look.ts:39-41`）仅服务缓存路径，一并删除。约 -40 LOC。
2. **prompt 改通道无关表述**（视觉通道是部署层配置，agent 不应感知）：素材理解段改为——素材描述已在 AI结论区 且用户未提更换 → 直接采用，不重看；缺失或可疑 → `look` 一次并补写一行描述；Checkpoint 1 的 echo 确认照旧承担人的纠正环节。约 ±5 行。

**测试**（`tests/engine/tools/marketing/look.test.ts`，~20 LOC）：改写 `'material descriptions are cached by image hash — second look skips the vision call'`（:215）——缓存删除后，同图同 focus 二次 `look` 也触发新的 vision 调用；保留既有 note/focus 传递断言。

### 1.2 设置面板三个字段的清除按钮全部清掉 API key

**问题**：`VisionKeysSection.vue:57,80,103` 三个字段（API key / Base URL / Model）的 `@clear` 全部绑定 `ctx.clearVisionKey`，而 `clearVisionKey`（`context.ts:82-86`）只清 `visionApiKey`。且清除按钮只在 `saved=true` 时渲染——baseURL/model 字段上出现的 X，点了必然误清 API key，watcher 随即把 `vision.ts` 的 key 置空，`isVisionChannelBReady()` 变 false，通道 B 报 "credentials are incomplete"。

**改法**：拆为 `clearVisionKey / clearVisionBaseURL / clearVisionModel` 三个函数（`context.ts`），`VisionKeysSection.vue` 三个字段的 `@clear` 分别绑定。~15 LOC。

**测试**：见 1.3 统一新增。

### 1.3 `save()` 吞掉合法的清空操作，prefill 让旧值不可见

**问题**：`context.ts:51-74` 的 `save()` 对 baseURL/model 用 `if (input.trim())` 守卫——用户 backspace 清空后空串被跳过，**旧 storage 值不动**。而这两个字段打开 dialog 时从 storage prefill（`context.ts:39-42`），用户以为清掉了，下次打开旧值仍在，"无论怎么配都不生效"。

**改法**：baseURL/model 改**无条件覆盖**（空串覆盖合法，反映清空意图）。**API key 保持"非空才覆盖"**——key 输入框永远空初始化是刻意的安全设计（不明文回显已存密钥），保留。触发点保持 `@change`，不加输入即存的 watcher（`save()` 内部会清空 key 输入框，逐键触发会清掉用户正在输入的内容）。~6 LOC。

**测试**（新建 `tests/engine/app/vision-settings.test.ts`，沿用 tests/engine/app 约定，~60 LOC）：三个 clear 分别清各自字段；baseURL/model 空串覆盖写入；key 空输入不覆盖已有 key。`context.ts` 依赖 inject/provide，测试前把 save/clear 纯逻辑最小抽取为可独立调用的函数（不改组件结构）。

## 阶段 2 — 体验增强（阶段 1 验证后做，可拆独立 commit）

| # | 改什么 / 为什么 | 怎么改 | 改动量 |
|---|---|---|---|
| 2.1 | 极长宽比设计（如 750×20000）被 scale=0.1 压到 75×2000，**结构比例、视觉重心同样判不准**，但 note 只提醒文字不可读，与 l2-visual-loop §4"可判断结构比例/视觉重心"的承诺不符 | `look.ts:170-176`：`node.width > 4×height`（或反之）时 note 追加 "Aspect ratio distorted at this scale — judge colors and presence, not proportions." | ~4 LOC + 测试 |
| 2.2 | drill-target 只列直接子节点（`look.ts:77-84`），真实设计文字常埋在 4-5 层下，模型要多轮 look 递归放大 token；且列表不限长度、名称不 trim/不限长，大设计 note 膨胀 | 抽 `collectDrillTargets(graph, targetId, { maxDepth: 2, maxCount: 5 })`：TEXT-only、深度受限、截断 5 条（"...and N more, look specific ids"）、名称 trim + 限长 | ~25 LOC + 测试 |
| 2.3 | **id 必填化（彻底取消默认解析）**。原设计：无 id 时按 `lastActiveAt`"最近活跃"启发式猜目标，且 `look`/`validate` 两个只读工具通过 `touchMarketingState` 隐藏改写后续默认目标（`look.ts:54`、`validate.ts:102`）。问题：启发式是猜测——视觉检查看了错的设计还报告正常比报错危险；读工具藏写副作用；prompt 的 Reuse IDs 纪律本就保证模型手上有 rootFrameId（丢失也可 `find_nodes` 找回） | `look.ts` 删 `resolveTargetId` + registry 导入，`id` 参数 `required: true`，缺 id 报错"用 setup_material_type 返回的 rootFrameId"；`validate.ts`/`marketing.ts` 同步（删多设计/latest 分支）；`registry.ts` 删 `touchMarketingState`（`lastActiveAt` 保留——app 层 setup 后同步路径仍用）；两工具 description 去掉 "Omit id" 表述 | ~-45 LOC + 测试改写（look 2 个、validate 5 处、restore 1 处、registry 1 处） |
| 2.4 | **删除工具返回里的框架性话术（冗余且限制灵活性）**。"advisory / locked direction" 框架同时存在三处：系统提示词 Phase 4、`look` 工具 description、每次调用返回的 note（`look.ts:192-194`）。per-call 层除冗余外还有两个问题：① 框架与用途错配——素材理解（"what does this image show"）、生图验收等场景与 locked direction 无关，note 无条件追加等于给通用工具强套工作流框架，且与 `focus` 参数携带的本次意图打架；② 限制灵活性——模型对每张图的判断被预设框架牵引。通道 B 的 "treat it as a secondary judgment" 同理 | 删 `look.ts:192-194` 通道 A 追加（框架保留在工具 description + 系统提示词 Phase 4，单一来源）；通道 B 结果 note 删 "secondary judgment" 框架、保留简短出处标注 "(Text analysis from the vision model)"——主模型需知道这是转述而非自己看图（事实元数据）；通道 B vision prompt 保持极简事实性，**不**加 advisory/validate 话术（vision 模型无工具语境，判断框架只属于主模型）；保留 per-call 事实性 note：节点信息、focus 回显、文字过小警告、drill targets、2.1 的比例失真提示 | ~-10 LOC + 测试（断言 note 不含 "locked direction"/"secondary judgment"，通道 B 含出处标注） |
| 2.5 | `look` 结果四种形态（A / B-cached / B-uncached / error）靠 `base64` 存在性区分（`ai-adapter.ts:142-158`），任何序列化/日志层都要自行识别。1.1 删缓存后 B 只剩一种形态，此条变为三形态区分 | 返回显式 `channel: 'A' \| 'B'` 字段（`look.ts` 两个返回处；`isMediaToolOutput` 仍按 base64 判，adapter 无需改） | ~6 LOC + 测试 |

## 阶段 3 — 随 fork-divergence D1 同批做（本任务不动）

- **vision 调用 60s 超时无 retry / partial-response 处理**（`vision.ts:83`）：长图慢返回直接 throw，随凭证迁移统一处理。
- **通道 B 三字段未填时 dialog 无就近提示**：D1 落地后该 UI 整体重写，现在不单独补。

## 明确不做（带技术理由，防止重复提出）

- **素材描述缓存及其持久化**：按 1.1 的分析整体删除而非修复——会话内文本分析留在上下文、跨会话有 AI结论区，缓存的命中场景随重看强制令删除而消失。若未来素材量大到重看成本真实可感，再按"文档 pluginData + 内容寻址 key（imageHash 本身即内容哈希，无需更换算法）"重新引入。
- **素材新鲜度的 hash 校验机制**（描述行带 imageHash 短码 + `describe` 输出 hash 做无 vision 比对）：`describe` 目前不输出 imageHash，为校验新增机制本身即是新的过度设计；Checkpoint 1 的 echo 确认已是人的安全网。
- **非 IMAGE 布局节点按 `(nodeId, focus)` 缓存**：布局节点没有失效信号，用户改完设计再 `look` 会拿到改动前的分析，而"改完再看"恰是最高频场景。当前"不缓存可变布局"是正确设计；如未来要做须用子树内容哈希/版本号。
- **`minFontSizeInSubtree` 的 undefined fontSize 处理**：现有控制流无害——`min = node.fontSize` 只在 `min === undefined` 时发生（无操作）；min 已是数字时 `undefined < min` 为 false 不会被替换。无需改。
- **localStorage 序列化层加固**：vueuse `useLocalStorage` 对字符串是 raw 存储（无 JSON 解析），不存在"JSON 非法 fallback 清空配置"的路径。手动调 DevTools 验证时注意值**不带引号**。

## 验证

- **单元测试**：`bun test tests/engine/tools/marketing/look.test.ts tests/engine/app/vision-settings.test.ts` 全绿；chat shard（`tests/engine/chat`）不破坏。
- **静态检查**：`bun run format` + 改动文件 oxlint 0 警告（本机性能约束，全量 lint/typecheck 交 CI）。
- **冒烟**：
  1. 通道 B 配好三字段 → `look` 出分析；点 baseURL 字段的 X → API key 仍在、`look` 仍可用（1.2 验证）。
  2. 通道 B 下连续两次 `look` 同一素材（任意 focus）→ 两次都触发 vision 调用、各返回当次分析（1.1 无缓存验证）。
  3. 默认通道下读 prompt 素材理解段 → 无"免费重看"表述，有 AI结论区 复用指引（1.1 prompt 验证）。

## 回滚

阶段 1 / 阶段 2 各自独立 commit，互不相依，单点 `git revert` 即可。1.1 的缓存删除是纯减法（进程内状态，无持久数据、无迁移负担）；prompt 改动随 1.1 同 commit。

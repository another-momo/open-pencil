# L1 生图工具优化

> 状态与执行顺序见 `README.md`。
> 上层总览见 `00-overview.md`，L1 生图工具 MVP 见 `00-overview.md` §3。

## 背景

`generate_image` 工具 MVP 已落地（`packages/core/src/tools/image-gen/`），经实测发现以下问题：

1. **不支持参考图生图**：缺少 `references` 参数，无法表达"用这些图做参考生成新图"的语义。当前 edit 路径把输入图当作"要修改的对象"而非"参考"，且只支持单张图。
2. **目标节点与输入隐式耦合**：`id` + IMAGE fill 被强制推断为"编辑"语义，当前图永远作为输入——无法表达"重新生成一张替换当前图、但不参考当前图"。重试场景下被否决的图作为输入，会让模型向被拒结果靠拢。
3. **尺寸映射丢失比例信息**：当前 `normalizeSize` 将任意输入映射到 gpt-image-2 的 7 个枚举尺寸，但实测 API（dmxapi）支持任意尺寸。枚举映射导致 1080x1920（9:16）被映射到 1024x1536（2:3），比例偏差 18.5%，影响 AI 生成构图。
4. **缺少超时控制**：图片生成是慢操作（30-60s），当前无超时设置，API 挂起时请求永远不返回。
5. **错误信息丢失**：`ofetch` 对非 2xx 响应直接抛 `FetchError`，`providers.ts` 中 `if (!response.ok)` 是不可达死代码。`FetchError` 的 message 只有 URL + status code，API 返回的具体错误（如 "size not supported"、"moderation blocked"）藏在 `err.data` 里被丢弃。
6. **FormData 字段名不兼容**：当前用 `image`，OpenAI 标准用 `image[]`。**已在 gpt_image_playground 实测 dmxapi `/images/edits` 支持多张 `image[]`**，可以放心按多图设计。
7. **缺少 `moderation` 参数**：OpenAI 标准参数，某些 API 需要它。

## 方案概览

| 改动 | 位置 | 优先级 |
|---|---|---|
| 参考图生图：支持 `references` 参数 | `apply.ts` / `providers.ts` / `requests.ts` | P0 |
| 尺寸规范化：枚举映射 → 16px 对齐 + 约束裁剪 | `packages/core/src/tools/image-gen/requests.ts` | P0 |
| 超时：ofetch `timeout` 选项，可配置 | `packages/core/src/tools/image-gen/providers.ts` | P0 |
| 错误信息：捕获 FetchError 解析 `err.data` | `packages/core/src/tools/image-gen/providers.ts` | P1 |
| 非 IMAGE 节点渲染参考（`asImage: true`） | `apply.ts` / `requests.ts` | P1 |
| 加 `moderation: 'auto'`；两端参数对齐（background / output_compression） | `packages/core/src/tools/image-gen/providers.ts` | P2 |
| 更新三处 generate_image 文档（tool description + 两个 system prompt） | `packages/core/src/tools/image-gen.ts` / `src/app/ai/chat/system-prompt.md` / `system-prompt-marketing.md` | P2 |
| 返回值增加 canvasWidth/canvasHeight | `packages/core/src/tools/image-gen/apply.ts` | P2 |

## P0：参考图生图

### 背景

当前 `generate_image` 只支持两种场景：文生图（`/images/generations`）和图编辑（`/images/edits` + 单张被编辑图）。缺少**参考图生图**：用一张或多张参考图作为风格/内容参考，生成全新图片。这是营销设计的高频场景（如"参考这张产品图的风格，生成节日海报"）。

OpenAI 的 `/images/edits` 端点通过 `image[]` 支持多张输入图，语义是"参考"而非"编辑"。dmxapi 的多图 `image[]` 已在 gpt_image_playground 实测通过。当前实现只传单张图且语义混淆。

### 心智模型：目标节点与参考输入完全解耦

**`references` 是唯一的图片输入入口，`id` 只决定输出目标。** 工具不做任何隐式图片收集——`image[]` 的内容与 agent 声明的 references 严格一一对应。

| 场景 | references | id | API 端点 | 输出 |
|---|---|---|---|---|
| 文生图 | 无 | 无 | generations | 新节点 |
| 参考生图 | 有 | 无 | edits | 新节点 |
| 填充/替换节点 | 无 / 有 | 有 | generations / edits | 覆盖该节点 |
| 编辑节点 | **包含目标节点自己** | 有 | edits | 覆盖该节点 |

- 想"参考当前图修改"（编辑语义）→ 把目标节点自己的 id 写进 references，并在 prompt 里用 `[image N]` 指代它
- 想"重新生成替换当前图、不参考旧图"（重试/换图语义）→ references 不写目标节点

### API 路由逻辑

遍历 `references`，按声明顺序逐项提取图片数据，收集到一个列表中。根据列表是否为空决定 API 端点：

- **列表非空** → 调 `/images/edits`，所有图片作为 `image[]` 参数传给 API。API 会综合参考这些图片生成新图。
- **列表为空**（无 references）→ 调 `/images/generations`，纯文生图。

无论走哪个端点，生成结果都输出到 `id` 指定的节点（覆盖其 fill），或创建新节点。

### 工具参数变化

```ts
params: {
  requests: {
    type: 'string',
    description: `JSON array. Each item:
      - prompt (required): description of what to generate
      - width, height (optional): dimensions for new images
      - id (optional): output target only — never used as an input image
        - omit → create new frame
        - provide → overwrite this node's fill with the result
      - references (optional): array of node ids — the ONLY source of input images
        - each id must have an IMAGE fill; its image data is appended to image[]
        - reference nodes are NOT modified; extraction happens before the
          output fill is written, so referencing the target itself is safe
        - to EDIT an existing image, include the target node's own id
        - image[] order = references declaration order; refer to images in
          the prompt as [image 1], [image 2], ... matching that order`
  }
}
```

### 位置引用约定：agent 内联手写 `[image N]`

**核心机制**：生图模型能理解 prompt 中的 `[image 1]`、`[image 2]` 等位置文本标记，并与 `image[]` 数组顺序对应。该约定在 gpt_image_playground 的两条独立链路中得到验证：人工 UI（`@图N` → `[image N]`，`promptImageMentions.ts`）和 agent 模式（`<ref id>` 标签，`agentImageReferences.ts`）——两者的共同点：**引用由 prompt 作者内联书写**，而非工具注入。

**设计**：agent 需要引用某张参考图时，自己在 prompt 里写 `[image N]`（N = references 声明顺序，从 1 开始）。工具不做任何注入，references 没有 label 参数。

**agent prompt 示例**（编辑当前海报 + 两张参考图）：
```
prompt: "重新设计 [image 1] 这张海报：保留 [image 2] 的产品主体，配色参考 [image 3]"
references: ["node-C", "node-A", "node-B"]
id: "node-C"
```
模型看到三张图和内联引用，直接对应。agent 未写标记时，退化为普通多图 prompt，模型按图片内容自行推断角色，无害。

> **被否决的方案**（工具注入 `[image N: role]` + label 参数）：见架构决策记录。

### 提取失败的处理

按 prompt 是否含 `[image N]` 标记分三种情况：

1. **prompt 无标记 + 部分提取失败**：跳过失败项；在返回结果的 `note` 中说明实际生效的参考图数量和各项跳过的原因（无标记时编号无关紧要，无需补偿）。
2. **prompt 无标记 + references 全部提取失败**：抛出明确错误（列出无效节点），不静默降级到文生图。
3. **prompt 含 `[image N]` 标记 + 任何提取失败**：**报错**。静默跳图会导致 agent 手写的标记与图片错位；让 agent 修正 references 后重试。

### 接口签名变化

```ts
// providers.ts
export interface ImageGenProvider {
  name: string
  generate(req: ImageGenRequest, images?: Uint8Array[]): Promise<ImageGenResult>
}
```

`images` 统一承载所有输入图片（即 references 提取结果）：
- 为空 → `POST /images/generations`（文生图）
- 非空 → `POST /images/edits`，images 作为 `image[]`

不再存在 baseImage 概念——输入图只有一个来源（references），provider 不关心图片的角色，只负责把列表发给 API。

### apply.ts 改动

**图片收集逻辑**（统一 `extractNodeImage` 辅助函数）：

只遍历 references 中的节点（目标节点不再被隐式收集——除非 agent 显式把它写进 references）。通过 `node.fills` 找到类型为 `IMAGE` 的 fill，取出 `imageHash`，再从 `figma.graph.images` 获取对应的 `Uint8Array` 图片数据。提取失败时按上一节的规则处理。

**generateOne 主流程**：

1. **解析目标节点**：如果 tool call 提供了 `id`，通过 `figma.getNodeById` 定位（仅作为输出目标）；否则为 null（后续创建新节点）。

2. **收集输入图片**：按 references 声明顺序，逐个提取图片。按"提取失败的处理"三规则决定跳过或抛错。

3. **尺寸处理**：
   - 目标节点不存在（新建）：使用用户指定的 `width/height`，未指定则默认 1024×1024。
   - 目标节点已存在且用户未指定尺寸：继承目标节点的宽高，通过 `normalizeSize` 做 16px 对齐和约束裁剪。
   - 目标节点已存在但用户指定了尺寸：使用用户尺寸。

4. **调用 API**：将图片列表传给 `provider.generate(req, images)`。provider 根据列表是否为空选择 generations 或 edits 端点。

5. **输出结果**：将 API 返回的图片 bytes 设为目标节点的 fill（`createImageFill`），返回节点 id、实际尺寸、provider 名称。

**批量调用的约束**：`image-gen.ts` 用 `Promise.all` 并发执行同一批次的 items。若 item A 的输出节点同时是 item B 的参考节点，提取与覆盖的先后顺序未定义。在 tool description 中注明约束：同一批次内，references 不得指向本批次其他 item 的输出节点（有依赖关系时分两次调用）。

### providers.ts 改动

**接口简化**：`generate` 方法签名从 `(req, baseImage?)` 改为 `(req, images?)`。`images` 是一个 `Uint8Array[]`，统一承载所有输入图片。

**请求构建逻辑**：

- **images 非空**（edits 路径）：构建 `FormData`，依次 append `model`、`prompt`、`size`、`n=1`、`quality`、`output_format`、`background`、`moderation=auto`，然后将 images 列表中的每张图作为 `image[]` 字段 append 进去（`form.append('image[]', blob, `input-${i + 1}.png`)`，与 playground 一致）。发送请求。
- **images 为空**（generations 路径）：构建 JSON body，包含 `model`、`prompt`、`size`、`n=1`、`quality`、`output_format`、`background`、`moderation=auto`。注意当前实现漏了 `background`，一并补上。发送请求。

**超时控制**（P0）：ofetch 原生支持 `timeout` 选项（毫秒，内部用 AbortSignal 实现），直接配置，不需要手写 AbortController + setTimeout。超时时间通过 `setImageGenCredentials(key, baseURL?, model?, timeoutMs?)` 增加第 4 个可选参数配置，默认 120_000。

**错误信息解析**（P1）：见下方 P1 节。

### 场景验证

| 场景 | references | id | image[] 顺序 | API 端点 | 输出目标 |
|------|-----------|-----|-------------|---------|---------|
| 文生图 | 无 | 无 | 空 | generations | 新节点 |
| 参考→新节点 | 有 | 无 | ref1, ref2, … | edits | 新节点 |
| 填充空节点 | 无 | 有 | 空 | generations | 同一节点 |
| 替换已有图（不参考旧图/重试） | 无 | 有 | 空 | generations | 同一节点 |
| 编辑节点 | 含目标节点自己 | 有 | 目标节点图, …（按声明顺序） | edits | 同一节点 |
| 参考+编辑 | 目标节点 + 其他参考 | 有 | 按声明顺序 | edits | 同一节点 |
| 渲染参考（P1） | 有（`asImage: true`） | 有/无 | 渲染图1, 渲染图2, … | edits | 新节点或已有节点 |

### 改动量

`apply.ts` ~60 行（图片收集 + 失败处理），`providers.ts` ~40 行，`requests.ts` +`references` 解析 ~15 行（P0 为 `string[]`，P1 扩展对象形式）。

## P0：尺寸规范化重构

### 现状

`requests.ts` 中 `ALLOWED_SIZES` 定义了 7 个枚举尺寸，`normalizeSize` 通过面积+宽高比评分匹配最近的枚举值。

**问题**：实测 API 支持任意尺寸，枚举映射丢失了用户请求的比例信息。

| 请求 | 当前映射 | 比例偏差 | 问题 |
|------|---------|---------|------|
| 1080x1920 (9:16) | 1024x1536 (2:3) | +18.5% | 竖屏海报比例失真 |
| 1200x628 (≈1.91:1) | 1536x1024 (3:2) | +12.8% | 社交分享比例失真 |
| 800x800 | 1024x1024 | 0% | 无谓放大 |

### 目标

保留用户请求的宽高比，仅做平台约束裁剪（16px 对齐、最大边、最大宽高比、像素上下限）。

### 实现

移植 `gpt_image_playground/src/lib/size.ts` 的 `normalizeDimensions` 函数（~35 行），核心逻辑：

```
1. roundTo16 对齐
2. 最大边 ≤ 3840（floor 缩放）
3. 宽高比 ≤ 3:1（floor 裁剪）
4. 像素 ≤ 8,294,400（floor 缩放）且 ≥ 655,360（ceil 放大）
5. 迭代 4 轮（约束间可能冲突，需收敛）
```

**删除** `ALLOWED_SIZES` 和基于它的评分匹配逻辑。

### 效果验证

| 输入 | 新方案 | 保留比例？ |
|------|--------|-----------|
| 1080x1920 | 1088x1920 (9:16) | ✓ |
| 1200x628 | 1200x624 (≈1.92:1) | ✓ |
| 5000x3000 | 3712x2224 (≈1.67:1) | ✓ |
| 800x800 | 816x816 (64 万像素低于下限 → ceil 放大) | ✓ |
| 400x3000 | 480x1408 (先裁到 3:1 → 400x1200，再触发最小像素放大) | 约束裁剪 |

注：上表由手算得出，最终以移植函数的单元测试断言为准（见"验证与测试"）。

### 注意事项

如果未来切换到只接受枚举尺寸的 API，应在 provider 层做映射（`providers.ts`），而非在请求解析层（`requests.ts`）一刀切。不同 provider 可以有不同的尺寸策略。

## P0：超时控制

### 现状

`providers.ts` 中 `ofetch` 调用只设了 `retry: 0`，无超时。图片生成 API 可能要 30-60s，API 挂起时请求永远不返回。

### 实现

ofetch 原生支持 `timeout` 选项（毫秒），内部基于 AbortSignal 实现，请求超时后自动 abort 并抛出超时错误——不需要手写 AbortController + setTimeout。

```ts
const response = await ofetch.raw(url, { /* ... */, retry: 0, timeout: imageGenTimeoutMs })
```

超时时间通过 `setImageGenCredentials` 新增第 4 个可选参数配置，默认 120_000（120s）。

## P1：错误信息改进

### 现状

`ofetch` 对非 2xx 响应**直接抛 `FetchError`**，`providers.ts` 中两处 `if (!response.ok) throw ...` 是不可达死代码。`FetchError.message` 只包含 URL 和 status code，API 返回的具体错误信息（响应 body）挂在 `err.data` 上，被直接丢弃。

### 实现

用 try/catch 包裹 ofetch 调用，捕获 `FetchError` 后解析 `err.data`（参考 playground 的 `getApiErrorMessage`），按优先级尝试读取：

1. `error.message`（OpenAI 标准格式）
2. `detail`（字符串类型）
3. `error`（字符串类型）
4. `message`

都没有则 fallback 到 `err.message`（含 status code）。`err.data` 可能是对象或字符串，需兼容两种形态。这样 agent 能看到 "size not supported"、"moderation blocked" 等具体原因，而不是只看到一个 HTTP status code。

## P1：非 IMAGE 节点作为参考

### 场景

营销设计中常见工作流：先把文字、形状、图片等元素排好版，然后以这些元素为参考生成背景图。例如"为当前排版生成合适的背景，只需要背景层，不包含前景信息"。

基础版 references 只能引用有 IMAGE fill 的节点。文字、形状、Group/Frame 等非图片节点无法作为参考图传给 API。

### 方案：references 声明 `asImage: true`，工具内部渲染

Agent 在 references 中用 `{ id, asImage: true }` 显式声明"这个节点需要渲染成图片"。工具内部对该节点调用 `figma.exportImage`（可选能力，已存在）渲染为 PNG bytes，与其他参考图一起进入 `images[]` 列表。

**工作流示例**：

```
Agent 调 generate_image:
{
  prompt: "为 [image 1] 生成合适的背景图，画面主题：春节促销",
  references: [{ id: "frame-layout", asImage: true }],
  width: 1080, height: 1920
}
→ 工具内部渲染 frame-layout 为 PNG bytes，作为 image[1] 发给 API
```

**需要的改动**：

- `requests.ts` 的 references 项类型从 `string` 扩展为 `string | { id, asImage?: boolean }`
- `apply.ts` 的图片收集逻辑：声明 `asImage: true` 的节点调 `figma.exportImage([id], { scale: 1, format: 'PNG' })` 取 bytes；未声明 asImage 的节点走原有 IMAGE fill 提取路径
- `figma.exportImage` 未注入的环境（headless CLI）：该项按提取失败处理，原因记为 "render not available in this environment"
- System prompt 引导 agent：引用非 IMAGE 节点时加 `asImage: true`

**为什么不在 P0 一起做**：`asImage` 标记依赖渲染能力，失败模式更多（空渲染、超大节点、无渲染能力的环境），先把 IMAGE 节点引用跑稳再加。

### 备选方案 A：export_image + 文件路径编排（未选择）

Agent 先调 `export_image` 导出 PNG 文件，references 传 `{ path }` 由工具读取。

- 优势：工具职责单一（渲染与生图分离）；导出文件可见、可复用
- 劣势：需新增 `readFile`/`writeFile` 两个 fs 能力及 MCP 路径安全校验；纯浏览器环境不可用；临时文件需管理；agent 要编排两步
- **不选的核心原因**：文件只是传递渲染 bytes 的介质，而渲染能力（`figma.exportImage`）工具层已有——内部渲染零新增能力即可覆盖全环境，文件方案为解决同一问题引入一整套 fs 读写架构，成本与收益不成比例

## P2：其他改进

### 加 moderation 参数；两端参数对齐

Playground 始终发送 `moderation: 'auto'`。在 `dmxImageProvider` 的 JSON body 和 FormData 中都加上。同时对齐两条路径的参数：generations 的 JSON body 漏发了 `background`（edits 的 FormData 有）；edits 的 FormData 漏发了 `output_compression`（generations 的 JSON 有，仅 jpeg/webp 时生效），一并补上。

### 更新三处 generate_image 文档

尺寸枚举列表和"Two modes"的描述硬编码在三处，需同步更新为新行为（解耦模型、references、任意尺寸 + 约束裁剪）：

1. **`packages/core/src/tools/image-gen.ts` 的 ToolDef description**（模型直接看到的工具文档，最重要）：更新为解耦模型——references 是唯一输入入口、id 只是输出目标、编辑 = references 引用目标自身；写明 `[image N]` 位置引用约定（N = references 声明顺序）；删除枚举尺寸列表。
2. **`src/app/ai/chat/system-prompt.md`**：删除为 generate_image 新增的 23 行文档。Marketing 模式的 agent 使用独立的 `system-prompt-marketing.md`，原始 prompt 里不需要。
3. **`src/app/ai/chat/system-prompt-marketing.md`**（§Size constraints，约 line 103）：删除枚举尺寸说明，改为"任意尺寸，16px 对齐 + 平台约束裁剪"；补充 references 用法（编辑 = 引用目标自身、`[image N]` 位置引用、`asImage: true` 渲染引用）；重试指引改为"references 不含目标节点即重新生成、不参考旧图"。

同时更新 `requests.ts` 中 `sizeNote` 的文案——"Mapped to allowed gpt-image-2 sizes" 随枚举删除改为描述约束裁剪（仅在实际调整了尺寸时出现）。

### 返回值增加画布尺寸信息

当前 `apply.ts` 返回 `{ id, width, height, provider }`。应增加 `canvasWidth`/`canvasHeight` 表示画布实际尺寸，以及 `note` 表示尺寸调整/参考图跳过情况，让 agent 知道生成尺寸和画布尺寸可能不同、哪些参考图实际生效。

## 架构决策记录

### 目标节点与参考输入完全解耦

`references` 是唯一的图片输入入口，`id` 只决定输出目标。工具不做任何隐式图片收集——包括不把目标节点的 IMAGE fill 自动作为输入。

好处：
- 心智模型一句话可述："references 是输入，id 是输出"——无场景矩阵、无状态推断
- "重新生成替换但不参考旧图"（重试场景）自然成立：references 不写目标节点即可。若保留隐式收集，被否决的旧图会作为输入让模型向被拒结果靠拢
- `image[]` 顺序 = references 声明顺序，位置引用（`[image N]`）完全由 agent 在 prompt 中控制，工具无注入、无 label
- provider 接口保持简单 `generate(req, images?)`：images 为空走 generations，非空走 edits；dmxapi 多图 `image[]` 已在 playground 实测通过

代价：编辑场景（高频）需把目标节点 id 写进 references，且推翻 MVP 的"id + IMAGE fill 自动编辑"行为。对 LLM 工具接口，显式声明比状态推断更可靠；MVP 刚落地，行为变更成本最低。

曾考虑 `regenerate: true` 布尔和 `mode: auto/edit/fill` 三态，两者都是给隐式推断打补丁——保留推断就必然需要覆盖推断的开关，语义混杂，弃用。

### 位置引用：agent 内联手写，工具不注入

**选定方案（原备选 A）**：工具不注入任何标记；agent 在 prompt 中内联书写 `[image N]` 引用第 N 张参考图，编号约定（N = references 声明顺序）写进 tool description 和 system prompt。

理由：
- 这是唯一有实证的模式——playground 两条独立链路（人工 `@图N` → `[image N]`；agent 模式 `<ref id>` 标签）都是"prompt 作者内联书写"
- 我们的 agent 一次性生成 prompt + references，内联书写零额外负担，"agent 负担重"的拒因不成立
- 工具最简：无注入逻辑、无标记检测正则、无 label 参数
- 降级优雅：agent 忘写标记 = 普通多图 prompt，模型按内容推断，无害
- 角色提示如需要，agent 可自行内联书写（`[image 2]（配色参考）`），无需工具参数

**被否决方案（工具注入 `[image N: role]` + label 参数）**：
- `[image N: role]` 格式和头部注入清单均为无实证发明——playground 从未使用角色标签，标记也从不脱离句子单独出现
- 注入场景形成两跳推理（prompt 里的描述 → 头部 label → 位置），不如内联一跳直接
- 工具复杂度上升（注入 + 检测 + label 传递），换来的只是掩盖"agent 忘写标记"这一无害降级

### 非 IMAGE 节点作为参考：工具内部渲染，不经文件

**选定方案（方案 B）**：references 用 `{ id, asImage: true }` 声明渲染意图，工具内部调 `figma.exportImage` 渲染为 PNG bytes。
- 零新增能力——`figma.exportImage` 可选能力已存在，环境注入模式成熟
- 单次工具调用，agent 工作流简单；无临时文件管理
- 覆盖全环境（含纯浏览器）——文件方案在浏览器不可用

**备选方案（方案 A）**：Agent 编排两步——`export_image` 导出 PNG 文件，references 传 `{ path }` 由工具读取。
- 优势：工具职责单一（渲染与生图分离）；导出文件可见、可复用
- 劣势：需新增 `readFile`/`writeFile` 两个 fs 能力及 MCP 路径安全校验；纯浏览器环境不可用；临时文件需管理；两步编排

**未选择的理由**：文件读写只是传递渲染 bytes 的传输介质，而渲染能力工具层已有——为同一目标引入整套 fs 架构不划算。若未来出现"引用画布外任意图片文件"的独立需求，再单独评估 `readFile` 能力。

### 为什么不在 provider 层做尺寸映射

当前 `normalizeSize` 在 `requests.ts`（请求解析层）做枚举映射，对所有 provider 一刀切。重构后：

- `requests.ts` 只做通用的 16px + 约束裁剪（所有 provider 共享）
- `providers.ts` 的 `generate()` 方法可以根据需要做 API 特定的尺寸适配
- 这样切换 provider 时不需要改请求解析逻辑

### 为什么参考 playground 而不是自己写

playground 的 `normalizeDimensions` 经过大量实际 API 测试验证（支持几十种供应商），其约束迭代（4 轮循环）处理了约束间的冲突收敛。自己写容易遗漏边界情况（如 400x3000 这类先触发比例裁剪、再触发最小像素放大的连锁约束）。移植时连同单元测试一起搬，不手填预期值。

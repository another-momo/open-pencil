# L1 生图工具优化评审（2026-07-29）

> 评审对象：`../plans/l1-image-gen-optimize.md` 声称已落地的 P0/P1/P2 全清单，对照实际代码（`packages/core/src/tools/image-gen/` 三件套 + `image-gen.ts` 入口 + 两个 system prompt + `CHANGELOG.md` Unreleased + 设置面板 `ImageGenKeysSection.vue` + 凭证接线 `src/app/ai/chat/storage.ts`）。
> 结论：plan 列出的所有改动均已在代码层落地，文档对齐。**没有任何功能性缺口**。原 5 处低优改进点（见 §三）+ **新增 2 类发布前必做项**（§五：命名修正 + prompt 触发引导），后两者源于"agent 何时该用 export:true" 的二次走查发现。
> §二"符合的部分"覆盖 P0×3 / P1×2 / P2×3 共 8 项的逐项判定；§三列偏差；§四列相邻问题；§五列发布前必做的命名修正 + prompt 引导补全；§六给执行顺序与一句话总结。

## 一、评审范围与口径

- **plan 声称的范围**：P0 三项（references 参数 / 尺寸规范化重构 / 超时控制）、P1 两项（错误信息改进 / 非 IMAGE 节点渲染参考）、P2 三项（`moderation` 与两端参数对齐 / 三处文档同步 / 返回值 `canvasWidth/canvasHeight`）。
- **口径**：plan §验证与测试 列出的 7 场景表 + 单元测试要求 + 联调验证 + CHANGELOG 同步；plan 架构决策记录里"位置引用由 agent 内联手写"等设计取舍**不属评审对象**（plan 自我一致即可）。
- **不评审**：`00-overview.md` 中"已被推翻的早期假设"段落（已知文档状态），与本次 plan 重构无关。
- **顺手发现的相邻问题**：`overview.md:36` 描述"覆盖该节点 fill"未体现 CHANGELOG Unreleased 第 4 条"覆盖 frame 时保留 children"行为，见 §五。

## 二、plan vs 代码：符合的部分

| # | plan 声称 | 代码实证 | 判定 |
|---|---|---|---|
| 1 | P0 references：解耦模型、`image[]` 多图 | `apply.ts:51-78` + `providers.ts:34-43,174-180` + 测试 `apply.test.ts:38-47`（目标有 IMAGE fill 但 references 为空时 `images === undefined`，走 generations） | ✅ |
| 2 | P0 references：三类失败处理（无标记+部分失败 → note；全失败 → 报错；含 `[image N]` + 任何失败 → 报错） | `apply.ts:67-78`；测试 `apply.test.ts:86-129` 全覆盖（`1/2` note / 全失败 `throw 'missing-a'` / 含标记 throw `'misalign'`） | ✅ |
| 3 | P0 references：编辑 = references 引用目标自身 | `apply.ts:51` 先取 target、`apply.ts:61-65` 先收集再覆盖 `apply.ts:101`；测试 `apply.test.ts:68-84` 断言 `extract before overwrite` | ✅ |
| 4 | P0 尺寸：枚举 → 16px 对齐 + 约束裁剪 | `requests.ts:5-21` 常量（16/3840/3/655360/8294400）+ `requests.ts:29-64` `normalizeDimensions` 4 轮迭代 + `requests.ts:72-79` `normalizeSize` | ✅ |
| 5 | P0 尺寸：playground 用例移植 | 测试 `requests.test.ts:5-29` 覆盖 1080×1920 / 1200×628 / 800×800 / 5000×3000 / 400×3000（含链式约束） | ✅ |
| 6 | P0 尺寸：`ALLOWED_SIZES` 删除 | 全库无残留（`grep -r ALLOWED_SIZES packages/core/src` 无命中） | ✅ |
| 7 | P0 超时：默认 120s，可由 `setImageGenCredentials` 第 4 参覆盖 | `providers.ts:70` `imageGenTimeoutMs = 120_000` + `providers.ts:72-88` 第 4 参 + `providers.ts:187,215` ofetch `timeout:` 选项 | ✅ |
| 8 | P1 错误：`FetchError` 解析 `err.data`，不可达死代码已删 | `providers.ts:121-138` `apiErrorMessage`（按 `error.message` / `detail` / `error(str)` / `message` 优先级）+ `providers.ts:220-222` try/catch + 全库无 `if (!response.ok)` 残留 | ✅ |
| 9 | P1 非 IMAGE 节点：`{ id, export: true }` + 工具内 `figma.exportImage` | `apply.ts:30-39` `extractReferenceImage` + `requests.ts:87-110` `parseReferences` 接受 string 或 `{id, export?}` | ✅ |
| 10 | P1 渲染：`figma.exportImage` 缺失时按提取失败 | `apply.ts:35` `if (!figma.exportImage) return null`；测试 `apply.test.ts:150-164` 验证报错 | ✅ |
| 11 | P2 `moderation: 'auto'` + 两端 `background`/`output_compression` 对齐 | `providers.ts:173,201` 两端都 append `moderation`；`providers.ts:152-160` `withCompression` 同时覆盖 FormData 与 JSON body | ✅ |
| 12 | P2 文档：tool description 重写为解耦模型 | `image-gen.ts:16` 一句覆盖 references 是唯一输入 / id 是输出目标 / 编辑 = 引用自身 / `[image N]` / `export: true` / 16px 对齐 / 批次依赖约束 | ✅ |
| 13 | P2 文档：`system-prompt-marketing.md` §Size constraints 改写 | `system-prompt-marketing.md:89-120` 四类场景示例（text-to-image / fill+retry / edit 引用自身 / reference-guided）；`:115` 改"任意尺寸 + 16px 对齐 + 约束裁剪"；`:116` 改"references 不指向本批次其他 item 的输出节点" | ✅ |
| 14 | P2 文档：`system-prompt.md` 删除 23 行 | `system-prompt.md` 全文未提及 references / `[image N]` / export:true，确认删除 | ✅ |
| 15 | P2 文档：`sizeNote` 文案同步 | `requests.ts:181` `"Adjusted to API constraints (16px alignment, edge/ratio/pixel limits): …"` | ✅ |
| 16 | P2 返回值 `canvasWidth/canvasHeight/note` | `apply.ts:7-16` `ImageGenExecuteResult` + `apply.ts:103-111` 返回构造 | ✅ |
| 17 | 单元测试：references 形态 / 提取失败 / 解耦语义 | `requests.test.ts:46-99` + `apply.test.ts:38-47` 全覆盖；plan §验证与测试 1.a/b 全部命中 | ✅ |
| 18 | CHANGELOG Unreleased 同步 | `CHANGELOG.md:8` Added 段（references + export + 比例保留）+ `CHANGELOG.md:35` Fixed 段（120s timeout / API 真实错误 / moderation/background/output_compression 对齐） | ✅ |

合计 18 项 plan 声称 → **18 项 ✅，0 项 ❌**。P0×3、P1×2、P2×3 全部在代码 + 文档 + 测试 + CHANGELOG 完整落地。

## 三、与 plan 略有出入的点

### 3.1 timeout 配置无 UI 入口（功能就绪，UI 缺位，可选补全）

`setImageGenCredentials(key, baseURL?, model?, timeoutMs?)` 第四参数已经定义（`providers.ts:72-88`），但：

- [ImageGenKeysSection.vue](open-pencil/src/components/chat/ProviderSettings/ImageGenKeysSection.vue) 只有 API Key / Base URL / Model 三个字段，没有超时设置。
- [storage.ts:60-68](open-pencil/src/app/ai/chat/storage.ts#L60-L68) 没有 `imageGenTimeoutMs` 持久化字段。
- [storage.ts:140](open-pencil/src/app/ai/chat/storage.ts#L140) 调用 `setImageGenCredentials` 时只传 3 个参数。

**plan 严格达标**（plan §P0 超时控制只写"默认 120_000，通过 `setImageGenCredentials` 新增第 4 个可选参数配置"，未要求暴露 UI）。**若产品想让用户能改**（dmxapi 慢场景想加长到 180s），需补一个 `imageGenTimeoutMs` 输入项 + storage ref + Vue 字段。**默认体验已正确**：120s 覆盖绝大多数场景，超时即抛错。

### 3.2 `withCompression` 在 JSON 路径写 number 而非 String（与 playground 一致，非 bug）

[providers.ts:152-160](open-pencil/packages/core/src/tools/image-gen/providers.ts#L152-L160)：

```ts
const withCompression = (target: FormData | Record<string, unknown>) => {
  if ((req.outputFormat === 'jpeg' || req.outputFormat === 'webp') && req.outputCompression != null) {
    if (target instanceof FormData) target.append('output_compression', String(req.outputCompression))
    else target.output_compression = req.outputCompression
  }
}
```

初看怀疑"JSON 路径数字直挂对象，dmxapi 是否接受"。**已用 playground 反查确认这是正确做法**：

| 载体 | playground (`openaiCompatibleImageApi.ts:509-511, 571-573`) | open-pencil | 一致？ |
|---|---|---|---|
| JSON body | `body.output_compression = params.output_compression`（number） | `target.output_compression = req.outputCompression`（number） | ✅ |
| FormData | `formData.append('output_compression', String(...))` | `String(req.outputCompression)` | ✅ |

wire format 本来不同：JSON 路径 stringify 输出 `123`、FormData 路径输出 `"123"`。**完全正确，撤回原疑虑。**

风格差异：playground 用 `output_format !== 'png'` 作为触发，open-pencil 用更严格的 `'jpeg' | 'webp'`。OpenAI 规范只支持 png/jpeg/webp 三种，行为等价；open-pencil 略胜在将来若加新格式（如 `webp2`）不会误发 compression 字段。**无需改动**。

### 3.3 `apply.ts` mutate `req.width/height` 入参（轻微风格问题，不踩坑）

[apply.ts:88-97](open-pencil/packages/core/src/tools/image-gen/apply.ts#L88-L97)：

```ts
} else if (req.id && (req.width === undefined || req.height === undefined)) {
  const normalized = normalizeSize(Math.round(target.width), Math.round(target.height))
  if (!('error' in normalized)) {
    req.width = normalized.width
    req.height = normalized.height
  }
}
```

`req` 来自 `parsed.requests` 数组，直接 mutate 入参。**行为正确**（fake provider 在 `apply.test.ts` 里观测到正确值）。

**为何实际不踩坑**：`Promise.all`（`image-gen.ts:36-43`）里各 item 是不同对象（`parseImageGenRequests` 已 `out.push({...})` 重新构造），同批内不同 `req` 互不共享引用。

**但仍建议改写**：用 `const finalReq = { ...req, width, height }` 传给 `provider.generate(finalReq, images)`。理由：① 表达"req 进入 provider 前已完成尺寸归一化"的不可变语义；② 未来若 `parsed.requests` 改成共享底层对象（如 memoize 解析结果）不会引爆；③ 与 requests.ts 已构造新对象的风格一致。**低优**，不改也行。

### 3.4 `Promise.all` 批次内 reference → 同批输出节点无运行时校验（plan 标注约束，无护栏）

[image-gen.ts:36-43](open-pencil/packages/core/src/tools/image-gen/image-gen.ts#L36-L43) 并发执行同一批次。plan §批量调用的约束写"references 不得指向本批次其他 item 的输出节点（有依赖关系时分两次调用）"。**目前只在 tool description 里告知**（`image-gen.ts:16` 末句）。

**实测的降级行为是优雅的**：误用时 A 还没写入 B 就开始 extract → `extractReferenceImage` 拿 null → 走「全失败报错」或「部分失败 + 标记 misalignment 报错」分支，**不会静默错位**（这是 `apply.ts:67-78` 的失败处理自然给出的兜底）。

**可选改进**：显式检测并给出更明确报错 `"Item N references Item M's output node; split into separate calls"`。**低优**，当前降级已可接受。

### 3.5 缺失 3 类单测（plan 未列，价值中等）

plan §验证与测试 1 未列以下三类，但都值得补：

| 缺失测试 | 价值 | 位置 |
|---|---|---|
| `apiErrorMessage` FetchError 解析 | 高（独立纯函数，无外部依赖，易测） | `providers.ts:121-138` |
| `withCompression` 两路径覆盖 | 中（jpeg/webp + FormData/JSON body 四组合） | `providers.ts:152-160` |
| `dmxImageProvider` FormData 字段名（`image[]` 而非 `image`） | 中（防止未来重构改字段名，dmxapi 实测对 `image` 字段会拒） | `providers.ts:174-180` |

需要 fetch mock 或 `globalThis.fetch` stub（已有同类先例可在 `tests/engine/` 找）。

## 四、与 plan 无关的相邻问题（顺手指出，不属评审对象）

### 4.1 `overview.md:36` "覆盖该节点 fill"未体现"frame 保留 children"

[00-overview.md:36](open-pencil/docs/plans/00-overview.md#L36) 写"省略 `id` → 新建 frame；传入 `id` → 覆盖该节点 fill"——但 CHANGELOG Unreleased Added 第 4 条明确"`generate_image` 和 `stock_photo` 现在可以把图片作为 Frame 的背景填充同时保留 children"，这是营销 text-over-image hero 模式的关键能力。overview 文档未体现。

**修订建议**：overview.md:36 改为"`id` 指向 leaf 时覆盖 fill；指向 Frame 时作为背景填充同时保留 children"。一句话即可。

### 4.2 `outputFormat` 触发条件与 playground 风格差异（已确认等价）

见 §3.2，无需改。

## 五、补充建议（基于"何时该用 export:true"评审）

继主评审后，从"agent 实际能否想起这条参数"角度做了二次走查，发现两类需补充落地的问题：**命名本身误导 + prompt 触发引导缺失**。两者合并修改工作量小、收益高，建议在发布前一并处理。

### 5.1 命名修正：`export:true` → `asImage:true`

#### 5.1.1 问题诊断

`export:true` 的命名**有结构性缺陷**，三方面：

1. **与已有 `export_image` 工具名混淆**——`export` 在工具域里已有"导出到文件"的稳定含义，agent 看到 `export:true` 会自然联想成"是不是要存文件"，但实际语义是"渲染成 PNG 字节流供内部使用，不出文件"。
2. **与同字段 string 形态的语义断层**——`"0:42"` 读起来是"用 id 指代节点"，`{"id":"0:42","export":true}` 却跳到"导出"，同一字段从"指代"到"导出"无逻辑桥梁。
3. **动词无承载对象**——`render`、`rasterize` 这类术语在设计工具里有精确含义（节点→像素），`export` 在 Figma/Affinity/Sketch 等语境下含义多达 4 种（导出文件 / 分享 / 复制 / 渲染）。

#### 5.1.2 推荐命名：`asImage:true`

考虑过的候选（按推荐度排序）：

| 命名 | 精度 | 与 `export_image` 区分 | LLM 直觉 | 推荐 |
|---|---|---|---|---|
| **`asImage`** | ✅ 介词短语清晰 | ✅ 零混淆 | ✅ 直白 | ✅ |
| `render` | ✅ 严格对应 CanvasKit 管线 | ✅ | ⚠️ React render 联想 | 次选 |
| `rasterize` | ✅ 技术精确 | ✅ | ❌ 生僻 | 不推荐 |
| `capture` | ⚠️ 含义模糊 | ✅ | ⚠️ | 不推荐 |
| `exportImage` / `exportAsImage` | ✅ | ❌ 仍与 `export_image` 混淆 | ✅ | ❌ |

`asImage` 胜在**对所有模式/角色都直觉**——agent、用户、开发者读到都立刻知道"把这个节点当作图片用"。`render` 是技术精确但对营销模式下的 agent 多了 React render 的联想噪声。

#### 5.1.3 迁移清单（6 个文件，纯字段名改写）

| # | 文件 | 当前 | 改为 | 行号 |
|---|---|---|---|---|
| 1 | `providers.ts` | `export?: boolean` + JSDoc | `asImage?: boolean` + JSDoc | `:9-10` |
| 2 | `apply.ts` | `if (ref.export)` | `if (ref.asImage)` | `:34` |
| 3 | `requests.ts` | `export: raw.export === true ? true : undefined` | `asImage: raw.asImage === true ? true : undefined` | `:103` |
| 4 | `image-gen.ts`（tool description） | `use \`{"id":"...","export":true}\`` | `use \`{"id":"...","asImage":true}\`` | `:16` |
| 5 | `system-prompt-marketing.md` | `use \`{"id":"...","export":true}\`` | `use \`{"id":"...","asImage":true}\`` | `:109` |
| 6 | 测试 fixture × 2 + plan 文档 × N + CHANGELOG × 1 | 同上替换 | 同上替换 | 见 grep |

**迁移成本**：纯字段名改写，**零逻辑变更**、**零数据迁移**（这是私有工具参数，仅在 prompt 串里出现，agent 读 description 即时生成，无持久化历史调用需兼容）。单测更新 fixture 后重跑应全绿。

**CHANGELOG** 归到 Unreleased → Changed 段：

> - Rename `references[*].export` to `references[*].asImage` in `generate_image` — `export` collided with the `export_image` tool's "save to file" semantics; `asImage` reads as "treat this node as an image" across UI/marketing modes.

### 5.2 prompt 触发引导（3 处补全，按 ROI 排序）

主评审时确认 agent **知道怎么写** `asImage:true`，但**缺少"什么时候该写"的触发引导**。典型场景是 plan §P1 的核心用例："先排版好 Frame 文字 + CTA，再要 AI 生成匹配背景"。三处补全：

#### 5.2.1 ROI 1 — marketing reference section 补"非 IMAGE 节点"段（最小改动）

在 [system-prompt-marketing.md:109](open-pencil/src/app/ai/chat/system-prompt-marketing.md#L109) 的"Reference-guided generation"示例后追加：

```markdown
**Non-image references (`asImage: true`):** if the reference is a Frame / Group /
composition (no IMAGE fill — i.e. text + shape layout, not a single picture),
wrap it as `{"id":"<id>","asImage":true}`. The tool renders the node to a PNG
internally and sends it to the API — common cases: a layout placeholder where
text + CTA already exist (background-generation 场景), a styled brand mark on
a colored background, or any node where the *visual composition* matters, not
a single image. Without `asImage:true`, references that have no IMAGE fill
will fail to extract.
```

**3-4 句，不破坏现有节奏**，覆盖核心触发场景。

#### 5.2.2 ROI 2 — Phase 3 工作流补"Frame 占位"分支引导

[system-prompt-marketing.md:208-228](open-pencil/src/app/ai/chat/system-prompt-marketing.md#L208-L228) 的 Phase 3 步骤 1 前，加一段触发条件：

```markdown
3. **Frame placeholders need a reference choice.** If the placeholder is a
   Frame (not a leaf shape) and you're generating its background, decide
   whether the rest of the design is part of the reference. Example: a hero
   Frame with a title + CTA already drawn — the user wants a background
   that complements that composition, not ignores it. Pass
   `{"id":"<hero-id>","asImage":true}` so the API sees the existing
   typography/CTA in the reference. Skip this only if the user explicitly
   says "ignore the existing layout" / "fresh background".
```

明确 trigger：**"placeholder 是 Frame + 生成背景 + 用户没说要 ignore layout"** → 用 `asImage:true`。

#### 5.2.3 ROI 3 — tool-level hint：失败错误信息更具行动性

[apply.ts:67-78](open-pencil/packages/core/src/tools/image-gen/apply.ts#L67-L78) 的 throw 处，区分"节点不存在"和"节点无 IMAGE fill"两种失败：

```ts
if (references.length > 0) {
  if (skipped.length > 0 && IMAGE_MARKER_RE.test(req.prompt)) {
    throw new Error(
      `Failed to extract reference image(s): ${skipped.join(', ')} — the prompt contains [image N] markers that would misalign; fix the references and retry`
    )
  }
  if (images.length === 0) {
    // 改进：区分"节点不存在"与"节点无 IMAGE fill"
    const missing = skipped.filter((id) => !figma.getNodeById(id))
    const noFill = skipped.filter((id) => figma.getNodeById(id) !== null)
    let hint = ''
    if (noFill.length > 0) {
      hint = ` — tip: ${noFill.length > 1 ? 'these nodes have' : 'this node has'} no IMAGE fill; pass {"id":"<id>","asImage":true} to render ${noFill.length > 1 ? 'them' : 'it'} as a reference`
    }
    throw new Error(
      `Failed to extract reference image(s): ${skipped.join(', ')}${hint}`
    )
  }
}
```

**好处**：
- 对 UI / marketing / MCP / CLI 四种模式同时生效，**不依赖 prompt 措辞调整**
- agent 漏加 `asImage:true` 报错后立刻知道怎么修，无需翻文档
- 复用现有 `IMAGE_MARKER_RE` 失败分支的措辞风格

### 5.3 改名与 prompt 优化的合并执行顺序

```
1. 5.1 改名 export:true → asImage:true  （6 个文件，1-2 小时）
2. 5.2.1 marketing reference section 补"非 IMAGE 节点"段  （10 分钟）
3. 5.2.3 apply.ts 失败错误信息加 tool-level hint  （20 分钟 + 单测）
4. 5.2.2 Phase 3 工作流加"Frame 占位"分支引导  （5 分钟）
5. （保留原 §五）补 apiErrorMessage / withCompression / FormData image[] 字段名单测
6. （保留原 §五）overview.md:36 补"Frame 时保留 children"行为描述
```

**优先级**：1-4 是发布前必做（命名清晰度 + 触发引导让 agent 真正用得起来）；5-6 是文档/测试完整性。

## 六、一句话总结

> plan 100% 落地，代码 + 测试 + 文档 + CHANGELOG 全部对齐；**新增**两类发布前必做项：① 命名修正 `export:true` → `asImage:true`（消除与 `export_image` 工具名的语义混淆）；② prompt 触发引导三处补全（marketing reference section / Phase 3 workflow / tool-level error hint），让 agent 在排版先行→生图作底的核心场景下能稳定想起 `asImage:true`。
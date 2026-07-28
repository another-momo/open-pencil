# 视觉回路：设计方案

> 最后更新 2026-07-27。本文档定义营销 Agent 的视觉回路——让 Agent 能"看到"画布，突破盲排版的质量上限。
> 状态与执行顺序见 `README.md`；评审背景见 `../review/2026-07-27-agent-design-review.md` 第二部分 §1。

## 1. 问题定位

整个 Agent 体系建立在 `describe`（结构化数据）之上，AI 从头到尾看不到画布：

- 配色和谐度、构图平衡、文字压图、生成图内容是否符合预期——设计的本质问题全部不可见，只能靠启发式 lint 间接推断（信噪比差，见错误目录 R3-4）
- 用户拖入的产品图 AI 不知道画的是什么，素材角色完全依赖用户命名——架空了多来源素材协调与图片风格协调两个设计理念（`l2-agent-mode.md` §1.4、§6.3）
- 所有 checkpoint 实质上是让用户充当 AI 的眼睛

## 2. 分工原则：视觉回路不替代现有检查

| 层 | 机制 | 回答的问题 | 性质 |
|---|---|---|---|
| 代码校验 | `validate` | readonly 值是否被改、结构是否合规 | 确定性，硬门槛 |
| 结构分析 | `describe` | 节点树、溢出、对比度数值 | 确定性，"盲"数据 |
| **视觉回路（新增）** | `look` | 图里画的是什么、文字压没压图、风格协不协调 | 模型判断，**advisory** |

核心原则：**视觉判断永远是 advisory，不当硬门槛**。多模态模型会幻觉（报告不存在的错位），硬门槛只留给确定性校验（方法论 §4）。look 报告"锚点似乎被移动"时不直接信，触发 validate 复核——确定性校验仍是唯一裁判。

## 3. 总体架构：双通道投递 + 能力探测

```
                    ┌─ 当前 chat 模型支持视觉？ ─┐
                    │                            │
              是 ──▶ 通道 A：直接注入          否 ──▶ 通道 B：视觉子调用
              look 工具结果携带                  look 内部调 generateText
              image part（AI SDK v6 原生）       （独立视觉模型：kimi/minimax）
              主模型自己看图                      返回文字分析给主模型
```

- **通道 A（首选）**：`look` 执行时导出 PNG，通过 AI SDK v6 的 `toModelOutput` 返回 media 内容部分，主模型直接"看到"。信息无损，质量上限最高。
- **通道 B（兜底）**：主模型是纯文本模型时，`look` 内部用独立配置的视觉模型做一次 `generateText`（图 + 聚焦问题），文字结论返回主模型。配置复用 imageGen 先例：`visionApiKey / visionBaseURL / visionModel`，设置面板加独立 section。
- **能力探测**：transports 层按 provider/model 判断走 A；A 失败（400 unsupported）自动降级 B 并在结果里声明。
- 两通道对 prompt 透明——prompt 只写"什么时候该 look、看什么都检查什么"，不关心投递方式。

**截图通道现成**：`export_image` 工具（`packages/core/src/tools/vector/export.ts`）走 CanvasKit 光栅管线，`look` 复用同一 `figma.exportImage` 能力，区别在于返回 media part 而非 base64 文本。

## 4. `look` 工具设计

```
look({ id?, focus? })
```

- `id`：目标节点，省略 = 当前营销根 frame 总览
- `focus`：本轮想检查什么（"文字可读性" / "与锁定的配色方案是否一致" / "这张图的内容是什么"）——注入通道 B 的分析 prompt；通道 A 则作为文字随图一起给主模型

### 两级截图策略（长图场景的关键）

| 级别 | 内容 | 用途 | 规格 |
|---|---|---|---|
| overview | 整个根 frame 缩到长边 ~1024px | 结构、跨 section 一致性、整体调性 | JPEG q75，便宜 |
| zoom | 单个 section 按长边 ~1568px | 文字可读性、字压图、细节 | JPEG q80，按需 |

理由：750×4000 的长图压到 1024 长边后文字全糊，可读性检查必须用 section 级 zoom；但每 section 都 zoom 太贵，overview 负责"哪些 section 有问题"，zoom 负责确认。

### 去重与上下文控制（2026-07-27 重写）

**dedup 机制已被撤销**——原计划让 `look` 截图按 `nodeId + sceneVersion` 哈希复用、未变时返回"未变化"文本。**该机制在 2026-07-27 OOM 排查讨论中被取消**，原因：
- dedup 仅节省 ~300KB / 命中率 <10%，ROI 太低
- dedup 返回的"unchanged: true refer to your previous inspection"假设历史图存在，与 chat history 媒体 elision（必须丢弃旧图）根本冲突，产生悬挂引用
- 实现复杂度不值收益

**`look` 现在永远返回完整 base64 图**（删除 `lastLookHashes` WeakMap、`fnv1a` 哈希、`unchanged: true` 分支）。

**token 成本控制完全由上下文工程的 `media elision` 负责**：chat messages 中只保留最新 K=2 张 `look` 图 base64，老的图被替换为文本占位（保留 note 文本和 meta 段）。详见 [l2-context-engineering.md §方案 1](./l2-context-engineering.md#方案-1图片-media-elision解决问题-1)。

**预算硬约束**：每 section 最多 2 次 zoom look（与"修复 2 次失败删掉重来"对齐）。agent 想精确看老图 → 重 look（dedup 已取消，永远返回当前图），无成本阻力。

## 5. 触发时机（prompt 规则）

1. **素材理解**：用户在需求单素材区/选区/拖入图片时 → look 生成图像内容描述，按图片字节 hash 缓存，写入设计状态。素材角色从"全靠用户命名"变为"AI 看图 + 用户声明仲裁"。
2. **生图验收**：`generate_image` 落画布后 → look 验证生成结果是否符合 prompt 意图（图内文字乱码是 AI 生图常见病，目前完全无检测）。
3. **checkpoint 前置门禁**：展示 CP2/CP4 前必须 overview look——把"修完 error/warning 才能展示"的盲规则升级为"看过且没有明显视觉问题才能展示"。ROI 最高的一条，直接消灭"带病展示"（R2-2 类）。
4. **跨 section 一致性**：现有"每 3 个 section 用 describe 分析风格协调"规则本质是盲猜，改为 overview look 执行。

## 6. 分期落地

| 期 | 内容 | 依赖 | 验证 |
|---|---|---|---|
| **V0** ✅ 代码完成（2026-07-27） | `look` 工具（`packages/core/src/tools/marketing/look.ts`）+ 通道 A（ai-adapter media 工具集合 `MEDIA_OUTPUT_TOOLS`，note 作为文本部分随图投递，debug log 省略 base64）+ prompt 规则（CP2/CP4 前置门禁、生图验收、look 纪律） | 仅 prompt + 一个工具，复用 export_image 管线；实现时发现 ai-adapter 已有 `toModelOutput` 媒体投递先例（export_image），通道 A 基础设施比预估更现成 | 第 4 轮回归后用 kimi/minimax 多模态模型跑朋友圈广告 |
| **V1** | 通道 B（独立视觉模型配置）+ 素材理解 + 两级截图 | 设置面板 section、hash 缓存 | 文本模型 + 视觉模型组合跑长图 |
| **V2** | 窗口化（chat history K=2）接入上下文工程管线 + lint 降噪 + overview 一致性替代盲规则 | 上下文工程 Phase C 落地 | token 基线对比 |

**V0 先做通道 A 的理由**：零配置、零新基础设施，最快验证"视觉回路到底提升多少"。若 V0 发现多模态模型对设计稿的判断质量差（设计审美是多模态弱项，很可能），视觉回路定位收缩为"素材理解 + 文字压图检测"两个确定性较强的用途，V1/V2 重排。

**V0 之前的人工预实验**：先拿第 3 轮冒烟的产出图手动喂给 kimi/minimax 多模态模型，粗测判断质量，再决定是否投入 V0 开发。

## 7. 与上下文工程的接缝（顺序约定）

视觉回路是纯增量 token 消耗特性，与上下文工程（`l2-context-engineering.md`）的依赖关系：

1. **token 基线在 Phase C 开工当天量**（A0 已解散，2026-07-27 讨论）：现有 debug log 的观测能力够用；基线会随 prompt/工具修改过期，提前量无意义。视觉回路的 look 开销届时一并在基线中计量。
2. **Phase C 窗口化（chat history K=2 媒体 elision）必须预留 base64 字节丢弃语义**：裁剪时 image part 替换为文本占位（保留 note 文本和 meta 段），而非丢整条消息或把 base64 留在历史里。**当前设计已收敛**：[l2-context-engineering.md §方案 1](./l2-context-engineering.md#方案-1图片-media-elision解决问题-1)（2026-07-27 重写）——保留最新 K=2 张 `look` 图 base64 + 取消 dedup + 占位保留 note 文本。
3. **V0 结论反向决定 Phase C 设计**：视觉判断可靠 → media elision 作为一等公民 + manifest sections 加 visualCheck 字段；不可靠 → 收缩用途，Phase C 不为图片做特殊设计。

顺序全景（与 `README.md` §当前执行顺序 一致）：第 4 轮回归 → 视觉 V0 → Phase B → Phase C（开工当天量基线）→ Phase A/D → 视觉 V1/V2。

## 8. 与现有体系的张力处理

- **lint 降噪**：R3-4 类启发式警告在视觉回路接入后降级——"看起来有没有问题"由图回答，lint 只保留结构性 error（方法论 §6）。
- **错误目录新增"视觉误判"类**：look 报告不存在的问题 / 漏报明显问题，按实测迭代方法论处理，先观察幻觉率再决定是否加 prompt 约束。
- **eval 工具不兜底视觉**：look 是视觉的唯一入口，防止 AI 用 eval 手写截图逻辑绕过预算与去重机制。

## 9. 风险

| 风险 | 缓解 |
|---|---|
| 多模态模型审美判断不可靠 | advisory 定位 + focus 收窄问题域（"文字是否可读"比"好不好看"可靠得多）+ V0 先实测 |
| 成本失控（每张图几百到几千 token） | chat history 媒体 elision（K=2）+ 每 section 预算上限；Phase C 基线中单独计量 look 开销 |
| 延迟叠加（截图 + 视觉推理每次数秒） | CP 前置门禁每轮多 5-10 秒，对"生图 60 秒"现状可接受；制作清单场景另算总账 |
| 隐私（画布内容发第三方视觉 API） | 与现有 LLM 调用同级；视觉模型配置独立，用户可选 |

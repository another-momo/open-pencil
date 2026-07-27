# L2 上下文工程

> 状态与执行顺序见 `README.md`。

## 问题

营销 Agent 的上下文供给存在三个问题：

**问题 1：图片 tool result 撑爆上下文。**
`look` 工具返回的图片以 media part 常驻对话历史，每张 ~30-40K tokens。实测一次朋友圈广告设计中，4 张图后单步输入从 37K 膨胀到 428K。同一节点被反复检查时，旧图已无信息价值但仍在每轮请求中重复发送。

**问题 2：营销状态无法跨 session 恢复。**
设计状态（根 frame、锚点、readonly 基线、锁定方向、活动事实）存在内存注册表里，文档重开即丢失。用户中断后无法"继续未完成的设计"。同时注册表按 SceneGraph 键控（一份文档一个设计），无法支持一份文档多设计并存（制作清单的前置条件）。

**问题 3：类型信息两处维护。**
素材类型的推断关键词写在营销 prompt（7 行映射），类型定义在 `material-types.ts` 注册表，新增类型要改两处，必然漂移。另有 ~35 行图片工具 API 细节（尺寸枚举等）写在 prompt 里，而工具 description 才是 tool calling 的原生携带位置。

## 方案

### 方案 1：图片 media elision（解决问题 1）

**规则**：同一节点只保留最新一张图。

发送每轮 LLM 请求前，扫描历史消息中的 media part：同一 `nodeId` 的旧图替换为文本占位（`[节点 X 的截图已省略，参考最近一次视觉检查结论]`，占位文字取该次 look 的 note/focus 摘要）。

**实现位置**：transports 层发送前的消息转换（`createToolLoopTransport` 的 `prepareCall` 或薄 transport wrapper）。不碰 Chat 消息存储——UI 历史保持完整，只有发给模型的被裁剪。

**验收**：朋友圈广告冒烟重跑，单步输入峰值 <100K；look 行为不变（新图正常投递，判断结论可引用占位文字）。

### 方案 2：跨 session 恢复（解决问题 2）

两个已有通道组合，不建新系统：

**显式状态 → 需求单 AI结论区**（已实现）：锁定方向、活动事实由 AI 追加到需求单 AI结论区（只追加不改写）。文档保存即持久化。

**结构状态 → 画布推导**：会话开始 / 文档重开时执行 `restoreStateFromCanvas()`——按 pluginData 标记与命名约定找到根 frame 与锚点实例，重建注册表（readonly 基线从组件定义重算）。推导不出的状态（如无需求单时的风格关键词）接受丢失，AI 向用户声明后重新确认。

**键控改造**：注册表从 `WeakMap<SceneGraph, state>` 改为 `SceneGraph → Map<rootFrameId, state>`，一份文档多设计各自独立。

**验收**：重开文档后 validate 可用、AI 可基于需求单结论继续设计；引擎单测验证同文档两个 root frame 状态隔离。

### 方案 3：类型关键词下沉注册表（解决问题 3）

`material-types.ts` 增加 `keywords` 字段（如 `['小红书', 'xiaohongshu', '种草']`）。`setup_material_type` 工具描述从 `id (label)` 升级为 `id (label, 关键词)`——模型在决定调用 setup 之前经工具描述即可看到推断依据（tool schema 与 prompt 同等可见）。

prompt 删除 7 行类型映射和 ~35 行图片工具 API 细节（尺寸枚举已在 `generate_image` 的 description 里）。推断**行为规则**（变体默认+声明、不确定就问、用户锁定优先）保留在 prompt——它们是策略不是数据。

**验收**：冒烟回归，类型推断准确率不降（朋友圈 / 小红书 / DSP 各测一）；新增类型只改注册表一处。

## 实施顺序

| # | 任务 | 产出物 | 依赖 |
|---|---|---|---|
| 1 | media elision：transport 发送前裁剪同节点旧图 | transports 消息转换 + 占位文本 | 无 |
| 2 | prompt 清理：keywords 字段 + 工具描述升级 + 删冗余段落 | `material-types.ts`、`marketing.ts`、`system-prompt-marketing.md` | 无 |
| 3 | 注册表 per-rootFrame 键控 | `marketing/registry.ts` 改造 + setup/validate 适配 | 无 |
| 4 | 画布推导恢复 `restoreStateFromCanvas()` | 根 frame/锚点/readonly 注册表重建 | 3 |

建议顺序 1 → 2 → 3 → 4。

## 扩展触发条件

以下条件出现时再考虑扩展，当前不做：

- **全量历史窗口化**：product_long 长图冒烟实测，media elision 后单步输入仍 >150K，或 AI 出现"忘记早期决策"的实证。开工当天用标准用例量新鲜基线。
- **方言文档从代码生成**：prompt 里的 props/布局规则与 `render.ts` 实际行为出现两次以上不一致事故。
- **prompt 动态装配**：出现"每轮 LLM 调用前必须重算 prompt 内容"的真实场景（如 per-rootFrame 状态注入），先在 transports 写拼接函数，规模增长后再抽象。

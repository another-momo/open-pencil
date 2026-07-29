# 营销 L2 资源体系与 validate 机制评审（2026-07-29）

> 评审对象：`../plans/l2-agent-mode.md` §3 / §4 / §5（素材类型体系、资源体系、运行时）+ 实测的 `validate` 工具与它依赖的全部支撑代码（核心 + 周边）。文件不含视觉问题（已有 `2026-07-29-visual-loop-implementation-review.md`）。
> 本评审由两部分组成：
> - 第一节至第十节：设计与实测的现状对照（落档）
> - 第十一节：基于本评审结论与后续讨论得出的**重构方向**（type / profile / reference 解耦 + Library .fig 单一来源 + Web-first dialog 化）——这部分是讨论存档，待后续修订 `plans/` 时引用
> 结论：**§3/§4/§5 设计与实测高度同构；三处自我修正（曾误判为缺失的 overrides 与营销 prompt 已存在）+ 一处真正发现的实现缺口（render 路径不挂 `recordInstanceOverrides`）+ validate 检查覆盖面仍偏窄 + 整体架构方向应向"三关切解耦 + Library .fig"演进**。按惯例：本评审落档后不再改动，结论通过修订 `plans/` 下的设计文档与代码生效。

---

## 一、总览

### 1.1 已落地的设计决策

1. **结构化模板**（`component-templates.ts` 的 `TemplateNode` + 内联 `readonly: true`），避开 JSX 字符串对 readonly 标记的脆弱性 — 实测成立
2. **资产注册表**（`assets.ts`）只存引用而非字节，`brand-logo` 通过 base64 内置 — Phase 4 品牌包接缝已留好
3. **物料类型预设 7 个 + `custom` 转口**全部按 §3.3 列表存在（尺寸、锚点、styleGuide、custom 一致），`dsp_banner` / `event_poster` 表里写的"多尺寸"实测是用 `custom + width+height` 兜底
4. **`setup_material_type` 三种调用模式**（首次 / 切换 / 修复）+ Components 页面幂等 — 实测比设计多一条"按 label 收养根 frame"分支
5. **会话级注册表 WeakMap 隔离 + pluginData 标记重开还原** — `restore.ts` 用 `open-pencil-marketing` plugin id 把 role / type / template / position / component 五键持久化到节点上
6. **多设计并存消歧**（`lastActiveAt` 单调时钟 + 显式 rootFrameId） — 实测支持，是设计 §4/§5 未明文要求的强化
7. **violation 自给自足**（`originalValue` / `nodeId` / `prop` / `fix` 都在 violation object 里） — AI 修复不需回去查注册表
8. **accept=true 一次性重基线** + **forward-fix 用 batch_update(originalValue)** 两条修复通路，有数据支撑 + prompt 引导

### 1.2 真问题（按优先级）

| # | 问题 | 优先级 |
|---|---|---|
| P0 | `render` 工具未挂 `recordInstanceOverrides`，AI 用 render 改 BrandBar 实例子文案时 overrides 不写 → 用户改组件定义触发同步时被静默冲掉 | P0 |
| P1 | validate 不检查 `minSections`（配置里有，代码只对 `maxSections` 报警）—— **refactor 落地后此 P1 撤销（min/max 字段整体删除）** | P1（当前） / 撤销（重构后） |
| P1 | validate 的 `state.readonly` 只快照 `fills`（非 TEXT）或 `fills/text/fontSize/fontWeight`（TEXT），未覆盖 `width/height/visibility/opacity` — readonly 节点几何/可视属性被偷改时无 violation | P1 |
| P2 | `accept=true` 只对 `readonly_modified` 类型重基线，混有其他类型违规时仍持续报错 | P2 |
| P2 | prompt L175 的"after completing each section"是 honor-system，无 hook 兜底 | P2 |

### 1.3 三处自我修正（评审过程错判，按惯例落档）

| 错判 | 真相 | 出处 |
|---|---|---|
| "营销 prompt 文件不存在" | 实测存在：`src/app/ai/chat/system-prompt-marketing.md`（381 行） | 搜索范围圈错 |
| "overrides 自动记录完全缺失" | 实测已落**两处** AI 工具钩：`modify/update.ts:96` / `structure/batch.ts:145`；fig 同步引擎已读。**修正**：UI 属性面板走的是另一套 `propertyOverrides` 函数（properties.ts:107），并不调用 `recordInstanceOverrides` | 搜索范围圈错 + 误把 UI 路径算入 `recordInstanceOverrides` 调用方 |
| "validate 只报告、不修复" | 修复通路明确：forward-fix 用 batch_update(originalValue)、accept=true 重基线、setup_material_type 修复模式补删锚点 — 数据齐备 | 把"修复前询问用户"误读为"无修复机制" |

> 这三条同时落到第十节作为评审同行警告：覆盖营销 / design-system 时不要把搜索范围圈死在 `packages/core/src/tools/marketing/`，协作域的钩常在 `modify` / `structure` / `editor` / `fig` / `scene-graph`。

---

## 二、§3 素材类型体系：设计 vs 实测

> **本节描述当前实现**。第十一节提出的 Library .fig 重构落地后，§3.1 的三层映射表与 §3.2 组件模板陈述会变化（组件进库、配置层瘦身至"硬约束"）；代码引用仍可作迁移前的现状参考。具体复核见 §11.7。

### 2.1 设计意图清单落地情况

| 设计意图 | 实测 | 落点 |
|---|---|---|
| 用户意图 → 配置映射层 | ✅ | `MaterialTypeConfig` 接口 + `matchKeywords` + `listMaterialTypes()` |
| 工具执行尺寸（确定性） | ✅ | `MaterialTypeSize { width, height: number \| null }` — `null` 即 HUG（长图自适应） |
| 工具执行锚点组件引用 | ✅ | `AnchorComponentRef { template, position: 'top' \| 'bottom' }` |
| 工具执行结构约束 | ✅ | `StructuralConstraints { anchors, minSections, maxSections }` — 含 minSections 字段（但 §4 见 P1 缺校验） |
| AI 用 section 规划 + contentGuide | ✅ | `SectionPlanItem[]` 进入 `setup_material_type` 工具返回值 |
| AI 用风格指南 | ✅ | `StyleGuide { colors, fonts, keywords }` |
| AI 用自定义字段 | ✅ | `custom: Record<string, string>` 由 AI 用通用能力解释 |
| `setup_material_type` 工具返回 + note 携带 rootFrameId | ✅ | [setup.ts:411](packages/core/src/tools/marketing/setup.ts#L411) 注入 `render every section INTO the root frame with render({ parent_id: "${rootFrameId}", jsx: ... })` 硬指令 |
| 7 个预设全部存在 + `custom` 转口 | ✅ | material-types.ts L67-237 |
| `event_poster` / `dsp_banner` 设计表达"多尺寸" | ⚠️ 表里写"A3/A4/自定义" / "IAB 标准"，实测固定 1080×1920 / 300×250 — 必要时经 `custom` 覆盖 | 见 §三 |

### 2.2 文档同步建议（微小）

§3.3 表的 `event_poster` / `dsp_banner` 尺寸列改为"默认 1080×1920 / 300×250，custom id 覆盖"，与实测对齐。

---

## 三、§4 资源体系：设计 vs 实测

### 3.1 三层映射

| 设计层 | 实测模块 | 状态 |
|---|---|---|
| 组件层（节点结构、样式、readonly 标记、可编辑槽位） | `component-templates.ts` 的 `ComponentTemplate` + 模板内联 `readonly: true` | ✅ |
| 配置层（尺寸、锚点、结构约束、section 规划、风格指南） | `material-types.ts` 的 `MATERIAL_TYPES` 数据 + `makeCustomMaterialType` | ✅ |
| 执行层（营销 prompt + AI Agent + 运行时工具） | `marketing.ts` 入口 + `setupMaterialTypeTool` / `validateTool` / `lookTool` 注册到 CORE_TOOLS | ✅ |

### 3.2 组件模板 — 结构化数据 + 物化

- `TemplateNode` 字段直对应 SceneNode；构建器递归 `createNode` + `updateNode`（builder.ts:88-156） — 与设计"约百行代码"措辞一致
- `imageRef: 'brand-logo'` 仅引用，字节经 `assets.ts` 注册表在 `resolveFill` 时取 — 资产与模板解耦 ✅
- 物化顺序：createNode 模板 → `createComponentFromNode` → `createInstance` → `reorderChild` 放首/末 → `markMarketingAnchor` 写 pluginData（setup.ts:160-205） ✅
- 真组件而非普通 frame 的三个理由（系列同步 / 单选容器 / .pen 原生）在实测全部成立 ✅

### 3.3 ⚠️ 真问题：`render` 路径漏挂 `recordInstanceOverrides`

设计 L135：
> AI 改实例子节点后，必须把改过的属性写入实例的 overrides 记录 — 实现上作为 `batch_update` / `update_node` 在实例子节点上执行时的自动行为

实测 grep `recordInstanceOverrides` 调用点：**2 处**（`structure/batch.ts:145`、`modify/update.ts:96`），但 `design-jsx/renderer.ts` 的 render 工具**未挂**。

注：UI 属性面板经过独立的 `propertyOverrides` 函数（[`editor/components/properties.ts:107-114`](packages/core/src/editor/components/properties.ts#L107-L114)）直接构造 `overrides` map，**不走** `recordInstanceOverrides`——是另一套 override 写入机制，不计入"调用 `recordInstanceOverrides` 的入口"。

后果：AI 在 §4.2 readonly 约束下，通常用 prompt 引导的批量 / 单 prop 工具改 BrandBar 实例子文案（prompt L175 走的就是 `batch_update`），所以**当前 AI 工具侧关键路径覆盖**。但若 AI 用 `render({jsx: "<Text>...</Text>"})` 重写实例内 CTA 子节点，**overrides 不会被记录**——用户随后改 BrandBar 定义触发 sync 时内容会被静默冲掉。

补法（最小变更）：在 `design-jsx/renderer.ts` 渲染过程中，对写入过 prop 的子节点调一次 `recordInstanceOverrides(graph, childId, props)`。具体接入点与父级 INSTANCE 关系的判断借用 `instance-overrides.ts:12-19` 的 `findEnclosingInstance` 已有的 walk-up 逻辑。

### 3.4 校验机制（§4.3）

| 设计意图 | 实测 | 备注 |
|---|---|---|
| readonly 两层存储（定义层 + 运行时层） | ✅ | 定义层 `TemplateNode.readonly`、运行时层 `ReadonlyNodeInfo` |
| 不持久化到文档（注册表 per-session） | ✅ | 注释明示，跨重开经 pluginData 重建 |
| 校验执行纯代码 | ✅ | validate.ts 的 `checkReadonly` + `checkStructure` |
| validate ↔ 视觉一致性分层 | ✅（升级） | 视觉一致性已由 `look` 工具而非 `describe` 承担 |
| 五种 violation：readonly_modified / readonly_deleted / anchor_deleted / anchor_misplaced / section_count | ✅ | 见 §四 |
| 每种 violation 带 `fix` 操作文本 | ✅ | 不是"ask user"占位——具体到 batch_update 模板 |
| 修复前询问用户 | ✅ | 设计意图；用户确认后两条路径 |
| 修复通路 forward-fix：用 batch_update(originalValue) | ✅ | violation 对象的 `originalValue: structuredClone(...)` 直接可用 |
| 修复通路 accept-forward：validate({accept: true}) 重基线 | ✅（范围窄，见 P2） | |

---

## 四、validate 详细评估

### 4.1 检查内容与触发

| 检查项 | 实现位置 | 检查范围 | 力度 |
|---|---|---|---|
| `readonly_modified` | checkReadonly（validate.ts:46-81） | TEXT 节点 fills/text/fontSize/fontWeight；非 TEXT fills | 强 |
| `readonly_deleted` | checkReadonly | 注册表条目对应 nodeId 在 scene 中是否存在 | 强 |
| `anchor_deleted` | checkStructure（validate.ts:83-131） | `state.anchors` 的 instanceId 在 scene 中是否存在 | 强 |
| `anchor_misplaced` | checkStructure | childIds[first] / childIds[last] 匹配 anchor id | 强 |
| `section_count` | checkStructure | `childIds.length - anchorsPresent > maxSections` | **只查上限不查下限**（P1） |
| 跨重开后 baseline | restore.ts:106-110 用 `snapshotReadonlyValues` 重新快照当前值 | baseline 在 reopen 时为"图上当前值"——此后"修改"相对此基准 | 强 |
| 多设计消歧 | getMarketingState + lastActiveAt | 显式 rootFrameId 时单选；省略时取最近活跃 | 强 |
| 用户确认"接受意图" | validate({accept: true}) | 只刷 `readonly_modified`（不刷其他四类，P2） | 中 |

### 4.2 触发路径实测

唯一调用方 = **AI**（受 prompt 引导）。无任何自动 hook：

| 触发点 | 触发方 | 来源 |
|---|---|---|
| 每完成 section 后调 | AI | [system-prompt-marketing.md:175](src/app/ai/chat/system-prompt-marketing.md#L175) |
| Phase 4 启动时调 | AI | [system-prompt-marketing.md:232](src/app/ai/chat/system-prompt-marketing.md#L232) |
| look 怀疑 readonly 时调 | AI | [system-prompt-marketing.md:240](src/app/ai/chat/system-prompt-marketing.md#L240) |
| 测试 | 直接调 | `tests/engine/tools/marketing/validate.test.ts` 五条 |

**没有任何 render/update/setup 副作用会触发 validate**（grep 全部 `validateMarketingDesign` 调用点，0 次非测试调用）。

### 4.3 修复通路

| 场景 | 入口 | 路径 |
|---|---|---|
| 用户说"误改了，恢复" | AI 调 batch_update | violation.originalValue 直接写回（已有专门测试保过：validate.test.ts:132-150） |
| 用户说"是有意修改，接受" | `validate({ accept: true })` | 一次性刷 readonly_modified 类型 baseline |
| 锚点实例被删 | `setup_material_type({ id: sameId })` repair mode（**前提：同 id + 同 rootFrameId**） | `resolveAnchors` 三档（[setup.ts:288-303](packages/core/src/tools/marketing/setup.ts#L288-L303)）：instanceAlive+intact skip / 活着但 damaged → rebuildAnchorInstance / 没了 → materializeAnchor 全量 |
| 锚点位置错位 | AI 调 reorderChild / reparentNode | fix 文本明示，但代码无自动调度 |
| section 超数 | AI 询问用户合并或删除 | fix 文本明示，代码无自动调度 |

实测并不是"只报告不修复"——**修复通路确实存在**（prompt + violation 数据 + accept=true + setup_material_type repair mode），由 AI 作为执行者。

### 4.4 未检查的盲区（按重要性）

| 缺口 | 后果 |
|---|---|
| **minSections 未校验** —— *refactor 落地后此缺口整体消失（min/max 字段删除）* | AI 删光所有 section 不会触发任何 violation |
| **readonly 节点几何/可视属性未快照**（`width/height/visibility/opacity`） | 偷改 logo 尺寸、隐藏 QR 时无 violation |
| **多锚点相对顺序** | 配置可指定多个位置约束，实测只校验 first/last |
| **section 顺序、空 section、几何对齐** | 不报警 |
| **custom 字段符合性** | `featureCount: '3-5个核心卖点'` 等语义字符串无对应校验 |
| **组件定义页被改** | prompt 明文禁止，但代码无"组件定义完整性"校验 |
| **accept=true 范围仅 readonly_modified** | 用户误以为"接受 = 解决所有问题" |

---

## 五、validate 的支撑基础设施（六层）

validate.ts 本体 183 行。为让它在生产里真可用，下面六层缺一不可。

### 5.1 读取侧（validate 读什么）

- `ReadonlyNodeInfo { props, originalValues, anchorInstanceId }` 数据形状（builder.ts:19-24）
- `snapshotReadonlyValues(node)` 物化时 `structuredClone` 深拷贝（builder.ts:159-166）
- `AnchorRecord { templateId, position, componentId, instanceId }`（registry.ts:15-20）
- `MarketingDocumentState` 整体容器（registry.ts:22-31）
- `WeakMap<SceneGraph, ...>` 文档隔离（registry.ts:33）
- `lastActiveAt` 单调时钟 + `getMarketingState(graph, rootFrameId?)` 多设计消歧（registry.ts:35, 65-80）
- `touchMarketingState` 触达刷新（registry.ts:94-97）
- `JSON.stringify` deep-equal（validate.ts:42-44）

### 5.2 写入侧（注册表怎么被填出来）

- `deriveTemplateReadonlyNames`（setup.ts:207-217）
- `collectComponentReadonlyIds`（setup.ts:123-139）
- `registerInstanceReadonly`——`state.readonly` Map **真实填充点**（setup.ts:141-156）
- `materializeAnchor` 全量物化（setup.ts:160-205）
- `rebuildAnchorInstance` 组件存活路径（setup.ts:224-271）
- `resolveAnchors` 三档决策（setup.ts:273-320）
- `setMarketingState` 唯一写入入口（registry.ts:87-92）
- `clearMarketingState`（registry.ts:99-110）
- `findRootFrame` 收养（setup.ts:68-92）

### 5.3 跨重开还原

- pluginData schema `open-pencil-marketing` + role / type / template / position / component 五键（restore.ts:25-32）
- `markMarketingRoot` / `markMarketingAnchor`（restore.ts:59-77）
- `restoreAnchor` 按插件数据重建（restore.ts:93-119）
- `restoreStateFromCanvas` 全图扫描（restore.ts:125-157）
- `ensureRestored` WeakSet 懒恢复（registry.ts:42-47）—— 单测 `tests/engine/tools/marketing/restore.test.ts:51-66` 保过

### 5.4 edits 不被同步静默清零（已实现）

```ts
// instance-overrides.ts:27-45（实测完整 body）
export function recordInstanceOverrides(graph, nodeId, props) {
  const instance = findEnclosingInstance(graph, nodeId)
  if (!instance) return

  const additions: Record<string, unknown> = {}
  for (const prop of props) {
    if (!SYNCED_PROPS.has(prop)) continue                 // 仅写"同步白名单"内的 prop
    additions[nodeId === instance.id ? prop : `${nodeId}:${prop}`] = true
  }
  if (Object.keys(additions).length === 0) return

  graph.updateNode(instance.id, {
    overrides: { ...instance.overrides, ...additions }
  })
}
```

AI 工具侧调用 `recordInstanceOverrides` 的入口（**仅 2 处**）：

| 入口 | 位置 |
|---|---|
| `update_node` 工具 | [`modify/update.ts:96-100`](packages/core/src/tools/modify/update.ts#L96-L100) |
| `batch_update` 工具 | [`structure/batch.ts:142-149`](packages/core/src/tools/structure/batch.ts#L142-L149)（带 `SCENE_PROP_MAP` 做 snake_case ↔ SceneNode field 名映射） |

**注**：UI 属性面板（用户手动编辑实例子节点）经独立的 `propertyOverrides` 函数（[`editor/components/properties.ts:107-114`](packages/core/src/editor/components/properties.ts#L107-L114)）**直接构造** `overrides` map，并不调用 `recordInstanceOverrides`。两条路径**独立、用途不重叠**——AI 工具侧覆盖"AI 改的内容不丢"，UI 侧覆盖"用户 UI 改的内容不丢"。UI 侧暂无针对性回归测试。

fig 同步引擎读出：`fig/src/instance-overrides/symbol/overrides.ts:37-43` + `scene-graph/src/instances.ts:154-160` `if (overrideKey in overrides) continue`。

单测 3 条保过 `recordInstanceOverrides` 路径：`validate.test.ts:69-103`（"batch_update on instance child records override" / "update_node text on instance child records override" / "batch_update outside instances records nothing"）。

### 5.5 violation 数据自洽

每个 violation object 自给自足：AI 修复时不需回去查：
- `nodeId` / `prop`（validate.ts:72-73）→ 精确 batch_update 入口
- `originalValue: structuredClone(...)`（validate.ts:74）→ 直接写回，省去查注册表
- `fix: string` 操作模板（validate.ts:60-129）→ 五种类型各自的步骤

### 5.6 跨域接线

- `validateTool` 注册 `CORE_TOOLS`（registry-core.ts:55）
- `getMarketingState` 从 `tools/index.ts:25` 公开导出——给非营销域识别 marketing root
- `lookTool` 共用 `getMarketingState` + `touchMarketingState`（marketing/look.ts:52-62）
- prompt 三处调用点（L175 / L232 / L240）

---

## 六、当前未自动 / 不能自动的部分

| 项 | 是否自动 | 风险 |
|---|---|---|
| 用户手动改 readonly 节点 | ❌ 仅当 AI 调 validate 才发现 | 用户改了，AI 不知道——持续违规模型直到下次 validate |
| 用户在 Checkpoint 间删锚点 | ❌ 同上 | 下一轮 render 把内容挂孤儿上时才发现 |
| `setup_material_type` 切换/修复后 | ❌ 无自动 revalidate | AI 不主动 validate 的话 baseline 是否对齐没人知 |
| `update_node` / `batchUpdate` 改 readonly 子节点 | ✅（覆盖，但仅这两工具） | 是 |
| render 改实例子节点 | ❌ 未挂 recordInstanceOverrides | 见 §3.3 真问题 |
| AI 完成 section 但忘了 validate | ❌ | prompt 的 "after completing each section" 是 honor-system |
| 文档重开后 | ❌ prompt 不强制第一次操作前 validate | 重设的 baseline 是否与图一致，依赖 AI 复核 |
| 多设计并存 | ❌ prompt 不明示切换时是否 validate | 切换 + 旧违规模型可能混进新状态 |

---

## 七、建议优先级

### P0（必修）

1. **`render` 路径挂 `recordInstanceOverrides`** — 接入点：design-jsx/renderer.ts，在子节点创建/属性写入路径上复用 `instance-overrides.ts:12-19` 的 `findEnclosingInstance` walk-up 逻辑。代价小，影响面窄（仅 instance 子树）。

### P1（强烈建议）

2. **加 minSections 校验** — `validate.ts:122-130` 加 `if (sectionCount < config.structure.minSections)` 分支。10 行代码，覆盖当前大类设计误删问题。
3. **扩 readonly 快照范围** — `builder.ts:160` 数组字面量扩展至 `['fills', 'width', 'height', 'visible', 'opacity']`，对非 TEXT 也一并启用。一行数组扩展，关闭"logo 尺寸被偷改无人知晓"盲区。

### P2（视节奏）

4. **accept=true 范围澄清** — prompt L175 加一句"accept=true 只刷新 readonly_modified 类型基线，不影响其他违规"。可避免用户误解。
5. **prompt 内显式章节提醒** — "完成每个 section 后 N 步内必须调 validate，否则重新描述 root frame"。这是 advisory，不消耗步数。
6. **section_count 包含 minSections 时的反例** — 当 anchor 被删 + minSections 同时不满足时给清晰错误信息（避免边界处混乱）。**注：refactor 落地后该 P2 整体消失（section_count 校验类型被删）**。

### P3（远期）

7. **validate 自动 follow-up**（争议）：是否在 setup_material_type return 后自动 validate 一次，作为修复模式完成度的自检？我倾向**否**——会与"AI 主动调"职责重叠，且制造双向真相源（违规模型可能由 setup 自动报告而 AI 未看到）。保持当前"AI 触发"单一来源更整洁。

---

## 八、与既有评审的关系

- `2026-07-27-agent-design-review.md` 已识别"validate 的'询问用户再修复'语义依赖 AI 自觉，属第二级注入"。本次评审确认：修复通路在数据层面已就绪，但 prompt 是唯一 trigger 入口——上一轮警告仍然有效。
- `2026-07-27-agent-design-review.md` 已识别"注册表键控的地基问题（按 SceneGraph → 按 rootFrame）"。本次确认：键控已切到 rootFrame，多设计并存实测支持（lastActiveAt + 显式 id）。
- `2026-07-29-visual-loop-implementation-review.md` 评审视觉回路（look / media elision）。本次评审资源体系 + validate，与视觉回路无重叠。

---

## 九、附录：测试覆盖

| 文件 | 用例 |
|---|---|
| `tests/engine/tools/marketing/validate.test.ts` | 5 条主流程 + 3 条 overrides 自动记录 |
| `tests/engine/tools/marketing/restore.test.ts` | 重开文档后 validate 可用 |
| `packages/fig/tests/instance-overrides.test.ts` | fig 同步引擎对 overrides 的处理 |

合计约 10 条相关单测保底。覆盖率与 §4.4 盲区对照：

- 已覆盖：`readonly_modified` / `readonly_deleted` / `anchor_deleted` / `anchor_misplaced` 4 类违规的主路径 + overrides 自动记录（AI 工具路径） + 重开还原
- 未覆盖（§4.4 盲区）：minSections 校验、readonly 几何属性快照、多锚点相对顺序、空 section、组件定义完整性 — 上述每条缺口都没有回归单测，等到 P1/P2 修复时需同步补

特别是上面 §5.4 注提到的 UI 路径（`propertyOverrides`）目前 0 条针对性单测，是优先级较低的独立缺口。

---

## 十、评审同行警告（避免再次错判）

| 警告 | 落地 |
|---|---|
| 搜索范围不要只圈 `packages/core/src/tools/marketing/` | 本评审三处自我修正的两处源自搜索范围圈错——markting 与协作域（modify/structure/editor/fig/scene-graph）钩常在外部 |
| "修复前询问用户" ≠ "无修复机制" | prompt 引导 + violation 数据自洽的双层修复通路是显式设计 |
| 实测和"设计文档没写"不矛盾 | 本次发现 `lastActiveAt` / "按 label 收养"等设计没写但已实现——多设计并存是真功能 |
| 不要轻言"prompt 缺失" | grep 一个路径没找到 ≠ 文件不存在；先 `Glob` 全仓再 `Grep` |
| 不要替"用户私有数据"找 pluginData | pluginData 是系统层元数据，用户摸不到；用户主动提供/编辑的数据只能在 plain nodes 上 |

---

## 十一、架构重构方向（讨论存档）

> 本节是评审过程中后续讨论沉淀出来的**重构方向**。不是对现状的实测对照，而是要把上面十节里暴露出的"过度耦合"问题推到正确的分解面。落档待 `plans/` 修订时引用。

### 11.1 当前 schema 的三层耦合问题

`MaterialTypeConfig`（[material-types.ts:42-54](packages/core/src/tools/marketing/material-types.ts#L42-L54)）当前把三个**性质不同**的概念合并：

| 概念 | 性质 | 典型内容 |
|---|---|---|
| **硬约束** | validate 引用，是物理不变量 | size / anchors / structure.anchors（位置） |
| **风格档案** | 软上下文注入 prompt | sectionPlan / styleGuide / custom |
| **参考样例** | 视觉参考、advisory | （schema 里**完全没 slot**） |

后果：换种风格必须改整个 MaterialTypeConfig；用户加 type 必然改代码；"min/maxSections"这种软下限混进了"structural"字段；reference 整层缺位。

### 11.2 三层正交切分

| 维度 | 谁提供 | 存储位置 | 选择权 | 注入方式 |
|---|---|---|---|---|
| **Type** | 代码或库 | Library.fig Types 区 | AI 推断 + CP1 user 确认 | setup_material_type 工具返回 |
| **Profile** | 用户或库 | Library.fig Profiles 区（plain TEXT 节点 = md 内容） | AI 推荐 + CP1 user 切换 | 首次 setup 调用时灌入 system prompt overlay |
| **Reference** | user 主动标记 | Library.fig References 区（plain frame + for:/tag: 子文本） | user opt-in | setup 返回 availableReferences；AI 用 `look` 自取 |

三者职责切开：**type 硬、profile 软、reference advisory**。

### 11.3 七项决策（Q1-Q7）

| # | 议题 | 决定 |
|---|---|---|
| 1 | library 标识是否需要 pluginData？ | **否**——文件位置 + Library Manager（v1 是 dialog）足够 |
| 2 | 单库 + 是否需要读写模式切换？ | **单库；编辑就是正常打开 .fig**，无特殊模式 |
| 3 | `matchKeywords` 字段是否保留？ | **砍掉**——`id + label + description` 够 LLM 推断 |
| 4 | 组件（BrandBar/CTABar）是否进库？ | **是**——四区齐全（Types / Profiles / Components / References） |
| 5 | `MATERIAL_TYPES` 代码种子是否保留？ | **砍掉**——`default-library.fig` ship-with；空库 + custom 兜底 |
| 6 | profile 注入时机？ | **首次 setup_material_type 调用时**入 system prompt overlay；中途切换 = 重 setup |
| 7 | references 多到要拆库？ | **暂不拆**——协议层可拆（按区扫库），v1 同文件 |

### 11.4 Library .fig 的具体形态

```
[Default-library.fig]            ← ship-with，复制到 ~/OpenPencil/Libraries/
└── 顶层 Page
    ├── Types 区
    │   └── wechat_moments
    │       ├── "id: wechat_moments"     ← 子文本节点（字面值）
    │       ├── "label: 朋友圈广告"
    │       ├── "size: 1080x1080"
    │       ├── "anchor_first: "
    │       └── "anchor_last: "
    ├── Profiles 区
    │   └── casual_v1                                ← frame
    │       ├── Text 节点：md 整段内容                ← 一段 plain TEXT，内容即 md
    │       └── Text 节点："applicable_to: wechat_moments, xiaohongshu"
    ├── Components 区
    │   ├── BrandBar       ← 真正 COMPONENT 节点
    │   └── CTABar
    └── References 区
        └── ref-product-long-001
            ├── "for: product_long"
            └── "tag: luxury_v1"
```

- **全部 plain nodes**——只有用户在画布里能直接操作的形态
- `role=library` pluginData 被否决（位置约定已够）
- 用户编辑 = 正常打开 .fig，**无特殊路径**（这是 Q2 的明确决定，避免引入 "Library Editor mode"）

### 11.5 Web-first 实操调整

**问题**：用户主要用 web 版测试，自动扫描本地文件不可行。

**简化方案**：
- marketing session 启动 → 弹 dialog：「拖入 / 选择一个 .fig 作为素材库」/「继续，无库」
- 选定后扫库 + 注入 + 后续行为不变
- 跨会话不持久化（每次重新提交）
- 桌面端可同等使用 dialog；不实现 automatic folder watch
- **编辑库不需要特殊工具**——直接打开 .fig 即可

`custom` 兜底始终可达：用户说"做 1080×1440" → AI 直接 `setup_material_type({ id: "custom", width: 1080, height: 1440 })`，不要求存在预定义 type。

### 11.6 与当前实现的迁移路径

| 现状 | 落到 library 后 |
|---|---|
| `MATERIAL_TYPES` const 数组 | Library.fig Types 区 |
| `listMaterialTypes()` | 扫库 + 合成 |
| `component-templates.ts` BrandBar/CTABar | Library.fig Components 区 |
| `assets.ts` 的 `brand-logo` 内置 base64 | Library.fig 资产 + 内置 fallback |
| profile 待新加 | Library.fig Profiles 区 |
| reference 待新加 | Library.fig References 区 |
| 自动扫描路径 | dialog + 用户提交 |
| `matchKeywords` 字段 | 删（用 label + description） |
| `sectionPlan / styleGuide / custom`（type 内字段） | 删（迁入 profile.md，由 AI 自然语言理解） |
| `min/maxSections` | 删（validate 同步删除 section_count 类型） |

**精简 validate**：section_count 整类删除（min/max 字段也删）；保留 readonly_modified / readonly_deleted / anchor_deleted / anchor_misplaced 四类。

**精简 setup_material_type 返参**：删 bundled sectionPlan/styleGuide/custom；加 availableReferences 列表 + activeProfileId 指针（profile 内容**不进返回值**，由 setup 调用时灌入 system prompt overlay）。

### 11.7 既有建议项的复核

| 既有结论 | 重组后是否仍成立 |
|---|---|
| P0: render 不挂 recordInstanceOverrides | ✅ 仍成立——与库架构独立 |
| P1: 加 minSections 校验 | ❌ **撤销**——min/max 字段整体删除；section_count 校验类型去除 |
| P1: 扩 readonly 快照范围（width/height/visibility/opacity） | ✅ 仍成立 |
| P2: accept=true 范围澄清 | ✅ 仍成立 |
| P2: prompt "after completing each section" hook | ✅ 仍成立 |
| §3.2 "三层映射" 表 | ❌ 修改——library 化后三层职责变 |

### 11.8 阶段路线

| 阶段 | 内容 | 状态 |
|---|---|---|
| **v0.5（本评审封档）** | 现状与重构方向并存于评审文档 | 已完成 |
| **v1 最小可用** | `default-library.fig` 落地；`setup_material_type` 读库；profile md 注入 system prompt；`material-types.ts` 的 `MATERIAL_TYPES` 拆出 | 待启动 |
| **v1.5** | 库按 zone 多文件拆分（references 独立）；跨库 profile id 空间 | 远期 |
| **v2** | IndexedDB / 后端持久化库文件免去 web 重复上传；multi-library 组合 | 远期 |

### 11.9 与品牌包（L3 路线图）的对齐

[docs/plans/l3-workbench.md:41](docs/plans/l3-workbench.md#L41) 提的"品牌规范：一次配置、永久生效"原本是独立概念（按 grep 摘录引用，未直接读取上下文；推断空间有限）。在 Library.fig 形态下：

- 品牌包 = library 中的若干 profile（`brand_acme_official` / `brand_acme_casual` …）
- 库文件可分享 = **品牌包分发**的天然载体
- 概念统一：library 既是**素材库**也是**品牌包**——单一载体

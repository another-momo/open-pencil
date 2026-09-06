# T91a-plan · 节点 ID 稳定性 + Brief 接口合并 + .fig 保留 pluginData

> **任务来源**：owner 实测三个 bug + 仓外 `docs/202609031650-new-intent-plugindata-design.md` + `docs/202609031730-node-id-stability-and-brief-redesign.md` 分析文档
> **关联**：T91b 接续（newIntent pluginData + ChatPanel 拦截 + abort）；本任务只解决 .fig 重导入后 brief/design 双向绑定断裂 + agent 视图歧义两个根因
> **拆分**：T91a 节点 ID 稳定性 + brief 接口合并；T91b newIntent pluginData + ChatPanel 拦截机制（独立 commit）

### 背景与动机

owner 实测发现三个 bug，本任务解决其中两个（bug 1 + bug 2）：

**Bug 1**——.fig 快照恢复后当前设计区状态丢失，无手动恢复路径：

- `import.ts` 通过 `mergePluginData` 把 pluginData 透传到反序列化的节点，但 brief / design 的双向绑定靠的是 **节点 ID**（`generateId()` 生成的 `0:N` 序号），重新导入后 `0:N → 0:M` 全部重生成
- 即使 pluginData 写得很完美，brief.boundDesigns 存的也是旧 ID，对不上新的设计区根框
- 前端没办法手动修复（用户手动输入 UUID 不友好）

**Bug 2**——agent 视图歧义：`readBrief` 返回 `boundDesigns`（authoritative 绑定）+ `designs`（lazy reconciliation view），agent 看到「未注册」状态会以为是 bug 而非正常读侧补显

### 关键事实（Phase 1+2 探查确认）

1. **`sharedPluginData` codec round-trip 实际是通的**：写测试 `tests/engine/io/fig/roundtrip/shared-plugin-data.test.ts`（5/5 pass）验证 `mergePluginData`（export-node.ts:997）+ `extractPluginData`（convert.ts:669）双向透传 OK，原分析文档描述不准确
2. **`generateId()` 跨 graph 实例不唯一**：用 `0:N` 序号；re-import 后节点 ID 全部重生成
3. **`crypto.randomUUID()` 是 `guides.ts:22` 现有先例**：可直接复用作为跨持久化稳定 ID
4. **前端不直接写 sharedPluginData**——所有写入都走 core 工具，所以 UUID 写入只能在 core 工具里做

### 方案概览

#### 1. UUID 唯一标识符

新增 helper：
- `BRIEF_UNIQUE_ID_KEY = 'uniqueId'` / `DESIGN_UNIQUE_ID_KEY = 'uniqueId'`
- `generatePluginUniqueId()` — 包装 `crypto.randomUUID()`
- `getBriefUniqueId(node)` / `getDesignUniqueId(node)` — 读侧容错（缺键返空串）
- `setBriefUniqueId(graph, nodeId, uuid)` / `setDesignUniqueId(graph, nodeId, uuid)` — 写侧
- `findBriefByUniqueId(figma, uuid)` / `findDesignByUniqueId(figma, uuid)` — UUID → 节点
- `findBriefByUniqueIdViaGraph(graph, uuid)` — `scanMarketingDesigns` 路径无需 figma 句柄

写入触发：每次 `createBrief` / `setupDesign` / `bindBriefToDesign` 都会保证对应节点写有 UUID；老节点靠读侧容错（空串）+ 懒补机制兼容

#### 2. Brief 接口合并

- 删 `BriefView.boundDesigns: string[]` 字段
- 新增 `BriefView.uniqueId: string`（brief 自身的稳定 UUID）
- `BriefDesignEntryView` 增加 `uniqueId: string`（对应 design 的稳定 UUID）
- `readDesigns` 重写：dedupe 键从 `designId` 改为 `uniqueId`（同时记 uniqueId + node id，应对老 design 无 UUID 的迁移过渡期）；design→brief 反向指针匹配也走 UUID（UUID 缺时退回 node id 兼容）

#### 3. UUID 路径穿透 snapshot + check

- `snapshotDesignRoot` / `snapshotBriefLink` 都加 `uniqueId` 字段
- `snapshotDesignRoot` 的 `briefId` 字段：原 pluginData 存 UUID → 解析为 brief 节点 id 后再返（view-model 对调用方暴露节点 id 更合用；老文档残留 node id 兼容 fallback）
- `scanMarketingDesigns` 的 `toDesignRef` 同处理（UUID → 节点 id 翻写）
- `checkActiveDesignCandidate` 的双向一致判定：design 有 UUID 时比 UUID，无 UUID 时退回节点 id（保证纯函数测试不写 uniqueId 也能跑）

#### 4. setup_design DESIGN_BRIEF_KEY 改写 UUID

- 原 `setDesignMarker(graph, root.id, DESIGN_BRIEF_KEY, brief.id)` 改为 `getBriefUniqueId(brief) || brief.id`
- `activeDesign.ts` 的 `snapshotBriefLink` 先按 UUID 解析再退回 node id

### 改动清单（约 6 文件）

#### 代码（4 改）

| 文件 | 改动 |
|---|---|
| `packages/core/src/tools/fork/marketing/brief.ts` | 加 UUID 基础设施（`BRIEF_UNIQUE_ID_KEY` / `DESIGN_UNIQUE_ID_KEY` / `generatePluginUniqueId` / `getBriefUniqueId` / `getDesignUniqueId` / `setBriefUniqueId` / `setDesignUniqueId` / `findBriefByUniqueId` / `findDesignByUniqueId` / `findBriefByUniqueIdViaGraph`）；`createBrief` 写 uniqueId；`bindBriefToDesign` 改 UUID 寻址 |
| `packages/core/src/tools/fork/marketing/brief-edit.ts` | 删 `boundDesigns` 字段；`readBrief` 返 `uniqueId`；`designs` 每条加 `uniqueId`；`readDesigns` 重新组织（UUID 优先 dedupe + 兜底 node id） |
| `packages/core/src/tools/fork/marketing/setup.ts` | `setupDesign` 写 uniqueId 到 design 根；`DESIGN_BRIEF_KEY` 写 brief 的 UUID；`scanMarketingDesigns` 的 `toDesignRef` 翻 UUID → 节点 id |
| `packages/core/src/tools/fork/marketing/active-design.ts` | `DesignRootSnapshot` 加 `uniqueId`；`snapshotDesignRoot` 翻 UUID → 节点 id；`snapshotBriefLink` 先 UUID 后 node id；`checkActiveDesignCandidate` 双向一致判定走 UUID 优先 |

#### 测试（3 改/建）

| 文件 | 改动 |
|---|---|
| `tests/engine/io/fig/roundtrip/shared-plugin-data.test.ts` | 新建——三 namespace × 三种 key 的 setSharedPluginData round-trip 验证（5/5 pass，证明 codec 通） |
| `tests/engine/rebuild/marketing/brief.test.ts` | 更新——`bindBriefToDesign` 测试改用真实设计节点 + 按 UUID 断言；`关联设计区` `toEqual` 加 `uniqueId` 字段 |
| `tests/engine/rebuild/marketing/setup.test.ts` | 更新——`标记五键读穿` 断言 `DESIGN_BRIEF_KEY` 是 UUID + 配对 brief UUID；`关联设计区` `toEqual` 加 `uniqueId` 字段 |
| `tests/engine/rebuild/marketing/active-design.test.ts` | 更新——`通过路径` 断言 `briefBoundDesignIds` 含 design 的 UUID；纯函数单源测试不动（`uniqueId ?? ''` 兜底） |

### 验收

- 七门禁全绿（T91a 触碰文件 lint 局部）
- 引擎测试：marketing 套件 229/229 全绿；engine tests 无引入回归（CLI / canvaskit / window 等预存基础设施失败与 T91a 无关）
- round-trip 测试先写先跑：若 codec 真坏则需补 codec 修复（本任务实测 codec 通的，不需修复）
- 端到端真值：capabilities ON → createBrief → setup_design → bindBriefToDesign → 保存 .fig → 重新 import → brief.uniqueId 和 design.uniqueId 一致，bind 关系仍生效

### 风险与边界

- **前端不能写 sharedPluginData**——T91b 的 ChatPanel 拦截 + abort 路径需要调一个新的 server endpoint（`POST /api/pi/intent-confirm` 之类），由 core 工具写 pluginData。T91a 不引入新 endpoint，留给 T91b
- **activeDesignNodeId 保留 node id**——它是「单槽指针」语义，与 brief/design UUID 寻址不冲突，不动
- **老文档残留 node id 兼容**：`DESIGN_BRIEF_KEY` 老值是 node id、`boundDesigns` 老值是 node id —— T91a 全部走「UUID 优先 + node id 兜底」策略，不会破老文档
- **brief `uniqueId` 老文档缺失**：`findBriefByUniqueId` 找不到时返 undefined → `snapshotBriefLink` 退回 `graph.getNode(briefId)` → 走原 node id 路径，干净 fallback
- **UUID 写到 setSharedPluginData 不需要 prefix**——`BRIEF_PLUGIN_NAMESPACE` 已在调用侧固定，键面无冲突

### 不修

- activeDesignNodeId 的 round-trip——T60-plan §2 已定谳「刷新丢映射是已知边界」
- T91b（newIntent pluginData + ChatPanel 拦截）——下一 commit
- node-change codec 的其他字段

### 下一步

T91a 完成后，下一 commit T91b 接续：
- 新增 pluginData 键 `newIntentModeId` / `newIntentProfileId` / `newIntentConfirmed`（文档根）
- `setup_design` 检查 `newIntentConfirmed`；false 时返 `{ status: 'awaiting_new_intent_confirmation', proposed, catalog }`
- `ChatPanel` 拦截 `awaiting_new_intent_confirmation` → 显示确认卡 + `abort(sessionId)`
- 新增 `POST /api/pi/intent-confirm` endpoint 写 pluginData
- 确认 → 写入 → AI 再次调用 setup_design → 通过
- `assembleTurn` 优先读 newIntent pluginData（时序错位修复）
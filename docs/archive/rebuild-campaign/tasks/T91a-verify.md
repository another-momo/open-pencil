# T91a-verify · 节点 ID 稳定性 + Brief 接口合并 + .fig 保留 pluginData（验收对照 + 端到端真值再生）

> **状态**：✅ 已完成 | **时间**：2026-09-03
> **关联**：T91b 接续（newIntent pluginData + ChatPanel 拦截 + abort）；本任务只解决 .fig 重导入后 brief/design 双向绑定断裂 + agent 视图歧义两个根因

## 验收对照

| 项 | 计划 | 实测 | 通过 |
| --- | --- | --- | --- |
| UUID 基础设施 9 helper | brief.ts 新增 9 个 UUID 辅助函数 | grep `BRIEF_UNIQUE_ID_KEY` / `DESIGN_UNIQUE_ID_KEY` / `generatePluginUniqueId` / `getBriefUniqueId` / `getDesignUniqueId` / `setBriefUniqueId` / `setDesignUniqueId` / `findBriefByUniqueId` / `findBriefByUniqueIdViaGraph` 全数就位 | ✅ |
| createBrief 写 uniqueId | 每次 createBrief 都给新 brief 写 UUID | brief.ts:502 `setBriefUniqueId(graph, brief.id, generatePluginUniqueId())` 落 | ✅ |
| setupDesign 写 design uniqueId + DESIGN_BRIEF_KEY 改 UUID | 三元组 + 双向绑定都用 UUID | setup.ts:338-341 改写 `DESIGN_BRIEF_KEY = getBriefUniqueId(brief) \|\| brief.id`；`setDesignUniqueId(graph, root.id, generatePluginUniqueId())` 紧随其后 | ✅ |
| bindBriefToDesign 改 UUID 寻址 | 不再用 node id 累加 | brief.ts:238-241 `getDesignUniqueId` 取 UUID，UUID 缺则 `generatePluginUniqueId()` 懒补；累加列表存 UUID 序列化的字符串 | ✅ |
| brief-edit 删 boundDesigns + designs 加 uniqueId | view-model 合并 | brief-edit.ts:95-112 BriefView 已无 boundDesigns，新增 uniqueId；BriefDesignEntryView:75-92 加 uniqueId 字段 | ✅ |
| readDesigns 重新组织：UUID 优先 dedupe + 兜底 node id | dedupe 键换 uniqueId | brief-edit.ts:222-282 `seenUniqueIds` + `seenNodeIds` 双 dedupe，design→brief 指针匹配走 UUID（缺时退回 node id） | ✅ |
| scanMarketingDesigns 翻 UUID → 节点 id | view-model 暴露节点 id | setup.ts:380-388 `toDesignRef(graph, node)` 调 `findBriefByUniqueIdViaGraph` 翻 UUID | ✅ |
| snapshotDesignRoot 翻 UUID → 节点 id | view-model 暴露节点 id | active-design.ts:116-130 `snapshotDesignRoot` 用 `findBriefByUniqueId(figma, rawBriefId)` 翻 UUID，老值兜底 | ✅ |
| snapshotBriefLink 先 UUID 后 node id | 双格式兼容 | active-design.ts:131-141 先 `findBriefByUniqueId` 再 `graph.getNode` | ✅ |
| checkActiveDesignCandidate 双向一致判定 UUID 优先 | 纯函数兼容 uniqueId 缺省 | active-design.ts:198-209 `design.uniqueId ?? ''` 兜底 | ✅ |
| shared-plugin-data round-trip 5/5 | 验证 codec 透传 OK | `bun test tests/engine/io/fig/roundtrip/shared-plugin-data.test.ts` → 5 pass | ✅ |
| 营销套件 0 回归 | brief / setup / active-design 全绿 | `bun test tests/engine/rebuild/marketing/` → 229 pass / 0 fail | ✅ |
| 全量 engine 不引入新失败 | 触碰文件外 0 回归 | `bun test tests/engine/rebuild/marketing tests/engine/io` → 338 pass / 0 fail（CLI / canvaskit / window 等预存基础设施失败与 T91a 无关，基线对比无新增） | ✅ |

## 端到端真值再生

dev server 起动后（capabilities ON）：

1. **创建 brief** → 浏览器控制台 0 报错；`figma.graph.getNode(briefId).sharedPluginData['open-pencil-marketing']` 含 `uniqueId` 字段为 UUID v4
2. **setup_design** → design 根同 namespace 含 `uniqueId` + `DESIGN_BRIEF_KEY`（UUID，**非** brief 节点 id）+ `bound-designs` 拼接含 design UUID
3. **保存 .fig → 重新 import**（手动 export .fig 文件 → OpenPencil Import）→ brief 与 design 节点 id 全部重生成（`0:N → 0:M`），但 `uniqueId` 跨重导入保持 → `findBriefByUniqueId` / `findDesignByUniqueId` 仍能反向找到原 brief / design → `boundDesigns.includes(designUuid)` 双向绑定检查通过
4. **agent 视图**：`readBrief` 返 `designs: [{uniqueId, designId, registered: true/false}]`，不再有 `boundDesigns` vs `designs` 歧义；老节点 `uniqueId === ''` 时走 lazy reconciliation 路径仍正确
5. **set_active_design**：传入 design UUID → `snapshotDesignRoot` 翻 UUID → 节点 id 走原判定；`check.ok === true` 通过

## 关键事实复盘

1. **sharedPluginData codec 实际是通的**——本任务 Phase 1 写的 5 例 round-trip 测试全部通过，原分析文档描述不准确（pluginData 透传 OK，问题在节点 ID 稳定性）
2. **`generateId()` 跨 graph 实例不唯一**——re-import 后所有 `0:N` 序号重生成
3. **`crypto.randomUUID()` 是唯一可用的跨持久化稳定 ID**——`guides.ts:22` 已有先例，直接复用
4. **UUID 写入只能由 core 工具完成**——前端 Vue 组件不能直写 pluginData
6. **view-model `briefId` 保留节点 id 形态**——更合用（UI / 跨 API 拼装 / 测试断言都用节点 id），pluginData 层 UUID ↔ view 层节点 id 转换在 snapshot 阶段完成

## 待 T91b 接续

- newIntent pluginData 机制（`newIntentModeId` / `newIntentProfileId` / `newIntentConfirmed` 三键）
- `setup_design` 检查 `newIntentConfirmed` 返 `awaiting_new_intent_confirmation` 信封
- `ChatPanel` 拦截 + `abort(sessionId)` + 新 server endpoint `POST /api/pi/intent-confirm`
- `assembleTurn` 优先读 newIntent pluginData 修复时序错位
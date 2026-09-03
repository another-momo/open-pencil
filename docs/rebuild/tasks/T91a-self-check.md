# T91a-self-check · 节点 ID 稳定性 + Brief 接口合并 + .fig 保留 pluginData（七门禁 + 测试钉扎）

> **状态**：✅ 完成 | **时间**：2026-09-03
> **任务来源**：owner 实测三个 bug + 仓外 `docs/202609031650-new-intent-plugindata-design.md` + `docs/202609031730-node-id-stability-and-brief-redesign.md` 分析文档
> **关联**：T91b 接续（newIntent pluginData + ChatPanel 拦截 + abort）；本任务只解决 .fig 重导入后 brief/design 双向绑定断裂 + agent 视图歧义两个根因

## 1. 改动文件清单

### 代码（4 改）

| 文件 | 改动 |
|---|---|
| `packages/core/src/tools/fork/marketing/brief.ts` | 加 UUID 基础设施 9 个 helper（key 常量、generate / get / set、findByUniqueId / ViaGraph）；`createBrief` 写 uniqueId（line 502）；`bindBriefToDesign` 改 UUID 寻址（line 238-241） |
| `packages/core/src/tools/fork/marketing/brief-edit.ts` | 删 `BriefView.boundDesigns` 字段（line 95-112）；`BriefDesignEntryView.uniqueId` 新增；`readDesigns` 重新组织：UUID 优先 dedupe + 兜底 node id（line 222-282）；`readBrief` 返 brief.uniqueId |
| `packages/core/src/tools/fork/marketing/setup.ts` | `setupDesign` 写 design uniqueId（line 341）；`DESIGN_BRIEF_KEY` 改写 brief UUID（line 338）；`toDesignRef` 翻 UUID → 节点 id（line 380-388）；`scanMarketingDesigns` / `resolveMarketingDesign` 用新 `toDesignRef(graph, node)` 签名 |
| `packages/core/src/tools/fork/marketing/active-design.ts` | `DesignRootSnapshot.uniqueId` 新增；`snapshotDesignRoot` 翻 UUID → 节点 id（line 116-130）；`snapshotBriefLink` 先 UUID 后 node id（line 131-141）；`checkActiveDesignCandidate` 双向一致判定走 `uniqueId ?? ''` 兜底（line 198-209） |

### 测试（4 改/建）

| 文件 | 改动 |
|---|---|
| `tests/engine/io/fig/roundtrip/shared-plugin-data.test.ts` | 新建——5 例钉死 codec sharedPluginData round-trip（`mergePluginData` + `extractPluginData` 透传 OK） |
| `tests/engine/rebuild/marketing/brief.test.ts` | `bindBriefToDesign` 走真实 design 节点 + 按 UUID 断言；`关联设计区` `toEqual` 加 `uniqueId` 字段；加 `getDesignUniqueId` import |
| `tests/engine/rebuild/marketing/setup.test.ts` | `③ 标记五键读穿` 断言 `DESIGN_BRIEF_KEY` 是 UUID + 配对 brief UUID；`⑨ 关联设计区登记` `toEqual` 加 `uniqueId` 字段 |
| `tests/engine/rebuild/marketing/active-design.test.ts` | `通过路径` 断言 `briefBoundDesignIds` 含 design 的 UUID（`getSharedPluginData` 读 `uniqueId` 键） |

### 治理（4 改/建）

| 文件 | 内容 |
|---|---|
| `docs/rebuild/tasks/T91a-plan.md` | 新建 |
| `docs/rebuild/tasks/T91a-self-check.md` | 新建（本文件） |
| `docs/rebuild/tasks/T91a-verify.md` | 新建 |
| `docs/rebuild/tasks/_index.md` | 追加 T91a 行 |
| `docs/rebuild/tracker.md` | 追加 T91a 行 |

## 2. 关键决策与发现

### 决策 1：UUID 写入在 core 工具里做，前端不能直接写

- sharedPluginData 写入需要走 figma-api proxy 通过 bridge，前端 Vue 组件不能直写
- 所有写入统一在 `createBrief` / `setupDesign` / `bindBriefToDesign` 完成，老节点靠读侧容错（缺键返空串）

### 决策 2：view-model `briefId` 字段保留节点 id 形态

- 原 pluginData 存 UUID 是为跨持久化稳定；view-model 对调用方暴露节点 id 更合用（UI / 跨 API 拼装 / 测试断言都用节点 id）
- `snapshotDesignRoot` / `toDesignRef` / `snapshotBriefLink` 全部做 UUID → 节点 id 翻写，老文档残留 node id 兼容 fallback
- `briefBoundDesignIds` 内部仍然存 UUID（绑定协议稳定键），但 `briefBoundDesignIds` 的 view 层 `boundDesigns` 字段已删除（合并进 `designs`）

### 决策 3：check 纯函数兼容 uniqueId 缺省

- `checkActiveDesignCandidate` 纯函数测试构造数据不写 `uniqueId` 字段 → `uniqueId` 是 `undefined` 而非空串
- `design.uniqueId ?? ''` 兜底让 fallback 路径正常；`boundDesignIds.includes(design.nodeId)` 在缺 uniqueId 时直接走原判定

### 决策 4：brief.ts 复用 `briefMarker` 单源

- `BRIEF_UNIQUE_ID_KEY` 和 `DESIGN_UNIQUE_ID_KEY` 共用 `'uniqueId'` 键名（namespace 已分），但走 `setBriefMarker` / `briefMarker` 单源读写面，避免插件数据散落各 stub

## 3. 已知边界与待 T91b 接续

- **activeDesignNodeId 跨 .fig 刷新**：T60 已定谳「丢映射是已知边界」，不动
- **newIntent pluginData 机制**：T91b 引入（T91a 不动）
- **前端 ChatPanel abort 拦截**：T91b 引入
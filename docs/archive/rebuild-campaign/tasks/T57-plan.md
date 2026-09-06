<!--
  写作纪律（改本文前必读）：
  - 事实性声明必须附核验命令 + 日期，否则标为【假设】
  - 本文只保留当前态，不保留修正历史
  - 详细规则见 docs/rebuild/05-process.md §4
-->

# T57 计划 · Phase 3 W2/T-B6：prepare_hero_scaffold 移植（标题前置克隆源 + 几何记录写入/校验）

> **状态**：✅ 已完成（2026-09-01 收口） | **时间**：2026-09-01 立项 | **负责人**：主 agent + 实现 subagent
> **规格真源**：[S3-tool-contracts-spec.md §7/§8/§9/§10](../../../doc/S3-tool-contracts-spec.md)、[S1-product-spec.md §3](../../../doc/S1-product-spec.md) 阶段 2、S4-phase3-plan.md T-B6 行
> **移植源**：`open-pencil` 仓 feature/agent-backend @ 5d38aa4e（T52 立项时实测 2026-08-31）：packages/core/src/tools/marketing/prepare-hero-scaffold.ts（221 行）+ hero-slot.ts（54 行）、tests/engine/tools/marketing/prepare-hero-scaffold.test.ts（320 行）
> **调研在案**：2026-09-01 Explore agent 产出（行号证据见下）

## 1. 背景与方案

移植旧 hero 脚手架工具进 fork 工具层，带两条契约修订（S3 §7 L100-104）：克隆源从「骨架期 HeroContent」改为**标题前置版式**（15 册 D.1，解锁「骨架未存在」缺口——S1 §3 L58-60：标题在 CP1 锁定并先于骨架渲染）；几何参数（UNDERLAP_PX/TRANSITION_ZONE_PX）由 agent 按 profile 语境定值、core 默认 100/100 兜底、**写入校验钳制**、落 scaffold 节点 pluginData 几何记录，下游（T58 compose_backdrop）一律读记录不收散参（S3 §8 L111：缺记录 = 结构化报错引导回 scaffold，跳步 = 显式失败）。

**关键设计定谳**（调研开放项裁决）：

1. **签名钉死**：`prepare_hero_scaffold({ root_id, source_node_id, underlap_px?, transition_zone_px? })`——克隆源**显式传 id**（AI 刚渲染的标题版式节点），不扫描不猜测；`root_id` 保留做结构校验（FRAME + layoutMode≠NONE，旧 `requireAutoLayoutRootFrame` hero-slot.ts:40-54 移植）；**不依赖 T53 的 marketing-root 标记**（同波次解耦）。`hero_bleed` 更名 `underlap_px`，无别名。
2. **几何**：`width = source.width`；`height = source.height + underlap_px`；位置 = `findPlacementPosition(figma, {width,height})`（fork/placement.ts:43-48，页面级统一，S3 §9 L124——取代旧 root 右侧 +100 内联逻辑，旧 prepare-hero-scaffold.ts:110-117）。
3. **scaffold 本体**（保留旧语义，旧 upsertScaffold :160-179）：页面级兄弟帧，名 `Hero生成参考`（HERO_TEXTS 外置），layoutMode NONE + clipsContent + 白底；**幂等 upsert**（按名寻址）；重调 = 更新几何 + 重克隆 + **保留既有 IMAGE fill**，否则重置白底。
4. **克隆**：清空 scaffold children → 逐 source child `graph.cloneTree(childId, scaffold.id, { layoutPositioning: 'ABSOLUTE' })`（cloneTree 存在于 packages/scene-graph/src/index.ts:559-578，2026-09-01 实测），x/y 原样拷贝（旧 recloneChildren :188-198）。
5. **几何记录**：pluginData namespace `'open-pencil-marketing'`（复用 `BRIEF_PLUGIN_NAMESPACE`，brief.ts:36）+ key `'hero-geometry'`，值 = JSON `{width, height, underlapPx, transitionZonePx}`（width/height = scaffold 全尺寸，T58 据此推 slot = height − underlapPx）。同文件导出 `readHeroGeometry(graph, node): HeroGeometry | null` 供 T58 消费——**缺记录返回 null，不静默默认**（T58 侧转结构化报错）。
6. **写入校验钳制**（钉死行为）：`underlap_px` 缺省 100，须有限 ≥0 ≤1000（比照旧 `validateHeroBleed` hero-slot.ts:25-33）；`transition_zone_px` 缺省 100，须有限 ≥0；**transition > underlap → 钳到 underlap** 且结果带 `clamped: true`（不报错）；非有限/负值 → `{ error, message }` 结构化返回。
7. **note 三分解体**（S3 §7 L104）：旧 `buildNote`（:200-221）写死 generate_image→compose_backdrop 指令链，**删除不移植**；新信封只带事实 note（克隆源 id/克隆子节点数/是否钳制）。信封：`{ scaffold_id, width, height, underlap_px, transition_zone_px, clamped, cloned_children, note }`。
8. **source 校验**：存在 + FRAME + ≥1 child，否则结构化错误引导先渲染标题（取代旧「HeroContent missing」路径，旧 :103-108）。
9. **i18n**：HERO_TEXTS 以导出常量放 hero-scaffold.ts 顶部（**不进 texts.ts**——texts.ts 本波次归 T53 独占，避免并行撞车；外置纪律不变）。

**文件布局**（全部落 ownedRoots，zones.json 零登记）：

| 文件 | 内容 |
|---|---|
| packages/core/src/tools/fork/marketing/hero-scaffold.ts | scaffold 建造/upsert/重克隆 + 几何记录读写校验 + HERO_TEXTS + `readHeroGeometry` |
| packages/core/src/tools/fork/marketing/hero-tools.ts | `prepareHeroScaffoldTool` ToolDef + `HERO_TOOLS` 数组（不进 FORK_TOOLS——冻结面） |
| tests/engine/rebuild/marketing/prepare-hero-scaffold.test.ts | 契约测试（S3 §10 L139 改写版） |

steiger 前缀预算：marketing/ 下 hero×2（scaffold/tools）、setup×2（T53）、brief×3 既有——均 <3 阈值加新建后不越线（brief 已有 3 件但属既有合规态，新增不带 brief 前缀）。

**接线冻结纪律**：`fork/marketing/index.ts`、`fork/index.ts`（FORK_TOOLS）由主 agent 集成；实现 agent 只交付 `HERO_TOOLS` + core，不碰这两个文件、不碰 zones.json/tracker/_index、禁止 commit/push。

## 2. 不做清单

- compose_backdrop（T58，消费几何记录）；marketing-root 标记校验（T53 职责，解耦）；derive_palette/sample_color/hero-slot 旧寻址语义（不移植）。
- 外部来源（用户上传图）分支的几何记录（S3 §8 L114 明示不适用）。
- 标题版式由谁渲染 = workflow 纪律（T-C2），本工具只认显式 source_node_id。

## 3. 验收标准

1. `bun test tests/engine/rebuild/marketing/prepare-hero-scaffold.test.ts` 全绿：①无骨架可克隆（标题前置源直接成 scaffold）；②几何记录写入四字段 + 读回；③钳制断言（transition>underlap → clamp+clamped:true；缺省 100/100；非有限/负 → error）；④幂等 upsert（重调保 scaffold id + 更新记录 + 重克隆）；⑤IMAGE fill 保留；⑥findPlacementPosition 集成（页面 bounds 右 +100/y 跟随/空页原点）；⑦source/root 校验错误路径；⑧信封字段钉扎（无指令链 note）。
2. 旧测试拓扑平移项：validation/geometry/idempotency/params 组（假 figma 换 `setupToolTest()` 真 SceneGraph+FigmaAPI，tests/helpers/tools.ts:17-22 先例）。
3. `bun test tests/engine/rebuild/` 全绿（既有基线不回退）。
4. 九门禁全绿；CI 逐 push 口径绿。

## 4. 红线

- schema.ts 不改；几何记录键名 `'hero-geometry'` 钉死（T58 硬依赖）；缺记录不静默默认。
- 中文文案外置 zh-cn；scaffold 显示名保留 `Hero生成参考`。
- 不移植旧 SCAFFOLD_GAP 定位、buildNote 指令链、registry/derive-palette 邻件。
- 并行波次纪律：禁止 commit/push、禁止碰 fork/index.ts、fork/marketing/index.ts、texts.ts、zones.json/tracker/_index。

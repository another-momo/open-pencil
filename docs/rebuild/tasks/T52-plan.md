<!--
  写作纪律（改本文前必读）：
  - 事实性声明必须附核验命令 + 日期，否则标为【假设】
  - 本文只保留当前态，不保留修正历史
  - 详细规则见 docs/rebuild/05-process.md §4
-->

# T52 计划 · Phase 3 W2/T-B1：brief 四区改造 + 三件套移植 + 放置统一策略

> **状态**：✅ 已完成（2026-09-01 收口） | **时间**：2026-08-31 立项 | **负责人**：主 agent + 实现 subagent
> **规格真源**：[S3-tool-contracts-spec.md §3/§9/§10](../../../doc/S3-tool-contracts-spec.md)（2026-08-31 含 tombstone 同步）、[S4-phase3-plan.md §4](../../../doc/S4-phase3-plan.md) T-B1 行
> **移植源**：`open-pencil` 仓 feature/agent-backend @ 5d38aa4e（`git -C ../open-pencil log -1 --format=%H` 实测 2026-08-31）：packages/core/src/tools/marketing/brief.ts（709 行）、brief-edit.ts（156 行）、tools/marketing.ts（ToolDef 面）、tests/engine/tools/marketing/brief{,-edit,-tools}.test.ts

## 1. 背景与方案

W2 首任务。把旧营销 brief 三件套（create_brief / read_brief / append_brief_conclusion）按 S3 §3 契约移植进 rebuild 架构，并完成四区改造。调研蓝图已核实（2026-08-31 Explore agent 产出，行号证据在案）：

**调研修正两条（相对任务背景口径）**：

1. 源仓与目标仓均**不存在** `findPlacementPosition`（双仓 grep 零命中，2026-08-31）；源实现实为 brief.ts 内 `resolveBriefPlacement`（居中试放→碰撞右移，brief.ts:182-193）。本任务按 S3 §9 语义**新建**共享助手：读页面顶层 bounds → 右侧 +100、y 跟随 bounds 顶；空页 → (0,0)。`scrollAndZoomIntoView` 目标仓已有（packages/core/src/figma-api/index.ts:497-518，与源仓逐行一致）。
2. 源仓 registry.ts（WeakMap+clock）**不移植**（S3 §1 已定谳删除）；「活跃设计」在 T60（T-B9）active_design 落地前不存在，本任务解析序改为：**显式 briefId 参数 > 当前页唯一 brief > 歧义报错**——杜绝源仓 findBrief 静默落「当前页第一个」的不对称兜底（brief.ts:155 实证）。

**文件布局**（全部落 ownedRoots，zones.json 零登记——`tools/zone-registry/zones.json` ownedRoots 实测含 `packages/core/src/tools/fork/`、`tests/engine/rebuild/`，2026-08-31）：

| 文件 | 内容 |
|---|---|
| packages/core/src/tools/fork/placement.ts | 共享 `findPlacementPosition(figma, {width,height})`（T53/T54/T57 复用） |
| packages/core/src/tools/fork/marketing/brief.ts | 标记常量 + 结构建造 + 读写助手（四区、zone 标记寻址、schemaVersion、绑定、结论分组、素材条目、惰性调和 tombstone） |
| packages/core/src/tools/fork/marketing/brief-edit.ts | 面板读写纯函数（readBrief/updateBriefContent/updateMaterialCaption/removeBriefMaterial），结构破坏 read-as-null |
| packages/core/src/tools/fork/marketing/tools.ts | 三件 ToolDef（create_brief/read_brief/append_brief_conclusion） |
| packages/core/src/tools/fork/marketing/texts.ts | 画布中文文案外置（zh-cn 内容语言，外置≠英文化） |
| packages/core/src/tools/fork/marketing/index.ts | `BRIEF_TOOLS` 导出 |
| tests/engine/rebuild/marketing/{brief,brief-edit,brief-tools,placement}.test.ts | 契约测试（S3 §10 改写口径） |

**关键设计定谳**：

- **pluginData 走通用 shared 面**：标记用 `get/setSharedPluginData(graph, node, 'open-pencil-marketing', key, value)`（packages/core/src/figma-api/plugin-data.ts:62-82 实测在案）——即 S3 §3「bindBriefToDesign 改走通用 upsert」的落点；读侧 `matchesSharedPluginData` 兼容旧非编码格式（plugin-data.ts:21-26），.fig 旧档可读。
- **四区结构**：内容区 / 素材区 / AI 结论区 / **关联设计区（新建）**。关联设计区条目 = 设计 id 权威 + 名称/mode/type 投影（读穿设计根 pluginData 四元组——T53 才写入，本任务读侧容错缺省「—」）。
- **zone 标记寻址**：区节点携带 pluginData zone 键（`content`/`materials`/`conclusions`/`designs`），寻址一律读标记；中文显示名仅作展示，读侧保留 name 兜底以兼容旧档。根节点 `schemaVersion: 1`。
- **歧义防护补齐**：read_brief/append_brief_conclusion 增加可选 `briefId` 参数；无参数且当前页多 brief → `{brief:null, ambiguous:true, candidates}`（read）/ `{ok:false, ambiguous:true, candidates}`（append），不再静默取第一个。
- **惰性调和 tombstone**（v7 删除边界态，S3 §3 已同步 2026-08-31）：关联设计区条目指向的设计已死 → 条目标注「（已删除）」保痕，不物理清除；design→brief 指针有而条目缺 → 补写（T53 写入指针后生效，本任务读侧预留）。
- **append 按设计归组**：每条结论带设计归属（名称 + id），存储侧不分区、读取侧过滤（S1 §5）。
- **字体治理**：`BRIEF_FONT_FAMILY` 单一命名常量 + 钉扎测试断言 `fontRegistryEntry('Alibaba PuHuiTi')` 在册（packages/core/src/text/font/registry.ts:59 实测已在册，T39 登记 T1）。
- **素材条目**：暴露 `imageNodeId`（look 直接看图的数据源）；IMAGE fill；EmptyHint 隐藏纪律随迁。
- **创建后 `scrollAndZoomIntoView`**（figma-api 既有）。

**接线冻结纪律**（并行波次约定）：`fork/index.ts` 的 FORK_TOOLS 列表与 `pi-backend/tools.ts` 的 AI 暴露面由主 agent 集成时统一接线，实现 agent 只交付 `BRIEF_TOOLS` 数组，不碰这两个文件。

## 2. 不做清单

- 活跃设计/registry 语义（T60 落地）；setup_design 与设计身份四元组写入（T53）；brief 面板 UI（T61）；undo burst（T59）。
- derive_palette / sample_hero_color / registry.ts / restore.ts 不移植（S3 §1 废弃/删除在案）。

## 3. 验收标准

1. `bun test tests/engine/rebuild/marketing/` 全绿：四区结构断言（关联设计区新建 + mode/type 投影读穿）、zone 标记寻址（改名显示名后仍可读写）、schemaVersion=1、逐字转录、幂等 `{created:false}`、歧义防护（read/append 双路）、tombstone 保痕、素材 imageNodeId 暴露、放置右+100/y 跟随/空页原点、scrollAndZoomIntoView 调用、字体注册表钉扎。
2. 旧三测试断言契约保留项全数平移（S3 §10：逐字转录/幂等/歧义/结构破坏 read-as-null/结论保序）。
3. `bun test tests/engine/rebuild/` 全绿（含既有 studio 等套件不回退）。
4. 九门禁全绿（lint/typecheck/format/check:arch/check:zones/check:tasks/check:bindings/test:type-shapes/check:i18n——以 `package.json` scripts 实测清单为准），全量回归失败数不增（对照 T51 收口基线）。
5. CI 逐 push 口径绿（`check:tasks --base HEAD~1`、`check:bindings --base HEAD~1` exit 0）。

## 4. 红线

- 不改 `packages/core/src/tools/registry.ts` 既有 spread 之外的上游文件；schema.ts 不加字段。
- 中文显示名保留（外置≠英文化）；zone 标记是寻址层，不是改名。
- 关联设计区不做 active 切换按钮逻辑（T60/T61 职责）。
- 并行波次纪律：实现 agent 禁止 commit/push、禁止碰 fork/index.ts 与 pi-backend/tools.ts、禁止改 zones.json/tracker/_index。

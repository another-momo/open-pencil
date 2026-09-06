<!--
  写作纪律（改本文前必读）：
  - 事实性声明必须附核验命令 + 日期，否则标为【假设】
  - 本文只保留当前态，不保留修正历史
  - 详细规则见 docs/rebuild/05-process.md §4
-->

# T53 计划 · Phase 3 W2/T-B2：setup_design 窄化（四职责+校验+设计身份落盘+结构化信封）+ 无状态三态解析

> **状态**：✅ 已完成（2026-09-01 收口） | **时间**：2026-09-01 立项 | **负责人**：主 agent + 实现 subagent
> **规格真源**：[S3-tool-contracts-spec.md §2/§9/§10](../../../doc/S3-tool-contracts-spec.md)、[S1-product-spec.md §5/§6](../../../doc/S1-product-spec.md)、[S4-phase3-plan.md](../../../doc/S4-phase3-plan.md) T-B2 行
> **移植源**：`open-pencil` 仓 feature/agent-backend @ 5d38aa4e（T52 立项时 `git -C ../open-pencil log -1 --format=%H` 实测 2026-08-31）：packages/core/src/tools/marketing/setup.ts（396 行）、registry.ts（116 行，**删除不移植**）、tests/engine/tools/marketing/setup.test.ts（152 行）
> **调研在案**：2026-09-01 Explore agent 产出（行号证据见下）

## 1. 背景与方案

W2 第二任务。旧 `setup_material_type`（ToolDef 在旧 marketing.ts:63-95）按 S3 §2 窄化重写为 `setup_design`：**仅「新建」时调用**，签名 `setup_design({ modeId, typeId?, profileId?, briefId })`。

**前瞻注记（owner 2026-09-01 v8）**：type 蓝图机制已被裁决为过度设计，**W3 批次删除（T-B11/T62）**——届时 typeId 校验与蓝图尺寸快照整体退役。本任务仍按现契约施工，但 typeId/蓝图逻辑**集中于 setup.ts 单一校验模块**，为 W3 切除留干净接缝。

**四职责**（S3 §2 L39-43）：① 新增根 frame，尺寸从该 mode 的 type 蓝图**读一次（快照语义）**；② 设尺寸与名称（最小空闲 `"label N"`，移植旧 `nextRootFrameName` setup.ts:149-156）；③ 设计身份四元组 + schemaVersion 落盘（`design.pluginData ← {briefId, modeId, typeId, profileId, schemaVersion}`，PD-19）；④ brief 关联设计区登记（调 T52 已交付的 `registerBriefDesignEntry`，brief.ts:820-856）。

**删除不移植**（S3 §2 L47）：领养发现逻辑（旧 `resolveExistingDesign` setup.ts:192-216、`findRootFrame`/`listSameTypeRoots`、`buildOriginPart` ADOPTED/NEW 教学 note、`siblingPagesOf` 跨页提示）、registry.ts 整体（WeakMap+clock 进程态）、`activeMaterialTypes` 进程内推送（W8 既成废弃）。

**关键设计定谳**（调研开放项裁决）：

1. **校验注入缝**：mode/type/profile 注册表仅后端进程可达（`src/app/ai/pi-backend/studio/registry.ts` loadStudioFromDirs，node:fs 直读），而 fork 工具在浏览器桥端执行（tool-handlers.ts:172-179）——数据层 ≠ 执行层。裁决：core 函数形参带 **catalog 快照注入**——`setupDesign(figma, args, catalog?)`，catalog = `{ modes: [{ id, label, types: 'none' | [{ id, label, size }] }], profileIds: string[] }`（size = `'WxH' | 'Wx'`，同构旧 `parseMaterialTypeSize` setup.ts:386-396）。catalog **不进工具 schema、不进模型视野**，由 pi-backend 桥调用外层附加（T22 documentId 注入先例，tools.ts:84-87）——**注入接线属冻结面，主 agent 集成时做**。core 测试直接 fixture 注入（S3 §10 校验断言因此可落在 bun 层）。
2. **新建意图确认拦截（双层）**：宿主随 args 外层注入 `confirmedNewIntent: boolean`（与 catalog 同缝，缺省 `false`）；core 函数见 `!== true` → 结构化错误引导确认（不建框）。宿主 wrapper 侧短路同属 T-B9/T-B10 接线，本任务只交付 core 机制 + 注入点约定。注意：T-B10 的 UI 指令块落地前无任何通道注入 `true`，工具对 AI 恒表现为「需先获得用户新建确认」——**符合契约**（S3 §2 L34-38 宿主拦截语义），S4 §7 尾巴表已登记此依赖。
3. **「单键原子铸造」= 语义级**：单次调用内逐键写五键（四元组 + schemaVersion），每键写后重读防 stale 快照（T52 `setBriefMarker` 先例，brief.ts:133-137）；键面复用 T52 已导出的 `DESIGN_MODE_KEY/TYPE_KEY/PROFILE_KEY/BRIEF_KEY`（brief.ts:61-64）+ `BRIEF_SCHEMA_VERSION_KEY`/`BRIEF_SCHEMA_VERSION='1'`（brief.ts:41-42）。不做物理单键 JSON（与 brief-edit.ts:75-89 读穿投影冲突）。
4. **重复调用 = 恒新建**：窄化后无领养无幂等，同参数再调 = 新建第二框（最小空闲名递增）。`mutates: true`。
5. **role 标记单源**：`MARKETING_ROLE_ROOT='marketing-root'` 常量在 setup.ts 导出；集成时把 `fork/image-gen/history.ts:61` 的同名本地常量改为 import（fork/ ownedRoot 内改动，zones 零登记）。
6. **general mode 尺寸**【裁决，spec 未言明】：general 无 type 蓝图 → 宽 750 + HUG 高（长图默认，`SETUP_GENERAL_DEFAULT_WIDTH=750` 命名常量）；`modeId='general'` 恒过校验、不得传 typeId。
7. **无状态三态解析**：setup.ts 同文件导出 `scanMarketingDesigns(figma): MarketingDesignRef[]`（扫当前页 role=marketing-root 标记节点，读穿四元组 + 名称，死节点不出现，两次扫描独立无进程态）+ `resolveMarketingDesign(figma, rootId?): ok | none | ambiguous`（显式 id > 唯一 > 歧义——「最近活跃」路已废除，S1 §9 L172）。v1 同页限定（S4 v6）。
8. **信封**：成功 `{ rootId, name, size: { width, height: number | null }, modeId, typeId?, profileId?, briefId, placement: { x, y } }`；错误 `{ error: <code>, message: <用户语言化 zh-cn>, ...extras }`（比照 brief-tools.ts 错误面先例）。code 枚举：`brief_not_found | ambiguous_brief | unknown_mode | type_not_in_mode | type_forbidden | type_required | unknown_profile | unconfirmed_new_intent | catalog_unavailable`。
9. **放置与视口**：`findPlacementPosition(figma, size)`（fork/placement.ts:43-48）+ 创建后 `scrollAndZoomIntoView`。
10. **MCP/headless 薄壳**：同一 core 函数；无 catalog 注入时仅 `modeId='general'` 且不带 typeId 可用，否则 `catalog_unavailable` 结构化错误。MCP 侧 catalog 接线 = 后续任务（尾巴表登记）。
11. **i18n**：SETUP_TEXTS 进共享 `texts.ts`（本任务独占该文件，T57 不碰）。

**几何移植**（保留值）：`layoutMode:'VERTICAL'`、`counterAxisSizing:'FIXED'`、`primaryAxisSizing: height===null?'HUG':'FIXED'`（'750x' → HUG，初始高 400）、白底、`clipsContent`（旧 `createRootFrame` setup.ts:158-185）。蓝图 `'WxH'` → FIXED 高；`'Wx'` → HUG。

**文件布局**（全部落 ownedRoots，zones.json 零登记——ownedRoots 含 `packages/core/src/tools/fork/`、`tests/engine/rebuild/`，2026-08-31 实测）：

| 文件 | 内容 |
|---|---|
| packages/core/src/tools/fork/marketing/setup.ts | `setupDesign` core + `scanMarketingDesigns` + `resolveMarketingDesign` + `MARKETING_ROLE_ROOT` 导出 |
| packages/core/src/tools/fork/marketing/setup-tool.ts | `setupDesignTool` ToolDef + `SETUP_TOOLS` 数组（不进 FORK_TOOLS——冻结面） |
| packages/core/src/tools/fork/marketing/texts.ts | SETUP_TEXTS 追加（zh-cn 外置） |
| tests/engine/rebuild/marketing/setup.test.ts | 契约测试（S3 §10 九契约改写版 + 三态解析新写） |

**接线冻结纪律**（并行波次约定）：`fork/marketing/index.ts`、`fork/index.ts`（FORK_TOOLS）、`pi-backend/tools.ts`（catalog/confirmedNewIntent 注入）由主 agent 集成时统一接线；实现 agent 只交付 `SETUP_TOOLS` + core，不碰这三个文件、不碰 zones.json/tracker/_index、禁止 commit/push。

## 2. 不做清单

- active_design 单槽 / set_active_design / 宿主路由（T60）；确认 UI 通道（T61）；Case B 话术（T-B9 设计时）。
- registry.ts / restore.ts / derive_palette / sample_hero_color 不移植（S3 §1 在案）。
- prompt-overlay.ts / modes.ts 的 T24 旧双模式遗留清理（仍引用 setup_material_type——随 T-B9 重构，尾巴表登记）。
- MCP 侧 catalog 注入接线（后续任务，尾巴表登记）。

## 3. 验收标准

1. `bun test tests/engine/rebuild/marketing/setup.test.ts` 全绿，覆盖 S3 §10 九契约改写版：①蓝图尺寸建框（750 宽）；②HUG/FIXED 语义；③标记含四元组五键读穿（getSharedPluginData + BRIEF_PLUGIN_NAMESPACE）；④最小空闲 `"label N"` 命名；⑤briefId 不存在 → `brief_not_found`（消费 T52 `findBrief` not-found 态，brief.ts:209-239）；⑥modeId 校验（general 恒过 / 未知 → `unknown_mode` / workflow 存在过）；⑦typeId 三态（在列表内过 / `types:'none'` 传 → `type_forbidden` / 缺 → `type_required` / 列表外 → `type_not_in_mode`）；⑧未确认 → `unconfirmed_new_intent` 且无框落地；⑨关联设计区登记（registerBriefDesignEntry 被调、条目名称投影、brief bound-designs 含新根）。另钉：信封字段、恒新建（再调得 "label 2"）、放置右 +100/y 跟随、scrollAndZoomIntoView、catalog 缺省走 general、profileId 不在册 → `unknown_profile`。
2. 无状态三态解析新写测试（S3 §10 L143）：空页 `none` / 唯一 `ok` / 两个 `ambiguous`（candidates 含四元组投影）/ 显式 id 命中与未中 / 死节点不出现 / 两次扫描独立。
3. 旧 setup.test.ts 断言契约保留项平移（几何/命名/HUG-FIXED/标记钉扎），领养断言**删除**。
4. `bun test tests/engine/rebuild/` 全绿（既有套件不回退）。
5. 九门禁全绿（lint/typecheck/format/check:arch/check:zones/check:tasks/check:bindings/test:type-shapes/check:i18n——以 package.json scripts 实测清单为准），全量回归失败数不增（对照 T52-T59 收口基线 172/172）。
6. CI 逐 push 口径绿。

## 4. 红线

- schema.ts 不加字段；ParamDef 不扩嵌套类型（catalog/confirmedNewIntent 走 schema 外注入）。
- 设计身份键面不改（T52 已导出并被 brief-edit 读穿消费）。
- 中文显示名/文案外置 zh-cn（外置≠英文化）。
- 并行波次纪律：禁止 commit/push、禁止碰 fork/index.ts、fork/marketing/index.ts、pi-backend/tools.ts、zones.json/tracker/_index。

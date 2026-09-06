<!--
  写作纪律（改本文前必读）：
  - 事实性声明必须附核验命令 + 日期，否则标为【假设】
  - 本文只保留当前态，不保留修正历史
  - 详细规则见 docs/rebuild/05-process.md §4
-->

# T52 核验 · brief 四区改造 + 三件套移植 + 放置统一策略

> **状态**：✅ 已完成（2026-08-31 收口） | **核验人**：独立核验 agent（未参与实现）
> **核验基准**：T52-plan.md §1/§3 + doc/S3-tool-contracts-spec.md §3/§9/§10；实现为工作树未提交态（`git status` 2026-08-31）

## 1. 核验范围

placement.ts 共享助手、fork/marketing/{brief,brief-edit,tools,texts,index}.ts、接线三处（fork/index.ts、tools/registry.ts、pi-backend/tools.ts 的 FORK_TOOLS 暴露段）、四份新测试（brief/brief-edit/brief-tools/placement）。同工作树内的 look.ts、image-gen/、undo/ 属 T54/T55/T59 并行波次，不在本核验范围。

## 2. 验收核验（V 逐条）

| # | 验收项 | 结果 | 证据 |
|---|---|---|---|
| V1 | T52 四测试文件全绿 | ✅ | `bun test tests/engine/rebuild/marketing/`（2026-08-31，unpiped exit 0）：72 pass / 0 fail，其中 T52 四文件 42 例（brief 13 + brief-edit 8 + brief-tools 16 + placement 5；另 30 例 look 属 T55） |
| V2 | 四区结构（内容/素材/AI结论/关联设计区新建） | ✅ | brief.ts:493-571 四卡各置 zone 标记；测试 brief.test.ts:92-128 断言四区可寻址 + DesignList 初始空 + EmptyHint 可见 |
| V3 | mode/type 投影读穿 + 缺省「—」容错 | ✅ | brief-edit.ts:186-206（designProjection 缺省 missingProjection='—'，texts.ts:38）；brief.test.ts:308-363 断言未写入→「—」、写入后读穿、改名读活名 |
| V4 | zone 标记寻址（改名显示名仍读写正常） | ✅ | brief.ts:175-192（标记优先）；brief.test.ts:152-173 四区全改名后 readBrief/updateBriefContent/appendToBriefAIZone 仍正常 |
| V5 | name 兜底兼容旧档 | ✅ | brief.ts:188-191（byName 兜底）；brief.test.ts:175-193 剥标记后读写正常；brief.test.ts:195-206 明文 key 旧档可读（plugin-data.ts:21-26 matchesSharedPluginData 兼容非编码格式） |
| V6 | schemaVersion=1 | ✅ | brief.ts:41-42, 440；brief.test.ts:101-103 |
| V7 | 逐字转录 | ✅ | tools.ts:128-130（trim 后直写，不润饰）；brief-tools.test.ts:178-188 `view.content === verbatim` |
| V8 | 幂等 {created:false} | ✅ | tools.ts:121；brief-tools.test.ts:169-176（二次调用 created:false 且同 briefId） |
| V9 | read+append 双路歧义防护，无静默第一个兜底 | ✅ | brief.ts:221-239（显式 briefId > 页内唯一 > ambiguous）；tools.ts:58-65/162-165 双路返回歧义结构；create 路亦不静默新建（tools.ts:113-120）；测试 brief-tools.test.ts:124-145/190-202/260-279 + brief.test.ts:216-234 |
| V10 | tombstone 保痕（已删设计标「（已删除）」不物理移除） | ✅ | brief-edit.ts:188-194；brief.test.ts:365-382 断言 deleted=true、名带 deletedMark、条目节点仍在画布 |
| V11 | 素材 imageNodeId 暴露 | ✅ | brief.ts:746-790 返回 {entryId, imageNodeId}；brief-edit.ts:137-153 视图带出；tools.ts:88-93 工具结果含 imageNodeId；测试 brief-edit.test.ts:105-146、brief-tools.test.ts:105-122 |
| V12 | 结论按设计归组（名称+id）保序 append-only | ✅ | brief.ts:653-736（组 designId 标记权威 + GroupTitle 投影 + name 兜底）；brief-edit.ts:161-184 读侧归属字段；测试 brief.test.ts:271-306、brief-tools.test.ts:228-245/281-296 保序断言 |
| V13 | findPlacementPosition 右+100 / y 跟随 / 空页原点 | ✅ | placement.ts:21,43-48；placement.test.ts:21-53（PLACEMENT_GAP=100、union bounds、空页 (0,0)、增长右移） |
| V14 | 创建后 scrollAndZoomIntoView | ✅ | tools.ts:131-132 调用 figma.viewport.scrollAndZoomIntoView（figma-api/index.ts:505-516 既有实现）；brief-tools.test.ts:204-216 断言 viewport 中心移到 brief 包围盒中心 |
| V15 | bindBriefToDesign 走 setSharedPluginData | ✅ | brief.ts:133-137, 161-168（通用 shared 面 upsert，幂等）；brief.test.ts:250-269 编码键可读 + Binding 行重写 |
| V16 | 字体钉扎 fontRegistryEntry('Alibaba PuHuiTi') | ✅ | brief.ts:98 BRIEF_FONT_FAMILY 单一常量；registry.ts:59 在册；brief.test.ts:130-150 注册表钉扎 + 全 TEXT 遍历断言 |
| V17 | 旧测试契约平移（S3 §10 保留项） | ✅ | 逐条映射见 §3 |
| V18 | `bun test tests/engine/rebuild/` 全套不回退 | ✅ | 2026-08-31 unpiped 直读退出码 exit 0：172 pass / 0 fail / 19 文件（含 studio、undo 等既有套件） |
| V19 | 接线：FORK_TOOLS 登记 + pi-backend 暴露 | ✅ | fork/index.ts:14-18 BRIEF_TOOLS 入列；registry.ts:12 ALL_TOOLS spread FORK_TOOLS；tools/index.ts 再导出；pi-backend/tools.ts:215-219 `...FORK_TOOLS` 入 createOpenPencilTools；zones.json patch 登记「T52 集成：registry 再导出 FORK_TOOLS」在案 |

## 3. 旧测试断言平移映射（源仓 tests/engine/tools/marketing/ 三文件）

| 旧断言（open-pencil @ 5d38aa4e） | 新落点 | 结果 |
|---|---|---|
| read_brief {brief:null} 正常态 | brief-tools.test.ts:84-90 | ✅ |
| 内容/素材/结论回读（含 'XX奶茶' 默认内容） | brief-tools.test.ts:92-103；brief-edit.test.ts:46-56 | ✅（结论改结构化视图，§10 改写口径允许） |
| 素材 imageNodeId/caption/hasImage 暴露 + 图片位 IMAGE fill | brief-tools.test.ts:105-122 | ✅ |
| 幂等 created:false 返回既有 id | brief-tools.test.ts:169-176 | ✅ |
| 逐字转录 initial_content | brief-tools.test.ts:178-188 | ✅（旧测试的「绑定活跃设计」半句依赖 setup_material_type，属 T53 不做清单，不迁） |
| 空文本拒绝且不碰 brief | brief-tools.test.ts:247-258 | ✅ |
| 结论保序回读 | brief-tools.test.ts:228-245 | ✅ |
| 多 brief 歧义结构 | brief-tools.test.ts:124-145（read）+ 260-279（append 补齐）+ 190-202（create 收窄） | ✅ 且加强（源仓 append 无歧义防护，S3 §3 要求补齐） |
| briefId 不存在 → error | brief-tools.test.ts:147-154 | ✅ 新增 |
| 三区结构 + 标记 | brief.test.ts:92-128 改四区 | ✅（S3 §3 关联设计区新建） |
| 空 MaterialGrid + EmptyHint 可见 | brief-edit.test.ts:58-78 | ✅（旧「无添加位」断言随结构消失不迁，非 §10 保留项） |
| isBrief 不认同名外观节点 | brief.test.ts:208-214 | ✅ |
| 布局几何不塌缩（宽 1252 / AI 卡 384 / 高=brief-72） | brief.test.ts:236-248 | ✅ |
| appendToBriefAIZone 写入 AI 区 + nonexistent→false | brief.test.ts:271-306 | ✅ |
| readBrief 回读追加结论 | brief-edit.test.ts:80-87 | ✅ |
| updateBriefContent 覆写 + nonexistent→false | brief-edit.test.ts:89-103 | ✅ |
| addBriefMaterialEntry 字节路（WRAP/定宽 180/EmptyHint 隐藏/IMAGE fill/hash 在册/caption） | brief-edit.test.ts:105-146 | ✅（新增 imageNodeId 断言） |
| hash 路 + 缺失 brief 报错 | brief-edit.test.ts:148-160 | ✅ |
| updateMaterialCaption / removeBriefMaterial | brief-edit.test.ts:162-178 | ✅ |
| 结构破坏 read-as-null（素材区删） | brief-edit.test.ts:180-188 扩为三区逐一删除 | ✅ 且加强 |
| getPageContentBounds union / 空页 null | placement.test.ts:25-43 | ✅ |
| create_brief 落既有内容右侧 +gap | placement.test.ts:55-75 | ✅ |
| 结论归组到设计名下 | brief-tools.test.ts:281-296（design_id 参数） | ✅ 语义保留（存储改结构化归属字段） |
| resolveBriefPlacement 居中试放→碰撞右移 | — | ❌ 不迁：**规格内处置**，T52-plan §1 调研修正 1 已定谳由 S3 §9 统一策略（右+100/y跟随/空页原点）替代 |
| 绑定活跃设计 / 跨页 brief 取胜（setup_material_type 依赖） | — | ❌ 不迁：T52-plan §2 不做清单（T53/T60 职责），S3 §10 保留清单不含此项 |

## 4. 边界与未核项

- **九门禁 + CI 逐 push（plan §3 第 4/5 条）**：本核验 agent 授权仅限「写本文 + 跑测试」，未跑 lint/typecheck/format/check:arch/check:zones/check:tasks/check:bindings/test:type-shapes/check:i18n 与 `--base HEAD~1` 口径——收口前需由主 agent 补跑或在集成核验中覆盖。【未核】
- read_brief 工具 `mutates:false` 与读侧零变更纪律：syncBriefDesignEntries 仅在 append 变更路径调用（tools.ts:173-175），读侧以 registered:false 补显（brief-edit.ts:11-17, 234-248），测试 brief.test.ts:384-413 钉扎。
- create_brief 幂等收窄（多 brief → ambiguous 不新建）为 plan §1 明示的工具级语义收窄，相对源仓是加强而非回退。
- 工作树为未提交态且混入 T54/T55/T59 并行改动；本核验仅审 T52 文件面，其余波次由各任务自核。

## 5. 总结论

**可以收口**（以 V1-V19 全绿为据；九门禁/CI 两条验收项超出本核验授权，收口动作前需另行确认——见 §4 首条）。

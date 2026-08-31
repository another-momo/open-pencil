<!--
  写作纪律（改本文前必读）：
  - 事实性声明必须附核验命令 + 日期，否则标为【假设】
  - 本文只保留当前态，不保留修正历史
  - 详细规则见 docs/rebuild/05-process.md §4
-->

# T52 自检 · Phase 3 W2/T-B1：brief 四区改造 + 三件套移植 + 放置统一策略

> **状态**：✅ 已完成（2026-09-01 收口） | **时间**：2026-08-31 立项 | **负责人**：主 agent + 实现 subagent + 核验 subagent

## 1. 立项段自查（2026-08-31）

1. **移植源实证**：`git -C ../open-pencil log -1 --format=%H` = 5d38aa4e（feature/agent-backend）；brief.ts 709 行 / brief-edit.ts 156 行 / marketing.ts ToolDef 面 213 行（wc -l 实测）。
2. **调研修正两条**（Explore 蓝图，行号证据在案）：① 双仓均无 `findPlacementPosition`（grep 零命中）——源为 brief.ts:182-193 resolveBriefPlacement（居中试放→碰撞右移），S3 §9 语义（右+100、y 跟随）以规格为准新建共享助手；② registry.ts（WeakMap+clock）按 S3 §1 定谳不移植，「活跃设计」缺位期解析序改为显式 briefId > 页内唯一 > 歧义信号。
3. **落点全在 ownedRoots**（zones.json 实测含 packages/core/src/tools/fork/、tests/engine/rebuild/）：zones 零新增登记；唯一上游触点为集成期 P22/P134（registry/index 再导出）。
4. **filePrefix 规则实测**（support.ts:179-183 正则）：brief.ts 无前缀、brief-edit/brief-tools 前缀组 ×2 < 3 阈值，marketing/ 目录布局不触 steiger。

## 2. 实现段核验（2026-08-31/09-01 实测填报）

- **C1 四区结构**：内容区/素材区/AI结论区/**关联设计区（新建）**；区节点携带 zone 标记 pluginData（content/materials/conclusions/designs），中文显示名仅展示层，读侧 name 兜底兼容旧档；根节点 schemaVersion=1。测试：四区断言 + 改名后读写正常 + 剥标记 name 兜底（tests/engine/rebuild/marketing/brief.test.ts）。
- **C2 三工具契约**：create_brief 逐字转录 + 幂等 `{created:false}` + 放置 findPlacementPosition + 创建后 scrollAndZoomIntoView + 多 brief 歧义结构（不静默绑错）；read_brief/append_brief_conclusion 可选 briefId 参数 + `{ambiguous:true, candidates}` 结构化歧义；append 按设计归组（组 frame 带 designId 标记 + GroupTitle，每条名称+id 归属，append-only）。
- **C3 tombstone 保痕**（v7 定谳，S3 §3 已于 2026-08-31 同步口径）：设计已删 → 关联设计区条目视图标注「（已删除）」，节点不物理移除（测试含节点存续断言）。
- **C4 惰性调和拆两瓣**（实测修正，见 §3.1）：读侧视图级调和（mutates:false 纪律不破）+ 物理补写 syncBriefDesignEntries 留变更路径（append/T53）。
- **C5 素材条目**：imageNodeId 暴露（look 数据源契约）；IMAGE fill + EmptyHint 隐藏纪律随迁。
- **C6 放置助手**：fork/placement.ts 共享 findPlacementPosition（右+PLACEMENT_GAP 100、y 跟随 bounds 顶、空页原点）；placement.test.ts 三态钉扎。
- **C7 硬编码治理**：texts.ts 全画布中文文案外置；BRIEF_FONT_FAMILY 单常量 + fontRegistryEntry 钉扎测试（registry.ts:59 在册）；魔法数字命名化随源保持。
- **C8 集成接线**（主 agent，2026-09-01）：BRIEF_TOOLS → FORK_TOOLS（fork/index.ts）→ pi-backend createOpenPencilTools 全量暴露（tools.ts）；registry.ts/index.ts 再导出 FORK_TOOLS（P22 扩注 + P134）。
- **C9 测试**：`bun test tests/engine/rebuild/marketing/` 72/72 绿（含 T55 look 30 例）；`bun test tests/engine/rebuild/` 172/172 绿（2026-09-01 集成后实测）。

## 3. 实测修正记录

1. **读路径不能物理补写**：plan 字面「读时惰性调和补写」与 mutates:false 契约冲突（桥按 def.mutates 包 undo，读侧写会产生幽灵撤销）。落法：读侧视图调和 + 物理补写收编进变更路径。教训已反哺：规格行文「读时调和」在 mutates 纪律下须读作「读时视图调和 + 写时物理调和」。
2. **结论视图结构化**：plan「每条带设计名称+id 归属」无法塞进旧契约的扁平字符串数组——conclusions 元素改 `{text, designId, designName}`（保序不变），下游消费方（T61 面板/T60 宿主）按新形状对接。
3. **并行波次 placement 漂移**：T54 按约定自建本地副本但签名分叉（无 size 参）；集成期归并到 fork/placement.ts（size 参保留为共享契约，apply.ts 调用点改传帧尺寸），本地副本删除、导出名归一 PLACEMENT_GAP。波次纪律（各自副本 + 集成归并）按设计奏效。
4. **type-shapes 撞型两例**：PlacementSize {width,height} 撞既有 ViewportSize → 改 `type PlacementSize = Size` 别名（scene-graph primitives）；测试侧 BriefCandidate 重复声明 → 改 import。教训：新 interface 声明前先想既有形状复用。
5. **type-aware lint 细案**：`pageBriefs[0]` 在非 noUncheckedIndexedAccess 配置下类型恒 SceneNode，`!first` 判空被 no-unnecessary-condition 拦（显式 `| undefined` 标注亦不豁免）——改 `length === 0` 判空 + 解构取用。
6. **brief.ts 880 行 > max-lines 600（warn 级）**：门禁不拦（warn）；结构自然生长点已到，T53 加 setup_design 时若再涨则拆 entries 模块（本任务交付物白名单锁 6 文件未拆）。

<!--
  写作纪律（改本文前必读）：
  - 事实性声明必须附核验命令 + 日期，否则标为【假设】
  - 本文只保留当前态，不保留修正历史
  - 详细规则见 docs/rebuild/05-process.md §4
-->

# T57 自检 · Phase 3 W2/T-B6：prepare_hero_scaffold 移植

> **状态**：✅ 已完成（2026-09-01 收口） | **时间**：2026-09-01 立项 | **负责人**：主 agent + 实现 subagent + 核验 subagent

## 1. 立项段自查（2026-09-01）

1. **移植源实证**：旧 prepare-hero-scaffold.ts 221 行 + hero-slot.ts 54 行全读（Explore 调研在案）；imports 仅 scene-graph 类型 + defineTool + ./hero-slot——无 registry/derive-palette 邻件牵连，排除面干净。
2. **契约修订两条落点**：克隆源 = 显式 source_node_id（标题前置版式，S1 §3 L58-60 定序；旧「HeroContent missing」路径废止）+ 几何记录写 scaffold pluginData（key `hero-geometry`，T58 硬依赖——S3 §8 L111 缺记录 = 结构化报错）。
3. **签名钉死**：`{ root_id, source_node_id, underlap_px?, transition_zone_px? }`；hero_bleed 更名 underlap_px 无别名；root 校验只取结构面（FRAME + auto-layout），不依赖同波次 T53 标记。
4. **steiger 预算**：hero×2（scaffold/tools）止步——hero-slot 助手内联进 hero-scaffold.ts，不建第三 hero-* 文件；texts.ts 归 T53 独占，HERO_TEXTS 落 hero-scaffold.ts 顶部（外置纪律不破）。
5. **落点全在 ownedRoots**：zones 零新增。

## 2. 实现段核验（2026-09-01 实测填报）

- **C1 标题前置克隆**：无骨架可直接成 scaffold（测试①实证：fixture 无 HeroContent）；source 校验（存在/FRAME/≥1 child）三错误路径结构化。
- **C2 几何记录**：四字段写入 + readHeroGeometry 读回；缺记录/畸形 → null（不静默默认，T58 侧转显式失败）；记录存**钳制后**值；slot 高 = height − underlapPx 交 T58 推导。
- **C3 写入校验钳制**：underlap 有限 0..1000 缺省 100；transition 有限 ≥0 缺省 100；transition > underlap → 钳到 underlap + `clamped:true`（不报错）；非有限/负 → `{error, message}`。
- **C4 scaffold 本体**：页面级兄弟帧 `Hero生成参考`（HERO_TEXTS），layoutMode NONE + clipsContent + 白底；幂等 upsert 按名寻址；重调保 id + 刷几何/记录/重克隆 + IMAGE fill 保留（否则重置白底）。
- **C5 放置**：findPlacementPosition 页面级（右 +100 / y 跟随 / 空页原点）——创建期一次性（见 §3.1 修正）。
- **C6 note 三分解体**：信封 note 仅事实（scaffold id/源 id/克隆数/钳制旗标）；测试⑧断言无 generate_image/compose_backdrop/replace_id 子串。
- **C7 集成接线**（主 agent）：HERO_TOOLS → fork/marketing/index.ts → FORK_TOOLS（fork/index.ts）。
- **C8 测试**：`bun test tests/engine/rebuild/marketing/prepare-hero-scaffold.test.ts` 17/17 绿；全套件 236/236 绿；`bunx steiger .` No problems found（2026-09-01 实测）。

## 3. 实测修正记录

1. **重调不再重定位**：旧实现每次按 root 相对坐标重算 x/y；新放置读页面 bounds——scaffold 自身进 bounds，重定位会每次右漂 width+100。落法：位置仅创建期设定，更新路径只刷尺寸/fill/children/记录（测试④钉扎：源移到 x=2000 后 scaffold 原地不动）。语义评估：scaffold 是参照物，用户可能手动挪过——尊重现状位置优于追源，修正合理。
2. **错误面升级**：旧扁平 `{error: string}` → T53 同款 `{error: <code>, message}`（八 code：invalid_params/root_not_found/root_not_frame/root_not_auto_layout/root_without_page/source_not_found/source_not_frame/source_empty），zh-cn 文案入 HERO_TEXTS。
3. **readHeroGeometry 先重读节点**（graph.getNode(node.id) 防 stale 快照，setBriefMarker 先例）——graph 形参是承重的，非冗余。
4. **工具描述保留一句契约提示**（compose 消费几何记录 + underlap_px 须一致）——静态描述非运行时 note 指令链，S3 §7 L104 不违；若后续裁决过宽可再削。

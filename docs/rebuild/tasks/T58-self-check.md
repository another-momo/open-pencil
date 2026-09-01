<!--
  写作纪律（改本文前必读）：
  - 事实性声明必须附核验命令 + 日期，否则标为【假设】
  - 本文只保留当前态，不保留修正历史
  - 详细规则见 docs/rebuild/05-process.md §4
-->

# T58 自检 · Phase 3 W3/T-B7：compose_backdrop 移植

> **状态**：✅ 已完成（2026-09-01 收口） | **时间**：2026-09-01 立项 | **负责人**：主 agent + 实现 subagent + 核验 subagent
> （S4 行号 T-B7；tracker 任务号 T58）

## 1. 实现段核验（2026-09-01 实测填报）

- **C1 交付**：compose-backdrop.ts（859 行 core + COMPOSE_TEXTS + 采样纯函数随迁）+ compose-tools.ts（65 行 ToolDef/COMPOSE_TOOLS）+ compose-backdrop.test.ts（865 行 46 用例）。
- **C2 几何消费**：管线内几何只从 readHeroGeometry(scaffold) 读；缺/畸形记录 → 结构化报错引导回 scaffold；transitionZonePx 驱动渐变过渡带与采样 bandSize（测试钉 50/100 两档）；槽高 = 记录 height − underlapPx。
- **C3 修订 3**：隐式收养/stray 侦测物理删除；HeroContent 含 IMAGE fill 未指定来源 → 结构化报错（含 discard_hero 指引）；discard_hero:true 显式丢弃路径；discard_hero + hero_image_from 同传 → invalid_params（实现期新增互斥校验）。
- **C4 不变量平移**：kiss 三明治 z 序三钉扎、HeroImg = slot + underlap、幂等重调、canvas_height 缺省跟随根高、颜色降级链 显式 > 采样 > 白兜底、hex 拒收进 note warning。
- **C5 note 瘦身**：信封 13 键钉扎，underlap_px/overlap_px 取代 hero_bleed；无工作流指令链。
- **C6 采样 seam**：sampler 第 3 参注入；真实现 sampleHeroBottomBand lazy `import('#core/canvaskit')`（字节未加载前短路，测试环境不碰 CanvasKit）。
- **C7 集成（主 agent）**：marketing/index.ts re-export COMPOSE_TOOLS；fork/index.ts 展开 + W3 登记者注释。
- **C8 测试**：`bun test tests/engine/rebuild/` 323/323 绿（2026-09-01 集成后）；新文件 46/46。

## 2. 实测修正记录

1. **采样纯函数只随迁 bottom 特化**（bottomBandRegion）——compose 只用 bottom 方向，全方向 bandRegion 不搬避免死分支。
2. **管线内空 scaffold 容忍白兜底**不报错；hero_image_from 显式来源无填充才报 source_no_image——scaffold_id 双职几何载体，discard_hero 才是显式无图路径。
3. **外部来源路径画布宽取 root.width**（无 canvas_width 散参）；宽度对账 WARNING 仅管线内可触发。
4. **type-shapes 撞型**（集成期主 agent 修正）：RGBChannels {r,g,b} 撞 tests/engine/io OracleColor → 删中间 interface，BandColor 平铺四字段，bandColorToHex 改内联参数形状。
5. **max-lines 859 > 600（warn 级）**：门禁不拦；后续若再涨拆采样模块（记录为结构观察点）。

## 3. 遗留

- 真采样器 CanvasKit 路径无集成测试（契约内：pure 函数 + 注入 seam 覆盖；浏览器冒烟归 W4）。

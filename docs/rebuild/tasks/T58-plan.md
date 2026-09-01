<!--
  写作纪律（改本文前必读）：
  - 事实性声明必须附核验命令 + 日期，否则标为【假设】
  - 本文只保留当前态，不保留修正历史
  - 详细规则见 docs/rebuild/05-process.md §4
-->

# T58 计划 · Phase 3 W3/T-B8：compose_backdrop 移植（消费 T57 几何记录）

> **状态**：🔄 进行中 | **时间**：2026-09-01 立项 | **负责人**：主 agent + 实现 subagent + 核验 subagent
> **调研蓝图**：T58 调研 subagent 2026-09-01（S3 §8 契约 + 上游 compose-backdrop.ts 662 行 + T57 交付物逐一在案）

## 1. 移植源实证

- 上游 open-pencil @ feature/agent-backend：`packages/core/src/tools/marketing/compose-backdrop.ts` 662 行（defineTool 一体式）；依赖 hero-slot.ts 54 行、sample-color.ts（CanvasKit）+ sample-color-pure.ts 102 行（纯数学 bandRegion/averageRegion/bandColorToHex）；旧测试 tests/engine/tools/marketing/compose-backdrop.test.ts 734 行 7 describe（wc -l 实测 2026-09-01，调研蓝图在案）。
- T57 已交：`readHeroGeometry(graph, node) => HeroGeometry | null`（hero-scaffold.ts:140），key `'hero-geometry'`，值 {width,height,underlapPx,transitionZonePx} 为钳制后值；缺失/畸形返回 null（T58 硬依赖）。

## 2. 定谳

1. **签名**：`composeBackdrop(figma, args)`；args = `{root_id, scaffold_id?, hero_image_from?, discard_hero?, canvas_height?, hero_color?}`。管线内路径 `scaffold_id` 必填二选一（scaffold_id 或 hero_image_from 外部来源）；`hero_height`/`hero_bleed` 散参**删除**（管线内一律读几何记录；外部来源从来源节点推导）。
2. **几何只读记录**（S3 §8 修订 2）：管线内从 `readHeroGeometry(scaffold)` 读；缺记录/畸形 → 结构化报错引导回 prepare_hero_scaffold（跳步 = 显式失败，不静默默认）。OVERLAP/transitionZone 与采样带 bandSize 一律取记录的 `transitionZonePx`；canvas_width 校验对记录 width。
3. **隐式收养删除**（S3 §8 修订 3）：HeroContent 含 IMAGE fill 且未指定 hero_image_from → 结构化错误「请指定来源，或传 discard_hero:true 确认丢弃」；`discard_hero:true` 显式丢弃路径。stray-image 侦测随删。
4. **不变量原样平移**：kiss 三明治 z 序（BaseWash < HeroImg < BackdropOverlay 锁于 BackgroundLayer）；HeroImg = slot + underlap 接缝藏进下一分区；幂等重调（canvas_height 缺省跟随根实际高度）；颜色降级链 显式 hero_color > 采样带 > 白兜底；hero_color 非 hex 拒收进 note warning 不报错（旧行为）。
5. **note 瘦身**（三分解体）：note 只留事实 + WARNING（rootWidth/heroColorRejected/heightDefaulted/sampleError）；删除「Re-call…/Verify with look…」工作流指令链（归 workflow Fix Playbook）。
6. **文件布局**（对齐 T57 约定）：`compose-backdrop.ts`（core 逻辑 + COMPOSE_TEXTS 文案常量）+ `compose-tools.ts`（ToolDef + COMPOSE_TOOLS）。采样纯函数随迁进 compose-backdrop.ts（不新增第三个 compose-*/sample-* 前缀文件——steiger filePrefix ≥3 违例红线，marketing/ 现 hero×2/setup×2，compose 前缀落 2 安全）。CanvasKit 采样通过**注入 seam**（composeBackdrop 第 3 参可选 sampler，缺省走真 getCanvasKit 实现）——测试注入假采样器，不碰 CanvasKit。
7. **注册**：marketing/index.ts re-export COMPOSE_TOOLS；fork/index.ts 展开进 FORK_TOOLS + W3 登记者注释（集成期主 agent 领土，实现 subagent 不动这两个文件）。
8. **不做**：与 brief 关联设计区联动（S3 §8 无要求，登记归 T53）；外部来源语义分支改造（维持旧逻辑）；审美修复指引进工具（归 workflow）。

## 3. 测试清单（tests/engine/rebuild/marketing/compose-backdrop.test.ts，setupToolTest 真 SceneGraph 基建）

工具定义钉扎；校验错误路径（root 缺失/非 FRAME/无自动布局/尺寸越界/hex 拒收进 note）；几何消费（记录读出/缺记录报错/畸形报错/canvas_height 缺省=root.height）；拓扑 z 序三钉扎 + HeroContent flow slot + fills=[] 强制；渐变契约（BaseWash 5%→白、Overlay 三段）；颜色管线三级降级 + 采样失败白兜底（注入假采样器）；hero_image_from fill transfer + 幂等不重复转移；新报错（含 discard_hero 路径，隐式收养断言全删）；幂等重调（尺寸跟随新记录、fill 保留、z 序重钉）；note 信封字段钉扎（无指令链）。

## 4. 验收标准

1. `bun test tests/engine/rebuild/` 全绿（含新增用例）；`bun run smoke:pi` 19/19。
2. lint 0 err、typecheck、format（仅触碰文件）、dupes、arch、type-shapes、i18n、zones、bindings、docs 全 exit 0（unpiped）。
3. marketing/index.ts + fork/index.ts 集成由主 agent 完成；zones.json 零新增（落点全在 ownedRoots）。
4. 三件套齐 + 核验 PASS 后 tracker/_index flip ✅。

## 5. 红线

- readHeroGeometry 是唯一几何来源；管线内路径禁止尺寸散参回潮。
- 隐式收养/stray 侦测代码与测试断言全部物理删除，不留死分支。
- 文案外置 COMPOSE_TEXTS；不碰 texts.ts（T53 领土本波次不动）。

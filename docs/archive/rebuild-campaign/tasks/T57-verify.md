<!--
  写作纪律（改本文前必读）：
  - 事实性声明必须附核验命令 + 日期，否则标为【假设】
  - 本文只保留当前态，不保留修正历史
  - 详细规则见 docs/rebuild/05-process.md §4
-->

# T57 核验 · prepare_hero_scaffold 移植（标题前置克隆源 + 几何记录写入/校验）

> **状态**：✅ 已完成（2026-08-31 收口） | **核验人**：独立核验 agent（未参与实现）
> **核验基准**：T57-plan.md §1/§3/§4 + doc/S3-tool-contracts-spec.md §7/§8/§9/§10；移植源 open-pencil 仓 feature/agent-backend（packages/core/src/tools/marketing/prepare-hero-scaffold.ts + hero-slot.ts）；实现为工作树未提交态（`git status --porcelain` 2026-08-31）

## 1. 核验范围

fork/marketing/hero-scaffold.ts（348 行：prepareHeroScaffold / readHeroGeometry / HERO_TEXTS / HERO_GEOMETRY_KEY / 默认 100/100/上限 1000）、fork/marketing/hero-tools.ts（prepareHeroScaffoldTool + HERO_TOOLS）、tests/engine/rebuild/marketing/prepare-hero-scaffold.test.ts（17 例）、主 agent 集成面（fork/marketing/index.ts、fork/index.ts 的 HERO_TOOLS 接线）。同工作树内 setup-\*/ask-user-question-\*/i18n/ChatPanel 等属 T53/T56 并行波次，不在本核验范围。

## 2. 验收核验（V 逐条）

| # | 验收项 | 结果 | 证据 |
|---|---|---|---|
| V1a | T57 契约测试 17 例全绿 | ✅ | `bun test tests/engine/rebuild/marketing/prepare-hero-scaffold.test.ts`（2026-08-31，unpiped 直读输出）：17 pass / 0 fail / 139 expect() calls，exit 0 |
| V1b | `bun test tests/engine/rebuild/` 全套不回退 | ✅ | 2026-08-31 unpiped exit 0：236 pass / 0 fail / 23 文件（含 studio、undo、image-gen、ask-user-question 等既有/并行套件） |
| V2a | 克隆源 = 显式 source_node_id（标题前置） | ✅ | hero-tools.ts:35-40 参数 required；hero-scaffold.ts:175-193 resolveSourceFrame（存在+FRAME+≥1 child）；description 明示 "ALREADY-RENDERED headline layout … never scans for a HeroContent slot"（hero-tools.ts:27） |
| V2b | 无骨架/HeroContent 也可调用——测试确无骨架 | ✅ | 测试 :110-123 setupPage 的 root 经 makeRoot（:43-52）建为 VERTICAL 自动布局且**零子节点**；① 用例 :246 前置钉扎 `expect(root.childIds.length).toBe(0)`；标题源 makeHeadlineSource（:55-80）是页面级独立 frame，不挂 root。骨架确实不存在 |
| V2c | 几何记录 {width,height,underlapPx,transitionZonePx} @ namespace 'open-pencil-marketing' key 'hero-geometry' | ✅ | hero-scaffold.ts:71 HERO_GEOMETRY_KEY、:35 import BRIEF_PLUGIN_NAMESPACE（brief.ts:36 唯一声明 'open-pencil-marketing'）、:123-133 JSON.stringify 落盘；测试 :137-138 钉扎键名/namespace 字面值，:284-293 钉扎原始 JSON 恰四字段 |
| V2d | 缺省 100/100、上限 1000 | ✅ | hero-scaffold.ts:66-68 常量；hero-tools.ts:41-55 参数 default/min/max；测试 :131-135 + :194-203（缺省调用 envelope 与记录均 100/100、height=850） |
| V2e | transition > underlap → 钳制 + clamped:true；记录存钳后值 | ✅ | hero-scaffold.ts:314-315 钳制、:324-330 几何对象取钳后 transitionZonePx 再落盘；测试 :205-213（250→100、clamped:true、note 含 'clamped'、记录 transitionZonePx=100）、:215-227（underlap 0 边界：transition 缺省 100 钳到 0） |
| V2f | 非有限/负值/超上限 → {error,message} 结构化，不建框 | ✅ | hero-scaffold.ts:291-301；测试 :229-239（-5/5000/NaN/+Inf/transition -1/NaN 全 invalid_params）、:185-190 校验失败页面顶层节点数不变 |
| V2g | readHeroGeometry 缺记录/畸形 → null（不静默默认，T58 硬依赖） | ✅ | hero-scaffold.ts:140-156（按 id 重读防 stale；raw==='' → null；JSON.parse throw → null；四字段逐typeof+isFinite 守卫）；测试 :297-301（root 无记录 → null；写入 'not-json' → null）；S3 §8 L111 跳步=显式失败的消费口就绪 |
| V3a | 页面级兄弟帧按显示名 'Hero生成参考' upsert | ✅ | 旧 prepare-hero-scaffold.ts:160-179 findChildByName(page, SCAFFOLD_NAME) → 新 hero-scaffold.ts:214-242 等价内联扫描 page.childIds；HERO_TEXTS.scaffoldName='Hero生成参考'（:43）；测试 :251-257 钉扎名称/父=页/非 root 子 |
| V3b | layoutMode NONE + clipsContent + 白底（新建） | ✅ | 旧 :172-179 → 新 :232-241 逐字段一致；测试 :255-257 |
| V3c | IMAGE fill 重调保留，非 IMAGE 重置白底 | ✅ | 旧 :164-170 hasImageFill 条件展开 → 新 :223-231 同构；测试 :378-389（IMAGE fill 含 imageHash deadbeef 保留）+ :391-403（红 SOLID 重置白） |
| V3d | cloneTree layoutPositioning ABSOLUTE + x/y 原样 | ✅ | 旧 :188-198 → 新 :249-260 同构（含 .slice() 再删）；scene-graph/src/index.ts:559-578 cloneTree 经 cloneNodeProps 逐字拷贝 props 后叠 overrides；测试 :264-276 钉扎 x=60/y=120/text 原样 + ABSOLUTE + 源子节点仍在（克隆≠引用） |
| V3e | requireAutoLayoutRootFrame 语义（FRAME + layoutMode≠NONE，无 marketing-root 标记依赖） | ✅ | 旧 hero-slot.ts:40-54 三查（存在→FRAME→layoutMode≠NONE）→ 新 resolveRootFrame :160-173 同序同语义 + 工具化文案；grep hero 两文件 'marketing-root' 仅命中头注释「不依赖 T53 的 marketing-root 标记」（:9），零代码依赖 |
| V4 | findPlacementPosition 仅 CREATE 时定位；重调不重定位偏差评估 | ✅ 偏差成立 | 见 §3 |
| V5 | note 仅事实，无指令链残留 | ✅（一处观察，见 §4 I1） | buildFactsNote :263-274 只带 scaffold 名/id + 克隆数 + 源 id + 钳制句；测试 ⑧ :406-428 钉扎 note 不含 generate_image/compose_backdrop/replace_id；grep hero 两文件：指令链词仅命中头注释（删除说明）与 description 一句排序依赖（hero-tools.ts:27），信封零残留 |
| V6a | schema.ts 未改 | ✅ | `git diff packages/core/src/tools/schema.ts`（2026-08-31）= 0 行 |
| V6b | BRIEF_PLUGIN_NAMESPACE 导入非重声明 | ✅ | hero-scaffold.ts:35 `import { BRIEF_PLUGIN_NAMESPACE } from './brief'`；全仓唯一声明 brief.ts:36 |
| V6c | 无第三 hero-* 文件（steiger 前缀预算） | ✅ | `ls packages/core/src/tools/fork/marketing/`（2026-08-31）：hero 前缀恰 2 件（hero-scaffold.ts、hero-tools.ts）；`bun run check:arch` exit 0 |
| V6d | zh-cn 外置 HERO_TEXTS；texts.ts 不沾 hero | ✅ | hero-scaffold.ts:41-62 全部画布/用户文案入 HERO_TEXTS as const；`git diff texts.ts | grep -i hero` = 0 命中（T53 独占纪律守住） |
| V6e | git status 无越界改动 | ✅ | `git status --porcelain`（2026-08-31）：T57 新增恰 3 件（hero-scaffold.ts、hero-tools.ts、prepare-hero-scaffold.test.ts）；集成面 fork/index.ts + fork/marketing/index.ts diff 经核——T57 仅贡献 HERO_TOOLS 行（同 diff 内 SETUP_TOOLS 行属 T53 集成）；其余 M/?? 文件均可归属 T53/T56 并行波次（setup-*、ask-user-question-*、i18n fork locales、ChatPanel/ChatMessage、zones.json、tracker/_index） |
| V7 | 门禁 | ✅ | 全部 unpiped 直读退出码（2026-08-31）：`bun run lint` exit 0（6 warnings / 0 errors，1413 文件）；`bun run typecheck` exit 0（tsgo --noEmit + vue-tsc ×2）；`bun run test:dupes` exit 0（0 clones）；`bun run check:arch` exit 0（steiger No problems found）；`bun run test:type-shapes` exit 0；补充并行波次覆盖面：`check:zones` / `check:tasks` / `check:i18n` / `check:bindings` 均 exit 0 |
| V8 | 信封钉扎 | ✅ | 成功信封恰 8 键 {scaffold_id,width,height,underlap_px,transition_zone_px,clamped,cloned_children,note}——测试 :410-419 排序键断言 + 类型 :99-110；错误面恰 {error,message} 两键——err() 帮手 :105-107 钉扎；错误码并集 :83-91 = invalid_params/root_not_found/root_not_frame/root_not_auto_layout/root_without_page/source_not_found/source_not_frame/source_empty |

## 3. V4 偏差评估：重调不再重定位（旧「root 动则 scaffold 跟动」语义移除）

- **旧行为**：upsert 把 `...geometry`（含 x/y = root.x+root.width+100）整体写回（旧 :112-117、:166-169），旧测试 :295「moves the scaffold when the root moved between calls」钉扎此语义。
- **新行为**：findPlacementPosition 仅在 CREATE 分支生效（hero-scaffold.ts:319 先读位再建帧；:223-231 既有分支只写 width/height/fills，不碰 x/y）。
- **健全性论证**：S3 §9 L124 钉死统一放置策略 = findPlacementPosition 读**整页 union bounds** 右 +100（placement.ts:43-48 实测）。scaffold 一旦建出即进入页面 bounds——若重调重算位置，新位置 = 自身右缘 +100，**每次重调右漂 自身宽+100**，反馈环成立。旧方案无此问题是因为定位锚是 root（不含 scaffold），但旧锚已被统一策略取代。故「重调不重定位」不是省事裁剪，而是采用统一放置策略的**必然推论**；且下游无任何消费者读 scaffold 的 x/y（T58 只读 pluginData 几何记录，S3 §8 L111）。T57-plan §1 定谳 2/3 已批准此偏差；幂等测试 ④（:332-376）钉扎：源整体右移至 x=2000 后重调，scaffold.x/y 不变（:353-354）、记录刷新、旧克隆整体替换。**结论：偏差成立，无需修补。**

## 4. 边界与未核项

- **I1（观察，非阻断）**：hero-tools.ts:27 description 含一句排序依赖「call prepare_hero_scaffold BEFORE compose_backdrop and pass the same underlap_px」。S3 §7 L104 的字面约束对象是 **note**（指令链三分解体 → workflow 文件），note 本体经测试 ⑧ 钉扎零残留；description 此句是硬契约依赖声明（T58 缺记录结构化报错本就引导回 scaffold），且旧 description 的完整配方链（"Next steps… generate_image with replace_id=… references=[{composite:true}]… then compose_backdrop({…})"）已整体删除——新 description 不再出现 generate_image/replace_id。评定为可接受的契约陈述，非指令链残留；若后续口径要求 description 也不提前后序，可一行删除，不构成本波次阻断。
- **I2（信息）**：plan §3.4「CI 逐 push 口径绿」超出本核验授权（禁止 commit/push），未核；九门禁中 lint/typecheck/test:dupes/check:arch/test:type-shapes + 补充四门（zones/tasks/i18n/bindings）均本地 exit 0。
- **I3（信息）**：工作树为未提交态且混入 T53/T56 并行改动；本核验仅审 V6e 列出的 T57 文件面 + 两集成文件 diff，其余波次由各任务自核。
- **I4（信息）**：旧测试拓扑平移核对——旧文件四组（validation 5 例 / geometry and topology 6 例 / idempotent re-call 4 例 / params 1 例）映射进新文件 ⑦③①②⑥④⑤⑧ 组；旧 :118「HeroContent missing」路径按 S3 §10 L140 改写口径被 source 校验取代（source_not_found/not_frame/empty），旧 :213「note 指向 generate_image/compose_backdrop」断言按 §7 L104 反向钉扎（不得包含），旧 :295 移动语义按 §3 评估不迁——三处均为规格内处置，非遗漏。

## 5. 总结论

**可以收口**（V1-V8 全绿；I1 为观察项不阻断；CI 逐 push 与 push 动作本身按波次纪律归主 agent/集成期）。

<!--
  写作纪律（改本文前必读）：
  - 事实性声明必须附核验命令 + 日期，否则标为【假设】
  - 本文只保留当前态，不保留修正历史
  - 详细规则见 docs/rebuild/05-process.md §4
-->

# T58 核验 · compose_backdrop 移植（消费 T57 几何记录）

> **状态**：✅ 已完成（2026-09-01 收口） | **核验人**：独立核验 agent（未参与实现）
> **核验基准**：T58-plan.md §2/§3/§4 + T58-self-check.md + 仓外 doc/S3-tool-contracts-spec.md §8（:107-122）+ 实现源码；实现为工作树未提交态（`git status` 2026-09-01，分支 rebuild/mode-arch）
> **实测日志**（仓外）：`D:\Desktop\AgentLearn\00_DIYProjects\0720openpencil\doc\T58-verify-*.log`

## 1. 核验范围

compose-backdrop.ts / compose-tools.ts / compose-backdrop.test.ts 三件套、S3 §8 三条契约修订逐字对照、几何消费链（readHeroGeometry 唯一来源 / 缺记录报错 / transitionZonePx 驱动）、隐式收养与 stray 侦测物理删除、采样 seam lazy import、note 信封、fork/index.ts + marketing/index.ts 注册、四门禁 unpiped 复跑。

## 2. 逐项核验（2026-09-01 实测，除注明外命令均在仓根执行）

| # | 核验项 | 结果 | 证据 |
|---|---|---|---|
| V1 | 交付面：compose-backdrop.ts + compose-tools.ts + 测试三件套 | ✅ | `wc -l packages/core/src/tools/fork/marketing/compose-{backdrop,tools}.ts tests/engine/rebuild/marketing/compose-backdrop.test.ts` → 856 / 65 / 865 行（self-check C1 报 859 行 core，实测 856——差异 3 行属落盘时序，非回退）；`grep -c "test(" compose-backdrop.test.ts` = 46，describe 段 ①-⑩ + 采样纯函数 11 个区块齐全 |
| V2 | S3 §8 修订 1：hero_image_from = 当选候选节点，幂等采纳不重新生成 | ✅ | compose-tools.ts:33-36 注册 `hero_image_from` 参数；compose-backdrop.ts `transferImageFill`（:470-488）幂等容忍——HeroImg 已有 IMAGE fill 时 `{transferred:false}` 不重复转移（测试 ⑦「幂等不重复转移」:568 起覆盖，含 HeroContent 来源清空语义） |
| V3 | S3 §8 修订 2：几何只从 scaffold pluginData 记录读；缺记录/畸形 → 结构化报错引导回 scaffold；transitionZonePx 驱动过渡带与采样带 | ✅ | `grep -rn readHeroGeometry packages/core/src src` → 唯一消费点 compose-backdrop.ts:417（另 hero-scaffold.ts:140 定义）；缺记录/畸形 → `geometry_missing`（:418-420），文案 `geometryMissing`（COMPOSE_TEXTS:75-76）含「请重新调用 prepare_hero_scaffold……跳步 = 显式失败」；`overlapPx = record.transitionZonePx`（:437）驱动 overlayY（:795 `heroImgHeight - overlapPx`）与采样 bandSize（:792 `resolveHeroColor(…, overlapPx, sampler)`）；测试 ③ :314-330 缺记录/畸形两例 + ⑥ :456-491 钉 bandSize 100/50 两档与 middle stop 位置跟随 |
| V4 | S3 §8 修订 3：隐式收养 + stray-image 侦测删除，替换为结构化报错（逐字）；discard_hero 显式路径 | ✅ | `grep -n "stray\|adopt" compose-backdrop.ts compose-tools.ts compose-backdrop.test.ts` → 仅注释与「断言全删」说明性文字，无可执行代码；`COMPOSE_TEXTS.heroContentHasImage`（:80-81）=「HeroContent 含图像填充且未指定 hero_image_from：请指定来源，或传 discard_hero:true 确认丢弃。」与 S3 §8 修订 3 引文逐字一致（句末句号除外）；防护逻辑 :762-768；`discard_hero` 与 `hero_image_from` 互斥校验 :306-308（self-check C3 记录的新增互斥）；测试 ⑧ :687-726 覆盖报错与丢弃路径 |
| V5 | 散参删除：hero_height/hero_bleed/canvas_width 不进 schema | ✅ | `grep -n "hero_height\|hero_bleed\|canvas_width" compose-tools.ts` 仅注释；测试 ① :177-180 `not.toHaveProperty` 三钉扎；信封侧 `hero_height` 是结果字段（ComposeBackdropSuccess:151），非入参 |
| V6 | 不变量平移：kiss 三明治 z 序 / HeroImg=slot+underlap / HeroContent fills=[] / canvas_height 缺省跟随根高 / 颜色降级链 / hex 拒收进 note | ✅ | z 序重钉 :778/:784/:788/:809/:824（BackgroundLayer[0]/HeroContent[1]，层内 BaseWash<HeroImg<BackdropOverlay），测试 ④ :346-369 三钉扎；HeroImg 高 = 记录 height、HeroContent = height−underlapPx（:434-435），测试 ③ :296-306；HeroContent 强制 `fills: []`（:611/:622），测试 ④ :365；canvas_height 缺省 = root.height（:741），测试 ③ :332-341；降级链 explicit>sampled>fallback（:502-517），hex 拒收进 note WARNING（:315-320, :698-700），测试 ⑥ :521-537 |
| V7 | 采样 seam：sampler 第 3 参注入；真实现 lazy import CanvasKit 且字节未加载前短路 | ✅ | 签名 `composeBackdrop(figma, args, sampler = sampleHeroBottomBand)`（:725-729）；`sampleHeroBottomBand` :241-276 中 `await import('#core/canvaskit')`（:247）位于 imageHash/bytes 两道短路（:243-245）之后；测试 ⑥ :539-550「缺省真采样器 seam」不传 sampler 实测白兜底不触 CanvasKit |
| V8 | note 瘦身：13 键信封、underlap_px/overlap_px 取代 hero_bleed、无指令链 | ✅ | ComposeBackdropSuccess（:142-158）恰 13 键，测试 ⑩ :813-827 `Object.keys(built).sort()` 全键钉扎 + :831-834 负断言 `Re-call`/`Verify with look`/`generate_image`/`prepare_hero_scaffold` 均不出现；WARNING 面 = rootWidth/heroColorRejected/heightDefaulted/sampleError（buildFactsNote :668-716） |
| V9 | 注册：marketing/index.ts re-export + fork/index.ts 展开 + W3 登记者注释 | ✅ | marketing/index.ts:15 `export { COMPOSE_TOOLS }`；fork/index.ts:14-15 注释「W3 登记者：COMPOSE_TOOLS（T58 compose_backdrop）…」+ :23 import + :35 `...COMPOSE_TOOLS` 展开进 FORK_TOOLS |
| V10 | 文件布局红线：compose 前缀落 2、采样纯函数随迁不新增 sample-* 文件 | ✅ | `ls packages/core/src/tools/fork/marketing/` → compose×2（hero×2/setup×2 并列）；bottomBandRegion/averageRegion/bandColorToHex 随迁 compose-backdrop.ts :181-235，仅 bottom 方向特化（self-check 修正记录 1，无全方向死分支） |
| V11 | 门禁 unpiped：bun test tests/engine/rebuild/ | ✅ | `bun test tests/engine/rebuild/ > …\doc\T58-verify-bun-test.log 2>&1`，随后 `echo EXIT=$?` 追加入同一日志 → EXIT=0，323 pass / 0 fail / 26 files（含新文件 46 用例；self-check C8 的 323/323 吻合） |
| V12 | 门禁 unpiped：bun run smoke:pi | ✅ | `bun run smoke:pi > …\doc\T58-verify-smoke-pi.log 2>&1` → EXIT=0；五个子冒烟 6+12+14+25+19 = 76 passed / 0 failed（`grep -c ✅` = 76）。plan §4 写的 19/19 是立项时旧计数，当前脚本面已扩为 76 条（package.json:62 五段 && 链实测） |
| V13 | 门禁：oxlint type-aware + oxfmt --check（触碰文件） | ✅ | `bunx oxlint -c oxlint.json --type-aware --type-check <17 触碰源文件>` → EXIT=0，0 errors / 2 warnings（max-lines：compose-backdrop.ts 856、brief.ts 879——warn 级不拦，self-check 修正记录 5 已在案）；`bunx oxfmt --check .oxfmtrc.json <25 触碰文件含测试>` → EXIT=0「All matched files use the correct format」（日志 T58-verify-oxlint/oxfmt.log） |

## 3. 非阻塞问题与边界

1. **测试头注过时**：compose-backdrop.test.ts:21-22 仍写「COMPOSE_TOOLS 未注册进 FORK_TOOLS（fork/index.ts 是集成期主 agent 领土）」——集成已由主 agent 完成（V9），注释未同步，cosmetic。
2. **self-check C1 行数微差**：报 859 行实测 856（wc -l），3 行差属文档落盘时序，非事实性回退。
3. **plan §4 smoke 计数过时**：立项写 19/19，现脚本面 76/76（T62 自检已按 76 填报），计数漂移非本任务引入。
4. **真采样器 CanvasKit 像素路径无集成测试**：契约内分期（pure 函数 + 注入 seam 覆盖，浏览器冒烟归 W4），self-check §3 已登记。
5. **max-lines 859→856 仍 >600（warn）**：结构观察点在案，门禁不拦。
6. **未核项**：全量 `bun run check` 九门禁套件（typecheck/arch/dupes/zones 等）本轮未逐项复跑（授权范围 = bun test + smoke:pi + oxlint/oxfmt 触碰文件）；zones.json diff 实测仅有 T61 的 ownedFiles 增删（ChatModeSelect/ChatStyleProfileSelect 移除 + 7 个 chat 组件新增），无 T58 新增区——与 plan §4.3「零新增」一致。

## 4. 总结论

**PASS**（V1-V13 全绿）：S3 §8 三条修订逐字落实（含 heroContentHasImage 报错文案与规格引文一致），几何消费严格单源（readHeroGeometry 唯一消费点 + 缺记录 geometry_missing 引导回 scaffold），transitionZonePx 同时驱动渐变过渡带与采样 bandSize（测试 100/50 两档钉扎），隐式收养/stray 代码零残留，采样 seam lazy import 且短路序正确，note 13 键无指令链，注册两级接线 + W3 登记者注释齐。四门禁 unpiped 全 EXIT=0。余量仅 §3 所列非阻塞项。

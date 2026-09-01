<!--
  写作纪律（改本文前必读）：
  - 事实性声明必须附核验命令 + 日期，否则标为【假设】
  - 本文只保留当前态，不保留修正历史
  - 详细规则见 docs/rebuild/05-process.md §4
-->

# T65 核验 · UI 交互修整批（owner 12 条拍板落地）

> **状态**：✅ PASS（2026-09-01 核验，无阻塞项） | **核验人**：独立核验 subagent（未参与实现）
> **核验基准**：T65-plan.md §2/§3/§5 + T65-self-check.md + X↔Y 共享契约双侧对账；实现为工作树未提交态（`git status` 2026-09-01，分支 rebuild/mode-arch，HEAD=915bccb9 T61）
> **职责边界**：只读核验 + 本报告；未 commit/push、未改任何源码

## 1. 逐项核验（2026-09-01 实测，除注明外命令均在仓根执行）

| # | 核验项 | 结果 | 证据 |
|---|---|---|---|
| 1a | 信封逐字格式两侧一致 | ✅ | 后端剥离正则 `src/app/ai/pi-backend/active-design-host.ts:56`：`/^\[新建意图确认(?:\s+modeId=([^\]\s]+))?(?:\s+profileId=([^\]\s]+))?(?:\s+canvas=([^\]\s]+))?\]\r?$/`——字段顺序 modeId→profileId→canvas、全部可缺省、值域 `[^\]\s]+`、`\r?$` 容忍 CRLF。前端序列化 `src/components/chat/active-design.ts:52-62` serializeNewIntentEnvelope：同序 push、falsy 省略、空参产出 `[新建意图确认]`（正则全组缺席可匹配）；发送点 ChatPanel.vue:384-394 信封置于消息首行（宿主只剥首行，host.ts:66-84）。测试钉扎 tests/engine/rebuild/pi-backend/active-design-host.test.ts:168-194（三字段全带/跳中/仅 canvas/值含空白不剥离/`\r\n` 剥离） |
| 1b | 系统提示行逐字注入 | ✅ | `packages/core/src/tools/fork/marketing/texts.ts:90-98` newIntentConfirmed 产出逐字 `用户已为本次新建确认参数：modeId=… profileId=… 尺寸=…（选择即锁定，不得覆盖）`，缺省字段省略、全缺省返空串；宿主 prepareTurn host.ts:386-398——剥离后置旗标 + `confirmedLine !== ''` 才 push 进 intentNotices → assembleTurn extraNotices 进 contextLines（host.ts:119）。测试 tests/engine/rebuild/pi-backend/active-design-host.test.ts:223-227「空槽+全字段信封 → contextLines 恰为确认参数行（格式逐字钉扎）」 |
| 1c | CanvasSizePreset 形状单源 | ✅ | core `packages/core/src/tools/fork/marketing/setup.ts:71-74` `{label, canvas}`；前端别名不双写：src/components/chat/active-design.ts:68 `export type NewIntentSizeChoice = CanvasSizePreset`（NewIntentPartData.sizeChoices :120 用之）；后端 src/app/ai/pi-backend/studio/types.ts:19 `StudioSizePreset = CanvasSizePreset`、studio/manifest.ts:15 `PiStudioModeEntry = StudioMode`——三处全为 import type 别名。`bun run test:type-shapes` exit 0（2026-09-01：「No duplicate object type shapes found.」） |
| 1d | manifest modes[].sizes? 投影 vs 前端消费 | ✅ | 数据面链：types.ts:42 StudioWorkflow.sizes? / :82 StudioMode.sizes? → validate.ts parseSizes:91-132 → studio/manifest.ts:49 `...(mode.sizes ? { sizes: mode.sizes } : {})` → setup-catalog.ts:41 同形透传 catalogJSON。前端链：mode-selection.ts:50 `piStudioManifest: Ref<PiStudioManifest \| null>`（共享类型 import :41）→ ChatPanel.vue:326-332 `modeSizeChoices(modeEntry)` 填 sizeChoices → ChatNewIntentCard.vue:222 渲染预设 chips（label+canvas）。字段名 sizes 全链一致 |
| 2 | zones.json 合规 | ✅ | `bun run check:zones` exit 0（2026-09-01：「clean: 81 modified (all registered), 509 added (owned), 1019 deleted, 0 renamed, base 88c10770」）。`git diff HEAD -- tools/zone-registry/zones.json` 实证：ownedRoots += `src/components/chat/`；ownedFiles += `src/components/ChatPanel.vue`、移除 T61 七条目+AskUserQuestionCard 共 8 条；pendingReclass 移除 `src/components/chat/` 与 `src/components/ChatPanel.vue` 两条目（现存 `src/app/ai/chat/` 为旧 AI 模块条目，非本批 chat 组件面）；patch P4/P5/P47 退役；`src/components/chat/tool-state.ts` 移出 T32 tarball.paths；$comment 含「P4/P5/P47: removed by T65 (2026-09-01)…」注记 |
| 3 | 三旧面板删除完整 | ✅ | `git grep -n "ChatGalleryPanel" / "ChatDesignListPanel" / "ChatBriefPanel" -- src packages tests` 三查全 rc=1 零命中（2026-09-01）；`git status` 三文件 `D` 在案；`find src packages tests -name "*Gallery*" -o -name "*DesignList*" -o -name "*BriefPanel*"` 零结果；zones.json ownedFiles 旧条目已移除（见 #2 diff） |
| 4 | 红线：无 type 轴复活 | ✅ | `git grep -rni "typeId\|blueprint" -- packages/core/src/tools/fork/marketing src/app/ai/pi-backend/studio` 仅 3 处命中，全为 active-design.ts:6-7/:52 注释中的 T62 删除历史说明（「typeId 已被 T62 并行删除」），零代码命中 |
| 5a | resolveSize 优先序 | ✅ | setup.ts:191-208：`args.canvas !== undefined` → parse（非法 → invalid_canvas :197-198）→ `mode?.sizes?.[0]` 预设（:202-205）→ `{width: 750, height: null}` 缺省（:207）。测试 setup.test.ts:351-386 三态+优先序 describe 在案 |
| 5b | invalid_canvas 触发 | ✅ | setup.ts:120 错误码表七码（brief_not_found/ambiguous_brief/unknown_mode/unknown_profile/invalid_canvas/unconfirmed_new_intent/catalog_unavailable）；resolveSize :196-198 非法 → `{error:'invalid_canvas'}`；setup-tool.ts diff 实证 canvas 参数进 schema（description 钉扎非法 → invalid_canvas 不建框）。测试 setup.test.ts:389-393 四种非法串（非数字宽/缺 x/三段/空串）→ invalid_canvas 且无框落地 |
| 5c | parseSizes 校验 | ✅ | validate.ts:91-132：sizes 非数组或空 → issue 整条不注册（:97-103）；非键值条目/空 label/canvas 过 core parseCanvasSize 单源校验（:123），逐条记 issue；`issues.length === before ? {sizes} : {}`（:132）——任一非法整条不注册 |
| 5d | rebuild 测试全过 | ✅ | `bun test ./tests/engine/rebuild`（2026-09-01 unpiped）：336 pass / 0 fail / 1386 expect() calls / 26 files，与预期基数 336 一致 |
| 6a | ChatContextBar 挂 header 三合一 | ✅ | ChatPanel.vue:581-584 `<ChatContextBar>` 挂 chat-session-bar header（import :34）；组件 644 行三节：①当前目标卡（:349-376）②设计区列表（:493-557，active 徽标+点击定位不切换 :101-107+显式「设为当前」走端点 :110-126）③需求单列表+详情编辑（:559-638）；trigger=当前设计名（:310 `active?.name ?? panelsText.contextTriggerEmpty`），空槽词 zh-cn.ts:42 `contextTriggerEmpty: '新设计'` |
| 6b | ChatInput 瘦身 | ✅ | ChatInput.vue 全读：输入条仅 textarea + ChatModeChips（:141）+ 模型名 label（:133-138 chat-pi-model-label，拍板③暂留）+ 设置/停止/发送钮；无任何面板 trigger 残留（git grep 三旧面板名零命中，见 #3） |
| 6c | data-context-switch 渲染分支 | ✅ | ChatMessage.vue:91-98 判定+载荷归一；模板 :173-182 分割线样式（`h-px flex-1 bg-border` 双侧 + contextSwitchLine 文本，非气泡）；ChatPanel.vue:481-489 handleContextSwitch 端点 200 后 appendHostMessage 注入；同意路径 :470-474 同形态替换原系统行 |
| 6d | 新建需求单调用方 | ✅ | ChatContextBar.vue:164 `createBriefOnPage(store, createDraft.value)`（import :41）；实现 src/components/chat/active-design.ts:258-268——core createBrief 原语经 makeFigmaFromStore 桥直调 + findPlacementPosition 落位，不触发 setup_design |
| 6e | 防丢=行内确认条 | ✅ | `grep -rn "window.confirm" src/components/` 仅 ChatContextBar.vue:18 注释命中（说明为何不用的注记），零代码调用；行内确认条实现 ChatContextBar.vue:253-295（pendingDiscard 'close'/'back' + detailDirty/createDirty 守卫 + :317-346 确认条 UI，popover 保持打开） |
| 6f | i18n 合规 + gallery 键清除 | ✅ | `bun run check:i18n` exit 0（2026-09-01：「All locale files are in sync.」）；`grep -rni "gallery" src/app/i18n/fork/` 仅 fork/index.ts:61 与 locales/en.ts:76 两处注释命中（删除注记），零活键 |
| 7 | 门禁复跑（unpiped） | ✅ | 2026-09-01 逐一复跑：`bun run check:zones` exit 0；`bun run typecheck`（tsgo --noEmit && vue-tsc ×2）exit 0；`bun run test:type-shapes` exit 0；`bun run check:i18n` exit 0。耗时门禁（lint/dupes/smoke:pi）依主 agent 已跑绿声明未重跑（self-check §2 表在案） |
| 8 | SFC 完整性 | ✅ | @vue/compiler-sfc@3.5.41（node_modules/.bun 路径实证）parse+compileTemplate+compileScript 五件全零错误：ChatContextBar.vue / ChatNewIntentCard.vue / ChatInput.vue / ChatMessage.vue / ChatModeChips.vue（2026-09-01，parse errors [] / template errors [] / script compile ok ×5） |
| 9 | 三件套齐 + 事实抽查 | ✅ | docs/rebuild/tasks/T65-plan.md / T65-self-check.md 存在且与实现一致。行号抽查 6/6 真实：setup.ts:71 CanvasSizePreset✓ :107 canvas✓ :191 resolveSize✓；active-design.ts:140 CONTEXT_SWITCH_PART_TYPE✓ :258 createBriefOnPage✓；active-design-host.ts:56 NEW_INTENT_MARKER✓。longform.md frontmatter :6-10 sizes=[电商详情长图 750x, 小红书长图 1080x]✓ |

## 2. 非阻塞问题（分级：cosmetic / observation，无 blocker）

1. **【cosmetic】self-check §1 路径书写偏差**：「registry/manifest.ts:49」实际文件为 `src/app/ai/pi-backend/studio/manifest.ts:49`（无 registry/ 中间层；函数 toStudioManifest 语义即 registry→manifest 投影，行号属实）。
2. **【cosmetic】parseCanvasSize 正则记述**：self-check/plan 写 `/^\d+x(\d+)?$/`；core 实现 setup.ts:77 为 `/^(\d+)x(\d+)?$/`（width 多一捕获组，校验语义全等；前端 CANVAS_VALUE_PATTERN active-design.ts:71 恰为所述形态）。
3. **【observation】序列化侧不校验值域**：serializeNewIntentEnvelope 对含空白/`]` 的值不做防御（宿主正则不匹配则信封泄漏为正文）；值源为 manifest filename id 实际不可达，且单一校验点在 core invalid_canvas（self-check §3 偏差③同原则已登记）。
4. **【observation】tool-state.ts byte-identical 声明未独立复算**：self-check 称 hash 806591eb 双侧实证；本核验以 `check:zones` exit 0 侧证（该条目已移出 tarball 约束面，且若漂移 base-diff 规则会判违规）。
5. **【observation】zones 计数漂移**：self-check §2 记「508 added」，本核验复跑为「509 added」——差 1 系三件套/本报告自身写入时序（docs/ 为 ownedRoot），非背离。

## 3. 未核项（按契约归后续批次）

- Playwright 交互冒烟（三合一面板/新建需求单/分割线回执/尺寸 chips 选择）→ W4 T-D 批次（plan §5.4 / self-check §4 在案）。
- lint/dupes/smoke:pi 三耗时门禁采信主 agent 绿跑声明（self-check §2），本轮未重跑。

## 4. 总结论

**PASS**：核验清单 9 项全绿——X↔Y 契约四项（信封逐字/系统提示行逐字/CanvasSizePreset 单源/manifest sizes 投影链）双侧对账一致；zones.json 转 owned 登记与 check:zones 合规；三旧面板删除零残留；type 轴红线零触犯；后端优先序/invalid_canvas/parseSizes 读码与 336 测试互证；前端三合一/瘦身/分割线/新建需求单/防丢/i18n 读码全符；四门禁 unpiped exit 0；SFC 五件编译零错误；三件套事实抽查 6/6 真实。残留仅 §2 五项 cosmetic/observation，不阻塞提交。

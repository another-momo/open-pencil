<!--
  写作纪律（改本文前必读）：
  - 事实性声明必须附核验命令 + 日期，否则标为【假设】
  - 本文只保留当前态，不保留修正历史
  - 详细规则见 docs/rebuild/05-process.md §4
-->

# T62 核验 · type 蓝图机制删除（过度设计，owner 2026-09-01 v8 拍板）

> **状态**：✅ 已完成（2026-09-01 收口） | **核验人**：独立核验 agent（未参与实现）
> **核验基准**：T62-plan.md §1/§2/§4 + T62-self-check.md + setup.ts/studio/prompt-overlay/longform.md 源码与 `git diff HEAD`；实现为工作树未提交态（`git status` 2026-09-01，分支 rebuild/mode-arch）
> **实测日志**（仓外）：`D:\Desktop\AgentLearn\00_DIYProjects\0720openpencil\doc\T62-verify-*.log`

## 1. 核验范围

grep 硬条复跑与白名单逐条核对、setup.ts 切除段（:145-242）与外溢 4 处现状、九码收六码、validation order、catalog 投影形状、longform.md frontmatter canvas 取值证据复核（对照 HEAD 原三 type 尺寸）、schemaVersion 未 bump、PiStudioModeEntry 别名、prompt-overlay.ts 段清理 + system-prompt-marketing.md 死引用删除、测试改写面、四门禁 unpiped 复跑。

## 2. 逐项核验（2026-09-01 实测，除注明外命令均在仓根执行）

| # | 核验项 | 结果 | 证据 |
|---|---|---|---|
| V1 | grep 硬条：`typeId\|blueprint\|蓝图\|Blueprint` 全仓复跑 | ✅（白名单口径需补记，见 §3-1） | `grep -rn "typeId\|blueprint\|蓝图\|Blueprint" src packages/*/src tests spikes`（排除 node_modules，日志 T62-verify-grep.log）→ 14 行命中，逐条分类：① 字体 budget blueprint 措辞 2 处（tests/engine/text/fonts/piece-cache.test.ts:44、memory.test.ts:129，self-check 白名单在案）；② kiwi schema 同名字段 3 处（fig.kiwi hotspotBlueprintId/blueprintID，二进制格式字段，无关同名）；③ T62/T60 删除注记注释 5 处（mode-selection.ts:11、active-design.ts:6-7/52、active-design.test.ts:11）；④ 旧残留键容忍测试 3 处（active-design.test.ts:221/225/227，含 `setSharedPluginData(…, 'typeId', 'legacy-type')`——定谳 2「读穿侧容忍旧画布 typeId 残留键」的显式钉扎）。**无任何存活蓝图机制代码**；②③④ 未列入 self-check C3 白名单（口径不完整，非违例，见 §3-1） |
| V2 | setup.ts 切除段 :145-242 整段删除 + 外溢 4 处 | ✅ | `git show HEAD:…/setup.ts | grep -c "typeId\|blueprint\|Blueprint"` = 39（含 :145-242 parseBlueprintSize/ResolvedBlueprint/resolveBlueprint 与 type 校验段，HEAD 实测在案）；现文件 grep 同模式 0 命中（EXIT=1）。现 setup.ts 369 行：校验段 :130-179 仅 validateProfileId + resolveMode（mode→profile 两级）；信封 :82-98 无 typeId；落盘 :273-279 五键（role/modeId/profileId/briefId/schemaVersion）无 typeId；读穿 toDesignRef :322-330 三元组；命名域 nextDesignRootName :188-203 去重域仅 modeId（注释 :186 明记 T62 定谳 2） |
| V3 | 九码收六码 | ✅ | SetupDesignErrorCode（:82-88）恰六码：brief_not_found/ambiguous_brief/unknown_mode/unknown_profile/unconfirmed_new_intent/catalog_unavailable；type_not_in_mode/type_forbidden/type_required 三码与其文案（texts.ts typeNotInMode/typeForbidden/typeRequired）均随 diff 删除（`git diff HEAD -- texts.ts` 实测三条 `-` 段） |
| V4 | validation order = confirmedNewIntent → brief → mode → profile；general 恒过 | ✅ | setupDesign :239-241 意图拦截 → :243-261 brief 三态 → :263 resolveMode（内 :160-167 general 恒过短路、:172-175 unknown_mode、:161/:176 validateProfileId）；顺序与定谳 5 逐环吻合 |
| V5 | catalog 投影收为 {modes:[{id,label}], profileIds[]} | ✅ | setup-catalog.ts:20-26 SetupCatalogProjection 恰两键；buildSetupCatalog :33-39 只映射 id/label + profileIds；core 侧 SetupCatalog（setup.ts:67-70）形状全等；service.ts:213 注入接线 `catalogJSON: () => JSON.stringify(buildSetupCatalog(...))` 未断 |
| V6 | 尺寸语义重钉：缺省 750 宽 + HUG；longform.md frontmatter canvas 取值证据 | ✅（取值按 plan 偏离条款落 750x，证据在案） | setup.ts:54-57 常量 750/400 + resolveMode :165/:178 恒 `{width:750, height:null}`；信封 size 语义不变（:103-104）。`git diff HEAD -- workflows/longform.md`：HEAD 原三 type 尺寸 = ecommerce_detail 750x / product_long 750x / xiaohongshu_long 1080x（全 HUG，diff `-` 段逐行在案），主蓝图（首列）= 750x → 现 frontmatter `canvas: 750x`（:6）；plan 定谳 1 默认写 750x2000 但授权「若主蓝图非此值则以原主蓝图值为准并记录证据」——self-check C4 已记录同口径证据，取值合规。`## type 蓝图` 节整段删除、改 mode 级「画布尺寸」节（:15-20，最小改写，精品重写归 T-C2） |
| V7 | schemaVersion 未 bump；BRIEF_SCHEMA_VERSION 机制不动 | ✅ | `git show HEAD:…/brief.ts` 与现文件均为 `BRIEF_SCHEMA_VERSION = '1'`（:42），diff 无 SCHEMA_VERSION 行变更；DESIGN_TYPE_KEY 已从 brief.ts 删除（现文件 :61-63 仅 MODE/PROFILE/BRIEF 三键），读穿容忍由 active-design 侧钉扎（V1-④） |
| V8 | 设计身份 = 三元组 {modeId, profileId, briefId} | ✅ | setup.ts:16/21-23/273-279、MarketingDesignRef :307-314、texts.ts missingProjection 注释「四元组→三元组」改、brief-edit.ts 投影 typeId 字段删（diff 实测 :70-83/:187-198 三处 `-`）、brief.test.ts :307-358 四元组→三元组断言改写（diff 在案）；`grep -rn 四元组 packages/core/src/tools/fork src/app/ai/pi-backend` 零命中 |
| V9 | PiStudioModeEntry 别名不双写 | ✅ | studio/manifest.ts:15 `export type PiStudioModeEntry = StudioMode`（注释 :13-14 记 type-shapes 撞型缘由，与 self-check 修正记录 4 吻合）；types.ts StudioWorkflow（:26-36）/StudioMode（:66-71）无 types 面；studio/index.ts 导出表去 StudioWorkflowType（diff `-` 行在案） |
| V10 | studio validate/registry/parse 切除 | ✅ | validate.ts:55-83 validateWorkflow 仅 step_budget + subtitle（types/SIZE_RE/parseWorkflowType 段整段删，注释 :55-56 记 T62 + canvas 键归 T-C）；registry.ts diff：:166 destructure 去 types、:177 注册对象去 types；parse.ts:82-84 三级索引保留、注释口径改写（diff 实测） |
| V11 | prompt-overlay.ts material types 段 + T24 遗留整段删 | ✅ | `git diff HEAD -- prompt-overlay.ts`：StudioWorkflowType import 删、studioOverlayInput 收为仅 profiles、buildMarketingOverlay 的 types 列表段与 `setup_material_type` fallback 段整段删；空输出语义改 `parts.length > 0 ? … : ''`（无内容返回空串） |
| V12 | system-prompt-marketing.md 死引用最小删除 | ✅ | diff 实测：Phase 0「Material Type Setup」段（含 setup_material_type/adopted/custom 尺寸指引）整段重写为「Design Setup」；「Material types in the current brand」引用清除；:153 设计状态笔记去 material type；现文件 `grep -in "material type\|setup_material"` EXIT=1 零命中（残留「type-scale」是字阶术语，无关） |
| V13 | 测试改写面 | ✅ | setup.test.ts diff：⑦ typeId 三态整例删、①② 重钉「缺省尺寸建框 750 宽 + HUG 初始 400 / 全 mode 同口径」（:93-119）、信封/落盘/读穿/命名/注入缝去 typeId；registry.test.ts C3 改「旧 types 键残留不影响注册；step_budget 非正整数 → 失败」；manifest.test.ts 改「modes 收两级…无 types 数据面」+ overlay 适配仅 profiles；builtin-assets.test.ts 改「T62 后无 types 面、画布尺寸节非空」（`expect('types' in longform).toBe(false)` + `sections['画布尺寸']`）；brief-tools.test.ts 接口投影 typeId 删；t24 smoke 头注与 manifest 断言同步（diff 在案） |
| V14 | 门禁 unpiped：bun test tests/engine/rebuild/ | ✅ | `bun test tests/engine/rebuild/ > …\doc\T62-verify-bun-test.log 2>&1`，`echo EXIT=$?` 追加 → EXIT=0，323 pass / 0 fail / 26 files（self-check C6 的 323/323 吻合） |
| V15 | 门禁 unpiped：bun run smoke:pi | ✅ | EXIT=0；6+12+14+25+19 = 76 passed / 0 failed（T62-verify-smoke-pi.log；与 self-check C6 的 76/76 吻合） |
| V16 | 门禁：oxlint type-aware + oxfmt --check（触碰文件） | ✅ | 源文件 17 个 oxlint EXIT=0（0 err / 2 warn = max-lines 两条，均非本任务引入面）；测试 6 文件 oxlint EXIT=0（0 err / 1 warn）；oxfmt --check 25 文件 EXIT=0。注：spikes/ 不在仓 lint 脚本 scope（package.json:27-28 目录清单无 spikes/），t24 smoke 单独 lint 出的 6 err 属 scope 外既存模式（no-console/no-promise-executor-return 等），非本任务引入（T62-verify-oxlint-tests.log 首版含该文件已复跑剔除） |

## 3. 非阻塞问题与边界

1. **grep 白名单口径不完整**：self-check C3 称白名单 = 字体两处 + 仓外 doc/，实测另有 kiwi schema 同名字段 3 处、T62/T60 删除注记注释 5 处、active-design.test.ts 残留键容忍钉扎 3 处（V1 分类②③④）。全部是说明性/无关同名/定谳 2 授权钉扎，非存活机制；但「触碰文件零命中」表述不精确（mode-selection.ts、active-design.ts 均为工作树触碰文件且有注释命中）。plan §4.1 说「名单以调研蓝图为准」，调研蓝图非落盘文件无法逐条对账【假设：调研蓝图已含此口径】。
2. **canvas 键仅落数据面**：validate.ts 不校验 `canvas` 键格式、registry 不消费（self-check 修正记录 3 声明归 T-C 批次接线）——longform.md 的 `canvas: 750x` 当前无运行时效应，属 plan 定谳 1 授权分期。
3. **types 残留键容忍无 studio 层测试钉扎反例**：registry.test.ts 仅钉「残留不影响注册」，旧 `## type 蓝图` 节内容已随 longform.md 删除，用户自存旧 workflow 文件的节文本会进入 sections 索引（无害，parse 三级索引保留系 plan 明确不做项）。
4. **system-prompt-marketing.md 内容重写归 T-C2**：本轮为最小死引用删除（V12），Phase 0 语义重写（新 setup_design 契约的模型指引）不在本任务验收面。
5. **未核项**：全量 `bun run check` 九门禁（typecheck/arch/dupes/type-shapes/i18n/zones/docs/bindings 等）本轮未逐项复跑（授权范围 = bun test + smoke:pi + oxlint/oxfmt 触碰文件）；zones.json diff 实测无 T62 新增区（仅 T61 ownedFiles 增删），与 plan §5「零新增」一致。

## 4. 总结论

**PASS**（V1-V16 全绿）：type 蓝图机制全触点物理删除（setup.ts 39 处命中归零、studio 五文件、prompt-overlay、system prompt、texts、tests），契约收编逐项落实（六码、validation order、三元组身份、两级 catalog 投影、命名域收 modeId），尺寸语义按定谳 1 重钉且 longform.md `canvas: 750x` 取值有 HEAD 原三 type 尺寸 diff 证据（750x/750x/1080x 全 HUG、主蓝图 750x），schemaVersion 未 bump 有 HEAD 对照，PiStudioModeEntry 别名合规。四门禁 unpiped 全 EXIT=0。余量仅 §3 所列非阻塞项（白名单口径补记、canvas 键接线归 T-C）。

<!--
  写作纪律（改本文前必读）：
  - 事实性声明必须附核验命令 + 日期，否则标为【假设】
  - 本文只保留当前态，不保留修正历史
  - 详细规则见 docs/rebuild/05-process.md §4
-->

# T66 核验 · T65 回归修整批 + 生图/备份优化提案落地

> **状态**：✅ PASS（2026-09-01 核验，无阻塞项） | **核验人**：独立核验 subagent（未参与实现）
> **核验基准**：T66-plan.md §1 六项范围 + ⑦裁定 + T66-self-check.md + plan §4 验收标准；实现为工作树未提交态（分支 rebuild/mode-arch）
> **职责边界**：只读核验 + 本报告；未 commit/push、未改任何源码

## 1. 逐项核验（2026-09-01 实测，除注明外命令均在仓根执行）

| # | 核验项 | 结果 | 证据 |
|---|---|---|---|
| 1 | ①双段 trigger | ✅ | ChatContextBar.vue:251-262 模板两态真实存在——`:252-256` 设计段（`v-if="active"` 名 / `v-else` `contextTriggerDesignEmpty`「待新建」text-muted）、`:257` 分隔符 `\|`、`:258-262` 需求单段（`briefCount > 0` 计数 / `contextTriggerBriefsEmpty`「无」text-muted）；max-w-80（:247）。i18n 四键双侧在案：zh-cn.ts:41-44「当前设计区：/待新建/需求单：/无」、en.ts:109-112「Design: /Not created/Briefs: /None」。ChatInput.vue `grep -n "chat-empty-slot-hint\|chipsEmptyHint"` rc=1 零命中；`grep -rn "chipsEmptyHint:" src/app/i18n/` rc=1（活键双侧删除；en.ts:85 仅存删除注记注释）；`grep -rn "chat-empty-slot-hint" src/` rc=1。计数口径：ChatContextBar.vue:140-149 briefCount = `scanCurrentPageBriefs(store).length`（sceneVersion watcher 重扫）；实现 active-design.ts:240-257 walk `state.currentPageId` childIds——当前页口径读码实证，跨页 brief 不计入由 chat-brief-panel.test.ts:206 用例钉扎 |
| 2 | ②排版修复四件套 | ✅ | createBriefOnPage active-design.ts:312——`computeAllLayouts(store.graph, currentPageId)` :322 + `store.select([brief.id])` :323 + `store.zoomToSelection()` :324 + `store.pushUndoEntry` :327（before :313 / after :326 snapshotPage 双向恢复）。applyBriefMutation :274-300 包裹全部五条写回路径：saveBriefContent :342 / saveMaterialCaption :349 / addBriefMaterialFromUpload :368 / addBriefMaterialsFromSelection :399 / removeBriefMaterialEntry :411（失败回滚 before :283/:297）。`bun test tests/engine/rebuild/marketing/chat-brief-panel.test.ts`：7 pass / 0 fail / 35 expects（exit 0） |
| 3 | ②dialog 四能力 | ✅ | ChatBriefDialog.vue（实测 406 行）：上传=useFileDialog :179-182 + onFilesPicked :183-201（arrayBuffer→Uint8Array→addBriefMaterialFromUpload :191，聚焦新条目标题 :200）；选区添加=onAddFromSelection :209-222 + 按钮 :343-351（selectionImageCount disabled 态 :346）；删除=onRemoveMaterial :166-177 + 按钮 :324-332；缩略图=thumbUrls Map :81 + thumbURL :83-91（createObjectURL）+ releaseThumbs :93-96 + 关闭/卸载 revoke（watch :98-105 / onBeforeUnmount :106）。AppDialogRoot/Header/Body :236/:242/:247。commit-before-act：commitDrafts :155-162（内容+全标题落盘）在删除 :169、上传 :188、选区添加 :213 三动作前调用；内容 :284 / 标题 :322 均 @change 提交。画布真相纪律：refresh() :61-77 打开与每次写回后重读，missing/broken 显式提示 |
| 4 | ③fieldsHint 文案 | ✅ | `sed -n '15,25p' packages/core/src/tools/fork/marketing/texts.ts`：:20 逐字「把需求写在这里：要做什么、给谁看、必须出现的内容、素材怎么用——写得越完整，AI 越少猜」（与 plan §1③定稿一致，grep 确认行号恰为 20）。落画布断言：chat-brief-panel.test.ts:108 以同串逐字 expect（用例 :95「fieldsHint 新文案落画布」），随 #2 套件全绿 |
| 5 | ④abort 守卫 | ✅ | service.ts 读码：abort 函数 :454；守卫 :468 `if (!entry) return`（running 布尔依赖已去，:456-466 注释钉 pi 三层 idle abort = no-op 实证依据）；`hitRunningRun = entry.running` :469 仅作日志；无条件 `await entry.session.abort()` :475；确认回显 console.debug :478-480（含命中进行中 run 布尔）；抛错吞掉 console.warn :481-485。`bun test tests/engine/rebuild/pi-backend/service-abort.test.ts`：4 pass / 0 fail（exit 0）——用例 :76 run 收尾后 abort 仍送达 / :87 进行中送达 / :111 未知 session no-op / :117 抛错吞掉 |
| 6 | ⑤备份页迁移 | ✅ | history.ts：getOrCreateBackupPage :126——pluginData 幂等（:127-129 遍历 getPages 按 `markerValue(page, ROLE_KEY) === ROLE_BACKUP_PAGE` 找，ROLE_BACKUP_PAGE='image-history-backup-page' :42），缺失才 `graph.addPage('图片备份')` :130（BACKUP_PAGE_NAME :50）+ upsertMarkers 打标 :131。createContainer :143 走 `findPlacementPositionOnPage(graph, backupPageId, …)` :146；import 仅 :35 placement seam，`grep isMarketingDesignRoot history.ts` 零命中（:25 注释自述锚定随迁删除）。placement.ts：getPageContentBoundsOnPage :36（graph 级）、findPlacementPositionOnPage :56（graph 级）；figma 形态单行委托——getPageContentBounds :47→:48、findPlacementPosition :73→:74。提案「已支持跨页」声明证伪在案（seam 为 T66 新增）。`bun test tests/engine/rebuild/image-gen/history.test.ts` 9 pass / placement-race.test.ts 5 pass（均 exit 0） |
| 7 | ⑥生图 provider | ✅ | 零残留：`grep -rn "IMAGE_GEN_PRESETS\|createDmxImageGenProvider\|provider-dmx" src/ packages/core/src tools/ tests/` rc=1；`ls` 双侧目录实证 presets.ts 不存在（core image-gen/ 与 pi-backend image-gen/ 均无），provider.ts 在案。provider-types.ts 注册表：IMAGE_GEN_PROVIDER_TYPES :14-19（`openai-compatible` 一族）+ isImageGenProviderType 守卫。credentials.ts 四字段 {providerType, baseUrl, model, apiKey} :31-34 + 旧格式 LegacyImageGenCredentials（presetId）:53-59 容忍读（:19-21 注释裁决）；测试 credentials.test.ts:85「旧格式容忍读」+:79「新格式不写 presetId」。routes.ts POST /api/pi/image-gen/test（TEST_PATHNAME :26）；routes.test.ts 真 HTTP——node:http createServer :10/:43 + listen 随机端口 :51 + fetch :64/:83/:235。description 实测 `bun -e` import GENERATE_IMAGE_DESCRIPTION.length = **1962** <2000（测试钉 toBeLessThan(2000)，tool-contract.test.ts:87）。GENERATE_IMAGE_PARAMETERS :238 Type.Object——9 字段（prompt/width/height/quality/output_format/output_compression/background/replace_id/references，grep 计数=9），additionalProperties:false :290（references 条目）+:296（请求条目）。四类错误拒绝用例：拼错 :39 / 类型 :49 / 嵌套 :54 / 枚举 :59。JSON 字符串兼容降级：requests.ts:88 `strictJSON ? JSON.parse : safeDestr` + generate.ts:18 注释自述保留。response_format 'url' 双侧：provider.ts:159（multipart form.append）+:184（JSON body）。`bun test tests/engine/rebuild/image-gen/`：96 pass / 0 fail / 282 expects / 10 files（exit 0） |
| 8 | ⑦内部设施不外露 | ✅ | `grep -in "图片备份\|历史图片备份\|backup page\|history container" src/app/ai/pi-backend/image-gen/generate.ts src/app/ai/pi-backend/prompts/system-prompt-marketing.md` rc=1 双文件零命中。generate.ts:57-61 description 现状 =「the previous version is auto-preserved and stays reusable as a reference」纯功能语义（:55 注释自述 owner 2026-09-01 裁定）；system-prompt-marketing.md 备份段同口径（:5/:30/:99/:104 抽查无内部落点名）。history.ts 内部常量（图片备份/CONTAINER_NAME）属实现侧，按核验清单豁免 |
| 9 | 门禁复跑（unpiped） | ✅ | 2026-09-01 逐一复跑：`bun run check:zones` exit 0（「clean: 81 modified (all registered), 520 added (owned), 1019 deleted, 0 renamed, base 88c10770」）；`bun run typecheck` exit 0（tsgo --noEmit + vue-tsc ×2）；`bun run check:i18n` exit 0（「All locale files are in sync.」）；`bun run test:type-shapes` exit 0（「No duplicate object type shapes found.」）；`bun test ./tests/engine/rebuild` exit 0——**375 pass / 0 fail / 1528 expects / 30 files**，与预期 375 一致。耗时门禁（lint/dupes/oxfmt/smoke:pi）依 self-check §2 绿跑声明采信，本轮未重跑（同 T65 核验先例） |
| 10 | 跨项一致性 | ✅ | A（面板）↔B（history）零交叉：`grep "image-gen\|history" ChatBriefDialog.vue active-design.ts` rc=1；`grep "ChatBriefDialog\|brief" packages/core/src/tools/fork/image-gen/history.ts` rc=1。ChatPanel.vue 挂载：import :34 + `<ChatBriefDialog />` :684。ChatContextBar popover 内嵌详情零残留：`grep "detailView\|captionDrafts" ChatContextBar.vue` 零命中（仅 openBriefDialog import :43 / openBriefDetail :202-205——条目点击关 popover 开 dialog）；dirty 守卫收敛为仅 createDirty（:208-209 注释自述详情草稿守卫随迁出删除）；需求单段 = 列表 + 内联新建（:411-441），骨架未动 |

## 2. 非阻塞问题（分级：cosmetic / observation，无 blocker）

1. **【cosmetic】ChatBriefDialog.vue 行数不符**：self-check §1② 记「348 行」，实测 `wc -l` = 406 行（2026-09-01）。功能核验不受影响（四能力/commit-before-act/重读纪律逐项实证在案，见 #3）。
2. **【cosmetic】description 字符数不符**：self-check §1⑥ 记「3068 → 1996」，bun import 实测 = 1962（LF 计 8 换行）。两值均 <2000，测试钉扎 `toBeLessThan(2000)` 通过；疑为统计口径差（CRLF/起止边界），语义无偏差。
3. **【observation】zones added 计数漂移**：self-check §2 记「516 added」，本核验复跑为「520 added」——差 4 系核验三件套/报告自身写入时序（docs/ 为 ownedRoot，T65 核验 #5 同型现象已登记），非背离。
4. **【observation】abort 不打断进行中长 HTTP**：generate 240s 工具调用内 abort 只置信号等收尾（service.ts:464-466 注释 + self-check §3.4 双向在案）——记录在案限制，非回归，工具层 signal 透传归后续可选方向。
5. **【observation】选区添加一律复制**：无移动/复制选择器（active-design.ts:391-394 注释 + self-check §3.1 在案，任务书允许的简化；原节点保留由测试 :177 钉扎）。
6. **【observation】abort 前端 toast 未做**：SSE 断连后无带外通路，仅后端 console.debug 日志（plan ④复杂度红线内裁决，self-check §3.4 在案）。

## 3. 未核项（按契约归后续批次）

- Playwright 交互实测（双段 trigger 两态 / dialog 四能力 / 停止按钮 / 备份页可见性）→ W4 T-D 批次（plan §3 未列入本轮验收，self-check §4 在案）。
- lint / test:dupes / oxfmt / smoke:pi 四耗时门禁采信主 agent 绿跑声明（self-check §2），本轮未重跑。

## 4. 总结论

**PASS**：核验清单 10 项全绿——①双段 trigger 模板/i18n/计数口径三侧实证；②排版四件套 + applyBriefMutation 全路径包裹 + 7 用例全绿；②dialog 四能力 + commit-before-act + 画布真相纪律读码全符；③fieldsHint 逐字 + 落画布断言；④abort 去 running 依赖 + 4 用例全绿；⑤备份页 pluginData 幂等 + 跨页 seam 委托形态 + 两测试文件全绿（提案「已支持跨页」声明证伪有据）；⑥生图 P0-P5 全落（零残留/注册表/四字段容忍读/真 HTTP 探针/1962<2000/9 字段 schema/四类错误/96 用例全绿）；⑦内部名双文件 grep 零命中；⑨五门禁 unpiped exit 0（375 pass 与预期一致）；⑩跨项零污染 + 挂载/残留核查通过。残留仅 §2 六项 cosmetic/observation（两处 self-check 数字偏差为记录级，不涉实现），不阻塞提交。

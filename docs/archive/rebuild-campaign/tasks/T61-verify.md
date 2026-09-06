<!--
  写作纪律（改本文前必读）：
  - 事实性声明必须附核验命令 + 日期，否则标为【假设】
  - 本文只保留当前态，不保留修正历史
  - 详细规则见 docs/rebuild/05-process.md §4
-->

# T61 核验 · Phase 3 W3/T-B10：选择器 UI 重做（chips + 新建意图确认 + 面板）

> **状态**：✅ 已完成（2026-08-31 核验出阻塞项，主 agent 修复后 2026-09-01 复核 PASS） | **核验人**：独立核验 agent（未参与实现与修复）
> **核验基准**：T61-plan.md §2/§3/§4 + T61-self-check.md + 共享契约五条例双侧对账；实现为工作树未提交态（`git status` 2026-08-31，分支 rebuild/mode-arch）
> **实测日志**（仓外）：`D:\Desktop\AgentLearn\00_DIYProjects\0720openpencil\doc\T61-verify-*.log`、`T60-verify-*.log`（共享门禁证据）

## 1. 核验范围

九项交付物落点、旧件删除、i18n 命名空间对齐、localStorage 键删除、T24 前端链退役、zones 登记、共享契约五条双侧对账（重点：set_active_design part 解析面）、门禁复跑。视觉/交互冒烟按契约归 W4 T-D 批次，不在本轮。

## 2. 逐项核验（2026-08-31 实测，除注明外命令均在仓根执行）

| # | 核验项 | 结果 | 证据 |
|---|---|---|---|
| V1 | C1 chips 两级数据驱动；旧件物理删除 | ✅ | ChatModeChips.vue 头注 :2-17 + 实现（:42-43 modes/profiles 数据源、:63-70 pick 写 setPiChipSelection、:57-59 chipsDisabled 联动 manifest 失败）——无 type 级专属逻辑；`ls src/components/chat/` 无 ChatModeSelect.vue / ChatStyleProfileSelect.vue（git status `D` 两条在案）；`grep -rn "ChatModeSelect\|ChatStyleProfileSelect" src/` 零引用残留 |
| V2 | C2 新建意图确认卡（Case A 一行 / Case B 四项 + references 勾选） | ✅ | ChatNewIntentCard.vue:78-93（Case A `intentCaseALine` 一行；Case B 四项 Keep/New/Materials/Radius + References 勾选区）；宿主 data part 注入 ChatPanel.vue:311-337（materialized 分叉 :318、references 收集 :324、`resolved:null` 初始）；拦截 :250-256（piPendingNewIntent 存在 → interceptNewIntent，消息留输入框 :335 restoreDraft）；确认 :361-380（resolveIntentPart('confirmed') + 信封+draft 送出 + references 正文行——self-check §2.2 登记偏差属实，信封字段契约未动）；取消 :382-388（chips 回滚 clearPiPendingNewIntent + 不发送） |
| V3 | C3 设计列表面板（active 徽标；点击=打开不切换；显式「设为当前」→ 端点） | ✅ | ChatDesignListPanel.vue 头注 :8-9 钉扎 v7 语义；:67-68 列表点击 `store.select([rootId]) + zoomToSelection()` 不调端点；:77 显式按钮 `postActiveDesign(design.rootId)`；active 徽标读 piActiveDesign 比对 |
| V4 | C4 需求单面板三段 | ✅ | ChatBriefPanel.vue：段①当前目标卡（:47/:179，头注 :6「无状态字段——身份之外一律不显示」）；段②全文档列表带页标识（:75 scanDocumentBriefs + :342 entry.pageName，点击=打开）；段③详情编辑第一功能（:97 readBriefView 读模型、:126 saveBriefContent、:142 saveMaterialCaption——写回经 makeFigmaFromStore + core brief-edit 原语，components/chat/active-design.ts:190-202） |
| V5 | C5 gallery 只读 / C6 失败显式暴露 | ✅ | ChatGalleryPanel.vue 头注 :3-5（只读浏览，数据源 piStudioManifest，空载显式空态）；mode-selection.ts:48 piStudioManifestFailed + :52-67 fetch 失败置真不静默 + :77-80 retryPiStudioManifest；ChatInput.vue:84-100 错误条 + 重试按钮、:127-129 chips+双面板挂载、:43 承载注 |
| V6 | C7 set_active_design 同意卡结构 | ⚠️ 结构在、数据面失陷 | ChatSetActiveDesignCard.vue 渲染/决断/置灰结构齐（:60-65 isLocked、decide emit）；ChatMessage.vue:131-137 分支 + ChatPanel.vue:393-452 决断处理（同意→postActiveDesign+resync :428-430；不同意→本地系统行 :438；决定记录 data part :441-451 不伪装用户消息）——**但 proposed 解析源错误，见 V7** |
| V7 | **共享契约 ③前端半边：part.input 误读 {proposed}** | ✅ **已修复，复核通过** | **原缺陷（2026-08-31 钉死）**：活体 part.input = 工具入参 `{node_id}`（mapping.ts:90；history.ts:67 回填同形），`{proposed}` 实际位于 part.output = 工具结果 details（active-design.ts:282-291 → tools.ts:241 → mapping.ts:122/133）；探针实证 parse(input)→全 null，同意路径永不到达端点（T61-verify-probe.log）。**修复（主 agent，2026-09-01）**：ChatSetActiveDesignCard.vue:42-44 改读 `part.state === 'output-available' ? part.output : undefined`（:42 行内注钉扎，对齐 AskUserQuestionCard.vue:57 读 output 先例）；ChatPanel.vue:405-414 consentProposed 改读 `part.output`（头注钉扎 input/output 分工）。**复核（2026-09-01）**：两处源码 Read 实证；真函数探针复跑——修复后消费路径 `parse(output)` → `{"nodeId":"1:234","name":"大促长图"}`，同意路径 nodeId 非空可达 postActiveDesign，pending 态（input-available）守卫正确回落全 null 不误判；独立复跑 `bun run typecheck` EXIT=0、两文件 oxlint type-aware 0 err 0 warn、oxfmt --check 全 correct（T61-verify-fix-typecheck/oxlint.log）。残留：ChatSetActiveDesignCard.vue:5 头注仍写「part.input 形状」旧文（:42 行内注已纠），cosmetic |
| V8 | C8 T24 前端链退役 + localStorage 键删除 | ✅ | transport.ts:39-41 停发 chatMode/pickedProfileId（注释钉扎 PD-16 翻案）；document-key.ts:143-153 getPiRequestContext 只余 sessionId/documentId；mode-selection.ts 全重写（头注 :1-23：active 读穿同步态 + piPendingNewIntent 暂存不持久化 + manifest 失败显式面）；`grep -rn "open-pencil:pi-chat-mode" src/ tests/ spikes/` 仅 mode-selection.ts:4 注释提及（退役记录），**零代码读写**；`grep -n localStorage src/app/ai/pi-backend/mode-selection.ts` 零命中 |
| V9 | C9 i18n 三命名空间 en/zh-cn 对齐 | ✅ | fork/index.ts:41-43 zh-CN pack 挂 chips/panels/confirm、:62-68 forkI18n 三域、:85-97 useForkChips/Panels/Confirm（useFork* 先例形态）；en.ts:75+ chipsMessageDefaults / panelsMessageDefaults / confirmMessageDefaults 英文默认值；zh-cn.ts:30/46/72 三命名空间全量中文；`bun run check:i18n` EXIT=0「All locale files are in sync」（T61-verify-i18n.log，键对齐工具实证） |
| V10 | 共享契约 ①信封逐字互配 | ✅ | serializeNewIntentEnvelope（components/chat/active-design.ts:40-48）四变体 × T60 剥离正则（active-design-host.ts:51-52）实测全 MATCH（T61-verify-probe.log）；与 T56 `[表单作答 formId=…]` 信封不混淆（resolveFormAnswer 只剥表单信封、stripNewIntentEnvelope 只认首行新意图信封，互不平移） |
| V11 | 共享契约 ②端点形状两侧一致 | ✅ | 后端 200 {modeId,profileId,briefId,name,materialized}（server.ts:201-207）/ 422 {error,message} / 502 / 400；前端 postActiveDesign（active-design.ts:139-151）!ok→null 折叠错误码、成功取三元组（`profileId: string \| null` vs 后端 '' 空串——调用方只判 truthy 后 resync 读穿，无实际分歧） |
| V12 | 共享契约 ④物化判据单源 / ⑤chips 读穿 | ✅ | ④core isDesignMaterialized 唯一判定（active-design.ts:245-261），前端 isDesignRootMaterialized 纯转调（components/chat/active-design.ts:108-110）不双写；⑤mode-selection.ts:98-114 读 root sharedPluginData ACTIVE_DESIGN_KEY + 三键标记读穿，sceneVersion watch + graph:replaced + tab 切换三触发（:122-144），系统同步不触发意图（setPiChipSelection :180-186 与回显相同则清暂存），无 active → 默认态 general+无 profile（:163-170） |
| V13 | zones.json 登记 | ⚠️ 非阻塞偏差 | 结构化扫描（bun JSON.parse）：7 新文件（ChatModeChips/ChatNewIntentCard/ChatDesignListPanel/ChatBriefPanel/ChatGalleryPanel/ChatSetActiveDesignCard/active-design.ts）全部进 ownedFiles；ChatModeSelect/ChatStyleProfileSelect 零残留（stale 移除属实）；`bun run check:zones` EXIT=0 clean。**但**：grep 全文件无 'T60'/'T61' 指针——ownedFiles 条目为纯字符串无指针机制；唯一上游改件 ChatPanel.vue 的 P4 patch reason（lastReviewed 2026-09-01）追加到 T56 为止，未补 T61 注记（T25/T27/T56 均有追加先例）。plan 验收 4「登记带 T61 指针」部分履约 |
| V14 | 门禁复跑（T61 触碰面） | ✅ | 与 T60 同轮 unpiped 直跑全 exit 0：typecheck（含 vue-tsc 双 tsconfig，覆盖全部 .vue 交付物——「可构建可挂载」实证）、oxlint type-aware 三触碰面 0 errors、check:i18n、check:zones、check:arch（steiger 无新增前缀违例）、test:dupes 0 clones、check:bindings、check:docs、oxfmt --check 触碰 21 文件全 correct（日志见 T60-verify-*.log / T61-verify-i18n.log）；`bun test tests/engine/rebuild/` 323/323 与 smoke:pi 76/76 不回退 |

## 3. 非阻塞问题与边界

1. **「重载置灰派生」声明不成立**（self-check C7 / ChatNewIntentCard.vue:14 / ChatSetActiveDesignCard.vue:12-13 三处行文失准）：宿主 appendHostMessage 的消息只进前端 chat.messages，永不进 pi 会话 JSONL（未经 session.prompt；T60-verify V15 链实证）；readPiHistoryFile（history.ts:54-89）只重建 text/toolCall part——刷新后确认卡/决定记录/本地系统行整体消失，同意卡从工具 part 重渲染为**未决断态**（可再点）。T56 answeredFormIds 能跨重载置灰是因为作答是文本信封进了真历史；T61 决定记录是 data part，无同等持久化。属行为缺口 + 文档失准，不阻塞门禁。
2. **V7 缺陷的爆炸半径（修复前评估，已随 2026-09-01 修复消解）**：仅 set_active_design 同意卡一路（事件③）受影响；面板「设为当前」（V3）不经该解析、直接 postActiveDesign，从未受影响；core/宿主端契约 ③ 交付始终正确（mutates:false + {proposed} 结果形状，T60-verify V10）。修复为单侧两点（卡片 + ChatPanel 各一处改读 part.output），修复后同意路径探针实证可达端点（V7 复核段）；建议后续补一例前端解析单测（活体 part 形状钉扎）防回归，归 W4 批次随行。
3. **施工期并行改树声明抽核**（self-check §2.1）：T62 删 types 后「types 若存在则渲染中间级」分支确未建（ChatModeChips 无 type 逻辑，V1 实证）；ACTIVE_DESIGN_KEY namespace = BRIEF_PLUGIN_NAMESPACE（core active-design.ts:50+import :35，与「open-pencil-marketing 而非早期假设」一致——brief.ts 内 namespace 常量定义 grep 实证 `BRIEF_PLUGIN_NAMESPACE` 值 'open-pencil-marketing'）。
4. **references 携带物走信封后正文行**（ChatPanel.vue:375-378）：self-check §2.2 已登记偏差，信封字段契约未动（V10 四变体实证），维持登记态。
5. **未核项**：Playwright 交互冒烟（chips 回显/确认卡/面板/同意卡）按契约归 W4 T-D1/D2；V7 缺陷的运行期复现（真实点击同意卡观察失败行）同属 W4 冒烟面——本轮为代码级 + 真函数探针实证，结论不依赖浏览器复现。

## 4. 总结论

**PASS**（V1-V14 全绿；V7 阻塞项经主 agent 2026-09-01 修复 + 同日复核通过）：九项交付物落点、旧件删除、i18n 对齐、localStorage 键删除、T24 链退役、门禁全绿、共享契约五条双侧一致。契约 ③ 前端解析面已改读 part.output（state 守卫），真函数探针复跑确认同意路径可达 POST /api/pi/active-design；typecheck/oxlint/oxfmt 独立复跑全 0。收口余量仅 §3 所列非阻塞项（重载置灰派生缺口归 W4、zones P4 缺 T61 指针、:5 头注旧文 cosmetic）。

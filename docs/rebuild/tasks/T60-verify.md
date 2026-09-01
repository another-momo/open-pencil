<!--
  写作纪律（改本文前必读）：
  - 事实性声明必须附核验命令 + 日期，否则标为【假设】
  - 本文只保留当前态，不保留修正历史
  - 详细规则见 docs/rebuild/05-process.md §4
-->

# T60 核验 · Phase 3 W3/T-B9：宿主路由与每回合组装（active_design 单槽）

> **状态**：✅ 已完成（2026-08-31 收口） | **核验人**：独立核验 agent（未参与实现）
> **核验基准**：T60-plan.md §2/§3/§4 + T60-self-check.md + 共享契约五条例（T61-plan §2）对源码逐条对账；实现为工作树未提交态（`git status` 2026-08-31，分支 rebuild/mode-arch）
> **实测日志**（仓外）：`D:\Desktop\AgentLearn\00_DIYProjects\0720openpencil\doc\T60-verify-*.log`、`T61-verify-*.log`（共享门禁/探针证据）

## 1. 核验范围

单槽读写、四事件移槽落点、合法性四条件、悬空清槽、每回合组装、一次性旗标、chatMode 退役、set_active_design 交付面、测试清单覆盖、九门禁 unpiped 复跑、与 T61 共享契约五条的 T60 侧对账、T61 移交项（宿主 data-* part 是否泄漏进模型视野）复核。

## 2. 逐项核验（2026-08-31 实测，除注明外命令均在仓根执行）

| # | 核验项 | 结果 | 证据 |
|---|---|---|---|
| V1 | 单槽读写：ACTIVE_DESIGN_KEY='activeDesignNodeId'，root sharedPluginData，空串=空槽；typeId 不读不写 | ✅ | `Read packages/core/src/tools/fork/marketing/active-design.ts`：:50 键名、:66-82 read/write/clear（read 根缺失→''；clear=写空串=删键）；全文无 typeId 引用（grep 实证）；身份三元组读穿 snapshotDesignRoot :116-129（DESIGN_MODE/PROFILE/BRIEF 三键，无 TYPE 键） |
| V2 | 事件① setup_design 成功回调移槽 | ✅ | tools.ts:215-226（结果含 rootId 且无 error → await onDesignCreated，失败只 warn）→ service.ts:218-220 装配闭包 → active-design-host.ts:373-375 moveSlot→writeSlot |
| V3 | 事件②③端点 POST /api/pi/active-design 四码 | ✅ | server.ts:175-214 handleActiveDesignRequest：200 回 {modeId,profileId,briefId,name,materialized}（:201-207）/ 422 校验驳回（:210，`error!=='bridge_unavailable'` 全归 422）/ 502 bridge_unavailable / 400 缺 nodeId（:195-198）/ 405 非 POST（:180-183）/ 401 全局鉴权（:355-358）；路由挂载 :364-367 在 /api/pi/ 前缀之前。处理本体 setActiveDesignViaBridge（active-design-host.ts:413-444）：probe→四条件→writeSlot→三元组 |
| V4 | 事件④ formId 映射仅作答移槽、会话内不落盘、刷新丢映射静默 | ✅ | active-design-host.ts:327 `formDesignByFormId` Map（模块级会话态，无落盘调用）；:368-372 observeToolExecution 只认 ask_user_question + `status==='awaiting_user'` + string formId；:338-346 resolveFormAnswer——`answer.aborted`（表单跳过）return 不移槽、未知 formId return 静默、probe + isFormTargetStillValid（:297-301：存在+仍根框+同页，brief 不作驳回依据）→ moveSlot。挂接点 service.ts:357-360（tool_execution_end 事件取 details 喂 observeToolExecution） |
| V5 | 合法性校验四条件单源 | ✅ | core checkActiveDesignCandidate（active-design.ts:161-184）：not_found / not_design_root（isMarketingDesignRoot）/ cross_page（pageId null 或 ≠ currentPageId）/ brief_mismatch（brief 存在+同页+boundDesignIds 登记本设计，双向链接一致）；纯函数判定、桥探针只取裸数据（active-design-host.ts:164-201 buildProbeSource 插值 core ACTIVE_DESIGN_PROBE_KEYS 常量 :299-310，不串化判定） |
| V6 | 悬空清槽 + 系统提示注入 | ✅ | evaluateActiveDesignSlot（active-design.ts:210-218）：槽非空且（节点不存在 ∨ 非根框）→ dangling；probeSlotState（active-design-host.ts:348-364）dangling → moveSlot('') 清槽 + notices=[ACTIVE_DESIGN_TEXTS.slotCleared]；slotCleared 文案 texts.ts:77 中文用户语言化；brief 悬空不清槽只提示（texts.ts:80 briefMissing，assembleTurn :113 注入） |
| V7 | 每回合组装：顺序固定 / 空槽 / workflow 缺失降级 / 封套 | ✅ | assembleTurn（active-design-host.ts:102-125）：空槽 → `{systemPrompt: base, contextLines: [...extraNotices]}`（无封套无 profile）；有槽 → 封套首行 designTargetEnvelope(:88-91 三元组+nodeId，profileId 缺省省略字段) + base→workflow.body→profileBody 顺序固定（:123）；modeId==='general' 无 workflow 段（:114-117）；workflow 缺失 → workflowMissing 提示行 + base only + 封套保留（:119-122）；钩子搬运 service.ts:234-251（systemPrompt per-run 替换 + contextLines 经 result.message customType='active-design-context' display:false 通道）；registry 每回合读单例 service.ts:207 `() => getStudioRegistry(rootDir)`；SessionEntry 缓存袋 = host 字段（service.ts:107-108） |
| V8 | 一次性旗标：剥离→置真→finally 复位，不跨回合 | ✅ | stripNewIntentEnvelope（active-design-host.ts:51-77）仅首行精确命中剥离、CRLF 容忍、非首行/畸形不动原文；prepareTurn :376-386 回合开始强制清零（防御）+ 信封命中置真；service.ts:381-382 runPrompt finally `entry.host.finalizeTurn()` 复位（finalizeTurn :388-391 旗标+回合态双清）；剥离后 stripped 照常进 run（service.ts:374 `session.prompt(prepared.promptText)`） |
| V9 | chatMode 退役（后端侧） | ✅ | `ls src/app/ai/pi-backend/modes.ts` → No such file（git status `D` 在案）；SessionEntry（service.ts:100-111）无 mode/overlay 字段、无驱逐重建代码（grep 全文件无 evict）；PiPromptOptions（service.ts:74-77）只余 model/documentId；请求面兼容窗 server.ts:62-64 `chatMode?: string` 类型保留但全文件无消费点（lastUserText 只取 messages）；冒烟实证兼容窗=t24 smoke C3（spikes/s-pi/backend-smoke/t24/prompt-assembly-smoke.mjs 头注 :24-25，残留字段忽略不报错正常进 run，25/25 通过） |
| V10 | set_active_design mutates:false 不落槽、{proposed} 形状 | ✅ | active-design.ts:265-293：`mutates: false`（:267）、execute 校验失败回 `{error: reason, message}`、成功回 `{proposed:{nodeId,name,modeId,profileId,briefId}, materialized}`（:282-291）——全路径无 writeActiveDesignNodeId 调用；交付面 ACTIVE_DESIGN_TOOLS 单件（:296）经 fork/index.ts:21/36 进 FORK_TOOLS → tools.ts:259 暴露 |
| V11 | setup_design 旗标假恒拒绝（验收标准 2） | ✅ | setup.ts:239-240 `if (args.confirmedNewIntent !== true) return { error: 'unconfirmed_new_intent' }`；setup-tool.ts:57 注入解析 `=== 'true'`；tools.ts:207 仅 `newIntentConfirmed()` 真时注 `__confirmedNewIntent='true'`；钉扎测试 setup.test.ts:216/230/467 + active-design-host.test.ts:191（无信封恒假）全绿 |
| V12 | 测试清单覆盖（plan §3） | ✅ | `grep -c "test('"` → core active-design.test.ts **21** 例 / pi-backend active-design-host.test.ts **23** 例（与 self-check C9 一致）；用例名逐条覆盖 plan §3：单槽读写/缺槽/删后读穿（core :71/:89/:100）、mutates:false+proposed 形状（core :233/:240/:264）、组装空槽/有槽/顺序/缺失降级/profile 有无（host :204/:210/:223/:232/:242/:251）、信封剥离+置真/复位/不滞留（host :148/:156/:163/:170/:179/:191）、①回调移槽（host :408）、④映射+刷新丢失+跳过不移+失格不移（host :318/:335/:358/:367/:386）、四驳回+通过（core :135/:145/:154/:163/:173/:184）、清槽+提示（host :289） |
| V13 | 门禁 unpiped 直跑全 exit 0 | ✅ | 逐条直跑看 `$?`（日志仓外）：`bun test tests/engine/rebuild/` EXIT=0 **323 pass / 0 fail**（T60-verify-bun-test.log，与 self-check 323/323 一致）；`bun run smoke:pi` EXIT=0，五段 6+12+14+25+19=**76/76**（T60-verify-smoke-pi.log，t24 smoke 25 处已重钉为单槽语义，与 self-check 一致）；`bun run typecheck` EXIT=0（T60-verify-typecheck.log）；`bunx oxlint -c oxlint.json --type-aware --type-check src/app/ai/pi-backend/ src/components/ packages/core/src/tools/fork/` EXIT=0，0 errors 2 warnings（均为 max-lines-per-function，落 compose-backdrop.ts:856/brief.ts:879——T62 领土非本任务触碰面，T60-verify-oxlint.log）；`bun run check:zones` EXIT=0 clean（81 modified/505 added/1019 deleted 全登记，T60-verify-zones.log）；`bun run check:arch` EXIT=0 No problems（T60-verify-arch.log）；`bun run test:dupes` EXIT=0 jscpd 0 clones（T60-verify-dupes.log，T60-self-check §2.2 的 walkSubtree 收编无回退）；`bun run check:bindings` EXIT=0 63 文件变更全绿；`bun run check:docs` EXIT=0 42/42；`bunx oxfmt --check`（只读模式替代 --write）触碰 21 文件全 correct（T60-verify-format.log） |
| V14 | 共享契约对账·T60 侧 | ✅（③前端半边失陷归 T61-verify） | ①信封：宿主剥离正则 active-design-host.ts:51-52 与 T61 serializeNewIntentEnvelope 四变体逐字互配——实测探针（T61-verify-probe.log）：`[新建意图确认 modeId=x profileId=y]` / 仅 modeId / 仅 profileId / 裸标记四形态全部 MATCH；②端点形状两侧一致（V3 + 前端 active-design.ts:139-151，!ok→null 折叠 422/502）；③part 形状 {proposed} core 侧在**工具结果**（details→part.output）——前端解析面失陷见 T61-verify V7；④物化判据单源 core isDesignMaterialized（active-design.ts:245-261，IMAGE fill ∨ hero-geometry），前端只 re-export（components/chat/active-design.ts:108-110）；⑤chips 回显读穿路径 mode-selection.ts:98-114（root sharedPluginData ACTIVE_DESIGN_KEY + 三键标记，与单槽口径一致，悬空→null 默认态） |
| V15 | T61 移交项复核：宿主 data-* part 不泄进模型视野 | ✅ 不泄漏（非阻塞观察见 §3-4） | 链路实证：①宿主发起 part（ChatPanel.vue:327 appendHostMessage `data-new-intent-confirm` / :441-451 `data-active-design-decision`+本地系统行）只进前端 chat.messages；②下次发送时 ai SDK 全量 messages 随 POST 体上行（transport.ts:35-42）——**会随历史 POST 回后端（带宽面）**；③server.ts:95-101 lastUserText 只取**末条 role==='user'** 消息的 `type==='text'` part——data-* 挂在 assistant 宿主消息上且类型非 text，双重排除；④run 上下文 = host.prepareTurn 产出的纯文本 + turnAssembly contextLines（service.ts:370-374），无 part 通道；⑤pi 会话 JSONL 从未记录宿主本地消息（未经 session.prompt）；⑥readPiHistoryFile（history.ts:54-89）只重建 text/toolCall part，data-* 天然不可能出现于回填。结论：**data-* part 不进模型视野、不进会话历史，无泄漏** |

## 3. 非阻塞问题与边界

1. **chat-mode.ts 实为孤儿类型文件**（self-check §2.3 填报失准）：`grep -rn "from.*chat-mode" src/ tests/ spikes/ tools/` 无任何真实 import——mode-selection.ts:4 与 studio/manifest.ts:3 仅在**注释**中提及该文件名作先例引证，并非「仍消费其 ChatMode 类型」。文件死码化但全门禁无报警（typecheck/knip 不管未引用文件）。处置建议归 T-C 批次顺带删除，非本任务回退。
2. **self-check C6「信封-only → server 400」表述不精确**：server.ts:128 校验的是剥离**前**原文（信封行非空，不会 400）；剥离发生在 run 内 prepareTurn（:379）。信封-only 消息实际会走到 `session.prompt('')`，该路径无测试钉扎。UI 侧不可达（拦截要求非空草稿、取消不发送），仅手工构造请求可触——与 self-check §2.4「归 W4 冒烟观察」口径一致，维持观察项。
3. **桥探针 eval 片段内含第三份物化遍历**（active-design-host.ts:184-195 hasMaterial）：eval 边界使然（浏览器侧取裸数据、判定留后端），模块头注已钉扎此纪律；不构成 jscpd 违例（字符串内代码，V13 dupes 0 实证）。
4. **data-* part 重载即消**（V15 链⑥推论）：宿主本地消息（确认卡/决定记录/系统行）不进 pi JSONL，刷新后整卡消失——同意卡置灰派生源随之丢失。行为影响与钉扎见 T61-verify §3-2。
5. **未核项**：Playwright 交互验证按契约归 W4 T-D 批次；CI push 绿需提交后观测（只读核验授权外，同 T63/T64 轮先例）；prefix 缓存命中率无测量手段（self-check §2.5 已转 W5 观察清单，plan §2.8 履约=顺序固定，V7 实证）。

## 4. 总结论

**PASS**（V1-V15 全绿）：单槽读写、四事件移槽、四条件校验、悬空清槽、每回合组装（顺序固定/空槽/降级）、一次性旗标生命周期、chatMode 后端退役、set_active_design mutates:false 不落槽八项定谳全部与源码逐条吻合；44 例新增测试覆盖 plan §3 全清单；九门禁 unpiped 全 exit 0（323/323 + 76/76）；共享契约 T60 侧五条全履约（③的前端解析失陷不影响 T60 侧交付正确性，归 T61-verify V7 阻塞项）；T61 移交的 data-* 复核结论 = 不泄进模型视野。收口余量仅 §3 所列非阻塞项。

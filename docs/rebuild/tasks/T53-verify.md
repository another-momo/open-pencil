<!--
  写作纪律（改本文前必读）：
  - 事实性声明必须附核验命令 + 日期，否则标为【假设】
  - 本文只保留当前态，不保留修正历史
  - 详细规则见 docs/rebuild/05-process.md §4
-->

# T53 核验 · setup_design 窄化（四职责+校验+设计身份落盘+结构化信封）+ 无状态三态解析

> **状态**：✅ 已完成（2026-09-01 收口） | **核验人**：独立核验 agent（未参与实现）
> **核验基准**：T53-plan.md §1/§3/§4 + doc/S3-tool-contracts-spec.md §2/§9/§10；实现为工作树未提交态（`git status` 2026-09-01，HEAD=ef3981a2 T54）

## 1. 核验范围

fork/marketing/{setup,setup-tool,texts}.ts 三件套、tests/engine/rebuild/marketing/setup.test.ts（24 例）、集成四面（fork/marketing/index.ts、fork/index.ts FORK_TOOLS、pi-backend/setup-catalog.ts 新建、pi-backend/tools.ts 注入缝、pi-backend/service.ts 上下文闭包）、image-gen/history.ts 侦测收敛。同工作树内 ask-user-question/hero-scaffold/ChatPanel 等属 T56/T57 并行波次，不在本核验范围（其门禁影响由 V6 全绿覆盖）。

## 2. 验收核验（V 逐条）

| # | 验收项 | 结果 | 证据 |
|---|---|---|---|
| V1 | setup.test.ts 全绿（24 例） | ✅ | `bun test tests/engine/rebuild/marketing/setup.test.ts`（2026-09-01，unpiped 直读 `EXIT=0`）：24 pass / 0 fail / 124 expect |
| V2 | `bun test tests/engine/rebuild/` 全套不回退 | ✅ | 2026-09-01 unpiped `EXIT=0`：236 pass / 0 fail / 23 文件（含 studio、undo、image-gen 等既有套件；与收口基线 236 一致） |
| V3 | 九契约改写版全覆盖（S3 §10） | ✅ | 逐条映射见 §3；测试 setup.test.ts:101-380 ①-⑨ + 五枚另钉全绿 |
| V4 | 无状态三态解析新写测试 | ✅ | setup.test.ts:382-481 六例：空页 none / 唯一 ok / 两个 ambiguous（candidates 四元组投影）/ 显式 id 命中与未中 not-found / 死节点不出现 / 两次扫描独立 |
| V5 | 签名恰为 {modeId, typeId?, profileId?, briefId} | ✅ | setup-tool.ts:31-53 四键（modeId/briefId required）；测试钉扎 setup.test.ts:488-495 `Object.keys(params)` 顺序与 required 标志；S3 §2 L30 签名一致 |
| V6 | 五键身份落盘复用 T52 常量，无本地重声明 | ✅ | setup.ts:30-44 自 `./brief` import DESIGN_MODE_KEY/TYPE_KEY/PROFILE_KEY/BRIEF_KEY + BRIEF_SCHEMA_VERSION/_KEY + BRIEF_PLUGIN_NAMESPACE/ROLE_KEY（单源定义 brief.ts:35-42,61-64）；`grep "DESIGN_*=\|BRIEF_SCHEMA_VERSION=" setup.ts setup-tool.ts` 零命中（exit 1）；落盘调用 setup.ts:342-348 逐键写 |
| V7 | registerBriefDesignEntry 成功路径实调 | ✅ | setup.ts:358（另 bindBriefToDesign:352、setBriefBindingLabel:353-357）；测试 ⑨ setup.test.ts:268-315 断言 bound-designs 指针 + 条目 designId 标记 + 名称投影 + 绑定行 + read_brief 读穿四元组 |
| V8 | findPlacementPosition + scrollAndZoomIntoView | ✅ | setup.ts:28 import、335-338 调用、360-361 viewport 聚焦；测试 setup.test.ts:337-360（右 +100/y 跟随 bounds 顶/viewport 中心移到新根中心） |
| V9 | 旧领养/registry 逻辑不移植 | ✅ | `grep -rn "resolveExistingDesign\|findRootFrame\|listSameTypeRoots\|buildOriginPart\|ADOPTED\|siblingPagesOf\|activeMaterialTypes" packages/core/src/tools/fork/ tests/engine/rebuild/` 仅 setup.ts 文件头注释两命中，代码零命中；fork/marketing/ 无 registry.ts（`ls` 实测 11 文件） |
| V10 | 注入缝不进 schema | ✅ | tools.ts:183-186 TypeBox shape 仅遍历 `Object.entries(def.params)`；paramToTypeBox tools.ts:127-157 只消费 ParamDef；setup_design params 四键（V5）——`__catalog`/`__confirmedNewIntent` 不出现在模型可见 schema |
| V11 | 注入 setup_design  scoped，他工具零外加 | ✅ | tools.ts:51 SETUP_DESIGN_TOOL 常量 + 197-201 `if (def.name === SETUP_DESIGN_TOOL && setupDesign)` 唯一注入分支；其余工具仅 T22 既有 document_id 外层（tools.ts:90-91，非本缝） |
| V12 | 投影形状 = 消费侧契约 | ✅ | setup-catalog.ts:17-24 SetupCatalogProjection {modes:{id,label,types:'none'\|{id,label,size}[]}[], profileIds:string[]} 与 setup.ts:59-77 SetupCatalog 逐字段同构；buildSetupCatalog setup-catalog.ts:31-41（types:'none' 保字面、否则 map {id,label,size}；profileIds 取 profiles.keys）；消费解析 setup-tool.ts:17-24（JSON.parse，畸形→undefined 不炸画布）+ 63-65 提取转置 |
| V13 | service 上下文闭包：请求时取注册表 + 恒 false | ✅ | service.ts:207-210 `catalogJSON: () => JSON.stringify(buildSetupCatalog(getStudioRegistry(rootDir)))`（请求时现取）、`newIntentConfirmed: () => false`（T61 落地前契约内行为）；createOpenPencilTools 三参贯穿 tools.ts:226-240 |
| V14 | 红线：schema.ts / ParamDef 零改动 | ✅ | `git status --porcelain packages/core/src/tools/schema.ts registry.ts registry-core.ts registry-extended.ts` 空输出（2026-09-01）；全量 `git diff --stat` 14 文件不含 schema.ts |
| V15 | 红线：无 commit/push | ✅ | `git log --oneline -5`：HEAD=ef3981a2（T54），以下为 T59/T55/T52/T51——无 T53 提交；T53 文件全部为未提交态（setup.ts/setup-tool.ts/setup.test.ts/setup-catalog.ts untracked，集成四文件 modified） |
| V16 | 红线：zh-cn 文案外置 | ✅ | texts.ts:46-68 SETUP_TEXTS 外置（git diff +29 行）；setup-tool.ts 中文仅注释与领域名词（需求单/关联设计区，同 T52 先例），用户可见 message 全走 SETUP_TEXTS（setup.ts:170-239 各错误分支） |
| V17 | history.ts 收敛：import 单源 + 编码键互通 + 旧格式容忍 | ✅ | 见 §4 探针实证（写→读→消费三环 + legacy 五环全过）；diff 确认本地 MARKETING_PLUGIN_ID/MARKETING_ROLE_ROOT/isMarketingRoot 副本整体删除（-16 行），改 import setup.ts:28 |
| V18 | 门禁全绿 | ✅ | 2026-09-01 逐门 unpiped 退出码：lint=0（6 warnings 含 brief.ts max-lines 880>600，存量 T52 文件，无 error）、format:check=0、typecheck=0（tsgo + vue-tsc 双段）、check:i18n=0、check:zones=0（81 modified 全登记/476 added 全 owned）、check:tasks=0、check:bindings=0、check:arch=0（steiger 零问题）、test:type-shapes=0、test:dupes=0（0 clones） |
| V19 | 三连跑无 flake | ✅ | `bun test tests/engine/rebuild/marketing/` ×3（2026-09-01，各自 unpiped 退出码）：136/136/136 pass、0 fail、EXIT 全 0——并行 agent 报告的「catalog 缺省」一次性 flake 未复现 |

## 3. 九契约 + 另钉映射（S3 §10 改写版 → setup.test.ts）

| 契约 | 测试落点 | 结果 |
|---|---|---|
| ① 蓝图尺寸建框（750 宽 + VERTICAL/counter-FIXED/白底/clipsContent） | setup.test.ts:102-115 | ✅ |
| ② HUG/FIXED 语义（'750x'→HUG 初始 400；'1080x1080'→FIXED） | setup.test.ts:117-130 | ✅ |
| ③ 标记六键读穿（role+四元组+schemaVersion；general 缺省键不写） | setup.test.ts:132-155 | ✅（BRIEF_SCHEMA_VERSION='1' 钉扎 :147） |
| ④ 最小空闲「label N」+ 恒新建（再调得「产品长图 2/3」，改名回裸名） | setup.test.ts:157-174 | ✅ |
| ⑤ briefId 不存在 → brief_not_found；空 id 多 brief → ambiguous_brief | setup.test.ts:176-205 | ✅（none 态亦归 brief_not_found，:188-192） |
| ⑥ modeId 校验（general 恒过 / unknown_mode / types:'none' mode 过） | setup.test.ts:207-225 | ✅ |
| ⑦ typeId 三态（在册过 / type_forbidden / type_required / type_not_in_mode） | setup.test.ts:227-242 | ✅（type_required 带 types 列表 extras，:236） |
| ⑧ 未确认 → unconfirmed_new_intent 且无框落地 | setup.test.ts:244-266 | ✅（缺省与显式 false 双路；页面顶层数不变） |
| ⑨ 关联设计区登记 + bound-designs 指针 + 读穿投影 | setup.test.ts:268-315 | ✅ |
| 另钉：信封字段恰全（placement 在内；general 缺省键不出现） | setup.test.ts:317-335 | ✅ |
| 另钉：放置右 +100 / y 跟随 / scrollAndZoomIntoView | setup.test.ts:337-360 | ✅ |
| 另钉：catalog 缺省仅 general 可用 / profileId 不在册 → unknown_profile | setup.test.ts:362-379 | ✅ |
| 另钉：ToolDef 注入缝（__catalog JSON / __confirmedNewIntent / 畸形容错） | setup.test.ts:483-556 | ✅ |

## 4. history.ts 收敛探针（V17 实证，2026-09-01 `bun -e` 一次性脚本，exit 0）

- **写侧编码形态**：setupDesign 落盘键为 `{pluginId:'open-pencil-marketing', key:'open-pencil-marketing/role', value:'marketing-root'}`（setSharedPluginData 编码面，plugin-data.ts:68-82，key=`${namespace}/${key}`）。
- **读侧互通**：`isMarketingDesignRoot(新根)=true`（setup.ts:140-143 → getSharedPluginData plugin-data.ts:62-66 → matchesSharedPluginData :21-26 编码键命中）；scanMarketingDesigns 同扫到。
- **消费闭环**：snapshotBeforeOverwrite 的历史容器锚定新根右侧（容器 x=2202 = root.x+750+100，history.ts:140-155 createContainer 锚定逻辑）。
- **legacy 容忍**：明文旧格式 `{pluginId:'open-pencil-marketing', key:'role'}` 手写标记仍被新读者判 true（matchesSharedPluginData :25 非编码兜底）；history.test.ts:109,128 即以旧格式造 marketing-root 且全绿——双向钉扎。
- 单源值 `MARKETING_ROLE_ROOT='marketing-root'` 仅 setup.ts:48 一处导出；`grep "marketing-root" packages/core/src src/` 除 setup.ts 外仅 hero-scaffold.ts:9 注释命中（T57 文件，非代码副本）。

## 5. 边界与未核项

- **CI 逐 push 口径（plan §3 第 6 条）**：本核验 agent 无 push 权限（红线），未触发远端 CI；九门禁本地全绿（V18），收口 push 后由主 agent 确认首跑。【未核】
- **T61 确认真源未落地**：service.ts:209 `newIntentConfirmed: () => false` 为契约内行为（S3 §2 L34-38 宿主拦截语义，S4 §7 尾巴表登记），AI 面恒 `unconfirmed_new_intent`——非缺陷，T61 UI 指令块落地前预期态。
- **MCP 侧 catalog 注入**属后续任务（plan §2 不做清单）；catalog 缺省语义已由测试 setup.test.ts:362-370, 528-555 钉扎。
- 工作树混入 T56/T57 并行改动（ask-user-question、hero-scaffold、ChatPanel/ChatMessage、i18n fork locales）；zones.json  diff 仅含 T56 登记（AskUserQuestionCard + P4/P47 patch reason），T53 零登记与 plan「ownedRoots 零登记」一致。tracker/_index 的 T53/T56/T57/T62 行为主 agent 登记，非实现者越权。
- lint 的 brief.ts max-lines 警告（880>600）为 T52 存量，非本任务引入；按核验授权「max-lines 警告可接受」处置。

## 6. 总结论

**可以收口**（V1-V19 全绿；CI 逐 push 一条超出本核验授权，收口动作时由主 agent 确认首跑——见 §5 首条）。

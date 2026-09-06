<!--
  写作纪律（改本文前必读）：
  - 事实性声明必须附核验命令 + 日期，否则标为【假设】
  - 本文只保留当前态，不保留修正历史
  - 详细规则见 docs/rebuild/05-process.md §4
-->

# T55 核验 · Phase 3 W2/T-B4：look 移植（通道 A + 媒体元数据字段化）

> **状态**：✅ 可以收口（2026-09-01 独立核验） | **时间**：2026-09-01 | **负责人**：独立核验 subagent（只读 + 本文唯一写权限）
> **核验对象**：rebuild/mode-arch 工作区未提交改动（HEAD=22f0d28b T51，`git status` 全量未提交，并行波次纪律「禁止 commit/push」成立，`git log --oneline -3` 实证 2026-09-01）
> **规格对照**：T55-plan.md §3 四条验收 + §4 三条红线；S3-tool-contracts-spec.md §5/§10 look 行

## 1. 核验范围

T55 名义文件集逐文件审读 + 移植源保真 diff + 三条测试命令实跑（unpiped）+ 九门禁与全量回归复跑。移植源钉 `open-pencil` 仓 feature/agent-backend @ 5d38aa4e（`git log --oneline -1 5d38aa4e` 实证存在，2026-09-01）。

## 2. 验收核验

| # | 验收项 | 结果 | 证据（2026-09-01，除注明外均 unpiped 直读退出码） |
|---|---|---|---|
| V1 | 三档导出模式自动选择触发条件正确 | ✅ | `bun test tests/engine/rebuild/marketing/look.test.ts` 30 pass / 0 fail / 99 expects：original-bytes（单 IMAGE fill 直出，「image-bearing nodes bypass rendering」无 exportImage mock 仍出图 +「mixed fills still render」反例）；isolated（自有可见填充 + 设计根无填充例外两条）；in-context（无填充容器 + 近白文字 + 低不透明度灰字 opacity 折叠三条）。实现侧 `needsContextExport`/`originalImageData`/`designRootId`/`contextClip` 与源 5d38aa4e 同文件 diff 逐字一致（`git show 5d38aa4e:...look.ts` 比对，唯一差异=通道 B 切除 + `mutates:false` 显式化 + id 文案换 setup_design，见 V5/I3） |
| V2 | 缩放策略边界 | ✅ | 同测试文件：4000 长边→scale≈1024/4000（`toBeCloseTo(...,5)`）；20000→0.1 钳制（`toBe(0.1)`）；800×600 区间内→`toBe(1)` 且 note 含「exported at 100%」；300→512/300 上采样；100→`toBe(4)` 封顶 + note 含「capped at ×4」。`exportScale` 与源逐字一致 |
| V3 | renderInContext/clip 主机能力真实实现 + 链路闭合 | ✅ | 四段全实装非桩：`figma-api/index.ts` options 类型增两键（与源 535-546 行逐字一致）；`render.ts` inContext 走活页渲染（`renderInContext===true \|\| nodeNeedsSceneBackdrop`）、clip 替代 content bounds、JPG 白底 clear、supersample `Math.max(2, scale)`——与源 diff 唯一差异在 `renderThumbnail` 段，`git diff HEAD` 证实该段 T55 未触碰（基线既有分歧）；`figma-factory.ts` 透传 quality/renderInContext/clip（与源逐字一致）→ `export/files.ts` renderExportImage 增 pageId 默认参 + quality + extras（与源逐字一致）；调用链 `server.ts→makeFigmaFromStore→tool-handlers makeFigma→store.renderExportImage（export/create.ts:30,114 接线）` 逐跳 grep 闭合。测试断言 `renderInContext:true` + clip `{0,52,750,898}`（48px 边距钳设计根）在案 |
| V4 | 通道 A 字段化：登记 + mapping 媒体块 + ImageContent 桥接 | ✅ | `media-output.ts` `MEDIA_OUTPUT_TOOLS={look, export_image}` 落 pi-backend 侧（ownedRoot）；`git diff packages/core/src/tools/schema.ts` 空（红线①成立）；`mapping.ts` 对登记工具 `tool_execution_end` 产出 `{type:'file', url:data URL, mediaType}` + 脱敏 `tool-output-available`——块形状契合 ai 包 UIMessageChunk file 定义（node_modules/ai/dist/index.d.ts:2392-2396）；`tools.ts` defineBridgeTool 对登记工具产出 pi `{type:'image', data, mimeType}`——契合 pi-ai ImageContent（pi-ai/dist/types.d.ts:241-245），文本副本脱敏、details 留全量供 mapping 接力；事件 `toolName` 字段真实性经 pi 源码发射点实证（agent-session.js:519-527）。钉扎测试 8 条全绿（含真实 look 结果 round-trip） |
| V5 | 通道 B / elision 零桩（红线②） | ✅ | `grep -n "vision\|channelB\|getVisionMode\|analyzeImageWithVisionModel\|isVisionChannelBReady" look.ts` 零命中（exit=1）；`grep -rn "elision" packages/core/src/tools/fork/ src/app/ai/pi-backend/` 零命中；源文件 vision import 三符号 + `analyzeViaVisionChannel` 函数 + `getVisionMode()==='B'` 分支整体切除无占位。测试无 B 通道凭据断言（S3 §10「通道 B 重写时更新凭据断言」的前置态） |
| V6 | 返回结构字段齐备 | ✅ | look.ts:318-327 返回 `base64/mimeType/byteLength/channel:'A'/node{id,name,width,height}/exportInfo{mode,scale?,upscaled?}/note`（focus 条件字段）；「returns the full fielded structure」测试逐字段断言（含 node 元数据——分区钻取承载字段，plan §1 末条） |
| V7 | 测试断言真实有效（非空转） | ✅ | mock exportImage 记录实际调用参数逐键断言（nodeIds/scale/format/quality/renderInContext/clip），非只断返回值；负面路径齐（未登记工具不产 file 块 / 登记工具无图像回退文本 / isError 走 tool-output-error）；mapping 测试事件形状与 pi 发射点一致（V4）；`sanitizeMediaToolOutput` 只剥 base64 余键保留断言在案 |
| V8 | 既有面不回退 | ✅ | `bun test tests/engine/tools/export-image.test.ts tests/engine/tools/registry.test.ts` 5 pass / 0 fail / 1066 expects（export_image 边界语义不变；registry 唯一性/描述/required 标记覆盖 look） |
| V9 | `bun test tests/engine/rebuild/` 全绿 | ✅ | 172 pass / 0 fail / 657 expects / 19 files（含 T52/T54/T59 同波套件，全绿不回退） |
| V10 | 九门禁 + CI 口径 | ✅（本地口径） | 九项逐项 exit 0：lint（0 errors；7 条 max-lines warning 均非 T55 文件，含 T52 brief.ts 880 行）/ typecheck（`tsgo --noEmit` + `check:vue` 双跑）/ format:check（2136 文件全正确）/ check:arch（steiger ✔ No problems found）/ check:zones（81 modified 全登记 / 451 added 全 owned / 1019 deleted / 0 renamed）/ check:tasks（P130-P137 摘要正确）/ check:bindings（66 文件全绿）/ test:type-shapes / check:i18n。附加：build:packages 九包 exit 0、check:docs 42/42、check:monorepo、check:packages（metadata+publint+attw）、check:deps（knip）、test:tools 27/27、test:dupes（jscpd 0 clones——svg/defs.ts 消克隆生效）。check:secrets 环境受限跳过（gitleaks 未装，CI 跑真扫描）；check:audit 需网络未跑（本 diff 零依赖变更，`git status` 无 package.json/lockfile 命中）。CI 逐 push 口径：波次纪律禁止 push，无 CI run 可核——以本地全门禁 + quick 套件为代理证据，真 CI 绿待收口提交后观察 |
| V11 | 全量回归失败数不增（对照 T51 基线） | ✅ | T51-verify 未记全量数（CI 修复任务），取最近记录基线 T45 收口 78 fail/2660（tracker.md:56，T46-T51 各行无更新值）。本机 8GB 内存两次整跑被 OOM/页面文件杀（exit 127/3，悬挂进程已清），改 quick 清单 447 文件分 6 片顺序跑（口径偏差已声明）：合计 2775 tests / **65 fail** ≤ 78，零新增失败簇——失败全部位于历史基线簇（CLI eval 子进程 spawn、BrowserRpcBridge/MCP concurrent、Figma clipboard、FIG export、flatten/boolean/canvas text render、variable binding、get_font_status；逐片 `(fail)` 行 grep 核对）；`grep rebuild 各片日志` 零 fail 命中；CLI eval 失败经手动复现证伪代码因果（同命令手动 `bun packages/cli/src/index.ts eval ...` 与 Bun.spawn 复刻均 exit 0 出正确 JSON，仅 `bun test` 进程内 spawn 失败——环境性问题） |
| V12 | 登记成文（zones/tracker/_index） | ✅ | zones.json P130-P135 六条 T55 patch（bytes/index re-export、figma-api options、render.ts、svg/defs 消克隆、figma-factory 透传、files.ts extras）+ P22 扩展注记，三新文件全落 ownedRoots（`packages/core/src/tools/fork/`、`src/app/ai/pi-backend/`、`tests/engine/rebuild/` 前缀覆盖，check:zones 实证）；tracker.md/_index.md T55 行在案（🔄 进行中，收口时翻 ✅） |

## 3. 问题清单（按严重度）

| # | 严重度 | 问题 | 处置建议 |
|---|---|---|---|
| I1 | 中 | **S3 §5 elision 条文与 T55 计划的表述张力**：S3 原文「elision（保留最近 K 张）仅通道 A 启用时才建…通道 B 主线不建」，T55-plan §1 引文写成「仅通道 B 启用时才建」（条件倒挂，引文勘误）；且 T55 通道 A 上线后无任何 elision——旧栈有 K=2 请求级 elision（l2-context-engineering.md 在案），新栈长会话多次 look 的 base64 图将在会话历史无界累积。验收字面不受影响（plan §2 不做清单明文排除、本核验指令亦以零桩为准），但 S3 读法会得出「通道 A 启用即欠 elision」 | owner 拍板：S4 尾巴表挂一行 elision 后续任务归属（~0.5-1 人日，context event 钩子，S3 已估算），顺手修正 plan §1 引文倒挂 |
| I2 | 低 | look.test.ts:14 头部注释过时：「lookTool 未注册进 FORK_TOOLS（fork/index.ts 是集成期主 agent 领土）」——集成已发生（fork/index.ts:18-20 含 lookTool，registry 唯一性测试实证）。测试直接 import 仍有效，纯注释误导 | 收口提交顺手删/改该行 |
| I3 | 低 | tools.ts:195-203 ImageContent 桥接段无单测覆盖（验收未要求——mapping 层钉扎已满足 §3.2；该段类型契合性本核验以源码比对覆盖）。defineBridgeTool 未导出、需桥 mock 方可测 | 记观察项；若后续媒体工具增多（export_image 走通验证）再补不迟 |
| I4 | 观察 | look.ts id 参数描述引用 `setup_design`（T53 工具，本仓尚未存在）——并行波次前向引用，与 brief.ts:58 注释同款模式；T53 落地后自洽。错误文案同步引用 setup_design | 无需处置；T-D1 集成冒烟时复核文案与实存工具名一致 |
| I5 | 观察 | 「模型真看到图」端到端无自动化覆盖：单测止于 chunk 产出与 ImageContent 形状，AI SDK 前端 file part 渲染与模型侧视觉输入未实证 | 契约口径如此（plan §3 未要求）；归 T-D1 集成冒烟 |
| I6 | 信息 | 本机环境：8GB 内存下 test:unit:quick 整跑两次被 OOM/页面文件杀（exit 127/3），分片跑通过；第一次整跑遗留的悬挂 bun 进程（1.9GB）加剧内存压力已清理。非代码问题 | 无需处置；后续核验遇同类症状先 `tasklist` 清悬挂 |

## 4. 总结论

**可以收口**。T55-plan §3 四条验收全部成立：V1/V2/V7 覆盖验收①（look 契约测试 30/30，三档/缩放/renderInContext/clip/返回结构全断言）；V4 覆盖验收②（登记钉扎 + mapping 媒体块单测）；V8/V9/V10/V11 覆盖验收③（rebuild 172/172 不回退、九门禁全绿、全量 65 fail ≤ 基线 78 且零新簇）；验收④以本地 CI 口径代理（波次禁 push，无 run 可核）。三条红线全守住（schema.ts 零 diff、通道 B/elision 零桩、无 commit/push）。移植保真度高——通道 A 代码路径与源 5d38aa4e 逐字一致，主机能力四文件与源同文件逐字一致。唯一中度事项 I1（elision 归属 + plan 引文倒挂）属规格-计划文档层裁决，不挡收口，但应在收口记录中显式挂账。

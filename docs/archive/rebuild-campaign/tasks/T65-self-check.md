<!--
  写作纪律（改本文前必读）：
  - 事实性声明必须附核验命令 + 日期，否则标为【假设】
  - 本文只保留当前态，不保留修正历史
  - 详细规则见 docs/rebuild/05-process.md §4
-->

# T65 自检 · Phase 3 W3：UI 交互修整批（owner 12 条拍板落地）

> **状态**：✅ 已完成（2026-09-01 收口） | **时间**：2026-09-01 立项 | **负责人**：主 agent + 实现 subagent X（后端）/Y（前端）+ 核验 subagent

决策源：doc/T65-ui-interaction-decisions.md（repo 外）；plan：docs/rebuild/tasks/T65-plan.md。

## 1. 实现段核验（2026-09-01 实测填报）

### 后端（subagent X）

- **sizes 预设清单**：`CanvasSizePreset{label,canvas}` 单源 `packages/core/src/tools/fork/marketing/setup.ts:71`，`parseCanvasSize` :80（正则 `/^\d+x(\d+)?$/`，`750x` = HUG 高）；studio/types.ts 别名收编（type-shapes 门禁避撞形），StudioWorkflow.sizes / StudioMode.sizes 透传；validate.ts `parseSizes`:91（非空清单、label 非空、canvas 正则，任一非法整条不注册）；registry.ts、manifest.ts:49、setup-catalog.ts:41 投影 `modes[].sizes?`（首条=首选预设；general 无此键）；longform.md frontmatter 落 [电商详情长图 750x, 小红书长图 1080x]；sizes 缺席 → 750 宽 HUG 缺省不变。
- **canvas 参数**：`SetupDesignArgs.canvas` setup.ts:107；优先序 = 显式传参 > sizes[0] > 缺省（resolveSize:191）；落盘 {width,height|null} 语义不变；ToolDef schema 四参；错误码表七码（新增 `invalid_canvas`，setup.ts:120）。
- **信封扩展 + 确认参数注入**：正则扩 canvas 组 `src/app/ai/pi-backend/active-design-host.ts:56`（逐字 `[新建意图确认 modeId=<id> profileId=<id> canvas=<值>]`，字段可缺省、顺序固定、容忍 CRLF）；`NewIntentEnvelope.canvas` :62；prepareTurn 注入系统提示行「用户已为本次新建确认参数：modeId=… profileId=… 尺寸=…（选择即锁定，不得覆盖）」（:386-396，extraNotices 进 contextLines）——修 T60/T61 集成缺口（剥离后确认参数对 AI 不可见）。

### 前端（subagent Y）

- **三合一状态面板**：`src/components/chat/ChatContextBar.vue`（644 行）挂 ChatPanel.vue header（:581）——当前设计（空槽触发词「新设计」）+ 设计列表 + 需求单（含新建需求单 `createBriefOnPage`，active-design.ts:258）合并，操作成本 3 跳 → 2 跳。
- **三旧面板物理删除**：ChatGalleryPanel.vue（gallery 整项删除，拍板④）/ ChatDesignListPanel.vue / ChatBriefPanel.vue；`grep -rn "ChatGalleryPanel\|ChatDesignListPanel\|ChatBriefPanel" src/ packages/ tests/` 零残留（2026-09-01）。
- **ChatInput 瘦身**（拍板⑤输入条哲学）：只留 chips + 模型名 label（随下一次消息发送生效的内容才进输入条）。
- **切换回执**：`CONTEXT_SWITCH_PART_TYPE='data-context-switch'`（active-design.ts:140）——对话流分割线形式（拍板⑨）。
- **chips**：badge 内容 + 撤销 ×；NewIntentPartData.sizeChoices 别名 core CanvasSizePreset。
- **防丢**：草稿丢失守卫 = 行内确认条（不用 window.confirm——Tauri WKWebView）；空槽提示挂 ChatInput 表单上方；字号 ≥11px；i18n panels 命名空间重写 + gallery 键清除（`bun run check:i18n` exit 0）。

### 集成（主 agent）

- **zones.json 转 owned**（拍板⑥）：`src/components/chat/` → ownedRoots；`src/components/ChatPanel.vue` → ownedFiles；patch P4/P5/P47 退役（$comment 注记，历史留 git）；pendingReclass 两条目移除；T61 的 7 个 ownedFiles 条目 + AskUserQuestionCard 条目移除（ownedRoot 覆盖，双账清理）；tool-state.ts 移出 T32 tarball.paths（提升时与 base 88c10770 byte 一致，hash 806591eb 双侧实证，2026-09-01）。

## 2. 门禁实测（2026-09-01，全 unpiped）

| 门禁 | 命令 | 结果 |
| --- | --- | --- |
| zones | `bun run check:zones` | clean: 81 modified / 508 added / 1019 deleted / 0 renamed |
| typecheck | `bun run typecheck`（tsgo + vue-tsc ×2） | exit 0 |
| i18n | `bun run check:i18n` | All locale files are in sync |
| type-shapes | `bun run test:type-shapes` | No duplicate object type shapes |
| lint | `bun run lint`（structure + type-aware） | 0 errors（max-lines 警告均为既有存量，T65 零新增） |
| dupes | `bun run test:dupes`（jscpd threshold 0） | 0 clones |
| oxfmt | `bunx oxfmt --check`（28 触碰文件） | All matched files use the correct format |
| SFC 编译 | @vue/compiler-sfc parse+compileTemplate（8 个触碰 .vue） | 8/8 OK |
| 单测 | `bun test ./tests/engine/rebuild` | 336 pass / 0 fail |
| 冒烟 | `bun run smoke:pi`（t22/t22-history/t23/t24/t28 五套件 && 链） | exit 0 |

## 3. 实测偏差记录

1. **裸信封不注入提示行**（零参数即无可锁定字段；X 偏差①）。
2. **宿主注入 catalog 预设非法时容忍落缺省**不报错（沿袭「宿主 bug 不炸画布」；X 偏差②）。
3. **剥离层不校验 canvas 格式**——非法值由 core setup_design 报 invalid_canvas（单一校验点原则；X 偏差⑤）。
4. **新建需求单后 popover 保持打开**（Y 偏差：让用户继续查看新条目，而非自关）。
5. **视觉冒烟未做**（契约内：归 W4 T-D 批次）；组件可构建可挂载由 typecheck/vue-tsc/SFC 扫描实证。

## 4. 遗留

- Playwright 交互验证（三合一面板/新建需求单/分割线回执/尺寸选择）→ W4 T-D1/D2。
- S1/S2/S3/S4 文档同步 T62 删除 + T65 拍板（输入条哲学、restyle=切 profile 新建、gallery 删除注记、当前页口径、sizes 语义）→ W3 T-C 批次随行。

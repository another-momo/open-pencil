# T91b-self-check · newIntent pluginData + ChatPanel 拦截 + abort + server endpoint

> **状态**：🟡 待验收 | **时间**：2026-09-04
> **任务来源**：T91a 收尾记录「待 T91b 接续」；owner 实测 bug 2（后半段）+ bug 3
> **关联**：T91a 已落 d1809c1df（UUID + brief 合并 + .fig pluginData）；本任务处理 envelope 时序错配 + 用户答「是」的死循环

## 1. 改动文件清单

### 代码（9 改/建）

| 文件                                                      | 改动                                                                                                                                                                                                                                                                                                                                                          |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/core/src/tools/fork/marketing/brief.ts`         | 加 newIntent pluginData 键常量（`NEW_INTENT_MODE_ID_KEY` / `NEW_INTENT_PROFILE_ID_KEY` / `NEW_INTENT_CONFIRMED_KEY`）+ `NewIntentState` interface + 4 个 helper：`readNewIntent` / `writeNewIntent` / `clearNewIntent` / `markNewIntentConfirmed`                                                                                                             |
| `packages/core/src/tools/fork/marketing/active-design.ts` | `ACTIVE_DESIGN_PROBE_KEYS` 扩三键（`newIntentModeIdKey` / `newIntentProfileIdKey` / `newIntentConfirmedKey`），从 brief.ts 单源 import 常量                                                                                                                                                                                                                   |
| `packages/core/src/tools/fork/marketing/setup.ts`         | 新增 `SetupDesignAwaitingIntent` 信封类型；移除 `SetupDesignErrorCode.unconfirmed_new_intent`；`SetupDesignResult` 联合增 awaiting 信封；`setupDesign` 双源检查 args + pluginData → 未确认返 awaiting 信封；落图成功后 `clearNewIntent`                                                                                                                       |
| `packages/core/src/tools/fork/marketing/setup-tool.ts`    | `setupDesignTool.description` 更新（描述 awaiting 信封）；头注加 T91b pluginData 双源注释                                                                                                                                                                                                                                                                     |
| `packages/core/src/tools/fork/marketing/texts.ts`         | 头注更新（T91b 不再有错误面，文案迁移到 awaiting 信封 message）                                                                                                                                                                                                                                                                                               |
| `src/app/ai/pi-backend/active-design-host.ts`             | `ActiveDesignBridgeIO` 扩 `probeNewIntent` / `clearNewIntent`；新增 `NewIntentSnapshot`；新增 `buildProbeNewIntentSource` / `buildClearNewIntentSource` 桥 eval 源；`createBridgeSlotIO` 实现两方法；`confirmNewIntentViaBridge`（写 pluginData 三键的 server handler）；`onDesignCreated` 钩子清 pluginData；`prepareTurn` OR 信封兼容路径 + pluginData 探针 |
| `src/app/ai/pi-backend/setup-catalog.ts`                  | 头注更新：newIntent 旗标真源迁到 pluginData                                                                                                                                                                                                                                                                                                                   |
| `src/app/ai/pi-backend/service.ts`                        | import + 挂载 `confirmNewIntent`（`POST /api/pi/intent-confirm` handler）                                                                                                                                                                                                                                                                                     |
| `src/app/ai/pi-backend/server.ts`                         | 新增 `handleIntentConfirmRequest` handler；路由 `/api/pi/intent-confirm`                                                                                                                                                                                                                                                                                      |
| `src/components/chat/active-design.ts`                    | 新增 `SetupAwaitingIntentPayload` interface + `parseSetupAwaitingIntent` 解析器 + `postIntentConfirm` 端点客户端                                                                                                                                                                                                                                              |
| `src/components/chat/ChatAwaitingIntentCard.vue`          | **新建**——轻量确认卡（modeId / profileId / briefId 三行 + Confirm / Cancel）                                                                                                                                                                                                                                                                                  |
| `src/components/chat/ChatMessage.vue`                     | import `parseSetupAwaitingIntent` + `ChatAwaitingIntentCard`；emit `intentAwaitingConfirm` / `intentAwaitingCancel`；模板挂 setup_design awaiting 分支                                                                                                                                                                                                        |
| `src/components/ChatPanel.vue`                            | import `postIntentConfirm`；新增 `awaitingIntentDecisions` 决断集；`handleIntentAwaitingConfirm`（POST intent-confirm + chat.stop + 系统行回执）；`handleIntentAwaitingCancel`（chat.stop + 系统行）；模板接两 emit                                                                                                                                           |
| `src/app/i18n/fork/locales/zh-cn.ts` / `en.ts`            | 新增 `awaitingIntentTitle / Mode / Profile / Brief / Confirm / Cancel / ConfirmedToast / ConfirmedLine / CancelledLine / FailedLine`                                                                                                                                                                                                                          |

### 测试（4 改/建）

| 文件                                                         | 改动                                                                                                                                                                                                  |
| ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tests/engine/rebuild/marketing/setup.test.ts`               | 旧 `⑧ 未确认 → unconfirmed_new_intent` 改为 `awaiting_new_intent_confirmation` 信封断言；新增 `⑧b pluginData 确认 → 落图 + 清三键`；新增 `⑧c pluginData 未确认 → awaiting 信封 + clearNewIntent 复位` |
| `tests/engine/rebuild/marketing/brief.test.ts`               | 新增 `newIntent pluginData 三键 round-trip`：write → read 对称 / clear 复位 / 字面量 `'true'` 单值判定                                                                                                |
| `tests/engine/rebuild/pi-backend/intent-confirm.test.ts`     | **新建**——`confirmNewIntentViaBridge` 4 例：modeId 缺 → invalid_args / 桥成功 → ok true（profileId 透传）/ profileId 缺省 / 桥不可达 → bridge_unavailable                                             |
| `tests/engine/rebuild/pi-backend/active-design-host.test.ts` | 头注加 T91b pluginData 探针二源确认 + clearNewIntent hook 说明（实际断言留给 bridge IO 集成测试；本测聚焦 envelope 路径）                                                                             |

### 治理（3 改/建）

| 文件                                    | 内容                              |
| --------------------------------------- | --------------------------------- |
| `docs/rebuild/tasks/T91b-self-check.md` | 新建（本文件）                    |
| `docs/rebuild/tasks/T91b-verify.md`     | 新建（验收对照 + 端到端真值再生） |
| `docs/rebuild/tasks/_index.md`          | 追加 T91b 行                      |
| `docs/rebuild/tracker.md`               | 追加 T91b 行                      |

## 2. 关键决策与发现

### 决策 1：信封 vs pluginData 双源并存（OR 语义）

- 信封 `[新建意图确认 modeId=...]` 路径保留为**程序化**同步通道（程序化调用方一次同步确认）；
- 前端 ChatAwaitingIntentCard 路径走 pluginData（持久化跨回合 + 跨重启）；
- `setupDesign` 端 args + pluginData 二者其一为真即放行；
- `prepareTurn` 端 envelope 命中 OR pluginData 探针 confirmed → `intentConfirmed = true`。

### 决策 2：pluginData 真源放 document root

- brief / design 走 frame 节点 `sharedPluginData`；newIntent 是**文档级**状态（与活动文档相关，不与具体 brief / design 绑定），写 document root 单源。
- 键面常量走 brief.ts 单源（`NEW_INTENT_*_KEY`），`active-design.ts` import 复用不双写。

### 决策 3：信源读取合并在 core 工具层而非 host

- `setupDesign(figma, args)` 直接 `readNewIntent(figma)` 读 pluginData，不依赖 host 注入。
- host 端 `newIntentConfirmed()` 走桥 eval 探针读 pluginData，但只是给 `tools.ts` 注入 args `__confirmedNewIntent` 用（一次性 path），不是真源。
- 真源 = `core` 工具层 `readNewIntent`（浏览器端拿 figma 句柄直读）+ `host` 端 `probeNewIntent`（后端拿不到 figma 句柄经桥 eval 探针）。

### 决策 4：awaiting 信封结构与 awaiting_user 同构

- `SetupDesignAwaitingIntent = { status: 'awaiting_new_intent_confirmation', proposed: {modeId, profileId, briefId}, catalog, message }`
- 信封 message 字段复用 `SETUP_TEXTS.unconfirmedNewIntent`（文案同口径，错误面已收六码）
- 前端 ChatMessage 检测 status 字段挂 ChatAwaitingIntentCard（不挂通用折叠工具卡——避免落入 error 视觉）

### 决策 5：abort 用 AI SDK Chat.stop

- ChatPanel 端 `chat.value?.stop()` 截停 SSE 流（client-side abort = 后端 SSE 链路终止，与 service-abort.test 验证过的语义一致）
- 不再需要 server-side `/api/pi/chat-cancel` 端点（用户答"是" / "否"后都不需要后端取消——前端断连即可）

### 决策 6：clearNewIntent 触发点

- `setupDesign` 落图成功后清 pluginData 三键（避免下次装配读到旧 modeId 误用）
- 仅 pluginData 确认路径清（args 一次性确认 = 程序化调用 = 不污染共享 document root）
- `onDesignCreated` 桥 hook 也调 `clearNewIntent`（双保险——即便 core 端 clearNewIntent 失败 host 仍兜底）

## 3. 已知边界

- **跨 .fig 重导入保留**：pluginData 与 UUID 走同一持久化层，T91a 已钉 round-trip 5/5；T91b 不再补测（共享基础设施）
- **多用户并发确认**：本任务只处理单用户单文档场景，不处理协作冲突（active_design 同 pattern——单槽不并发）
- **pluginData 字符编码**：服务端经桥 eval 传字符串，与 brief UUID 同源；T91a 钉 round-trip 覆盖

# T94-self-check · 停止按钮误报错误修复

> **状态**：🟡 待验收 | **时间**：2026-09-04
> **任务来源**：owner 任务卡 T94；预研 `docs/202609031745-reasoning-visibility-and-stop-button.md` §3 + §5.3
> **关联**：T93 同修一份预研（reasoning 可见性，已完成）；T92/T93 在途同文件 diff 正交实证（ChatPanel.vue 的 T93 落点是 `isThinking` 一行，ChatMessage.vue 的 T93 落点是 reasoning 折叠卡分支，与本任务落点零重叠）

## 1. 改动文件清单

### 代码（4 改）

| 文件                                  | 改动                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/components/ChatPanel.vue`        | 新增 `isUserStopped = ref(false)` + `justStopped = refAutoReset(false, 4000)`；`handleStop()` 先立旗标再 `chat.value?.stop()`；`chatFailure` watcher 加吞错误分支（旗标命中 → `clearChatFailure()` + return）；新增 `watch(status, ...)` 消费旗标（ready → toast.info + justStopped；error → clearChatFailure + `chat.value?.clearError()`）；模板 ChatMessage 传 `:stopped="index === messages.length - 1 && justStopped"` |
| `src/components/chat/ChatMessage.vue` | props 新增 `stopped?: boolean`（默认 false）；模板 role 分支之后挂 `data-test-id="chat-stopped-hint"` 瞬时小字行（`icon-lucide-circle-stop` + `confirmText.chatStopped`，`text-[11px] text-muted`）                                                                                                                                                                                                                         |
| `src/app/i18n/fork/locales/en.ts`     | `confirmMessageDefaults` 新增 `chatStopped: 'Stopped'`（confirm 组 = 聊天流回执键既有宿主；T93 `reasoningTitle` 同组先例）                                                                                                                                                                                                                                                                                                  |
| `src/app/i18n/fork/locales/zh-cn.ts`  | `confirm` 组新增 `chatStopped: '已停止'`                                                                                                                                                                                                                                                                                                                                                                                    |

### 治理（5 改/建）

| 文件                                   | 内容           |
| -------------------------------------- | -------------- |
| `docs/rebuild/tasks/T94-plan.md`       | 新建           |
| `docs/rebuild/tasks/T94-self-check.md` | 新建（本文件） |
| `docs/rebuild/tasks/T94-verify.md`     | 新建           |
| `docs/rebuild/tasks/_index.md`         | 追加 T94 行    |
| `docs/rebuild/tracker.md`              | 追加 T94 行    |

## 2. 关键决策与发现

### 决策 1：旗标消费点放 status watcher，吞错误放 chatFailure watcher

- AI SDK `makeRequest` catch 块内 `onError` 先于 `setStatus({status:'error'})` 同步执行（node_modules/ai/dist/index.js dist 实证）——两者同 tick 落位，Vue watcher 按最终值合并触发，创建顺序（chatFailure watcher 在前）保证吞错误分支先跑；即使顺序反转，`clearChatFailure()` 后置 null 也让 toast 分支 `if (!reason) return` 短路。
- `isUserStopped` 只在 `handleStop` 立旗——stop 按钮 `v-if="isStreaming"` 守卫（ChatInput.vue）保证随后必有 ready/error 终态消费旗标，不会无条件残留。

### 决策 2：error 分支追加 `clearError()`

- 吞掉假 error 后 status 残留 `'error'` 虽不妨碍发送（ChatInput 只挡 streaming/submitted），但与干净 abort 路径终态（ready）不一致；`clearError()` 是 SDK 官方复位（"set the status to ready if the chat is in an error state"），调用后 watcher 以 flag=false 重入一次 no-op，无循环。

### 决策 3：停止回执双通道（toast + 末条消息瞬时行）

- 必修「显示正常停止提示」走 `toast.info(confirmText.value.chatStopped)`——T91b `awaitingIntentConfirmedToast` 同形态先例；
- 选修 ChatMessage 底部小字行同步落地：`justStopped` refAutoReset(4s) 派生（`debugCopied` refAutoReset 先例），只传末条消息，`data-test-id="chat-stopped-hint"`。
- 两通道同文案同键，toast 即时醒目、行内上下文化，4s 后均消散不污染会话历史（不走 `appendHostMessage`——避免重载后历史里堆「已停止」系统行）。

### 决策 4：i18n 键落 confirm 组

- 任务只指定落到 fork seam 两个 locale 文件，未指定组；`confirm` 组已是聊天流回执键宿主（awaitingIntent\* / contextSwitchLine），ChatPanel 与 ChatMessage 均已消费 `useForkConfirm()`——选 confirm 组让 `index.ts` 零变更（新组需注册 `get()` 映射）。

### 决策 5：T91b 两处 stop 调用点不立旗标

- `handleIntentAwaitingConfirm` / `handleIntentAwaitingCancel` 的 `chat.stop()` 是流程内部截停，已有显式回执（系统行 + toast）；立旗标会多弹一次「已停止」属双重通知。其 abort 若竞态漏出假 error，登记为已知边界（plan「不修」节）。

## 3. 门禁实录（2026-09-04）

| 门禁        | 命令                                                                                                                          | 结果                                               |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| oxfmt       | `bunx oxfmt --check`（4 触碰文件）                                                                                            | ✅ All matched files use the correct format        |
| tsgo        | `bunx tsgo --noEmit`                                                                                                          | ✅ 0 错（无输出）                                  |
| vue-tsc     | `bunx vue-tsc --noEmit -p tsconfig.json`                                                                                      | ✅ 0 错（无输出）                                  |
| oxlint      | `oxlint -c oxlint.json`（4 触碰文件）                                                                                         | ✅ 0 error / 1 warn（见 §4）                       |
| i18n        | `bun run check:i18n`                                                                                                          | ✅ All locale files are in sync                    |
| cancel 回归 | `bun test tests/engine/rebuild/pi-backend/chat-cancel-route.test.ts tests/engine/rebuild/pi-backend/transport-cancel.test.ts` | ✅ 8 pass / 0 fail                                 |
| 邻近回归    | `bun test tests/engine/rebuild/marketing/tool-output-display.test.ts`                                                         | ✅ 5 pass / 0 fail（T92 文件，ChatMessage 共用区） |

e2e `tests/e2e/chat/panel.spec.ts` 无 stop 按钮用例（仅 mock 流用 `finishReason:'stop'`），无需更新。ChatPanel/ChatMessage 无现成组件单测（T93 self-check 同结论），行为真值留 owner dev 实测（verify 三场景）。

## 4. 已知边界

- **max-lines warn**：ChatPanel.vue script 段 621 行越过 600 阈值（T93 +2 行 + T94 +32 行合力；规则为 warn 非 error，lint 脚本未加 `--deny-warnings`；`src/app/ai/pi-backend/active-design-host.ts` 645 行 warn 先例在）。ChatPanel 瘦身留后续专项。
- **旗标残留窄窗**：stop 后 chat 实例被替换（切 tab/reset）且新 chat status 初值与旧值相同（ready→ready 不触发 watcher）时，旗标理论上可残留并误吞下一次真错误 toast。实证评估窗口极窄（进行中流在切 tab 前大概率已终态化），接受（plan 风险节同述）。
- **全局 unhandledrejection → toast.error 通道**不经 chat status/chatFailure，无法凭旗标区分，不在本任务范围（plan「不修」节）。

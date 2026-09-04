# T94-plan · 停止按钮误报错误修复（isUserStopped 旗标 + 「已停止」回执）

> **任务来源**：owner 任务卡 T94；预研真源 仓外 `docs/202609031745-reasoning-visibility-and-stop-button.md` §3（停止按钮显示报错）+ §5.3（停止按钮改进）
> **关联**：T93 同修一份预研（reasoning 可见性，已完成）；T91b 两处 `chat.value?.stop()` 调用点（awaiting 确认/取消）在本任务只登记边界、不改行为
> **日期**：2026-09-04

### 背景与动机

用户点停止按钮 → `ChatPanel.handleStop()` → `chat.value?.stop()` → AI SDK abort 本 fetch + transport 带外 POST `/api/pi-chat/cancel`（T73）→ 后端 `service.abort(sessionId)` → SSE 断开。前端不区分「用户主动停止」和「意外断开」：断开若被 AI SDK 判负（`status='error'` + `onError` → `chatFailure`），ChatPanel 的 `chatFailure` watcher 弹 `toast.error(chatRequestFailed)`——正常操作被当作错误显示（预研 §3.3）。

### 关键事实（ai@7.0.68 / @ai-sdk/vue@4.0.68 dist 实证）

1. **干净 abort 路径**：`AbstractChat.makeRequest` 内 `isAbort` 旗标由 `abortController.signal` 监听同步置位；catch 里 `if (isAbort || err.name === 'AbortError')` → `setStatus({status:'ready'})`，**不调 onError**。`onFinish` 以 `isAbort:true` 触发（`transports.ts handleChatFinish` 对 isAbort 短路，无 diagnostics 污染）。
2. **竞态漏网路径**：owner 实测观察到 error 显示（预研 §3 定谳）。理论上面 1 覆盖大多数情形，但停止时序里服务端 SSE 断开方式 / 全局 `unhandledrejection`（`src/app/shell/ui.ts`）等因素可能让 error 漏出——**本修复对两种终态（ready / error）都兜底，不依赖竞态根因的完全钉死**。
3. **onError 先于 setStatus 同步触发**（makeRequest catch 块内顺序）——`chatFailure` 置位与 `status='error'` 落在同一 tick；Vue watcher 按最终值合并触发，`chatFailure` watcher 凭 `isUserStopped` 旗标吞错误是可靠的。
4. **stop 按钮只在 streaming/submitted 时出现**（`ChatInput.vue` `isStreaming` 守卫 + `v-if`）——旗标必然被随后的 ready/error 终态消费，不会无条件残留吞掉后续真错误。
5. **`clearError()`** 是 AI SDK 官方复位接口（"set the status to ready if the chat is in an error state"）——吞掉假 error 后把 status 拉回 ready，与干净 abort 路径终态一致。

### 方案概览

```
handleStop() 先 isUserStopped = true 再 chat.stop()
        ↓
status 落 ready（干净路径）──→ toast.info(chatStopped) + 末条消息瞬时「已停止」行（4s refAutoReset）+ 旗标复位
status 落 error（竞态漏网）──→ chatFailure watcher 吞掉（clearChatFailure，不弹 toast.error）
                              + status watcher error 分支复位旗标 + clearError() 拉回 ready
```

### 改动清单（4 代码文件）

| 文件                                  | 改动                                                                                                                                                                                                                                                               |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/components/ChatPanel.vue`        | 新增 `isUserStopped` ref + `justStopped` refAutoReset(4s)；`handleStop` 先立旗标再 stop；`chatFailure` watcher 加吞错误分支；新增 `status` watcher 消费旗标（ready→toast+瞬时行；error→clearChatFailure+clearError）；模板 ChatMessage 传 `:stopped`（仅末条消息） |
| `src/components/chat/ChatMessage.vue` | 新增 `stopped?: boolean` prop；模板尾部（role 分支之后）挂 `data-test-id="chat-stopped-hint"` 瞬时小字行（circle-stop 图标 + `confirmText.chatStopped`，muted 11px）                                                                                               |
| `src/app/i18n/fork/locales/en.ts`     | `confirmMessageDefaults` 新增 `chatStopped: 'Stopped'`（confirm 组 = 聊天流回执键的既有宿主，awaitingIntentConfirmedToast 先例；ChatPanel/ChatMessage 均已消费 `useForkConfirm`，index.ts 零变更）                                                                 |
| `src/app/i18n/fork/locales/zh-cn.ts`  | `confirm` 组新增 `chatStopped: '已停止'`                                                                                                                                                                                                                           |

### 治理（5 改/建）

| 文件                                   | 内容           |
| -------------------------------------- | -------------- |
| `docs/rebuild/tasks/T94-plan.md`       | 新建（本文件） |
| `docs/rebuild/tasks/T94-self-check.md` | 新建           |
| `docs/rebuild/tasks/T94-verify.md`     | 新建           |
| `docs/rebuild/tasks/_index.md`         | 追加 T94 行    |
| `docs/rebuild/tracker.md`              | 追加 T94 行    |

### 验收

- `bunx oxfmt --check`（4 触碰文件）干净；`bunx tsgo --noEmit` 0 错；`vue-tsc --noEmit -p tsconfig.json` 0 错
- `bun run check:i18n` locale 同步通过
- `bun test tests/engine/rebuild/pi-backend/chat-cancel-route.test.ts tests/engine/rebuild/pi-backend/transport-cancel.test.ts` 8/8 无回归
- 行为真值（留 owner dev 实测）：
  - 场景 1（干净路径）：streaming 中点停止 → 无 error toast → toast「已停止」+ 末条消息底部 4s 小字行 → 输入框恢复可发送
  - 场景 2（竞态路径）：停止后若 SDK 落 error → 无 error toast、无 chatFailure 残留 → status 复位 ready（发送不受阻）
  - 场景 3（真错误不吞）：非停止触发的失败（如凭证 401/网络断）→ 仍弹 `chatRequestFailed` toast

### 不修（边界）

- **T91b 两处 `chat.stop()` 调用点**（`handleIntentAwaitingConfirm` / `handleIntentAwaitingCancel`）不立旗标——那两个流程已有显式回执（系统行 + toast），再弹「已停止」属双重通知；若其 abort 竞态漏出假 error，后续任务再议（登记为已知边界）
- **全局 `unhandledrejection` → toast.error 通道**（`src/app/shell/ui.ts`）不在本任务范围——该通道不经 chat status/ chatFailure，无法凭 `isUserStopped` 区分
- **预研 §5.4 loading indicator 放大**——T93 任务卡明确不修，本任务同律
- **后端 `service.abort` 返回值**（预研 §5.3「后端配合」段）——后端 abort 语义已由 T73 测试钉扎，本任务纯前端

### 风险

- **旗标残留风险**：stop 后 chat 实例被替换（切 tab / reset）而 status watcher 未观察到终态 → 旗标残留，下一次真错误被误吞。缓解：切 tab / clear 后 ensureChat 重建 Chat，新 chat 的 status 初值 'ready' 与旧值不同则 watcher 触发消费；同值（ready→ready）不触发的情形下，stop 按钮在新 chat 上不可点（status 非 streaming），真错误路径 = 新 chat 的 submit 失败——此时旧旗标可能残留误吞一次 toast。**实证评估**：切 tab/reset 前若有进行中的流，旧 chat 的 abort 大概率已先把 status 落终态消费旗标；残留窗口极窄，接受为已知边界。
- **max-lines warn**：ChatPanel.vue script 段 621 行（T93+T94 合力越过 600 阈值；warn 非 error，`active-design-host.ts` 645 行先例在）——瘦身留后续专项，本任务不做。

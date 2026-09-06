# T94-verify · 停止按钮误报错误修复

> **状态**：🟡 待 owner dev 实测 | **时间**：2026-09-04
> **关联**：T93（同预研 reasoning 部分，已完成）；T91b（stop 调用点边界登记）

## 验收对照

| 项                             | 计划                                                         | 实测                                                                                                                                                      | 通过 |
| ------------------------------ | ------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- |
| ChatPanel `isUserStopped` ref  | `handleStop()` 先立旗标再 `chat.value?.stop()`               | `isUserStopped = ref(false)` 就位；handleStop 首行 `isUserStopped.value = true`                                                                           | ✅   |
| status watcher 消费旗标        | ready → 正常停止提示 + 复位；error → 吞错误 + 复位           | `watch(status, ...)` 双分支就位；error 分支另加 `clearChatFailure()` + `clearError()`                                                                     | ✅   |
| chatFailure watcher 吞错误     | 旗标命中 → `clearChatFailure()` + return（不弹 toast.error） | 分支就位，注释钉 T94                                                                                                                                      | ✅   |
| i18n `chatStopped` 键          | en "Stopped" / zh-CN "已停止"，fork seam 两 locale           | `confirmMessageDefaults` + zh-cn `confirm` 组全数就位；`check:i18n` 通过                                                                                  | ✅   |
| ChatMessage 停止小字行（选修） | status ready 且停止刚触发 → 末条消息底部 muted 行            | `stopped` prop + `data-test-id="chat-stopped-hint"` 模板行就位；ChatPanel 传 `:stopped="index === messages.length - 1 && justStopped"`（4s refAutoReset） | ✅   |
| oxfmt                          | 触碰文件格式干净                                             | `bunx oxfmt --check` 4 文件全过                                                                                                                           | ✅   |
| tsgo                           | 0 错                                                         | `bunx tsgo --noEmit` 无输出                                                                                                                               | ✅   |
| vue-tsc                        | 0 错                                                         | `bunx vue-tsc --noEmit -p tsconfig.json` 无输出                                                                                                           | ✅   |
| cancel 测试无回归              | chat-cancel-route + transport-cancel                         | 8 pass / 0 fail（2026-09-04 实录）                                                                                                                        | ✅   |

## 端到端真值再生（dev server 起动后，留 owner 实测）

1. **场景 1（干净停止）**：发消息 → streaming 中点停止按钮 → 预期：无 error toast；弹「已停止 / Stopped」info toast；末条消息底部出现 4s `chat-stopped-hint` 小字行（circle-stop 图标）；输入框恢复可发送；停止按钮随 status=ready 消失。

2. **场景 2（竞态漏网）**：停止后若 SDK 落 `status='error'`（服务端 SSE 断开竞态）→ 预期：仍无 error toast；`chatFailure` 无残留（Copy log 不含失败记录）；status 被 `clearError()` 拉回 ready；可立即重发消息。

3. **场景 3（真错误不吞）**：非停止路径的失败（如模型凭证失效 / 后端不可达）→ 预期：仍弹 `chatRequestFailed`（或 insufficient-credit / output-limit 对应文案）error toast——旗标未立，吞错误分支不生效。

4. **场景 4（T91b 边界确认）**：awaiting 确认卡 Confirm/Cancel 触发的内部 stop → 预期：只出该流程自有回执（系统行 + toast），**不**出「已停止」toast——该路径未立旗标，属登记边界（若观测到假 error toast 漏出，升级为新任务）。

## 核验命令

```bash
bunx oxfmt --check src/components/ChatPanel.vue src/components/chat/ChatMessage.vue src/app/i18n/fork/locales/en.ts src/app/i18n/fork/locales/zh-cn.ts
bunx tsgo --noEmit
bunx vue-tsc --noEmit -p tsconfig.json
bun run check:i18n
bun test tests/engine/rebuild/pi-backend/chat-cancel-route.test.ts tests/engine/rebuild/pi-backend/transport-cancel.test.ts
```

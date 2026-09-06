# T93-self-check · reasoning 可见性修复（isThinking 圆点 + reasoning 折叠渲染）

> **状态**：✅ 完成 | **时间**：2026-09-04
> **任务来源**：仓外预研 `docs/202609031745-reasoning-visibility-and-stop-button.md` §5.1 + §5.2（方案 A）
> **关联**：T92（tool-output 统一出口）同期在途——ChatMessage.vue 工作树含 T92 未提交改动（hasErrorOutput 删除 / displayToolOutput 接入），本任务 diff 与其正交（import 行合并 + reasoning 分支插入），未触碰 T92 区块

## 1. 改动文件清单

### 代码（4 改）

| 文件 | 改动 |
| ---- | ---- |
| `src/components/ChatPanel.vue` | `isThinking` 计算属性加 `if (lastPart.type === 'reasoning') return true`（:150，step-start 行之后）——reasoning 流式期间三圆点不再消失（预研 §5.1 原样落地） |
| `src/components/chat/ChatMessage.vue` | import 追加 `isReasoningUIPart`（from 'ai'）；模板链 tool-call 分支与 text 分支之间插入 reasoning `<details>` 折叠卡——`:open="streaming"`（流式展开、结束折叠、此后用户手动态保持）、`data-test-id="chat-reasoning"`、brain 图标 + `confirmText.reasoningTitle` 标题 + `border-l-2` 竖线正文（whitespace-pre-wrap 纯文本） |
| `src/app/i18n/fork/locales/en.ts` | `confirmMessageDefaults` 尾部加 `reasoningTitle: 'Thinking process'`（T93 注释） |
| `src/app/i18n/fork/locales/zh-cn.ts` | `confirm` 段尾部加 `reasoningTitle: '思考过程'`（T93 注释） |

### 治理（5 改/建）

| 文件 | 内容 |
| ---- | ---- |
| `docs/rebuild/tasks/T93-plan.md` | 新建 |
| `docs/rebuild/tasks/T93-self-check.md` | 新建（本文件） |
| `docs/rebuild/tasks/T93-verify.md` | 新建 |
| `docs/rebuild/tasks/_index.md` | 追加 T93 行 |
| `docs/rebuild/tracker.md` | 追加 T93 行 |

## 2. 定谳记录

1. **i18n 键落 `confirm` 组而非新建 `chat` 命名空间**：ChatMessage.vue 已消费 `useForkConfirm()`（contextSwitchLine 先例——对话流内联文案本就在 confirm 组），零新 import、零 index.ts 变更；新命名空间语义更纯但违反最小改动纪律，否决（plan §关键事实 2）。
2. **`<details :open="streaming">` 交互语义**：流式期间每 token 重渲染强制展开（用户此时手动折叠会被盖回，可接受，与预研示例一致）；streaming 翻 false 时折叠一次；此后无重渲染，用户展开/折叠状态保持。
3. **视觉不照搬预研示例的 text-sm**：本聊天气泡正文即 text-xs、工具卡 label 为 text-[11px]——折叠卡对齐工具卡骨架（`rounded-lg border border-border bg-canvas` + text-[11px]），保持面板视觉一致。
4. **zones 零变更**：ChatPanel.vue 在 ownedFiles（T65 晋升）、src/components/chat/ 与 src/app/i18n/fork/ 均为 ownedRoot——无需登记。

## 3. 门禁实测

| 门禁 | 命令 | 结果 |
| ---- | ---- | ---- |
| 格式化 | `bunx oxfmt --check .oxfmtrc.json <4 触碰文件>` | ✅ All matched files use the correct format（5 files，2331ms） |
| 类型 | `bunx tsgo --noEmit` | ✅ 0 errors |
| 模板类型 | `bunx vue-tsc --noEmit -p tsconfig.json` | ✅ 0 errors（confirmText.reasoningTitle 键位 + isReasoningUIPart 模板收窄实证） |
| lint | `bunx oxlint -c oxlint.json --type-aware --type-check <4 触碰文件>` | ✅ 0 warnings / 0 errors（349 rules） |
| i18n | `bun run check:i18n` | ✅ All locale files are in sync（fork seam 不在该检查覆盖内，键位正确性由 vue-tsc 兜底） |
| 单测 | `bun test tests/engine/rebuild/chat` | ✅ 30/30 pass（selection-capture，无回归） |
| i18n seam | `bun test tests/engine/rebuild/i18n-seam.test.ts` | ✅ 2/2 pass |

## 4. 现成单测排查结论（任务约束项）

`grep -rln "ChatMessage\|ChatPanel\|isThinking\|chat-typing-indicator" tests/` → 仅命中 `tests/e2e/chat/panel.spec.ts`（playwright 真浏览器 e2e，需 dev server，不在本子 agent 范围）；**ChatPanel.vue / ChatMessage.vue 无现成单测**（tests/engine 下零引用）。无回归可跑——以 tsgo + vue-tsc + oxlint + check:i18n + chat 套件兜底。

## 5. 偏离声明

无。plan 四项代码改动全部按预定落地，无额外修复。

## 6. 风险与边界

- **T92 在途同文件**：ChatMessage.vue 工作树含 T92 未提交改动，本任务 diff 已核验与其正交（git diff 实证：本任务仅 import 行 + reasoning 分支块）；主 agent commit 时需按任务边界拆开或合并说明。
- **长 reasoning 刷屏**：流式期间折叠卡随内容增长无高度上限——结束后自动折叠收口，可接受；高度截断/markdown 渲染明确不修。
- **后端契约零改动**：mapping.ts 的 reasoning-start/delta/end chunk（:39-67）本就在发，纯前端渲染面补位。

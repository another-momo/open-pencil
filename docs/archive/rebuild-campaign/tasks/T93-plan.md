# T93-plan · reasoning 可见性修复（isThinking 圆点 + reasoning 内容折叠渲染）

> **任务来源**：owner 实测 UX 问题 + 仓外预研 `docs/202609031745-reasoning-visibility-and-stop-button.md` §5.1 + §5.2（方案 A 折叠显示）
> **范围拍板**：只做 §5.1（最小修复）+ §5.2 方案 A（折叠渲染 reasoning 内容）；§5.3 停止按钮改进、§5.4 loading indicator 样式放大**不在本任务**

### 背景与动机

两个同根问题（预研 §二 / §四已实测定谳）：

1. **Reasoning 过程零反馈**：`isThinking` 计算属性没有处理 `reasoning` 类型 part——reasoning part 一旦到达，`lastPart.type === 'reasoning'` 不匹配任何分支，落到 `return s === 'submitted'`（此时 s 已是 `streaming`）→ 三个弹跳圆点消失，用户看不到任何反馈（以为卡住）。
2. **Reasoning 内容永不渲染**：后端 `src/app/ai/pi-backend/mapping.ts` 已把 `thinking_start/delta/end` 映射为 `reasoning-start/delta/end` SSE chunk（实证 mapping.ts:39-67），前端 AI SDK 已存入 `ReasoningUIPart`（`type: 'reasoning'`，`text` 字段，ai@^7 `isReasoningUIPart` 存在），但 `ChatMessage.vue` 模板链没有 reasoning 分支——part 被静默吞掉，用户只有复制 debug 日志才能看到。

### 关键事实

1. **所有触碰文件均在 owned 区**：`src/components/ChatPanel.vue`（ownedFiles，T65 晋升）、`src/components/chat/`（ownedRoot，T65）、`src/app/i18n/fork/`（ownedRoot，T35）——zones.json 零变更。
2. **i18n 键归属 `confirm` 组**（定谳）：`ChatMessage.vue` 已消费 `useForkConfirm()`（contextSwitchLine 先例——对话流内联文案本就在 confirm 组），新增 `reasoningTitle` 进 `confirmMessageDefaults` + zh-cn `confirm` 段 = 零新 import、零 index.ts 变更。新建独立 `chat` 命名空间（需改 index.ts get() 返回 + 新 composable）语义更纯但违反最小改动纪律，否决。
3. **AI SDK 类型天然支持**：`UIMessagePart` 联合含 `ReasoningUIPart`（`{ type: 'reasoning'; text: string; state?: 'streaming' | 'done' }`），`isReasoningUIPart` 导出可用——模板内 `part.type === 'reasoning'` 或 helper 均可收窄，`part.text` 类型安全。
4. **`:open="streaming"` 语义**：`streaming` prop 仅最后一条 assistant 消息在 submitted/streaming 时为 true（ChatPanel `isStreamingMessage`）——流式期间强制展开（每 token 重渲染会盖掉用户手动折叠，可接受，与预研示例一致）；结束后翻转一次为 false → 折叠；此后 Vue 不再重渲染该 details，用户手动展开/折叠状态保持。

### 方案

#### 1. `ChatPanel.vue` isThinking（预研 §5.1，1 行）

```ts
if (lastPart.type === 'step-start') return true
if (lastPart.type === 'reasoning') return true // ← 新增：reasoning 流式期间圆点不消失
```

效果对照（预研 §5.1 表格原样成立）：submitted 无 part → 圆点；streaming + reasoning → 圆点（修复）；streaming + text → 文本气泡（圆点消失，与 reasoning 折叠卡并存）。

#### 2. `ChatMessage.vue` reasoning 渲染分支（预研 §5.2 方案 A）

在模板链 tool-call 分支与 text 分支之间插入：

```vue
<details
  v-else-if="isReasoningUIPart(part)"
  data-test-id="chat-reasoning"
  :open="streaming"
  class="rounded-lg border border-border bg-canvas px-2 py-1"
>
  <summary class="flex cursor-pointer items-center gap-1 text-[11px] text-muted select-none">
    <icon-lucide-brain class="size-3" />
    {{ confirmText.reasoningTitle }}
  </summary>
  <div class="mt-1 border-l-2 border-muted pl-2 text-[11px] whitespace-pre-wrap text-muted">
    {{ part.text }}
  </div>
</details>
```

- 视觉沿用既有 tool 卡 / file 附件卡骨架（`rounded-lg border border-border bg-canvas`），字号对齐工具卡 label（`text-[11px]`），不用预研示例的 text-sm（本聊天气泡正文即 text-xs）。
- 图标 `icon-lucide-brain`（lucide Brain，unplugin 自动解析，与既有 `icon-lucide-*` 用法同律）。
- script 侧 import 追加 `isReasoningUIPart`（from 'ai'）。

#### 3. i18n（fork seam，2 文件）

| 文件 | 改动 |
| ---- | ---- |
| `src/app/i18n/fork/locales/en.ts` | `confirmMessageDefaults` 尾部加 `reasoningTitle: 'Thinking process'`（T93 注释） |
| `src/app/i18n/fork/locales/zh-cn.ts` | `confirm` 段尾部加 `reasoningTitle: '思考过程'`（T93 注释） |

### 改动清单（5 改 + 4 治理）

#### 代码（4 改）

| 文件 | 改动 |
| ---- | ---- |
| `src/components/ChatPanel.vue` | `isThinking` 加 `if (lastPart.type === 'reasoning') return true`（1 行 + 注释） |
| `src/components/chat/ChatMessage.vue` | import 加 `isReasoningUIPart`；模板插 reasoning `<details>` 分支 |
| `src/app/i18n/fork/locales/en.ts` | confirm 组加 `reasoningTitle` |
| `src/app/i18n/fork/locales/zh-cn.ts` | confirm 段加 `reasoningTitle: '思考过程'` |

#### 治理（4 改/建）

| 文件 | 内容 |
| ---- | ---- |
| `docs/rebuild/tasks/T93-plan.md` | 新建（本文件） |
| `docs/rebuild/tasks/T93-self-check.md` | 新建 |
| `docs/rebuild/tasks/T93-verify.md` | 新建 |
| `docs/rebuild/tasks/_index.md` + `docs/rebuild/tracker.md` | 各追加 T93 行 |

### 验收

- `bunx oxfmt`（4 个触碰文件）→ 无 diff 遗留
- `bunx tsgo --noEmit` → 0 errors
- `bun run check:vue`（vue-tsc）→ 0 errors（模板类型收窄 + confirmText.reasoningTitle 键位实证）
- `oxlint`（触碰文件局部）→ 0 errors
- `bun run check:tasks` → T93 三件套齐（写完后跑）
- 现成单测排查结论：ChatPanel.vue / ChatMessage.vue **无现成单测**（grep 实证 tests/ 下零引用；唯一 chat e2e `tests/e2e/chat/panel.spec.ts` 需 playwright 真浏览器，不在本子 agent 范围）——无回归可跑，以门禁 + 类型检查兜底
- 端到端真值（留给主 agent / owner 实测）：开思考级别发消息 → reasoning 流式期间圆点持续 + 「思考过程」折叠卡展开滚动 → text 到达后圆点消失、折叠卡收拢、可手动展开回看

### 不修

- 停止按钮报错体验（预研 §5.3）——独立任务
- Loading indicator 放大/加文字（预研 §5.4）——独立任务
- reasoning 内容高度截断 / markdown 渲染——折叠卡内纯文本 pre-wrap 即可

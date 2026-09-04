# T93-verify · reasoning 可见性修复（验收对照 + 门禁实录）

> **状态**：✅ 已完成（代码 + 门禁）| **时间**：2026-09-04
> **关联**：仓外预研 `docs/202609031745-reasoning-visibility-and-stop-button.md` §5.1 + §5.2 方案 A；T92 在途同文件（diff 正交，实证见 self-check §6）

## 验收对照

| 项 | 计划（预研出处） | 实测 | 通过 |
| -- | ---------------- | ---- | ---- |
| isThinking reasoning 分支 | §5.1：`lastPart.type === 'reasoning'` → true，圆点不消失 | `ChatPanel.vue:150` `if (lastPart.type === 'reasoning') return true` 落在 step-start 行之后（git diff 实证 +2 行） | ✅ |
| reasoning 模板分支 | §5.2 方案 A：`<details>` 折叠，流式 `:open="true"`，结束折叠 | `ChatMessage.vue` tool-call 与 text 分支间插入 `<details v-else-if="isReasoningUIPart(part)" data-test-id="chat-reasoning" :open="streaming">` + summary（brain 图标 + reasoningTitle）+ 竖线正文 `{{ part.text }}` | ✅ |
| i18n 键 | reasoningTitle：en="Thinking process" / zh-CN="思考过程"，fork locales 双文件 | `en.ts` confirmMessageDefaults 尾部 + zh-cn.ts confirm 段尾部各一键（git diff 实证，双语值与任务给定逐字一致） | ✅ |
| oxfmt | 触碰文件格式化 0 遗留 | `bunx oxfmt --check` → All matched files use the correct format | ✅ |
| tsgo | 0 errors | `bunx tsgo --noEmit` 无输出（exit 0） | ✅ |
| vue-tsc | 模板类型 0 errors（reasoningTitle 键位 + part.text 收窄） | `bunx vue-tsc --noEmit -p tsconfig.json` 无输出（exit 0） | ✅ |
| 现成单测回归 | 若有 ChatPanel/ChatMessage 单测则跑 | 排查结论：无现成单测（仅 e2e panel.spec.ts，子 agent 不跑浏览器）；替代兜底：`bun test tests/engine/rebuild/chat` 30/30 + `i18n-seam.test.ts` 2/2 + `check:i18n` in sync + oxlint 0/0 | ✅ |
| 三件套 + 索引 | plan/self-check/verify + tracker/_index 追加 | 三文件物理存在；tracker.md §2 与 _index.md §2 各追加 T93 行 | ✅ |

## 行为真值推演（端到端留给主 agent / owner 实测）

| 阶段 | status | lastPart.type | isThinking | 渲染 |
| ---- | ------ | ------------- | ---------- | ---- |
| 提交后 | submitted | 无 | true | 三圆点 |
| reasoning 流式 | streaming | reasoning | **true（修复）** | 三圆点 + 「思考过程」折叠卡展开滚动 |
| text 开始 | streaming | text | false | 圆点消失；折叠卡收拢（:open=false 翻转一次）；文本气泡流出 |
| 结束后回看 | ready | — | false | 折叠卡保持收拢，点击 summary 手动展开回看 |

端到端实测步骤（dev server 起服后）：设置里开思考级别（thinking level 非 Off）→ 发任意消息 → 观察上表四阶段。

## 不修（任务边界拍板）

- 停止按钮报错体验（预研 §5.3）
- Loading indicator 放大 / 加文字（预研 §5.4）
- reasoning 内容高度截断 / markdown 渲染

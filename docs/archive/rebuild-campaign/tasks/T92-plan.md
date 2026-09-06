# T92-plan · look-tool UI 工具卡片 base64 裁剪 + 模型通道占位符 omit

> **任务来源**：仓外预研 `docs/202609010000-look-tool-review.md` §2（日志裁剪：部分落地，UI 侧遗漏）+ §4（模型上下文占位符噪音）
> **关联**：T81（look-tool 批 P-01/P-04）后续收口；§2 老分支 `displayOutput` 语义对齐

### 背景与动机

预研 §2：`sanitizeMediaToolOutput` 已脱敏 details 通道，但 `ChatMessage.vue` 工具卡片展开时 `JSON.stringify(part.output, null, 2)` 未裁剪——若 part.output 是带完整 base64 的 media 输出（如历史消息/其他注入路径），展开卡片会看到完整 base64 噪音。老分支 `displayOutput` 有裁剪（`[omitted N chars]` 占位），mode 分支遗漏。

预研 §4：tools.ts `content[1].text` 用 `sanitizeMediaToolOutput` 保留 `[inlined as file part, N chars]` 占位符——该占位符是给人类看的信号，模型已从 `content[0].image` 拿到真图，占位符对模型是纯噪音浪费 token。UI 通道需要占位符、模型通道不需要，两通道应分函数。

### 方案概览

#### 必修（UI 裁剪）

- 新建 `src/components/chat/tool-output.ts`：`displayToolOutput(part)` 单源生成工具卡片 `<pre>` 文本——errorText / error 输出路径原样；media 输出（`isMediaToolOutput` 判定）序列化时 base64 替换为 `[omitted N chars]`（对齐老分支 displayOutput 语义）；其余 `JSON.stringify(output, null, 2)` 不变。
- 从 ChatMessage.vue 抽出成独立 ts 模块以便单测（`tool-state.ts` 同模式先例；`src/components/chat/` 已是 ownedRoot，zones 零新登记）。
- `ChatMessage.vue` 模板三元表达式替换为 `displayToolOutput(part)`，删除本地 `hasErrorOutput`（逻辑并入 helper）。

#### 选修（模型通道 omit）

- `media-output.ts` 新增 `sanitizeMediaToolOutputForModel`：完全 omit base64 键（不留占位符）。既有 `sanitizeMediaToolOutput` 保留为 UI 通道（占位符语义不动，look.test.ts 钉扎零改动），doc 注释标注双通道分工。
- `tools.ts` `content[1].text` 换用 `sanitizeMediaToolOutputForModel`；`details: result`（完整 base64）不动——details 只进 UI 映射层，mediaToolOutputChunks 仍会脱敏。

### 改动清单

| 文件 | 改动 |
| --- | --- |
| `src/components/chat/tool-output.ts` | 新建——displayToolOutput helper |
| `src/components/chat/ChatMessage.vue` | 模板换 displayToolOutput；删本地 hasErrorOutput；import 接线 |
| `src/app/ai/pi-backend/media-output.ts` | 新增 sanitizeMediaToolOutputForModel + 双通道 doc 注释 |
| `src/app/ai/pi-backend/tools.ts` | content[1].text 换 ForModel 变体 + 注释更新 |
| `tests/engine/rebuild/marketing/tool-output-display.test.ts` | 新建——5 例（裁剪/不误裁/errorText/error 输出/模型通道 omit） |
| `docs/rebuild/tasks/T92-{plan,self-check,verify}.md` | 三件套 |
| `docs/rebuild/tracker.md` + `docs/rebuild/tasks/_index.md` | 追加 T92 行 |

### 验收

- 新测试 5 例全过；marketing + chat 套件 0 回归（look.test.ts 既有钉扎不动）
- `bunx oxfmt` 触碰文件格式化、`bunx tsgo --noEmit` 0 错、vue-tsc 0 错、oxlint 触碰文件 0 警 0 错
- check:zones clean（两新文件均在 ownedRoot 内）

### 风险与边界

- `isMediaToolOutput` 要求 base64 + mimeType 双 string 字段，非 media 输出（含凑巧带 base64Like 字段的普通对象）不误裁——测试钉扎。
- UI 占位语义双形态并存：file chunk 路径的 tool-output-available 仍带 `[inlined as file part, N chars]`（sanitizeMediaToolOutput，mapping 层已裁）；displayToolOutput 的 `[omitted N chars]` 只兜住带完整 base64 的输出形态（对齐老分支文案）。两形态不冲突。
- 不修：预研 §5 vision 检查（T81 已落）、`details` 完整 base64 保留（UI 映射层兜底）。

### 下一步

主 agent 验收 commit（本任务不 git add/commit）。

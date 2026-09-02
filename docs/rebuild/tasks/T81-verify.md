# T81 核验 · look-tool 批（P-01 缩略图渲染补位 + P-04 vision chat route 前置拒绝 + P-02 closure 标注）

> 日期：2026-09-02。核验人 = 独立核验子 agent（未参与实施）。

## 结论：PASS 6/6

## 逐项核验

1. **P-01 — ChatMessage.vue `file` chunk 渲染补位（import + FilePart + helper）** — PASS
   实证：
   - L3 `import { isFileUIPart, isTextUIPart, isToolUIPart, getToolName } from 'ai'` —— `isFileUIPart`
     已 import。
   - L132 `type FilePart = Extract<UIMessagePart<UIDataTypes, UITools>, { type: 'file' }>`。
   - L134 `function filePartAlt(part: FilePart): string`；L140 `function filePartFilename(part: FilePart): string`。

2. **P-01 — 模板渲染分支（ChatMessage.vue:270-285）** — PASS
   **关键点（核验员 focus）**：
   - L270 `v-else-if="isFileUIPart(part)"` 分支已加。
   - L271 `data-test-id="chat-file-attachment"` 锚点已埋。
   - L274-279 `<img :src="part.url" :alt="filePartAlt(part)" class="mt-1 max-h-48 rounded border border-border" />`
     —— 图像 mediaType 直渲 `<img>`，src 直绑 `part.url`（data: URL）。
   - L285 `<span class="truncate">{{ filePartFilename(part) }}</span>` —— 非图像回落文件名占位。

3. **P-04 — defineBridgeTool 形参 + execute 入口 vision check（tools.ts）** — PASS
   **关键点（核验员 focus）**：vision check 在 MEDIA_OUTPUT_TOOLS 集合守门。
   实证：
   - L30-32 头注释「T81 P-04：vision 前置拒绝——MODEL.IMAGE 输入模态闭包…MEDIA_OUTPUT_TOOLS
     工具执行前 fail-fast」。
   - L52 `import { isMediaToolOutput, MEDIA_OUTPUT_TOOLS, sanitizeMediaToolOutput } from './media-output'`。
   - L194 `modelSupportsVision?: () => boolean`（可选形参，向后兼容）。
   - L211-215：
     ```ts
     if (MEDIA_OUTPUT_TOOLS.has(def.name) && modelSupportsVision && !modelSupportsVision()) {
       throw new Error(
         `This model does not support image input. The ${def.name} tool requires vision capability.`
       )
     }
     ```
   - L268 `modelSupportsVision?: () => boolean`（createOpenPencilTools 形参透传）；
     L280 调用点透传。

4. **P-04 — service.ts 闭包注入（service.ts:228-232）** — PASS
   实证：L228-232：

   ```ts
   // T81 P-04：vision 前置拒绝闭包——pi Model.input('text' | 'image')
   // 的 'image' 在场即代表 vision；createSession 已 resolveModel，闭包
   // 直接读 model.input…
   ;() => Array.isArray(model.input) && model.input.includes('image')
   ```

   直接读 `admin.resolveModel` 出来的 pi `Model.input`，无需另起 catalog 反查（与 plan §2.B.4 一致）。

5. **P-02 closure 标注（self-check 落点，无代码改动）** — PASS
   **关键点（核验员 focus）**：plan §2.C 明示「closure 标注（self-check 落点，无代码改动）」。
   实证：git status 中 `src/app/ai/pi-backend/media-output.ts` **未修改**；self-check §2.C 与
   plan §2.C 均已落点标注「`[inlined as file part, ${base64.length} chars]` 与 `[omitted N chars]`
   是命名差异、行为等价；look.test.ts:557-563 已钉扎字面量」。
   零代码改动符合 plan 决策。

6. **测试与门禁复跑** — PASS
   - `bun test tests/engine/rebuild/marketing/look.test.ts tests/engine/rebuild/chat/ tests/engine/rebuild/image-gen/internal-visibility.test.ts`
     → **60 pass / 0 fail / 169 expect()**（30 look + 25 chat + 5 image-gen internal-visibility）。
     - look.test.ts 含 `media output registration (T55 channel A)` describe 下 `sanitizeMediaToolOutput
strips only the base64 payload` 等 P-02 字面量钉扎例，复跑绿。
     - chat/ 目录 selection-capture.test.ts 复跑绿（T70 不受影响）。
     - internal-visibility.test.ts 复跑绿（`createOpenPencilTools()` 无参调用向后兼容——
       `modelSupportsVision?` 可选形参默认 undefined，老调用面不触发新检查）。
   - `bun run lint` → 7 warnings / **0 errors**（pre-existing，与本批无关）。
   - `bun run typecheck`（`tsgo --noEmit && bun run check:vue`）→ exit 0。
   - `bun run check:vue` → exit 0（typecheck 内含）。
   - `bun run check:zones` → `clean: 85 modified (all registered)` —— 3 个触动文件
     （ChatMessage.vue + tools.ts + service.ts）全在 ownedRoots 内，零 P-NN 登记。
   - `bun run check:i18n` → `All locale files are in sync.`（零 i18n 改动，vision 拒绝错文案硬编码英文）。
   - `bun run format:check` → All matched files use the correct format.
   - `bun run check:arch` → ✔ No problems found!

## 偏差复核

1. **worker 报告「3 文件修改/1 创建」与 git 实证「3 文件修改」一致**（self-check §3.1）：
   核验员实证 git status 触动 `src/components/chat/ChatMessage.vue` + `src/app/ai/pi-backend/tools.ts`
   - `src/app/ai/pi-backend/service.ts` 三文件，与 plan §2 三处一致。worker「1 创建」为口径偏差
     （功能项描述），git 实证无新文件创建。非代码偏差。
2. **P-04 实现位置**（self-check §3.2 / plan §4 边界）：chat-mode.ts 是纯 type-only 文件，无
   dispatch 面——vision 检查实装在 `tools.ts` `defineBridgeTool.execute` 入口（:211-215），
   与 owner 描述的「chat route 前置拒绝」语义等价（LLM 决定调工具之后、桥 RPC 烧凭据之前）。
   属 plan 显式决策，非偏差。
3. **vision 拒绝错文案硬编码英文**（self-check §3.3 / plan §4 边界）：tools.ts:213 字符串硬编码
   英文「This model does not support image input. The ${def.name} tool requires vision capability.」。
   无 i18n key，与 T66「内部设施不外露」一致；check:i18n 复跑绿。

## 发现的问题

无。

# T82 计划 · 生图工具描述的 prompt 规则越位（迁回 workflow/profile）

> 日期：2026-09-02。owner 指令：「image generation 的 tool schema 中现在
> 写死了提示语，要求生图提示词不要生成带有文字的图片，这本来应该是
> workflow 或者 profile 的职责，请一并改过来」。

## 1. 事实基线（已取证，勿重复调查）

### 1.1 越位点

**A. `src/app/ai/pi-backend/image-gen/generate.ts:70`** —— GENERATE_IMAGE_DESCRIPTION
（typebox-validated 工具 description，AI 模型看到）中含两条越位规则：

> "Returns node id metadata only (no image bytes): inspect with `describe`,
> visually accept with `look` (**right subject, no garbled or wrong-language text**);
> on miss, regenerate with an adjusted prompt (max 2 attempts). **Never ask for
> rendered text in prompts.** If the key is missing or the API returns 401, tell
> the user to add/check the Image Generation API key in AI chat settings
> (separate from the chat LLM key) — do NOT fall back to eval-drawn gradients."

加粗两处均为 prompt 规则（关于生图请求的内容形态），不属于工具 schema
字段的事实描述（哪些字段、必填选填、批量行为、引用语义、replace 语义）。
后者在 description 前半段已铺好。

**B. `src/app/ai/pi-backend/image-gen/generate.ts:249`** —— prompt 字段 schema
description：

> `description: 'Text prompt — never ask for rendered text inside the image'`

后半句「never ask for rendered text inside the image」是 prompt 规则；前半句
「Text prompt」是 schema 字段事实描述（保留）。

### 1.2 规则归宿（owner 决策「应迁到 workflow 或者 profile」）

**profile** = `src/app/ai/pi-backend/studio/base.md`（T47 起替代 `chat/system-prompt.md`
成为每回合组装 source；T46 fidelity 双向校验锚 `tools/rebuild/src/verify/t46-base-fidelity.mjs`）。
**workflow** = `src/app/ai/pi/pi-backend/studio/workflows/{marketing,longform,...}.md`
（每个 workflow 可独立覆盖）。

通用规则放 `studio/base.md` 「## Tool discipline」段；workflow 可在各自文件
重申/覆盖（与现有 `look` 段「不是替代 describe」同模式）。本任务仅落地
通用规则一处。

**transcribe 同步约束**：T46 fidelity invariant 要求 `prompts/system-prompt-base.md`
（转写源，T46 起）与 `studio/base.md`（转写目标）剥 frontmatter + T46 头注后
**逐字零 diff**（见 `tools/rebuild/src/verify/t46-base-fidelity.mjs`）。本任务在两
文件**同步新增**同一规则段落，零 diff 维持。

### 1.3 zones

- `src/app/ai/pi-backend/image-gen/generate.ts` —— `src/app/ai/pi-backend/` ownedRoot
- `src/app/ai/pi-backend/studio/base.md` —— `src/app/ai/pi-backend/` ownedRoot
- `src/app/ai/pi-backend/prompts/system-prompt-base.md` —— `src/app/ai/pi-backend/` ownedRoot

**零 P-NN 登记**。

### 1.4 测试钉扎

`tests/engine/rebuild/image-gen/tool-contract.test.ts` 现有「P5 description
瘦身 <2000 字符」用例钉长度上限。删两段后 description 减约 30 字符，仍 < 2000，
该断言自动绿。

`grep -rn "rendered text\|garbled\|wrong-language\|never ask" tests/engine/rebuild/`
**零命中**——无测试钉这些短语，可纯删。

新增 1 例正向钉扎测试（钉新规则在 profile 中存在）：

- `tests/engine/rebuild/image-gen/prompt-discipline.test.ts`（新文件）
  - 读 `src/app/ai/pi-backend/studio/base.md` 文本，断言含
    "generate_image" + "no rendered text" 关键词组合
  - 读 `src/app/ai/pi-backend/prompts/system-prompt-base.md` 同断言
    （T46 fidelity 同形）
  - 读 `src/app/ai/pi-backend/image-gen/generate.ts` 中
    `GENERATE_IMAGE_DESCRIPTION` 常量，断言**不含** "rendered text"
    "garbled" "wrong-language" 三关键词（反向钉：tool description
    不再承载 prompt 规则）
  - 读 `GENERATE_IMAGE_PARAMETERS` 中 prompt 字段 description，
    断言**不含** "rendered text"（反向钉：字段 hint 也不再承载）

## 2. 施工清单

### A. `generate.ts` 两处越位卸

1. **GENERATE_IMAGE_DESCRIPTION（:62-70）**：删 "no garbled or wrong-language text"
   段（"inspect with `describe`, visually accept with `look` (**right subject, no
   garbled or wrong-language text**); on miss, regenerate with an adjusted prompt
   (max 2 attempts). Never ask for rendered text in prompts."），保留 "inspect
   with `describe`, visually accept with `look`; on miss, regenerate with an
   adjusted prompt (max 2 attempts)." 这一段删完 description 由 9 行压到 7 行。
   末尾 "If the key is missing..." 段保留（key 缺失处理是工具行为，非
   prompt 规则）。
2. **prompt 字段 schema description（:249）**：删 "never ask for rendered text
   inside the image"，保留 `description: 'Text prompt'`。

### B. `studio/base.md` + `prompts/system-prompt-base.md` 同步新增

在两文件的 `## Tool discipline` 段末尾（"Never export images/files..." 之后）
新增一条：

> 🖼 **Never ask for rendered text in `generate_image` prompts.** AI-rendered
> text inside generated images is unreliable (garbled glyphs, wrong language).
> Title/copy text belongs on real `Text` nodes (placed via `render` /
> `set_text`); use `generate_image` for visual content only. If a generated
> image must contain a word, place it on a Text node laid over the image,
> never in the prompt.

新增一行 + 换行；保持与邻居 bullet 同形态（emoji + bold 起头 + 句末句号）。

### C. 测试 `tests/engine/rebuild/image-gen/prompt-discipline.test.ts`

按 §1.4 写四条断言（profile 含新规则、transcribe 同步、tool description
不含、字段 hint 不含）。

### D. 边界

- 不动 `studio/profiles/*.md` 与 `studio/workflows/*.md`（owner 仅要求通用
  规则回迁；各 workflow 需要时自己重申）
- 不动 `prompts/chat/system-prompt.md`（T46 起该文件已退役，无读点）
- 不动 `look.ts` 描述（look 描述中的 "generated-image content (e.g. garbled
  text in AI images)" 是 look 工具的功能场景说明，不是 prompt 规则——保留）
- 不动 `studio/base.md` 其他规则段

## 3. 验收标准

1. `grep -rn "rendered text\|never ask.*text\|garbled\|wrong-language" src/app/ai/pi-backend/image-gen/ src/app/ai/pi-backend/studio/ src/app/ai/pi-backend/prompts/`：
   - image-gen/ 零命中（卸完）
   - studio/base.md 命中 1 条新规则段
   - prompts/system-prompt-base.md 命中 1 条新规则段（与 base.md 同步）
2. `bun test tests/engine/rebuild/image-gen/`：105 pass（含 prompt-discipline.test.ts 新 1 例）/ 0 fail
3. `bun test tests/engine/rebuild/marketing/`：现有套件不变；如有新增失败，回归修复
4. 门禁 unpiped：lint / typecheck / check:vue / check:zones / check:i18n / check:docs / format:check 全绿
5. T46 fidelity 验证：`bun tools/rebuild/src/verify/t46-base-fidelity.mjs` →
   零 diff（自动；不在七门禁内但属隐性合约）
6. `tools/rebuild/src/verify/t46-base-fidelity.mjs` 若不在主 agent 必经路径，
   至少人工 cat 一下两文件「## Tool discipline」段末行确认同步

## 4. 风险与对策

- **T46 fidelity 误判风险**：transcribe 同步要求两文件「逐字零 diff」（剥
  frontmatter + T46 头注）。新增段必须在两文件 byte-equal，emoji、空格、
  换行格式完全一致。fast-worker 写完两段后必须 `diff` 校验一次。
- **description 瘦身幅度**：原 description 1962 字符 → 删 2 段后约 1920
  字符；仍 < 2000（P5 上限），tool-contract test 「长度上限钉扎」仍绿。
- **profile 重申未动**：现有 profiles（watercolor_poster_v2 等）已含「paint
  NO lettering」「extend the scene calmly through the bleed」等具体指引；
  与新增通用规则兼容，无需触动。
- **look 描述中的 "generated-image content (e.g. garbled text in AI images)"
  保留**：是 look 工具的功能场景（视觉检查图像中是否有乱码字），非
  prompt 规则。t76 §1 已注「营销 imports 是 A's 自己的职责，不是 B
  交叉」。本任务边界对齐。

## 5. 关联

- T77（image-gen provider 收尾）：同文件改动，但语义不同——T77 改的是
  provider 协议层（response_format / background wire / Seedream 族）；
  本任务改的是 description 文案。无文件块交叠。
- T66（生图 schema 化 P4/P5）：P5 钉扎 description <2000 字符仍生效；本
  任务顺向兼容。
- T46（base.md transcribe invariant）：本任务顺向兼容（同步新增、零 diff
  维持）。

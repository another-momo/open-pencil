# T82 核验 · 生图工具描述的 prompt 规则越位（迁回 workflow/profile）

> 日期：2026-09-02。核验人 = 独立核验子 agent（未参与实施）。

## 结论：PASS 7/7

## 逐项核验

1. **A1 — GENERATE_IMAGE_DESCRIPTION 卸 prompt 规则（generate.ts:62-70）** — PASS
   **关键点（核验员 focus）**：description 文本改动落地。
   实证：L62-70 description 内已**不含** `no garbled or wrong-language text` 段，
   已**不含** `Never ask for rendered text in prompts` 段。保留
   `inspect with \`describe\`, visually accept with \`look\`; on miss, regenerate with an adjusted prompt
   (max 2 attempts).`以及末尾`If the key is missing or the API returns 401…` 段
   （key 缺失处理是工具行为，非 prompt 规则，属 plan §2.A.1 保留项）。

2. **A2 — prompt 字段 schema description 卸规则（generate.ts:249）** — PASS
   **关键点（核验员 focus）**：prompt schema 字段 hint 改动落地。
   实证：L249 `description: 'Text prompt'` —— 已**不含** `never ask for rendered text inside the image`。

3. **image-gen/ 目录零越位命中** — PASS
   实证：`grep -n "rendered text\|garbled\|wrong-language\|never ask" src/app/ai/pi-backend/image-gen/generate.ts`
   → **0 命中**。

4. **B — studio/base.md + prompts/system-prompt-base.md 同步新增（byte-equal）** — PASS
   **关键点（核验员 focus）**：两文件同位置新增 bullet 且 byte-identical。
   实证：
   - `studio/base.md:103` 新增 bullet `- 🖼 **Never ask for rendered text in \`generate_image\` prompts.\*\* AI-rendered text inside generated images is unreliable (garbled glyphs, wrong language). Title/copy text belongs on real \`Text\` nodes (placed via \`render\` / \`set_text\`); use \`generate_image\` for visual content only. If a generated image must contain a word, place it on a Text node laid over the image, never in the prompt.`
   - `prompts/system-prompt-base.md:101` 同位置同 bullet。
   - `diff <(grep -A0 "Never ask for rendered" base.md) <(grep -A0 "Never ask for rendered" system-prompt-base.md)` → **零输出（byte-equal）**。
   - 格式同邻居 bullet（emoji 🖼 + bold 起头 + 句末句号），符合 plan §2.B 同形态要求。

5. **C — prompt-discipline.test.ts 新建（4 例）** — PASS
   **关键点（核验员 focus）**：新测试文件 4 cases。
   实证：`tests/engine/rebuild/image-gen/prompt-discipline.test.ts` 新建（git status 实证 untracked），
   含 1 个 describe（T82 prompt 规则归宿）+ 4 个 test：
   - :24 `profile (studio/base.md) 含 generate_image 不渲染文字规则` — 断言 `toContain('generate_image')` + `toMatch(/no rendered text|rendered text/i)`。
   - :30 `transcribe 同步源 (prompts/system-prompt-base.md) 含同样规则` — 同断言。
   - :36 `生图 tool description 不再承载 prompt 规则（卸完）` — `not.toContain 'rendered text' / 'garbled' / 'wrong-language'`。
   - :42 `prompt 字段 schema description 不再承载 prompt 规则` — 单层断言提取 prompt 字段 description + `not.toContain 'rendered text'`。

6. **测试与门禁复跑** — PASS
   - `bun test tests/engine/rebuild/image-gen/` → **108 pass / 0 fail / 326 expect()**
     （原套件 104 + 新增 4 = 108，与 self-check §1.2 一致；包含 tool-contract.test.ts 的
     「generate_image description（P5：瘦身 <2000 字符）> 长度上限钉扎」等仍绿）。
   - `bun tools/rebuild/src/verify/t46-base-fidelity.mjs` → **3 passed, 0 failed**
     （`base.md frontmatter id=base` + `双源头注两文各一` + `逐字保真：剥除后 base.md ===
system-prompt-base.md（零 diff）`）。
   - `bun run lint` → 7 warnings / **0 errors**（pre-existing，与本批无关）。
   - `bun run typecheck`（`tsgo --noEmit && bun run check:vue`）→ exit 0。
   - `bun run check:zones` → `clean: 85 modified (all registered)` —— 4 个触动文件
     （generate.ts + studio/base.md + prompts/system-prompt-base.md + prompt-discipline.test.ts）
     全在 ownedRoots 内，零 P-NN 登记。
   - `bun run check:i18n` → `All locale files are in sync.`（零 i18n key 改动）。
   - `bun run format:check` → All matched files use the correct format.
   - `bun run check:arch` → ✔ No problems found!

7. **边界守护（plan §2.D）** — PASS
   实证：
   - `studio/profiles/*.md` 与 `studio/workflows/*.md` 未触动（git status 实证）。
   - `prompts/chat/system-prompt.md` 未触动（git status 实证）。
   - `look.ts` 描述未触动（grep 实证 `generated-image content (e.g. garbled text in AI images)`
     保留——是 look 工具的功能场景说明，非 prompt 规则）。
   - `studio/base.md` 其他规则段未动（仅在 `## Tool discipline` 段末尾新增 1 条 bullet）。

## 偏差复核

1. **description 字符数减幅**（self-check §3.1）：plan §4 估「删 2 段后约 1920 字符，仍 < 2000」。
   核验员未精确统计字符数，但实证 description 中已不含 `no garbled` / `wrong-language` /
   `never ask for rendered text in prompts` 等越位文本；tool-contract 「长度上限钉扎」测试复跑绿，
   与 plan 估计一致。非偏差。
2. **prompt-discipline.test.ts 4 例 vs plan §1.4「4 例正向钉扎」**（self-check §3.2）：plan §1.4
   描述为「4 条断言」，实际落地为 2 正向（profile 含 + transcribe 含）+ 2 反向（tool description
   不含 + 字段 hint 不含），覆盖面与 plan §1.4 字段描述完全对应。属语义同义、非偏差。
3. **worker 报告「3 文件修改 + 1 新测试文件」与 git 实证一致**（self-check §3.3）：
   核验员实证 git status 含 `src/app/ai/pi-backend/image-gen/generate.ts` +
   `src/app/ai/pi-backend/studio/base.md` + `src/app/ai/pi-backend/prompts/system-prompt-base.md`
   三个修改 + `tests/engine/rebuild/image-gen/prompt-discipline.test.ts` 一个新建（untracked）。
   与 plan §2 三处 + §2.C 新建一处一致。非偏差。

## 发现的问题

无。

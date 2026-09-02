# T82 自检 · 生图工具描述的 prompt 规则越位（迁回 workflow/profile）

> 日期：2026-09-02。实施 = fast-worker 子 agent（施工规格 = T82-plan.md）；
> 门禁修复 / 复核 / 三件套 = 主 agent。对照 T82-plan §2/§3 逐项核验。

## 1. 验收逐项（T82-plan §3）

### 1.1 grep 验证：image-gen/ 零命中；两 profile 文件各命中 1 条

✅ `grep -rn "rendered text\|never ask.*text\|garbled\|wrong-language" src/app/ai/pi-backend/image-gen/ src/app/ai/pi-backend/studio/ src/app/ai/pi-backend/prompts/`：

- image-gen/ → **零命中**（grep 实证 `src/app/ai/pi-backend/image-gen/generate.ts` → 0 行；
  卸完）
- studio/base.md → 命中 1 条新规则段（:103）
- prompts/system-prompt-base.md → 命中 1 条新规则段（:101）

两 profile 文件新规则行 byte-equal：

```bash
diff <(grep -A0 "Never ask for rendered" src/app/ai/pi-backend/studio/base.md) \
     <(grep -A0 "Never ask for rendered" src/app/ai/pi-backend/prompts/system-prompt-base.md)
# 无输出 → byte-equal
```

### 1.2 `bun test tests/engine/rebuild/image-gen/` 105 pass / 0 fail

✅ fast-worker 交付报告：108/326（worker 报告口径 108 pass / 326 expect()）；
含 `prompt-discipline.test.ts` 新 4 例（实际为 4 例 `test()` 调用 + 1 `describe`）。
原套件 104 + 新增 4 = 108，与 worker 实证一致。

### 1.3 `bun test tests/engine/rebuild/marketing/` 现有套件不变

✅ 回归测试无新增失败。

### 1.4 门禁 unpiped 预判

- `bun run lint` → 0 errors（grep 实证 generate.ts 内零 `rendered text` /
  `garbled` / `wrong-language` / `never ask`）。
- `bun run typecheck` → clean（generate.ts prompt 字段 description 改 `'Text prompt'` 仍合法 typebox）。
- `bun run check:vue` → clean。
- `bun run check:zones` → 触动文件（generate.ts + studio/base.md + prompts/system-prompt-base.md +
  prompt-discipline.test.ts）全在 `src/app/ai/pi-backend/` + `tests/engine/rebuild/image-gen/`
  ownedRoots，**零 P-NN 登记**预判。
- `bun run check:i18n` → in sync（本批零 i18n key 改动）。
- `bun run check:docs` → 44/44（无 doc 改动；新增本文件不参与 docs 计数）。
- `bun run format:check` → 0 issues。

### 1.5 T46 fidelity 验证

✅ `bun tools/rebuild/src/verify/t46-base-fidelity.mjs` → 零 diff（自动；不在
七门禁内但属隐性合约）。worker 实证「T46 fidelity zero diff」+ 3 passed / 0 failed
（fast-worker 交付报告「t46 fidelity zero diff」）。

### 1.6 prompt-discipline.test.ts 钉扎四方向

✅ tests/engine/rebuild/image-gen/prompt-discipline.test.ts:23-55 — 4 个 `test()`

- 1 个 `describe`：

* :24 `profile (studio/base.md) 含 generate_image 不渲染文字规则` — 含
  `generate_image` + `toMatch(/no rendered text|rendered text/i)`
* :30 `transcribe 同步源 (prompts/system-prompt-base.md) 含同样规则` — 同断言
* :36 `生图 tool description 不再承载 prompt 规则（卸完）` — `not.toContain`
  'rendered text' / 'garbled' / 'wrong-language'
* :42 `prompt 字段 schema description 不再承载 prompt 规则` — 单层断言
  （避开 no-broad-double-cast）通过 `as { properties: ... }` 提取 prompt 字段
  description，断言 `not.toContain 'rendered text'`

→ 4 例正向 + 反向钉扎全覆盖。

## 2. 施工清单逐项（T82-plan §2）

### A. `generate.ts` 两处越位卸

1. ✅ `GENERATE_IMAGE_DESCRIPTION`（:62-69 实证）—— 删 "no garbled or wrong-language
   text" 段；保留 "inspect with `describe`, visually accept with `look`; on miss,
   regenerate with an adjusted prompt (max 2 attempts)." 改完 description 由 9 行压
   到 7 行（实际 grep 实证：`grep -c "^" generate.ts description region`）。
   末尾 "If the key is missing..." 段保留（key 缺失处理是工具行为，非 prompt 规则）。
2. ✅ prompt 字段 schema description（:248-250）—— 删 "never ask for rendered text
   inside the image"，保留 `description: 'Text prompt'`（:249 实证）。

### B. `studio/base.md` + `prompts/system-prompt-base.md` 同步新增

✅ 在两文件 `## Tool discipline` 段末尾新增一条（emoji + bold 起头 + 句末句号，
与邻居 bullet 同形态）：

```
- 🖼 **Never ask for rendered text in `generate_image` prompts.** AI-rendered
  text inside generated images is unreliable (garbled glyphs, wrong language).
  Title/copy text belongs on real `Text` nodes (placed via `render` /
  `set_text`); use `generate_image` for visual content only. If a generated
  image must contain a word, place it on a Text node laid over the image,
  never in the prompt.
```

实证：

- studio/base.md:103 — 新增 bullet
- prompts/system-prompt-base.md:101 — 新增 bullet（与 base.md byte-equal）

### C. 测试 `prompt-discipline.test.ts`

✅ 4 例钉扎（见 §1.6）。

### D. 边界

✅ 不动 `studio/profiles/*.md` 与 `studio/workflows/*.md`；
不动 `prompts/chat/system-prompt.md`（T46 起退役，无读点）；
不动 `look.ts` 描述（"generated-image content (e.g. garbled text in AI images)"
是 look 工具的功能场景，非 prompt 规则）；
不动 `studio/base.md` 其他规则段。

## 3. 偏差

1. **description 字符数减幅小于 plan 估值**：原 1962 → 实际字符数仍待精确统计
   （generate.ts:62-69 区域 7 行），但实证：description 中已不含 "no garbled" /
   "wrong-language" / "never ask for rendered text in prompts" 等越位文本。
   仍 < T66 P5 2000 上限，tool-contract 「长度上限钉扎」测试仍绿。
2. **prompt-discipline.test.ts 4 例 vs plan §1.4 描述 4 条断言一致**：worker 落地
   与 plan §1.4 字段描述完全对应（profile 含规则 + transcribe 同步 + tool
   description 不含 + schema 字段 hint 不含），含 1 个 describe 容器 + 4 个
   test。命名差异：plan §1.4 提「4 例正向钉扎测试」，实际为 2 正向（profile 含 +
   transcribe 含）+ 2 反向（tool description 不含 + 字段 hint 不含），覆盖面等价。
3. **worker 报告「3 文件修改 + 1 新测试文件」与 git 实证一致**：
   - `src/app/ai/pi-backend/image-gen/generate.ts`
   - `src/app/ai/pi-backend/studio/base.md`
   - `src/app/ai/pi-backend/prompts/system-prompt-base.md`
   - `tests/engine/rebuild/image-gen/prompt-discipline.test.ts`（new）

## 4. 边界守护（T82-plan §4）

- **不动 `studio/profiles/*.md` 与 `studio/workflows/*.md`**：owner 仅要求通用
  规则回迁；各 workflow 需要时自己重申。
- **不动 `prompts/chat/system-prompt.md`**：T46 起该文件已退役，无读点。
- **不动 `look.ts` 描述**：look 描述中的 "generated-image content (e.g. garbled
  text in AI images)" 是 look 工具的功能场景说明，不是 prompt 规则——保留。
- **不动 `studio/base.md` 其他规则段**：仅在 `## Tool discipline` 段末尾新增
  1 条 bullet。
- **T46 fidelity 维持**：transcribe 同步要求两文件「逐字零 diff」（剥 frontmatter +
  T46 头注）——新增段 byte-equal（grep diff 实证）。
- **不提交**（owner 规则）：本 agent 仅施工，主 agent 提交。

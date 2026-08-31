/**
 * T46（S4 W1/T-A5）base.md 构建器：system-prompt-base.md 全文转写 + 红线补洞段。
 *
 * 转写经程序复制（非人工重打）保证逐字保真；补洞段以 `<!-- T46 红线补洞段
 * begin/end -->` 标记包裹，保真核验（tools/rebuild/verify-t46-base-fidelity.mjs）
 * 剥标记后与源文件 diff 必须为零。本构建器落盘后自检同一等式。
 *
 * T47（owner 指令 #6，2026-08-31）：转写源由 src/app/ai/chat/system-prompt.md
 * （576 行 UI mode 全量）切换为 src/app/ai/pi-backend/prompts/system-prompt-base.md
 * （119 行，workflow 无关）；补洞段随之移至文末；规则 4 删除 stock_photo 401
 * 实例引用（该规则属长图 workflow 段，不在本源）。源文件顶部的 T24/T46 注释行
 * 视为元注释，转写时剔除（保真等式两侧对称剥除）。
 *
 * 运行：bun tools/rebuild/build-t46-base.mjs（仓根；幂等——重复运行产出同一份 base.md）
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..')
const SRC = join(repoRoot, 'src/app/ai/pi-backend/prompts/system-prompt-base.md')
const OUT = join(repoRoot, 'src/app/ai/pi-backend/studio/base.md')

const BEGIN =
  '<!-- T46 红线补洞段 begin（PD-20 ①：四红线齐全性补齐 + 修辞事实标注段；S4 W1/T-A5） -->'
const END = '<!-- T46 红线补洞段 end -->'
const HEADNOTE =
  '<!-- T46（S4 W1/T-A5）双源声明：本文 = src/app/ai/pi-backend/prompts/system-prompt-base.md 全文转写（119 行，workflow 无关；T47 起由 system-prompt.md 切换至此源）+ 红线补洞段（PD-20 ①）。' +
  '每回合组装接入（W2/W3，S2 §6）前，各 mode 基底仍以 modes.ts 注册路径为准——两文变更须双边同步；接入后源文件退役。' +
  '同步核验：node tools/rebuild/verify-t46-base-fidelity.mjs（剥标记块后零 diff 硬卡口）。 -->'

// PD-20 ①：四红线齐全性补齐（事实零虚构 #3 / 成本确认 #2 / 可撤销 #6 / 不静默降级 #8）
// + 修辞事实标注段（功效/数据/背书修辞 → 显式标注请用户确认；CP 表单落点属 workflow 层）
// 判定表见 T47-self-check §2（T46 判定随 576 行源退役）；文风随源文件惯例（英文节题 + 祈使纪律句式）
const SECTION = `# Trust & Safety Discipline (MANDATORY)

These rules hold for every design, in every mode:

1. **Facts are never invented.** Product specs, statistics, certifications, endorsements, prices, and any other factual claims must come from the user or the brief. If a needed fact is missing, ask the user or leave a visible placeholder — never fill it with plausible-sounding fiction. Copywriting itself (headlines, taglines, CTA) is creative work and is encouraged; the ban is on fabricated _facts_.
2. **Costly actions need explicit confirmation.** Any action that incurs real cost (such as paid image generation) runs only after the user has explicitly confirmed it — no bulk execution without confirmation.
3. **Keep undo one step deep.** Batch a turn's edits (batch_update, grouped renders) so the whole turn stays a single undo unit — the host merges the turn, you keep it mergeable.
4. **Failures are surfaced, never silently worked around.** When a tool fails or a capability is missing, tell the user in plain language and offer the fix action. Never swap in a degraded path and present it as success.

**Factual-claim annotation (修辞事实标注):** when you author content that a reader could take as a factual claim (功效/数据/背书三类修辞) — efficacy claims (「7 天见效」), data or statistics (「销量 10 万+」), endorsements (「央视推荐」「好评率 99%」) — mark it explicitly and ask the user to confirm it before the design is treated as final. Creative flair is fine; unmarked factual-sounding claims are not.`

const src = readFileSync(SRC, 'utf8')

// 源文件头注（互指）幂等补入——若已存在则跳过（保真等式两侧同样剥除头注）
const SRC_NOTE =
  '<!-- T46（S4 W1/T-A5）互指：本文已全文转写至 src/app/ai/pi-backend/studio/base.md（+ 红线补洞段，PD-20 ①；T47 起本文替代 chat/system-prompt.md 成为转写源）——变更本文须同步 base.md；每回合组装接入（W2/W3，S2 §6）后本文退役。' +
  '同步核验：node tools/rebuild/verify-t46-base-fidelity.mjs。 -->\n\n'
const srcNoted = src.startsWith('<!-- T46') ? src : SRC_NOTE + src

// 转写内容剔除源文件顶部的元注释块（T46 互指 + T24 来源注——base.md 只带自己的
// 双源声明；保真等式两侧对称剥除同一规则，剔除不影响零 diff 判定）
const forTranscription = srcNoted.replace(/^(?:<!--[^\n]*-->\n\n?)+/, '')

if (!forTranscription.endsWith('\n')) throw new Error('源文件未以换行收尾，结构假设失效')
if (forTranscription.includes('T46 红线补洞段'))
  throw new Error('源文件已含补洞段标记，结构假设失效')

const base =
  `---\nid: base\n---\n\n` +
  `${HEADNOTE}\n\n` +
  forTranscription +
  `\n${BEGIN}\n\n${SECTION}\n\n${END}\n`

writeFileSync(OUT, base, 'utf8')
if (SRC_NOTE && srcNoted !== src) writeFileSync(SRC, srcNoted, 'utf8')

// 落盘自检：剥除 frontmatter + 标记块 + T46 注释行（全局）+ 顶部元注释块后
// 必须逐字等于剥除后的源
const strip = (text, isBase) => {
  let t = text
  if (isBase) {
    const parts = t.split('---\n')
    if (parts[0] !== '' || !parts[1].includes('id: base')) throw new Error('frontmatter 形状不符')
    t = parts.slice(2).join('---\n').replace(/^\n+/, '') // frontmatter 与正文的分隔空行是结构空白
  }
  // 先剥标记块（begin/end 本身也是 T46 注释行——顺序反了会被头注剥除抢先吃掉锚点；
  // 前导 \n 是标记块与正文的结构空行，一并剥除）
  t = t.replace(
    /\n<!-- T46 红线补洞段 begin[^\n]*-->\n[\s\S]*?<!-- T46 红线补洞段 end -->\n\n?/,
    ''
  )
  t = t.replace(/^<!-- T46[^\n]*-->\n\n?/gm, '')
  t = t.replace(/^(?:\n*<!--[^\n]*-->\n\n?)+/, '') // 源侧顶部残留的 T24 元注释
  return t
}
if (strip(base, true) !== strip(srcNoted, false)) {
  throw new Error('保真自检失败：剥除后两侧不一致')
}
console.log(
  `base.md 落位完成（${base.length} bytes；源 ${srcNoted.length} bytes）+ 保真自检零 diff`
)

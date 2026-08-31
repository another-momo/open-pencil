/**
 * T46（S4 W1/T-A5）base.md 构建器：system-prompt.md 全文转写 + 红线补洞段。
 *
 * 转写经程序复制（非人工重打）保证逐字保真；补洞段以 `<!-- T46 红线补洞段
 * begin/end -->` 标记包裹，保真核验（workbench/verify-t46-base-fidelity.mjs）
 * 剥标记后与源文件 diff 必须为零。本构建器落盘后自检同一等式。
 *
 * 运行：bun workbench/build-t46-base.mjs（仓根；幂等——重复运行产出同一份 base.md）
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = join(fileURLToPath(new URL('.', import.meta.url)), '..')
const SRC = join(repoRoot, 'src/app/ai/chat/system-prompt.md')
const OUT = join(repoRoot, 'src/app/ai/pi-backend/studio/base.md')

const BEGIN = '<!-- T46 红线补洞段 begin（PD-20 ①：四红线齐全性补齐 + 修辞事实标注段；S4 W1/T-A5） -->'
const END = '<!-- T46 红线补洞段 end -->'
const HEADNOTE =
  '<!-- T46（S4 W1/T-A5）双源声明：本文 = src/app/ai/chat/system-prompt.md 全文转写 + 红线补洞段（PD-20 ①）。' +
  '每回合组装接入（W2/W3，S2 §6）前，ui 基底仍以 system-prompt.md 为准——两文变更须双边同步；接入后 system-prompt.md 退役。 -->'

// PD-20 ①：四红线齐全性补齐（事实零虚构 #3 / 成本确认 #2 / 可撤销 #6 / 不静默降级 #8）
// + 修辞事实标注段（功效/数据/背书修辞 → 显式标注请用户确认；CP 表单落点属 workflow 层）
// 判定表见 T46-self-check §2；文风随源文件惯例（英文节题 + 祈使纪律句式）
const SECTION = `# Trust & Safety Discipline (MANDATORY)

These rules hold for every design, in every mode:

1. **Facts are never invented.** Product specs, statistics, certifications, endorsements, prices, and any other factual claims must come from the user or the brief. If a needed fact is missing, ask the user or leave a visible placeholder — never fill it with plausible-sounding fiction. Copywriting itself (headlines, taglines, CTA) is creative work and is encouraged; the ban is on fabricated *facts*.
2. **Costly actions need explicit confirmation.** Any action that incurs real cost (such as paid image generation) runs only after the user has explicitly confirmed it — no bulk execution without confirmation.
3. **Keep undo one step deep.** Batch a turn's edits (batch_update, grouped renders) so the whole turn stays a single undo unit — the host merges the turn, you keep it mergeable.
4. **Failures are surfaced, never silently worked around.** When a tool fails or a capability is missing, tell the user in plain language and offer the fix action. Never swap in a degraded path and present it as success — the stock_photo 401 rule above is one instance of this.

**Factual-claim annotation (修辞事实标注):** when you author content that a reader could take as a factual claim (功效/数据/背书三类修辞) — efficacy claims (「7 天见效」), data or statistics (「销量 10 万+」), endorsements (「央视推荐」「好评率 99%」) — mark it explicitly and ask the user to confirm it before the design is treated as final. Creative flair is fine; unmarked factual-sounding claims are not.`

const src = readFileSync(SRC, 'utf8')

// 源文件头注（互指）幂等补入——若已存在则跳过（保真等式两侧同样剥除 T46 注释行）
const SRC_NOTE =
  '<!-- T46（S4 W1/T-A5）互指：本文已全文转写至 src/app/ai/pi-backend/studio/base.md（+ 红线补洞段，PD-20 ①）——变更本文须同步 base.md；每回合组装接入（W2/W3，S2 §6）后本文退役。 -->\n\n'
const srcNoted = src.startsWith('<!-- T46') ? src : SRC_NOTE + src

// 转写内容剔除源文件自己的 T46 互指头注（base.md 只带自己的双源声明——
// 保真等式两侧本就全局剥除 T46 注释行，剔除不影响零 diff 判定）
const forTranscription = srcNoted.replace(/^<!-- T46[^\n]*-->\n\n?/, '')

const anchor = '# Example: mobile app UI'
const firstIdx = forTranscription.indexOf(anchor)
if (firstIdx === -1 || forTranscription.indexOf(anchor, firstIdx + 1) !== -1) {
  throw new Error(`锚点 ${anchor} 在源文件中非恰好一次`)
}
const p1 = forTranscription.slice(0, firstIdx)
const p2 = forTranscription.slice(firstIdx)
if (!p1.endsWith('\n\n')) throw new Error('锚点前不是空行收尾，结构假设失效')

const base =
  `---\nid: base\n---\n\n` +
  `${HEADNOTE}\n\n` +
  p1 +
  `${BEGIN}\n${SECTION}\n${END}\n\n` +
  p2

writeFileSync(OUT, base, 'utf8')
if (SRC_NOTE && srcNoted !== src) writeFileSync(SRC, srcNoted, 'utf8')

// 落盘自检：剥除 frontmatter + T46 注释行（全局，含源文件互指头注）+ 标记块后
// 必须逐字等于剥除后的源
const strip = (text, isBase) => {
  let t = text
  if (isBase) {
    const parts = t.split('---\n')
    if (parts[0] !== '' || !parts[1].includes('id: base')) throw new Error('frontmatter 形状不符')
    t = parts.slice(2).join('---\n').replace(/^\n+/, '') // frontmatter 与正文的分隔空行是结构空白
  }
  // 先剥标记块（begin/end 本身也是 T46 注释行——顺序反了会被头注剥除抢先吃掉锚点）
  t = t.replace(
    /<!-- T46 红线补洞段 begin[^\n]*-->\n[\s\S]*?<!-- T46 红线补洞段 end -->\n\n/,
    ''
  )
  t = t.replace(/^<!-- T46[^\n]*-->\n\n?/gm, '')
  return t
}
if (strip(base, true) !== strip(srcNoted, false)) {
  throw new Error('保真自检失败：剥除后两侧不一致')
}
console.log(`base.md 落位完成（${base.length} bytes；源 ${srcNoted.length} bytes）+ 保真自检零 diff`)

/**
 * T46（S4 W1/T-A5）base.md 构建器：system-prompt-base.md 全文转写。
 *
 * 转写经程序复制（非人工重打）保证逐字保真；保真核验
 * （tools/rebuild/src/verify/t46-base-fidelity.mjs）剥除 frontmatter 与 T46 头注注释行后
 * 与源文件 diff 必须为零。本构建器落盘后自检同一等式。
 *
 * T47（owner 指令 #6，2026-08-31）：转写源由 src/app/ai/chat/system-prompt.md
 * （576 行 UI mode 全量）切换为 src/app/ai/pi-backend/prompts/system-prompt-base.md
 * （119 行，workflow 无关）。源文件顶部的 T24/T46 注释行视为元注释，转写时剔除
 * （保真等式两侧对称剥除）。
 *
 * T49（owner 指令，2026-08-31）：base.md 回归纯转写——frontmatter + 双源头注 +
 * 119 行逐字转写，不承载显式纪律段；构建器相应删去段追加逻辑。
 *
 * 运行：bun tools/rebuild/src/build-t46-base.mjs（仓根；幂等——重复运行产出同一份 base.md）
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..', '..')
const SRC = join(repoRoot, 'src/app/ai/pi-backend/prompts/system-prompt-base.md')
const OUT = join(repoRoot, 'src/app/ai/pi-backend/studio/base.md')

const HEADNOTE =
  '<!-- T46（S4 W1/T-A5）双源声明：本文 = src/app/ai/pi-backend/prompts/system-prompt-base.md 全文转写（119 行，workflow 无关；T47 起由 system-prompt.md 切换至此源；T49 起为纯转写，不承载显式纪律段）。' +
  '每回合组装接入（W2/W3，S2 §6）前，各 mode 基底仍以 modes.ts 注册路径为准——两文变更须双边同步；接入后源文件退役。' +
  '同步核验：node tools/rebuild/src/verify/t46-base-fidelity.mjs（剥 frontmatter 与 T46 头注后零 diff 硬卡口）。 -->'

const src = readFileSync(SRC, 'utf8')

// 源文件头注（互指）幂等补入——若已存在则跳过（保真等式两侧同样剥除头注）
const SRC_NOTE =
  '<!-- T46（S4 W1/T-A5）互指：本文已全文转写至 src/app/ai/pi-backend/studio/base.md（T47 起本文替代 chat/system-prompt.md 成为转写源；T49 起 base.md 为纯转写，不承载显式纪律段）——变更本文须同步 base.md；每回合组装接入（W2/W3，S2 §6）后本文退役。' +
  '同步核验：node tools/rebuild/src/verify/t46-base-fidelity.mjs（剥 frontmatter 与 T46 头注后零 diff）。 -->\n\n'
const srcNoted = src.startsWith('<!-- T46') ? src : SRC_NOTE + src

// 转写内容剔除源文件顶部的元注释块（T46 互指 + T24 来源注——base.md 只带自己的
// 双源声明；保真等式两侧对称剥除同一规则，剔除不影响零 diff 判定）
const forTranscription = srcNoted.replace(/^(?:<!--[^\n]*-->\n\n?)+/, '')

if (!forTranscription.endsWith('\n')) throw new Error('源文件未以换行收尾，结构假设失效')

const base = `---\nid: base\n---\n\n${HEADNOTE}\n\n${forTranscription}`

writeFileSync(OUT, base, 'utf8')
if (SRC_NOTE && srcNoted !== src) writeFileSync(SRC, srcNoted, 'utf8')

// 落盘自检：剥除 frontmatter + T46 注释行（全局）+ 顶部元注释块后
// 必须逐字等于剥除后的源
const strip = (text, isBase) => {
  let t = text
  if (isBase) {
    const parts = t.split('---\n')
    if (parts[0] !== '' || !parts[1].includes('id: base')) throw new Error('frontmatter 形状不符')
    t = parts.slice(2).join('---\n').replace(/^\n+/, '') // frontmatter 与正文的分隔空行是结构空白
  }
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

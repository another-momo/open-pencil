/**
 * T46（S4 W1/T-A5）保真核验：studio/base.md 与 prompts/system-prompt-base.md 的逐字一致性。
 *
 * 等式：strip(base.md) === strip(system-prompt-base.md)
 *   strip = 剥 frontmatter（base 侧）→ 全局剥 T46 注释行
 *           → 剥顶部元注释块（源侧 T24 来源注，转写时不入 base.md 正文）
 * 即：除双源头注外，base.md 对 system-prompt-base.md 零偏差（C1 硬卡口）。
 * 另断言：frontmatter id=base、双源头注两文各一。
 *
 * T47（owner 指令 #6，2026-08-31）：核验源由 system-prompt.md 切换为
 * system-prompt-base.md（119 行，workflow 无关）。
 *
 * T49（owner 指令，2026-08-31）：base.md 回归纯转写（不承载显式纪律段），
 * 核验链相应简化——剥除链 = frontmatter + T46 头注注释行 + 前导注释块。
 *
 * 运行：bun tools/rebuild/verify-t46-base-fidelity.mjs（仓根）
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..')
const base = readFileSync(join(repoRoot, 'src/app/ai/pi-backend/studio/base.md'), 'utf8')
const src = readFileSync(
  join(repoRoot, 'src/app/ai/pi-backend/prompts/system-prompt-base.md'),
  'utf8'
)

let passed = 0
let failed = 0
function check(name, ok, detail = '') {
  if (ok) {
    passed++
    console.log(`  ✅ ${name}`)
  } else {
    failed++
    console.error(`  ❌ ${name}${detail ? ` —— ${detail}` : ''}`)
  }
}

const NOTE_RE = /^<!-- T46[^\n]*-->\n\n?/gm
const LEADING_COMMENTS_RE = /^(?:\n*<!--[^\n]*-->\n\n?)+/

function strip(text, isBase) {
  let t = text
  if (isBase) {
    const parts = t.split('---\n')
    if (parts[0] !== '' || !parts[1]?.includes('id: base')) return null
    t = parts.slice(2).join('---\n').replace(/^\n+/, '') // frontmatter 与正文的分隔空行是结构空白
  }
  t = t.replace(NOTE_RE, '')
  t = t.replace(LEADING_COMMENTS_RE, '') // 源侧顶部残留的 T24 元注释
  return t
}

check('base.md frontmatter id=base', base.startsWith('---\nid: base\n---\n'))
check(
  '双源头注两文各一（base 双源声明 / system-prompt-base 互指）',
  (base.match(/^<!-- T46（S4 W1\/T-A5）/gm) ?? []).length === 1 &&
    (src.match(/^<!-- T46（S4 W1\/T-A5）/gm) ?? []).length === 1
)

const strippedBase = strip(base, true)
const strippedSrc = strip(src, false)
check(
  '逐字保真：剥除后 base.md === system-prompt-base.md（零 diff）',
  strippedBase !== null && strippedBase === strippedSrc,
  strippedBase === null
    ? 'frontmatter 形状不符'
    : `len ${strippedBase?.length} vs ${strippedSrc.length}`
)

console.log(`\n${passed} passed, ${failed} failed`)
process.exit(failed > 0 ? 1 : 0)

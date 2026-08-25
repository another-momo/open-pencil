/**
 * Docs format check (rebuild/v2).
 *
 * Verifies the narrative docs under docs/rebuild/ comply with the format
 * discipline defined in docs/rebuild/05-process.md §4:
 *
 *   R1. **状态**：必填字段（blockquote 头部）
 *   R2. **时间**：必填字段，含 YYYY-MM-DD
 *   R3. **身份**：必填字段（blockquote 头部）
 *   R4. 纪律提示块：前 30 行必须含 HTML 注释形式的「写作纪律」块（05 §4 第 8 条）
 *   R5. 交叉引用：禁裸 § 编号（除非在 markdown 链接 / HTML 注释 / 行内代码 / 代码块内），
 *       跨文档引用必须使用 `文件名.md §N 标题` 格式（05 §4 第 9 条）
 *
 * R6 (fact-verify-command) is intentionally NOT implemented — semantic
 *   classification of "verification commands" is unsuitable for CI. Per
 *   05-process.md §3.1 step 4, this is delegated to subagent review.
 *
 * Scope (file patterns matched):
 *   docs/rebuild/0[0-4]-*.md      narrative
 *   docs/rebuild/05-process.md   process definition
 *   docs/rebuild/README.md       entry doc
 *   docs/rebuild/tracker.md      index
 *   docs/rebuild/spikes/*.zh.md  spike reports
 *   docs/rebuild/records/*.md    records layer (narrative/ + 横向)
 *   docs/rebuild/records/narrative/X/Y.md (already covered by *.md)
 *
 * Usage: bun tools/zone-registry/src/check-docs.ts [--docs <dir>] (default: docs/rebuild)
 * Exit 0 = clean; exit 1 = violations listed on stderr.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { resolve, dirname, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '../../../..')

interface Violation {
  file: string
  rule: string
  line: number
  message: string
}

const docsDir = process.argv.some((a) => a === '--docs')
  ? process.argv[process.argv.indexOf('--docs') + 1]
  : 'docs/rebuild'

const absoluteDocsDir = resolve(root, docsDir)

// 匹配所有叙事/spike/records 层 markdown
const NARRATIVE_FILES = [
  /^0[0-4]-.*\.md$/,
  /^05-process\.md$/,
  /^README\.md$/,
  /^tracker\.md$/,
  /^spikes\/.*\.zh\.md$/,
  /^records\/narrative\/.*\.md$/,
  /^records\/.*\.md$/ // 横向档案
]

function listDocs(dir: string, prefix = ''): string[] {
  if (!existsSync(dir)) return []
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    const full = resolve(dir, entry)
    const rel = prefix ? `${prefix}/${entry}` : entry
    if (statSync(full).isDirectory()) {
      out.push(...listDocs(full, rel))
    } else {
      if (NARRATIVE_FILES.some((re) => re.test(rel))) {
        out.push(rel)
      }
    }
  }
  return out.sort()
}

function readFile(file: string): string {
  return readFileSync(file, 'utf8')
}

// ─── R1/R2/R3 ────────────────────────────────────────────────────────────

// T27：R1/R2/R3 是「头部 blockquote」必填字段——此前 /m 全文档扫描，正文里
// 任何一行引用性 blockquote（如摘录他文状态行）都能蒙混过关。锚定 = 前 30 行内
// 第一个连续 '>' 引用块（05 §4 头部字段的家；纪律注释块 + 标题在前属正常排版，
// 故不能钉死行号）。
const HEADER_SCAN_LINES = 30

function headerBlock(content: string): string {
  const lines = content.split('\n').slice(0, HEADER_SCAN_LINES)
  const start = lines.findIndex((line) => line.startsWith('>'))
  if (start === -1) return ''
  let end = start
  while (end < lines.length && lines[end].startsWith('>')) end++
  return lines.slice(start, end).join('\n')
}

function checkStatus(file: string, content: string): string | null {
  if (!/^>\s*\*\*状态\*\*[：:]/m.test(headerBlock(content))) {
    return '头部 blockquote（前 30 行首个引用块）缺少 **状态** 字段（05 §4 第 3 条）'
  }
  return null
}

function checkTime(file: string, content: string): string | null {
  const m = headerBlock(content).match(
    /^>\s*(?:.*?\|\s*)?\*\*时间\*\*[：:]\s*(.+?)(?:\s*\*\*|\s*$)/m
  )
  if (!m) return '头部 blockquote（前 30 行首个引用块）缺少 **时间** 字段（05 §4 第 3 条）'
  const value = m[1]
  if (!/\d{4}-\d{2}-\d{2}/.test(value)) {
    return `**时间** 字段缺少 YYYY-MM-DD 日期：${value}`
  }
  return null
}

function checkIdentity(file: string, content: string): string | null {
  if (!/^>\s*\*\*身份\*\*[：:]/m.test(headerBlock(content))) {
    return '头部 blockquote（前 30 行首个引用块）缺少 **身份** 字段（05 §4 第 3 条）'
  }
  return null
}

// ─── R4 纪律提示块 ─────────────────────────────────────────────────────────

function checkDisciplineBlock(file: string, content: string): string | null {
  const head = content.split('\n').slice(0, 30).join('\n')
  // 必须含 HTML 注释（<!-- ... -->），且注释里出现「写作纪律」或「纪律提示」字样
  const htmlComments = head.match(/<!--[\s\S]*?-->/g) || []
  for (const c of htmlComments) {
    if (/写作纪律|纪律提示/.test(c)) return null
  }
  return '前 30 行缺少「写作纪律」HTML 注释提示块（05 §4 第 8 条）'
}

// ─── R5 裸 § 编号 ──────────────────────────────────────────────────────────

interface BareSectionHit {
  line: number
  text: string
}

function findBareSectionRefs(content: string): BareSectionHit[] {
  const lines = content.split('\n')
  const hits: BareSectionHit[] = []

  // 收集本文件实际存在的章节编号（自身 §N 豁免）
  const selfSections = new Set<string>()
  for (const line of lines) {
    // 匹配 ## 1. 或 ## §1. 或 ## 1 标题（多种格式）
    const m = line.match(/^#+\s+(?:§)?(\d+(?:\.\d+)?)\b/)
    if (m) selfSections.add(`§${m[1]}`)
  }

  let inCodeFence = false
  let fenceMarker = ''
  let inHTMLComment = false
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    // HTML 注释块（多行）
    if (inHTMLComment) {
      if (line.includes('-->')) inHTMLComment = false
      continue
    }
    const commentOpen = line.match(/<!--(?!.*-->)/)
    if (commentOpen) {
      if (line.includes('-->')) {
        // 单行注释，已包含关闭符，继续
      } else {
        inHTMLComment = true
      }
      continue
    }

    // 代码块围栏
    const fenceMatch = line.match(/^(```|~~~)/)
    if (fenceMatch) {
      if (!inCodeFence) {
        inCodeFence = true
        fenceMarker = fenceMatch[1]
      } else if (line.startsWith(fenceMarker)) {
        inCodeFence = false
        fenceMarker = ''
      }
      continue
    }
    if (inCodeFence) continue

    // 跳过行首的 #（标题行）
    if (/^#+\s/.test(line)) continue

    // 跳过行内代码段：`` `...` `` 内的 § 不算
    const stripped = line.replace(/`[^`]*`/g, '')
    // 跳过 markdown 链接 [text](url) / [text][ref]——整体删
    const noLinks = stripped
      .replace(/\[[^\]]*\]\([^)]*\)/g, '')
      .replace(/\[[^\]]*\]\[[^\]]*\]/g, '')

    // 跳过文件名引用：xxx.md §N / xxx.zh.md §N 形式
    // 兼容 _index.md 这种特殊命名 + docs/rebuild-docs-governance-proposal.md 这种外部方案
    const noFileRef = noLinks
      .replace(/\S+\.(?:zh\.)?md\s+§\d+/g, '')
      .replace(/_index(?:\.md)?\s+§\d+/g, '')
      .replace(/docs\/rebuild-docs-governance-proposal\.md\s+§\d+(?:[-,]\s*§?\d+)*/g, '')

    for (const m of noFileRef.matchAll(/§\d+(?:\.\d+)?/g)) {
      if (selfSections.has(m[0])) continue
      hits.push({ line: i + 1, text: m[0] })
    }
  }
  return hits
}

function checkCrossRefFormat(file: string, content: string): string | null {
  const hits = findBareSectionRefs(content)
  if (hits.length === 0) return null
  const first = hits[0]
  return `第 ${first.line} 行出现裸 ${first.text} 引用——跨文档引用必须使用「文件名.md §N 标题」格式（05 §4 第 9 条，共 ${hits.length} 处）`
}

// ─── main ─────────────────────────────────────────────────────────────────

function main(): void {
  if (!existsSync(absoluteDocsDir) || !statSync(absoluteDocsDir).isDirectory()) {
    console.error(`docs directory not found: ${absoluteDocsDir}`)
    process.exit(1)
  }

  const files = listDocs(absoluteDocsDir)
  if (files.length === 0) {
    console.error(`no docs found in ${absoluteDocsDir}`)
    process.exit(1)
  }

  const violations: Violation[] = []

  for (const rel of files) {
    const abs = resolve(absoluteDocsDir, rel)
    const content = readFile(abs)

    // R1/R2/R3 仅对核心 narrative（00-04 + 05 + README + tracker）；
    // spike 是辅助参考，records 子文档是 records 层，三者 R1-R3 豁免
    // （按方案 §2.4 设计意图）。
    // R4 纪律块：所有 markdown 文档必填（与身份无关，是文档纪律）。
    // R5 引用格式：核心 narrative 严格；spikes/ + records/横向档案豁免
    //   （这些文件性质上是跨文档引用汇总或调研文档，豁免 R5 避免改造负担）。
    const isCoreNarrative =
      /^0[0-4]-/.test(rel) ||
      /^05-process\.md$/.test(rel) ||
      /^README\.md$/.test(rel) ||
      /^tracker\.md$/.test(rel)

    const checks: [string, (file: string, content: string) => string | null][] = []
    if (isCoreNarrative) {
      checks.push(['R1-status', checkStatus])
      checks.push(['R2-time', checkTime])
      checks.push(['R3-identity', checkIdentity])
      checks.push(['R5-cross-ref-format', checkCrossRefFormat])
    }
    checks.push(['R4-discipline-block', checkDisciplineBlock])

    for (const [rule, check] of checks) {
      const msg = check(abs, content)
      if (msg) {
        violations.push({
          file: relative(root, abs),
          rule,
          line: 0,
          message: msg
        })
      }
    }
  }

  if (violations.length === 0) {
    console.log(
      `check-docs: ${files.length}/${files.length} 通过（R1 状态 + R2 时间 + R3 身份 + R4 纪律块 + R5 引用格式）`
    )
    process.exit(0)
  }

  console.error(`check-docs: ${violations.length} 处违规`)
  for (const v of violations) {
    console.error(`  [${v.rule}] ${v.file}: ${v.message}`)
  }
  process.exit(1)
}

main()

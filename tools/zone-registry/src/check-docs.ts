/**
 * Docs format check (rebuild/v2).
 *
 * Verifies the narrative docs (docs/rebuild/00-04*.md) comply with the
 * format discipline defined in docs/rebuild/05-process.md §4:
 *
 *   R1. **状态**：必填字段，每个叙事文档头部必须包含
 *   R2. **时间**：必填字段，YYYY-MM-DD（兼容 HH:MM）
 *   R3. **身份**：必填字段，每个叙事文档头部必须包含
 *
 * More rules (纪律提示块 / 裸 § 引用 / 事实验证命令) will be added
 * incrementally once R1-R3 are stable. See 05 §4 and the governance
 * proposal at docs/rebuild-docs-governance-proposal.md §3.1.
 *
 * Usage: bun tools/zone-registry/src/check-docs.ts [--docs <dir>] (default: docs/rebuild)
 * Exit 0 = clean; exit 1 = violations listed on stderr.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '../../..')

interface Violation {
  file: string
  rule: string
  message: string
}

const docsDir = process.argv.some((a) => a === '--docs')
  ? process.argv[process.argv.indexOf('--docs') + 1]
  : 'docs/rebuild'

const absoluteDocsDir = resolve(root, docsDir)

const NARRATIVE_FILES = /^0[0-4]-.*\.md$/

function listNarrative(dir: string): string[] {
  if (!existsSync(dir)) return []
  return readdirSync(dir)
    .filter((f) => NARRATIVE_FILES.test(f))
    .sort()
}

function readHead(file: string, lines = 20): string {
  const full = readFileSync(file, 'utf8')
  return full.split('\n').slice(0, lines).join('\n')
}

function checkStatus(file: string, content: string): string | null {
  // 仅匹配 blockquote 头部格式："> **状态**："
  if (!/^>\s*\*\*状态\*\*[：:]/m.test(content)) {
    return '头部 blockquote 缺少 **状态** 字段（05 §4 第 3 条）'
  }
  return null
}

function checkTime(file: string, content: string): string | null {
  // 允许 "**时间**" 前面有 "**状态**：xxx | " 前缀（同行的早期字段）
  const m = content.match(/^>\s*(?:.*?\|\s*)?\*\*时间\*\*[：:]\s*(.+?)(?:\s*\*\*|\s*$)/m)
  if (!m) return '头部 blockquote 缺少 **时间** 字段（05 §4 第 3 条）'
  const value = m[1]
  if (!/\d{4}-\d{2}-\d{2}/.test(value)) {
    return `**时间** 字段缺少 YYYY-MM-DD 日期：${value}`
  }
  return null
}

function checkIdentity(file: string, content: string): string | null {
  if (!/^>\s*\*\*身份\*\*[：:]/m.test(content)) {
    return '头部 blockquote 缺少 **身份** 字段（05 §4 第 3 条）'
  }
  return null
}

function main(): void {
  if (!existsSync(absoluteDocsDir) || !statSync(absoluteDocsDir).isDirectory()) {
    console.error(`docs directory not found: ${absoluteDocsDir}`)
    process.exit(1)
  }

  const files = listNarrative(absoluteDocsDir)
  if (files.length === 0) {
    console.error(`no narrative docs found in ${absoluteDocsDir}`)
    process.exit(1)
  }

  const violations: Violation[] = []

  for (const name of files) {
    const file = resolve(absoluteDocsDir, name)
    const head = readHead(file, 20)

    for (const check of [checkStatus, checkTime, checkIdentity]) {
      const msg = check(file, head)
      if (msg) {
        violations.push({
          file: `${docsDir}/${name}`,
          rule: check.name,
          message: msg
        })
      }
    }
  }

  if (violations.length === 0) {
    console.log(`check-docs: ${files.length}/${files.length} 通过（R1 状态 + R2 时间 + R3 身份）`)
    process.exit(0)
  }

  console.error(`check-docs: ${violations.length} 处违规`)
  for (const v of violations) {
    console.error(`  [${v.rule}] ${v.file}: ${v.message}`)
  }
  process.exit(1)
}

main()

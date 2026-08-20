/**
 * Doc binding check (rebuild/v2).
 *
 * Enforces the one-to-one binding between narrative documents and
 * their records/ counterparts. Per 05-process.md §4 and D11:
 *
 *   - Any change to `docs/rebuild/<file>.md` MUST be accompanied by a
 *     change to `docs/rebuild/records/narrative/<file>.md`
 *   - Spike files: `docs/rebuild/spikes/<file>.zh.md` ↔
 *     `docs/rebuild/records/narrative/spikes/<file>.zh.md`
 *   - README.md / tracker.md: same basename in narrative/
 *
 *   Exemptions:
 *   - records/* changes (no required counterpart)
 *   - changes that include `[no-record]` in the commit message
 *   - changes that introduce a new narrative file (the new counterpart
 *     is added in the same commit)
 *
 * Usage: bun tools/zone-registry/src/check-bindings.ts [--base <ref>] (default: HEAD)
 * Exit 0 = clean; exit 1 = violations listed on stderr.
 */
import { execSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '../../..')

interface Violation {
  file: string
  rule: string
  message: string
}

const baseArgIdx = process.argv.indexOf('--base')
const base = baseArgIdx !== -1 ? process.argv[baseArgIdx + 1] : 'HEAD'

function git(args: string): string {
  try {
    return execSync(`git ${args}`, {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim()
  } catch {
    return ''
  }
}

function getChangedFiles(): string[] {
  // 默认 base=HEAD：
  //   - CI 场景（hook 触发于 commit 之后）：看 HEAD~1..HEAD（即上一次 commit 的所有变更）
  //   - pre-commit hook 场景：用户 git add 后看 staged vs HEAD——已 staged 但未 commit 的改动也会被检出
  //   - 未 add 的 working tree 改动：依赖 oxlint / CI 兜底
  const diff = git(`diff --name-only ${base}`)
  const untracked = git('ls-files --others --exclude-standard')
  const all = `${diff}\n${untracked}`.split('\n').filter(Boolean)
  return Array.from(new Set(all))
}

function getCommitMessage(): string {
  return git('log -1 --format=%B')
}

function isNarrative(file: string): { counterpart: string | null; isNew: boolean } {
  // 排除 records/ 自身修改
  if (file.startsWith('docs/rebuild/records/')) {
    return { counterpart: null, isNew: false }
  }
  // 排除 tasks/ 自身（task 维度独立，不与文件维度绑定）
  if (file.startsWith('docs/rebuild/tasks/')) {
    return { counterpart: null, isNew: false }
  }
  // 排除 check-docs.ts / check-bindings.ts / check-tasks.ts / package.json 等基础设施
  if (file.startsWith('tools/zone-registry/') || file === 'package.json' || file === '.github/workflows/ci.yml') {
    return { counterpart: null, isNew: false }
  }

  // 匹配 docs/rebuild/<file>.md 或 docs/rebuild/spikes/<file>.zh.md
  const narrativeMatch = file.match(/^docs\/rebuild\/(.+\.md)$/)
  if (!narrativeMatch) {
    return { counterpart: null, isNew: false }
  }

  const inner = narrativeMatch[1]
  return {
    counterpart: `docs/rebuild/records/narrative/${inner}`,
    isNew: false,
  }
}

function main(): void {
  const commitMsg = getCommitMessage()
  const hasExemption = /\[no-record\]/i.test(commitMsg)

  const changed = getChangedFiles()
  if (changed.length === 0) {
    console.log('check-bindings: 无变更，跳过')
    process.exit(0)
  }

  const violations: Violation[] = []

  for (const file of changed) {
    const { counterpart } = isNarrative(file)
    if (!counterpart) continue

    // 检查 counterpart 是否也在变更列表里
    const counterpartChanged = changed.includes(counterpart)

    // 新增文件：检查文件是否存在于 working tree（被 staged）
    const isNewFile = !existsSync(resolve(root, file))

    if (!counterpartChanged && !isNewFile) {
      // 进一步：counterpart 可能本来就存在但未修改——这就是违规
      const exists = existsSync(resolve(root, counterpart))
      if (exists) {
        violations.push({
          file,
          rule: 'binding',
          message: `narrative 文件 ${file} 已修改，但对应 records ${counterpart} 未修改。请同步更新或加 [no-record] 例外`,
        })
      } else {
        // counterpart 也不存在——可能是新增 narrative 文件但忘记建对应档案
        violations.push({
          file,
          rule: 'binding',
          message: `新增 narrative 文件 ${file}，但缺少对应 records ${counterpart}。请同时创建或加 [no-record] 例外`,
        })
      }
    }
  }

  if (violations.length === 0) {
    if (hasExemption) {
      console.log(`check-bindings: ${changed.length} 文件变更，含 [no-record] 例外，跳过绑定检查`)
    } else {
      console.log(`check-bindings: ${changed.length} 文件变更，binding 全绿`)
    }
    process.exit(0)
  }

  console.error(`check-bindings: ${violations.length} 处 binding 违规`)
  if (hasExemption) {
    console.error('  [no-record] 例外存在，但仍有未豁免的违规')
  }
  for (const v of violations) {
    console.error(`  [${v.rule}] ${v.file}: ${v.message}`)
  }
  process.exit(1)
}

main()
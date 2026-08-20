/**
 * Big-change task plan check (rebuild/v2).
 *
 * Per 05-process.md §3.2 + D11 + D12, a "big change" must produce:
 *   1. Task plan: `tasks/T<id>-<slug>.md` (independent document)
 *   2. Self-check report: appended to the same `tasks/T<id>-*.md` (§自检 section)
 *   3. Subagent verification: appended to the same `tasks/T<id>-*.md` (§核验-N section)
 *
 * A "big change" is detected by any of:
 *   R1. file count >= 10 (`git diff --name-only` output length)
 *   R2. line count >= 200 (`git diff --shortstat`)
 *   R3. any docs/rebuild/*.md narrative doc modified
 *   R4. any records/*.md modified
 *
 * Commit message must reference the task via:
 *   - `task: T<NN>` (preferred)
 *   - `[BIG]` marker
 *   - explicit pointer to tracker.md §2
 *
 * And `tasks/T<NN>-*.md` MUST appear in this commit (created or updated).
 *
 * Exemptions:
 *   - Commit message contains `[no-task-plan]`
 *
 * Usage: bun tools/zone-registry/src/check-tasks.ts [--base <ref>] (default: HEAD)
 * Exit 0 = clean; exit 1 = violations listed on stderr.
 */
import { execSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '../../..')

interface Violation {
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

interface DiffStats {
  files: string[]
  shortstat: string
}

function getDiffStats(): DiffStats {
  const files = git(`diff --name-only ${base}`)
    .split('\n')
    .filter(Boolean)
  const shortstat = git(`diff --shortstat ${base}`)
  return { files, shortstat }
}

function getCommitMessage(): string {
  return git('log -1 --format=%B')
}

function isBigChange(stats: DiffStats): string[] {
  const reasons: string[] = []
  if (stats.files.length >= 10) reasons.push(`R1 文件数 ${stats.files.length} >= 10`)

  const insertMatch = stats.shortstat.match(/(\d+) insertions?/)
  const deleteMatch = stats.shortstat.match(/(\d+) deletions?/)
  const totalLines =
    (insertMatch ? parseInt(insertMatch[1], 10) : 0) +
    (deleteMatch ? parseInt(deleteMatch[1], 10) : 0)
  if (totalLines >= 200) reasons.push(`R2 变更行数 ${totalLines} >= 200`)

  const narrativeChanged = stats.files.some(
    (f) =>
      /^docs\/rebuild\/0[0-4]-.*\.md$/.test(f) ||
      /^docs\/rebuild\/05-process\.md$/.test(f) ||
      /^docs\/rebuild\/README\.md$/.test(f) ||
      /^docs\/rebuild\/tracker\.md$/.test(f) ||
      /^docs\/rebuild\/spikes\/.*\.zh\.md$/.test(f)
  )
  if (narrativeChanged) reasons.push('R3 命中 docs/rebuild/*.md 叙事文档')

  const recordsChanged = stats.files.some((f) => /^docs\/rebuild\/records\/.*\.md$/.test(f))
  if (recordsChanged) reasons.push('R4 命中 docs/rebuild/records/*.md')

  return reasons
}

function main(): void {
  const stats = getDiffStats()
  if (stats.files.length === 0) {
    console.log('check-tasks: 无变更，跳过')
    process.exit(0)
  }

  const commitMsg = getCommitMessage()
  const hasExemption = /\[no-task-plan\]/i.test(commitMsg)

  const reasons = isBigChange(stats)
  if (reasons.length === 0) {
    console.log(`check-tasks: ${stats.files.length} 文件变更（小改动，无需 task 计划）`)
    process.exit(0)
  }

  // 检查 task 计划指针：commit message 含 task: T<NN> / [BIG] / tracker.md §2
  const taskRefMatch = commitMsg.match(/\btask:\s*T?(\d+)/i) || commitMsg.match(/\[BIG\]/i) || /tracker\.md\s+§\s*2/i.test(commitMsg)
  const taskId = taskRefMatch ? (commitMsg.match(/T?(\d+)/)?.[1] ?? null) : null

  if (hasExemption) {
    console.log(`check-tasks: 大改动命中（${reasons.join(' / ')}），但 [no-task-plan] 例外`)
    process.exit(0)
  }

  const violations: Violation[] = []

  if (!taskRefMatch) {
    violations.push({
      rule: 'big-change-task-pointer',
      message: `检测到大改动（${reasons.join(' / ')}），但 commit message 无 task 计划指针。

要求（[05-process.md §3.2](05-process.md) + D11 + D12）：
- commit message 必须含 \`task: T<NN>\` / \`[BIG]\` / 或指向 tracker.md §2 任务表的引用
- 同时必须创建/更新 \`tasks/T<NN>-<slug>.md\`（task 计划文档，承载计划 + 自检 + 核验三件套）

例外：在 commit message 加 \`[no-task-plan]\` tag（限 owner 标注，**仅限紧急 CI 红修复**）。`,
    })
  }

  // 检查 tasks/T<id>-*.md 是否在本次 commit 里被创建或更新
  if (taskId) {
    const taskFilePattern = new RegExp(`^docs/rebuild/tasks/T${taskId}-[^/]+\\.md$`)
    const taskFileChanged = stats.files.some((f) => taskFilePattern.test(f))
    if (!taskFileChanged) {
      violations.push({
        rule: 'big-change-task-file',
        message: `commit message 引用 T${taskId}，但本次 commit 不包含 \`tasks/T${taskId}-*.md\` 的创建或更新。请同步提交 task 计划文档。`,
      })
    }
  }

  if (violations.length === 0) {
    console.log(`check-tasks: 大改动（${reasons.join(' / ')}），task 计划指针 + 文档存在`)
    process.exit(0)
  }

  console.error(`check-tasks: ${violations.length} 处违规`)
  for (const v of violations) {
    console.error(`  [${v.rule}] ${v.message}`)
  }
  process.exit(1)
}

main()
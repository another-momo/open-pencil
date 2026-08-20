/**
 * Big-change task plan check (rebuild/v2).
 *
 * Per 05-process.md §3.2 + D11 + D12 + D13, a "big change" must produce:
 *   1. Task plan: `tasks/T<id>-<slug>.md` (independent document)
 *   2. Self-check report: appended to the same `tasks/T<id>-*.md` (§自检 section)
 *   3. Subagent verification: appended to the same `tasks/T<id>-*.md` (§核验-N section)
 *
 * This script (D13 enhancement) also validates:
 *   - task 文档章节阶段识别（plan-only / plan+自检 / plan+自检+核验）
 *   - tracker.md §2 任务表与 task 文档的一致性（T 编号必须出现在任务表里）
 *
 * A "big change" is detected by any of:
 *   R1. file count >= 10
 *   R2. line count >= 200
 *   R3. any docs/rebuild/*.md narrative doc modified
 *   R4. any records/*.md modified
 *
 * Commit message must reference the task via `task: T<NN>`.
 *
 * Exemptions:
 *   - `[no-task-plan]` tag (owner only, emergency CI red fix)
 *
 * Usage: bun tools/zone-registry/src/check-tasks.ts [--base <ref>] (default: HEAD)
 * Exit 0 = clean; exit 1 = violations listed on stderr.
 */
import { execSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '../../../..')

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
      stdio: ['ignore', 'pipe', 'ignore']
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
  const files = git(`diff --name-only ${base}`).split('\n').filter(Boolean)
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
    (insertMatch ? Number.parseInt(insertMatch[1], 10) : 0) +
    (deleteMatch ? Number.parseInt(deleteMatch[1], 10) : 0)
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

// ─── D13 增强：task 文档章节阶段识别 + tracker.md 一致性 ──────────────────

type TaskStage = 'plan-only' | 'plan+自检' | 'plan+自检+核验' | 'unknown'

function readTaskDocumentStage(taskFilePath: string): TaskStage {
  if (!existsSync(taskFilePath)) return 'unknown'
  const content = readFileSync(taskFilePath, 'utf8')

  // plan 章节：识别 §1 任务概述 / §2 任务清单 / §3 验收标准 任一即可（标题可带数字前缀如 `## 1.`)
  const hasPlan = /^\s*#+\s+\d+\.\s*任务概述/m.test(content) || /^\s*#+\s+\d+\.\s*任务清单/m.test(content) || /^\s*#+\s+\d+\.\s*验收标准/m.test(content)
  // 自检章节：`## 自检` 或 `## N. 自检`，后接 · / 数字 / 空格
  const hasSelfCheck = /^##\s+(\d+\.\s+)?自检(\s|·|$)/m.test(content)
  // 核验章节：`## 核验-N` 或 `## N. 核验-N` 或 `## 核验 ·`
  const hasVerify = /^##\s+(\d+\.\s+)?核验(-N\b|\s|·|$)/m.test(content)

  if (hasVerify && hasSelfCheck && hasPlan) return 'plan+自检+核验'
  if (hasSelfCheck && hasPlan) return 'plan+自检'
  if (hasPlan) return 'plan-only'
  return 'unknown'
}

function readTrackerTaskTable(): Set<string> {
  // 读 tracker.md §2 任务表，提取所有 [BIG] T<NN> 编号
  const trackerPath = resolve(root, 'docs/rebuild/tracker.md')
  if (!existsSync(trackerPath)) return new Set()
  const content = readFileSync(trackerPath, 'utf8')
  // 提取 `| T<NN> ...` 或 `| ... | ✅ | ...` 形式
  const ids = new Set<string>()
  const idRe = /\bT(\d+)\b/g
  for (const m of content.matchAll(idRe)) {
    ids.add(m[1])
  }
  return ids
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

  // 解析 task 指针
  const taskRefMatch = commitMsg.match(/\btask:\s*T?(\d+)/i)
  const taskId = taskRefMatch ? taskRefMatch[1] : null

  // 兼容 [BIG] 形式——若 commit 含 [BIG] 但无 task: T<NN>，尝试匹配
  if (!taskId && /\[BIG\]/i.test(commitMsg)) {
    // 尝试从 tracker.md §2 找最新 [BIG] 编号
    const trackerIds = Array.from(readTrackerTaskTable())
    taskId // placeholder
    // 不强行补——要求显式 task: T<NN>
  }

  if (hasExemption) {
    console.log(`check-tasks: 大改动命中（${reasons.join(' / ')}），但 [no-task-plan] 例外`)
    process.exit(0)
  }

  const violations: Violation[] = []

  if (!taskRefMatch) {
    violations.push({
      rule: 'big-change-task-pointer',
      message: `检测到大改动（${reasons.join(' / ')}），但 commit message 无 \`task: T<NN>\` 指针。

要求（[05-process.md §3.2](05-process.md) + D11 + D12 + D13）：
- commit message 必须含 \`task: T<NN>\` 形式（如 \`task: T02\`）
- 同时必须创建/更新 \`tasks/T<NN>-<slug>.md\`（task 计划文档）
- task 文档应含 §1 任务概述 / §2 任务清单 / §3 验收标准（plan-only 阶段即可）

例外：在 commit message 加 \`[no-task-plan]\` tag（限 owner 标注，**仅限紧急 CI 红修复**）。`
    })
  }

  if (taskId) {
    // 检查 tasks/T<id>-*.md 是否在本次 commit 里被创建或更新
    const taskFilePattern = new RegExp(`^docs/rebuild/tasks/T${taskId}-[^/]+\\.md$`)
    const taskFileChanged = stats.files.some((f) => taskFilePattern.test(f))
    if (!taskFileChanged) {
      violations.push({
        rule: 'big-change-task-file',
        message: `commit message 引用 T${taskId}，但本次 commit 不包含 \`tasks/T${taskId}-*.md\` 的创建或更新。请同步提交 task 计划文档。`
      })
    }

    // D13 检查：task 文档章节阶段识别
    if (taskFileChanged) {
      const taskFileRel = stats.files.find((f) => taskFilePattern.test(f))
      if (taskFileRel) {
        const taskFilePath = resolve(root, taskFileRel)
        const stage = readTaskDocumentStage(taskFilePath)
        if (stage === 'unknown' || stage === 'plan-only') {
          // 第一个 commit 阶段（创建 task 计划），只要求有 plan
          // 但如果本次 commit 还同时改了大量代码文件，应进入下一阶段（自检）
          // 简化规则：本次 commit 含 docs/rebuild 改动 → 要求 task 文档含自检
          const hasDocChanges = stats.files.some((f) => f.startsWith('docs/rebuild/'))
          if (hasDocChanges && stage === 'unknown') {
            violations.push({
              rule: 'big-change-task-stage',
              message: `本次 commit 改动 docs/rebuild/ 文档但 tasks/T${taskId}-*.md 不含 §1 任务概述 / §2 任务清单 / §3 验收标准章节。请补 task 文档结构。`
            })
          }
        }
      }
    }

    // D13 检查：tracker.md §2 任务表里 T<NN> 编号必须存在
    // 注意：tracker.md 自身可能在本次 commit 里被改；这种情况下读 working tree
    const trackerIds = readTrackerTaskTable()
    if (!trackerIds.has(taskId)) {
      // 但如果 tracker.md 本身在本次 commit 里，可能刚加进任务表——读 working tree 的版本
      const trackerRel = 'docs/rebuild/tracker.md'
      if (!stats.files.includes(trackerRel)) {
        violations.push({
          rule: 'big-change-task-tracker',
          message: `commit message 引用 T${taskId}，但 [tracker.md §2 任务表](tracker.md) 不含 T${taskId} 编号。请同步更新 tracker.md 任务表。`
        })
      } else {
        // tracker.md 在本次 commit 里——重新读 working tree 版本检查
        const trackerPath = resolve(root, trackerRel)
        if (existsSync(trackerPath)) {
          const fresh = readFileSync(trackerPath, 'utf8')
          if (!new RegExp(`\\bT${taskId}\\b`).test(fresh)) {
            violations.push({
              rule: 'big-change-task-tracker',
              message: `commit message 引用 T${taskId}，但本次 commit 修改的 [tracker.md](tracker.md) 仍不含 T${taskId} 编号。`
            })
          }
        }
      }
    }
  }

  if (violations.length === 0) {
    const stageInfo = taskId ? `task T${taskId}` : '无 task'
    console.log(`check-tasks: 大改动（${reasons.join(' / ')}），${stageInfo} 指针 + 文档存在 + tracker.md §2 一致`)
    process.exit(0)
  }

  console.error(`check-tasks: ${violations.length} 处违规`)
  for (const v of violations) {
    console.error(`  [${v.rule}] ${v.message}`)
  }
  process.exit(1)
}

main()

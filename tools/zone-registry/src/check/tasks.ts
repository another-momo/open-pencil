/**
 * Big-change task plan check (rebuild/v2) — D15 rewrite.
 *
 * Per 05-process.md §3.2 + D11 + D12 + D13 + D15, a "big change" must produce:
 *   1. Task plan:       tasks/T<NN>-plan.md (independent document)
 *   2. Self-check:      tasks/T<NN>-self-check.md (independent document)
 *   3. Subagent verify: tasks/T<NN>-verify.md (independent document)
 *
 * D15: 三件套物理拆分 + 任务表路径检查。任务表（tracker.md §2 / _index.md §2）
 * 填三件套相对路径列，CI 用 `existsSync` 检查三文件存在。零正则、零章节、
 * 零语义判定——三件套齐不齐一目了然。
 *
 * D19 (T09): 占位检测。existsSync 只能查存在、查不了"实做"——T06/T07 的
 * verify.md 曾是全占位模板（"（待 subagent 填）"）而 self-check 声称核验已做。
 * 对 commit 引用 task 的 self-check / verify 做占位标记扫描，命中即拒收。
 * 模式集刻意收窄到模板词汇，避免误伤"（待拍板）"等合法散文。
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

// ─── D15：任务表路径列解析 ────────────────────────────────────────────────

interface TaskTableRow {
  id: string
  plan: string
  selfCheck: string
  verify: string
  /** Optional — row 状态列（✅ / 🔄 / ⬜） */
  status?: string
}

const TASK_TABLE_FILES = ['docs/rebuild/tracker.md', 'docs/rebuild/tasks/_index.md']

/**
 * 读任务表，解析每行的 T 编号 + plan / self-check / verify 三列路径。
 * 路径列匹配 `](路径)` 形式——markdown 链接的目标，提取括号内相对路径。
 * 兼容两种表格写法：
 *   1. `| T03 | ... | [T03](tasks/T03-plan.md) | [T03](tasks/T03-self-check.md) | [T03](tasks/T03-verify.md) |`
 *   2. `| T03 | ... | tasks/T03-plan.md | tasks/T03-self-check.md | tasks/T03-verify.md |`
 */
function readTaskTable(): Map<string, TaskTableRow> {
  const rows = new Map<string, TaskTableRow>()

  for (const rel of TASK_TABLE_FILES) {
    const p = resolve(root, rel)
    if (!existsSync(p)) continue
    const content = readFileSync(p, 'utf8')

    // 按行解析表格
    for (const line of content.split('\n')) {
      // 跳过表头分隔行（|---|）
      if (/^\s*\|[\s-:|]+\|\s*$/.test(line)) continue
      // 必须含 | 分隔
      if (!line.includes('|')) continue

      const cells = line
        .split('|')
        .map((c) => c.trim())
        .filter((c, i, arr) => i > 0 && i < arr.length - 1) // 去掉首尾空 cell

      if (cells.length < 4) continue

      // 第一列匹配 T<NN>
      const idMatch = cells[0].match(/\bT(\d{2,})\b/)
      if (!idMatch) continue
      const id = idMatch[1]

      // 后三列必须是 tasks/T<id>-{plan,self-check,verify}.md 形式
      const plan = extractPathFromCell(cells[cells.length - 3])
      const selfCheck = extractPathFromCell(cells[cells.length - 2])
      const verify = extractPathFromCell(cells[cells.length - 1])

      if (!plan || !selfCheck || !verify) continue
      if (!plan.includes(`T${id}-plan`)) continue
      if (!selfCheck.includes(`T${id}-self-check`)) continue
      if (!verify.includes(`T${id}-verify`)) continue

      rows.set(id, { id, plan, selfCheck, verify })
    }
  }
  return rows
}

/** 从单元格提取 markdown 链接目标或纯路径。返回相对 docs/rebuild/ 的路径（去掉 `../` 前缀）。 */
function extractPathFromCell(cell: string): string | null {
  let raw: string | null = null
  // 形如 `[T03](tasks/T03-plan.md)` 或 `[T03](../tasks/T03-plan.md)`
  const linkMatch = cell.match(/\]\(([^)]+)\)/)
  if (linkMatch) raw = linkMatch[1].trim()
  // 形如 `tasks/T03-plan.md` 或 `../tasks/T03-plan.md`
  if (!raw) {
    const pathMatch = cell.match(/(\.\.\/)?(tasks\/T\d{2,}-[a-z-]+\.md)/)
    if (pathMatch) raw = pathMatch[2]
  }
  if (!raw) return null
  // 规范化：相对 docs/rebuild/（tracker.md 视角用 `tasks/`；_index.md 视角用 `../tasks/` → 统一去掉 `../`）
  return raw.replace(/^\.\.\//, '')
}

// ─── 检查函数 ─────────────────────────────────────────────────────────────

function checkPointer(commitMsg: string, reasons: string[]): Violation[] {
  const taskRefMatch = commitMsg.match(/\btask:\s*T?(\d+)/i)
  if (taskRefMatch) return []
  return [
    {
      rule: 'big-change-task-pointer',
      message: `检测到大改动（${reasons.join(' / ')}），但 commit message 无 \`task: T<NN>\` 指针。

要求（[05-process.md §3.2](05-process.md) + D11 + D12 + D13 + D15）：
- commit message 必须含 \`task: T<NN>\` 形式（如 \`task: T02\`）
- 同时必须创建/更新 \`tasks/T<NN>-plan.md\`（task 计划文档）

例外：在 commit message 加 \`[no-task-plan]\` tag（限 owner 标注，**仅限紧急 CI 红修复**）。`
    }
  ]
}

function checkThreePieceExists(taskId: string, row: TaskTableRow | undefined): Violation[] {
  const violations: Violation[] = []
  if (!row) {
    violations.push({
      rule: 'big-change-task-table-missing',
      message: `commit message 引用 T${taskId}，但任务表（[tracker.md §2](../tracker.md) 或 [tasks/_index.md §2](_index.md)）中没有 T${taskId} 行，**或行内三件套路径列格式不对**。

要求（D15）：
- 任务表 T${taskId} 行必须含 plan / self-check / verify 三列
- 三列路径形如 \`tasks/T${taskId}-plan.md\` / \`tasks/T${taskId}-self-check.md\` / \`tasks/T${taskId}-verify.md\`
- 路径可以用 markdown 链接 \`[T${taskId}](tasks/T${taskId}-plan.md)\` 或纯路径形式
- **物理文件必须存在**：CI 用 \`existsSync\` 逐个检查，缺一个就拒`
    })
    return violations
  }

  for (const [label, rel] of [
    ['plan', row.plan],
    ['self-check', row.selfCheck],
    ['verify', row.verify]
  ] as const) {
    const abs = resolve(root, 'docs/rebuild', rel)
    if (!existsSync(abs)) {
      violations.push({
        rule: `big-change-task-${label}-missing`,
        message: `T${taskId} 三件套缺 \`${label}\`：任务表登记路径 \`${rel}\`，但文件不存在。

要求（D15）：
- 三件套物理拆分：plan / self-check / verify 三个独立 .md 文件
- 任务表填三列路径，CI 用 \`existsSync\` 检查
- 缺一不可`
      })
    }
  }
  return violations
}

// ─── D19：占位检测（05-process.md §4.11「禁止占位」的机器化）────────────────

/**
 * 占位模板词汇，刻意收窄以避免误伤"（待拍板）"等合法散文：
 *   （待）/（待）        —— 模板里的空待办括号
 *   （待 subagent…      —— "（待 subagent 填）" "（待 subagent 验证）" 等
 *   待 owner 触发        —— D15 明文禁止的占位句
 */
const PLACEHOLDER_RE = /（待[)）]|（待\s*subagent|待\s*owner\s*触发/

function checkNoPlaceholder(taskId: string, row: TaskTableRow): Violation[] {
  const violations: Violation[] = []
  for (const [label, rel] of [
    ['self-check', row.selfCheck],
    ['verify', row.verify]
  ] as const) {
    const abs = resolve(root, 'docs/rebuild', rel)
    if (!existsSync(abs)) continue // 缺失由 checkThreePieceExists 报告
    const content = readFileSync(abs, 'utf8')
    const hit = content.match(PLACEHOLDER_RE)
    if (hit) {
      violations.push({
        rule: `big-change-task-${label}-placeholder`,
        message: `T${taskId} 的 ${label}（\`${rel}\`）含占位标记 \`${hit[0]}\`——占位核验/占位自检违反 05-process.md §4.11（D15/D19）。

要求：
- verify.md 必须是 subagent 实做核验后的实测值填报，不允许"（待 subagent 填）"类模板
- self-check.md 完成度必须实时期更新，不允许"待 owner 触发核验"
- 主 agent 主动派单核验，不依赖 owner 触发`
      })
    }
  }
  return violations
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

  if (hasExemption) {
    console.log(`check-tasks: 大改动命中（${reasons.join(' / ')}），但 [no-task-plan] 例外`)
    process.exit(0)
  }

  const taskRefMatch = commitMsg.match(/\btask:\s*T?(\d+)/i)
  const taskId = taskRefMatch ? taskRefMatch[1] : null
  const taskTable = readTaskTable()

  const violations: Violation[] = [...checkPointer(commitMsg, reasons)]

  if (taskId) {
    const row = taskTable.get(taskId)
    violations.push(...checkThreePieceExists(taskId, row))
    if (row) violations.push(...checkNoPlaceholder(taskId, row))
  }

  if (violations.length === 0) {
    const stageInfo = taskId ? `task T${taskId}` : '无 task'
    console.log(
      `check-tasks: 大改动（${reasons.join(' / ')}），${stageInfo} 三件套（plan / self-check / verify）齐全`
    )
    process.exit(0)
  }

  console.error(`check-tasks: ${violations.length} 处违规`)
  for (const v of violations) {
    console.error(`  [${v.rule}] ${v.message}`)
  }
  process.exit(1)
}

main()

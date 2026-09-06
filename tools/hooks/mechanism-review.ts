#!/usr/bin/env bun
/**
 * Mechanism review reminder hook (rebuild/v2, 2026-09-06).
 *
 * Tracks when the governing mechanism (zones.json / patches / tarball /
 * relocations / etc.) was last reviewed, and reminds on stale state.
 *
 * Marker file path: <git-common-dir>/mechanism-review
 *   - git-common-dir = absolute path to .git (or .git dir under worktrees)
 *   - file content: <SHA>|<ISO date>
 *   - SHA = HEAD at review time (no branch dependency)
 *
 * Default (no args / `check`):
 *   - marker missing → silently write current HEAD + today, exit 0
 *     (first run after install does not nag)
 *   - marker present → compute commit count between marker SHA and HEAD;
 *     if either threshold hit (>= 20 commits OR >= 30 days), print a
 *     prominent Chinese reminder to stderr; always exit 0 (advisory,
 *     never blocks)
 *   - any error → swallow and exit 0 (advisory never breaks the commit)
 *
 * `mark` subcommand:
 *   - unconditionally write `<HEAD SHA>|<ISO date>` to marker, exit 0
 *
 * Usage:
 *   bun tools/hooks/mechanism-review.ts          # check (default)
 *   bun tools/hooks/mechanism-review.ts check    # same as above
 *   bun tools/hooks/mechanism-review.ts mark     # reset the marker
 *
 * Wired into tools/hooks/post-commit (added 2026-09-06).
 */

import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const COMMIT_THRESHOLD = 20
const DAY_THRESHOLD = 30

function git(args: string[]): string {
  try {
    return execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()
  } catch {
    return ''
  }
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

function markerPath(): string {
  const commonDir = git(['rev-parse', '--git-common-dir'])
  if (!commonDir) return ''
  return join(commonDir, 'mechanism-review')
}

function currentHead(): string {
  return git(['rev-parse', 'HEAD'])
}

function commitCountBetween(shaA: string, shaB: string): number {
  const out = git(['rev-list', '--count', `${shaA}..${shaB}`])
  if (!out) return 0
  const n = Number(out)
  return Number.isFinite(n) ? n : 0
}

function daysBetween(isoA: string, isoB: string): number {
  const a = new Date(isoA + 'T00:00:00Z').getTime()
  const b = new Date(isoB + 'T00:00:00Z').getTime()
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 0
  return Math.floor(Math.abs(b - a) / 86_400_000)
}

function runCheck(): void {
  const marker = markerPath()
  if (!marker) {
    // not in a git repo or git unavailable — silent, never block
    return
  }
  if (!existsSync(marker)) {
    // First run: silently seed the marker
    const head = currentHead()
    if (!head) return
    try {
      writeFileSync(marker, `${head}|${todayIso()}\n`, 'utf8')
    } catch {
      // cannot write — exit silently
    }
    return
  }
  let raw = ''
  try {
    raw = readFileSync(marker, 'utf8')
  } catch {
    return
  }
  const [markerSha, markerDate] = raw.trim().split('|')
  if (!markerSha || !markerDate) {
    // malformed — silently re-seed
    const head = currentHead()
    if (head) {
      try {
        writeFileSync(marker, `${head}|${todayIso()}\n`, 'utf8')
      } catch {
        /* noop */
      }
    }
    return
  }
  const head = currentHead()
  if (!head) return
  const commitCount = commitCountBetween(markerSha, head)
  const dayCount = daysBetween(markerDate, todayIso())
  if (commitCount < COMMIT_THRESHOLD && dayCount < DAY_THRESHOLD) return

  // Threshold hit → prominent reminder
  const which: string[] = []
  if (commitCount >= COMMIT_THRESHOLD) which.push(`${commitCount} commits ≥ ${COMMIT_THRESHOLD}`)
  if (dayCount >= DAY_THRESHOLD) which.push(`${dayCount} 天 ≥ ${DAY_THRESHOLD} 天`)
  const trigger = which.join('，')
  process.stderr.write(
    [
      '',
      '────────────────────────────────────────────────────────',
      '⚠  机制复盘提醒（mechanism-review.ts）',
      `触发：${trigger}`,
      `上次复盘：${markerSha.slice(0, 8)} @ ${markerDate}`,
      `当前 HEAD：${head.slice(0, 8)}`,
      '',
      `距上次复盘 ${dayCount} 天 / ${commitCount} commits。`,
      '请审视：',
      '  - zones.json（patches / ownedFiles / stubs / deletedPaths /',
      '    upstreamMergeTarball / relocations）是否仍反映现状？',
      '  - docs/rebuild 已冻结于 docs/archive/rebuild-campaign，是否仍',
      '    有引用旧路径的活脚本/文档需要机械更新？',
      '  - check:tasks / check:docs 已退役（2026-09-06），遗留脚本/钩',
      '    子/文档是否仍有活调用需要清理？',
      '  - 仓外 BOARD.md 决策 log 三问剪枝：已沉淀进仓外 AGENTS.md？',
      '    仍影响当前或将开工的工作？皆否则删（历史在仓外 git log）。',
      '    仅在本工作台布局下适用，外部 clone 忽略本条。',
      '  - 是否有新的机制类需求应当纳入 review（如本文钩自身）？',
      '',
      '复盘后运行：bun tools/hooks/mechanism-review.ts mark',
      '────────────────────────────────────────────────────────',
      ''
    ].join('\n')
  )
}

function runMark(): void {
  const marker = markerPath()
  if (!marker) return
  const head = currentHead()
  if (!head) return
  try {
    writeFileSync(marker, `${head}|${todayIso()}\n`, 'utf8')
    process.stdout.write(`[mechanism-review] marker reset → ${head.slice(0, 8)} @ ${todayIso()}\n`)
  } catch {
    // silent
  }
}

function main(): void {
  const sub = process.argv[2] ?? 'check'
  if (sub === 'mark') {
    runMark()
    return
  }
  // default + explicit `check` both call runCheck
  runCheck()
}

try {
  main()
} catch {
  // advisory never blocks; any uncaught error → exit 0
}
process.exit(0)

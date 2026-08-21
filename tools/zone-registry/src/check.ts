/**
 * Zone registry purity check (rebuild/v2).
 *
 * Verifies the working tree against tools/zone-registry/zones.json:
 *  1. Every upstream file modified vs merge-base is a registered patch
 *     (revoked patches do NOT whitelist).
 *  2. Every deleted upstream file is registered in deletedPaths
 *     (exact match or under a deleted directory prefix).
 *  3. deletedPaths do not exist on disk.
 *  4. New files (added vs merge-base) live under ownedRoots.
 *  5. Renames are decomposed (old path = deletion, new path = addition);
 *     typechanges (T, e.g. symlink→file) count as modifications;
 *     other unexpected git statuses (C/U/…) fail loudly.
 *
 * pendingReclass is planning metadata only (see zones.json $comment):
 * modifications there are governed by rule 1 like everywhere else.
 * LFS fixtures under tests/fixtures/ are covered by rule 1 — the clean
 * filter normalizes real-content-over-pointer to a no-op, while any real
 * content change (e.g. force-added binaries) fails as unregistered.
 *
 * Usage: bun tools/zone-registry/src/check.ts [--base <ref>]  (default base: merge-base with upstream/master)
 * Exit 0 = clean; exit 1 = violations listed on stderr.
 */
import { execSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')

interface Zones {
  ownedRoots: string[]
  ownedFiles: string[]
  stubs: string[]
  pendingReclass: string[]
  patches: { id: string; file: string; reason: string; disposition: string }[]
  deletedPaths: string[]
}

interface Changes {
  modified: string[]
  added: string[]
  deleted: string[]
  violations: string[]
}

function git(args: string[]): string {
  const quoted = args.map((a) => (/\s/.test(a) ? JSON.stringify(a) : a)).join(' ')
  return execSync(`git ${quoted}`, { cwd: root, encoding: 'utf8' }).trim()
}

function resolveBase(): string {
  const baseIdx = process.argv.indexOf('--base')
  if (baseIdx !== -1) return process.argv[baseIdx + 1]
  // In-progress merge: the base is the being-merged head (MERGE_HEAD), not the old
  // merge-base — otherwise every upstream change in flight shows up as an
  // unregistered modification and the merge commit can never pass pre-commit.
  let mergeHead = ''
  try {
    mergeHead = git(['rev-parse', '-q', '--verify', 'MERGE_HEAD'])
  } catch {
    mergeHead = '' // no in-progress merge — rev-parse exits 1
  }
  const base = mergeHead || git(['merge-base', 'HEAD', 'upstream/master'])
  if (!base) {
    console.error('[zones] cannot resolve merge-base with upstream/master')
    process.exit(1)
  }
  return base
}

// Working tree vs base (covers staged + unstaged; untracked handled separately)
function collectChanges(base: string): Changes {
  const changes: Changes = { modified: [], added: [], deleted: [], violations: [] }
  const diff = git(['diff', '--name-status', base, '--'])
  for (const line of diff ? diff.split('\n') : []) {
    const parts = line.split('\t')
    const status = parts[0]
    if (status === 'M' || status === 'T') changes.modified.push(parts[1])
    else if (status === 'A') changes.added.push(parts[1])
    else if (status === 'D') changes.deleted.push(parts[1])
    else if (status.startsWith('R')) {
      changes.deleted.push(parts[1])
      changes.added.push(parts[2])
    } else {
      changes.violations.push(`UNEXPECTED git status "${status}" for ${parts.slice(1).join(' → ')}`)
    }
  }
  const untracked = git(['ls-files', '--others', '--exclude-standard'])
  for (const line of untracked ? untracked.split('\n') : []) {
    if (line) changes.added.push(line)
  }
  return changes
}

function checkModified(zones: Zones, modified: string[]): string[] {
  const patchedFiles = new Set(
    zones.patches.filter((p) => p.disposition !== 'revoked').map((p) => p.file)
  )
  const owned = new Set([...zones.ownedFiles, ...zones.stubs])
  return modified
    .filter((file) => !patchedFiles.has(file) && !owned.has(file))
    .map(
      (file) => `MODIFIED but not registered: ${file} (register a patch in zones.json or revert)`
    )
}

function checkDeletedRegistered(zones: Zones, deleted: string[]): string[] {
  return deleted
    .filter(
      (file) =>
        !zones.deletedPaths.some(
          (d) => file === d || file.startsWith(d.endsWith('/') ? d : `${d}/`)
        )
    )
    .map(
      (file) =>
        `DELETED but not registered: ${file} (add the path to deletedPaths in zones.json or restore)`
    )
}

function checkDeletedAbsent(zones: Zones): string[] {
  return zones.deletedPaths
    .filter((p) => existsSync(resolve(root, p)))
    .map((p) => `DELETED path still exists: ${p}`)
}

function checkAdded(zones: Zones, added: string[]): string[] {
  const owned = new Set([...zones.ownedFiles, ...zones.stubs])
  return added
    .filter((file) => !owned.has(file) && !zones.ownedRoots.some((r) => file.startsWith(r)))
    .map((file) => `ADDED outside ownedRoots: ${file} (add an owned root or move the file)`)
}

function main() {
  const zones: Zones = JSON.parse(
    readFileSync(resolve(root, 'tools/zone-registry/zones.json'), 'utf8')
  )
  const base = resolveBase()
  const changes = collectChanges(base)
  const violations = [
    ...changes.violations,
    ...checkModified(zones, changes.modified),
    ...checkDeletedRegistered(zones, changes.deleted),
    ...checkDeletedAbsent(zones),
    ...checkAdded(zones, changes.added)
  ]

  if (violations.length > 0) {
    console.error(`[zones] ${violations.length} violation(s):`)
    for (const v of violations) console.error(`  - ${v}`)
    process.exit(1)
  }
  console.log(
    `[zones] clean: ${changes.modified.length} modified (all registered), ${changes.added.length} added (owned), ${changes.deleted.length} deleted (all registered), base ${base.slice(0, 8)}`
  )
}

main()

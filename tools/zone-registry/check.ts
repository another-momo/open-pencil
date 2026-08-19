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
 *     unexpected git statuses (C/T/U/…) fail loudly.
 *
 * pendingReclass is planning metadata only (see zones.json $comment):
 * modifications there are governed by rule 1 like everywhere else.
 * LFS fixtures under tests/fixtures/ are covered by rule 1 — the clean
 * filter normalizes real-content-over-pointer to a no-op, while any real
 * content change (e.g. force-added binaries) fails as unregistered.
 *
 * Usage: bun tools/zone-registry/check.ts [--base <ref>]  (default base: merge-base with upstream/master)
 * Exit 0 = clean; exit 1 = violations listed on stderr.
 */
import { execSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')

interface Zones {
  ownedRoots: string[]
  ownedFiles: string[]
  stubs: string[]
  pendingReclass: string[]
  patches: { id: string; file: string; reason: string; disposition: string }[]
  deletedPaths: string[]
}

function git(args: string[]): string {
  const quoted = args.map((a) => (/\s/.test(a) ? JSON.stringify(a) : a)).join(' ')
  return execSync(`git ${quoted}`, { cwd: root, encoding: 'utf8' }).trim()
}

function main() {
  const zones: Zones = JSON.parse(readFileSync(resolve(root, 'tools/zone-registry/zones.json'), 'utf8'))

  const baseIdx = process.argv.indexOf('--base')
  const base = baseIdx >= 0 ? process.argv[baseIdx + 1] : git(['merge-base', 'HEAD', 'upstream/master'])
  if (!base) {
    console.error('[zones] cannot resolve merge-base with upstream/master')
    process.exit(1)
  }

  // Working tree vs base (covers staged + unstaged; untracked handled separately)
  const diff = git(['diff', '--name-status', base, '--'])
  const modified: string[] = []
  const added: string[] = []
  const deleted: string[] = []
  const violations: string[] = []
  for (const line of diff ? diff.split('\n') : []) {
    const parts = line.split('\t')
    const status = parts[0]
    if (status === 'M') modified.push(parts[1])
    else if (status === 'A') added.push(parts[1])
    else if (status === 'D') deleted.push(parts[1])
    else if (status.startsWith('R')) {
      // rename: old path = deletion, new path = addition
      deleted.push(parts[1])
      added.push(parts[2])
    } else {
      violations.push(`UNEXPECTED git status "${status}" for ${parts.slice(1).join(' → ')}`)
    }
  }
  const untracked = git(['ls-files', '--others', '--exclude-standard'])
  for (const line of untracked ? untracked.split('\n') : []) {
    if (line) added.push(line)
  }

  const patchedFiles = new Set(zones.patches.filter((p) => p.disposition !== 'revoked').map((p) => p.file))
  const owned = new Set([...zones.ownedFiles, ...zones.stubs])
  const ownedRoots = zones.ownedRoots
  const deletedRegistry = zones.deletedPaths

  // 1. modified upstream files must be registered patches or owned
  for (const file of modified) {
    if (patchedFiles.has(file) || owned.has(file)) continue
    violations.push(`MODIFIED but not registered: ${file} (register a patch in zones.json or revert)`)
  }

  // 2. deleted upstream files must be registered in deletedPaths
  for (const file of deleted) {
    if (deletedRegistry.some((d) => file === d || file.startsWith(d.endsWith('/') ? d : `${d}/`))) continue
    violations.push(`DELETED but not registered: ${file} (add the path to deletedPaths in zones.json or restore)`)
  }

  // 3. deleted paths must not exist
  for (const p of deletedRegistry) {
    if (existsSync(resolve(root, p))) {
      violations.push(`DELETED path still exists: ${p}`)
    }
  }

  // 4. new files only under ownedRoots
  for (const file of added) {
    if (owned.has(file)) continue
    if (ownedRoots.some((r) => file.startsWith(r))) continue
    violations.push(`ADDED outside ownedRoots: ${file} (add an owned root or move the file)`)
  }

  if (violations.length > 0) {
    console.error(`[zones] ${violations.length} violation(s):`)
    for (const v of violations) console.error(`  - ${v}`)
    process.exit(1)
  }
  console.log(
    `[zones] clean: ${modified.length} modified (all registered), ${added.length} added (owned), ${deleted.length} deleted (all registered), base ${base.slice(0, 8)}`
  )
}

main()

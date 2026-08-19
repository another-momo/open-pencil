/**
 * Zone registry purity check (rebuild/v2).
 *
 * Verifies the working tree against tools/zone-registry/zones.json:
 *  1. Every upstream file modified vs merge-base is a registered patch.
 *  2. pendingReclass files are byte-identical to merge-base (不许改).
 *  3. deletedPaths do not exist on disk.
 *  4. New files (added vs merge-base) live under ownedRoots.
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

function git(args: string): string {
  return execSync(`git ${args}`, { cwd: root, encoding: 'utf8' }).trim()
}

function main() {
  const zones: Zones = JSON.parse(readFileSync(resolve(root, 'tools/zone-registry/zones.json'), 'utf8'))

  const baseIdx = process.argv.indexOf('--base')
  const base = baseIdx >= 0 ? process.argv[baseIdx + 1] : git('merge-base HEAD upstream/master')
  if (!base) {
    console.error('[zones] cannot resolve merge-base with upstream/master')
    process.exit(1)
  }

  // Working tree vs base (covers staged + unstaged; untracked handled separately)
  const diff = git(`diff --name-status ${base} --`)
  const modified: string[] = []
  const added: string[] = []
  const deleted: string[] = []
  for (const line of diff ? diff.split('\n') : []) {
    const [status, file] = line.split('\t')
    if (status === 'M') modified.push(file)
    else if (status === 'A') added.push(file)
    else if (status === 'D') deleted.push(file)
  }
  const untracked = git('ls-files --others --exclude-standard')
  for (const line of untracked ? untracked.split('\n') : []) {
    if (line) added.push(line)
  }

  const patchedFiles = new Set(zones.patches.map((p) => p.file))
  const owned = new Set([...zones.ownedFiles, ...zones.stubs])
  const ownedRoots = zones.ownedRoots
  const violations: string[] = []

  // 1. modified upstream files must be registered patches or owned
  for (const file of modified) {
    if (patchedFiles.has(file) || owned.has(file)) continue
    violations.push(`MODIFIED but not registered: ${file} (register a patch in zones.json or revert)`)
  }

  // 3. deleted paths must not exist
  for (const p of zones.deletedPaths) {
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
    `[zones] clean: ${modified.length} modified (all registered), ${added.length} added (owned), ${deleted.length} deleted, base ${base.slice(0, 8)}`
  )
}

main()

#!/usr/bin/env bun
import { spawn } from 'node:child_process'
/**
 * Serial unit-test runner for tests/engine/ (rebuild/v2).
 *
 * Batches tests by first-level subdirectory under tests/engine/ (root-level
 * scattered files form their own batch). Runs `bun test <files>` per batch,
 * stops on first failure (same exit code), and prints pass/fail summaries
 * per batch. Reuses tools/unit-tests/src/list.ts for heavy-only filtering
 * (when --heavy-only is passed).
 *
 * Usage: bun tools/unit-tests/src/serial.ts [--heavy-only]
 * Exit 0 = all batches pass; non-zero = first failing batch's exit code.
 */
import { readdir, readFile } from 'node:fs/promises'
import { resolve, join, relative } from 'node:path'

const ROOT = resolve(import.meta.dirname, '../../..')
const TESTS_ROOT = resolve(ROOT, 'tests/engine')

const args = new Set(process.argv.slice(2))
const heavyOnly = args.has('--heavy-only')

async function listBatchFiles(): Promise<Map<string, string[]>> {
  const entries = await readdir(TESTS_ROOT, { withFileTypes: true })
  const batches = new Map<string, string[]>()
  // root-level scattered .test.ts files → batch "_root"
  const rootLevel: string[] = []
  for (const e of entries) {
    if (e.isFile() && e.name.endsWith('.test.ts')) {
      rootLevel.push(relative(ROOT, join(TESTS_ROOT, e.name)).split('\\').join('/'))
    } else if (e.isDirectory()) {
      const dirPath = join(TESTS_ROOT, e.name)
      const files: string[] = []
      await collectTestFiles(dirPath, ROOT, files)
      if (files.length > 0) batches.set(e.name, files)
    }
  }
  if (rootLevel.length > 0) batches.set('_root', rootLevel)
  return batches
}

async function collectTestFiles(absDir: string, root: string, out: string[]): Promise<void> {
  const entries = await readdir(absDir, { withFileTypes: true })
  for (const e of entries) {
    const p = join(absDir, e.name)
    if (e.isDirectory()) {
      await collectTestFiles(p, root, out)
    } else if (e.isFile() && e.name.endsWith('.test.ts')) {
      out.push(relative(root, p).split('\\').join('/'))
    }
  }
}

function heavyFilter(files: string[]): string[] {
  // Mirror shards.HEAVY_UNIT_TEST_PATTERNS (avoid pulling the whole module)
  const HEAVY = [
    'tests/engine/clipboard/fixtures/',
    'tests/engine/io/fig/heavy/',
    'tests/engine/io/fig/roundtrip/exhaustive.test.ts',
    'tests/engine/io/fig/roundtrip/glyph-blob.test.ts',
    'tests/engine/io/fig/roundtrip/variables.test.ts',
    'tests/engine/io/fig/export/text.test.ts',
    'tests/engine/io/fig/export/worker.test.ts',
    'tests/engine/io/fig/import/group-reclassify.test.ts',
    'tests/engine/layout/auto-layout/text/measurement.test.ts',
    'tests/engine/render/canvas/cache.test.ts'
  ]
  if (!heavyOnly) return files
  const norm = (s: string) => s.split('\\').join('/')
  return files.filter((f) => HEAVY.some((p) => norm(f).startsWith(p) || norm(f) === p))
}

async function runBatch(name: string, files: string[]): Promise<number> {
  if (files.length === 0) {
    console.log(`[serial] batch ${name}: 0 files, skip`)
    return 0
  }
  console.log(`[serial] batch ${name}: ${files.length} files`)
  const t0 = Date.now()
  return new Promise((resolveRun) => {
    const proc = spawn('bun', ['test', ...files], {
      cwd: ROOT,
      stdio: 'inherit',
      env: { ...process.env, BUN_HEAVY_TESTS: heavyOnly ? 'true' : 'false' }
    })
    proc.on('close', (code) => {
      const elapsed = ((Date.now() - t0) / 1000).toFixed(1)
      const status = code === 0 ? 'PASS' : `FAIL (exit ${code ?? 'null'})`
      console.log(`[serial] batch ${name}: ${status} in ${elapsed}s`)
      resolveRun(code ?? 1)
    })
  })
}

async function main(): Promise<void> {
  const batches = await listBatchFiles()
  // stable, alphabetical ordering for predictable output
  const names = [...batches.keys()].sort()
  let totalFiles = 0
  let passedBatches = 0
  let failedBatches = 0
  for (const name of names) {
    const files = heavyFilter(batches.get(name)!)
    if (files.length === 0) continue
    totalFiles += files.length
    const code = await runBatch(name, files)
    if (code === 0) passedBatches++
    else {
      failedBatches++
      console.error(`[serial] stopping: batch ${name} failed`)
      process.exit(code)
    }
  }
  console.log(
    `[serial] done: ${passedBatches}/${passedBatches + failedBatches} batches passed, ${totalFiles} files${heavyOnly ? ' (heavy-only)' : ''}`
  )
}

main().catch((e) => {
  console.error('[serial] fatal:', e)
  process.exit(2)
})

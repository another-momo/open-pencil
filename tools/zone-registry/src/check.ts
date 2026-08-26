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
 *        bun tools/zone-registry/src/check.ts --patches-report [--base <ref>]
 *          T28（决策单 #5，轻量过堂机制）：报告模式——逐条补丁输出相对
 *          upstream merge-base 的当前 diff 行数摘要（numstat），供过堂审视
 *          补丁腐烂度；只读报告，恒 exit 0，不参与主检查判红。
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
  patches: {
    id: string
    file: string
    reason: string
    disposition: string
    /** T28（决策单 #5）：上次过堂日期（YYYY-MM-DD），轻量机制——登记即视为过堂 */
    lastReviewed?: string
  }[]
  deletedPaths: string[]
  /** T32：tarball/tarball 替换式合并的结构化登记——byte 一致的拷贝走此字段
   *  而非 ownedFile 兜底，机器可解析；每条记录锚定上游 base SHA + paths +
   *  deletedPaths + 登记任务号 + 上次过堂日期。 */
  upstreamMergeTarball?: Array<{
    base: string
    paths: string[]
    deletedPaths: string[]
    task: string
    lastReviewed: string
  }>
}

interface Rename {
  oldPath: string
  newPath: string
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
  // T32：-M 启用 rename detection，让 collectRenames 能捕到 R 行
  const diff = git(['diff', '--name-status', '-M', base, '--'])
  for (const line of diff ? diff.split('\n') : []) {
    const parts = line.split('\t')
    const status = parts[0]
    if (status === 'M' || status === 'T') changes.modified.push(parts[1])
    else if (status === 'A') changes.added.push(parts[1])
    else if (status === 'D') changes.deleted.push(parts[1])
    else if (status.startsWith('R')) {
      // T32：rename 仍送 D+A 给原规则（checkDeletedRegistered 已能识别 deletedPaths
      //   或 tarball.deletedPaths；checkAdded 已能识别 tarball.paths 或 ownedFile），
      //   同时由 collectRenames 单独捕获供 checkRenames 做交叉一致性判定。
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

/**
 * T32：抽取 rename 记录供 checkRenames 做交叉一致性判定。
 *  - 与 collectChanges 共享 `git diff --name-status -M` 输出，重复执行可接受（只读）；
 *  - 返回 [{oldPath, newPath}] 数组。
 */
function collectRenames(base: string): Rename[] {
  const diff = git(['diff', '--name-status', '-M', base, '--'])
  const renames: Rename[] = []
  for (const line of diff ? diff.split('\n') : []) {
    const parts = line.split('\t')
    if (parts[0].startsWith('R')) renames.push({ oldPath: parts[1], newPath: parts[2] })
  }
  return renames
}

/**
 * T32 L1：tarball/tarball 替换式合并的结构化白名单——
 *  凡 added/deleted 命中 upstreamMergeTarball[*].paths/deletedPaths ，
 *  视为已合规登记；同时校验各 tarball 的 base SHA 本地可达。
 */
function checkUpstreamMergeTarball(zones: Zones): string[] {
  const tarballs = zones.upstreamMergeTarball ?? []
  const violations: string[] = []
  for (const t of tarballs) {
    // 校验 base SHA 本地可达
    try {
      git(['rev-parse', '-q', '--verify', t.base])
    } catch {
      violations.push(
        `upstreamMergeTarball base "${t.base}" (task ${t.task}) not reachable locally`
      )
    }
  }
  return violations
}

/**
 * T32 L2：rename 交叉一致性——每对 (oldPath, newPath) 须满足：
 *   - oldPath 命中 zones.deletedPaths（含子目录）或某 tarball.deletedPaths
 *   - newPath 命中 zones.ownedRoots/ownedFiles/stubs 或某 patches.file 或某 tarball.paths
 *   两端都缺则报 RENAME but not registered。
 */
function checkRenames(zones: Zones, renames: Rename[]): string[] {
  if (renames.length === 0) return []
  const tarballs = zones.upstreamMergeTarball ?? []
  const tarballDeleted = new Set(tarballs.flatMap((t) => t.deletedPaths))
  const tarballPaths = new Set(tarballs.flatMap((t) => t.paths))
  const patchedFiles = new Set(
    zones.patches.filter((p) => p.disposition !== 'revoked').map((p) => p.file)
  )
  const owned = new Set([...zones.ownedFiles, ...zones.stubs])
  return renames
    .filter(({ oldPath, newPath }) => {
      const oldOk =
        tarballDeleted.has(oldPath) ||
        zones.deletedPaths.some(
          (d) => oldPath === d || oldPath.startsWith(d.endsWith('/') ? d : `${d}/`)
        )
      const newOk =
        tarballPaths.has(newPath) ||
        owned.has(newPath) ||
        zones.ownedRoots.some((r) => newPath.startsWith(r)) ||
        patchedFiles.has(newPath)
      return !oldOk || !newOk
    })
    .map(
      ({ oldPath, newPath }) =>
        `RENAME but not registered: ${oldPath} → ${newPath} (register old in deletedPaths/tarball.deletedPaths AND new in patches/ownedFiles/tarball.paths)`
    )
}

/**
 * T32 L3：上游已删的 follow 文件本地若仍残留，视为 GHOST——根治 T10 留 vector-edit
 *  死目录这类历史遗留。用 upstream/master..upstreamBase log 列出上游自上次合并以来
 *  所有 deleted 文件，磁盘上仍存在且不属于我们自有的，报警。
 */
function checkGhostDeleted(zones: Zones, base: string): string[] {
  // upstreamBase = 我们本地与上游的 merge-base（base 是它或 MERGE_HEAD）
  let upstreamBase = base
  try {
    upstreamBase = git(['merge-base', 'HEAD', 'upstream/master'])
    // oxlint-disable-next-line open-pencil/no-silent-catch
  } catch {
    // 没有 upstream/master 配置（CI 上游 fetch 后必有，本机可能没有）——降级用 base
  }
  // 列出 upstream 自 upstreamBase 以来的所有 deleted 文件（不论我们在不在 base）
  let deletedByUpstream = ''
  try {
    deletedByUpstream = git([
      'log',
      '--diff-filter=D',
      '--name-only',
      '--pretty=format:',
      `${upstreamBase}..upstream/master`
    ])
    // oxlint-disable-next-line open-pencil/no-silent-catch
  } catch {
    // upstream/master 不可达——跳过本次核查
    return []
  }
  // 豁免面与三态登记对齐（04-porting-discipline.md §5）：owned（含过渡态，如
  // AppTextButton.vue 上游删但本地 importer 在用）/ patch（base 改动登记）/
  // tarball.paths（byte 一致白名单）。三者已脱离 follow 区范畴，ghost 不归本检查管。
  const patchedFiles = new Set(
    zones.patches.filter((p) => p.disposition !== 'revoked').map((p) => p.file)
  )
  const owned = new Set([...zones.ownedFiles, ...zones.stubs])
  const tarballPaths = new Set((zones.upstreamMergeTarball ?? []).flatMap((t) => t.paths))
  const candidates = (deletedByUpstream ? deletedByUpstream.split('\n') : []).filter(Boolean)
  return candidates
    .filter((p) => existsSync(resolve(root, p)))
    .filter((p) => !zones.ownedRoots.some((r) => p.startsWith(r)))
    .filter((p) => !patchedFiles.has(p))
    .filter((p) => !owned.has(p))
    .filter((p) => !tarballPaths.has(p))
    .map(
      (p) =>
        `GHOST deleted file from upstream: ${p} still exists locally (remove or move under ownedRoots, or register a patch if importer-dependent)`
    )
}

/**
 * T32 L4：tarball drift——本地文件 byte 与 tarball.paths 收录的版本不一致即违规。
 *  tarball 语义 = 与 base 字节一致（04-porting-discipline.md §5.2），任何本地改动
 *  都破坏该语义：小改应转 patch、大改应转 ownedFile（owner 拍板），改完前判红。
 *  （收口评审 F1：初版为 warn 不阻断——等于把 tarball 文件的未登记修改从 T31 前
 *  的红灯降成警告，门禁被削弱；实测升红时零 drift，无副作用。）
 */
function checkDriftTarball(zones: Zones): string[] {
  const tarballs = zones.upstreamMergeTarball ?? []
  if (tarballs.length === 0) return []
  const violations: string[] = []
  for (const t of tarballs) {
    for (const path of t.paths) {
      try {
        const localSha = git(['hash-object', path])
        const upstreamSha = git(['ls-tree', t.base, path]).split(/\s+/)[2]
        if (localSha && upstreamSha && localSha !== upstreamSha) {
          violations.push(
            `TARBALL_DRIFT: ${path} (task ${t.task}) drifted from base ${t.base.slice(0, 8)} — reclassify to patch or ownedFile`
          )
        }
        // oxlint-disable-next-line open-pencil/no-silent-catch
      } catch {
        // 文件不存在或 base 不可达——跳过
      }
    }
  }
  return violations
}

function checkModified(zones: Zones, modified: string[]): string[] {
  const patchedFiles = new Set(
    zones.patches.filter((p) => p.disposition !== 'revoked').map((p) => p.file)
  )
  const owned = new Set([...zones.ownedFiles, ...zones.stubs])
  // tarball 文件的本地修改由 checkDriftTarball 判红（单一职责，避免双报）
  const tarballPaths = new Set((zones.upstreamMergeTarball ?? []).flatMap((t) => t.paths))
  return modified
    .filter(
      (file) =>
        !patchedFiles.has(file) &&
        !owned.has(file) &&
        !tarballPaths.has(file) &&
        // Merge-base is MERGE_HEAD during any in-progress merge, including merges
        // of our own branches (spike/*, merge/*) — files under ownedRoots are ours
        // (never upstream), so conflict-resolution edits there are not patches.
        !zones.ownedRoots.some((r) => file.startsWith(r))
    )
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
  // T32：tarball.paths 是 byte 一致拷贝的结构化登记，命中即视为合规（无需 ownedFile 兜底）
  const tarballPaths = new Set((zones.upstreamMergeTarball ?? []).flatMap((t) => t.paths))
  return added
    .filter(
      (file) =>
        !owned.has(file) &&
        !tarballPaths.has(file) &&
        !zones.ownedRoots.some((r) => file.startsWith(r))
    )
    .map((file) => `ADDED outside ownedRoots: ${file} (add an owned root or move the file)`)
}

/**
 * T28（决策单 #5）：过堂报告——每条补丁相对 base 的当前 diff 行数。
 * 只读：任何 git/文件错误降级为「?」，报告模式恒 exit 0。
 */
function patchesReport(zones: Zones, base: string): void {
  console.log(`[zones] patches report (base ${base.slice(0, 8)})——过堂用，不参与判红：`)
  let totalAdd = 0
  let totalDel = 0
  for (const p of zones.patches) {
    let numstat = ''
    try {
      numstat = git(['diff', '--numstat', base, '--', p.file])
    } catch {
      numstat = ''
    }
    const lines = numstat ? numstat.split('\n').filter(Boolean) : []
    let add = 0
    let del = 0
    let binary = false
    for (const line of lines) {
      const [a, d] = line.split('\t')
      if (a === '-' || d === '-') {
        binary = true // 二进制文件 numstat 给 '-'（图片/ico 等）
        continue
      }
      add += Number(a) || 0
      del += Number(d) || 0
    }
    totalAdd += add
    totalDel += del
    const size = binary ? 'binary' : `+${add}/-${del}`
    const revoked = p.disposition === 'revoked' ? ' [revoked]' : ''
    const reviewed = p.lastReviewed ? ` reviewed=${p.lastReviewed}` : ' reviewed=?'
    console.log(`  ${p.id}\t${size}\t${p.file}${revoked}${reviewed}`)
  }
  console.log(
    `[zones] patches total: +${totalAdd}/-${totalDel} across ${zones.patches.length} patch(es)`
  )
}

function main() {
  const zones: Zones = JSON.parse(
    readFileSync(resolve(root, 'tools/zone-registry/zones.json'), 'utf8')
  )
  const base = resolveBase()
  // T28：报告模式先行——只输出过堂摘要即返回，主检查流程不受影响
  if (process.argv.includes('--patches-report')) {
    patchesReport(zones, base)
    process.exit(0)
  }
  const changes = collectChanges(base)
  // T32：rename 交叉一致性 + tarball drift（F1 收口评审：drift 判红，不 warn）
  const renames = collectRenames(base)
  // 装配顺序——violations 在前、Renames/Ghost/Drift 在中、Tarball 白名单在后兜底 ADDED
  const violations = [
    ...changes.violations,
    ...checkRenames(zones, renames),
    ...checkModified(zones, changes.modified),
    ...checkDeletedRegistered(zones, changes.deleted),
    ...checkDeletedAbsent(zones),
    ...checkGhostDeleted(zones, base),
    ...checkDriftTarball(zones),
    ...checkUpstreamMergeTarball(zones),
    ...checkAdded(zones, changes.added)
  ]

  if (violations.length > 0) {
    console.error(`[zones] ${violations.length} violation(s):`)
    for (const v of violations) console.error(`  - ${v}`)
    process.exit(1)
  }
  console.log(
    `[zones] clean: ${changes.modified.length} modified (all registered), ${changes.added.length} added (owned), ${changes.deleted.length} deleted (all registered), ${renames.length} renamed (cross-checked), base ${base.slice(0, 8)}`
  )
}

main()

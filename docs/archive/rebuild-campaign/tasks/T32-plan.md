<!--
  写作纪律（改本文前必读）：
  - 事实性声明必须附核验命令 + 日期，否则标为【假设】
  - 计划被实测推翻时，直接改本文为新版本，完整理由记入 records/ 子文档
  - 本文只保留当前态，不保留修正历史
  - 改完后刷新本文头部的「状态」字段
  - 详细规则见 docs/rebuild/05-process.md §4
-->

# T32 计划 · zones 边界纠正（ownedFile→tarball 模式）+ check.ts 机制改造

> **状态**：未核验 | **时间**：2026-08-26 | **核验人**：主 agent
> **分支**：`rebuild/pi-zone-cleanup`（自 38029fc5 拉出，待 owner 拍板后建）
> **上游钉扎**：`88c1077071328b8df68f282543f16e20e97930b4`（与 T31 一致，T31 已收口）
> **T31 commit**：`c0c1f117`（上游合并第二轮，tarball 法）

## 1. 背景与问题定位

T31 上游合并第二轮（88c10770，commit `c0c1f117`）用 tarball 法把上游四个 commit 的内容快进到本地，同时在 `tools/zone-registry/zones.json` 做了两类登记：

- **P62-P82 共 21 枚 patch 条目**（以及 P60/P61 共 23 枚）—— 标记 follow 区被快进拷贝的文件；
- **+24 个 ownedFiles 新增条目** —— 标记"T31 期间新引入仓内的文件"。

登记中有一类**边界判定错**：15 个 vector 编辑器 / vector-input / shared/input/vector / core/vector/handle-selection 文件**与上游 88c10770 字节一致**（待 S1 实测复核），但被登记成 ownedFiles 而非 patches。`check:zones` 当前对这两类的处置逻辑（`tools/zone-registry/src/check.ts:148-150` 周边）：

- `MODIFIED but not registered` —— patch 标签覆盖，合法；
- `ADDED outside ownedRoots` —— 必须有 ownedFile/ownedRoot 兜底。

vector 15 文件实际属于"上游字节一致 + 我们快进拷贝"——T31 当时误归 ownedFile（错位）。本任务采用结构化方案：把 tarball 拷贝从"ownedFile 兜底 + patch 占位"拆为 **zones.json 新增顶层 `upstreamMergeTarball` 字段**，机器可解析、白名单语义清晰。

### 三类相关遗留问题的根因

1. **vector 15 文件**：登记模式错位（ownedFile 而非 tarball）；
2. **P62-P82 21 枚 patch**：登记模式错位（patch 而非 tarball）；
4. **机制层漏洞**：
   - **L1（tarball 无结构化注册路径）**：check.ts `checkAdded`（行 147）只接受 ownedRoots/ownedFiles/stubs 兜底，**不允许 patch 模式或 tarball 标签为白名单**——T31 借 ownedFile 错位绕过是反例；
   - **L2（rename 一致性缺失）**：`collectChanges`（行 84-99）把 R 行拆分为 D+A 后交独立判定，**漏掉"rename 必须 a 入 deletedPaths + b 入补丁表"的交叉一致性**——上游 rename 一个 follow 文件若只登记 b 为 patch、a 没列入 deletedPaths，当前会双重红（D 一处 + A 一处）；若两端都登记，**没有机器可识别的 rename 元数据**辅助核对；
   - **L3（ghost deleted 无原生检测）**：check.ts 只检查"本地已删 vs deletedPaths 登记"（行 127）和"deletedPaths 列表 vs 磁盘存在"（行 141），**没有反向检测**：上游已删的 follow 文件本地若残留旧实现，diff --name-status 的 D 行覆盖范围有限，本地残留不被察觉——这是 T10 留 vector-edit 死目录的根本原因（虽 T31 借 bb8c5c18 一并清掉是补救）。

### 三类相关遗留问题的根因

1. **vector 15 文件**：登记模式错位（ownedFile 而非 patch）；
2. **P62-P82 21 枚 patch**：登记模式合规，但需复核是否每条都对应字节一致的文件（个别若实际存在本地差异，需扩大 patch hunk）；
3. **机制层**：zones.json 的 `check.ts` 未原生检测"RENAMED outside ownedRoots"和"follow 区应删文件仍残留"——这是 T10 留 vector-edit 死目录的根本原因。T31 借 bb8c5c18 一并清理是补救，不是有机制兜底。

## 2. 涉及文件（15 个 ownedFile→patch 模式纠正）

```
packages/core/src/vector/handle-selection.ts
packages/vue/src/canvas/vector-input/bend.ts
packages/vue/src/canvas/vector-input/input.ts
packages/vue/src/shared/input/vector/hit-test.ts
packages/vue/src/shared/input/vector/index.ts
packages/vue/src/shared/input/vector/snap.ts
src/app/editor/vector/create.ts
src/app/editor/vector/handle-actions.ts
src/app/editor/vector/handles.ts
src/app/editor/vector/history.ts
src/app/editor/vector/index.ts
src/app/editor/vector/lifecycle.ts
src/app/editor/vector/network.ts
src/app/editor/vector/selection.ts
src/app/editor/vector/types.ts
```

## 3. 任务清单

1. **S1：字节一致性实测** —— `git rev-parse 88c10770` 验证可达；`git diff --stat 88c10770..HEAD -- <15 paths>` 输出空；抽样 5 个文件逐一核对。**任何非空 diff 都先停手、回到 plan 修订**，不强行绕开。
2. **S2：zones.json schema 升级** —— 新增顶层字段 `upstreamMergeTarball: Array<{ base: string, paths: string[], deletedPaths: string[], task: string, lastReviewed: string }>`。每个 tarball 合并留下一条记录：
   - `base`：上游被合并的 commit SHA（必需）；
   - `paths`：本轮 tarball 拷贝进本地且与 base 字节一致的文件路径数组（覆盖原 `ownedFiles` 越位的 15 文件 + 复审 P62-P82 中确属 tarball 的部分）；
   - `deletedPaths`：本轮 tarball 一并清掉的本地残留旧路径数组（覆盖 zones.json `deletedPaths` 中由本轮 tarball 引发的条目，便于审计 tarball 删除面 vs 历史删除面）；
   - `task`：登记此 tarball 的任务号（T32 自己首次落地可写 "T32"；**T31 历史性补登记**写 "T31 retro-T32"，与新增 T32 区分）；
   - `lastReviewed`：YYYY-MM-DD 格式过堂日期。
   - **schema 演进纪律**：新增字段为 additive，老 zones.json 仍可读；不在 patches / ownedFiles / deletedPaths 三处混语义。
3. **S3：ownedFiles 与 patches 改写** —— 15 vector 文件从 `ownedFiles` 数组移除；P60-P61 保留（指向测试文件，与 tarball 无关）；**P62-P82 21 枚 patch 按 S4 复核结果分两类处置**：
   - **确属 tarball 拷贝（byte 一致）**：从 `patches` 数组移除，统一进 `upstreamMergeTarball[*].paths`；
   - **确有本地改动（byte 不一致）**：保留 patch 登记，必要时扩大 hunk。
4. **S4：P62-P82 21 枚 patch 复核** —— `git diff 88c10770..HEAD -- <each path>` 抽样核对字节一致；任何不一致需保留 patch 并在 narrative 记录。narrative 段写明"复核通过 XX 条 / 复核发现保留 patch YY 条"。
5. **S5：check.ts 机制改造** —— `tools/zone-registry/src/check.ts` 新增 3 个函数 + 改 1 个函数（详见 §8）：
   - **新增 `checkUpstreamMergeTarball(zones, added, deleted)`**：扫描 zones.json `upstreamMergeTarball` 数组，凡某路径在任意 `paths` 数组命中或 `deletedPaths` 命中即视为合规；同时校验各 tarball 的 `base` SHA 本地可达、对应 commit 真实存在；
   - **新增 `checkRenames(zones, renames)`**：从 `collectChanges` 拆出 R 行单独处理——对每对 (oldPath, newPath)：
     - oldPath 必须命中某 tarball 的 `deletedPaths` 或 zones.json `deletedPaths`（隐式清理语义）；
     - newPath 必须命中某 tarball 的 `paths` 或 `patches` 或 `ownedFiles`/`ownedRoots`（新增面）；
     - 两端都缺则报 "RENAME but not registered" 错误；
   - **新增 `checkGhostDeleted(zones, base)`**：用 `git log --diff-filter=D --name-only upstream/master..base` 列出上游自上次 merge-base 以来所有删过的 follow 文件，对比本地磁盘，残留即红 "GHOST deleted file from upstream: <path> still exists locally"——这是 L3 的根治方案，可彻底防止 vector-edit 这类死目录复发；
   - **改 `collectChanges`**：把 R 行从"拆分为 D+A 各自走原逻辑"改为"保留原始 R 记录并单独送 `checkRenames`"——避免 R 行同时触发 D 红 + A 红双判（错位语义）；其他 status 处理不变。
   - **`main()` 装配**：`violations` 列表拼装顺序为 `...changes.violations, ...checkRenames, ...checkModified, ...checkDeletedRegistered, ...checkDeletedAbsent, ...checkGhostDeleted, ...checkUpstreamMergeTarball, ...checkAdded`——D/A 在前、Renames/Ghost 在中、Tarball 白名单在后兜底 ADDED。
6. **S6：04-porting-discipline.md 新增 §3.x「owned/follow/tarball 三态边界判定」** —— 内容要点：
   - **三态定义**：owned（我们的资产，纯自有）、follow（与上游某 commit 字节一致的拷贝，可被上游未来改动覆盖）、tarball（通过 tarball/tarball 替换式合并引入的 follow 子集，结构化登记在 `upstreamMergeTarball`，等价于 follow 但有审计钩子）；
   - **判定规则**：「与上游某 commit 字节一致 → tarball（首选）或 follow + patch（手动调整语义）」；「纯自有资产 → ownedFile」；「上游已不存在对应 commit 或我们做了结构性偏离 → ownedFile（owner 拍板）」；
   - **tarball 纪律**：上游内容字节一致的新拷贝**统一登记 tarball**，不登记 ownedFile（ownedFile 卡死未来合并）、不登记 patch（patch hunk 应留给真实改动）；tarball 模式让 git 三路合并正常运作，且有审计时间线；
   - **反例警示**：T31 vector 树 15 文件是"byte 一致却误归 ownedFile"的反例——T32 即为此纠偏；T31 P62-P82 21 枚 patch 是"byte 一致却误归 patch"的反例——T32 同为此纠偏。
7. **S7：02-phase-0.md §3.3「重分类仪式」补充** —— 在末尾加一段：「§3.x 补充：tarball/tarball 替换式合并的 path 登记走 zones.json 新增 `upstreamMergeTarball` 顶层字段（机器可解析），不走 ownedFile 也不走 patch——边界判定规则详见 04-porting-discipline.md §3.x。」
8. **S8：upstream-merge.md「合并-2」叙事订正** —— 第79 行原文 "T10 tarball 法把上游 rename 落成「新目录加、旧目录留」孤儿死目录，本轮借 bb8c5c18 清除" 改为：**实际上 T10 合并（5201404f）未触碰 vector-edit 目录**（`git show b84530bf --name-status | grep vector` 零命中，2026-08-26 复核）。vector-edit → vector 的改名发生于上游 `bb8c5c18`，该 commit 在 T10 之后、T31 之前出现在 upstream/master；T31 用 tarball 法取 88c10770 快照时一并采纳并清死目录（zones.json `deletedPaths` +14）。**T10 之所以留死目录，不是 tarball 法本身错，而是当时没有 `checkGhostDeleted` 兜底——T32 新增该机制可根治此类死目录复发**。
9. **S9：check:zones 全套复跑** —— `bun run check:zones` 必须 exit 0（因 15 文件 + P62-P82 中 tarball 部分已转白名单，`checkUpstreamMergeTarball` 兜底）；`bun run check` 全 14 件门禁全绿。本机 windows 环境中文 console 乱码已知，pytest/bun test 长输出走前台跑 + timeout 180s。
10. **S10：T32 三件套收口** —— `docs/rebuild/tasks/T32-self-check.md`（主 agent 写）+ `docs/rebuild/tasks/T32-verify.md`（subagent 独立核验 V1-V5）+ `docs/rebuild/tracker.md` 追加 T32 当前行 + `docs/rebuild/tasks/_index.md §2` 追加 T32 永久行 + `records/narrative/zones.json.md`（如不存在则新建）+ `records/topics/upstream-merge.md` 追加 T32 条目。
11. **S11：CI 推送** —— staging 先行（`PUSH_BRANCH=rebuild/pi-staging node .gh-api-push.mjs <commit>`）→ 等 CI 绿 → 同 SHA 推 rebuild/pi → `gh run view <run-id> -R another-momo/open-pencil --json conclusion` 复验 success。

## 4. zones.json 新字段草案（schema）

```jsonc
{
  "$comment": "现有注释保留 + 新增：upstreamMergeTarball 是结构化的 tarball 拷贝登记（覆盖 ownedFiles 越位的 15 文件 + 复审 P62-P82 中确属 tarball 的部分）；机器可解析，CI 通过 checkUpstreamMergeTarball 校验 base SHA 本地可达 + paths/deletedPaths 字段非空 + 不与 ownedFiles 重叠。",
  "ownedRoots": [...],
  "ownedFiles": [...],       // 移除 15 vector 条目
  "stubs": [...],
  "pendingReclass": [...],
  "patches": [...],          // P60-P61 保留；P62-P82 按 S4 复核结果处置
  "upstreamMergeTarball": [  // 新增顶层字段
    {
      "base": "88c1077071328b8df68f282543f16e20e97930b4",
      "task": "T31 retro-T32",
      "lastReviewed": "2026-08-26",
      "paths": [
        "packages/core/src/vector/handle-selection.ts",
        "packages/vue/src/canvas/vector-input/bend.ts",
        "packages/vue/src/canvas/vector-input/input.ts",
        "packages/vue/src/shared/input/vector/hit-test.ts",
        "packages/vue/src/shared/input/vector/index.ts",
        "packages/vue/src/shared/input/vector/snap.ts",
        "src/app/editor/vector/create.ts",
        "src/app/editor/vector/handle-actions.ts",
        "src/app/editor/vector/handles.ts",
        "src/app/editor/vector/history.ts",
        "src/app/editor/vector/index.ts",
        "src/app/editor/vector/lifecycle.ts",
        "src/app/editor/vector/network.ts",
        "src/app/editor/vector/selection.ts",
        "src/app/editor/vector/types.ts"
        // + P62-P82 中复核为 byte 一致的路径（数量待 S4 实测确认）
      ],
      "deletedPaths": [
        "src/app/editor/vector-edit/",
        "packages/vue/src/canvas/node-edit/",
        "packages/vue/src/shared/input/node-edit/"
        // + T31 一并清的 +14 deletedPaths 中确属本 tarball 引发的条目
      ]
    }
  ],
  "deletedPaths": [...]      // 保留所有现有条目，不动；checkGhostDeleted 用 upstream log 独立核查
}
```

## 5. check.ts 改造伪代码

### 5.1 类型扩展

```typescript
interface Zones {
  // ... 现有字段
  upstreamMergeTarball?: Array<{
    base: string
    paths: string[]
    deletedPaths: string[]
    task: string
    lastReviewed: string
  }>
}
```

### 5.2 `checkUpstreamMergeTarball`（新增）

```typescript
function checkUpstreamMergeTarball(zones: Zones, added: string[], deleted: string[]): string[] {
  const tarballs = zones.upstreamMergeTarball ?? []
  const tarballPaths = new Set(tarballs.flatMap((t) => t.paths))
  const tarballDeleted = new Set(tarballs.flatMap((t) => t.deletedPaths))
  const violations: string[] = []
  // 校验 base SHA 本地可达
  for (const t of tarballs) {
    try {
      git(['rev-parse', '-q', '--verify', t.base])
    } catch {
      violations.push(`upstreamMergeTarball base "${t.base}" (task ${t.task}) not reachable locally`)
    }
  }
  // added 命中白名单 → 不再报 ADDED 红
  // 此函数只返回 violation，checkAdded 需自行过滤 tarballPaths
  return violations
}
```

### 5.3 `checkRenames`（新增）

```typescript
interface Rename {
  oldPath: string
  newPath: string
}

function collectRenames(base: string): Rename[] {
  const diff = git(['diff', '--name-status', '-M', base, '--'])  // -M 启用 rename detection
  const renames: Rename[] = []
  for (const line of diff ? diff.split('\n') : []) {
    const parts = line.split('\t')
    if (parts[0].startsWith('R')) renames.push({ oldPath: parts[1], newPath: parts[2] })
  }
  return renames
}

function checkRenames(zones: Zones, renames: Rename[]): string[] {
  const tarballs = zones.upstreamMergeTarball ?? []
  const tarballDeleted = new Set(tarballs.flatMap((t) => t.deletedPaths))
  return renames
    .filter(({ oldPath, newPath }) =>
      !tarballDeleted.has(oldPath) &&
      !zones.deletedPaths.some((d) => oldPath === d || oldPath.startsWith(d + '/')) &&
      !zones.ownedRoots.some((r) => newPath.startsWith(r)) &&
      !zones.ownedFiles.includes(newPath) &&
      !zones.patches.some((p) => p.file === newPath) &&
      !tarballs.some((t) => t.paths.includes(newPath))
    )
    .map(({ oldPath, newPath }) =>
      `RENAME but not registered: ${oldPath} → ${newPath} (register in upstreamMergeTarball.deletedPaths and .paths, or deletedPaths + patches/ownedFiles)`
    )
}
```

### 5.4 `checkGhostDeleted`（新增）

```typescript
function checkGhostDeleted(zones: Zones, base: string): string[] {
  // 列出 upstream/master 自 base 以来所有删过的 follow 文件
  // 注：base 是我们的 merge-base；用 upstream/master..base 反向找上游删过的文件需
  //     git log --diff-filter=D --name-only <our-merge-base>..upstream/master
  //     但 base 在合并后可能等于 MERGE_HEAD（即 upstream/master 自己），
  //     此时空集；合并前 base = merge-base HEAD upstream/master，可取
  let upstreamBase = base
  try {
    upstreamBase = git(['merge-base', 'HEAD', 'upstream/master'])
  } catch { /* use base as-is */ }
  const deletedByUpstream = git([
    'log', '--diff-filter=D', '--name-only', '--pretty=format:', `${upstreamBase}..upstream/master`
  ])
  const candidates = (deletedByUpstream ? deletedByUpstream.split('\n') : []).filter(Boolean)
  return candidates
    .filter((p) => existsSync(resolve(root, p)))   // 本地仍残留
    .filter((p) => !zones.ownedRoots.some((r) => p.startsWith(r)))   // 但不是我们自有
    .map((p) => `GHOST deleted file from upstream: ${p} still exists locally (remove or move under ownedRoots)`)
}
```

### 5.5 `collectChanges` 改动

把 R 行从"拆 D+A"改为"保留 R 记录、只把新增路径送 checkAdded"：

```typescript
function collectChanges(base: string): Changes {
  const changes: Changes = { modified: [], added: [], deleted: [], violations: [] }
  const diff = git(['diff', '--name-status', '-M', base, '--'])
  for (const line of diff ? diff.split('\n') : []) {
    const parts = line.split('\t')
    const status = parts[0]
    if (status === 'M' || status === 'T') changes.modified.push(parts[1])
    else if (status === 'A') changes.added.push(parts[1])
    else if (status === 'D') changes.deleted.push(parts[1])
    else if (status.startsWith('R')) {
      // rename 不再拆分：D 端由 checkRenames 覆盖，A 端由 checkAdded + tarball 白名单覆盖
      changes.deleted.push(parts[1])   // 仍送 checkDeletedRegistered，让它认识 deletedPaths 或 tarball.deletedPaths
      changes.added.push(parts[2])     // 仍送 checkAdded，让它认识 tarball.paths 或 ownedFile
    } else {
      changes.violations.push(`UNEXPECTED git status "${status}" for ${parts.slice(1).join(' → ')}`)
    }
  }
  // untracked 同原逻辑
  const untracked = git(['ls-files', '--others', '--exclude-standard'])
  for (const line of untracked ? untracked.split('\n') : []) {
    if (line) changes.added.push(line)
  }
  return changes
}
```

注：rename 双送 D+A 是为了**保持向后兼容**——`checkDeletedRegistered` 已能识别 deletedPaths + tarball.deletedPaths，`checkAdded` 已能识别 tarball.paths + ownedFile；`checkRenames` 单独保证 R 行两端的交叉一致性。

### 5.6 `main()` 装配

```typescript
function main() {
  const zones: Zones = JSON.parse(...)
  const base = resolveBase()
  if (process.argv.includes('--patches-report')) {
    patchesReport(zones, base)
    process.exit(0)
  }
  const changes = collectChanges(base)
  const renames = collectRenames(base)   // 新增
  const violations = [
    ...changes.violations,
    ...checkRenames(zones, renames),                   // 新增
    ...checkModified(zones, changes.modified),
    ...checkDeletedRegistered(zones, changes.deleted),
    ...checkDeletedAbsent(zones),
    ...checkGhostDeleted(zones, base),                  // 新增
    ...checkUpstreamMergeTarball(zones, changes.added, changes.deleted),  // 新增（白名单兜底）
    ...checkAdded(zones, changes.added.filter(f =>     // checkAdded 增加 tarball 白名单
      !(zones.upstreamMergeTarball ?? []).some(t => t.paths.includes(f))
    ))
  ]
  if (violations.length > 0) { ... }
  console.log(...)  // 报告补 "X renamed (registered)"
}
```

## 6. 验收标准

| # | 验收 | 核验命令 |
|---|---|---|
| C1 | 15 vector 文件与上游 88c10770 字节完全一致 | `git diff --stat 88c10770..HEAD -- <15 paths>` 输出空；抽样 5 文件逐一确认 |
| C2 | zones.json `ownedFiles` 不再含 15 vector 条目 | `python -c "import json; z=json.load(open('tools/zone-registry/zones.json',encoding='utf-8')); assert not any('vector' in f for f in z['ownedFiles'])"` |
| C3 | zones.json 新增 `upstreamMergeTarball` 顶层字段，含 T31 retro-T32 一条记录（base=88c10770，paths 含 15 vector + P62-P82 中复核为 byte 一致的路径，deletedPaths 含 vector-edit/node-edit 等 T31 一并清的条目） | `python -c "import json; z=json.load(open('tools/zone-registry/zones.json',encoding='utf-8')); assert 'upstreamMergeTarball' in z; assert any(t['base']=='88c1077071328b8df68f282543f16e20e97930b4' for t in z['upstreamMergeTarball'])"` |
| C4 | P62-P82 21 枚 patch 按 S4 复核结果处置（byte 一致部分移入 tarball.paths，不一致保留 patch） | narrative 段记录"复核通过 XX 条 / 保留 patch YY 条" |
| C5 | check.ts 新增 3 个函数 + 改 1 个函数（checkUpstreamMergeTarball、checkRenames、checkGhostDeleted + collectChanges R 行处理） | `git diff HEAD~ -- tools/zone-registry/src/check.ts | grep -E 'checkUpstreamMergeTarball\|checkRenames\|checkGhostDeleted\|collectRenames'` 命中 |
| C6 | check:zones 全绿（含新规则） | `bun run check:zones` exit 0 |
| C7 | check 全 14 件绿（含 smoke:pi 80 断言） | `bun run check` exit 0 |
| C8 | 04-porting-discipline.md 新增 §3.x「owned/follow/tarball 三态边界判定」 | `grep -n 'owned/follow/tarball 三态边界判定' docs/rebuild/04-porting-discipline.md` 命中 |
| C9 | 02-phase-0.md §3.3 末尾指向 04 §3.x | `grep -n 'tarball/tarball 替换式合并' docs/rebuild/02-phase-0.md` 命中 |
| C10 | upstream-merge.md「合并-2」叙事订正 | `grep -n 'T10 tarball 法' docs/rebuild/records/topics/upstream-merge.md` 零命中 |
| C11 | tracker / _index / narrative 登记完整 | 三文件 T32 行均可定位 |
| C12 | 远端 CI 双链 success | staging run + rebuild/pi run 均 `conclusion=success` |

## 7. 不动

- T31 自身提交 `c0c1f117` 不重做；
- T31 之前的所有 commits 不重做；
- 不动 `disposition: revoked` 既有逻辑（check.ts 行 109）；
- 不动 `checkDeletedAbsent`（行 141）；
- 不升级 `patches[*]` 元数据（如 `kind: 'reduction' | 'feature-port' | 'upstream-merge-tarball'` 字段）——作为未来 T33 候选。

## 8. check.ts 改造范围速查

| 新增/改 | 函数 | 解决漏洞 | 优先级 |
|---|---|---|---|
| 新增 | `checkUpstreamMergeTarball` | L1 | 必做 |
| 新增 | `checkRenames` + `collectRenames` | L2 | 必做 |
| 新增 | `checkGhostDeleted` | L3 | 必做 |
| 改 | `collectChanges` R 行处理 | L2 配套 | 必做 |
| 改 | `main()` 装配顺序 | 三漏洞联动 | 必做 |
| 改 | `Zones` 类型 + `checkAdded` tarball 白名单 | L1 配套 | 必做 |

## 9. 风险与依赖

- **核心风险**（S1 拦截）：若字节一致复核发现非空 diff——说明 15 文件已被某次本地改动穿透但未登记 patch，需先排查差异源再继续；
- **核心风险**（S4 复核）：P62-P82 21 枚 patch 中若发现非 byte 一致的，需要保留 patch 并扩大 hunk——这是当前分类错位的真实代价，不能绕开；
- **核心风险**（S5 check.ts 改造）：新规则接入后应**先在本机跑过 `bun run check:zones` 验证不退化**——任何回归即停手；
- **依赖**：T31 已收口（`38029fc5`），本地 rebuild/pi HEAD = 38029fc5；
- **本地验证纪律**：本机 windows 环境中文 console 乱码已知，pytest/bun test 长输出走前台跑 + timeout 180s（[05-process.md §6](05-process.md) 既有纪律）；
- **格式化纪律**：本任务只精确修 zones.json + 04 §3.x + 02 §3.3 追加段 + upstream-merge.md 第79 行 + check.ts + T32 三件套 + tracker/_index/narrative；不跑 `bunx oxfmt docs/rebuild/` 目录通配（避免 T30 oxfmt/git-checkout 事故重演）。

## 10. 留给 owner review 的开放项

- **04 §3.x 措辞**：是否同意"owned/follow/tarball 三态边界判定"为永久纪律；
- **02 §3.3 补充段**：是否需要把"upstreamMergeTarball 顶层字段"作为独立的 sub-§3.3.1 而非末尾一句话；
- **是否还有其他要并入 T32 的事项**（用户在原话里明说"我再看有没有别的要一起放"，本 plan 现覆盖 vector/owned 边界纠正 + P62-P82 复核 + check.ts 三漏洞根治 + 纪律补强 + 叙事订正，若有 chat/i18n 等其他 module 的同类问题需 user 列举再扩 plan）。
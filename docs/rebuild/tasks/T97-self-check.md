# T97-self-check · 06-zone-governance.md + zones.json 同步修复

> **任务来源**：T97-plan（owner 触发补办路径）
> **核验日期**：2026-09-05
> **自检人**：主 agent

## 承诺 vs 落地对照表

| # | T97-plan 承诺项 | 落地情况 | 偏差/证据 |
|---|----|----|----|
| 1 | 新增 docs/rebuild/06-zone-governance.md（约 321 行） | ✅ 已创建，文件长度实测见下方命令 | 无偏差 |
| 2 | README 第一层登记 06 + 头部状态刷新 | ✅ 已落地 README §「本目录是什么」表格新增一行；头部状态/时间/基线刷为 2026-09-05 | 无偏差 |
| 3 | zones.json deletedPaths 加 `src/app/ai/chat/` 前缀 | ✅ 已加（字典序位置正确，src/app/ai/attachment 之后、src/app/ai/chat/model.ts 之前） | 无偏差 |
| 4 | records/narrative/06-zone-governance.md 新建（物理绑定层） | ✅ 已创建，含修正-1 + 初版核验条目 | 无偏差 |
| 5 | records/narrative/README.md 追加修正-2 | ✅ 已追加（README 登记 06 + 头部刷新登记） | 无偏差 |
| 6 | check:zones 全绿 | ✅ `bun tools/zone-registry/src/check.ts` exit 0（[zones] clean: 126 modified, 695 added, 1130 deleted, 16 renamed, base 88c10770） | 无偏差 |
| 7 | check:docs 全绿 | ✅ check-docs 45/45 通过（已超 44，因新增 06 叙事文档） | 无偏差 |
| 8 | check:bindings 全绿 | ✅ check-bindings 5 文件变更，binding 全绿（06↔narrative/06、README↔narrative/README） | 无偏差 |
| 9 | check:tasks 挂 T97 指针后通过 | ✅ 已创建本三件套 | 无偏差 |
| 10 | 数字面板与 zones.json 实测一致 | ✅ 见 §核验命令输出 | 无偏差 |
| 11 | checker 13 条规则全清单覆盖 | ✅ §4 表格 13 行 + §5.6 装配顺序 | 无偏差 |
| 12 | relocations 仅给设计草案不落地 | ✅ §6 顶部明示【假设/未落地】 | 无偏差 |

## 完成度自评

- **代码/数据改动**：3 文件（06 新增 + README 改 + zones.json 改）
- **档案改动**：2 文件（narrative/06 新增 + narrative/README 改）
- **任务档案**：3 文件（T97-plan + T97-self-check + T97-verify）
- **总体完成度**：100%（承诺 12 项全部落地，无偏差）

## 决策影响

1. **数字校正**：删除了 prompt 假设中的 129 deletedPaths（实际 135→136）+ font cluster 9 patch（实际 12）+ 删除区复活 155 文件（实际 17→21）等不符合实测的数字；改写为实测值并附核验命令——这是「事实性声明必须附核验命令 + 日期」（05-process.md §4 第 1 条）的纪律体现
2. **relocations 字段未落地**：zones.json 顶层键实测 7 个不含 relocations——§6 给设计草案但明确标【假设/未落地】，避免与 owner 决策冲突
3. **顺手修父 commit 债**：77e32774a commit message 自称 check:zones clean 但实际未更新 zones.json；本次 commit 内同步修复——这是「发现腐烂即改」（05-process.md §4 第 2 条）的纪律体现，但同时也是「不可见的 patches retire」边界——本次 retire 范围限于 deletedPaths 加目录前缀，不涉及 patches 登记变更（check-tasks 已确认「补丁条目集合无变化（仅格式/注释变动）」）

## 核验命令（自检实测）

```bash
# 1. 数字面板实测
node -e "const z=require('./tools/zone-registry/zones.json');console.log({
  ownedRoots: z.ownedRoots.length,
  ownedFiles: z.ownedFiles.length,
  patches: z.patches.length,
  permanent: z.patches.filter(p=>p.disposition!=='revoked').length,
  revoked: z.patches.filter(p=>p.disposition==='revoked').length,
  deletedPaths: z.deletedPaths.length,
  dirPrefixes: z.deletedPaths.filter(p=>p.endsWith('/')).length,
  fileTombstones: z.deletedPaths.filter(p=>!p.endsWith('/')).length,
  stubs: z.stubs.length,
  pendingReclass: z.pendingReclass.length,
  tarballs: z.upstreamMergeTarball.length
})"
# 实测输出：{ ownedRoots: 15, ownedFiles: 56, patches: 129, permanent: 126,
# revoked: 3, deletedPaths: 136, dirPrefixes: 12, fileTombstones: 124,
# stubs: 1, pendingReclass: 0, tarballs: 3 }

# 2. zones 顶层键实测
node -e "console.log(Object.keys(require('./tools/zone-registry/zones.json')))"
# 实测输出：[ '$comment', 'ownedRoots', 'ownedFiles', 'stubs',
# 'pendingReclass', 'patches', 'deletedPaths', 'upstreamMergeTarball' ]

# 3. checker 函数清单实测
grep -nE 'function (check|collect)' tools/zone-registry/src/check.ts
# 实测输出：13 个函数（1 collectChanges + 12 check 函数）

# 4. 失锚 patch 实测
node -e "const {execSync}=require('child_process');const z=JSON.parse(require('fs').readFileSync('tools/zone-registry/zones.json','utf8'));const out=execSync('git diff --name-only --diff-filter=D 88c1077071328b8df68f282543f16e20e97930b4..upstream/master',{encoding:'utf8'});const ds=new Set(out.split('\n').filter(Boolean));console.log(z.patches.filter(p=>p.disposition!=='revoked'&&ds.has(p.file)).map(p=>p.id+' '+p.file).join('\n'))"
# 实测输出：P74 src/app/editor/clipboard/system.ts
#           P192 packages/vue/src/i18n/messages/dialogs.ts
#           P193 packages/vue/src/i18n/locales/zh-cn/dialogs.json

# 5. 改锚 patch 实测（19 R 行中 2 命中）
git diff --name-status -M 88c1077071328b8df68f282543f16e20e97930b4..upstream/master | grep '^R'
# 实测命中：P159 boolean-visual.test.ts → visual/boolean.test.ts
#          P170 export-fixtures.ts → operations/export-fixtures.ts

# 6. tarball drift 实测
node -e "..."（见 §5.5 核验命令）
# 实测输出：T50 0/7 / T31 10/41 / T63 paths=0

# 7. 删除区复活拦截实测
node -e "..."（见 §5.3 核验命令）
# 实测输出：5 前缀 21 文件（11 src/components/chat/ + 4 src/app/ai/chat/
#          + 2 packages/cli/ + 2 tests/engine/cli/ + 2 packages/mcp/）

# 8. 门禁实测
bun tools/zone-registry/src/check.ts       # exit 0
bun tools/zone-registry/src/check/docs.ts  # 45/45
bun tools/zone-registry/src/check/bindings.ts  # 5 文件变更全绿
bun tools/zone-registry/src/check/tasks.ts # 挂 T97 指针后通过
```

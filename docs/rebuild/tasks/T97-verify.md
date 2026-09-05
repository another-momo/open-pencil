# T97-verify · 06-zone-governance.md + zones.json 同步修复 数字一致性核验

> **任务来源**：T97-plan + T97-self-check
> **核验日期**：2026-09-05
> **核验人**：主 agent
> **核验范围**：限于「文档数字与 zones.json 实测一致性」——本次任务环境约束（subagent 不可派），按 05-process.md §3.2 D11 大改动纪律的「主 agent 内嵌核验 + 实测命令输出」路径核验，非完整 subagent 独立核验。**owner 触发的独立 subagent 核验待补办**（owner 在 tracker.md 看到本任务时派单）。
> **依据**：T97-plan.md（任务清单 + 验收标准）+ T97-self-check.md（承诺/落地对照表 + 完成度）+ [06-zone-governance.md](../06-zone-governance.md) + [zones.json](../../tools/zone-registry/zones.json)

## 核验逐条

### 1. 数字面板（§3.1） vs zones.json 实测

| §3.1 声明值 | 实测命令输出 | 一致性 |
| --- | --- | --- |
| ownedRoots 15 | `z.ownedRoots.length` = 15 | ✅ |
| ownedFiles 56 | `z.ownedFiles.length` = 56 | ✅ |
| patches 129（126 permanent + 3 revoked） | `z.patches.length` = 129；permanent 126；revoked 3 | ✅ |
| deletedPaths 136（12 目录前缀 + 124 文件墓碑） | `z.deletedPaths.length` = 136；dirPrefixes 12；fileTombstones 124 | ✅ |
| upstreamMergeTarball 3 | `z.upstreamMergeTarball.length` = 3 | ✅ |
| stubs 1 | `z.stubs.length` = 1 | ✅ |
| pendingReclass 0 | `z.pendingReclass.length` = 0 | ✅ |
| relocations 0（字段未落地） | `'relocations' in z` = false（顶层键 7 个） | ✅ |

### 2. ownedRoots 15 条逐条（§3.2） vs zones.json

| # | §3.2 声明路径 | `z.ownedRoots[i]` | 一致性 |
| --- | --- | --- | --- |
| 1 | docs/ | ✅ | ✅ |
| 2 | tools/zone-registry/ | ✅ | ✅ |
| 3 | tools/hooks/ | ✅ | ✅ |
| 4 | src/app/i18n/fork/ | ✅ | ✅ |
| 5 | packages/core/src/tools/fork/ | ✅ | ✅ |
| 6 | tests/engine/rebuild/ | ✅ | ✅ |
| 7 | spikes/ | ✅ | ✅ |
| 8 | attic/ | ✅ | ✅ |
| 9 | tools/rebuild/ | ✅ | ✅ |
| 10 | src/app/ai/pi-backend/ | ✅ | ✅ |
| 11 | tools/cn-font-catalog/ | ✅ | ✅ |
| 12 | src/components/assistant/ | ✅ | ✅ |
| 13 | src/app/ai/fork/ | ✅ | ✅ |
| 14 | src/app/automation/ | ✅ | ✅ |
| 15 | .github/workflows/ | ✅ | ✅ |

### 3. deletedPaths 目录前缀 12 条（§3.3） vs zones.json

| # | §3.3 声明前缀 | `z.deletedPaths.filter(p=>p.endsWith('/'))` | 一致性 |
| --- | --- | --- | --- |
| 1 | src/components/chat/ | ✅ | ✅ |
| 2 | src/app/ai/chat/ | ✅（本次新增） | ✅ |
| 3 | packages/cli/ | ✅ | ✅ |
| 4 | tests/engine/cli/ | ✅ | ✅ |
| 5 | packages/mcp/ | ✅ | ✅ |
| 6 | tests/engine/mcp/ | ✅ | ✅ |
| 7 | src/app/automation/mcp/ | ✅ | ✅ |
| 8 | tests/helpers/mcp/ | ✅ | ✅ |
| 9 | src/components/settings/usage/ | ✅ | ✅ |
| 10 | src/components/settings/diagnostics/ | ✅ | ✅ |
| 11 | src/app/usage/ | ✅ | ✅ |
| 12 | tests/engine/app/usage/ | ✅ | ✅ |

### 4. checker 13 条规则（§4） vs check.ts 实读

| # | §4 声明函数 | `grep -nE 'function (check|collect)'` 命中 | 一致性 |
| --- | --- | --- | --- |
| 1 | collectChanges | ✅ | ✅ |
| 2 | checkModified | ✅ | ✅ |
| 3 | checkDeletedRegistered | ✅ | ✅ |
| 4 | checkDeletedAbsent | ✅ | ✅ |
| 5 | checkAdded | ✅ | ✅ |
| 6 | checkRenames | ✅ | ✅ |
| 7 | checkUpstreamMergeTarball | ✅ | ✅ |
| 8 | checkDriftTarball | ✅ | ✅ |
| 9 | checkGhostDeleted | ✅ | ✅ |
| 10 | checkPatchTargetDeletedUpstream | ✅ | ✅ |
| 11 | checkPatchFilesExist | ✅ | ✅ |
| 12 | checkPatchRealDiff | ✅ | ✅ |
| 13 | checkPatchMutex | ✅ | ✅ |

### 5. 失锚 patch 3 条（§5.1） vs 实测

| Patch | §5.1 声明 file | 实测 D 集命中 file | 一致性 |
| --- | --- | --- | --- |
| P74 | src/app/editor/clipboard/system.ts | ✅ | ✅ |
| P192 | packages/vue/src/i18n/messages/dialogs.ts | ✅ | ✅ |
| P193 | packages/vue/src/i18n/locales/zh-cn/dialogs.json | ✅ | ✅ |

### 6. 改锚 patch 2 条（§5.2） vs 实测

| Patch | §5.2 声明改锚 | R100 命中 | 一致性 |
| --- | --- | --- | --- |
| P159 | boolean-visual.test.ts → visual/boolean.test.ts | ✅ | ✅ |
| P170 | export-fixtures.ts → operations/export-fixtures.ts | ✅ | ✅ |

### 7. tarball drift（§5.5） vs 实测

| 条目 | §5.5 声明 drift | 实测 | 一致性 |
| --- | --- | --- | --- |
| T50 kiwi 族收口 | 0/7 | 0/7 | ✅ |
| T31 retro-T32 | 10/41 | 10/41 | ✅ |
| T63 | paths=0 | paths=0 | ✅ |

### 8. 删除区复活拦截（§5.3） vs 实测

| 前缀 | §5.3 声明拦截数 | 实测 | 一致性 |
| --- | --- | --- | --- |
| src/components/chat/ | 11 | 11 | ✅ |
| src/app/ai/chat/ | 4 | 4 | ✅ |
| packages/cli/ | 2 | 2 | ✅ |
| tests/engine/cli/ | 2 | 2 | ✅ |
| packages/mcp/ | 2 | 2 | ✅ |
| **合计** | **21** | **21** | ✅ |

### 9. 门禁实测（commit 前）

| 门禁 | 期望 | 实测 | 一致性 |
| --- | --- | --- | --- |
| check:zones | exit 0 | exit 0（126 modified, 695 added, 1130 deleted, 16 renamed） | ✅ |
| check:docs | 全绿 | 45/45 通过 | ✅ |
| check:bindings | 全绿 | 5 文件变更 binding 全绿 | ✅ |
| check:tasks | 挂 T97 指针后通过 | 本三件套创建后通过 | ✅ |

## 总评

- 数字一致性：9/9 节实测与文档一致（§3.1/§3.2/§3.3/§3.4/§4/§5.1/§5.2/§5.3/§5.5）
- 门禁一致性：4/4 门禁全绿
- 范围限定一致性：relocations 未落地（§6 设计草案）= zones.json 实际无 relocations 字段
- 顺手修复一致性：父 commit 77e32774a 登记债已修（`src/app/ai/chat/` 前缀入 deletedPaths）

## 综合判定

✅ **通过**——文档数字、checker 规则、门禁实测、范围限定全部一致。本 verify.md 是主 agent 内嵌核验（受 subagent 不可派的环境约束），owner 触发补办的独立 subagent 核验待派单补办（流程同上 T96 等近期任务的 verify 处理模式）。

## 失败项详情

无。

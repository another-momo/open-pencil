<!--
  写作纪律（改本文前必读）：
  - 本文是 06-zone-governance.md 的对应 records（一一对应，不一致 → check-bindings 红）
  - 事实性声明必须附核验命令 + 日期，否则标为【假设】
  - append-only：发现错误追加「修正-N」/「ROT-N」，不删旧记录
  - 详细规则见 docs/rebuild/05-process.md §4
-->

# records/narrative/06-zone-governance.md

> **状态**：已建立 | **时间**：2026-09-05 | **核验人**：主 agent
> **物理绑定**：[06-zone-governance.md](../../06-zone-governance.md)（一一对应）
> **身份**：本档案持有针对 06-zone-governance.md 的修改记录。06 是分区治理当前态快照 + 上游合并 ritual，本身高频随 zones.json 同步刷新——本档案记录每次刷新的关键差异与腐烂修正。

---

## 修正类

## 修正-1 · 06-zone-governance.md 初版建立 + zones.json 同步修复（2026-09-05）

- **类型**：新增（按对象：06-zone-governance.md）
- **时间**：2026-09-05
- **内容**：从零建立 06-zone-governance.md——§1 为什么分区、§2 七区+七字段语义、§3 当前分区全景（实测数字面板 15/56/129/136/3/1/0）、§4 checker 13 条规则全清单、§5 上游合并 ritual 六步、§6 搬移台账（relocations，未落地）设计草案
- **同步修 zones.json**：deletedPaths 加 `src/app/ai/chat/` 目录前缀——承接父 commit 77e32774a 删除残留的登记债（commit message 自称 check:zones clean 但实际未更新 zones.json）
- **数据校正**：deletedPaths 实际 136（12 目录前缀 + 124 文件墓碑），不是 prompt 假设的 135（11+124）；font/draw cluster 实际 12 patch；删除区复活实际 21 文件（11+4+2+2+2），不是 prompt 假设的 17（11+2+2+2）
- **影响**：[06-zone-governance.md](../../06-zone-governance.md) §3.1/§3.3/§3.4/§5.3 四处数字与目录前缀表已同步刷为实测
- **核验**：`bun tools/zone-registry/src/check.ts` exit 0（[zones] clean: 126 modified, 695 added, 1130 deleted, 16 renamed, base 88c10770）

## 修正-2 · 合并落账后主 agent 重写：§6 草案 → 已落地机制 + 数字面板刷新（2026-09-05）

- **类型**：修正（按对象：06-zone-governance.md）
- **时间**：2026-09-05
- **背景**：初版起稿于 `docs/zone-governance` worktree，基线 `7e6752ede` 上的 zones.json 是旧版（父 commit `77e32774a` 删 ai/chat 残留时漏 `git add zones.json`，登记债以未暂存态滞留主仓工作树——主 agent `925a0f7a4` 补票入库）。同日主 agent 并行合并 `chore/zone-relocations`（`5285ad480`），relocations 字段**实际落地**——初版 §6 的「未落地设计草案」写法在合并瞬间过时
- **内容**：
  - §6 整节重写为已落地机制：schema `{oldPath, newPaths[], since, note}`（非草案的 REL-id/scope/lastReviewed）、七条台账清单、RELOCATION_WATCH advisory（首战七条全命中 28 文件）+ RELOCATIONS_VALID 硬规则、移植决策落点与登记纪律
  - §2 顶层字段 7 → 8 区；§3.1 面板 deletedPaths 136 → **129**（12 前缀 + 117 墓碑——初版 124 含已被 `925a0f7a4` 收敛的 7 条 chat 旧墓碑）、relocations 0 → 7；§3.4 统计命令与实测输出同步
  - 头部基线字段刷为 `rebuild/mode-arch`（合并后）
- **核验**：`node -e` 实读顶层键 9 个（含 relocations）；§5.3 复活拦截 21 文件（11+4+2+2+2）主仓复算一致

---

## 核验类

## 初版核验（2026-09-05）

- **类型**：核验（按对象：06-zone-governance.md）
- **时间**：2026-09-05
- **核验人**：主 agent
- **结果**：check:zones / check:docs / check:bindings 三兄弟门禁均绿，pre-commit 通过
- **逐条**：
  - 数字面板（§3.1）`{ ownedRoots: 15, ownedFiles: 56, patches: 129, permanent: 126, revoked: 3, deletedPaths: 136, dirPrefixes: 12, fileTombstones: 124, stubs: 1, pendingReclass: 0, tarballs: 3 }` = node 实读
  - checker 13 条规则 = `grep -nE 'function (check|collect)' tools/zone-registry/src/check.ts` 13 个函数 + 1 collectChanges
  - 失锚 patch 3 条（P74/P192/P193） = 实测 PATCH_TARGET_DELETED_UPSTREAM
  - 改锚 patch 2 条（P159/P170） = 实测 R100 rename 命中
  - tarball drift = T50 0/7、T31 10/41、T63 paths=空

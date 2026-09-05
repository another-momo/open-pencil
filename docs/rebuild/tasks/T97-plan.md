# T97-plan · 新增 06-zone-governance.md + 同步修 zones.json 父 commit 登记债

> **任务来源**：owner 触发补办路径——文档治理（docs/rebuild/）第二轮增补计划中的「06 分区治理与合并手册」；本任务非 owner 任务卡，是 04-porting-discipline + 02-phase-0 文档体系的第三篇配套操作手册。
> **关联**：[04-porting-discipline.md §5 三态边界判定](../04-porting-discipline.md) + [02-phase-0.md §3.1 zone registry](../02-phase-0.md)（本文是这两篇的「当前态 + 合并 ritual」操作手册配套）；与父 commit 77e32774a 的 zones.json 登记债承接（该 commit message 自称 check:zones clean 但实际未更新 zones.json，本次顺手修复 broken 状态）
> **日期**：2026-09-05

### 背景与动机

rebuild/ 文档集目前 00-05 共 6 篇——00 背景、01 目标态、02 Phase 0、03 Phase 1 runtime、04 移植纪律、05 工作方式——覆盖「为什么、做什么、怎么做、怎么管」，但**缺一篇「分区机制当前态 + 上游合并 ritual」的操作手册**。具体缺：

- **七区+七字段语义**：04 §5 提了 owned/follow+patch/tarball 三态，但 zones.json 实际有 7 个区（含 stubs/pendingReclass/deletedPaths/upstreamMergeTarball/$comment）；relocations 是否存在、deletedPaths 文件墓碑 vs 目录前缀的吸收惯例、stubs 的实际使用——这些都散在多个 commit message 里没有集中文档
- **checker 13 条规则全清单**：check.ts 的 13 个函数（`collectChanges` + 12 个 check）在 commit message 与 check 报告里有零散描述，但没有按「规则 + 函数 + 报错关键字 + 说明」四列整理
- **上游合并 ritual**：05 §3.3 给了「月合并 + 双周窗口」节律，但具体操作步骤（drift 过堂 → 改锚 → 删除区复活 → 移植评估 → tarball 生命周期 → 收口判定）从未文档化——下次大合并（实测上游 +180 commits 自 base）将无 ritual 可循

本次任务把这三块补齐。同步修复父 commit 77e32774a 的 zones.json 登记债（commit 删除 `src/app/ai/chat/{provider-models.ts,system-prompt.md}` 但未在 deletedPaths 加 `src/app/ai/chat/` 目录前缀，导致 pre-commit 红）。

### 改动清单

| 文件 | 改动 |
| ---- | ---- |
| `docs/rebuild/06-zone-governance.md` | **新增**——321 行；§1 为什么分区、§2 七区+七字段语义、§3 当前分区全景（实测数字面板）、§4 checker 13 条规则全清单、§5 上游合并 ritual 六步、§6 搬移台账（relocations，未落地）设计草案 |
| `docs/rebuild/README.md` | 第一层「叙事/决策文档」表格新增一行 06 登记；头部状态字段刷为 2026-09-05；基线刷为 `docs/zone-governance` @ `7e6752ede` |
| `tools/zone-registry/zones.json` | `deletedPaths` 数组加 `"src/app/ai/chat/"` 目录前缀（承接父 commit 77e32774a 删除残留的登记债）；数字变化：deletedPaths 135→136、dirPrefixes 11→12 |
| `docs/rebuild/records/narrative/06-zone-governance.md` | **新增**——物理绑定层档案（check:bindings 一一对应）；含修正-1 + 初版核验条目 |
| `docs/rebuild/records/narrative/README.md` | 追加修正-2 条目（README 登记 06 + 头部刷新） |

### 验收标准

1. `bun tools/zone-registry/src/check.ts` exit 0（[zones] clean: ...）
2. `bun tools/zone-registry/src/check/docs.ts` 全绿
3. `bun tools/zone-registry/src/check/bindings.ts` 全绿（06 ↔ narrative/06、README ↔ narrative/README）
4. `bun tools/zone-registry/src/check/tasks.ts` 挂 task 指针后通过（本任务即 T97）
5. 数字面板与 zones.json 实测一致：ownedRoots 15 / ownedFiles 56 / patches 129（126+3）/ deletedPaths 136（12+124）/ stubs 1 / pendingReclass 0 / tarballs 3
6. checker 13 条规则全清单覆盖实读 [check.ts](../../tools/zone-registry/src/check.ts) 的 13 个函数

### 范围限定

- **不在范围内**：新增 relocations 字段（§6 仅给设计草案，落地以单独 owner 决策为准）；新增 tarball 自动巡检脚本；新增 §5 之外的合并自动化（如 merge 脚本、冲突预解析）
- **顺手修复**：父 commit 77e32774a 的 zones.json 登记债——本任务 commit 内一并修复，使 pre-commit 落地

### 参考

- [04-porting-discipline.md §5](../04-porting-discipline.md)
- [02-phase-0.md §3.1](../02-phase-0.md)
- [05-process.md §4.10](../05-process.md) D14 文件↔record 一一对应
- [05-process.md §4.11](../05-process.md) D15 task 三件套物理拆分
- [zones.json $comment](../../tools/zone-registry/zones.json)
- [check.ts](../../tools/zone-registry/src/check.ts)

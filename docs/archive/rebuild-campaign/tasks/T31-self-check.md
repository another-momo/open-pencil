<!--
  写作纪律（改本文前必读）：
  - 事实性声明必须附核验命令 + 日期，否则标为【假设】
  - 本文只保留当前态，不保留修正历史；修正记入 records/narrative/tasks/T31-self-check.md
-->

# T31 自检 · 上游合并第二轮（88c10770 · 8 commits / 188 文件）

> **状态**：已核验（本地面全过，远端 CI 见 verify） | **时间**：2026-08-25 | **核验人**：主 agent
> **plan**：[T31-plan.md](T31-plan.md)（验收 C1-C5 见 plan §4）
> **分支**：rebuild/pi-upstream-merge-2 | **上游钉扎**：upstream/master @ 88c1077071328b8df68f282543f16e20e97930b4

## 1. 验收对账（C1-C5）

| 验收 | 口径 | 结果 | 证据 |
|---|---|---|---|
| C1 | 内核四 commit 文件全部落盘且与上游快照一致 | ✅ | `diff -r` 对 packages/core/src/vector、packages/vue/src/canvas/vector-input、packages/vue/src/shared/input/vector、src/app/editor/vector、src/app/editor/clipboard 与上游快照一致（2026-08-25） |
| C2 | tool-state.ts 落盘 + ChatMessage 采纳语义且不引入已删面引用 | ✅ | `grep -c 'attachment' src/components/chat/ChatMessage.vue` = 0；`grep classifyToolState src/components/chat/ChatMessage.vue` 命中；`bun test tests/engine/app/chat/tool-state.test.ts` 5/5 绿 |
| C3 | 删除区零复活 | ✅ | `find src/app -path '*ai/acp*' -o -path '*integrations/mcp*' -o -path '*diagnostics*' -o -name 'tools/index.ts'` 零命中（2026-08-25） |
| C4 | 门禁全绿 | ✅ | 见 §2 实录 |
| C5 | 合并记录登记 | ✅ | tracker T31 行 + _index 行 + records/topics/upstream-merge.md append + commit message 含「task: T31」 |

## 2. 门禁实录（本地面，2026-08-25）

| 门禁 | 结果 | 备注 |
|---|---|---|
| check:zones | ✅ | clean（76 modified / 296 added owned / 1028 deleted 全登记）；P60-P82 登记 + ownedFiles +24 + deletedPaths +14 |
| check:docs | ✅ | 39/39 |
| check:bindings | ✅ | 66 文件变更全绿 |
| check:tasks | ✅ | T31 三件套齐全 |
| tsgo + vue-tsc ×2 | ✅ | typecheck 绿（i18n pi* key 合并后 TS2339 清零） |
| oxlint structure+type-aware | ✅ | 0 error 3 warning（warning = max-lines 存量 3 件 + complexity 已修为 0） |
| oxfmt format:check | ✅ | 全过 |
| check:i18n | ✅ | All locale files are in sync |
| check:packages / deps / monorepo / arch | ✅ | 全绿（deps 修复 vector-edit 悬空 import + AppButton/theme-button 补拷后转绿） |
| test:type-shapes / dupes | ✅ | 全绿 |
| smoke:pi 批次 | ✅ | 80 断言全绿（target 6 + history 12 + sessions 14 + assembly 29 + gc 19），无 bun 孤儿 |
| clipboard 新增测试 | ✅ | keyboard + memory 10 断言绿 |
| recovery 测试 | ✅ | 11→14 绿（新增 preferences 3 条） |
| tool-state 测试 | ✅ | 5 断言绿 |
| vector-edit / node-edit-snap 重指测试 | ✅ | 17 断言绿 |

## 3. 八 commit 裁落实录

| commit | 裁定 | 落盘结果 |
|---|---|---|
| bb8c5c18 vector pointer-release | 采纳快进 | vector rename 完成（vector-edit/node-edit 遗留死目录删除 + 新目录落盘 + 测试 import 重指） |
| 7a311677 clipboard 加固 | 采纳快进 | 8 文件落盘 + complexity 超限最小重构（helper 抽取） |
| b65b1bd4 MCP isError | 部分采纳 | tool-state.ts 落盘 + ChatMessage toolState 委托 classifyToolState；attachment 块不采纳（已删面） |
| f75d67ad crash recovery 可配置 | 采纳快进（D33 改判） | 存量加固零交叠，7 文件 + zh-cn/messages i18n 落盘 |
| 5f8a373b diagnostics 地基 | 不采纳 | 维持删除（diagnostics 面未建，引用在 mcp 删除区） |
| 0f981ff2 portless 路由 | 不采纳 | 维持删除（automation/bridge+mcp 删除区） |
| a0a71c34 changelog 审计 | 不采纳 | CHANGELOG.md 未维护 |
| 88c10770 cli import fs | 不采纳 | packages/cli 未启用（B4 依赖 D4 open） |

## 4. 机制幸免事件 / 备注

- **HTTPS 数据面断**：`git fetch upstream` 报 curl 28，本轮不做 git 三路合并，改用 gh api compare + tarball 快照手工裁定落盘（runbook-github-push §2.2 同法）
- **T10 tarball 法遗留债**：上游 rename（vector-edit→vector 等）在 T10 落成了「新目录加、旧目录留」的孤儿死目录，本轮借 bb8c5c18 一并清除
- **i18n 覆盖冲键**：直接拷上游 messages/dialogs.ts + zh-cn/dialogs.json 会把我们 T21 的 26 个 pi* key 冲掉（TS2339 批量报错暴露）；已按 HEAD 定义合并回写 + check:i18n 复绿
- **AppButton/theme-button 上游链**：RecoveryDialog 引用的 AppButton.vue 与 theme/button.ts 不在 f75d67ad commit 清单（上游前序 commit 带入），随本批补拷

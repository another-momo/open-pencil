<!--
  写作纪律（改本文前必读）：
  - 事实性声明必须附核验命令 + 日期，否则标为【假设】
  - 计划被实测推翻时，直接改本文为新版本，完整理由记入 records/ 子文档
  - 本文只保留当前态，不保留修正历史
  - 改完后刷新本文头部的「状态」字段
  - 详细规则见 docs/rebuild/05-process.md §4
-->

# T31 计划 · 上游合并第二轮（88c10770 · 8 commits / 188 文件）

> **状态**：已核验 | **时间**：2026-08-25 | **核验人**：主 agent
> **分支**：`rebuild/pi-upstream-merge-2`（自 2014c81a 拉出）
> **上游钉扎**：`upstream/master @ 88c1077071328b8df68f282543f16e20e97930b4`（`gh api repos/open-pencil/open-pencil/branches/master`，2026-08-25；HTTPS 数据面挂，漂移面与快照均经 gh api 取得）

## 1. 背景与方法

距上次合并（T10，upstream/master@5201404f）上游推进 8 commits。因 HTTPS 数据面断（`git fetch` 报 `curl 28 Recv failure: Connection was reset`，2026-08-25），本轮**不做 git 三路合并**，改用「per-commit 内容裁定 + 手工落盘」：以 `gh api compare` 取 8 commit 各自文件清单、以 tarball 快照取上游新文件内容，按归属分类逐 commit 裁定取舍。

**漂移对账（2026-08-25 实测）**：8 commit / 188 文件；与我们在 5201404f..2014c81a 改动面（1338 文件）交叠 25 文件。

## 2. 八 commit 分类裁定

| commit | 内容 | 裁定 | 理由 |
|---|---|---|---|
| `bb8c5c18` | fix(editor) vector 拖拽 pointer-release 提交 | **采纳（跟随）** | 编辑器内核，`packages/core`+`packages/vue`+`src/app/editor/vector` 全在跟随上游区；我们未改过这些文件 |
| `7a311677` | fix(editor) clipboard 兜底加固 | **采纳（跟随）** | 编辑器内核，`src/app/editor/clipboard`+`shell/keyboard` 跟随上游区 |
| `5f8a373b` | feat(diagnostics) 本地用量与诊断地基 | **不采纳（维持删除）** | `src/app/diagnostics` 我们未建；其引用面在 mcp 删除区（`mcp/pi.ts` 已删）；新功能面，不属内核跟随——如确需另立项 |
| `b65b1bd4` | fix(chat) MCP 结果 optional isError | **部分采纳** | 新增 `tool-state.ts` 采纳（语义修正：MCP `output-available`+`isError:true` 原被误判 done）；ChatMessage.vue 里 attachment 展示块**不采纳**（`@/app/ai/attachment` 已随 T25 删，attach.ts 不产 attachment 数据） |
| `0f981ff2` | fix(mcp) Portless 开发路由隔离 | **不采纳（维持删除）** | 全部落在 `src/app/automation/{bridge,mcp}` + `vite/automation.ts` 删除区/壳区 |
| `f75d67ad` | feat(app) crash recovery 可配置 | **采纳（快进）** | 实测非新功能引入——`document/recovery`/`settings/preferences`/`RecoveryDialog` 存量已在仓（T10 带入），本 commit 只是给存量加「可配置」开关；且与我们 5201404f..2014c81a 改动面零交叠（`grep -E "document/recovery\|settings/preferences" our-changed-files` 零命中，2026-08-25），属存量加固快进，无需 owner 拍板（D33 登记备查） |
| `a0a71c34` | docs changelog 审计 | **不采纳** | CHANGELOG.md 我们未维护 |
| `88c10770` | fix(cli) import 命令改 Node fs | **不采纳** | `packages/cli` 未启用（01 §5 B4 依赖 D4，open） |

## 3. 任务清单

1. **内核两 commit 快进**（bb8c5c18 + 7a311677）：新增/改/重命名文件按上游快照落盘——`packages/core/src/vector/handle-selection.ts` + `packages/vue/src/canvas/vector-input/` + `packages/vue/src/shared/input/vector/` + `src/app/editor/vector/` 重命名批 + `src/app/editor/clipboard/` 加固批 + 对应 tests
2. **ChatMessage 部分采纳**（b65b1bd4）：`src/components/chat/tool-state.ts` 新文件落盘 + ChatMessage.vue 仅采纳「`classifyToolState` 统一入口」语义（替换 T27 的 hasErrorOutput 散点），不采纳 attachment 展示块 + `visibleUserMessageText`（依赖已删面）
3. **删除区零复活核对**：合并后 grep 确认 `src/app/ai/{acp,tools/index.ts}`、`src/app/integrations/mcp`、`src/app/diagnostics`、`src/components/settings/{mcp,models/ProfileEditor}` 仍不在仓
4. **Recovery 面快进**（f75d67ad：存量加固零交叠，测试 11→14 绿）+ D33 登记备查
5. **门禁全绿**（tsgo/vue-tsc×2/lint/zones/docs/i18n/deps/arch/monorepo/tools/type-shapes/packages + check:tasks/bindings/zones/docs + smoke:pi 批次）
6. **T31 三件套收口** + tracker/_index 行 + narrative append + staging 推送 + B.3 复验

## 4. 验收标准

| # | 验收 | 口径 |
|---|---|---|
| C1 | 内核两 commit 文件全部落盘且与上游快照逐字节一致 | `diff -r` 对 `packages/core/src/vector`、`packages/vue/src/canvas/vector-input`、`packages/vue/src/shared/input/vector`、`src/app/editor/vector`、`src/app/editor/clipboard` 与上游快照一致（仅上游新增/改名面） |
| C2 | tool-state.ts 落盘 + ChatMessage 采纳语义且不引入已删面引用 | `grep -c 'attachment' src/components/chat/ChatMessage.vue` = 0；`grep classifyToolState src/components/chat/ChatMessage.vue` 命中；`bun test tests/engine/app/chat/tool-state.test.ts` 绿 |
| C3 | 删除区零复活 | `find src/app -path '*ai/acp*' -o -path '*integrations/mcp*' -o -path '*diagnostics*' -o -name 'tools/index.ts'` 零命中 |
| C4 | 门禁全绿 | 见 §3.5 全套 + smoke:pi 批次 80 断言 |
| C5 | 合并记录登记 | tracker T31 行 + _index 行 + records/topics/upstream-merge.md append + 提交 commit message 含「task: T31」 |

## 5. 不做清单

- 不做 git 三路合并（HTTPS 断 + 我方大量删除会产生 phantom 冲突）；内容裁定替代
- 不把上游 snapshot 目录入库（../upstream-snapshot 在仓外）
- 不动 tests/e2e 快照 PNG（darwin 截图，本机 Windows 不可复跑，跟随上游原样落盘即可）

## 6. 完成时间窗

2026-08-25 单会话收口（内核快进为机械落盘，唯一非机械面是 ChatMessage 语义合并与 Recovery 决策）。

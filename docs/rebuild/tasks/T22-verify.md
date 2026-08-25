<!--
  写作纪律（改本文前必读）：
  - 事实性声明必须附核验命令 + 日期，否则标为【假设】
  - 本文只保留当前态，不保留修正历史
  - 详细规则见 docs/rebuild/05-process.md §4
-->

# tasks/T22-verify.md · T22 独立核验记录

> **T 编号**：T22（Phase 1-pi 实施 · session↔file 绑定）
> **状态**：✅ 独立核验通过（2026-08-24，subagent 独立于实施者核验，HEAD=2640605a @ rebuild/pi）

## 核验项（预审自 [T22-plan.md §2](T22-plan.md) 验收清单 A1-A7 派生）

| #   | 核验项                                                       | 结果 | 证据节 |
| --- | ------------------------------------------------------------ | ---- | ------ |
| V1  | 代码与实施自述一致（D1-D4 全部落地形态）                     | ✅   | §V1    |
| V2  | 回填时序修复（空态重取 + graph:replaced 订阅 + 防复活守卫）  | ✅   | §V2    |
| V3  | 可运行验证（引擎测试 20/20、两个后端冒烟 12/12 + 6/6、lint） | ✅   | §V3    |
| V4  | 浏览器实测证据链合理性（A1/A2/A3/A6 与代码行为自洽）         | ✅   | §V4    |
| V5  | 边界与偏差登记完整性（plan §1.4、A4/A5/A7 覆盖归口）         | ✅   | §V5    |
| V6  | 卫生（无 fixture 改动、无密钥、无本机残留入库）              | ✅   | §V6    |

## V1 代码与自述一致 ✅（2026-08-24 逐文件 Read + grep 调用点）

- **document-key.ts**：铸造仅 `ensurePiDocUuid`（:53-72，写根节点 pluginData `{pluginId:'openpencil.ai', key:'openpencil.ai/docId'}`）。仓内调用点 grep（`grep -rn "ensurePiDocUuid\|resolvePiSessionId\|mintPiSessionId\|getPiDocKeyPrefix\|loadPiChatHistory" src/`）：模块内 = getPiDocKeyPrefix(:86)/mintPiSessionId(:98)/resolvePiSessionId(:106)；模块外仅 attach.ts:18（getPiRequestContext）与 use.ts:28（loadPiChatHistory/mintPiSessionId）——**无任何加载路径调 ensurePiDocUuid**。
- **loadPiChatHistory 只读 + 守卫**（document-key.ts:122-144）：用 `findDocIdEntry` 直读（:126），无 docId 直接 undefined 不铸造（:127）；`storeSessions` 同前缀守卫在 fetch 之前短路（:129）——A6「clear 全程零 history 请求」的代码依据。
- **history.ts**：`toAssistantParts`（:54-75）文本直通 + toolCall→`tool-<name>` part（input-available），thinking 跳过（:72 注释）；`foldToolResult`（:77-89）按 toolCallId 折叠 output-available/output-error。与 plan D3 最小保真一致。
- **service.ts**：`resolveLatestSessionId`（:202-210）= readIndex 键 `startsWith(前缀+'-')` 过滤 + sort + `keys.at(-1)`——定长 UTC 后缀字典序取最新，与 D2 一致。
- **server.ts**：`/api/pi/history` 精确匹配（:193）位于 `/api/pi/` 前缀分支（:208）**之前**；`sessionId` 精确优先、`docKey` 前缀解析兜底二选一（:198-200）；未命中返回 `{sessionId:null, messages:[]}`（:202）。
- **tools.ts**：`document_id` 注入桥 args 外层（:77-78，有值才注入）；schema 仅由 `def.params` 生成（:172-175），**document_id 不进 schema**（target-smoke ④ 实证）。
- **transport.ts**：`sendMessages` 每次发送先 `await this.getContext()` 动态解析（:30），body 带 sessionId + 条件 documentId（:36-38）。
- **use.ts/attach.ts/storage.ts**：pi 模式接线 `loadHistory: loadPiChatHistory` + `onSessionReset → mintPiSessionId`（use.ts:36-44，VITE_PI_BACKEND=1 门控）；attach 工厂传 `() => getPiRequestContext(store)`（attach.ts:31）；storage.ts grep `sessionId|sessionStorage` **零命中**——旧 per-tab UUID 逻辑已删净。

## V2 回填时序修复 ✅（2026-08-24 与 self-check §3.1-17 逐条对读）

- **transports.ts 空态重取**：`(!messages || messages.length === 0) && loadHistory` 时空数组也重跑 loadHistory（:255-257），注释自述 graph:replaced 时序动机（:253-254）；**同 store else-if 分支**：`chat.messages.length === 0` 时补取并灌入，带 `chat === activeChat` 防竞态（:272-278）。
- **ChatPanel.vue graph:replaced 订阅**：`watch(() => activeTab.value?.store, ...)` + `store.onEditorEvent('graph:replaced', …)` 回调里重跑 `ensureChat()` + `onCleanup(stop)` + `{ immediate: true }`（:142-155）；事件本身存在于 `packages/core/src/editor/types.ts:116`、由 `create.ts:216` 在 replaceGraph 时发出——触发链真实存在。
- 与 §3.1-17 描述（常驻挂载 → setup ensureChat 早于导入落定 → 三件套修复）逐点对应，无夸大。

## V3 可运行验证 ✅（2026-08-24 本机全跑，无 LLM key 需求）

| 命令                                                                                                                           | 结果                                |
| ------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------- |
| `bun test tests/engine/scene-graph/plugin-data.test.ts`                                                                        | **20 pass / 0 fail**（48.25s）      |
| `bun spikes/s-pi/backend-smoke/t22/history-smoke.mjs`                                                                          | **12 passed / 0 failed**（一次通过） |
| `bun spikes/s-pi/backend-smoke/t22/target-smoke.mjs`                                                                           | **6 passed / 0 failed**             |
| `bunx oxlint -c oxlint.json --type-aware --type-check <T22 五文件>`                                                            | **0 warnings, 0 errors**            |

- 引擎往返专项实证存在：`plugin-data.test.ts:125-152`「roundtrips root node shared plugin data through fig export/import」，铸 `openpencil.ai/docId` → export/import → 根节点读回 + proxy `getSharedPluginData` 双断言。
- history-smoke 覆盖：docKey 前缀解析族内最新、文本/工具卡片折叠、reasoning 不回填、sessionId 精确读、B 族隔离、未知前缀空族、GET 只读（index.json 不变）。
- target-smoke 覆盖：document_id 注入/缺省不注入/参数透传/结果透传/不进 schema。

## V4 浏览器实测证据链合理性 ✅（2026-08-24 一致性复核，非重跑）

self-check §3.1-18 的四条记录与代码行为一一自洽：

- **A6 零 history 请求** ⟺ 守卫（document-key.ts:129）在 fetch 前短路——clear 后 storeSessions 已有同前缀新铸会话，任何 ensureChat 触发的 loadPiChatHistory 都在发请求前返回 undefined。记录与代码吻合。
- **A3 恰好一次带正确 docKey 的 history 请求** ⟺ 恢复对话框还原 → `graph:replaced`（create.ts:216）→ ChatPanel watcher 重跑 ensureChat → 同 store 走 else-if 补取分支（transports.ts:272-278）一次 fetch；docId 由恢复快照携带（铸造已经 autosave/recovery 落盘，recon 12 链路），docKey 前缀自然一致。
- **A1 发送前零 history 请求 + docId 为 null** ⟺ 铸造仅在 getPiRequestContext（发送时），loadPiChatHistory 无 uuid 直接 undefined 不发请求（:127）。
- **A2 双文档前缀不同** ⟺ docUuid 铸在各自文档根节点，sha1 前缀天然按文件分叉。
- **bind-smoke.mjs 流程与实证一致**（脚本 Read 复核 2026-08-24）：AI tab 激活 `[data-test-id=properties-tab-ai]`（头注释 :12）、发送按钮 `发送消息` 点击提交（:165）、恢复对话框 `恢复` 按钮（:270）、`void openPencil.openFile("/tests/fixtures/circle-text.fig")`（:329）前先 `tabbar-new` 开新 tab（:327）——与 §3.1-19 描述及 §3.1-18 实测路径逐步对应；步骤 ①-④ 映射 A1/A3/A6/A2。
- 浏览器实测由主 agent 以 MCP 完成、本机 `chromium.launch` 起不来【环境限制，§3.3 已登记】——本核验只确认记录与代码、脚本三方自洽，未发现相互矛盾。

## V5 边界与偏差登记 ✅（2026-08-24 对读 plan §1.4 + self-check §3.2/§3.3）

- **plan §1.4「明确不做」五条**在 self-check §3.3 全部有落点：会话列表/多线程 UI（「会话线程列表 UI 不做」）、文件副本/save-as 族谱共享（边界首条）、多浏览器 tab 并发（边界首条 + D5 单窗口前提）、sessionId 映射表（D2 前缀扫描够用，边界「index.json 只增不减」承接 D6 不清理）。
- **recon 副作用**：dirty/autosave 与无 undo 均登记于 §2.5-12（updateNode → sceneVersion++ → 3s 防抖 autosave / recovery 快照；UndoManager 纯显式 push 不进栈），§1.3 plan 侧亦有，双向一致。
- **偏差 1-4**（§3.2）均有代码实证：仅发送时铸造（V1 调用点 grep）、空态重取+守卫（V2）、`readPiDocUuid` 不导出（document-key.ts 导出面 = 6 函数，无该名）、前缀不按 store 缓存（getPiDocKeyPrefix :85-87 每次读当时根节点，resolvePiSessionId :106-113 前缀失配放逐重铸）。
- **A4/A5/A7 覆盖归口**（按 plan §2 表实际编号）：
  - **A4 工具落对文档** → `target-smoke.mjs`（6/6，注入断言 + 非活动 tab id `tab-t22-target` 场景 + 不进 schema）；桥侧落点解析为 `resolveAutomationTarget` 既有能力（target.ts:76-106，桥代码零改动，plan §3.3）。
  - **A5 回归** → self-check §3.1-20：本机 gate 全绿（oxlint/tsgo/vue-tsc/check:zones/prettier），本次核验独立复跑 oxlint 五文件 0 error（V3）；**T19/T20/T21 LLM 依赖冒烟因本机无 OPENROUTER_API_KEY 阻塞，已按规则上报 owner 补 key**——已登记的已知阻塞，非静默缺口。
  - **A7 docId 持久化往返** → 引擎根节点往返专项（plugin-data.test.ts:125-152，V3a 20/20）+ 云文档同管线依据 = §2.5-14（云文档保存 = 同一条 exportFigFile → S3 标准 .fig 字节，加载同一解析管线，docUuid 对云文档同样成立），文档中有据。

## V6 卫生 ✅（2026-08-24）

- `git show --stat HEAD`（2640605a）：18 文件，**无 tests/fixtures/ 下任何 LFS fixture 改动**。
- 密钥扫描：T22 全部改动文件中 `OPENROUTER_API_KEY` 唯一出现为 `history-smoke.mjs:131` 的 `delete backendEnv.OPENROUTER_API_KEY`（子进程环境净化，防泄漏措施而非泄漏）；无 `sk-` 类字面值。
- `git status --porcelain` 输出为空（工作树干净）；`.openpencil/pi-sessions/index.json` 经 `git check-ignore` 确认为 ignored，本机运行残留（.openpencil/ 下 JSONL/index）未入库。

## 总结论

**可以收口。** V1-V6 全部通过：代码与自述逐文件一致；时序修复三件套真实落地且与实测记录自洽；四项可运行验证本机复跑全绿（20/20、12/12、6/6、0 error）；边界/偏差登记完整覆盖 plan §1.4 与 recon 副作用；git 卫生干净。

两条已登记的环境限制不影响收口（均属 §3.3 明示，非代码缺陷）：① 本机 playwright 起不了浏览器，bind-smoke.mjs 留 CI/他机复跑，浏览器侧结论以 MCP 实测记录为准；② T19/T20/T21 LLM 冒烟待 owner 补 OPENROUTER_API_KEY 后补跑（A5 的 CI/全量回归臂）。

## 更正补记（2026-08-25，三方 review 触发）

- **本 verify 的核验清单缺「远端 CI 复验」项**——V1-V6 只覆盖代码/测试/边界/卫生，未含 `gh run view <id>` 复验远端 CI 结论，导致 self-check 与 tracker 登记的「CI 32687026233 全绿」假绿未被发现。
- **实录**（`gh run view <id> -R another-momo/open-pencil --json conclusion`，2026-08-25 复验）：run 32687026233（2640605a）= **failure**、run 32687981729（a52add36）= **failure**，均红于 format:check；format 红被 T23 首 commit 1a78076f 顺带吸收（其 run 32693810508 红于 steiger 而非 format，反证 format 已修复）。
- **教训**：核验范围缩水本身构成打回理由——本表 V1-V6 结论不受影响（均为本机可复跑项），但「可以收口」结论当时缺少 CI 维度佐证。05-process.md 附录 B.3 已追加「verify 必须含远端 CI 复验」强制规则（2026-08-25）；事件完整实录见 [records/topics/ci-infra.md CI-12](../records/topics/ci-infra.md)。

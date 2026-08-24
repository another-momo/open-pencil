<!--
  写作纪律（改本文前必读）：
  - 事实性声明必须附核验命令 + 日期，否则标为【假设】
  - 本文只保留当前态，不保留修正历史
  - 详细规则见 docs/rebuild/05-process.md §4
-->

# tasks/T22-self-check.md · T22 自查记录

> **T 编号**：T22（Phase 1-pi 实施 · session↔file 绑定）
> **状态**：✅ 已收口（2026-08-24，V1-V6 核验通过 + CI 32687026233 全绿）

## 1. 立项依据

T21 收口后按排队序列推进（T20/T21 均留口「session↔file 绑定归 T22」：attach.ts:10 注释、T21-plan §5 边界清单）。

## 2. 侦察事实（注册期，2026-08-24 核验）

### 2.1 文档身份面

1. tab 模型：`Tab { id, store, kind }`，id 为模块级计数器 `tab-N`（`src/app/tabs/index.ts:31-35,47-50`）；多文档多 tab 各持独立 EditorStore；桥响应里的 documentId 即 tab.id（`src/app/automation/bridge/target.ts:100`）
2. `tab-N` 刷新即失效（内存计数器）；同一运行期重开同一文件经 `findTabByFileIdentity` 去重切回已有 tab（`src/app/tabs/index.ts:339-348`）
3. 持久身份原料：`DocumentSourceIdentity { handle, path }`（`src/app/document/io/types.ts:3-6`），`setDocumentSource` 写入（`src/app/document/io/source.ts:96-114`），`getSourceIdentity` 供 tab 去重（`src/app/tabs/open/identity.ts:36-51`）；云文档另有 `StorageDocumentBinding { providerId, documentId }`（`src/app/tabs/index.ts:261-266`）；**无模块把 handle/path 导出为跨重载稳定 document key**

### 2.2 会话面

4. 旧 ToolLoop 聊天历史仅内存 WeakMap&lt;EditorStore, UIMessage[]&gt;（`src/app/ai/chat/transports.ts:117,207-225`），无持久化，刷新全丢
5. pi sessionId 前端生成：sessionStorage per-tab UUID（`src/app/ai/chat/storage.ts:135-145`），attach 时取一次（`src/app/ai/pi-backend/attach.ts:28-30`）；app 内切文件 tab sessionId 不变——前端 WeakMap 显示空会话、后端 session 继续累积，视图发散
6. 后端 session 组织：`.openpencil/pi-sessions/` 下 `index.json` = `Record<sessionId, {file}>`（`src/app/ai/pi-backend/service.ts:54,130-135,180-185`）；`SessionManager.open(indexedFile, sessionsDir)` 恢复 / `create(rootDir, sessionsDir)` 新建（service.ts:95-99）；实测 index.json 已积累 70+ 条目且 key 语义混杂（smoke id 与裸 UUID 并存，ls 2026-08-24）
7. `PiBackendChatTransport.reconnectToStream` 恒 null（`src/app/ai/pi-backend/transport.ts:41-43`）——无历史回填通道

### 2.3 桥目标面

8. `resolveAutomationTarget`：args.document_id 有值 → `getTabById`；无值 → 当前活动 tab（`src/app/automation/bridge/target.ts:76-106`，回退逻辑 :81）；page_id 缺省回退该 tab currentPageId（:90-91）
9. pi 链路不注入 document_id：`callBridgeTool` body 只含 LLM 按 schema 填的 toolArgs（`src/app/ai/pi-backend/tools.ts:72,151-162`）；对比 MCP 侧工具 schema 显式带 document_id 可选参（`packages/mcp/src/tool/registration.ts:21,29-32`）
10. 多窗口 latest-wins：`registerBrowser` 新注册直接覆盖 browserWs、拒绝旧连接 in-flight、关闭旧 socket（`packages/mcp/src/browser-rpc.ts:217-241`）——所有 RPC 打最后注册窗口

### 2.4 实测补记

11. 2026-08-24 in-app 浏览器实测事故：页面切后台被 Chromium 冻结 → WS 开而不处理 → 桥 RPC 20s 超时（create_shape 失败）；前台重载后恢复。佐证「工具落点依赖单一存活窗口」的脆弱性，T22 D4 注入 + 单窗口前提声明与此直接相关

## 2.5 方案 recon（2026-08-23 核验，subagent 四路并行）

12. **pluginData 写副作用**：`setSharedPluginData` = `graph.updateNode(id,{pluginData})` 薄封装（`packages/core/src/figma-api/plugin-data.ts:68-82`）；**不进 undo 栈**（UndoManager 纯显式 push，`packages/scene-graph/src/undo.ts:30-50`；updateNode 无 undo 引用，`packages/scene-graph/src/index.ts:392-440`）；**会触发 `node:updated` → `requestRender` → `sceneVersion++`**（`packages/core/src/editor/graph-events.ts:66-71`、`create.ts:85-92`），dirty = `sceneVersion > savedVersion`（`src/app/document/autosave/create.ts:25`）→ 3s 防抖 autosave（:56-62）或写 recovery 快照（`recovery/controller.ts:75-81`）。全仓无 beforeunload/未保存提示（grep 零命中）。命名空间 `openpencil.ai` 与保留 `open-pencil`（plugin-data.ts:3）不冲突
13. **.fig 根节点往返闭环**：根节点不走通用 sceneNodeToKiwi；`export.ts:475-478` 先 `Object.assign(documentNc, rawNodeFields)` 再 `applyEnabledLibrariesPluginData`（`library-metadata.ts:9-34`）把**根节点整个 pluginData 数组**复制进 DOCUMENT NodeChange（覆盖 rawNodeFields 通道，live 状态胜出）；导入侧 `import.ts:50-60` `applyImportedDocumentMetadata` 原样还原到 rootNode.pluginData。普通节点往返有测试（`tests/engine/scene-graph/plugin-data.test.ts:88-119`），**根节点任意 key 无专项测试**（T22 §3.4 补）
14. **云文档同一管线**：云文档保存 = `exportFigFile`（`src/app/document/io/source.ts:50-53`）→ 本地 IndexedDB + outbox 上传（`src/app/storage/sync/persist.ts:23-52`、`engine.ts:93-135`）；S3 上就是标准 .fig 字节 + meta sidecar（`s3/adapter.ts:192-216`）；加载经 `readFigForTab` 同一解析管线（`src/app/tabs/index.ts:301-306`）。→ docUuid 对云文档同样成立，`providerId:documentId` 兜底退役。唯一真实 provider = S3（`storage/providers.ts:4-20`）
15. **pi 读取面**（关键修正：SessionManager 来自 `pi-coding-agent` 0.84.2 非 pi-agent-core，service.ts:26-31）：`loadEntriesFromFile(path)` 零副作用纯函数（`node_modules/.bun/@earendil-works+pi-coding-agent@0.84.2*/node_modules/@earendil-works/pi-coding-agent/dist/core/session-manager.d.ts:169`）；`SessionManager.open` 对 v3 非空文件事实只读（旧版本迁移重写、空文件写 header 两个陷阱）；**绝不用 createAgentSession 做读**（恢复时写 thinking_level_change，sdk.js:233-237）。**pi 不写 index.json**——index.json 全由我们 service.ts 写入（:78-89,130-135,179-186，grep pi dist 零命中 index.json）；**pi 内部 session id 与我们 index 键是两套 id**（service.ts:99 create 未传 options.id）。JSONL v3 实测结构：首行 `{type:'session',version:3,...}`，消息条目 `{type:'message',message:AgentMessage}`，toolResult 独立 role 按 toolCallId 折叠（实测 `.openpencil/pi-sessions/*.jsonl` 首行 version:3，2026-08-23）

## 3.1 实施事实（2026-08-24 核验）

16. **铸造时机定型为「仅发送时」**：加载/回填路径全程只读。实证依据：Chat 创建期铸造的 docId 在 fig 导入落定后消失——`applyImportedDocumentMetadata`（`packages/core/src/kiwi/fig/import.ts:50-60`）整体赋值 `rootNode.pluginData`，冲掉加载窗口内的写入（recon 13 的 wholesale-assign 语义，2026-08-24 浏览器实测复现：手动 `ensurePiDocUuid` 在导入落定后写入稳定存活，Chat 创建期写入被冲掉）。发送时刻图已稳定，铸造结果经 autosave/recovery 落盘（recon 12 链路）
17. **回填时序缺口与三件套修复**：ChatPanel 常驻挂载（「设计」tab 激活时 `chat-empty-state` 仍在 DOM，2026-08-24 实测）→ setup 的 `ensureChat` 在 restore/导入落定前跑完 → 空 Chat 缓存 → 回填永远错过。修复：`ChatPanel.vue` 订阅活动 store 的 `graph:replaced`（restore/openFile 复用同 store 换图，tab id 不变、不触发既有 watcher，见 `src/app/tabs/index.ts:178-192,204-216`）→ 重跑 `ensureChat`；`transports.ts` 空态重取——WeakMap 缓存为空数组也重跑 `loadHistory`，且同 store 分支补「chat.messages 为空则补取并灌入」；`document-key.ts` 防复活守卫——`storeSessions` 已有同前缀会话（clear 后新铸）时 `loadPiChatHistory` 直接 undefined、不发请求（否则 clear 后任何 ensureChat 触发都会复活族内旧会话并冲掉新铸 sessionId）
18. **浏览器实测（2026-08-24，MCP playwright 驱动；免 key 方案：route 拦截 /api/pi-chat 回灌固定 SSE + 合成 v3 JSONL 种进真实后端 index.json）**：
    - A1：捕获体 `{"sessionId":"doc-74ccb1c6…-20260824T031828Z","documentId":"tab-1","messages":[…]}`；前缀与页内 `sha1(docId)` 一致；发送前 docId 为 null 且零 `/api/pi/history` 请求
    - A3：`persistRecoveryNow()` → reload → 点「恢复」→ DOM 现 `T22-SEED-QUESTION`/`T22-SEED-ANSWER`；history 请求恰好一次且 docKey 前缀正确；恢复后 docId 同一
    - A6：Clear → 空态 → 再发送捕获 `…-20260824T032103Z`（同前缀、新后缀、≠ 种子）；clear 全程零 history 请求（守卫短路）；后端 index.json 种子条目仍在（旧会话归档）
    - A2：新 tab 开 `circle-text.fig` 铸造独立 docId → 前缀 `doc-097f3e25…` ≠ A 族 `doc-74ccb1c6…`；documentId 为 `tab-2`
19. **冒烟复跑全绿（2026-08-24）**：`t22/history-smoke.mjs` 12/12（前缀解析族内最新、文本/工具折叠、reasoning 不回填、GET 只读）、`t22/target-smoke.mjs` 6/6（document_id 注入/缺省/透传、不进 schema）、引擎 `tests/engine/scene-graph/plugin-data.test.ts` 20/20（含新增根节点任意 key .fig 往返专项）；`t22/bind-smoke.mjs` 按实证流程重写（AI tab 激活、发送按钮提交、恢复对话框、void openFile）——本机 playwright `chromium.launch` 建 CDP 管道超时（headless shell 1208 / full 1187 均失败）【环境限制】，浏览器半由 MCP 实测代跑，脚本供 CI/他机复跑
20. **本机 gate（2026-08-24）**：oxlint 全量 0 error（3 个 max-lines warning 均为既有 packages 文件）、tsgo --noEmit 净、vue-tsc 双工程净、check:zones 净、prettier 已格式化改动文件；~~T19/T20/T21 LLM 依赖冒烟因本机无 OPENROUTER_API_KEY 阻塞~~ → **已于 2026-08-24 补跑全绿**（key 在本机 `.openpencil/key-env`，owner 指出后实证）：admin 21/21、settings 11/11（修两处 UI 保存/清除段等响应竞态后）、tools 9/9（重试预算扩到容忍 tool-output-error 模型方差后）、T19 smoke.mjs 15/15、T20 tool-smoke 18/18（keeper wrapper 自开桥执行端）；期间定位两起非产品问题——7703 端口孤儿跨轮污染（T24-self-check §3.3-7 同根因）与 settings 冒烟环境敏感觉态，均已修复/登记。阻塞项至此**完全消解**：CI 无 LLM 冒烟 job（2026-08-24 grep .github/workflows 实证 OPENROUTER/smoke/spikes 零命中，冒烟依赖活浏览器/活桥/活编辑器，属本机验证工具），不存在 CI 补跑面，亦无需登记仓库 secret

## 3.2 与计划的偏差

1. **铸造时机收窄**：plan D1 只写「惰性铸造」未定时机；实施定型为「仅发送时铸造，加载/回填只读」（事实 16 的覆盖窗口杀伤所致）
2. **回填触发面补齐**：plan D3「Chat 创建且本地无消息时拉取」→ 实施增加 graph:replaced 后的空态重取 + clear 防复活守卫（事实 17）。不改 plan 语义（仍只灌空态、不做增量合并），属时序实现细节
3. **readPiDocUuid 不导出**：自定义 lint 规则 `no-useless-pass-through-wrappers` 拦截薄封装 → 内联 `findDocIdEntry` 直调；模块导出面 = ensurePiDocUuid / getPiDocKeyPrefix / mintPiSessionId / resolvePiSessionId / loadPiChatHistory / getPiRequestContext
4. **前缀不按 store 缓存**（plan 未约束）：每次发送读当时根节点，导入覆盖窗口后前缀漂移由 resolvePiSessionId 自愈（缓存前缀失配即放逐重铸）

## 3.3 已知边界

- 文件副本/save-as 同 docUuid 共享会话族谱；同一文件多浏览器 tab 并发时历史发散；多窗口 latest-wins（单窗口为前提约束）；index.json 只增不减无清理策略；会话线程列表 UI 不做（clear 即新会话，旧会话归档可查）
- clear 后极短时间内（新会话铸造未落定，亚毫秒级）即发送，竞态下可能沿用族内旧会话 id——仅 id 归属偏差，无数据损坏；实测 500ms 余量下稳定走新后缀
- 本机 playwright 无法启动浏览器（CDP 管道超时）【环境限制】，浏览器冒烟脚本需在 CI/他机运行

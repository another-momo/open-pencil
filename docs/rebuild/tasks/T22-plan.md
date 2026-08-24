<!--
  写作纪律（改本文前必读）：
  - 事实性声明必须附核验命令 + 日期，否则标为【假设】
  - 本文只保留当前态，不保留修正历史
  - 详细规则见 docs/rebuild/05-process.md §4
-->

# tasks/T22-plan.md · T22 计划

> **T 编号**：T22（Phase 1-pi 实施 · session↔file 绑定：每文件稳定可恢复会话 + 工具落对文档）
> **状态**：🔄 方案定稿（owner 拍板 2026-08-23：pluginData docUuid + 哈希前缀 + 时间戳后缀；四条前置 recon 全过，见 [T22-self-check.md §2](T22-self-check.md)）

## 1. 问题与决策

### 1.1 现状缺口（recon 实证，2026-08-24，证据见 self-check §2）

1. pi sessionId 是**浏览器 tab 级** sessionStorage UUID（chat/storage.ts:135-145），与设计文件无关：app 内切文件 tab 时 sessionId 不变，前端按 EditorStore WeakMap 显示空会话而后端 session 持续累积——前后端视图发散
2. 刷新页面后前端**拿不回**后端已有历史（`reconnectToStream` 恒 null，无历史拉取端点）
3. 桥的目标 documentId 是**运行期 tab 序号**（`tab-N` 内存计数器，刷新即失效），且 pi 链路 `callBridgeTool` 不注入 document_id——工具恒打「最后注册窗口的当前活动 tab」
4. 持久身份原料齐全（`DocumentSourceIdentity {handle, path}`、云文档 `StorageDocumentBinding`）但没有任何模块导出稳定的 document key 给桥/AI 层

### 1.2 决策

> 身份方案经 owner 评审三轮迭代（2026-08-23）：初版 path-hash 被「未保存文件无招」挑战 → pluginData 方案（旧分支 2026-08-18 提案）复活但只存 UUID 不存 sessionId（防泄露/防污染）→ 多 session 由时间戳后缀承接（pi 的 index.json 天然是注册表）。

- **D1 文档身份 docUuid**：文档 UUID 惰性铸造进根节点 sharedPluginData（namespace `openpencil.ai`、key `docId`，存储形态 `{pluginId:'openpencil.ai', key:'openpencil.ai/docId'}`，plugin-data.ts:68-82）——首次 AI 交互时若无则 `crypto.randomUUID()` 铸入。对本地 .fig 与云文档统一成立（云文档走同一条 exportFigFile 管线，S3 上就是标准 .fig 字节，recon 实证 2026-08-23）。**已废弃**：path-hash 方案（重命名断绑、未保存无招）、`providerId:documentId` 云文档兜底（不需要了）、scratch 临时 key（docUuid 在内存里即可用，保存时随文件自然落盘，recovery 快照也携带）
- **D2 sessionId 三段式**：`doc-<sha1(docUuid)>-<yyyyMMddTHHmmssZ>`（UTC 字典序可排）。哈希前缀 = 文件会话族谱身份；时间戳后缀 = 族谱内的第 N 会话。「该文件有哪些会话」= 扫我们自建的 index.json（service.ts:54 `Record<string,{file}>`，pi 自己不写 index，recon 实证）按前缀过滤排序，最新即活跃。**clear 上下文按钮 = 本地铸新后缀**，旧会话 JSONL 归档保留（不做会话列表 UI，留演进路径：将来加本地映射表做多线程，现有主线程 id 原样兼容）
- **D3 会话解析 + 历史回填**：后端新增 `GET /api/pi/history?docKey=<前缀>`——index.json 前缀扫描取最新 sessionId，`loadEntriesFromFile` 零副作用纯读（pi-coding-agent session-manager.d.ts:169，recon 实证）→ UIMessage[]，返回 `{sessionId, messages}`；前端 Chat 创建且本地 WeakMap 无消息时拉取，采用返回的 sessionId 作为当前会话。转换最小保真：user/assistant 文本 + 工具卡片（toolResult 按 toolCallId 折叠回 assistant tool part），reasoning 不回填。**不碰运行中 AgentSession，不经 createAgentSession 做读**（会写 thinking_level_change，sdk.js:233-237）
- **D4 工具目标注入**：chat 请求体加 `documentId`（前端当前 tab.id，运行期值、随发随取不过期）；后端 `callBridgeTool` 注入桥 args 外层 `document_id`（桥 resolveAutomationTarget 原生支持，桥代码零改动）；**不进 core 工具 schema**（不对模型暴露实现细节）
- **D5 多窗口**：维持单窗口前提（桥 latest-wins 已实证），不做窗口路由，写进已知边界
- **D6 session 清理**：不做（index.json 只增不减已有 79 条目，归档/LRU 留后续）

### 1.3 决策副作用与边界（recon 实证 2026-08-23）

- **docId 写入 = 文档变 dirty**：`setSharedPluginData` → `updateNode` → `node:updated` → `requestRender` → `sceneVersion++`（graph-events.ts:66-71、create.ts:85-92），dirty = `sceneVersion > savedVersion`（autosave/create.ts:25）。后果：已保存文件首次对话后 3 秒 autosave 把 docId 静默持久化（自愈通道，正合需求）；未保存文件写 recovery 快照（顺带让「未保存 + 刷新」也能找回 docId）。本仓**不存在**「未保存更改」弹窗/beforeunload（全仓 grep 零命中），无 UX 事故面
- **不进 undo 栈**：UndoManager 纯显式 push（undo.ts:30-50），updateNode 从不记录（index.ts:392-440），Ctrl+Z 不会撤销 docId
- **不触发布局缓存失效**：pluginData 不在 LAYOUT_AFFECTING_KEYS（index.ts:319-356）

### 1.4 明确不做

会话列表/多线程切换 UI（演进路径见 D2）；文件副本/save-as 的会话族谱分叉（副本同 docUuid 共享族谱，记边界）；同一文件多浏览器 tab 并发协同（后端 entry.queue 串行兜底）；pi session 树 fork 暴露到 UI；sessionId 映射表（前缀扫描 index.json 已够用）。

## 2. 验收清单

| #   | 验收项                                                                                                                              | 验证方式                              |
| --- | ----------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| A1  | 文件级稳定会话族：同一文件关闭重开 + 刷新页面后，docKey 前缀相同、GET history 解析出同一最新 sessionId，后端恢复同一 JSONL           | API/浏览器冒烟 + index.json 断言      |
| A2  | 双文档隔离：A/B 两文件 tab 各自会话族，历史互不串（前缀不同 → 两族 sessionId）                                                       | 浏览器冒烟                            |
| A3  | 历史回填：聊过的文件刷新页面后聊天面板显示历史（GET history + 前端灌水，文本+工具卡片）                                              | 浏览器冒烟                            |
| A4  | 工具落对文档：请求带 documentId 时即使该 tab 非活动，shape 也建在指定文档（桥 document_id 路径实证）                                 | API 冒烟（构造非活动 tab 场景）       |
| A5  | chat 面行为兼容 + 回归：T19/T20/T21 冒烟全绿、本地 gate 全绿、CI 绿                                                                  | 回归                                  |
| A6  | clear 新开会话：clear 后 sessionId 同前缀新时间戳，旧会话 JSONL 保留于 index.json 可查；再刷新解析回族内最新会话                     | 浏览器冒烟 + index.json 断言          |
| A7  | docId 持久化往返：首次对话铸 docId → 保存 → 重新打开 → 根节点 pluginData 含 `openpencil.ai/docId`（引擎测试覆盖根节点往返空白）      | 引擎单测 + API 冒烟                   |

## 3. 实施面

### 3.1 前端

- 新增 `src/app/ai/pi-backend/document-key.ts`（owned root 内）：`getDocUuid(store)`——读根节点 `getSharedPluginData('openpencil.ai','docId')`，无则 `crypto.randomUUID()` + `setSharedPluginData` 铸入（副作用见 §1.3）；`docKeyPrefix(uuid)` = `doc-<sha1(docUuid)>`（crypto.subtle.digest）；每 store 缓存当前完整 sessionId（WeakMap），clear 时铸新时间戳后缀
- `attach.ts`/`transport.ts`：transport factory 动态取「当前活动文档」的 sessionId + documentId（`getActiveEditorStore()` → document-key）；POST body 加 `documentId`
- 历史回填：Chat 创建且 WeakMap 无消息时调 `GET /api/pi/history?docKey=<前缀>`，采用返回的 sessionId 并灌入 messages（对接点：transports.ts ensureChat 的 override factory 已按 store 切换，pi 侧在 transport 构造时附带 history loader）
- clear 按钮接线：现有清空逻辑改为「铸新 sessionId + 清本地消息」（旧会话后端归档保留）

### 3.2 后端

- `server.ts`：`GET /api/pi/history?docKey=<前缀>` → `{ sessionId, messages: UIMessage[] }`（族内最新）；可选 `sessionId=<完整>` 精确读取
- `service.ts`：`resolveLatestSessionId(docKeyPrefix)`——readIndex 前缀过滤 + 后缀排序；`readHistory(sessionId)`——index 查 file，`loadEntriesFromFile` 纯读（零副作用，recon 实证 v3 文件 open 也安全但纯函数更稳），`message` 条目转 UIMessage：user/assistant 文本直通、`toolCall`→`tool-<name>` part（input-available）、`toolResult` 按 toolCallId 折叠补 output-available/output-error、reasoning 跳过
- `tools.ts`：`callBridgeTool` 接受可选 `documentId` 注入桥 args 外层；`service.ts` 把请求体 documentId 传入工具闭包（每 session 创建时绑定，随请求更新——session 复用但 documentId 以当次请求为准）
- 请求体契约：`{ sessionId, messages, model?, documentId? }`

### 3.3 桥

零改动（`resolveAutomationTarget` 已支持 args.document_id，`target.ts:81`）。

### 3.4 引擎测试

- `tests/engine/scene-graph/`（或 io/fig/roundtrip/）新增根节点 pluginData .fig 文件级往返测试：根 `setSharedPluginData('openpencil.ai','docId',uuid)` → exportFigFile → parseFigFile → 断言读回（recon 实证现有套件只覆盖普通节点，根节点靠 enabledLibraries 路径隐式覆盖，补专项）

## 4. 冒烟设计（spikes/s-pi/backend-smoke/t22/ 领域目录）

1. **绑定冒烟**：打开保存过的文件 → 发话 → 断言后端 index.json 含 `doc-<sha1>-<ts>` sessionId 且根节点含 docId；刷新页面重开同文件 → GET history 解析同族最新会话、历史回填
2. **双文档隔离冒烟**：A 文件会话发「记住数字 42」→ 切 B 文件会话问「数字是几」→ 不应知道；切回 A → 应记得
3. **刷新回填冒烟**：聊天后刷新页面，断言聊天面板渲染出历史消息（DOM 断言）
4. **目标注入冒烟**：API 直发带 `documentId=<非活动 tab>` 的建 shape 请求 → 桥回读断言节点落在指定文档而非活动 tab
5. **clear 冒烟**：聊过 → clear → 断言新 sessionId 同前缀新时间戳、index.json 两条目并存；刷新后仍解析回最新会话
6. **回归**：T19 smoke.mjs + T20 tool-smoke/browser-tool-smoke + T21 四件

## 5. 风险与边界

- ~~R1 pi 读取 API/格式未知~~ → **已消解**（recon 2026-08-23：`loadEntriesFromFile` 零副作用纯读；JSONL v3 格式实测；toolResult 折叠映射明确）
- **R2**：前端 WeakMap 消息与后端回填历史的双源合并——只在本地无消息时回填，不做增量合并
- **R3**：pi sessionId 与我们 index.json 键是两套 id（service.ts:99 create 未传 options.id，pi 自生 uuidv7）——本方案只动我们自己这层，不碰 pi 内部 id
- 边界：文件副本/save-as 共享会话族谱；同文件多 tab 并发发散；单窗口前提（latest-wins）；index.json 无清理；会话线程列表 UI 不做（演进路径已登记 D2）

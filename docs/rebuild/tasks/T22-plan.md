<!--
  写作纪律（改本文前必读）：
  - 事实性声明必须附核验命令 + 日期，否则标为【假设】
  - 本文只保留当前态，不保留修正历史
  - 详细规则见 docs/rebuild/05-process.md §4
-->

# tasks/T22-plan.md · T22 计划

> **T 编号**：T22（Phase 1-pi 实施 · session↔file 绑定：每文件稳定可恢复会话 + 工具落对文档）
> **状态**：🔄 立项（方案待 owner 过目；recon 已完成，见 [T22-self-check.md §2](T22-self-check.md)）

## 1. 问题与决策

### 1.1 现状缺口（recon 实证，2026-08-24，证据见 self-check §2）

1. pi sessionId 是**浏览器 tab 级** sessionStorage UUID（chat/storage.ts:135-145），与设计文件无关：app 内切文件 tab 时 sessionId 不变，前端按 EditorStore WeakMap 显示空会话而后端 session 持续累积——前后端视图发散
2. 刷新页面后前端**拿不回**后端已有历史（`reconnectToStream` 恒 null，无历史拉取端点）
3. 桥的目标 documentId 是**运行期 tab 序号**（`tab-N` 内存计数器，刷新即失效），且 pi 链路 `callBridgeTool` 不注入 document_id——工具恒打「最后注册窗口的当前活动 tab」
4. 持久身份原料齐全（`DocumentSourceIdentity {handle, path}`、云文档 `StorageDocumentBinding`）但没有任何模块导出稳定的 document key 给桥/AI 层

### 1.2 决策

- **D1 文档 key 派生**：本地文件 = 规范化绝对路径；云文档 = `providerId:documentId`；未保存文档 = `scratch-<tabId>` 运行期临时 key（不持久、不参与绑定）
- **D2 sessionId 确定性派生**：`doc-<sha1(documentKey)>`——同文件永远同 session，**不需要映射表、不需要迁移**；scratch 沿用 sessionStorage per-tab UUID（现状语义）。未保存→首次保存时的 session 迁移**不做**（保存后即按文件 key 开新会话，记边界）
- **D3 历史回填**：后端新增 `GET /api/pi/history?sessionId=`（pi JSONL → UIMessage[]）；前端在 Chat 创建且本地无消息时拉取灌水。解决刷新丢会话
- **D4 工具目标注入**：chat 请求体加 `documentId`（前端当前 tab.id，运行期值、随发随取不过期）；后端 `callBridgeTool` 注入桥 args 外层 `document_id`（桥 resolveAutomationTarget 原生支持，桥代码零改动）；**不进 core 工具 schema**（不对模型暴露实现细节）
- **D5 多窗口**：维持单窗口前提（桥 latest-wins 已实证），不做窗口路由，写进已知边界
- **D6 session 清理**：不做（index.json 只增不减已有 70+ 条目，归档/LRU 留后续）

### 1.3 明确不做

文件重命名/移动的映射迁移（path 变即新 session，记边界）；同一文件多浏览器 tab 的并发协同（后端 entry.queue 串行兜底，前端历史发散记边界）；pi session 树 fork 暴露到 UI。

## 2. 验收清单

| #   | 验收项                                                                                                              | 验证方式                            |
| --- | ------------------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| A1  | 文件级稳定 session：同一文件关闭重开 + 刷新页面后 sessionId 相同，后端恢复同一 JSONL                                | API/浏览器冒烟 + index.json 断言    |
| A2  | 双文档隔离：A/B 两文件 tab 各自会话，历史互不串（前端 WeakMap + 后端两 sessionId）                                  | 浏览器冒烟                          |
| A3  | 历史回填：聊过的文件刷新页面后聊天面板显示历史（GET history + 前端灌水）                                            | 浏览器冒烟                          |
| A4  | 工具落对文档：请求带 documentId 时即使该 tab 非活动，shape 也建在指定文档（桥 document_id 路径实证）                | API 冒烟（构造非活动 tab 场景）     |
| A5  | chat 面行为兼容 + 回归：T19/T20/T21 冒烟全绿、本地 gate 全绿、CI 绿                                                  | 回归                                |

## 3. 实施面

### 3.1 前端

- 新增 `src/app/ai/pi-backend/document-key.ts`（owned root 内）：从 EditorStore source identity 派生 documentKey + sessionId；scratch 文档回退 sessionStorage UUID（沿用 loadPiBackendSessionId 语义，按 tab store 分键）
- `attach.ts`/`transport.ts`：transport factory 动态取「当前活动文档」的 sessionId + documentId（`getActiveEditorStore()` → source identity）；POST body 加 `documentId`
- 历史回填：Chat 创建且 WeakMap 无消息时调 `GET /api/pi/history?sessionId=` 灌入（对接点：transports.ts ensureChat 的 override factory 已按 store 切换，pi 侧在 transport 构造时附带 history loader）

### 3.2 后端

- `server.ts`：`GET /api/pi/history?sessionId=` → `{ messages: UIMessage[] }`
- `service.ts`：`readHistory(sessionId)`——pi SessionManager/JSONL 读取转 UIMessage（**recon 待补**：pi session 文件格式与读取 API，见 §5 风险 R1）
- `tools.ts`：`callBridgeTool` 接受可选 `documentId` 注入桥 args 外层；`service.ts` 把请求体 documentId 传入工具闭包（每 session 创建时绑定，随请求更新——session 复用但 documentId 以当次请求为准）
- 请求体契约：`{ sessionId, messages, model?, documentId? }`

### 3.3 桥

零改动（`resolveAutomationTarget` 已支持 args.document_id，`target.ts:81`）。

## 4. 冒烟设计（spikes/s-pi/backend-smoke/t22/ 领域目录）

1. **绑定冒烟**：打开/新建保存过的文件 → 发话 → 断言后端 index.json 含 `doc-<hash>` sessionId；刷新页面重开同文件 → sessionId 相同、历史回填
2. **双文档隔离冒烟**：A 文件会话发「记住数字 42」→ 切 B 文件会话问「数字是几」→ 不应知道；切回 A → 应记得
3. **刷新回填冒烟**：聊天后刷新页面，断言聊天面板渲染出历史消息（DOM 断言）
4. **目标注入冒烟**：API 直发带 `documentId=<非活动 tab>` 的建 shape 请求 → 桥回读断言节点落在指定文档而非活动 tab
5. **回归**：T19 smoke.mjs + T20 tool-smoke/browser-tool-smoke + T21 四件

## 5. 风险与边界

- **R1**：pi JSONL → UIMessage 转换保真度（reasoning/tool call parts 的映射、中断回合的残帧）——实施前先 recon pi SessionManager 读取 API 与文件格式，转换只做「用户/助手文本 + 工具卡片」最小保真，reasoning 不回填
- **R2**：前端 WeakMap 消息与后端回填历史的双源合并——只在本地无消息时回填，不做增量合并
- 边界：文件移动/重命名断绑；未保存文档不绑定；同文件多 tab 并发发散；单窗口前提（latest-wins）；index.json 无清理

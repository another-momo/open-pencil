<!--
  写作纪律（改本文前必读）：
  - 事实性声明必须附核验命令 + 日期，否则标为【假设】
  - 本文只保留当前态，不保留修正历史
  - 详细规则见 docs/rebuild/05-process.md §4
-->

# tasks/T22-self-check.md · T22 自查记录

> **T 编号**：T22（Phase 1-pi 实施 · session↔file 绑定）
> **状态**：🔄 方案定稿（两轮 recon 全过；owner 已拍板 docUuid 方案）

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

## 2.2 实施事实

（待实施期回填）

## 2.3 与计划的偏差

（待实施期回填）

## 2.4 已知边界

- 文件副本/save-as 同 docUuid 共享会话族谱；同一文件多浏览器 tab 并发时历史发散；多窗口 latest-wins（单窗口为前提约束）；index.json 只增不减无清理策略；会话线程列表 UI 不做（clear 即新会话，旧会话归档可查）

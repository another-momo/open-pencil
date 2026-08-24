<!--
  写作纪律（改本文前必读）：
  - 事实性声明必须附核验命令 + 日期，否则标为【假设】
  - 本文只保留当前态，不保留修正历史
  - 详细规则见 docs/rebuild/05-process.md §4
-->

# tasks/T22-self-check.md · T22 自查记录

> **T 编号**：T22（Phase 1-pi 实施 · session↔file 绑定）
> **状态**：🔄 立项（注册期 recon 已完成）

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

## 2.2 实施事实

（待实施期回填）

## 2.3 与计划的偏差

（待实施期回填）

## 2.4 已知边界

- 文件重命名/移动后 path 变 → 新 session（不迁移）；未保存文档不绑定；同一文件多浏览器 tab 并发时历史发散；多窗口 latest-wins（单窗口为前提约束）；index.json 只增不减无清理策略

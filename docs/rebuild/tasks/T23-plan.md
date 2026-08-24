<!--
  写作纪律（改本文前必读）：
  - 事实性声明必须附核验命令 + 日期，否则标为【假设】
  - 本文只保留当前态，不保留修正历史
  - 详细规则见 docs/rebuild/05-process.md §4
-->

# tasks/T23-plan.md · T23 计划

> **T 编号**：T23（Phase 1-pi 实施 · 会话查看/切换 UI）
> **状态**：🔄 立项（owner 直接诉求 2026-08-24：「能直观看到绑定关系对不对、方便切到另一 session 继续对话」）

## 1. 问题与决策

### 1.1 现状缺口（证据见 self-check §2）

1. T22 落地了会话族谱（index.json 前缀族）与刷新回填，但「会话线程列表 UI」被划入明确不做（T22-plan §1.4）——页面上看不到一个文档有哪些会话、当前绑哪个，也切不回旧会话继续聊。owner 2026-08-24 提出本项，即废止该条不做约定
2. 后端事实源已具备：`.openpencil/pi-sessions/index.json` = `Record<sessionId,{file}>`，族 = `startsWith(前缀+'-')` 键集合（service.ts:86 readIndex、:202 resolveLatestSessionId 同法）；`readHistory(sessionId)` 精确读已在（service.ts:212，T22 落地）
3. 前端切换所需挂钩已具备：`storeSessions` WeakMap（document-key.ts，T22）+ `chat.messages` 可整体赋值（ChatPanel 既有用法）+ `ensureChat` 切 tab 时自动缓存/恢复（transports.ts）

### 1.2 决策

- **E1 后端族谱清单**：`GET /api/pi/sessions?docKey=<sha1 前缀>` → `{sessions:[{sessionId,title,messageCount,updatedAtMs}]}`。title = 首条用户消息文本截断 40 字；updatedAtMs = 会话文件 mtime；按 sessionId 后缀字典序**倒序**（定长 UTC 后缀 → 最新在前，T22 D2 性质）。复用 `readPiHistoryFile` 折叠结果派生摘要；**绝不用 createAgentSession 做读**（写 thinking_level_change，T22-self-check §2.5-15）。全程只读：不写 index.json、不改 JSONL、不开新会话
- **E2 前端只读拉取**：`listPiSessionFamily(store)` 无 docId → undefined（不发请求、不铸造，同 T22 loadPiChatHistory 纪律）；`switchPiSession(store, sessionId)` = `GET /api/pi/history?sessionId=<id>` 精确读 → 命中则 `storeSessions.set(store, sessionId)` 并返回 messages，失败/空返回 null
- **E3 UI**：ChatPanel 顶部加会话栏——reka DropdownMenu + menu.ts 样式（CanvasPaneHeader.vue:59-70 同例）。触发钮显示当前会话标签（后缀派生本地时间，如 `08-24 03:18`；无会话显示 `Sessions`），title 提示完整 sessionId（绑定关系直查）。下拉项 = 族内会话（时间 + 首条用户消息预览 + 消息条数），当前会话勾标。选中即切换：ensureChat 后整体替换 `chat.messages` 并采用该 sessionId，后续发送续写该会话。streaming/submitted 期间禁用切换
- **E4 新建会话仍走既有 Clear 按钮**（族内新后缀，T22 D2），下拉不重复造入口
- **E5 空态**：无 docId（从未 AI 交互）或族为空 → 菜单内「No sessions yet」禁用项；触发钮常开（空态本身就是绑定关系的直观呈现）

### 1.3 决策副作用与边界

- 清单在下拉打开时实时拉取（localhost 后端、族规模小）；不做轮询/订阅/缓存
- 切换 = 整体替换 chat.messages（不增量合并、不动画布、不进 undo）；输入框草稿不受影响
- 切换后切 tab 再切回：ensureChat 既有 WeakMap 缓存语义自动保留切换后消息（transports.ts:213-215 缓存先行）
- 排序键 = 创建后缀（定长字典序），展示时间亦从后缀派生（本地时区格式化）；mtime 仅作 updatedAtMs 字段透出，UI 暂不展示

### 1.4 明确不做

- 跨文档会话跳转（族按文档隔离，切文档用 tab）
- 会话重命名/删除/清理（延续 T22 D6：index.json 只增不减）
- 会话搜索/分页/虚拟滚动
- 切换会话本身的 undo

## 2. 验收清单

- B1 族谱清单：`GET /api/pi/sessions?docKey=` 返回族内全部会话（合成 ≥2 条族 + 孤族对照），字段齐（sessionId/title/messageCount/updatedAtMs），最新在前；未知前缀 → 空数组
- B2 只读：list 请求前后 index.json 与全部 JSONL 内容不变、根节点无 docId 时前端零请求
- B3 UI 可见：下拉列出族内会话（时间 + 预览 + 条数）、当前会话勾标、无 docId 文档禁用态
- B4 切换续聊：选中旧会话 → 面板消息替换为该会话内容 → 再发送捕获体 sessionId = 被选会话（同族旧后缀，不铸新）
- B5 隔离：两个文档各自下拉只列本族会话
- B6 回归：clear 仍铸族内新后缀（T22 A6 不破）；刷新恢复回填仍取族内最新（T22 A3 不破）

## 3. 实施面

### 3.1 后端

- `service.ts`：`listSessionFamily(docKeyPrefix)` — readIndex 键过滤 + 逐条 `readPiHistoryFile` 派生摘要 + sort 倒序；返回类型入 `PiChatService`
- `server.ts`：`GET /api/pi/sessions` 精确路由置 `/api/pi/` 前缀分支**之前**（与 history 路由同例，server.ts:193 vs :208），仅收 docKey

### 3.2 前端

- `document-key.ts`：`PiSessionSummary` 类型 + `listPiSessionFamily(store)` + `switchPiSession(store, sessionId)`
- `ChatPanel.vue`：顶部会话栏（DropdownMenuRoot/Trigger/Content/Item + menuCls），打开时拉清单；切换 → `await ensureChat()` → `chat.messages = msgs`；状态条 streaming/submitted 时禁用

### 3.3 测试/冒烟

- `spikes/s-pi/backend-smoke/t23/sessions-smoke.mjs`：合成族（两时间戳 + 孤族对照 + 未知前缀）→ B1/B2 断言（复用 t22 history-smoke 的随机端口 + backendExited watch + taskkill 清理范式）
- 浏览器半（MCP 实测，免 key 拦截方案同 T22）：B3/B4/B5/B6；流程固化进 `t23/sessions-bind-smoke.mjs` 供 CI/他机复跑（本机 playwright CDP 起不来，T22-self-check §3.3 环境限制延续）
- 引擎无改动

## 4. 风险与边界

- 族内长会话全量读文件派生摘要：族规模小 + localhost，可接受；后续若慢可改头部扫描轻解析
- 标签硬编码英文（Sessions/No sessions），与 ChatPanel 既有 `Clear`/`Copy log` 硬编码同例；check:i18n 只校验 locale 文件结构（tools/i18n/src/check-locales.ts），不管模板硬编码
- 单窗口前提延续（T22 D5）；多窗口 latest-wins 语义不变

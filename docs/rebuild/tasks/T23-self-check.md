<!--
  写作纪律（改本文前必读）：
  - 事实性声明必须附核验命令 + 日期，否则标为【假设】
  - 本文只保留当前态，不保留修正历史
  - 详细规则见 docs/rebuild/05-process.md §4
-->

# tasks/T23-self-check.md · T23 自查记录

> **T 编号**：T23（Phase 1-pi 实施 · 会话查看/切换 UI）
> **状态**：🔄 实施完成待核验（owner 直接诉求 2026-08-24）

## 1. 立项依据

T22 收口当日 owner 体验后提出：「前端有做查看/切换 session 的功能嘛？这样我能直观的看到是不是绑定关系是对的、也能方便的切到另一 session 继续对话」——即废止 T22-plan §1.4 的「会话线程列表 UI 不做」约定，捞回实施。

## 2. 侦察事实（注册期，2026-08-24 核验）

1. 后端族谱事实源现成：`readIndex()` 读 `.openpencil/pi-sessions/index.json`（`src/app/ai/pi-backend/service.ts:86`）；族解析先例 = `resolveLatestSessionId` 的 `startsWith(前缀+'-')` + sort（service.ts:202-210）；精确读先例 = `readHistory(sessionId)`（service.ts:212-216，经 index 键→文件→`readPiHistoryFile`）
2. pi 读取陷阱沿用 T22 recon 15：`createAgentSession` 会写 thinking_level_change，读取只能走 `readPiHistoryFile`（纯 readFileSync + parseSessionEntries，`src/app/ai/pi-backend/history.ts`）
3. 前端会话状态挂钩现成：`storeSessions` WeakMap + `resolvePiSessionId` 前缀校验自愈（document-key.ts，T22）；`chat.messages` 可整体赋值（ChatPanel.vue 图片附件路径既有用法）；`ensureChat` 每次调用先把当前 chat.messages 缓存进 WeakMap（transports.ts:213-215）——切换会话后切 tab 不丢
4. UI 原语：reka-ui `DropdownMenuRoot/Trigger/Portal/Content/Item` + `@/components/ui/menu` 的 `useMenuUI()` 样式槽（`src/components/canvas/CanvasPaneHeader.vue:5-9,59-70` 同例）；ChatPanel 已有硬编码英文标签先例（`Clear`/`Copy log`，ChatPanel.vue:334-345）
5. i18n 门禁范围：`tools/i18n/src/check-locales.ts` 只校验 `packages/vue/src/i18n/locales` 下 locale 文件结构与翻译完整性，不管组件模板硬编码字符串
6. ChatPanel 常驻挂载（T22 事实 17）：会话栏加在面板顶部即全程可见，不随属性 tab 切换卸载

## 3.1 实施事实

1. 后端 `GET /api/pi/sessions?docKey=<前缀>`：路由在 `/api/pi/` 前缀分支之前（`src/app/ai/pi-backend/server.ts`），非 GET → 405，docKey 缺失/未知 → 空数组；`PiChatService.listSessionFamily`（`service.ts`）= `readIndex()` 键 `startsWith(前缀+'-')` 过滤 → `sort().reverse()`（后缀定长 UTC，字典序=创建序）→ `summarizeSession`（标题=首条 user 文本 slice(0,40)、messageCount=折叠后消息数、updatedAtMs=statSync mtimeMs）。全程只读（`readPiHistoryFile` + `statSync`，不触 `createAgentSession`）。核验：`bun spikes/s-pi/backend-smoke/t23/sessions-smoke.mjs` 14/14（2026-08-24）
2. 前端只读族谱/切换函数（`src/app/ai/pi-backend/document-key.ts` 尾部）：`hasPiDocId`（无 docId → 不发请求不铸造）、`listPiSessionFamily`（fetch 包装，出错 undefined）、`getPiCurrentSessionId`（storeSessions 直读）、`switchPiSession`（前缀守卫 `startsWith(前缀+'-')` + 响应 `sessionId` 回显校验，双保险防跨族收养；命中则 `storeSessions.set` 并返回消息）
3. ChatPanel 会话栏（`src/components/ChatPanel.vue`）：`v-if="PI_BACKEND"` 置顶于 ScrollArea 之上；触发器标签 = 当前会话 `MM-dd HH:mm`（无则 `Sessions`，title=完整 sessionId）；菜单项 `${时间} · ${标题} · N msgs` 新→旧，当前项前置勾图标；空族 → 禁用 `No sessions yet` 项；当前会话不在族谱（本地新铸未持久化）→ 顶部禁用 `new session` 占位项（带勾）。`refreshSessionMeta` 挂钩：setup ensureChat 后 / tab 切换 watcher / `graph:replaced` / 发送后 / clear 后（setTimeout 100ms 等 mint 微任务）
4. 切换发送语义：切到旧会话后 `resolvePiSessionId` 命中缓存同前缀 → 请求沿用旧 sessionId。实证：MCP 拦截捕获切换后发送 body.sessionId = OLD 会话 id（2026-08-24）
5. 浏览器实测全绿（MCP playwright，2026-08-24）：首发后触发器 `Sessions → 08-24 12:47`；种 OLD/MID 双会话 → persistRecoveryNow → 刷新 → 恢复 → MID 回填（DOM 见 MID Q/A、无 OLD 串扰，触发器 title=MID）；下拉 2 项新→旧、标题/消息数正确、勾在 MID；点 OLD → DOM 切换 → 发送沿用 OLD；第二文档（新 tab + circle-text.fig）不铸 docId、下拉仅禁用空族项；Clear → 铸同前缀新后缀（OLD/MID/首发均不同）
6. 冒烟固化：`node spikes/s-pi/backend-smoke/t23/sessions-bind-smoke.mjs` 19/19（2026-08-24）；同轮修好 t22 bind-smoke 三处工具病（见 3.2-3）→ 15/15
7. 工具链实证（2026-08-24，已写进两个冒烟头注释）：① bun 跑 playwright `chromium.launch` 卡 CDP pipe 握手 180s 超时，node 秒起——浏览器冒烟必须用 node；② 脚本无配置文件时 `getByTestId` 默认属性 `data-testid` 不匹配仓内 `data-test-id`，须 `selectors.setTestIdAttribute('data-test-id')`；③ 旧修订版 chromium_headless_shell（如 1208 配 playwright-core 1.62）能起进程但 locator 全废——`resolveChromiumExecutable` 先查 `chromium.executablePath()` 钉死版存在则走默认解析；④ 菜单打开是异步 fetch，断言前须等 `/api/pi/sessions` 响应落定，否则读到占位态

## 3.2 与计划的偏差

1. E5 修订（计划期已定调，实施照此）：触发器恒可用，空族靠菜单内禁用项表达（AppTextButton 无 disabled prop），而非禁用触发器
2. 计划 §3.3 冒烟运行命令写作 bun，实测 bun 无法起浏览器（3.1-7①）——冒烟头注释改为 node 并实证留因
3. t22 bind-smoke 原计划外修复：该文件自写入起从未真正跑绿（getByTestId 属性不匹配 + bun 启动卡死），本轮一并修复并首证 15/15；另补恢复后 docId 读取竞态（还原异步，轮询等落位再比对）
4. 下拉当前项指示用自定义勾 svg（reka DropdownMenuItem 无内置选中态），冒烟按 path 字符串断言——耦合图标实现，换图标需同步冒烟

## 3.3 已知边界

1. 流式进行中禁止切换（submit/streaming 状态下切换入口拦截）——切换即弃流由 Clear 承担，不在本任务范围
2. 继续旧会话不改族谱新旧序：排序键=创建时刻后缀（字典序），向旧会话追加消息后刷新回填仍取族内最新后缀会话；被继续的旧会话可经下拉再次切回（updatedAtMs=mtime 仅供展示参考，不参与排序）
3. 时间标签格式 `MM-dd HH:mm` 不含年份——跨年同月日的会话标签撞脸（实测 OLD/MID 均显示 `01-01 08:00`），区分靠标题与 title 悬浮完整 sessionId；如需改进另立任务
4. 拦截/未落盘的本地新会话在后端族谱中不存在——下拉以禁用 `new session` 占位项如实呈现（E5 设计内行为，非缺陷）
5. 切换是客户端整体替换 `chat.messages`：pi 侧不做增量合并，切换瞬间未 flush 的本地流式增量丢失（流式中本就被边界 1 拦截）

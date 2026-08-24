<!--
  写作纪律（改本文前必读）：
  - 事实性声明必须附核验命令 + 日期，否则标为【假设】
  - 本文只保留当前态，不保留修正历史
  - 详细规则见 docs/rebuild/05-process.md §4
-->

# tasks/T23-verify.md · T23 独立核验记录

> **T 编号**：T23（Phase 1-pi 实施 · 会话查看/切换 UI）
> **状态**：✅ 核验通过（独立 subagent 2026-08-24，总结论「可以收口」）

## 核验项（预审自 [T23-plan.md §2](T23-plan.md) 验收清单 B1-B6 派生）

| #   | 核验项                                                                       | 结果 | 证据节 |
| --- | ---------------------------------------------------------------------------- | ---- | ------ |
| V1  | 代码与自述一致（E1-E5 落地形态：list 路由只读、前端拉取不铸、切换采用 sessionId） | ✅    | §V1    |
| V2  | 可运行验证（t23 sessions-smoke 全绿 + lint/type/zone gate）                   | ✅    | §V2    |
| V3  | 浏览器实测证据链合理性（B3/B4/B5/B6 与代码行为自洽）                           | ✅    | §V3    |
| V4  | T22 回归不破（A3 回填/A6 clear 语义、A5 document_id 注入不受影响）             | ✅    | §V4    |
| V5  | 边界登记完整性（plan §1.4 不做项、mtime/排序语义、单窗口前提）                 | ✅    | §V5    |
| V6  | 卫生（无 fixture 改动、无密钥、无本机残留入库）                                | ✅    | §V6    |

## 核验证据（独立 subagent 亲跑，2026-08-24）

### §V1 代码与自述一致 ✅

- `server.ts`：`/api/pi/sessions` 精确路由（:210）置于 `/api/pi/` 管理面前缀分支（:219）之前；非 GET → 405；docKey 缺失 → `{sessions: []}`。
- `service.ts`：`listSessionFamily`（:245-255）= readIndex 键前缀过滤 + `sort().reverse()` + `summarizeSession`（:229-243：title=首条 user 文本 slice(0,40)、messageCount=折叠后条数、updatedAtMs=statSync mtimeMs）；读取面只走 `readPiHistoryFile` + `statSync`，**不触 createAgentSession**。
- `document-key.ts`：`hasPiDocId` 只读不铸造；`listPiSessionFamily` 无 docId → undefined 零请求；`switchPiSession` 前缀守卫 + 响应 sessionId 回显校验双保险，命中才 `storeSessions.set`。
- `ChatPanel.vue`：会话栏 `v-if="PI_BACKEND"` 置顶；空族禁用项 + `currentSessionMissing` 未落盘占位项齐全；`refreshSessionMeta` 五处挂钩齐全；`handleSwitchSession` 流式拦截（streaming/submitted 直接 return）。

### §V2 可运行验证 ✅（核验员 2026-08-24 实跑）

- `bun spikes/s-pi/backend-smoke/t23/sessions-smoke.mjs` → **14/14**（含只读断言：index.json/JSONL 内容+mtime 不变、未知前缀/缺参空数组、405、B 族隔离）。
- `bunx oxlint -c oxlint.json --type-aware --type-check`（5 个触动文件）→ **0/0**；`bunx tsgo --noEmit` → exit 0。
- `node spikes/s-pi/backend-smoke/t23/sessions-bind-smoke.mjs`（dev server localhost:1420）→ **19/19**，覆盖 B3/B4/B5/B6。

### §V3 证据链合理性 ✅

- self-check §3.1-3/4 声明与代码逐一吻合（触发器标签来源、占位逻辑、切换后 `resolvePiSessionId` 缓存命中沿用旧 sessionId 机理）；§3.1-5 浏览器实测声明被核验员 bind-smoke 19/19 复现。
- 核验员深挖并查明一个表面矛盾：第二文档「下拉仅禁用空族项」与 ChatPanel 常驻单例 + `sessionList` 不清空的静态推演冲突——实证机理为 tabbar-new 走 home tab 绕行（WorkspaceView `v-if` 卸载重挂载，sessionList 归零），声明在实测路径成立。

### §V4 T22 回归 ✅

- 代码层：防复活守卫（document-key.ts:117）、graph:replaced 挂钩（ChatPanel.vue:154-168）、`getPiRequestContext` documentId 注入（:137-145）均未动。
- 实跑：`bun spikes/s-pi/backend-smoke/t22/history-smoke.mjs` → **12/12**；`node spikes/s-pi/backend-smoke/t22/bind-smoke.mjs` → **15/15**。

### §V5 边界登记 ✅

- 排序语义/mtime 仅展示、年份缺失撞脸、流式禁切换、未落盘占位、整体替换语义均在 [T23-self-check.md §3.3](T23-self-check.md)；plan §1.4 四项不做（跨文档跳转/重命名删除/搜索分页/切换 undo）代码中确无实现。
- 核验员附赠发现一处未登记角落（两文档 tab 直接互切时 stale 清单残影，前缀守卫兜底无数据风险）——已补登记为 §3.3-6。

### §V6 卫生 ✅

- `git show 1a78076f | grep -i -E "OPENROUTER|api.?key|sk-"` 仅命中环境变量名/标识符，无真实密钥；无 `D:\`/`C:\Users` 硬编码入库（冒烟内 `.openpencil/pi-sessions` 为 `join(process.cwd(), ...)` 运行期拼接）；`.openpencil/` 零入库；`--stat` 15 文件无 tests/fixtures 改动；冒烟后种子自洁、index.json 已还原。

## 整改翻转记录（核验后 CI 两轮红 → 绿）

1. run 32693810508（1a78076f）红：steiger `no-native-title-attributes-in-vue`（触发器 `:title` 属性）→ 14b6d9e2 换 `Tip` 组件，冒烟断言同步改标签口径，本地 check:arch ✅ + bind-smoke 19/19 复绿（2026-08-24）。
2. run 32694435629（14b6d9e2）红：test:type-shapes 禁 `PiSessionSummary` 前后端同构镜像 → 62691d09 抽 `session-summary.ts` 纯类型契约单一事实源，type-shapes ✅ + 双冒烟复绿（14/14、19/19，2026-08-24）。
3. 远端 CI rebuild/pi run **32695035580**（62691d09）**全绿**。

> 核验员报告针对 1a78076f 给出「可以收口」，并标记核验窗口内的并行修改——即上述整改 1/2 两笔（实施者本人所为，已提交并对新态复跑核验）；整改未改变 V1-V6 任一结论（Tip 重构为等价呈现替换，类型单源化为零行为变更重构）。

## 总结论

**可以收口。** T23 会话查看/切换：V1-V6 全过 + CI 三轮后全绿（32695035580）。

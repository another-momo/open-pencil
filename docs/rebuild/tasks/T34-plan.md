<!--
  写作纪律（改本文前必读）：
  - 事实性声明必须附核验命令 + 日期，否则标为【假设】
  - 计划被实测推翻时，直接改本文为新版本，完整理由记入 records/ 子文档
  - 本文只保留当前态，不保留修正历史
  - 改完后刷新本文头部的「状态」字段
  - 详细规则见 docs/rebuild/05-process.md §4
-->

# T34 计划 · 上游合并第三轮（octopus 8 commits）

> **状态**：执行中 | **时间**：2026-08-27 | **负责人**：主 agent
> **分支**：`rebuild/upstream-merge-2`（自 `rebuild/pi (36ad5c17)` 拉出）
> **上游钉扎**：88c10770 → 本轮追平
> **merge 形态**：octopus（8 commits 一次性合并到 `rebuild/upstream-merge-2`）

## 1. 合并目标与范围

T31 第二轮合并（`c0c1f117 task: T31 上游合并第二轮`）的 base 钉到 `88c10770`。此后上游又走了 8 个 commit，全部纳入本轮：

| SHA | 类型 | 标题 |
|---|---|---|
| `88c10770` | fix(cli) | use Node fs for import command |
| `a0a71c34` | docs | audit recent changelog entries |
| `7a311677` | fix(editor) | harden clipboard fallbacks |
| `b65b1bd4` | fix(chat) | treat MCP results with optional isError correctly |
| `5f8a373b` | feat(diagnostics) | add local usage and diagnostics foundation |
| `bb8c5c18` | fix(editor) | commit vector drags on pointer release (#586) |
| `f75d67ad` | feat(app) | make crash recovery configurable |
| `0f981ff2` | fix(mcp) | isolate Portless development routes |

owner 决策（2026-08-27 启动时）：「整体一起拉个合并分支推进合并，不要单独拆开」——即 8 commit 一次性 octopus。

## 2. 冲突盘点（merge 算法自动合并后的产物）

merge 后 `git status` 报 23 个冲突，分三类：

### 2.1 modify/delete 冲突（5 个，上游改/我们删）

`git rm` 取**我们删除**侧（保留我们的产品决策，T25/T27 主动清理）：

- `src/app/ai/acp/transport.ts`（T25 soft-cut acp）
- `src/app/ai/tools/index.ts`（T27 三方 review）
- `src/app/integrations/mcp/pi.ts`（T25 三路径收敛）
- `src/app/integrations/mcp/runtime.ts`（T25 三路径收敛）
- `src/components/settings/mcp/MCPConnectionsSection.vue`（T25 旧设置面切）
- `src/components/settings/models/ProfileEditor.vue`（T25 旧设置面切）

> **附误操作纠正**：merge 阶段误把 `src/components/ui/AppTextButton.vue` 当作 modify/delete 处理（上游 5f8a373b 删除它）。事后发现 `AppTextButton.vue` 是 T32 转 owned 的「保留存在」文件——**已 git checkout HEAD 恢复**。详见 self-check §3。

### 2.2 i18n dialogs.json 冲突（8 个）

- 1 个 `zh-cn`：保留 HEAD（在 `diagnosticsCopyFailed` 之后**追加** T20/T22 引入的 pi 相关 i18n 串 `piCatalogRefresh`/`piKeyPlaceholderConfigured` 等 26 条；上游到 `diagnosticsCopyFailed` 截止）。
- 7 个 `de/es/fr/it/ja/pl/ru`：T25 主动删除的语种，merge 算法给出 stage-3 = base 内容——**全部 git rm 删除**（保留产品决策）。

### 2.3 content 冲突（10 个）

| 文件 | 解法 | 理由 |
|---|---|---|
| `vite.config.ts` | 三方手工合并：保留 `piBackendPlugin` import + 上游新增 `AUTOMATION_HTTP_PORT` / `devAutomationRoute` import + 上游新增 2 个 `__OPENPENCIL_LOCAL_AUTOMATION_*` define | 0f981ff2 改动 + 我们 P-num |
| `vite/automation.ts` | git 自动合并到位（新签名 `{browserURL, corsOrigin, httpPort, portlessServiceName, runtimeId}`） | 0f981ff2 |
| `src/app/automation/bridge/vite-plugin.ts` | git 自动合并到位（API 签名扩展 + discoveryPath 字段） | 0f981ff2 |
| `src/app/automation/mcp/spawn.ts` | 三方手工合并：保留 HEAD 的 `RUNTIME_AUTOMATION_AUTH_TOKEN` P104 块 + 上游的 `DEV_AUTOMATION_HTTP_URL` 块 + git 误判的重复 `DEV_AUTOMATION_AUTH_TOKEN` 删除 | 0f981ff2 + 我们 P104 |
| `src/app/ai/chat/transports.ts` | `git checkout HEAD`——T25/T27 已主动删除 `createACPTransport`/`createToolLoopTransport`（ACP / ToolLoopAgent 路径），上游 diagnostics 引入的 `recordChatCompleted`/`Failed`/`recordModelStepCompleted` 也未被外部调用 | T25/T27 决策 |
| `src/app/ai/debug/index.ts` | `git checkout HEAD`——上游 `formatTokenUsage`/`formatLogEntry`/`formatDiagnostics` 依赖已删除的 `src/app/ai/tools` | T27 决策 |
| `src/app/editor/clipboard/system.ts` | `git checkout HEAD`——保留 T31 P35 把上游 7a311677 引入的复杂度超限函数抽 helper | T31 决策 |
| `src/app/settings/dialog.ts` | 三方手工合并：保留上游 `SettingsSection` 扩展（加 `usage`/`diagnostics`/`mcp` 三个值） | 上游 5f8a373b 引入两个新 panel |
| `src/components/settings/SettingsDialog.vue` | 三方手工合并：保留上游在 AI 与 Media 之间插入的 `usage`/`diagnostics`/`mcp` 三个 nav button；main 区 panel 路由 `usage`/`diagnostics` 已 git 自动合并到位；`mcp` 无 panel 路由（点击 main 区空白，不崩——v-if/v-else-if 都不命中时 main 渲染为空） | 上游 5f8a373b |
| `src/components/ChatPanel.vue` | `git checkout HEAD`——保留 `AppTextButton`（我们 ownedFile），不替换为 `AppButton`；T35 替换 AppTextButton 时一起做 | T32 决策 |
| `src/components/chat/ChatMessage.vue` | 三方手工合并：保留 HEAD import（HEAD 23 行已 `import { classifyToolState } from './tool-state'`）+ 保留 HEAD 的 P-num 注释（b65b1bd4 标注）——上游的 `imageAttachmentsForMessage`/`ImageAttachment.vue` 不存在（`src/app/ai/attachment/` 未合并） | T32 + 上游 5f8a373b 缺配套 |

## 3. 主机代码补充改动（非 merge 冲突解）

### 3.1 `src/app/ai/pi-backend/host.ts` 决策注记

**评估问题**：上游 0f981ff2 给 vite plugin 加了 `OPENPENCIL_MCP_DISCOVERY_PATH` 临时目录隔离（避免 worktree 间抢 `~/.openpencil/mcp.json`），host.ts 是否应跟随？

**决策**：**不跟**。理由：

- host.ts 是生产形态入口，主服务端口固定（默认 8080），子进程沿用 7600/7700 常量——多 host 实例会被 `EADDRINUSE` 拦截（spawn stderr 已 passthrough 转译）。
- discovery 默认路径冲突场景是「dev mode 下多 worktree 同跑」——host.ts 不在此场景。
- 未来若扩成同主机多 host.ts 实例，再补临时目录隔离——届时复用 vite-plugin 的 sha256(runtimeId) 方案即可。

**代码内**已加决策注记（spawnBridge 函数顶部 5 行注释）。

## 4. 不做（出栈）

- **AppTextButton → AppButton 替换**——T32 owner 已记入未来 chat/settings iteration，本轮 owner 没让做。
- **5f8a373b 的 image attachment 全套**——上游新增但本轮合并只吃 settings section 类型 + nav button；image panel 不在 rebuild/pi 改造目标里，留 T35+。
- **0f981ff2 的 Portless 集成**——host.ts 不走 Portless 路径；dev 模式通过 vite plugin 已自动获得 Portless 隔离能力。
- **zones.json 上游删除登记**——check.ts 的 `checkDeletedAbsent` 已经覆盖「既不在上游存在、也不在我们存在」场景，**无需手动登记 deletedPaths**（T32 时误判，本轮纠正）。

## 5. 验收标准

| # | 验收 | 结果 |
|---|---|---|
| C1 | octopus merge 8 commits 全部进入 `rebuild/upstream-merge-2` | ✅ |
| C2 | 23 个冲突全部解完，`git status` 无 UU | ✅ |
| C3 | `check:zones` exit 0 | ✅（base 88c10770，55 modified / 283 added / 1014 deleted / 0 renamed） |
| C4 | `check:deps` exit 0（恢复 AppTextButton 后） | ✅ |
| C5 | `typecheck`（tsgo + vue-tsc ×2）exit 0 | ✅ |
| C6 | `lint` 0 errors（3 存量 max-lines warnings 均为非 T34 触发） | ✅ |
| C7 | `check:docs` 40/40 / `check:bindings` 全绿 / `check:i18n` 全绿 / `check:monorepo` ✅ / `check:arch` ✅ / `check:packages` ✅ | ✅ |
| C8 | `smoke:pi` 全套（t22/t23/t24/t28） 0 failed | ✅ |
| C9 | subagent V1-V8 独立核验全 ✅ | 推送前复验 |
| C10 | CI 双链 success @ 同 SHA（staging 先行 → 绿 → rebuild/pi 同 SHA → 复验） | 推送后复验 |

## 6. 风险与教训

- **AppTextButton 误删**：merge 阶段把「上游删除 + 我们 owned 保留」当成 modify/delete 处理，误删了一次。**教训**：modify/delete 冲突解前必须先 `git show HEAD:<path>` 确认路径在 HEAD 是否存在，不能仅凭 merge status DU 标识一刀切。
- **octopus 一次到位**：8 个 commit 时间跨度 8/21~8/25，连号不交叉，octopus 合并比 sequential cherry-pick 节省 ~1 小时反复解决中间态。

## 7. 关联文档

- self-check：[T34-self-check.md](T34-self-check.md)
- verify：[T34-verify.md](T34-verify.md)
- 索引：[tasks/_index.md §2](../tasks/_index.md)

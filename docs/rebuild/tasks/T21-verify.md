<!--
  写作纪律（改本文前必读）：
  - 事实性声明必须附核验命令 + 日期，否则标为【假设】
  - 本文只保留当前态，不保留修正历史
  - 详细规则见 docs/rebuild/05-process.md §4
-->

# tasks/T21-verify.md · T21 独立核验记录

> **T 编号**：T21（Phase 1-pi 实施 · pi 原生 provider/凭据管理 + 全量 core tools + system prompt + 环绕补齐）
> **状态**：✅ 已核验通过（2026-08-24，独立 subagent 复核；首轮于 bc7c9551 打回的 V3/V6 两项经整改 commit c7a0a44c + 7431f9f4 复验通过）——**可以收口**

## 核验项（预审自 [T21-plan.md §2](T21-plan.md) 验收清单派生）

| #   | 核验项                                                                           | 结果 | 证据 |
| --- | -------------------------------------------------------------------------------- | ---- | ---- |
| V1  | A1 后端 pi 原生 model/auth 落地（catalog/credential/provider 端点，无 read-key） | ✅   | 见下 |
| V2  | A2 设置 UI 改向（UI 存 key → auth.json → 聊天可用，全程无 env key）              | ✅   | 见下 |
| V3  | A3 全量 core tools（26 = 22+4）+ system prompt 接入（多工具协作冒烟）            | ✅   | 计数口径已更正并复验通过 |
| V4  | A4 环绕补齐（桥 undo 条目 + 后端 step budget `_warning`）                        | ✅   | 见下 |
| V5  | A5 chat 面零改动 + T19/T20 回归                                                  | ✅   | 见下（附两点已声明偏差） |
| V6  | A6 key 卫生 + 无占位 + CI 绿                                                     | ✅   | CI run 32656186119（7431f9f4）completed/success，13 job 全绿 |
| V7  | A7 文档纪律（三件套齐、tracker/\_index 登记、事实可复验）                        | ✅   | 见下 |

## V1 · 后端 pi 原生 model/auth（✅）

- 端点存在：`src/app/ai/pi-backend/server.ts:119-164`——GET `/api/pi/catalog`、POST/DELETE `/api/pi/credentials`、POST `/api/pi/providers`；无任何 read-key 端点（读文件 2026-08-24）。
- `getCatalog` 白名单字段（`provider-admin.ts:126-155`）：provider 仅 id/name/baseUrl + `auth:{configured,type,source}`，model 仅元数据——无 key 字段路径；错误文案（`assertKeyCarriable` :97-104、`setCredential` 回验 :192-195）不含 key 本体；server.ts:166-169 统一 400 `{error}`。
- 种子 models.json 只含 `'$OPENROUTER_API_KEY'` env 引用（:78），非 key 本体；兜底写 auth.json 带 0600（:170）。
- 冒烟 `spikes/s-pi/backend-smoke/t21/admin-smoke.mjs` 存在且断言合理：空态→POST key→auth.json 落盘→configured→upsert→DELETE 回空，每步 `assertRedacted`；后端进程 env 显式剔除 OPENROUTER_API_KEY 跑无 env 全链（读文件 2026-08-24；活模型冒烟未复跑，按纪律只审脚本）。

## V2 · 设置 UI 改向（✅）

- 前端无 key 持久化：`PiModelsPanel.vue:25` keyDrafts 为内存 ref、存成功后即清（:77）；`client.ts` key 仅经 POST body 传输；全模块无 localStorage key 写入（读文件 2026-08-24）。
- pi design 指派独立槽：`assignment.ts:16` `openpencil.pi.design-model`（仅存 providerId/modelId/thinkingLevel，无迁移逻辑）。
- 聊天请求带 model spec：`transport.ts:27-31`；`attach.ts:30` 注入 `getPiDesignModelSpec` getter。
- `ModelsPanel.vue` pi 分支渲染 PiModelsPanel，legacy 路径原样保留。

## V3 · 全量 core tools + system prompt（✅，首轮打回项复验通过）

- 首轮（bc7c9551）打回原因：self-check/plan 口径「21+4=25」与实测 26 不符。整改后复验（2026-08-24）：
  - 运行时计数：`bun -e "import {CORE_TOOLS,EXTENDED_TOOLS} from '@open-pencil/core/tools'; …"` → CORE_TOOLS=22、白名单 4 全中、合计 26；
  - 文档口径已全量更正为 22+4=26 并附核验命令：self-check §2.1-11（含 `sed -n '/export const CORE_TOOLS/,/^]/p' … grep -cE` 命令）、§2.2-4（「26 工具 = CORE_TOOLS 22 + extended 白名单 4」）、§2.3-2（「create_shape 保留为第 26 个工具」）、plan §1.4/A3；tools.ts 头注释同步更正（读文件/grep 2026-08-24）。
  - 功能面：注册集为旧 ToolLoop 等价集（22+3=25）的超集，验收实质达成。
- `paramToTypeBox`（tools.ts）覆盖 ParamDef 全部 5 种 type + enum/min/max/required（对照 `packages/core/src/tools/schema.ts:15-32`）。
- system prompt 接入属实：`service.ts` `DefaultResourceLoader({systemPrompt: 读盘 system-prompt.md, noContextFiles:true, noSkills:true, noPromptTemplates:true})`；选项存在于 pi SDK（resource-loader.d.ts:78-82）；模块级缓存。
- 冒烟 `t21/tools-smoke.mjs`（describe→render 有序 + 无 output-error + 桥真实执行回读）、`t21/settings-smoke.mjs`、`t21/undo-smoke.mjs` 断言合理；脚本已归位 `spikes/s-pi/backend-smoke/t21/` 领域目录（ls 实证 2026-08-24）。

## V4 · 环绕补齐（✅）

- `tool-handlers.ts:19-33` `withAIUndo` = snapshotPage → fn → snapshotPage → pushUndoEntry(`AI: <name>`)；render 特判与 ALL_TOOLS mutates 路径全覆盖；与旧 `src/app/ai/tools/index.ts:107-130` 语义一致（读文件 2026-08-24）。
- `maybeAppendStepWarning` 文案与旧 `packages/core/src/tools/ai-adapter.ts:66` 逐字符一致，阈值 ≤5 一致。
- pi 无 maxTurns 声明属实，且核验命令已更正为可复现路径：`grep -ri "maxTurns" node_modules/.bun/@earendil-works+pi-agent-core@0.84.2*/node_modules/@earendil-works/pi-agent-core/dist` 零命中（复跑实证 2026-08-24）。

## V5 · chat 面零改动 + 回归（✅）

- `git diff --stat bf2d9c06..bc7c9551`（2026-08-24）：`ChatPanel.vue`、`src/app/ai/chat/transports.ts`、`use.ts`、`storage.ts` 均不在 diff。
- 两点已声明偏差（self-check §2.2-7）：①pi-backend/attach.ts +4 行注入 design model getter；②ChatInput.vue +16 行 pi 模式只读模型标签（v-if 分支，legacy 走 v-else-if）。
- 回归脚本在库：smoke.mjs/tool-smoke.mjs/browser-tool-smoke.mjs；browser-tool-smoke 详情正则已从 `"nodeId"` 改为 `"id"`（diff 实证，与 tools.ts 返回桥原始结果对齐）。

## V6 · key 卫生 + 无占位 + CI（✅，首轮打回项复验通过）

- 首轮（bc7c9551）打回原因：CI run 32655127504 failure——format:check 5 文件未格式化 + test:dupes 报 client.ts 内 5 行克隆。整改后复验（2026-08-24）：
  - `git diff bc7c9551..c7a0a44c --stat`：恰为 5 个格式文件 + client.ts 去重（11 行），范围与失败日志一一对应；
  - 本地 `bun run test:dupes` exit 0（复跑 2026-08-24）；
  - **CI 绿**：`gh api repos/another-momo/open-pencil/actions/runs/32656186119` → 7431f9f4 completed/**success**，`/jobs` 全 job conclusion 唯一值 `["success"]`（含 Code quality / Repository hygiene / check:secrets 所在 hygiene 面，2026-08-24 轮询确认）。
- key 卫生：`grep -rn "sk-or-" src/ spikes/` 零命中（2026-08-24；仓内既有命中均为 node_modules 占位串与 packages/core 预存 Google Fonts key，与 T21 无关）。
- 轻量 gate 首轮已本地复跑全绿（lint/tsgo/check:vue/i18n/zones/docs，exit 均 0）；整改后 check:docs 于本文重写后复跑 38/38 通过（2026-08-24）。

## V7 · 文档纪律（✅）

- 三件套齐：T21-plan.md / T21-self-check.md / T21-verify.md 均在 `docs/rebuild/tasks/`。
- 登记在册：`docs/rebuild/tracker.md:55`、`docs/rebuild/tasks/_index.md:53` 均有 T21 行（grep 2026-08-24）。
- self-check §2.2 抽查 8 条全部复验为真：§2.2-1（provider-admin 职责）、§2.2-2（server 端点）、§2.2-4（26 工具，整改后）、§2.2-5（DefaultResourceLoader 选项）、§2.2-6（withAIUndo）、§2.2-7（前端文件清单）、§2.2-9（zone 注册 P37-P40 + ownedFiles）、§2.2-10（字符串 models 归一化）。

## 总结论：可以收口

V1-V7 全部核验通过。首轮两项打回（工具计数口径失真、CI 红）经 c7a0a44c + 7431f9f4 整改并复验闭环：文档计数 26=22+4 全量更正且附可复现核验命令，CI run 32656186119 全绿。A1-A7 验收清单满足，T21 可以收口。

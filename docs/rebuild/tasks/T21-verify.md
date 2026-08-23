<!--
  写作纪律（改本文前必读）：
  - 事实性声明必须附核验命令 + 日期，否则标为【假设】
  - 本文只保留当前态，不保留修正历史
  - 详细规则见 docs/rebuild/05-process.md §4
-->

# tasks/T21-verify.md · T21 独立核验记录

> **T 编号**：T21（Phase 1-pi 实施 · pi 原生 provider/凭据管理 + 全量 core tools + system prompt + 环绕补齐）
> **状态**：❌ 已核验（2026-08-24，独立 subagent 于工作树 bc7c9551 复核）——**不可收口**（CI 红 + 工具计数声明失真，见 V3/V6）

## 核验项（预审自 [T21-plan.md §2](T21-plan.md) 验收清单派生）

| #   | 核验项                                                                           | 结果 | 证据 |
| --- | -------------------------------------------------------------------------------- | ---- | ---- |
| V1  | A1 后端 pi 原生 model/auth 落地（catalog/credential/provider 端点，无 read-key） | ✅   | 见下 |
| V2  | A2 设置 UI 改向（UI 存 key → auth.json → 聊天可用，全程无 env key）              | ✅   | 见下 |
| V3  | A3 全量 core tools + system prompt 接入（多工具协作冒烟）                        | ❌   | 计数声明失真（实为 26=22+4，非 25=21+4），功能面达标 |
| V4  | A4 环绕补齐（桥 undo 条目 + 后端 step budget `_warning`）                        | ✅   | 见下 |
| V5  | A5 chat 面零改动 + T19/T20 回归                                                  | ✅   | 见下（附两点已声明偏差） |
| V6  | A6 key 卫生 + 无占位 + CI 绿                                                     | ❌   | **CI run 32655127504（bc7c9551）failure**：format:check 5 文件未格式化 + test:dupes 克隆 |
| V7  | A7 文档纪律（三件套齐、tracker/\_index 登记、事实可复验）                        | ✅   | 三件套齐、登记在册；抽查 8 条声明 7 真 1 假（即 V3 计数） |

## V1 · 后端 pi 原生 model/auth（✅）

- 端点存在且仅绑本机进程：`src/app/ai/pi-backend/server.ts:119-164`——GET `/api/pi/catalog`、POST/DELETE `/api/pi/credentials`、POST `/api/pi/providers`；无任何 read-key 端点（读文件 2026-08-24）。
- `getCatalog` 白名单字段（`provider-admin.ts:126-155`）：provider 仅 id/name/baseUrl + `auth:{configured,type,source}`，model 仅 id/name/api/reasoning/input/contextWindow/maxTokens/cost——无 key 字段路径。
- 错误文案不含 key：`assertKeyCarriable`（provider-admin.ts:97-104）与 `setCredential` 回验报错（:192-195）均不含 key 本体；server.ts:166-169 统一 400 `{error}`。
- 种子 models.json 只含 `'$OPENROUTER_API_KEY'` env 引用（:78），非 key 本体；兜底写 auth.json 带 0600（:170）。
- 冒烟 `spikes/s-pi/backend-smoke/t21-admin-smoke.mjs` 存在且断言合理：空态 catalog→POST key→auth.json 落盘→configured→upsert→DELETE 回空，每步 `assertRedacted` 断言响应体不含 key；后端进程 env 显式剔除 OPENROUTER_API_KEY 跑无 env 全链（读文件 2026-08-24；活模型冒烟未复跑，按纪律只审脚本）。

## V2 · 设置 UI 改向（✅）

- 前端无 key 持久化：`PiModelsPanel.vue:25` keyDrafts 为内存 ref，存成功后即清（:77）；`client.ts:89-92` key 仅经 POST body 传输；全模块无 localStorage key 写入（读文件 2026-08-24）。
- pi design 指派独立槽：`assignment.ts:16` `openpencil.pi.design-model`（useLocalStorage，仅存 providerId/modelId/thinkingLevel，无迁移逻辑）。
- 聊天请求带 model spec：`transport.ts:27-31` 请求体 `...(model ? { model } : {})`；`attach.ts:30` 注入 `getPiDesignModelSpec` getter。
- `ModelsPanel.vue:86` pi 分支 `v-if="isPiBackend"` 渲染 PiModelsPanel，legacy 路径原样保留。

## V3 · 全量 core tools + system prompt（❌ 计数声明失真）

- **失真点**：self-check §2.2-4/plan §1.4 口径「CORE_TOOLS 21 + 白名单 4 = 25 工具」。实测（`bun -e "import {CORE_TOOLS,EXTENDED_TOOLS} from '@open-pencil/core/tools'; …"`，2026-08-24）：**CORE_TOOLS.length=22**，白名单 4 全中（get_components/list_libraries/insert_library_component/create_shape），`createOpenPencilTools` 实际注册 **26 个**。功能上是旧 ToolLoop 等价集的**超集**（旧=22+3=25），验收实质达成，但文档计数与代码不符，需更正 self-check/plan 口径。
- `paramToTypeBox`（tools.ts:101-131）覆盖 ParamDef 全部 5 种 type（string/number/boolean/color/string[]）+ enum/min/max/required（对照 `packages/core/src/tools/schema.ts:15-32`，2026-08-24）。
- system prompt 接入属实：`service.ts:115-122` `DefaultResourceLoader({systemPrompt: 读盘 system-prompt.md, noContextFiles:true, noSkills:true, noPromptTemplates:true})`；选项在 pi SDK 存在（`node_modules/@earendil-works/pi-coding-agent/dist/core/resource-loader.d.ts:78-82`，2026-08-24）；模块级缓存 `cachedSystemPrompt`（service.ts:56-61）。
- 冒烟 `t21-tools-smoke.mjs` 存在且断言合理（describe→render 有序 + output 无 error + 桥真实执行回读节点 id）；`t21-settings-smoke.mjs`/`t21-undo-smoke.mjs` 同审通过（读文件 2026-08-24）。

## V4 · 环绕补齐（✅）

- `tool-handlers.ts:19-33` `withAIUndo` = snapshotPage → fn → snapshotPage → pushUndoEntry(`AI: <name>`)；render 特判（:42）与 ALL_TOOLS mutates 路径（:76）全覆盖；与旧 `src/app/ai/tools/index.ts:107-130` 语义一致。
- `maybeAppendStepWarning`（tools.ts:133-142）文案与旧 `packages/core/src/tools/ai-adapter.ts:66` 逐字符一致（`⚠ ${remaining} steps remaining out of ${MAX_AGENT_STEPS}. …`），阈值 ≤5 一致。
- pi 无 maxTurns 声明属实：`grep -rl "maxTurns" node_modules/.bun/@earendil-works+pi-agent-core@0.84.2+053dfffa33d20cd6/.../pi-agent-core` 零命中（2026-08-24）。注：self-check 写的 grep 路径 `node_modules/@earendil-works/pi-agent-core/dist` 在本机不存在（bun 安装在 .bun 仓库目录），声明语义为真但核验命令路径不可复现，建议更正。

## V5 · chat 面零改动 + 回归（✅）

- `git diff --stat bf2d9c06..bc7c9551`（2026-08-24）：`src/components/chat/ChatPanel.vue`、`src/app/ai/chat/transports.ts`、`src/app/ai/chat/use.ts`、`src/app/ai/chat/storage.ts` 均不在 diff。
- 两点已声明偏差：①`src/app/ai/pi-backend/attach.ts` +4 行（注入 design model getter）与 plan A5「attach 不动」字面冲突，但属 pi-backend 模块自身且已声明于 self-check §2.2-7；②`ChatInput.vue` +16 行 pi 模式只读模型标签（v-if 分支，legacy 走 v-else-if，亦声明于 §2.2-7）。
- 回归脚本在库：smoke.mjs/tool-smoke.mjs/browser-tool-smoke.mjs；browser-tool-smoke 详情正则已从 `"nodeId"` 改为 `"id"`（diff 实证，与 tools.ts execute 返回桥原始结果对齐）。

## V6 · key 卫生 + 无占位 + CI（❌ CI 红）

- key 卫生✅：`grep -rn "sk-or-" src/ spikes/` 零命中（2026-08-24；仓内既有命中均为 node_modules 内 `sk-or-…` 占位串与 packages/core 预存 Google Fonts key，与 T21 无关）。
- 轻量 gate 本地全绿（2026-08-24 复跑）：`bun run lint`（0 errors/3 warnings）、`bunx tsgo --noEmit`（exit 0）、`bun run check:vue`（exit 0）、`bun run check:i18n`（in sync）、`bun run check:zones`（clean）、`bun run check:docs`（38/38）。check:secrets 本机无 gitleaks（`which gitleaks go` 均无，2026-08-24），按声明跳过。
- **CI ❌**：`gh api repos/another-momo/open-pencil/actions/runs?branch=rebuild/pi`（2026-08-24）——bc7c9551 唯一 run [32655127504](https://github.com/another-momo/open-pencil/actions/runs/32655127504) **completed/failure**。两个失败 job：
  1. Code quality → Verify formatting（format:check）：`packages/vue/src/i18n/messages/dialogs.ts`、`src/app/ai/pi-backend/assignment.ts`、`src/app/ai/pi-backend/tools.ts`、`src/components/settings/models/ModelsPanel.vue`、`PiModelsPanel.vue` 共 5 文件不符 oxfmt；
  2. Repository hygiene → Detect duplicated product code（test:dupes）：jscpd 报 `client.ts:99-104` 与 `client.ts:60-65` 克隆（5 行/85 token，阈值 0%）。
  （均为可分钟级修复项，但按 A6「CI 绿」口径当前不满足。）

## V7 · 文档纪律（✅）

- 三件套齐：T21-plan.md / T21-self-check.md / T21-verify.md 均在 `docs/rebuild/tasks/`（读文件 2026-08-24）。
- 登记在册：`docs/rebuild/tracker.md:55`、`docs/rebuild/tasks/_index.md:53` 均有 T21 行（grep 2026-08-24）。
- self-check §2.2 抽查 8 条：§2.2-1（provider-admin 职责）✅、§2.2-2（server 端点）✅、§2.2-4（25 工具）❌（实为 26，见 V3）、§2.2-5（DefaultResourceLoader 选项）✅、§2.2-6（withAIUndo）✅、§2.2-7（前端文件清单）✅、§2.2-9（zone 注册 P37-P40，zones.json:250-270 + ownedFiles）✅、§2.2-10（字符串 models 归一化，provider-admin.ts:222-223）✅。

## 总结论：不可收口

两项阻断（均小修）：

1. **V6 CI 红**：bc7c9551 run 32655127504 failure——跑 `bun run format` 修复 5 文件格式 + 消除 `client.ts` 内 5 行重复（requestJSON/clearPiCredential 错误处理段），推送后待 CI 绿。
2. **V3 文档计数失真**：self-check §2.2-4 / plan §1.4/§2-A3 的「CORE_TOOLS 21 + 4 = 25」与代码（22+4=26）不符，就地更正计数口径；另建议顺手更正 §2.3-1 maxTurns grep 路径为实际 .bun 仓库路径。

其余 V1/V2/V4/V5/V7 全部核验通过，实现质量本身无疑义。

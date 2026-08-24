<!--
  写作纪律（改本文前必读）：
  - 事实性声明必须附核验命令 + 日期，否则标为【假设】
  - 本文只保留当前态，不保留修正历史
  - 详细规则见 docs/rebuild/05-process.md §4
-->

# tasks/T25-self-check.md · T25 自查记录

> **T 编号**：T25（Phase 1-pi 实施 · 减法收口）
> **状态**：✅ 已收口（C1-C6 全过；subagent 独立核验见 [T25-verify.md](T25-verify.md)）

## 1. 立项依据

T24-plan D9 拆分 + T24 收口后 Phase 1-pi 任务面唯一剩余项。owner 2026-08-24 拍板 D1-D3（harness 切 / 旧设置面切 / 门退役 + 一键启动）并指令开工。

## 2. 侦察事实（2026-08-24）

1. 三路径实况：pi override（attach.ts:22 env 门）/ ToolLoop（transports.ts:63-110）/ harness（transports.ts:156-183）汇入同一 Chat 类（use.ts:46 createChatSessionManager）
2. vite.config.ts:35 实证：piBackendPlugin 已无条件随 serve 拉起后端——一键启动缺的只是 `server.open` 与 key 自助注入
3. .gitignore:82 实证 `.openpencil/` 不入库——key-env 自助注入无泄露面
4. packages/harness 消费者仅 src/app/ai/harness/{process,transport}.ts（grep -rln 实证）；package.json:16 workspace + lint/format 脚本引用需同步去
5. vision-runtime.ts / tools/vision.ts 零消费者（grep 实证）——look 旧前端实现是死代码，C4a 重建走后端（答疑结论）
6. analyzeAttachedImages（ChatPanel.vue:279）是旧 vision 直通唯一活消费者——随 D2 切除，C4a 恢复（owner 知情）
7. 门消费面：attach.ts:22、use.ts:37、storage.ts:44、ChatPanel.vue:173、ChatInput.vue:82、ModelsPanel.vue:14
8. D2 文件族（grep -rln 'ai/chat/storage|ai/models|ai/providers' 实证 15 文件）：chat/storage.ts、models/{runtime,store}.ts、providers/{registry,compatible}.ts、chat/model.ts、vision-runtime.ts、tools/vision.ts、attachment/image/analyze.ts、settings/credentials/persistence.ts 等 + 组件 ChatProfileSelect/RoleAssignments/ProfileEditor/ProviderSetup
9. 冒烟维护教训（2026-08-24 补跑实证）：固定端口冒烟跑前须查孤儿（netstat 端口实证）；浏览器冒烟必须 node 跑；keeper 页面可自开（tools-smoke.mjs:112-127 模式）

## 3. 实施记录

### 3.0 删除清单（step 1 recon 定稿，2026-08-24 逐符号 grep 实证）

**整删（文件级）**

- D1 harness 族：`src/app/ai/harness/`（process.ts、transport.ts）、`packages/harness/` 整包、`src/app/integrations/mcp/` + `src/components/settings/mcp/`（recon 实证：MCP 连接设置唯一消费者是 harness 传输的 buildPiMCPServers；7600 桥 packages/mcp 保留）
- D2 旧模型/凭证族：`src/app/ai/models/`（6 文件整目录，pi 指派独立存于 pi-backend/assignment.ts 已实证）、`src/app/ai/providers/`（零外部消费者）、`src/app/ai/chat/model.ts`、`src/app/ai/chat/reasoning.ts`、`src/app/ai/vision-runtime.ts`、`src/app/ai/tools/vision.ts`（零消费者死代码）、`src/app/ai/attachment/`（整目录——贴图从不进 pi 后端，analyze 是唯一终点）、`src/app/settings/credentials/migration.ts`（T21 已拍板无存量迁移；stock-photo 旧格式 key 随弃）
- 组件族：`ProviderSetup.vue`、`ProviderModelSelect.vue`、`ProviderConnectionTestButton.vue`、`ChatProfileSelect.vue`、`settings/models/ProfileEditor.vue`、`settings/models/RoleAssignments.vue`、`components/chat/attachment/` 子目录

**拆分保留（手术式）**

- `chat/storage.ts` 死——stock-photo 面（pexelsKeyStatus/unsplashKeyStatus/setPexelsKey/setUnsplashKey + refreshMediaCredentials）与 remember 面（browserCredentialsRemembered/setRememberCredentials）迁入新薄模块 `settings/credentials/stock-photo-keys.ts`；AI 凭证面（apiKeyStatus/setAPIKey/resolveAPIKey/refreshAIProviderStatus/designCredentialReference/credentialRevision/registerAIChatEffects 的模型 watch 族）删
- `settings/credentials/` 基础设施保留（app/browser/index/memory/native/reference/services/storage/switchable/types）；`persistence.ts` 删 aiModelSettings/modelConnectionCredentialRef/mcpConnectionSettings 关联，保留通用持久化开关
- `chat/use.ts` 瘦身：activeTab + ensureChat/resetChat/chatFailure/clearChatFailure + stock-photo/remember re-export；isConfigured 随 ProviderSetup 删除（pi 语义：后端首个 prompt 如实报错，T19 既定）

**修改（不删）**

- `transports.ts` 收敛为 createChatSessionManager 单出口（override 唯一来源 + T22 钩子 + finish/failure 分类保留）
- `attach.ts` 去 env 门恒注册；`ChatInput.vue`/`ChatPanel.vue`/`ModelsPanel.vue` 分支塌缩；`SettingsDialog.vue` 去 MCP 段挂挂载
- `vite.config.ts` +`server.open: true`；`pi-backend/main.ts` +key-env 自助注入；`package.json` 去 packages/harness（workspace/lint/format）；`zones.json` 删除登记

### 3.1 实施事实（2026-08-24 实施 + 回归）

按 §3.0 清单执行完毕，事实如下（均可 `git show <T25 收口 commit> --stat` 复核）：

1. **收敛**：`transports.ts` 重写为 createChatSessionManager 单出口——override 为 transport 唯一来源，无 override 即抛「pi backend attach missing」；T22 历史回填两分支、失败分类、WeakMap 消息暂存全保留。`use.ts` 瘦身（无门恒挂会话钩子 + stock-photo/remember re-export）；`attach.ts` 去门恒注册。
2. **手术拆分**：新增 `settings/credentials/media-credentials.ts`（叶子模块，破 stock-photo-keys ↔ persistence 循环引用）+ `stock-photo-keys.ts`（状态/注入/开关 + 模块加载即 `refreshMediaCredentials()` 承接旧 credentialsReady 职责）；`persistence.ts` 收敛为 stock-photo + vectorize + storage 三类 ref。
3. **组件手术**：ChatInput.vue（附件 UI + 旧模型臂切除，submit 仅文本）、ChatPanel.vue（附件分析流 + ProviderSetup 门 + isConfigured + PI_BACKEND 常量切除；会话栏恒挂）、ChatMessage.vue（附件呈现切除）、ModelsPanel.vue（塌缩为恒 PiModelsPanel）、SettingsDialog.vue（MCP 导航/区块/导入切除）、`settings/dialog.ts`（SettingsSection 去 mcp）。
4. **删除**：§3.0 整删清单全部落地（含 `chat/connection-test.ts`——recon 遗漏、实施期 grep 补入网；测试族 8 件 + 孤儿 helper `tests/helpers/mcp/acp-session.ts`）。删除后 `grep -E "from '@/app/ai/(chat/(storage|model|reasoning|connection-test)|attachment|models|providers|harness|vision-runtime|tools/vision)'|integrations/mcp|credentials/migration|VITE_PI_BACKEND" src/ tests/` 零命中（C1）。
5. **依赖收敛**：package.json 去 packages/harness（workspace/lint/format/test:tools/build:paths）+ 五个浏览器直调 AI SDK provider（@ai-sdk/anthropic、deepseek、google、openai、@openrouter/ai-sdk-provider，grep 全仓零消费者）；tsconfig paths 去 @open-pencil/harness；bun.lock 重生成（7 packages removed）。
6. **i18n**：dialogs 删旧面专属键 106 个（connectionTest*/mcp*/模型编辑器族/harness 权限族/ProviderSetup 族等），en 源 + zh-cn 同步；零动态键访问（grep `dialogs.value\[` 零命中）前提下删除，vue-tsc ×2 + check:i18n 复核通过。保守保留通用键（apply/ok/paste 等上游存量，非本任务面）。
7. **一键启动（D3）**：`vite/server.ts` +`open: !host`（Tauri host 注入时除外）；`pi-backend/main.ts` +key-env 自助注入（仅补缺失项、不覆盖 env、不打印；cwd 非仓根时自然跳过——冒烟 tempRoot 场景不受影响，已逐件核对 admin/history/sessions/prompt-assembly 四件 spawn cwd 均为 tempRoot）。
8. **zones 登记**：ownedFiles +2（stock-photo-keys/media-credentials）、deletedPaths +30、patches 更新 9 件（P4/P5/P6/P7/P17/P18/P37/P38/P40 追加 T25 注记）+ 新增 P44-P50（SettingsDialog/dialog.ts/persistence/ChatMessage/vite-server/e2e-spec/type-shapes），pendingReclass 摘除已删 4 项。`check:zones` 输出 clean（45 modified / 248 added / 1012 deleted 全登记）。
9. **冒烟回归（C4，2026-08-24 本机全绿）**：t22 bind 15/15、t23 sessions-bind 19/19、t24 mode-overlay-bind 17/17（浏览器三件跑在切除后 UI 上，会话栏/模式选择器/profile 下拉 testid 全存活）；t22 history 12/12、t23 sessions 14/14、t24 prompt-assembly 27/27、t21 admin/settings/tools 全过、t19 smoke 全过、t20 tool-smoke 全过（keeper 包装复跑）。
10. **一键启动实测（C5）**：净 shell（未 export key）`bun run dev` → vite 200 + 后端 /health ok + `/api/pi/catalog` openrouter `configured:true`（key-env 自助注入生效，进程/env 无 key 打印）；`resolveConfig('serve')` 实证 `server.open === true` 且 `/api/pi` proxy 在位（agent shell 无 GUI 会话，浏览器弹窗无法直接观测——config 级实证 + vite 标准行为）。
11. **e2e（C6）**：`tests/e2e/chat/panel.spec.ts` 重写适配 pi 单通道（删 ProviderSetup 门/模型选择器/附件流用例 6 件，新增「无设置门直聊」断言；Meta+j → ControlOrMeta+j 顺修 `$mod` 跨平台），本机 headless-shell 实跑 **13/13 全绿**——mock 经保留的 setChatTransport 钩子注入生效（D4）。

### 3.2 与计划的偏差

1. `server.open` 落在 `vite/server.ts`（createDevServerOptions）而非 plan 写的 vite.config.ts——server 选项集中在该工厂，config 只传 host。效果等价。
2. plan 未列 `chat/connection-test.ts`（ProviderConnectionTestButton/ProfileEditor 的后端）与 `ChatMessage.vue`（attachment presentation 消费者）——实施期 grep 补入删除/手术清单。
3. 计划外顺修两件（均为门禁排雷实证，非产品面）：① `tools/type-shapes/src/files.ts` Windows 反斜杠归一（本机 `test:tools` 恒红——Bun.Glob 在 Windows 产出 `\`，与我的改动无关但挡 C3 全绿证据）；② e2e spec 的 `Meta+j` → `ControlOrMeta+j`（`$mod` 绑定在 Windows 语义为 Ctrl，旧写法本机恒失败）。
4. e2e spec 重写超出 plan C6「mock 完好」的最低要求——旧 spec 有 6 件用例钉死已删 UI（ProviderSetup 门/附件/模型选择器），不适配则该文件即死代码；重写后实跑绿。
5. 核验后顺修（[T25-verify.md §V4-7](T25-verify.md) 登记的非阻断残留）：`piCatalogOffline` 文案仍写 VITE_PI_BACKEND=1 → 改为 `bun run dev` 表述（en + zh-cn 同步，check:i18n 复核通过）。

### 3.3 已知边界

1. **analyzeAttachedImages 知情退化**（owner 2026-08-24 拍板）：贴图分析随 attachment 族切除，C4a 通道 B 重建时恢复（服务端视觉形态）。
2. **本机环境受限门禁两件**：`check:secrets`（本机无 gitleaks 二进制亦无 go 工具链，脚本 spawn ENOENT 即败，与改动无关）与 `check:audit`（用户级 bunfig registry=npmmirror，无 npm audit bulk 端点 → 404）。两者均 CI 面可查（ci.yml secrets/audit 门在 Linux + 官方 registry 下跑）。
3. **本机 unit quick 套件 101 件失败均为环境性**（fig 导出/字体下载/eval CLI/ws 桥，与 AI 面零交集；失败套件无任何对已删模块的导入——grep 实证零残留）。全量 unit 交远端 CI（heavy-tests.yml + ci.yml build 门）。
4. **T20 tool-smoke 需 keeper 页面**（7600 桥执行端）——本次以一次性包装 `.tmp-t25-t20-keeper.mjs` 复跑（跑完即删）；冒烟脚本自身不带 keeper 是旧已知项（T24 §3.3-7 同类教训：固定端口冒烟跑前查孤儿，本次开跑前已 netstat 清查 1420/7600/7700 并kill 三件上代 dev 残留）。
5. **浏览器自动开（server.open）在 agent shell 无法观测**（无 GUI 会话，`cmd /c start` 亦不弹）——证据止于 resolveConfig 级；owner 本机首跑 `bun run dev` 即可直观确认。

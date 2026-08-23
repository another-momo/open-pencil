<!--
  写作纪律（改本文前必读）：
  - 事实性声明必须附核验命令 + 日期，否则标为【假设】
  - 本文只保留当前态，不保留修正历史
  - 详细规则见 docs/rebuild/05-process.md §4
-->

# tasks/T21-self-check.md · T21 自查记录

> **T 编号**：T21（Phase 1-pi 实施 · pi 原生 provider/凭据管理 + 全量 core tools + system prompt + 环绕补齐）
> **状态**：🔄 进行中

## 1. 立项依据

owner 拍板（2026-08-24）：①provider/凭据一步到位 pi 原生、不迁移存量、不过度设计多 agent、产品功能参考 deepseek-harness；②undo + 全量 core tools + system prompt 同做。前置讨论结论（2026-08-23/24 会话）见 [T21-plan §1.2](T21-plan.md)。

## 2. 侦察事实（注册期，2026-08-24 核验）

### 2.1 pi 原生 model/auth 能力面

1. `CredentialStore` 接口（read/list/modify/delete，modify 为唯一写路径、串行化、支持跨进程锁；OAuth 刷新在锁内）：`node_modules/@earendil-works/pi-ai/dist/auth/types.d.ts`（CredentialStore 接口定义段）
2. `AuthStorage`：auth.json 文件存储实现（FileAuthStorageBackend 带锁 / InMemoryAuthStorageBackend / ReadOnlyAuthStorage）：`node_modules/@earendil-works/pi-coding-agent/dist/core/auth-storage.d.ts`
3. `RuntimeCredentials`：非持久化运行时 key 覆盖层（setRuntimeApiKey/removeRuntimeApiKey），构造包在任意 CredentialStore 外：`node_modules/@earendil-works/pi-coding-agent/dist/core/runtime-credentials.d.ts`
4. `ModelRuntime` 统一门面：getProviders/getModels/getModel/checkAuth/getAvailable/getAuth/login/logout/setRuntimeApiKey/refresh/registerProvider；`createAgentSession({ modelRuntime })` 吃自定义 runtime：`node_modules/@earendil-works/pi-coding-agent/dist/core/model-runtime.d.ts`、`dist/core/sdk.d.ts:18` 区域（CreateAgentSessionOptions.modelRuntime）
5. 内置 OAuth 流（anthropic/github-copilot/openai-codex/openrouter/xai/kimi-coding 等 + PKCE/device-code）：`node_modules/@earendil-works/pi-ai/dist/auth/oauth/` 目录清单
6. env 解析为 ambient fallback（getEnvApiKey/findEnvKeys）：`node_modules/@earendil-works/pi-ai/dist/env-api-keys.d.ts`
7. pi 官方凭据解析顺序（auth.json → env → models.json 内 key）与 auth.json 0600：pi 官方文档 packages/coding-agent/docs/providers.md（web 检索 2026-08-24，【外部参考】）
8. pi 无 subagent/Task 编排面：`grep -ri "subagent" node_modules/@earendil-works/pi-coding-agent/dist --include="*.d.ts"` 零命中（2026-08-24）；session 树 fork/navigateTree 为单 agent 分支管理（agent-session.d.ts:583-604 注释段）
9. settings 仅 defaultModel/defaultThinkingLevel；scopedModels 为会话级循环列表（sdk.d.ts CreateAgentSessionOptions.scopedModels）——无命名 profile/role 层

### 2.2 本仓现状面

10. 后端模型装配硬编码 OPENROUTER_FREE_MODELS + `$OPENROUTER_API_KEY` env 引用，authPath/modelsPath 已指 `.openpencil/pi-agent/`：`src/app/ai/pi-backend/service.ts:53-115`（读文件 2026-08-24）
11. 旧 ToolLoop 等价工具集 = CORE_TOOLS 21 个 + 白名单 extended 3 个：`packages/core/src/tools/registry-core.ts:25-54` + `src/app/ai/tools/index.ts:98-104`（读文件 2026-08-24）
12. ToolDef 为自定义 ParamDef 迷你 schema（type: string/number/boolean/color/string[] + required/enum/min/max），非 valibot per-tool：`packages/core/src/tools/schema.ts:15-32`；MCP 侧已有 ParamDef→zod 转换器先例：`packages/mcp/src/tool/schema.ts`（paramToZod 全文）
13. 桥 handler mutates 环绕有 ensureGraphFonts/computeAllLayouts/requestRender/flashNodes，缺 undo：`src/app/automation/bridge/tool-handlers.ts:53-59`；旧 undo 环绕先例（snapshotPage → pushUndoEntry `AI: <name>` → restorePageFromSnapshot）：`src/app/ai/tools/index.ts:107-130`；AutomationTarget.store 即 EditorStore：`src/app/automation/bridge/target.ts`（类型定义段）
14. system-prompt.md 静态无动态注入：`src/app/ai/chat/transports.ts:78`（`instructions: SYSTEM_PROMPT`）
15. step budget 旧机制：MAX_AGENT_STEPS=50 + 工具结果注 `_warning`：`src/app/ai/tools/index.ts:21`、`packages/core/src/tools/ai-adapter.ts:46-69,176-177`
16. 设置 UI 面：ModelsPanel.vue(169)/ProfileEditor.vue(550)/RoleAssignments.vue(109) + app 层 store `src/app/ai/models/store.ts`（aiModelSettings/profiles/assignments）；前端自有凭据多后端存储（Native/Browser/memory/migration）：`src/app/settings/credentials/` 目录
17. 死代码排除：export_image 在 EXTENDED_TOOLS 但不在旧白名单（旧 agent 本就没挂）；createVisualInspectionTool 全仓零调用（`grep -rn createVisualInspectionTool src/`，2026-08-24，仅定义处命中）
18. vite proxy 现仅 `/api/pi-chat` 前缀：`src/app/ai/pi-backend/vite-plugin.ts`（config() hook 段）

### 2.3 外部参考（非本仓事实）

19. deepseek-harness llm-pi-ai 模式：provider profile dict 按 route 键、apiKeyEnv 凭据引用按请求解析、无 key 可开机（catalog 可浏览/存 key 即用/免重启）、配置面脱敏回显、GET /models 探询：GitHub deepseek-ai/deepseek-harness `packages/llm/llm-pi-ai/README.md` 与 `.agents/notes/.../2026-07-29-request-level-llm-config-credentials.md`（web 检索 2026-08-24，【外部参考】）

## 2.2 实施事实

（待实施期回填）

## 2.3 与计划的偏差

（待实施期回填）

## 2.4 已知边界

- OAuth 交互流不在本期（留接口）；模型 GET /models 探询不在本期
- 存量凭据不迁移——升级后用户需在设置页重配 key（owner 明确接受，2026-08-24）
- 两套 `CredentialStore` 同名不同物：app 层（src/app/settings/credentials/types.ts，profileId 键泛型秘密存储）vs pi 层（provider 键 api_key/oauth）——实施期命名/注释须防混淆

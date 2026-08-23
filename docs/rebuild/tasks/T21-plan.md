<!--
  写作纪律（改本文前必读）：
  - 事实性声明必须附核验命令 + 日期，否则标为【假设】
  - 本文只保留当前态，不保留修正历史
  - 详细规则见 docs/rebuild/05-process.md §4
-->

# tasks/T21-plan.md · T21 实施计划

> **T 编号**：T21（Phase 1-pi 实施 · pi 原生 provider/凭据管理 + 全量 core tools + system prompt + 环绕补齐）
> **状态**：🔄 进行中

## 1. 背景与已决事项

### 1.1 owner 拍板（2026-08-24，本任务立项依据）

1. LLM provider 及凭据管理**一步到位使用 pi 原生方案**（ModelRuntime + AuthStorage/auth.json）；**不做存量迁移**（旧前端凭据存储中的 key 不迁移，用户重配）；**不为未来多 agent 编排做过度设计**；聚焦充分发挥 pi 对 provider 的接入及管理能力，产品功能参考 deepseek-harness（外部项目，见 §1.3）
2. 配套功能与接线同做：桥 undo、全量 core tools、system prompt 接入

### 1.2 讨论期已决（2026-08-23/24 会话，T20 收口后四轮问答）

- **环绕逻辑按层重摆、不重写**：执行侧（undo/字体/布局/高亮）留浏览器桥 handler；控制侧（step budget）挪后端 tool wrapper；浏览器侧 toolLog 退役（pi session JSONL 已更全）
- **工具层凭据（Pexels 等）保持前端管理**——凭据属于执行侧，工具在浏览器执行，key 不经后端
- **LLM 凭据走 pi 原生**：auth.json 主路径 + OAuth 留口（AuthInteraction 桥接 UI 不实现）；env 变量保留为 pi 原生 ambient fallback（pi resolution order：auth.json → env → models.json key 引用，pi 官方文档 providers.md 实证）
- **role profile 保留 app 层**：pi 有目录（models.json/provider）+ 全局默认 + 会话级 scopedModels，无命名 profile/role 指派层；我们的 role→profile→connection 指派映射为 pi 的 (model, thinkingLevel) 消费
- **mode profile 方向留口不做**：本任务只接 design 一档，profile 注册表（多模式/多 agent 的注册面）不提前建
- **pi 无 subagent/Task 编排**（SDK 全量 grep 零命中，2026-08-24）：将来多 agent = app 层编排器 + 多 createAgentSession 共享 ModelRuntime + "subagent as tool"，本任务不建

### 1.3 deepseek-harness 参考要点（外部项目，web 检索 2026-08-24）

- 无 key 可开机：catalog 可浏览、存 key 即用、全程免重启；缺 key 是请求期可行动报错（MISSING_CREDENTIAL 指明入口），不是启动失败
- 秘密不落配置文件：凭据为引用/独立存储，auth.json 0600 权限（pi 官方行为）
- 配置面只回显脱敏描述（redacted describe），永不回显 key 本体
- 模型发现走协议原生 GET /models 探询（本任务不实现，留口）

### 1.4 现状起点（实证，2026-08-24）

- 后端 service.ts:53-115：models.json 硬编码 OPENROUTER_FREE_MODELS 写入 `.openpencil/pi-agent/`，authPath 已指向同目录 auth.json（未实际使用），模型固定 openrouter/free，key 靠 `$OPENROUTER_API_KEY` env 引用
- 工具面：后端仅 create_shape 一个 hello-tool（tools.ts）；旧 ToolLoop 等价集 = CORE_TOOLS 21 + 白名单 extended 3（get_components/list_libraries/insert_library_component），共 24（registry-core.ts:25-54 + 旧 tools/index.ts:98-104）
- system-prompt.md 为静态字符串（旧 transports.ts:78 `instructions: SYSTEM_PROMPT`，无动态注入）
- 桥 handler（tool-handlers.ts:53-59）有 fonts/layout/render/flash，缺 undo；旧环绕 undo 先例在 src/app/ai/tools/index.ts:107-130（snapshotPage → pushUndoEntry `AI: <name>`）
- ToolDef 用自定义 ParamDef 迷你 schema（core/tools/schema.ts:15-32），非 valibot per-tool；MCP 侧已有 paramToZod 转换先例（packages/mcp/src/tool/schema.ts）→ toolsToPi 只需仿写 paramToTypeBox
- vite proxy 现仅转发 `/api/pi-chat`（vite-plugin.ts），新端点需扩前缀

## 2. 验收清单（A 系）

| #   | 验收项                                                                                                                                                                                                                                           | 判定方式                                      |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------- |
| A1  | 后端 pi 原生 model/auth 落地：ModelRuntime + AuthStorage（.openpencil/pi-agent/），端点：GET catalog（provider+model+auth 状态，脱敏）、POST/DELETE credential（set/delete，**无 read-key 端点**）、provider upsert（自定义 baseURL/api/models） | curl 实证 + auth.json 落盘检查                |
| A2  | 设置 UI 改向：provider 目录/凭据状态读写走后端；role 指派保留 app 层；UI 存 key → auth.json 落盘 → 聊天可用（全程无 env key）                                                                                                                    | 浏览器冒烟实证                                |
| A3  | 全量 24 core tools 经 toolsToPi 接入 + 后端加载 system-prompt.md                                                                                                                                                                                 | API 冒烟：模型可调 render/describe 等真实工具 |
| A4  | 环绕补齐：桥 mutates 产生 `AI: <name>` 撤销条目（undo 栈实证）+ 后端 step budget 近限注 `_warning`                                                                                                                                               | 冒烟断言 undo 栈；budget 单测/冒烟            |
| A5  | chat 面零改动（ChatPanel/attach/transports 不动）；T19/T20 冒烟回归全绿                                                                                                                                                                          | git diff + 回归                               |
| A6  | key 卫生（端点不回 key、日志不含 key、仓内无明文）+ 无占位 + CI 绿                                                                                                                                                                               | 扫描 + CI                                     |
| A7  | 文档纪律：三件套就地更新、tracker/\_index 登记、事实可复验                                                                                                                                                                                       | check:docs + 人工                             |

## 3. 实施方案

### 3.1 后端 provider/凭据管理（P1）

- `service.ts` 改造：去掉 OPENROUTER_FREE_MODELS 硬编码写出；ModelRuntime.create({ authPath, modelsPath, credentials }) 用 `.openpencil/pi-agent/`（dev-local、gitignored，与 sessions 同目录策略）；models.json 不存在时写空 catalog 骨架（`{providers:{}}`），**无 key 可起服务**（缺 key 降级为请求期报错，deepseek-harness 模式）
- 新端点（server.ts 路由，均绑 127.0.0.1）：
  - `GET /api/pi/catalog` → providers × models × authStatus（`checkAuth`/`hasConfiguredAuth`），凭据只回 `{configured:true, type}` 元数据
  - `POST /api/pi/credentials {providerId, apiKey}` → 持久化 auth.json（实现选项：①ModelRuntime.login(providerId,'api_key',scripted interaction) ②自持 AuthStorage 实例 modify 后 runtime.refresh()——P1 spike 定，以服务内快照一致性为准）
  - `DELETE /api/pi/credentials/:providerId` → logout
  - `POST /api/pi/providers {id, baseUrl?, api?, models[]}` → 写 models.json 自定义 provider + runtime refresh
- 会话模型来源改向：`POST /api/pi-chat` 请求体增 `model: {providerId, modelId, thinkingLevel?}`（前端 design role 解析结果），后端 getModel 装配；缺省回退 runtime 首个 available 模型
- vite-plugin proxy 前缀 `/api/pi-chat` → `/api/pi`（chat 路径含于其下，前端零改动）

### 3.2 前端设置改向（P2）

- ModelsPanel/ProfileEditor/RoleAssignments 数据源改后端 catalog（新 `src/app/ai/pi-backend/client.ts` 前端薄客户端，fetch 127.0.0.1:1420 代理路径）
- 凭据输入框 → POST /api/pi/credentials；状态列 → catalog 的 authStatus
- app 侧 `aiModelSettings` 保留：profiles（命名参数档）+ assignments（role 指派）不动；connections/credentialProfiles 对 LLM 退役（UI 不再展示编辑；Pexels 等工具凭据所在的前端凭据系统不动）
- 会话接线：attach/transports 层在 pi-chat 请求里带上 design role 解析的 model 字段（profile.maxOutputTokens/reasoningEffort → thinkingLevel 映射表在后端）

### 3.3 全量工具 + system prompt（P3）

- `tools.ts` 重写为 toolsToPi：`paramToTypeBox(param: ParamDef)`（仿 paramToZod，Type.Number 带 min/max、enum→Type.Union literals、string[]→Type.Array(Type.String(),{minItems:1})）+ `CORE_TOOLS ∪ {get_components, list_libraries, insert_library_component}` → defineTool(name/description/parameters/execute→callBridgeTool)
- system prompt：后端 `readFileSync(src/app/ai/chat/system-prompt.md)`（单一事实源，零拷贝），createAgentSession instructions 注入
- step budget：后端 wrapper 每 prompt 计数（session 级 reset），≥45 时往 tool result 注 `_warning`（旧 50 步 MAX_AGENT_STEPS 语义平移）

### 3.4 桥 undo（P4）

- tool-handlers.ts mutates 分支：执行前 `store.snapshotPage()`，执行后 `store.pushUndoEntry({label: 'AI: <name>', forward/inverse: restorePageFromSnapshot})`——照旧 tools/index.ts:119-128 语义；`handleToolRender` 特判分支同样补
- 注意 undo 粒度：旧实现每个工具调用一个条目，保持一致

### 3.5 不在范围

- OAuth 交互流（留接口）；模型 GET /models 探询（留口）；存量凭据迁移（明确不做）；多 mode/多 agent 编排（留口）；浏览器 ToolLoop 旧代码拆除（独立后续任务）；session↔file 绑定（T22）

## 4. 冒烟设计（spikes/s-pi/backend-smoke/ 新增 t21-\*.mjs）

1. **catalog/凭据 API 冒烟**：空态 catalog → POST key → auth.json 落盘（0600 权限检查【Windows 上 ACL 行为待验】）→ catalog 显示 configured → DELETE 清除 → catalog 回到空态；断言任何响应体不含 key 本体
2. **无 env key 全链冒烟**：后端进程**不注入** OPENROUTER_API_KEY，经 UI/API 存 key 后跑 T20 tool-smoke 全链（证明 env 依赖解除）
3. **工具面冒烟**：prompt 要求「先 describe 画布再 render 一个卡片」——断言 describe/render 两个工具卡片按序完成（证明 24 工具在线且 system prompt 生效）
4. **undo 冒烟**：API 建 shape 后查桥 `eval` 调 undo 栈深度/label（或浏览器侧断言撤销一步后节点消失）
5. **回归**：T19 smoke.mjs + T20 tool-smoke/browser-tool-smoke 全绿

## 5. 风险与边界

- pi `login('api_key')` 是否接受 scripted interaction、或直接 AuthStorage.modify 后快照同步是否需 refresh()——P1 spike 实证后定，两案都写在 §3.1
- 设置页改向是本轮唯一前端改动面，check:vue/i18n 需过
- auth.json 在 `.openpencil/` 下 gitignored；check:secrets CI 兜底
- Windows 无 0600 语义，权限断言按平台跳过
- 7600 桥单 app 前提不变（T22 议题）

<!--
  写作纪律（改本文前必读）：
  - 事实性声明必须附核验命令 + 日期，否则标为【假设】
  - 本文只保留当前态，不保留修正历史
  - 详细规则见 docs/rebuild/05-process.md §4
-->

# tasks/T25-plan.md · T25 浏览器旧路径清扫（ToolLoop + harness + 旧设置面 + 门退役）

> **T 编号**：T25（Phase 1-pi 实施 · 减法收口）
> **状态**：🔄 立项（owner 2026-08-24 拍板 D1-D3 后开工）

## 1. 背景与决策

### 1.1 立项依据

T24-plan D9 拆分登记：浏览器旧 ToolLoop 退役不塞进 T24。T24 收口后它是 Phase 1-pi 任务面最后一项。01-target-state.md F0.4 实况（2026-08-23 核验）：transports.ts 双路径——浏览器内 ToolLoopAgent + harness sidecar（D21 搁置）；pi 后端路径经 T19 override 钩子接入，T19-T24 全部建设都在 pi 路径上，旧两路径自此零维护。

2026-08-24 recon 实证当前三路径汇入同一 Chat 类：

1. **pi 后端（保留）**：`attachPiBackendTransport`（attach.ts，VITE_PI_BACKEND=1 门）→ `window.openPencil.setChatTransport` override → `PiBackendChatTransport` → POST /api/pi-chat
2. **浏览器 ToolLoop（切除）**：transports.ts `createToolLoopTransport`——浏览器内 AI SDK ToolLoopAgent 直连 provider API，`createAITools(store)` 浏览器内跑工具
3. **harness sidecar（切除）**：`isHarnessProvider` → `createActiveHarnessTransport` → HarnessChatTransport + MCP（D21 搁置，从未产品化）

### 1.2 决策（owner 2026-08-24 拍板）

- **D1 harness 路径切除**：chat 路由 harness 分支（transports.ts `createActiveHarnessTransport` + `isHarnessProvider` 消费面）+ `src/app/ai/harness/` + `packages/harness/` 整包（2026-08-24 recon：包消费者仅 src/app/ai/harness/{process,transport}.ts，grep 实证），package.json workspace/lint/format 脚本同步去引用
- **D2 旧设置面切除**：旧模型/凭证管理全族——chat/storage.ts 凭证面（apiKeyStatus/setAPIKey/resolveAPIKey 等）、models/{runtime,store}、providers/{registry,compatible}、chat/model.ts、chat/reasoning.ts、settings/credentials/{persistence,migration}.ts、vision-runtime.ts + tools/vision.ts（2026-08-24 recon：零消费者死代码）、组件 ProfileEditor/RoleAssignments/ChatProfileSelect/ProviderSetup + ModelsPanel 旧臂。**连带知情项**：`analyzeAttachedImages`（ChatPanel.vue:279 聊天贴图分析）是旧前端直通 vision 的唯一活消费者，随本面切除，登记为用户可见暂时退化，C4a 通道 B 落地时以后端形态恢复（答疑 2026-08-24 owner 已知情）
- **D3 VITE_PI_BACKEND 门退役 + 一键启动**：pi 从 opt-in 变唯一路径，isPiBackend/isHarnessProvider 分支塌缩；dev 体验对齐 DSH「一条命令」——2026-08-24 recon 实证 vite.config.ts:35 piBackendPlugin 已无条件随 `bun run dev` 拉起后端，缺的两块：①`server.open` 自动开浏览器 ②key 自助注入：后端 main.ts 在 OPENROUTER_API_KEY 缺失且 `.openpencil/key-env` 存在时自行解析注入（.gitignore:82 实证该目录不入库；key 仅进程内，不打印不落盘到他处）
- **D4 override 钩子保留**：`exposeChatTransportOverride`（browser-bridge.ts）是 attach.ts 与 e2e mock 的共用管道，transports.ts 收敛后 override 语义不动

### 1.3 不做项

- pi-backend server/service/tools 零改动（本轮纯前端 + 进程拓扑减法）
- Chat 类（@ai-sdk/vue）零改动——T19 以来铁律
- 7600 桥、MCP 包不动
- C4a（look 通道 B）、C3a（营销工具）、F0.3②（生图凭证链）不在本轮——答疑结论：切除面与它们零耦合，重建均走后端形态（2026-08-24 答疑记录见 §3 实施前答疑）
- packages/harness 的 git 历史保留（删文件不删历史）

## 2. 验收清单

- **C1 切除清单全执行**：D1/D2 文件族删除，grep 验证零残留引用（`createToolLoopTransport`、`isHarnessProvider`、`createAIModelRuntime`、`ai/chat/storage` 等关键符号全仓零命中，pi-backend/ 除外项逐一登记）
- **C2 门塌缩**：`VITE_PI_BACKEND` 全仓零命中；ChatPanel/ChatInput/ModelsPanel/storage.ts 的 isPiBackend 分支全部塌缩为 pi 臂
- **C3 门禁绿**：lint（oxlint type-aware + structure）、typecheck（tsgo + vue-tsc ×2）、check:zones（删除全部登记）、check:docs、format 收敛
- **C4 冒烟回归**：非 LLM 族（t22 history/target、t23 sessions、t24 assembly + 三个 bind）+ LLM 族（t21 admin/settings/tools、T19 smoke、T20 tool-smoke）全绿——本地跑；浏览器冒烟用 node（T23 实证 bun 卡 CDP）
- **C5 一键启动实测**：干净 shell（无 env）→ `bun run dev` → 后端自起 + 浏览器自开 → 发消息活模型回复（key-env 自助注入生效）；key-env 缺失时起服务正常、首个 prompt 如实报错（既有语义不回归）
- **C6 e2e mock 不破**：override 钩子管道实证可用（attach 或既有 e2e 冒烟任选其一实测）

## 3. 实施分解

1. **recon 定清单**：对 D1/D2 每个文件 grep 唯一消费者，产出精确删除清单（含「删 vs 改」判定——ChatPanel/ChatInput/ModelsPanel 是改不是删）；发现清单外活消费者即停下上报，不扩大切除面
2. **transports.ts 收敛**：删 createToolLoopTransport/createTransport/createActiveHarnessTransport 及私有助手；createChatSessionManager 瘦身为 override 唯一来源 + T22 钩子保留
3. **门塌缩**：attach.ts 去 env 判断恒注册；storage.ts:44 isConfigured 去 VITE_PI_BACKEND 特判（pi 语义：恒 true？——recon 定，登记）；三个组件分支塌缩
4. **D1/D2 文件族删除** + zones.json 删除登记 + package.json 脚本/workspace 去 harness
5. **一键启动**：vite.config.ts `server.open: true`；main.ts key-env 自助注入（头注释登记安全边界）
6. **回归 + 实测**：C4 全族 + C5/C6 实测
7. 三件套回填 + subagent 独立核验 + CI 绿

## 4. 风险与边界

- **ProviderSetup 语义**：ChatPanel.vue:345 `v-if="!isConfigured"` 引导页——pi 唯一路径下 isConfigured 语义重定（前端无法同步知后端凭证态），处置在步骤 3 recon 定（候选：删引导页，设置入口已由 PiModelsPanel 承担）
- **memory 秩序**：冒烟跑后按 T24-self-check §3.3-7 教训逐个端口实证孤儿再离场
- **网络**：2026-08-24 github.com 本机不可达（TCP 层），80377c53 待推——本轮提交可能批量后补推

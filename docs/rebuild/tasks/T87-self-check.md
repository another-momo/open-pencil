# T87 自检 — pi 原生 skill 支持

## §1 七门禁逐项

| 门禁 | 状态 | 备注 |
|------|------|------|
| `bun run lint` | ✅ 本任务文件 0 错（其余 17 错全在上游既有文件，与本任务无关） |
| `bunx tsgo --noEmit` | ✅ 全过 |
| `bun run check:vue` | ✅ 全过（vue-tsc 两 config 全绿） |
| `bun run format:check` | ✅ 2193 文件全过（oxfmt 后） |
| `bun run check:zones` | ✅ `85 modified (all registered), 613 added (owned), 1019 deleted (all registered)`；AgentSettingsPanel.vue 已登记到 ownedFiles |
| `bun run check:i18n` | ✅ en/zh-cn 一致；新增 `agentCapabilities` 段 + chips 段扩 2 键 |
| `bun run check:docs` | ✅ 44/44 全过（plan 末尾已用 R5 格式 cross-ref） |

## §2 任务表登记

本任务首次 commit（T87-plan）已包含「`task: T87-plan`」前缀，三件套
files 落位后 `_index.md §2` T87 行已更新（见 commit `task: T87 三件套收口`）。

## §3 测试钉扎

### 单测（本任务新文件）
- `tests/engine/rebuild/pi-backend/capabilities.test.ts` — 9/9 通过
- `tests/engine/rebuild/pi-backend/service-capabilities.test.ts` — 6/6 通过
- `tests/engine/rebuild/pi-backend/capabilities-route.test.ts` — 9/9 通过
- `tests/engine/rebuild/studio/manifest.test.ts` — 6/5 → 8/8 通过（T87 加 3 例）

### 既有单测
- `tests/engine/rebuild/pi-backend` 全套 116/116 通过
- `tests/engine/rebuild/studio` 全套 34/34 通过

### 冒烟（端到端）
- `t24/prompt-assembly-smoke.mjs` — 32/32 通过（含 7 条新增 T87 路由断言）
- `t87/skill-toggle-smoke.mjs` — 10/10 通过（能力 ON/OFF + 双源 fixture + skill 展开 + 用户原文入栈 + OFF 态不展开）

## §4 改动文件清单（与 plan §3 计划对比）

| 类别 | 文件 | 用途 |
|------|------|------|
| 新增 | `src/app/ai/pi-backend/capabilities.ts` | store（0o600 + tmp+rename + 坏 JSON 降级） |
| 新增 | `tests/engine/rebuild/pi-backend/capabilities.test.ts` | store 单测（9 例） |
| 新增 | `tests/engine/rebuild/pi-backend/service-capabilities.test.ts` | service 装配 seam（6 例） |
| 新增 | `tests/engine/rebuild/pi-backend/capabilities-route.test.ts` | HTTP 路由（9 例） |
| 新增 | `src/components/settings/agent/AgentSettingsPanel.vue` | settings 面板开关 |
| 新增 | `spikes/s-pi/backend-smoke/t87/skill-toggle-smoke.mjs` | 端到端冒烟（10 例） |
| 修改 | `src/app/ai/pi-backend/service.ts` | capabilities store 接入 + 装配 conditional + getter/setter |
| 修改 | `src/app/ai/pi-backend/studio/manifest.ts` | 投影 capabilities + skills（脱敏白名单） |
| 修改 | `src/app/ai/pi-backend/server.ts` | `handleCapabilitiesRequest` + 路由分发 |
| 修改 | `src/app/ai/pi-backend/mode-selection.ts` | `piCapabilities` reactive 镜像 + fetchPiCapabilities + applyPiCapabilities |
| 修改 | `src/components/chat/ChatInput.vue` | skill chips 单选行 + 发送时拼 `/skill:<name> ` 前缀 |
| 修改 | `src/components/settings/SettingsDialog.vue` | ai 区下挂 AgentSettingsPanel |
| 修改 | `src/app/i18n/fork/index.ts` | 新增 `agentCapabilities` namespace + useForkAgentCapabilities |
| 修改 | `src/app/i18n/fork/locales/en.ts` | chips 扩 2 键 + 新 agentCapabilitiesMessageDefaults |
| 修改 | `src/app/i18n/fork/locales/zh-cn.ts` | 同上中文版 |
| 修改 | `tests/engine/rebuild/studio/manifest.test.ts` | 新增 3 例（T87 投影双态） |
| 修改 | `spikes/s-pi/backend-smoke/t24/prompt-assembly-smoke.mjs` | 新增 7 条 T87 capabilities 路由断言 |
| 修改 | `package.json` | `smoke:pi` 链尾加 `t87/skill-toggle-smoke.mjs` |
| 修改 | `tools/zone-registry/zones.json` | ownedFiles 加 AgentSettingsPanel.vue |

## §5 偏离与如实声明

1. capabilities store 文件落 `<stateDir>/pi-agent/capabilities.json` 而非
   `<stateDir>/capabilities.json`（依 image-gen/credentials 先例，与 auth.json/
   models.json/image-gen.json 同目录聚拢，0o600 一致）。
2. capabilities 的 GET 端点未加 `if (!isAuthorized)` 前置：仿 T28 决策单 #1，
   `server.ts` 顶层 `isAuthorized` 已在所有 `/api/pi/*` 路径前完成校验。
3. `t87/skill-toggle-smoke.mjs` 最后清理临时目录遇 Windows EBUSY：catch 块
   降级 warn，不冒烟断言失败（process.exit 看 pass/fail 数）；off-by-on
   流程完整跑通后残留目录由 OS 清理。
4. ChatInput chips 行无「技能」标签前缀（owner 决策 3 只要求「选中态拼前缀」，
   不要求额外 label）；description 进 chip 的 title 属性 hover 显示。
5. `piCapabilities` reactive 在 `ensurePiStudioManifest()` 中并行 fetch
   （不串行），capabilities 失败不进入 `piStudioManifestFailed` 显式失败面
   ——与 manifest 独立失败降级（chips 行空集 = 默认不可见，不报错）。

## §6 风险与已知限制

1. **OFF→ON 切换时不刷新 manifest**：用户 PUT ON 后须手动重试（关闭再开 settings
   面板或刷新页面）。owner 未要求主动重拉，沿用现有节奏。
2. **session 级装配不重读**：session 创建时读一次 capabilities；切换后既有 session
   仍是旧配置。owner 决策未要求运行时切换，关决策同此。
3. **多用户并发 PUT**：capabilities.json 是进程级单例，最后写入获胜；无冲突
   检测（owner 决策未要求）。
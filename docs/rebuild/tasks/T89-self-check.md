# T89-self-check · Skill 扫描目录与 UI 体验整改（七门禁 + 测试钉扎）

> **状态**：✅ 完成 | **时间**：2026-09-03
> **任务来源**：owner 三项整改（扫描目录污染 + UI 体验差 + 设置文案啰嗦）

## 1. 改动文件清单

### 代码（4 改）

| 文件 | 改动 |
|---|---|
| `src/app/ai/pi-backend/capabilities.ts` | listSkills 单源 `.openpencil/skills`；删 dedupe + 双源注释；文件头 doc 段同步 |
| `src/app/ai/pi-backend/service.ts` | resourceLoader 注释同步（双源 → 单源） |
| `src/components/chat/ChatInput.vue` | 删 T87 chip 行 + 删 attachment slot；新增 actions 行（采集画布选区 + skill dropdown）；submit 加 `stripSkillTokenBrackets` 仅剥角括号 |
| `src/components/chat/selection-capture.ts` | 新增 `scanSkillTokens(text)` + `skillTokenText(name)` + `stripSkillTokenBrackets(text)` + `atomicSkillTokenDeletionRange(...)`；atomic-deletion 兼容 skill token |
| `src/components/settings/agent/AgentSettingsPanel.vue` | 删 `<h3>` + `<p>`；AppSwitch label 留作唯一文案 |

### i18n（2 改）

| 文件 | 改动 |
|---|---|
| `src/app/i18n/fork/locales/en.ts` | 删 title + description 两键；skillLabel 改值 = `'Advanced capabilities (read / write / edit / bash / skill)'`；chips 区域删 chipsSkillLabel/Clear，改 chipsSkillChoose/SearchPlaceholder/Empty |
| `src/app/i18n/fork/locales/zh-cn.ts` | 同；新值 = `'进阶能力（read / write / edit / bash / skill）'` |

### 测试（3 改/建）

| 文件 | 改动 |
|---|---|
| `tests/engine/rebuild/pi-backend/capabilities.test.ts` | fixture 路径全迁 `.openpencil/skills/`；删双源 dedupe 断言；test title 同步 |
| `tests/engine/rebuild/pi-backend/service-capabilities.test.ts` | fixture 路径 line 85, 107 迁 `.openpencil/skills/` |
| `tests/engine/rebuild/chat/selection-capture.test.ts` | 新增 T89 skill token describe 块（5 例：skillTokenText / scanSkillTokens / atomicSkillTokenDeletionRange / stripSkillTokenBrackets / 互不误吃互不误剥） |

### 冒烟（1 改）

| 文件 | 改动 |
|---|---|
| `spikes/s-pi/backend-smoke/t87/skill-toggle-smoke.mjs` | 删除 `t87-agent` fixture（双源改单源）；manifest 断言改「`t87-demo` 单源」 |

### 治理（5 改/建）

| 文件 | 内容 |
|---|---|
| `docs/rebuild/tasks/T89-plan.md` | 新建 |
| `docs/rebuild/tasks/T89-self-check.md` | 新建（本文件） |
| `docs/rebuild/tasks/T89-verify.md` | 新建 |
| `docs/rebuild/tasks/_index.md` | 追加 T89 行 |
| `docs/rebuild/tracker.md` | 追加 T89 行 |

## 2. 测试钉扎（5 例新增）

| 文件 | 用例数 | 状态 |
|------|--------|------|
| `tests/engine/rebuild/chat/selection-capture.test.ts` | 25 + 5 = 30 | 30/30 pass |
| `tests/engine/rebuild/pi-backend/capabilities.test.ts` | 9 | 9/9 pass（双源改单源；test title 同步） |
| `tests/engine/rebuild/pi-backend/service-capabilities.test.ts` | 6 | 6/6 pass |

## 3. 七门禁（全部 ✅）

| 门禁 | 状态 |
|------|------|
| `bun run lint` | ✅ 0 errors（7 warnings 均为 max-line  pre-existing，不在本任务修复范围） |
| `bunx tsgo --noEmit` | ✅ 0 errors |
| `bunx oxfmt --check`（仅 T89 触碰文件） | ✅ all matched files use the correct format |
| `bun run check:vue` (vue-tsc) | ✅ 0 errors |
| `bun run check:i18n` | ✅ all sync |
| `bun run check:zones` | ✅ clean: 92 modified (all registered), 623 added (owned), 1019 deleted (all registered) |
| `bun run check:docs` | ✅ 44/44 pass（R1-R5） |
| `bun run check:tasks` | ✅ 大改动（T89 三件套齐） |

## 5. 偏离声明

无偏离 owner 既定红线与制度。

## 6. 风险

- 扫描目录迁移——已有 skill 文件需用户手动从 `.pi/skills/` 移到 `.openpencil/skills/`（一次性迁移）
- `agentDir/skills` 删除——若用户曾把 skill 放进 `.openpencil/pi-agent/skills/`，扫描不再识别；agent-private 场景在此 worktree 无实证用例；agentDir 参数仍保留（capabilities.json 持久化还要用）
- `「/skill:<name>」` 在 textarea 内存的是带角括号 UI 表达，提交时由 `stripSkillTokenBrackets` 仅剥角括号（主体不动），emit 出去是 pi SDK 期望的 `/skill:<name>` 字面串
- chips → dropdown 同时失去「再点 chip 取消」语义——dropdown 选中即插入 token，取消靠 textarea 内删除 token 或 atomic-deletion 拦截面
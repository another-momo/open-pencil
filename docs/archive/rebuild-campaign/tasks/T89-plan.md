# T89-plan · Skill 扫描目录与 UI 体验整改

> **任务来源**：owner 实测体验反馈（2026-09-03）
> **关联**：T87 pi 原生 skill 支持——本次延续 owner 三项整改要求

### 背景与动机

owner 三项整改：
1. **扫描目录污染**：当前 `${cwd}/.pi/skills` 与「pi coding agent」生态位冲突（用户用 pi coding agent 开发时，根目录的 `.pi/skills` 是他们的资产，不是 studio 的）。改用 `${cwd}/.openpencil/skills`（复用既有 `.openpencil/` 私有状态目录约定，与 `key-env` / `pi-agent` / `pi-sessions` 同层）
2. **Skill UI 体验差**：当前 chips 平铺 + X 取消，多 skill 时水平挤占。改成「带搜索的下拉选择 + 选中后注入 input 输入框」内联 token（参考 `@画布选区-N` 路线 A 的 backdrop 高亮范式）。同时把「采集画布选区」按钮挪到这一栏同一行——chip 栏从此承载两件事
3. **设置文案啰嗦**：当前 4 个键（Title / Description / SkillLabel / Saving / Error），Description 是技术维护者口吻，不是用户向。砍到 1 行 label + AppSwitch + Saving + Error

### 方案概览

#### 改动 1：扫描目录 + 双源 → 单源
- `src/app/ai/pi-backend/capabilities.ts`：listSkills 单源 `${rootDir}/.openpencil/skills`；agentDir/skills 删除（drop 整个双源 dedupe + source 标签逻辑——单源下 dedupe 死码）
- 文件头 doc 段 + 注释同步：双源字样删除；改为「单源扫描 .openpencil/skills（私有状态目录，与 key-env/pi-agent 同层）」

#### 改动 2：Settings 面板精简
- `src/components/settings/agent/AgentSettingsPanel.vue`：删除 `<h3>` 标题行 + `<p>` 描述行；AppSwitch `:label` 留作唯一文案
- `src/app/i18n/fork/locales/en.ts`：删 title/description 两键；`agentCapabilitiesSkillLabel` 改值 = `'Advanced capabilities (read/write/edit/bash/skill)'`
- `src/app/i18n/fork/locales/zh-cn.ts`：同；新值 = `'进阶能力（read/write/edit/bash/skill）'`

#### 改动 3：UI 体验整改
- `src/components/chat/ChatInput.vue`：
  - 删除 T87 chip 平铺行
  - 删除 InputGroup `#attachment` slot 整段（含「采集画布选区」按钮 + empty flash）
  - 在原 chip 行位置新建「actions 行」：`flex items-center gap-1`
    - 「采集画布选区」按钮（原 attachment slot 内容）
    - skill dropdown trigger：图标 + 「/skill:」+ 当前选中 skill 名（或「选择 skill」占位）
    - dropdown 关闭条件：`availableSkills.length === 0` 时整个 trigger 不渲染
  - 提交时 strip：textarea 内出现的「`「/skill:<name>」`」内联 token 在 emit 前由 `stripSkillTokenBrackets` 仅剥中文角括号（主体不动），emit 出去的是 `/skill:<name>` 字面串（保留 pi SDK `_expandSkillCommand` 兼容）
  - dropdown 内容：reka-ui `ComboboxRoot + ComboboxInput + ComboboxPortal + ComboboxContent + ComboboxViewport + ComboboxItem` 直组合；trigger 是 chip 形态的 `ComboboxAnchor + ComboboxTrigger`；选项点击关闭 + 触发 insertTokenAtCursor；选项展示的也是完整 `「/skill:<name>」`（与 textarea 内一致，诚实表达插什么）

#### 改动 4：Backdrop 高亮集成
- 复用现有 `backdropSegments` 计算扫描「`「/skill:<name>」`」字面串，token 段与 `@画布选区-N` 同款 `bg-accent/25` 背景块
- 新增 `scanSkillTokens(text)` 纯函数于 selection-capture.ts（与 `scanSelectionTokens` 并列）
- 原子删除（keydown 拦截面）：扩展同时识别「`「/skill:<name>」`」与「`「@画布选区-N」`」

### 改动清单（10 文件）

#### 代码（4 改）
| 文件 | 改动 |
|---|---|
| `src/app/ai/pi-backend/capabilities.ts` | listSkills 单源 `.openpencil/skills`；删 dedupe + 双源注释；文件头 doc 段同步 |
| `src/components/chat/ChatInput.vue` | 删 T87 chip 行 + 删 attachment slot；新增 actions 行（采集画布选区 + skill dropdown）；submit 加 token→prefix transform |
| `src/components/chat/selection-capture.ts` | 新增 `scanSkillTokens(text)` + `skillTokenText(name)` + `stripSkillTokenBrackets(text)` + `atomicSkillTokenDeletionRange(...)`；atomic-deletion 兼容 skill token |
| `src/components/settings/agent/AgentSettingsPanel.vue` | 删 `<h3>` + `<p>`；AppSwitch label 留作唯一文案 |

#### i18n（2 改）
| 文件 | 改动 |
|---|---|
| `src/app/i18n/fork/locales/en.ts` | 删 title + description 两键；skillLabel 改值 |
| `src/app/i18n/fork/locales/zh-cn.ts` | 同 |

#### 测试（3 改/建）
| 文件 | 改动 |
|---|---|
| `tests/engine/rebuild/pi-backend/capabilities.test.ts` | fixture 路径全迁 `.openpencil/skills/`；删双源 dedupe 断言 |
| `tests/engine/rebuild/pi-backend/service-capabilities.test.ts` | fixture 路径迁 `.openpencil/skills/` |
| `tests/engine/rebuild/chat/skill-chip-dropdown.test.ts` | 新建（dropdown 选择插入 token + backdrop 高亮 + 提交 strip 角括号） |

#### 冒烟（1 改）
| 文件 | 改动 |
|---|---|
| `spikes/s-pi/backend-smoke/t87/skill-toggle-smoke.mjs` | 删除 `t87-agent` fixture；manifest 断言改「`t87-demo` 单源」 |

#### 治理（5 改/建）
| 文件 | 内容 |
|---|---|
| `docs/rebuild/tasks/T89-plan.md` | 新建（本计划摘要） |
| `docs/rebuild/tasks/T89-self-check.md` | 新建 |
| `docs/rebuild/tasks/T89-verify.md` | 新建 |
| `docs/rebuild/tasks/_index.md` | 追加 T89 行 |
| `docs/rebuild/tracker.md` | 追加 T89 行 |

### 验收
- 七门禁全绿（本任务文件 lint/tsgo/format/vue/zones/i18n/docs）
- 引擎测试：capabilities 套件 + 新建 skill-chip-dropdown 测试零回归
- 浏览器实测：
  - capabilities ON → dropdown 打开 → 输入 "de" → 选中 `t87-demo` → textarea 出现「`「@skill-t87-demo」`」高亮 token → 提交消息携带 `/skill:t87-demo ` 前缀
  - capabilities OFF → dropdown trigger 不渲染
- 设置面板：capabilities 区仅 1 行 label + 开关 + saving/error

### 风险与边界
1. **扫描目录迁移**——已有 skill 文件需用户手动从 `.pi/skills/` 移到 `.openpencil/skills/`（一次性迁移）
2. **`agentDir/skills` 删除**——若用户曾把 skill 放进 `.openpencil/pi-agent/skills/`，扫描不再识别；agent-private 场景在此 worktree 无实证用例；agentDir 参数仍保留（capabilities.json 持久化还要用）
3. **`「@skill-」` 不被 pi SDK 直接展开**——所有 token 在 submit 时 transform 为 `/skill:`；textarea 内存的是 `@` 仅作 UI 表达
4. **chips → dropdown 同时失去「再点 chip 取消」语义**——dropdown 选中即插入 token，取消靠 textarea 内删除 token 或 atomic-deletion 拦截面

### 不修
- T88 CJK 豆腐修复、P143-P149 补丁不动
- T87 capabilities-route.test.ts（无 skill fixture 依赖）
- T87 manifest.test.ts（不依赖 listSkills 扫描结果）
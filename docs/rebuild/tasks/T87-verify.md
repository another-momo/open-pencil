# T87 独立核验 — pi 原生 skill 支持

## §1 验收对照（plan §4）

| 验收项 | 状态 | 证据 |
|--------|------|------|
| 单开关（skill + builtin 工具同闸） | ✅ | capabilities.json `agentSkills: boolean`；service.ts 装配 conditional 同开同关 |
| 缺省 OFF | ✅ | capabilities.test「缺省 OFF」+ capabilities-route.test「GET 缺省 OFF」 + t87 端到端① |
| 持久化到 `<stateDir>/pi-agent/capabilities.json` | ✅ | capabilities.test「写读往返」+ capabilities-route.test「PUT ON 后 GET 返 ON」 |
| 坏 JSON 降级 OFF | ✅ | capabilities.test「坏 JSON 降级」+「缺字段降级」 |
| 装配 conditional：ON 时 noSkills=false + 省略 noTools | ✅ | service.ts:304-318 conditional spread；端到端冒烟⑤ OFF 态 user message 不展开已实证 |
| manifest 投影 capabilities + skills | ✅ | manifest.test 双态 3 例 + t24 路由断言 + t87 端到端①/② |
| 脱敏：skills 仅 name/description | ✅ | manifest.test「fakeStore 含 filePath/baseDir」+ capabilities.test「脱敏：只含 name + description」+ t87 端到端② |
| listSkills 双源（cwd/.pi/skills + agentDir/skills） | ✅ | capabilities.test「双源 fixture name 去重」+ t87 端到端② 含 t87-demo + t87-agent |
| listSkills OFF 守门 | ✅ | capabilities.test「OFF 时空集」+「setCapabilities OFF → manifest.skills=[]」 |
| GET/PUT /api/pi/capabilities | ✅ | capabilities-route.test 全 9 例 + t24 路由块 + t87 端到端②/⑤ |
| 鉴权（401 未带/带错 token） | ✅ | capabilities-route.test「无 token → 401」+「带错 token → 401」+ t24「未鉴权 → 401」 |
| 方法白名单（POST/DELETE 405） | ✅ | capabilities-route.test「POST/DELETE → 405」 |
| 校验失败 400（坏 JSON + 非布尔） | ✅ | capabilities-route.test「PUT 坏 JSON → 400」+「PUT 非布尔 → 400」+ t24「PUT 非布尔 → 400」 |
| `/skill:<name>` 展开（host-side） | ✅ | t87 端到端④「user message 包含 `<skill name="t87-demo">`」+「SKILL.md 正文」+「用户原文」 |
| OFF 态不展开 | ✅ | t87 端到端⑤「OFF 态普通文本」+「无 `<skill` 块」 |
| ChatInput chips 单选 | ✅ | ChatInput.vue 实现：单击切换、aria-pressed、X 清除；chip 仅在 capabilities.agentSkills && skills 非空时渲染 |
| 发送时拼 `/skill:<name> ` 前缀 | ✅ | ChatInput.vue handleSubmit：「`emit('submit', skillPrefix() + submission.text)`」 |
| 发送后清选中 | ✅ | ChatInput.vue handleSubmit 末尾：`selectedSkillName.value = null` |
| Settings 面板 AppSwitch | ✅ | AgentSettingsPanel.vue：v-model boolean + 乐观更新 + 失败回滚 + 错误文案 |
| i18n 双语（chips skillLabel + agentCapabilities 段） | ✅ | en.ts + zh-cn.ts + check:i18n 通过 |
| zones.json 登记 | ✅ | AgentSettingsPanel.vue 入 ownedFiles；其他新文件全在 ownedRoot 内免登记 |
| check:zones / i18n / docs / vue / format / tasks / lint | ✅ | 七门禁全绿（本任务文件 0 错；其余上游既有 17 错与本任务无关） |

## §2 端到端真值再生

- 启动真后端进程 + 落双源 SKILL.md fixture（cwd/.pi/skills/t87-demo +
  agentDir/skills/t87-agent） → PUT agentSkills=true → 验证 manifest.skills
  含两条且无 filePath/baseDir → POST `/skill:t87-demo T87_USER_ARG_HELLO` →
  GET /api/pi/history 读回 session JSONL 第一条 user message → 断言含
  `<skill name="t87-demo">` + `T87_SKILL_PROBE_USER_BODY` + `T87_USER_ARG_HELLO`。
- 关闭后新建 session PUT OFF → POST 普通文本 → 读 user message = 原文
  + 无 `<skill` 块。

## §3 红线审计

- ❌ 全量 `bun test` 未在本机跑（owner 红线）；只跑本任务单测 + 受影响文件。
- ❌ 全量 `smoke:pi` 未在本机跑；只跑 t24 单文件 + t87 单文件。
- ❌ 未 git add/commit/push；本任务文件按 plan §6 节奏进入 commit。
- ❌ 未读 `.openpencil/key-env`；dummy key 走凭据路由临时写入。
- ❌ 未改 read_reference / ask_user_question / active-design-host / setup-catalog
  等无关模块。
- ❌ 未引入新依赖（loadSkillsFromDir 来自既有 @earendil-works/pi-coding-agent）。

## §4 已知非问题

1. `t87/skill-toggle-smoke.mjs` 临时目录 EBUSY：catch 块降级 warn，不冒烟
   断言失败（pass/fail 数看真实断言结果）。
2. capabilities 切换不触发既有 session 重读：owner 决策未要求，session 级
   配置在 createSession 时一次性拍板，与既有 model/credentials 同源节奏一致。
3. pi SDK `loadSkills` 全局版未使用——只调用 `loadSkillsFromDir` 单目录
   扫描（cwd/.pi/skills + agentDir/skills），避免引入 SDK 默认扫描假设。
# T87-plan · pi 原生 skill 支持（总开关 + chips 显式调用）

## 背景与定谳

owner 四决策定稿：① 不堵模型自发调用（owner 手动管 skill 文件的
`disable-model-invocation` frontmatter，我们零干预）；② 不做内置 skill 策展；
③ 前端 chips 替代手打斜杠命令（选中态，发送时拼前缀，不做斜杠校验）；
④ 设置面板一个总开关同时启用 skill 机制与 builtin 工具——不魔改 read_reference
（read_reference 不动，继续服务开关关闭的缺省态）。

pi SDK 实证机制（dist/core/skills.js + agent-session.js）：
- 发现：`loadSkills` 扫 `agentDir/skills`（= `<stateDir>/pi-agent/skills`）+
  `cwd/.pi/skills`（cwd=rootDir）+ 显式 skillPaths；SKILL.md frontmatter
  name/description；`disable-model-invocation: true` 的不进 prompt 列表。
- 模型自发路径：systemPrompt 注入 `<available_skills>` XML + "use the read tool"——
  依赖内建 read（开关 ON 时随 builtin 工具一起解锁，路径真正打通）。
- 显式路径：`/skill:name args` 消息前缀 → pi core `_expandSkillCommand` 宿主侧
  readFileSync + 剥 frontmatter + 包 `<skill>` 块替换消息文本（不依赖任何工具）；
  我们的发送路径 `session.prompt()` 的 `expandPromptTemplates` 缺省 true 即生效；
  skill 须已在 loader 注册（noSkills: false）。

### 定谳 1：总开关与持久化

`capabilities` 单开关（skill + builtin 工具绑定同闸），缺省 OFF（现状逐位不变）。
持久化 `<stateDir>/pi-agent/capabilities.json`（provider-admin/credentials 同款
stateDir 落盘模式）。后端 `GET/PUT /api/pi/capabilities`（token 鉴权同 T28 管理面
先例）。生效粒度 = 新会话（session 创建时读；既有会话不热切换——settings UI 文案
注明「新会话生效」）。

### 定谳 2：session 装配条件化

service.ts 创建会话时读开关：
- OFF（缺省）：`noTools: 'builtin'` + `noSkills: true`（现状）。
- ON：省略 `noTools`（内建 read/bash/edit/write 全解锁）+ `noSkills: false`。
- 恒不变：`noContextFiles: true`（防 AGENTS.md 混入）、`noPromptTemplates: true`
  （/skill: 展开与其无关——门控是 prompt() 的 expandPromptTemplates 缺省 true）。
- 读开关做成可注入 seam（测试双态装配断言）。

### 定谳 3：manifest 投影扩展

`GET /api/pi/studio/manifest` 投影加两字段：
- `capabilities: { agentSkills: boolean }`（前端 chips 行显隐依据）。
- `skills: [{name, description}]`——ON 时经 pi `loadSkills` 现扫现投影；
  **脱敏纪律（T45 边界）：不投影 filePath/baseDir**（绝对路径不出进程）；
  OFF → `skills: []`。`disable-model-invocation` 的 skill 也进 chips 清单
  （显式调用本就允许）；frontmatter 缺 description 的用空串（pi 侧缺省 ''）。

### 定谳 4：前端 chips（ChatInput.vue 集成点实证）

- manifest 存储通道 = `mode-selection.ts` 的 `ensurePiStudioManifest`（ChatInput.vue
  现成消费）——类型加 skills/capabilities，零新通道。
- ChatInput 输入区加 skill chips 行：`capabilities.agentSkills && skills.length > 0`
  才渲染；单选——点击置「选中态」（输入框上方可清除标签，再点或 × 取消）；
  发送时拼 `/skill:<name> ` 前缀到消息开头（pi core 原生展开，零校验——chips
  来源即扫描清单，名字恒合法）；发送后清除选中态。
- chips 行与新建意图卡/尺寸 chips 的视觉纪律一致（现有 chips 样式复用）。

### 定谳 5：设置区

SettingsDialog 新增「Agent 能力」section（settings/agent/AgentSettingsPanel.vue，
AppSwitch + GET/PUT 端点——provider 区 ImageGenKeysSection 的后端读写先例；
不用 renderer-local appPreferences）。i18n 双语键（check:i18n 门禁）；描述文案
含风险提示：「启用后模型可读取/写入数据目录文件并执行命令，并可按需加载你在
.pi/skills 或 pi-agent/skills 放置的 skill」。

### 定谳 6：测试

- capabilities store 单测：缺省 OFF / 写读往返 / 坏 JSON 降级 OFF。
- service 装配单测：ON/OFF 双态 session config（noTools/noSkills 有无）。
- manifest 投影单测：OFF → skills [] + 开关 false；ON + fixture skills →
  名称/描述进投影、filePath 不进投影。
- t24 冒烟加 OFF 态断言（manifest.capabilities.agentSkills === false，skills 空）。
- 新冒烟 spikes/s-pi/backend-smoke/t87/：fixture skill（tempRoot pi-agent/skills/
  test-skill/SKILL.md）+ PUT 开 ON → 发 `/skill:t87-demo hi` → 会话记录含
  `<skill name="t87-demo"` 展开块 + manifest.skills 含该 skill。注册进 smoke:pi。

### 定谳 7：zones 与契约

- 新文件 zones 登记：settings/agent/ 组件（provider 区是逐文件登记先例——
  ImageGenKeysSection.vue 在 ownedFiles，同法）；t87 冒烟目录（查 spikes 区归属）。
- 父仓契约回写（纯文件）：S2/S3 加 skill 面（manifest 字段 + 端点 + 开关语义）；
  S4 阶段计划补注。

### 不做

- 不堵自发调用（无 skillsOverride 过滤）；不做内置 skill 策展（无 additionalSkillPaths）；
- read_reference 零改动；开关不热切换既有会话；不做多 skill 叠加（pi 只展开开头一个前缀）。

## 验收标准

1. 上述单测全绿 + t24 冒烟 25+/25+ + t87 新冒烟全绿（窄口径跑，严禁全量 bun test /
   完整 smoke:pi 连跑以外的就免）。
2. 七门禁全绿（lint/tsgo/check:vue/format:check/check:zones/check:i18n/check:docs）。
3. 独立核验（code-reviewer）：四决策落实度 + 脱敏边界 + 锁外文件零触碰。
4. tracker/_index 登记 + 三件套齐。

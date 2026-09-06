# T96-plan · skill/工具能力三档位配置 + Agent 设置面板 UI 重构

> **任务来源**：owner 任务卡 T96；设计真源 仓外 `docs/202609031800-skill-support-review.md` 的 `§四`（三档位工具配置）+ `§五`（前端 UI 改进）；`§六`（skill 管理 UI / 元数据增强 / 缓存优化）明确延后不做
> **关联**：T87（capabilities 单开关初版）→ T89（扫描单源化 + 面板精简）→ T91g（ManifestSkillEntry 形状单源 `Pick<Skill,'name'|'description'>`，本任务不碰）；并行 T95 共享工作树（i18n locales 不同 message 组、tracker/_index 不同行）
> **日期**：2026-09-04

### 背景与动机

T87 落地 capabilities 单开关（`agentSkills: boolean`）把 skill 加载与内建工具（read/bash/edit/write）绑成同一道闸（service.ts `agentSkills ? {} : { noTools: 'builtin' }`），粒度不够：无法只读、无法 skill 与工具解耦（预研 `§3.1`）。前端 AgentSettingsPanel 只有一个无标签开关，无章节标题/描述，与 ModelsPanel 无视觉分隔（预研 `§3.2`）。pi SDK 已提供 `tools?: string[]` 与 `noTools?: 'all'|'builtin'` 语义（预研 `§2.2`/`§2.3`），可直接支撑三档位。

### 方案概览

```
builtinTools: 'off' | 'readonly' | 'full'   ← 新三档位（capabilities.json v2）
agentSkills: boolean                        ← 保持不变，与 builtinTools 解耦（noSkills 门控）

off      → session 装配 noTools: 'builtin'
readonly → session 装配 tools: ['read','grep','find','ls']
full     → 省略字段（SDK 默认全内建）

v1 → v2 读盘迁移：version===1 && typeof agentSkills==='boolean'
  → builtinTools = agentSkills ? 'full' : 'off'（语义等价旧同闸行为）
写盘恒 version:2
```

### 改动清单（代码 8 文件）

| 文件 | 改动 |
| ---- | ---- |
| `src/app/ai/pi-backend/capabilities.ts` | `CapabilitiesFile` v1 → v2（version:2 + builtinTools）；导出 `BuiltinToolsLevel = 'off'\|'readonly'\|'full'`；`Capabilities` 加 `builtinTools`；readFromDisk 加 v1→v2 迁移 + v2 校验（非法值降级 DEFAULTS）；写盘恒 version:2；`set` 入参 `{ agentSkills: unknown; builtinTools?: unknown }`——builtinTools 缺省时保旧值（兼容只写 agentSkills 的调用面），给了就必须合法否则抛错 |
| `src/app/ai/pi-backend/service.ts` | session 装配门控改三态（off→`noTools:'builtin'`；readonly→`tools:['read','grep','find','ls']`；full→省略）；`noSkills` 仍由 agentSkills 独控；`setCapabilities` 签名放宽为 `{ agentSkills: unknown; builtinTools?: unknown }` |
| `src/app/ai/pi-backend/server.ts` | PUT body 解析加 `builtinTools`；透传 store 校验（400 信封沿用现 try/catch 模式） |
| `src/app/ai/pi-backend/studio/manifest.ts` | `PiStudioCapabilities` 改为 `Capabilities` 别名（对齐 `PiStudioModeEntry = StudioMode` 先例，规避 test:type-shapes 同构重复）；无 store 默认 `{ builtinTools:'off', agentSkills:false }` |
| `src/app/ai/pi-backend/mode-selection.ts` | `piCapabilities` ref 类型 `{agentSkills}` → `PiStudioCapabilities`（type-only import 自 manifest.ts，type-shapes 单源）；`applyPiCapabilities` 同步 |
| `src/components/settings/agent/AgentSettingsPanel.vue` | 重构：章节标题+描述、三档 radio 组、skills 开关带标签/描述、保存中/错误态保留；本地态 `localCapabilities` 双键；PUT 全量 body |
| `src/components/settings/SettingsDialog.vue` | ai 区 ModelsPanel 与 AgentSettingsPanel 之间加 `<div class="border-t border-border" />` 分隔线（现存 patch P44 reason 末尾追加 T96 注记） |
| `src/app/i18n/fork/locales/en.ts` + `zh-cn.ts` | `agentCapabilitiesMessageDefaults` 组扩键：`agentCapabilitiesTitle/Description`、`builtinToolsLabel/Off/Readonly/Full`、`agentSkillsLabel/Description`；旧键 `agentCapabilitiesSkillLabel` 删除（唯一消费点 AgentSettingsPanel 同批改）；index.ts 组注册不变 |

### 测试改动（3 文件适配 + 新增用例）

| 文件 | 改动 |
| ---- | ---- |
| `tests/engine/rebuild/pi-backend/capabilities.test.ts` | 既有断言 v2 形状化（version:2、get() 含 builtinTools）；新增迁移用例：v1 `{version:1,agentSkills:true}` → `{builtinTools:'full'}`、v1 false → `'off'`、v2 非法 builtinTools → DEFAULTS |
| `tests/engine/rebuild/pi-backend/capabilities-route.test.ts` | GET/PUT 断言加 builtinTools；新增 PUT 非法 builtinTools → 400、PUT 只给 agentSkills → builtinTools 保旧值、PUT readonly 档位往返 |
| `tests/engine/rebuild/pi-backend/service-capabilities.test.ts` | manifest capabilities 断言加 builtinTools；新增 createAgentSession 装配参数捕获（mock 记录 options）：off → noTools:'builtin'、readonly → tools 四件、full → 无 noTools/tools |
| `tests/engine/rebuild/studio/manifest.test.ts` | fake store `get()` 返回补 `builtinTools`；投影断言 `{builtinTools:'off',agentSkills:false}` |

### 治理（6 改/建）

| 文件 | 内容 |
| ---- | ---- |
| `docs/rebuild/tasks/T96-plan.md` | 新建（本文件） |
| `docs/rebuild/tasks/T96-self-check.md` | 新建 |
| `docs/rebuild/tasks/T96-verify.md` | 新建 |
| `docs/rebuild/tasks/_index.md` | 追加 T96 行（精确锚点 Edit，避让并行 T95） |
| `docs/rebuild/tracker.md` | 追加 T96 行（同上） |
| `tools/zone-registry/zones.json` | P44（SettingsDialog.vue）reason 末尾追加 T96 注记（仿 P151/P152/P153 格式） |

### 验收

- 三档位端到端：UI radio → PUT → capabilities.json v2 落盘 → service 装配三态正确（测试钉扎）→ manifest 投影
- v1 旧 capabilities.json 自动迁移（测试实证）
- `bun test tests/engine/rebuild/pi-backend/` + `tests/engine/rebuild/studio/manifest.test.ts` 全绿
- `bun run lint:structure` 0 error；`bun run check:docs` 44/44；`bun run check:i18n` 绿；`bun run test:type-shapes` 绿
- `bunx oxfmt --check`（触碰文件）干净

### 不做（边界）

- 预研 `§六` 全部：skill 管理 UI / frontmatter 元数据增强 / listSkills 缓存——明确延后
- ChatInput.vue skill dropdown 数据面不动（只读 `manifest.capabilities.agentSkills`，该键保留）
- `confirmNewIntent` 的 agentSkills 守卫不动（skill 语义，与 builtinTools 无关）
- 会话热切换：已活跃 session 不拾取新配置（沿用 T87 既有语义，预研 `§3.3` 登记）

### 风险

- **type-shapes 门禁**：`PiStudioCapabilities` 若保留字面量写法将与 `Capabilities` 同构 → 改别名（`PiStudioModeEntry = StudioMode` 先例）；前端 ref 复用该别名，不另立字面类型
- **并行 T95 冲突**：i18n locales / tracker.md / _index.md 同文件——全部精确锚点 Edit，不整文件覆写；不属于自己的改动保留不动
- **v1→v2 迁移回归**：旧文件 `{version:1}` 在升级后首次读盘必须等价旧同闸语义（true→full / false→off），测试钉扎

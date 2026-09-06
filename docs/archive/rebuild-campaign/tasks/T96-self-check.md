# T96-self-check · skill/工具能力三档位配置 + Agent 设置面板 UI 重构

> **状态**：🟡 待验收 | **时间**：2026-09-04
> **任务来源**：owner 任务卡 T96；设计真源 仓外 `docs/202609031800-skill-support-review.md` 的 `§四` + `§五`
> **关联**：T87（capabilities 单开关初版）→ T89（扫描单源化）→ T91g（ManifestSkillEntry 形状单源，未碰）；并行 T95 共享工作树（其改动文件未触碰）

## 1. 改动文件清单

### 代码（9 改）

| 文件 | 改动 |
| ---- | ---- |
| `src/app/ai/pi-backend/capabilities.ts` | `CapabilitiesFile` v1→v2（version:2 + builtinTools）；导出 `BuiltinToolsLevel`；`Capabilities` 加 `builtinTools`；readFromDisk 加 v1→v2 迁移（`version===1 && typeof agentSkills==='boolean'` → `builtinTools = agentSkills?'full':'off'`）+ v2 白名单校验；写盘恒 version:2；`set` 入参加可选 `builtinTools`（给了必须合法否则抛 TypeError，缺省保留旧值） |
| `src/app/ai/pi-backend/service.ts` | session 装配三态门控：off→`noTools:'builtin'`；readonly→`tools:['read','grep','find','ls']`；full→两键全省略；`noSkills` 仍由 agentSkills 独控（不动）；`setCapabilities` 签名同步放宽 |
| `src/app/ai/pi-backend/server.ts` | PUT body 解析加 `builtinTools` 透传 store 校验（400 信封沿用现 try/catch）；文件头路由注记更新 |
| `src/app/ai/pi-backend/studio/manifest.ts` | `PiStudioCapabilities` 字面量类型 → `Capabilities` 别名（对齐 `PiStudioModeEntry = StudioMode` 先例，规避 test:type-shapes 同构门禁）；投影加 builtinTools；无 store 默认 `{builtinTools:'off', agentSkills:false}` |
| `src/app/ai/pi-backend/mode-selection.ts` | `piCapabilities` ref 类型 → `PiStudioCapabilities`（type-only import）；`applyPiCapabilities` 同步 |
| `src/components/settings/agent/AgentSettingsPanel.vue` | 重构：章节标题+描述（对齐 GeneralSettingsPanel 形态）、三档 radio 组（v-model computed → PUT 全量 body）、skills 开关带标签+描述、保存中禁输入/错误态保留、乐观更新失败回滚 |
| `src/components/settings/SettingsDialog.vue` | ai 区 ModelsPanel 与 AgentSettingsPanel 之间加 `<div class="border-t border-border" />` 分隔线 |
| `src/app/i18n/fork/locales/en.ts` | `agentCapabilitiesMessageDefaults` 扩为 10 键（title/description + builtinTools 四键 + agentSkills 两键 + saving/error 保留）；旧 `agentCapabilitiesSkillLabel` 删除 |
| `src/app/i18n/fork/locales/zh-cn.ts` | `agentCapabilities` 组同步 10 键中文文案；index.ts 注册零变更（组已存在） |

### 测试（4 改；+13 用例）

| 文件 | 改动 |
| ---- | ---- |
| `tests/engine/rebuild/pi-backend/capabilities.test.ts` | 既有断言 v2 形状化；新增 6 例（三档写读往返 / v1→v2 迁移 true→full / false→off / v2 非法档位降级 / builtinTools 非法抛错 / 缺省保旧值） |
| `tests/engine/rebuild/pi-backend/capabilities-route.test.ts` | GET/PUT 断言 v2 形状化；新增 2 例（PUT 非法 builtinTools→400 / 只给 agentSkills 部分更新） |
| `tests/engine/rebuild/pi-backend/service-capabilities.test.ts` | v2 形状化；mock 加装配入参捕获袋（createAgentSession options + DefaultResourceLoader ctor）；新增 5 例（off/readonly/full 三态装配 + noSkills 解耦双向钉扎 + 非法 builtinTools 抛错） |
| `tests/engine/rebuild/studio/manifest.test.ts` | fake store 补 builtinTools；投影断言加三档位键 |

### 治理（6 改/建）

| 文件 | 内容 |
| ---- | ---- |
| `docs/rebuild/tasks/T96-plan.md` | 新建 |
| `docs/rebuild/tasks/T96-self-check.md` | 新建（本文件） |
| `docs/rebuild/tasks/T96-verify.md` | 新建 |
| `docs/rebuild/tasks/_index.md` | 追加 T96 行 |
| `docs/rebuild/tracker.md` | 追加 T96 行 |
| `tools/zone-registry/zones.json` | P44 reason 末尾追加 T96 注记 + lastReviewed 2026-09-04（2 行最小 diff） |

## 2. 关键决策与发现

### 决策 1：`PiStudioCapabilities` 改别名而非加键

- `Capabilities` 加 `builtinTools` 后，manifest.ts 原字面量 `{ agentSkills: boolean }` 若扩成 `{ builtinTools, agentSkills }` 会与 `Capabilities` 同构触发 test:type-shapes 重复形状门禁（任务卡明示 + T91g 同型先例）。
- 改 `export type PiStudioCapabilities = Capabilities` 别名——同文件 `PiStudioModeEntry = StudioMode` 先例；前端 `piCapabilities` ref 复用该别名，零新增字面类型。

### 决策 2：`set` 的 builtinTools 缺省语义 = 保留旧值

- 预研 `§4.5` 示意代码是「两键全给」；落地放宽为 builtinTools 可选——兼容只写 agentSkills 的旧调用面（T87 形状 PUT 不炸），server.ts 无条件透传两键（undefined 即缺席）。测试钉扎部分更新语义。

### 决策 3：v1→v2 迁移放读盘，写盘恒 v2

- 任务卡纪律 ⑩ 原样落地：`version===1 && typeof agentSkills==='boolean'` → `builtinTools = agentSkills?'full':'off'`——与 T87 同闸语义严格等价（true 时旧行为 = 开放全部内建 ≈ full；false 时 = noTools:'builtin' ≈ off）。迁移不写盘（读面零副作用，同缺省 OFF 纪律），下次 set 落盘自然升级 v2（测试钉扎）。

### 决策 4：三态装配用扩展运算保持条件省略

- `...(off ? { noTools:'builtin' as const } : {})` + `...(readonly ? { tools:[...] } : {})`——full 态两键全省略走 SDK 默认（与 T87 注释语义一致：显式省略而非显式允许）。装配入参捕获测试钉三态 + `'tools' in opts` / `'noTools' in opts` 反向钉扎省略语义。

### 决策 5：UI 用 v-model radio 而非 :checked+@change

- 预研 `§5.2` 示意代码用 `:checked` + `@change`；落地改 `v-model="builtinTools"` + `value="off|readonly|full"`（Vue radio 惯用法，computed setter 即 PUT 触发点），语义等价、代码更短。样式类对齐仓内 GeneralSettingsPanel（标题 `text-xs font-semibold` + 描述 `text-[11px] text-muted` + 容器 `rounded border border-border`）。

### 决策 6：mock 捕获袋在批跑下安全

- mock.module process 级污染（T91d 实证）下，service-abort.test.ts 的 abortSpy 断言在同批 9 文件跑中稳定通过——实证同文件 mock 在同文件测试执行期间生效。捕获袋（capturedSessionOptions/capturedLoaderOptions）同模式，批跑 103/103 实证。

## 3. 门禁实录（2026-09-04）

| 门禁 | 命令 | 结果 |
| ---- | ---- | ---- |
| oxfmt | `bunx oxfmt --check`（13 触碰文件） | ✅ All matched files use the correct format |
| oxlint（结构） | `bun run lint:structure` | ✅ 0 error / 13 warn（全部既有：max-lines 等，无一在触碰文件） |
| oxlint（触碰面） | `oxlint -c oxlint.json`（13 触碰文件） | ✅ 0 warning / 0 error |
| tsgo | `bunx tsgo --noEmit` | ✅ 0 错（无输出） |
| vue-tsc | `bunx vue-tsc --noEmit -p tsconfig.json` | ✅ 0 错（无输出） |
| i18n | `bun run check:i18n` | ✅ All locale files are in sync |
| type-shapes | `bun run test:type-shapes` | ✅ No duplicate object type shapes found |
| docs | `bun run check:docs` | ✅ 44/44 通过 |
| zones | `bun run check:zones` | ✅ clean（96 modified all registered） |
| scoped 测试 | `bun test tests/engine/rebuild/pi-backend/ tests/engine/rebuild/studio/manifest.test.ts` | ✅ 103 pass / 0 fail（baseline 90 → +13） |

未跑全量引擎测试（owner 机器 OOM 风险，任务卡纪律 ⑤）。ChatInput.vue 消费面（`manifest.capabilities.agentSkills`）键保留零改动，其既有测试在 pi-backend 套件内（capabilities-route manifest 断言）已覆盖。

## 4. 已知边界

- **会话热切换不做**：已活跃 session 不拾取新配置（沿用 T87 语义，预研 `§3.3` 登记）——新档位在下一次 createSession 生效。
- **UI 无组件单测**：AgentSettingsPanel 无现成组件测试基建（T93/T94 同结论），端到端三档切换 + 迁移真值留 owner dev 实测（verify 场景）。
- **预研 `§六` 全部延后**：skill 管理 UI / frontmatter 元数据 / listSkills 缓存——任务卡明示不做。

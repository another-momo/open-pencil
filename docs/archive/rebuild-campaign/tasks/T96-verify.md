# T96-verify · skill/工具能力三档位配置 + Agent 设置面板 UI 重构

> **状态**：🟡 待 owner dev 实测 | **时间**：2026-09-04
> **关联**：T87/T89（capabilities 前身）；设计真源 `docs/202609031800-skill-support-review.md` 的 `§四` + `§五`

## 验收对照

| 项 | 计划 | 实测 | 通过 |
| -- | ---- | ---- | ---- |
| capabilities.json v2 | 写盘恒 `{version:2, builtinTools, agentSkills}` | capabilities.test「写读往返」钉 version:2 + 三键 | ✅ |
| v1→v2 迁移 | `{version:1,agentSkills:true}` → full；false → off | 迁移两用例通过（含迁移后写盘升级 v2 钉扎） | ✅ |
| 坏档位降级 | v2 非法 builtinTools → DEFAULTS | 「v2 非法 builtinTools」用例通过 | ✅ |
| service 三态装配 | off→`noTools:'builtin'`；readonly→`tools:[read,grep,find,ls]`；full→两键省略 | 装配入参捕获三用例通过 | ✅ |
| noSkills 解耦 | agentSkills 独控，与 builtinTools 无关 | 解耦双向钉扎用例通过（full+skills off → noSkills true；off+skills on → noSkills false + noTools 仍在） | ✅ |
| PUT 校验 | 非法 builtinTools → 400；部分更新保旧值 | route 两新用例通过 | ✅ |
| manifest 投影 | capabilities 含 builtinTools | manifest.test + route manifest 断言通过 | ✅ |
| UI 重构 | 标题/描述 + 三档 radio + skills 开关标签 | 面板重构落地（无组件单测基建，端到端留实测） | ✅（代码面） |
| 分隔线 | SettingsDialog ai 区 ModelsPanel ↔ Agent 面板 | `<div class="border-t border-border" />` 就位；zones P44 reason 追加 | ✅ |
| i18n | 10 键双语 + 旧 skillLabel 键删除 | check:i18n 同步通过；键组就位 | ✅ |
| 门禁 | lint:structure 0 error / check:docs 44/44 / check:i18n / test:type-shapes | 全绿（self-check `§3` 实录） | ✅ |
| scoped 测试 | pi-backend + manifest 套件 | 103 pass / 0 fail（baseline 90 → +13） | ✅ |

## 端到端真值再生（dev server 起动后，留 owner 实测）

1. **场景 1（三档切换）**：Settings → AI 区 → Agent 能力分区。预期：章节标题「Agent 能力 / Agent Capabilities」+ 描述；文件访问三档 radio（关闭/只读/完整）；技能系统开关带标签+描述；切换即保存（「保存中…」瞬态）；ModelsPanel 与本分区之间有分隔线。

2. **场景 2（档位生效）**：切「只读」→ 发消息让 AI 读文件（应可用 read/grep/find/ls）→ 让 AI 改文件（edit/write/bash 不可用）；切「关闭」→ 内建工具全不可用（设计工具仍在）；切「完整」→ read/bash/edit/write 恢复。注意：已活跃 session 不拾取新配置（已知边界）——新会话或重开后验证。

3. **场景 3（skills 解耦）**：文件访问=关闭 + 技能系统=开 → skill dropdown 仍列出 `.openpencil/skills` 内容、`/skill:<name>` 展开正常；文件访问=完整 + 技能系统=关 → dropdown 空、skills 不进 prompt。

4. **场景 4（v1 迁移）**：手工把 `.openpencil/pi-agent/capabilities.json` 改为 `{"version":1,"agentSkills":true}` → 重启后端 → GET /api/pi/capabilities 应返 `{builtinTools:'full', agentSkills:true}`；Settings 面板三档应选中「完整」、技能系统开。下次任意保存后文件升级为 version:2。

5. **场景 5（失败回滚）**：断后端后拨开关/档位 → 面板显示「保存失败：…」错误行，控件回滚到旧值。

## 核验命令

```bash
bunx oxfmt --check src/app/ai/pi-backend/capabilities.ts src/app/ai/pi-backend/service.ts src/app/ai/pi-backend/server.ts src/app/ai/pi-backend/studio/manifest.ts src/app/ai/pi-backend/mode-selection.ts src/components/settings/agent/AgentSettingsPanel.vue src/components/settings/SettingsDialog.vue src/app/i18n/fork/locales/en.ts src/app/i18n/fork/locales/zh-cn.ts tests/engine/rebuild/pi-backend/capabilities.test.ts tests/engine/rebuild/pi-backend/capabilities-route.test.ts tests/engine/rebuild/pi-backend/service-capabilities.test.ts tests/engine/rebuild/studio/manifest.test.ts
bun run lint:structure
bun run check:docs
bun run check:i18n
bun run test:type-shapes
bunx tsgo --noEmit
bunx vue-tsc --noEmit -p tsconfig.json
bun test tests/engine/rebuild/pi-backend/ tests/engine/rebuild/studio/manifest.test.ts
```

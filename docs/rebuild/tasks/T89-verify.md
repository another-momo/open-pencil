# T89-verify · Skill 扫描目录与 UI 体验整改（验收对照 + 端到端真值再生）

> **状态**：✅ 已完成 | **时间**：2026-09-03

## 验收对照

| 项 | 计划 | 实测 | 通过 |
|---|------|------|------|
| capabilities.ts 单源扫描 | `${cwd}/.openpencil/skills` | `capabilities.ts:128` `join(rootDir, '.openpencil', 'skills')` | ✅ |
| 删双源 dedupe 死码 | 单源下 dedupe 无意义 | `listSkills` 改为 `return result.skills.map(projectSkill)` | ✅ |
| ChatInput 删 chip 行 + attachment slot | T87 chip 行 + InputGroup attachment 槽删除 | `ChatInput.vue` 内不再有这两段 | ✅ |
| ChatInput 新增 actions 行 | 「采集画布选区」+ skill dropdown 共一行 | `ChatInput.vue` 新增 `<div data-test-id="chat-actions-row">` 承载 | ✅ |
| skill dropdown 用 reka-ui ComboboxRoot | chip 形态 trigger + 选项点击触发 | `ComboboxAnchor + ComboboxTrigger + ComboboxContent + ComboboxItem` 直组合 | ✅ |
| 「「/skill:<name>」」内联 token | strip 仅剥角括号 | `stripSkillTokenBrackets` 实现；`submit` 时调用 | ✅ |
| selection-capture.ts 加 skill helper | `scanSkillTokens` / `skillTokenText` / `atomicSkillTokenDeletionRange` | 已实现 + 5 例新单测全过 | ✅ |
| backdrop 高亮 skill token | 与 selection token 同款 `bg-accent/25` | `backdropSegments` 合并扫描两类 token 并按 start 序合并 | ✅ |
| 原子删除兼容 skill token | Backspace/Delete 紧邻 skill token 整段删 | `handleAtomicTokenDeletion` 同时检查 selection → skill | ✅ |
| AgentSettingsPanel 砍 title/description | 1 行 label + AppSwitch + Saving + Error | `<h3>` + `<p>` 删除；AppSwitch 留作唯一文案 | ✅ |
| i18n 改文案 | 标题/描述/标签三键收敛 | en.ts / zh-cn.ts：删除 2 键、改 1 键；新增 chipsSkillChoose/SearchPlaceholder/Empty | ✅ |
| capabilities 套件 fixture 迁移 | `.pi/skills` → `.openpencil/skills` | `capabilities.test.ts` 全部 fixture 路径已迁 | ✅ |
| service-capabilities 套件 fixture 迁移 | 同上 | `service-capabilities.test.ts` line 85, 107 已迁 | ✅ |
| t87 smoke fixture 简化 | 删 `t87-agent` 双源第二份 | `skill-toggle-smoke.mjs` 单源 fixture + 单源断言 | ✅ |
| 七门禁全绿 | lint/tsgo/oxfmt/vue/i18n/zones/docs | 全部通过（lint 0 errors / tsgo 0 / oxfmt 全 format 正确 / vue 0 / i18n sync / zones clean / docs 44/44） | ✅ |

## 端到端真值再生

dev server 起动后（capabilities ON）：

1. ChatInput 上方渲染新的「actions 行」（data-test-id="chat-actions-row"）
2. 「采集画布选区」按钮保留（T70 行为不变）
3. dropdown trigger（data-test-id="chat-skill-trigger"）渲染，标签 = 「选择 skill」
4. 点击 trigger → 弹出带搜索输入 + 候选列表的 popover
5. 输入 "demo" → 候选列表过滤为 `t87-demo` 一项
7. textarea 出现「`「/skill:t87-demo」`」高亮 token（backdrop 渲染 `bg-accent/25` 块）
8. Backspace 紧随 token 尾 → 整段删除（atomic-deletion）
9. 提交消息 → emit 出去的是 `/skill:t87-demo T87_USER_ARG_HELLO`（strip 角括号后）
10. capabilities OFF → dropdown trigger 不渲染，「采集画布选区」按钮仍渲染
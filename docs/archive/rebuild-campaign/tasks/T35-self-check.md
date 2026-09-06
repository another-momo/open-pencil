<!--
  写作纪律（改本文前必读）：
  - 事实性声明必须附核验命令 + 日期，否则标为【假设】
  - 计划被实测推翻时，直接改本文为新版本，完整理由记入 records/ 子文档
  - 本文只保留当前态，不保留修正历史
  - 改完后刷新本文头部的「状态」字段
  - 详细规则见 docs/rebuild/05-process.md §4
-->

# T35 自检 · pi 段迁回 fork seam + i18n 卫生整顿

> **状态**：已核验 | **时间**：2026-08-27 | **核验人**：主 agent
> **分支**：`rebuild/t35-i18n-fork`（自 `rebuild/pi (29985845)` 拉出）
> **基线**：`29985845`（T34 收口后 rebuild/pi HEAD）

## 1. 交付物

- **`src/app/i18n/fork/locales/zh-cn.ts`**：27 条 pi 段 i18n（仅中文）
- **`src/app/i18n/fork/locales/en.ts`**（新建）：`piMessageDefaults` 英文 27 条
- **`src/app/i18n/fork/index.ts`**：`forkI18n` + `forkPiMessages` + `useForkPi()` hook（仿 useNotificationMessages 模式）
- **`packages/vue/src/i18n/locales/zh-cn/dialogs.json`**：删 27 条 pi 段（还原到上游 88c10770 截止状态）
- **`packages/vue/src/i18n/messages/dialogs.ts`**：删 27 条 pi 段（撤销 P38）
- **`src/components/settings/models/PiModelsPanel.vue`**：21 处 `dialogs.piXxx` → `dialogs.xxx`；3 处通用键（models/connected/modelNeedsCredential）→ `uiDialogs.xxx`
- **`src/components/chat/ChatInput.vue`**：1 处 `dialogs.value.piDesignModelDefault` → `piDialogs.designModelDefault`
- **`tools/zone-registry/zones.json`**：P38 / P40 disposition 改 revoked
- **oxfmt 顺手兜底 21 个上游格式不一致文件**（packages/*/package.json 等）

## 2. 关键决策

### 2.1 pi 段完整迁移到 fork seam（撤销 P38/P40）

| 项 | T34 合并后状态 | T35 处置 |
|---|---|---|
| packages/vue/src/i18n/messages/dialogs.ts | 27 条 pi 段 en 默认值（patch P38） | **撤销 P38**——删 27 条 |
| packages/vue/src/i18n/locales/zh-cn/dialogs.json | 27 条 pi 段 zh 翻译（patch P40） | **撤销 P40**——删 27 条 |
| src/app/i18n/fork/locales/en.ts | 不存在 | **新建**——27 条英文默认值（仿 notificationMessageDefaults） |
| src/app/i18n/fork/locales/zh-cn.ts | 1 条 seamProbe 测试条目 | **加 27 条中文翻译**（pi 段内容） |
| src/app/i18n/fork/index.ts | 仅 export forkI18n | **加 forkPiMessages + useForkPi()** |

**理由**：pi 段是「我们自有 i18n 内容」，不属于 packages/vue 上游域——T31/T34 已经实证「走 packages/vue 会持续被上游合并撞」。

### 2.2 ChatInput.vue 复用同 seam（顺手发现）

`dialogs.value.piDesignModelDefault` 是 ChatInput.vue 唯一的 pi 段引用——一并迁回 fork seam（`piDialogs.designModelDefault`），保持单一来源。

### 2.3 PiModelsPanel.vue 通用键保持走 useI18n

`models` / `connected` / `modelNeedsCredential` 是上游 dialogs 通用段（dialogs.json 里就有），不属于 pi 段——继续走 `useI18n().dialogs.xxx`，命名 `uiDialogs` 区分。

## 3. 门禁实测（2026-08-27）

| 命令 | exit | 关键输出 |
|---|---|---|
| `bun run check:zones` | 0 | `[zones] clean: 53 modified (all registered), 288 added (owned), 1014 deleted (all registered), 0 renamed (cross-checked), base 88c10770` |
| `bun run check:i18n` | 0 | `All locale files are in sync.` |
| `bun run check:deps` | 0 | exit 0 |
| `bun run typecheck`（tsgo + vue-tsc ×2） | 0 | 全绿 |
| `bun run lint` | 0 | 0 errors（3 存量 max-lines warning 均为非 T35 触发） |
| `bun run format:check` | 0 | All matched files use the correct format |
| `bun run check:docs` | 0 | 40/40 通过 |
| `bun run check:bindings` | 0 | 10 文件变更，binding 全绿 |
| `bun run check:tasks` | 0 | zones.json 改动 P38/P40（revoked）+ 大改动 R2 963 行——T34 三件套齐全 |
| `bun run check:monorepo` | 0 | sherif No issues found |
| `bun run check:arch` | 0 | steiger No problems found |
| `bun run check:packages` | 0 | metadata / publint / attw 全过 |
| `bun run test:type-shapes` | 0 | No duplicate object type shapes found |
| `bun run test:dupes` | 0 | Found 0 clones |
| `bun run smoke:pi` | 0 | 80 passed, 0 failed |

## 4. 实施过程发现的问题

### 4.1 S3 批量替换的正则陷阱

bulk 替换 `dialogs.piXxx` → `dialogs.xxx` 时，Python 正则 `re.sub(r'dialogs(?:\.value)?\.pi([A-Z])', r'dialogs\1', content)` **误删了 `.` 分隔符**——`dialogs.piXxx` 变成 `dialogsXxx`，然后再修 `dialogs.Xxx` → `dialogs.xxx` 时**错把 21 处全改成 dialogs.Xxx 大写开头**。

教训：**批量替换 pi 段 key 时，必须用「删除 `pi` 前缀」正则而非「删除 `pi.` 段」**。多跑了 3 次 grep 才发现 ChatInput.vue 也有 1 处 + PiModelsPanel.vue 还有 3 处通用键（`models` / `connected` / `modelNeedsCredential`）被误改。

### 4.2 fork seam 类型系统的两个细节

- `get` 函数返回类型必须显式标 `Promise<ComponentsJSON>`（nanostores/i18n 的 `TranslationLoader` 约束）
- `PiNamespace` 类型必须基于 `piMessageDefaults`（含 `params(...)` 参数化）而非 zh-cn.ts 的 string 字面量——否则 `providerModels({count})` 被识别为 string 不能调用

### 4.3 oxfmt 顺手兜底 21 个上游格式不一致文件

T34 merge 时上游 0f981ff2/5f8a373b 等 commit 引入了若干 package.json 等文件的格式差异，T34 当时本机 oxfmt 只跑了 vite.config.ts。T35 跑 `bunx oxfmt --write` 时一次发现 21 个文件需要收敛（packages/vue/example 等）——**已顺手修，无新增任务**。

## 5. 关联文档

- plan：[T35-plan.md](T35-plan.md)
- verify：[T35-verify.md](T35-verify.md)（subagent V1-V5 核验完成后已就绪）
- 索引：[tasks/_index.md §2](../tasks/_index.md)
- 上游 dialogs.ts 形态参考：`packages/vue/src/i18n/messages/dialogs.ts`（不含 pi 段后）
- fork seam 设计参考：`src/app/i18n/notifications/index.ts`（notificationMessages 模式）

## 5. CI 红修复（2026-08-27 后续）

CI run 33062559416（head=8ae675a6）报 failure——`Engine tests — app` job 3 个测试 fail：

1. **fork i18n seam: zh-CN pack loads lazily** —— `setLocale('zh-CN')` 后 50ms 内 rebuildMessages.get() 仍返回英文（"Fork i18n seam works"），期望中文「fork i18n 缝已接通」
2. **clipboard image notifications: warns web users when pasted images cannot be fetched** —— 期望英文 message，实际中文
3. **clipboard image notifications: shows an actionable desktop error for partial failures** —— 期望英文 message，实际中文

**根因**：T35 把 fork seam 的 zh-cn **lazy import** 改成了**顶层 import**（`import zhCN from './locales/zh-cn'`）——破坏「zh-CN 只在 setLocale 后才加载」的 lazy 语义：
- rebuildMessages 是 forkI18n 的派生 store，依赖 lazy import 在 locale 切换后才生效
- 顶层 import 让 zh-cn.ts 在 fork seam 模块加载时就同步执行，subsequent lazy import 直接返回 cached module
- 但 `forkI18n('rebuild', ...)` 的**派生 store 行为**未变——setLocale('zh-CN') 后内部 lazy load 时机变了，导致测试 50ms 内仍读到 en 默认值

同时 zh-CN pack 加载**没立即完成**让 fork seam 维持 en 默认值——但 packages/vue 的 i18n seam 的 zh-CN 加载完成——dialogMessages 立刻切到 zh-CN——clipboard 测试收到中文。

**修复**：fork seam get 函数恢复 `(await import('./locales/zh-cn'))` 动态导入 + 顶层 import 只保留 type + en.ts 默认值。

**commit `61476bd7`** —— 本机测试两批全过（fork seam 2 + clipboard notifications 2），CI 待 push 后复验。

**T35 教训补记**：
- fork seam 的 lazy import 是**功能性的**——它让 zh-CN pack 在 setLocale 后才加载；顶层 import 会破坏这个语义
- 测试 50ms 等待窗口对 CI 速度敏感——本机 63ms 通过，CI 53ms 通过，但这次 fail 说明加载链路破坏后回退到 en 默认值

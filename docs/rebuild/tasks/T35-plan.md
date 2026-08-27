<!--
  写作纪律（改本文前必读）：
  - 事实性声明必须附核验命令 + 日期，否则标为【假设】
  - 计划被实测推翻时，直接改本文为新版本，完整理由记入 records/ 子文档
  - 本文只保留当前态，不保留修正历史
  - 改完后刷新本文头部的「状态」字段
  - 详细规则见 docs/rebuild/05-process.md §4
-->

# T35 计划 · pi 段迁回 fork seam + i18n 卫生整顿

> **状态**：执行中 | **时间**：2026-08-27 | **负责人**：主 agent
> **分支**：`rebuild/t35-i18n-fork`（自 `rebuild/pi (29985845)` 拉出）
> **基线**：`29985845`（T34 收口后 rebuild/pi HEAD）

## 1. 背景与根因

**T20/T22 引入的 27 条 pi 段 i18n key 错放在上游的 `packages/vue/src/i18n/locales/zh-cn/dialogs.json` 里**——而不是我们已建好的 fork seam（`src/app/i18n/fork/locales/zh-cn.ts`）。

**症状**：
- 每次上游改 `dialogs.json` 必撞我们的 pi 段（已经在 T31/T34 两次合并中暴露）
- 上游未来若引入新的 dialogs.json 重构，我们还要继续手动维护冲突
- fork seam（`src/app/i18n/fork/`）除了 1 条 `seamProbe` 测试条目外**从未承担过生产内容**

**根因**（已确认）：
- T20 实施时 owner 立下的 fork seam 标准方案尚未被后续实施人贯彻
- packages/vue/src/i18n/locales/zh-cn/dialogs.json 是「现成文件」，实施时直接复用，**绕过了自有 fork 机制**

**为什么这是问题**：

| 维度 | 走 fork（应该） | 走 packages/vue（现状） |
|---|---|---|
| 上游合并阻力 | 上游改 packages/vue 不影响 fork | 上游改 dialogs.json 必撞 |
| 上游删除风险 | 上游删 fork 区文件 = 我们删它 | 上游删 packages/vue 文件 = 自动消化（merge 自动采用 ours 删除） |
| 隔离度 | 我们自有内容物理独立 | 我们自有内容寄生在上游目录 |
| 沟通成本 | 「fork 区」概念清晰 | 「dialogs.json 尾巴」语义模糊 |

## 2. 现状盘点

**pi 段 27 条 key 清单**（实测自 `packages/vue/src/i18n/locales/zh-cn/dialogs.json`）：

```
piModelsDescription
piCatalogRefresh
piCatalogOffline
piProviderModels
piKeyPlaceholderConfigured
piKeyPlaceholderMissing
piKeySave
piKeyClear
piAddProvider
piProviderId
piProviderBaseUrl
piProviderApi
piProviderModelIds
piProviderSave
piDesignModel
piDesignModelDescription
piDesignProvider
piDesignModelField
piDesignModelSave
piDesignModelDefault
piThinkingLevel
piThinkingOff
piThinkingMinimal
piThinkingLow
piThinkingMedium
piThinkingHigh
piThinkingExtraHigh
```

**fork seam 当前内容**（实测 `src/app/i18n/fork/locales/zh-cn.ts`）：

```ts
import type { ComponentsJSON } from '@nanostores/i18n'

export default {
  rebuild: {
    seamProbe: 'fork i18n 缝已接通'
  }
} satisfies ComponentsJSON
```

**调用方盘点**（需要把 `dialogs.piXxx` → `forkI18n.pi.xxx`）：

待实施时实测 `grep -rn "dialogs\\.pi" src/ packages/` 拿到完整调用方清单（预计 4-6 个 .vue 文件：`PiModelsPanel.vue` / `ProviderSettingsField.vue` / `ProviderSettingsLink.vue` / etc.）。

## 3. 实施方案

### S1：fork seam 增 pi 段

`src/app/i18n/fork/locales/zh-cn.ts`：

```ts
import type { ComponentsJSON } from '@nanostores/i18n'

export default {
  rebuild: {
    seamProbe: 'fork i18n 缝已接通'
  },
  pi: {
    modelsDescription: 'Provider、凭据和设计模型由本地 pi 后端管理。',
    catalogRefresh: '刷新',
    catalogOffline: '无法连接 pi 后端——请用 `bun run dev` 启动开发服务器。',
    providerModels: '{count} 个模型',
    keyPlaceholderConfigured: '密钥已保存——输入新密钥以替换',
    keyPlaceholderMissing: '粘贴 API 密钥',
    keySave: '保存密钥',
    keyClear: '清除密钥',
    addProvider: '添加自定义 Provider',
    providerId: 'Provider ID',
    providerBaseUrl: 'Base URL',
    providerApi: 'API 类型',
    providerModelIds: '模型 ID（每行一个）',
    providerSave: '保存 Provider',
    designModel: '设计模型',
    designModelDescription: 'AI 聊天代理使用的模型。凭据来自上方对应的 Provider 条目。',
    designProvider: 'Provider',
    designModelField: '模型',
    designModelSave: '保存',
    designModelDefault: '后端默认（openrouter/free）',
    thinkingLevel: '思考级别',
    thinkingOff: '关闭',
    thinkingMinimal: '最低',
    thinkingLow: '低',
    thinkingMedium: '中',
    thinkingHigh: '高',
    thinkingExtraHigh: '极高'
  }
} satisfies ComponentsJSON
```

### S2：dialogs.json 删 27 条 pi 段

`packages/vue/src/i18n/locales/zh-cn/dialogs.json` 移除 27 条 pi* key——保留到上游 88c10770 同款截止状态（参考 T31 合并时的「上游 messages+zh-cn 覆盖冲掉 T21 的 26 个 pi* key」教训）。

### S3：调用方改键路径

预计改动文件清单（实施前实测确定）：

- `src/components/settings/models/PiModelsPanel.vue`（已有 ownedFile 登记）
- `src/components/settings/provider/ProviderSettingsField.vue`
- `src/components/settings/provider/ProviderSettingsLink.vue`
- 其他 grep 命中的 .vue 文件

改动模式：`{{ dialogs.piCatalogRefresh }}` → `{{ forkI18n.pi.catalogRefresh }}`，对应 import 调整。

### S4：门禁复跑

`check:i18n`（`bun tools/i18n/src/check-locales.ts`）—— 确认 locale 文件结构仍合规。

`check:zones`—— 确认 `packages/vue/src/i18n/locales/zh-cn/dialogs.json` 不在我们 patches 列表里（T21 加的 P40 / P38 是否还在？需实测；如有残留要登记成 revoked 或迁移）。

`check:deps` / `check:tasks` / `typecheck` / `lint` / `smoke:pi`—— 全套绿。

### S5：三件套 + 推送

plan + self-check + verify（V1-V5）+ push SOP（staging → CI 绿 → rebuild/pi 同 SHA → gh run view 复验）。

## 4. 不做（出栈）

- **en.ts fork 段补全**：fork seam 只维护 zh-cn 是 owner 拍板的（T25 owner 决策）；en 留空。
- **其他语言的 pi 段迁移**：de/es/fr/it/ja/pl/ru 在 T25 主动删除了，没必要重建。
- **fork seam 重构为更通用的 multi-namespace**：本任务保持现有 `createI18n<Locale, 'en'>(locale, ...)` 范式，不动 seam 本身结构。
- **dialogs.json 拆分成多个文件**：本任务只动 pi 段，不重构其他 dialog 段。
- **check:zones 加「未登记 + byte 一致幽灵」规则**：这是另一个独立议题（T36+ 候选）。

## 5. 验收标准

| # | 验收 | 结果 |
|---|---|---|
| C1 | `src/app/i18n/fork/locales/zh-cn.ts` 含 27 条 pi 段 | ⏸ 待开工 |
| C2 | `packages/vue/src/i18n/locales/zh-cn/dialogs.json` 不含 pi* key（与上游 88c10770 截止状态一致） | ⏸ 待开工 |
| C3 | 所有 `dialogs.piXxx` 调用改为 `forkI18n.pi.xxx` | ⏸ 待开工 |
| C4 | `check:i18n` 全绿 | ⏸ 待开工 |
| C5 | `check:zones` 全绿（含 P38/P40 patches 状态判定） | ⏸ 待开工 |
| C6 | `typecheck` / `lint` / `check:deps` 全绿 | ⏸ 待开工 |
| C7 | `smoke:pi` 全过 | ⏸ 待开工 |
| C8 | subagent V1-V5 独立核验「可以收口」 | ⏸ 待开工 |
| C9 | CI 双链 success @ 同 SHA（推送后复验） | ⏸ 待开工 |

## 6. 风险与依赖

- **风险 1：调用方 grep 不全**——可能漏改某个 vue 文件，导致构建时 dialogs.piXxx 报 undefined。**缓解**：实施时实测 grep 全量 + typecheck 捕获未定义引用。
- **风险 2：forkI18n 在某些组件上下文不可用**——fork seam 通过 nanostores/i18n 创建，理论上全局可用；但如果某个 .vue 文件在 `<script setup>` 顶部没 import，需要补 import。**缓解**：实测每个调用方。
- **依赖**：T34 push 后实际 commit SHA 作为基线。

## 7. 关联文档

- self-check：[T35-self-check.md](T35-self-check.md)（待建）
- verify：[T35-verify.md](T35-verify.md)（待建）
- 索引：[tasks/_index.md §2](../tasks/_index.md)（待翻 🔄）
- 上游 dialogs.ts 形态参考：`packages/vue/src/i18n/messages/dialogs.ts`
- fork seam 设计参考：[docs/rebuild/03-phase-1-runtime.md §？](../03-phase-1-runtime.md)（待补引用）

## 8. 备查

**T31 commit c0c1f117 已实证**：上游 messages+zh-cn 覆盖冲掉 T21 的 26 个 pi* key 后，按 HEAD 定义合并回写——这就是「走 packages/vue 上游目录」持续踩坑的实证。本任务 T35 是根治这个反复踩坑的方案。

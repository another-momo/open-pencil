# P8 profile 自动采用漂移修复（实施任务）

> 任务记录（带 Step / 改动量 / 验证 / 回滚）。**当前正确设计见 `../architecture/l2-resource-library.md`** §2（Profile 行）+ §3 决策表 Q14；评审依据见 `../../review/2026-08-01-marketing-workbench-branch-review.md` §2.5.8（产品分析）+ §2.4 P8（风险行）+ §3.2 第 4 项（profile 双源镜像）+ §五 阶段 1.2 第 3 项（执行指令）；实施记录见 `../history/l2-resource-library-history.md` §9.4。
>
> 上层总览见 `../README.md`。

## 实施步骤骨架

按 `../architecture/l2-resource-library.md` §2 Profile 行 + §3 Q14 决策 + review §阶段 1.2 第 3 项 ①②③ 落地。

| 改动 | 代码位置 | 改动量 |
|---|---|---|
| **plan**：建本任务文档 | `tasks/profile-p8-fix.md` | 新建 |
| **plan**：§2 Profile 行"选择权"列改写 + §3 增 Q14 决策 | `architecture/l2-resource-library.md` L29 + §3 | 编辑 |
| **plan**：history §9.4 占位 | `history/l2-resource-library-history.md` L74 之后 | 追加 |
| **core**：删 `auto-pick` + `(applicable ?? profiles[0]).id` 兜底 | `packages/core/src/tools/marketing/setup.ts:124-125` | ~3 LOC |
| **tests**：改 `setup returns activeProfileId` 断言（默认无 activeProfileId），新增"未匹配 → 无"、"显式传 profile 正常"、"无 profiles → 空" 三个测试 | `tests/engine/tools/marketing/setup.test.ts` | ~30 LOC |
| **app**：bindMarketingLibrary 在 user-picked profile 存在时不覆盖为 `undefined` | `src/app/ai/marketing/library.ts:126-128` | ~5 LOC |
| **app**：MarketingConfigBar Profile chip 三态显式（null 虚线 muted / ai 实线 muted / user accent） | `src/components/chat/MarketingConfigBar.vue:173-181` | ~15 LOC（含 i18n） |
| **i18n**：新增 `profileChipUnset` / `profileChipInferred` 文案 key | `packages/vue/src/i18n/messages/dialogs.ts:131-146` | ~3 LOC |
| **tests**：新增"user-picked profile 不被 bind 覆盖"测试 | `tests/engine/app/marketing-library.test.ts` | ~25 LOC |
| **prompt**：改事实陈述（L162 "setup auto-picks..." → "explicit user choice"） | `src/app/ai/chat/system-prompt-marketing.md:162` | 编辑 |
| **P8v2**：收紧 buildMarketingOverlay — profile catalog 段 + active 段均只在 user-picked profile 时输出；无 pick 时零泄漏 | `src/app/ai/marketing/library.ts:193-258` | 重写 |
| **P8v2**：system-prompt L172/L193/L202/L206 改条件性（profile 是可选 binding spec，不是默认） | `src/app/ai/chat/system-prompt-marketing.md` 4 处 | 编辑 |
| **P8v2**：setupMaterialTypeTool 描述 `profile` 参数改写（明确"省略 = 不挂载"） | `packages/core/src/tools/marketing.ts:54-58` | 编辑 |
| **P8v2**：tools/index.ts 删 `setActiveProfile` 回调（AI 不再 echo profile） | `src/app/ai/tools/index.ts:169-177` | 删 9 LOC |
| **P8v2**：storage.ts 收紧 profileSelection type（删 `'ai'`），删 setAiProfile 死路径 | `src/app/ai/chat/storage.ts:111-136` | 删 11 LOC |
| **P8v2**：library.ts 删 setActiveProfile 死路径（仅剩 getActiveProfileId read-only） | `src/app/ai/marketing/library.ts:173-191` | 删 9 LOC |
| **P8v2**：MarketingConfigBar chip 三态 → 二态（删 'inferred' 中间态） | `src/components/chat/MarketingConfigBar.vue:131-166` | 改 |
| **P8v2**：marketing-library 测试改写（overlay 断言收紧；删 AI 路径测试） | `tests/engine/app/marketing-library.test.ts` | 改 |

## 验证

- **单元测试**：`tests/engine/tools/marketing/` 全绿 + `tests/engine/app/marketing-library.test.ts` 全绿（70 → 75 + 1 个 app 测试）
- **回归测试**：chat shard 15 个不破坏；`bun run typecheck` + `bun run lint` 全绿
- **冒烟**：4 场景见下方

详见 `../history/l2-resource-library-history.md`（§9.4 实施记录 / §回滚方案 / §评审后续修正）。

### 冒烟场景（与 review §3.2-4 + §2.5.8 对齐）

| 场景 | 预期 |
|---|---|
| 库有 2 个 profile，type 无匹配 → setup | 返回无 `activeProfileId`；overlay 输出 `(none)` 提示；chip 显示 `Style: None` 虚线灰 |
| 用户在 chip 选 profile A | chip 显示 `Style: Profile A` accent 高亮；下轮 setup 返回 `activeProfileId: 'A'` |
| 用户选 A 后切回 Auto | chip 显示 `Style: None` 虚线灰；下轮 setup 不再返回 `activeProfileId`（不再 auto-pick） |
| AI echo profile B | chip 显示 `Style: Profile B (inferred)` 实线 muted；不持久化 |

## 实施记录

| 阶段 | 状态 | commit | 说明 |
|---|---|---|---|
| 2026-08-03 计划批准 | ✅ | — | ExitPlanMode 通过 |
| 2026-08-03 step1 plan 文档 | ⏳ | — | 本文件 + §2/Q14 + §9.4 占位 |
| 2026-08-03 step2 core 改动 | ⬜ | — | setup.ts 删兜底 + tests |
| 2026-08-03 step3 app 改动 | ⬜ | — | library.ts bind 不覆盖 + chip 三态 + i18n |
| 2026-08-03 step4 整体验证 + commit | ⬜ | — | typecheck + lint + bun test |

详细时间线、误诊教训、commit hash 见 `../history/l2-resource-library-history.md` §9.4。

## 回滚方案

- **回滚触发**：CI 失败 + 修复成本 > 1 小时
- **回滚单位**：单个 commit `fix(marketing): profile explicit selection only (Phase 1.2 P8)`
- **回滚方法**：`git revert HEAD`（不破坏 Phase 0 / Phase 1.1 commit）
- **不破坏的依赖**：本次改动不涉及 `registry.ts` / `validate.ts`（Phase 1.1 修复）；不动 chat 模块
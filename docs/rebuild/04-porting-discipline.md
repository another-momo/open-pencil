<!--
  写作纪律（改本文前必读）：
  - 事实性声明必须附核验命令 + 日期，否则标为【假设】
  - 计划被实测推翻时，直接改本文为新版本，完整理由记入 records/ 子文档
  - 本文只保留当前态，不保留修正历史
  - 改完后刷新本文头部的「状态」字段
  - 详细规则见 docs/rebuild/05-process.md §4
-->

# 04 · 移植纪律（Phase 2+）

> **状态**：已核验 | **时间**：2026-08-25 | **核验人**：主 agent
> **身份**：Phase 2+ 移植操作的过程纪律；每条规则都必须能被 CI 或核验命令检查。
> **基线**：供货方 = 旧分支 `feature/agent-backend` @ `a1c33881`。移植不是搬家，是带验收的复审。

## 1. 移植清单（实测）

| 移植对象 | 规模 | 来源（旧分支路径） | 注意 |
|---|---|---|---|
| 营销工具 | 恰 14 文件 | `packages/core/src/tools/marketing/` | 注册名实测：setup_material_type、look、compose_backdrop、sample_hero_color、derive_palette、prepare_hero_scaffold、create_brief/read_brief/append_brief_conclusion |
| 生图管线 | 恰 4 文件 | `packages/core/src/tools/image-gen/` | **历史快照内置**（history.ts），随移植自带 |
| 测试规约 | 恰 16 文件 | `tests/engine/tools/{marketing,image-gen}/`（12+4） | `bun test` 报告 224 通过（2026-08-18）；『16 文件移植全绿』验收口径 2026-08-25 已废止（宿主随 T10 消失），层 1 验收改按 [01-target-state.md §4](01-target-state.md) 五环冒烟口径 |
| brand config | 数据 + schema | `public/default-brand/config.yaml`（7 type + 8 profile）+ `packages/agent/src/brand/`（schema/loader/repository） | repository 语义含 SQLite 用户覆盖层；剥离 AI SDK 依赖后移植 |
| prompts | markdown 内容 | **源是 `src/app/ai/chat/system-prompt{,-marketing}.md`**；agent 侧是构建期拷贝 | 两段式组装（base+marketing）；只移植源，消除双副本 |
| 需求单 | 机制 + UI | core brief 系列 + `src/app/ai/marketing/brief-panel.ts` + `src/components/chat/BriefPanelDialog.vue` | — |
| marketing app 层 | 4 文件 | `src/app/ai/marketing/{brief-panel,library,settings,vision-settings}.ts` | library.ts 实测是 brand HTTP 服务 shim，按新后端重塑；settings 含生图凭证链（C3a 生成环组件，D32） |
| Chat UI | 组件若干 | `src/components/chat/`（BriefPanelDialog/MarketingConfigBar/BrandConfigPanel/ProfileGalleryDialog/ChatProfileSelect/ChatInput/ChatMessage）+ **`src/components/ChatPanel.vue`（根目录）** | 路径按实际来 |
| 视觉回路语义 | 1 份 | 双份镜像取一：`src/app/ai/chat/{elision,media-tool-results}.ts` 或 `packages/agent/src/{elision,media-rewriter}.ts` | 对新 runtime 媒体模型实现（C4a） |
| 生图凭证 UI | 1 组件 | `ImageGenKeysSection.vue`（实际路径移植时确认） | C3a 生成环组件（凭证与工具同阶段开发，D32） |

**不移植**：`packages/agent` 其余全部（agent-loop/elision/media-rewriter/model-resolver/routes/prompts/generated 生成物/inline-prompts 脚本）、core 的 `ai-adapter.ts`（AI SDK 耦合，用缝替代）、.fig 素材库机制、「素材图理解」phantom、L3 目录、validate（无此工具，如需走 C3c 新建）、ACP/collab/desktop/demos（删除区）。

## 2. 三条纪律

1. **逐字 → 测试绿 → 重构另起 commit**。行为变更只能是显式决策、单独 commit、测试同步改。防两个退化：赶进度盲抄 / 逐文件重设计（变相重写）。
2. **测试即规约**。测试随块移植（或先行）；绿灯前不许重构实现。语义锁在测试里（`replace_id` 降级、覆盖快照、页作用域……），移植时不动语义只动实现。
3. **引擎补丁随需登记**。不设 phase：闭环跑到哪撞出哪个问题，哪个补丁带回归测试进，按 [02-phase-0.md §3.2 补丁点登记制](02-phase-0.md) 编号登记。

## 3. 次序

1. Phase 0 验收通过（[02-phase-0.md §5 验收标准](02-phase-0.md)）
2. Phase 1 runtime spike 硬门通过（[03-phase-1-runtime.md](03-phase-1-runtime.md)）→ **F0 地基切片**（[01-target-state.md §3 层 0](01-target-state.md)，验收 "hello-tool"）
3. **层 1 价值闭环薄切**（[01-target-state.md §4](01-target-state.md)）：C2a → C3a → C4a → C1a → C5a（次序按依赖现场调，验收：闭环端到端）
4. 层 2 增强逐块进（[01-target-state.md §5](01-target-state.md)）
5. **parity 线**（[01-target-state.md §8](01-target-state.md)）达成 → owner 拍板切换，旧分支转只读参考

## 4. 移植操作约定

- 从旧分支拷文件：`git checkout feature/agent-backend -- <path>`，逐块 commit（commit message 注明能力块编号与验收测试；`docs/rebuild/` 范围不采用 PR 管理——T08 决策，任务以 commit + 任务表登记为载体）。任务登记 = [tasks/_index.md §2](tasks/_index.md) 逐任务永久行（三件套路径列，真源）+ [tracker.md §2](tracker.md) 当前任务行（收口后并入分组行，D31）。
- 落位按 [02-phase-0.md §3.5 基础设施纪律](02-phase-0.md) 目录约定；core 工具一律新文件，注册走缝合缝（[02-phase-0.md §3.4](02-phase-0.md)）。
- 每完成一个能力块，zone registry 里对应「待重分类」项按仪式摘除。
- 每合并一次 upstream，当场刷新 registry 与补丁清单，tracker 记合并记录。

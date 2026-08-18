# 04 · 移植纪律（Phase 2+）

> 日期：2026-08-18 | 供货方：旧分支 `feature/agent-backend`。移植不是搬家，是带验收的复审。

## 1. 移植清单（实测，见 00 §3）

| 移植对象 | 规模 | 来源（旧分支路径） |
|---|---|---|
| 营销工具 | 14 文件 | `packages/core/src/tools/marketing/` |
| 生图管线 | 4 文件 | `packages/core/src/tools/image-gen/` |
| 测试规约 | 16 文件 224 用例 | `tests/engine/tools/{marketing,image-gen}/` |
| brand config | 数据 + schema | `public/default-brand/config.yaml`、`packages/agent/src/brand/`（schema/loader/repository 剥离 AI SDK 依赖后移植） |
| prompts | markdown 内容 | `packages/agent/src/prompts/`、`src/app/ai/chat/system-prompt-marketing.md` |
| 需求单 | 机制 + UI | core brief 系列 + `src/app/ai/marketing/brief-panel.ts` + `src/components/chat/BriefPanelDialog.vue` 等 |
| Chat UI | 3+ 组件 | `src/components/chat/`（拥有区部分） |

**不移植**：`packages/agent` 其余全部（agent-loop / elision / media-rewriter / model-resolver / routes——AI SDK 形状的对话机器，见 00 §4）、.fig 素材库机制、L3 目录、validate readonly baseline、ACP/collab/desktop（删除区）。

## 2. 三条纪律

1. **逐字 → 测试绿 → 重构另起 commit**。行为变更只能是显式决策、单独 commit、测试同步改。防两个退化：赶进度盲抄（得到同样的代码 + 丢失的历史），或逐文件重设计（变相重写，scope 爆炸）。
2. **测试即规约**。测试随块移植（或先行）；绿灯前不许重构实现。语义锁在测试里（`replace_id` 降级、覆盖快照、页作用域……），移植时不许动语义，只许动实现。
3. **引擎补丁随需登记**。不设 phase：闭环跑到哪撞出哪个问题（如长会话 OOM 再现），哪个补丁带回归测试进，按 02 §3.2 编号登记。

## 3. 次序

1. Phase 0 验收通过（02 §5）
2. Phase 1 runtime spike 硬门通过（03），`packages/agent` 出生
3. **最小价值闭环**：C1 薄切（brief 创建/绑定）→ C2 薄切（config.yaml 加载 + overlay 注入）→ C3 薄切（setup / generate_image / look / compose_backdrop）→ C4（对新 runtime 媒体模型实现视觉回路）→ C5 薄切（最简 chat UI + session）
4. 增强逐块进：validate、生图历史、ProfileGallery 精化、references 软过滤、素材理解缓存……每块自带测试
5. B4 serve 入口 + F1 产品化
6. **parity 线**（01 §5）达成 → 切换默认分支，旧分支转入只读参考

## 4. 移植操作约定

- 从旧分支拷文件：`git checkout feature/agent-backend -- <path>`，逐个 PR 进，PR 描述注明对应能力块（C1/C2/…）与验收测试。
- 落位按 02 §3.5 目录约定；core 工具一律新文件，注册走缝合缝。
- 每完成一个能力块，zone registry 里对应「待重分类」项按仪式摘除。
- 每合并一次 upstream，刷新 registry 与补丁清单——机制活着，文档就不会烂。

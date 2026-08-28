<!--
  写作纪律（改本文前必读）：
  - 事实性声明必须附核验命令 + 日期，否则标为【假设】
  - 计划被实测推翻时，直接改本文为新版本，完整理由记入 records/ 子文档
  - 本文只保留当前态，不保留修正历史
  - 改完后刷新本文头部的「状态」字段
  - 详细规则见 docs/rebuild/05-process.md §4
-->

# 04 · 移植纪律（Phase 2+）

> **状态**：已核验 | **时间**：2026-08-28 | **核验人**：主 agent
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

## 5. owned/follow/tarball 三态边界判定（T32，2026-08-26 owner 拍板）

`tools/zone-registry/src/check.ts` 的判红框架把仓内路径划入三种状态：

| 状态 | 含义 | 登记位置 | 处置 |
|---|---|---|---|
| **owned** | 我们的纯自有资产（上游不存在或我们分叉了） | `ownedRoots` / `ownedFiles` / `stubs` | 未来上游若引入同名/同语义资产，按"再发现+再决策"流程处理 |
| **follow + patch** | 我们改了上游某 commit 的版本（base 锚点 + 本地 hunk） | `patches[*]` | 上游未来改动：自动三方合并；冲突时人工 merge |
| **tarball** | 通过 tarball/tarball 替换式合并引入的 follow 子集——byte 与上游 base 一致 | `upstreamMergeTarball[*].paths` + `deletedPaths` | 结构化白名单；等价于 follow 但有审计钩子 |

### 5.1 判定规则

- 与上游某 commit 字节一致 → **tarball**（首选）或 follow + patch（手动调整语义时）；
- 纯自有资产（上游不存在或被我们彻底替换）→ **owned**（owner 拍板）；
- 上游已不存在对应 commit 或我们做了结构性偏离 → **owned**（owner 拍板）；
- 我们改了上游某版本（byte 不一致）→ **follow + patch**，patch reason 写明"在 base=X 之上叠加哪些本地 hunk"；
- **过渡态 owned**：上游已删某文件（base 不再提供）但本地 importer 仍在用、下一轮 chat/settings 迭代改用替代品 → 登记为 **ownedFile**，patch 标签不适用。例：T32 时 `src/components/ui/AppTextButton.vue`（上游 5f8a373b 删，4 个 follow 区 importer 在用）。

### 5.2 tarball 与本地改动的互斥规则

tarball 字段收录的是 byte 一致的拷贝。**若该文件在登记 tarball 之后本地又发生改动**，必须从 `tarball.paths` 移除并按改动幅度分诊：

- **小改**（行级 / hunk 级） → 改走 patch 模式（保留 base 锚点 + 描述本地 hunk）；
- **大改**（功能级 / 与上游分叉） → 改走 ownedFile（owner 拍板 + 删除 tarball 条目）。

`check.ts` 的 `checkDriftTarball` 函数在本地文件 byte 与 `tarball.paths` 收录的版本不一致时**判红**（violation `TARBALL_DRIFT: <path>`）。tarball 语义 = 与 base 字节一致，任何本地改动都破坏该语义——先按改动幅度转 patch/owned 完成再登记，改完前 CI 保持红。（T32 收口评审 F1：初版 warn 不阻断，等于把 tarball 文件的未登记修改从红灯降成警告、削弱门禁——实测升红时零 drift，无副作用。）

### 5.3 上游"既改名又动代码"的处理

- 改名 → 旧路径进 `upstreamMergeTarball[*].deletedPaths`（或 zones.json `deletedPaths`），新路径进 `paths`（或 `patches` / `ownedFiles`）；
- 改代码 → 上游代码变化在未来 tarball 轮次体现；当前 `paths` 字段锚定的是**该 tarball base 时刻**的字节快照，与后续上游改动无关；
- `checkGhostDeleted`（[tools/zone-registry/src/check.ts](../tools/zone-registry/src/check.ts)）兜底：若上游已删某 follow 文件、本地仍残留，报警 `GHOST deleted file from upstream: <path>`——根治 T10 留 vector-edit 死目录的历史债。

### 5.4 反例警示

- T31 vector 树 15 文件是"byte 一致却误归 ownedFile"的反例——T32 即为此纠偏；
- T31 P62-P82 21 枚 patch 中 18 枚是"byte 一致却误归 patch"的反例——T32 同为此纠偏；
- T31 残留 12 个上游已删的 snapshot / AppTextButton.vue 是"check.ts 缺 ghost 检测"的反例——T32 新增 `checkGhostDeleted` 一并根治。

## 6. 上游合并 SOP 清单（T36 增补，2026-08-28）

T31/T34 两轮合并的质量事故沉淀为可勾检清单。每条都必须能在合并任务的 plan/verify 里被逐项核对——写法保持「规则 + 实证出处」。

1. **裁定对账表开工**：启动合并时先过上轮裁定对账表——上次合并 plan 的每条裁定标「维持/反转+理由+owner 拍板」写入本轮 plan；无冲突静默合入的文件也要过表（实证：T34 真实 git merge 把 T31 裁掉的 diagnostics/portless/changelog/cli-import 四条裁定静默反转，无人登记，T36 才追认）。
2. **modify/delete 冲突先证存在**：解 modify/delete 冲突前必须 `git show HEAD:<path>` 确认 HEAD 是否真有此路径，禁止凭 DU 标识一刀切 `git rm`（实证：T34 把 AppTextButton.vue 当 modify/delete 误删，事后 `git checkout HEAD --` 恢复）。
3. **UI 入口保留裁定核对完整路由链**：冲突解法含「保留上游 UI 入口」时，核对 nav→panel 路由完整链（含 v-else 兜底落点）；plan 的行为断言必须引用具体文件行号版本（实证：T34 后 mcp nav 落 Storage——面板已删、nav 复活、裸 v-else 兜底；T34 plan 断言对两个版本均不成立）。
4. **merge 收尾固定格式化**：`bunx oxfmt --write` + `bun run format:check` 全绿才算 merge 收尾（实证：T34 曾 lint 绿但 format 红——两条独立门禁，lint 绿 ≠ format 绿）。
5. **外壳类功能逐 export 查调用方**：合入「外壳类」功能（面板/登记层就绪但无数据产线）时，对每个新增 export `git grep` 生产调用方；零调用方的必须在 plan 显式登记「壳合入 + 空数据后果 + 接线排期」（实证：T34 合入 diagnostics/usage 外壳未接线，usage 面板 token 列恒「Not reported」直到 T36 chat 级接线）。
6. **合并后跑登记健康三规则**：`bun run check:zones` 的 R-exist（patch 目标必须存在）/ R-diff（patch 相对 base 必须有 diff）/ R-mutex（patch 不得与 ownedFiles/stubs/deletedPaths 重叠）必须全绿——T36 已机器化进 `tools/zone-registry/src/check.ts`，直接判红。
7. **上游已删文件双向扫描**：`checkGhostDeleted`（上游已删 ∩ 本地残留）之外，加反向扫描「现存 import × 上游已删文件」（实证：T34 的 AppTextButton.vue——上游 5f8a373b 已删、本地 4 个 importer 在用，过渡态 owned 登记）。
8. **e2e 僵尸断言扫描**：merge 后 `git grep` tests/e2e 中指向已删 UI 面的 test-id（实证：credentials.spec.ts 五处 settings-section-mcp 断言从 T25 活到 T36 才清）。
9. **CI 红修复挂 task 指针 + 知晓 base 语义**：CI 红修复 commit 一律 `task: T<NN>` 抬头；注意 Rebuild discipline job 的 base=github.event.before 语义——同 SHA 不同 push 区间 base 不同（实证：run 33052862364 红于此）。
10. **verify 含断言级复核 + 裁定对账**：plan 的用户可见行为断言必须由核验人实证（不接受推理式断言）；核验项必须含「上轮裁定维持/反转对账」（实证：T34 plan/verify 双双错误通过——mcp nav 断言从未被实测）。
11. **CI run 链当日入档**：当轮全部 CI run（含中间红 run）必须 append 进 `records/topics/ci-infra.md`（实证：T34 五 run 缺总账，T36 补记）。
12. **tarball 态纪律**：tarball/内容裁定式合并仅诞生于无网应急合并；网络恢复后下轮必须真 merge 收口；merge-base 已超过某条 tarball.base 的记录应归档（实证：T31 tarball → T34 真 merge 收口后，T31 的 tarball 登记已部分冗余）。
13. **上游动 dev 进程拓扑必复核 fork 自建进程读取侧**：合并引入上游对 dev spawn/env/discovery/端口拓扑的改动时，逐项核对 fork 自建进程（pi-backend 等）的对应读取假设（实证：T34 带入 0f981ff2 把 dev 桥 discovery 从平台默认路径隔离到 tmpdir，pi-backend `readDiscoveryFile()` 仍盲读默认路径，工具调用全灭——smoke:pi 自含不连活桥拦不住；T38 修复 + `tests/engine/rebuild/pi-dev-discovery.test.ts` 钉扎算法）。

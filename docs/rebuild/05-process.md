<!--
  写作纪律（改本文前必读）：
  - 本文是过程定义，优先级最高。修改本文需在 records/docs-governance.md 登记一条决策
  - 修改本文后必须刷新头部的「状态/时间/核验人」三字段
  - 详细规则见 docs/rebuild/05-process.md §4
-->

# 05 · 工作方式与文档纪律

> **状态**：已核验 | **时间**：2026-08-20 18:30 | **核验人**：主 agent + owner 讨论产出
> **身份**：本文是迁移改造全过程的过程定义：怎么干活、怎么跟踪、文档怎么写怎么管。优先级最高——与其他文档冲突时，以本文的过程裁决为准；事实冲突时，以代码与核验记录为准。

## 1. 角色与决策权

| 角色 | 职责 |
|---|---|
| 人（项目 owner） | D 类决策唯一拍板人；gate 验收签字；parity 切换决定 |
| 主 agent | 方案设计、整体 review、文档维护、移植与施工 |
| 核查 subagent | 只读事实核查（证伪/证实 + 证据），不写规划、不改代码 |

铁律：**任何 agent（包括主 agent）写的事实性陈述都视为未核验草稿**，经核验（本人重跑或 subagent 对账）后方可标记【已核验】。本次文档集首轮即按此执行：先 subagent 逐文档核查，主 agent 整体 review，修正后才算开工依据。

## 2. 文档体系（规划与跟踪的载体）

```
docs/rebuild/
├── README.md                    # 索引 + 治理兜底规则
├── 00-why-rebuild.md            # 背景、实测资产、大改清单（叙事）
├── 01-target-state.md           # 目标态、能力地图、不加清单（决策）
├── 02-phase-0.md                # Phase 0 定义与验收（决策）
├── 03-phase-1-runtime.md        # runtime spike 硬门（决策/调研）
├── 04-porting-discipline.md     # 移植纪律（决策）
├── 05-process.md                # 本文（过程定义，优先级最高）
├── tracker.md                   # 【活文档·精简】阶段门 + 任务表 + 记录索引
├── records/                     # 按对象分的变更/核验/腐烂记录（append-only）
│   ├── _index.md                # 子文档索引 + 编号规则
│   ├── agent-runtime.md         # agent 后端 / runtime 相关
│   ├── brand-config.md          # brand config / type / profile
│   ├── chat-ui.md               # ChatPanel / ChatInput / 聊天界面
│   ├── i18n.md                  # i18n 缝 / locale
│   ├── tools-marketing.md       # 营销工具
│   ├── tools-image-gen.md       # 生图管线
│   ├── upstream-merge.md        # upstream 合并记录
│   ├── ci-infra.md              # CI / workflows / zone registry
│   ├── spikes.md                # spike 文档的核验与修正
│   ├── docs-governance.md       # 文档体系本身的修改
│   └── ...                      # 随 Phase 推进新增
├── spikes/                      # spike 报告（Phase 1 起，一事一报）
└── archive/                     # 过期文档坟墓（归档不删除，文件名加日期）
```

**真相分层**：路径归属 → zone registry（代码，CI 校验，Phase 0 产出）；状态与决策 → `tracker.md` 索引 + `records/*` 子文档（按对象分）；叙事与理由 → 00-04。三层冲突时：registry > records 子文档 > tracker 索引 > 叙事文档。

**关于 tracker.md 拆分**：原 tracker.md 集阶段门 / 决策日志 / 任务表 / WIP 审判 / 核验日志 / 腐烂记录六类信息于一身，膨胀至 106 行后查找困难。新结构：tracker.md 只保留索引 + 阶段门 + 任务表 + 记录索引三块（≤50 行）；详细记录按对象归 `records/` 子文档，子文档 append-only。

## 3. 工作方式

### 3.1 阶段门（gate）制度

每个 phase 有入口标准、出口标准（02/03/04 各文档已定义），状态集中在 tracker 呈现。过 gate 的条件：**出口标准逐条核验通过 + 该阶段文档全量 review 完成**。

**gate review 标准动作（不可跳过）**：

1. CI 全绿（已自动化）
2. zone check 全绿（已自动化）
3. **文档格式校验全绿**（check-docs.ts，已自动化）
4. **subagent 文档核验**：对当前 phase 相关叙事文档中的所有可检查声明，逐条验证，结果记入 `records/` 对应对象子文档。核验不通过的阻塞 gate。

> 第 4 步是 gate 的硬性前置条件——不跑核验就不能过 gate。subagent 核验 prompt 模板见附录 A。

### 3.2 任务粒度与大改动纪律（D11）

**基本任务单位**：

- 能力块（C1-C5/B1-B4/F1）与引擎补丁（Pn）是基本任务单位：一块 = 一个 PR + 验收测试 + tracker 一行 + **独立 task 计划文档**（见下）。
- spike 单独成报告进 `spikes/`：问题、方法、代码链接、结论、对选型的影响。spike 自身的核验与修正记录归 `records/narrative/spikes/<file>.zh.md`。
- 移植操作按 04 的纪律（逐字 → 绿 → 重构另 commit）。

**Task 维度 vs 文件维度的严格分离**：

- **Task 维度**（`tasks/T<id>-<slug>.md`）：一个 task 一个文档。承载 task 计划 + 自检报告 + subagent 核验——这是 task 全生命周期的唯一权威。
- **文件维度**（`records/narrative/<file>.md`）：与文件一一对应。承载腐烂/修正/核验——针对**物理文件**的变更历史，不放 task 相关的自检/核验。
- **Tracker.md**（[tracker.md](tracker.md)）：仅保留索引（任务编号 + 块号 + 状态 + PR），具体内容指针到 `tasks/T<id>.md`。**不重复 task 计划内容**。
- **错误示范**：把"task 自检-N"放进 `records/narrative/<file>.md` 会破坏文件维度档案的纯度——必须放 `tasks/T<id>.md`。

**大改动纪律（D11 决策）**：

满足以下任一即为"大改动"：

| 规则 | 阈值 | CI 检测 |
|---|---|---|
| R1 文件数 | 修改文件 ≥ 10 个 | `git diff --name-only \| wc -l` |
| R2 行数 | 变更行 ≥ 200 行 | `git diff --shortstat` |
| R3 叙事文档 | 修改任意 `docs/rebuild/{00-04,05,README,tracker,spikes}*.md` | 文件名匹配 |
| R4 records 层 | 修改任意 `docs/rebuild/records/*.md` | 文件名匹配 |

**大改动必产三件套**（05-process.md §3.2 + D11，**全部落在 `tasks/T<id>.md` 单个文档**）：

1. **task 计划**（开工前）：创建 `tasks/T<id>-<slug>.md`，含任务清单、目标、验收标准。**同时**在 [tracker.md §2 任务表](tracker.md) 新增一行（编号指针 + 状态 + PR），`[BIG]` 大改动标记
2. **自检报告**（完工时）：在同一 `tasks/T<id>.md` 追加「自检-N」章节——分标【事实/决策/假设】，对照原方案列出"承诺X / 落地Y / 偏差Z"。**不许**写进 `records/narrative/`
3. **subagent 核验**（自检后）：派出只读 subagent 对照原方案 + task 计划 + 自检报告三方一致，结果记入同一 `tasks/T<id>.md`「核验-N」章节

**CI 拦截**：`tools/zone-registry/src/check-tasks.ts` 检查命中大改动 → 必须有 task 计划指针（commit message 含 `task:` / `T<id>` / `[BIG]`） + `tasks/T<id>.md` 必须在本次 commit 里被创建或更新。**例外**：commit message 加 `[no-task-plan]` tag（限 owner 标注，**仅限紧急 CI 红修复**，24h 内必须补办）。

**针对 agent 的核心约束**：主 agent 自认完成大改动任务前，**必须主动对照方案文档产出完成度对照报告**——不得"做而不报"或"号称完成未对照"。详见附录 B 的工作流程。

### 3.3 upstream 合并

- 月合并（或漂移显著时提前），在专用分支操作；合并后**当场**刷新 zone registry 与补丁清单，`records/upstream-merge.md` 记一条合并记录。
- 合并后必须跑 check-docs.ts（CI 自动）+ 排 subagent 核验受影响文档。
- Phase 0 出口含一次「合并演习」。

## 4. 文档纪律（写作与维护规则）

1. **三种陈述分标**：
   - 【事实】可重跑的观察。必须附：核验命令/路径 + 日期。例：「`packages/core/src/tools/marketing/` 14 文件（`ls`，2026-08-18）」。
   - 【决策】人的选择。必须附：拍板人 + 日期 + 理由，登记进 `records/` 对应对象子文档（D 编号）。
   - 【假设】未验证的判断。必须显式标注【假设】，且**禁止进入任何验收标准**。
2. **腐烂即改**：发现文档与现实不符，当场修正文档，并在 `records/` 对应对象子文档「腐烂记录」加一条（ROT-N 编号，日期/文档/错的内容/实况）。不许「知道错了但留着」。
3. **状态字段**：每个叙事文档（00-04）头部必须包含五字段：`状态` / `时间`（YYYY-MM-DD HH:MM，本地时间 24h 制）/ `核验人` / `身份`（决策链角色）/ `基线`（可选）。状态值：`草稿`（agent 新写未核）/ `已核验`（对账通过）/ `已执行`（描述的 phase 已执行完成，可与「已核验」并存）/ `已过期`（归档 archive/）。时间精度用 `YYYY-MM-DD HH:MM` 便于同日事件排序。
4. **维护触发器**：①阶段转换；②决策拍板或变更；③实测发现不符；④每次 upstream 合并后；⑤每个 gate review 全量重核；⑥叙事文档大改后（主 agent 判定本文档做了结构性重写时，写入完成 24h 内排一次核验）。
5. **档案纪律**：归档不删除；旧分支文档只作历史参考，引用前重新核验（[00-why-rebuild.md §5](00-why-rebuild.md) 已有三处实锤）。
6. **写作风格**：写约束，不写心路；写可检查的标准，不写方向性口号；每个「必须/应该」都要能被 CI 或核验命令检查。
7. **计划修正**：当执行实测推翻文档中的计划/假设时：
   - 叙事文档（00-04）**直接改成新版本**，不加修正节、不加 blockquote、不保留旧方案痕迹。
   - 修正的完整记录记入 `records/` 子文档：决策类记入对应对象的决策记录，事实类记入对应对象的核验记录，已被替代的旧方案用「修正-N」编号追加。
   - 叙事文档的状态字段在修正后**必须刷新**（降为「草稿」待下次核验，或重新标注核验日期）。
   - 旧方案如果值得保留（如否决的理由将来可能被重新评估），在 records 子文档中用一条记录保留，不回填到叙事文档。
8. **纪律提示块**：每个叙事文档（00-04）的前 15 行必须包含纪律提示块。格式为 HTML 注释（源码可见，渲染不可见）。HTML 注释 vs blockquote：blockquote 给读者看（增加阅读噪音），HTML 注释给写的人看（agent 编辑文件时一定能看到前几行的注释）。本文档自身也需要纪律提示块。
9. **交叉引用格式**：文档间引用必须使用 `文件名.md §N 标题` 格式。禁止使用无文件名的纯 § 编号引用。例：写 `02-phase-0.md §5 验收标准`，不写 `02 §5`。

## 5. 首轮执行记录（本纪律的第一次应用）

**已迁移至 [tasks/T00-docset-v1-2026-08-18.md](tasks/T00-docset-v1-2026-08-18.md)**——按 [05-process.md §3.2 task 维度规则](05-process.md)，历史执行记录归 task 档案，不入过程定义文档本身。本节仅作引用占位。

## 附录 A · subagent 文档核验 prompt 模板

```markdown
你是只读核查 agent。任务：核验指定文档中的所有可检查声明。

步骤：
1. 读取目标文档，提取所有可检查声明：
   - 【事实】声明（附带验证命令和日期的）
   - 数字声明（含具体计数的）
   - 路径/文件存在性声明
   - 依赖关系声明
   - API 存在性声明
2. 对每条声明，运行验证命令或读取相关代码
3. 比对声明值与实测值
4. 输出报告：
   - ✅ 通过：声明值 = 实测值
   - ❌ 失败：声明值 ≠ 实测值（附实测值）
   - ⚠️ 无法验证：命令不可执行或路径不存在

不修改任何文件。只读。
```

**核验结果的记录位置**：每条核验结果记入对应的 `records/` 对象子文档。格式：

```markdown
## 核验 · Phase X 文档（2026-08-20 16:00）

- **类型**：核验
- **核验人**：subagent A
- **范围**：00-why-rebuild.md, 02-phase-0.md
- **结果**：15/15 通过，0 失败，0 无法验证
- **逐条**：
  - ✅ [00-why-rebuild.md §3](00-why-rebuild.md) 营销工具 14 文件 → `ls | wc -l` = 14
  - ✅ [02-phase-0.md §5](02-phase-0.md) deleted 951 → `git diff --name-only | wc -l` = 951
```

**subagent 核验范围（不限于数字）**：所有能用命令+代码得到「对/错」结论的声明都应被核验。常见类型：数字（`ls | wc -l`、`grep | wc -l`）/文件存在（`ls`、`test -e`）/API 存在（`grep -r`）/依赖关系（`grep` 统计 import）/行为描述（读代码确认）/配置事实（`cat package.json | jq`）。

---

## 附录 B · 大改动工作流程（D11）

**目标**：避免主 agent「号称完成未对照方案」类问题。流程强制主 agent 在大改动任务的全周期内产出可审计的中间产物。

### B.1 开工前：task 计划登记（落在 `tasks/T<id>-<slug>.md`）

- **创建独立 task 文档**：`tasks/T<id>-<slug>.md`（如 `tasks/T01-governance-2026-08-20.md`）
- task 文档必须包含：任务概述 / 任务清单（多 step）/ 验收标准 / 参考方案文档 / 完成时间窗
- **同时**在 [tracker.md §2 任务表](tracker.md) 新增一行（**仅一行**）：T 编号 + 块号 + 状态 + `[BIG]` 标记 + 任务计划指针（`tasks/T<id>.md`）
- **CI 拦截**（commit 阶段）：`tools/zone-registry/src/check-tasks.ts` 检测到大改动 → 检查 commit message 含 `task: T<id>` / `[BIG]` 引用 + `tasks/T<id>.md` 在本次 commit 里被创建或更新

### B.2 完工时：自检报告（**追加到同一 `tasks/T<id>.md` 末尾**）

```markdown
## 自检 · 2026-08-20 19:30

**主 agent 任务清单**（对照原方案）：
- [x] 子任务 1（【事实】已做）
- [x] 子任务 2（【决策】做了 X 选择）
- [ ] 子任务 3（【假设】待 subagent 核验）

**承诺 vs 落地对照**：

| 原方案承诺 | 实际落地 | 偏差 | 决策登记 |
|---|---|---|---|
| §2.1 计划修正规则 | ✅ 已做 | 无 | — |
| §3.1 check-docs 6 条 | ⚠️ 仅 5 条 | R6 暂缓 | D12（语义判定不适合 CI）|
| §4 存量整改 | ✅ 9 文件覆盖 | 无 | — |

**完成度自评**：
- 完全落地 X 条（Y%）
- 部分落地 Z 条（W%）
- 完全未做 V 条（U%）
```

### B.3 自检后：subagent 核验（**追加到同一 `tasks/T<id>.md` 末尾**）

派出只读 subagent 独立核验，prompt 模板见附录 A。subagent 输出结果记入 `tasks/T<id>.md`「核验-N」章节。**核验不通过 → 重做自检 → 再核验**。

### B.4 决策偏差登记

自检中发现与原方案的偏差（如「R6 暂缓」「spike R5 豁免」等），必须登记为新的 D 决策（`records/docs-governance.md`），不允许"做而不报"。

### B.5 三件套缺一不可的强制点

| 检查点 | 触发 | 落点 | CI / 流程 |
|---|---|---|---|
| task 计划 | 大改动开工前 | `tasks/T<id>.md` 创建 | `check-tasks.ts` 自动拦截 commit |
| 自检报告 | 主 agent 完工时 | `tasks/T<id>.md` 自检章节 | 主 agent 自律（D11） |
| subagent 核验 | 自检完成后 | `tasks/T<id>.md` 核验章节 | gate review 第 4 步硬性前置 |

**核心约束**：三件套**全部落在 `tasks/T<id>.md` 单个文档**——不允许分散在 records/ 子文档或 tracker.md。task 维度（task 文档）和文件维度（records 文档）严格分离。

### B.6 例外机制

- 紧急 commit（修 CI 红等）允许 `[no-task-plan]` tag 跳过 check-tasks 检查
- 例外 tag 必须在 24h 内补办 task 计划登记（owner 监督）
- 自检报告与核验**不允许**走例外——这是纪律底线
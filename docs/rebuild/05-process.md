<!--
  写作纪律（改本文前必读）：
  - 本文是过程定义，优先级最高。修改本文需在 records/topics/docs-governance.md 登记一条决策
  - 修改本文后必须刷新头部的「状态/时间/核验人」三字段
  - 详细规则见 docs/rebuild/05-process.md §4
  - 文件↔record 一一对应纪律见 05-process.md §4.10（D14 决策）
  - task 三件套物理拆分纪律见 05-process.md §4.11（D15 决策，owner 提议"任务表填三列 + CI 查表对路径"）
-->

# 05 · 工作方式与文档纪律

> **状态**：草稿（owner 两次提示后修订：§3.2 显式补一一对应 + [05-process.md §4.10](05-process.md) D14 + [05-process.md §4.11](05-process.md) D15 三件套物理拆分；T09 修订：§3.2 大改动段落按 D15 重写除腐、§3.1 脚本路径修正、§2 树状图修正、PR 列残留清除，待 owner + subagent 核验） | **时间**：2026-08-25（附录 B.3 新增 verify 远端 CI 复验强制规则——T22 假绿事件触发；§2 ≤80 行预算同步；§4 第 5 条「五处实锤」口径统一；头部与树状图裸 § 引用修正） | **核验人**：主 agent 修订，待 owner + subagent 核验
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
├── README.md                       # 索引 + 治理兜底规则
├── 00-why-rebuild.md               # 背景、实测资产、大改清单（叙事）
├── 01-target-state.md              # 目标态、能力地图、不加清单（决策）
├── 02-phase-0.md                   # Phase 0 定义与验收（决策）
├── 03-phase-1-runtime.md           # runtime spike 硬门（决策/调研）
├── 04-porting-discipline.md        # 移植纪律（决策）
├── 05-process.md                   # 本文（过程定义，优先级最高）
├── tracker.md                      # 【活文档·精简】阶段门 + 任务表（plan/self-check/verify 三列路径）+ 记录索引
├── proposals/                      # 外部建议集合（append-only，不修改原条目）
│   └── governance-v1.md            # D10-D15 落地的源头建议
├── tasks/                          # task 维度档案——三件套物理拆分（D15 决策）
│   ├── _index.md                   # 任务表（镜像 tracker.md §2）
│   └── T<NN>-{plan,self-check,verify}.md   # 每 task 三件套，编号全局递增（T00 起）
├── records/                        # 变更/核验/腐烂记录（append-only）—— 两层结构（D14 D15）
│   ├── _index.md                   # 子文档索引（两层列表）
│   ├── narrative/                  # 物理绑定层（与文件 1:1，05-process.md §4.10 D14）
│   │   ├── 00-why-rebuild.md
│   │   ├── 01-target-state.md
│   │   ├── 02-phase-0.md
│   │   ├── 03-phase-1-runtime.md
│   │   ├── 04-porting-discipline.md
│   │   ├── 05-process.md
│   │   ├── README.md
│   │   ├── tracker.md
│   │   ├── proposals/
│   │   └── spikes/<file>.zh.md
│   └── topics/                     # 主题聚合层（横向档案，10 文件，D15 重组）
│       ├── agent-runtime.md
│       ├── brand-config.md
│       ├── chat-ui.md
│       ├── ci-infra.md
│       ├── docs-governance.md
│       ├── i18n.md
│       ├── spikes.md
│       ├── tools-image-gen.md
│       ├── tools-marketing.md
│       └── upstream-merge.md
├── spikes/                         # spike 报告（Phase 1 起，一事一报）
└── archive/                        # 过期文档坟墓（按需创建；归档不删除，文件名加日期）
```

**真相分层**：路径归属 → zone registry（代码，CI 校验，Phase 0 产出）；状态与决策 → `tracker.md` 任务表 + `records/narrative/<file>.md`（物理绑定层）+ `records/topics/<topic>.md`（主题聚合层）；叙事与理由 → 00-04；task 三件套 → `tasks/T<NN>-{plan,self-check,verify}.md`。**三层冲突时**：registry > records 子文档 > tracker 索引 > 叙事文档。

**task 三件套（[§4.11 D15](05-process.md)）**：每个 task 由三个独立物理文件承载——`tasks/T<NN>-plan.md` / `tasks/T<NN>-self-check.md` / `tasks/T<NN>-verify.md`，任务表填三列路径，CI 用 `existsSync` 检查三文件存在。

**records 两层结构（[§4.10 D14](05-process.md)）**：`records/narrative/` 物理绑定层（与文件 1:1）+ `records/topics/` 主题聚合层（跨文件横向档案）——两并存，主题聚合层不可替代物理绑定层。完整列表见 [`records/_index.md`](records/_index.md)。

**proposals 集合**：外部建议文档——append-only，不修改原条目；采纳映射登记在 [`records/topics/docs-governance.md` 的 D 决策条目](records/topics/docs-governance.md)。

**关于 tracker.md 拆分**：原 tracker.md 集阶段门 / 决策日志 / 任务表 / WIP 审判 / 核验日志 / 腐烂记录六类信息于一身，膨胀至 106 行后查找困难。新结构：tracker.md 只保留索引 + 阶段门 + 任务表 + 记录索引三块（≤80 行——T09 由 ≤50 行放宽，任务表行数随 task 增长，原预算已不可达）；详细记录按对象归 `records/` 子文档，子文档 append-only。

## 3. 工作方式

### 3.1 阶段门（gate）制度

每个 phase 有入口标准、出口标准（02/03/04 各文档已定义），状态集中在 tracker 呈现。过 gate 的条件：**出口标准逐条核验通过 + 该阶段文档全量 review 完成**。

**gate review 标准动作（不可跳过）**：

1. CI 全绿（已自动化——T09 起四个纪律检查经 ci.yml `rebuild-discipline` job 接线，见 [records/topics/ci-infra.md CI-6](records/topics/ci-infra.md)）
2. zone check 全绿（`tools/zone-registry/src/check.ts`，CI + pre-commit 双拦截）
3. **文档格式校验全绿**（`tools/zone-registry/src/check/docs.ts`，CI + pre-commit 双拦截）
4. **文件↔record 一一对应核验全绿**（`tools/zone-registry/src/check/bindings.ts`，CI + pre-commit 双拦截）：物理文件修改 → `records/narrative/<file>.md` 同步更新；缺失/孤儿均拒绝合入。
5. **task 三件套齐全 + 无占位核验全绿**（`tools/zone-registry/src/check/tasks.ts`，D15 读任务表三列路径 + `existsSync`；D19 占位检测：self-check/verify 命中占位标记即拒收）：commit 引用 `task: T<NN>` → `tasks/T<NN>-{plan,self-check,verify}.md` 三文件必须全部存在且非占位。
6. **subagent 文档核验**：对当前 phase 相关叙事文档中的所有可检查声明，逐条验证，结果记入 `records/` 对应对象子文档。核验不通过的阻塞 gate。

> 第 4 / 5 / 6 步是 gate 的硬性前置条件——不跑核验就不能过 gate。subagent 核验 prompt 模板见附录 A。

### 3.2 任务粒度与大改动纪律（D11）

**基本任务单位**：

- 能力块（C1-C5/B1-B4/F1）与引擎补丁（Pn）是基本任务单位：一块 = 一组 commit + 验收测试 + tracker 一行 + **独立 task 三件套**（见下）。`docs/rebuild/` 范围不采用 PR 管理（T08 决策）——任务以 commit + 任务表登记为唯一载体。
- spike 单独成报告进 `spikes/`：问题、方法、代码链接、结论、对选型的影响。spike 自身的核验与修正记录归 `records/narrative/spikes/<file>.zh.md`。
- 移植操作按 04 的纪律（逐字 → 绿 → 重构另 commit）。

**Task 维度 vs 文件维度的严格分离**：

- **Task 维度**（`tasks/T<NN>-{plan,self-check,verify}.md` 三件套，D15 决策）：每个 task 由**三个独立物理文件**承载——`plan.md`（计划 + 任务清单 + 验收标准）/ `self-check.md`（主 agent 自检 + 完成度数字）/ `verify.md`（subagent 独立核验）。三件套对应任务表三列路径，CI 用 `existsSync` 逐个检查——零正则、零章节、零语义判定，三件套齐不齐一目了然。
- **文件维度**（`records/narrative/<file>.md`）：**与物理文件一一对应**——每个被纳入治理的物理文件必须有自己的 `records/narrative/<file>.md`（文件名去后缀、连字符化）。承载腐烂/修正/核验——针对**物理文件**的变更历史，不放 task 相关的自检/核验。
- **Tracker.md**（[tracker.md §2 任务表](tracker.md)）：**任务表的真源**——每行含 T 编号 + 块 + 内容 + 验收 + 状态 + **plan / self-check / verify 三列路径**（T08 起无 PR 列）。[tasks/_index.md §2 任务清单](tasks/_index.md) 作为辅助镜像同步。**不重复 task 计划内容**，仅作为三件套路径索引。
- **错误示范 1**：把"task 自检-N"放进 `records/narrative/<file>.md` 会破坏文件维度档案的纯度——必须放 `tasks/T<NN>-self-check.md`。
- **错误示范 2**：跨多个物理文件只维护一个"主题聚合"record（如 `records/topics/agent-runtime.md` 涵盖十几个文件）——主题聚合 record 是检索辅助，**不是替代物**；每个被治理文件必须有自己的 `records/narrative/<file>.md`。详细两层关系见 [05-process.md §4.10](05-process.md)。
- **错误示范 3（D15 新增）**：把三件套装进单文档 `tasks/T<id>-<slug>.md` 然后用 `## 自检` / `## 核验` 章节正则识别——章节可以是占位（如「待 owner 触发」），CI 识别为通过但实际三件套不齐。**必须物理拆分 + 任务表路径列**。

**大改动纪律（D11 决策）**：

满足以下任一即为"大改动"：

| 规则 | 阈值 | CI 检测 |
|---|---|---|
| R1 文件数 | 修改文件 ≥ 10 个 | `git diff --name-only \| wc -l` |
| R2 行数 | 变更行 ≥ 200 行 | `git diff --shortstat` |
| R3 叙事文档 | 修改任意 `docs/rebuild/{00-04,05,README,tracker,spikes}*.md` | 文件名匹配 |
| R4 records 层 | 修改任意 `docs/rebuild/records/*.md` | 文件名匹配 |

**大改动必产三件套**（D11 确立义务，D15 物理拆分落法——详细结构见 [05-process.md §4.11](05-process.md) 与 [附录 B](05-process.md)）：

1. **task 计划**（开工前）：创建 `tasks/T<NN>-plan.md`，含任务清单、目标、验收标准。**同时**在 [tracker.md §2 任务表](tracker.md) 新增一行（含 plan / self-check / verify 三列路径）。
2. **自检报告**（完工时）：创建 `tasks/T<NN>-self-check.md`——分标【事实/决策/假设】，对照原方案列出"承诺X / 落地Y / 偏差Z"。**不许**写进 `records/narrative/`。
3. **subagent 核验**（自检后，主 agent 主动派单）：只读 subagent 对照原方案 + task 计划 + 自检报告三方一致，结果填入 `tasks/T<NN>-verify.md`——**必须实做，禁止占位模板**（[05-process.md §4.11](05-process.md)，CI 占位检测拦截）。

**CI 拦截**：`tools/zone-registry/src/check/tasks.ts` 检查命中大改动 → commit message 必须含 `task: T<NN>` 指针 + 任务表有对应行 + 三件套 `existsSync` 全过 + 占位检测全过。**例外**：commit message 加 `[no-task-plan]` tag（限 owner 标注，**仅限紧急 CI 红修复**，24h 内必须补办）。

**针对 agent 的核心约束**：主 agent 自认完成大改动任务前，**必须主动对照方案文档产出完成度对照报告**——不得"做而不报"或"号称完成未对照"。详见附录 B 的工作流程。

### 3.3 upstream 合并

- 月合并（或漂移显著时提前），在专用分支操作；合并后**当场**刷新 zone registry 与补丁清单，`records/topics/upstream-merge.md` 记一条合并记录。
- 合并后必须跑 check:docs（CI 自动）+ 排 subagent 核验受影响文档。
- Phase 0 出口含一次「合并演习」。

## 4. 文档纪律（写作与维护规则）

1. **三种陈述分标**：
   - 【事实】可重跑的观察。必须附：核验命令/路径 + 日期。例：「`packages/core/src/tools/marketing/` 14 文件（`ls`，2026-08-18）」。
   - 【决策】人的选择。必须附：拍板人 + 日期 + 理由，登记进 `records/` 对应对象子文档（D 编号）。
   - 【假设】未验证的判断。必须显式标注【假设】，且**禁止进入任何验收标准**。
2. **腐烂即改**：发现文档与现实不符，当场修正文档，并在 `records/` 对应对象子文档「腐烂记录」加一条（ROT-N 编号，日期/文档/错的内容/实况）。不许「知道错了但留着」。
3. **状态字段**：每个叙事文档（00-04）头部必须包含五字段：`状态` / `时间`（YYYY-MM-DD HH:MM，本地时间 24h 制）/ `核验人` / `身份`（决策链角色）/ `基线`（可选）。状态值：`草稿`（agent 新写未核）/ `已核验`（对账通过）/ `已执行`（描述的 phase 已执行完成，可与「已核验」并存）/ `已过期`（归档 archive/）。时间精度用 `YYYY-MM-DD HH:MM` 便于同日事件排序。
4. **维护触发器**：①阶段转换；②决策拍板或变更；③实测发现不符；④每次 upstream 合并后；⑤每个 gate review 全量重核；⑥叙事文档大改后（主 agent 判定本文档做了结构性重写时，写入完成 24h 内排一次核验）。
5. **档案纪律**：归档不删除；旧分支文档只作历史参考，引用前重新核验（[00-why-rebuild.md §5](00-why-rebuild.md) 已有五处实锤）。
6. **写作风格**：写约束，不写心路；写可检查的标准，不写方向性口号；每个「必须/应该」都要能被 CI 或核验命令检查。
7. **计划修正**：当执行实测推翻文档中的计划/假设时：
   - 叙事文档（00-04）**直接改成新版本**，不加修正节、不加 blockquote、不保留旧方案痕迹。
   - 修正的完整记录记入 `records/` 子文档：决策类记入对应对象的决策记录，事实类记入对应对象的核验记录，已被替代的旧方案用「修正-N」编号追加。
   - 叙事文档的状态字段在修正后**必须刷新**（降为「草稿」待下次核验，或重新标注核验日期）。
   - 旧方案如果值得保留（如否决的理由将来可能被重新评估），在 records 子文档中用一条记录保留，不回填到叙事文档。
8. **纪律提示块**：每个叙事文档（00-04）的前 15 行必须包含纪律提示块。格式为 HTML 注释（源码可见，渲染不可见）。HTML 注释 vs blockquote：blockquote 给读者看（增加阅读噪音），HTML 注释给写的人看（agent 编辑文件时一定能看到前几行的注释）。本文档自身也需要纪律提示块。
9. **交叉引用格式**：文档间引用必须使用 `文件名.md §N 标题` 格式。禁止使用无文件名的纯 § 编号引用。例：写 `02-phase-0.md §5 验收标准`，不写 `02 §5`。
10. **文件↔record 一一对应纪律（owner 触发 · D14 决策）**：
    - **核心约束**：每个被纳入文档治理范围的**物理文件**（如 `00-why-rebuild.md`、`05-process.md`、`tracker.md`、`README.md`、各种 spike `.zh.md`）必须拥有自己的 `records/narrative/<file>.md`——文件名脱去 `.md` 后缀、连字符化（如 `00-why-rebuild.md` ↔ `records/narrative/00-why-rebuild.md`）。**一一对应**，不允许多文件共享一个 record，也不允许 record 单独存在没有对应文件。
    - **两层关系**：`records/topics/<topic>.md`（如 `agent-runtime.md`、`ci-infra.md`）是**主题聚合层**（横向档案），按主题横向检索；`records/narrative/<file>.md` 是**物理绑定层**，纵向记录单个**物理文件**的腐烂/修正/核验。两者并存，主题聚合层为检索辅助，**不可替代**物理绑定层。
    - **横向档案不需要 narrative 绑定**（owner 反馈 2026-08-21，T07 修正）：`records/topics/<topic>.md` 是横向档案，本身**没有"对应物理文件"**——它的"绑定对象"是主题（多个物理文件的腐烂/核验）而不是单文件。**不允许**为 `topics/ci-infra.md` / `topics/agent-runtime.md` 等横向档案创建 `narrative/<topic>.md`——`narrative/` 层**只绑物理文件**。
    - **修改触发**：物理文件被改（任意 commit 改其内容）→ 同 commit 内必须更新对应 `records/narrative/<file>.md`（哪怕只追加一条「无变化」记录）。不允许"有修改、无 record"。横向档案被改 → 不触发 narrative 绑定。
    - **新增/删除触发**：新增物理文件 → 同步创建对应 record；物理文件被删或归档 → record 末尾标 `[ARCHIVED]`，归档但不删除。横向档案新增/删除不触发 narrative。
    - **CI 拦截**：`tools/zone-registry/src/check/bindings.ts` 检测到叙事层物理文件被改但未更新 `records/narrative/<file>.md` → 拒绝 commit（pre-commit）+ 拒绝 push（CI）。`docs/rebuild/05-process.md §3.1` gate review 第 6 步（subagent 文档核验）将"record 与物理文件一一对应"列为必查项。
    - **常见误区**：
      - 误区 1：以为 `records/topics/<对象>.md` 里写了某文件就算绑定了——错。`records/topics/<对象>.md` 是主题聚类（覆盖多文件），**不构成**与单文件的绑定关系，必须有独立的 `records/narrative/<file>.md`。
      - 误区 2（T07 新增）：为横向档案创建 `narrative/<topic>.md`——错。横向档案不需要 narrative 绑定（见上面"横向档案不需要 narrative 绑定"条目）。修正案例：T06 一开始误创建 `records/narrative/ci-infra.md`——已撤回。
    - **暂不绑定**：纯转瞬文件（CI 临时产物、构建产物、缓存）不属于治理范围，不要求一一对应。
11. **task 三件套物理拆分纪律（owner 触发 · D15 决策）**：
    - **核心约束**：每个 task 由**三个独立物理文件**承载——`tasks/T<NN>-plan.md` / `tasks/T<NN>-self-check.md` / `tasks/T<NN>-verify.md`（D15 决策）。**禁止**把三件套装回单文档 `tasks/T<id>-<slug>.md` 然后用章节正则识别——章节可以是占位（如「待 owner 触发」），CI 识别为通过但实际三件套不齐。
    - **任务表路径列**：[tracker.md §2 任务表](../tracker.md) 与 [tasks/_index.md §2 任务清单](../tasks/_index.md) 各自维护一份任务表，每行含 T 编号 + 块 + 内容/标题 + 验收 + 状态 + plan 路径 + self-check 路径 + verify 路径（T08 起无 PR 列——`docs/rebuild/` 范围不采用 PR 管理）。两表互为指针、真源是 tracker.md。
    - **CI 拦截**：`tools/zone-registry/src/check/tasks.ts` 检测大改动命中 + commit 含 `task: T<NN>` → 读任务表 → 检查 `existsSync(tasks/T<NN>-plan.md)` / `existsSync(tasks/T<NN>-self-check.md)` / `existsSync(tasks/T<NN>-verify.md)`。**任何一个缺失 → 拒绝 commit**。零正则、零章节、零语义判定。
    - **主 agent 自律**：完成度数字必须**实时期更新**（不允许"实际已 100%、自检停在 70%"的情况）；核验-N 不允许占位「待 owner 触发」——主 agent 在自检完成后**主动派 general-purpose subagent 独立核验**，不依赖 owner 触发。这是 D11「做而不报」纪律的机器可检查载体。
    - **错误示范**：在 `tasks/T<NN>-self-check.md` 写「核验-N 待 owner 触发」作为占位 → 即使三件套文件存在，CI `existsSync` 通过但纪律失效。**核验必须实做**——派单后由 subagent 产出实测报告填入 `tasks/T<NN>-verify.md`。
    - **暂不强制**：Phase 0 期间的 T00 历史回填（owner 触发回填任务）允许 `verify.md` 内容短、引用历史 owner 验收——但物理文件必须存在。

## 5. 首轮执行记录（本纪律的第一次应用）

**已迁移至 [tasks/T00-plan.md](tasks/T00-plan.md) / [tasks/T00-self-check.md](tasks/T00-self-check.md) / [tasks/T00-verify.md](tasks/T00-verify.md)**——按 [05-process.md §3.2 task 维度规则 + §4.11 D15 三件套物理拆分纪律](05-process.md)，历史执行记录归 task 档案三件套，不入过程定义文档本身。本节仅作引用占位。

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

### B.1 开工前：task 计划登记（落在 `tasks/T<NN>-plan.md` + 任务表三列）

- **创建 plan.md**：`tasks/T<NN>-plan.md`（如 `tasks/T04-plan.md`）
- plan.md 必须包含：任务概述 / 任务清单（多 step）/ 验收标准 / 参考方案文档 / 完成时间窗
- **同时**在 [tracker.md §2 任务表](tracker.md) 新增一行（**仅一行**）：T 编号 + 块号 + 内容 + 验收 + 状态 + **plan / self-check / verify 三列路径**（D15 决策；无 PR 列，T08）
- **同步** [tasks/_index.md §2 任务清单](tasks/_index.md) 镜像任务表
- **CI 拦截**（commit 阶段）：`tools/zone-registry/src/check/tasks.ts` 检测到大改动 → 检查 commit message 含 `task: T<NN>` 引用 + `existsSync(tasks/T<NN>-plan.md)` 必须为 true

### B.2 完工时：自检报告（落在 `tasks/T<NN>-self-check.md`）

- **创建 self-check.md**：`tasks/T<NN>-self-check.md`（如 `tasks/T04-self-check.md`）
- self-check.md 必须包含：任务清单对照 / 承诺 vs 落地对照表 / 完成度自评（**实时期更新**——不允许"实际已 100%、自检停在 70%"的情况）/ 自评要点 / 决策影响
- **同时**更新 [tracker.md §2 任务表](tracker.md) + [tasks/_index.md §2 任务清单](tasks/_index.md) 的 self-check 列路径
- **CI 拦截**：commit 时 `existsSync(tasks/T<NN>-self-check.md)` 必须为 true；否则拒绝合入

### B.3 自检后：subagent 核验（落在 `tasks/T<NN>-verify.md`，主 agent **主动派单**）

- **创建 verify.md**：`tasks/T<NN>-verify.md`（如 `tasks/T04-verify.md`）
- **主 agent 主动派 general-purpose subagent 独立核验**——**不依赖 owner 触发**。这是 D11「做而不报」纪律的机器可检查载体。
- verify.md 必须包含：核验背景（核验人/时间/范围/依据）/ 逐条核验表（每条含证据命令 + 实测值）/ 总评 / 综合判定 / 失败项详情（如有）
- **verify 必须含远端 CI 复验项**（2026-08-25 新增，T22 假绿事件触发——实录见 [records/topics/ci-infra.md CI-12](records/topics/ci-infra.md)）：凡 self-check / tracker 登记了远端 CI run 结论的，verify 必须用 `gh run view <id> --json conclusion`（或 `gh api repos/<owner>/<repo>/actions/runs/<id>`）独立复验该结论为真；**核验范围缺此项即打回**（核验范围缩水本身构成打回理由，同 ROT-16 占位核验同级）
- **同时**更新 [tracker.md §2 任务表](tracker.md) + [tasks/_index.md §2 任务清单](tasks/_index.md) 的 verify 列路径
- **CI 拦截**：commit 时 `existsSync(tasks/T<NN>-verify.md)` 必须为 true；否则拒绝合入

### B.4 决策偏差登记

自检中发现与原方案的偏差（如「R6 暂缓」「spike R5 豁免」等），必须登记为新的 D 决策（`records/topics/docs-governance.md`），不允许"做而不报"。

### B.5 三件套缺一不可的强制点

| 检查点 | 触发 | 落点 | CI / 流程 |
|---|---|---|---|
| task 计划 | 大改动开工前 | `tasks/T<NN>-plan.md` 创建 + 任务表 plan 列填路径 | `tools/zone-registry/src/check/tasks.ts` 自动拦截 commit（`existsSync` plan） |
| 自检报告 | 主 agent 完工时 | `tasks/T<NN>-self-check.md` 创建 + 完成度实时期更新 + 任务表 self-check 列填路径 | `tools/zone-registry/src/check/tasks.ts` 自动拦截 commit（`existsSync` self-check + 占位检测 D19） |
| subagent 核验 | 自检完成后 | `tasks/T<NN>-verify.md` 创建（主 agent 主动派单）+ 任务表 verify 列填路径 | `tools/zone-registry/src/check/tasks.ts` 自动拦截 commit（`existsSync` verify + 占位检测 D19） |

**核心约束**（D15）：三件套**三个独立物理文件**——不允许单文档 `T<id>-<slug>.md` + 章节正则形式。**禁止占位**：「核验-N 待 owner 触发」「完成度暂未刷新」等占位章节即使文件存在也不通过纪律——主 agent 必须实做。

### B.6 例外机制

- 紧急 commit（修 CI 红等）允许 `[no-task-plan]` tag 跳过 check-tasks 检查
- 例外 tag 必须在 24h 内补办 task 计划登记（owner 监督）
- 自检报告与核验**不允许**走例外——这是纪律底线
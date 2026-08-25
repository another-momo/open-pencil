<!--
  写作纪律（改本文前必读）：
  - 事实性声明必须附核验命令 + 日期，否则标为【假设】
  - 本文只保留当前态，不保留修正历史；修正记入 records/narrative/tasks/T30-verify.md
-->

# T30 独立核验 · 01 推进规划重整 + 04/05/tracker 文档纪律轮 + tracker 合并压缩（D30/D31/D32）

> **状态**：已核验（独立 subagent，V3 一项打回，余全过） | **时间**：2026-08-25 | **核验人**：独立 subagent
> **plan**：[T30-plan.md](T30-plan.md) | **self-check**：[T30-self-check.md](T30-self-check.md)

## 核验清单（V1-V8，对账 plan 验收 C1-C8）

> 每条附核验命令 + 实测结果 + 结论；全部命令由独立 subagent 于 2026-08-25 实跑，未照抄 self-check 结论。

- [x] V1 = C1（01 §2 推进规划 + 原 §8 删除）——✅ 通过
  - `grep -n '^## ' docs/rebuild/01-target-state.md`（2026-08-25）→ 节序列 = §1 一句话定义 / **§2 推进规划（Phase 划分）**（01:22）/ §3 层 0 / §4 层 1 / §5 层 2 / §6 不加清单 / §7 待拍板决策 / §8 parity 线；§2 内含 Phase↔层映射表（Phase 0/1 无对应层说明 + 每 Phase 验收主场指针，01:26-33 实测目视）。
  - `grep -c '三路线对比' docs/rebuild/01-target-state.md`（2026-08-25）= **0**，原 §8 三路线对比节零残留。
- [x] V2 = C2（01 去补丁规范化，事实标注保留不误伤）——✅ 通过
  - `grep -n '（2026-08-25 三方 review 整改）\|决策批 #13 拍板口径详目\|待 owner + subagent 核验\|（2026-08-25 同步）' docs/rebuild/01-target-state.md`（2026-08-25）→ 零命中（exit=1）。
  - 事实标注保留实证：`grep -n '2026-08-25 owner 拍板口径，决策批 #13' docs/rebuild/01-target-state.md` → 01:63 层 1 验收行命中；§7 决策表 D3（01:96）/D5（01:98）状态列含「已拍板（owner，2026-08-25」（原文带 markdown 粗体标记 `**已拍板**（owner，2026-08-25：…`，2026-08-25 目视核对）。
- [ ] V3 = C3（03 §4.4 + §6 两行）——❌ **打回**
  - 合规面：`grep -n '### 4.4 X 复用更贵' docs/rebuild/03-phase-1-runtime.md` → 03:156 命中；§4.4 含五条代价列表 + 人日差【假设】标注（03:156-170 目视）；§6 文档关系索引两行（03:240 起）分别指向「01-target-state.md §2」与「本文 §4.4」，§6 内无旧号错指。
  - 打回点：`grep -n '01-target-state.md §[78]' docs/rebuild/03-phase-1-runtime.md`（2026-08-25）→ **1 命中**（spec 口径应零命中）：03:67，§2.2 关键约束表「工作量」行来源列残留 `[01-target-state.md §8](01-target-state.md)`。01 §8 现为 parity 线，原三路线对比内容已迁本文 §4.4——旧号错指/腐烂指针。
  - 旁证：`git show 28336b93:docs/rebuild/03-phase-1-runtime.md | grep -n '01-target-state.md §[78]'`（2026-08-25）→ T30 前 4 处（:14/:68/:227/:228），T30 commit 79504b8e 已修 3 处（头部→§2、§6 两行），独漏 §2.2 表内这 1 处。
  - 修复建议：03:67 来源列改指本文 §4.4 或仅留 `[spikes/04-dsh-x-design.zh.md §7.1]`，改后复跑上述 grep 应零命中。
- [x] V4 = C4（04 四处）——✅ 通过
  - 头部（04:12）：`状态：已核验 | 时间：2026-08-25 | 核验人：主 agent`，无 changelog 尾巴（2026-08-25 目视）。
  - §3 次序 4 处引用：`grep -n '01-target-state.md §' docs/rebuild/04-porting-discipline.md`（2026-08-25）→ 04:42 `§3 层 0` / 04:43 `§4` / 04:44 `§5` / 04:45 `§8`，新编号全对。
  - 测试规约行（04:22）：注意列含「已废止」+「01-target-state.md §4」（『16 文件移植全绿』口径废止、改按 01 §4 五环冒烟口径）。
  - §4 登记规则（04:49）：含「tasks/_index.md §2」逐任务永久行（真源）+「D31」。
- [x] V5 = C5（05 六处）——✅ 通过（逐项 grep + 目视，2026-08-25）
  - 头部纯化（05:13）：`状态：已核验 | 时间：2026-08-25 | 核验人：主 agent`。
  - §2 树状图：05:37 含 `runbook-github-push.md` 行；05:41 `_index.md # 逐任务索引真源（§2 任务清单含三件套路径列）+ 实录归档（§6）`。
  - §2「tracker.md 结构」段（05:79）：含「任务表两区」定义（逐任务索引真源 = tasks/_index.md §2；tracker.md §2 = 当前任务行 + 已收口分组行）。
  - §3.2（05:110）：行以「任务表（两区，D31）」开头且称 _index §2 为逐任务索引真源。
  - §4.11（05:177）：任务表路径列行称 _index §2 为逐任务索引真源。
  - 附录 B.1（05:235→236）：先「tasks/_index.md §2 新增逐任务永久行（——逐任务索引真源）」、后「tracker.md §2 登记当前任务行」，主场互换顺序正确。
- [x] V6 = C6（tracker 合并压缩 + 行数预算 + 占位行删）——✅ 通过
  - `wc -l docs/rebuild/tracker.md`（2026-08-25）= **53 行** ≤ 80 预算。
  - `grep -c '^| T[0-9]' docs/rebuild/tracker.md`（2026-08-25）= **6**（5 分组行 T00-T09/T10-T13/T14-T17/T18-T25/T26-T29（tracker:36-40）+ T30 当前行（tracker:41））。附注：spec 所给 `grep -c '^| T'` 实测 = 7，多出的 1 是任务表表头行 `| T 编号 |`（tracker:34），实义任务行 6 行达标。
  - `grep -c '后续 task 按顺序登记' docs/rebuild/tracker.md`（2026-08-25）= **0**，占位行已删。
  - 5 分组行末三列均为 `—`（`grep -c '| — | — | — |'` 命中 5 组行，tracker:36-40，2026-08-25）。
- [x] V7 = C7（\_index.md 真源互换 + T26-T30 行）——✅ 通过
  - `grep -c '^| \[T3\?0\]\|^| \[T2[6-9]\]' docs/rebuild/tasks/_index.md`（2026-08-25）= **5**（T26:\_index:60 / T27:61 / T28:62 / T29:63 / T30:64）。
  - 头部关系行（\_index:14）：「本文 §2 任务清单是**逐任务索引真源**……如有不一致以本文为准」。
  - §2 标题（\_index:28）：含「逐任务索引真源」。
  - 归档注（\_index:30）：改口为「两区结构」（本节 §2 = 逐任务索引真源，tracker.md §2 = 当前任务行 + 已收口分组行）。
- [x] V8 = C8（D32 全仓 F0.3② 清零）——✅ 通过
  - 当前态八件 `grep -c 'F0.3②'` 与 `grep -c 'F0.3①'`（01/02/03/04/05/tracker/README/00-why-rebuild，2026-08-25）全 **0**。
  - 01 §3 F0.3 行名 =「F0.3 聊天凭证链」（01:43）；01 §4 C3a 依赖列末格 =「F0.2 桥」（01:59）；tracker Phase 2 行含「出口全数达成（F0.7 脆依赖随 T10 消除；生图独立凭证链随 D32 移层 1 C3a）」（tracker:23）——三处正向口径全对。
  - 全仓残留扫描 `grep -rn 'F0.3[②①]' docs/rebuild/`（2026-08-25，Windows 下路径分隔符为反斜杠，spec 的 `grep -v 'records/narrative\|records/topics'` 需先 `tr '\\' '/'` 归一化方生效）残留全部位于允许区：records/narrative + records/topics（历史档案，spec 明示允许）、spikes/*.md（带日期调研实录 3 处）、tasks/T19-T26 历史三件套（plan §5 不做清单明示不回改时间戳实录）、D32 变更自描述行（T30-self-check:23 / 本文 V8 行 / \_index:64 T30 行）。
  - 边界项（不阻断，建议后续顺手改口）：`records/_index.md:59` 生图管线行仍以「F0.3② 凭证链」描述 topics/tools-image-gen.md 内容——在 records 档案允许区内，但 records/\_index.md 属当前态索引，D32 后该标签已与 01 改口（F0.3 聊天凭证链 + ② 编号取消）不一致。

## 门禁复验（subagent 复跑，全部 2026-08-25）

- [x] `bun run check:docs` → `check-docs: 39/39 通过（R1 状态 + R2 时间 + R3 身份 + R4 纪律块 + R5 引用格式）` ✅
- [x] `bun run check:tasks` → 工作区相对 HEAD 干净时报「无变更，跳过」；为实证 T30 登记强制复跑 `bun tools/zone-registry/src/check/tasks.ts --base 28336b93` → `check-tasks: 大改动（R1 文件数 15 >= 10 / R2 变更行数 921 >= 200 / R3 / R4），task T30 三件套（plan / self-check / verify）齐全` ✅
- [x] `bun run check:bindings` → 同上跳过机制；强制 `--base 28336b93` → `check-bindings: 15 文件变更，binding 全绿` ✅
- [x] `bun run check:zones` → `[zones] clean: 53 modified (all registered), 271 added (owned), 1014 deleted (all registered), base 5201404f` ✅
- [x] 远端 CI（B.3 强制复验）：`gh run view 32848717421 -R another-momo/open-pencil --json conclusion,status,headBranch,headSha`（2026-08-25）→ `conclusion=success, status=completed, headBranch=rebuild/pi, headSha=79504b8e1e736c128d2a039e034ee4808d979f9e`（= T30 commit）✅；`gh run view 32848429734`（staging 中转）→ `conclusion=success, headBranch=rebuild/pi-staging`，同 sha ✅

## 核验结论

**打回 + 理由**：V3 一项不过——`docs/rebuild/03-phase-1-runtime.md:67`（§2.2 关键约束表「工作量」行来源列）残留 `[01-target-state.md §8](01-target-state.md)` 旧号错指：01 §8 自 T30 起为 parity 线，原三路线对比内容已迁 03 本文 §4.4，spec 核验命令 `grep -n '01-target-state.md §[78]' docs/rebuild/03-phase-1-runtime.md` 应零命中、实测 1 命中（2026-08-25）。plan C4「grep 无旧号错指」未闭环。

修复路径（单行级）：03:67 来源列改指本文 §4.4（或仅留 `[spikes/04-dsh-x-design.zh.md §7.1]` 来源），改后复跑该 grep 零命中 + check:docs 绿即可收口。

其余面全绿：V1/V2/V4/V5/V6/V7/V8 七项通过；本地四门禁（check:docs 39/39、check:tasks 三件套齐全、check:bindings 全绿、check:zones clean）全过；远端 CI 双 run（staging 32848429734 + rebuild/pi 32848717421，均 @ 79504b8e）独立复验 success。另有一项不阻断建议：records/\_index.md:59「F0.3② 凭证链」标签随 D32 顺手改口（见 V8 边界项）。

## 打回项闭环（主 agent 整改，2026-08-25）

- **V3 打回项修复**：03-phase-1-runtime.md §2.2 工作量行来源列 `[01-target-state.md §8](01-target-state.md)` → `本文 §4.4`；复跑 `grep -n '01-target-state.md §[78]' docs/rebuild/03-phase-1-runtime.md` 零命中（exit 1，2026-08-25）
- **V8 边界项顺手修复**：records/_index.md 生图管线行「F0.3② 凭证链」→「生图独立凭证链（原 F0.3②，D32 归并 C3a）」
- 两处 narrative 登记：03 条目 append 于 [records/narrative/03-phase-1-runtime.md](../records/narrative/03-phase-1-runtime.md)；records/_index.md 不在 check:bindings 绑定面（复跑全绿，2026-08-25）

**总结论（主 agent 整改后）：可以收口**——V1-V8 全过 + 四门禁绿 + 远端 CI 双 run success；打回项与边界项均已闭环。

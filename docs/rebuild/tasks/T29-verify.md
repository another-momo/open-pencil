<!--
  写作纪律（改本文前必读）：
  - 事实性声明必须附核验命令 + 日期，否则标为【假设】
  - 本文只保留当前态，不保留修正历史
  - 详细规则见 docs/rebuild/05-process.md §4
  - 本文件由独立核验 subagent 填写（05-process.md §4.11 + 附录 B）；主 agent 只建骨架
  - 附录 B.3：verify 必须含 `gh run view <id>` 复验远端 CI 结论，缺失即打回
-->

# tasks/T29-verify.md · T29 独立核验

> **T 编号**：T29（决策批落地 · 文档面）
> **状态**：🔄 待独立核验（骨架已建，待 subagent 实跑填写）

## 核验依据

- 方案：[T29-plan.md](T29-plan.md)（T29-D1..D10 交办）
- 自查：[T29-self-check.md](T29-self-check.md)
- 决策留痕口：[records/topics/docs-governance.md 决策批总登记 + 补登](../records/topics/docs-governance.md)

## 核验项（subagent 逐项实跑填写结论 + 证据）

| # | 核验项 | 方法建议 | 结论 |
|---|---|---|---|
| V1 | 补签组四处落点与 owner 拍板口径一致（D3 一文件多会话族谱 / D5 双模式保留 / D16 关闭 / 冻结期部分解冻） | 读 01 §6 + agent-runtime.md + chat-ui.md + docs-governance.md 对应条目 | ✅（2026-08-25 读文件实测）：01-target-state.md §6 D3（:85）「已拍板（2026-08-25 owner 补签：一文件多会话 + 族谱形态确认；落地 = T22/T23）」、D5（:87）「已拍板（双模式保留；落地 = T24 chatMode 请求级）」；records/topics/agent-runtime.md:247「D3 补签」条目、records/topics/chat-ui.md:51「D5 补签」条目在案；records/topics/docs-governance.md D16 形式关闭条目（:452-456，状态=已关闭）+ 治理冻结期「部分解冻」拍板条目（:458-465，堵漏型修正放行/新增治理面 Phase 2 继续冻结）——四处落点与拍板口径一致 |
| V2 | CI-14 登记与 gh api 实测一致：`gh api repos/another-momo/open-pencil/branches/rebuild%2Fpi/protection` | gh api 实测对照条目内容 | ✅（2026-08-25 `gh api repos/another-momo/open-pencil/branches/rebuild%2Fpi/protection` 实测）：required_status_checks.contexts = ["Code quality","Package integrity","Repository hygiene","Rebuild discipline"] 四项、enforce_admins.enabled=true、allow_force_pushes.enabled=true、allow_deletions.enabled=false、required_linear_history=false——与 ci-infra.md CI-14（:216）登记逐项一致（含「独立复验」段落的同口径记录） |
| V3 | 05 三处规则文与 T28 机制事实一致（过堂命令 / 报警命令 / 双周口径）；4 处原 `<待 T28 回填>` 标记位已回填实际命令名 | 读 05 §3.2/§3.3 + narrative/05-process.md 修正-N 条目：命令名就位且无占位语义（grep `待 T28 回填` 的命中仅限 T29 三件套/tracker 描述该历史标记的散文，不算残留） | ✅（2026-08-25）：05-process.md §3.2（:133）zones.json 变更报警规则文命令名 = `bun run check:tasks`（task 指针强制 + 不得用 `[no-task-plan]` 例外 + CI 摘要输出）、§3.3（:141）补丁过堂命令名 = `bun run check:zones --patches-report`（恒 exit 0）、§3.3（:140）双周窗口 >20 commits 触发、三口径取最先——与 T28 机制事实一致（两命令本核验 T28-V5 均已实跑验证 exit 0/摘要输出/指针判定路径）。records/narrative/05-process.md:185 修正-N 条目登记 #5/#6/#7/#8/#15 五项机制落地 + 回填事实。`grep -r "待 T28 回填" docs/` 命中仅 tracker.md:67 与 T29 三件套内描述该历史标记的散文（按口径不算残留），05 与 narrative 零命中、无占位语义 |
| V4 | Tk-Dn 规则文 + D25-D29 补登在案；历史文档未回改 | 读 records/_index.md §1 + agent-runtime.md；git diff 确认历史 plan 未动 | ✅（2026-08-25）：records/_index.md §1（:20）Tk-Dn 规则文在案（全局 D 仅跨任务、任务内自 2026-08-25 一律 Tk-Dn、历史不回改）；05-process.md §4 第 1 条（:149）同步改口并指回 _index.md §1；records/topics/agent-runtime.md:256-267「补登 · 全局 D 注册表恢复登记（D25-D29）」五条逐项一句话 + 出处指针。`git diff --name-only 08b4129a..HEAD -- docs/rebuild/tasks/` 除 T28/T29 三件套与 _index.md 外零命中——T19-T25 历史 plan/self-check/verify 未回改 |
| V5 | tracker 归档：tasks/_index.md §6 原文照录（抽查 3 任务对照 git 历史）+ tracker ≤80 行 | `grep -c "" docs/rebuild/tracker.md`；抽查比对 | ✅（2026-08-25）：tasks/_index.md §6（:93）「任务实录归档（T00-T20…）」节在案，归档依据注记完备；抽查 T10/T15/T20 三任务——§6 归档的「状态列原文/验收列原文」与 `git show 08b4129a:docs/rebuild/tracker.md` 对应行单元格逐字一致（仅链接路径按 tasks/ 目录相对位调整，如 `tasks/T20-self-check.md`→`T20-self-check.md`，内容零丢失）。`grep -c "" docs/rebuild/tracker.md` = **80 行** ≤80 预算贴顶（与 T29-self-check §4「T28/T29 两行入库后 80 行贴预算顶」自述一致；self-check §2.5 录 78 行为 T28/T29 行入库前口径） |
| V6 | 层 1 新口径在 01 §3 与 tracker Phase 3 行一致；旧「16 文件」口径无残留宣称 | grep `16 个移植` / `16 文件` 全仓 | ✅（2026-08-25）：01-target-state.md §3（:50）层 1 验收 = 「C1a-C5a 五环各配一条端到端冒烟且全绿 + `smoke:pi` 批次全绿 + CI 绿」，tracker.md:26 Phase 3 行同口径（含「原 16 测试文件口径宿主随 T10 消失已废止」废止声明）——两处在案且一致；01 §7 parity 线（:94）同步指新口径。`grep -rn "16 个移植\|16 文件\|16个移植" docs/ README.md AGENTS.md` 命中均为历史事实记录（00/04 基线表「恰 16 文件」、records 历史核验条目、spike 02 历史计划、修订注记对旧口径的引用式废止声明），无任何位置仍以旧口径作现行宣称。**观察项**（不打回）：01 §3 修订注记内「smoke:pi 批次现状 59 断言 = t22 6+t22 12+t23 14+t24 27」已随同日先行落地的 T28 过时——现 package.json `smoke:pi` 为五套件（含 t28/session-gc-smoke.mjs），本核验实测五套件 80 断言（6+12+14+29+19）；该句自带核验命令（`grep '"smoke:pi"' package.json`）可复现偏差，建议下一任务顺手刷新 |
| V7 | 根 README/AGENTS 指针落点 + zones.json P58/P59 登记 + check:zones 绿 | 读两文件 diff；`bun run check:zones` | ✅（2026-08-25）：README.md:250-253「OpenPencil Rebuild」节 4 行（链 docs/rebuild/README.md + tracker.md、明示内部工作文档）；AGENTS.md:113-114 Documentation 节 2 行 docs/rebuild 指针；CHANGELOG.md 不在 df908884 改动清单（未动，符合 owner 口径）。zones.json P58（README.md）/P59（AGENTS.md）登记在案、lastReviewed=2026-08-25、注记指 T29 决策单 #14。`bun run check:zones` 实测 exit 0（`[zones] clean: 53 modified (all registered), 268 added (owned), 1014 deleted (all registered), base 5201404f`） |
| V8 | 决策批总登记 15 项逐项有结论（含补登条目 #1/#2/#10），无空白项 | 读 docs-governance.md 决策批总登记 + 补登条目 | ✅（2026-08-25 读文件实测）：docs-governance.md:467「决策批总登记」条目覆盖 #3/#4/#5/#6/#7/#8/#9/#11/#12/#13/#14/#15 共 12 项逐项一句话结论 + 落地指针（#9「维持现状」、#11「交上游」亦如实登记拍板不做）；同文件「决策批总登记补登 · #1/#2/#10」条目（append-only 另起、不改原文）补齐余下 3 项，含 owner 原话（#1「按你建议的方式改」/#2「…归档，不删除」/#10「同意建议」）+ T28 落地事实 + 报送源头指针（T27-plan §3.3 第 1/2/4 组）——15 项无空白；05 修改决策随条登记（05 自身纪律） |
| V9 | records/ append-only：git diff 确认 records/** 无既有条目删改（头部时间字段刷新除外） | `git diff HEAD~<N> -- docs/rebuild/records/` 审阅 | ✅（2026-08-25）：`git diff --ignore-cr-at-eol 08b4129a..HEAD -- docs/rebuild/records/` = 138 插入 / 2 删除（不加 `--ignore-cr-at-eol` 时的大量删除经逐行比对确认为 CRLF 行尾重流噪声，删增内容逐字相同）。2 处真实删除均在 records/_index.md：①头部状态/时间行刷新（本项骨架明示豁免）；②§1 D 编号规则表行就地改口为 Tk-Dn 新规——系决策批 #7 拍板的规则文本体修改（非记录条目删改），docs-governance.md 决策批总登记 #7 在案。narrative//topics/ 各档案全部为纯追加新条目，无既有条目删改。另：工作树当前有未提交的 ci-infra.md 纯追加 9 行（CI-15 勘误，`git diff` 实测 insertion-only），非 T29 commit 内容、append-only 形态合规，留主 agent 后续入库 |
| V10 | **远端 CI 复验（05 附录 B.3 强制）**：推送后 `gh run view <id> -R another-momo/open-pencil` 复验 conclusion | gh run list/view；run id 与 conclusion 记入本表（与 T28-verify V7 同批 run 可复用，需各自记录） | ✅（2026-08-25 独立复验，与 T28-verify V7 同批 run、本表各自记录）：`gh run view 32831596110 -R another-momo/open-pencil --json status,conclusion,headSha,headBranch` = rebuild/pi 分支、headSha `df908884e7134e2b3a71d727c22f15b267489676`（与本地 HEAD 一致）、status=completed、**conclusion=success**；`--json jobs` 14 个 job 全 success。同 SHA staging run `gh run view 32831236127`（rebuild/pi-staging）completed/success——与 CI-15 勘误记录的「staging 先行 + 受保护分支快进」推送路径互证 |

## 核验结论

**可以收口**（核验人：独立核验 subagent，非实施者；2026-08-25）——V1-V10 全 ✅：补签组/CI-14/05 规则文/Tk-Dn/tracker 归档/层 1 口径/根文档指针/决策批总登记/append-only/远端 CI 十项均经读文件 + gh api + git diff + 门禁实跑复核；远端 CI rebuild/pi run 32831596110（df908884）经 `gh run view` 独立复验 success（05 附录 B.3 口径）。

观察项（均不打回，供后续任务顺手处理）：
1. 01-target-state.md §3 修订注记内「smoke:pi 批次现状 59 断言（t22 6+t22 12+t23 14+t24 27）」已随同日先行的 T28 落地过时——现 smoke:pi 为五套件、本核验实测 80 断言（6+12+14+29+19）；该句自带核验命令（`grep '"smoke:pi"' package.json`）可复现偏差（详见 V6）。
2. 工作树现有未提交改动 docs/rebuild/records/topics/ci-infra.md（CI-15 勘误，纯追加 9 行，append-only 合规）——非 T28/T29 commit 内容，核验未触碰，留主 agent 入库。
3. tracker.md 全文 80 行贴预算顶，后续收口满一阶段即按决策批 #8 机制归档 T21+ 行（与 T29-self-check §4 自述一致）。

全程未 commit/push；本文件之外未改任何文件；未读/打印任何 key/token 值；tests/fixtures 下 LFS 文件未触碰。

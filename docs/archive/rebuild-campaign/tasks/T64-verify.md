<!--
  写作纪律（改本文前必读）：
  - 事实性声明必须附核验命令 + 日期，否则标为【假设】
  - 本文只保留当前态，不保留修正历史
  - 详细规则见 docs/rebuild/05-process.md §4
-->

# T64 核验 · CI 门禁分层：GHOST 窗口规则改 drift 雷达

> **状态**：✅ 已完成（2026-09-01 收口） | **核验人**：独立核验 agent（未参与实现）
> **核验基准**：T64-plan.md §1/§3/§4 + T64-self-check.md + check.ts/zones.json/workflow 源码；实现为工作树未提交态（`git status` 2026-09-01）
> **实测日志**（仓外）：`D:\Desktop\AgentLearn\00_DIYProjects\0720openpencil\doc\T64-verify-*.log`

## 1. 核验范围

check.ts 的 `--drift` 收编（仅 GHOST 一条、规则集合与顺序不动）、package.json 脚本接线、双模式 unpiped 实测、阴性探针（drift 报 GHOST / 静态不报该条）、upstream-drift.yml 与 ci.yml 走查、zones.json 登记、三件套事实一致性。C7 全门禁套件复跑与 CI push 绿观测超出本核验授权（只读 + 禁 commit/push），见 §3。

## 2. 逐项核验（2026-09-01 实测，除注明外命令均在仓根执行）

| # | 核验项 | 结果 | 证据 |
|---|---|---|---|
| V1 | GHOST 仅 `--drift` 执行；usage/函数头注含 T64 定谳；其余规则集合与顺序未动 | ✅ | `git diff tools/zone-registry/src/check.ts` 全 diff 仅 3 处 hunk：① usage 头注 +2 行（check.ts:29-30，`--drift`（T64：…owner 2026-09-01 拍板降为雷达，不进 push 门禁））；② checkGhostDeleted 函数头注 +5 行（check.ts:210-213，含 T63/be942783/run 33460844556 引证）；③ main 装配行 :479 改 `...(process.argv.includes('--drift') ? checkGhostDeleted(zones, base) : [])`。GHOST 在数组中的位置不变（checkDeletedAbsent 之后、checkDriftTarball 之前），规则本体 11 行 filter 逻辑零改动，无其他 hunk |
| V2 | package.json `check:zones:drift` 脚本 | ✅ | `git diff package.json` 仅 +1 行（:34 `"check:zones:drift": "bun tools/zone-registry/src/check.ts --drift"`）；聚合 `check` 脚本（:31）仍接静态 `check:zones`，分层正确 |
| V3 | 静态模式实测：exit 0 且输出无 GHOST 条 | ✅ | `bun run check:zones > …\doc\T64-verify-zones.log 2>&1; echo EXIT=$?` → EXIT=0，输出 `[zones] clean: 81 modified (all registered), 485 added (owned), 1019 deleted (all registered), 0 renamed (cross-checked), base 88c10770`，无 violation 段 |
| V4 | drift 模式实测：fetch 后 exit 0 | ✅ | `git fetch upstream master` 第 1/2 次超时（port 443 after ~21s），第 3 次成功；upstream/master = be942783（i18n 命名空间重构，T63 在案那笔）。`bun run check:zones:drift > …\doc\T64-verify-zones-drift.log 2>&1; echo EXIT=$?` → EXIT=0，clean 行同上。窗口证据：`git log --diff-filter=D --name-only 88c10770..upstream/master` 列出 15 条上游删除（含 T63 tarball 两条 + P74 的 system.ts），drift 干净 = 豁免面全部命中 |
| V5 | 阴性探针：drift 报 GHOST、静态不报该条 | ✅（分层成立） | 探针 = `git show 88c10770:scripts/visual-compare.ts > scripts/visual-compare.ts`（base 字节一致恢复；scripts/ 目录本地已删需先 mkdir）。静态 `check:zones` EXIT=1，2 violations：`DELETED path still exists` + `ADDED outside ownedRoots`——**无 GHOST 条**；drift `check:zones:drift` EXIT=1，3 violations——多出 `GHOST deleted file from upstream: scripts/visual-compare.ts still exists locally …`，且 GHOST 条位置恰在 DeletedAbsent 与 ADDED 之间，与装配顺序一致（日志 T64-verify-probe-static/drift.log）。路径选择受限分析见 §3-1 |
| V6 | 探针清理 + 工作区净度 | ✅ | `rm scripts/visual-compare.ts && rmdir scripts`；`git status --porcelain` 仅剩 T64 预期面（M ci.yml/package.json/check.ts/zones.json + ?? upstream-drift.yml/T64-plan/T64-self-check），无探针残留；复跑双模式（T64-verify-post-static/drift.log）均 EXIT=0 |
| V7 | upstream-drift.yml 走查 | ✅ | YAML 解析合法（yaml 模块 parse OK，`on` 键 = schedule + workflow_dispatch）；cron `'17 1 * * *'` 与 plan 一致；权限块仅 `contents: read + issues: write`（红线达标）；checkout 用与 ci.yml 全仓一致的 SHA pin（3d3c42e5…）+ `persist-credentials: false` + `fetch-depth: 0`；setup-bun@v2 与 ci.yml rebuild-discipline 同版；不跑 bun install 与 ci.yml 注释「Scripts use only node builtins, so no bun install is needed」口径一致；fetch upstream 两步与 ci.yml:113-116 相同；drift 步骤 `id: drift`；issue 步骤 `if: failure() && steps.drift.outcome == 'failure'` 条件正确（failure() 解锁后续步骤 + outcome 钉扎失败源是 drift 步而非 checkout/fetch）；去重逻辑 = listForRepo(state:open, per_page:100) 按标题精确匹配再 create，body 带 `${context.serverUrl}/…/actions/runs/${context.runId}` 链接与处置 SOP——与 self-check C4 声明逐字吻合 |
| V8 | ci.yml 注释位置与步骤行为未变 | ✅ | `git diff .github/workflows/ci.yml` 仅 +2 行注释（T64 分层说明 + 雷达去向），紧邻 `- name: Zone registry purity` 步骤上方；步骤本体仍 `run: bun run check:zones`（静态），job 其余部分零 diff |
| V9 | zones.json 登记 + JSON 合法 | ✅ | 结构化 JSON.parse OK；ownedFiles 末位 += `.github/workflows/upstream-drift.yml`；P32（file=.github/workflows/ci.yml）reason 扩注含「T64（2026-09-01，owner 拍板）…拆出为 --drift 子模式，进 upstream-drift.yml nightly 雷达 + 失败自动建 issue」、lastReviewed 2026-09-01、task "T64"；`task` 字段为既有惯例（23 条 patches 带此字段，grep 实测） |
| V10 | 三件套一致性 | ✅ | plan §3 验收 4 条：① 双模式 exit 0 = V3/V4；② 阴性探针 = V5/V6；③ zones 登记带 T64 指针 = V9，「CI push 绿」待提交后观测（§3-6）；④ YAML 合法人工核 = V7。self-check C1-C6 与实测逐条吻合；C2 数字 483 与实测 485 差 2 属任务文档落盘时序（§3-2），非事实错误 |

## 3. 非阻塞问题与边界

1. **零静态污染的探针路径在当前登记态不存在**（核验指令设想的理想探针不可得，已绕行）：窗口内 15 条上游删除路径逐一分类（base=Y 实测 + zones.json 结构化扫描）——2 条被 T63 tarball 豁免、1 条（system.ts）挂 P74 patch 豁免、其余 12 条全部在 `deletedPaths`。重建任一非豁免路径必触发静态规则（untracked→`checkAdded` + 在 deletedPaths→`checkDeletedAbsent`）；gitignore 面（`git check-ignore` 实测 7 候选全 not-ignored）与 ownedRoots 面（GHOST 自身豁免）均无候选。故探针只能选「静态报 2 条非 GHOST 违例」的路径——这两条是静态规则对「复活已登记删除文件」的**正确**报警，不影响分层判定：GHOST 条仅出现于 drift 输出（V5）。
2. **自检 C2 的「483 added」与实测 485 漂移**：差 2 = 自检填报后落盘的 T64-self-check.md 等任务文档落入 owned 计数（本文写入后还会 +1）；T63 轮有同款 +2 现象（T63-verify §3）。退出码语义不变，非回退。
3. **actions/github-script@v7 未按 SHA pin**：与仓内惯例一致（ci.yml 亦用 oven-sh/setup-bun@v2、actions/setup-node@v4 tag；仅 checkout 全仓 SHA pin）。若后续统一升 pin 纪律，本文件随行即可。
4. **issue 去重两个边界**：`listForRepo` 的 issues API 返回含 PR（同标题 open PR 也会命中去重）；per_page=100 只扫首页。仓规模下实际无影响。
5. **去重命中日志文案** `drift issue already open — skip dedupe` 语义微瑕（实际行为 = 去重命中、跳过创建），cosmetic。
6. **未核项**：C7 全门禁套件（rebuild 236/236、smoke:pi 19/19、lint/typecheck 等）未在本轮复跑（授权仅只读核验 + 探针）；「CI push 绿」与雷达 workflow 的绿/红路径 GitHub 实证，均需提交推送后观测（cron 下次触发或 workflow_dispatch 手动跑）——与 T63 轮同例。

## 4. 总结论

**PASS**（V1-V10 全绿）：GHOST 收编 `--drift` 旗标本体与接线正确，双模式实测与阴性探针钉死分层语义（GHOST 条仅 drift 出现），雷达 workflow 结构/权限/去重/触发条件走查无缺陷，ci.yml 行为零变更，zones.json 登记合规带 T64 指针。收口余量仅 §3 所列非阻塞项（CI 复绿与雷达实证待 push 后观测）。

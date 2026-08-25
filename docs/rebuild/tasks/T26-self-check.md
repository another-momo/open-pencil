<!--
  写作纪律（改本文前必读）：
  - 事实性声明必须附核验命令 + 日期，否则标为【假设】
  - 本文只保留当前态，不保留修正历史
  - 详细规则见 docs/rebuild/05-process.md §4
-->

# tasks/T26-self-check.md · T26 自查记录

> **T 编号**：T26（Phase 1 收口后整改 · 文档叙事面）
> **状态**：✅ 已收口（C1-C7 全过，C8 远端 CI 待推送后回填；独立核验见 [T26-verify.md](T26-verify.md)）

## 1. 处置实录（交办清单 43 条全闭环）

### 1.1 T22 假绿止损（C1）

- 实证：`gh run view 32687026233 -R another-momo/open-pencil --json conclusion` = failure；32687981729 同；失败步骤 = Code quality「Verify formatting」（gh api jobs 复验，2026-08-25）
- 更正落点：tracker.md T22 行（实录）、tasks/_index.md T22 行、T22-self-check.md 头部（更正记录行保留原始错误说明）、records/narrative/tracker.md 末尾勘误段（append-only，旧条目不动）、records/topics/ci-infra.md CI-12 完整实录（含 commit a52add36 message 不可改声明）、T22-verify.md 末尾「更正补记」（V1-V6 缺远端 CI 复验项教训）
- 规则堵漏：05-process.md 附录 B.3 新增「verify 必须含 `gh run view <id>` 复验远端 CI 结论，缺失即打回」+ records/narrative/05-process.md 对应注记

### 1.2 阶段门与 tracker 治理（C2）

- 阶段门表：Phase 1 行改实录（spike T11-T13 ✅ + X 线 D24 搁置 + pi 线 T18-T25 ✅）；Phase 2 行改 🔄（F0.1-F0.6 已建成，仅余 F0.3② 生图凭证）；「能力契约测试绿」无定义判据改写（grep 全仓零命中实证）；表上加注重排原因一行；验收签字栏不动
- tracker 头部时间 2026-08-25；narrative 计数 13→15（`find docs/rebuild/records/narrative -type f | wc -l` = 15 实测）；两处死链 `../records/_index.md` 修正
- T11 行 🔶→✅（图例本无 🔶 定义；活模型面补跑由 T18 承担，行内注明）

### 1.3 决策表同步（C3）

- 01 §6：表头错误指针（「集中登记于 tracker.md §1」）改 records/topics/ 档案指针；增状态/登记档案两列；D2（2026-08-20 owner 拍 B 默认）、D7（=D24）标注已拍板；D3/D5 标注「已事实落地（T22/T23、T24），待 owner 补签」；D1/D4/D6/D8 保持 open
- 01 §2 F0 表处置列全量刷新（每格附 task 指针）；:31 断裂锚点（`#27-dsh-集成形态` 不存在）改指 03 §5；§3 层 1 验收「16 文件」加【口径失效待重建】标注（`find tests/engine/rebuild -type f` 仅 1 文件实测，语义不改待 owner）；§8 人日数字加【假设】
- 03 回血：§0 宣告 D24 终局；§5 标题去「待 owner 拍板」+ §5.1 拍板结论行；§6 索引错误指针改 agent-runtime.md；:114 风险段与 :96 勘误矛盾联动修正；:207 裸引用补全；constants.ts 行号 :347→:359（grep 实证）
- records/topics append 状态更新：agent-runtime.md（D9 闭环=D22/D24、D7 闭环=D24、全局 D 注册表 D24 后停更现象记录）、chat-ui.md（D5 事实落地待补签）、docs-governance.md（D11 补登记消解悬空指针 + D16 前提过期 + 冻结期提案状态）

### 1.4 腐烂清扫（C4）

- README：基线 rebuild/pi + upstream@5201404f（`git merge-base` 实测）；≤50→≤80；第一层表补 tasks/ 与 proposals/ 入口两行
- 05:78 ≤50→≤80 同步；05:150「三处实锤」→「五处」（00 §5 实列 5 条、README「五处」互证）
- 02 §3.3 pending-reclass 清单重写为当前态（对照 zones.json 实测；providers//models/ 已删条目移除）；§3.4 两缝补【决策】标注；02/04 头部时间刷新（T09 修正后停滞）
- _index.md：§2 补 runbook-github-push 与 proposals 行、计数 15；§3 类型列修正（D5 → chat-ui.md；agent-runtime 延至 D24）
- ci-infra.md CI-13：T11-T25 窗口 CI run 总账补录（T10-T20 十个收口 run 逐 id `gh run view` 复验 success；T21-T25 窗口经 `gh run list` 核实）
- T24-plan 头部 🔄→✅；T24-verify 末尾更正注记（总结论 D1-D9→D1-D8 越界）；T21-verify 末尾补录第二轮红 run 32655585170（c7a0a44c，gh 溯源）
- 裸 § 引用：05 自身 4 处 + 01/02/03/04/tracker 各处在修正中一并补齐文件名
- 00-05/README/tracker/_index 头部时间全部刷新 2026-08-25（git log -1 --format=%cs 逐文件对账）

### 1.5 证伪（C5，每条附证据）

| 发现 | 证伪证据 |
|---|---|
| minimax「T25 self-check ✅ vs verify 待核验错位」 | 时效性误报——T25-verify.md 磁盘态已 ✅（V1-V6 全过，2026-08-24 独立 subagent 执行），审计基线早于回填 |
| minimax「层 1 端到端未达成=Phase 1 缺陷」 | 口径错位——01 §3/§7 层 1 属 parity 线前独立层，Phase 1 出口 = runtime spike（已收口） |
| minimax「AGENTS.md 仍有 mini-max 错误」 | AGENTS.md 是上游 follow 区文件，不属重建仓处置范围 |
| governance review L4「pre-0 验收待 owner 挂起」 | 真实待签状态，非腐烂（签字栏原样保留） |
| governance review L5「00 brand config 303 行实为 243」 | 反证——`git show a1c33881:.../config.yaml \| wc -l` 与 `git show 5d38aa4e:...` 均 = 303，00 原文成立、review 的 243 不成立（证伪注记追加在 records/narrative/00-why-rebuild.md） |

### 1.6 报送 owner（C6，只核实不动笔）

1. D 编号体系整改（task 局部 D1-Dn 与全局撞名检索歧义；建议 Tk-Dn 限定名，回改范围 ≈ T18-T25 八个 task 三件套）
2. tracker 行数治理（现 89 行 > ≤80 预算；建议已收口任务归档 tasks/_index.md）
3. 层 1 验收口径重建（16 文件宿主已随 T10 消失）
4. §4.1 三态分标大面积补标（工作量待评估）
5. §4.3 状态词汇表扩展（「已建立」25+ 文件：合法化 or 批量改值）
6. 补签组：D3/D5（事实落地）、D16（前提消解形式关闭）、治理冻结期提案
7. 根级 README/AGENTS/CHANGELOG 与 rebuild 文档串联（follow 区，改=patch）
8. upstream 双周合并 SOP 写入 05 §3.3（现仅月合并口径）

## 2. 门禁实录（C7，2026-08-25）

- `bun run check:docs` → 39/39 通过（R1-R5）
- `bun run check:bindings` → 绿（60 文件变更，含 T27 同批代码文件）
- records append-only 纪律：本任务对 records/ 的全部改动为末尾追加（git diff 可复核零删除既有内容行——个别表行内文字修正除外：_index.md §2/§3 是活索引表非档案条目，tracker.md 等核心叙事为活文档原地改写，纪律允许）

## 3. 已知边界

1. T22 假绿的 commit message 面（a52add36）不可改——以 CI-12 勘误声明替代
2. 05 附录 B.3 新规则按 05 自身纪律应在 docs-governance.md 登记决策——已以状态更新条目记入（C13 同批）；若 owner 要求独立 D 编号，收口后补登
3. 头部时间刷新覆盖本次被改文件；未被改的历史 tasks/ 文件保持原时间（纪律只要求「改完刷新」）

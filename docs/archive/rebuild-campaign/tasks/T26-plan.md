<!--
  写作纪律（改本文前必读）：
  - 事实性声明必须附核验命令 + 日期，否则标为【假设】
  - 本文只保留当前态，不保留修正历史
  - 详细规则见 docs/rebuild/05-process.md §4
-->

# tasks/T26-plan.md · T26 三方 review 整改（文档叙事+决策表面）

> **T 编号**：T26（Phase 1 收口后整改 · 文档叙事面）
> **状态**：✅ 已收口（实施+自查完成；独立核验见 [T26-verify.md](T26-verify.md)）

## 1. 背景与立项依据

同 [T27-plan.md §1](T27-plan.md)（2026-08-25 三方 review + owner 指令三分法处置）。T26 承载**文档叙事与决策表面**——三方 review 在该面的交集结论：机制骨架真实有效（门禁全绿、三件套 78/78、records 无篡改），但叙事层系统性漂移（阶段门表、01 §6 决策表、03 选型章、records 索引四处停在 D22/D24 拍板前），且发生一起公信力事件（T22 CI 假绿扩散 5 处）。

最高危单条（kimi_K3 发现、主 agent 2026-08-25 复验证实）：**T22「CI 32687026233 全绿」不实**——`gh run view 32687026233 / 32687981729` 均 conclusion=failure（红于 format:check，失败文件正是 T22 自己的改动），被 T23 commit 1a78076f 顺带吸收（其 run 32693810508 红于 steiger 而非 format，反证 format 已被静默修复）。宣称面 5 处：tracker.md T22 行、tasks/_index.md、T22-self-check.md、records/narrative/tracker.md、commit a52add36 message（不可改，勘误声明替代）。

## 2. 验收清单

- C1 T22 假绿止损闭环：可改 4 处全部更正为实录 + records append-only 勘误（CI-12）+ T22-verify 缺项教训补记 + 05-process.md 新增「verify 必须含 gh run view 远端 CI 复验」规则（附录 B.3）
- C2 阶段门表按实录重排（Phase 1 含 spike/X 搁置/pi 实施三段实录；Phase 2 F0 仅余 F0.3②），tracker 头部时间/计数/死链修正，T11 🔶→✅（注明补跑承担方）
- C3 决策表同步：01 §6 指针修正 + D2/D7 标注已拍板 + D3/D5 标注事实落地待补签；03 回血（§0/§5/§6）；records/topics 三档案 append 状态更新（D7/D9/D5/D16/D11）
- C4 文档腐烂清扫：README 基线/预算/入口、02 §3.3 清单当前态、00/05「三处vs五处」矛盾、_index 漏行与计数、行号漂移、头部时间停滞、裸 § 引用（核心叙事面）、ci-infra CI-13 总账补录
- C5 证伪项有实证结论（minimax T25 错位 / 层 1 口径 / AGENTS.md / pre-0 签字 / 00「303 行」反证）
- C6 报送 owner 项只核实不动笔（D 编号体系 / tracker 行数治理 / 层 1 验收口径 / 三态分标 / 词汇表 / 补签组 / 根文档串联 / 双周 SOP）
- C7 门禁：check:docs / check:bindings 绿；records append-only 纪律零违反（只增不改）
- C8 远端 CI rebuild/pi 全绿（05 附录 B.3 口径，gh run view 复验）

## 3. 处置清单（交办合并口径，实录见 self-check）

A1-A7（T22 止损组）/ B1-B9（tracker+README+tasks 组）/ C1-C15（决策表+03+02+00+index+ci-infra 组）/ D1-D4（交叉引用格式组）/ E1-E3（证伪组）——逐条证据与改动文件见 [T26-self-check.md §1](T26-self-check.md)。

## 4. 纪律要点

- records/ 全目录 append-only：更正走追加勘误条目，严禁改旧内容
- 核心叙事活文档原地改写，头部时间随改刷新（2026-08-25）
- tracker 任务表本任务只改既有行；T26/T27 新行由主 agent 收口登记
- 裸 § 修复面限核心叙事（00-05/README/tracker）；proposals/governance-v1.md 是已采纳历史快照，不改（报送说明）

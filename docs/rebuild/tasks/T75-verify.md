# T75 核验 · 整体 review 合并 + 选择性优化落地

> 日期：2026-09-02。独立核验 subagent（只读 + 仅写本文件；未改动任何实现/文档文件；git 仅读操作 status/diff/branch）。
> 材料：T75-plan.md（落地清单 + 不做清单）、T75-self-check.md（自检申报）。
> 改动面：A = docs/rebuild/records/review-2026-09-01-{code-review,research-adjudication}.md（新）；B = 父仓 doc/ 六处文本修正（非 git 仓）；C = T66-verify.md §10 措辞、internal-visibility.test.ts 第 5 例、setup-catalog.ts:9-12 注释。

## 逐项核验

| 项 | 结论 | 证据 |
| --- | --- | --- |
| V1 B 组六处逐条读回 | PASS | 逐条 grep 实证（父仓 `doc/`，工作目录 `D:/Desktop/AgentLearn/00_DIYProjects/0720openpencil/doc`）：① `grep -n "2026-09-02 状态回写" base-candidate-list.md` → :14 命中，段内明写「实际归宿 = studio/workflows/longform.md 通用纪律第 2 则……**不是** base.md」✓；② `grep -n "2026-09-02 补注" t67-marketing-prompt-mining.md` → :7 命中，含「**物理删除**」+ 迁移归宿（longform.md 通用纪律第 1/2 则 + base-candidate-list #1）✓；③ `grep -n "已随 T67 退役物理删除" S2-asset-files-spec.md` → :58 命中（补注嵌于原句括号内，「句作历史批评留存」在文）✓；④ `grep -n "分流定稿" S2-asset-files-spec.md` → :133 命中，段首「**marketing prompt 静态段分流定稿**（2026-09-01 T67 完工……本行原写『随 W3 T-C1 执行』，2026-09-02 T75 按完工事实改写）」✓；⑤ `grep -n "✅ 已闭合" S4-phase3-plan.md` → :122 命中，T53 行 ~~删除线~~ + ✅ 已闭合（2026-09-02 T75 清理）✓；⑥ `grep -n "销账" T-C-survey-20260901.md` → :23（§3 节首）与 :32（§4 节首）各一条「2026-09-02 销账注记……保留仅为历史追溯，**不是待办**」✓。六条行号与自检申报逐字一致。 |
| V2 S4:122 闭合事实基础 | PASS | 独立 grep 仓内码：`grep -n "__confirmedNewIntent" src/app/ai/pi-backend/tools.ts` → :207 `if (setupDesign.newIntentConfirmed()) extra.__confirmedNewIntent = 'true'`——catalog 外层注入真实存在；`grep -n "intentConfirmed" src/app/ai/pi-backend/active-design-host.ts` → :331 `let intentConfirmed = false`、:374 `newIntentConfirmed: () => intentConfirmed`、:385 回合开始清零、:389 prepareTurn 剥信封分支置真（`stripNewIntentEnvelope` 命中即 true），:403 finalizeTurn 复位——信封置真链路完整（读 :325-407 确认控制流：信封永不跨回合滞留）。自检引用行号 331/374/389 全部属实。 |
| V3 T66-verify §10 措辞 | PASS | `grep -n "字面零交叉\|非 B 跨界" docs/rebuild/tasks/T66-verify.md` → :27（§10 跨项一致性行）命中，新措辞「A（面板）↔B（history）**字面**零交叉……那是 A 自身职责，**非 B 跨界**，2026-09-02 T75 按 review P2-03 澄清措辞」在案；git diff 证实该文件仅此一行改动（2 行 +-，1 行替换）。 |
| V4 两目录测试 | PASS | unpiped 复跑 `bun test tests/engine/rebuild/image-gen/ tests/engine/rebuild/pi-backend/` → **134 pass / 0 fail / 359 expect() calls / 15 files**（2.89s），与自检申报逐字一致。分拆复跑：internal-visibility.test.ts 单跑 5/5（新第 5 例在内）；pi-backend/ 目录 40/40——「40/40 回归无损」申报属实。未跑全量（遵守 owner 明令）。 |
| V5 门禁（unpiped 逐个） | PASS | `bun run lint` exit 0（0 errors / 7 warnings，逐条核对均为既有 max-lines：scene-graph/types.ts、core editor variants、fonts.ts、cn-catalog.ts、props-overrides.ts、compose-backdrop.ts、brief.ts——T75 触及三文件零警告）；`bun run tsgo` exit 0；`bun run format:check` exit 0（2168 files all correct）；`bun run check:zones` exit 0（clean：85 modified all registered / 552 added owned，零登记与 plan §4 边界一致）；`bun run check:i18n` exit 0（in sync）；`bun run check:docs` exit 0（44/44）。 |
| V6 新钉扎质量 | PASS | 读 internal-visibility.test.ts L51-71 第 5 例：①目录消失显式失败——L54 `expect(existsSync(cliSrc)).toBe(true)` 先于遍历，注释自述「防空转假绿」✓；②遍历覆盖嵌套——L56-63 显式栈 DFS，`entry.isDirectory()` 压栈递归，实测 packages/cli/src 含 commands/analyze、library 等嵌套子目录（30 个 .ts 文件）均被覆盖✓；③词边界——L66 `/\b(?:ALL_TOOLS\|FORK_TOOLS\|toolsToAI)\b/`，`\b` 防 `MY_ALL_TOOLS` 类前缀误命中（`_` 为词字符，下划线拼接亦不越界）✓；④offenders 形态——先收集全量再 `expect(offenders).toEqual([])`，fail 时一次报全部越界文件而非首个✓；⑤现状实证——核验员复跑 `grep -rln "ALL_TOOLS\|FORK_TOOLS\|toolsToAI" packages/cli/src/` rc=1 零命中，钉扎当前确绿✓。缺陷见补充观察 2/3（均不阻塞）。 |
| V7 git 状态 | PASS | `git status --short`（分支 rebuild/mode-arch）：`M` T66-verify.md + setup-catalog.ts + internal-visibility.test.ts 三件；`??` 两份 records 新文件 + T75-plan.md + T75-self-check.md——与申报的 A+C+三件套完全对应，无其他混入（本文件 T75-verify.md 为核验员按指令新增，属预期第 5 个 untracked）。`git diff --stat`：3 files / +38 -4；setup-catalog.ts diff 逐行确认为 comment-only（L9-12 注释块内改写，零代码行触及），「comment-only」申报属实。 |
| V8 自检一致性 | PASS | §1.B 六处：V1 已逐条读回一致；§1.B.7 profile-as-skill 零引用实质成立（src/ tools/ 零命中，命中项均为评审报告与 T75 三件套自述，见补充观察 4）；§1.C 三符号 grep 零命中复跑属实（V6⑤）；§2 门禁数字与本核验员复跑全一致（134/0/359/15、lint 0 err 7 warn、tsgo 0、format all correct、zones clean、i18n sync、docs 44/44）；§3 偏差 4 条均属实（全量弃权合 owner 明令、T73/T74 撞号登记在 plan §2、父仓非 git 仓、不做清单与 plan §2 逐条对应）。一处措辞不精确见补充观察 1，不阻塞。 |

## 补充观察（不阻塞）

- B1 注文括弧内佐证细节不精确：注称「base.md 仅 1 处工具说明（grep Composition|组合原语）」，核验员复跑该 grep 对 base.md **零命中**（仓内 base.md 全无一处 Composition/组合原语字样；最相近者为 :112「Fill color / gradient → set_fill」工具路由行，不含被引关键字）。实质主张成立——组合原语纪律本体确在 longform.md 通用纪律第 2 则（:22 正文 + :83 交叉引用两命中），base.md 确未承载该纪律；仅括弧内「1 处」计数与所述命令不符。
- 钉扎扩展名覆盖：第 5 例只扫 `.ts`（L64 `endsWith('.ts')`）。当前 packages/cli/src 实测 100% .ts（30 文件），无漏面；但若未来 CLI 引入 .tsx/.mts/.vue 消费面，钉扎不覆盖。属可接受的现状钉扎，非缺陷性假绿。
- 钉扎为纯文本正则：CLI 文件注释/字符串中出现三符号字面亦会 fail。对「防静默外泄」的保守钉扎而言方向正确（宁可误报），仅记录语义。
- §1.B.7「grep 零命中（2026-09-02）」字面不复现：核验员同命令复跑命中 13 行，全部位于 review-2026-09-01-research-adjudication.md（7 行）+ T75-self-check.md（2 行）+ T75-plan.md（1 行）等评审/T75 自述文档；src/、tools/ 及其余 docs/ 零命中。「零实质引用（除评审档案自述外）」成立，「零命中」措辞不精确；profile-as-skill-proposal.md 文件本身仓内仓外不存在（裁决 §5.1 的更广 grep 佐证）。
- lint 两阶段输出：lint:structure + 主 lint 合并输出中 max-lines 警告首屏显示 9 条（含 tests/ 两文件），主 lint 阶段（1421 files）为 7 条，均既有文件；自检取后者，与 T74-verify 口径一致。

## 总结论

**PASS（8/8）**——B 组六处父仓修正逐条 grep 读回命中且行号与申报一致；S4:122 闭合的码上事实基础（tools.ts:207 外层注入 + active-design-host.ts intentConfirmed 信封链路）独立复核成立；T66-verify §10 新措辞在案；两目录测试 134/0/359/15 与门禁六连绿全部复跑一致；新反向钉扎质量合格（显式失败/嵌套遍历/词边界/全量 offenders 四要点齐备）；git 状态纯净无混入；自检申报与实测一致。

## 阻塞项清单

无。补充观察 5 条均为措辞不精确或未来扩展面提示，不构成本任务阻塞。

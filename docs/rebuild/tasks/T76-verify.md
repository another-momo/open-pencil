# T76 核验 · S4 §7 尾巴清单刷新（T-E1 可离线部分）

> 日期：2026-09-02。独立核验 subagent（只读；唯一写入 = 本文件；git 仅读操作 status）。
> 材料：T76-plan.md（审计结论 + 落地行）、T76-self-check.md（自检申报）。
> 交付面：父仓 `D:\Desktop\AgentLearn\00_DIYProjects\0720openpencil\doc\S4-phase3-plan.md` §7 尾巴表（父仓非 git 仓，L100-140 共 41 行表行）——4 行闭合（L124/L128/L130/L133）+ 1 行进展注记（L114）+ 6 行新登记（L135-140）。

## 逐项核验

| 项 | 结论 | 证据 |
|---|---|---|
| V1① active_design 事件④闭合 | PASS | S4 L128 行文本 = `~~**active_design 事件④绑定口径**~~` + `✅ 已闭合（2026-09-02 T76 刷新，随 T-B9/T60 落地）`，删除线与标记在案。码上独立复核（src/app/ai/pi-backend/active-design-host.ts）：`formDesignByFormId` 恰在 **:334**（Map 声明）、`observeToolExecution` 表单挂起时记 formId→槽位恰在 **:378**（`formDesignByFormId.set(details.formId, currentSlotNodeId)`，:375 为实现体、:319 为接口声明）、`resolveFormAnswer` 恰在 **:345**（定义）与 **:395**（prepareTurn 内调用）——四个行号与行述逐字吻合。机制语义复核（:330-400 通读）：宿主侧 Map 按 formId 相关性推导 + `probeCandidate`/`isFormTargetStillValid` 合法性校验后 `moveSlot`，作答解析走 `parseAskAnswer(text)`——「宿主按 run 上下文 + formId 相关性推导，工具签名不加字段」在码中成立。 |
| V1② prompt-overlay/modes.ts 闭合 | PASS | S4 L124 行文本 = `~~**prompt-overlay.ts / modes.ts 的 T24 旧双模式遗留**~~` + `✅ 已闭合（2026-09-02 T76 刷新）`，删除线在案。码上复核：prompt-overlay.ts（实际位于 src/app/ai/pi-backend/）头注 :5-6 自述「T62：material types 段整段 + T24 遗留（setup_material_type fallback 文案）一并删除——type 机制退役后 overlay 仅余 profile 段」在案；`find src packages -name modes.ts` 全仓零命中（`ls src/app/ai/chat/` = failure/provider-models/system-prompt/transports/use 五件，确无 modes.ts）；`grep -rn setup_material_type src/ packages/core/src --include="*.ts"` 唯一命中 = prompt-overlay.ts:5 头注自述，零活引用。 |
| V1③ GHOST/T64 闭合 | PASS | S4 L130 行文本 = `~~**GHOST 窗口规则分层**~~` + `✅ 已闭合（2026-09-02 T76 刷新，T64 落地在案）`。码上复核：`.github/workflows/upstream-drift.yml` **:8-9** = `schedule:` + `- cron: '17 1 * * *'`（与自检申报行号逐字吻合）；文件头注 :1-4 明述分层口径（push 门禁 ci.yml 只跑静态规则、drift 改 nightly 巡检 + 自动建 issue）；tracker.md L75 T64 行 = ✅ 已完成（2026-09-01 收口），「check:zones 拆静态规则（push gate 保留）+ drift 子模式进 nightly schedule workflow」与 S4 行述一致。 |
| V1④ image_gen 可见性/T72 闭合 | PASS | S4 L133 行文本 = `~~**image_gen_begin/commit 对 AI 可见性**~~` + `✅ 已闭合（2026-09-01 T72…方案 A）…internal-visibility.test.ts 5 例钉扎（含 T75 新增 CLI 反向钉扎）`。独立复跑（仅本文件，未全量）：`bun test tests/engine/rebuild/image-gen/internal-visibility.test.ts` → **5 pass / 0 fail / 10 expects**，五例标题逐条对应「internal 标记机器可读 / agent 工具集不透出 / ALL_TOOLS 保留桥分发面 / 全仓 internal 清单=已知两件 / CLI 包不直接消费（T75 反向钉扎）」——与行述「agent/MCP 双面过滤 + 桥执行面保留 + 5 例钉扎」一致。 |
| V2 进展注记行 | PASS | S4 L114 行 = `**进展（2026-09-02 T76 刷新）**：组装侧已改读注册表 base（active-design-host.ts:114 registry.base?.body…）…退役半项未执行——t46-base-fidelity.mjs 仍钉双源逐字一致，退役=删文件+退该核验脚本，需 owner 裁决`。码上复核：active-design-host.ts **:114** 恰为 `const base = registry.base?.body ?? ''`；`grep -rn "system-prompt-base" src/ --include="*.ts"` exit 1 零运行时引用；tools/rebuild/src/verify/t46-base-fidelity.mjs（74 行）仍钉双源逐字一致——头注 :2-14 明述等式 `strip(base.md) === strip(system-prompt-base.md)`，:55-60 断言 frontmatter id=base + 双源头注两文各一。未闭合性质（退役待裁决）与行述相符，行首无删除线。 |
| V3 六行新登记 | PASS | S4 L135-140 六行全部 grep 读回，行内标注与来源逐条核对一致：①L135 v3 derive_palette 死链标「2026-09-02 代码评审 P1-02」——评审档 docs/rebuild/records/review-2026-09-01-code-review.md L49 P1-02 在案，且独立重跑 `grep -n derive_palette watercolor_poster_v3.md` 命中 **:18/:26/:38/:48** 与行述逐字吻合，「T69-plan §3 显式列入不做清单」亦在评审档实证；②L136 abort 长 HTTP 标「评审 P2-01」——评审档 L65 在案（service.abort 只置信号 / 240s / generate.ts signal 透传建议字字对应）；③L137 routes 4xx 标「评审 P2-02」——评审档 L72 在案（'Method Not Allowed' 等英文硬编 + fork i18n 脱节 + 错误码抽常量/前端转译建议对应）；④L138 桥 /health 假阳性标「T73 残余观察 A，T73-plan §4」——T73-plan L31 残余观察 A 在案（/health 仍报 ok、reload 自愈、browserWs+registered 不代表应用层活性）；⑤L139 不可见 store 标「T73 残余观察 B」——T73-plan L32 在案（9 次 Create Shape 0:221 族 vs 可见图 0:2 族为空），行内「疑同源」推断与「2026-09-02 T73 钱测 12 圆正常」反例均如实标注；⑥L140 res.on('close') 标「T73 根因」——T73-plan L13 根因段在案（vite proxy close 语义不可靠），「已由带外取消通道补位（双通道幂等）」与 T73-plan L17-18（cancel 端点 + fire-and-forget、幂等 no-op）一致。 |
| V4 未闭合行完整性 | PASS | 父仓非 git 仓无法 diff，改为语义抽查六行：web 资产兜底（L105「分发形态讨论（不阻塞 Phase 3）」）、multi-segment（L107「拓展批…单段版随首发精品验证后再裁决」）、casual_v1（L119「拓展批…首发精品做透后再裁决」）、MCP-headless catalog（L123「后续任务立项（不阻塞 Phase 3 闭环）」）、look elision（L132「归属与时机待 owner 指认（建议 W4 冒烟前）」）、T59 观察项（L134「三项均低严重度不阻断；专测补齐挂 W3 稳定化批或下次触碰 tool-handlers.ts 时」）——六行原指认时机语义完整保留，均无删除线、无 ✅ 闭合标记，与自检 §3.2「原文不动」申报一致。 |
| V5 仓内门禁 | PASS（附注） | `bun run check:docs`（unpiped）→ **44/44 通过**；`bun run check:zones`（unpiped）→ **clean**（85 modified all registered / 555 added owned / 1019 deleted all registered / 0 renamed）。`git status --short` 仅 `?? docs/rebuild/tasks/T76-plan.md` + `?? docs/rebuild/tasks/T76-self-check.md`（+ 本核验文件），零代码改动、零越界文件。**附注**：tracker.md 与 tasks/_index.md 尚无 T76 行（grep T76 零命中）——按核验指令「若 tracker 行尚未加则说明，不算 FAIL」，在案说明。 |
| V6 自检申报一致性 | PASS | T76-self-check.md 逐条对实测：§1.1 行号 :334/:378/:345/:395 全中；§1.2 prompt-overlay.ts:5-6 头注、ls 无 modes.ts、grep 仅头注命中全中；§1.3 upstream-drift.yml:8-9 cron 全中、T64 ✅ 在 tracker 全中；§1.4「2026-09-02 复跑 5/5 绿」与本核验员复跑一致；§1.5 :114 registry.base?.body、零 system-prompt-base 引用、t46-base-fidelity.mjs 仍钉双源（申报 :2-58，实文件 74 行、钉扎逻辑覆盖该区间至 :60 的双源头注断言）全中；§2 门禁 44/44 + zones clean 与实测逐字一致；§3 偏差三条均属实（T-E1 未完全收口 / 未闭合行原文不动抽查六行成立 / 新登记第 10 行「疑同源」推断成分已在 S4 L139 行内明示并附反例）。 |

## 补充观察（不阻塞）

- **路径措辞小偏差**：plan/self-check/S4 L124 均以 `src/app/ai/chat/` 为 ls 取证目录，而 prompt-overlay.ts 与 active-design-host.ts 实际位于 `src/app/ai/pi-backend/`。实质结论不受影响——modes.ts 经 `find src packages` 全仓零命中（不止 chat 目录），setup_material_type 全仓仅头注一命中；仅行内取证路径的目录名与文件实际所在目录不一致，建议下次触碰该行时顺手修正。
- **§7 表格被空行断开**：S4 L131 为空白行，使 Markdown 表在 L130（GHOST 行）后断裂，L132-140（look elision 起，含六行新登记）成为无表头的第二段表。grep 读回不受影响；渲染面为既有瑕疵，父仓非 git 无法判定是否 T76 引入。
- **L133（image_gen 可见性）闭合日期为 2026-09-01 T72**：该行本已在 T72 闭合，T76 对其做的是措辞刷新（补「含 T75 新增 CLI 反向钉扎」），计为四行闭合之一与 plan §1 口径一致；其余三行（L124/L128/L130）均带「2026-09-02 T76 刷新」字样。
- tracker/_index 的 T76 行缺位已按指令在 V5 附注说明，不计 FAIL。

## 阻塞项清单

无阻塞项。遗留说明两项（均不阻塞）：①tracker.md / tasks/_index.md 的 T76 登记行尚未添加；②父仓 S4 非 git 仓，本任务改动无法以 git diff 留痕，V4 完整性以语义抽查代替。

## 总结论

**PASS（6/6）**——四行闭合（行号逐字吻合 + 测试 5/5 复跑绿）、一行进展注记（双源现状与退役卡点如实）、六行新登记（来源标注与评审档/T73-plan 逐条对得上）、未闭合行原文完整、仓内门禁双绿、自检申报零虚报。

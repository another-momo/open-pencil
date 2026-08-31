<!--
  写作纪律（改本文前必读）：
  - 事实性声明必须附核验命令 + 日期，否则标为【假设】
  - 计划被实测推翻时，直接改本文为新版本，完整理由记入 records/ 子文档
  - 本文只保留当前态，不保留修正历史
  - 改完后刷新本文头部的「状态」字段
  - 详细规则见 docs/rebuild/05-process.md §4
-->

# T49 计划 · base 红线补洞段及机制撤除（过度工程）+ S1 §7 层归属修正与过严原则删除

> **状态**：✅ 已完成 | **时间**：2026-08-31 立项 / 2026-08-31 收口 | **负责人**：主 agent（实现段派 subagent 执行）
> **分支**：`rebuild/mode-arch`（worktree `open-pencil-mode`；T48 收口 c65991bc 之后）
> **规格真源**：owner 指令（2026-08-31，本会话第三轮）：「#2 base 补洞的内容和相关机制我觉得都是过度工程，请去掉」「#3 S1 §7 层归属很多都是错误的，大量的职责都压到 base 中了，实际上很多都应该是宿主层的内容；而文案/内容/事实上的原则要求过严过细……强事实则弱创意，属于后期的产品打磨阶段要考虑的 workflow 效果层面的事情，不属于安全纪律，请从文档拿掉」

## 1. 背景与立项

T46 按 PD-20① 给 base.md 加了「Trust & Safety Discipline (MANDATORY)」补洞段（四红线 + 修辞事实标注，含 begin/end 标记块 + 构建器 SECTION 常量 + 保真核验 BLOCK_RE 剥除链 + 钉扎测试两条断言的配套机制）。owner 复核判定：**补洞内容与配套机制均为过度工程**——红线的执行本体应是宿主确定性逻辑（checkpoint/确认表单/undo 合并/快照留存都是产品代码行为），不该以显式纪律段压进 prompt base；文案/事实类原则（事实零虚构细则、修辞事实标注）过严过细，「强事实则弱创意」，属后期产品打磨阶段的 workflow 效果层事项，不属安全纪律。

本任务 = 同一决策的两面：**代码面撤除**（base.md 回归纯转写，机制拆除）+ **规格面修正**（S1 §7 层归属改宿主、删过严原则行）。

## 2. 决策点（本任务开工前拍板/默认项登记）

- **D-a base.md = 纯转写**：撤除补洞段后 base.md = frontmatter（`id: base`）+ T46 双源头注 + system-prompt-base.md 119 行逐字转写。构建器保留（转写保真纪律不动），删 SECTION/BEGIN/END 追加逻辑；头注文案同步去「补洞段/剥标记块」表述。
- **D-b 保真核验链简化**：verify-t46-base-fidelity.mjs 删 BLOCK_RE 及补洞段相关检查行，strip 链 = frontmatter + 头注注释行 + 前导注释块；检查项数按实际调整（如实记录）。
- **D-c 钉扎测试撤两条**：studio-builtin-assets.test.ts 删「红线补洞段钉扎」两条 expect 与注释，docstring 的 T46 段注记同步。
- **D-d S1 §7 目标形态**：删三行（事实零虚构 #3 / AI 可写文案 PD-8 / 修辞事实标注 PD-20①）；层归属改宿主：红线 #2（CP 确认流/成本提示/确认表单）、#5（覆盖快照 = generate_image 内置行为）、#6（undo burst 合并）、#7（持久化/pluginData/session 绑定）、#10（不弹面板 = 宿主 UI 行为）；#1 保持 base+宿主、#8 改宿主，但两者 base 侧标注「base 侧候选随 PD-20 触发式 base 重新设计评估」（因 T49 后 base.md 不再承载显式红线段）；节首层归属引言补记本决策；§8 不做清单「base 重新设计」行的守卫「红线补洞现在做」改为「红线补洞已按 owner 2026-08-31 指令撤销（T49）」；附录索引「§3/§7 修辞事实标注」行同步标注撤销。
- **D-e S4 文档同步**（仓外 doc/S4-phase3-plan.md）：§3 前置工程批「base v0 红线补洞」行、§4 T-A5 行去补洞口径；T-C1/T-C2 的「修辞事实标注」工作项标注「随 owner 2026-08-31 决策转出安全纪律，是否作为 workflow 效果层内容后期打磨再评」；§7 双源收编行去「补洞段」表述；版本线加 v4 记录。
- **D-f 历史文档不改写**：T46/T47 三件套各加「⚠ 当前态修正（T49）」指针行（补洞段已撤除，相关段落为历史记录），正文不动（治理惯例）；tracker/_index 历史行不改。
- **D-g 不碰转写源**：system-prompt-base.md 正文不动（T24 移植形态），仅其 T46 互指头注的「剥标记块」措辞随核验链简化同步修订。

## 3. 范围与修法

1. `tools/rebuild/build-t46-base.mjs`：删补洞段常量与追加逻辑 + docstring/头注改写 → 重建 `src/app/ai/pi-backend/studio/base.md`（幂等复跑零 diff）。
2. `tools/rebuild/verify-t46-base-fidelity.mjs`：删 BLOCK_RE 与补洞检查行 → 复跑全绿。
3. `tests/engine/rebuild/studio-builtin-assets.test.ts`：删两条钉扎 + 注释/docstring 同步 → `bun test tests/engine/rebuild/` 全绿。
4. `src/app/ai/pi-backend/prompts/system-prompt-base.md` 头注措辞修订。
5. T46/T47 三件套指针行 ×6；tracker/_index T49 行。
6. 仓外：S1 §7/§8/附录修订 + S4 五处同步（D-e）。
7. 实证：九项门禁 + rebuild 测试 + T24 冒烟 30/30 + 保真核验 + 全量回归对照 T48 基线 76 fail/2661。

## 4. 验收标准

- **C1 base.md 纯转写**：`grep -c "Trust & Safety" src/app/ai/pi-backend/studio/base.md` = 0；`node tools/rebuild/verify-t46-base-fidelity.mjs` 全绿（剥除链无 BLOCK_RE）；构建器两跑幂等。
- **C2 机制零残留**：`grep -rn "补洞\|Trust & Safety\|修辞事实标注\|BLOCK_RE" src/ tests/ tools/ spikes/` 仅命中 T46-T49 文档指针行与历史叙事（docs/ 历史段落豁免），代码面零命中。
- **C3 S1 §7 修正落位**：三层行删除、五行改宿主、引言与 §8 守卫、附录索引同步；S4 五处同步；grep 可验。
- **C4 门禁与冒烟**：九项门禁全绿（不接管验码）；`node spikes/s-pi/backend-smoke/t24/prompt-assembly-smoke.mjs` 30/30。
- **C5 回归**：全量回归失败数不增于 T48 基线（76 fail/2661），唯一化 diff 零本任务文件。
- **C6 登记面**：T49 三件套齐 + tracker/_index 行 + T46/T47 指针行。

## 5. 不做（out of scope)

- base 重新设计（PD-20 触发式任务本体，含红线 #1/#8 的 base 侧候选评估）——仍是第二个 mode workflow 开工前的触发项。
- 修辞事实标注/文案原则作为 workflow 效果层内容的任何新设计——后期打磨阶段再评（owner 2026-08-31）。
- studio/workflow 命名（owner 已拍板暂不改名，本会话第三轮 #1）。
- W2 任何任务的提前开工。

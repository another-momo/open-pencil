<!--
  写作纪律（改本文前必读）：
  - 事实性声明必须附核验命令 + 日期，否则标为【假设】
  - 计划被实测推翻时，直接改本文为新版本，完整理由记入 records/ 子文档
  - 本文只保留当前态，不保留修正历史
  - 改完后刷新本文头部的「状态」字段
  - 详细规则见 docs/rebuild/05-process.md §4
-->

# T46 核验 · base.md v0 落位 + 红线补洞 + base 候选清单建档（S4 W1 / T-A5）

> **状态**：✅ 核验通过（带 findings 收口；F1/F2 已于收口段修复并复验） | **时间**：2026-08-31 独立核验 | **核验人**：subagent（general-purpose，只读 + V1 幂等性验证后还原）
> **⚠ 当前态修正（T47，2026-08-31）**：转写源已切换为 prompts/system-prompt-base.md（119 行），本文中 576 行源判定表/双源头注落点/P123 等口径为历史记录，现役口径见 T47 三件套
> **关联**：[T46-plan.md](T46-plan.md)（验收标准 C1-C6）/ [T46-self-check.md](T46-self-check.md)
> **被验对象**：25cda2be（立项）→ 0045baf4（实现）

## 总结论

**带 findings 收口**。核心交付物（base.md 保真、四红线 + 修辞事实标注段、failures 收零、建档登记、门禁、回归面）全部经独立实证通过；F1（P1 构建器不幂等）与 F2（P2 头注缺核验命令指针）不阻断交付语义，收口段已修复并复验（见末节）。

## V1 保真复核（C1）——通过

- `node tools/rebuild/verify-t46-base-fidelity.mjs` → 6/6 passed（2026-08-31）。
- 人工抽查：base.md 头 6 行（frontmatter `id: base` + 双源声明头注）、补洞段边界（L234 begin / L247 end，恰在 `# Example: mobile app UI` L249 前）、两文件尾部 8 行逐字一致。
- 分段 diff：`base.md[7..233]` vs `system-prompt.md[3..229]`（各 227 行）零 diff；`base.md[249..597]` vs `system-prompt.md[229..578]` 零 diff。base.md L248 空行属补洞块自有尾隔，保真等式成立。
- 幂等性实测初验失败 → 记 F1（已修，见末节）。

## V2 红线补洞质量（C2）——通过

- 独立 grep 源文件 576 行正文：`invent|fabricat|hallucinat|make up` 0 命中（#3 缺）；`confirm|cost|paid` 0 命中（#2 缺）；`undo` 仅 L265 示例 JSX 图标名 `lucide:undo-2`（#6 prose 缺）；`ask the user|permission` 0 命中；#8 仅 L111 stock_photo 401 局部规则。四判定全部独立复证。
- 补洞尺度：四条规则纯增量——规则 1 显式豁免文案创作（与源文件 L130 real text content 创作意图一致）；规则 4 明示 L111 为通则既有特例；块外零 diff 即「零改写既有 prose」硬证据。
- 标注段覆盖功效（「7 天见效」）/ 数据（「销量 10 万+」）/ 背书（「央视推荐」「好评率 99%」）三类 + "ask the user to confirm it before the design is treated as final" 确认动作。

## V3 注册表收零与 schema 钉扎（C3/C4）——通过

- `bun test tests/engine/rebuild/` → 26 pass / 0 fail（5 文件，2026-08-31）。studio-builtin-assets.test.ts 钉 failures 收零 + base 注册 + 补洞段双锚点；studio-registry.test.ts 新 C1 测（`id: not-base` → failure「不是 `base`」；缺省 id 注册成功）。
- `node spikes/s-pi/backend-smoke/t24/prompt-assembly-smoke.mjs` → 30/30（fixture 复制 base.md；无绝对路径断言移交无资产后端半）。
- `bun spikes/probes/probe-t45-old-route.mjs` → 旧路径 404，新路径 200，modes=[general,longform]，profiles=3，failures=0（2026-08-31；probe 需 bun 运行，其 docstring 已写明）。

## V4 建档与登记面（C5）——通过

- 仓外 `doc/base-candidate-list.md`：PD-20② 原文引、判定尺两反例、条目表头、空表不预填、生命周期（T46 → T-C1/C2 → W5 归档）俱全。
- 仓外 `doc/S4-phase3-plan.md` §7 三处更新齐：候选清单行指向新文件；「base.md 免 label 校验」行划除标 ✅（T46 D-e）；新增「base.md / system-prompt.md 双源收编」行（T46 D-b，时机 = W2 组装改造）。
- `docs/rebuild/tracker.md` 与 `docs/rebuild/tasks/_index.md` T46 行登记在案（核验时点 🔄，收口后翻 ✅）。

## V5 门禁与回归复核（C6）——通过

- `bun run check:zones / check:docs / check:bindings / check:tasks` 全部 exit 0（2026-08-31）。
- 全量回归日志 `doc/t46-regression-run.log（仓外）` 尾：2559 pass / 23 skip / 79 fail，Ran 2661 tests across 434 files，542.28s 完整跑完。
- `doc/t46-failures.txt（仓外）`（74 行唯一化）diff `doc/t45-failures.txt（仓外）`（73 行）仅两处：T45 的 MCP concurrent startServer 转绿；新增 MCP stdio readiness（bridge connect timeout 抖动）与 plugin-data roundtrip 两条——隔离复跑 9/9、20/20 全绿确为 flake；grep `studio|registry|rebuild|assembly|base|prompt` 于失败清单 0 命中，零本任务文件。

## V6 缺陷面——通过

- 双源防控：两文头注各一（`<!-- T46（S4 W1/T-A5）` 起头），写明双边同步 + W2/W3 接入后退役；核验命令指针缺失 → 记 F2（已修）。
- schema 一致性：registry.ts `id !== undefined && id !== 'base'` → failure「不是 `base`」，缺省即注册——与两条新 C1 测钉扎一致。
- 补洞段风格：英文祈使纪律体 + 编号规则；中文仅出现在 PD-20 锚词（「修辞事实标注」标签、功效/数据/背书类目）与「」引号示例内——锚词由 verify 脚本第 5 断言钉死，属设计而非杂糅。
- zones.json P123（system-prompt.md 头注补丁）：理由写明退役条件（W2/W3 接入后移除），disposition permanent、lastReviewed 2026-08-31，合理。

## Findings 处置（收口段，2026-08-31）

- **F1（P1）构建器不幂等**——已修：构建器包裹格式对齐 oxfmt 典范形（`BEGIN\n\n`、`_facts_`、`\nEND`）；复跑两次 `git diff` 零增长，幂等坐实；verify 复跑 6/6。修复记录见 T46-self-check §3 第 7 条。
- **F2（P2）头注缺核验命令指针**——已修：两文头注各补「同步核验：node tools/rebuild/verify-t46-base-fidelity.mjs」；保真 6/6 复跑确认（剥除正则兼容）。修复记录见 T46-self-check §3 第 8 条。
- 修复后复验（2026-08-31）：verify 6/6；format:check 全绿（2093 文件）；`bun test tests/engine/rebuild/` 26/26；assembly 冒烟 30/30。

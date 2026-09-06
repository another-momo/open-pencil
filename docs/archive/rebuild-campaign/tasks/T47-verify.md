<!--
  写作纪律（改本文前必读）：
  - 事实性声明必须附核验命令 + 日期，否则标为【假设】
  - 计划被实测推翻时，直接改本文为新版本，完整理由记入 records/ 子文档
  - 本文只保留当前态，不保留修正历史
  - 改完后刷新本文头部的「状态」字段
  - 详细规则见 docs/rebuild/05-process.md §4
-->

# T47 核验 · W1 收口后修正批：base 转写源切换 + workbench 归档迁移 + 生图路线乙登记

> **状态**：✅ 核验通过（带 findings 收口；F1/F2 已于收口段修复并复验） | **时间**：2026-08-31 独立核验 | **核验人**：subagent（general-purpose，只读；V1 构建器连跑零增长无需还原）
> **⚠ 当前态修正（T49，2026-08-31）**：红线补洞段及配套机制已全部撤除（过度工程），base.md 回归 119 行纯转写；本文补洞段相关核验口径为历史记录，现役口径见 T49 三件套
> **关联**：[T47-plan.md](T47-plan.md)（验收标准 C1-C7）/ [T47-self-check.md](T47-self-check.md)
> **被验对象**：4ef9bf1e（立项）→ a2b3f3f5（实现）→ 2c1c0b6e（format 补）→ 6b0f0ffc（自检补记）

## 总结论

**带 findings 收口**。V1-V7 全部核验项通过，代码面/门禁面/回归面零问题；F1（P1 spike 06 §0 汇表行自相矛盾）与 F2（P2 T41-self-check 半扫残留）均为文档面，不阻断收口，已于收口段修复复验（见末节）。

## V1 转写保真（新源，C1）——通过

- `node tools/rebuild/src/verify/t46-base-fidelity.mjs` → 6/6（2026-08-31）。
- 幂等：`bun tools/rebuild/src/build-t46-base.mjs` 连跑两次均「12434 bytes；源 10979 bytes + 保真自检零 diff」，第二次后 `git status --short` 完全为空。
- 人工抽查：base.md frontmatter + 双源头注（含核验命令）；补洞段 begin/end 在文末；正文 L7-123 vs 源 L5-121 diff 零；`grep T24 base.md` 无命中（元注释未混入正文）。

## V2 回退干净性（C2）——通过

- `git diff rebuild/pi -- src/app/ai/chat/system-prompt.md` 为空（字节级回退）；check:zones exit 0；zones.json 无 P123，P35（attic 路径 + T47 注记）/P124（oxlint .mjs 豁免）在案；ownedRoots 含 attic/、tools/rebuild/，无 workbench/。

## V3 迁移零残留（C3）——通过

- 代码/CI 面 grep 零命中（唯一命中为 P124 reason 的迁移叙事自述，合理）；`ls workbench` 不存在；ci.yml job 四处路径全指 attic/dsh-workbench；`git log --diff-filter=R` 见 42 条 rename。
- markdown 链接断链核验零断链；DSH 时代叙事文档（T14-T18）纯文本提及豁免口径评估为**合理**（历史证据 + attic README 映射承载）。

## V4 钉扎与冒烟复跑（C4）——通过

- `bun test tests/engine/rebuild/` 26/26；`node spikes/s-pi/backend-smoke/t24/prompt-assembly-smoke.mjs` 30/30；`bun spikes/probes/probe-t45-old-route.mjs` 旧 404 / 新 200 failures=0（2026-08-31 全部复跑实证）。

## V5 登记落位（C5）——通过（1 条 P1 已修）

- spike 06 SP-a2 节 = 路线乙决定版 + 头部状态行同步；records 镜像（narrative/06、topics/spikes.md）同步；S4 v3 修订行 + §2/§3/§4/§7 五处落位；T46 三件套指针行在案。
- 遗留：§0 汇表 SP-a2 行旧口径 → 记 F1（已修）。

## V6 门禁与回归复核（C6）——通过

- check:zones/docs/bindings/tasks exit 0；`bun run format:check` 直跑 exit 0（2098 文件）；`bun run lint` 0 errors/5 warnings（回基线）。
- 仓外 doc/t47-regression-run.log 尾部：77 fail / 2661 tests / 492.32s 完整跑完；diff T46 基线（74→72 行）：T46 三条 flake 转绿 + 新增 1 条 MCP stdio transport flake（隔离复跑 9/9 绿）；grep studio/registry/rebuild/assembly 于失败清单 0 命中；「clipboard text outline probe」确认为字体引擎测试非本任务探针。全量未复跑。

## V7 缺陷面——通过

- 补洞段自洽：规则 3 batch_update 在新源实存（base.md L97）；规则 4 去 stock_photo 引用后自含成立；base.md 无 stock_photo/401 残留。
- 路径深度：spikes/probes 与 tools/rebuild 均为 2 级 repoRoot，probe-t45 实跑实证、verify-t45-dump 静态正确。
- lint 修复语义等价（process.pid % 200 端口区间 [7910,8109)；Promise executor 花括号不改 await 语义）；spikes/ 不在 lint 视野与 lint 0 errors 一致，非矛盾。
- 双文互指：base.md L5 ↔ system-prompt-base.md L1 各含核验命令。

## Findings 处置（收口段，2026-08-31）

- **F1（P1）spike 06 §0 汇表 SP-a2 行旧口径 + L63「SP-a2 解锁后即插即测」残留**——已修：汇表行改路线乙决定版（关闭 + W2 双后端抽象指针），L63 改「凭证来源归入 T-B 批工具层（DMX key；pi-ai 扩展位即插即测）」。复验 check:docs 42/42、format:check exit 0。
- **F2（P2）T41-self-check.md 单元格残留「owned root workbench/」**——已修：改注「原 owned root workbench/，T47 起居 spikes/probes/」。

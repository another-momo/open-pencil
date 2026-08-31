<!--
  写作纪律（改本文前必读）：
  - 事实性声明必须附核验命令 + 日期，否则标为【假设】
  - 计划被实测推翻时，直接改本文为新版本，完整理由记入 records/ 子文档
  - 本文只保留当前态，不保留修正历史
  - 改完后刷新本文头部的「状态」字段
  - 详细规则见 docs/rebuild/05-process.md §4
-->

# T46 自检 · base.md v0 落位 + 红线补洞 + base 候选清单建档（S4 W1 / T-A5）

> **状态**：✅ 已收口（独立核验通过，findings 2 条已修） | **时间**：2026-08-31 立项；2026-08-31 实现；2026-08-31 收口 | **负责人**：主 agent
> **关联**：[T46-plan.md](T46-plan.md)（验收标准 C1-C6 以其 §4 为准）

## 1. 立项段自检（2026-08-31）

- [x] 任务定义三来源逐字复核（2026-08-31）：S4 §4 T-A5 行（base.md v0 落位 = 572 行 UI prompt 移入 + 红线补洞 PD-20① + 候选清单建档 PD-20②）、S4 §3 前置批行（补洞非调优：四红线齐全性检查 + 修辞事实标注段新增，半日级）、S2 §3（base 全局唯一/不可选/每回合必组装 + v0 沿用两守卫）、19 册 PD-20 原文（不阻塞 + 触发式重设计 + 两守卫全文）。
- [x] 「572 行」口径勘误预登记：`wc -l src/app/ai/chat/system-prompt.md` = **576**（2026-08-31）——规格文本 572 为 2026-08-30 成文时点值；T44 已有同类行数勘误先例（264→303），本任务以实测 576 为准并写入 plan §1。
- [x] 四红线预检（grep，2026-08-31）：`虚构|编造` 0 命中；「撤销」仅示例 JSX `undo-2` 图标名；「成本/确认/静默/降级」无纪律语义命中——四红线在 576 行 prose 中均无直接对应段，补齐工作量属实（非零工作）；宿主/工具承载（undo burst/历史容器/错误用户语言化）的判定留实现段逐条定。
- [x] base 槽位校验现状实证（Read registry.ts loadBase，2026-08-31）：仅查 frontmatter id（`id !== undefined && id !== 'base'` → 失败），无 label/必需节要求——「免 label」是现状，本任务成文 + 钉测试（D-e/D-f），无需改 registry 代码。
- [x] 组装边界复核：modes.ts:38/43-44 实证 ui/marketing 基底路径；T45-plan §5「不做每回合组装改造（W2/W3）」与 T44 longform.md「落位 = 注册表在案」先例一致 → D-b（组装不动 + 双源防控三重）成立。system-prompt.md 消费面 = modes.ts + 六个冒烟 fixture（grep -l 实证：t21/t22/t23/t24/t28），均不受 D-b 影响。
- [x] 钉扎测试收编锚点实证：`studio-builtin-assets.test.ts:7-8` 头注已预约「T-A5 收口时应把该断言收为 failures: []」，:25-27 为现状断言。
- [x] S4 §7 尾巴表现状复核（2026-08-31 Read）：「base 候选清单指认（PD-20 ②）」与「base.md 免 label 校验（T43 核验观察项 d）」两行在案，实现段更新指向/标处置（C5）。
- [x] 三件套立项即建档（本文 + T46-verify.md），无占位禁词。

## 2. 实现段自检（2026-08-31）

### 四红线齐全性判定表（C2 核心证据；方法 = 通读全文 576 行 + 英文术语 grep 双轨）

| 红线 | 现状（依据） | 判定 | 处置 |
|---|---|---|---|
| #3 事实零虚构 | 无任何事实/虚构纪律（`grep -niE "invent\|fabricat\|hallucinat\|made-up\|fictional"` 零命中，2026-08-31） | **缺席** | 补入新节第 1 条：事实类内容（规格/统计/认证/背书/价格）必须来自用户或需求单，缺则追问或留可见占位；并衔接 PD-8——文案创作（标题/口号/CTA）受鼓励，禁的是编造「事实」 |
| #2 成本确认 | 零命中（本 prompt 不含计费工具——generate_image 不在其内） | **缺席**（工具面在 marketing 链） | 补入新节第 2 条（mode 无关通则）：产生实际成本的动作须用户显式确认后才执行，未确认不批量 |
| #6 可撤销 | 零纪律命中（「undo」仅示例 JSX 图标名 `undo-2`，:263）；undo burst 为宿主承载（S1 §7 落点） | **宿主承载，prose 缺席** | 补入新节第 3 条协作侧纪律：一回合修改聚合为一批保持单个撤销单元（宿主合并回合，agent 保持可合并） |
| #8 不静默降级 | **特例有、通则缺**：:109 stock_photo 401 → 告知用户 + 禁止 eval 静默兜底 | **部分落点** | 补入新节第 4 条通则：工具失败/能力缺失用用户语言说明 + 给修复动作，不得静默换路径冒充成功；:109 明示为该通则的既有特例 |

修辞事实标注段（PD-20 ①）：落为新节末段——可被解读为事实声明的 AI 创作元素（功效/数据/背书三类修辞，各带中文例）必须显式标注并请用户确认；CP 表单落点属 workflow 层（S1 §7 层归属），base 段只写 mode 无关纪律。

### C1 base.md 落位保真 ✅

- 构建经程序复制（`workbench/build-t46-base.mjs`，幂等）——非人工重打；插入点锚 `# Example: mobile app UI`（断言全文恰好一次）。
- 独立保真核验 `bun workbench/verify-t46-base-fidelity.mjs`（2026-08-31）→ **6/6**：frontmatter id=base、标记 begin/end 各一、双源头注各一、四红线语义锚点、修辞事实标注三例+confirm、剥除后零 diff。
- 补洞段位置：「Advanced tools」节之后、两个 Example 之前（纪律区尾、示例区头）；标记注释包裹（`<!-- T46 红线补洞段 begin/end -->`），核验脚本剥除后逐字等于源文件。
- 双源声明/互指头注两文各一（D-b 防控落地）：base.md 声明「组装接入前 ui 基底以 system-prompt.md 为准、接入后退役」；system-prompt.md 顶部互指（git diff 实证仅 +2 行注释）。

### C2 红线补洞 ✅

判定表见上；新节 `# Trust & Safety Discipline (MANDATORY)` 一节承载四条 + 标注段（单节连续块，标记可剥除——保真等式成立的前提设计）。尺度控制：四条约 12 行 + 标注段 1 段，零改写既有 prose（diff 零为证）。

### C3 注册表收零实证 ✅

- `bun test tests/engine/rebuild/`（2026-08-31）→ **26 pass / 0 fail / 5 文件**：钉扎测试收编为 `failures: []` + base 注册断言（免 label、origin=builtin、补洞段锚点）；registry 新增 schema 钉扎（id 缺省合法/写错失败）。
- 端点实证 `bun workbench/probe-t45-old-route.mjs`（2026-08-31）：新路径 200 且 **failures=0**；旧路径维持 404。
- 冒烟 `bun spikes/s-pi/backend-smoke/t24/prompt-assembly-smoke.mjs`（2026-08-31）→ **30/30**：fixture 加复制 base.md；资产后端 failures 断言收零；base 缺失 + 整体态 + 路径脱敏断言移交无资产后端半（覆盖不丢）。

### C4 base schema 成文 + 钉扎 ✅

D-e 成文（plan §2）；钉扎 = studio-registry.test.ts 新 C1 测（`id: not-base` → failure「不是 `base`」；缺省 id 注册成功；免 label 由全组 BASE_MD 无 label 共同钉扎）。

### C5 建档与 S4 §7 更新 ✅

- `doc/base-candidate-list.md` 建档（仓外，2026-08-31）：PD-20 ② 原文引 + 判定尺（两反例测试）+ 条目格式约定 + 空表（不预填）+ 生命周期（T-C1/C2 记录 → W5 归档）。
- S4 §7 三处更新（python 替换 assert count==1，2026-08-31）：候选清单行指向新文件；「base.md 免 label 校验」行划除标 ✅ 已处置；新增「base.md / system-prompt.md 双源收编」行（指认时机 = W2 组装改造）。

### C6 门禁与回归 ✅

- 门禁（2026-08-31）：format:check 全绿（2093 文件）；lint 0 errors/5 warnings（基线告警）；`bunx tsgo --noEmit` exit 0；check:vue exit 0；check:i18n in sync；check:docs 42/42；check:zones/check:bindings/check:tasks 见 pre-commit 输出（收口 commit 记录）。
- 全量回归（`bun run test:unit:quick`，2026-08-31，run 日志 `workbench/t46-regression-run.log` 542.28s 完整跑完）：79 fail / 2661 tests（对照 T45 基线 78 fail / 2660，测试数 +1 = registry 新 schema 钉扎，符合预期）。唯一化去抖 diff（剥 `[xx ms]` 后缀，T45 73 行 → T46 74 行）：基线 1 条本轮转绿（MCP concurrent startServer），新增 2 条均非本任务文件——MCP stdio readiness（bridge connect timeout 抖动）与 plugin-data roundtrip，两文件隔离复跑 9/9、20/20 全绿确为 flake；零本任务文件（studio/registry/rebuild/assembly 全文无命中）。

## 3. 实测修正记录（实现段，2026-08-31）

1. **构建器自检初版漏剥双层头注**：strip 正则只剥首条 T46 注释（^ 锚单次），base 侧残留源文件互指头注 → 保真自检红灯；改全局剥除（/gm）。
2. **/gm 头注剥除抢先吃掉补洞段标记**：begin/end 标记同为 `<!-- T46` 行，先剥头注则标记块正则失锚 → 调整顺序：先剥标记块、后剥头注（两脚本同步）。
3. **oxfmt 在 frontmatter 与头注间插空行**：format 后保真 diff +1 字节（前导空行）→ 构建器改发 oxfmt 典范形（`---` 后空行），strip 容忍 frontmatter 分隔空行；build → format → verify 循环实测稳定（二次 format 零改动）。
4. **修辞事实标注断言语义锚过严**：初版断言要求「功效/数据/背书」字面值，节文本初版只带中文例子未带三类词 → 节文本补「（功效/数据/背书三类修辞）」插语（顺带忠实 PD-20 ① 原文三分）。
5. **plan D-e 误判**：「非 base id 仍失败 registry 测试已有」不实——grep 实证无此钉扎；已补（studio-registry.test.ts 新 C1 测），plan 口径以此为准。
6. **冒烟断言收零的连带**：资产后端 failures 由「base 缺失一条」收为零数组后，「无绝对路径泄漏」断言在空数组上真退化（every 真空真）→ 该断言移交无资产后端半（failures 含 base.md + 整体态两条，检查为实）。
7. **F1（核验 P1）构建器不幂等**：独立核验实测 `build-t46-base.mjs` 重建产出与已提交 base.md 有 3 处文本差异（begin 标记后空行、`*facts*` vs oxfmt 典范 `_facts_`、end 标记前空行）——构建器包裹格式未对齐 oxfmt 典范形 → 修：构建器改发典范形（`BEGIN\n\n` / `_facts_` / `\nEND`），复跑两次 diff 零增长，幂等坐实（2026-08-31）。
8. **F2（核验 P2）头注缺核验命令指针**：base.md 双源声明与 system-prompt.md 互指头注均只说「双边同步」未给核验手段 → 两文头注各补「同步核验：node workbench/verify-t46-base-fidelity.mjs」（剥除正则兼容，保真 6/6 复跑确认，2026-08-31）。

## 4. 关键决策回执

- **转写 = 程序复制 + 标记块设计**：base.md = frontmatter + 双源声明 + 576 行逐字 + 标记包裹的补洞段；保真核验 = 剥除后零 diff（比 T44 的 NORMALIZE 表更硬——本任务零被迫偏差）。
- **补洞段单节承载**：四红线 + 标注段合为 `# Trust & Safety Discipline (MANDATORY)` 一节（纪律区尾、示例区头），保证剥除点唯一、核验简单。
- **双源暂行期**：ui 基底仍读 system-prompt.md（modes.ts:38 未动——冒烟 byte 级断言面零改动）；双文头注互指 + S4 §7 收编行兜底。

<!--
  写作纪律（改本文前必读）：
  - 事实性声明必须附核验命令 + 日期，否则标为【假设】
  - 本文只保留当前态，不保留修正历史
  - 详细规则见 docs/rebuild/05-process.md §4
-->

# T69 计划 · Phase 3 W3/T-C3：精品 profile 首发做透（基于 watercolor_poster_v2 改写）+ golden 场景

> **状态**：🔄 进行中 | **时间**：2026-09-01 立项 | **负责人**：主 agent + 实现 subagent + 核验 subagent
> **调研蓝图**：doc/T-C-survey-20260901.md（仓外）§7；owner 方针（S4:62）：「先做好一个再拓展其他的」——单精品全链做透 + golden 场景一；首发 = 基于 v2 改

## 1. 范围

### A. watercolor_poster_v2.md 改写做透（调研 §7 必改项七条）

1. **compose_backdrop 实参对齐 T58**：:45 调用含已删除的 `canvas_width`——改 {root_id, scaffold_id, canvas_height?}（管线内路径）或 {root_id, hero_image_from}（外部来源），与 T58 契约逐字段对账。
2. **Recipe 接新序（S1:60）**：直接 generate_image 进 HeroContent 的旧流 → prepare_hero_scaffold 克隆标题前置版式 → generate_image 以 scaffold 为 composite 参考 → compose_backdrop(scaffold_id)（跳步=显式失败，S3:104/:112）。Recipe 每步写明工具调用形状与失败语义。
3. **阶段名对齐 hero-first 新五阶段**（:41 旧「Phase 2 skeleton / Phase 2.5」口径 → 阶段 2 hero 物化 / 阶段 3 结构与填充）。
4. **尺寸去硬编码**：750 通篇（:15/:18/:23/:44/:45）参数化——以 workflow sizes 预设为输入（canvas 宽从尺寸预设读，字阶与 bleed 规则随宽度分档；T68 ⑧ 的字阶梯优先序声明对齐）。
5. **hero_composition 键裁决**（S4:121 尾巴）：v2 默认 lower-third 是否补带 hero_composition 键——裁决并记录理由（默认：不补带，profile 正文 Variable system 的 lockup 枚举已承载；若 scaffold 几何记录需要结构化读入则补，以实现 subagent 对 T57 几何记录的读码结论为准）。
6. **applicable_to 注记去 type 提法**（S2:102 随 T62 修订）。
7. **通过加载期校验**（S2:116）：studio validate 全绿（五必需节：Fixed system / Variable system / Anti-identity / Recipe / Tone）。

内容做透（T48 未做的内容性升级，:60 明示归本任务）：Recipe 配方与 T57/T58 工具链真实能力逐步对账（每个工具名存在性、每个参数名拼写、每个返回值消费点）；Tone 节保留；中英口径统一（现文英文，保持英文为主、关键中文术语括注）。

### B. golden 场景一（调研 §7：S2:132 定义）

- 形态：**固定 brief + 固定尺寸预设 → 最小样板图 + 评分量表跑分**（接缝可见性 / 标题可读性 / 节奏感）。T62 后「固定 type」→「固定尺寸预设」（电商详情长图 750x）。
- 落地形态裁决（实现 subagent 提议、self-check 记录）：优先**零生图成本的程序性断言**（S2:132 后半：排版面程序性注入后可纯布局断言）——即写一个 golden 场景测试/脚本：以固定 brief 文本 + 750x 预设驱动 scaffold 准备与骨架渲染的确定性部分，断言字阶/版式/hero 几何；真生图样板归档若需 API key 与成本，标记为手动流程（文档化步骤）而非 CI 门禁。
- 归档位：仓外 doc/ 或 tests 钉扎（视形态裁决）。

### C. 明确不做

- watercolor_poster_v3（derive_palette 悬空，随其改写轮——拓展批）；editorial/solid Recipe 补齐（拓展批）；casual_v1（拓展批裁决）。
- 其余 mode 的 profile 集。

## 2. 边界与门禁

- 仓内：studio/profiles/watercolor_poster_v2.md（单文件）+ golden 场景测试/脚本（tests/engine/rebuild/ 或 spikes/，按裁决）。
- 门禁：`bun test ./tests/engine/rebuild`（studio 钉扎：builtin-assets/registry/manifest 三套件含 profile 校验）+ `bun run smoke:pi`。若新增测试文件，zones 已在 owned 区零登记。
- 与 T68 的接口：字阶梯优先序（workflow 规则 vs profile Fixed system）以 T68 ⑧ 的声明为准；本任务改写若先于 T68 完成，在 v2 文中留「与 workflow 字阶规则冲突时以 profile 为准」的既有口径即可（现文已是此语义）。

## 3. 验收标准

1. v2 七条必改项全落地（核验逐条对照调研 §7 清单）。
2. Recipe 中每个工具名/参数名与仓内实现逐一对账（核验抽 5 处 grep 实证）。
3. studio 测试 + rebuild 全套 + smoke:pi 全绿。
4. golden 场景按裁决形态落地并可重复跑分（程序性断言版）或步骤文档化（手动版）。
5. 三件套齐 + 核验 PASS 后 flip tracker。

<!--
  写作纪律（改本文前必读）：
  - 事实性声明必须附核验命令 + 日期，否则标为【假设】
  - 计划被实测推翻时，直接改本文为新版本，完整理由记入 records/ 子文档
  - 本文只保留当前态，不保留修正历史
  - 改完后刷新本文头部的「状态」字段
  - 详细规则见 docs/rebuild/05-process.md §4
-->

# T44 计划 · config.yaml 拆解迁移 + longform.md 骨架（S4 W1 / T-A2）

> **状态**：✅ 已完成 | **时间**：2026-08-31 立项 / 2026-08-31 收口 | **负责人**：主 agent
> **⚠ 当前态修正（T48，2026-08-31）**：owner 指令补迁 watercolor_poster_v2（studio/profiles/ 现为四精品）；verify-t44-migration-fidelity.mjs 的核验源 brand/config.yaml 已被 T45 删除，T48 修复为 git 钉扎源（4ce51816），本文「三精品」「config.yaml 读文件」口径为历史记录，现役口径见 [T48-plan.md](T48-plan.md)
> **分支**：`rebuild/mode-arch`（worktree `open-pencil-mode`；T43 收口 a2f04d4f 之后）
> **规格真源**：[S2 资产文件机制规格 v2](../../../doc/S2-asset-files-spec.md) §2 id 规则 / §4 workflow / §5 profile+迁移清单；[S4 Phase 3 计划 v2](../../../doc/S4-phase3-plan.md) §4 W1 T-A2 行；[S1 产品规格](../../../doc/S1-product-spec.md) §3 执行序

## 1. 背景与立项

T43（T-A1）已建成 studio 文件机制内核（两源扫描/校验/注册表/失败数据面），但 `src/app/ai/pi-backend/studio/` 下还没有任何真实资产文件。本任务执行 S4 W1 第二刀：把 T24 单文件 `brand/config.yaml`（303 行，7 type + 8 profile；核验：`wc -l src/app/ai/pi-backend/brand/config.yaml`，2026-08-31；~~264~~ 系照抄 S2 §2 旧数字，核验观察项勘误）拆解迁移为 studio 文件集：

- **profiles/ 三份精品**：watercolor_poster_v3（迁移清单定为模板基准）+ editorial_poster_v1 + solid_poster_v1
- **workflows/longform.md 骨架**：长图三 type 折叠进 frontmatter（PD-17）+ 正文结构（阶段定义 / type 蓝图 / 纪律）

迁移完成后 config.yaml 的内容面即退役；文件与读取链的物理移除随 T-A3（端点改源）同步执行（D-c）。

## 2. 决策点（本任务开工前拍板/默认项登记）

- **D-a T-A2 与 T-A4 边界合并**：T-A4 原文「workflow 文件机制 + longform.md 首份骨架」——机制前半句已被 T43 建成（加载/校验/注册表），骨架后半句与 T-A2「长图三 type 折叠进 longform.md 骨架」是同一个文件。本任务一次性产出 longform.md 骨架（结构定义）；T-A4 不再单独立项，其口径被三段吸收：机制=T43 / 骨架=T44 / 内容填充=W3 T-C2。登记时在 tracker 与 S4 任务表注记。
- **D-b 精品集范围 = 3 份**：v3 + editorial + solid，正好落在迁移清单「凑满 3-4 个精品」下限。**casual_v1 不迁移**：其 applicable_to 全部是非长图 type（wechat_moments / xiaohongshu / dsp_banner），这些 type 本批暂缓收录（S2 §2）；且 casual 正文是 4 条 bullet 的 v0 形态、缺五节结构，重写属 T-C3「三选二~三」裁决域。挂 S4 §7 尾巴表。
- **D-c config.yaml 退役分两步**：本任务只做内容面迁移（纯新增文件），`brand/config.yaml` 与 `brand/index.ts` 读取链（service.ts 启动加载 → prompt-overlay / manifest）保持运转，物理删除随 T-A3 改源后同步执行。中间态零行为变化。既有测试对 config.yaml 零依赖（核验：`grep -rln "config.yaml\|loadBrandSeed\|brand/manifest" tests/` 无命中，2026-08-31）。
- **D-d `applicable_to` 重写**：旧值是 type id 列表（如 `[product_long, event_poster, xiaohongshu]`）；新机制校验引用完整性按 mode id（S2 §5：「Recipe 分节与 applicable_to 引用目标均为 mode id」）→ 三份统一改写 `applicable_to: [longform]`。
- **D-e 节名归一映射**（T43 校验五必需节为精确名：`Fixed system` / `Variable system` / `Anti-identity` / `Tone` / `Recipe`，validate.ts `PROFILE_REQUIRED_SECTIONS`）：
  - `## Fixed system（不可违反）`、`## Fixed system (never break)` → `## Fixed system`
  - `## Variable system（每个设计选定并记录）`、`## Variable system (choose per design; record your picks)` → `## Variable system`
  - `## Anti-identity（本风格绝不做）`、`## Anti-identity (this style never does)` → `## Anti-identity`
  - `## Visual environment setup（Phase 2.5）`、`## Visual environment setup (Phase 2.5)` → `## Recipe`
  - `## Tone` 不动；文首 `# 标题` 与引言段保留（sections 索引只收 ## / ###，引言留在 body 供注入）。
  - 节内正文**逐字保留**；editorial/solid 英文正文不翻译（保真优先，语言统一归 T-C3 改写定稿）。
- **D-f editorial/solid 的 Recipe 写 `no-op`**：旧文件中 Visual environment setup 节为空；S2 §5 允许显式空节（09 §C-1 空节矛盾的解法）。物化配方补齐归 T-C3，挂 S4 §7 尾巴表。
- **D-g longform 三 type**：`ecommerce_detail`（750x）与 `product_long`（750x）从 config.yaml 携带；`xiaohongshu_long`（1080x，HUG）为新增——S2 §4 示例值；旧 `xiaohongshu`（1080x1440 方图）属非长图 type 暂缓收录。旧 type 的 `description` 字段不迁（`StudioWorkflowType` 无此字段；PD-17：type 刚性载荷 = 尺寸 + 蓝图体节）。
- **D-h 蓝图节写「真实但最小」**：T43 校验要求每 type 同名蓝图节非空（章节序 + 每节内容要求；平台约束可选）。本批写真实的最小章节序骨架（设计知识，非占位符），T-C2 充实。
- **D-i 骨架其余节**：`## 阶段定义` 列 S1 §3 五阶段一行式结构定义（0 需求接入 / 1 方向提案 / 2 hero 物化 / 3 结构与填充 / 4 终审）+ CP 位挂点名；`## 纪律` 列挂点清单（Fix Playbook / resume 协议 / restyle 协议 / 脱困阀参数 / CP3 色调确认——内容 T-C2 填充）。两节非 T43 校验必需，但 S2 §4 骨架结构要求存在。

## 3. 范围与修法

### S1 profiles/ 三份（`src/app/ai/pi-backend/studio/profiles/`）

| 文件 | frontmatter | 正文处理 |
|---|---|---|
| `watercolor_poster_v3.md` | id/label=水彩海报 v3/`applicable_to: [longform]`/`version: 3` | D-e 节名归一；五节正文逐字保留 |
| `editorial_poster_v1.md` | id/label=杂志封面海报/`applicable_to: [longform]`/`version: 1` | D-e 节名归一；Recipe = `no-op`（D-f） |
| `solid_poster_v1.md` | id/label=扁平几何海报/`applicable_to: [longform]`/`version: 1` | D-e 节名归一；Recipe = `no-op`（D-f） |

### S2 `workflows/longform.md` 骨架

- frontmatter：id=longform / label=长图设计 / subtitle（S2 §4 示例：电商详情 / 产品长文 / 小红书长图的分区物料）/ `step_budget: 50` / types 三条（D-g，id/label/size，safeArea 暂不写）。
- 正文：`## 阶段定义`（D-i）→ `## type 蓝图`（`### ecommerce_detail` / `### product_long` / `### xiaohongshu_long` 各一段最小真实章节序，D-h）→ `## 纪律`（D-i）。

### S3 实测钉扎测试（`tests/engine/rebuild/studio/builtin-assets.test.ts`）

真目录加载：内置 = 仓库 `src/app/ai/pi-backend/studio/`，用户 = tmp 空目录。断言：`failures: []`；`longform` 注册且三 type 齐全、各蓝图节非空；profiles 恰好 3 份且 applicableTo=[longform]；modes = [general, longform]。把「内置资产过校验面」钉成永久门禁——后续 W3 内容填充若写坏文件，测试即红。

### S4 登记

- tracker.md 任务表 + tasks/_index.md §2 各加 T44 行（三件套链接齐全）。
- S4 §7 尾巴表 +2 行：casual_v1 处置裁决挂 T-C3；editorial/solid Recipe 补齐挂 T-C3。
- S4 §4 任务表 T-A4 行注记三段吸收（D-a）。

## 4. 验收标准

- **C1** 四个文件落位（profiles×3 + longform.md），实测钉扎测试证明零 failures 过 T43 校验面。
- **C2** 保真：v3 的 Recipe 正文 = config.yaml v3 markdown 的 Visual environment setup 节逐字（节名除外）；editorial/solid 的 Fixed/Variable/Anti-identity/Tone 四节正文逐字保留。核验方式：diff 对照 config.yaml 源段。
- **C3** 钉扎测试绿 + 既有 `studio-registry.test.ts` 16/16 不回归。
- **C4** 门禁全绿：check:zones / check:docs / check:tasks / check:bindings / lint（0 errors）/ tsgo / check:vue / format:check / check:i18n。
- **C5** 三件套 + tracker/_index 登记齐全；全量回归对照 T43 基线（78 fail 行/2654 tests）失败数不增、唯一化 diff 无本任务文件。

## 5. 不做（out of scope）

- 不动 service.ts / server.ts / prompt-overlay.ts / mode-selection.ts / 前端选择器（T-A3 与 T-B10 的范围）。
- 不删 `brand/config.yaml`、不退休 `loadBrandSeed`（T-A3 同步执行）。
- 不写 base.md（T-A5）。
- 不做 profile 内容改写、casual_v1 重做裁决、golden 场景（T-C3）。
- 不填 longform.md 的阶段/CP/蓝图详细内容（T-C2）。
- 不迁移非长图 type（wechat_moments / wechat_article_cover / xiaohongshu / event_poster / dsp_banner）——S2 §2 暂缓收录；event_poster 虽被旧 profile 引用，但其归属 mode 的 workflow 文件不存在。

## 6. 风险与回退

| 风险 | 缓解 |
|---|---|
| hex 启发式误伤正文 | v3 正文仅含 `#1F2937`/`#374151`/`#6B7280` 三个合法 6 位 hex（不触发 5/7 位纯 hex 与 6/8 位含非 hex 两条拦截；editorial/solid 无 hex）；钉扎测试 failures:[] 兜底 |
| 蓝图节写成空壳占位被核验打回 | D-h 明确写真实章节序骨架；C2/C3 双卡口 |
| `## Recipe` 下直接挂 `### longform` 子节会导致 Recipe 节体为空（sections 索引遇任意级标题即截断） | 本批 Recipe 不分子节（单 mode）；v3 Recipe 正文平铺 |
| 文件集纯属新增，无既有行为面变更 | 回退 = 删四个文件 + 测试文件；config.yaml 读取链全程未动 |

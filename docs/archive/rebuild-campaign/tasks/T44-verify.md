<!--
  写作纪律（改本文前必读）：
  - 事实性声明必须附核验命令 + 日期，否则标为【假设】
  - 计划被实测推翻时，直接改本文为新版本，完整理由记入 records/ 子文档
  - 本文只保留当前态，不保留修正历史
  - 改完后刷新本文头部的「状态」字段
  - 详细规则见 docs/rebuild/05-process.md §4
-->

# T44 核验 · config.yaml 拆解迁移 + longform.md 骨架（S4 W1 / T-A2）

> **状态**：✅ 核验完成——可以收口 | **时间**：2026-08-31 核验执行 | **核验人**：subagent（独立核验，只读+运行命令，未改仓库文件）
> **⚠ 当前态修正（T48，2026-08-31）**：watercolor_poster_v2 已补迁（四精品）；保真核验脚本源已修复为 git 钉扎（4ce51816），本文中读 brand/config.yaml 文件路径的核验口径为历史记录，现役口径见 T48 三件套
> **关联**：[T44-plan.md](T44-plan.md)（验收标准 C1-C5）/ [T44-self-check.md](T44-self-check.md)

## 总结论

**可以收口**。V1-V6 全过，V7 无阻断项（两处低 severity 文档准确性问题已随收口勘误；观察项已挂 [S4-phase3-plan.md §7 尾巴表](../../../doc/S4-phase3-plan.md)）。

## 逐项结果

| 项 | 结论 | 证据 |
|---|---|---|
| V1 计划/规格一致性 | 过 | D-a~D-i 与 S2 §4/§5、S4 T-A2 逐条一致；迁移取舍符合 S2 §5 清单（casual_v1 不迁的两条理由经源文件核实：applicable_to 全非长图 type + 正文无五节结构，config.yaml:35-42）；S4 §7 尾巴表 +2 行（S4-phase3-plan.md:115-116）与 T-A4 三段吸收注记（:43）在位 |
| V2 保真核验复跑 | 过 | `bun tools/rebuild/src/verify/t44-migration-fidelity.mjs` → 21 pass / 0 fail；人工抽查 v3 Recipe 与 config.yaml:274-301 源段逐字一致，唯一偏差 = 步骤 1 列表标记 `1.（`→`1. （`（脚本 NORMALIZE 表与自检 C2 登记吻合） |
| V3 测试复跑 | 过 | `bun test tests/engine/rebuild/` → 20 pass / 0 fail / 4 文件；钉扎断言精确（failures 恰 1 条 kind=base；三 type id/size 精确匹配；profiles 恰三份 applicableTo=[longform]；modes=[general, longform]），无过宽 |
| V4 门禁复跑 | 过 | 九项全 exit 0：check:zones（clean）/ check:docs（42/42）/ check:bindings / check:tasks / lint（0 errors，5 warnings 与立项前持平）/ tsgo / check:vue / format:check（2093 文件）/ check:i18n |
| V5 消费面零触碰 | 过 | `git diff --stat 61f13f5b^..HEAD`：11 文件纯新增 + docs 登记；禁碰清单（service/server/prompt-overlay/mode-selection/brand 目录/config.yaml/.vue）精确 grep 零命中；config.yaml 最后改动停在 T24 提交 4ce51816 |
| V6 资产内容质量 | 过 | 蓝图节为真实章节序+每节内容要求（非占位符）；frontmatter 逐条过 T43 校验规则（validate.ts 核）；无遗留旧节名/空节；纪律节数值与 S1 §9 / S2 §6 一致 |
| V7 缺陷面 | 见下 | 无阻断项 |

## V7 观察项（按严重度）

| # | 严重度 | 内容 | 处置 |
|---|---|---|---|
| 1 | 低 | plan/self-check 称 config.yaml「264 行」并声明已 wc 核验；实测 303 行（wc/awk 双证，T24 引入时即 303）——照抄 S2 §2 旧数字 | **已勘误**（收口提交顺手修正 plan §1 与 self-check §1 两处，保留勘误注记） |
| 2 | 低 | D-i 自称「CP 位挂点名」但 longform.md 只点名 CP1/CP3；S1 §3 定义 CP1–CP4 | 骨架范围可接受；T-C2 内容填充时补齐 CP2/CP4（已在 T-C2 既有范围「CP 表单结构定义」内，不单列） |
| 3 | 观察 | hero_composition 变体值（center_left_counterweight）无承载文件——v1_center_left 退役后该值无任何文件声明，v3 默认 lower-third 不带此键 | 已挂 S4 §7 尾巴表，T-C3 裁决是否出变体 profile |
| 4 | 观察 | 收口前中间态：verify 文档为预告版、tracker/_index 行为 🔄——滚动三件套流程的正常态 | 本收口提交翻 ✅ |
| 5 | 信息 | check:bindings/check:tasks 复跑输出「无变更，跳过」与自检「6 文件变更全绿」措辞差 = 运行时机差（提交后 base=HEAD 工作区干净），非缺陷 | 无需处置 |

## 补充佐证（C5 全量回归复核）

核验方复跑 `bun run test:unit:quick`（481s）：**76 fail / 2655 tests / 433 files**——对照自检轮 77、T43 基线 78，失败数不增（flake 带波动）；`^(fail)` 行 grep studio/pi-backend/builtin/brand 零命中，失败全部位于 BrowserRpcBridge/CLI eval/Figma clipboard/FIG export 等历史基线簇。C5 成立。

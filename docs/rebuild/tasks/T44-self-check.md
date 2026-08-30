<!--
  写作纪律（改本文前必读）：
  - 事实性声明必须附核验命令 + 日期，否则标为【假设】
  - 计划被实测推翻时，直接改本文为新版本，完整理由记入 records/ 子文档
  - 本文只保留当前态，不保留修正历史
  - 改完后刷新本文头部的「状态」字段
  - 详细规则见 docs/rebuild/05-process.md §4
-->

# T44 自检 · config.yaml 拆解迁移 + longform.md 骨架（S4 W1 / T-A2）

> **状态**：🔄 进行中（立项段已自检；实现段收口时重写本文） | **时间**：2026-08-31 立项 | **负责人**：主 agent
> **关联**：[T44-plan.md](T44-plan.md)（验收标准 C1-C5 以其 §4 为准）

## 1. 立项段自检（2026-08-31）

- [x] 迁移源已通读：`brand/config.yaml` 264 行、7 type + 8 profile（`wc -l` + 全文 Read，2026-08-31）。
- [x] 消费链已核对：service.ts:45/121/209/408（loadBrandSeed → overlay/manifest）、server.ts GET 路由、prompt-overlay.ts、mode-selection.ts、ChatStyleProfileSelect.vue——本任务零触碰（D-c，T-A3 范围）。
- [x] 既有测试对 config.yaml 零依赖（`grep -rln "config.yaml\|loadBrandSeed\|brand/manifest" tests/` 无命中，2026-08-31）→ 迁移不碰既有测试。
- [x] 校验面已逐条比对（validate.ts 实测）：
  - 五必需节精确名 `Fixed system`/`Variable system`/`Anti-identity`/`Tone`/`Recipe` → D-e 节名归一映射覆盖旧文件全部节名变体（中文括号版 + 英文括号版）。
  - `applicable_to` 引用完整性按 mode id（knownModeIds 含 general）→ D-d 改写 [longform]。
  - hex 启发式：v3 正文三个 6 位合法 hex 不触发拦截（逐个人工核对，2026-08-31）。
  - 字体白名单只查 frontmatter 的 font/lettering/pairing 键——三份 frontmatter 均不含这些键，不触发。
  - type size 正则 `/^\d+x\d*$/`：750x / 1080x HUG 形态合法。
- [x] T-A2/T-A4 重叠已裁决：D-a 三段吸收（机制 T43 / 骨架 T44 / 内容 T-C2），登记含注记。
- [x] 迁移取舍对照 S2 §5 迁移清单逐条落实：v3 保留为模板基准=迁；editorial/solid=迁（Recipe no-op，补齐挂 T-C3）；casual_v1=不迁（D-b）；watercolor v0/v1/v2 + v1_center_left=退役不进文件集（git 历史留存，无需动作）；目录扩张=不做。
- [x] 三件套立项即建档（本文 + T44-verify.md），无占位禁词（`（待）`/`（待 subagent`/`待 owner 触发` 形态均未使用）。

## 2. 实现段自检（收口时填写）

（实现完成后重写：C1-C5 逐条证据 + 门禁输出 + 全量回归对照。）

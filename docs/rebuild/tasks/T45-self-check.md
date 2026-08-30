<!--
  写作纪律（改本文前必读）：
  - 事实性声明必须附核验命令 + 日期，否则标为【假设】
  - 计划被实测推翻时，直接改本文为新版本，完整理由记入 records/ 子文档
  - 本文只保留当前态，不保留修正历史
  - 改完后刷新本文头部的「状态」字段
  - 详细规则见 docs/rebuild/05-process.md §4
-->

# T45 自检 · manifest 投影改源 + brand 链退役（S4 W1 / T-A3）

> **状态**：🔄 进行中（立项段已自检；实现段收口时重写本文） | **时间**：2026-08-31 立项 | **负责人**：主 agent
> **关联**：[T45-plan.md](T45-plan.md)（验收标准 C1-C6 以其 §4 为准）

## 1. 立项段自检（2026-08-31）

- [x] 消费面全景实证（逐一 Read/grep，2026-08-31）：service.ts（:45/:121/:209/:408）、server.ts（:246/:273）、prompt-overlay.ts（:16 + 文案）、mode-selection.ts（fetch+类型+符号）、ChatStyleProfileSelect.vue（只读 profiles 平铺）——共 5 文件，全部列入 T45-plan §1 表。
- [x] 测试/脚本零消费旧端点与 overlay：`grep -rln "buildMarketingOverlay|brand/manifest|brandManifest|getBrandManifest" tests/ scripts/ tools/` 无命中（2026-08-31）→ 更名无测试面连锁。
- [x] smoke:pi 脚本不涉端点：`grep -rn "brand" scripts/ tools/` 无命中（2026-08-31）。
- [x] docs 历史档案（T24 三件套、01 旧五环表）含旧端点字面——封存记录不改，已在 C2 口径中显式豁免。
- [x] studio 注册表公共 API 复核：`getStudioRegistry(rootDir)` 走约定目录（内置 `<rootDir>/src/app/ai/pi-backend/studio/` + 用户 `~/.openpencil/studio/`），与 service.ts 的 rootDir 注入模型一致（brand/index.ts 同先例）。
- [x] 信任边界两处维持：profile body 不下发（T24 D7）+ failures 绝对路径不下发（本任务新增相对化，D-a）。
- [x] 中间态明确：base.md 未落位 → manifest.failures 恒含 base 缺失一条（D-g），T44 钉扎测试不动。
- [x] 三件套立项即建档（本文 + T45-verify.md），无占位禁词。

## 2. 实现段自检（收口时填写）

（实现完成后重写：C1-C6 逐条证据 + 门禁输出 + 实证截图索引 + 全量回归对照。）

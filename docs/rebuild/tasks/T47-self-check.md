<!--
  写作纪律（改本文前必读）：
  - 事实性声明必须附核验命令 + 日期，否则标为【假设】
  - 计划被实测推翻时，直接改本文为新版本，完整理由记入 records/ 子文档
  - 本文只保留当前态，不保留修正历史
  - 改完后刷新本文头部的「状态」字段
  - 详细规则见 docs/rebuild/05-process.md §4
-->

# T47 自检 · W1 收口后修正批：base 转写源切换 + workbench 归档迁移 + 生图路线乙登记

> **状态**：🔄 立项段完成 | **时间**：2026-08-31 立项 | **负责人**：主 agent
> **关联**：[T47-plan.md](T47-plan.md)（验收标准 C1-C7 以其 §4 为准）

## 1. 立项段自检（2026-08-31）

- [x] 指令来源复核（2026-08-31，本会话原文）：#6「base 现在复制的是 system-prompt.md，而不是 system-prompt-base.md，请改过来，应该要暂用更加 workflow 无关的 system-prompt-base.md」；#4「workbench 目录是已经搁置的 DSH plugin 形态产品路线的遗留物，如果有误导应该改名 + 错误放置的文件迁移出来」；#1「生图走路线乙，自写 GPT image 2 形状 provider 作为当前核心 provider，pi-ai 的 generateImages 作为未来可拓展支持项，DMX 不走 pi-ai，不用做探针任务」。
- [x] #6 目标文件实证（2026-08-31）：`src/app/ai/pi-backend/prompts/system-prompt-base.md` 存在（`wc -l` = 119；T24 头注自述「marketing 模式 base 段，移植自上游 fork」）；modes.ts:43 实证 marketing basePromptPath 已指此文件。119 行源无 `# Example: mobile app UI` 锚点（grep 0 命中）→ 补洞段位置决策 = 文末（D-b）。
- [x] #4 目录来历实证（2026-08-31）：workbench/README.md 首行「openpencil-marketing（workbench/）… dsh bundle」+ cordis.patch.yml/presets/src 俱全 → DSH plugin 路线遗留物坐实；`.github/workflows/ci.yml:151-186` workbench-build job 在役（路径须随改名更新）；lint/format:check 范围均不含 workbench/（package.json:27/30 实证，改名零门禁联动）；workbench/.gitignore 自包含（node_modules/lib/assets，随目录走）。
- [x] #4 混入清单盘点（2026-08-31，`ls workbench/`）：T43-T46 期间混入 = build-t46-base.mjs、verify-t44/t45/t46 三件、verify-t45-manifest-dump.json、probe-sp-a1/sp-b/sp-c/t41/t45-old-route 五件、t45-rewire-assembly-smoke.py、t45/t46-failures.txt 两件、t45/t46-regression-run.log 两件（.log 未入库）。
- [x] #1 旧仓形状实证（2026-08-31）：`open-pencil/packages/core/src/tools/image-gen/providers.ts:79-217`——baseURL dmxapi.cn/v1、model gpt-image-2-ssvip、`/images/generations` + `/images/edits`；pi-ai 侧 openrouter-images 为 dist/api 唯一图像模块（`ls` 实证无 images/generations 模块）→ 路线分叉判据成立，路线乙 = 自写 provider。
- [x] 文档引用面盘点（2026-08-31，grep workbench）：docs/rebuild 下 T41/T44/T45/T46 三件套 + spike 06 共 ~25 处引用，实现段逐文件改写并清单化。
- [x] S4 修文点位盘点（2026-08-31）：§2 SP 表 SP-a 行（L19）、§3 补洞行（L33）、§4 T-A5 行（L44）、§7 双源收编行 + 新增生图 provider 行。

<!--
  写作纪律（改本文前必读）：
  - 事实性声明必须附核验命令 + 日期，否则标为【假设】
  - 本文只保留当前态，不保留修正历史
  - 详细规则见 docs/rebuild/05-process.md §4
-->

# T51 核验 · CI 第三轮修复（GHOST silhouette + steiger 架构门禁首跑合规化）

> **状态**：✅ 已完成（2026-08-31 收口） | **时间**：2026-08-31 立项 | **负责人**：主 agent

## 1. 核验范围

run 33387675445 两红的全部处置项，对 T51-plan §3 验收标准逐条核验（2026-08-31，全部 unpiped 直读退出码）。

## 2. 验收核验

| # | 验收项 | 结果 | 证据 |
|---|---|---|---|
| V1 | check:arch 零违规 | ✅ | `bun run check:arch`：✔ No problems found，exit 0 |
| V2 | check:zones 纯度 | ✅ | 73 modified / 405 added / 1019 deleted 全登记（含 silhouette GHOST），0 renamed cross-checked，exit 0 |
| V3 | 三保真核验新位置 | ✅ | t44 21 pass/0 fail；t46 3 passed（含逐字零 diff 硬卡口）；t48 9 pass/0 fail |
| V4 | 迁移后测试 | ✅ | `bun test tests/engine/rebuild/` 26/26（builtin-assets 深度锚修正后转绿） |
| V5 | 引用零残留 | ✅ | 旧 12 路径全仓 grep 零命中（docs/spikes/tools/tests/src/packages） |
| V6 | 全门禁 + CI 逐 push 口径 | ✅ | check:zones/docs/tasks/bindings、build:packages→lint、tsgo、check:vue、format:check、check:i18n、check:packages、check:deps、check:monorepo、test:tools、test:dupes、check:arch、test:type-shapes exit 0；check:tasks/check:bindings --base HEAD~1 exit 0 |

## 3. 处置映射（收口证据清单）

| run 33387675445 失败 | 处置 | 证据 |
|---|---|---|
| GHOST silhouette-autopsy.test.ts | 跟随上游 379ef8b6 删除 + deletedPaths 第 119 条 | C1 |
| steiger prefer-domain-folders ×3 组 | probes sp×3 → sp/ 子目录；studio×3 → studio/ 子目录；verify×4 → src/verify/（合并 strict-tools-layout 同消） | C2/C7 |
| steiger strict-tools-layout ×6 | 同上 + build-t46-base → src/ + cn build → src/ | C2/C7 |
| steiger no-native-title ×2（1 err 1 warn） | FontsSettingsPanel 两处 title 换 Tip 包裹 | C5 |
| （同步骤掩盖）test:type-shapes Windows ENOENT | files.ts 缺失根 existsSync 跳过（P50 扩注） | 自检 §3.3 |

## 4. 遗留与边界

- probe-t41/probe-t45 两探针留存 spikes/probes/ 根（前缀组 ×2 未达 ≥3 阈值，规则合规）。
- verify-t45-manifest-dump.json（数据文件）与 t45-rewire-assembly-smoke.py 留存 tools/rebuild/ 根（.json/.py 不在 TEXT_EXTENSIONS，strict-tools-layout 不覆盖）。
- 探针脚本（sp×3）为手动 spike 工件，门禁不执行；路径独立性以 import 解析审计为准（仅 sp-b 有相对 import 已修正），未逐个实跑（sp-a1 需网络/sp-b 起服务）。
- T50 自检 §3 的流程建议（check:tasks 预演口径 / lint 前置 build:packages / 推前 fetch upstream）与本任务 §3.2（job 内全步骤预演）合计四条，是否固化进 05-process.md 待 owner 拍板。

<!--
  写作纪律（改本文前必读）：
  - 事实性声明必须附核验命令 + 日期，否则标为【假设】
  - 计划被实测推翻时，直接改本文为新版本，完整理由记入 records/ 子文档
  - 本文只保留当前态，不保留修正历史
  - 改完后刷新本文头部的「状态」字段
  - 详细规则见 docs/rebuild/05-process.md §4
-->

# tracker · 重建跟踪表（活文档·精简索引）

> **状态**：已核验 | **时间**：2026-08-25 | **核验人**：主 agent
> **身份**：阶段门 + 任务表（当前任务行 + 已收口分组行，D31；逐任务索引真源 = [tasks/_index.md §2](tasks/_index.md)）+ 记录索引三块合一（≤80 行预算）。详细记录见 `records/` 子文档。更新纪律见 `05-process.md §4`。
> **状态值**：⬜未开始 / 🔄进行中 / ✅完成 / ❌阻塞 / 🪦放弃

## 1. 阶段门

| 阶段                  | 出口标准（摘要）                                                                        | 状态 | 完成日期         | 验收签字                       |
| --------------------- | --------------------------------------------------------------------------------------- | ---- | ---------------- | ------------------------------ |
| pre-0 文档集          | 文档核查 + review 修正完成（R1-R4）                                                     | ✅   | 2026-08-18 14:00 | 待 owner                       |
| Phase 0 机制+减法     | [02-phase-0.md §5](02-phase-0.md) 七条验收（实测结果已填）                              | ✅   | 2026-08-19 16:30 | 待 owner（远端 CI 验证后补签） |
| Phase 1 runtime spike | [03-phase-1-runtime.md](03-phase-1-runtime.md) Q0-Q3 有代码答案（SP-7/SP-8 离线面全绿）+ runtime 选型拍板（D24 拍 pi，2026-08-23）；原判据「能力契约测试绿」全仓无定义（grep 零命中，2026-08-25），已漂移废止——spike 验收以 T11-T13 plan 验收清单实录为准 | ✅   | 2026-08-23（D24 拍板；spike 完成 = T11-T13，X 线随 D24 搁置，pi 线 T18-T25 续建） | —                              |
| Phase 2 F0 地基切片   | [01-target-state.md §3](01-target-state.md) hello-tool 验收：hello-tool 全链已通（T20，一句话 → AI 建 frame → 回复可见）；F0.1-F0.6 已在 T19-T25 建成（F0.1/F0.4→T19、F0.2→T20、F0.3→T21、F0.5→T22/T23、F0.6→T24），出口全数达成（F0.7 脆依赖随 T10 消除；生图独立凭证链随 D32 移层 1 C3a） | ✅   | 2026-08-25       | owner（2026-08-25 拍板）        |
| Phase 3 最小价值闭环  | [01-target-state.md §4](01-target-state.md) 层 1 验收（2026-08-25 owner 拍板新口径：C1a-C5a 五环各配一条端到端冒烟且全绿 + smoke:pi 批次全绿 + CI 绿；原 16 测试文件口径宿主随 T10 消失已废止） | ⬜   | —                | —                              |
| Phase 4 增强补齐      | [01-target-state.md §5](01-target-state.md) 层 2 逐块进                                 | ⬜   | —                | —                              |
| parity 切换           | [01-target-state.md §8](01-target-state.md)，owner 决定                                 | ⬜   | —                | —                              |

## 2. 任务表（当前任务行 + 已收口分组行；逐任务索引真源 = [tasks/_index.md §2](tasks/_index.md)——D31）

> **T08 整改**：删除 PR 列。本仓库 `docs/rebuild/` 范围**不采用 PR 管理**——任务以 commit + 任务表登记为唯一载体。详见 [T08-plan.md §1.1](tasks/T08-plan.md)。

> **两区结构（D31，2026-08-25）**：逐任务索引真源 = [tasks/_index.md §2](tasks/_index.md)（每任务一行含三件套路径，永久保留）；本表 = 当前任务行（逐任务登记）+ 已收口任务分组行（同类项跨行合并，末三列不填三件套）。已收口任务详情由 _index.md 与三件套回溯，不挤占本表空间。

| T 编号 | 块                         | 内容                                                                                                                                                                                                                                                                        | 验收                                                                                              | 状态                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | plan                          | self-check                                | verify                            |
| ------ | -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------- | ----------------------------------------- | --------------------------------- |
| T00-T09 | 文档治理+CI 基建 | 文档集首轮整改 R1-R4 → review 修复收口（tracker 拆分、[05-process.md §5](05-process.md) 迁移、三件套物理拆分、LFS cache、删 PR 列、CI 接线，10 任务全 ✅） | 逐任务验收与三件套见 [tasks/_index.md §2](tasks/_index.md) | ✅ | — | — | — |
| T10-T13 | upstream 合并+Phase 1 spike | upstream/master@5201404f 合并（79 commits/864 文件）+ S-pi / S-X 双 spike + D22 拍板后 X 线收口（4 任务全 ✅） | 同上 | ✅ | — | — | — |
| T14-T17 | Phase 1-X 实施 | 插件骨架产品化 / 编辑器入孤岛 / 7600 桥真链路+token 链 / ChatPanel 消费 SessionFace（4 任务全 ✅；X 线随 D24 搁置归档） | 同上 | ✅ | — | — | — |
| T18-T25 | Phase 1-pi 实施（F0 地基切片） | pi SDK 主线启动（D24）→ 后端换心 → hello-tool 全链 → provider/凭据管理 → session↔file 绑定 → 会话切换 UI → prompt 装配（F0.6）→ 浏览器旧路径清扫（8 任务全 ✅，hello-tool 全链已通） | 同上 | ✅ | — | — | — |
| T26-T29 | 三方 review 整改+决策批落地 | 三方 review 文档面/代码面逐条整改（43+32 条全闭环）+ owner 2026-08-25 决策批 15 项代码面/文档面落地（4 任务全 ✅） | 同上 | ✅ | — | — | — |
| T30 | 文档治理 | 01 推进规划重整（Phase 规划入 [01-target-state.md §2](01-target-state.md)、[01-target-state.md](01-target-state.md) 原三路线对比节迁 [03-phase-1-runtime.md §4.4](03-phase-1-runtime.md)、去补丁式备注）+ 04/05 文档纪律轮 + 本表合并压缩与真源互换（D30/D31） | [T30-plan.md 验收标准](tasks/T30-plan.md) | 🔄 | [T30-plan](tasks/T30-plan.md) | [T30-self-check](tasks/T30-self-check.md) | [T30-verify](tasks/T30-verify.md) |
| T31 | upstream 合并第二轮 | upstream/master@88c10770 合并（8 commits/188 文件，内容裁定替代 git 三路合并——HTTPS 数据面断）：vector rename + clipboard 加固 + tool-state + recovery 四 commit 快进 + diagnostics/portless/changelog/cli 四 commit 维持删除 | ✅ 已完成（C1-C5 全过：内核四 commit 快进 + 删除区零复活 + 门禁 14 件绿 + smoke:pi 80 断言；subagent 独立核验 V1-V5「可以收口」；远端 CI 链 staging 32861755654 + 32863770126 + rebuild/pi 32864065492 + verify 32918297304 全 success，`gh run view` 复验 2026-08-26） | ✅ | [T31-plan](tasks/T31-plan.md) | [T31-self-check](tasks/T31-self-check.md) | [T31-verify](tasks/T31-verify.md) |
| T32 | zones 边界纠正 + check.ts 机制改造 | vector 15 + P62-P82 中 18 枚 byte 一致错位 → 转 `upstreamMergeTarball`（base=88c10770, paths=42, deletedPaths=3）；5 个真实自有 ownedFile 补 P98-P102 patch 溯源；P60/P61/P74 保留 patch（确有本地改动）；12 个上游已删 ghost 文件物理清理（11 个 e2e snapshot + 1 个 AppButton.vue）；AppTextButton.vue 改 ownedFile（过渡态：上游删但本地 4 importer 在用，下一轮 chat/settings 迭代改用 AppButton.vue）；check.ts 新增 5 个函数（`checkUpstreamMergeTarball` / `checkRenames` / `checkGhostDeleted` / `checkDriftTarball` / `collectRenames`）+ 改 `collectChanges -M` rename detection + 改 `main()` 装配；[04-porting-discipline.md §5 三态边界判定](04-porting-discipline.md) 新增 + [02-phase-0.md §3.3 末尾](02-phase-0.md) 补充 | ✅ 已完成（C1-C13 全过：42 处 byte 一致错位转 tarball + 5 自有补 P98-P102 溯源 + 12 ghost 清理 + check.ts 五函数根治 L1-L4 + drift 升红 F1；subagent 独立核验 V1-V5 全过「可以收口」；远端 CI 414d37d8 双链 success，`gh api` 复验 2026-08-26） | ✅ | [T32-plan](tasks/T32-plan.md) | [T32-self-check](tasks/T32-self-check.md) | [T32-verify](tasks/T32-verify.md) |
| T33 | localhost 分发骨架 | 生产编排器 [host.ts](../src/app/ai/pi-backend/host.ts)（静态托管 + /api/pi 流式反代 + 桥/后端 spawn + token 注入）+ spawn.ts P104 运行时 token hook + runtime.ts P105 canConnect 放行 + package.json serve script（P103）——bun run build && bun run serve 一条链起全栈 | ✅ 已完成（C1-C6 全过：host.ts 三职能 + P103-P105；冒烟实测浏览器建矩形全链（截图存证）+ 门禁全套绿 + smoke:pi 80 断言；subagent 独立核验 V1-V5「可以收口」；远端 CI 7886a8f3 success，`gh api` 复验 2026-08-26） | ✅ | [T33-plan](tasks/T33-plan.md) | [T33-self-check](tasks/T33-self-check.md) | [T33-verify](tasks/T33-verify.md) |
| T34 | 上游合并第三轮 | octopus 8 commits（`88c10770` `fix(cli)` / `a0a71c34` `docs` / `7a311677` `fix(editor) clipboard` / `b65b1bd4` `fix(chat) isError` / `5f8a373b` `feat(diagnostics)` / `bb8c5c18` `fix(editor) vector drags` / `f75d67ad` `feat(app) crash recovery` / `0f981ff2` `fix(mcp) Portless isolation`）；24 个冲突三类解（modify/delete 6 取我们删侧 + dialogs.json 8 [zh-cn 保留 pi 段 / 7 个 de/es/fr/it/ja/pl/ru 删除] + content 10 三方手合 / git 自动合 / git checkout HEAD）；[host.ts spawnBridge](../src/app/ai/pi-backend/host.ts) 决策注记——不跟 OPENPENCIL_MCP_DISCOVERY_PATH 隔离（生产形态端口独占不存在多实例场景）；AppTextButton.vue 误删纠正 + zones 误判纠正（checkDeletedAbsent 已覆盖删除方向）| ✅ 已完成（C1-C10 全过：merge 完整 / 24 冲突 grep 实测 / AppTextButton 恢复后 check:deps 绿 / zones 合规 / host.ts 注记 / 11 项门禁 exit 0 / typecheck + lint 0 errors / smoke:pi 80 passed / subagent V1-V8 全 ✅；远端推送阻塞——环境网络层 github.com 不通，待 owner 协助；本机 HEAD=`9a22d276`） | ✅ | [T34-plan](tasks/T34-plan.md) | [T34-self-check](tasks/T34-self-check.md) | [T34-verify](tasks/T34-verify.md) |

## 3. 记录索引

> **两层结构**（[05-process.md §4.10 D14 + §4.11 D15](05-process.md)）：`records/narrative/` 物理绑定层（与文件 1:1）+ `records/topics/` 主题聚合层（跨文件横向档案）。**权威列表见 [`records/_index.md`](records/_index.md)**——本文档不重复维护。

### 3.1 narrative/ 物理绑定层

按物理文件 1:1 绑定（每个被治理文件一份 `records/narrative/<file>.md`）。完整列表见 [records/_index.md §2](records/_index.md)。计数（`find docs/rebuild/records/narrative -type f | wc -l` 实测 = 15，2026-08-25）：6 个核心叙事文档（00-05）+ README + tracker + runbook-github-push + 5 个 spike + 1 个 proposal = 15 份 narrative 档案。

### 3.2 topics/ 主题聚合层（横向档案）

按主题跨文件聚合（10 份：agent-runtime / brand-config / chat-ui / i18n / tools-marketing / tools-image-gen / upstream-merge / ci-infra / spikes / docs-governance）。完整列表（含主要记录类型列）见 [records/_index.md §3](records/_index.md)——权威列表单源维护，本处不重复（2026-08-25 去重，决策批 #8 行数治理）。

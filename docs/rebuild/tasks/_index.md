<!--
  写作纪律（改本文前必读）：
  - 事实性声明必须附核验命令 + 日期，否则标为【假设】
  - 计划被实测推翻时，直接改本文为新版本，完整理由记入 records/ 子文档
  - 本文只保留当前态，不保留修正历史
  - 改完后刷新本文头部的「状态」字段
  - 详细规则见 docs/rebuild/05-process.md §4
-->

# tasks · 任务档案索引

> **状态**：已核验 | **时间**：2026-08-31 | **核验人**：主 agent
> **身份**：task 维度档案的入口。**每个 task 三件套物理拆分**——`tasks/T<NN>-plan.md` / `tasks/T<NN>-self-check.md` / `tasks/T<NN>-verify.md`，CI 用 `existsSync` 逐个检查。
> **与 [tracker.md §2 任务表](../tracker.md) 的关系**：本文 §2 任务清单是**逐任务索引真源**（每任务一行含三件套路径，永久保留——D31，2026-08-25）；tracker.md §2 是阶段门视角摘要（当前任务行 + 已收口分组行）。如有不一致以本文为准。
> **与 records/narrative/ 的关系**：task 维度 vs 文件维度，**严格分离**——task 自检/核验不进 records/，文件腐烂/修正也不进 tasks/。详见 [05-process.md §3.2 + §4.11](05-process.md)。

## 1. 编号规则（D15）

| 类型      | 前缀                  | 规则                   | 示例              |
| --------- | --------------------- | ---------------------- | ----------------- |
| task 计划 | `T<NN>-plan.md`       | 任务清单 + 验收标准    | T03-plan.md       |
| task 自检 | `T<NN>-self-check.md` | 主 agent 自检 + 完成度 | T03-self-check.md |
| task 核验 | `T<NN>-verify.md`     | subagent 独立核验报告  | T03-verify.md     |
| 编号      | T<NN>                 | 全局递增，从 T00 开始  | T04               |

**禁止**：单文档 `T<id>-<slug>.md` + 章节正则形式（章节可以是占位，CI 误判率非零）——D15 决策核心。

## 2. 任务清单（逐任务索引真源；tracker.md §2 摘要见 [tracker.md](../tracker.md)）

> **两区结构**（2026-08-25 决策批 #8 归档机制 + D31 合并压缩）：本节 §2 = 逐任务索引真源，永久保留每任务一行；tracker.md §2 = 当前任务行 + 已收口任务分组行（同类项跨行合并）。T00-T20 行状态列长实录归档于 §6。

| T 编号                      | 块                         | 标题                                                                                                                    | 状态                                                                                                                                         | plan                             | self-check                                   | verify                               |
| --------------------------- | -------------------------- | ----------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- | -------------------------------------------- | ------------------------------------ |
| [T00](../tasks/T00-plan.md) | 文档治理                   | 文档集首轮整改（R1-R4 核查轮）                                                                                          | ✅ 已完成（历史回填）                                                                                                                        | [T00-plan](../tasks/T00-plan.md) | [T00-self-check](../tasks/T00-self-check.md) | [T00-verify](../tasks/T00-verify.md) |
| [T01](../tasks/T01-plan.md) | 文档治理                   | 文档体系整改（plan-correction / tracker拆分 / check-docs / binding / tasks）                                            | ✅ 已完成（待 owner 验收）                                                                                                                   | [T01-plan](../tasks/T01-plan.md) | [T01-self-check](../tasks/T01-self-check.md) | [T01-verify](../tasks/T01-verify.md) |
| [T02](../tasks/T02-plan.md) | 文档治理                   | 文档纪律二次检查（[05-process.md §5](../05-process.md) 迁移 + check-tasks 增强）                                        | ✅ 已完成（CI 11/11 全绿）                                                                                                                   | [T02-plan](../tasks/T02-plan.md) | [T02-self-check](../tasks/T02-self-check.md) | [T02-verify](../tasks/T02-verify.md) |
| [T03](../tasks/T03-plan.md) | 文档治理                   | [05-process.md §4.10](../05-process.md) 文件↔record 一一对应纪律补漏（D14 决策落地）                                    | ✅ 已完成（CI 11/11 全绿 + subagent A 18/18 通过）                                                                                           | [T03-plan](../tasks/T03-plan.md) | [T03-self-check](../tasks/T03-self-check.md) | [T03-verify](../tasks/T03-verify.md) |
| [T04](../tasks/T04-plan.md) | 文档治理                   | task 纪律 CI 强化（D15 三件套物理拆分 + 任务表路径检查）                                                                | ✅ 已完成（CI 11/11 全绿 + subagent A 21/21 通过）                                                                                           | [T04-plan](../tasks/T04-plan.md) | [T04-self-check](../tasks/T04-self-check.md) | [T04-verify](../tasks/T04-verify.md) |
| [T05](../tasks/T05-plan.md) | 文档治理                   | 00-05 系统性腐烂 review（外部 proposal 内化 + 05 §2 树状图重写 + D16 候选登记 + D17 本机绝对路径清理）                  | ✅ 已完成（CI 11/11 全绿 × 2 + subagent A 19/19 通过）                                                                                       | [T05-plan](../tasks/T05-plan.md) | [T05-self-check](../tasks/T05-self-check.md) | [T05-verify](../tasks/T05-verify.md) |
| [T06](../tasks/T06-plan.md) | CI 基础设施                | LFS cache 启用（每次 push 节省 ~99% 上游 LFS 流量）                                                                     | ✅ 已完成（setup-bun action.yml 加 actions/cache@v6）                                                                                        | [T06-plan](../tasks/T06-plan.md) | [T06-self-check](../tasks/T06-self-check.md) | [T06-verify](../tasks/T06-verify.md) |
| [T07](../tasks/T07-plan.md) | 文档治理                   | 修正 §4.10 应用错误（横向档案 narrative 绑定撤回）+ 高频腐烂防御                                                        | ✅ 已完成（核验由 T09 回填：12 通过 + 1 警告）                                                                                               | [T07-plan](../tasks/T07-plan.md) | [T07-self-check](../tasks/T07-self-check.md) | [T07-verify](../tasks/T07-verify.md) |
| [T08](../tasks/T08-plan.md) | 文档治理                   | tracker.md 任务表删 PR 列（owner 提议）                                                                                 | ✅ 已完成（CI 11/11 全绿 + subagent A 12/12 通过）                                                                                           | [T08-plan](../tasks/T08-plan.md) | [T08-self-check](../tasks/T08-self-check.md) | [T08-verify](../tasks/T08-verify.md) |
| [T09](../tasks/T09-plan.md) | 文档治理+CI 基建           | review 发现核实与修复（CI 接线 + 占位检测 + 腐烂修正 + T06/T07 核验回填）                                               | ✅ 已完成（CI 12/12 全绿含新 job + subagent A 核验 N1-N5 闭环）                                                                              | [T09-plan](../tasks/T09-plan.md) | [T09-self-check](../tasks/T09-self-check.md) | [T09-verify](../tasks/T09-verify.md) |
| [T10](../tasks/T10-plan.md) | upstream 合并+Phase 1 启动 | upstream/master@5201404f 合并 + D20 登记 + spike 任务登记                                                               | ✅ 已完成（远端 CI run 32458703514 12/12）                                                                                                   | [T10-plan](../tasks/T10-plan.md) | [T10-self-check](../tasks/T10-self-check.md) | [T10-verify](../tasks/T10-verify.md) |
| [T11](../tasks/T11-plan.md) | Phase 1 runtime            | S-pi spike（pi sdk 库形态四项验证）                                                                                     | 🔶 离线面全过（subagent 核验讫）；活模型面阻塞待 owner 补 key                                                                                | [T11-plan](../tasks/T11-plan.md) | [T11-self-check](../tasks/T11-self-check.md) | [T11-verify](../tasks/T11-verify.md) |
| [T12](../tasks/T12-plan.md) | Phase 1 runtime            | S-X spike（dsh-X 六项验证含硬 gate）                                                                                    | ✅ 已完成（CI run 32560998564 12/12；X5 硬 gate 通过；模型面阻塞已上报）                                                                     | [T12-plan](../tasks/T12-plan.md) | [T12-self-check](../tasks/T12-self-check.md) | [T12-verify](../tasks/T12-verify.md) |
| [T13](../tasks/T13-plan.md) | Phase 1-X 收口             | 双 spike 合并回归 + dsh 版本钉扎纪律 + S-X 模型面补跑                                                                   | ✅ 已完成（合并回归+版本纪律 CI run 32563228158 全绿；X3/X6 模型面 2026-08-23 以 openrouter/free 实测通过；S-pi 模型面随 pi 产品版后置 D22） | [T13-plan](../tasks/T13-plan.md) | [T13-self-check](../tasks/T13-self-check.md) | [T13-verify](../tasks/T13-verify.md) |
| [T14](../tasks/T14-plan.md) | Phase 1-X 实施             | 插件骨架产品化（MS-X1：workbench/ bundle 骨架 + dev 回路 + HMR 证伪）                                                   | ✅ 已完成（装机冒烟 + HMR A 级证伪 + CI job；CI run 32569154626 全绿）                                                                       | [T14-plan](../tasks/T14-plan.md) | [T14-self-check](../tasks/T14-self-check.md) | [T14-verify](../tasks/T14-verify.md) |
| [T15](../tasks/T15-plan.md) | Phase 1-X 实施             | M2 编辑器入孤岛（E1 CanvasKit wasm 探针 → E2 外壳 → E3 生命周期 → E4 收口）                                             | ✅ 已完成（E1-E4 全过 + subagent 核验 V1-V8；CI run 32576137352 全绿）                                                                       | [T15-plan](../tasks/T15-plan.md) | [T15-self-check](../tasks/T15-self-check.md) | [T15-verify](../tasks/T15-verify.md) |
| [T16](../tasks/T16-plan.md) | Phase 1-X 实施             | 7600 桥真链路 + token 链（M3+M4 链路半）                                                                                | ✅ 已完成（B1-B4 全过 + subagent 核验 V1-V8；CI run 32579903008 全绿）                                                                       | [T16-plan](../tasks/T16-plan.md) | [T16-self-check](../tasks/T16-self-check.md) | [T16-verify](../tasks/T16-verify.md) |
| [T17](../tasks/T17-plan.md) | Phase 1-X 实施             | ChatPanel 消费 SessionFace（M3 消息回路半）                                                                             | ✅ 已完成（C1-C5 全过 + subagent 核验 V1-V8；CI run 32611136517 全绿）                                                                       | [T17-plan](../tasks/T17-plan.md) | [T17-self-check](../tasks/T17-self-check.md) | [T17-verify](../tasks/T17-verify.md) |
| [T18](../tasks/T18-plan.md) | Phase 1-pi 启动            | pi SDK 主线启动：分支 + 钉扎 + S-pi 模型面补跑                                                                          | ✅ 已完成（P1-P4 全过 + subagent 核验 V1-V8；CI run 32627633002 全绿）                                                                       | [T18-plan](../tasks/T18-plan.md) | [T18-self-check](../tasks/T18-self-check.md) | [T18-verify](../tasks/T18-verify.md) |
| [T19](../tasks/T19-plan.md) | Phase 1-pi 实施            | 后端换心：pi service + SSE 契约 + Chat 类零改动                                                                         | ✅ 已完成（V1-V8 全过 + CI 32637559364 全绿）                                                                                                | [T19-plan](../tasks/T19-plan.md) | [T19-self-check](../tasks/T19-self-check.md) | [T19-verify](../tasks/T19-verify.md) |
| [T20](../tasks/T20-plan.md) | Phase 1-pi 实施            | 工具链路：后端独立进程化 + hello-tool 全链 + 工具事件映射                                                               | ✅ 已完成（V1-V8 全过 + CI 32645061123 全绿）                                                                                                | [T20-plan](../tasks/T20-plan.md) | [T20-self-check](../tasks/T20-self-check.md) | [T20-verify](../tasks/T20-verify.md) |
| [T21](../tasks/T21-plan.md) | Phase 1-pi 实施            | pi 原生 provider/凭据管理 + 全量 core tools + system prompt + 环绕补齐（undo/step budget）                              | ✅ 已完成（V1-V7 全过 + CI 32656186119 全绿）                                                                                                | [T21-plan](../tasks/T21-plan.md) | [T21-self-check](../tasks/T21-self-check.md) | [T21-verify](../tasks/T21-verify.md) |
| [T22](../tasks/T22-plan.md) | Phase 1-pi 实施            | session↔file 绑定（docUuid 身份 + 会话族谱 + 历史回填 + 工具目标注入）                                                  | ✅ 已完成（V1-V6 全过；CI 32687026233 原记「全绿」不实——2026-08-25 复验两 run 均 failure（format:check 红），被 T23 顺带吸收，更正实录见 [tracker.md §2 T22 行](../tracker.md) 与 records/topics/ci-infra.md CI-12）                                                                                                | [T22-plan](../tasks/T22-plan.md) | [T22-self-check](../tasks/T22-self-check.md) | [T22-verify](../tasks/T22-verify.md) |
| [T23](../tasks/T23-plan.md) | Phase 1-pi 实施            | 会话查看/切换 UI（族谱清单 + ChatPanel 会话栏下拉）                                                                     | ✅ 已完成（V1-V6 全过 + CI 32695035580 全绿）                                                                                                | [T23-plan](../tasks/T23-plan.md) | [T23-self-check](../tasks/T23-self-check.md) | [T23-verify](../tasks/T23-verify.md) |
| [T24](../tasks/T24-plan.md) | Phase 1-pi 实施            | prompt 装配（四层抽象：AgentMode 建会话烘焙 base/工具集 + per-run 工作流段 + per-run profile overlay + brand 种子薄切） | ✅ 已完成（V1-V6 全过 + CI 32713950013 全绿）                                                                                                | [T24-plan](../tasks/T24-plan.md) | [T24-self-check](../tasks/T24-self-check.md) | [T24-verify](../tasks/T24-verify.md) |
| [T25](../tasks/T25-plan.md) | Phase 1-pi 实施            | 浏览器旧路径清扫（三路径收敛 pi 单路径 + 旧设置面切除 + VITE_PI_BACKEND 门退役 + 一键启动）                             | ✅ 已完成（C1-C6 全过 + subagent 核验 V1-V6 可以收口）                                                                                                       | [T25-plan](../tasks/T25-plan.md) | [T25-self-check](../tasks/T25-self-check.md) | [T25-verify](../tasks/T25-verify.md) |
| [T26](../tasks/T26-plan.md) | 三方 review 整改（文档面） | 三方 review 文档叙事面逐条核实整改（T22 CI 假绿止损 + 阶段门重排 + 01 决策表同步 + 03 回血） | ✅ 已完成（43 条全闭环 + CI run 32809703730 success） | [T26-plan](../tasks/T26-plan.md) | [T26-self-check](../tasks/T26-self-check.md) | [T26-verify](../tasks/T26-verify.md) |
| [T27](../tasks/T27-plan.md) | 三方 review 整改（代码面） | 三方 review 代码与机制面整改（session 队列接力 + SSE abort + 崩溃复活 + 死数据面切除 + 检查器修正） | ✅ 已完成（32 条全闭环 + smoke:pi 80 断言全绿 + CI run 32812269846 success） | [T27-plan](../tasks/T27-plan.md) | [T27-self-check](../tasks/T27-self-check.md) | [T27-verify](../tasks/T27-verify.md) |
| [T28](../tasks/T28-plan.md) | 决策批落地（代码面） | owner 决策批代码面 6 项（pi 后端 bearer 鉴权 / session GC / oxfmt / smoke:pi 进 CI / 补丁过堂 / zones 报警） | ✅ 已完成（C1-C6 全过 + CI run 32831596110 success） | [T28-plan](../tasks/T28-plan.md) | [T28-self-check](../tasks/T28-self-check.md) | [T28-verify](../tasks/T28-verify.md) |
| [T29](../tasks/T29-plan.md) | 决策批落地（文档面） | owner 决策批文档面 10 项（补签补登 / CI-14 / 05 规则文 / 层 1 验收口径重建 / 根 README+AGENTS 指针） | ✅ 已完成（C1-C9 全过 + CI run 32834978183 success） | [T29-plan](../tasks/T29-plan.md) | [T29-self-check](../tasks/T29-self-check.md) | [T29-verify](../tasks/T29-verify.md) |
| [T30](../tasks/T30-plan.md) | 文档治理 | 01 推进规划重整（Phase 规划入 01 §2 + 原三路线对比节迁 03 §4.4 + 去补丁）+ 04/05 纪律轮 + tracker 合并压缩与真源互换 + F0.3② 归并 C3a（D30/D31/D32） | 🔄 进行中 | [T30-plan](../tasks/T30-plan.md) | [T30-self-check](../tasks/T30-self-check.md) | [T30-verify](../tasks/T30-verify.md) |
| [T31](../tasks/T31-plan.md) | upstream 合并第二轮 | upstream/master@88c10770 合并（vector/clipboard/tool-state/recovery 四 commit 快进 + 四 commit 维持删除 + i18n pi* key 合并回写） | ✅ 已完成（V1-V5 全过 + CI 四 run 链 success） | [T31-plan](../tasks/T31-plan.md) | [T31-self-check](../tasks/T31-self-check.md) | [T31-verify](../tasks/T31-verify.md) |
| [T32](../tasks/T32-plan.md) | zones 边界纠正 + check.ts 机制改造 | vector 15 + 18 patches byte 一致错位 → 转 upstreamMergeTarball + 5 个真实自有补 P98-P102 patch 溯源 + 12 个 ghost 物理清理 + AppTextButton.vue 改 ownedFile；check.ts 新增 5 函数根治 L1/L2/L3 + drift warn；04 §5 三态边界判定 | ✅ 已完成（V1-V5 全过「可以收口」+ CI 414d37d8 双链 success） | [T32-plan](../tasks/T32-plan.md) | [T32-self-check](../tasks/T32-self-check.md) | [T32-verify](../tasks/T32-verify.md) |
| [T33](../tasks/T33-plan.md) | localhost 分发骨架 | 生产编排器 host.ts + P103-P105（serve script / 运行时 token hook / canConnect 放行）——build+serve 一条链全栈，浏览器建矩形全链实测通过 | ✅ 已完成（V1-V5 全过「可以收口」+ CI 7886a8f3 success） | [T33-plan](../tasks/T33-plan.md) | [T33-self-check](../tasks/T33-self-check.md) | [T33-verify](../tasks/T33-verify.md) |
| [T34](../tasks/T34-plan.md) | 上游合并第三轮 | octopus 8 commits（`88c10770`→`0f981ff2`，含 diagnostics + crash recovery + Portless 隔离）；24 冲突三类解（modify/delete 6 取我们删侧 + dialogs.json 8 [zh-cn 保留 pi 段 / 7 个语种删] + content 10）；host.ts spawnBridge 决策注记（不跟 DISCOVERY_PATH 隔离）；AppTextButton 误删纠正 + zones 误判纠正（checkDeletedAbsent 已覆盖） | ✅ 已完成（V1-V8 全过「可以收口」+ CI 双链 success @ 29985845） | [T34-plan](../tasks/T34-plan.md) | [T34-self-check](../tasks/T34-self-check.md) | [T34-verify](../tasks/T34-verify.md) |
| [T35](../tasks/T35-plan.md) | pi 段迁回 fork seam + i18n 卫生整顿 | 27 条 pi 段 i18n 从 packages/vue 迁回 src/app/i18n/fork/（zh-cn.ts + en.ts 新建 piMessageDefaults）；撤销 P38/P40；PiModelsPanel.vue + ChatInput.vue 22 处调用改键；forkPiMessages + useForkPi hook 仿 useNotificationMessages | ✅ 已完成（V1-V4 全过，V5 占位字样清理后过 subagent 复验） | [T35-plan](../tasks/T35-plan.md) | [T35-self-check](../tasks/T35-self-check.md) | [T35-verify](../tasks/T35-verify.md) |
| [T36](../tasks/T36-plan.md) | T31/T34 合并质量整改 | 登记大扫除（zones.json P8/P60/P61/P98-P102 移除 + P74/P45 理由改写）+ diagnostics chat 级接线（transports.ts，owner 拍板①）+ changelog/cli import/portless 三静默反转追认（拍板②）+ mcp 僵尸 nav 清除（拍板③）+ 上游合并 SOP 12 条入 04 + check.ts 三条登记健康规则判红（拍板④） | ✅ 已完成（C1-C10 全过；verify V7 打回 1 项经复核为标准过宽翻正） | [T36-plan](../tasks/T36-plan.md) | [T36-self-check](../tasks/T36-self-check.md) | [T36-verify](../tasks/T36-verify.md) |
| [T37](../tasks/T37-plan.md) | 决策批次登记 | owner 两批 8 项拍板（2026-08-28）登记入 records：D1/D4/D6/D8 闭环 + D34-D37 新登（C3a 凭证链口径 / t21 CI 化 / narrative 豁免 / 预研集处置）；D36 配套 bindings.ts 豁免 + 05 §4.10 修订 | ✅ 已完成（C1-C6 全过；verify V1-V8 全绿） | [T37-plan](../tasks/T37-plan.md) | [T37-self-check](../tasks/T37-self-check.md) | [T37-verify](../tasks/T37-verify.md) |
| [T38](../tasks/T38-plan.md) | 三症状回归修复 | useForkPi 去 `as any` Ref 类型谎报（T35 引入，script 侧访问静默 undefined → 模型名/thinking 空白）+ pi-backend vite 插件注入同源 OPENPENCIL_MCP_DISCOVERY_PATH（T34 带入的上游 0f981ff2 discovery 隔离致工具桥断链）+ pi-dev-discovery 钉扎测试 + [04-porting-discipline.md](../04-porting-discipline.md) §6 SOP 第 13 条 | ✅ 已完成（门禁全绿 + smoke:pi 80/80；浏览器实证 V1-V4 三症状消失） | [T38-plan](../tasks/T38-plan.md) | [T38-self-check](../tasks/T38-self-check.md) | [T38-verify](../tasks/T38-verify.md) |
| [T39](../tasks/T39-plan.md) | 字体能力建设 | 字体注册表白名单（[font/registry.ts](../../packages/core/src/text/font/registry.ts)，Inter/PuHuiTi/NotoNaskh 三套 + tier 授权登记）+ PuHuiTi 9 字重子集内置（~20MB 普通 git 对象，D-e LFS 推延）+ 加载链三修（systemFontDataCache 会话缓存 / pending 态 textPicture 缓存沿用 / local-fonts 权限挂起解偶 P110+P111）+ patch P107-P112 | ✅ 已完成（C1-C6 全过；浏览器实证 PuHuiTi 渲染中文 + 字重切换无闪现；test:unit:quick 基线对照 100/100 fail（diff 仅 5 例双向 flake，零回归）） | [T39-plan](../tasks/T39-plan.md) | [T39-self-check](../tasks/T39-self-check.md) | [T39-verify](../tasks/T39-verify.md) |
| [T40](../tasks/T40-plan.md) | 字体子集化与 CDN 接入 | 中文网字计划 CDN 子集 provider（result.css 解析 + unicode-range 选片 + piece 级缓存）+ 内存治理（FontManager 单点字节预算 50MB + LRU 逐出 + 逐出联动 fontResolver.reset）+ web-fonts 浏览器门禁解除 + 注册表 CDN 家族（source:cdn）+ IndexedDB piece 缓存 + 同名塌缩修复（分片 alias 回退链）+ patch P113-P120 | ✅ 已完成（C1-C8 全过；浏览器实证 CDN 家族渲染中文；test:unit:quick 78 fail/2600 对照基线 100/2560，diff 仅 2 例已登记 flake，零回归） | [T40-plan](../tasks/T40-plan.md) | [T40-self-check](../tasks/T40-self-check.md) | [T40-verify](../tasks/T40-verify.md) |
| [T41](../tasks/T41-plan.md) | 可变字体支持 + 字体白名单可视化管理 | 可变字体全链路放行（D-b 收口 + wght 轴排版注入 + syst 回注册表）+ 白名单运行时管控（全来源含系统字体，bundled 恒开锁定）+ SettingsDialog Fonts 分区面板 + picker reload 失效 + 面板数据源 bug 修复（includeDisabled 不过滤枚举） | ✅ 已完成（C1-C9 全过；Playwright 实证 VF 250/900 渲染差异 + 面板三态复验；test:unit:quick 两轮 77/2615、76/2626 对照基线 78/2600 零回归） | [T41-plan](../tasks/T41-plan.md) | [T41-self-check](../tasks/T41-self-check.md) | [T41-verify](../tasks/T41-verify.md) |
| [T42](../tasks/T42-plan.md) | CDN 中文网字计划独立开关 + 全量目录支持 + 字体面板交互优化 | CDN 开关与在线 provider 解耦（cnFontsEnabled 独立门禁）+ @chinese-fonts 全量目录离线管线入仓（83 包探针 → 105 族，catalog 族默认关 opt-in）+ 面板 UX（状态筛选/折叠截断/来源开关区/批量启停） | ✅ 已完成（C1-C7 全过；Playwright 实证独立开关双向解耦 + catalog opt-in 端到端渲染；test:unit:quick 77 fail/2627/431 对照 T41 基线 76-77/2615-2626 零回归） | [T42-plan](../tasks/T42-plan.md) | [T42-self-check](../tasks/T42-self-check.md) | [T42-verify](../tasks/T42-verify.md) |
| [T43](../tasks/T43-plan.md) | Phase 3 · studio 资产文件机制内核（S4 W1 / T-A1，分支 rebuild/mode-arch） | 三类资产统一文件机制：两源扫描+同 id 覆盖 + frontmatter 解析 + 按类加载期校验 + 失败显式暴露数据面 + general 特例 + reload API | ✅ 已完成（C1-C8 全过：单测 16/16 + 门禁全绿 + 全量回归零 T43 文件失败（+1 MCP 并发 flake 隔离复跑 22/22 绿）；subagent 独立核验 V1-V7「可以收口」） | [T43-plan](../tasks/T43-plan.md) | [T43-self-check](../tasks/T43-self-check.md) | [T43-verify](../tasks/T43-verify.md) |
| [T44](../tasks/T44-plan.md) | Phase 3 · config.yaml 拆解迁移 + longform.md 骨架（S4 W1 / T-A2，吸收 T-A4 骨架） | 精品 profile 三份迁为 profiles/ 文件集（v3 模板基准 + editorial + solid，节名归一/applicable_to 改写/Recipe no-op 待 T-C3）+ 长图三 type 折叠进 workflows/longform.md 骨架 + 真目录钉扎测试；casual_v1 与退役集不迁；config.yaml 物理删除随 T-A3 | ✅ 已完成（C1-C5 全过：钉扎 1/1 + 保真 21/21 + 门禁九项全绿 + 全量回归 77→76 fail/2655 对照 T43 基线 78/2654 零新增；subagent 核验 V1-V7「可以收口」） | [T44-plan](../tasks/T44-plan.md) | [T44-self-check](../tasks/T44-self-check.md) | [T44-verify](../tasks/T44-verify.md) |
| [T45](../tasks/T45-plan.md) | Phase 3 · manifest 投影改源 + brand 链退役（S4 W1 / T-A3） | 端点更名 /api/pi/studio/manifest（modes 展开 + profiles 摘要 + failures 路径脱敏）+ service 改源 getStudioRegistry + overlay 适配 + 前端两件更名 + brand/ 目录删除退休 | ✅ 已完成（C1-C6 全过：端点实证 + grep 零残留 + 冒烟 29/29 与 17/17 + 门禁九项 + 回归 78 fail/2660 唯一 diff=已知 flake；subagent 核验 V1-V8「可以收口」，6 项轻微发现随收口修复） | [T45-plan](../tasks/T45-plan.md) | [T45-self-check](../tasks/T45-self-check.md) | [T45-verify](../tasks/T45-verify.md) |
| [T46](../tasks/T46-plan.md) | Phase 3 · base.md v0 落位 + 红线补洞 + base 候选清单建档（S4 W1 / T-A5） | 576 行 UI prompt 转写 studio/base.md（组装不动，W2/W3 接入）+ 四红线齐全性检查与修辞事实标注段（PD-20 ①）+ base 候选清单建档（PD-20 ②）+ 免 label schema 成文 + 钉扎 failures 收零 | ✅ 已完成（2026-08-31 收口） | [T46-plan](../tasks/T46-plan.md) | [T46-self-check](../tasks/T46-self-check.md) | [T46-verify](../tasks/T46-verify.md) |
| [T47](../tasks/T47-plan.md) | Phase 3 · W1 收口后修正批：base 转写源切换 + workbench 归档迁移 + 生图路线乙登记 | 转写源切 119 行 workflow 无关源 + workbench→attic/dsh-workbench 正名与错放迁移 + 生图路线乙（自写 DMX provider 核心 / pi-ai 扩展位 / SP-a2 探针取消） | ✅ 已完成（2026-08-31 收口） | [T47-plan](../tasks/T47-plan.md) | [T47-self-check](../tasks/T47-self-check.md) | [T47-verify](../tasks/T47-verify.md) |
| [T48](../tasks/T48-plan.md) | Phase 3 · watercolor_poster_v2 抢救性迁移 + T44 保真核验脚本修复 | v2 自 git 钉扎源补迁（节名归一/applicable_to→[longform]/真 Recipe 逐字）+ verify-t44 失效源修复（git 钉扎） | ✅ 已完成（2026-08-31 收口） | [T48-plan](../tasks/T48-plan.md) | [T48-self-check](../tasks/T48-self-check.md) | [T48-verify](../tasks/T48-verify.md) |
| [T49](../tasks/T49-plan.md) | Phase 3 · base 红线补洞段及机制撤除 + S1-product-spec.md §7 层归属修正 | base.md 纯转写化 + 补洞机制拆除 + S1-product-spec.md §7 删三行/五改宿主 + S4-phase3-plan.md 同步 | ✅ 已完成（2026-08-31 收口） | [T49-plan](../tasks/T49-plan.md) | [T49-self-check](../tasks/T49-self-check.md) | [T49-verify](../tasks/T49-verify.md) |
| (后续 task 按顺序登记)      | —                          | —                                                                                                                       | —                                                                                                                                            | —                                | —                                            | —                                    |

## 3. 三件套结构（强制）

每个 task 三个物理文件**职责分明**：

| 文件                    | 必含章节                                                                         | 禁止                                      |
| ----------------------- | -------------------------------------------------------------------------------- | ----------------------------------------- |
| **T<NN>-plan.md**       | §1 任务概述 / §2 任务清单 / §3 验收标准 / §4 关联文档 / §5 身份                  | 禁止含自检数字 / 禁止含核验报告           |
| **T<NN>-self-check.md** | §1 任务清单对照 / §2 承诺 vs 落地对照 / §3 完成度自评（实时期更新）/ §4 自评要点 | 禁止占位「待 owner 触发核验」             |
| **T<NN>-verify.md**     | §1 核验背景 / §2 逐条核验（subagent A 填报）/ §3 总评 / §4 综合判定              | 禁止复述自检；必须含独立证据命令 + 实测值 |

## 4. 与 records/ 的边界（D15 强化）

| 维度                         | 落点                                                              | 示例                              |
| ---------------------------- | ----------------------------------------------------------------- | --------------------------------- |
| **task 计划**                | `tasks/T<NN>-plan.md`                                             | T01-plan.md                       |
| **task 自检**                | `tasks/T<NN>-self-check.md`                                       | T01-self-check.md                 |
| **task 核验**                | `tasks/T<NN>-verify.md`                                           | T01-verify.md                     |
| **文件腐烂**                 | `records/narrative/<file>.md` §腐烂                               | 02-phase-0.md §0 删               |
| **文件修正**                 | `records/narrative/<file>.md` §修正                               | 02-phase-0.md 修正-2              |
| **文件核验**（针对文件状态） | `records/narrative/<file>.md` §核验                               | 02-phase-0.md R3                  |
| **跨文件横向决策**           | `records/topics/docs-governance.md`                               | D10 / D11 / D12 / D13 / D14 / D15 |
| **CI / merge / WIP**         | `records/topics/ci-infra.md` / `records/topics/upstream-merge.md` | CI-1 / MERGE-1                    |

**严禁**：把 task 自检/核验放进 `records/narrative/<file>.md`——破坏文件维度档案纯度（D14 §4.10 纪律）。

## 5. CI 拦截逻辑（D15）

`tools/zone-registry/src/check/tasks.ts` 检测大改动命中 + commit 含 `task: T<NN>` → 读任务表 → 检查 `existsSync(tasks/T<NN>-{plan,self-check,verify}.md)`。**任何一个缺失 → 拒绝 commit**。零正则、零章节、零语义判定。

详细纪律见 [05-process.md §3.1 gate review 第 5 项 + §4.11 三件套物理拆分纪律](../05-process.md)。

## 6. 任务实录归档（T00-T20，2026-08-25 自 [tracker.md §2](../tracker.md) 迁入）

> **归档依据**：2026-08-25 owner 决策批 #8 拍板 tracker 行数治理——tracker.md 任务表 T00-T20 行压缩为一句摘要 + 三件套链接，状态列长实录文本移至本节（每任务一节，原文照录，信息零丢失）。T00-T09 行原文本即摘要（状态列仅 ✅、验收列为短句），tracker 行未改动，本节照录其验收列原文备查；T10-T20 行为本次实际压缩对象。T21 起近期行保留在 tracker 原表，后续收口满一个阶段再归档。

### T00 · 文档集首轮整改（R1-R4 核查轮）

- **验收列原文**：✅ 完成（历史回填）
- **状态列原文**：✅

### T01 · 文档体系整改（plan-correction / tracker拆分 / check-docs / binding / tasks）

- **验收列原文**：✅ 完成（待 owner 验收）
- **状态列原文**：✅

### T02 · 文档纪律二次检查（05-process.md §5 迁移 + check-tasks 增强）

- **验收列原文**：✅ 完成（CI 11/11 全绿）
- **状态列原文**：✅

### T03 · 05-process.md §4.10 文件↔record 一一对应纪律补漏（D14 决策落地）

- **验收列原文**：✅ 完成（CI 11/11 全绿 + subagent A 18/18 通过）
- **状态列原文**：✅

### T04 · task 纪律 CI 强化（D15 三件套物理拆分 + 任务表路径检查）

- **验收列原文**：✅ 完成（CI 11/11 全绿 + subagent A 18/18 + 3 追加通过）
- **状态列原文**：✅

### T05 · 00-05 系统性腐烂 review（外部 proposal 内化 + 05-process.md §2 树状图重写 + D16 候选登记 + D17 本机绝对路径清理）

- **验收列原文**：✅ 完成（CI 11/11 全绿 × 2 commits + subagent A 19/19 通过）
- **状态列原文**：✅

### T06 · LFS cache 启用（每次 push 节省 ~99% 上游 LFS 流量）

- **验收列原文**：✅ 完成（setup-bun action.yml 加 actions/cache@v6）
- **状态列原文**：✅

### T07 · 修正 05-process.md §4.10 应用错误（横向档案 narrative 绑定撤回）+ 高频腐烂防御

- **验收列原文**：✅ 完成（核验由 T09 回填：subagent A 12 通过 + 1 警告，见 [T07-verify.md](T07-verify.md)）
- **状态列原文**：✅

### T08 · tracker.md 任务表删 PR 列（owner 提议）

- **验收列原文**：✅ 完成（CI 11/11 全绿 + subagent A 12/12 通过，commit 7d013794）
- **状态列原文**：✅

### T09 · review 发现核实与修复（CI 接线 + 占位检测 + 腐烂修正 + T06/T07 核验回填）

- **验收列原文**：✅ 完成（CI 12/12 全绿含新 Rebuild discipline job，run 32447539784 + subagent A 核验 N1-N5 闭环）
- **状态列原文**：✅

### T10 · upstream/master@5201404f 合并（79 commits/864 文件漂移）+ D20 登记 + spike 任务登记

- **验收列原文**：[T10-plan.md §3](T10-plan.md) 七条验收
- **状态列原文**：✅ 完成（远端 CI run 32458703514 12/12；rebuild/v2 ff → 1749b877）

### T11 · S-pi spike（pi sdk 库形态四项验证）

- **验收列原文**：[T11-plan.md §3](T11-plan.md)
- **状态列原文**：✅ 已完成（离线面全过 subagent 核验讫，commit e58a6ea9；活模型面由 T18 补跑完成——S-pi-1 活模型 8/8（openrouter/free，见 T18 行），原「阻塞待 owner 补 key」已消解，2026-08-25 翻 ✅）

### T12 · S-X spike（dsh-X 六项验证含硬 gate）

- **验收列原文**：[T12-plan.md §3](T12-plan.md)
- **状态列原文**：✅ 已完成（CI run 32560998564 12/12；X5 硬 gate 通过；模型面阻塞已上报）

### T13 · D22 拍板后收口：双 spike 合并回归 + dsh 版本钉扎纪律 + S-X 模型面补跑

- **验收列原文**：[T13-plan.md §3](T13-plan.md)
- **状态列原文**：✅ 已完成（合并回归+版本纪律 CI run 32563228158 全绿；X3/X6 模型面 2026-08-23 以 openrouter/free 实测通过——真实工具调用 → 7600 桥 → 活编辑器回包，证据 workbench/evidence/t13-x3-x6-openrouter-live.png；S-pi 模型面随 pi 产品版后置 D22）

### T14 · 插件骨架产品化（MS-X1：workbench/ bundle 骨架 + 版本钉扎 + dev 回路 + HMR 决策点证伪）

- **验收列原文**：[T14-plan.md §3](T14-plan.md)
- **状态列原文**：✅ 已完成（装机冒烟 + HMR A 级证伪 + CI job；远端 CI run 32569154626 全绿）

### T15 · M2 编辑器入孤岛（E1 CanvasKit wasm 探针 → E2 编辑器外壳 → E3 生命周期 → E4 冒烟收口）

- **验收列原文**：[T15-plan.md §3](T15-plan.md)
- **状态列原文**：✅ 已完成（E1-E4 全过 + subagent 核验 V1-V8「可以提交」；远端 CI HEAD run 32576137352 全绿）

### T16 · 7600 桥真链路 + token 链（M3+M4 链路半：真桥起服 → island 桥客户端 → host 工具端到端）

- **验收列原文**：[T16-plan.md §3](T16-plan.md)
- **状态列原文**：✅ 已完成（B1-B4 全过 + subagent 核验 V1-V8「可以提交」；远端 CI HEAD run 32579903008 全绿）

### T17 · ChatPanel 消费 SessionFace（M3 消息回路半：绑定层 → 消息流渲染 → 发送回路 → 控制面 → 端到端冒烟）

- **验收列原文**：[T17-plan.md §3](T17-plan.md)
- **状态列原文**：✅ 已完成（C1-C5 全过 + subagent 独立核验 V1-V8「可以提交」；远端 CI HEAD run 32611136517 全绿）

### T18 · pi SDK 主线启动（D24）：rebuild/pi 分支 + pi 版本钉扎纪律 + S-pi 活模型面补跑 + 01 F0 地面依据 post-merge 核查

- **验收列原文**：[T18-plan.md §3](T18-plan.md)
- **状态列原文**：✅ 已完成（P1-P4 全过：S-pi-1 活模型 8/8 + S-pi-2 主线 7/7 + 钉扎纪律 + F0 四行修正；subagent 独立核验 V1-V8「可以提交」含改参防伪造复跑；远端 CI rebuild/pi run 32627633002 全绿）

### T19 · 后端换心（F0.1/F0.4）：pi SDK 薄 service + UIMessage v1 SSE 契约 + 前端 Chat 类零改动（文本回路）

- **验收列原文**：[T19-plan.md §3](T19-plan.md)
- **状态列原文**：✅ 已完成（P1-P5 全过：后端冒烟 14/14 + 重启恢复 RECOVERY-PASS + 真实 Chromium 浏览器冒烟 7/7；subagent 独立核验 V1-V8「可以提交」；远端 CI rebuild/pi run 32637559364 全绿；CI 三连红事故链与 oxfmt 平台坑实录见 [T19-self-check.md §2.7](T19-self-check.md)）

### T20 · 工具链路：后端独立进程化（owner 拍板：非 vite 中间件）+ hello-tool 全链 + 工具事件映射（工具卡片可见）

- **验收列原文**：[T20-plan.md §3](T20-plan.md)
- **状态列原文**：✅ 已完成（P1-P5 全过：API 冒烟 18/18 + 浏览器冒烟全绿含卡片 pending→完成 + nodeId↔画布对账 + T19 回归 15/15；willRetry 提前 finish 根因修复见 [T20-self-check §2.3](T20-self-check.md)；subagent 独立核验 V1-V8「可以收口」；远端 CI rebuild/pi run 32645061123 全绿）

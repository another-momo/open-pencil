<!--
  写作纪律（改本文前必读）：
  - 事实性声明必须附核验命令 + 日期，否则标为【假设】
  - 本文只保留当前态，不保留修正历史
  - 详细规则见 docs/rebuild/05-process.md §4
-->

# tasks/T27-plan.md · T27 三方 review 整改（代码+机制面）

> **T 编号**：T27（Phase 1 收口后整改 · 代码与机制面）
> **状态**：✅ 已收口（实施+自查完成；独立核验见 [T27-verify.md](T27-verify.md)）

## 1. 背景与立项依据

2026-08-25 Phase 0+1 三方 review（主 agent 两个独立 subagent + 外部 kimi_K3 + 外部 minimax_M3，报告在仓库上层 `docs/20260825-*.md`）后，owner 指令：基于三份 review 结果拆分两个任务逐条核实与改进，每条发现的处置只能是——证实并改进 / 证伪放弃 / 因改动量或产品面影响报送 owner 决策。T27 承载**代码与机制面**，T26 承载**文档叙事面**。

关键背景事实（2026-08-25 主 agent 实证）：

- kimi/minimax 审计基线早于 T25 最终收口（kimi 自述基线 b85caa33+staged 混合态），部分发现需先复核时效性
- T22 CI 假绿经 `gh run view 32687026233 / 32687981729` 证实（均 failure）——文档面更正在 T26
- minimax 的 harness 残留发现经 grep 证实存在（constants.ts:190/212、ProviderSelect.vue:65、PiModelsPanel harnessThinking* 键）
- minimax 的「T25 self-check/verify 错位」经读盘证伪（T25-verify.md 磁盘态已 ✅ V1-V6）

## 2. 验收清单

- C1 处置三分法全覆盖：交办清单 A1-A24 / B1-B3 / C1-C5 每条有「证实并改进 / 证伪放弃 / 报送 owner」之一的明确结论 + 证据
- C2 代码改动质量：主 agent 逐文件 diff 抽查无返工项
- C3 门禁全绿：tsgo / lint / check:vue / check:zones / check:docs / check:bindings / check:tasks / check:i18n / check:monorepo / check:arch / test:type-shapes / test:tools / test:dupes / check:deps / oxfmt（format 脚本口径）本地实跑全绿；check:audit / check:secrets 本机环境受限项须证实与改动无关（干净基线同态）
- C4 冒烟回归：`bun run smoke:pi`（本任务新增正式入口：t22 target 6 + history 12 + t23 sessions 14 + t24 prompt-assembly 27 = 59 断言）全绿
- C5 三区登记：follow 区改动全部登记 zones.json patch（P51-P56 + 既有条目追加注记），删除文件登记 deletedPaths，check:zones 绿
- C6 远端 CI rebuild/pi 全绿（gh run view 复验结论，05 附录 B.3 口径）

## 3. 处置清单（交办合并口径）

### 3.1 证实并改进（实施面）

| # | 项 | 落点 |
|---|---|---|
| A1 | session 串行队列 rejection 接力（`.catch(() => undefined)` 防永久卡死） | pi-backend/service.ts |
| A2 | SSE 断连 `res.on('close')` → service.abort（停烧 token）；只读路由统一 try/catch 500 | server.ts / service.ts |
| A3 | vite 插件后端崩溃有限次复活（3 次退避，健康即清零） | vite-plugin.ts |
| A4 | ensureChat 调用序号防跨 tab await 竞态；onSessionReset 返回 Promise、resetChat await | chat/transports.ts / use.ts |
| A5 | 旧 ToolLoop 死数据面切除（tools/index.ts 整删、showContinue/Continue 死 UI、debug 三节裁剪） | tools/index.ts（删）/ ChatPanel.vue / debug/index.ts |
| A6 | ChatInput 提交失败草稿回填（defineExpose restoreDraft） | ChatInput.vue / ChatPanel.vue |
| A7 | check:secrets 缺二进制打 SKIPPED exit 0（CI 仍真扫） | tools/secret-scan |
| A8 | injectKeyEnv 读文件失败降级不炸启动（文案不含内容） | pi-backend/main.ts |
| A9 | index.json tmp+rename 原子写；读失败出声（仅路径+错误类型） | service.ts |
| A10 | readBody 4MB 上限 413 | server.ts |
| A11 | SSE 帧 JSON.parse try/catch 跳坏帧 | pi-backend/transport.ts |
| A12 | tools.ts 401/网络无变化重试核实处置 | pi-backend/tools.ts |
| A13 | ChatPanel setTimeout(100) 魔法数 → resetChat().then 确定性刷新 | ChatPanel.vue |
| A14 | catalog DTO 纯类型契约单源化（catalog.ts 新模块） | pi-backend/catalog.ts（新增）/ client.ts / provider-admin.ts |
| A15 | 冒烟正式入口 smoke:pi / smoke:pi:ui + 头注释 stale 路径修正 | package.json / spikes smoke 两文件 |
| A16 | harness 死标识清理（constants.ts union/常量/def、ProviderSelect.vue 整删、harnessThinking*→piThinking*） | constants.ts / ProviderSelect.vue（删）/ i18n 两文件 / PiModelsPanel.vue |
| A17 | check:bindings 语义修正（[no-record] 非豁免；narrative 删除方向防孤儿） | check/bindings.ts |
| A18 | check:docs R1/R2/R3 锚定头部（前 30 行首个引用块） | check/docs.ts |
| A19 | pre-commit 纯代码大改动也触发 check:tasks | tools/hooks/pre-commit |
| A20 | steiger drift 收口（补注册 5 条零违规；3 条存量违规注释挂起；2 条启用即崩修复） | steiger.config.ts / steiger-rules/index.ts |
| A21 | RPC_TIMEOUT 环境变量化（OPENPENCIL_RPC_TIMEOUT_MS，默认 20s 不变） | packages/mcp/browser-rpc.ts |
| A22 | models.json 启动期最小结构校验（文案不含 key）+ runtime 初始化失败不留死 promise | provider-admin.ts |
| A23 | scratch/ 非死配置（steiger 规则指定放置区）注记保留 | .gitignore |
| A24 | dev 日志平铺清理（.openpencil/ 本地零散 log 删除，不入库面） | 本地动作 |

### 3.2 证伪/已消解（复核结论）

- B1 并发双创建窗口：dev 单用户+流式禁发下不可达（防御代码目的已达）
- B2 pi loginError 是否回显 key：未能证实所有分支不回显——assertKeyCarriable 已拦空白字符，保持监测
- kimi H-2「T25 staged 混合态」：时效性发现，T25 已四 commit 收口入库
- minimax「T25 self-check/verify 错位」：证伪（磁盘态 verify 已 ✅）
- minimax「层 1 未达成=Phase 1 缺陷」：口径错位（层 1 属 parity 线前独立层，Phase 1 出口是 runtime spike）
- knip 4 项（taskkill/tabs）为 pre-existing latent，非本任务引入（git diff 0 行实证）；经白名单收口，报送 owner 复核

### 3.3 报送 owner（本任务不动）

- pi 后端零鉴权（写 key/baseUrl 端点经 vite proxy 暴露；建议复用 7600 桥 token 模式）
- session GC/rotate 策略（pi-sessions 只增不减）
- 大包结构项：SceneGraph 拆分 / core barrel / stock-photo 移层 / packages noUnusedLocals / kiwi oxlint 豁免 / packages 内联测试 / unit test 进 CI / CI e2e+契约测试
- 机制信任根：分支保护（gh api 实测 404）/ 补丁 hunk 机器化 / zones.json 自改报警
- check:tasks 阈值博弈加固、占位正则纳「待核验」
- smoke:pi 依赖本机既有 pi-sessions fixture（新机首跑前置失败）的供给策略
- format:check 净树判据在脏工作树结构性必红的口径缺陷

## 4. 实施分解（实录）

单 subagent 执行（交办清单逐条），主 agent 逐文件 diff 抽查把关后收口。改动面：src/app/ai/pi-backend/ 9 文件（+catalog.ts 新增）、src/app/ai/chat/ 2 文件、src/app/ai/tools/ 整删、debug/index.ts 裁剪、组件 4 文件（ProviderSelect.vue 删）、packages/core constants.ts、packages/mcp browser-rpc.ts、i18n 两文件、tools 四检查器/钩子、steiger 两文件、spikes 冒烟两文件注释、package.json/knip.json/.gitignore、zones.json（P51-P56 + 追加注记）。

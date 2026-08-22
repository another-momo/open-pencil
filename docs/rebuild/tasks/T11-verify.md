<!--
  写作纪律（改本文前必读）：
  - 事实性声明必须附核验命令 + 日期，否则标为【假设】
  - 计划被实测推翻时，直接改本文为新版本，完整理由记入 records/ 子文档
  - 本文只保留当前态，不保留修正历史
  - 改完后刷新本文头部的「状态」字段
  - 详细规则见 docs/rebuild/05-process.md §4
-->

# tasks/T11-verify.md · T11 subagent 核验报告（离线面）

> **T 编号**：T11（S-pi spike 执行 · pi sdk 路线实证）
> **核验时间**：2026-08-21（离线面；活模型面阻塞待 owner 补 key，核验范围不含活模型项）

## 1. 核验背景

T11 按 spikes/02 §6（D2 修正版）+ spikes/05 §6 执行直用 pi SDK 路线实证。本次核验覆盖**离线面**（S-pi-1/S-pi-3/S-pi-2 前置/S-pi-4 走读）与文档合规；活模型面（S-pi-1 活模型、S-pi-2 通道 B/A、S-pi-3 流式崩溃残留项）因环境无任何 LLM API key（2026-08-21 `printenv` 实测）未核验，属明示阻塞而非通过。

**核验人**：subagent（general-purpose，只读核查 + 重跑测试，未修改任何文件）
**时间**：2026-08-21
**范围**：`spikes/s-pi/` 两离线测试重跑 + [T11-self-check.md](T11-self-check.md) §2 声明逐条抽查 + D19 占位探针 + 改动面合规
**依据**：[05-process.md §3.1 gate review 第 6 步](../05-process.md) + [T11-plan.md §3 验收标准](T11-plan.md)

## 2. 逐条核验（subagent 实测）

| # | 声明 | 结果 | 实测值（2026-08-21） |
|---|---|---|---|
| 1 | 离线测试全过 | ✅ | `npm run test:offline` 退出码 0；offline-echo.mjs **8 PASS / 0 FAIL**，offline-session-persistence.mjs **16 PASS / 0 FAIL**（grep 实测计数） |
| 2 | deepseek 条目 input 字段 | ✅ | pi-ai 0.84.2 包内 `dist/providers/data/deepseek.json` 仅 2 模型（deepseek-v4-flash/pro），均 `input:["text"]`、`reasoning:true`、`thinkingFormat:"deepseek"`、contextWindow 1M |
| 3 | blockImages 降级机制 | ✅ | `sdk.js:140` convertToLlmWithBlockImages 确有，`:154` image→`"Image reading is disabled."` 占位替换；触发条件为 `settingsManager.getBlockImages()` 设置项（非模型能力），作用于 user/toolResult |
| 4 | SDK 公开面 | ✅ | `model-runtime.d.ts:96` registerNativeProvider；`sdk.d.ts` CreateAgentSessionOptions 四字段（modelRuntime:16 / model:18 / customTools:47 / sessionManager:51）俱在 |
| 5 | `tools: []` 空 allowlist 全禁 | ✅ | `agent-session.js:1945` isAllowedTool 逻辑确认（空 Set truthy → 全禁含 customTools；self-check 引用行号 1941 与实测 1945 差 4 行，无伤） |
| 6 | S-pi-4 映射表事件存在性 | ✅ | 表上全部事件（含 auto_retry_start）均存在于 AgentEvent/AgentSessionEvent 类型联合（pi-agent-core types.d.ts:374 / agent-session.d.ts:40）；无虚构事件 |
| 7 | 上游参照行号 | ✅ | mapPart 精确位于 open-pencil-rebuild packages/harness/src/backends/pi.ts:62-89（逐行数过）；mapEvent 精确位于 src/app/ai/harness/transport.ts:28-62 |
| 8 | D19 占位探针 | ✅ | T11-plan/self-check、spikes/s-pi/README.md 与 *.mjs 对 D19 正则零命中；§3 阻塞清单「待 owner 补 key」不匹配正则且附证据，属如实披露非占位 |
| 9 | 改动面合规 | ✅ | `git status --short` 仅 `?? docs/rebuild/tasks/T11-self-check.md` 与 `?? spikes/`（仅 s-pi/）；无越界路径；tests/fixtures/ LFS phantom 本次未复现 |
| 10 | 增量落盘结论真实性 | ✅ | 阶段 A 断言真实（prompt 返回后、dispose 前 readFileSync 已得 5 条目）；外推边界（同步微任务推流 vs 真实慢速流式崩溃）在 self-check §2.3/§3 如实标注 |

## 3. 核验发现与处置（2 错误 + 1 夸大 + 1 命名微瑕）

| # | 严重度 | 发现 | 处置 |
|---|---|---|---|
| F1 | ❌ 错误 | self-check 原称「npm ls 全 deduped 无双实例风险」——物理核查确认 pi-ai@0.84.2 与 typebox@1.3.7 各有**两份物理拷贝**（顶层 + pi-coding-agent/node_modules 嵌套，同版本逐字节相同）；npm ls 的 deduped 标记误导 | 已修正 §2.2：如实记录双拷贝事实 + 风险边界（仅跨拷贝 instanceof 有害，本 spike 未触发；实施 task 排查指引） |
| F2 | ❌ 错误 | S-pi-3 断言数原写 17/17，实测 **16/16**（源文件 16 处 check()） | 已修正 §1/§2.3 两处计数 |
| F3 | ⚠️ 夸大 | §2.5 原称映射表左列「均为实测时间线真实出现」，但 `auto_retry_start` 从未在实测出现（类型中存在，spike 未触发） | 已修正：明示 auto_retry_start 来自类型联合非实测；并补记有意略去事件清单（tool_execution_update 等）供实施 task 补评估 |
| F4 | ⚠️ 微瑕 | §2.5 称 mapEvent 输入为 BackendEvent，实际类型名 HarnessTurnEvent（protocol.ts:49；与 BackendEvent 结构等价） | 已修正命名 |

处置方式：按文档纪律**就地修正** self-check（当前态为修正后版本），修正历史以本表为准。

## 4. 结论

- 离线面声明**基本属实**：两测试真实全过；SDK 公开面、deepseek 条目、上游行号引用全部独立验证为真；活模型阻塞系如实披露。
- F1-F4 均已就地修正并经主 agent 复核；无颠覆性问题。
- T11 当前状态：**离线面全过且经独立核验；活模型面阻塞（证据见 [T11-self-check.md §3](T11-self-check.md)），待 owner 补 key 后补验，届时本文档追加活模型面核验记录**。
